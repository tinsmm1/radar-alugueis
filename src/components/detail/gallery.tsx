"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Images } from "lucide-react";
import { Photo } from "@/components/property/card";
import { cn } from "@/lib/utils";

/** Photo gallery: main photo with arrows and a thumbnail strip (keyboard accessible). */
export function Gallery({ photos, title }: { photos: string[]; title: string }) {
  const [i, setI] = useState(0);
  const n = photos.length;
  const go = (d: number) => setI((x) => (x + d + n) % n);
  if (!n) {
    return (
      <div className="relative overflow-hidden rounded-2xl border">
        <Photo src={null} alt={title} className="aspect-[16/9] w-full" />
        <p className="absolute inset-x-0 bottom-3 text-center text-xs text-muted-foreground">A fonte não enviou fotos deste imóvel.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="group relative overflow-hidden rounded-2xl border bg-muted" onKeyDown={(e) => (e.key === "ArrowLeft" ? go(-1) : e.key === "ArrowRight" ? go(1) : undefined)}>
        <Photo src={photos[i]} alt={`${title}, foto ${i + 1} de ${n}`} className="aspect-[16/9] w-full" />
        {n > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Foto anterior" className="absolute top-1/2 left-3 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow hover:bg-white">
              <ChevronLeft className="size-5" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Próxima foto" className="absolute top-1/2 right-3 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow hover:bg-white">
              <ChevronRight className="size-5" />
            </button>
          </>
        )}
        <span className="absolute right-3 bottom-3 inline-flex items-center gap-1 rounded-full bg-zinc-900/75 px-2.5 py-1 text-xs text-white">
          <Images className="size-3.5" />
          {i + 1}/{n}
        </span>
      </div>
      {n > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((src, k) => (
            <button key={src} type="button" onClick={() => setI(k)} aria-label={`Ver foto ${k + 1}`} aria-current={k === i} className={cn("shrink-0 overflow-hidden rounded-lg border-2 border-transparent", k === i && "border-primary")}>
              <Photo src={src} alt="" className="h-14 w-20" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
