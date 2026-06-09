<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import {
  HANDOUT_FONT_SIZE_MAX,
  HANDOUT_FONT_SIZE_MIN,
  useAppearanceStore,
} from '@/stores/appearance'
import { APP_BANK_PACK_FILE_PREFIX, APP_CACHE_FILE_PREFIX } from '@/constants/branding'
import {
  exportCacheSnapshot,
  importCacheSnapshot,
  previewCacheSnapshot,
} from '@/services/cache-backup'
import {
  exportQuestionBankPack,
  mergeQuestionBankPack,
  previewQuestionBankPack,
} from '@/services/question-bank-pack'
import {
  BACKGROUND_IMAGE_SET_FEE,
  isBackgroundImageRemoval,
  settleBackgroundImageSetFee,
} from '@/services/background-image-billing'
import { fileToStorableBackgroundDataUrl, isLikelyImageFile } from '@/utils/backgroundImageUpload'
import { isDataUrlBackground } from '@/utils/backgroundImageFit'
import BackgroundImageFitEditor from './components/BackgroundImageFitEditor.vue'
import BackgroundMusicSection from './components/BackgroundMusicSection.vue'

const appearanceStore = useAppearanceStore()
const {
  backgroundColor,
  backgroundOpacity,
  backgroundImage,
  backgroundImageFit,
  chromeOpacity,
  themeStyle,
  handoutFontSizePx,
} = storeToRefs(appearanceStore)

const showBackgroundFitEditor = computed(() =>
  isDataUrlBackground(backgroundImage.value.trim()),
)

onMounted(() => {
  bgUploadBusy.value = false
  const img = backgroundImage.value.trim()
  if (isDataUrlBackground(img) && !backgroundImageFit.value) {
    window.setTimeout(() => {
      void appearanceStore.initBackgroundImageFitFromUrl(img)
    }, 0)
  }
})
const uploadMessage = ref('')
const bankPackMessage = ref('')
const bgUploadBusy = ref(false)
const bgFileInputRef = ref<HTMLInputElement | null>(null)
const cacheUploadRef = ref<HTMLInputElement | null>(null)
const bankPackUploadRef = ref<HTMLInputElement | null>(null)

const triggerBackgroundFilePick = () => {
  if (bgUploadBusy.value) {
    uploadMessage.value = '正在处理上一张图片，请稍候…'
    return
  }
  uploadMessage.value = ''
  bgFileInputRef.value?.click()
}

const triggerCacheUpload = () => {
  bankPackMessage.value = ''
  cacheUploadRef.value?.click()
}

const triggerBankPackUpload = () => {
  uploadMessage.value = ''
  bankPackUploadRef.value?.click()
}
const opacityPercent = computed(() => Math.round(backgroundOpacity.value * 100))
const chromeOpacityPercent = computed(() => Math.round(chromeOpacity.value * 100))

const handoutFontPresets = [14, 16, 18, 20, 24] as const

const onThemeStyleChange = (v: string) => {
  if (v === 'light' || v === 'dark' || v === 'soft') {
    appearanceStore.updateThemeStyle(v)
  }
}

const applyBackgroundImageWithBilling = (next: string): boolean => {
  const prev = backgroundImage.value
  if (!appearanceStore.updateBackgroundImage(next)) {
    uploadMessage.value =
      '保存失败：地址或内容过长，超出浏览器本地存储上限。请改用「上传本地背景图」自动压缩，或使用较短的网络图片 URL。'
    return false
  }
  const charge = settleBackgroundImageSetFee(prev, next)
  if (!charge.ok) {
    appearanceStore.updateBackgroundImage(prev)
    uploadMessage.value = charge.message
    return false
  }
  if (charge.charged) {
    uploadMessage.value = `已设置背景图，扣除 ${BACKGROUND_IMAGE_SET_FEE} 元，当前余额 ${charge.balance} 元。`
  } else if (!isBackgroundImageRemoval(next)) {
    uploadMessage.value = '已设置背景图（本次未扣费）。'
  } else if (isBackgroundImageRemoval(next)) {
    uploadMessage.value = '已去除背景图（不扣费）。'
  }
  return true
}

const handleBackgroundImageChange = (event: Event) => {
  const value = (event.target as HTMLInputElement).value
  applyBackgroundImageWithBilling(value)
}

