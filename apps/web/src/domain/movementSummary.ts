import { csvText } from './csv.ts';
import type { PregnancyRecord } from './family.ts';

export type MovementRecord = Extract<PregnancyRecord, { type: 'movement' }>;

export interface DailyMovementSummary {
  readonly date: string;
  readonly sessionCount: number;
  readonly totalMinutes: number;
  readonly totalCount: number;
  readonly sessions: readonly MovementRecord[];
}

// Pure descriptive aggregation by local date; never extrapolates 12h totals or labels clinical normality.
export function summarizeMovementsByDay(
  records: readonly PregnancyRecord[],
): DailyMovementSummary[] {
  const movements = records.filter((item): item is MovementRecord => item.type === 'movement');
  const byDate = new Map<string, MovementRecord[]>();

  for (const item of movements) {
    const existing = byDate.get(item.date);

    if (existing) {
      existing.push(item);
    } else {
      byDate.set(item.date, [item]);
    }
  }

  return Array.from(byDate.entries())
    .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
    .map(([date, list]) => {
      const sessions = [...list].sort(
        (a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id),
      );

      return {
        date,
        sessionCount: sessions.length,
        totalMinutes: sessions.reduce((sum, item) => sum + item.minutes, 0),
        totalCount: sessions.reduce((sum, item) => sum + item.count, 0),
        sessions,
      };
    });
}

export function buildMovementsCsv(records: readonly PregnancyRecord[]): string {
  const movements = records
    .filter((item): item is MovementRecord => item.type === 'movement')
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.time.localeCompare(a.time) || a.id.localeCompare(b.id),
    );
  const header = ['日期', '开始时间', '观察时长(分钟)', '记录次数', '备注'].map(csvText).join(',');
  const rows = movements.map((item) =>
    [
      csvText(item.date),
      csvText(item.time),
      String(item.minutes),
      String(item.count),
      csvText(item.notes),
    ].join(','),
  );

  return '\ufeff' + [header, ...rows].join('\n');
}
