import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import {
  deepseekChatConversation,
  type DeepSeekChatTurn,
} from '@/services/deepseek'
import { rememberAiResponse } from '@/utils/aiResponseCache'
import { sanitizeAssistantReplyForDisplay } from '@/utils/deepseekReplySanitize'

export type DeepSeekDisplayTurn = DeepSeekChatTurn & {
  /** 展示用标签，如「回答」「你的追问」 */
  label?: string
}

export function useDeepseekConversation(options: {
  resetKey: ComputedRef<string> | Ref<string>
}) {
  /** 发给 API 的完整对话（含内部 prompt） */
  const apiHistory = ref<DeepSeekChatTurn[]>([])
  /** 面板展示：学员可见的提问 + AI 最终回答 */
  const displayTurns = ref<DeepSeekDisplayTurn[]>([])
  const systemPrompt = ref('')
  const loading = ref(false)
  const error = ref('')

  const hasStarted = computed(() => apiHistory.value.length > 0)

  const lastAssistantText = computed(() => {
    for (let i = displayTurns.value.length - 1; i >= 0; i--) {
      const t = displayTurns.value[i]
      if (t?.role === 'assistant') return t.content
    }
    return ''
  })

  function reset() {
    apiHistory.value = []
    displayTurns.value = []
    systemPrompt.value = ''
    error.value = ''
  }

  watch(
    () => options.resetKey.value,
    () => reset(),
  )

  function assistantPair(rawAssistant: string): { api: string; display: string } {
    const api = rawAssistant.trim()
    const display = sanitizeAssistantReplyForDisplay(rawAssistant)
    if (!api) throw new Error('智能服务未返回有效内容')
    if (!display) throw new Error('智能服务未返回可展示的回答')
    return { api, display }
  }

  async function start(input: {
    /** 发给模型的首条 user（可含题目材料等上下文） */
    initialUser: string
    /** 面板展示的首条提问；省略则首屏只展示 AI 回答（如一键「解答」按钮） */
    displayUser?: string
    system: string
    cacheKey?: string | null
    fetch: () => Promise<string>
    displayUserLabel?: string
    displayAssistantLabel?: string
  }) {
    error.value = ''
    loading.value = true
    try {
      systemPrompt.value = input.system
      const raw = input.cacheKey
        ? await rememberAiResponse(input.cacheKey, input.fetch)
        : await input.fetch()
      const { api, display } = assistantPair(raw)

      apiHistory.value = [
        { role: 'user', content: input.initialUser },
        { role: 'assistant', content: api },
      ]

      const assistantTurn: DeepSeekDisplayTurn = {
        role: 'assistant',
        content: display,
        label: input.displayAssistantLabel ?? '回答',
      }
      const displayUser = input.displayUser?.trim()
      displayTurns.value = displayUser
        ? [
            {
              role: 'user',
              content: displayUser,
              label: input.displayUserLabel ?? '你的提问',
            },
            assistantTurn,
          ]
        : [assistantTurn]
    } catch (e) {
      const msg = e instanceof Error ? e.message : '请求失败'
      error.value = msg
      throw e
    } finally {
      loading.value = false
    }
  }

  async function followup(userMessage: string, labels?: { user?: string; assistant?: string }) {
    const trimmed = userMessage.trim()
    if (!trimmed) throw new Error('请输入追问内容')
    if (!hasStarted.value) throw new Error('请先发起首次提问')

    error.value = ''
    loading.value = true
    const prior = apiHistory.value.slice()
    try {
      const raw = await deepseekChatConversation({
        system: systemPrompt.value,
        history: prior,
        userMessage: trimmed,
      })
      const { api, display } = assistantPair(raw)

      apiHistory.value = [
        ...prior,
        { role: 'user', content: trimmed },
        { role: 'assistant', content: api },
      ]
      displayTurns.value = [
        ...displayTurns.value,
        { role: 'user', content: trimmed, label: labels?.user ?? '你的追问' },
        { role: 'assistant', content: display, label: labels?.assistant ?? '回答' },
      ]
      return display
    } catch (e) {
      const msg = e instanceof Error ? e.message : '请求失败'
      error.value = msg
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    apiHistory,
    loading,
    error,
    hasStarted,
    lastAssistantText,
    displayTurns,
    reset,
    start,
    followup,
  }
}
