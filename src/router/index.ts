import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/learning/type-edit',
    },
    {
      path: '/learning/type-edit',
      name: 'learning-type-edit',
      component: () => import('@/views/learning/learning-type-edit/index.vue'),
    },
    {
      path: '/learning/question-bank',
      name: 'question-bank',
      component: () => import('@/views/learning/question-bank/index.vue'),
    },
    {
      path: '/learning/question-bank-favorite',
      name: 'question-bank-favorite',
      component: () => import('@/views/learning/question-bank-favorite/index.vue'),
    },
    {
      path: '/learning/question-bank-score',
      name: 'question-bank-score',
      component: () => import('@/views/learning/question-bank-score/index.vue'),
    },
    {
      path: '/learning/money-spend',
      name: 'money-spend',
      component: () => import('@/views/learning/money-spend/index.vue'),
    },
    {
      path: '/learning/wen-wu-rank',
      name: 'wen-wu-rank',
      component: () => import('@/views/learning/question-bank-score/WenWuRankView.vue'),
    },
    {
      path: '/learning/score-ranking',
      name: 'score-ranking',
      component: () => import('@/views/learning/score-ranking/index.vue'),
    },
    {
      path: '/learning/answer-log',
      name: 'answer-log',
      component: () => import('@/views/learning/answer-log/index.vue'),
    },
    {
      path: '/learning/wrong-book',
      name: 'wrong-book',
      component: () => import('@/views/learning/wrong-book/index.vue'),
    },
    {
      path: '/guide',
      name: 'app-guide',
      component: () => import('@/views/guide/index.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/settings/index.vue'),
    },
    {
      path: '/tools/mindmap-viewer',
      name: 'mindmap-viewer',
      component: () => import('@/views/tools/mindmap-viewer/index.vue'),
    },
    {
      path: '/tools/material-organize',
      name: 'material-organize',
      component: () => import('@/views/tools/material-organize/index.vue'),
    },
    {
      path: '/tools/markdown-preview',
      name: 'markdown-preview',
      component: () => import('@/views/tools/markdown-preview/index.vue'),
    },
    {
      path: '/tools/mental-math',
      name: 'mental-math',
      component: () => import('@/views/tools/mental-math/index.vue'),
    },
  ],
})

export default router
