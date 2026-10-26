import { mount } from '@vue/test-utils';
import { defineComponent, reactive, shallowRef } from 'vue';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { clearFormDrafts, useFormDraft } from './useFormDraft';

const router = vi.hoisted(() => ({
  beforeEach: vi.fn<(guard: () => boolean) => () => void>(() => vi.fn()),
}));
vi.mock('vue-router', () => ({ useRouter: () => router }));
const wrappers: ReturnType<typeof mount>[] = [];

function setup(
  scope = shallowRef('local'),
  baseline?: unknown,
  extraFields: Record<string, string> = {},
) {
  const form = reactive<Record<string, string>>({ title: '', amount: '', ...extraFields });
  let draft!: ReturnType<typeof useFormDraft>;
  const wrapper = mount(
    defineComponent({
      setup() {
        draft = useFormDraft({
          form,
          scope: () => scope.value,
          name: 'expense:new',
          baseline,
          optionalFields: Object.keys(extraFields),
        });

        return () => null;
      },
    }),
  );
  wrappers.push(wrapper);

  return { form, draft, wrapper };
}

beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('restores incomplete input and stable record id without submitting it', () => {
  const first = setup();
  first.form.title = '未保存费用';
  first.form.amount = '12.';
  const id = first.draft.id.value;
  first.wrapper.unmount();
  const second = setup();
  expect(second.form).toEqual({ title: '未保存费用', amount: '12.' });
  expect(second.draft.id.value).toBe(id);
  expect(second.draft.restored.value).toBe(true);
  second.form.title = '';
  second.form.amount = '';
  second.draft.accept();
  expect(sessionStorage.length).toBe(0);
  expect(second.draft.dirty.value).toBe(false);
  expect(second.draft.id.value).not.toBe(id);
});

it('旧草稿可补新增可选字段，原有输入与编号保持不变', () => {
  const old = setup();
  old.form.title = '旧计划草稿';
  const id = old.draft.id.value;
  old.wrapper.unmount();
  const { form, draft } = setup(undefined, undefined, { weekdays: '' });
  expect(form.title).toBe('旧计划草稿');
  expect(form.weekdays).toBe('');
  expect(draft.id.value).toBe(id);
  expect(draft.storageError.value).toBe('');
});

it('isolates identities and stops old forms writing after a scope change', () => {
  const scope = shallowRef('user-a:family-a');
  const first = setup(scope);
  first.form.title = 'private';
  expect(setup(shallowRef('user-b:family-b')).form.title).toBe('');
  scope.value = 'user-b:family-b';
  clearFormDrafts();
  first.form.title = 'late response';
  expect(sessionStorage.length).toBe(0);
  expect(first.draft.dirty.value).toBe(false);
});

it('retains stale baseline across repeated restores and further typing', () => {
  const first = setup(undefined, { title: 'old', date: '2026-10-21' });
  first.form.title = 'my edit';
  first.wrapper.unmount();
  const reordered = setup(undefined, { date: '2026-10-21', title: 'old' });
  expect(reordered.draft.changedSource.value).toBe(false);
  reordered.wrapper.unmount();
  const second = setup(undefined, { title: 'changed remotely', date: '2026-10-21' });
  expect(second.draft.changedSource.value).toBe(true);
  second.form.title = 'continued edit';
  second.wrapper.unmount();
  const third = setup(undefined, { title: 'changed remotely', date: '2026-10-21' });
  expect(third.form.title).toBe('continued edit');
  expect(third.draft.changedSource.value).toBe(true);
});

it('requires confirmation to discard and guards navigation and browser unload', () => {
  const { form, draft, wrapper } = setup();
  const confirm = vi.fn(() => false);
  vi.stubGlobal('confirm', confirm);
  form.title = 'draft';
  const guard = router.beforeEach.mock.calls[0]![0] as unknown as () => boolean;
  expect(guard()).toBe(false);
  expect(draft.confirmDiscard()).toBe(false);
  expect(form.title).toBe('draft');
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  confirm.mockReturnValue(true);
  expect(guard()).toBe(true);
  expect(draft.confirmDiscard()).toBe(true);
  expect(form.title).toBe('');
  expect(sessionStorage.length).toBe(0);
  wrapper.unmount();
  const after = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(after);
  expect(after.defaultPrevented).toBe(false);
});

it('uses the latest source baseline after accepting a saved form', () => {
  const baseline = shallowRef({ revision: 1 });
  const first = setup(undefined, () => baseline.value);
  first.form.title = 'saved';
  baseline.value = { revision: 2 };
  first.draft.accept();
  first.form.title = 'next edit';
  first.wrapper.unmount();
  const second = setup(undefined, () => baseline.value);
  expect(second.form.title).toBe('next edit');
  expect(second.draft.changedSource.value).toBe(false);
});

it('warns on storage failure without discarding input', () => {
  vi.stubGlobal('sessionStorage', {
    getItem: () => null,
    setItem: () => {
      throw new Error('quota');
    },
  });
  const { form, draft } = setup();
  form.title = 'keep me';
  expect(draft.storageError.value).toContain('暂存失败');
  expect(form.title).toBe('keep me');
  expect(draft.dirty.value).toBe(true);
});

it('rejects malformed drafts and clears only draft storage', () => {
  sessionStorage.setItem('unrelated', 'keep');
  sessionStorage.setItem('24years.draft.v1:["local","expense:new"]', '{bad');
  const { draft, form } = setup();
  expect(form.title).toBe('');
  expect(draft.storageError.value).toContain('无法读取');
  clearFormDrafts();
  expect(sessionStorage.getItem('unrelated')).toBe('keep');
  expect(sessionStorage.length).toBe(1);
});

it('coalesces rapid edits and flushes immediately on beforeunload or accept', () => {
  vi.useFakeTimers();
  const setItem = vi.spyOn(sessionStorage, 'setItem');
  const { form, draft } = setup();
  form.title = 'a';
  form.title = 'ab';
  form.title = 'abc';
  expect(setItem).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(150);
  expect(setItem).toHaveBeenCalledTimes(2);
  expect(
    JSON.parse(sessionStorage.getItem('24years.draft.v1:["local","expense:new"]')!).form.title,
  ).toBe('abc');

  form.title = 'abcd';
  window.dispatchEvent(new Event('beforeunload', { cancelable: true }));
  expect(
    JSON.parse(sessionStorage.getItem('24years.draft.v1:["local","expense:new"]')!).form.title,
  ).toBe('abcd');

  draft.accept();
  form.title = 'first-after-accept';
  expect(
    JSON.parse(sessionStorage.getItem('24years.draft.v1:["local","expense:new"]')!).form.title,
  ).toBe('first-after-accept');

  form.title = 'flushed-on-pagehide';
  window.dispatchEvent(new Event('pagehide'));
  expect(
    JSON.parse(sessionStorage.getItem('24years.draft.v1:["local","expense:new"]')!).form.title,
  ).toBe('flushed-on-pagehide');
  vi.useRealTimers();
});
