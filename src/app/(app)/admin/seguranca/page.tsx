import { LogOut } from "lucide-react";
import { logout } from "@/auth/actions";
import { getAuthMode } from "@/auth/session";
import { PasswordForm } from "@/components/admin/password-form";
import { Section } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/auth/session";

export const metadata = { title: "Segurança" };
export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  // Each page verifies the session itself (defence in depth: the layout check alone can be skipped by partial renders).
  await requireAuth();
  const mode = await getAuthMode();
  return (
    <>
      <Section title="Senha" description="Trocar a senha encerra a sessão nos outros aparelhos.">
        <PasswordForm fixed={mode.mode === "env"} />
      </Section>
      <Section title="Sessão" description="A sessão dura 30 dias neste aparelho. Depois de 8 tentativas erradas, o acesso fica bloqueado por 15 minutos.">
        <form action={logout}>
          <Button type="submit" variant="outline">
            <LogOut />
            Sair deste aparelho
          </Button>
        </form>
      </Section>
    </>
  );
}
