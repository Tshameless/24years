import { downloadBackup } from './backup';
import { csvText } from './csv';
import { type Expense, type ExpenseCategory } from './family';

export type LedgerCategory = '全部' | '津贴' | ExpenseCategory;

export function filterLedger(
  expenses: readonly Expense[],
  month: string,
  category: LedgerCategory,
): Expense[] {
  return expenses
    .filter(
      (item) =>
        (!month || item.date.slice(0, 7) === month) &&
        (category === '全部' ||
          (category === '津贴'
            ? item.kind === 'allowance'
            : item.kind === 'expense' && item.category === category)),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

export function ledgerCsv(expenses: readonly Expense[]): string {
  const header = [
    '记录编号',
    '发生日期',
    '收支类型',
    '分类',
    '账目名称',
    '支出（元）',
    '已报销（元）',
    '已到账津贴（元）',
    '净支出（元）',
  ];
  const rows = expenses.map((item) => {
    const expense = item.kind === 'expense' ? item.amountCents : 0;
    const reimbursed = item.kind === 'expense' ? item.reimbursedCents : 0;
    const allowance = item.kind === 'allowance' ? item.amountCents : 0;

    return [
      ...[
        item.id,
        item.date,
        item.kind === 'expense' ? '家庭支出' : '已到账津贴',
        item.kind === 'expense' ? item.category : '津贴',
        item.title,
      ].map(csvText),
      ...[expense, reimbursed, allowance, expense - reimbursed - allowance].map((cents) =>
        (cents / 100).toFixed(2),
      ),
    ].join(',');
  });

  // BOM allows spreadsheet software to recognize Chinese UTF-8 column names.
  return '\uFEFF' + [header.map(csvText).join(','), ...rows].join('\r\n') + '\r\n';
}

export function downloadLedgerCsv(expenses: readonly Expense[], filename: string) {
  downloadBackup(ledgerCsv(expenses), filename, 'text/csv;charset=utf-8');
}
