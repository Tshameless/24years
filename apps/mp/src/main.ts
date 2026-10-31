import { createSSRApp } from 'vue';

import App from './App.vue';
import { installDomainStorage } from './utils/storage';
import { loadFamily, onFamilyChange } from './store/family';
import { bootstrapCollaboration, scheduleCloudPush } from './store/collab';

export function createApp() {
  installDomainStorage();
  loadFamily();

  // 本地存储先就绪（离线可用），再把变更桥接到云同步。
  onFamilyChange(scheduleCloudPush);
  void bootstrapCollaboration();

  const app = createSSRApp(App);

  return {
    app,
  };
}
