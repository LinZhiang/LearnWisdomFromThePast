import qbPerfectMidiUrl from '@/assets/voice/A_085XGW.MID?url'

type JzzModule = typeof import('jzz')
type SmfModule = typeof import('jzz-midi-smf')
type TinyModule = typeof import('jzz-synth-tiny')

type JzzInstance = JzzModule['default']
type MidiPlayer = ReturnType<
  InstanceType<JzzInstance['MIDI']['SMF']>['player']
>

let jzzBundle: {
  JZZ: JzzInstance
} | null = null
let jzzMidiReady = false
let activePlayer: MidiPlayer | null = null

async function loadJzzBundle() {
  if (jzzBundle) return jzzBundle
  const [JZZ, SMF, Tiny] = await Promise.all([
    import('jzz'),
    import('jzz-midi-smf'),
    import('jzz-synth-tiny'),
  ])
  jzzBundle = { JZZ: JZZ.default }
  if (!jzzMidiReady) {
    ;(SMF.default as SmfModule['default'])(JZZ.default)
    ;(Tiny.default as TinyModule['default'])(JZZ.default)
    JZZ.default.synth.Tiny.register('Web Audio')
    jzzMidiReady = true
  }
  return jzzBundle
}

/** JZZ 使用 Web Audio；与 HTML Audio 背景音乐并存时需先 resume 上下文 */
async function ensureWebAudioRunning(): Promise<{ JZZ: JzzInstance } | null> {
  const bundle = await loadJzzBundle()
  const { JZZ } = bundle
  const ac = JZZ.lib.getAudioContext?.() as AudioContext | undefined
  if (!ac) return null
  if (ac.state === 'suspended') {
    try {
      await ac.resume()
    } catch {
      return null
    }
  }
  if (ac.state !== 'running') {
    await new Promise<void>((r) => window.setTimeout(r, 80))
  }
  return ac.state === 'running' ? bundle : null
}

function openMidiAndPlay(JZZ: JzzInstance, player: MidiPlayer): Promise<boolean> {
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
    const bundle = await ensureWebAudioRunning()
    if (!bundle) return false
    const { JZZ } = bundle

    const res = await fetch(qbPerfectMidiUrl)
    if (!res.ok) return false
    const buf = await res.arrayBuffer()
    const smf = new JZZ.MIDI.SMF(buf)
    const player = smf.player()
    return await openMidiAndPlay(JZZ, player)
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
