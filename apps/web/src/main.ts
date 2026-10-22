import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import './styles/index.css';

createApp(App).use(router).mount('#app');

if (import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext) {
  void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
    // Offline support is progressive enhancement and must never block app startup.
  });
}
