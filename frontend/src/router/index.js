import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import CraftView from '../views/CraftView.vue'
import ERDView from '../views/ERDView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: {
        title: 'DataCraft - Database Connection'
      }
    },
    {
      path: '/query',
      name: 'query',
      component: CraftView,
      meta: {
        title: 'DataCraft - Crafting Query'
      }
    },
    {
      path: '/erd',
      name: 'erd',
      component: ERDView,
      meta: {
        title: 'DataCraft - Crafting ERD'
      }
    }
  ]
})

router.beforeEach((to, from, next) => {
  document.title = to.meta.title || 'DataCraft'
  next()
})

export default router
