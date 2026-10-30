import type { PregnancyRecord } from './family';

export type Contraction = Extract<PregnancyRecord, { type: 'contraction' }>;

export interface ContractionAnalysis {
  completedCount: number;
  avgDurationSeconds: number;
  avgIntervalMinutes: number | null;
  matches511: boolean;
  rule: '5-1-1' | '4-1-1';
  status: 'empty' | 'insufficient' | 'irregular' | 'regular_early' | 'active_labor_511';
  title: string;
  advice: string;
  badge: string;
}

/**
 * Evaluates contraction patterns against the clinical "5-1-1" rule (ACOG guidelines).
 * 5: Contractions are about 5 minutes apart (or closer) from the start of one to the next.
 * 1: Each contraction lasts for approximately 1 minute (>= 45-60 seconds).
 * 1: This pattern has consistently continued for at least 1 hour (or >= 6 consecutive regular contractions).
 */
export function analyzeContractions(
  records: readonly Contraction[],
  referenceTime = Date.now(),
  options: { multiparous?: boolean } = {},
): ContractionAnalysis {
  const rule = options.multiparous ? '4-1-1' : '5-1-1';
  const intervalLimit = options.multiparous ? 4.5 : 5.5;
  const completed = records
    .filter((item): item is Contraction & { endedAt: number } => item.endedAt !== null)
    .sort((a, b) => b.startedAt - a.startedAt);

  if (completed.length === 0) {
    return {
      completedCount: 0,
      avgDurationSeconds: 0,
      avgIntervalMinutes: null,
      matches511: false,
      rule,
      status: 'empty',
      badge: '待记录',
      title: '日常观察',
      advice: '记录宫缩可帮助辨别真假临产。开始出现腹痛发紧时点击计时。',
    };
  }

  // Filter to contractions occurring within the past 3 hours to evaluate active pattern
  const recentWindowMs = 3 * 60 * 60 * 1000;
  const recent = completed.filter((item) => referenceTime - item.startedAt <= recentWindowMs);
  const pool = recent.length >= 2 ? recent : completed.slice(0, 10);

  if (pool.length < 3) {
    const single = pool[0]!;
    const durSec = Math.max(0, Math.round((single.endedAt - single.startedAt) / 1000));

    return {
      completedCount: completed.length,
      avgDurationSeconds: durSec,
      avgIntervalMinutes: null,
      matches511: false,
      rule,
      status: 'insufficient',
      badge: '数据收集中',
      title: '继续记录中',
      advice: '已记录最近宫缩；连续记录 3 次以上将自动分析规律趋势与临产特征。',
    };
  }

  // Calculate durations
  const durationsSec = pool.map((item) =>
    Math.max(0, Math.round((item.endedAt - item.startedAt) / 1000)),
  );
  const avgDuration = Math.round(durationsSec.reduce((acc, d) => acc + d, 0) / durationsSec.length);

  // Calculate intervals between consecutive start times
  const intervalsMin: number[] = [];
  for (let i = 0; i < pool.length - 1; i++) {
    const intervalMs = pool[i]!.startedAt - pool[i + 1]!.startedAt;

    if (intervalMs > 0 && intervalMs <= 45 * 60 * 1000) {
      intervalsMin.push(intervalMs / 60000);
    }
  }

  const avgInterval =
    intervalsMin.length > 0
      ? Number((intervalsMin.reduce((acc, v) => acc + v, 0) / intervalsMin.length).toFixed(1))
      : null;

  // Total span from oldest to newest in the pool
  const oldest = pool[pool.length - 1]!;
  const newest = pool[0]!;
  const spanMinutes = (newest.startedAt - oldest.startedAt) / 60000;

  // ACOG 5-1-1 evaluation:
  // - Average interval is between 2 and 5.5 minutes
  // - Average duration is >= 45 seconds
  // - The pattern has been tracked for at least 40 minutes or has at least 6 consecutive regular contractions
  const isInterval511 = avgInterval !== null && avgInterval <= intervalLimit && avgInterval >= 1.5;
  const isDuration511 = avgDuration >= 45;
  const isSustained = spanMinutes >= 40 || pool.length >= 6;

  if (isInterval511 && isDuration511 && isSustained) {
    return {
      completedCount: completed.length,
      avgDurationSeconds: avgDuration,
      avgIntervalMinutes: avgInterval,
      matches511: true,
      rule,
      status: 'active_labor_511',
      badge: '5-1-1 规律临产',
      title: '已符合 5-1-1 规律临产标准',
      advice:
        '宫缩间隔已达到约 5 分钟或更短、持续约 1 分钟并保持规律。这通常是真正产程启动的信号，建议联系产检医院或带齐待产包与就医证件前往急诊。',
    };
  }

  // Early regular labor: intervals <= 8 mins and duration >= 30 secs
  if (avgInterval !== null && avgInterval <= 8.5 && avgDuration >= 30) {
    return {
      completedCount: completed.length,
      avgDurationSeconds: avgDuration,
      avgIntervalMinutes: avgInterval,
      matches511: false,
      rule,
      status: 'regular_early',
      badge: '出现规律',
      title: '宫缩逐渐规律',
      advice: `当前平均间隔约 ${avgInterval} 分钟，单次持续约 ${avgDuration} 秒。请继续保持记录并核对就医卡与待产包。`,
    };
  }

  return {
    completedCount: completed.length,
    avgDurationSeconds: avgDuration,
    avgIntervalMinutes: avgInterval,
    matches511: false,
    rule,
    status: 'irregular',
    badge: '尚无明显规律',
    title: '不规律宫缩（假临产可能）',
    advice:
      '宫缩间隔或时长尚不固定，常见于假性宫缩（Braxton Hicks）。建议适当饮水、换体位放松休息并继续观察。',
  };
}
