import { dayDifference, type PregnancyRecord } from './family';

export type Vital = Extract<PregnancyRecord, { type: 'vital' }>;
export const vitalLabels = {
  weight: '体重（kg）',
  bloodPressure: '血压（mmHg）',
  glucose: '血糖（mmol/L）',
};

export function selectVitals(
  records: readonly PregnancyRecord[],
  metric: Vital['metric'],
  from: string,
  to: string,
) {
  return records
    .filter(
      (item): item is Vital =>
        item.type === 'vital' &&
        item.metric === metric &&
        (!from || item.date >= from) &&
        (!to || item.date <= to),
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

export function vitalPlot(records: readonly Vital[]) {
  if (!records.length) {
    return null;
  }

  const values = records.flatMap((item) =>
    item.secondary === null ? [item.value] : [item.value, item.secondary],
  );
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.1, 1);
  const low = min - padding;
  const high = max + padding;
  const first = records[0]!;
  const last = records[records.length - 1]!;
  const span = dayDifference(last.date, first.date);
  const x = (date: string) =>
    span === 0 ? 300 : 55 + (dayDifference(date, first.date) / span) * 490;
  const y = (value: number) => 160 - ((value - low) / (high - low)) * 130;

  return {
    low,
    high,
    points: records.map((item) => ({
      id: item.id,
      date: item.date,
      value: item.value,
      secondary: item.secondary,
      x: x(item.date),
      y: y(item.value),
      y2: item.secondary === null ? null : y(item.secondary),
    })),
  };
}
