"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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
      return;
    }

    if (goalData && goalData.length > 0) {
      const newGoalId = goalData[0].id;
      for (const kr of keyResults) {
        await supabase.from("key_results").insert({
          goal_id: newGoalId,
          title: kr.title,
          target: kr.target,
          unit: kr.unit,
          user_id: userId,
        });
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
    "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500";
  const selectClass =
    "bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500";

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">🎯 Goals</h1>
          <p className="text-gray-500 mt-1">
            {goals.length} active goal{goals.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + New Goal
        </button>
      </div>

      {/* Add Goal Form */}
      {showForm && (
        <div className="bg-gray-900 rounded-lg p-5 mb-6 space-y-4">
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
            <p className="text-sm text-gray-400 mb-2">Key Results</p>
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
                      className="text-gray-600 hover:text-red-400 text-sm"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addKRRow}
              className="mt-2 text-sm text-amber-400 hover:text-amber-300 transition-colors"
            >
              + Add key result
            </button>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={addGoal}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Create Goal
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Goals List */}
      {goals.length === 0 ? (
        <div className="bg-gray-900 rounded-lg p-12 text-center">
          <p className="text-gray-500 text-lg mb-2">No goals yet</p>
          <p className="text-gray-600 text-sm">
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
                className="bg-gray-900 rounded-lg p-5 hover:border-gray-700 transition-colors"
              >
                {/* Goal Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {goal.title}
                    </h3>
                    {goal.description && (
                      <p className="text-sm text-gray-500 mt-0.5">
                        {goal.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-md">
                      {goal.timeframe}
                    </span>
                    <span
                      className={`text-lg font-bold ${
                        progress >= 100
                          ? "text-green-400"
                          : progress >= 50
                          ? "text-amber-400"
                          : "text-amber-400"
                      }`}
                    >
                      {Math.round(progress)}%
                    </span>
                  </div>
                </div>

                {/* Overall Progress Bar */}
                <div className="w-full bg-gray-800 rounded-full h-2 mb-4">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      progress >= 100
                        ? "bg-green-500"
                        : progress >= 50
                        ? "bg-amber-400"
                        : "bg-amber-500"
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
                            <span className="text-sm text-gray-300">
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
                                    className="w-20 bg-gray-800 border border-amber-500 rounded px-2 py-0.5 text-white text-sm text-right"
                                    autoFocus
                                  />
                                  <span className="text-xs text-gray-500">
                                    / {kr.target} {kr.unit}
                                  </span>
                                  <button
                                    onClick={() => updateKRProgress(kr.id)}
                                    className="text-green-400 text-xs"
                                  >
                                    ✓
                                  </button>
                                  <button
                                    onClick={() => setEditingKR(null)}
                                    className="text-gray-500 text-xs"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <span
                                  className="text-sm text-gray-400 cursor-pointer hover:text-amber-400 transition-colors"
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
                          <div className="w-full bg-gray-800 rounded-full h-1.5">
                            <div
                              className="bg-amber-400/70 h-1.5 rounded-full transition-all"
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