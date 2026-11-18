"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Expand, Images } from "lucide-react";
import { Photo } from "@/components/property/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Full-screen viewer: whole photo (not cropped), arrows, keyboard and thumbnails. */
function Lightbox({ photos, title, i, go, setI, open, onOpenChange }: { photos: string[]; title: string; i: number; go: (d: number) => void; setI: (k: number) => void; open: boolean; onOpenChange: (v: boolean) => void }) {
  const n = photos.length;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[95vh] w-[96vw] max-w-none flex-col gap-3 border-0 bg-zinc-950 p-3 text-white sm:max-w-none [&_[data-slot=dialog-close]]:text-white [&_[data-slot=dialog-close]]:hover:bg-white/15"
        onKeyDown={(e) => (e.key === "ArrowLeft" ? go(-1) : e.key === "ArrowRight" ? go(1) : undefined)}
      >
        <DialogTitle className="truncate pr-10 text-sm font-medium text-white/90">{title} · foto {i + 1} de {n}</DialogTitle>
        <div className="relative min-h-0 flex-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[i]} alt={`${title}, foto ${i + 1} de ${n}`} referrerPolicy="no-referrer" className="absolute inset-0 m-auto max-h-full max-w-full object-contain" />
          {n > 1 && (
            <>
              <button type="button" onClick={() => go(-1)} aria-label="Foto anterior" className="absolute top-1/2 left-2 inline-flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-zinc-900 shadow hover:bg-white">
                <ChevronLeft className="size-6" />
              </button>
              <button type="button" onClick={() => go(1)} aria-label="Próxima foto" className="absolute top-1/2 right-2 inline-flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-zinc-900 shadow hover:bg-white">
                <ChevronRight className="size-6" />
              </button>
            </>
          )}
        </div>
        {n > 1 && (
          <div className="flex shrink-0 justify-center gap-2 overflow-x-auto pb-1">
            {photos.map((src, k) => (
              <button key={src} type="button" onClick={() => setI(k)} aria-label={`Ver foto ${k + 1}`} aria-current={k === i} className={cn("shrink-0 overflow-hidden rounded-md border-2 border-transparent opacity-60 hover:opacity-100", k === i && "border-white opacity-100")}>
                <Photo src={src} alt="" className="h-14 w-20" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Photo gallery: main photo with arrows, a thumbnail strip and a full-screen viewer (keyboard accessible). */
export function Gallery({ photos, title }: { photos: string[]; title: string }) {
  const [i, setI] = useState(0);
  const [full, setFull] = useState(false);
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
        <button type="button" onClick={() => setFull(true)} aria-label="Ver fotos em tela cheia" className="block w-full cursor-zoom-in">
          <Photo src={photos[i]} alt={`${title}, foto ${i + 1} de ${n}`} className="aspect-[16/9] w-full" />
        </button>
        <button type="button" onClick={() => setFull(true)} className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-zinc-900 shadow hover:bg-white">
          <Expand className="size-3.5" />
          Tela cheia
        </button>
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
      <Lightbox photos={photos} title={title} i={i} go={go} setI={setI} open={full} onOpenChange={setFull} />
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
