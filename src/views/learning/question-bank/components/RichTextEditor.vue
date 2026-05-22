<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { Quill, QuillEditor } from '@vueup/vue-quill'
import type { QuillOptions } from 'quill'
import '@vueup/vue-quill/dist/vue-quill.snow.css'

const props = defineProps<{
  modelValue: string
  placeholder?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const editorRef = ref<InstanceType<typeof QuillEditor> | null>(null)
const quillInstance = ref<Quill | null>(null)
const activeImageEl = ref<HTMLImageElement | null>(null)
const activeImageIndex = ref<number | null>(null)
const toolbarId = `rich-toolbar-${Math.random().toString(36).slice(2, 8)}`

const content = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value),
})

const onEditorReady = (quill: Quill) => {
  quillInstance.value = quill
  const setActiveImage = (target: EventTarget | null) => {
    if (!(target instanceof HTMLImageElement)) {
      activeImageEl.value = null
      activeImageIndex.value = null
      return
    }
    const blot = Quill.find(target)
    if (!blot || blot instanceof Quill) return
    activeImageEl.value = target
    activeImageIndex.value = quill.getIndex(blot)
    quill.setSelection(activeImageIndex.value, 1, 'user')
  }

  const clickHandler = (event: Event) => {
    setActiveImage(event.target)
  }

  const keydownHandler = (event: KeyboardEvent) => {
    if (event.key !== 'Delete' && event.key !== 'Backspace') return
    const index = activeImageIndex.value
    if (index === null) return
    event.preventDefault()
    quill.deleteText(index, 1, 'user')
    activeImageEl.value = null
    activeImageIndex.value = null
    quill.setSelection(Math.max(0, index - 1), 0, 'silent')
  }

  quill.root.addEventListener('click', clickHandler)
  quill.root.addEventListener('keydown', keydownHandler)
  ;(quill as Quill & { __imageClickHandler?: (event: Event) => void }).__imageClickHandler =
    clickHandler
  ;(quill as Quill & { __imageKeydownHandler?: (event: KeyboardEvent) => void }).__imageKeydownHandler =
    keydownHandler
}

const pickLocalImage = () =>
  new Promise<string | null>((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) {
        resolve(null)
        return
      }
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(file)
    }
    input.click()
  })

const resizeActiveImage = (delta: number) => {
  const img = activeImageEl.value
  if (!img) {
    window.alert('请先点击编辑器中的图片，再调整大小。')
    return
  }
  const currentWidth = img.clientWidth || img.naturalWidth || 200
  const nextWidth = Math.max(60, Math.round(currentWidth + delta))
  img.style.width = `${nextWidth}px`
  img.style.maxWidth = '100%'
  img.style.height = 'auto'
}

const resetActiveImageSize = () => {
  const img = activeImageEl.value
  if (!img) {
    window.alert('请先点击编辑器中的图片，再还原大小。')
    return
  }
  img.style.width = ''
  img.style.maxWidth = '100%'
  img.style.height = 'auto'
}

const removeActiveImage = () => {
  const quill = quillInstance.value ?? editorRef.value?.getQuill()
  const index = activeImageIndex.value
  if (!quill || index === null) {
    window.alert('请先点击编辑器中的图片，再删除。')
    return
  }
  quill.deleteText(index, 1, 'user')
  activeImageEl.value = null
  activeImageIndex.value = null
  quill.setSelection(Math.max(0, index - 1), 0, 'silent')
}

const editorOptions = {
  modules: {
    toolbar: {
      container: `#${toolbarId}`,
      handlers: {
        image: async () => {
          const base64 = await pickLocalImage()
          if (!base64) return
          const quill = quillInstance.value ?? editorRef.value?.getQuill()
          if (!quill) return
          const range = quill.getSelection(true)
          const index = range?.index ?? quill.getLength()
          quill.insertEmbed(index, 'image', base64)
          quill.setSelection(index + 1, 0)
        },
        imageSmaller: () => resizeActiveImage(-40),
        imageLarger: () => resizeActiveImage(40),
        imageReset: () => resetActiveImageSize(),
        imageDelete: () => removeActiveImage(),
      },
    },
  },
} as unknown as QuillOptions

onBeforeUnmount(() => {
  const quill = quillInstance.value as
    | (Quill & {
        __imageClickHandler?: (event: Event) => void
        __imageKeydownHandler?: (event: KeyboardEvent) => void
      })
    | null
  if (!quill?.__imageClickHandler) return
  quill.root.removeEventListener('click', quill.__imageClickHandler)
  if (quill.__imageKeydownHandler) {
    quill.root.removeEventListener('keydown', quill.__imageKeydownHandler)
  }
})
</script>

<template>
  <div class="rich-editor-wrap">
    <div :id="toolbarId" class="ql-toolbar ql-snow unified-toolbar">
      <span class="ql-formats">
        <button class="ql-bold" type="button" />
        <button class="ql-italic" type="button" />
        <button class="ql-underline" type="button" />
        <button class="ql-strike" type="button" />
      </span>
      <span class="ql-formats">
        <select class="ql-header">
          <option selected />
          <option value="1" />
          <option value="2" />
        </select>
        <button class="ql-blockquote" type="button" />
        <button class="ql-code-block" type="button" />
      </span>
      <span class="ql-formats">
        <button class="ql-list" value="ordered" type="button" />
        <button class="ql-list" value="bullet" type="button" />
        <select class="ql-align">
          <option selected />
          <option value="center" />
          <option value="right" />
          <option value="justify" />
        </select>
      </span>
      <span class="ql-formats">
        <select class="ql-color" />
        <select class="ql-background" />
      </span>
      <span class="ql-formats">
        <button class="ql-link" type="button" />
        <button class="ql-image" type="button" />
        <button class="ql-clean" type="button" />
      </span>
      <span class="ql-formats image-actions-inline">
        <button class="ql-imageSmaller" type="button" :disabled="!activeImageEl">缩小</button>
        <button class="ql-imageLarger" type="button" :disabled="!activeImageEl">放大</button>
        <button class="ql-imageReset" type="button" :disabled="!activeImageEl">还原</button>
        <button class="ql-imageDelete danger" type="button" :disabled="!activeImageEl">删除</button>
      </span>
      <span class="image-actions-tip">
        {{ activeImageEl ? '已选中图片' : '请先点击富文本中的图片' }}
      </span>
    </div>
    <QuillEditor
      ref="editorRef"
      v-model:content="content"
      content-type="html"
      theme="snow"
      :options="editorOptions"
      :placeholder="placeholder"
      @ready="onEditorReady"
    />
  </div>
</template>

<style scoped>
.rich-editor-wrap {
  display: grid;
  gap: 0;
}

.unified-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  border-bottom: 0;
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
}

.image-actions-inline button {
  width: auto;
  padding: 0 8px;
  font-size: 12px;
}

.image-actions-inline button.danger {
  color: var(--app-danger);
}

.image-actions-tip {
  font-size: 12px;
  color: var(--app-text-muted);
  margin-left: 4px;
}

:deep(.ql-container.ql-snow) {
  border-top: 1px solid var(--app-border-soft);
  border-bottom-left-radius: 8px;
  border-bottom-right-radius: 8px;
}
</style>
