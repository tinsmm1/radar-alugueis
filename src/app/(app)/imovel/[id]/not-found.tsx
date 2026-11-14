import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PropertyNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-20 text-center">
      <SearchX className="size-10 text-muted-foreground" />
      <h1 className="text-lg font-semibold">Imóvel não encontrado</h1>
      <p className="text-sm text-muted-foreground">O imóvel pode ter sido removido pela política de retenção ou o endereço está incorreto.</p>
      <Button asChild>
        <Link href="/">Voltar à busca</Link>
      </Button>
    </div>
  );
}
