import { mount } from '@vue/test-utils';
import { afterEach, expect, it, vi } from 'vitest';
import LedgerReport from './LedgerReport.vue';
import { downloadLedgerCsv } from '@/domain/ledgerReport';
import type { Expense } from '@/domain/family';

vi.mock('@/domain/ledgerReport', () => ({ downloadLedgerCsv: vi.fn() }));
const expenses: Expense[] = [
  {
    id: 'bill',
    date: '2026-10-01',
    title: '费用',
    category: '产检医疗',
    kind: 'expense',
    amountCents: 10010,
    reimbursedCents: 2005,
  },
];
afterEach(() => {
  vi.clearAllMocks();
});

it('空范围禁用导出，取消确认不下载；成功后范围变化清除旧提示', async () => {
  const confirm = vi.fn(() => false);
  vi.stubGlobal('confirm', confirm);
  const wrapper = mount(LedgerReport, { props: { expenses: [], month: '', category: '全部' } });
  expect(wrapper.get('button').attributes('disabled')).toBeDefined();
  await wrapper.setProps({ expenses });
  await wrapper.get('button').trigger('click');
  expect(downloadLedgerCsv).not.toHaveBeenCalled();
  confirm.mockReturnValue(true);
  await wrapper.get('button').trigger('click');
  expect(downloadLedgerCsv).toHaveBeenCalledWith(expenses, '24years-ledger-all-全部.csv');
  expect(wrapper.get('[role="status"]').text()).toContain('已发起');
  await wrapper.setProps({ month: '2026-10' });
  expect(wrapper.find('[role="status"]').exists()).toBe(false);
  wrapper.unmount();
});

it('下载受阻时明确显示错误，不显示成功也不修改记录', async () => {
  vi.stubGlobal('confirm', () => true);
  vi.mocked(downloadLedgerCsv).mockImplementationOnce(() => {
    throw new Error('blocked');
  });
  const original = JSON.stringify(expenses);
  const wrapper = mount(LedgerReport, {
    props: { expenses, month: '2026-10', category: '产检医疗' },
  });
  await wrapper.get('button').trigger('click');
  expect(wrapper.get('[role="alert"]').text()).toContain('无法发起下载');
  expect(wrapper.find('[role="status"]').exists()).toBe(false);
  expect(JSON.stringify(expenses)).toBe(original);
  wrapper.unmount();
});