/** 多档压缩 + 重试写入，避免大图 Base64 撑爆 localStorage */
const tryCompressAndSaveBackground = async (file: File): Promise<'ok' | 'storage_fail' | 'billing_fail'> => {
  const prev = backgroundImage.value
  const steps = [
    { maxEdge: 1920, q: 0.84 },
    { maxEdge: 1600, q: 0.78 },
    { maxEdge: 1280, q: 0.74 },
    { maxEdge: 960, q: 0.7 },
    { maxEdge: 720, q: 0.66 },
    { maxEdge: 640, q: 0.62 },
  ]
  for (const { maxEdge, q } of steps) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const dataUrl = await fileToStorableBackgroundDataUrl(file, maxEdge, q)
    if (!appearanceStore.updateBackgroundImage(dataUrl)) continue
    let charge: ReturnType<typeof settleBackgroundImageSetFee>
    try {
      charge = settleBackgroundImageSetFee(prev, dataUrl)
    } catch {
      appearanceStore.updateBackgroundImage(prev)
      uploadMessage.value = '扣费处理异常，已恢复原有背景图，请稍后重试。'
      return 'billing_fail'
    }
    if (!charge.ok) {
      appearanceStore.updateBackgroundImage(prev)
      uploadMessage.value = charge.message
      return 'billing_fail'
    }
    await appearanceStore.initBackgroundImageFitFromUrl(dataUrl)
    await nextTick()
    if (charge.charged) {
      uploadMessage.value = `已保存本地背景图：${file.name}，扣除 ${BACKGROUND_IMAGE_SET_FEE} 元，当前余额 ${charge.balance} 元。可在下方拖动调整位置与缩放。`
    } else {
      uploadMessage.value = `已保存本地背景图：${file.name}（本次未扣费）。可在下方拖动调整位置与缩放。`
    }
    return 'ok'
  }
  return 'storage_fail'
}

const handleBackgroundImageFileChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  if (!isLikelyImageFile(file)) {
    uploadMessage.value =
      '无法识别为图片：请选择常见图片文件（如 jpg、png、webp）。若已选对仍失败，可能是系统未标出文件类型，请确认扩展名正确。'
    return
  }

  bgUploadBusy.value = true
  uploadMessage.value = `正在处理「${file.name}」…`
  await nextTick()
  try {
    const result = await tryCompressAndSaveBackground(file)
    if (result === 'billing_fail') {
      /* 消息已在 tryCompressAndSaveBackground 内设置 */
    } else if (result === 'ok') {
      /* 成功消息已在 tryCompressAndSaveBackground 内设置 */
    } else {
      uploadMessage.value =
        '保存失败：浏览器本地存储空间不足。已自动多档压缩仍无法写入。请换更小的图片、自行裁切后再传，或使用「背景图片 URL」填写网络图片地址。'
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (msg === 'decode') {
      uploadMessage.value =
        '无法解码该图片（浏览器可能不支持此格式，例如部分 HEIC）。请先在系统中转为 JPG 或 PNG 再上传。'
    } else if (msg === 'read') {
      uploadMessage.value = '读取文件失败，请重试或换一张图片。'
    } else {
      uploadMessage.value = '处理图片时出错，请换一张图片重试。'
    }
  } finally {
    bgUploadBusy.value = false
  }
}

