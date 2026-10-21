import { taskIsDue, type FamilyTask } from './family';

export const responsibilityLabels = { mother: '母亲', father: '父亲', single_parent: '本人' };

export const taskTemplates = [
  { title: '整理下次就诊的问题', repeat: 'once', time: '19:00' },
  { title: '一起聊聊今天的感受', repeat: 'daily', time: '20:00' },
  { title: '核对待产物品', repeat: 'weekly', time: '19:00' },
  { title: '确认就医路线与交通安排', repeat: 'once', time: '18:00' },
] as const;

export function dueReminders(
  tasks: readonly (Omit<FamilyTask, 'completedDates'> & {
    readonly completedDates: readonly string[];
  })[],
  date: string,
  time: string,
  quiet: boolean,
  role?: string,
) {
  if (quiet || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    return [];
  }

  return tasks
    .filter(
      (task) =>
        taskIsDue(task, date) &&
        task.time <= time &&
        !task.completedDates.includes(date) &&
        (!task.assignee || task.assignee === role),
    )
    .sort((a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id));
}
