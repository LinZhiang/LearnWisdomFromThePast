<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useAppearanceStore } from '@/stores/appearance'
import { APP_CACHE_FILE_PREFIX } from '@/constants/branding'
import {
  exportCacheSnapshot,
  importCacheSnapshot,
  previewCacheSnapshot,
} from '@/services/cache-backup'
import { fileToStorableBackgroundDataUrl, isLikelyImageFile } from '@/utils/backgroundImageUpload'

const appearanceStore = useAppearanceStore()
const { backgroundColor, backgroundOpacity, backgroundImage, chromeOpacity, themeStyle } =
  storeToRefs(appearanceStore)
const uploadMessage = ref('')
const bgUploadBusy = ref(false)
const opacityPercent = computed(() => Math.round(backgroundOpacity.value * 100))
const chromeOpacityPercent = computed(() => Math.round(chromeOpacity.value * 100))

const onThemeStyleChange = (v: string) => {
  if (v === 'light' || v === 'dark' || v === 'soft') {
    appearanceStore.updateThemeStyle(v)
  }
}

const handleBackgroundImageChange = (event: Event) => {
  const value = (event.target as HTMLInputElement).value
  if (!appearanceStore.updateBackgroundImage(value)) {
    uploadMessage.value =
      '保存失败：地址或内容过长，超出浏览器本地存储上限。请改用「上传本地背景图」自动压缩，或使用较短的网络图片 URL。'
  }
}

/** 多档压缩 + 重试写入，避免大图 Base64 撑爆 localStorage */
const tryCompressAndSaveBackground = async (file: File): Promise<boolean> => {
  const steps = [
    { maxEdge: 1920, q: 0.84 },
    { maxEdge: 1600, q: 0.78 },
    { maxEdge: 1280, q: 0.74 },
    { maxEdge: 960, q: 0.7 },
    { maxEdge: 720, q: 0.66 },
    { maxEdge: 640, q: 0.62 },
  ]
  for (const { maxEdge, q } of steps) {
    const dataUrl = await fileToStorableBackgroundDataUrl(file, maxEdge, q)
    if (appearanceStore.updateBackgroundImage(dataUrl)) {
      return true
    }
  }
  return false
}

const handleBackgroundImageFileChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  if (!isLikelyImageFile(file)) {
    uploadMessage.value =
      '无法识别为图片：请选择常见图片文件（如 jpg、png、webp）。若已选对仍失败，可能是系统未标出文件类型，请确认扩展名正确。'
    input.value = ''
    return
  }

  bgUploadBusy.value = true
  uploadMessage.value = '正在处理图片…'
  try {
    const ok = await tryCompressAndSaveBackground(file)
    if (ok) {
      uploadMessage.value = `已保存本地背景图：${file.name}`
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
    input.value = ''
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
</script>

<template>
  <div class="settings-page-root">
  <section class="settings-page">
    <header class="page-hero">
      <span class="page-kicker">系统 01</span>
      <h2 class="page-title">界面设置</h2>
      <p class="page-subtitle">
        支持设置背景颜色、背景图片和整体风格，设置会自动保存。有背景图时，半透明背景色会叠在图片上方；切换整体风格时会将背景色同步为该风格的推荐色（你可再微调）。深色/柔和下若仍为默认白且透明度
        100%，则视为不叠色以免挡住主题底色。顶栏与内容面板透明度只降低衬底不透明度，文字与正文内图片不受影响；拉得过低时可配合毛玻璃略微提亮可读性。
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

      <label class="settings-item">
        <span>上传本地背景图</span>
        <input
          type="file"
          accept="image/*,.heic,.heif"
          :disabled="bgUploadBusy"
          @change="handleBackgroundImageFileChange"
        />
      </label>

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
    </div>

    <p v-if="uploadMessage">{{ uploadMessage }}</p>

    <div class="settings-actions">
      <button type="button" @click="downloadCacheFile">下载缓存文件</button>
      <label class="upload-cache-button">
        上传缓存文件
        <input type="file" accept="application/json,.json" @change="uploadCacheFile" />
      </label>
    </div>

    <button type="button" @click="appearanceStore.reset">恢复默认</button>
  </section>
  </div>
</template>

<style scoped>
.settings-page-root {
  width: 100%;
  display: flex;
  justify-content: center;
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

.settings-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.upload-cache-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  padding: 8px 12px;
  background: var(--app-surface-alt);
  cursor: pointer;
}

.upload-cache-button input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.settings-page p {
  color: var(--app-text-muted);
}
</style>