const downloadCacheFile = async () => {
  const content = await exportCacheSnapshot()
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${APP_CACHE_FILE_PREFIX}-${Date.now()}.json`
  link.click()
  URL.revokeObjectURL(url)
  uploadMessage.value = '缓存文件已下载。'
}

const uploadCacheFile = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const content = await file.text()
    const preview = previewCacheSnapshot(content)
    const confirmText = [
      '即将覆盖当前本地缓存，是否继续？',
      `导出时间: ${preview.exportedAt || '未知'}`,
      `学习类型: ${preview.counts.learningTypes}`,
      `学习题库: ${preview.counts.questionBanks}`,
      `题库收藏: ${preview.counts.favoriteQuestions}`,
      `学习分数: ${preview.counts.questionScores}`,
      `分数排名: ${preview.counts.scoreRankings}`,
      `答题日志: ${preview.counts.answerLogs}`,
      `学习用时(按日): ${preview.counts.dailyWebUsage}`,
      `工作/出差登记: ${preview.counts.workTimeLogs}`,
      `锻炼时间登记: ${preview.counts.exerciseTimeLogs}`,
    ].join('\n')
    const confirmed = window.confirm(confirmText)
    if (!confirmed) {
      uploadMessage.value = '已取消导入。'
      input.value = ''
      return
    }
    await importCacheSnapshot(content)
    uploadMessage.value = '缓存文件导入成功，页面数据可刷新后查看。'
  } catch {
    uploadMessage.value = '缓存文件导入失败，请检查文件格式。'
  }
  input.value = ''
}

const formatBankPackMergeSummary = (
  result: Awaited<ReturnType<typeof mergeQuestionBankPack>>,
) =>
  [
    `新增学习类型 ${result.learningTypesAdded} 个`,
    `合并已有类型 ${result.learningTypesMerged} 个`,
    `新增题库条目 ${result.questionBanksAdded} 条`,
    `跳过重复条目 ${result.questionBanksSkipped} 条`,
    result.questionBankAiPrepAdded + result.questionBankAiPrepSkipped > 0
      ? `附带测验缓存：新增 ${result.questionBankAiPrepAdded}，跳过 ${result.questionBankAiPrepSkipped}`
      : '',
  ]
    .filter(Boolean)
    .join('；')

const downloadBankPackFile = async () => {
  const content = await exportQuestionBankPack()
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${APP_BANK_PACK_FILE_PREFIX}-${Date.now()}.json`
  link.click()
  URL.revokeObjectURL(url)
  bankPackMessage.value = '题库包已下载（仅含学习类型与题库，不含错题与成绩）。'
}

const uploadBankPackFile = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const content = await file.text()
    const preview = previewQuestionBankPack(content)
    const dryRun = await mergeQuestionBankPack(content, { dryRun: true })
    const confirmText = [
      '将以「合并」方式导入题库，不会覆盖您的错题、收藏、答题日志与分数。',
      `文件来源: ${preview.source === 'pack' ? '题库包' : '完整缓存（仅提取类型与题库）'}`,
      `导出时间: ${preview.exportedAt || '未知'}`,
      `文件中: 学习类型 ${preview.counts.learningTypes} 个，题库 ${preview.counts.questionBanks} 条`,
      '预计结果:',
      formatBankPackMergeSummary(dryRun),
      '',
      '是否继续导入？',
    ].join('\n')
    const confirmed = window.confirm(confirmText)
    if (!confirmed) {
      bankPackMessage.value = '已取消导入。'
      input.value = ''
      return
    }
    const result = await mergeQuestionBankPack(content)
    bankPackMessage.value = `题库包导入完成：${formatBankPackMergeSummary(result)}。请刷新或进入学习题库查看。`
  } catch {
    bankPackMessage.value = '题库包导入失败，请确认文件为有效的题库包或缓存 JSON。'
  }
  input.value = ''
}
</script>

