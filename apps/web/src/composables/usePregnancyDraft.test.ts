import { mount } from '@vue/test-utils';
import { defineComponent, shallowRef } from 'vue';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { usePregnancyDraft } from './usePregnancyDraft';
import type { PregnancyRecord } from '@/domain/family';

vi.mock('vue-router', () => ({ useRouter: () => ({ beforeEach: () => () => {} }) }));
const state = vi.hoisted(() => ({ store: {} }));
vi.mock('./useFamily', () => ({ useFamily: () => state.store }));
const wrappers: ReturnType<typeof mount>[] = [];
type Packing = Extract<PregnancyRecord, { type: 'packing' }>;
const original: Packing = {
  id: 'item',
  type: 'packing',
  date: '2026-10-21',
  title: '资料',
  notes: '',
  completed: false,
};
const records = shallowRef<PregnancyRecord[]>([]);
const identity = shallowRef('a');

function setup() {
  let editor!: ReturnType<typeof usePregnancyDraft<Packing, { title: string; completed: boolean }>>;
  const wrapper = mount(
    defineComponent({
      setup() {
        editor = usePregnancyDraft({
          type: 'packing',
          defaults: () => ({ title: '', completed: false }),
          fields: (record: Packing) => ({ title: record.title, completed: record.completed }),
        });

        return () => null;
      },
    }),
  );
  wrappers.push(wrapper);

  return { editor, wrapper };
}

beforeEach(() => {
  sessionStorage.clear();
  records.value = [original];
  identity.value = 'a';
  state.store = {
    data: {
      get value() {
        return { pregnancyRecords: records.value };
      },
    },
    identity,
    cloud: { role: shallowRef('editor') },
  };
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  );
});
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount());
  vi.unstubAllGlobals();
});
it('restores booleans and original edit snapshot while blocking remote overwrites', () => {
  const first = setup();
  first.editor.edit(original);
  first.editor.form.title = '草稿';
  first.editor.form.completed = true;
  first.wrapper.unmount();
  records.value = [{ ...original, title: '远端修改' }];
  const second = setup();
  expect(second.editor.form.title).toBe('草稿');
  expect(second.editor.form.completed).toBe(true);
  expect(second.editor.before.value).toEqual(original);
  expect(second.editor.stale.value).toBe(true);
  second.editor.form.title = '继续填写';
  second.wrapper.unmount();
  expect(setup().editor.stale.value).toBe(true);
});
it('blocks duplicate creates after a lost response and clears saved drafts', () => {
  const first = setup();
  first.editor.form.title = '新物品';
  const id = first.editor.draft.id.value;
  first.wrapper.unmount();
  records.value = [{ ...original, id }];
  const second = setup();
  expect(second.editor.stale.value).toBe(true);
  second.editor.cancel();
  expect(second.editor.stale.value).toBe(false);
  expect(sessionStorage.length).toBe(0);
});
it('protects unsaved input when switching records and resets on identity change', () => {
  const { editor } = setup();
  editor.form.title = '不要丢失';
  vi.mocked(window.confirm).mockReturnValue(false);
  expect(editor.edit(original)).toBe(false);
  expect(editor.form.title).toBe('不要丢失');
  identity.value = 'b';
  expect(editor.form.title).toBe('');
});
it('rejects malformed source snapshots', () => {
  const first = setup();
  first.editor.form.source = '{bad';
  first.wrapper.unmount();
  const second = setup();
  expect(second.editor.stale.value).toBe(true);
  expect(second.editor.before.value).toBeNull();
});
