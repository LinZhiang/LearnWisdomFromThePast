declare module 'jzz' {
  interface JzzChain {
    and(cb: (this: unknown) => void): JzzChain
    or(cb: () => void): JzzChain
  }

  interface JzzMidiPlayer {
    connect(dest: unknown): void
    play(): JzzChain
    stop(): void
    sndOff?: () => void
  }

  interface JzzRoot {
    (): { openMidiOut(name: string): JzzChain }
    lib: { getAudioContext?: () => AudioContext | undefined }
    synth: { Tiny: { register: (name: string) => void } }
    MIDI: {
      SMF: new (buf: ArrayBuffer | Uint8Array) => {
        player: () => JzzMidiPlayer
      }
    }
  }

  const JZZ: JzzRoot
  export default JZZ
}

declare module 'jzz-midi-smf' {
  function SMF(JZZ: unknown): void
  export default SMF
}

declare module 'jzz-synth-tiny' {
  function Tiny(JZZ: unknown): void
  export default Tiny
}
