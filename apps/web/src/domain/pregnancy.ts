import { isDate, isObject, localDate, shortText } from './primitives.ts';
import { validExpense, type Expense } from './ledger.ts';
import type { FamilyProfile } from './profile.ts';
import type { FamilyTask } from './tasks.ts';

export interface FamilyData {
  version: 1;
  profile: FamilyProfile | null;
  tasks: FamilyTask[];
  expenses: Expense[];
  theme: 'light' | 'dark';
  pregnancyRecords?: PregnancyRecord[];
}

export type PregnancyRecord =
  | {
      id: 'postpartum-plan';
      type: 'postpartum';
      date: string;
      followupDate?: string;
      newbornFollowupDate?: string;
      supportPerson: string;
      recovery: string;
      feeding: string;
      questions: string;
      notes: string;
    }
  | { id: string; type: 'bonding'; date: string; title: string; minutes: number; notes: string }
  | { id: string; type: 'mood'; date: string; title: string; notes: string }
  | {
      id: string;
      type: 'packing';
      date: string;
      title: string;
      completed: boolean;
      notes: string;
      category?: string;
      quantity?: number;
      assignee?: 'mother' | 'father' | 'single_parent';
    }
  | { id: string; type: 'checkup'; title: string; date: string; notes: string; completed: boolean }
  | {
      id: string;
      type: 'vital';
      date: string;
      /** Local wall-clock time; absent for measurements with unknown time. */
      time?: string;
      context?: string;
      metric: 'weight' | 'bloodPressure' | 'glucose';
      value: number;
      secondary: number | null;
      notes: string;
    }
  | { id: string; type: 'contraction'; startedAt: number; endedAt: number | null }
  | {
      id: string;
      type: 'movement';
      date: string;
      time: string;
      minutes: number;
      count: number;
      notes: string;
    }
  | {
      id: string;
      type: 'medical';
      hospital: string;
      contact: string;
      phone: string;
      notes: string;
    }
  | {
      id: 'birth-plan';
      type: 'birthPlan';
      date: string;
      supportPerson: string;
      discussPainRelief: boolean;
      discussPosition: boolean;
      discussProcedures: boolean;
      discussNewbornCare: boolean;
      discussEarlyContact: boolean;
      questions: string;
      notes: string;
    }
  | {
      id: 'pregnancy-outcome';
      type: 'outcome';
      kind: 'birth' | 'ended';
      date: string;
      time?: string;
      mode?: 'vaginal' | 'cesarean' | 'assisted' | 'unknown';
      location?: string;
      babyName?: string;
      birthWeightGrams?: number;
      birthLengthCm?: number;
      headCircumferenceCm?: number;
      apgarOne?: number;
      apgarFive?: number;
      notes: string;
    };

export type PregnancyOutcome = Extract<PregnancyRecord, { type: 'outcome' }>;

export function pregnancyOutcome(records: readonly PregnancyRecord[] | undefined) {
  return records?.find((record): record is PregnancyOutcome => record.type === 'outcome') ?? null;
}

export interface PregnancyChange {
  type: 'pregnancy';
  before: PregnancyRecord | null;
  value: PregnancyRecord | null;
  /** Completing an existing checkup or packing item can atomically create one expense. */
  expense?: Expense;
}

