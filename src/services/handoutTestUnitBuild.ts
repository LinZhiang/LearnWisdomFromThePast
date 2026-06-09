import type { QuestionBank } from '@/db/models'
import {
  questionBankExpandsToGeneralInTest,
  questionBankExpandsToJudgmentInTest,
  questionBankExpandsToMcqInTest,
} from '@/constants/question-bank-types'
import type { QuestionBankTestBuildConfig } from '@/views/learning/question-bank/components/questionBankTestTypes'
import type { TestUnit } from '@/views/learning/question-bank/components/questionBankTestTypes'
import {
  fetchHandoutDerivedGeneralResilient,
  fetchHandoutDerivedJudgmentResilient,
  fetchQuizDerivedMcqsResilient,
  prepareQuizMcqUnits,
  type PreparedQuizMcq,
} from '@/services/questionBankTestAiPrep'
import {
  getHandoutGeneralCount,
  getHandoutJudgmentCount,
  getHandoutMcqCount,
} from '@/utils/handoutQuestion'
import {
  handoutGeneralUnitScore,
  handoutJudgmentOptions,
} from '@/utils/handoutTestUnit'

type HandoutBuildConfig = Pick<
  QuestionBankTestBuildConfig,
  'includeChoiceLike' | 'includeGeneral' | 'includeJudgment'
>

type HandoutBuildDeps = {
  onStage?: (message: string) => void
  fetchMcqAvoidHint: () => Promise<string>
  fetchGeneralAvoidHint: () => Promise<string>
  fetchJudgmentAvoidHint: () => Promise<string>
}

async function fetchHandoutMcqPreparedStrict(
  q: QuestionBank,
  fetchAvoidHint: () => Promise<string>,
): Promise<PreparedQuizMcq[]> {
  const limit = getHandoutMcqCount(q)
  if (limit <= 0) return []

  const avoidHint = await fetchAvoidHint()
  let mcqs = await fetchQuizDerivedMcqsResilient(q, avoidHint)
  let prepared = prepareQuizMcqUnits(mcqs)
  if (prepared.length < limit && avoidHint.trim()) {
    mcqs = await fetchQuizDerivedMcqsResilient(q, '')
    prepared = prepareQuizMcqUnits(mcqs)
  }
  if (prepared.length < limit) {
    throw new Error(`「${q.title}」选择题仅生成 ${prepared.length}/${limit} 道，请稍后重试`)
  }
  return prepared.slice(0, limit)
}

/** 按讲义配置一次性展开全部测验小题（选择 + 计算 + 判断），不足目标数则抛错 */
export async function buildHandoutTestUnits(
  q: QuestionBank,
  config: HandoutBuildConfig,
  deps: HandoutBuildDeps,
): Promise<TestUnit[]> {
  if ((q.type ?? 'general') !== 'handout' || q.id == null) return []

  const units: TestUnit[] = []
  const title = q.title.trim() || '讲义'

  if (questionBankExpandsToMcqInTest(q) && config.includeChoiceLike) {
    deps.onStage?.(`正在从「${title}」讲义生成选择题…`)
    const prepared = await fetchHandoutMcqPreparedStrict(q, deps.fetchMcqAvoidHint)
    const subTotal = prepared.length
    for (let i = 0; i < prepared.length; i++) {
      const p = prepared[i]!
      units.push({
        kind: 'mindmap-mcq',
        parent: q,
        stem: p.stem,
        options: p.options,
        correctIndices: p.correctIndices,
        mode: p.mode,
        subIndex: i + 1,
        subTotal,
      })
    }
  }

  if (questionBankExpandsToGeneralInTest(q) && config.includeGeneral) {
    const expected = getHandoutGeneralCount(q)
    if (expected > 0) {
      deps.onStage?.(`正在从「${title}」讲义生成计算题…`)
      const avoidHint = await deps.fetchGeneralAvoidHint()
      const raw = await fetchHandoutDerivedGeneralResilient(q, avoidHint)
      if (raw.length < expected) {
        throw new Error(`「${title}」计算题仅生成 ${raw.length}/${expected} 道，请稍后重试`)
      }
      const subTotal = raw.length
      for (let i = 0; i < raw.length; i++) {
        const item = raw[i]!
        units.push({
          kind: 'handout-general',
          parent: q,
          stem: item.stem,
          referenceAnswer: item.referenceAnswer,
          analysis: item.analysis,
          knowledgePoint: item.knowledgePoint,
          score: handoutGeneralUnitScore(),
          subIndex: i + 1,
          subTotal,
        })
      }
    }
  }

  if (questionBankExpandsToJudgmentInTest(q) && config.includeJudgment) {
    const expected = getHandoutJudgmentCount(q)
    if (expected > 0) {
      deps.onStage?.(`正在从「${title}」讲义生成判断题…`)
      const avoidHint = await deps.fetchJudgmentAvoidHint()
      const raw = await fetchHandoutDerivedJudgmentResilient(q, avoidHint)
      if (raw.length < expected) {
        throw new Error(`「${title}」判断题仅生成 ${raw.length}/${expected} 道，请稍后重试`)
      }
      const options = handoutJudgmentOptions()
      const subTotal = raw.length
      for (let i = 0; i < raw.length; i++) {
        const item = raw[i]!
        units.push({
          kind: 'handout-judgment',
          parent: q,
          stem: item.stem,
          options,
          correctIndices: item.answer ? [0] : [1],
          mode: 'single',
          analysis: item.analysis,
          knowledgePoint: item.knowledgePoint,
          subIndex: i + 1,
          subTotal,
        })
      }
    }
  }

  return units
}
