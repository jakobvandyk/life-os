"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { queueWrite } from "@/lib/sync";

interface KeyResult {
  id: number;
  goal_id: number;
  title: string;
  target: number;
  current: number;
  unit: string;
}

interface Goal {
  id: number;
  title: string;
  description: string;
  timeframe: string;
  status: string;
  key_results: KeyResult[];
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);
  const [showForm, setShowForm] = useState(false);
  const [editingKR, setEditingKR] = useState<number | null>(null);
  const [krValue, setKrValue] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    timeframe: "quarterly",
    keyResults: [{ title: "", target: "", unit: "" }],
  });

  const fetchGoals = () => {
    supabase.from("goals").select("*, key_results(*)").eq("status", "active").order("created_at", { ascending: false }).then(({ data, error }) => {
      if (data) setGoals(data);
      if (error) console.error("Error fetching goals:", error);
    });
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  const addGoal = async () => {
    if (!userId) return; // Guard
    if (!form.title.trim()) return;
    const keyResults = form.keyResults.filter((kr) => kr.title.trim() && kr.target).map((kr) => ({
        title: kr.title,
        target: parseFloat(kr.target),
        unit: kr.unit,
      }));

    const { data: goalData, error: goalError } = await supabase.from("goals").insert({
      title: form.title,
      description: form.description,
      timeframe: form.timeframe,
      user_id: userId,
    }).select();

    if (goalError) {
      console.error("Error adding goal:", goalError);
      await queueWrite("goals", "insert", {
        title: form.title,
        description: form.description,
        timeframe: form.timeframe,
        user_id: userId,
      });
      return;
    }

    if (goalData && goalData.length > 0) {
      const newGoalId = goalData[0].id;
      for (const kr of keyResults) {
        const { error: krError } = await supabase.from("key_results").insert({
          goal_id: newGoalId,
          title: kr.title,
          target: kr.target,
          unit: kr.unit,
          user_id: userId,
        });
        if (krError) {
          await queueWrite("key_results", "insert", {
            goal_id: newGoalId,
            title: kr.title,
            target: kr.target,
            unit: kr.unit,
            user_id: userId,
          });
        }
      }
    }
    setForm({
      title: "",
      description: "",
      timeframe: "quarterly",
      keyResults: [{ title: "", target: "", unit: "" }],
    });
    setShowForm(false);
    fetchGoals();
  };

  const addKRRow = () => {
    setForm({...form,
      keyResults: [...form.keyResults, { title: "", target: "", unit: "" }],
    });
  };

  const updateKRForm = (index: number, field: string, value: string) => {
    const updated = [...form.keyResults];
    updated[index] = {...updated[index], [field]: value };
    setForm({...form, keyResults: updated });
  };

  const removeKRRow = (index: number) => {
    if (form.keyResults.length <= 1) return;
    const updated = form.keyResults.filter((_, i) => i !== index);
    setForm({...form, keyResults: updated });
  };

  const updateKRProgress = async (krId: number) => {
    if (!userId) return; // Guard
    const val = parseFloat(krValue);
    if (isNaN(val)) return;
    const { error } = await supabase.from("key_results").update({ current: val }).eq("id", krId);
    if (error) {
      console.error("Error updating key result progress:", error);
      await queueWrite("key_results", "update", { id: krId, current: val });
    }
    setEditingKR(null);
    fetchGoals();
  };

  const goalProgress = (goal: Goal): number => {
    if (goal.key_results.length === 0) return 0;
    const total = goal.key_results.reduce((sum, kr) => {
      const pct = kr.target > 0 ? (kr.current / kr.target) * 100 : 0;
      return sum + Math.min(pct, 100);
    }, 0);
    return total / goal.key_results.length;
  };

  const inputClass =
    "w-full bg-desert-surface border border-desert-border rounded-sm px-3 py-2 text-desert-text text-sm placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent transition-colors";
  const selectClass =
    "bg-desert-surface border border-desert-border rounded-sm px-3 py-2 text-desert-text text-sm focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent transition-colors";

  return (
    <div className="bg-desert-bg min-h-screen p-6 relative z-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-pixel text-lg text-desert-text">◎ Goals</h1>
          <p className="text-desert-text-3 mt-1">
            {goals.length} active goal{goals.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-desert-accent hover:bg-desert-accent-hover text-desert-text text-sm font-mono rounded-sm transition-colors"
        >
          + New Goal
        </button>
      </div>

      {/* Add Goal Form */}
      {showForm && (
        <div className="bg-desert-surface rounded-sm p-5 mb-6 space-y-4">
          <input
            type="text"
            placeholder="Goal title (e.g. Improve fitness)"
            value={form.title}
            onChange={(e) => setForm({...form, title: e.target.value })}
            className={inputClass}
            autoFocus
          />
          <textarea
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({...form, description: e.target.value })}
            rows={2}
            className={inputClass}
          />
          <select
            value={form.timeframe}
            onChange={(e) => setForm({...form, timeframe: e.target.value })}
            className={selectClass}
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annual">Annual</option>
          </select>

          {/* Key Results */}
          <div>
            <p className="text-sm font-mono text-desert-text-3 mb-2">Key Results</p>
            <div className="space-y-2">
              {form.keyResults.map((kr, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Key result (e.g. Run 3x per week)"
                    value={kr.title}
                    onChange={(e) => updateKRForm(i, "title", e.target.value)}
                    className={`flex-1 ${inputClass}`}
                  />
                  <input
                    type="number"
                    placeholder="Target"
                    value={kr.target}
                    onChange={(e) => updateKRForm(i, "target", e.target.value)}
                    className={`w-24 ${inputClass}`}
                  />
                  <input
                    type="text"
                    placeholder="Unit"
                    value={kr.unit}
                    onChange={(e) => updateKRForm(i, "unit", e.target.value)}
                    className={`w-24 ${inputClass}`}
                  />
                  {form.keyResults.length > 1 && (
                    <button
                      onClick={() => removeKRRow(i)}
                      className="text-desert-text-3 hover:text-desert-danger text-sm"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addKRRow}
              className="mt-2 text-sm text-desert-accent hover:text-desert-accent-hover transition-colors"
            >
              + Add key result
            </button>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={addGoal}
              className="px-4 py-2 bg-desert-accent hover:bg-desert-accent-hover text-desert-text text-sm font-mono rounded-sm transition-colors"
            >
              Create Goal
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-desert-text-3 hover:text-desert-text text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Goals List */}
      {goals.length === 0 ? (
        <div className="bg-desert-surface rounded-sm p-12 text-center">
          <p className="text-desert-text-3 text-lg mb-2">No goals yet</p>
          <p className="text-desert-text-3 text-sm">
            Set a goal with measurable key results to track your progress.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map((goal) => {
            const progress = goalProgress(goal);
            return (
              <div
                key={goal.id}
                className="bg-desert-surface rounded-sm p-5 border border-desert-border hover:border-desert-border-strong transition-colors"
              >
                {/* Goal Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                     <h3 className="text-base font-mono font-bold text-desert-text">
                       {goal.title}
                     </h3>
                     {goal.description && (
                       <p className="text-sm text-desert-text-3 mt-0.5">
                         {goal.description}
                       </p>
                     )}
                  </div>
                  <div className="flex items-center gap-3">
                     <span className="text-xs text-desert-text-3 bg-desert-surface border border-desert-border px-2 py-1 rounded-sm">
                       {goal.timeframe}
                     </span>
                    <span
                      className={`text-lg font-bold font-mono ${
                        progress >= 100
                          ? "text-desert-success"
                          : progress >= 50
                          ? "text-desert-accent"
                          : "text-desert-accent"
                      }`}
                    >
                      {Math.round(progress)}%
                    </span>
                  </div>
                </div>

                {/* Overall Progress Bar */}
                <div className="w-full bg-desert-border rounded-full h-2 mb-4">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      progress >= 100
                        ? "bg-desert-success"
                        : progress >= 50
                        ? "bg-desert-accent"
                        : "bg-desert-accent"
                    }`}
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>

                {/* Key Results */}
                {goal.key_results.length > 0 && (
                  <div className="space-y-3">
                    {goal.key_results.map((kr) => {
                      const krPct =
                        kr.target > 0
                          ? Math.min((kr.current / kr.target) * 100, 100)
                          : 0;
                      return (
                        <div key={kr.id}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-mono text-desert-text">
                              {kr.title}
                            </span>
                            <div className="flex items-center gap-2">
                              {editingKR === kr.id ? (
                                <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      step="any"
                                      value={krValue}
                                      onChange={(e) => setKrValue(e.target.value)}
                                      onKeyDown={(e) =>
                                        e.key === "Enter" &&
                                        updateKRProgress(kr.id)
                                      }
                                      className="w-20 bg-desert-surface border border-desert-accent rounded px-2 py-0.5 text-desert-text text-sm text-right focus:outline-none focus:ring-1 focus:ring-desert-accent"
                                      autoFocus
                                    />
                                  <span className="text-xs text-desert-text-3">
                                    / {kr.target} {kr.unit}
                                  </span>
                                    <button
                                      onClick={() => updateKRProgress(kr.id)}
                                      className="text-desert-success text-xs"
                                    >
                                      ✓
                                    </button>
                                    <button
                                      onClick={() => setEditingKR(null)}
                                      className="text-desert-text-3 text-xs"
                                    >
                                      ✕
                                    </button>
                                </div>
                              ) : (
                                <span
                                  className="text-sm text-desert-text-3 cursor-pointer hover:text-desert-accent transition-colors"
                                  onClick={() => {
                                    setEditingKR(kr.id);
                                    setKrValue(kr.current.toString());
                                  }}
                                >
                                  {kr.current} / {kr.target} {kr.unit}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="w-full bg-desert-border rounded-full h-1.5">
                            <div
                              className="bg-desert-accent/70 h-1.5 rounded-full transition-all"
                              style={{ width: `${krPct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}