// The shared data model. A "video" is the unit of work: most tools read or write
// something that belongs to the video currently selected in the video bar.

import { useCallback, useMemo } from 'react'
import { useCollection, useStored, write } from './store'
import { addDays, defaultCurrency, fmtTime, today, weekStart } from './util'

// ---- production stages ----

export const STAGES = [
  { id: 'planned', name: 'Planned' },
  { id: 'scripting', name: 'Scripting' },
  { id: 'shooting', name: 'Shooting' },
  { id: 'editing', name: 'Editing' },
  { id: 'scheduled', name: 'Scheduled' },
  { id: 'published', name: 'Published' },
] as const

export type StageId = (typeof STAGES)[number]['id']

export const stageName = (id: StageId): string => STAGES.find((s) => s.id === id)?.name ?? id

// ---- entities ----

export interface Video {
  id: string
  title: string
  stage: StageId
  publishDate?: string
  seriesId?: string
  notes?: string
  createdAt: number
}

export interface Idea {
  id: string
  title: string
  notes: string
  tags: string[]
  rating: number
  createdAt: number
  videoId?: string
}

export interface Series {
  id: string
  name: string
  premise: string
  cadence: string
}

export interface Brand {
  channel: string
  tagline: string
  colors: string[]
  font: string
  logo: string
  voice: string
}

export const DEFAULT_BRAND: Brand = {
  channel: '',
  tagline: '',
  colors: ['#e5432a', '#1a1915', '#fffdf8', '#f5b800'],
  font: 'Anton',
  logo: '',
  voice: '',
}

export interface Settings {
  currency: string
  wpm: number
}

export const DEFAULT_SETTINGS: Settings ={ currency: defaultCurrency(), wpm: 150 }

export interface ScriptDoc {
  body: string
}
export const EMPTY_SCRIPT: ScriptDoc = { body: '' }

export interface OutlineSection {
  id: string
  heading: string
  notes: string
  seconds: number
}

export const EMPTY_OUTLINE: OutlineSection[] = []

/** Outline -> script skeleton: headings become "# lines", notes become [cues] to write against. */
export function outlineToScript(sections: OutlineSection[]): string {
  return sections
    .map((s) => {
      const cues = s.notes
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => `[${l}]`)
        .join('\n')
      return `# ${s.heading.trim() || 'Untitled section'}\n${cues ? cues + '\n' : ''}`
    })
    .join('\n')
}

export interface Chapter {
  id: string
  time: number
  title: string
}

export const EMPTY_CHAPTERS: Chapter[] = []

/** Chapters as YouTube expects them in a description: "0:00 Title", one per line, in time order. */
export function chaptersText(chapters: Chapter[]): string {
  return [...chapters]
    .sort((a, b) => a.time - b.time)
    .map((c) => `${fmtTime(c.time)} ${c.title.trim()}`)
    .join('\n')
}

/** The problems that stop YouTube turning timestamps into chapters. Empty means valid. */
export function chapterProblems(chapters: Chapter[]): string[] {
  const out: string[] = []
  if (chapters.length < 3) out.push(`At least three chapters are needed. You have ${chapters.length}.`)
  if (chapters.length && chapters[0].time !== 0) out.push('The first chapter must start at 0:00.')
  if (chapters.some((c, i) => i > 0 && c.time <= chapters[i - 1].time)) out.push('Chapters must be in order, each later than the one before.')
  else if (chapters.some((c, i) => i > 0 && c.time - chapters[i - 1].time < 10)) out.push('Every chapter must be at least 10 seconds long.')
  if (chapters.some((c) => !c.title.trim())) out.push('Every chapter needs a title.')
  return out
}

export type PromoKind ='community' | 'short' | 'poll' | 'social'

export interface Promo {
  id: string
  videoId?: string
  kind: PromoKind
  date?: string
  text: string
  status: 'idea' | 'drafted' | 'posted'
}

export const PROMO_KINDS: { id: PromoKind; name: string }[] = [
  { id: 'community', name: 'Community post' },
  { id: 'short', name: 'Shorts teaser' },
  { id: 'poll', name: 'Poll' },
  { id: 'social', name: 'Social post' },
]

