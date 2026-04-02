"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { queueWrite } from "@/lib/sync";
import PixelIcon from "@/components/PixelIcon";

interface JournalEntry {
  id: number;
  date: string;
  mood: number | null;
  energy: number | null;
  gratitude: string;
  reflection: string;
  wins: string;
}

const moodOptions = [
  { value: 1, emoji: "😞", label: "Rough" },
  { value: 2, emoji: "😐", label: "Meh" },
  { value: 3, emoji: "🙂", label: "Okay" },
  { value: 4, emoji: "😊", label: "Good" },
  { value: 5, emoji: "🤩", label: "Great" },
];

const energyOptions = [
  { value: 1, emoji: "🪫", label: "Drained" },
  { value: 2, emoji: "😴", label: "Low" },
  { value: 3, emoji: "⚡", label: "Moderate" },
  { value: 4, emoji: "🔥", label: "High" },
  { value: 5, emoji: "🚀", label: "Peak" },
];

const textareaClass =
  "w-full bg-desert-bg border border-desert-border-strong rounded-sm px-4 py-3 text-desert-text text-sm placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent transition-colors resize-none";

export default function JournalPage() {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [gratitude, setGratitude] = useState("");
  const [reflection, setReflection] = useState("");
  const [wins, setWins] = useState("");
  const [recentEntries, setRecentEntries] = useState<JournalEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchEntry = async (date: string) => {
    const { data, error } = await supabase
      .from("journal_entries")
      .select("*")
      .eq("date", date)
      .maybeSingle();

    if (error) {
      console.error("Error fetching entry:", error);
      return;
    }

    setEntry(data);
    if (data) {
      setMood(data.mood);
      setEnergy(data.energy);
      setGratitude(data.gratitude || "");
      setReflection(data.reflection || "");
      setWins(data.wins || "");
    } else {
      setMood(null);
      setEnergy(null);
      setGratitude("");
      setReflection("");
      setWins("");
    }
  };

  const fetchRecent = async () => {
    const { data, error } = await supabase
      .from("journal_entries")
      .select("*")
      .order("date", { ascending: false })
      .limit(30);

    if (error) {
      console.error("Error fetching recent entries:", error);
      return;
    }

    setRecentEntries(data || []);
  };

  useEffect(() => {
    fetchEntry(selectedDate);
    fetchRecent();
  }, [selectedDate]);

  const saveEntry = async () => {
    if (!userId) return;
    setSaving(true);
    const payload = {
      user_id: userId,
      date: selectedDate,
      mood,
      energy,
      gratitude,
      reflection,
      wins,
    };
    const { error } = await supabase.from("journal_entries").upsert(
      payload,
      { onConflict: "user_id,date" }
    );

    if (error) {
      await queueWrite("journal_entries", "insert", payload);
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    fetchRecent();
  };

  const goToDate = (offset: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const isToday = selectedDate === new Date().toISOString().split("T")[0];

  const displayDate = new Date(selectedDate + "T12:00:00").toLocaleDateString(
    "en-NZ",
    { weekday: "long", year: "numeric", month: "long", day: "numeric" }
  );

  return (
    <div className="bg-desert-bg min-h-screen p-6 relative z-10">
      {/* Header */}
      <div className="mb-8 pb-6 border-b border-desert-border">
          <h1 className="font-pixel text-lg text-desert-text flex items-center gap-3"><PixelIcon name="journal" size={18} className="text-desert-accent" /> Journal</h1>
          <p className="text-desert-text-3 mt-1">Daily reflection & check-in</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Entry — Left 2 Columns */}
        <div className="col-span-2 space-y-6">
          {/* Date Picker */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => goToDate(-1)}
              className="px-3 py-1.5 bg-desert-surface hover:bg-desert-surface-hover text-desert-text-3 rounded-sm text-sm transition-colors"
            >
              ← Prev
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-desert-surface border border-desert-border rounded-sm px-3 py-1.5 text-desert-text text-sm focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent transition-colors"
            />
            <button
              onClick={() => goToDate(1)}
              disabled={isToday}
              className={`px-3 py-1.5 rounded-sm text-sm transition-colors ${
                isToday
                  ? "bg-desert-surface text-desert-text-3 cursor-not-allowed"
                  : "bg-desert-surface hover:bg-desert-surface-hover text-desert-text-3"
              }`}
            >
              Next →
            </button>
            {isToday && (
              <span className="text-xs text-desert-accent font-medium">Today</span>
            )}
          </div>

          <p className="text-base font-mono text-desert-text">{displayDate}</p>

          {/* Mood Selector */}
          <div>
            <p className="text-sm font-mono text-desert-text-3 mb-2">How are you feeling?</p>
            <div className="flex gap-2">
              {moodOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setMood(opt.value)}
                  className={`flex flex-col items-center gap-1 px-4 py-3 rounded-sm transition-all ${
                    mood === opt.value
                      ? "bg-desert-accent/30 border-2 border-desert-accent scale-105"
                      : "bg-desert-surface border-2 border-desert-border hover:border-desert-border-strong"
                  }`}
                >
                  <span className="text-2xl">{opt.emoji}</span>
                  <span className="text-xs text-desert-text-3">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Energy Selector */}
          <div>
            <p className="text-sm font-mono text-desert-text-3 mb-2">Energy level?</p>
            <div className="flex gap-2">
              {energyOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setEnergy(opt.value)}
                  className={`flex flex-col items-center gap-1 px-4 py-3 rounded-sm transition-all ${
                    energy === opt.value
                      ? "bg-desert-accent/30 border-2 border-desert-accent scale-105"
                      : "bg-desert-surface border-2 border-desert-border hover:border-desert-border-strong"
                  }`}
                >
                  <span className="text-2xl">{opt.emoji}</span>
                  <span className="text-xs text-desert-text-3">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Gratitude */}
          <div>
            <p className="text-sm font-mono text-desert-text-3 mb-2">
              🙏 What are you grateful for today?
            </p>
            <textarea
              value={gratitude}
              onChange={(e) => setGratitude(e.target.value)}
              placeholder="Three things you're grateful for..."
              rows={3}
              className={textareaClass}
            />
          </div>

          {/* Wins */}
          <div>
            <p className="text-sm font-mono text-desert-text-3 mb-2">🏆 Wins & accomplishments</p>
            <textarea
              value={wins}
              onChange={(e) => setWins(e.target.value)}
              placeholder="What went well? What did you accomplish?"
              rows={3}
              className={textareaClass}
            />
          </div>

          {/* Reflection */}
          <div>
            <p className="text-sm font-mono text-desert-text-3 mb-2">💭 Reflection</p>
            <textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              placeholder="What's on your mind? What could be better?"
              rows={4}
              className={textareaClass}
            />
          </div>

          {/* Save Button */}
          <button
            onClick={saveEntry}
            disabled={saving}
            className={`w-full py-3 rounded-sm text-sm font-mono transition-all ${
              saved
                ? "bg-desert-success text-desert-text"
                : saving
                ? "bg-desert-surface text-desert-text-3"
                : "bg-desert-accent hover:bg-desert-accent-hover text-desert-text"
            }`}
          >
            {saved ? "✓ Saved!" : saving ? "Saving..." : "Save Entry"}
          </button>
        </div>

        {/* Recent Entries — Right Column */}
        <div>
          <h2 className="text-sm font-mono text-desert-text-3 mb-3 uppercase tracking-wider">
            Recent Entries
          </h2>
          {recentEntries.length === 0 ? (
            <p className="text-desert-text-3 text-sm">No entries yet.</p>
          ) : (
            <div className="space-y-2">
              {recentEntries.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setSelectedDate(e.date)}
                  className={`w-full text-left p-3 rounded-sm transition-colors ${
                    e.date === selectedDate
                    ? "bg-desert-accent/20 border border-desert-accent/30"
                    : "bg-desert-surface border border-desert-border hover:border-desert-border-strong"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono text-desert-text">
                      {new Date(e.date + "T12:00:00").toLocaleDateString("en-NZ", {
                        month: "short",
                        day: "numeric",
                        weekday: "short",
                      })}
                    </span>
                    <div className="flex gap-1">
                      {e.mood && (
                        <span className="text-sm">
                          {moodOptions.find((m) => m.value === e.mood)?.emoji}
                        </span>
                      )}
                      {e.energy && (
                        <span className="text-sm">
                          {energyOptions.find((en) => en.value === e.energy)?.emoji}
                        </span>
                      )}
                    </div>
                  </div>
                  {e.gratitude && (
                    <p className="text-xs text-desert-text-3 mt-1 truncate">
                      {e.gratitude}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}