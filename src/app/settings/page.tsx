"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PixelIcon from "@/components/PixelIcon";
import SignOutButton from "@/components/SignOutButton";
import { parseAppleHealthExport } from "@/lib/apple-health-parser";
import { type NotificationPreferences, type NotificationRule, RULE_LABELS, TIMED_RULES, type RuleType, type Channel } from "@/lib/notifications/types";
import { seedDefaultRules } from "@/lib/notifications/defaults";

interface ExchangeRate {
  id: number;
  pair: string;
  rate: number;
}

interface SyncLog {
  id: number;
  source: string;
  status: string;
  records_imported: number;
  error_message: string | null;
  synced_at: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [exportDays, setExportDays] = useState(14);
  const [exporting, setExporting] = useState<string | null>(null);
  const cronometerRef = useRef<HTMLInputElement>(null);
  const ofxRef = useRef<HTMLInputElement>(null);
  const healthXmlRef = useRef<HTMLInputElement>(null);
  const [healthImportProgress, setHealthImportProgress] = useState<string | null>(null);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences | null>(null);
  const [notifRules, setNotifRules] = useState<NotificationRule[]>([]);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setEmail(user.email ?? null);

      const [{ data: ratesData }, { data: logsData }] = await Promise.all([
        supabase.from("finance_exchange_rates").select("*"),
        supabase
          .from("integration_syncs")
          .select("*")
          .eq("user_id", user.id)
          .order("synced_at", { ascending: false })
          .limit(20),
      ]);

      setRates(ratesData || []);
      setSyncLogs(logsData || []);

      await seedDefaultRules(supabase as any, user.id);
      const { data: prefsData } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .single();
      setNotifPrefs(prefsData as unknown as NotificationPreferences);

      const { data: rulesData } = await supabase
        .from("notification_rules")
        .select("*")
        .eq("user_id", user.id)
        .order("id");
      setNotifRules((rulesData || []) as unknown as NotificationRule[]);

