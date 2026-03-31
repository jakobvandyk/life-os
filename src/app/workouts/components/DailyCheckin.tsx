"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";

export interface Checkin {
  id?: string;
  user_id: string;
  date: string;
  weight?: number | null;
  sleep?: number | null;
  hrv?: number | null;
  readiness?: number | null;
  shin?: number | null;
  waist?: number | null;
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
  const [shinEnabled, setShinEnabled] = useState(false);
  const [shin, setShin] = useState<number | null>(null);
  const [waistEnabled, setWaistEnabled] = useState(false);
  const [waist, setWaist] = useState<string>("");

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
  const latestReadiness = checkins.find(c => c.readiness != null)?.readiness;
  const latestSleep = checkins.find(c => c.sleep != null)?.sleep;
  const totalEntries = checkins.length;

  // Load today's data into form
  useEffect(() => {
    if (todayCheckin) {
      setWeight(todayCheckin.weight?.toString() || "");
      setSleep(todayCheckin.sleep?.toString() || "");
      setHrv(todayCheckin.hrv?.toString() || "");
      setReadiness(todayCheckin.readiness || null);
      setShinEnabled(todayCheckin.shin != null);
      setShin(todayCheckin.shin || null);
      setWaistEnabled(todayCheckin.waist != null);
      setWaist(todayCheckin.waist?.toString() || "");
    } else {
      setWeight("");
      setSleep("");
      setHrv("");
      setReadiness(null);
      setShinEnabled(false);
      setShin(null);
      setWaistEnabled(false);
      setWaist("");
    }
  }, [todayCheckin]);

