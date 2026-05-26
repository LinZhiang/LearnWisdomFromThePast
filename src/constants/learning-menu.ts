export interface LearningMenuItem {
  key: string
  title: string
  path: string
}

export const learningMenuItems: LearningMenuItem[] = [
  {
    key: 'learning-type-edit',
    title: '学习类型编辑',
    path: '/learning/type-edit',
  },
  {
    key: 'question-bank',
    title: '学习题库',
    path: '/learning/question-bank',
  },
  {
    key: 'question-bank-favorite',
    title: '题库收藏',
    path: '/learning/question-bank-favorite',
  },
  {
    key: 'question-bank-score',
    title: '学习分数',
    path: '/learning/question-bank-score',
  },
  {
    key: 'money-spend',
    title: '金钱消费',
    path: '/learning/money-spend',
  },
  {
    key: 'score-ranking',
    title: '分数排名',
    path: '/learning/score-ranking',
  },
  {
    key: 'answer-log',
    title: '答题日志',
    path: '/learning/answer-log',
  },
  {
    key: 'wrong-book',
    title: '错题本',
    path: '/learning/wrong-book',
  },
  {
    key: 'app-settings',
    title: '设置',
    path: '/settings',
  },
  {
    key: 'mindmap-viewer',
    title: '思维导图',
    path: '/tools/mindmap-viewer',
  },
  {
    key: 'material-organize',
    title: '资料整理',
    path: '/tools/material-organize',
  },
]
