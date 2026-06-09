export interface LearningMenuItem {
  key: string
  title: string
  path: string
}

export interface LearningMenuGroup {
  key: string
  title: string
  children: LearningMenuItem[]
}

/** 顶栏二级菜单分组（A 练题 / B 统计 / C 工具） */
export const learningMenuGroups: LearningMenuGroup[] = [
  {
    key: 'study-practice',
    title: '题库学习',
    children: [
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
        key: 'wrong-book',
        title: '错题本',
        path: '/learning/wrong-book',
      },
      {
        key: 'answer-log',
        title: '答题日志',
        path: '/learning/answer-log',
      },
    ],
  },
  {
    key: 'stats-records',
    title: '成绩统计',
    children: [
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
    ],
  },
  {
    key: 'study-tools',
    title: '学习工具',
    children: [
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
      {
        key: 'markdown-preview',
        title: 'Markdown预览',
        path: '/tools/markdown-preview',
      },
      {
        key: 'mental-math',
        title: '口算练习',
        path: '/tools/mental-math',
      },
    ],
  },
]

/** 网页操作说明：顶栏一级入口 */
export const guideMenuItem: LearningMenuItem = {
  key: 'app-guide',
  title: '操作说明',
  path: '/guide',
}

/** 设置保持一级入口，不单独做二级菜单 */
export const settingsMenuItem: LearningMenuItem = {
  key: 'app-settings',
  title: '设置',
  path: '/settings',
}

/** 扁平列表，供学习时长统计等逻辑复用 */
export const learningMenuItems: LearningMenuItem[] = [
  ...learningMenuGroups.flatMap((g) => g.children),
  guideMenuItem,
  settingsMenuItem,
]
