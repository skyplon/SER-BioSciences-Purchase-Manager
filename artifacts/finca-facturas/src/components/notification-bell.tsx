import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth, useUser } from "@clerk/react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";

interface AppNotification {
  id: number;
  type: string;
  invoiceId: number | null;
  invoiceSupplier: string;
  actorName: string | null;
  createdAt: string;
}

const LAST_SEEN_KEY = "notif-last-seen";

function getLastSeen(userId: string): string | null {
  try { return localStorage.getItem(`${LAST_SEEN_KEY}-${userId}`); } catch { return null; }
}

function setLastSeen(userId: string, iso: string) {
  try { localStorage.setItem(`${LAST_SEEN_KEY}-${userId}`, iso); } catch {}
}

export function NotificationBell() {
  const t = useT();
  const { getToken } = useAuth();
  const { user } = useUser();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeenState] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const userId = user?.id ?? "";

  useEffect(() => {
    if (userId) setLastSeenState(getLastSeen(userId));
  }, [userId]);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    try {
      const token = await getToken();
      const res = await fetch("/api/notifications?limit=30", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch {}
  }, [getToken, userId]);

  useEffect(() => {
    fetchNotifications();
    intervalRef.current = setInterval(fetchNotifications, 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) =>
    !lastSeen || new Date(n.createdAt) > new Date(lastSeen)
  ).length;

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && userId) {
      const now = new Date().toISOString();
      setLastSeen(userId, now);
      setLastSeenState(now);
    }
  };

  const typeLabel = (type: string) => {
    if (type === "created") return t("notifications.created");
    if (type === "updated") return t("notifications.updated");
    if (type === "deleted") return t("notifications.deleted");
    return type;
  };

  const typeColor = (type: string) => {
    if (type === "created") return "bg-green-500";
    if (type === "updated") return "bg-blue-500";
    if (type === "deleted") return "bg-red-500";
    return "bg-gray-400";
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8"
          data-testid="button-notification-bell"
          aria-label={t("notifications.title")}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/40">
          <p className="text-sm font-semibold text-foreground">{t("notifications.title")}</p>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t("notifications.empty")}</p>
          ) : (
            notifications.map((n) => {
              const isUnread = !lastSeen || new Date(n.createdAt) > new Date(lastSeen);
              return (
                <div
                  key={n.id}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 transition-colors",
                    isUnread ? "bg-primary/5" : "hover:bg-muted/30"
                  )}
                >
                  <span className={cn("mt-1.5 h-2 w-2 rounded-full flex-shrink-0", typeColor(n.type))} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground leading-snug">
                      {typeLabel(n.type)}{" "}
                      <span className="font-normal text-muted-foreground">— {n.invoiceSupplier}</span>
                    </p>
                    {n.actorName && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t("notifications.by")} {n.actorName}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(n.createdAt)}</p>
                  </div>
                  {isUnread && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />}
                </div>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
