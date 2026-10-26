import { addDays, isDate, isObject, shortText } from './primitives.ts';
import type { ChildGender } from './child.ts';
import {
  lmsFor,
  WHO_STANDARD_SOURCE,
  WHO_STANDARD_VERSION,
  type GrowthStandardMetric,
} from './growth-standards.ts';

export interface ChildGrowthRecord {
  id: string;
  date: string;
  weightKg?: number;
  heightCm?: number;
  headCircumferenceCm?: number;
  notes?: string;
}

export function validGrowthRecord(value: unknown): value is ChildGrowthRecord {
  if (!isObject(value)) {
    return false;
  }

  const { id, date, weightKg, heightCm, headCircumferenceCm, notes } = value as Record<
    string,
    unknown
  >;

  if (!shortText(id, 64) || !isDate(date)) {
    return false;
  }

  const hasWeight =
    weightKg !== undefined &&
    typeof weightKg === 'number' &&
    Number.isFinite(weightKg) &&
    weightKg >= 0.5 &&
    weightKg <= 40;

  const hasHeight =
    heightCm !== undefined &&
    typeof heightCm === 'number' &&
    Number.isFinite(heightCm) &&
    heightCm >= 20 &&
    heightCm <= 140;

  const hasHead =
    headCircumferenceCm !== undefined &&
    typeof headCircumferenceCm === 'number' &&
    Number.isFinite(headCircumferenceCm) &&
    headCircumferenceCm >= 20 &&
    headCircumferenceCm <= 60;

  if (weightKg !== undefined && !hasWeight) {
    return false;
  }

  if (heightCm !== undefined && !hasHeight) {
    return false;
  }

  if (headCircumferenceCm !== undefined && !hasHead) {
    return false;
  }

  if (!hasWeight && !hasHeight && !hasHead) {
    return false;
  }

  if (notes !== undefined && (typeof notes !== 'string' || notes.length > 500)) {
    return false;
  }

  return true;
}

export type GrowthMetric = 'weightKg' | 'heightCm' | 'headCircumferenceCm';

export interface GrowthAssessment {
  status: 'low' | 'normal' | 'high';
  percentileBand: '< P3' | 'P3 - P15' | 'P15 - P85' | 'P85 - P97' | '> P97';
  p3: number;
  p50: number;
  p97: number;
  zScore: number;
  percentile: number;
  standardVersion: string;
  source: string;
  summary: string;
}

export function ageInMonthsAt(birthDate: string, date: string): number {
  const [bYear, bMonth, bDay] = birthDate.split('-').map(Number);
  const [year, month, day] = date.split('-').map(Number);
  let months = (year - bYear) * 12 + month - bMonth;

  if (day < bDay) {
    months -= 1;
  }

  return Math.max(0, months);
}

export function correctedAgeMonths(
  chronologicalMonths: number,
  gestationalWeeks?: number,
): number {
  if (gestationalWeeks === undefined || gestationalWeeks >= 37) {
    return chronologicalMonths;
  }

  const weeksPremature = 40 - gestationalWeeks;

  return Math.max(0, chronologicalMonths - weeksPremature / 4.345);
}

export function assessChildGrowth(
  metric: GrowthMetric,
  value: number,
  ageMonths: number,
  gender: ChildGender,
): GrowthAssessment | null {
  if ((gender !== 'boy' && gender !== 'girl') || ageMonths < 0 || ageMonths > 60) {
    return null;
  }

  const lms = lmsFor(gender, metric as GrowthStandardMetric, ageMonths);

  if (!lms) {return null;}

  const zScore = lms.l === 0
    ? Math.log(value / lms.m) / lms.s
    : (Math.pow(value / lms.m, lms.l) - 1) / (lms.l * lms.s);
  const percentile = 0.5 * (1 + erf(zScore / Math.SQRT2));
  const p3 = lms.l === 0 ? lms.m * Math.exp(lms.s * -1.8808) : lms.m * Math.pow(1 + lms.l * lms.s * -1.8808, 1 / lms.l);
  const p50 = lms.m;
  const p97 = lms.l === 0 ? lms.m * Math.exp(lms.s * 1.8808) : lms.m * Math.pow(1 + lms.l * lms.s * 1.8808, 1 / lms.l);

  let status: GrowthAssessment['status'] = 'normal';
  let percentileBand: GrowthAssessment['percentileBand'] = 'P15 - P85';
  let summary = `处于 WHO 标准正常范围（P50 典型中位数约为 ${p50}）`;

  if (value < p3) {
    status = 'low';
    percentileBand = '< P3';
    summary = `低于 WHO 标准第 3 百分位（参考下限 ${p3}），建议儿科体检随访评估`;
  } else if (value > p97) {
    status = 'high';
    percentileBand = '> P97';
    summary = `高于 WHO 标准第 97 百分位（参考上限 ${p97}），结合体型综合观察`;
  } else if (value <= (p3 + p50) / 2) {
    percentileBand = 'P3 - P15';
    summary = `处于正常偏低参考范围（P3-P15），持续观察平稳生长曲线`;
  } else if (value >= (p50 + p97) / 2) {
    percentileBand = 'P85 - P97';
    summary = `处于正常偏高参考范围（P85-P97），持续观察平稳生长曲线`;
  }

  return {
    status,
    percentileBand,
    p3: Math.round(p3 * 10) / 10,
    p50: Math.round(p50 * 10) / 10,
    p97: Math.round(p97 * 10) / 10,
    zScore: Math.round(zScore * 100) / 100,
    percentile: Math.round(percentile * 1000) / 10,
    standardVersion: WHO_STANDARD_VERSION,
    source: WHO_STANDARD_SOURCE,
    summary,
  };
}

