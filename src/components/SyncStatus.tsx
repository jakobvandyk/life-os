"use client";

import { useState } from "react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { processSyncQueue } from "@/lib/sync";

export default function SyncStatus() {
  const { isOnline, pendingCount, hasErrors } = useOnlineStatus();
  const [showActions, setShowActions] = useState(false);

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

  const handleRetry = async () => {
    await processSyncQueue();
  };

  const handleClear = async () => {
    const { db } = await import("@/lib/local-db");
    await db.sync_queue.where("status").anyOf("pending", "error").delete();
  };

  return (
    <div>
      <button
        onClick={() => (pendingCount > 0 || hasErrors) && setShowActions(!showActions)}
        className="flex items-center gap-2"
      >
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        <span className="font-mono text-desert-text-3 text-[9px] uppercase tracking-wider">
          {label}
        </span>
      </button>
      {showActions && (pendingCount > 0 || hasErrors) && (
        <div className="flex gap-2 mt-1 ml-4">
          <button
            onClick={handleRetry}
            className="font-mono text-[8px] text-desert-accent hover:text-desert-accent-glow uppercase tracking-wider transition-colors"
          >
            Retry
          </button>
          <button
            onClick={handleClear}
            className="font-mono text-[8px] text-desert-text-3 hover:text-desert-danger uppercase tracking-wider transition-colors"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
