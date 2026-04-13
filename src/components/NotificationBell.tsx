"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PixelIcon from "./PixelIcon";

interface NotificationItem {
  id: number;
  rule_type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  snoozed_until: string | null;
  created_at: string;
}

export default function NotificationBell() {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    const fetchCount = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("channel", "inapp")
        .eq("read", false)
        .is("snoozed_until", null);
      setUnreadCount(count ?? 0);
    };
    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, [userId]);

  useEffect(() => {
    if (!open || !userId) return;
    const fetchNotifications = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, rule_type, title, body, link, read, snoozed_until, created_at")
        .eq("user_id", userId)
        .eq("channel", "inapp")
        .is("snoozed_until", null)
        .order("created_at", { ascending: false })
        .limit(20);
      setNotifications(data || []);
    };
    fetchNotifications();
  }, [open, userId]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markAsRead = async (id: number) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    if (!userId) return;
    await supabase.from("notifications").update({ read: true })
      .eq("user_id", userId).eq("channel", "inapp").eq("read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const snoozeNotification = async (id: number, minutes: number) => {
    await fetch("/api/notifications/snooze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notification_id: id, duration_minutes: minutes }),
    });
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const handleClick = (notif: NotificationItem) => {
    if (!notif.read) markAsRead(notif.id);
    if (notif.link) { setOpen(false); router.push(notif.link); }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "now";
    if (diffMin < 60) return `${diffMin}m`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h`;
    return `${Math.floor(diffHrs / 24)}d`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-1.5 text-desert-text-3 hover:text-desert-text transition-colors"
      >
        <PixelIcon name="chat" size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-desert-danger text-desert-bg font-mono text-[9px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-full ml-2 bottom-0 w-80 bg-desert-surface border border-desert-border rounded-sm shadow-lg z-50 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between px-3 py-2 border-b border-desert-border">
            <span className="font-mono text-xs text-desert-text-2 uppercase tracking-wider">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="font-mono text-[10px] text-desert-accent hover:text-desert-accent-glow">
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="px-3 py-6 text-center text-desert-text-3 text-xs">No notifications</div>
          ) : (
            notifications.map((notif) => (
              <div key={notif.id}
                className={`px-3 py-2.5 border-b border-desert-border cursor-pointer hover:bg-desert-surface-hover transition-colors ${!notif.read ? "bg-desert-bg/50" : ""}`}>
                <div onClick={() => handleClick(notif)}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`font-mono text-xs font-medium ${!notif.read ? "text-desert-text" : "text-desert-text-2"}`}>
                      {notif.title}
                    </span>
                    <span className="font-mono text-[10px] text-desert-text-3">{formatTime(notif.created_at)}</span>
                  </div>
                  <p className="text-xs text-desert-text-3 line-clamp-2">{notif.body}</p>
                </div>
                {!notif.read && (
                  <div className="flex gap-1 mt-1.5">
                    {[15, 30, 60].map((m) => (
                      <button key={m}
                        onClick={(e) => { e.stopPropagation(); snoozeNotification(notif.id, m); }}
                        className="font-mono text-[9px] text-desert-text-3 hover:text-desert-accent px-1 py-0.5 border border-desert-border rounded-sm">
                        {m < 60 ? `${m}m` : `${m / 60}h`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
