import { CheckCircle2, CircleDashed } from "lucide-react";
import { ProfileForm } from "@/components/admin/profile-form";
import { Section } from "@/components/admin/ui";
import { COMMUTE_NOTE, COMMUTE_SOURCES } from "@/domain/commute";
import { envState } from "@/lib/env";
import { getProfile } from "@/server/profile";
import { requireAuth } from "@/auth/session";

export const metadata = { title: "Perfil e trabalho" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  // Each page verifies the session itself (defence in depth: the layout check alone can be skipped by partial renders).
  await requireAuth();
  const profile = await getProfile();
  const tomtom = envState("TOMTOM_API_KEY");
  return (
    <>
      <Section
        title="Perfil e trabalho"
        description="Onde você e sua família trabalham ou estudam, a que horas saem e voltam e como vão. O Radar calcula o tempo porta a porta de cada imóvel nesses horários de pico e usa isso na nota, na busca e no Guia de decisão."
      >
        <ProfileForm profile={profile} />
      </Section>
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Trânsito real do horário (opcional)">
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              {tomtom === "valid" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
              <span>
                <b>TOMTOM_API_KEY</b> {tomtom === "valid" ? "configurada: carro, bicicleta e a pé usam o trânsito histórico do dia e horário." : tomtom === "invalid" ? "com valor inválido." : "ausente: o Radar usa o modelo calibrado."} Crie a chave grátis em developer.tomtom.com (2.500 consultas por dia) e cadastre-a na Vercel.
              </span>
            </li>
            <li className="flex items-start gap-2"><CircleDashed className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><span><b>TOMTOM_DAILY_BUDGET</b> (opcional): limite diário usado pelo Radar, padrão 2000.</span></li>
          </ul>
        </Section>
        <Section title="Como o tempo é estimado">
          <p className="text-sm text-muted-foreground">{COMMUTE_NOTE}</p>
          <ul className="mt-2 space-y-1 text-sm">
            {COMMUTE_SOURCES.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{s.label}</a></li>)}
          </ul>
        </Section>
      </div>
    </>
  );
}