export function validPregnancyRecord(value: unknown): value is PregnancyRecord {
  if (!isObject(value) || !shortText(value.id, 100)) {
    return false;
  }

  const note = (text: unknown) => typeof text === 'string' && text.length <= 2000;
  const positive = (n: unknown, max: number) =>
    typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= max;
  switch (value.type) {
    case 'bonding':
      return (
        isDate(value.date) &&
        shortText(value.title, 80) &&
        note(value.notes) &&
        Number.isInteger(value.minutes) &&
        positive(value.minutes, 1440)
      );
    case 'mood':
      return (
        isDate(value.date) &&
        ['愉悦', '平静', '烦躁', '低落', '疲惫'].includes(String(value.title)) &&
        note(value.notes)
      );
    case 'packing':
      return (
        isDate(value.date) &&
        shortText(value.title, 80) &&
        typeof value.completed === 'boolean' &&
        (value.category === undefined || shortText(value.category, 30)) &&
        (value.quantity === undefined ||
          (Number.isInteger(value.quantity) && positive(value.quantity, 9999))) &&
        (value.assignee === undefined ||
          ['mother', 'father', 'single_parent'].includes(String(value.assignee))) &&
        note(value.notes)
      );
    case 'checkup':
      return (
        shortText(value.title, 80) &&
        isDate(value.date) &&
        note(value.notes) &&
        typeof value.completed === 'boolean'
      );
    case 'vital':
      return (
        isDate(value.date) &&
        (value.time === undefined ||
          (typeof value.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value.time))) &&
        (value.context === undefined || shortText(value.context, 80)) &&
        note(value.notes) &&
        ((value.metric === 'weight' && positive(value.value, 1000) && value.secondary === null) ||
          (value.metric === 'glucose' && positive(value.value, 100) && value.secondary === null) ||
          (value.metric === 'bloodPressure' &&
            positive(value.value, 400) &&
            positive(value.secondary, 400)))
      );
    case 'movement':
      return (
        isDate(value.date) &&
        typeof value.time === 'string' &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(value.time) &&
        Number.isInteger(value.minutes) &&
        positive(value.minutes, 1440) &&
        Number.isInteger(value.count) &&
        typeof value.count === 'number' &&
        value.count >= 0 &&
        value.count <= 9999 &&
        note(value.notes)
      );
    case 'contraction':
      return (
        Number.isSafeInteger(value.startedAt) &&
        positive(value.startedAt, 8640000000000000) &&
        (value.endedAt === null ||
          (Number.isSafeInteger(value.endedAt) &&
            typeof value.endedAt === 'number' &&
            value.endedAt >= Number(value.startedAt) &&
            value.endedAt <= 8640000000000000))
      );
    case 'medical':
      return (
        value.id === 'medical-card' &&
        typeof value.hospital === 'string' &&
        value.hospital.length <= 100 &&
        typeof value.contact === 'string' &&
        value.contact.length <= 50 &&
        typeof value.phone === 'string' &&
        /^[+\d ()-]{0,30}$/.test(value.phone) &&
        note(value.notes)
      );
    case 'postpartum':
      return (
        value.id === 'postpartum-plan' &&
        isDate(value.date) &&
        (value.followupDate === undefined ||
          (isDate(value.followupDate) && value.followupDate >= value.date)) &&
        (value.newbornFollowupDate === undefined ||
          (isDate(value.newbornFollowupDate) && value.newbornFollowupDate >= value.date)) &&
        typeof value.supportPerson === 'string' &&
        value.supportPerson.length <= 80 &&
        note(value.recovery) &&
        note(value.feeding) &&
        note(value.questions) &&
        note(value.notes)
      );
    case 'birthPlan':
      return (
        value.id === 'birth-plan' &&
        isDate(value.date) &&
        typeof value.supportPerson === 'string' &&
        value.supportPerson.length <= 80 &&
        typeof value.discussPainRelief === 'boolean' &&
        typeof value.discussPosition === 'boolean' &&
        typeof value.discussProcedures === 'boolean' &&
        typeof value.discussNewbornCare === 'boolean' &&
        typeof value.discussEarlyContact === 'boolean' &&
        note(value.questions) &&
        note(value.notes)
      );
    case 'outcome': {
      const shared =
        value.id === 'pregnancy-outcome' &&
        isDate(value.date) &&
        (value.time === undefined ||
          (typeof value.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value.time))) &&
        note(value.notes);

      if (value.kind === 'ended') {
        return (
          shared &&
          value.mode === undefined &&
          value.location === undefined &&
          value.babyName === undefined &&
          value.birthWeightGrams === undefined &&
          value.birthLengthCm === undefined &&
          value.headCircumferenceCm === undefined &&
          value.apgarOne === undefined &&
          value.apgarFive === undefined
        );
      }

      return (
        shared &&
        value.kind === 'birth' &&
        ['vaginal', 'cesarean', 'assisted', 'unknown'].includes(String(value.mode)) &&
        (value.location === undefined ||
          (typeof value.location === 'string' && value.location.length <= 100)) &&
        (value.babyName === undefined ||
          (typeof value.babyName === 'string' && value.babyName.length <= 40)) &&
        (value.birthWeightGrams === undefined ||
          (typeof value.birthWeightGrams === 'number' &&
            Number.isInteger(value.birthWeightGrams) &&
            value.birthWeightGrams > 0 &&
            value.birthWeightGrams <= 10000)) &&
        (value.birthLengthCm === undefined ||
          (typeof value.birthLengthCm === 'number' &&
            Number.isFinite(value.birthLengthCm) &&
            value.birthLengthCm > 0 &&
            value.birthLengthCm <= 100)) &&
        (value.headCircumferenceCm === undefined ||
          (typeof value.headCircumferenceCm === 'number' &&
            Number.isFinite(value.headCircumferenceCm) &&
            value.headCircumferenceCm > 0 &&
            value.headCircumferenceCm <= 100)) &&
        (value.apgarOne === undefined ||
          (typeof value.apgarOne === 'number' &&
            Number.isInteger(value.apgarOne) &&
            value.apgarOne >= 0 &&
            value.apgarOne <= 10)) &&
        (value.apgarFive === undefined ||
          (typeof value.apgarFive === 'number' &&
            Number.isInteger(value.apgarFive) &&
            value.apgarFive >= 0 &&
            value.apgarFive <= 10))
      );
    }
    default:
      return false;
  }
}

