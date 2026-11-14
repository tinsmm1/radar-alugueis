"use client";
import { useOptimistic, useTransition } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toggleFavorite } from "@/server/actions/favorites";
import { cn } from "@/lib/utils";

export function FavoriteButton({ id, initial, size = "icon", className }: { id: number; initial: boolean; size?: "icon" | "sm"; className?: string }) {
  const [on, setOn] = useOptimistic(initial);
  const [pending, start] = useTransition();
  const click = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    start(async () => {
      setOn(!on);
      const res = await toggleFavorite(id);
      if (!res.ok) toast.error(res.error);
      else toast.success(res.data.favorite ? "Salvo em Favoritos" : "Removido dos Favoritos");
    });
  };
  return (
    <Button type="button" variant="outline" size={size === "icon" ? "icon-sm" : "sm"} onClick={click} disabled={pending} aria-pressed={on} aria-label={on ? "Remover dos favoritos" : "Favoritar"} className={cn(size === "icon" && "rounded-full", className)}>
      <Heart className={cn(on && "fill-rose-500 text-rose-500")} />
      {size === "sm" && (on ? "Favorito" : "Favoritar")}
    </Button>
  );
}
