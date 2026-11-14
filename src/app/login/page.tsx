import { redirect } from "next/navigation";
import { getAuthMode, isAuthenticated } from "@/auth/session";
import { Logo } from "@/components/shell/logo";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await isAuthenticated()) redirect("/");
  const mode = await getAuthMode().catch(() => null);
  const next = (await searchParams).next;
  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-accent/60 to-background px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-7 shadow-sm">
        <Logo className="mb-6" />
        {mode === null ? (
          <p className="text-sm text-destructive">Banco de dados não conectado. Configure DATABASE_URL e publique de novo.</p>
        ) : mode.mode === "misconfigured" ? (
          <p className="text-sm text-destructive">APP_PASSWORD ou AUTH_SECRET está com valor inválido (mínimo de 8 e 32 caracteres). O acesso fica bloqueado até corrigir a variável na Vercel.</p>
        ) : (
          <>
            <h1 className="text-lg font-semibold">{mode.mode === "setup" ? "Crie a sua senha" : "Entrar"}</h1>
            <p className="mt-1 mb-5 text-sm text-muted-foreground">
              {mode.mode === "setup" ? "Primeiro acesso: a senha protege o seu radar. Guarde-a bem." : "Radar pessoal de aluguéis em Belo Horizonte."}
            </p>
            <LoginForm setup={mode.mode === "setup"} next={typeof next === "string" ? next : ""} />
          </>
        )}
      </div>
    </div>
  );
}
