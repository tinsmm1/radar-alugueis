"use client";
import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2, KeyRound } from "lucide-react";
import type { Mode } from "@/domain/listing";
import { MODE_COOKIE, parseMode, withMode } from "@/lib/mode";
import { cn } from "@/lib/utils";

/** Remembers the mode (cookie) and applies its accent to the whole document, portals included. */
function applyMode(mode: Mode) {
  document.cookie = `${MODE_COOKIE}=${mode}; path=/; max-age=31536000; samesite=lax`;
  document.documentElement.dataset.mode = mode;
}

/**
 * "Alugar | Comprar": switches the whole hub. The choice goes to the URL (shareable) and to a
 * cookie (remembered across pages); the accent colour follows it (data-mode on <html>).
 */
export function ModeSwitch({ initial, className }: { initial: Mode; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const mode = parseMode(params.get("modo")) ?? initial;

  useEffect(() => applyMode(mode), [mode]);

  const go = (next: Mode) => {
    if (next === mode) return;
    applyMode(next);
    const q = params.toString();
    router.push(withMode(pathname + (q ? `?${q}` : ""), next));
    router.refresh();
  };

  return (
    <div role="radiogroup" aria-label="Modo do radar" className={cn("inline-flex rounded-xl border bg-muted/60 p-0.5", className)}>
      {([["aluguel", "Alugar", KeyRound], ["compra", "Comprar", Building2]] as const).map(([m, label, Icon]) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={mode === m}
          onClick={() => go(m)}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-[10px] px-3 text-sm font-semibold transition-colors",
            mode === m ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}
