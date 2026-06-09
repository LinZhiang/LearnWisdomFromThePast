export type MentalMathMode =
  | 'easy'
  | 'normal'
  | 'hard'
  | 'power-easy'
  | 'power-hard'

export type MentalMathModeCategory = 'arithmetic' | 'power'

/** 答对加时、答错扣时的秒数 */
export const MENTAL_MATH_TIME_CORRECT_BONUS_SEC = 1
export const MENTAL_MATH_TIME_WRONG_PENALTY_SEC = 1

export type MentalMathModeConfig = {
  id: MentalMathMode
  category: MentalMathModeCategory
  label: string
  durationSec: number
  optionCount: number
  correctDelta: number
  wrongDelta: number
  maxScore: number
  desc: string
}

export const MENTAL_MATH_ARITHMETIC_MODES: MentalMathModeConfig[] = [
  {
    id: 'easy',
    category: 'arithmetic',
    label: '简单模式',
    durationSec: 20,
    optionCount: 3,
    correctDelta: 4,
    wrongDelta: -8,
    maxScore: 100,
    desc: '20 秒 · 个位数加减乘除（含负数）· 3 选项 · 对 +4 / 错 -8 · 对 +1 秒 / 错 -1 秒',
  },
  {
    id: 'normal',
    category: 'arithmetic',
    label: '普通模式',
    durationSec: 30,
    optionCount: 4,
    correctDelta: 8,
    wrongDelta: -16,
    maxScore: 100,
    desc: '30 秒 · 个位或十位加减乘除（含负数）· 4 选项 · 对 +8 / 错 -16 · 对 +1 秒 / 错 -1 秒',
  },
  {
    id: 'hard',
    category: 'arithmetic',
    label: '高难模式',
    durationSec: 40,
    optionCount: 4,
    correctDelta: 14,
    wrongDelta: -28,
    maxScore: 100,
    desc: '40 秒 · 十位或百位加减乘除（含负数）· 4 选项 · 对 +14 / 错 -28 · 对 +1 秒 / 错 -1 秒',
  },
]

export const MENTAL_MATH_POWER_MODES: MentalMathModeConfig[] = [
  {
    id: 'power-easy',
    category: 'power',
    label: '简单题',
    durationSec: 25,
    optionCount: 3,
    correctDelta: 4,
    wrongDelta: -8,
    maxScore: 100,
    desc: '25 秒 · 2ⁿ（含 2⁻¹～2⁻³ 与 2⁰～2¹²）· 3 选项 · 对 +4 / 错 -8 · 对 +1 秒 / 错 -1 秒',
  },
  {
    id: 'power-hard',
    category: 'power',
    label: '复杂题',
    durationSec: 35,
    optionCount: 4,
    correctDelta: 8,
    wrongDelta: -16,
    maxScore: 100,
    desc: '35 秒 · 2ⁿ（含 2⁻¹～2⁻⁵ 与 2⁰～2¹⁶）· 4 选项 · 对 +8 / 错 -16 · 对 +1 秒 / 错 -1 秒',
  },
]

/** 四则口算 + 2 的次幂全部模式 */
export const MENTAL_MATH_MODES: MentalMathModeConfig[] = [
  ...MENTAL_MATH_ARITHMETIC_MODES,
  ...MENTAL_MATH_POWER_MODES,
]

export type MentalMathQuestion = {
  id: number
  expression: string
  correctAnswer: number
  options: number[]
  correctIndex: number
}

