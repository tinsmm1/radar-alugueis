"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { deleteSearch, renameSearch, setSearchNotify } from "@/server/actions/searches";

export function NotifyToggle({ id, field, initial, label }: { id: number; field: "notifyNew" | "notifyDrop"; initial: boolean; label: string }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  const change = (v: boolean) =>
    start(async () => {
      setOn(v);
      const res = await setSearchNotify(id, field, v);
      if (!res.ok) {
        setOn(!v);
        toast.error(res.error);
      }
    });
  return (
    <label className="flex items-center gap-2 text-sm">
      <Switch checked={on} onCheckedChange={change} disabled={pending} />
      {label}
    </label>
  );
}

export function SearchTitle({ id, name }: { id: number; name: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [pending, start] = useTransition();
  const router = useRouter();
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await renameSearch(id, value);
      if (!res.ok) return void toast.error(res.error);
      setEditing(false);
      router.refresh();
    });
  };
  if (editing) {
    return (
      <form onSubmit={save} className="flex items-center gap-1.5">
        <Input value={value} onChange={(e) => setValue(e.target.value)} maxLength={80} autoFocus className="h-8" aria-label="Nome da busca" />
        <Button type="submit" size="icon-sm" disabled={pending} aria-label="Salvar"><Check /></Button>
        <Button type="button" size="icon-sm" variant="ghost" onClick={() => setEditing(false)} aria-label="Cancelar"><X /></Button>
      </form>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <h2 className="text-base font-semibold tracking-tight">{name}</h2>
      <Button size="icon-xs" variant="ghost" onClick={() => setEditing(true)} aria-label="Renomear busca"><Pencil /></Button>
    </div>
  );
}

export function DeleteSearch({ id, name }: { id: number; name: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const remove = () => {
    if (!window.confirm(`Apagar a busca "${name}"? Você deixa de receber alertas dela.`)) return;
    start(async () => {
      const res = await deleteSearch(id);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Busca apagada.");
      router.refresh();
    });
  };
  return (
    <Button size="sm" variant="ghost" className="text-destructive" onClick={remove} disabled={pending}>
      <Trash2 />
      Apagar
    </Button>
  );
}