<template>
  <div class="settings-page-root">
  <section class="settings-page settings-page--appearance">
    <header class="page-hero">
      <span class="page-kicker">系统 01</span>
      <h2 class="page-title">界面设置</h2>
      <p class="page-subtitle">
        支持设置背景颜色、背景图片和整体风格，设置会自动保存。上传<strong>本地背景图</strong>后可在取景框内拖动调整位置、用滑条缩放与旋转，并支持水平/垂直翻转与「重置取景」（不另扣费）。新设或更换背景时，余额足够则扣
        <strong>{{ BACKGROUND_IMAGE_SET_FEE }} 元</strong>（不设宵禁与余额门槛；不足时跳过扣费仍可设置；清空 URL 去除背景不扣费）。有背景图时，半透明背景色会叠在图片上方；切换整体风格时会将背景色同步为该风格的推荐色（你可再微调）。深色/柔和下若仍为默认白且透明度
        100%，则视为不叠色以免挡住主题底色。顶栏与内容面板透明度只降低衬底不透明度，文字与正文内图片不受影响；拉得过低时可配合毛玻璃略微提亮可读性。学习内容字号（讲义、题目查看、测验）可在下方单独调节，便于课堂投影。
      </p>
    </header>

    <div class="settings-grid">
      <label class="settings-item">
        <span>背景颜色</span>
        <input
          :value="backgroundColor"
          type="color"
          @input="appearanceStore.updateBackgroundColor(($event.target as HTMLInputElement).value)"
        />
      </label>

      <label class="settings-item">
        <span>背景透明度（{{ opacityPercent }}%）</span>
        <input
          :value="opacityPercent"
          type="range"
          min="0"
          max="100"
          step="1"
          @input="
            appearanceStore.updateBackgroundOpacity(
              Number(($event.target as HTMLInputElement).value) / 100,
            )
          "
        />
      </label>

      <label class="settings-item">
        <span>背景图片 URL</span>
        <input
          :value="backgroundImage"
          type="text"
          placeholder="https://example.com/background.jpg"
          @change="handleBackgroundImageChange"
        />
      </label>

      <div class="settings-item settings-item--bg-upload">
        <span>上传本地背景图</span>
        <div class="settings-bg-upload-row">
          <el-button
            type="primary"
            class="settings-bg-upload-btn"
            :loading="bgUploadBusy"
            :disabled="bgUploadBusy"
            @click="triggerBackgroundFilePick"
          >
            {{ bgUploadBusy ? '处理中…' : '选择图片' }}
          </el-button>
          <span v-if="bgUploadBusy" class="settings-bg-upload-status">压缩并保存中，请勿关闭页面</span>
        </div>
        <input
          ref="bgFileInputRef"
          type="file"
          class="settings-file-input"
          accept="image/*,.heic,.heif"
          tabindex="-1"
          aria-hidden="true"
          @change="handleBackgroundImageFileChange"
        />
        <p v-if="uploadMessage" class="settings-message settings-message--inline">{{ uploadMessage }}</p>
      </div>

      <BackgroundImageFitEditor
        v-if="showBackgroundFitEditor"
        :key="backgroundImage"
        :image-url="backgroundImage"
      />

      <label class="settings-item settings-item--theme">
        <span>整体风格</span>
        <el-select
          :model-value="themeStyle"
          class="settings-theme-select"
          aria-label="整体风格"
          @update:model-value="onThemeStyleChange"
        >
          <el-option value="light" label="浅色" />
          <el-option value="dark" label="深色" />
          <el-option value="soft" label="柔和" />
        </el-select>
      </label>

      <label class="settings-item">
        <span>顶栏与内容面板透明度（{{ chromeOpacityPercent }}%）</span>
        <input
          :value="chromeOpacityPercent"
          type="range"
          min="0"
          max="100"
          step="1"
          @input="
            appearanceStore.updateChromeOpacity(
              Number(($event.target as HTMLInputElement).value) / 100,
            )
          "
        />
      </label>

      <div class="settings-item settings-item--handout-font">
        <span>学习内容字号（{{ handoutFontSizePx }}px）</span>
        <input
          :value="handoutFontSizePx"
          type="range"
          :min="HANDOUT_FONT_SIZE_MIN"
          :max="HANDOUT_FONT_SIZE_MAX"
          step="1"
          @input="
            appearanceStore.updateHandoutFontSizePx(
              Number(($event.target as HTMLInputElement).value),
            )
          "
        />
        <div class="settings-handout-font-presets">
          <el-button
            v-for="px in handoutFontPresets"
            :key="px"
            size="small"
            :type="handoutFontSizePx === px ? 'primary' : 'default'"
            plain
            @click="appearanceStore.updateHandoutFontSizePx(px)"
          >
            {{ px }}px
          </el-button>
        </div>
        <p class="settings-item-hint">
          讲义编辑/预览、题目查看（含选择题题干与选项）、题目测验正文与选项、收藏错题详情等共用同一字号；标题与公式随正文同比放大。
        </p>
      </div>
    </div>

    <p v-if="uploadMessage" class="settings-message">{{ uploadMessage }}</p>

    <div class="settings-data-block">
      <h3 class="settings-data-block__title">数据备份</h3>
      <p class="settings-item-hint">
        学习数据保存在本机浏览器。换机或清空前请导出备份；也可只分享或获取「学习类型 + 题库」而不动个人记录。
      </p>

      <div class="settings-data-sub">
        <span class="settings-data-sub__label">完整缓存（换机恢复）</span>
        <p class="settings-data-sub__desc">
          下载或上传后会包含错题、收藏、答题日志、分数等全部内容；上传将<strong>覆盖</strong>当前本地数据。
        </p>
        <div class="settings-actions settings-actions--pair">
          <el-button class="settings-action-btn" @click="downloadCacheFile">下载缓存文件</el-button>
          <el-button class="settings-action-btn" @click="triggerCacheUpload">上传缓存文件</el-button>
        </div>
        <input
          ref="cacheUploadRef"
          type="file"
          class="settings-file-input"
          accept="application/json,.json"
          @change="uploadCacheFile"
        />
      </div>

      <div class="settings-data-sub">
        <span class="settings-data-sub__label">题库包（仅学习类型与题库）</span>
        <p class="settings-data-sub__desc">
          适合从他处获取题库：只合并目录树和题目，<strong>不改动</strong>错题本、收藏、答题日志与分数。同一学习类型下「类型 + 标题」相同的条目视为重复并跳过；目录按「父节点 + 名称」自动对齐，不重复建类。
        </p>
        <div class="settings-actions settings-actions--pair">
          <el-button class="settings-action-btn" @click="downloadBankPackFile">下载题库包</el-button>
          <el-button class="settings-action-btn" @click="triggerBankPackUpload">合并导入题库包</el-button>
        </div>
        <input
          ref="bankPackUploadRef"
          type="file"
          class="settings-file-input"
          accept="application/json,.json"
          @change="uploadBankPackFile"
        />
        <p v-if="bankPackMessage" class="settings-message settings-message--inline">{{ bankPackMessage }}</p>
      </div>
    </div>

    <div class="settings-actions settings-actions--single">
      <el-button class="settings-action-btn" @click="appearanceStore.reset">恢复默认</el-button>
    </div>
  </section>

  <BackgroundMusicSection />
  </div>
