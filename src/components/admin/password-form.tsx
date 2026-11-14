"use client";
import { useActionState } from "react";
import { changePassword, type FormState } from "@/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordForm({ fixed }: { fixed: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(changePassword, null);
  if (fixed) return <p className="text-sm text-muted-foreground">A senha está definida pela variável <code>APP_PASSWORD</code> da Vercel. Para trocá-la, altere a variável e publique de novo.</p>;
  return (
    <form action={action} className="grid max-w-md gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="pw-current">Senha atual</Label>
        <Input id="pw-current" name="current" type="password" autoComplete="current-password" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pw-new">Nova senha</Label>
        <Input id="pw-new" name="password" type="password" autoComplete="new-password" required minLength={8} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pw-confirm">Repita a nova senha</Label>
        <Input id="pw-confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
      </div>
      {state && (
        <p role="status" className={"error" in state ? "text-sm text-destructive" : "text-sm text-emerald-700"}>
          {"error" in state ? state.error : state.ok}
        </p>
      )}
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? "Salvando…" : "Trocar senha"}
      </Button>
    </form>
  );
}
