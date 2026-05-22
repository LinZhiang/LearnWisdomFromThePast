import { createRouter, createWebHistory } from 'vue-router'
import AnswerLogView from '@/views/learning/answer-log/index.vue'
import LearningTypeEditView from '@/views/learning/learning-type-edit/index.vue'
import QuestionBankFavoriteView from '@/views/learning/question-bank-favorite/index.vue'
import QuestionBankScoreView from '@/views/learning/question-bank-score/index.vue'
import WenWuRankView from '@/views/learning/question-bank-score/WenWuRankView.vue'
import QuestionBankView from '@/views/learning/question-bank/index.vue'
import ScoreRankingView from '@/views/learning/score-ranking/index.vue'
import SettingsView from '@/views/settings/index.vue'
import WrongBookView from '@/views/learning/wrong-book/index.vue'
import MindmapViewerView from '@/views/tools/mindmap-viewer/index.vue'

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
      component: LearningTypeEditView,
    },
    {
      path: '/learning/question-bank',
      name: 'question-bank',
      component: QuestionBankView,
    },
    {
      path: '/learning/question-bank-favorite',
      name: 'question-bank-favorite',
      component: QuestionBankFavoriteView,
    },
    {
      path: '/learning/question-bank-score',
      name: 'question-bank-score',
      component: QuestionBankScoreView,
    },
    {
      path: '/learning/wen-wu-rank',
      name: 'wen-wu-rank',
      component: WenWuRankView,
    },
    {
      path: '/learning/score-ranking',
      name: 'score-ranking',
      component: ScoreRankingView,
    },
    {
      path: '/learning/answer-log',
      name: 'answer-log',
      component: AnswerLogView,
    },
    {
      path: '/learning/wrong-book',
      name: 'wrong-book',
      component: WrongBookView,
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsView,
    },
    {
      path: '/tools/mindmap-viewer',
      name: 'mindmap-viewer',
      component: MindmapViewerView,
    },
  ],
})

export default router
