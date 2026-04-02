ALTER TABLE workout_checkins ADD COLUMN IF NOT EXISTS hrv_rmssd REAL;
ALTER TABLE workout_checkins ADD COLUMN IF NOT EXISTS shin_pain INTEGER CHECK (shin_pain >= 0 AND shin_pain <= 10);
ALTER TABLE workout_checkins ADD COLUMN IF NOT EXISTS waist_cm REAL;
COMMENT ON COLUMN workout_checkins.hrv IS 'SDNN from Apple Health (ms)';
COMMENT ON COLUMN workout_checkins.hrv_rmssd IS 'RMSSD from Polar H10 via Elite HRV (ms)';
COMMENT ON COLUMN workout_checkins.shin_pain IS 'Shin pain rating 0-10';
COMMENT ON COLUMN workout_checkins.waist_cm IS 'Waist circumference in cm';
