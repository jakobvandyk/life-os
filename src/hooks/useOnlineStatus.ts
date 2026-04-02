"use client";

import { useState, useEffect, useCallback } from "react";
import { processSyncQueue } from "@/lib/sync";

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [hasErrors, setHasErrors] = useState(false);

  const checkQueue = useCallback(async () => {
    try {
      const { db } = await import("@/lib/local-db");
      const pending = await db.sync_queue
        .where("status")
        .equals("pending")
        .count();
      const errors = await db.sync_queue
        .where("status")
        .equals("error")
        .count();
      setPendingCount(pending);
      setHasErrors(errors > 0);
    } catch {
      // Dexie not available (SSR)
    }
  }, []);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const goOnline = async () => {
      setIsOnline(true);
      // Auto-replay pending writes
      await processSyncQueue();
      await checkQueue();
    };

    const goOffline = () => setIsOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    // Check queue periodically
    checkQueue();
    const interval = setInterval(checkQueue, 30000);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      clearInterval(interval);
    };
  }, [checkQueue]);

  return { isOnline, pendingCount, hasErrors };
}
