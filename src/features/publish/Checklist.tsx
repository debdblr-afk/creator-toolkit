import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useCollection, useDoc, useStored } from '../../lib/store'
import {
  EMPTY_CHAPTERS,
  EMPTY_SCRIPT,
  EMPTY_STRINGS,
  chapterProblems,
  spokenText,
  useActiveVideo,
  type Chapter,
  type ScriptDoc,
  type Video,
} from '../../lib/data'
import type { Design } from '../../lib/thumb'
import type { DescDoc } from './Description'
import type { Cue } from '../produce/Subtitles'
import { Link } from '../../lib/router'
import { countWords, cx, fmtDateLong, uid } from '../../lib/util'
import { Btn, ConfirmBtn, Input, Meter, NeedVideo, Status, Toggle, VideoBar, type Tone } from '../../ui/kit'

export interface CheckItem {
  id: string
  group: string
  text: string
}

const GROUPS = ['Video', 'Title and description', 'Thumbnail', 'Rules and rights', 'Launch']

const DEFAULT_ITEMS: CheckItem[] = [
  ['Video', 'Final export watched from start to finish'],
  ['Video', 'Audio is even, with no clipping or long silences'],
  ['Video', 'Captions uploaded, or automatic captions reviewed'],
  ['Video', 'Resolution and frame rate are what you intended'],
  ['Title and description', 'Title is final and still reads well when cut short'],
  ['Title and description', 'First two lines of the description say what the video delivers'],
  ['Title and description', 'Chapters added, starting at 0:00'],
  ['Title and description', 'Tags added'],
  ['Title and description', 'Added to the right playlist'],
  ['Title and description', 'Category and language set'],
  ['Thumbnail', 'Custom thumbnail uploaded (1280 × 720, under 2 MB)'],
  ['Thumbnail', 'Readable at the smallest size'],
  ['Thumbnail', 'Adds to the title instead of repeating it'],
  ['Rules and rights', 'Paid promotion declared if the video is sponsored'],
  ['Rules and rights', 'Audience setting chosen (made for kids or not)'],
  ['Rules and rights', 'Music, footage and images are licensed or your own'],
  ['Launch', 'End screen added'],
  ['Launch', 'Cards added at relevant moments'],
  ['Launch', 'Pinned comment ready'],
  ['Launch', 'Community post or teaser scheduled'],
].map(([group, text], i) => ({ id: `c${i + 1}`, group, text }))

const NO_CUES: Cue[] = []

/** What the rest of the toolkit already knows about this video. */
function Signals({ video }: { video: Video }) {
  const [script] = useDoc<ScriptDoc>('scripts', video.id, EMPTY_SCRIPT)
  const [desc] = useDoc<DescDoc | null>('descriptions', video.id, null)
  const [chapters] = useDoc<Chapter[]>('chapters', video.id, EMPTY_CHAPTERS)
  const [tags] = useDoc<string[]>('videoTags', video.id, EMPTY_STRINGS)
  const [cues] = useDoc<Cue[]>('subs', video.id, NO_CUES)
  const { items: designs } = useCollection<Design>('thumbnails')

  const words = countWords(spokenText(script.body))
  const hasThumb = designs.some((d) => d.videoId === video.id)
  const sortedChapters = [...chapters].sort((a, b) => a.time - b.time)
  const chaptersOk = chapters.length > 0 && chapterProblems(sortedChapters).length === 0

  const rows: { tone: Tone; text: string; to: string }[] = [
    { tone: video.title.length <= 70 ? 'good' : 'warn', text: `Title is ${video.title.length} characters long`, to: '/titles' },
    { tone: video.publishDate ? 'good' : 'info', text: video.publishDate ? `Publish date: ${fmtDateLong(video.publishDate)}` : 'No publish date set', to: '/calendar' },
    { tone: words ? 'good' : 'info', text: words ? `Script written: ${words} spoken words` : 'No script written', to: '/script' },
    { tone: hasThumb ? 'good' : 'info', text: hasThumb ? 'A thumbnail design is linked' : 'No thumbnail design linked', to: '/thumbnail' },
    { tone: desc?.intro?.trim() ? 'good' : 'info', text: desc?.intro?.trim() ? 'Description opening lines written' : 'Description not started', to: '/description' },
    {
      tone: chaptersOk ? 'good' : chapters.length ? 'warn' : 'info',
      text: chaptersOk ? `${chapters.length} valid chapters` : chapters.length ? 'Chapters do not meet YouTube’s rules yet' : 'No chapters',
      to: '/chapters',
    },
    { tone: tags.length ? 'good' : 'info', text: tags.length ? `${tags.length} tags ready` : 'No tags', to: '/tags' },
    { tone: cues.length ? 'good' : 'info', text: cues.length ? `${cues.length} captions drafted` : 'No captions drafted', to: '/subtitles' },
  ]

  return (
    <div className="card stack">
      <div>
        <h2 className="card-title">From your project</h2>
        <p className="small muted">What the other tools already hold for this video.</p>
      </div>
      <div className="stack tight">
        {rows.map((r) => (
          <Status key={r.to} tone={r.tone}>
            {r.text}. <Link to={r.to}>Open</Link>
          </Status>
        ))}
      </div>
    </div>
  )
}

