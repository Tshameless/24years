import { mount } from '@vue/test-utils';
import { afterEach, expect, it, vi } from 'vitest';
import MovementTimer from './MovementTimer.vue';

afterEach(() => vi.unstubAllGlobals());

it('invalidates pending audio on draft changes and ignores its late rejection', async () => {
  let reject!: (error: Error) => void;
  const close = vi.fn(async () => {});
  vi.stubGlobal(
    'AudioContext',
    class {
      state = 'running';
      close = close;
      resume = () =>
        new Promise<void>((_resolve, fail) => {
          reject = fail;
        });
    },
  );
  const wrapper = mount(MovementTimer, {
    props: {
      running: false,
      remaining: 0,
      dueKey: '',
      disabled: false,
      quiet: false,
      scope: 'a',
      invalid: false,
    },
  });
  const button = () => wrapper.findAll('button').find((node) => node.text().includes('提示音'))!;
  await button().trigger('click');
  expect(button().attributes('disabled')).toBeDefined();
  await wrapper.setProps({ scope: 'b' });
  expect(close).toHaveBeenCalledTimes(1);
  reject(new Error('old draft'));
  await Promise.resolve();
  expect(wrapper.text()).not.toContain('无法启用提示音');
  expect(button().attributes('disabled')).toBeUndefined();
  await wrapper.setProps({ quiet: true, dueKey: 'expired' });
  expect(button().attributes('disabled')).toBeDefined();
  expect(wrapper.text()).toContain('观察计时已结束');
  wrapper.unmount();
});

it('keeps an inline result when audio is unsupported', async () => {
  vi.stubGlobal('AudioContext', undefined);
  const wrapper = mount(MovementTimer, {
    props: {
      running: false,
      remaining: 0,
      dueKey: 'expired',
      disabled: false,
      quiet: false,
      scope: 'a',
      invalid: false,
    },
  });
  await wrapper
    .findAll('button')
    .find((node) => node.text().includes('提示音'))!
    .trigger('click');
  expect(wrapper.text()).toContain('无法启用提示音');
  expect(wrapper.get('[role="alert"]').text()).toContain('观察计时已结束');
  wrapper.unmount();
});
