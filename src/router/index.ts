import { createRouter, createMemoryHistory, createWebHashHistory } from 'vue-router';
import routes from './routes';

const createHistory =
  process.env.SERVER === 'true' || process.env.SERVER === '1'
    ? createMemoryHistory
    : createWebHashHistory;

const router = createRouter({
  scrollBehavior: () => ({ left: 0, top: 0 }),
  routes,
  history: createHistory(process.env.VUE_ROUTER_BASE),
});

export default router;
