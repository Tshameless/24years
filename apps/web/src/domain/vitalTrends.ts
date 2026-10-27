import { type PregnancyRecord } from './family';

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
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.time ?? '').localeCompare(b.time ?? '') ||
        a.id.localeCompare(b.id),
    );
}

export interface VitalAssessment {
  metric: Vital['metric'];
  level: 'normal' | 'attention' | 'warning';
  badge: string;
  tip: string;
}

export function assessVital(
  metric: Vital['metric'],
  value: number,
  secondary: number | null,
  context = '',
  options?: { postpartum?: boolean },
): VitalAssessment {
  const isPostpartum = !!options?.postpartum;

  if (metric === 'bloodPressure') {
    const systolic = value;
    const diastolic = secondary ?? 0;

    if (systolic >= 140 || diastolic >= 90) {
      return {
        metric,
        level: 'warning',
        badge: '高压警戒',
        tip: isPostpartum
          ? '收缩压 ≥ 140 或舒张压 ≥ 90 mmHg。产后血压持续偏高需关注产后高血压风险，建议静坐休息 15 分钟后复测，持续偏高请及时就医。'
          : '收缩压 ≥ 140 或舒张压 ≥ 90 mmHg。提示妊娠期高血压或子痫前期风险，建议静坐休息 15 分钟后复测，持续偏高请立即就医。',
      };
    }

    if (systolic >= 130 || diastolic >= 85) {
      return {
        metric,
        level: 'attention',
        badge: '临界偏高',
        tip: '血压接近高限（130-139 / 85-89 mmHg），建议保持规律作息并定期复查。',
      };
    }

    return {
      metric,
      level: 'normal',
      badge: '标准区间',
      tip: isPostpartum
        ? '血压处于产后常规推荐区间（< 130/85 mmHg）。'
        : '血压处于孕期常规推荐区间（< 130/85 mmHg）。',
    };
  }

  if (metric === 'glucose') {
    const isFasting = context.includes('空腹');
    const isPostMeal = context.includes('餐后');
    const fastingLimit = isPostpartum ? 6.1 : 5.1;
    const postMealLimit = isPostpartum ? 7.8 : 8.5;

    if (isFasting && value >= fastingLimit) {
      return {
        metric,
        level: 'warning',
        badge: '空腹偏高',
        tip: isPostpartum
          ? '产后空腹血糖常规参考应 < 6.1 mmol/L，建议按出院医嘱随访复查。'
          : '孕期空腹血糖基准参考应 < 5.1 mmol/L，偏高提示糖耐量异常筛查风险。',
      };
    }

    if (isPostMeal && value >= postMealLimit) {
      return {
        metric,
        level: 'warning',
        badge: '餐后偏高',
        tip: isPostpartum
          ? '产后餐后 2 小时血糖常规参考应 < 7.8 mmol/L，建议关注饮食并按医嘱随访。'
          : '孕妇餐后 2 小时血糖基准参考应 < 8.5 mmol/L，建议咨询医生并优化饮食结构。',
      };
    }

    if (!isFasting && !isPostMeal && value >= postMealLimit) {
      return {
        metric,
        level: 'attention',
        badge: '数值较高',
        tip: isPostpartum
          ? '血糖偏高，建议明确空腹或餐后场景并遵医嘱复查。'
          : '血糖偏高，建议明确空腹或餐后场景并遵产检医嘱。',
      };
    }

    return {
      metric,
      level: 'normal',
      badge: '参考区间',
      tip: isPostpartum ? '处于产后常规控制区间内。' : '处于孕期常见控制区间内。',
    };
  }

  return {
    metric,
    level: 'normal',
    badge: '已记录',
    tip: '建议固定时段监测体重变化。',
  };
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
  const timestamp = (item: Vital) => {
    const [year, month, day] = item.date.split('-').map(Number);
    const [hours, minutes] = (item.time ?? '00:00').split(':').map(Number);

    return Date.UTC(year, month - 1, day, hours, minutes);
  };
  const first = records[0]!;
  const firstTimestamp = timestamp(first);
  const lastTimestamp = timestamp(records[records.length - 1]!);
  const span = lastTimestamp - firstTimestamp;
  const x = (item: Vital) =>
    span === 0 ? 300 : 55 + ((timestamp(item) - firstTimestamp) / span) * 490;
  const y = (value: number) => 160 - ((value - low) / (high - low)) * 130;

  return {
    low,
    high,
    points: records.map((item) => ({
      id: item.id,
      date: item.date,
      time: item.time,
      value: item.value,
      secondary: item.secondary,
      x: x(item),
      y: y(item.value),
      y2: item.secondary === null ? null : y(item.secondary),
    })),
  };
}
