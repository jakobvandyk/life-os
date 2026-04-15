"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { queueWrite } from "@/lib/sync";

export interface Checkin {
  id?: string;
  user_id: string;
  date: string;
  weight?: number | null;
  sleep?: number | null;
  sleep_score?: number | null;
  hrv?: number | null;
  hrv_rmssd?: number | null;
  readiness?: number | null;
  shin?: number | null;
  shin_pain?: number | null;
  waist?: number | null;
  waist_cm?: number | null;
  pns_index?: number | null;
  sns_index?: number | null;
  stress_index?: number | null;
  kubios_readiness?: number | null;
  mean_hr?: number | null;
  body_fat_pct?: number | null;
  steps?: number | null;
  active_calories?: number | null;
  resting_hr?: number | null;
  vo2_max?: number | null;
  tags?: string[] | null;
  created_at?: string;
}

interface DailyCheckinProps {
  userId: string;
  checkins: Checkin[];
  onRefetch: () => void;
}

export default function DailyCheckin({ userId, checkins, onRefetch }: DailyCheckinProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Checkin | null>(null);
  const [pastDate, setPastDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // Form state for today
  const [weight, setWeight] = useState<string>("");
  const [sleep, setSleep] = useState<string>("");
  const [hrv, setHrv] = useState<string>("");
  const [readiness, setReadiness] = useState<number | null>(null);
  const [hrvRmssd, setHrvRmssd] = useState<string>("");
  const [shinPain, setShinPain] = useState<number | null>(null);
  const [shinPainEnabled, setShinPainEnabled] = useState(false);
  const [waistCm, setWaistCm] = useState<string>("");
  const [waistCmEnabled, setWaistCmEnabled] = useState(false);
  const [kubiosOpen, setKubiosOpen] = useState(false);
  const [pnsIndex, setPnsIndex] = useState<string>("");
  const [snsIndex, setSnsIndex] = useState<string>("");
  const [stressIndex, setStressIndex] = useState<string>("");
  const [kubiosReadiness, setKubiosReadiness] = useState<string>("");
  const [meanHr, setMeanHr] = useState<string>("");
  const [bodyFatPct, setBodyFatPct] = useState<string>("");
  const [tags, setTags] = useState<string>("");

  // Get today's checkin
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCheckin = useMemo(() =>
    checkins.find(c => c.date === todayStr), [checkins]
  );

  // Computed helpers
  const compute7DayAvg = (): number | null => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const pts = checkins.filter(c => c.weight != null && new Date(c.date) >= cutoff);
    if (!pts.length) return null;
    return pts.reduce((sum, c) => sum + (c.weight || 0), 0) / pts.length;
  };

  const computePrevAvg = (): number | null => {
    const end = new Date();
    end.setDate(end.getDate() - 7);
    const start = new Date();
    start.setDate(start.getDate() - 14);
    const pts = checkins.filter(c => c.weight != null && new Date(c.date) >= start && new Date(c.date) < end);
    if (!pts.length) return null;
    return pts.reduce((sum, c) => sum + (c.weight || 0), 0) / pts.length;
  };

  const computeStreak = (): number => {
    const dateSet = new Set(checkins.map(c => c.date));
    let streak = 0;
    const d = new Date();
    const today = d.toISOString().slice(0, 10);
    if (!dateSet.has(today)) d.setDate(d.getDate() - 1);
    while (dateSet.has(d.toISOString().slice(0, 10))) {
      streak++;
      d.setDate(d.getDate() - 1);
      if (streak > 365) break;
    }
    return streak;
  };

  const computeSparklineData = () => {
    const days = 14;
    const data = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const entry = checkins.find(c => c.date === dateStr && c.weight != null);
      if (entry) {
        data.push({ date: dateStr, value: entry.weight! });
      }
    }
    return data;
  };

  const sparklineData = computeSparklineData();
  const avg7Day = compute7DayAvg();
  const prevAvg = computePrevAvg();
  const streak = computeStreak();

  // Calculate trend arrow and difference
  const trend = useMemo(() => {
    if (avg7Day === null || prevAvg === null) return { arrow: "→", diff: "0.0" };
    const diff = avg7Day - prevAvg;
    const absDiff = Math.abs(diff).toFixed(1);
    const arrow = diff > 0 ? "↑" : diff < 0 ? "↓" : "→";
    return { arrow, diff: absDiff };
  }, [avg7Day, prevAvg]);

  // Latest values for trends
  const latestHrv = checkins.find(c => c.hrv != null)?.hrv;
  const latestRmssd = checkins.find(c => c.hrv_rmssd != null)?.hrv_rmssd;
  const latestReadiness = checkins.find(c => c.readiness != null)?.readiness;
  const latestSleep = checkins.find(c => c.sleep != null)?.sleep;
  const latestShinPain = checkins.find(c => (c.shin_pain ?? c.shin) != null)?.shin_pain ?? checkins.find(c => c.shin != null)?.shin;
  const latestWaistCm = checkins.find(c => (c.waist_cm ?? c.waist) != null)?.waist_cm ?? checkins.find(c => c.waist != null)?.waist;
  const latestPns = checkins.find(c => c.pns_index != null)?.pns_index;
  const latestSns = checkins.find(c => c.sns_index != null)?.sns_index;
  const latestStress = checkins.find(c => c.stress_index != null)?.stress_index;
  const latestKubiosReadiness = checkins.find(c => c.kubios_readiness != null)?.kubios_readiness;
  const latestMeanHr = checkins.find(c => c.mean_hr != null)?.mean_hr;
  const latestBodyFatPct = checkins.find(c => c.body_fat_pct != null)?.body_fat_pct;
  const latestSteps = checkins.find(c => c.steps != null)?.steps;
  const latestActiveCals = checkins.find(c => c.active_calories != null)?.active_calories;
  const latestRestingHr = checkins.find(c => c.resting_hr != null)?.resting_hr;
  const latestVo2Max = checkins.find(c => c.vo2_max != null)?.vo2_max;
  const totalEntries = checkins.length;

  const getShinPainColor = (value: number | null | undefined): string => {
    if (value == null) return "text-desert-text";
    if (value === 0) return "text-desert-success";
    if (value >= 1 && value <= 3) return "text-desert-text";
    if (value >= 4 && value <= 6) return "text-desert-warning";
    return "text-desert-danger";
  };

  // Helper to reset all form fields
  const resetForm = () => {
    setWeight("");
    setSleep("");
    setHrv("");
    setHrvRmssd("");
    setReadiness(null);
    setShinPainEnabled(false);
    setShinPain(null);
    setWaistCmEnabled(false);
    setWaistCm("");
    setPnsIndex("");
    setSnsIndex("");
    setStressIndex("");
    setKubiosReadiness("");
    setMeanHr("");
    setBodyFatPct("");
    setKubiosOpen(false);
    setTags("");
  };

  // Helper to load form from an entry
  const loadFromEntry = (entry: Checkin) => {
    setWeight(entry.weight?.toString() || "");
    setSleep(entry.sleep?.toString() || "");
    setHrv(entry.hrv?.toString() || "");
    setHrvRmssd(entry.hrv_rmssd?.toString() || "");
    setReadiness(entry.readiness || null);
    setShinPainEnabled(entry.shin_pain != null || entry.shin != null);
    setShinPain(entry.shin_pain ?? entry.shin ?? null);
    setWaistCmEnabled(entry.waist_cm != null || entry.waist != null);
    setWaistCm((entry.waist_cm ?? entry.waist)?.toString() || "");
    setPnsIndex(entry.pns_index?.toString() || "");
    setSnsIndex(entry.sns_index?.toString() || "");
    setStressIndex(entry.stress_index?.toString() || "");
    setKubiosReadiness(entry.kubios_readiness?.toString() || "");
    setMeanHr(entry.mean_hr?.toString() || "");
    setBodyFatPct(entry.body_fat_pct?.toString() || "");
    setTags(Array.isArray(entry.tags) ? entry.tags.join(", ") : "");
    if (entry.pns_index != null || entry.sns_index != null || entry.hrv_rmssd != null) {
      setKubiosOpen(true);
    }
  };

  // Load today's data into form
  useEffect(() => {
    if (todayCheckin) {
      loadFromEntry(todayCheckin);
    } else {
      resetForm();
    }
  }, [todayCheckin]);

  // Build payload with only form-managed fields — never sends fields the
  // form doesn't control (steps, active_calories, resting_hr, vo2_max,
  // sleep_score) so webhook-sourced values aren't overwritten with null.
  const buildPayload = (dateStr: string) => ({
    user_id: userId,
    date: dateStr,
    weight: weight ? parseFloat(weight) : null,
    sleep: sleep ? parseFloat(sleep) : null,
    hrv: hrv ? parseInt(hrv) : null,
    hrv_rmssd: hrvRmssd ? parseFloat(hrvRmssd) : null,
    readiness: readiness,
    shin_pain: shinPainEnabled ? shinPain : null,
    waist_cm: waistCmEnabled && waistCm ? parseFloat(waistCm) : null,
    pns_index: pnsIndex ? parseFloat(pnsIndex) : null,
    sns_index: snsIndex ? parseFloat(snsIndex) : null,
    stress_index: stressIndex ? parseFloat(stressIndex) : null,
    kubios_readiness: kubiosReadiness ? parseFloat(kubiosReadiness) : null,
    mean_hr: meanHr ? parseFloat(meanHr) : null,
    body_fat_pct: bodyFatPct ? parseFloat(bodyFatPct) : null,
    tags: tags ? tags.split(",").map(t => t.trim()).filter(Boolean) : null,
  });

  // Selective save: update only form-managed fields if row exists,
  // insert full payload if it doesn't. Prevents overwriting webhook data.
  const selectiveSave = async (dateStr: string) => {
    const payload = buildPayload(dateStr);

    const { data: existing } = await supabase
      .from("workout_checkins")
      .select("id")
      .eq("user_id", userId)
      .eq("date", dateStr)
      .maybeSingle();

    if (existing) {
      // Update only — omit user_id and date (they're the key)
      const { user_id: _u, date: _d, ...updateFields } = payload;
      const { error: updateError } = await supabase
        .from("workout_checkins")
        .update(updateFields)
        .eq("id", existing.id);

      if (updateError) {
        console.error("Checkin update failed, queueing offline:", updateError);
        await queueWrite("workout_checkins", "update", { id: existing.id, ...updateFields });
      }
    } else {
      const { error: insertError } = await supabase
        .from("workout_checkins")
        .insert(payload);

      if (insertError) {
        console.error("Checkin insert failed, queueing offline:", insertError);
        await queueWrite("workout_checkins", "insert", payload);
      }
    }
  };

  const handleSave = async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);

    try {
      await selectiveSave(todayStr);
      onRefetch();
      if (!todayCheckin) {
        resetForm();
      }
    } catch (err: any) {
      console.error("Checkin save error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (entry?: Checkin) => {
    if (entry) {
      setEditingEntry(entry);
      setPastDate(entry.date);
      loadFromEntry(entry);
    } else {
      setEditingEntry(null);
      setPastDate(new Date().toISOString().slice(0, 10));
      resetForm();
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingEntry(null);
  };

  const handleModalSave = async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);

    try {
      await selectiveSave(pastDate);

      closeModal();
      onRefetch();
      // If editing today, reload form state
      if (editingEntry?.date === todayStr) {
        const newToday = checkins.find(c => c.date === todayStr);
        if (newToday) {
          loadFromEntry(newToday);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!editingEntry || !userId) return;
    if (!confirm("Delete this check-in entry?")) return;

    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase
        .from("workout_checkins")
        .delete()
        .eq("user_id", userId)
        .eq("date", editingEntry.date);

      if (error) await queueWrite("workout_checkins", "delete", { id: editingEntry.id });

      closeModal();
      onRefetch();
      // If deleted today's entry, clear form
      if (editingEntry.date === todayStr) {
        resetForm();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getReadinessColor = (value: number | null) => {
    if (value === null) return "border-desert-border-strong text-desert-text-3";
    if (value >= 1 && value <= 3) return "bg-desert-danger-dim border-desert-danger text-desert-danger";
    if (value >= 4 && value <= 6) return "bg-desert-accent-glow border-desert-accent text-desert-accent";
    if (value >= 7 && value <= 10) return "bg-desert-success-dim border-desert-success text-desert-success";
    return "border-desert-border-strong text-desert-text-3";
  };

  const toggleReadiness = (value: number) => {
    setReadiness(prev => prev === value ? null : value);
  };

  // Sparkline SVG generation
  const generateSparkline = () => {
    if (sparklineData.length < 2) return null;
    const values = sparklineData.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const padding = 2;
    const width = 300;
    const height = 40;
    const points = sparklineData.map((d, i) => {
      const x = (i / (sparklineData.length - 1)) * width;
      const y = height - ((d.value - min) / range) * (height - 2 * padding) - padding;
      return `${x},${y}`;
    }).join(" ");

    const lastX = ((sparklineData.length - 1) / (sparklineData.length - 1)) * width;
    const lastY = height - ((values[values.length - 1] - min) / range) * (height - 2 * padding) - padding;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full text-desert-text" preserveAspectRatio="none">
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <circle cx={lastX} cy={lastY} r="3" fill="currentColor" />
      </svg>
    );
  };

  const formatHistoryPill = (entry: Checkin) => {
    const parts = [];
    if (entry.weight) parts.push(`${entry.weight.toFixed(1)}kg wt`);
    if (entry.body_fat_pct != null) parts.push(`${entry.body_fat_pct.toFixed(1)}% bf`);
    if (entry.waist_cm) parts.push(`${entry.waist_cm.toFixed(1)}cm waist`);
    else if (entry.waist) parts.push(`${entry.waist.toFixed(1)}cm waist`);
    if (entry.hrv_rmssd) parts.push(`${entry.hrv_rmssd.toFixed(0)} rmssd`);
    if (entry.pns_index != null) parts.push(`pns ${entry.pns_index.toFixed(1)}`);
    if (entry.kubios_readiness != null) parts.push(`rdy ${entry.kubios_readiness.toFixed(0)}`);
    if (entry.hrv) parts.push(`${entry.hrv} sdnn`);
    if (entry.readiness) parts.push(`${entry.readiness}/10 rdy`);
    if (entry.sleep) parts.push(`${entry.sleep}h sleep`);
    if (entry.shin_pain != null) parts.push(`${entry.shin_pain}/10 shin`);
    else if (entry.shin != null) parts.push(`${entry.shin}/10 shin`);
    if (entry.steps != null) parts.push(`${entry.steps.toLocaleString()} steps`);
    if (entry.active_calories != null) parts.push(`${entry.active_calories} aCal`);
    if (entry.resting_hr != null) parts.push(`${entry.resting_hr} rhr`);
    if (entry.vo2_max != null) parts.push(`${entry.vo2_max.toFixed(1)} vo2`);
    if (Array.isArray(entry.tags) && entry.tags.length > 0) parts.push(entry.tags.join(", "));
    return parts.join(" · ");
  };

  const pastEntries = useMemo(() =>
    checkins
      .filter(c => c.date !== todayStr)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 60),
    [checkins, todayStr]
  );

  // Reusable inline JSX renderers — defined as arrow functions returning JSX
  // rather than as React components to avoid remount issues (Bug fix: defining
  // components inside render causes input unmount/remount on every keystroke,
  // dismissing mobile keyboards). These share parent state via closure.
  const renderToggleSwitch = (enabled: boolean, onToggle: () => void) => (
    <button
      type="button"
      onClick={onToggle}
      className="relative inline-block w-10 h-5"
    >
      <span
        className={`absolute inline-block w-4 h-4 bg-desert-surface-hover rounded-full transition-transform ${
          enabled ? "translate-x-5" : "translate-x-0.5"
        }`}
        style={{ top: "2px", left: enabled ? "calc(100% - 17px)" : "2px" }}
      />
      <div
        className={`w-full h-full rounded-full transition-colors ${
          enabled ? "bg-desert-accent" : "bg-desert-surface"
        }`}
      />
    </button>
  );

  const renderShinPainSlider = () => (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <label className="font-mono text-xs uppercase tracking-wider text-desert-text-2">
          Shin Pain (0-10)
        </label>
        {renderToggleSwitch(shinPainEnabled, () => {
          setShinPainEnabled(!shinPainEnabled);
          if (shinPainEnabled) setShinPain(null);
        })}
      </div>
      {shinPainEnabled ? (
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="0"
            max="10"
            step="1"
            value={shinPain ?? 0}
            onChange={(e) => setShinPain(parseInt(e.target.value))}
            className="flex-1 accent-desert-accent"
          />
          <span className="font-mono text-desert-text w-6 text-right">{shinPain ?? 0}</span>
        </div>
      ) : (
        <div className="font-mono text-desert-text-3 text-sm">—</div>
      )}
    </div>
  );

  const renderWaistCmInput = () => (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <label className="font-mono text-xs uppercase tracking-wider text-desert-text-2">
          Waist (CM)
        </label>
        {renderToggleSwitch(waistCmEnabled, () => {
          setWaistCmEnabled(!waistCmEnabled);
          if (waistCmEnabled) setWaistCm("");
        })}
      </div>
      {waistCmEnabled ? (
        <input
          type="number"
          step="0.1"
          placeholder="85.0"
          value={waistCm}
          onChange={(e) => setWaistCm(e.target.value)}
          className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-3 py-2 font-mono text-desert-text placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent"
        />
      ) : (
        <div className="font-mono text-desert-text-3 text-sm">—</div>
      )}
    </div>
  );

  const renderTagsInput = () => (
    <div className="mb-6">
      <label className="block font-mono text-xs uppercase tracking-wider text-desert-text-2 mb-2">
        Tags
      </label>
      <input
        type="text"
        placeholder="e.g. rest-day, travel, deload"
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-3 py-2 font-mono text-desert-text placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent"
      />
    </div>
  );

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-desert-danger-dim border border-desert-danger text-desert-danger rounded-sm p-3 text-sm">
          {error}
        </div>
      )}

      {/* Section 1: Today's Form */}
      <div className="bg-desert-surface border border-desert-border rounded-sm p-5">
        <h2 className="font-mono font-bold text-base tracking-[0.06em] uppercase text-desert-text mb-4">Today&#39;s Check-in</h2>

        {/* Row 1: Weight, Sleep, HRV SDNN, Body Fat */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-xs text-desert-text-3 uppercase tracking-wider font-mono mb-2">
              Weight (kg)
            </label>
            <input
              type="number"
              step="0.1"
              placeholder="90.5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-3 py-2 text-desert-text placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent"
            />
          </div>
          <div>
            <label className="block text-xs text-desert-text-3 uppercase tracking-wider font-mono mb-2">
              Sleep (hrs)
            </label>
            <input
              type="number"
              step="0.25"
              placeholder="7.5"
              value={sleep}
              onChange={(e) => setSleep(e.target.value)}
              className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-3 py-2 text-desert-text placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent"
            />
          </div>
          <div>
            <label className="block text-xs text-desert-text-3 uppercase tracking-wider font-mono mb-2">
              HRV SDNN
            </label>
            <input
              type="number"
              step="1"
              placeholder="52"
              value={hrv}
              onChange={(e) => setHrv(e.target.value)}
              className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-3 py-2 text-desert-text placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent"
            />
          </div>
          <div>
            <label className="block text-xs text-desert-text-3 uppercase tracking-wider font-mono mb-2">
              Body Fat (%)
            </label>
            <input
              type="number"
              step="0.1"
              placeholder="Scale estimate"
              value={bodyFatPct}
              onChange={(e) => setBodyFatPct(e.target.value)}
              className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-3 py-2 text-desert-text placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent"
            />
          </div>
        </div>

        {/* Kubios Metrics (collapsible) */}
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setKubiosOpen(!kubiosOpen)}
            className="flex items-center gap-2 w-full text-left mb-3"
          >
            <span className={`text-desert-text-3 text-xs transition-transform ${kubiosOpen ? "rotate-90" : ""}`}>▶</span>
            <span className="font-mono text-xs uppercase tracking-wider text-desert-text-2">Kubios HRV Metrics</span>
          </button>
          {kubiosOpen && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pl-4 border-l border-desert-border">
              <div>
                <label className="block text-xs text-desert-accent uppercase tracking-wider font-mono mb-2">
                  RMSSD (ms)
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="From Kubios"
                  value={hrvRmssd}
                  onChange={(e) => setHrvRmssd(e.target.value)}
                  className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-3 py-2 text-desert-text placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent"
                />
              </div>
              <div>
                <label className="block text-xs text-desert-text-3 uppercase tracking-wider font-mono mb-2">
                  PNS Index (parasympathetic)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 1.2"
                  value={pnsIndex}
                  onChange={(e) => setPnsIndex(e.target.value)}
                  className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-3 py-2 text-desert-text placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent"
                />
              </div>
              <div>
                <label className="block text-xs text-desert-text-3 uppercase tracking-wider font-mono mb-2">
                  SNS Index (sympathetic)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. -0.8"
                  value={snsIndex}
                  onChange={(e) => setSnsIndex(e.target.value)}
                  className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-3 py-2 text-desert-text placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent"
                />
              </div>
              <div>
                <label className="block text-xs text-desert-text-3 uppercase tracking-wider font-mono mb-2">
                  Stress Index (Baevsky)
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="Baevsky"
                  value={stressIndex}
                  onChange={(e) => setStressIndex(e.target.value)}
                  className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-3 py-2 text-desert-text placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent"
                />
              </div>
              <div>
                <label className="block text-xs text-desert-text-3 uppercase tracking-wider font-mono mb-2">
                  Readiness (0-100)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  placeholder="Kubios 0-100"
                  value={kubiosReadiness}
                  onChange={(e) => setKubiosReadiness(e.target.value)}
                  className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-3 py-2 text-desert-text placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent"
                />
              </div>
              <div>
                <label className="block text-xs text-desert-text-3 uppercase tracking-wider font-mono mb-2">
                  Mean HR (bpm)
                </label>
                <input
                  type="number"
                  step="1"
                  placeholder="bpm"
                  value={meanHr}
                  onChange={(e) => setMeanHr(e.target.value)}
                  className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-3 py-2 text-desert-text placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent"
                />
              </div>
            </div>
          )}
        </div>

        {/* Readiness Scale */}
        <div className="mb-4">
          <label className="block text-xs text-desert-text-3 uppercase tracking-wider font-mono mb-3">
            Readiness (1 = wrecked · 10 = great)
          </label>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => toggleReadiness(value)}
                className={`w-10 h-10 rounded-sm border font-mono text-sm font-medium transition-colors duration-150 ${getReadinessColor(readiness === value ? value : null)}`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        {/* Shin Pain (range slider) */}
        {renderShinPainSlider()}

        {/* Waist (cm) */}
        {renderWaistCmInput()}

        {/* Tags */}
        {renderTagsInput()}

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full bg-desert-accent hover:bg-desert-accent-glow disabled:bg-desert-accent/50 text-desert-bg font-mono font-semibold uppercase tracking-wider text-sm rounded-sm py-2 px-4 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Saving..." : todayCheckin ? "Update today" : "Save check-in"}
        </button>
      </div>

      {/* Section 2: Trends */}
      <div className="space-y-6">
        {/* Body Composition */}
        <div>
          <p className="font-mono text-[10px] text-desert-text-3 uppercase tracking-widest mb-2">Body Composition</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="bg-desert-surface border border-desert-border rounded-sm p-4">
              <div className="font-mono text-xs text-desert-text-3 uppercase tracking-widest mb-1">7-day avg weight</div>
              <div className="font-mono font-bold text-2xl text-desert-text tracking-tight">{avg7Day !== null ? `${avg7Day.toFixed(1)}kg` : "—"}</div>
              <div className="font-mono text-xs text-desert-text-2 mt-1">{trend.arrow} {trend.diff}kg vs prev</div>
            </div>
            <div className="bg-desert-surface border border-desert-border rounded-sm p-4">
              <div className="font-mono text-xs text-desert-text-3 uppercase tracking-widest mb-1">Body Fat</div>
              <div className="font-mono font-bold text-2xl text-desert-text tracking-tight">{latestBodyFatPct != null ? `${latestBodyFatPct.toFixed(1)}%` : "—"}</div>
              <div className="font-mono text-xs text-desert-text-2 mt-1">scale estimate</div>
            </div>
            <div className="bg-desert-surface border border-desert-border rounded-sm p-4">
              <div className="font-mono text-xs text-desert-text-3 uppercase tracking-widest mb-1">Waist</div>
              <div className="font-mono font-bold text-2xl text-desert-text tracking-tight">{latestWaistCm != null ? `${latestWaistCm.toFixed(1)}cm` : "—"}</div>
              <div className="font-mono text-xs text-desert-text-2 mt-1">latest</div>
            </div>
          </div>
        </div>

        {/* HRV & Recovery */}
        <div>
          <p className="font-mono text-[10px] text-desert-text-3 uppercase tracking-widest mb-2">HRV & Recovery</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="bg-desert-surface border border-desert-border rounded-sm p-4">
              <div className="font-mono text-xs text-desert-text-3 uppercase tracking-widest mb-1">RMSSD (Polar)</div>
              <div className="font-mono font-bold text-2xl text-desert-accent tracking-tight">{latestRmssd !== undefined ? latestRmssd?.toFixed(0) : "—"}</div>
              <div className="font-mono text-xs text-desert-text-2 mt-1">ms · recovery</div>
            </div>
            <div className="bg-desert-surface border border-desert-border rounded-sm p-4">
              <div className="font-mono text-xs text-desert-text-3 uppercase tracking-widest mb-1">SDNN (Apple)</div>
              <div className="font-mono font-bold text-2xl text-desert-text tracking-tight">{latestHrv !== undefined ? latestHrv : "—"}</div>
              <div className="font-mono text-xs text-desert-text-2 mt-1">ms</div>
            </div>
            <div className="bg-desert-surface border border-desert-border rounded-sm p-4">
              <div className="font-mono text-xs text-desert-text-3 uppercase tracking-widest mb-1">Readiness</div>
              <div className="font-mono font-bold text-2xl text-desert-text tracking-tight">{latestReadiness !== undefined ? `${latestReadiness}/10` : "—"}</div>
              <div className="font-mono text-xs text-desert-text-2 mt-1">latest</div>
            </div>
            <div className="bg-desert-surface border border-desert-border rounded-sm p-4">
              <div className="font-mono text-xs text-desert-text-3 uppercase tracking-widest mb-1">Sleep</div>
              <div className="font-mono font-bold text-2xl text-desert-text tracking-tight">{latestSleep !== undefined ? `${latestSleep}h` : "—"}</div>
              <div className="font-mono text-xs text-desert-text-2 mt-1">latest</div>
            </div>
            <div className="bg-desert-surface border border-desert-border rounded-sm p-4">
              <div className="font-mono text-xs text-desert-text-3 uppercase tracking-widest mb-1">PNS Index</div>
              <div className={`font-mono font-bold text-2xl tracking-tight ${latestPns != null ? (latestPns >= 0 ? "text-desert-success" : "text-desert-danger") : "text-desert-text"}`}>{latestPns != null ? latestPns.toFixed(2) : "—"}</div>
              <div className="font-mono text-xs text-desert-text-2 mt-1">parasympathetic</div>
            </div>
            <div className="bg-desert-surface border border-desert-border rounded-sm p-4">
              <div className="font-mono text-xs text-desert-text-3 uppercase tracking-widest mb-1">SNS Index</div>
              <div className={`font-mono font-bold text-2xl tracking-tight ${latestSns != null ? (latestSns <= 0 ? "text-desert-success" : "text-desert-danger") : "text-desert-text"}`}>{latestSns != null ? latestSns.toFixed(2) : "—"}</div>
              <div className="font-mono text-xs text-desert-text-2 mt-1">sympathetic</div>
            </div>
          </div>
        </div>

        {/* Activity */}
        <div>
          <p className="font-mono text-[10px] text-desert-text-3 uppercase tracking-widest mb-2">Activity</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="bg-desert-surface border border-desert-border rounded-sm p-4">
              <div className="font-mono text-xs text-desert-text-3 uppercase tracking-widest mb-1">Steps</div>
              <div className="font-mono font-bold text-2xl text-desert-forest tracking-tight">{latestSteps != null ? latestSteps.toLocaleString() : "—"}</div>
              <div className="font-mono text-xs text-desert-text-2 mt-1">latest</div>
            </div>
            <div className="bg-desert-surface border border-desert-border rounded-sm p-4">
              <div className="font-mono text-xs text-desert-text-3 uppercase tracking-widest mb-1">Active Cal</div>
              <div className="font-mono font-bold text-2xl text-desert-accent tracking-tight">{latestActiveCals != null ? latestActiveCals.toLocaleString() : "—"}</div>
              <div className="font-mono text-xs text-desert-text-2 mt-1">kcal</div>
            </div>
            <div className="bg-desert-surface border border-desert-border rounded-sm p-4">
              <div className="font-mono text-xs text-desert-text-3 uppercase tracking-widest mb-1">Resting HR</div>
              <div className={`font-mono font-bold text-2xl tracking-tight ${latestRestingHr != null ? latestRestingHr < 55 ? "text-desert-success" : latestRestingHr < 65 ? "text-desert-text" : "text-desert-warning" : "text-desert-text"}`}>{latestRestingHr != null ? latestRestingHr : "—"}</div>
              <div className="font-mono text-xs text-desert-text-2 mt-1">bpm</div>
            </div>
            <div className="bg-desert-surface border border-desert-border rounded-sm p-4">
              <div className="font-mono text-xs text-desert-text-3 uppercase tracking-widest mb-1">VO2 Max</div>
              <div className="font-mono font-bold text-2xl text-desert-celestial tracking-tight">{latestVo2Max != null ? latestVo2Max.toFixed(1) : "—"}</div>
              <div className="font-mono text-xs text-desert-text-2 mt-1">ml/kg/min</div>
            </div>
          </div>
        </div>

        {/* Kubios */}
        <div>
          <p className="font-mono text-[10px] text-desert-text-3 uppercase tracking-widest mb-2">Kubios</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="bg-desert-surface border border-desert-border rounded-sm p-4">
              <div className="font-mono text-xs text-desert-text-3 uppercase tracking-widest mb-1">Stress Index</div>
              <div className={`font-mono font-bold text-2xl tracking-tight ${latestStress != null ? latestStress < 100 ? "text-desert-success" : latestStress < 200 ? "text-desert-warning" : "text-desert-danger" : "text-desert-text"}`}>{latestStress != null ? latestStress.toFixed(0) : "—"}</div>
              <div className="font-mono text-xs text-desert-text-2 mt-1">Baevsky</div>
            </div>
            <div className="bg-desert-surface border border-desert-border rounded-sm p-4">
              <div className="font-mono text-xs text-desert-text-3 uppercase tracking-widest mb-1">Kubios Readiness</div>
              <div className="font-mono font-bold text-2xl text-desert-accent tracking-tight">{latestKubiosReadiness != null ? `${latestKubiosReadiness.toFixed(0)}` : "—"}</div>
              <div className="font-mono text-xs text-desert-text-2 mt-1">/100</div>
            </div>
            <div className="bg-desert-surface border border-desert-border rounded-sm p-4">
              <div className="font-mono text-xs text-desert-text-3 uppercase tracking-widest mb-1">Mean HR</div>
              <div className="font-mono font-bold text-2xl text-desert-text tracking-tight">{latestMeanHr != null ? `${latestMeanHr.toFixed(0)}` : "—"}</div>
              <div className="font-mono text-xs text-desert-text-2 mt-1">bpm</div>
            </div>
          </div>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="bg-desert-surface border border-desert-border rounded-sm p-4">
            <div className="font-mono text-xs text-desert-text-3 uppercase tracking-widest mb-1">Streak</div>
            <div className="font-mono font-bold text-2xl text-desert-text tracking-tight">{streak} day{streak !== 1 ? "s" : ""}</div>
            <div className="font-mono text-xs text-desert-text-2 mt-1">consecutive check-ins</div>
          </div>
          <div className="bg-desert-surface border border-desert-border rounded-sm p-4">
            <div className="font-mono text-xs text-desert-text-3 uppercase tracking-widest mb-1">Shin Pain</div>
            <div className={`font-mono font-bold text-2xl tracking-tight ${getShinPainColor(latestShinPain)}`}>{latestShinPain != null ? `${latestShinPain}/10` : "—"}</div>
            <div className="font-mono text-xs text-desert-text-2 mt-1">latest</div>
          </div>
          <div className="bg-desert-surface border border-desert-border rounded-sm p-4">
            <div className="font-mono text-xs text-desert-text-3 uppercase tracking-widest mb-1">Total entries</div>
            <div className="font-mono font-bold text-2xl text-desert-text tracking-tight">{totalEntries}</div>
            <div className="font-mono text-xs text-desert-text-2 mt-1">all time</div>
          </div>
        </div>
      </div>

      {/* Section 3: Sparkline */}
      {sparklineData.length >= 2 && (
        <div className="bg-desert-surface border border-desert-border rounded-sm p-4">
          <div className="flex justify-between items-center mb-3">
            <div className="font-mono text-xs text-desert-text-3 uppercase tracking-widest">
              Weight — last 14 days
            </div>
            <div className="font-mono text-xs text-desert-text-2">
              {avg7Day !== null ? `${avg7Day.toFixed(1)}kg avg` : "—"}
            </div>
          </div>
          {generateSparkline()}
        </div>
      )}

      {/* Section 4: History */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-mono font-bold text-base tracking-[0.06em] uppercase text-desert-text">History</h2>
          <button
            onClick={() => openEditModal()}
            className="bg-desert-surface border border-desert-border text-desert-text-2 font-mono text-sm rounded-sm py-2 px-4 hover:bg-desert-surface-hover hover:border-desert-border-strong transition-colors duration-150"
          >
            + Add past date
          </button>
        </div>

        <div className="space-y-2">
          {pastEntries.length === 0 ? (
            <p className="font-sans text-sm text-desert-text-3">No past entries</p>
          ) : (
            pastEntries.map((entry) => (
              <div key={entry.id} className="bg-desert-surface border border-desert-border rounded-sm p-4 hover:bg-desert-surface-hover hover:border-desert-border-strong transition-colors duration-150 cursor-pointer" onClick={() => openEditModal(entry)}>
                <div className="flex justify-between items-baseline mb-3">
                  <span className="font-mono font-medium text-sm tracking-[0.04em] uppercase text-desert-text-2">
                    {new Date(entry.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </span>
                </div>

                {/* Card body - checkin summary */}
                {formatHistoryPill(entry) && (
                  <p className="font-sans text-sm text-desert-text-2 leading-relaxed">
                    {formatHistoryPill(entry)}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={closeModal}>
          <div
            className="bg-desert-surface border border-desert-border rounded-t-sm p-6 w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-mono font-medium text-sm tracking-[0.04em] uppercase text-desert-text-2">
                {editingEntry ? "Edit entry" : "New entry"}
              </h3>
              <button
                onClick={closeModal}
                className="text-desert-text-2 hover:text-desert-text text-2xl"
              >
                ×
              </button>
            </div>

            {!editingEntry && (
              <div className="mb-4">
                <label className="block font-mono text-xs text-desert-text-3 uppercase tracking-wider mb-2">
                  Date
                </label>
                <input
                  type="date"
                  max={todayStr}
                  value={pastDate}
                  onChange={(e) => setPastDate(e.target.value)}
                  className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-3 py-2 text-desert-text font-sans focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent"
                />
              </div>
            )}

            {editingEntry && (
              <div className="mb-4">
                <label className="block font-mono text-xs text-desert-text-3 uppercase tracking-wider mb-2">
                  Date
                </label>
                <div className="font-mono text-sm text-desert-text">
                  {new Date(editingEntry.date + "T00:00:00").toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block font-mono text-xs text-desert-text-3 uppercase tracking-wider mb-2">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="90.5"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-3 py-2 text-desert-text font-sans placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent"
                />
              </div>

              <div>
                <label className="block font-mono text-xs text-desert-text-3 uppercase tracking-wider mb-2">
                  Body Fat (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="Scale estimate"
                  value={bodyFatPct}
                  onChange={(e) => setBodyFatPct(e.target.value)}
                  className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-3 py-2 text-desert-text font-sans placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent"
                />
              </div>

              <div>
                <label className="block font-mono text-xs text-desert-text-3 uppercase tracking-wider mb-2">
                  Sleep (hrs)
                </label>
                <input
                  type="number"
                  step="0.25"
                  placeholder="7.5"
                  value={sleep}
                  onChange={(e) => setSleep(e.target.value)}
                  className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-3 py-2 text-desert-text font-sans placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent"
                />
              </div>

              <div>
                <label className="block font-mono text-xs text-desert-text-3 uppercase tracking-wider mb-2">
                  HRV
                </label>
                <input
                  type="number"
                  step="1"
                  placeholder="52"
                  value={hrv}
                  onChange={(e) => setHrv(e.target.value)}
                  className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-3 py-2 text-desert-text font-sans placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent"
                />
              </div>

              <div>
                <label className="block font-mono text-xs text-desert-text-3 uppercase tracking-wider mb-3">
                  Readiness (1 = wrecked · 10 = great)
                </label>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleReadiness(value)}
                      className={`w-10 h-10 rounded-sm border font-mono text-sm font-medium transition-colors duration-150 ${getReadinessColor(readiness === value ? value : null)}`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>

              {/* Shin Pain (range slider) */}
              {renderShinPainSlider()}

              {/* Waist (cm) */}
              {renderWaistCmInput()}

              {/* Tags */}
              {renderTagsInput()}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleModalSave}
                disabled={loading}
                className="flex-1 bg-desert-accent hover:bg-desert-accent-glow disabled:bg-desert-accent/50 text-desert-bg font-mono font-semibold uppercase tracking-wider text-sm rounded-sm py-2 px-4 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Saving..." : editingEntry ? "Update entry" : "Save entry"}
              </button>
              {editingEntry && (
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="px-4 py-2 bg-desert-danger-dim border border-desert-danger text-desert-danger font-mono text-sm rounded-sm hover:bg-desert-danger transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