</template>

<style scoped>
.settings-page-root {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  box-sizing: border-box;
  padding: 0 12px 28px;
}

.settings-page {
  width: 100%;
  max-width: 760px;
  padding: 16px;
  border: 1px solid var(--app-border-soft);
  border-radius: 12px;
  background: var(--app-surface);
}

.settings-grid {
  display: grid;
  gap: 12px;
  margin: 16px 0;
}

.settings-item {
  display: grid;
  gap: 8px;
}

.settings-item input {
  height: 36px;
  border-radius: 6px;
  border: 1px solid var(--app-border);
  padding: 0 10px;
  background: var(--app-surface-alt);
  color: var(--app-text);
}

.settings-item--theme :deep(.settings-theme-select) {
  width: 100%;
}

.settings-item--theme :deep(.el-select__wrapper) {
  min-height: 36px;
  background-color: var(--app-surface-alt);
  box-shadow: 0 0 0 1px var(--app-border) inset;
}

.settings-item--theme :deep(.el-select__placeholder),
.settings-item--theme :deep(.el-select__selected-item) {
  color: var(--app-text);
}

.settings-item input[type='range'] {
  height: 28px;
  padding: 0;
}

.settings-item-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--app-text-muted);
}

.settings-handout-font-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.settings-item--bg-upload .settings-bg-upload-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.settings-item--bg-upload .settings-bg-upload-btn {
  flex-shrink: 0;
}

.settings-bg-upload-status {
  font-size: 13px;
  color: var(--app-text-muted);
}

.settings-message--inline {
  margin: 0;
}

.settings-message {
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--app-text-muted);
}

.settings-data-block {
  margin-top: 8px;
  padding-top: 16px;
  border-top: 1px solid var(--app-border-soft);
  display: grid;
  gap: 16px;
}

.settings-data-block__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--app-text);
}

.settings-data-sub {
  display: grid;
  gap: 8px;
}

.settings-data-sub__label {
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text);
}

.settings-data-sub__desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
  color: var(--app-text-muted);
}

.settings-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 4px;
}

.settings-actions--pair {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.settings-actions--single {
  grid-template-columns: 1fr;
  margin-top: 12px;
}

.settings-actions :deep(.settings-action-btn) {
  width: 100%;
  margin: 0;
  height: 36px;
}

.settings-file-input {
  display: none;
}

@media (max-width: 560px) {
  .settings-actions {
    grid-template-columns: 1fr;
  }
}

.settings-page p:not(.settings-message) {
  color: var(--app-text-muted);
}
</style>
