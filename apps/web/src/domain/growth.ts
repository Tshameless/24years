import { addDays, isDate, isObject, shortText } from './primitives.ts';
import type { ChildGender } from './child.ts';

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
    weightKg <= 60;

  const hasHeight =
    heightCm !== undefined &&
    typeof heightCm === 'number' &&
    Number.isFinite(heightCm) &&
    heightCm >= 20 &&
    heightCm <= 160;

  const hasHead =
    headCircumferenceCm !== undefined &&
    typeof headCircumferenceCm === 'number' &&
    Number.isFinite(headCircumferenceCm) &&
    headCircumferenceCm >= 20 &&
    headCircumferenceCm <= 70;

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
  summary: string;
}

// WHO Child Growth Standards (0 - 24 months, [P3, P50, P97])
type WhoPoints = Record<number, [number, number, number]>;

const whoData: Record<'boy' | 'girl', { weight: WhoPoints; height: WhoPoints; head: WhoPoints }> = {
  boy: {
    weight: {
      0: [2.5, 3.3, 4.3],
      1: [3.4, 4.5, 5.7],
      2: [4.4, 5.6, 7.0],
      3: [5.1, 6.4, 7.9],
      4: [5.6, 7.0, 8.6],
      6: [6.4, 7.9, 9.7],
      9: [7.2, 8.9, 10.9],
      12: [7.8, 9.6, 11.8],
      18: [8.9, 10.9, 13.5],
      24: [9.7, 12.2, 15.0],
    },
    height: {
      0: [46.3, 49.9, 53.4],
      1: [51.1, 54.7, 58.4],
      2: [54.7, 58.4, 62.2],
      3: [57.6, 61.4, 65.3],
      4: [60.0, 63.9, 67.8],
      6: [63.6, 67.6, 71.6],
      9: [68.0, 72.0, 76.2],
      12: [71.3, 75.7, 80.2],
      18: [77.2, 82.3, 87.4],
      24: [82.5, 87.8, 93.2],
    },
    head: {
      0: [32.1, 34.5, 36.9],
      1: [35.1, 37.3, 39.5],
      2: [37.0, 39.1, 41.2],
      3: [38.3, 40.5, 42.6],
      4: [39.4, 41.6, 43.7],
      6: [41.0, 43.3, 45.4],
      9: [42.6, 45.0, 47.1],
      12: [43.6, 46.1, 48.3],
      18: [44.9, 47.4, 49.7],
      24: [45.8, 48.3, 50.7],
    },
  },
  girl: {
    weight: {
      0: [2.4, 3.2, 4.2],
      1: [3.2, 4.2, 5.4],
      2: [4.0, 5.1, 6.5],
      3: [4.6, 5.8, 7.4],
      4: [5.1, 6.4, 8.1],
      6: [5.8, 7.3, 9.2],
      9: [6.6, 8.2, 10.4],
      12: [7.1, 8.9, 11.3],
      18: [8.2, 10.2, 12.8],
      24: [9.0, 11.5, 14.4],
    },
    height: {
      0: [45.6, 49.1, 52.7],
      1: [50.0, 53.7, 57.4],
      2: [53.2, 57.1, 60.9],
      3: [55.8, 59.8, 63.8],
      4: [58.0, 62.1, 66.2],
      6: [61.5, 65.7, 69.8],
      9: [65.6, 70.1, 74.5],
      12: [69.2, 74.0, 78.9],
      18: [75.3, 80.7, 86.1],
      24: [80.3, 86.4, 92.5],
    },
    head: {
      0: [31.7, 33.9, 36.1],
      1: [34.3, 36.5, 38.6],
      2: [36.0, 38.2, 40.3],
      3: [37.2, 39.5, 41.6],
      4: [38.3, 40.6, 42.7],
      6: [39.9, 42.2, 44.4],
      9: [41.5, 43.8, 46.0],
      12: [42.5, 44.9, 47.1],
      18: [43.7, 46.2, 48.5],
      24: [44.6, 47.2, 49.5],
    },
  },
};

function interpolateWho(points: WhoPoints, months: number): [number, number, number] {
  const keys = Object.keys(points)
    .map(Number)
    .sort((a, b) => a - b);
  const clamped = Math.max(0, Math.min(24, months));

  if (points[clamped]) {
    return points[clamped];
  }

  let lower = keys[0];
  let upper = keys[keys.length - 1];

  for (let i = 0; i < keys.length - 1; i++) {
    if (keys[i] <= clamped && clamped <= keys[i + 1]) {
      lower = keys[i];
      upper = keys[i + 1];
      break;
    }
  }

  const factor = (clamped - lower) / (upper - lower);
  const [l3, l50, l97] = points[lower];
  const [u3, u50, u97] = points[upper];

  return [
    Math.round((l3 + (u3 - l3) * factor) * 10) / 10,
    Math.round((l50 + (u50 - l50) * factor) * 10) / 10,
    Math.round((l97 + (u97 - l97) * factor) * 10) / 10,
  ];
}

export function assessChildGrowth(
  metric: GrowthMetric,
  value: number,
  ageMonths: number,
  gender: ChildGender = 'boy',
): GrowthAssessment {
  const gKey = gender === 'girl' ? 'girl' : 'boy';
  const mKey = metric === 'weightKg' ? 'weight' : metric === 'heightCm' ? 'height' : 'head';
  const [p3, p50, p97] = interpolateWho(whoData[gKey][mKey], ageMonths);

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

  return { status, percentileBand, p3, p50, p97, summary };
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