function List({ video }: { video: Video }) {
  const [items, setItems] = useStored<CheckItem[]>('checklist', DEFAULT_ITEMS)
  const [checked, setChecked] = useDoc<string[]>('checks', video.id, EMPTY_STRINGS)
  const [editing, setEditing] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const done = items.filter((i) => checked.includes(i.id)).length
  const groups = [...new Set([...GROUPS, ...items.map((i) => i.group)])]
  const toggle = (id: string) => setChecked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const addItem = (group: string) => {
    const text = (drafts[group] ?? '').trim()
    if (!text) return
    setItems((prev) => [...prev, { id: uid(), group, text }])
    setDrafts((prev) => ({ ...prev, [group]: '' }))
  }

  return (
    <div className="split">
      <div className="stack">
        <div className="card stack">
          <div className="row spread">
            <span className="strong">
              {done} of {items.length} checked
            </span>
            <Toggle checked={editing} onChange={setEditing}>
              Edit the list
            </Toggle>
          </div>
          <Meter label="Checklist progress" value={done} max={items.length} tone={done === items.length && items.length > 0 ? 'good' : undefined} />
          {done === items.length && items.length > 0 && <Status tone="good">Everything is checked. This video is ready to publish.</Status>}
        </div>

        {groups.map((group) => {
          const list = items.filter((i) => i.group === group)
          if (!list.length && !editing) return null
          return (
            <section key={group} className="card stack">
              <div className="row spread">
                <h2 className="card-title">{group}</h2>
                <span className="small muted num">
                  {list.filter((i) => checked.includes(i.id)).length} of {list.length}
                </span>
              </div>
              <ul className="stack tight">
                {list.map((item) => (
                  <li key={item.id} className="row nowrap">
                    <label className={cx('check-item grow', checked.includes(item.id) && 'done')}>
                      <input type="checkbox" className="check" checked={checked.includes(item.id)} onChange={() => toggle(item.id)} />
                      <span>{item.text}</span>
                    </label>
                    {editing && <Btn variant="ghost" size="sm" aria-label={`Remove "${item.text}"`} icon={<Trash2 size={15} />} onClick={() => setItems((prev) => prev.filter((x) => x.id !== item.id))} />}
                  </li>
                ))}
              </ul>
              {editing && (
                <form
                  className="row nowrap"
                  onSubmit={(e) => {
                    e.preventDefault()
                    addItem(group)
                  }}
                >
                  <Input className="input-sm" aria-label={`New item for ${group}`} placeholder="Add your own step" value={drafts[group] ?? ''} onValue={(v) => setDrafts((prev) => ({ ...prev, [group]: v }))} />
                  <Btn size="sm" type="submit" icon={<Plus size={15} />} disabled={!(drafts[group] ?? '').trim()}>
                    Add
                  </Btn>
                </form>
              )}
            </section>
          )
        })}
      </div>

      <aside className="stack sticky">
        <Signals video={video} />
        <div className="card stack">
          <h2 className="card-title">Reset</h2>
          <div className="row">
            <ConfirmBtn onConfirm={() => setChecked([])}>Untick everything</ConfirmBtn>
            {editing && <ConfirmBtn onConfirm={() => setItems(DEFAULT_ITEMS)}>Restore the default list</ConfirmBtn>}
          </div>
          <p className="small muted">The list itself is shared by all your videos. Ticks are kept separately for each one.</p>
        </div>
      </aside>
    </div>
  )
}

export default function Checklist() {
  const video = useActiveVideo()
  return (
    <>
      <VideoBar />
      {video ? <List key={video.id} video={video} /> : <NeedVideo />}
    </>
  )
}
