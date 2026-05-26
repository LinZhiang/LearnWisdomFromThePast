import JZZ from 'jzz'
import SMF from 'jzz-midi-smf'
import Tiny from 'jzz-synth-tiny'
import qbPerfectMidiUrl from '@/assets/voice/A_085XGW.MID?url'

type MidiPlayer = ReturnType<
  InstanceType<typeof JZZ.MIDI.SMF>['player']
>

let jzzMidiReady = false
let activePlayer: MidiPlayer | null = null

function ensureJzzMidi(): void {
  if (jzzMidiReady) return
  SMF(JZZ)
  Tiny(JZZ)
  JZZ.synth.Tiny.register('Web Audio')
  jzzMidiReady = true
}

/** JZZ 使用 Web Audio；与 HTML Audio 背景音乐并存时需先 resume 上下文 */
async function ensureWebAudioRunning(): Promise<boolean> {
  ensureJzzMidi()
  const ac = JZZ.lib.getAudioContext?.() as AudioContext | undefined
  if (!ac) return false
  if (ac.state === 'suspended') {
    try {
      await ac.resume()
    } catch {
      return false
    }
  }
  if (ac.state !== 'running') {
    await new Promise<void>((r) => window.setTimeout(r, 80))
  }
  return ac.state === 'running'
}

function openMidiAndPlay(player: MidiPlayer): Promise<boolean> {
  return new Promise((resolve) => {
    JZZ()
      .openMidiOut('Web Audio')
      .and(function (this: unknown) {
        try {
          player.connect(this)
          activePlayer = player
          player
            .play()
            .and(() => resolve(true))
            .or(() => {
              activePlayer = null
              resolve(false)
            })
        } catch {
          activePlayer = null
          resolve(false)
        }
      })
      .or(() => resolve(false))
  })
}

/** 题库全对弹窗出现时播放 MIDI；返回是否已成功开始播放 */
export async function startQbPerfectMidi(): Promise<boolean> {
  stopQbPerfectMidi()
  try {
    const audioOk = await ensureWebAudioRunning()
    if (!audioOk) return false

    const res = await fetch(qbPerfectMidiUrl)
    if (!res.ok) return false
    const buf = await res.arrayBuffer()
    const smf = new JZZ.MIDI.SMF(buf)
    const player = smf.player()
    return await openMidiAndPlay(player)
  } catch {
    return false
  }
}

/** 关闭弹窗时停止 MIDI */
export function stopQbPerfectMidi(): void {
  if (!activePlayer) return
  try {
    activePlayer.stop()
    activePlayer.sndOff?.()
  } catch {
    /* ignore */
  }
  activePlayer = null
}