export type MentalMathAnswerRecord = {
  questionId: number
  expression: string
  correctAnswer: number
  chosenAnswer: number
  chosenIndex: number
  correct: boolean
  scoreAfter: number
  elapsedMs: number
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pickNonZero(min: number, max: number): number {
  let n = randInt(min, max)
  while (n === 0) n = randInt(min, max)
  return n
}

/** 简单：个位数 -9～9 */
function pickEasyOperand(): number {
  return randInt(-9, 9)
}

/** 普通：个位或十位 */
function pickNormalOperand(): number {
  if (Math.random() < 0.5) {
    return randInt(-9, 9)
  }
  return randInt(-99, 99)
}

/** 高难：十位或百位（绝对值至少 10） */
function pickHardOperand(): number {
  const sign = Math.random() < 0.5 ? -1 : 1
  if (Math.random() < 0.55) {
    return sign * randInt(10, 99)
  }
  return sign * randInt(100, 999)
}

function pickOperands(mode: MentalMathMode): [number, number] {
  if (mode === 'easy') {
    return [pickEasyOperand(), pickEasyOperand()]
  }
  if (mode === 'normal') {
    return [pickNormalOperand(), pickNormalOperand()]
  }
  return [pickHardOperand(), pickHardOperand()]
}

type BuiltQuestion = {
  expression: string
  answer: number
  hasNegativeInCalculation: boolean
}

function hasNegativeInValues(...values: number[]): boolean {
  return values.some((v) => v < 0)
}

function buildAdd(a: number, b: number): BuiltQuestion {
  const answer = a + b
  return {
    expression: `${a} + ${b} = ?`,
    answer,
    hasNegativeInCalculation: hasNegativeInValues(a, b, answer),
  }
}

function buildSub(a: number, b: number): BuiltQuestion {
  const answer = a - b
  return {
    expression: `${a} − ${b} = ?`,
    answer,
    hasNegativeInCalculation: hasNegativeInValues(a, b, answer),
  }
}

function buildMul(a: number, b: number): BuiltQuestion {
  const answer = a * b
  return {
    expression: `${a} × ${b} = ?`,
    answer,
    hasNegativeInCalculation: hasNegativeInValues(a, b, answer),
  }
}

function buildDiv(mode: MentalMathMode): BuiltQuestion | null {
  let divisor = 0
  let quotient = 0
  let dividend = 0
  for (let i = 0; i < 24; i++) {
    if (mode === 'easy') {
      divisor = pickNonZero(-9, 9)
      quotient = pickNonZero(-9, 9)
    } else if (mode === 'normal') {
      divisor = pickNonZero(-99, 99)
      quotient = pickNonZero(-99, 99)
    } else {
      divisor = pickNonZero(-99, 99)
      quotient = pickNonZero(-99, 99)
    }
    dividend = divisor * quotient
    if (mode === 'easy' && Math.abs(dividend) > 99) continue
    if (mode === 'normal' && Math.abs(dividend) > 9999) continue
    if (mode === 'hard' && Math.abs(dividend) > 999999) continue
    break
  }
  if (divisor === 0) return null
  return {
    expression: `${dividend} ÷ ${divisor} = ?`,
    answer: quotient,
    hasNegativeInCalculation: hasNegativeInValues(dividend, divisor, quotient),
  }
}

function buildRandomQuestion(mode: MentalMathMode): BuiltQuestion {
  const ops = ['+', '-', '*', '/']
  const op = ops[randInt(0, ops.length - 1)]!
  if (op === '/') {
    const div = buildDiv(mode)
    if (div) return div
  }
  const [a, b] = pickOperands(mode)
  if (op === '+') return buildAdd(a, b)
  if (op === '-') return buildSub(a, b)
  return buildMul(a, b)
}

/** 错误选项与正确答案相差 1～4；运算含负数时混入小正数干扰项 */
function distinctWrongAnswers(
  correct: number,
  count: number,
  hasNegativeInCalculation: boolean,
): number[] {
  const wrong: number[] = []
  const used = new Set<number>([correct])
  const candidates: number[] = []

  for (let delta = 1; delta <= 4; delta++) {
    candidates.push(correct + delta, correct - delta)
  }

  if (hasNegativeInCalculation) {
    for (let p = 1; p <= 9; p++) {
      candidates.push(p)
    }
  }

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = randInt(0, i)
    const tmp = candidates[i]!
    candidates[i] = candidates[j]!
    candidates[j] = tmp
  }

  for (const candidate of candidates) {
    if (wrong.length >= count) break
    if (used.has(candidate)) continue
    used.add(candidate)
    wrong.push(candidate)
  }

  for (let delta = 1; wrong.length < count && delta <= 4; delta++) {
    for (const sign of [-1, 1]) {
      const candidate = correct + sign * delta
      if (used.has(candidate)) continue
      used.add(candidate)
      wrong.push(candidate)
      if (wrong.length >= count) break
    }
  }

  return wrong
}

const POWER_SUPERSCRIPT_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹'
const POWER_SUPERSCRIPT_MINUS = '⁻'

