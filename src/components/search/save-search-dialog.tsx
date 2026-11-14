"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { describeFilter, filterToParams, type Filter } from "@/domain/filters";
import { saveSearch } from "@/server/actions/save-search";
import { SwitchRow } from "./fields";
import { useFilterNav } from "./use-filter-nav";

/**
 * Saves the current filters (or a preset built by another page, e.g. "properties like this one")
 * as a search; new matches and price drops become notifications.
 */
export function SaveSearchDialog({ preset, label = "Salvar busca", variant = "default" }: { preset?: Filter; label?: string; variant?: "default" | "outline" } = {}) {
  const nav = useFilterNav();
  const filter = preset ?? nav.filter;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [notifyNew, setNew] = useState(true);
  const [notifyDrop, setDrop] = useState(true);
  const [keepArea, setKeepArea] = useState(false);
  const [pending, start] = useTransition();
  const summary = describeFilter(filter);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await saveSearch(name || summary.slice(0, 80), filterToParams(filter).toString(), notifyNew, notifyDrop, keepArea);
      if (!res.ok) return void toast.error(res.error);
      setOpen(false);
      toast.success("Busca salva", { description: "Você será avisado de novidades.", action: { label: "Ver buscas", onClick: () => router.push("/buscas") } });
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (setOpen(o), o && setName(summary === "Todos os imóveis" ? "" : summary.slice(0, 80)))}>
      <DialogTrigger asChild>
        <Button size="sm" variant={variant} aria-label={label}>
          <BellPlus />
          <span className={preset ? undefined : "hidden sm:inline"}>{label}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{preset ? "Criar alerta" : "Salvar esta busca"}</DialogTitle>
            <DialogDescription>{summary}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="search-name">Nome</Label>
            <Input id="search-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Ex.: 2 quartos perto do metrô" />
          </div>
          <SwitchRow id="notify-new" label="Avisar sobre imóveis novos" checked={notifyNew} onChange={setNew} />
          <SwitchRow id="notify-drop" label="Avisar sobre reduções de preço" checked={notifyDrop} onChange={setDrop} />
          {filter.bbox && <SwitchRow id="keep-area" label="Manter a área do mapa" hint="Sem isso, a busca vale para a cidade inteira." checked={keepArea} onChange={setKeepArea} />}
          <p className="text-xs text-muted-foreground">
            Os avisos aparecem em Notificações e, se configurado em Administração, por e-mail ou Telegram.
          </p>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
