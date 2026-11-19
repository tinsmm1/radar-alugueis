"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Photo } from "./photo";

/** Card photo with arrows to browse the listing's photos without opening it. */
export function CardPhotos({ photos, fallback, alt, className }: { photos: string[] | null; fallback: string | null; alt: string; className?: string }) {
  const list = photos?.length ? photos : fallback ? [fallback] : [];
  const [i, setI] = useState(0);
  const n = list.length;
  const go = (e: React.MouseEvent, d: number) => {
    e.preventDefault();
    e.stopPropagation();
    setI((x) => (x + d + n) % n);
  };
  return (
    <div className={cn("relative", className)}>
      <Photo src={list[i] ?? null} alt={n > 1 ? `${alt}, foto ${i + 1} de ${n}` : alt} className="size-full" />
      {n > 1 && (
        <>
          <button type="button" onClick={(e) => go(e, -1)} aria-label="Foto anterior" className="absolute top-1/2 left-2 z-20 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-zinc-900 shadow transition-opacity hover:bg-white md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100">
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" onClick={(e) => go(e, 1)} aria-label="Próxima foto" className="absolute top-1/2 right-2 z-20 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-zinc-900 shadow transition-opacity hover:bg-white md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100">
            <ChevronRight className="size-4" />
          </button>
          <span className="absolute bottom-2 left-1/2 z-20 -translate-x-1/2 rounded-full bg-zinc-900/70 px-2 py-0.5 text-[11px] text-white tabular-nums">{i + 1}/{n}</span>
        </>
      )}
    </div>
  );
}