export const promoKindName = (kind: PromoKind): string => PROMO_KINDS.find((k) => k.id === kind)?.name ?? kind

export interface StreakConfig {
  perWeek: number
}
export const DEFAULT_STREAK: StreakConfig = { perWeek: 1 }

export const EMPTY_STRINGS: string[] = []

// ---- hooks ----

export const useVideos = () => useCollection<Video>('videos')

export function newVideo(title: string, extra: Partial<Video> = {}): Omit<Video, 'id'> {
  return { title, stage: 'planned', createdAt: Date.now(), ...extra }
}

/** The video selected in the video bar (falls back to the most recently created). */
export function useActiveVideo(): Video | undefined {
  const { items } = useVideos()
  const [id] = useStored<string>('currentVideoId', '')
  return items.find((v) => v.id === id) ?? items[items.length - 1]
}

export function useSettings(): readonly [Settings, (patch: Partial<Settings>) => void] {
  const [stored, set] = useStored<Settings>('settings', DEFAULT_SETTINGS)
  const patch = useCallback((p: Partial<Settings>) => set((prev) => ({ ...prev, ...p })), [set])
  const merged = useMemo(() => ({ ...DEFAULT_SETTINGS, ...stored }), [stored])
  return [merged, patch] as const
}

/** Per-video document stores, cleaned up when a video is deleted. */
const VIDEO_DOC_KEYS = ['scripts', 'outlines', 'shots', 'titles', 'subs', 'descriptions', 'chapters', 'videoTags', 'checks']

export function deleteVideo(id: string): void {
  write<Video[]>('videos', (prev) => prev.filter((v) => v.id !== id), [])
  for (const key of VIDEO_DOC_KEYS) {
    write<Record<string, unknown>>(
      key,
      (prev) => {
        if (!(id in prev)) return prev
        const next = { ...prev }
        delete next[id]
        return next
      },
      {},
    )
  }
}

// ---- script text ----

/** The words that are actually spoken: drops "# headings" and [bracketed cues]. */
export function spokenText(body: string): string {
  return body
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n')
    .replace(/\[[^\]\n]*\]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export interface ScriptSection {
  heading: string
  text: string
}

/** Split a script on "# heading" lines. Text before the first heading becomes "Opening". */
export function scriptSections(body: string): ScriptSection[] {
  const sections: ScriptSection[] = []
  let current: ScriptSection = { heading: 'Opening', text: '' }
  for (const line of body.split('\n')) {
    if (line.trim().startsWith('#')) {
      if (current.text.trim() || sections.length) sections.push(current)
      current = { heading: line.replace(/^\s*#+\s*/, '').trim() || 'Untitled', text: '' }
    } else {
      current.text += line + '\n'
    }
  }
  if (current.text.trim() || sections.length) sections.push(current)
  return sections
}

// ---- upload streak ----

export function useUploadDates(): string[] {
  const { items: videos } = useVideos()
  const [log] = useStored<string[]>('uploadLog', EMPTY_STRINGS)
  return useMemo(() => {
    const now = today()
    const fromVideos = videos.filter((v) => v.stage === 'published' && v.publishDate).map((v) => v.publishDate as string)
    return [...fromVideos, ...log].filter((d) => d <= now)
  }, [videos, log])
}

export function computeStreak(dates: string[], perWeek: number) {
  const counts = new Map<string, number>()
  for (const d of dates) {
    const w = weekStart(d)
    counts.set(w, (counts.get(w) ?? 0) + 1)
  }
  const target = Math.max(1, perWeek)
  const hit = (w: string) => (counts.get(w) ?? 0) >= target
  const thisWeek = weekStart(today())

  // The current week only extends the streak; an unfinished week never breaks it.
  let current = hit(thisWeek) ? 1 : 0
  for (let w = addDays(thisWeek, -7); hit(w); w = addDays(w, -7)) current++

  let best = 0
  let run = 0
  const first = [...counts.keys()].sort()[0]
  if (first) {
    for (let w = first; w <= thisWeek; w = addDays(w, 7)) {
      run = hit(w) ? run + 1 : 0
      best = Math.max(best, run)
    }
  }
  return { current, best: Math.max(best, current), counts, thisWeek: counts.get(thisWeek) ?? 0, target }
}
