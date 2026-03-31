export interface ExerciseDef {
  id: string;
  name: string;
  unit: string;
  sets: number;
  reps: number;
  type: 'compound' | 'iso';
}

export interface SessionType {
  label: string;
  hint: string;
  warmup: string;
  warmupType: 'standard' | 'shoulder';
  exercises: ExerciseDef[];
}

export const SESSIONS: Record<string, SessionType> = {
  'upper-strength': {
    label: 'Upper strength',
    hint: 'Heavy / low rep',
    warmup: '5 min treadmill + mobility. Rotator cuff and band pull-aparts before pressing.',
    warmupType: 'shoulder',
    exercises: [
      { id: 'bb-bench', name: 'BB Bench', unit: 'kg', sets: 3, reps: 5, type: 'compound' },
      { id: 'db-row', name: 'DB Row', unit: 'kg/ea', sets: 3, reps: 5, type: 'compound' },
      { id: 'oh-press', name: 'OH KB Press', unit: 'kg/ea', sets: 2, reps: 8, type: 'compound' },
      { id: 'lat-pull', name: 'Lat Pulldown', unit: 'kg', sets: 2, reps: 8, type: 'compound' },
      { id: 'inc-fly', name: 'Inc DB Fly', unit: 'kg', sets: 2, reps: 15, type: 'iso' },
      { id: 'cable-crunch-s', name: 'Cable Crunch', unit: 'kg', sets: 2, reps: 20, type: 'iso' },
    ]
  },
  'lower-strength': {
    label: 'Lower strength',
    hint: 'Squat / pull',
    warmup: '5 min treadmill + hip and ankle mobility before squatting.',
    warmupType: 'standard',
    exercises: [
      { id: 'bb-squat', name: 'BB Back Squat', unit: 'kg', sets: 3, reps: 5, type: 'compound' },
      { id: 'deadlift', name: 'Deadlift', unit: 'kg', sets: 3, reps: 5, type: 'compound' },
      { id: 'bulg', name: 'Bulgarian Split Squat', unit: 'kg/ea', sets: 3, reps: 8, type: 'compound' },
      { id: 'stand-calf', name: 'Standing Calf', unit: 'kg', sets: 4, reps: 8, type: 'iso' },
    ]
  },
  'upper-volume': {
    label: 'Upper volume',
    hint: 'Moderate / hypertrophy',
    warmup: '5 min treadmill + mobility. Rotator cuff and band pull-aparts before pressing.',
    warmupType: 'shoulder',
    exercises: [
      { id: 'bench-v', name: 'BB Bench', unit: 'kg', sets: 3, reps: 10, type: 'compound' },
      { id: 'row-v', name: 'KB Row', unit: 'kg', sets: 3, reps: 10, type: 'compound' },
      { id: 'inc-bench', name: 'Incline BB', unit: 'kg', sets: 2, reps: 12, type: 'compound' },
      { id: 'lat-pull-v', name: 'Cable Lat Pulldown', unit: 'kg', sets: 2, reps: 12, type: 'compound' },
      { id: 'ez-jm', name: 'EZ JM Press', unit: 'kg', sets: 2, reps: 12, type: 'iso' },
      { id: 'ez-curl', name: 'EZ Curl', unit: 'kg', sets: 2, reps: 12, type: 'iso' },
      { id: 'cable-crunch-v', name: 'Cable Crunch', unit: 'kg', sets: 2, reps: 25, type: 'iso' },
    ]
  },
  'lower-volume': {
    label: 'Lower volume',
    hint: 'Hip hinge / isolation',
    warmup: '5 min treadmill + hip mobility.',
    warmupType: 'standard',
    exercises: [
      { id: 'hip-thrust', name: 'Hip Thrusts', unit: 'kg', sets: 3, reps: 8, type: 'compound' },
      { id: 'hack-squat', name: 'Hack Squats', unit: 'kg', sets: 3, reps: 8, type: 'compound' },
      { id: 'leg-curl', name: 'DB Leg Curl', unit: 'kg', sets: 3, reps: 12, type: 'iso' },
      { id: 'leg-ext', name: 'DB Leg Ext', unit: 'kg', sets: 3, reps: 12, type: 'iso' },
      { id: 'seat-calf', name: 'Seated Calf', unit: 'kg', sets: 4, reps: 15, type: 'iso' },
      { id: 'rev-curl', name: 'Reverse EZ Curl', unit: 'kg', sets: 3, reps: 8, type: 'iso' },
    ]
  }
};

export type SessionTypeKey = keyof typeof SESSIONS;

export function getExerciseType(sessionType: string, exerciseId: string): 'compound' | 'iso' {
  const session = SESSIONS[sessionType as SessionTypeKey];
  if (!session) return 'compound';
  const ex = session.exercises.find(e => e.id === exerciseId);
  return ex?.type || 'compound';
}
