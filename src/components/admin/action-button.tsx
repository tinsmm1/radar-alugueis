"use client";
import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/server/actions/run-action";

type Props = {
  /** A server action (bind its arguments on the server: `deleteFeed.bind(null, id)`). */
  action: () => Promise<ActionResult<unknown>>;
  children: ReactNode;
  success?: string;
  confirm?: string;
  pendingLabel?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
  size?: "default" | "sm" | "xs" | "lg";
  className?: string;
};

/** Button that runs a server action with optional confirmation, spinner and toast feedback. */
export function ActionButton({ action, children, success, confirm, pendingLabel, variant = "outline", size = "sm", className }: Props) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const click = () => {
    if (confirm && !window.confirm(confirm)) return;
    start(async () => {
      const res = await action();
      if (!res.ok) return void toast.error(res.error);
      const note = (res.data as { note?: string } | undefined)?.note;
      toast.success(note || success || "Pronto.");
      router.refresh();
    });
  };
  return (
    <Button type="button" variant={variant} size={size} onClick={click} disabled={pending} className={className}>
      {pending && <Loader2 className="animate-spin" />}
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
