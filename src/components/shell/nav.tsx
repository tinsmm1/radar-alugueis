"use client";
import Link from "next/link";
import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { Mode } from "@/domain/listing";
import { parseMode } from "@/lib/mode";
import { Bell, Columns3, Compass, Heart, Map, Search, Settings, Sparkles, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { ModeSwitch } from "./mode-switch";

export const NAV = [
  { href: "/", label: "Buscar", icon: Search },
  { href: "/guia", label: "Guia", icon: Compass },
  { href: "/oportunidades", label: "Oportunidades", icon: Sparkles },
  { href: "/bairros", label: "Bairros", icon: Map },
  { href: "/comparar", label: "Comparar", icon: Columns3 },
  { href: "/favoritos", label: "Favoritos", icon: Heart },
  { href: "/buscas", label: "Buscas salvas", icon: Bookmark },
] as const;

function active(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Mode-aware pages keep the current mode in their links. */
const MODE_PAGES = new Set(["/", "/guia", "/oportunidades", "/bairros", "/comparar", "/favoritos"]);

function useHref(mode: Mode) {
  return (href: string) => (MODE_PAGES.has(href) ? `${href}?modo=${mode}` : href);
}

/** Top bar (desktop/tablet) and bottom bar (phone). Mode switch, bell and gear are always visible. */
export function Nav(props: { unread: number; compareCount?: number; mode: Mode }) {
  return (
    <Suspense fallback={<NavInner {...props} urlMode={null} />}>
      <NavWithParams {...props} />
    </Suspense>
  );
}

function NavWithParams(props: { unread: number; compareCount?: number; mode: Mode }) {
  const params = useSearchParams();
  return <NavInner {...props} urlMode={parseMode(params.get("modo"))} />;
}

function NavInner({ unread, compareCount, mode: initial, urlMode }: { unread: number; compareCount?: number; mode: Mode; urlMode: Mode | null }) {
  const pathname = usePathname();
  const mode = urlMode ?? initial;
  const link = useHref(mode);
  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-2 px-4 lg:px-6">
          <Link href={link("/")} className="mr-3 shrink-0" aria-label="Radar Aluguéis BH, início">
            <Logo className="[&>span:last-child]:hidden sm:[&>span:last-child]:inline" />
          </Link>
          <ModeSwitch initial={mode} className="mr-2" />
          <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Principal">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={link(href)}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                  active(pathname, href) && "bg-accent text-accent-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
                {href === "/comparar" && compareCount ? <span className="rounded-full bg-primary px-1.5 text-[11px] leading-5 text-primary-foreground">{compareCount}</span> : null}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <Link href="/notificacoes" className={cn("relative inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground", active(pathname, "/notificacoes") && "bg-accent text-accent-foreground")} aria-label={unread ? `Notificações: ${unread} novas` : "Notificações"}>
              <Bell className="size-[18px]" />
              {unread > 0 && <span className="absolute top-1 right-1 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] leading-4 font-semibold text-white">{unread > 99 ? "99+" : unread}</span>}
            </Link>
            <Link href="/admin" className={cn("inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground", active(pathname, "/admin") && "bg-accent text-accent-foreground")} aria-label="Administração">
              <Settings className="size-[18px]" />
            </Link>
          </div>
        </div>
      </header>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Principal (celular)">
        {NAV.filter((n) => n.href !== "/buscas" && n.href !== "/bairros").map(({ href, label, icon: Icon }) => (
          <Link key={href} href={link(href)} className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground", active(pathname, href) && "text-primary")}>
            <Icon className="size-5" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
