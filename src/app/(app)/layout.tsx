import { requireAuth } from "@/auth/session";
import { Nav } from "@/components/shell/nav";
import { currentMode } from "@/server/mode";
import { unreadCount } from "@/server/notify/events";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requireAuth();
  const [unread, mode] = await Promise.all([unreadCount().catch(() => 0), currentMode()]);
  return (
    <div data-mode={mode} className="flex flex-1 flex-col">
      <Nav unread={unread} mode={mode} />
      <main className="flex-1 pb-20 lg:pb-0">{children}</main>
    </div>
  );
}