function erf(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);

  return sign * y;
}

export interface PediatricMilestone {
  id: string;
  ageLabel: string;
  title: string;
  type: 'vaccine' | 'checkup';
  dueDayOffset: number;
  description: string;
}

export const PEDIATRIC_MILESTONES: readonly PediatricMilestone[] = [
  {
    id: 'birth-dose',
    ageLabel: '出生时',
    title: '卡介苗 & 乙肝疫苗（第1剂）',
    type: 'vaccine',
    dueDayOffset: 1,
    description: '产院常规接种，核对预防接种证与接种部位反应。',
  },
  {
    id: 'month-1',
    ageLabel: '满月 (28-30天)',
    title: '乙肝疫苗（第2剂）及满月健康体检',
    type: 'vaccine',
    dueDayOffset: 30,
    description: '社区卫生服务中心接种乙肝第2剂，进行满月生长发育与黄疸消退评估。',
  },
  {
    id: 'days-42',
    ageLabel: '42 天',
    title: '母婴 42 天健康复查',
    type: 'checkup',
    dueDayOffset: 42,
    description: '母亲产后恢复体检与新生儿身长、体重、头围、神经反射及髋关节常规筛查。',
  },
  {
    id: 'month-2',
    ageLabel: '2 月龄',
    title: '脊灰灭活疫苗（第1剂）',
    type: 'vaccine',
    dueDayOffset: 60,
    description: '预防脊髓灰质炎（小儿麻痹），接种前半小时避免热喂养。',
  },
  {
    id: 'month-3',
    ageLabel: '3 月龄',
    title: '脊灰第2剂、百白破第1剂与健康体检',
    type: 'vaccine',
    dueDayOffset: 90,
    description: '接种百白破三联及脊灰疫苗，监测俯卧抬头、视听追踪发育。',
  },
  {
    id: 'month-4',
    ageLabel: '4 月龄',
    title: '脊灰第3剂与百白破第2剂',
    type: 'vaccine',
    dueDayOffset: 120,
    description: '完成基础免疫接种，接种后现场留观 30 分钟。',
  },
  {
    id: 'month-5',
    ageLabel: '5 月龄',
    title: '百白破疫苗（第3剂）',
    type: 'vaccine',
    dueDayOffset: 150,
    description: '百日咳、白喉、破伤风基础针最后一针。',
  },
  {
    id: 'month-6',
    ageLabel: '6 月龄',
    title: '乙肝第3剂、流脑第1剂与 6 月龄健康体检',
    type: 'checkup',
    dueDayOffset: 180,
    description: '完成乙肝基础免疫，进行贫血筛查（血常规）、骨骼发育评估与辅食添加指导。',
  },
  {
    id: 'month-8',
    ageLabel: '8 月龄',
    title: '麻腮风疫苗（第1剂）、乙脑第1剂与体检',
    type: 'vaccine',
    dueDayOffset: 240,
    description: '预防麻疹、腮腺炎、风疹，检查坐立、抓握手部精细动作。',
  },
  {
    id: 'month-9',
    ageLabel: '9 月龄',
    title: 'A 群流脑疫苗（第2剂）',
    type: 'vaccine',
    dueDayOffset: 270,
    description: 'A 群流行性脑脊髓膜炎多糖疫苗第2剂。',
  },
  {
    id: 'year-1',
    ageLabel: '1 周岁',
    title: '1 周岁健康体检与生长发育综合评估',
    type: 'checkup',
    dueDayOffset: 365,
    description: '身长、体重、出牙数、语言萌芽、站立行走及微量元素/血常规评估。',
  },
] as const;

export function getRecommendedMilestones(
  birthDate: string,
  today: string,
): Array<PediatricMilestone & { targetDate: string; isOverdue: boolean }> {
  return PEDIATRIC_MILESTONES.map((item) => {
    const targetDate = addDays(birthDate, item.dueDayOffset);
    const isOverdue = targetDate < today;

    return { ...item, targetDate, isOverdue };
  });
}
