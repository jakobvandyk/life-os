/**
 * Client-side streaming parser for Apple Health export.xml
 * Reads in chunks via ReadableStream, extracts relevant <Record> types,
 * aggregates per day into compact daily objects.
 */

const METRIC_TYPES = new Set([
  "HKQuantityTypeIdentifierBodyMass",
  "HKQuantityTypeIdentifierBodyFatPercentage",
  "HKQuantityTypeIdentifierHeartRateVariabilitySDNN",
  "HKQuantityTypeIdentifierRestingHeartRate",
  "HKQuantityTypeIdentifierStepCount",
  "HKQuantityTypeIdentifierActiveEnergyBurned",
  "HKQuantityTypeIdentifierVO2Max",
  "HKQuantityTypeIdentifierHeartRate",
  "HKCategoryTypeIdentifierSleepAnalysis",
]);

const ASLEEP_VALUES = new Set([
  "HKCategoryValueSleepAnalysisAsleepCore",
  "HKCategoryValueSleepAnalysisAsleepDeep",
  "HKCategoryValueSleepAnalysisAsleepREM",
  "HKCategoryValueSleepAnalysisAsleep",
]);

export interface DailyRecord {
  date: string;
  weight?: number;
  body_fat_pct?: number;
  hrv?: number;
  resting_hr?: number;
  steps?: number;
  active_calories?: number;
  vo2_max?: number;
  mean_hr?: number;
  sleep?: number;
}

interface DayAccumulator {
  weight?: number;
  body_fat_pct?: number;
  hrv?: number;
  resting_hr?: number;
  steps: number;
  active_calories: number;
  vo2_max?: number;
  hr_sum: number;
  hr_count: number;
  sleep_seconds: number;
}

function attr(line: string, name: string): string | null {
  const re = new RegExp(`${name}="([^"]*)"`, "i");
  const m = line.match(re);
  return m ? m[1] : null;
}

function parseDate(dateStr: string): string {
  return dateStr.substring(0, 10);
}

function parseDateTime(dateStr: string): number {
  const iso = dateStr.replace(" ", "T").replace(/ ([+-])(\d{2})(\d{2})$/, "$1$2:$3");
  return new Date(iso).getTime();
}

export async function parseAppleHealthExport(
  file: File,
  onProgress?: (bytesRead: number, totalBytes: number) => void
): Promise<DailyRecord[]> {
  const byDate = new Map<string, DayAccumulator>();

  function getDay(date: string): DayAccumulator {
    let day = byDate.get(date);
    if (!day) {
      day = { steps: 0, active_calories: 0, hr_sum: 0, hr_count: 0, sleep_seconds: 0 };
      byDate.set(date, day);
    }
    return day;
  }

  const stream = file.stream();
  const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let bytesRead = 0;
  const totalBytes = file.size;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    bytesRead += new TextEncoder().encode(value).length;
    buffer += value;

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.includes("<Record ")) continue;

      const type = attr(line, "type");
      if (!type || !METRIC_TYPES.has(type)) continue;

      const startDateStr = attr(line, "startDate");
      if (!startDateStr) continue;
      const date = parseDate(startDateStr);

      const day = getDay(date);

      if (type === "HKCategoryTypeIdentifierSleepAnalysis") {
        const sleepValue = attr(line, "value");
        if (!sleepValue || !ASLEEP_VALUES.has(sleepValue)) continue;
        const endDateStr = attr(line, "endDate");
        if (!endDateStr) continue;
        const start = parseDateTime(startDateStr);
        const end = parseDateTime(endDateStr);
        if (end > start) {
          day.sleep_seconds += (end - start) / 1000;
        }
        continue;
      }

      const valueStr = attr(line, "value");
      if (!valueStr) continue;
      const numValue = parseFloat(valueStr);
      if (isNaN(numValue)) continue;

      switch (type) {
        case "HKQuantityTypeIdentifierBodyMass":
          if (day.weight == null) day.weight = numValue;
          break;
        case "HKQuantityTypeIdentifierBodyFatPercentage": {
          const pct = numValue <= 1 ? numValue * 100 : numValue;
          if (day.body_fat_pct == null) day.body_fat_pct = pct;
          break;
        }
        case "HKQuantityTypeIdentifierHeartRateVariabilitySDNN":
          if (day.hrv == null) day.hrv = numValue;
          break;
        case "HKQuantityTypeIdentifierRestingHeartRate":
          if (day.resting_hr == null) day.resting_hr = numValue;
          break;
        case "HKQuantityTypeIdentifierStepCount":
          day.steps += numValue;
          break;
        case "HKQuantityTypeIdentifierActiveEnergyBurned":
          day.active_calories += numValue;
          break;
        case "HKQuantityTypeIdentifierVO2Max":
          if (day.vo2_max == null) day.vo2_max = numValue;
          break;
        case "HKQuantityTypeIdentifierHeartRate":
          day.hr_sum += numValue;
          day.hr_count += 1;
          break;
      }
    }

    if (onProgress) onProgress(bytesRead, totalBytes);
  }

  const records: DailyRecord[] = [];
  for (const [date, day] of byDate) {
    const record: DailyRecord = { date };
    if (day.weight != null) record.weight = Math.round(day.weight * 10) / 10;
    if (day.body_fat_pct != null) record.body_fat_pct = Math.round(day.body_fat_pct * 10) / 10;
    if (day.hrv != null) record.hrv = Math.round(day.hrv);
    if (day.resting_hr != null) record.resting_hr = Math.round(day.resting_hr);
    if (day.steps > 0) record.steps = Math.round(day.steps);
    if (day.active_calories > 0) record.active_calories = Math.round(day.active_calories);
    if (day.vo2_max != null) record.vo2_max = Math.round(day.vo2_max * 10) / 10;
    if (day.hr_count > 0) record.mean_hr = Math.round(day.hr_sum / day.hr_count);
    if (day.sleep_seconds > 0) record.sleep = Math.round((day.sleep_seconds / 3600) * 10) / 10;
    if (Object.keys(record).length > 1) records.push(record);
  }

  records.sort((a, b) => a.date.localeCompare(b.date));
  return records;
}
