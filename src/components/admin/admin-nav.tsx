"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin", label: "Visão geral" },
  { href: "/admin/perfil", label: "Perfil e trabalho" },
  { href: "/admin/fontes", label: "Fontes" },
  { href: "/admin/execucoes", label: "Execuções" },
  { href: "/admin/importar", label: "Importar" },
  { href: "/admin/camadas", label: "Camadas" },
  { href: "/admin/demonstracao", label: "Demonstração" },
  { href: "/admin/notificacoes", label: "Notificações" },
  { href: "/admin/dados", label: "Backup e dados" },
  { href: "/admin/seguranca", label: "Segurança" },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Seções da administração" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul className="flex w-max gap-1 border-b lg:w-auto">
        {TABS.map((t) => {
          const on = t.href === "/admin" ? pathname === "/admin" : pathname.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={on ? "page" : undefined}
                className={cn("-mb-px inline-flex h-10 items-center border-b-2 border-transparent px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground", on && "border-primary text-foreground")}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
