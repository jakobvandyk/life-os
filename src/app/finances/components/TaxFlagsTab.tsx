"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface TaxFlag {
  id: number;
  title: string;
  jurisdiction: string;
  priority: string;
  notes: string;
  user_id: string;
}

const priorityColors: Record<string, string> = {
  urgent: "bg-desert-danger-dim text-desert-danger border-desert-danger",
  high: "bg-desert-warning-dim text-desert-warning border-desert-warning",
  medium: "bg-desert-celestial-dim text-desert-celestial border-desert-celestial",
  low: "bg-desert-surface-hover text-desert-text-3 border-desert-border",
};

const jurisdictionColors: Record<string, string> = {
  AU: "bg-desert-success-dim text-desert-success",
  NZ: "bg-desert-celestial-dim text-desert-celestial",
  US: "bg-desert-accent-glow text-desert-accent",
  multi: "bg-desert-mystic-dim text-desert-mystic",
};

const inputClass =
  "w-full bg-desert-bg border border-desert-border-strong rounded-sm px-3 py-2 text-desert-text text-sm placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent transition-colors";
const selectClass =
  "bg-desert-bg border border-desert-border-strong rounded-sm px-3 py-2 text-desert-text text-sm focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent transition-colors";

export default function TaxFlagsTab({
  taxFlags,
  onRefresh,
  userId,
}: {
  taxFlags: TaxFlag[];
  onRefresh: () => void;
  userId: string | null;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    jurisdiction: "AU",
    priority: "medium",
    notes: "",
  });

  const addFlag = async () => {
    if (!userId) return;
    if (!form.title.trim()) return;
    const { error } = await supabase.from("finance_tax_flags").insert({
      ...form,
      resolved_at: null,
      user_id: userId,
    });
    if (error) console.error("Error adding tax flag:", error);
    setForm({ title: "", jurisdiction: "AU", priority: "medium", notes: "" });
    setShowForm(false);
    onRefresh();
  };

  const resolveFlag = async (id: number) => {
    if (!userId) return;
    const { error } = await supabase
      .from("finance_tax_flags")
      .update({ resolved_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);
    if (error) console.error("Error resolving tax flag:", error);
    onRefresh();
  };

  const deleteFlag = async (id: number) => {
    if (!userId) return;
    const { error } = await supabase.from("finance_tax_flags").delete().eq("id", id).eq("user_id", userId);
    if (error) console.error("Error deleting tax flag:", error);
    onRefresh();
  };

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="font-mono font-bold text-base tracking-[0.06em] uppercase text-desert-text">Tax & Compliance Flags</h2>
          <p className="text-sm text-desert-text-3">
            {taxFlags.length} open item{taxFlags.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-desert-accent hover:bg-desert-accent-glow text-desert-bg font-mono font-semibold uppercase tracking-wider text-sm rounded-sm transition-colors duration-150"
        >
          + Add Flag
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="bg-desert-surface rounded-sm p-5 mb-6 space-y-3">
          <input
            type="text"
            placeholder="Flag title (e.g. Multi-jurisdiction tax filing)"
            value={form.title}
            onChange={(e) => setForm({...form, title: e.target.value })}
            className={inputClass}
            autoFocus
          />
          <textarea
            placeholder="Notes / context (optional)"
            value={form.notes}
            onChange={(e) => setForm({...form, notes: e.target.value })}
            rows={3}
            className={inputClass}
          />
          <div className="flex gap-3 items-center">
            <div>
              <span className="text-xs text-desert-text-3 mr-2">Jurisdiction:</span>
              <select
                value={form.jurisdiction}
                onChange={(e) => setForm({...form, jurisdiction: e.target.value })}
                className={selectClass}
              >
                <option value="AU">Australia</option>
                <option value="NZ">New Zealand</option>
                <option value="US">United States</option>
                <option value="multi">Multi-jurisdiction</option>
              </select>
            </div>
            <div>
              <span className="text-xs text-desert-text-3 mr-2">Priority:</span>
              <select
                value={form.priority}
                onChange={(e) => setForm({...form, priority: e.target.value })}
                className={selectClass}
              >
                <option value="urgent">🔴 Urgent</option>
                <option value="high">🟠 High</option>
                <option value="medium">🔵 Medium</option>
                <option value="low">⚪ Low</option>
              </select>
            </div>
            <div className="flex-1" />
            <button
              onClick={addFlag}
              className="px-4 py-2 bg-desert-accent hover:bg-desert-accent-glow text-desert-bg font-mono font-semibold uppercase tracking-wider text-sm rounded-sm transition-colors duration-150"
            >
              Add Flag
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

      {/* Empty State */}
      {taxFlags.length === 0 ? (
        <div className="bg-desert-surface rounded-sm p-12 text-center">
          <p className="text-desert-text-3 text-lg mb-2">🎉 All clear!</p>
          <p className="text-desert-text-3 text-sm">No open tax or compliance flags.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {taxFlags.map((flag) => (
            <div
              key={flag.id}
              className="bg-desert-surface border border-desert-border rounded-sm p-4 hover:border-desert-border-strong transition-colors duration-150"
            >
              <div className="flex items-start gap-4">
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-mono font-medium text-sm text-desert-text">{flag.title}</p>
                  </div>
                  {flag.notes && (
                    <p className="text-xs text-desert-text-3 mt-1 whitespace-pre-wrap">
                      {flag.notes}
                    </p>
                  )}
                </div>

                {/* Badges */}
                <span
                  className={`px-2 py-0.5 rounded-md text-xs font-medium border shrink-0 ${
                    priorityColors[flag.priority]
                  }`}
                >
                  {flag.priority}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-md text-xs font-medium shrink-0 ${
                    jurisdictionColors[flag.jurisdiction]
                  }`}
                >
                  {flag.jurisdiction}
                </span>

                {/* Actions */}
                <button
                  onClick={() => resolveFlag(flag.id)}
                  className="px-3 py-1 bg-desert-success-dim hover:bg-desert-success-dim/40 text-desert-success text-xs font-medium rounded-sm transition-colors shrink-0"
                >
                  ✓ Resolve
                </button>
                <button
                  onClick={() => deleteFlag(flag.id)}
                  className="text-desert-text-3 hover:text-desert-danger text-sm transition-colors shrink-0"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}