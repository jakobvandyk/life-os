ALTER TABLE workout_checkins ADD COLUMN IF NOT EXISTS pns_index REAL;
ALTER TABLE workout_checkins ADD COLUMN IF NOT EXISTS sns_index REAL;
ALTER TABLE workout_checkins ADD COLUMN IF NOT EXISTS stress_index REAL;
ALTER TABLE workout_checkins ADD COLUMN IF NOT EXISTS kubios_readiness REAL;
ALTER TABLE workout_checkins ADD COLUMN IF NOT EXISTS mean_hr REAL;

COMMENT ON COLUMN workout_checkins.pns_index IS 'Kubios parasympathetic index';
COMMENT ON COLUMN workout_checkins.sns_index IS 'Kubios sympathetic index';
COMMENT ON COLUMN workout_checkins.stress_index IS 'Kubios Baevsky stress index';
COMMENT ON COLUMN workout_checkins.kubios_readiness IS 'Kubios readiness score 0-100';
COMMENT ON COLUMN workout_checkins.mean_hr IS 'Mean heart rate during HRV reading (bpm)';
