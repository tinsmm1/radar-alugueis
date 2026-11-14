"use client";
import { useState, useTransition } from "react";
import { NotebookPen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { saveFavoriteNote } from "@/server/actions/favorites";

/** Private note on a favourite (per list). */
export function NoteEditor({ propertyId, listId, initial }: { propertyId: number; listId: number; initial: string | null }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(initial ?? "");
  const [saved, setSaved] = useState(initial ?? "");
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      const res = await saveFavoriteNote(propertyId, listId, note);
      if (!res.ok) return void toast.error(res.error);
      setSaved(note.trim());
      setOpen(false);
      toast.success("Nota salva.");
    });
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-start gap-2 rounded-lg border border-dashed px-3 py-2 text-left text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground">
        <NotebookPen className="mt-px size-3.5 shrink-0" />
        <span className="line-clamp-3 whitespace-pre-line">{saved || "Adicionar nota (visita, dúvidas, contato…)"}</span>
      </button>
    );
  }
  return (
    <div className="space-y-2">
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} rows={3} autoFocus aria-label="Nota" className="text-sm" />
      <div className="flex gap-1.5">
        <Button size="sm" onClick={save} disabled={pending}>Salvar nota</Button>
        <Button size="sm" variant="ghost" onClick={() => { setNote(saved); setOpen(false); }}>Cancelar</Button>
      </div>
    </div>
  );
}
