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
const privateCareRecords = shallowRef<PregnancyRecord[]>([]);
const identity = shallowRef('a');

function setupWith<R extends PregnancyRecord, T extends Record<string, string | number | boolean>>(
  options: Parameters<typeof usePregnancyDraft<R, T>>[0],
) {
  let editor!: ReturnType<typeof usePregnancyDraft<R, T>>;
  const wrapper = mount(
    defineComponent({
      setup() {
        editor = usePregnancyDraft(options);

        return () => null;
      },
    }),
  );
  wrappers.push(wrapper);

  return { editor, wrapper };
}

function setup() {
  return setupWith<Packing, { title: string; completed: boolean }>({
    type: 'packing',
    defaults: () => ({ title: '', completed: false }),
    fields: (record: Packing) => ({ title: record.title, completed: record.completed }),
  });
}

beforeEach(() => {
  sessionStorage.clear();
  records.value = [original];
  privateCareRecords.value = [];
  identity.value = 'a';
  state.store = {
    data: {
      get value() {
        return { pregnancyRecords: records.value };
      },
    },
    privateCareRecords,
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
it('treats identical records with different property ordering as fresh', () => {
  const first = setup();
  first.editor.edit(original);
  first.editor.form.title = '修改后';
  first.wrapper.unmount();
  records.value = [
    {
      completed: original.completed,
      notes: original.notes,
      title: original.title,
      date: original.date,
      type: original.type,
      id: original.id,
    },
  ];
  const second = setup();
  expect(second.editor.stale.value).toBe(false);
});

it('keeps private care records fresh during editing and marks stale only when modified', () => {
  type Mood = Extract<PregnancyRecord, { type: 'mood' }>;
  const privateMood: Mood = {
    id: 'private-mood-1',
    type: 'mood',
    date: '2026-10-21',
    title: '平静',
    notes: '仅保存在本机',
    visibility: 'private',
  };
  records.value = [];
  privateCareRecords.value = [privateMood];

  const { editor: moodEditor } = setupWith<Mood, { notes: string }>({
    type: 'mood',
    defaults: () => ({ notes: '' }),
    fields: (record: Mood) => ({ notes: record.notes }),
  });

  moodEditor.edit(privateMood);
  expect(moodEditor.stale.value).toBe(false);

  privateCareRecords.value = [{ ...privateMood, notes: '已在另一标签页更新' }];
  expect(moodEditor.stale.value).toBe(true);
});
