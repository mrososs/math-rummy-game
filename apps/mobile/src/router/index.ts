import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: () => import('../views/HomeView.vue') },
  {
    path: '/room/create',
    name: 'create-room',
    component: () => import('../views/CreateRoomView.vue'),
  },
  {
    path: '/room/join',
    name: 'join-room',
    component: () => import('../views/JoinRoomView.vue'),
  },
  {
    path: '/room/lobby',
    name: 'lobby',
    component: () => import('../views/LobbyView.vue'),
  },
  {
    path: '/game',
    name: 'game',
    component: () => import('../views/GameView.vue'),
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../views/SettingsView.vue'),
  },
  {
    path: '/help',
    name: 'help',
    component: () => import('../views/HelpView.vue'),
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});
