"use client";

import { useState } from "react";

interface TaxFlag {
  id: number;
  title: string;
  jurisdiction: string;
  priority: string;
  notes: string;
}

const priorityColors: Record<string, string> = {
  urgent: "bg-red-500/20 text-red-400 border-red-500/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  medium: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  low: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const jurisdictionColors: Record<string, string> = {
  AU: "bg-green-500/20 text-green-400",
  NZ: "bg-blue-500/20 text-blue-400",
  US: "bg-amber-500/20 text-amber-400",
  multi: "bg-purple-500/20 text-purple-400",
};

const inputClass =
  "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500";
const selectClass =
  "bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500";

export default function TaxFlagsTab({
  taxFlags,
  onRefresh,
}: {
  taxFlags: TaxFlag[];
  onRefresh: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    jurisdiction: "AU",
    priority: "medium",
    notes: "",
  });

  const addFlag = async () => {
    if (!form.title.trim()) return;
    await fetch("/api/finances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: "tax_flag", data: form }),
    });
    setForm({ title: "", jurisdiction: "AU", priority: "medium", notes: "" });
    setShowForm(false);
    onRefresh();
  };

  const resolveFlag = async (id: number) => {
    await fetch(`/api/finances/${id}?table=tax_flag`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolve: true }),
    });
    onRefresh();
  };

  const deleteFlag = async (id: number) => {
    await fetch(`/api/finances/${id}?table=tax_flag`, { method: "DELETE" });
    onRefresh();
  };

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Tax & Compliance Flags</h2>
          <p className="text-sm text-gray-500">
            {taxFlags.length} open item{taxFlags.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + Add Flag
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 mb-6 space-y-3">
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
              <span className="text-xs text-gray-500 mr-2">Jurisdiction:</span>
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
              <span className="text-xs text-gray-500 mr-2">Priority:</span>
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
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Add Flag
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

      {/* Empty State */}
      {taxFlags.length === 0 ? (
        <div className="bg-gray-900 rounded-xl p-12 border border-gray-800 text-center">
          <p className="text-gray-500 text-lg mb-2">🎉 All clear!</p>
          <p className="text-gray-600 text-sm">No open tax or compliance flags.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {taxFlags.map((flag) => (
            <div
              key={flag.id}
              className="bg-gray-900 rounded-xl p-4 border border-gray-800 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-start gap-4">
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-white">{flag.title}</p>
                  </div>
                  {flag.notes && (
                    <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">
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
                  className="px-3 py-1 bg-green-600/20 hover:bg-green-600/40 text-green-400 text-xs font-medium rounded-lg transition-colors shrink-0"
                >
                  ✓ Resolve
                </button>
                <button
                  onClick={() => deleteFlag(flag.id)}
                  className="text-gray-600 hover:text-red-400 text-sm transition-colors shrink-0"
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