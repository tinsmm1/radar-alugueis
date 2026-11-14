"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FEATURE_LABEL, FEATURES, PROPERTY_TYPES, TYPE_LABEL } from "@/domain/listing";
import { addManualListing } from "@/server/actions/admin";

const select = "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim().replace(/\./g, "").replace(",", ".");
  return s === "" ? null : Number(s);
};
const int = (v: FormDataEntryValue | null) => {
  const n = num(v);
  return n == null ? null : Math.trunc(n);
};

function Field({ id, label, children, className }: { id: string; label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

/** Manual entry of a listing the owner found (e.g. on a portal): stored under the "manual" source. */
export function ManualForm() {
  const [features, setFeatures] = useState<string[]>([]);
  const [created, setCreated] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const submit = (fd: FormData) =>
    start(async () => {
      const rent = num(fd.get("rent"));
      const purpose = (["aluguel", "compra", "ambos"] as const).find((x) => x === fd.get("purpose")) ?? "aluguel";
      const res = await addManualListing({
        url: String(fd.get("url") ?? ""), title: String(fd.get("title") ?? ""), type: String(fd.get("type") ?? ""),
        purpose, rent, salePrice: num(fd.get("salePrice")), condo: num(fd.get("condo")), iptu: num(fd.get("iptu")), iptuPeriod: fd.get("iptuPeriod") === "anual" ? "anual" : "mensal",
        area: num(fd.get("area")), bedrooms: int(fd.get("bedrooms")), suites: int(fd.get("suites")), bathrooms: int(fd.get("bathrooms")), parking: int(fd.get("parking")),
        features, advertiserType: fd.get("advertiserType") === "proprietario" ? "proprietario" : fd.get("advertiserType") === "imobiliaria" ? "imobiliaria" : null,
        street: String(fd.get("street") ?? ""), number: String(fd.get("number") ?? ""), neighborhood: String(fd.get("neighborhood") ?? ""),
      });
      if (!res.ok) return void toast.error(res.error);
      setCreated(res.data.propertyId);
      setFeatures([]);
      toast.success("Anúncio cadastrado.");
      router.refresh();
    });
  return (
    <form action={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Field id="m-title" label="Título" className="sm:col-span-2"><Input id="m-title" name="title" required maxLength={300} placeholder="Ex.: Apartamento 2 quartos com varanda" /></Field>
      <Field id="m-url" label="Link do anúncio original" className="sm:col-span-2"><Input id="m-url" name="url" type="url" placeholder="https://…" /></Field>
      <Field id="m-type" label="Tipo">
        <select id="m-type" name="type" className={select} defaultValue="apartamento">
          {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
        </select>
      </Field>
      <Field id="m-purpose" label="Finalidade">
        <select id="m-purpose" name="purpose" className={select} defaultValue="aluguel">
          <option value="aluguel">Aluguel</option>
          <option value="compra">Venda</option>
          <option value="ambos">Aluguel e venda</option>
        </select>
      </Field>
      <Field id="m-rent" label="Aluguel (R$/mês)"><Input id="m-rent" name="rent" inputMode="decimal" placeholder="2.500" /></Field>
      <Field id="m-sale" label="Preço de venda (R$)"><Input id="m-sale" name="salePrice" inputMode="decimal" placeholder="450.000" /></Field>
      <Field id="m-condo" label="Condomínio (R$)"><Input id="m-condo" name="condo" inputMode="decimal" placeholder="em branco = não informado" /></Field>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Field id="m-iptu" label="IPTU (R$)"><Input id="m-iptu" name="iptu" inputMode="decimal" placeholder="não informado" /></Field>
        <Field id="m-iptu-p" label="Período">
          <select id="m-iptu-p" name="iptuPeriod" className={select} defaultValue="anual"><option value="anual">por ano</option><option value="mensal">por mês</option></select>
        </Field>
      </div>
      <Field id="m-area" label="Área privativa (m²)"><Input id="m-area" name="area" inputMode="decimal" /></Field>
      <Field id="m-bed" label="Quartos"><Input id="m-bed" name="bedrooms" inputMode="numeric" /></Field>
      <Field id="m-suites" label="Suítes"><Input id="m-suites" name="suites" inputMode="numeric" /></Field>
      <Field id="m-bath" label="Banheiros"><Input id="m-bath" name="bathrooms" inputMode="numeric" /></Field>
      <Field id="m-park" label="Vagas"><Input id="m-park" name="parking" inputMode="numeric" /></Field>
      <Field id="m-adv" label="Anunciante">
        <select id="m-adv" name="advertiserType" className={select} defaultValue=""><option value="">Não informado</option><option value="imobiliaria">Imobiliária</option><option value="proprietario">Proprietário</option></select>
      </Field>
      <Field id="m-street" label="Rua" className="sm:col-span-2"><Input id="m-street" name="street" maxLength={200} /></Field>
      <Field id="m-number" label="Número"><Input id="m-number" name="number" maxLength={20} /></Field>
      <Field id="m-nb" label="Bairro"><Input id="m-nb" name="neighborhood" required maxLength={120} /></Field>
      <fieldset className="sm:col-span-2 lg:col-span-4">
        <legend className="mb-2 text-sm font-medium">Características</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {FEATURES.map((f) => (
            <label key={f} className="flex items-center gap-2 text-sm">
              <Checkbox checked={features.includes(f)} onCheckedChange={(v) => setFeatures((cur) => (v === true ? [...cur, f] : cur.filter((x) => x !== f)))} />
              {FEATURE_LABEL[f]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-4">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Plus />}
          Cadastrar anúncio
        </Button>
        {created != null && <Link href={`/imovel/${created}`} className="text-sm font-medium text-primary hover:underline">Abrir o imóvel cadastrado</Link>}
        <p className="text-xs text-muted-foreground">Campos em branco ficam como “não informado” e nunca contam como zero no custo.</p>
      </div>
    </form>
  );
}
