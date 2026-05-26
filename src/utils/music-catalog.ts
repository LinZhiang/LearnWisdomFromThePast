/** 扫描 src/assets/music 下音频，构建树形目录（供 el-tree-select 使用） */

const AUDIO_GLOB = import.meta.glob(
  [
    '@/assets/music/**/*.mp3',
    '@/assets/music/**/*.MP3',
    '@/assets/music/**/*.wav',
    '@/assets/music/**/*.WAV',
    '@/assets/music/**/*.ogg',
    '@/assets/music/**/*.m4a',
    '@/assets/music/**/*.flac',
    '@/assets/music/**/*.aac',
  ],
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>

export type MusicPlayMode = 'loop' | 'sequential' | 'shuffle-folder' | 'shuffle-all'

/** 兼容旧版 localStorage 中的 shuffle */
export function normalizeMusicPlayMode(raw: unknown): MusicPlayMode {
  if (raw === 'shuffle' || raw === 'shuffle-folder') return 'shuffle-folder'
  if (raw === 'shuffle-all') return 'shuffle-all'
  if (raw === 'loop' || raw === 'sequential') return raw
  return 'sequential'
}

export function isShufflePlayMode(mode: MusicPlayMode): boolean {
  return mode === 'shuffle-folder' || mode === 'shuffle-all'
}

export const MUSIC_PLAY_MODE_OPTIONS: { value: MusicPlayMode; label: string }[] = [
  { value: 'loop', label: '循环' },
  { value: 'sequential', label: '顺序' },
  { value: 'shuffle-folder', label: '当前类型随机' },
  { value: 'shuffle-all', label: '所有类型随机' },
]

export type MusicTrack = {
  /** 相对路径，如 `轻音乐/01.mp3` */
  id: string
  label: string
  url: string
  /** 所在文件夹（根目录为空字符串） */
  folder: string
}

export type MusicTreeNode = {
  id: string
  label: string
  children?: MusicTreeNode[]
  /** 文件夹节点不可选 */
  disabled?: boolean
}

const MUSIC_ROOT = 'assets/music/'

function relPathFromGlobKey(key: string): string {
  const idx = key.indexOf(MUSIC_ROOT)
  if (idx >= 0) return key.slice(idx + MUSIC_ROOT.length).replace(/\\/g, '/')
  return key.replace(/\\/g, '/')
}

function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, '')
}

function buildTracks(): MusicTrack[] {
  const tracks: MusicTrack[] = []
  for (const [key, url] of Object.entries(AUDIO_GLOB)) {
    const rel = relPathFromGlobKey(key)
    const slash = rel.lastIndexOf('/')
    const folder = slash >= 0 ? rel.slice(0, slash) : ''
    const fileName = slash >= 0 ? rel.slice(slash + 1) : rel
    tracks.push({
      id: rel,
      label: stripExt(fileName),
      url,
      folder,
    })
  }
  tracks.sort((a, b) => a.id.localeCompare(b.id, 'zh-CN'))
  return tracks
}

const ALL_TRACKS = buildTracks()

function folderLabel(folder: string): string {
  if (!folder) return '未分类'
  const parts = folder.split('/')
  return parts[parts.length - 1] ?? folder
}

function insertFolder(
  nodes: MusicTreeNode[],
  folderParts: string[],
  track: MusicTrack,
  pathSoFar: string[] = [],
): void {
  if (folderParts.length === 0) return
  const [head, ...rest] = folderParts
  const currentPath = [...pathSoFar, head]
  const folderId = `dir:${currentPath.join('/')}`
  let node = nodes.find((n) => n.id === folderId)
  if (!node) {
    node = {
      id: folderId,
      label: folderLabel(head),
      children: [],
      disabled: true,
    }
    nodes.push(node)
  }
  if (!node.children) node.children = []
  if (rest.length === 0) {
    node.children.push({
      id: track.id,
      label: track.label,
    })
  } else {
    insertFolder(node.children, rest, track, currentPath)
  }
}

function buildTree(): MusicTreeNode[] {
  const roots: MusicTreeNode[] = []
  for (const track of ALL_TRACKS) {
    if (!track.folder) {
      roots.push({ id: track.id, label: track.label })
      continue
    }
    insertFolder(roots, track.folder.split('/'), track)
  }
  const sortNodes = (list: MusicTreeNode[]): MusicTreeNode[] => {
    list.sort((a, b) => {
      const aDir = a.id.startsWith('dir:')
      const bDir = b.id.startsWith('dir:')
      if (aDir !== bDir) return aDir ? -1 : 1
      return a.label.localeCompare(b.label, 'zh-CN')
    })
    for (const n of list) {
      if (n.children?.length) n.children = sortNodes(n.children)
    }
    return list
  }
  return sortNodes(roots)
}

export const musicTreeData: MusicTreeNode[] = buildTree()

export function getMusicTrackById(id: string | null | undefined): MusicTrack | undefined {
  if (!id) return undefined
  return ALL_TRACKS.find((t) => t.id === id)
}

/** 与当前曲目同文件夹的播放列表（根目录曲目则取全部根级曲目） */
/** 与当前曲目同一文件夹（树中直接父节点下）的曲目列表 */
export function getPlaylistForTrack(trackId: string): MusicTrack[] {
  const track = getMusicTrackById(trackId)
  if (!track) return []
  const list = track.folder
    ? ALL_TRACKS.filter((t) => t.folder === track.folder)
    : ALL_TRACKS.filter((t) => !t.folder)
  return [...list].sort((a, b) => a.id.localeCompare(b.id, 'zh-CN'))
}

/** 曲库内全部曲目（用于「所有类型随机」） */
export function getAllMusicTracks(): MusicTrack[] {
  return [...ALL_TRACKS]
}

/** 按播放模式返回用于顺序切歌 / 随机抽选的曲目范围 */
export function getScopePlaylistForMode(trackId: string, mode: MusicPlayMode): MusicTrack[] {
  if (mode === 'shuffle-all') return getAllMusicTracks()
  return getPlaylistForTrack(trackId)
}

export function hasMusicTracks(): boolean {
  return ALL_TRACKS.length > 0
}
