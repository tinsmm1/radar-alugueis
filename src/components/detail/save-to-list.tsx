"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createList, saveFavoriteNote, toggleFavorite } from "@/server/actions/favorites";

type List = { id: number; name: string; count: number };

/** Save the property in one or more lists, with a personal note. */
export function SaveToList({ propertyId, lists, inLists }: { propertyId: number; lists: List[]; inLists: Array<{ listId: number; note: string | null }> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<Set<number>>(new Set(inLists.map((l) => l.listId)));
  const [note, setNote] = useState(inLists.find((l) => l.note)?.note ?? "");
  const [newList, setNewList] = useState("");

  const save = () =>
    start(async () => {
      const before = new Set(inLists.map((l) => l.listId));
      const wanted = new Set(selected);
      if (newList.trim()) {
        const res = await createList(newList);
        if (!res.ok) return void toast.error(res.error);
        wanted.add(res.data.id);
      }
      for (const id of new Set([...before, ...wanted])) {
        if (before.has(id) !== wanted.has(id)) {
          const r = await toggleFavorite(propertyId, id);
          if (!r.ok) return void toast.error(r.error);
        }
      }
      for (const id of wanted) {
        const r = await saveFavoriteNote(propertyId, id, note);
        if (!r.ok) return void toast.error(r.error);
      }
      toast.success(wanted.size ? "Listas atualizadas" : "Removido das listas");
      setOpen(false);
      setNewList("");
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ListPlus />
          Salvar em lista
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Salvar em listas</DialogTitle>
          <DialogDescription>Organize os imóveis que você acompanha. A nota fica visível só para você.</DialogDescription>
        </DialogHeader>
        <fieldset className="space-y-2">
          <legend className="sr-only">Listas</legend>
          {lists.map((l) => (
            <label key={l.id} className="flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-sm has-checked:border-primary has-checked:bg-accent">
              <span className="flex items-center gap-2">
                <input type="checkbox" className="size-4 accent-primary" checked={selected.has(l.id)} onChange={(e) => setSelected((s) => { const n = new Set(s); if (e.target.checked) n.add(l.id); else n.delete(l.id); return n; })} />
                {l.name}
              </span>
              <span className="text-xs text-muted-foreground">{l.count}</span>
            </label>
          ))}
        </fieldset>
        <div className="space-y-1.5">
          <Label htmlFor="new-list">Nova lista (opcional)</Label>
          <Input id="new-list" value={newList} onChange={(e) => setNewList(e.target.value)} placeholder="Ex.: Visitar no sábado" maxLength={60} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="note">Nota</Label>
          <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: perguntar sobre a vaga coberta" maxLength={2000} rows={3} />
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={pending}>{pending ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
