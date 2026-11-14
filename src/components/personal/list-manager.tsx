"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createList, deleteList, renameList } from "@/server/actions/favorites";

/** Create a list; rename or delete the current one (the first list is permanent). */
export function ListManager({ current, permanent }: { current: { id: number; name: string } | null; permanent: boolean }) {
  const [mode, setMode] = useState<"idle" | "new" | "rename">("idle");
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      if (mode === "new") {
        const res = await createList(name);
        if (!res.ok) return void toast.error(res.error);
        toast.success("Lista criada.");
        router.push(`/favoritos?lista=${res.data.id}`);
      } else if (current) {
        const res = await renameList(current.id, name);
        if (!res.ok) return void toast.error(res.error);
        toast.success("Lista renomeada.");
        router.refresh();
      }
      setMode("idle");
    });
  };

  const remove = () => {
    if (!current || !window.confirm(`Apagar a lista "${current.name}"? Os imóveis continuam nas outras listas.`)) return;
    start(async () => {
      const res = await deleteList(current.id);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Lista apagada.");
      router.push("/favoritos");
    });
  };

  if (mode !== "idle") {
    return (
      <form onSubmit={submit} className="flex items-center gap-1.5">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={mode === "new" ? "Nome da nova lista" : "Novo nome"} maxLength={60} autoFocus className="h-8 w-48" aria-label="Nome da lista" />
        <Button type="submit" size="icon-sm" disabled={pending || !name.trim()} aria-label="Salvar"><Check /></Button>
        <Button type="button" size="icon-sm" variant="ghost" onClick={() => setMode("idle")} aria-label="Cancelar"><X /></Button>
      </form>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      <Button size="sm" variant="outline" onClick={() => { setName(""); setMode("new"); }}><Plus />Nova lista</Button>
      {current && (
        <Button size="sm" variant="ghost" onClick={() => { setName(current.name); setMode("rename"); }}><Pencil />Renomear</Button>
      )}
      {current && !permanent && (
        <Button size="sm" variant="ghost" className="text-destructive" onClick={remove} disabled={pending}><Trash2 />Apagar lista</Button>
      )}
    </div>
  );
}