      setLoading(false);
    };

    load();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const getLastSync = (source: string): SyncLog | undefined =>
    syncLogs.find((l) => l.source === source);

  const formatSyncTime = (log: SyncLog | undefined): string => {
    if (!log) return "Never synced";
    const d = new Date(log.synced_at);
    return `${d.toLocaleDateString("en-NZ", { day: "numeric", month: "short" })} ${d.toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit" })} · ${log.records_imported} records`;
  };

  const triggerSync = async (source: string, endpoint: string) => {
    setSyncing(source);
    setUploadResult(null);
    try {
      const res = await fetch(endpoint);
      const data = await res.json();
      if (res.ok) {
        setUploadResult(`${source}: Synced ${data.imported ?? data.updated ?? 0} records`);
      } else {
        setUploadResult(`${source}: ${data.error || "Failed"}`);
      }
    } catch {
      setUploadResult(`${source}: Connection error`);
    }
    setSyncing(null);
    // Refresh sync logs
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("integration_syncs")
        .select("*")
        .eq("user_id", user.id)
        .order("synced_at", { ascending: false })
        .limit(20);
      setSyncLogs(data || []);
    }
  };

  const uploadFile = async (source: string, endpoint: string, file: File) => {
    setSyncing(source);
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(endpoint, { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        const parts = [`${source}: ${data.imported} dates imported`];
        if (data.skipped) parts.push(`${data.skipped} skipped`);
        if (data.checkins) parts.push(`${data.checkins} checkin records`);
        if (data.journal) parts.push(`${data.journal} journal updates`);
        if (data.nutrition) parts.push(`${data.nutrition} nutrition records`);
        if (data.total_value) parts.push(`$${data.total_value}`);
        setUploadResult(parts.join(", "));
      } else {
        setUploadResult(`${source}: ${data.error || "Failed"}`);
      }
    } catch {
      setUploadResult(`${source}: Upload error`);
    }
    setSyncing(null);
  };

  const importHealthXml = async (file: File) => {
    setSyncing("HealthImport");
    setUploadResult(null);
    setHealthImportProgress("Parsing XML...");
    try {
      const records = await parseAppleHealthExport(file, (read, total) => {
        const pct = Math.round((read / total) * 100);
        setHealthImportProgress(`Parsing XML... ${pct}%`);
      });
      setHealthImportProgress(`Uploading ${records.length} days...`);

      const BATCH = 200;
      let totalImported = 0;
      let totalSkipped = 0;
      for (let i = 0; i < records.length; i += BATCH) {
        const batch = records.slice(i, i + BATCH);
        const res = await fetch("/api/import/apple-health", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(batch),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        totalImported += data.imported;
        totalSkipped += data.skipped;
        setHealthImportProgress(`Uploading... ${Math.min(i + BATCH, records.length)}/${records.length} days`);
      }

      setUploadResult(`Apple Health: ${totalImported} days imported, ${totalSkipped} skipped (${records.length} total days parsed)`);
    } catch (e) {
      setUploadResult(`Apple Health: ${e instanceof Error ? e.message : "Import failed"}`);
    }
    setHealthImportProgress(null);
    setSyncing(null);
  };

  const updatePrefs = async (updates: Partial<NotificationPreferences>) => {
    if (!notifPrefs) return;
    const { error } = await supabase
      .from("notification_preferences")
      .update(updates as Record<string, unknown>)
      .eq("user_id", notifPrefs.user_id);
    if (!error) setNotifPrefs({ ...notifPrefs, ...updates } as NotificationPreferences);
  };

  const updateRule = async (ruleId: number, updates: Partial<NotificationRule>) => {
    const { error } = await supabase
      .from("notification_rules")
      .update(updates as Record<string, unknown>)
      .eq("id", ruleId);
    if (!error) {
      setNotifRules((prev) =>
        prev.map((r) => (r.id === ruleId ? { ...r, ...updates } as NotificationRule : r))
      );
    }
  };

  const enablePush = async () => {
    if (!("Notification" in window)) {
      setUploadResult("Push notifications not supported in this browser");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setUploadResult("Push notification permission denied");
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    });
    await updatePrefs({
      push_enabled: true,
      push_subscription: subscription.toJSON() as Record<string, unknown>,
    });
  };

  const disablePush = async () => {
    await updatePrefs({ push_enabled: false, push_subscription: null });
  };

  const generatePairingCode = async () => {
    if (!notifPrefs) return;
    setGeneratingCode(true);
    const code = "LOS-" + Math.random().toString(36).substring(2, 6);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await supabase.from("telegram_pairing_codes").delete().eq("user_id", notifPrefs.user_id);
    await supabase.from("telegram_pairing_codes").insert({
      user_id: notifPrefs.user_id,
      code,
      expires_at: expiresAt,
    });
    setPairingCode(code);
    setGeneratingCode(false);
  };

  const disconnectTelegram = async () => {
    await updatePrefs({ telegram_enabled: false, telegram_chat_id: null });
    setPairingCode(null);
  };

  const toggleChannel = (rule: NotificationRule, channel: Channel) => {
    const channels = rule.channels.includes(channel)
      ? rule.channels.filter((c) => c !== channel)
      : [...rule.channels, channel];
    updateRule(rule.id, { channels });
  };

  if (loading) {
    return (
      <div className="min-h-screen p-6 relative z-10">
        <p className="text-desert-text-3">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 relative z-10">
      {/* Header */}
      <div className="mb-8 pb-6 border-b border-desert-border">
        <h1 className="font-pixel text-lg text-desert-text flex items-center gap-3"><PixelIcon name="settings" size={22} className="text-desert-accent" /> Settings</h1>
        <p className="text-desert-text-3 mt-1">Account, integrations, and data</p>
      </div>

      {/* Upload result banner */}
      {uploadResult && (
        <div className="mb-6 bg-desert-surface border border-desert-border rounded-sm p-3 flex items-center justify-between">
          <p className="text-desert-text text-sm font-mono">{uploadResult}</p>
          <button
            onClick={() => setUploadResult(null)}
            className="text-desert-text-3 hover:text-desert-text text-xs"
          >
            ✕
          </button>
        </div>
      )}

      <div className="space-y-8 max-w-2xl">
        {/* Profile Section */}
        <section>
          <h2 className="font-mono font-bold text-sm tracking-[0.06em] uppercase text-desert-text mb-4">
            Profile
          </h2>
          <div className="bg-desert-surface border border-desert-border rounded-sm p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-desert-text-3 text-xs font-mono uppercase tracking-wider mb-1">
                  Email
                </p>
                <p className="text-desert-text font-mono text-sm">{email}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 border border-desert-danger text-desert-danger font-mono font-semibold uppercase tracking-wider text-sm rounded-sm hover:bg-desert-danger hover:text-desert-bg transition-colors duration-150"
              >
                Sign Out
              </button>
            </div>
          </div>
        </section>

        {/* Integrations Section */}
        <section>
          <h2 className="font-mono font-bold text-sm tracking-[0.06em] uppercase text-desert-text mb-4">
            Integrations
          </h2>
          <div className="space-y-2">
            {/* Apple Health */}
            <div className="bg-desert-surface border border-desert-border rounded-sm p-4 hover:border-desert-border-strong transition-colors duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-8 text-center flex items-center justify-center"><PixelIcon name="int_health" size={20} className="text-desert-danger" /></span>
                  <div>
                    <p className="text-desert-text font-mono text-sm font-medium">Apple Health</p>
                    <p className="text-desert-text-3 text-xs">
                      Webhook for iOS Shortcut — POST /api/integrations/health
                    </p>
                  </div>
                </div>
                <span className="text-desert-text-3 font-mono text-[10px]">
                  {formatSyncTime(getLastSync("apple_health"))}
                </span>
              </div>
            </div>

            {/* Apple Health Import */}
            <div className="bg-desert-surface border border-desert-border rounded-sm p-4 hover:border-desert-border-strong transition-colors duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-8 text-center flex items-center justify-center"><PixelIcon name="int_health" size={20} className="text-desert-danger" /></span>
                  <div>
                    <p className="text-desert-text font-mono text-sm font-medium">Apple Health Import</p>
                    <p className="text-desert-text-3 text-xs">
                      {healthImportProgress || "Upload export.xml — historical backfill"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    ref={healthXmlRef}
                    type="file"
                    accept=".xml"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) importHealthXml(file);
                    }}
                  />
                  <button
                    onClick={() => healthXmlRef.current?.click()}
                    disabled={syncing === "HealthImport"}
                    className="px-3 py-1.5 bg-desert-accent text-desert-bg font-mono font-semibold uppercase tracking-wider text-[10px] rounded-sm hover:bg-desert-accent-glow transition-colors duration-150 disabled:opacity-50"
                  >
                    {syncing === "HealthImport" ? "Importing..." : "Upload XML"}
                  </button>
                </div>
              </div>
            </div>

            {/* Cronometer */}
            <div className="bg-desert-surface border border-desert-border rounded-sm p-4 hover:border-desert-border-strong transition-colors duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-8 text-center flex items-center justify-center"><PixelIcon name="int_nutrition" size={20} className="text-desert-success" /></span>
                  <div>
                    <p className="text-desert-text font-mono text-sm font-medium">Cronometer</p>
                    <p className="text-desert-text-3 text-xs">Upload CSV — nutrition or biometrics export</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-desert-text-3 font-mono text-[10px]">
                    {formatSyncTime(getLastSync("cronometer"))}
                  </span>
                  <input
                    ref={cronometerRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadFile("Cronometer", "/api/import/cronometer", file);
                    }}
                  />
                  <button
                    onClick={() => cronometerRef.current?.click()}
                    disabled={syncing === "Cronometer"}
                    className="px-3 py-1.5 bg-desert-accent text-desert-bg font-mono font-semibold uppercase tracking-wider text-[10px] rounded-sm hover:bg-desert-accent-glow transition-colors duration-150 disabled:opacity-50"
                  >
                    {syncing === "Cronometer" ? "..." : "Upload CSV"}
                  </button>
                </div>
              </div>
            </div>

            {/* myBOQ */}
            <div className="bg-desert-surface border border-desert-border rounded-sm p-4 hover:border-desert-border-strong transition-colors duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-8 text-center flex items-center justify-center"><PixelIcon name="int_bank" size={20} className="text-desert-celestial" /></span>
                  <div>
                    <p className="text-desert-text font-mono text-sm font-medium">myBOQ</p>
                    <p className="text-desert-text-3 text-xs">Upload OFX bank export</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-desert-text-3 font-mono text-[10px]">
                    {formatSyncTime(getLastSync("boq_ofx"))}
                  </span>
                  <input
                    ref={ofxRef}
                    type="file"
                    accept=".ofx,.qfx"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadFile("myBOQ", "/api/import/ofx", file);
                    }}
                  />
                  <button
                    onClick={() => ofxRef.current?.click()}
                    disabled={syncing === "myBOQ"}
                    className="px-3 py-1.5 bg-desert-accent text-desert-bg font-mono font-semibold uppercase tracking-wider text-[10px] rounded-sm hover:bg-desert-accent-glow transition-colors duration-150 disabled:opacity-50"
                  >
                    {syncing === "myBOQ" ? "..." : "Upload OFX"}
                  </button>
                </div>
              </div>
            </div>

            {/* Binance */}
            <div className="bg-desert-surface border border-desert-border rounded-sm p-4 hover:border-desert-border-strong transition-colors duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-8 text-center flex items-center justify-center"><PixelIcon name="int_crypto" size={20} className="text-desert-warning" /></span>
                  <div>
                    <p className="text-desert-text font-mono text-sm font-medium">Binance</p>
                    <p className="text-desert-text-3 text-xs">Sync crypto portfolio balances</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-desert-text-3 font-mono text-[10px]">
                    {formatSyncTime(getLastSync("binance"))}
                  </span>
                  <button
                    onClick={() => triggerSync("Binance", "/api/sync/binance")}
                    disabled={syncing === "Binance"}
                    className="px-3 py-1.5 bg-desert-accent text-desert-bg font-mono font-semibold uppercase tracking-wider text-[10px] rounded-sm hover:bg-desert-accent-glow transition-colors duration-150 disabled:opacity-50"
                  >
                    {syncing === "Binance" ? "..." : "Sync Now"}
                  </button>
                </div>
              </div>
            </div>

            {/* iCal */}
            <div className="bg-desert-surface border border-desert-border rounded-sm p-4 hover:border-desert-border-strong transition-colors duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-8 text-center flex items-center justify-center"><PixelIcon name="int_ical" size={20} className="text-desert-accent" /></span>
                  <div>
                    <p className="text-desert-text font-mono text-sm font-medium">iCal</p>
                    <p className="text-desert-text-3 text-xs">
                      Sync calendar feeds (set ICAL_URL_1 in env)
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-desert-text-3 font-mono text-[10px]">
                    {formatSyncTime(getLastSync("ical"))}
                  </span>
                  <button
                    onClick={() => triggerSync("iCal", "/api/sync/ical")}
                    disabled={syncing === "iCal"}
                    className="px-3 py-1.5 bg-desert-accent text-desert-bg font-mono font-semibold uppercase tracking-wider text-[10px] rounded-sm hover:bg-desert-accent-glow transition-colors duration-150 disabled:opacity-50"
                  >
                    {syncing === "iCal" ? "..." : "Sync Now"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Notifications Section */}
        {notifPrefs && (
          <section>
            <h2 className="font-mono font-bold text-sm tracking-[0.06em] uppercase text-desert-text mb-4">
              Notifications
            </h2>
            <div className="space-y-4">
              {/* Global Settings */}
              <div className="bg-desert-surface border border-desert-border rounded-sm p-4">
                <p className="font-mono text-xs text-desert-text-2 uppercase tracking-wider mb-3">Global</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-desert-text-3 text-xs block mb-1">Timezone</label>
                    <select
                      value={notifPrefs.timezone}
                      onChange={(e) => updatePrefs({ timezone: e.target.value })}
                      className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-2 py-1.5 font-mono text-xs text-desert-text"
                    >
                      {["Pacific/Auckland", "Australia/Sydney", "Australia/Melbourne", "America/New_York", "America/Los_Angeles", "Europe/London", "Asia/Tokyo"].map((tz) => (
                        <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-desert-text-3 text-xs block mb-1">Quiet start</label>
                      <input type="time" value={notifPrefs.quiet_start} onChange={(e) => updatePrefs({ quiet_start: e.target.value })}
                        className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-2 py-1.5 font-mono text-xs text-desert-text" />
                    </div>
                    <div className="flex-1">
                      <label className="text-desert-text-3 text-xs block mb-1">Quiet end</label>
                      <input type="time" value={notifPrefs.quiet_end} onChange={(e) => updatePrefs({ quiet_end: e.target.value })}
                        className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-2 py-1.5 font-mono text-xs text-desert-text" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Channel Connections */}
              <div className="space-y-2">
                <p className="font-mono text-xs text-desert-text-2 uppercase tracking-wider">Channels</p>
                {/* Web Push */}
                <div className="bg-desert-surface border border-desert-border rounded-sm p-4 flex items-center justify-between">
                  <div>
                    <p className="text-desert-text font-mono text-sm font-medium">Web Push</p>
                    <p className="text-desert-text-3 text-xs">{notifPrefs.push_enabled ? "Push notifications enabled" : "Browser notifications"}</p>
                  </div>
                  <button onClick={notifPrefs.push_enabled ? disablePush : enablePush}
                    className={`px-3 py-1.5 font-mono font-semibold uppercase tracking-wider text-[10px] rounded-sm transition-colors duration-150 ${
                      notifPrefs.push_enabled ? "border border-desert-danger text-desert-danger hover:bg-desert-danger hover:text-desert-bg" : "bg-desert-accent text-desert-bg hover:bg-desert-accent-glow"
                    }`}>
                    {notifPrefs.push_enabled ? "Disable" : "Enable Push"}
                  </button>
                </div>
                {/* Telegram */}
                <div className="bg-desert-surface border border-desert-border rounded-sm p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-desert-text font-mono text-sm font-medium">Telegram</p>
                      <p className="text-desert-text-3 text-xs">{notifPrefs.telegram_chat_id ? "Connected" : "Bot notifications + habit logging"}</p>
                    </div>
                    {notifPrefs.telegram_chat_id ? (
                      <button onClick={disconnectTelegram}
                        className="px-3 py-1.5 border border-desert-danger text-desert-danger font-mono font-semibold uppercase tracking-wider text-[10px] rounded-sm hover:bg-desert-danger hover:text-desert-bg transition-colors duration-150">
                        Disconnect
                      </button>
                    ) : (
                      <button onClick={generatePairingCode} disabled={generatingCode}
                        className="px-3 py-1.5 bg-desert-accent text-desert-bg font-mono font-semibold uppercase tracking-wider text-[10px] rounded-sm hover:bg-desert-accent-glow transition-colors duration-150 disabled:opacity-50">
                        {generatingCode ? "..." : "Connect Telegram"}
                      </button>
                    )}
                  </div>
                  {pairingCode && !notifPrefs.telegram_chat_id && (
                    <div className="mt-3 p-3 bg-desert-bg border border-desert-border-strong rounded-sm">
                      <p className="text-desert-text-3 text-xs mb-2">Send this to your Life OS bot on Telegram:</p>
                      <code className="font-mono text-sm text-desert-accent select-all">/pair {pairingCode}</code>
                      <p className="text-desert-text-3 text-[10px] mt-2">Code expires in 10 minutes</p>
                    </div>
                  )}
                </div>
                {/* In-App */}
                <div className="bg-desert-surface border border-desert-border rounded-sm p-4 flex items-center justify-between">
                  <div>
                    <p className="text-desert-text font-mono text-sm font-medium">In-App</p>
                    <p className="text-desert-text-3 text-xs">Notification bell in sidebar</p>
                  </div>
                  <button onClick={() => updatePrefs({ inapp_enabled: !notifPrefs.inapp_enabled })}
                    className={`px-3 py-1.5 font-mono font-semibold uppercase tracking-wider text-[10px] rounded-sm transition-colors duration-150 ${
                      notifPrefs.inapp_enabled ? "bg-desert-success/20 text-desert-success border border-desert-success/30" : "bg-desert-bg border border-desert-border-strong text-desert-text-3"
                    }`}>
                    {notifPrefs.inapp_enabled ? "On" : "Off"}
                  </button>
                </div>
              </div>

              {/* Notification Rules */}
              <div>
                <p className="font-mono text-xs text-desert-text-2 uppercase tracking-wider mb-2">Rules</p>
                <div className="bg-desert-surface border border-desert-border rounded-sm divide-y divide-desert-border">
                  {notifRules.filter((r) => r.rule_type !== "sync_event").map((rule) => {
                    const label = RULE_LABELS[rule.rule_type as RuleType];
                    const isTimed = TIMED_RULES.includes(rule.rule_type as RuleType);
                    return (
                      <div key={rule.id} className="px-4 py-3 flex items-center gap-3">
                        <button onClick={() => updateRule(rule.id, { enabled: !rule.enabled })}
                          className={`w-8 h-4 rounded-full relative transition-colors flex-shrink-0 ${rule.enabled ? "bg-desert-accent" : "bg-desert-border"}`}>
                          <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-desert-bg transition-transform ${rule.enabled ? "left-4.5" : "left-0.5"}`} />
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-xs text-desert-text font-medium">{label?.name}</p>
                          <p className="text-desert-text-3 text-[10px] truncate">{label?.description}</p>
                        </div>
                        {isTimed && (
                          <input type="time" value={rule.time || ""} onChange={(e) => updateRule(rule.id, { time: e.target.value })}
                            className="bg-desert-bg border border-desert-border-strong rounded-sm px-1.5 py-1 font-mono text-[10px] text-desert-text w-20" />
                        )}
                        {rule.rule_type === "weekly_review" && (
                          <select value={rule.day_of_week ?? 0} onChange={(e) => updateRule(rule.id, { day_of_week: parseInt(e.target.value) })}
                            className="bg-desert-bg border border-desert-border-strong rounded-sm px-1 py-1 font-mono text-[10px] text-desert-text">
                            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
                              <option key={i} value={i}>{d}</option>
                            ))}
                          </select>
                        )}
                        <div className="flex gap-1">
                          {(["push", "telegram", "inapp"] as Channel[]).map((ch) => {
                            const connected = ch === "push" ? notifPrefs.push_enabled : ch === "telegram" ? !!notifPrefs.telegram_chat_id : true;
                            if (!connected) return null;
                            const active = rule.channels.includes(ch);
                            return (
                              <button key={ch} onClick={() => toggleChannel(rule, ch)}
                                className={`px-1.5 py-0.5 font-mono text-[9px] uppercase rounded-sm transition-colors ${
                                  active ? "bg-desert-accent/20 text-desert-accent border border-desert-accent/30" : "bg-desert-bg text-desert-text-3 border border-desert-border"
                                }`}>
                                {ch === "inapp" ? "app" : ch}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Exchange Rates Section */}
        <section>
          <h2 className="font-mono font-bold text-sm tracking-[0.06em] uppercase text-desert-text mb-4">
            Exchange Rates
          </h2>
          <div className="bg-desert-surface border border-desert-border rounded-sm p-5">
            {rates.length === 0 ? (
              <p className="text-desert-text-3 text-sm">No exchange rates configured</p>
            ) : (
              <div className="space-y-3">
                {rates.map((rate) => (
                  <div key={rate.id} className="flex items-center justify-between">
                    <span className="font-mono text-sm text-desert-text-2">{rate.pair}</span>
                    <span className="font-mono text-sm text-desert-text font-medium">
                      {rate.rate.toFixed(4)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Data Export */}
        <section>
          <h2 className="font-mono font-bold text-sm tracking-[0.06em] uppercase text-desert-text mb-4">
            Data Export
          </h2>
          <div className="space-y-3">
            {/* Export for Analysis */}
            <div className="bg-desert-surface border border-desert-border rounded-sm p-5">
              <div className="mb-3">
                <p className="text-desert-text text-sm font-medium">Export for Analysis</p>
                <p className="text-desert-text-3 text-xs">
                  JSON bundle for AI analysis — checkins, nutrition, journal, habits, workouts, goals, tasks, reviews
                </p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex gap-1.5">
                  {[7, 14, 30, 60, 90].map((d) => (
                    <button
                      key={d}
                      onClick={() => setExportDays(d)}
                      className={`px-2.5 py-1 font-mono text-xs rounded-sm transition-colors duration-150 ${
                        exportDays === d
                          ? "bg-desert-accent text-desert-bg"
                          : "bg-desert-bg border border-desert-border-strong text-desert-text-2 hover:text-desert-text hover:border-desert-accent"
                      }`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
                <button
                  onClick={async () => {
                    setExporting("analysis");
                    try {
                      const res = await fetch(`/api/export/analysis?days=${exportDays}`, { credentials: "include" });
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `life-os-export-${new Date().toISOString().split("T")[0]}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    } finally {
                      setExporting(null);
                    }
                  }}
                  disabled={exporting === "analysis"}
                  className="px-4 py-1.5 bg-desert-accent text-desert-bg font-mono font-semibold uppercase tracking-wider text-xs rounded-sm hover:bg-desert-accent-glow transition-colors duration-150 disabled:opacity-50"
                >
                  {exporting === "analysis" ? "Exporting..." : "Download JSON"}
                </button>
              </div>
            </div>

            {/* Full Data Backup */}
            <div className="bg-desert-surface border border-desert-border rounded-sm p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-desert-text text-sm font-medium">Full Data Backup</p>
                  <p className="text-desert-text-3 text-xs">
                    Download all data across all tables — no date filter
                  </p>
                </div>
                <button
                  onClick={async () => {
                    setExporting("full");
                    try {
                      const res = await fetch("/api/export/analysis?days=9999", { credentials: "include" });
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `life-os-backup-${new Date().toISOString().split("T")[0]}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    } finally {
                      setExporting(null);
                    }
                  }}
                  disabled={exporting === "full"}
                  className="px-4 py-2 bg-desert-surface-hover border border-desert-border-strong text-desert-text font-mono font-semibold uppercase tracking-wider text-sm rounded-sm hover:border-desert-accent hover:text-desert-accent transition-colors duration-150 disabled:opacity-50"
                >
                  {exporting === "full" ? "Exporting..." : "Backup All"}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Account */}
        <section>
          <h2 className="font-mono font-bold text-sm tracking-[0.06em] uppercase text-desert-text mb-4">Account</h2>
          <div className="bg-desert-surface border border-desert-border rounded-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-desert-text text-sm">{email}</p>
                <p className="text-desert-text-3 text-xs">Signed in</p>
              </div>
              <SignOutButton />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
