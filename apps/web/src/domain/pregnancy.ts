import { isDate, isObject, localDate, sameValue, shortText } from './primitives.ts';
import { validExpense, type Expense } from './ledger.ts';
import type { FamilyProfile } from './profile.ts';
import type { FamilyTask } from './tasks.ts';
import { childIdForOutcome, validChild, type Child } from './child.ts';

export interface FamilyData {
  version: 1;
  profile: FamilyProfile | null;
  tasks: FamilyTask[];
  expenses: Expense[];
  theme: 'light' | 'dark';
  pregnancyRecords?: PregnancyRecord[];
  children?: Child[];
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
  | {
      id: string;
      type: 'mood';
      date: string;
      title: string;
      notes: string;
      visibility: 'private' | 'shared';
    }
  | {
      id: string;
      type: 'nutrition';
      date: string;
      water: boolean;
      protein: boolean;
      vegetables: boolean;
      supplement: boolean;
      notes: string;
    }
  | {
      id: string;
      type: 'mentalScreening';
      date: string;
      score: number;
      selfHarm: boolean;
      answers?: readonly number[];
      notes: string;
      visibility: 'private' | 'shared';
    }
  | {
      id: string;
      type: 'ultrasound';
      date: string;
      gestationWeeks: number;
      gestationDays: number;
      bpd?: number;
      fl?: number;
      ac?: number;
      hc?: number;
      afi?: number;
      umbilicalSd?: number;
      efw?: number;
      fhr?: number;
      presentation?: string;
      notes: string;
    }
  | {
      id: string;
      type: 'symptom';
      date: string;
      symptoms: readonly string[];
      severity: 'mild' | 'moderate' | 'severe';
      notes: string;
    }
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
      pulse?: number;
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
      bloodType?: string;
      hospitalNumber?: string;
      obstetrician?: string;
      obstetricPhone?: string;
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
      birthGestationalWeeks?: number;
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

export function isPostpartumCareRecord(
  record: PregnancyRecord,
): record is Extract<
  PregnancyRecord,
  { type: 'mood' | 'nutrition' | 'mentalScreening' | 'vital' }
> {
  return ['mood', 'nutrition', 'mentalScreening', 'vital'].includes(record.type);
}

export function postpartumWindowEnd(outcomeDate: string): string {
  const [year, month, day] = outcomeDate.split('-').map(Number);
  const targetYear = year + 2;
  const maxDay = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
  const clampedDay = Math.min(day, maxDay);

  return `${targetYear}-${String(month).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

export function withinPostpartumWindow(outcomeDate: string, recordDate: string): boolean {
  return recordDate >= outcomeDate && recordDate <= postpartumWindowEnd(outcomeDate);
}

export interface PregnancyChange {
  type: 'pregnancy';
  before: PregnancyRecord | null;
  value: PregnancyRecord | null;
  /** Completing an existing checkup or packing item can atomically create one expense. */
  expense?: Expense;
  /** A birth outcome and its linked child profile are saved in one transaction. */
  child?: { before: Child | null; value: Child | null };
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
        note(value.notes) &&
        (value.visibility === 'private' || value.visibility === 'shared')
      );
    case 'nutrition':
      return (
        isDate(value.date) &&
        typeof value.water === 'boolean' &&
        typeof value.protein === 'boolean' &&
        typeof value.vegetables === 'boolean' &&
        typeof value.supplement === 'boolean' &&
        note(value.notes) &&
        (value.visibility === 'private' || value.visibility === 'shared')
      );
    case 'mentalScreening':
      return (
        isDate(value.date) &&
        typeof value.score === 'number' &&
        Number.isInteger(value.score) &&
        value.score >= 0 &&
        value.score <= 30 &&
        typeof value.selfHarm === 'boolean' &&
        (value.answers === undefined ||
          (Array.isArray(value.answers) &&
            value.answers.length === 10 &&
            value.answers.every(
              (answer) => Number.isInteger(answer) && answer >= 0 && answer <= 3,
            ))) &&
        note(value.notes)
      );
    case 'ultrasound':
      return (
        isDate(value.date) &&
        typeof value.gestationWeeks === 'number' &&
        Number.isInteger(value.gestationWeeks) &&
        value.gestationWeeks >= 0 &&
        value.gestationWeeks <= 42 &&
        typeof value.gestationDays === 'number' &&
        Number.isInteger(value.gestationDays) &&
        value.gestationDays >= 0 &&
        value.gestationDays <= 6 &&
        ['bpd', 'fl', 'ac', 'hc', 'afi', 'umbilicalSd', 'efw', 'fhr'].every(
          (key) =>
            value[key] === undefined ||
            (typeof value[key] === 'number' && Number.isFinite(value[key]) && value[key] >= 0),
        ) &&
        (value.presentation === undefined || shortText(value.presentation, 40)) &&
        note(value.notes)
      );
    case 'symptom':
      return (
        isDate(value.date) &&
        Array.isArray(value.symptoms) &&
        value.symptoms.length <= 12 &&
        value.symptoms.every((item) => shortText(item, 40)) &&
        ['mild', 'moderate', 'severe'].includes(String(value.severity)) &&
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
        (value.pulse === undefined || positive(value.pulse, 300)) &&
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
        (value.bloodType === undefined || shortText(value.bloodType, 20)) &&
        (value.hospitalNumber === undefined || shortText(value.hospitalNumber, 50)) &&
        (value.obstetrician === undefined || shortText(value.obstetrician, 50)) &&
        (value.obstetricPhone === undefined ||
          (typeof value.obstetricPhone === 'string' &&
            /^[+\d ()-]{0,30}$/.test(value.obstetricPhone))) &&
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
          value.birthGestationalWeeks === undefined &&
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
        (value.birthGestationalWeeks === undefined ||
          (typeof value.birthGestationalWeeks === 'number' &&
            Number.isInteger(value.birthGestationalWeeks) &&
            value.birthGestationalWeeks >= 20 &&
            value.birthGestationalWeeks <= 45)) &&
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

export function applyPregnancyChange(data: FamilyData, change: PregnancyChange): FamilyData {
  const { before, value, expense, child } = change;

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

  if (!sameValue(records.find((item) => item.id === id) ?? null, before)) {
    throw new PregnancyChangeError('这条记录已变化，请重新打开最新记录，输入已保留。', 409);
  }

  let updatedChildren = data.children;

  if (child) {
    const linkedOutcome =
      value?.type === 'outcome' && value.kind === 'birth'
        ? value
        : before?.type === 'outcome' && before.kind === 'birth'
          ? before
          : value?.type === 'outcome'
            ? value
            : before?.type === 'outcome'
              ? before
              : null;
    const { before: childBefore, value: childValue } = child;
    const childId = childBefore?.id ?? childValue?.id;
    const existingChild = data.children?.find((item) => item.id === childId) ?? null;
    const endingBirth =
      linkedOutcome?.kind === 'birth' &&
      (!value || value.type !== 'outcome' || value.kind !== 'birth');

    if (
      childBefore &&
      !childValue &&
      (!endingBirth ||
        childBefore.sourceOutcomeId !== linkedOutcome?.id ||
        (childBefore.growthRecords?.length ?? 0) > 0)
    ) {
      throw new PregnancyChangeError('不能通过更正分娩记录删除孩子档案，请在成长档案中管理。');
    }

    if (
      !linkedOutcome ||
      (!childBefore && !childValue) ||
      (childBefore !== null && !validChild(childBefore)) ||
      (childValue !== null && !validChild(childValue)) ||
      (childBefore && childValue && childBefore.id !== childValue.id) ||
      (childValue?.sourceOutcomeId !== undefined &&
        (endingBirth || childValue.sourceOutcomeId !== linkedOutcome.id))
    ) {
      throw new PregnancyChangeError('关联的新生儿档案格式无效。');
    }

    if (!sameValue(existingChild, childBefore)) {
      throw new PregnancyChangeError('关联的新生儿档案已变化，请刷新后重试。', 409);
    }

    if (childValue) {
      updatedChildren = [
        ...(data.children ?? []).filter((item) => item.id !== childId),
        childValue,
      ];
    } else {
      updatedChildren = (data.children ?? []).filter((item) => item.id !== childId);
    }
  }

  const currentOutcome = pregnancyOutcome(records);
  const changedOutcome = (before ?? value)?.type === 'outcome';

  if (
    currentOutcome?.kind === 'birth' &&
    changedOutcome &&
    (!value || (value.type === 'outcome' && value.kind !== 'birth'))
  ) {
    const linkedChild = (data.children ?? []).find(
      (item) =>
        item.sourceOutcomeId === currentOutcome.id ||
        item.id === childIdForOutcome(currentOutcome.id),
    );

    if (linkedChild && !child) {
      throw new PregnancyChangeError('请先处理关联孩子档案，再更正或撤销分娩记录。', 409);
    }
  }

  if (
    currentOutcome &&
    (before ?? value)?.type !== 'outcome' &&
    (before ?? value)?.type !== 'postpartum' &&
    !isPostpartumCareRecord((before ?? value)!)
  ) {
    throw new PregnancyChangeError('孕期记录已结束，历史记录仅供查阅。', 409);
  }

  const currentCareRecord = (value ?? before)!;

  if (
    currentOutcome &&
    isPostpartumCareRecord((before ?? value)!) &&
    isPostpartumCareRecord(currentCareRecord)
  ) {
    if (
      currentOutcome.kind !== 'birth' ||
      (before &&
        (!isPostpartumCareRecord(before) ||
          !withinPostpartumWindow(currentOutcome.date, before.date))) ||
      !withinPostpartumWindow(currentOutcome.date, currentCareRecord.date)
    ) {
      throw new PregnancyChangeError(
        before && isPostpartumCareRecord(before) && before.date < currentOutcome.date
          ? '孕期记录已结束，分娩前的历史记录仅供查阅。'
          : '产后身心记录仅可在分娩后 24 个月内保存。',
        409,
      );
    }
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
      (before !== null && (before?.type !== value.type || before.completed)) ||
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
    ...(updatedChildren !== undefined ? { children: updatedChildren } : {}),
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
