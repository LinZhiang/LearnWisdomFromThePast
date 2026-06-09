import classEndUrl from '@/assets/voice/pomodoro-class-end.wav?url'
import classStartUrl from '@/assets/voice/pomodoro-class-start.wav?url'

let classStartAudio: HTMLAudioElement | null = null
let classEndAudio: HTMLAudioElement | null = null

function getClassStartAudio(): HTMLAudioElement {
  if (!classStartAudio) {
    classStartAudio = new Audio(classStartUrl)
    classStartAudio.preload = 'auto'
  }
  return classStartAudio
}

function getClassEndAudio(): HTMLAudioElement {
  if (!classEndAudio) {
    classEndAudio = new Audio(classEndUrl)
    classEndAudio.preload = 'auto'
  }
  return classEndAudio
}

/** 休息结束 → 上课铃 */
export async function playPomodoroClassStartBell(): Promise<void> {
  try {
    const el = getClassStartAudio()
    el.currentTime = 0
    await el.play()
  } catch {
    /* 浏览器可能拦截自动播放；用户已点击过番茄时通常可播 */
  }
}

/** 学习结束 → 放学铃 */
export async function playPomodoroClassEndBell(): Promise<void> {
  try {
    const el = getClassEndAudio()
    el.currentTime = 0
    await el.play()
  } catch {
    /* ignore */
  }
}
