"use client";

import { useEffect, useState } from "react";

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
  "w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none";

export default function JournalPage() {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [gratitude, setGratitude] = useState("");
  const [reflection, setReflection] = useState("");
  const [wins, setWins] = useState("");
  const [recentEntries, setRecentEntries] = useState<JournalEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchEntry = (date: string) => {
    fetch(`/api/journal?date=${date}`).then((r) => r.json()).then((data) => {
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
      });
  };

  const fetchRecent = () => {
    fetch("/api/journal").then((r) => r.json()).then(setRecentEntries);
  };

  useEffect(() => {
    fetchEntry(selectedDate);
    fetchRecent();
  }, [selectedDate]);

  const saveEntry = async () => {
    setSaving(true);
    await fetch("/api/journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: selectedDate,
        mood,
        energy,
        gratitude,
        reflection,
        wins,
      }),
    });
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
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">📔 Journal</h1>
        <p className="text-gray-500 mt-1">Daily reflection & check-in</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Entry — Left 2 Columns */}
        <div className="col-span-2 space-y-6">
          {/* Date Picker */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => goToDate(-1)}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg text-sm transition-colors"
            >
              ← Prev
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={() => goToDate(1)}
              disabled={isToday}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                isToday
                  ? "bg-gray-800 text-gray-600 cursor-not-allowed"
                  : "bg-gray-800 hover:bg-gray-700 text-gray-400"
              }`}
            >
              Next →
            </button>
            {isToday && (
              <span className="text-xs text-indigo-400 font-medium">Today</span>
            )}
          </div>

          <p className="text-lg text-gray-300 font-medium">{displayDate}</p>

          {/* Mood Selector */}
          <div>
            <p className="text-sm text-gray-400 mb-2">How are you feeling?</p>
            <div className="flex gap-2">
              {moodOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setMood(opt.value)}
                  className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl transition-all ${
                    mood === opt.value
                      ? "bg-indigo-600/30 border-2 border-indigo-500 scale-105"
                      : "bg-gray-900 border-2 border-gray-800 hover:border-gray-700"
                  }`}
                >
                  <span className="text-2xl">{opt.emoji}</span>
                  <span className="text-xs text-gray-400">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Energy Selector */}
          <div>
            <p className="text-sm text-gray-400 mb-2">Energy level?</p>
            <div className="flex gap-2">
              {energyOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setEnergy(opt.value)}
                  className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl transition-all ${
                    energy === opt.value
                      ? "bg-indigo-600/30 border-2 border-indigo-500 scale-105"
                      : "bg-gray-900 border-2 border-gray-800 hover:border-gray-700"
                  }`}
                >
                  <span className="text-2xl">{opt.emoji}</span>
                  <span className="text-xs text-gray-400">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Gratitude */}
          <div>
            <p className="text-sm text-gray-400 mb-2">
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
            <p className="text-sm text-gray-400 mb-2">🏆 Wins & accomplishments</p>
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
            <p className="text-sm text-gray-400 mb-2">💭 Reflection</p>
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
            className={`w-full py-3 rounded-lg text-sm font-medium transition-all ${
              saved
                ? "bg-green-600 text-white"
                : saving
                ? "bg-gray-700 text-gray-400"
                : "bg-indigo-600 hover:bg-indigo-500 text-white"
            }`}
          >
            {saved ? "✓ Saved!" : saving ? "Saving..." : "Save Entry"}
          </button>
        </div>

        {/* Recent Entries — Right Column */}
        <div>
          <h2 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">
            Recent Entries
          </h2>
          {recentEntries.length === 0 ? (
            <p className="text-gray-600 text-sm">No entries yet.</p>
          ) : (
            <div className="space-y-2">
              {recentEntries.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setSelectedDate(e.date)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    e.date === selectedDate
                      ? "bg-indigo-600/20 border border-indigo-500/30"
                      : "bg-gray-900 border border-gray-800 hover:border-gray-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">
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
                    <p className="text-xs text-gray-500 mt-1 truncate">
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