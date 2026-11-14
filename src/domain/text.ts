/** Lowercase, no accents, single spaces: the key used to compare names and addresses. */
export function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const SMALL = new Set(["da", "das", "de", "do", "dos", "e"]);

/** "SAO PEDRO" / "são pedro" → "São Pedro" (keeps accents; small words lowercase). */
export function titleCase(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((w, i) => (i > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/** Word set without stop words, for title/description similarity. */
function tokens(value: string): Set<string> {
  return new Set(
    normalizeText(value)
      .split(" ")
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}
const STOP = new Set(["com", "para", "por", "uma", "dos", "das", "nos", "nas", "the", "apto", "apartamento", "aluguel", "venda"]);

/** Jaccard similarity of word sets (0..1). Empty texts are 0, never a match. */
export function textSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  const x = tokens(a ?? "");
  const y = tokens(b ?? "");
  if (!x.size || !y.size) return 0;
  let inter = 0;
  for (const w of x) if (y.has(w)) inter++;
  return inter / (x.size + y.size - inter);
}

/** Escape LIKE wildcards in user text. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
// Brazilian phone numbers: (31) 99999-9999, 31 3333-4444, +55 31 999999999, 31999999999.
const PHONE = /(\+?55[\s.-]?)?\(?\b\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}\b/g;

/** Removes e-mails and phone numbers from free text (LGPD: contact data is not kept). */
export function scrubContacts(text: string): string {
  return text.replace(EMAIL, "[contato removido]").replace(PHONE, "[contato removido]");
}
