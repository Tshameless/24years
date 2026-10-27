import { addDays, type PregnancyRecord } from './family';

export interface PrenatalScheduleItem {
  week: string;
  title: string;
  guidance: string;
  offsetWeeks: number;
}

// A planning aid only. Dates and examinations must be confirmed with the care team.
export const prenatalSchedule: readonly PrenatalScheduleItem[] = [
  {
    week: '6–8 周',
    title: '首次就诊与建档',
    guidance: '确认宫内孕、胎心胎芽及基础检查；按医院要求准备资料。',
    offsetWeeks: 7,
  },
  {
    week: '11–13+6 周',
    title: 'NT / 早期筛查',
    guidance: '提前向医院确认检查窗口和预约要求。',
    offsetWeeks: 12,
  },
  {
    week: '16–18 周',
    title: '中期筛查沟通',
    guidance: '确认唐筛、无创 DNA 或其他检查安排。',
    offsetWeeks: 17,
  },
  {
    week: '20–24 周',
    title: '系统超声排畸',
    guidance: '确认超声项目、预约时间和报告保存方式。',
    offsetWeeks: 22,
  },
  {
    week: '24–28 周',
    title: '糖耐量与血常规',
    guidance: '向医院确认禁食、采血次数和当天注意事项。',
    offsetWeeks: 26,
  },
  {
    week: '28–34 周',
    title: '孕晚期常规随访',
    guidance: '按医生安排记录体重、血压、宫高腹围及胎儿生长。',
    offsetWeeks: 31,
  },
  {
    week: '36–37 周',
    title: '胎心监护与分娩沟通',
    guidance: '确认 NST、GBS 及入院流程，以医院安排为准。',
    offsetWeeks: 36,
  },
  {
    week: '38–40 周',
    title: '临产前每周随访',
    guidance: '关注医生交代的复诊、胎心和羊水评估安排。',
    offsetWeeks: 39,
  },
];

export function scheduleDate(dueDate: string, offsetWeeks: number) {
  return addDays(dueDate, -((40 - offsetWeeks) * 7));
}

export function hasScheduledCheckup(
  records: readonly PregnancyRecord[],
  item: PrenatalScheduleItem,
) {
  return records.some((record) => record.type === 'checkup' && record.title === item.title);
}
