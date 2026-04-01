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

export default function ProgressView({ sessions }: ProgressViewProps) {
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
      case 'easy': return 'bg-desert-success';
      case 'med': return 'bg-desert-accent';
      case 'hard': return 'bg-desert-danger';
      case 'fail': return 'bg-desert-mystic';
      default: return 'bg-desert-text-3';
    }
  };

  return (
    <div className="space-y-6">
      {/* Section 1: Metrics row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Sessions count */}
        <div className="bg-desert-surface border border-desert-border rounded-sm p-4">
          <div className="font-mono text-xs text-desert-text-3 uppercase tracking-widest mb-1">
            Sessions
          </div>
          <div className="font-mono font-bold text-2xl text-desert-text tracking-tight">
            {metrics.totalSessions}
          </div>
        </div>

        {/* Compound RIR 2 */}
        <div className="bg-desert-surface border border-desert-border rounded-sm p-4">
          <div className="font-mono text-xs text-desert-text-3 uppercase tracking-widest mb-1">
            Compound RIR 2
          </div>
          <div className="font-mono font-bold text-2xl text-desert-text tracking-tight">
            {metrics.compoundPercent}%
          </div>
        </div>

        {/* Iso RIR 0-1 */}
        <div className="bg-desert-surface border border-desert-border rounded-sm p-4">
          <div className="font-mono text-xs text-desert-text-3 uppercase tracking-widest mb-1">
            Iso RIR 0-1
          </div>
          <div className="font-mono font-bold text-2xl text-desert-text tracking-tight">
            {metrics.isoPercent}%
          </div>
        </div>
      </div>

      {/* Metrics hint */}
      <div className="font-mono text-xs text-desert-text-3">
        <span className="text-desert-celestial">■</span> Compound: aim ≥60% at RIR 2 (Med) ·
        <span className="text-desert-success">■</span> Isolation: aim ≥60% at RIR 0-1 (Hard/Fail)
      </div>

      {/* Section 2: Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`rounded-sm px-3 py-1 text-xs font-mono cursor-pointer transition-colors duration-150 whitespace-nowrap ${
              filter === opt.value
                ? "bg-desert-surface border border-desert-border text-desert-text"
                : "text-desert-text-3 hover:text-desert-text-2 px-3 py-1"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Section 3: Progress bars */}
      {exerciseData.length === 0 ? (
        <div className="bg-desert-surface border border-desert-border rounded-sm p-8 text-center">
          <p className="text-desert-text-3 font-mono">No data yet</p>
        </div>
      ) : (
        <div className="bg-desert-surface border border-desert-border rounded-sm p-4 space-y-1">
          {exerciseData.map((ex, idx) => (
            <div key={ex.exerciseId} className={`py-3 ${idx < exerciseData.length - 1 ? 'border-b border-desert-border' : ''}`}>
              {/* Row 1 */}
              <div className="flex items-center gap-3">
                {/* Exercise name */}
                <div className="font-mono text-sm text-desert-text min-w-[120px] truncate" title={ex.name}>
                  {ex.name}
                </div>

                {/* Type badge */}
                <span className={`text-xs rounded px-1.5 py-0.5 font-mono ${
                  ex.type === 'compound'
                    ? 'bg-desert-celestial-dim border border-desert-celestial text-desert-celestial'
                    : 'bg-desert-success-dim border border-desert-success text-desert-success'
                }`}>
                  {ex.type === 'compound' ? 'Compound' : 'Iso'}
                </span>

                {/* Progress bar */}
                <div className="flex-1">
                  <div className="bg-desert-border rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full ${
                        ex.type === 'compound' ? 'bg-desert-celestial' : 'bg-desert-success'
                      }`}
                      style={{ width: `${overallMax > 0 ? (ex.maxWeight / overallMax) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                {/* Max weight label */}
                <div className="font-mono text-sm text-desert-text-2 min-w-[60px] text-right flex items-center justify-end gap-1">
                  {ex.maxWeight > (ex.prevWeight || 0) && (
                    <span className="text-desert-success">↑</span>
                  )}
                  {ex.maxWeight < (ex.prevWeight || 0) && (
                    <span className="text-desert-danger">↓</span>
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
      <div className="font-mono text-xs text-desert-text-3">
        Dots = last 3 sessions:
        <span className="text-desert-success">● easy</span> ·
        <span className="text-desert-accent">● med</span> ·
        <span className="text-desert-danger">● hard</span> ·
        <span className="text-desert-mystic">● fail</span>
      </div>
    </div>
  );
}
