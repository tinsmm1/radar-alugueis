"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { markNotificationsSeen } from "@/server/actions/notifications";

/** Opening the page marks every notification as seen (clears the bell badge). */
export function MarkSeen({ unread }: { unread: number }) {
  const done = useRef(false);
  const router = useRouter();
  useEffect(() => {
    if (!unread || done.current) return;
    done.current = true;
    void markNotificationsSeen().then((res) => {
      if (res.ok) router.refresh();
    });
  }, [unread, router]);
  return null;
}