  const handleSave = async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);

    try {
      const payload = {
        user_id: userId,
        date: todayStr,
        weight: weight ? parseFloat(weight) : null,
        sleep: sleep ? parseFloat(sleep) : null,
        hrv: hrv ? parseInt(hrv) : null,
        readiness: readiness,
        shin: shinEnabled ? shin : null,
        waist: waistEnabled && waist ? parseFloat(waist) : null,
      };

      const { error } = await supabase
        .from("workout_checkins")
        .upsert(payload, { onConflict: "user_id,date" });

      if (error) throw error;

      onRefetch();
      // Reset form if it's a new entry (not update)
      if (!todayCheckin) {
        setWeight("");
        setSleep("");
        setHrv("");
        setReadiness(null);
        setShinEnabled(false);
        setShin(null);
        setWaistEnabled(false);
        setWaist("");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (entry?: Checkin) => {
    if (entry) {
      setEditingEntry(entry);
      setPastDate(entry.date);
      setWeight(entry.weight?.toString() || "");
      setSleep(entry.sleep?.toString() || "");
      setHrv(entry.hrv?.toString() || "");
      setReadiness(entry.readiness || null);
      setShinEnabled(entry.shin != null);
      setShin(entry.shin || null);
      setWaistEnabled(entry.waist != null);
      setWaist(entry.waist?.toString() || "");
    } else {
      setEditingEntry(null);
      setPastDate(new Date().toISOString().slice(0, 10));
      setWeight("");
      setSleep("");
      setHrv("");
      setReadiness(null);
      setShinEnabled(false);
      setShin(null);
      setWaistEnabled(false);
      setWaist("");
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
      const dateToUse = pastDate;
      const payload = {
        user_id: userId,
        date: dateToUse,
        weight: weight ? parseFloat(weight) : null,
        sleep: sleep ? parseFloat(sleep) : null,
        hrv: hrv ? parseInt(hrv) : null,
        readiness: readiness,
        shin: shinEnabled ? shin : null,
        waist: waistEnabled && waist ? parseFloat(waist) : null,
      };

      const { error } = await supabase
        .from("workout_checkins")
        .upsert(payload, { onConflict: "user_id,date" });

      if (error) throw error;

      closeModal();
      onRefetch();
      // If editing today, reload form state
      if (editingEntry?.date === todayStr) {
        const newToday = checkins.find(c => c.date === todayStr);
        if (newToday) {
          setWeight(newToday.weight?.toString() || "");
          setSleep(newToday.sleep?.toString() || "");
          setHrv(newToday.hrv?.toString() || "");
          setReadiness(newToday.readiness || null);
          setShinEnabled(newToday.shin != null);
          setShin(newToday.shin || null);
          setWaistEnabled(newToday.waist != null);
          setWaist(newToday.waist?.toString() || "");
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

      if (error) throw error;

      closeModal();
      onRefetch();
      // If deleted today's entry, clear form
      if (editingEntry.date === todayStr) {
        setWeight("");
        setSleep("");
        setHrv("");
        setReadiness(null);
        setShinEnabled(false);
        setShin(null);
        setWaistEnabled(false);
        setWaist("");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getReadinessColor = (value: number | null) => {
    if (value === null) return "border-gray-700 text-gray-500";
    if (value >= 1 && value <= 3) return "bg-red-900/50 border-red-500 text-red-400";
    if (value >= 4 && value <= 6) return "bg-amber-900/50 border-amber-500 text-amber-400";
    if (value >= 7 && value <= 10) return "bg-green-900/50 border-green-500 text-green-400";
    return "border-gray-700 text-gray-500";
  };

  const getShinColor = (value: number | null) => {
    if (value === null) return "border-gray-700 text-gray-500";
    if (value >= 0 && value <= 2) return "bg-green-900/50 border-green-500 text-green-400";
    if (value >= 3 && value <= 5) return "bg-amber-900/50 border-amber-500 text-amber-400";
    if (value >= 6 && value <= 10) return "bg-red-900/50 border-red-500 text-red-400";
    return "border-gray-700 text-gray-500";
  };

  const toggleReadiness = (value: number) => {
    setReadiness(prev => prev === value ? null : value);
  };

  const toggleShin = (value: number) => {
    setShin(prev => prev === value ? null : value);
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
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
        <polyline
          points={points}
          fill="none"
          stroke="white"
          strokeWidth="1.5"
        />
        <circle cx={lastX} cy={lastY} r="3" fill="white" />
      </svg>
    );
  };

  const formatHistoryPill = (entry: Checkin) => {
    const parts = [];
    if (entry.weight) parts.push(`${entry.weight.toFixed(1)}kg wt`);
    if (entry.waist) parts.push(`${entry.waist.toFixed(1)}cm waist`);
    if (entry.hrv) parts.push(`${entry.hrv} hrv`);
    if (entry.readiness) parts.push(`${entry.readiness}/10 rdy`);
    if (entry.sleep) parts.push(`${entry.sleep}h sleep`);
    if (entry.shin != null) parts.push(`${entry.shin}/10 shin`);
    return parts.join(" · ");
  };

  const pastEntries = useMemo(() => 
    checkins
      .filter(c => c.date !== todayStr)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 60),
    [checkins, todayStr]
  );

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-900/50 border border-red-500 text-red-400 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {/* Section 1: Today's Form */}
      <div className="bg-gray-900 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-white mb-4">Today's Check-in</h2>

        {/* Row 1: Weight, Sleep, HRV */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider font-mono mb-2">
              Weight (kg)
            </label>
            <input
              type="number"
              step="0.1"
              placeholder="90.5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider font-mono mb-2">
              Sleep (hrs)
            </label>
            <input
              type="number"
              step="0.25"
              placeholder="7.5"
              value={sleep}
              onChange={(e) => setSleep(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider font-mono mb-2">
              HRV
            </label>
            <input
              type="number"
              step="1"
              placeholder="52"
              value={hrv}
              onChange={(e) => setHrv(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Row 2: Readiness Scale */}
        <div className="mb-4">
          <label className="block text-xs text-gray-500 uppercase tracking-wider font-mono mb-3">
            Readiness (1 = wrecked · 10 = great)
          </label>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => toggleReadiness(value)}
                className={`w-10 h-10 rounded-lg border font-mono text-sm font-medium transition-colors ${getReadinessColor(readiness === value ? value : null)}`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        {/* Row 3: Shin Pain Toggle */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-gray-300">Shin pain today</label>
            <button
              type="button"
              onClick={() => {
                setShinEnabled(!shinEnabled);
                if (shinEnabled) setShin(null);
              }}
              className="relative inline-block w-10 h-5"
            >
              <span
                className={`absolute inline-block w-4 h-4 bg-white rounded-full transition-transform ${
                  shinEnabled ? "translate-x-5" : "translate-x-0.5"
                }`}
                style={{ top: "2px", left: shinEnabled ? "calc(100% - 17px)" : "2px" }}
              />
              <div
                className={`w-full h-full rounded-full transition-colors ${
                  shinEnabled ? "bg-amber-500" : "bg-gray-700"
                }`}
              />
            </button>
          </div>
          {shinEnabled && (
            <div className="mt-3">
              <div className="flex flex-wrap gap-2">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleShin(value)}
                    className={`w-10 h-10 rounded-lg border font-mono text-sm font-medium transition-colors ${getShinColor(shin === value ? value : null)}`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Row 4: Waist Toggle */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-gray-300">Log waist cm</label>
            <button
              type="button"
              onClick={() => {
                setWaistEnabled(!waistEnabled);
                if (!waistEnabled) setWaist("");
              }}
              className="relative inline-block w-10 h-5"
            >
              <span
                className={`absolute inline-block w-4 h-4 bg-white rounded-full transition-transform ${
                  waistEnabled ? "translate-x-5" : "translate-x-0.5"
                }`}
                style={{ top: "2px", left: waistEnabled ? "calc(100% - 17px)" : "2px" }}
              />
              <div
                className={`w-full h-full rounded-full transition-colors ${
                  waistEnabled ? "bg-amber-500" : "bg-gray-700"
                }`}
              />
            </button>
          </div>
          {waistEnabled && (
            <input
              type="number"
              step="0.5"
              placeholder="85.0"
              value={waist}
              onChange={(e) => setWaist(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
            />
          )}
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/50 text-gray-950 font-mono font-medium py-3 rounded-lg transition-colors"
        >
          {loading ? "Saving..." : todayCheckin ? "Update today" : "Save check-in"}
        </button>
      </div>

      {/* Section 2: Trends */}
      <div className="grid grid-cols-3 gap-4">
        {/* 7-day avg weight */}
        <div className="bg-gray-900 rounded-lg p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider font-mono mb-1">
            7-day avg weight
          </div>
          <div className="text-2xl font-mono font-semibold text-white">
            {avg7Day !== null ? `${avg7Day.toFixed(1)}kg` : "—"}
          </div>
          <div className="text-xs font-mono text-gray-400 mt-1">
            {trend.arrow} {trend.diff}kg vs prev
          </div>
        </div>

        {/* Streak */}
        <div className="bg-gray-900 rounded-lg p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider font-mono mb-1">
            Streak
          </div>
          <div className="text-2xl font-mono font-semibold text-white">
            {streak} day{streak !== 1 ? "s" : ""}
          </div>
          <div className="text-xs font-mono text-gray-400 mt-1">
            consecutive check-ins
          </div>
        </div>

        {/* Latest HRV */}
        <div className="bg-gray-900 rounded-lg p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider font-mono mb-1">
            Latest HRV
          </div>
          <div className="text-2xl font-mono font-semibold text-white">
            {latestHrv !== undefined ? latestHrv : "—"}
          </div>
          <div className="text-xs font-mono text-gray-400 mt-1">
            ms
          </div>
        </div>

        {/* Readiness */}
        <div className="bg-gray-900 rounded-lg p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider font-mono mb-1">
            Readiness
          </div>
          <div className="text-2xl font-mono font-semibold text-white">
            {latestReadiness !== undefined ? `${latestReadiness}/10` : "—"}
          </div>
          <div className="text-xs font-mono text-gray-400 mt-1">
            latest
          </div>
        </div>

        {/* Sleep */}
        <div className="bg-gray-900 rounded-lg p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider font-mono mb-1">
            Sleep
          </div>
          <div className="text-2xl font-mono font-semibold text-white">
            {latestSleep !== undefined ? `${latestSleep}h` : "—"}
          </div>
          <div className="text-xs font-mono text-gray-400 mt-1">
            latest
          </div>
        </div>

        {/* Total Entries */}
        <div className="bg-gray-900 rounded-lg p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider font-mono mb-1">
            Total entries
          </div>
          <div className="text-2xl font-mono font-semibold text-white">
            {totalEntries}
          </div>
          <div className="text-xs font-mono text-gray-400 mt-1">
            all time
          </div>
        </div>
      </div>

      {/* Section 3: Sparkline */}
      {sparklineData.length >= 2 && (
        <div className="bg-gray-900 rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <div className="text-xs text-gray-500 uppercase tracking-wider font-mono">
              Weight — last 14 days
            </div>
            <div className="text-xs font-mono text-gray-400">
              {avg7Day !== null ? `${avg7Day.toFixed(1)}kg avg` : "—"}
            </div>
          </div>
          {generateSparkline()}
        </div>
      )}

      {/* Section 4: History */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-white">History</h2>
          <button
            onClick={() => openEditModal()}
            className="bg-gray-800 hover:bg-gray-700 text-white text-sm font-mono px-4 py-2 rounded-lg transition-colors"
          >
            + Add past date
          </button>
        </div>

        <div className="space-y-2">
          {pastEntries.length === 0 ? (
            <p className="text-gray-500 text-sm">No past entries</p>
          ) : (
            pastEntries.map((entry) => (
              <div key={entry.id} className="bg-gray-900 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-sm font-mono text-white">
                    {new Date(entry.date + "T00:00:00").toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                  <button
                    onClick={() => openEditModal(entry)}
                    className="text-xs text-gray-400 hover:text-white font-mono transition-colors"
                  >
                    Edit
                  </button>
                </div>
                <div className="text-xs text-gray-400 font-mono">
                  {formatHistoryPill(entry)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={closeModal}>
          <div
            className="bg-gray-900 rounded-t-lg p-6 w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">
                {editingEntry ? "Edit entry" : "New entry"}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            {!editingEntry && (
              <div className="mb-4">
                <label className="block text-xs text-gray-500 uppercase tracking-wider font-mono mb-2">
                  Date
                </label>
                <input
                  type="date"
                  max={todayStr}
                  value={pastDate}
                  onChange={(e) => setPastDate(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            )}

            {editingEntry && (
              <div className="mb-4">
                <label className="block text-xs text-gray-500 uppercase tracking-wider font-mono mb-2">
                  Date
                </label>
                <div className="text-sm text-white font-mono">
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
                <label className="block text-xs text-gray-500 uppercase tracking-wider font-mono mb-2">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="90.5"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider font-mono mb-2">
                  Sleep (hrs)
                </label>
                <input
                  type="number"
                  step="0.25"
                  placeholder="7.5"
                  value={sleep}
                  onChange={(e) => setSleep(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider font-mono mb-2">
                  HRV
                </label>
                <input
                  type="number"
                  step="1"
                  placeholder="52"
                  value={hrv}
                  onChange={(e) => setHrv(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider font-mono mb-3">
                  Readiness (1 = wrecked · 10 = great)
                </label>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleReadiness(value)}
                      className={`w-10 h-10 rounded-lg border font-mono text-sm font-medium transition-colors ${getReadinessColor(readiness === value ? value : null)}`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-gray-300">Shin pain today</label>
                  <button
                    type="button"
                    onClick={() => {
                      setShinEnabled(!shinEnabled);
                      if (shinEnabled) setShin(null);
                    }}
                    className="relative inline-block w-10 h-5"
                  >
                    <span
                      className={`absolute inline-block w-4 h-4 bg-white rounded-full transition-transform ${
                        shinEnabled ? "translate-x-5" : "translate-x-0.5"
                      }`}
                      style={{ top: "2px", left: shinEnabled ? "calc(100% - 17px)" : "2px" }}
                    />
                    <div
                      className={`w-full h-full rounded-full transition-colors ${
                        shinEnabled ? "bg-amber-500" : "bg-gray-700"
                      }`}
                    />
                  </button>
                </div>
                {shinEnabled && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => toggleShin(value)}
                        className={`w-10 h-10 rounded-lg border font-mono text-sm font-medium transition-colors ${getShinColor(shin === value ? value : null)}`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-gray-300">Log waist cm</label>
                  <button
                    type="button"
                    onClick={() => {
                      setWaistEnabled(!waistEnabled);
                      if (!waistEnabled) setWaist("");
                    }}
                    className="relative inline-block w-10 h-5"
                  >
                    <span
                      className={`absolute inline-block w-4 h-4 bg-white rounded-full transition-transform ${
                        waistEnabled ? "translate-x-5" : "translate-x-0.5"
                      }`}
                      style={{ top: "2px", left: waistEnabled ? "calc(100% - 17px)" : "2px" }}
                    />
                    <div
                      className={`w-full h-full rounded-full transition-colors ${
                        waistEnabled ? "bg-amber-500" : "bg-gray-700"
                      }`}
                    />
                  </button>
                </div>
                {waistEnabled && (
                  <input
                    type="number"
                    step="0.5"
                    placeholder="85.0"
                    value={waist}
                    onChange={(e) => setWaist(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                  />
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleModalSave}
                disabled={loading}
                className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/50 text-gray-950 font-mono font-medium py-3 rounded-lg transition-colors"
              >
                {loading ? "Saving..." : editingEntry ? "Update entry" : "Save entry"}
              </button>
              {editingEntry && (
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="px-6 py-3 border border-red-500 text-red-400 hover:bg-red-900/30 font-mono text-sm rounded-lg transition-colors disabled:opacity-50"
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
