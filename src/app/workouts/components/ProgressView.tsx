"use client";

import { useState, useMemo } from "react";
import { WorkoutSession, WorkoutExercise } from "../page";
import { SESSIONS, getExerciseType, SessionTypeKey } from "../constants";

interface ProgressViewProps {
  sessions: (WorkoutSession & { exercises: WorkoutExercise[] })[];
  userId: string | null;
  onRefetch: () => void;
}

type FilterType = 'all' | SessionTypeKey;

const FILTER_OPTIONS: { label: string; value: FilterType }[] = [
  { label: "All", value: "all" },
  { label: "Upper str", value: "upper-strength" },
  { label: "Lower str", value: "lower-strength" },
  { label: "Upper vol", value: "upper-volume" },
  { label: "Lower vol", value: "lower-volume" },
];

export default function ProgressView({ sessions, exercises }: ProgressViewProps) {
  const [filter, setFilter] = useState<FilterType>("all");


  // Calculate metrics
  const metrics = useMemo(() => {
    const totalSessions = sessions.length;

    let compCorrect = 0, compTotal = 0, isoCorrect = 0, isoTotal = 0;

    sessions.forEach(session => {
      session.exercises.forEach(ex => {
        if (!ex.rpe || ex.rpe.trim() === '') return;
        const exType = getExerciseType(session.type, ex.exercise_id);
        if (exType === 'compound') {
          compTotal++;
          if (ex.rpe === 'med') compCorrect++;
        } else {
          isoTotal++;
          if (ex.rpe === 'hard' || ex.rpe === 'fail') isoCorrect++;
        }
      });
    });

    const compoundPercent = compTotal > 0 ? Math.round((compCorrect / compTotal) * 100) : 0;
    const isoPercent = isoTotal > 0 ? Math.round((isoCorrect / isoTotal) * 100) : 0;

    return { totalSessions, compoundPercent, isoPercent };
  }, [sessions]);

  // Build exercise progress data
  const exerciseData = useMemo(() => {
    // Flatten all exercises from all sessions, with session type attached
    const allItems: Array<{
      ex: WorkoutExercise;
      sessionType: SessionTypeKey;
    }> = [];

    sessions.forEach(session => {
      session.exercises.forEach(ex => {
        allItems.push({
          ex,
          sessionType: session.type as SessionTypeKey
        });
      });
    });

    // Sort by created_at descending (most recent first)
    allItems.sort((a, b) =>
      new Date(b.ex.created_at).getTime() - new Date(a.ex.created_at).getTime()
    );

    // Group by exercise_id
    const exerciseMap = new Map<string, {
      name: string;
      type: 'compound' | 'iso';
      exerciseId: string;
      entries: Array<{
        weight: number;
        rpe: string | null;
        date: string;
        sessionType: SessionTypeKey;
      }>;
    }>();

    for (const item of allItems) {
      const ex = item.ex;
      if (ex.weight === null) continue;

      const type = getExerciseType(item.sessionType, ex.exercise_id);
      const existing = exerciseMap.get(ex.exercise_id);
      
      if (existing) {
        existing.entries.push({
          weight: ex.weight,
          rpe: ex.rpe,
          date: ex.created_at,
          sessionType: item.sessionType,
        });
      } else {
        exerciseMap.set(ex.exercise_id, {
          name: ex.name,
          type,
          exerciseId: ex.exercise_id,
          entries: [{
            weight: ex.weight,
            rpe: ex.rpe,
            date: ex.created_at,
            sessionType: item.sessionType,
          }],
        });
      }
    }

    // Transform to array with calculated stats
    const data = Array.from(exerciseMap.values()).map(ex => {
      // Entries are already sorted by date descending due to initial sort
      const sortedEntries = ex.entries;

      const maxWeight = Math.max(...sortedEntries.map(e => e.weight));
      const prevWeight = sortedEntries.length > 1 ? sortedEntries[1].weight : null;

      const lastRpe = sortedEntries
        .map(e => e.rpe)
        .filter((rpe): rpe is string => rpe !== null && rpe.trim() !== "")
        .slice(0, 3);

      return {
        name: ex.name,
        type: ex.type,
        exerciseId: ex.exerciseId,
        maxWeight,
        prevWeight,
        lastRpe,
        sessionTypes: [...new Set(ex.entries.map(e => e.sessionType))],
      };
    });

    // Filter by selected filter
    let filtered = data;
    if (filter !== 'all') {
      const selectedSessionType = filter as SessionTypeKey;
      filtered = data.filter(ex =>
        ex.sessionTypes.includes(selectedSessionType)
      );
    }

    // Sort by max weight descending
    return filtered.sort((a, b) => b.maxWeight - a.maxWeight);
  }, [sessions, filter]);

  // Calculate overall max for progress bar scaling
  const overallMax = useMemo(() => {
    if (exerciseData.length === 0) return 0;
    return Math.max(...exerciseData.map(ex => ex.maxWeight));
  }, [exerciseData]);

  const getRpeDotColor = (rpe: string) => {
    switch (rpe) {
      case 'easy': return 'bg-green-400';
      case 'med': return 'bg-amber-400';
      case 'hard': return 'bg-red-400';
      case 'fail': return 'bg-purple-400';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Section 1: Metrics row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Sessions count */}
        <div className="bg-gray-900 rounded-lg p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider font-mono mb-1">
            Sessions
          </div>
          <div className="text-2xl font-mono font-semibold text-white">
            {metrics.totalSessions}
          </div>
        </div>

        {/* Compound RIR 2 */}
        <div className="bg-gray-900 rounded-lg p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider font-mono mb-1">
            Compound RIR 2
          </div>
          <div className="text-2xl font-mono font-semibold text-white">
            {metrics.compoundPercent}%
          </div>
        </div>

        {/* Iso RIR 0-1 */}
        <div className="bg-gray-900 rounded-lg p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider font-mono mb-1">
            Iso RIR 0-1
          </div>
          <div className="text-2xl font-mono font-semibold text-white">
            {metrics.isoPercent}%
          </div>
        </div>
      </div>

      {/* Metrics hint */}
      <div className="text-xs text-gray-500 font-mono">
        <span className="text-blue-400">■</span> Compound: aim ≥60% at RIR 2 (Med) · 
        <span className="text-green-400">■</span> Isolation: aim ≥60% at RIR 0-1 (Hard/Fail)
      </div>

      {/* Section 2: Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`rounded-full px-3 py-1 text-xs font-mono cursor-pointer transition-colors whitespace-nowrap ${
              filter === opt.value
                ? "bg-white text-gray-950 border border-white"
                : "border border-gray-700 text-gray-400 hover:text-white"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Section 3: Progress bars */}
      {exerciseData.length === 0 ? (
        <div className="bg-gray-900 rounded-lg p-8 text-center">
          <p className="text-gray-500 font-mono">No data yet</p>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-lg p-4 space-y-1">
          {exerciseData.map((ex, idx) => (
            <div key={ex.exerciseId} className={`py-3 ${idx < exerciseData.length - 1 ? 'border-b border-gray-800' : ''}`}>
              {/* Row 1 */}
              <div className="flex items-center gap-3">
                {/* Exercise name */}
                <div className="text-sm text-white min-w-[120px] truncate" title={ex.name}>
                  {ex.name}
                </div>

                {/* Type badge */}
                <span className={`text-xs rounded px-1.5 py-0.5 font-mono ${
                  ex.type === 'compound'
                    ? 'bg-blue-900/50 text-blue-400 border border-blue-800'
                    : 'bg-green-900/50 text-green-400 border border-green-800'
                }`}>
                  {ex.type === 'compound' ? 'Compound' : 'Iso'}
                </span>

                {/* Progress bar */}
                <div className="flex-1">
                  <div className="bg-gray-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full ${
                        ex.type === 'compound' ? 'bg-blue-400' : 'bg-green-400'
                      }`}
                      style={{ width: `${overallMax > 0 ? (ex.maxWeight / overallMax) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                {/* Max weight label */}
                <div className="text-sm font-mono text-gray-400 min-w-[60px] text-right flex items-center justify-end gap-1">
                  {ex.maxWeight > (ex.prevWeight || 0) && (
                    <span className="text-green-400">↑</span>
                  )}
                  {ex.maxWeight < (ex.prevWeight || 0) && (
                    <span className="text-red-400">↓</span>
                  )}
                  {ex.maxWeight.toFixed(1)}
                </div>
              </div>

              {/* Row 2: RPE dots */}
              {ex.lastRpe.length > 0 && (
                <div className="flex gap-1 mt-2 ml-[132px]">
                  {ex.lastRpe.map((rpe, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full ${getRpeDotColor(rpe)}`}
                      title={rpe}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Section 4: Legend */}
      <div className="text-xs text-gray-500 font-mono">
        Dots = last 3 sessions: 
        <span className="text-green-400">● easy</span> · 
        <span className="text-amber-400">● med</span> · 
        <span className="text-red-400">● hard</span> · 
        <span className="text-purple-400">● fail</span>
      </div>
    </div>
  );
}
