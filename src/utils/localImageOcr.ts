import { createWorker, type Worker } from 'tesseract.js'
import {
  compressImageDataUrl,
  type RichMaterialImage,
} from '@/utils/richMaterialImages'

/** 资料整理：写入 DeepSeek 提示词的用户目标（与界面说明一致） */
export const MATERIAL_LECTURE_USER_GOAL = '请把上图内容转成文字并标出重点'

let ocrWorker: Worker | null = null
let ocrWorkerInit: Promise<Worker> | null = null

async function getOcrWorker(): Promise<Worker> {
  if (ocrWorker) return ocrWorker
  if (!ocrWorkerInit) {
    ocrWorkerInit = (async () => {
      const worker = await createWorker('chi_sim+eng', 1, {
        logger: () => {},
      })
      ocrWorker = worker
      return worker
    })()
  }
  return ocrWorkerInit
}

export async function terminateLocalOcrWorker(): Promise<void> {
  if (ocrWorker) {
    await ocrWorker.terminate()
    ocrWorker = null
    ocrWorkerInit = null
  }
}

/**
 * 在浏览器内 OCR（DeepSeek chat 接口不支持 image_url，故用本地识别后再交 DeepSeek 整理）。
 */
export async function ocrImagesLocally(
  images: RichMaterialImage[],
  onProgress?: (msg: string) => void,
): Promise<string> {
  if (images.length === 0) return ''

  const worker = await getOcrWorker()
  const sections: string[] = []

  for (let i = 0; i < images.length; i += 1) {
    const img = images[i]!
    onProgress?.(`正在识别图片文字（${i + 1} / ${images.length}）…`)

    const dataUrl = await compressImageDataUrl(img.dataUrl)
    const { data } = await worker.recognize(dataUrl)
    const text = (data.text ?? '').trim()
    sections.push(
      `【附图${img.index}】\n${text || '[本图未识别到清晰文字，请检查图片是否清晰或文字过小]'}`,
    )
  }

  return sections.join('\n\n')
}