function formatPowerSuperscriptDigits(n: number): string {
  return String(n)
    .split('')
    .map((ch) => POWER_SUPERSCRIPT_DIGITS[Number(ch)] ?? ch)
    .join('')
}

function formatPowerOfTwoExpression(exponent: number): string {
  const expStr =
    exponent < 0
      ? POWER_SUPERSCRIPT_MINUS + formatPowerSuperscriptDigits(-exponent)
      : formatPowerSuperscriptDigits(exponent)
  return `2${expStr} = ?`
}

/** 错误选项为相邻次幂的 2^n，差距不超过 ±2（复杂题 ±3） */
function distinctPowerWrongExponents(
  exponent: number,
  count: number,
  minExp: number,
  maxExp: number,
  maxNeighbor: number,
): number[] {
  const wrong: number[] = []
  const used = new Set<number>([exponent])
  const candidates: number[] = []

  for (let delta = 1; delta <= maxNeighbor; delta++) {
    if (exponent - delta >= minExp) candidates.push(exponent - delta)
    if (exponent + delta <= maxExp) candidates.push(exponent + delta)
  }

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = randInt(0, i)
    const tmp = candidates[i]!
    candidates[i] = candidates[j]!
    candidates[j] = tmp
  }

  for (const e of candidates) {
    if (wrong.length >= count) break
    if (used.has(e)) continue
    used.add(e)
    wrong.push(e)
  }

  for (let delta = 1; wrong.length < count && delta <= maxNeighbor; delta++) {
    for (const sign of [-1, 1]) {
      const e = exponent + sign * delta
      if (e < minExp || e > maxExp || used.has(e)) continue
      used.add(e)
      wrong.push(e)
      if (wrong.length >= count) break
    }
  }

  return wrong
}

function generatePowerOfTwoQuestion(
  mode: 'power-easy' | 'power-hard',
  id: number,
  optionCount: number,
): MentalMathQuestion {
  const minExp = mode === 'power-easy' ? -3 : -5
  const maxExp = mode === 'power-easy' ? 12 : 16
  const maxNeighbor = mode === 'power-easy' ? 2 : 3
  const exponent = randInt(minExp, maxExp)
  const correctAnswer = 2 ** exponent
  const wrongExponents = distinctPowerWrongExponents(
    exponent,
    optionCount - 1,
    minExp,
    maxExp,
    maxNeighbor,
  )
  const wrongValues = wrongExponents.map((e) => 2 ** e)
  const options = [...wrongValues, correctAnswer]

  for (let i = options.length - 1; i > 0; i--) {
    const j = randInt(0, i)
    const tmp = options[i]!
    options[i] = options[j]!
    options[j] = tmp
  }

  const correctIndex = options.findIndex((v) => v === correctAnswer)
  return {
    id,
    expression: formatPowerOfTwoExpression(exponent),
    correctAnswer,
    options,
    correctIndex: correctIndex >= 0 ? correctIndex : 0,
  }
}

export function generateMentalMathQuestion(
  mode: MentalMathMode,
  id: number,
  optionCount: number,
): MentalMathQuestion {
  if (mode === 'power-easy' || mode === 'power-hard') {
    return generatePowerOfTwoQuestion(mode, id, optionCount)
  }

  const built = buildRandomQuestion(mode)
  const wrong = distinctWrongAnswers(
    built.answer,
    optionCount - 1,
    built.hasNegativeInCalculation,
  )
  const options = [...wrong, built.answer]
  for (let i = options.length - 1; i > 0; i--) {
    const j = randInt(0, i)
    const tmp = options[i]!
    options[i] = options[j]!
    options[j] = tmp
  }
  const correctIndex = options.findIndex((v) => v === built.answer)
  return {
    id,
    expression: built.expression,
    correctAnswer: built.answer,
    options,
    correctIndex: correctIndex >= 0 ? correctIndex : 0,
  }
}

export function clampMentalMathScore(score: number, max = 100): number {
  return Math.min(max, Math.max(0, Math.round(score)))
}

export function getMentalMathModeConfig(mode: MentalMathMode): MentalMathModeConfig {
  return MENTAL_MATH_MODES.find((m) => m.id === mode) ?? MENTAL_MATH_MODES[0]!
}
