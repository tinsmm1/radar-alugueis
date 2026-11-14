import "server-only";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { isIP } from "node:net";
import { Agent, fetch as undiciFetch, type Response } from "undici";

export const USER_AGENT_BASE = "RadarAlugueisBH/1.0 (monitor pessoal de alugueis)";

/** IPv6 text → 16 bytes (handles "::" and a trailing dotted IPv4); null if malformed. */
function ipv6Bytes(ip: string): number[] | null {
  let s = ip.toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  const dotted = /(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (dotted) {
    const v4 = dotted[1].split(".").map(Number);
    s = s.slice(0, -dotted[1].length) + ((v4[0] << 8) | v4[1]).toString(16) + ":" + ((v4[2] << 8) | v4[3]).toString(16);
  }
  const [head, tail] = s.includes("::") ? s.split("::") : [s, null];
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const groups = tail === null ? h : [...h, ...Array(8 - h.length - t.length).fill("0"), ...t];
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.flatMap((g) => [parseInt(g, 16) >> 8, parseInt(g, 16) & 255]);
}

function privateV4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
}

/**
 * Private, loopback, link-local, CGNAT, multicast and reserved ranges (IPv4 and IPv6). IPv6
 * forms that embed an IPv4 address (mapped ::ffff:0:0/96, compatible ::/96, NAT64 64:ff9b::/96,
 * 6to4 2002::/16) are judged by the embedded IPv4.
 */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) return privateV4(ip);
  const b = ipv6Bytes(ip);
  if (!b) return true;
  const v4 = (o: number) => `${b[o]}.${b[o + 1]}.${b[o + 2]}.${b[o + 3]}`;
  const zeros = (n: number) => b.slice(0, n).every((x) => x === 0);
  if (zeros(10) && b[10] === 0xff && b[11] === 0xff) return privateV4(v4(12));
  if (zeros(12)) return true; // ::, ::1 and deprecated IPv4-compatible addresses
  if (b[0] === 0x00 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b) return privateV4(v4(12));
  if (b[0] === 0x20 && b[1] === 0x02) return privateV4(v4(2));
  if ((b[0] & 0xfe) === 0xfc) return true; // unique local fc00::/7
  if (b[0] === 0xfe && (b[1] & 0xc0) === 0x80) return true; // link-local fe80::/10
  if (b[0] === 0xff) return true; // multicast
  return false;
}

export class FetchError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

/**
 * DNS is checked when the socket connects (not before), so a hostname cannot resolve to a
 * public address for a check and to a private one for the request (DNS rebinding).
 */
const guardedAgent = new Agent({
  connect: {
    lookup(hostname, options, callback) {
      dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
        if (err) return callback(err, "", 0);
        const list = addresses as unknown as LookupAddress[];
        const bad = list.find((a) => isPrivateAddress(a.address));
        if (bad || !list.length) return callback(new FetchError("Endereço de rede não permitido."), "", 0);
        const opts = options as { all?: boolean };
        if (opts.all) (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, list);
        else callback(null, list[0].address, list[0].family);
      });
    },
  },
  headersTimeout: 20_000,
  bodyTimeout: 30_000,
});

export type SafeFetchOptions = {
  maxBytes?: number;
  timeoutMs?: number;
  accept?: string;
  method?: "GET" | "POST";
  body?: string;
  headers?: Record<string, string>;
  /** Hosts allowed to be redirected to (default: any public host). */
  allowRedirectTo?: (url: URL) => boolean;
};

/** Validates a user-supplied URL: http(s), no credentials, no literal private IPs, default ports. */
export function assertPublicUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new FetchError("Endereço inválido.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new FetchError("Use um endereço http(s).");
  if (url.username || url.password) throw new FetchError("Endereço com usuário/senha não é aceito.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) === 6) throw new FetchError("Use um nome de domínio (endereços IPv6 literais não são aceitos).");
  if (isIP(host) && isPrivateAddress(host)) throw new FetchError("Endereço de rede não permitido.");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new FetchError("Endereço de rede não permitido.");
  if (url.port && !["80", "443"].includes(url.port)) throw new FetchError("Porta não permitida.");
  return url;
}

/**
 * Outbound GET/POST for feeds and public data: SSRF-guarded on every hop (manual redirects,
 * connect-time DNS check), size cap, timeout and an identifying User-Agent.
 */
export async function safeFetch(raw: string, opts: SafeFetchOptions = {}): Promise<{ url: string; status: number; contentType: string; body: Buffer }> {
  const maxBytes = opts.maxBytes ?? 4 * 1024 * 1024;
  const deadline = AbortSignal.timeout(opts.timeoutMs ?? 30_000);
  let url = assertPublicUrl(raw);
  for (let hop = 0; hop < 5; hop++) {
    const res: Response = await undiciFetch(url, {
      method: opts.method ?? "GET",
      body: opts.body,
      dispatcher: guardedAgent,
      redirect: "manual",
      signal: deadline,
      headers: { "user-agent": USER_AGENT_BASE, accept: opts.accept ?? "*/*", "accept-language": "pt-BR,pt;q=0.9", ...opts.headers },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      await res.body?.cancel();
      const next = assertPublicUrl(new URL(res.headers.get("location")!, url).toString());
      if (opts.allowRedirectTo && !opts.allowRedirectTo(next)) throw new FetchError("Redirecionamento para outro site recusado.", res.status);
      url = next;
      continue;
    }
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > maxBytes) {
      await res.body?.cancel();
      throw new FetchError(`Arquivo grande demais (limite ${Math.round(maxBytes / 1048576)} MB).`, res.status);
    }
    const chunks: Buffer[] = [];
    let size = 0;
    if (res.body) {
      for await (const chunk of res.body) {
        size += chunk.length;
        if (size > maxBytes) throw new FetchError(`Arquivo grande demais (limite ${Math.round(maxBytes / 1048576)} MB).`, res.status);
        chunks.push(Buffer.from(chunk));
      }
    }
    return { url: url.toString(), status: res.status, contentType: res.headers.get("content-type") ?? "", body: Buffer.concat(chunks) };
  }
  throw new FetchError("Redirecionamentos demais.");
}

/** Decodes a body as UTF-8, or Latin-1 when the declared charset or invalid bytes say so. */
export function decodeText(body: Buffer, contentType = ""): string {
  if (/charset=(iso-8859-1|latin1|windows-1252)/i.test(contentType)) return body.toString("latin1");
  const utf8 = body.toString("utf8");
  return utf8.includes("�") ? body.toString("latin1") : utf8;
}

/** Waits between calls to the same host (Nominatim ≥ 1 s, others a little). */
const lastCall = new Map<string, number>();
export async function politeGap(host: string, gapMs: number): Promise<void> {
  const wait = (lastCall.get(host) ?? 0) + gapMs - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall.set(host, Date.now());
}
