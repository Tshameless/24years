import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import Uni from '@uni-helper/plugin-uni';

export default defineConfig({
  resolve: {
    alias: {
      // 共享领域层是 workspace 源码包，直接指向真实路径，避免小程序编译时把
      // symlink 当成未编译的 node_modules 依赖。
      '@24years/domain': fileURLToPath(new URL('../../packages/domain/src', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    // https://uni-helper.js.org/plugin-uni
    Uni(),
  ],
});
