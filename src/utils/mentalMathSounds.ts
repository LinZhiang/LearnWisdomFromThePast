import correctUrl from '@/assets/voice/答对了.wav?url'
import wrongUrl from '@/assets/voice/答错了.wav?url'
import startUrl from '@/assets/voice/开始.wav?url'

let correctAudio: HTMLAudioElement | null = null
let wrongAudio: HTMLAudioElement | null = null
let startAudio: HTMLAudioElement | null = null

function getCorrectAudio(): HTMLAudioElement {
  if (!correctAudio) {
    correctAudio = new Audio(correctUrl)
  }
  return correctAudio
}

function getWrongAudio(): HTMLAudioElement {
  if (!wrongAudio) {
    wrongAudio = new Audio(wrongUrl)
  }
  return wrongAudio
}

function getStartAudio(): HTMLAudioElement {
  if (!startAudio) {
    startAudio = new Audio(startUrl)
  }
  return startAudio
}

export function playMentalMathCorrectSound(): void {
  try {
    const a = getCorrectAudio()
    a.currentTime = 0
    void a.play()
  } catch {
    /* 静音环境等 */
  }
}

export function playMentalMathWrongSound(): void {
  try {
    const a = getWrongAudio()
    a.currentTime = 0
    void a.play()
  } catch {
    /* 静音环境等 */
  }
}

export function playMentalMathStartSound(): void {
  try {
    const a = getStartAudio()
    a.currentTime = 0
    void a.play()
  } catch {
    /* 静音环境等 */
  }
}
