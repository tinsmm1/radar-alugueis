"use client";
import { useActionState } from "react";
import { createPassword, login, type FormState } from "@/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ setup, next }: { setup: boolean; next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setup ? createPassword : login, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div className="space-y-1.5">
        <Label htmlFor="password">Senha</Label>
        <Input id="password" name="password" type="password" autoComplete={setup ? "new-password" : "current-password"} required minLength={setup ? 8 : 1} autoFocus />
      </div>
      {setup && (
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Repita a senha</Label>
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
        </div>
      )}
      {state && "error" in state && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Aguarde…" : setup ? "Criar senha e entrar" : "Entrar"}
      </Button>
    </form>
  );
}
