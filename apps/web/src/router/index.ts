import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: () => import('@/views/LoginView.vue') },
    { path: '/backup', component: () => import('@/views/BackupView.vue') },
    { path: '/pregnancy', component: () => import('@/views/PregnancyView.vue') },
    {
      path: '/',
      name: 'Home',
      component: () => import('@/views/HomeView.vue'),
    },
    {
      path: '/tasks',
      component: () => import('@/views/TasksView.vue'),
    },
    {
      path: '/ledger',
      component: () => import('@/views/LedgerView.vue'),
    },
    {
      path: '/family',
      component: () => import('@/views/FamilyView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      component: () => import('@/views/NotFoundView.vue'),
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
});

export default router;
