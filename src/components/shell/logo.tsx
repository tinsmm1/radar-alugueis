import { cn } from "@/lib/utils";

/** Radar mark: a house inside radar rings (no portal or third-party branding). */
export function Logo({ className, withText = true }: { className?: string; withText?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <svg viewBox="0 0 32 32" className="size-7 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="9" className="fill-primary" />
        <circle cx="16" cy="17" r="10" fill="none" stroke="white" strokeOpacity=".35" strokeWidth="1.5" />
        <circle cx="16" cy="17" r="6" fill="none" stroke="white" strokeOpacity=".6" strokeWidth="1.5" />
        <path d="M11 18.5 16 14l5 4.5V23h-3.2v-3h-3.6v3H11z" fill="white" />
      </svg>
      {withText && (
        <span className="text-[15px] leading-none">
          Radar <span className="text-primary">Aluguéis</span> <span className="text-muted-foreground">BH</span>
        </span>
      )}
    </span>
  );
}
