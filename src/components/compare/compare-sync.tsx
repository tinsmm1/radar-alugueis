"use client";
import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCompare } from "@/lib/compare";

/**
 * Keeps the comparator selection (this browser) and the URL (?ids=…) in sync: a shared link
 * fills an empty selection; afterwards the selection drives the URL so the server re-renders.
 */
export function CompareSync({ urlIds }: { urlIds: number[] }) {
  const { ids, set } = useCompare();
  const router = useRouter();
  const pathname = usePathname();
  const modo = useSearchParams().get("modo");
  const adopted = useRef(false);
  const url = urlIds.join(",");
  const local = ids.join(",");
  useEffect(() => {
    if (!adopted.current) {
      adopted.current = true;
      if (!local && url) {
        set(urlIds);
        return;
      }
    }
    if (local !== url) {
      const q = new URLSearchParams();
      if (local) q.set("ids", local);
      if (modo) q.set("modo", modo);
      router.replace(q.size ? `${pathname}?${q}` : pathname, { scroll: false });
    }
  }, [local, url, urlIds, set, router, pathname, modo]);
  return null;
}

export function RemoveFromCompare({ id }: { id: number }) {
  const { remove } = useCompare();
  return (
    <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(id)} aria-label="Remover do comparador" className="rounded-full bg-white/90 shadow-sm hover:bg-white">
      <X />
    </Button>
  );
}

export function ClearCompare() {
  const { clear, ids } = useCompare();
  if (!ids.length) return null;
  return (
    <Button type="button" variant="outline" size="sm" onClick={clear}>
      Limpar comparador
    </Button>
  );
}
