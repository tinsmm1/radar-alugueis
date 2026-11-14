"use client";
import { useRouter } from "next/navigation";
import { Columns3, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { COMPARE_MAX, useCompare } from "@/lib/compare";
import { cn } from "@/lib/utils";

export function CompareButton({ id, size = "icon", className }: { id: number; size?: "icon" | "sm"; className?: string }) {
  const c = useCompare();
  const router = useRouter();
  const on = c.has(id);
  const click = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!on && c.full) return toast.info(`O comparador aceita até ${COMPARE_MAX} imóveis. Remova um para incluir este.`);
    c.toggle(id);
    if (!on) toast.success("Adicionado ao comparador", { action: { label: "Comparar", onClick: () => router.push("/comparar") } });
  };
  return (
    <Button type="button" variant={on ? "default" : "outline"} size={size === "icon" ? "icon-sm" : "sm"} onClick={click} aria-pressed={on} aria-label={on ? "Remover do comparador" : "Adicionar ao comparador"} className={cn(size === "icon" && "rounded-full", !on && "bg-white/95", className)}>
      {on ? <Check /> : <Columns3 />}
      {size === "sm" && (on ? "No comparador" : "Comparar")}
    </Button>
  );
}
