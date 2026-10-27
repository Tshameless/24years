import { downloadBackup } from './backup';
import { csvText } from './csv';
import type { ChildGrowthRecord } from './growth';

export function growthCsv(records: readonly ChildGrowthRecord[]): string {
  const header = ['测量日期', '体重（kg）', '身长（cm）', '头围（cm）', '备注'].map(csvText);
  const rows = [...records]
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    .map((record) =>
      [
        record.date,
        record.weightKg?.toString() ?? '',
        record.heightCm?.toString() ?? '',
        record.headCircumferenceCm?.toString() ?? '',
        csvText(record.notes ?? ''),
      ].join(','),
    );

  return '\uFEFF' + [header.join(','), ...rows].join('\r\n') + '\r\n';
}

export function downloadGrowthCsv(records: readonly ChildGrowthRecord[], filename: string) {
  downloadBackup(growthCsv(records), filename, 'text/csv;charset=utf-8');
}
