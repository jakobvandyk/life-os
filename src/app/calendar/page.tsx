"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";

interface CalendarEvent {
  id: number;
  title: string;
  type: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  all_day: boolean;
  notes: string | null;
  color: string | null;
}

interface TaskItem {
  id: number;
  title: string;
  due_date: string;
  priority: string;
}

interface GoalItem {
  id: number;
  title: string;
  target_date: string;
  area: string;
}

type UnifiedItem = {
  id: string;
  title: string;
  date: string;
  time: string | null;
  source: "event" | "task" | "goal";
  priority?: string;
  area?: string;
  notes?: string | null;
  allDay: boolean;
};

const SOURCE_STYLES: Record<string, { badge: string; dot: string }> = {
  event: {
    badge: "bg-desert-celestial/20 text-desert-celestial border border-desert-celestial/30",
    dot: "bg-desert-celestial",
  },
  task: {
    badge: "bg-desert-accent-dim text-desert-accent border border-desert-accent/30",
    dot: "bg-desert-accent",
  },
  goal: {
    badge: "bg-desert-mystic/20 text-desert-mystic border border-desert-mystic/30",
    dot: "bg-desert-mystic",
  },
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatTime(time: string | null): string {
  if (!time) return "";
  const [h, m] = time.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "pm" : "am";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m}${ampm}`;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CalendarPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [view, setView] = useState<"month" | "agenda">("month");
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    date: toDateStr(new Date()),
    start_time: "",
    end_time: "",
    all_day: true,
    notes: "",
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  const fetchData = async () => {
    if (!userId) return;

    const [{ data: eventsData }, { data: tasksData }, { data: goalsData }] =
      await Promise.all([
        supabase.from("calendar_events").select("*").eq("user_id", userId),
        supabase
          .from("tasks")
          .select("id, title, due_date, priority")
          .eq("user_id", userId)
          .not("due_date", "is", null)
          .neq("status", "done"),
        supabase
          .from("goals")
          .select("id, title, target_date, area")
          .eq("user_id", userId)
          .not("target_date", "is", null)
          .eq("status", "active"),
      ]);

    setEvents(eventsData || []);
    setTasks(tasksData || []);
    setGoals(goalsData || []);
  };

  useEffect(() => {
    if (userId) fetchData();
  }, [userId]);

  // Merge all sources into unified items
  const allItems: UnifiedItem[] = useMemo(() => {
    const items: UnifiedItem[] = [];

    events.forEach((e) =>
      items.push({
        id: `event-${e.id}`,
        title: e.title,
        date: e.date,
        time: e.start_time,
        source: "event",
        notes: e.notes,
        allDay: e.all_day,
      })
    );

    tasks.forEach((t) =>
      items.push({
        id: `task-${t.id}`,
        title: t.title,
        date: t.due_date,
        time: null,
        source: "task",
        priority: t.priority,
        allDay: true,
      })
    );

    goals.forEach((g) =>
      items.push({
        id: `goal-${g.id}`,
        title: g.title,
        date: g.target_date,
        time: null,
        source: "goal",
        area: g.area,
        allDay: true,
      })
    );

    return items.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.time && b.time) return a.time.localeCompare(b.time);
      if (a.time) return -1;
      if (b.time) return 1;
      return 0;
    });
  }, [events, tasks, goals]);

  // Group items by date for quick lookup
  const itemsByDate = useMemo(() => {
    const map: Record<string, UnifiedItem[]> = {};
    allItems.forEach((item) => {
      if (!map[item.date]) map[item.date] = [];
      map[item.date].push(item);
    });
    return map;
  }, [allItems]);

  // Month grid data
  const monthGrid = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    // Monday = 0, Sunday = 6
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: { date: string; day: number; inMonth: boolean }[] = [];

    // Previous month padding
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      cells.push({ date: toDateStr(d), day: d.getDate(), inMonth: false });
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: toDateStr(new Date(year, month, d)), day: d, inMonth: true });
    }

    // Next month padding to fill grid
    const remaining = 7 - (cells.length % 7);
    if (remaining < 7) {
      for (let d = 1; d <= remaining; d++) {
        const date = new Date(year, month + 1, d);
        cells.push({ date: toDateStr(date), day: d, inMonth: false });
      }
    }

    return cells;
  }, [currentMonth]);

  const todayStr = toDateStr(new Date());

  const navigateMonth = (delta: number) => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + delta, 1)
    );
  };

  const addEvent = async () => {
    if (!form.title.trim() || !userId) return;

    const { error } = await supabase.from("calendar_events").insert({
      user_id: userId,
      title: form.title,
      date: form.date,
      start_time: form.all_day ? null : form.start_time || null,
      end_time: form.all_day ? null : form.end_time || null,
      all_day: form.all_day,
      notes: form.notes || null,
      type: "event",
    });

    if (error) {
      console.error("Error adding event:", error);
      return;
    }

    setForm({ title: "", date: toDateStr(new Date()), start_time: "", end_time: "", all_day: true, notes: "" });
    setShowForm(false);
    fetchData();
  };

  const deleteEvent = async (eventId: string) => {
    if (!userId) return;
    const numId = parseInt(eventId.replace("event-", ""));
    const { error } = await supabase
      .from("calendar_events")
      .delete()
      .eq("id", numId)
      .eq("user_id", userId);
    if (error) {
      console.error("Error deleting event:", error);
      return;
    }
    setSelectedDate(null);
    fetchData();
  };

  // Agenda: next 30 days
  const agendaItems = useMemo(() => {
    const start = toDateStr(new Date());
    const end = new Date();
    end.setDate(end.getDate() + 30);
    const endStr = toDateStr(end);
    return allItems.filter((i) => i.date >= start && i.date <= endStr);
  }, [allItems]);

  const monthLabel = currentMonth.toLocaleDateString("en-NZ", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="bg-desert-bg min-h-screen p-6 relative z-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-pixel text-lg text-desert-text">📅 Calendar</h1>
          <p className="text-desert-text-3 mt-1">Events, tasks, and goals</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex bg-desert-surface border border-desert-border rounded-sm overflow-hidden">
            <button
              onClick={() => setView("month")}
              className={`px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors ${
                view === "month"
                  ? "bg-desert-accent text-desert-bg"
                  : "text-desert-text-3 hover:text-desert-text"
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setView("agenda")}
              className={`px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors ${
                view === "agenda"
                  ? "bg-desert-accent text-desert-bg"
                  : "text-desert-text-3 hover:text-desert-text"
              }`}
            >
              Agenda
            </button>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-desert-accent text-desert-bg font-mono font-semibold uppercase tracking-wider text-sm rounded-sm hover:bg-desert-accent-glow transition-colors duration-150"
          >
            + Event
          </button>
        </div>
      </div>

      {/* Add Event Form */}
      {showForm && (
        <div className="bg-desert-surface border border-desert-border rounded-sm p-5 mb-6">
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Event title..."
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && addEvent()}
              autoFocus
              className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-4 py-2 text-desert-text placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent transition-colors"
            />
            <div className="flex gap-3 flex-wrap items-end">
              <div>
                <p className="text-xs text-desert-text-3 mb-1">Date</p>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="bg-desert-bg border border-desert-border-strong rounded-sm px-3 py-2 text-desert-text font-mono text-sm focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent transition-colors"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer pb-2">
                <input
                  type="checkbox"
                  checked={form.all_day}
                  onChange={(e) => setForm({ ...form, all_day: e.target.checked })}
                  className="accent-desert-accent"
                />
                <span className="text-sm text-desert-text-2">All day</span>
              </label>
              {!form.all_day && (
                <>
                  <div>
                    <p className="text-xs text-desert-text-3 mb-1">Start</p>
                    <input
                      type="time"
                      value={form.start_time}
                      onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                      className="bg-desert-bg border border-desert-border-strong rounded-sm px-3 py-2 text-desert-text font-mono text-sm focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent transition-colors"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-desert-text-3 mb-1">End</p>
                    <input
                      type="time"
                      value={form.end_time}
                      onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                      className="bg-desert-bg border border-desert-border-strong rounded-sm px-3 py-2 text-desert-text font-mono text-sm focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent transition-colors"
                    />
                  </div>
                </>
              )}
            </div>
            <textarea
              placeholder="Notes (optional)"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-4 py-2 text-desert-text placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent transition-colors resize-none"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-desert-text-3 hover:text-desert-text text-sm transition-colors duration-150"
              >
                Cancel
              </button>
              <button
                onClick={addEvent}
                className="px-4 py-2 bg-desert-accent text-desert-bg font-mono font-semibold uppercase tracking-wider text-sm rounded-sm hover:bg-desert-accent-glow transition-colors duration-150"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Month View */}
      {view === "month" && (
        <div>
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigateMonth(-1)}
              className="px-3 py-1.5 text-desert-text-2 hover:text-desert-text font-mono text-sm transition-colors"
            >
              ← Prev
            </button>
            <h2 className="font-mono font-bold text-sm tracking-[0.06em] uppercase text-desert-text">
              {monthLabel}
            </h2>
            <button
              onClick={() => navigateMonth(1)}
              className="px-3 py-1.5 text-desert-text-2 hover:text-desert-text font-mono text-sm transition-colors"
            >
              Next →
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="text-center font-mono text-xs text-desert-text-3 uppercase tracking-wider py-2"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 border-t border-l border-desert-border">
            {monthGrid.map((cell) => {
              const dayItems = itemsByDate[cell.date] || [];
              const isToday = cell.date === todayStr;
              const isSelected = cell.date === selectedDate;

              return (
                <div
                  key={cell.date}
                  onClick={() => setSelectedDate(isSelected ? null : cell.date)}
                  className={`min-h-[80px] p-1.5 border-r border-b border-desert-border cursor-pointer transition-colors ${
                    !cell.inMonth
                      ? "bg-desert-bg/50"
                      : isSelected
                      ? "bg-desert-surface-hover"
                      : "bg-desert-bg hover:bg-desert-surface"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`font-mono text-xs ${
                        isToday
                          ? "bg-desert-accent text-desert-bg w-5 h-5 rounded-full flex items-center justify-center font-bold"
                          : cell.inMonth
                          ? "text-desert-text-2"
                          : "text-desert-text-3/50"
                      }`}
                    >
                      {cell.day}
                    </span>
                  </div>
                  {/* Dot indicators */}
                  {dayItems.length > 0 && (
                    <div className="flex gap-0.5 flex-wrap">
                      {dayItems.slice(0, 4).map((item) => (
                        <div
                          key={item.id}
                          className={`w-1.5 h-1.5 rounded-full ${SOURCE_STYLES[item.source].dot}`}
                        />
                      ))}
                      {dayItems.length > 4 && (
                        <span className="text-[9px] text-desert-text-3 font-mono">
                          +{dayItems.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Selected date detail */}
          {selectedDate && (
            <div className="mt-4 bg-desert-surface border border-desert-border rounded-sm p-4">
              <h3 className="font-mono font-bold text-xs tracking-[0.06em] uppercase text-desert-text-2 mb-3">
                {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-NZ", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </h3>
              {(itemsByDate[selectedDate] || []).length === 0 ? (
                <p className="text-desert-text-3 text-sm">No items</p>
              ) : (
                <div className="space-y-2">
                  {(itemsByDate[selectedDate] || []).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3 p-3 bg-desert-bg rounded-sm border border-desert-border hover:border-desert-border-strong transition-colors"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <span
                          className={`shrink-0 px-2 py-0.5 rounded-sm font-mono text-[10px] uppercase tracking-wider ${SOURCE_STYLES[item.source].badge}`}
                        >
                          {item.source}
                        </span>
                        <div className="min-w-0">
                          <p className="text-desert-text text-sm truncate">{item.title}</p>
                          {item.time && (
                            <p className="text-desert-text-3 text-xs font-mono mt-0.5">
                              {formatTime(item.time)}
                            </p>
                          )}
                          {item.notes && (
                            <p className="text-desert-text-3 text-xs mt-1 line-clamp-2">
                              {item.notes}
                            </p>
                          )}
                        </div>
                      </div>
                      {item.source === "event" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteEvent(item.id);
                          }}
                          className="shrink-0 text-desert-text-3 hover:text-desert-danger text-xs transition-colors"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Agenda View */}
      {view === "agenda" && (
        <div>
          <h2 className="font-mono font-bold text-sm tracking-[0.06em] uppercase text-desert-text mb-4">
            Next 30 Days
          </h2>
          {agendaItems.length === 0 ? (
            <div className="bg-desert-surface rounded-sm p-12 text-center">
              <p className="text-desert-text-3">Nothing scheduled</p>
            </div>
          ) : (
            <div className="space-y-1">
              {(() => {
                let lastDate = "";
                return agendaItems.map((item) => {
                  const showHeader = item.date !== lastDate;
                  lastDate = item.date;
                  const isToday = item.date === todayStr;

                  return (
                    <div key={item.id}>
                      {showHeader && (
                        <div className="pt-4 pb-2 first:pt-0">
                          <p
                            className={`font-mono text-xs uppercase tracking-wider ${
                              isToday ? "text-desert-accent font-bold" : "text-desert-text-3"
                            }`}
                          >
                            {isToday
                              ? "Today"
                              : new Date(item.date + "T12:00:00").toLocaleDateString("en-NZ", {
                                  weekday: "short",
                                  day: "numeric",
                                  month: "short",
                                })}
                          </p>
                        </div>
                      )}
                      <div className="flex items-center gap-3 p-3 bg-desert-surface border border-desert-border rounded-sm hover:bg-desert-surface-hover hover:border-desert-border-strong transition-colors">
                        <span
                          className={`shrink-0 px-2 py-0.5 rounded-sm font-mono text-[10px] uppercase tracking-wider ${SOURCE_STYLES[item.source].badge}`}
                        >
                          {item.source}
                        </span>
                        <p className="text-desert-text text-sm flex-1 truncate">{item.title}</p>
                        {item.time && (
                          <span className="text-desert-text-3 text-xs font-mono shrink-0">
                            {formatTime(item.time)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