export class PregnancyChangeError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// Records are flat objects. Compare fields independently of JSON property ordering.
function sameRecord(a: PregnancyRecord | null, b: PregnancyRecord | null): boolean {
  if (!a || !b) {
    return a === b;
  }

  return (
    Object.keys(a).length === Object.keys(b).length &&
    Object.entries(a).every(
      ([key, value]) => (b as unknown as Record<string, unknown>)[key] === value,
    )
  );
}

export function applyPregnancyChange(data: FamilyData, change: PregnancyChange): FamilyData {
  const { before, value, expense } = change;

  if (
    (before !== null && !validPregnancyRecord(before)) ||
    (value !== null && !validPregnancyRecord(value)) ||
    (!before && !value) ||
    (before && value && (before.id !== value.id || before.type !== value.type))
  ) {
    throw new PregnancyChangeError('记录格式无效。');
  }

  const id = (before ?? value)!.id;
  const records = data.pregnancyRecords ?? [];

  if (!sameRecord(records.find((item) => item.id === id) ?? null, before)) {
    throw new PregnancyChangeError('这条记录已变化，请重新打开最新记录，输入已保留。', 409);
  }

  const currentOutcome = pregnancyOutcome(records);

  if (
    currentOutcome &&
    (before ?? value)?.type !== 'outcome' &&
    (before ?? value)?.type !== 'postpartum'
  ) {
    throw new PregnancyChangeError('孕期记录已结束，历史记录仅供查阅。', 409);
  }

  if (value?.type === 'outcome' && (!data.profile || value.date > localDate())) {
    throw new PregnancyChangeError('请先建立档案，并填写不晚于今天的实际结束日期。');
  }

  if (
    value?.type === 'postpartum' &&
    (currentOutcome?.kind !== 'birth' || value.date < currentOutcome.date)
  ) {
    throw new PregnancyChangeError('请先记录分娩，交接日期不能早于分娩日期。');
  }

  if (
    before?.type === 'outcome' &&
    (!value || (value.type === 'outcome' && value.kind !== 'birth')) &&
    records.some((item) => item.type === 'postpartum')
  ) {
    throw new PregnancyChangeError('请先在产后交接中删除交接记录，再更正孕期结束状态。', 409);
  }

  if (
    value?.type === 'outcome' &&
    records.some((item) => item.type === 'postpartum' && item.date < value.date)
  ) {
    throw new PregnancyChangeError('分娩日期不能晚于已有交接日期，请先更正交接记录。', 409);
  }

  const updated = [...records.filter((item) => item.id !== id), ...(value ? [value] : [])];

  if (
    value &&
    (value.type === 'outcome' || value.type === 'birthPlan') &&
    records.some((item) => item.type === value.type && item.id !== value.id)
  ) {
    throw new PregnancyChangeError('这项记录已经存在，请编辑最新记录。', 409);
  }

  if (
    data.profile?.quietMode &&
    !before &&
    value?.type === 'contraction' &&
    value.endedAt === null
  ) {
    throw new PregnancyChangeError('安静关怀期间暂停新计时，已有计时仍可结束。');
  }

  if (updated.filter((item) => item.type === 'contraction' && item.endedAt === null).length > 1) {
    throw new PregnancyChangeError('已有一次宫缩正在计时，请先结束它。', 409);
  }

  if (
    value?.type === 'outcome' &&
    records.some((item) => item.type === 'contraction' && item.endedAt === null)
  ) {
    throw new PregnancyChangeError('请先结束正在进行的宫缩计时，再保存孕期结束记录。', 409);
  }

  if (
    expense &&
    (!validExpense(expense) ||
      (value?.type !== 'checkup' && value?.type !== 'packing') ||
      !value.completed ||
      before?.type !== value.type ||
      before.completed ||
      expense.id !== `${value.type}-${id}` ||
      expense.kind !== 'expense' ||
      expense.category !== (value.type === 'checkup' ? '产检医疗' : '待产准备') ||
      (value.type === 'packing' && expense.reimbursedCents !== 0) ||
      expense.date !== value.date)
  ) {
    throw new PregnancyChangeError('关联费用格式无效。');
  }

  if (expense && data.expenses.some((item) => item.id === expense.id)) {
    throw new PregnancyChangeError('此记录已有关联账目，请在家庭账本中修改。', 409);
  }

  return {
    ...data,
    profile:
      value?.type === 'outcome' && value.kind === 'ended' && data.profile
        ? { ...data.profile, quietMode: true }
        : data.profile,
    pregnancyRecords: updated,
    expenses: expense ? [expense, ...data.expenses] : data.expenses,
  };
}

export function validPregnancyLifecycle(records: PregnancyRecord[]): boolean {
  const outcome = pregnancyOutcome(records);
  const handoff = records.find((item) => item.type === 'postpartum');

  return (
    !(outcome && records.some((item) => item.type === 'contraction' && item.endedAt === null)) &&
    (!handoff || (outcome?.kind === 'birth' && handoff.date >= outcome.date))
  );
}
