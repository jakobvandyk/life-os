"use client";

import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export default function SyncStatus() {
  const { isOnline, pendingCount, hasErrors } = useOnlineStatus();

  let dotColor: string;
  let label: string;

  if (hasErrors) {
    dotColor = "bg-desert-danger";
    label = "Sync error";
  } else if (!isOnline || pendingCount > 0) {
    dotColor = "bg-desert-warning";
    label = isOnline ? `${pendingCount} pending` : "Offline";
  } else {
    dotColor = "bg-desert-success";
    label = "Synced";
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${dotColor}`} />
      <span className="font-mono text-desert-text-3 text-[9px] uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}
