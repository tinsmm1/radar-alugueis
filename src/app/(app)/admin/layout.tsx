import { AdminNav } from "@/components/admin/admin-nav";

export const metadata = { title: { default: "Administração", template: "%s · Administração · Radar Aluguéis BH" } };

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-6 lg:py-8">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Administração</h1>
        <p className="mt-1 text-sm text-muted-foreground">Fontes, coleta automática, camadas geográficas, notificações e dados do seu radar.</p>
      </div>
      <AdminNav />
      <div className="mt-6 space-y-6">{children}</div>
    </div>
  );
}
