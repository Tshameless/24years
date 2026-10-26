import { cents, isDate, isObject, shortText } from './primitives.ts';

export const expenseCategories = ['产检医疗', '营养日用', '宝宝用品', '待产准备', '其他'] as const;

export type ExpenseCategory = (typeof expenseCategories)[number];

export interface Expense {
  id: string;
  title: string;
  date: string;
  kind: 'expense' | 'allowance';
  category: ExpenseCategory;
  amountCents: number;
  reimbursedCents: number;
}

export function parseMoney(value: string): number | null {
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(value.trim())) {
    return null;
  }

  const [whole, fraction = ''] = value.trim().split('.');

  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export function currency(centsAmount: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(centsAmount / 100);
}

export function summarizeExpenses(expenses: readonly Expense[]) {
  const totals = expenses.reduce(
    (sum, item) => {
      if (item.kind === 'allowance') {
        sum.allowance += item.amountCents;
      } else {
        sum.total += item.amountCents;
        sum.reimbursed += item.reimbursedCents;
      }

      return sum;
    },
    { total: 0, reimbursed: 0, allowance: 0 },
  );

  return {
    ...totals,
    net: totals.total - totals.reimbursed - totals.allowance,
  };
}

export function validExpense(value: unknown): value is Expense {
  return (
    isObject(value) &&
    shortText(value.id, 100) &&
    shortText(value.title, 80) &&
    isDate(value.date) &&
    (value.kind === 'expense' || value.kind === 'allowance') &&
    expenseCategories.includes(value.category as ExpenseCategory) &&
    cents(value.amountCents) &&
    value.amountCents > 0 &&
    cents(value.reimbursedCents) &&
    value.reimbursedCents <= value.amountCents &&
    (value.kind !== 'allowance' || value.reimbursedCents === 0)
  );
}
