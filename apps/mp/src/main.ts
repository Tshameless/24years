import { createSSRApp } from 'vue';

import App from './App.vue';
import { installDomainStorage } from './utils/storage';
import { loadFamily } from './store/family';

export function createApp() {
  installDomainStorage();
  loadFamily();

  const app = createSSRApp(App);

  return {
    app,
  };
}
