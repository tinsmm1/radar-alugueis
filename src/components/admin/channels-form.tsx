"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveChannels, testChannel } from "@/server/actions/notifications";

export function ChannelsForm({ email, telegram, canEmail, canTelegram }: { email: string; telegram: string; canEmail: boolean; canTelegram: boolean }) {
  const [saving, startSave] = useTransition();
  const [testing, startTest] = useTransition();
  const router = useRouter();
  const save = (fd: FormData) =>
    startSave(async () => {
      const res = await saveChannels({ notifyEmail: String(fd.get("email") ?? "").trim(), telegramChatId: String(fd.get("telegram") ?? "").trim() });
      if (!res.ok) return void toast.error(res.error);
      toast.success("Canais salvos.");
      router.refresh();
    });
  const test = (kind: "email" | "telegram") =>
    startTest(async () => {
      const res = await testChannel(kind);
      if (!res.ok) return void toast.error(res.error);
      toast.success(kind === "email" ? "E-mail de teste enviado." : "Mensagem de teste enviada no Telegram.");
    });
  return (
    <form action={save} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="c-email">E-mail para alertas</Label>
        <Input id="c-email" name="email" type="email" defaultValue={email} placeholder="voce@exemplo.com" />
        <Button type="button" variant="outline" size="sm" onClick={() => test("email")} disabled={testing || !canEmail}>
          Enviar e-mail de teste
        </Button>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="c-tg">chat_id do Telegram</Label>
        <Input id="c-tg" name="telegram" inputMode="numeric" defaultValue={telegram} placeholder="123456789" />
        <Button type="button" variant="outline" size="sm" onClick={() => test("telegram")} disabled={testing || !canTelegram}>
          Enviar teste no Telegram
        </Button>
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />}
          Salvar canais
        </Button>
      </div>
    </form>
  );
}
