import { ArrowDown, ArrowUp, Clock, FileText, Plus, Trash2 } from 'lucide-react'
import { useDoc } from '../../lib/store'
import {
  EMPTY_CHAPTERS,
  EMPTY_OUTLINE,
  EMPTY_SCRIPT,
  outlineToScript,
  useActiveVideo,
  type Chapter,
  type OutlineSection,
  type ScriptDoc,
  type Video,
} from '../../lib/data'
import { fmtSpan, fmtTime, uid } from '../../lib/util'
import { Btn, ConfirmBtn, Input, NeedVideo, Textarea, TimeInput, VideoBar, toast } from '../../ui/kit'

type PresetSection = [heading: string, seconds: number, notes: string]

const PRESETS: { name: string; blurb: string; sections: PresetSection[] }[] = [
  {
    name: 'Tutorial',
    blurb: 'Teach one thing step by step.',
    sections: [
      ['Hook', 20, 'Show the finished result'],
      ['What you need', 40, ''],
      ['Step 1', 120, ''],
      ['Step 2', 120, ''],
      ['Step 3', 120, ''],
      ['Common mistakes', 60, ''],
      ['Recap and next video', 30, ''],
    ],
  },
  {
    name: 'List video',
    blurb: 'Several items, strongest teased first.',
    sections: [
      ['Hook', 20, 'Tease the best item'],
      ['Item 1', 90, ''],
      ['Item 2', 90, ''],
      ['Item 3', 90, ''],
      ['Item 4', 90, ''],
      ['Item 5', 90, ''],
      ['Wrap-up and next video', 30, ''],
    ],
  },
  {
    name: 'Review',
    blurb: 'A verdict, then the reasons.',
    sections: [
      ['Hook', 20, 'The verdict in one line'],
      ['What it is and who it is for', 45, ''],
      ['What I liked', 120, ''],
      ['What I did not like', 90, ''],
      ['Compared with the alternatives', 90, ''],
      ['Verdict', 45, ''],
      ['Next video', 20, ''],
    ],
  },
  {
    name: 'Story or vlog',
    blurb: 'A goal, an obstacle and an outcome.',
    sections: [
      ['Cold open', 25, 'Start in the middle of the action'],
      ['Setup', 60, 'What I am trying to do and why'],
      ['The attempt', 180, ''],
      ['The problem', 90, ''],
      ['The turn', 90, ''],
      ['Outcome', 60, ''],
      ['What I learned', 45, ''],
    ],
  },
  {
    name: 'Explainer',
    blurb: 'Answer one question clearly.',
    sections: [
      ['Hook', 20, 'The question this video answers'],
      ['Why it matters', 45, ''],
      ['The simple version', 90, ''],
      ['Going deeper', 150, ''],
      ['An example', 90, ''],
      ['Common misunderstandings', 60, ''],
      ['Summary', 30, ''],
    ],
  },
]

function Builder({ video }: { video: Video }) {
  const [sections, setSections] = useDoc<OutlineSection[]>('outlines', video.id, EMPTY_OUTLINE)
  const [script, setScript] = useDoc<ScriptDoc>('scripts', video.id, EMPTY_SCRIPT)
  const [chapters, setChapters] = useDoc<Chapter[]>('chapters', video.id, EMPTY_CHAPTERS)
  const total = sections.reduce((sum, s) => sum + s.seconds, 0)

  const patch = (id: string, p: Partial<OutlineSection>) => setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...p } : s)))

  const move = (index: number, dir: -1 | 1) =>
    setSections((prev) => {
      const target = index + dir
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })

  const applyPreset = (preset: (typeof PRESETS)[number]) =>
    setSections(preset.sections.map(([heading, seconds, notes]) => ({ id: uid(), heading, seconds, notes })))

  const toScript = () => {
    const skeleton = outlineToScript(sections)
    setScript((prev) => ({ body: prev.body.trim() ? `${prev.body.trimEnd()}\n\n${skeleton}` : skeleton }))
    toast(script.body.trim() ? 'Outline added to the end of the script' : 'Script skeleton created')
  }

  const toChapters = () => {
    let at = 0
    const next: Chapter[] = []
    for (const s of sections) {
      next.push({ id: uid(), time: at, title: s.heading.trim() || 'Untitled section' })
      at += s.seconds
    }
    setChapters(next)
    toast('Chapters created from the outline')
  }

  if (sections.length === 0) {
    return (
      <div className="stack">
        <p className="muted">Pick a structure to start from. Every heading, note and duration can be changed.</p>
        <div className="grid cols-auto">
          {PRESETS.map((p) => (
            <button key={p.name} type="button" className="card preset" onClick={() => applyPreset(p)}>
              <strong>{p.name}</strong>
              <span className="small muted">{p.blurb}</span>
              <span className="tiny muted">
                {p.sections.length} sections · about {fmtSpan(p.sections.reduce((sum, s) => sum + s[1], 0))}
              </span>
            </button>
          ))}
          <button type="button" className="card preset" onClick={() => setSections([{ id: uid(), heading: 'Hook', seconds: 20, notes: '' }])}>
            <strong>Blank outline</strong>
            <span className="small muted">Start with a single hook section.</span>
          </button>
        </div>
      </div>
    )
  }

  let startsAt = 0
  return (
    <div className="split">
      <div className="stack">
        {sections.map((s, i) => {
          const start = startsAt
          startsAt += s.seconds
          return (
            <section key={s.id} className="card outline-row">
              <div className="outline-time num">{fmtTime(start)}</div>
              <div className="stack tight grow">
                <div className="row nowrap">
                  <Input className="grow" aria-label={`Section ${i + 1} heading`} placeholder="Section heading" value={s.heading} onValue={(heading) => patch(s.id, { heading })} />
                  <TimeInput className="outline-dur" aria-label={`Section ${i + 1} length`} title="Length (m:ss)" value={s.seconds} onValue={(seconds) => patch(s.id, { seconds })} />
                </div>
                <Textarea rows={2} aria-label={`Section ${i + 1} notes`} placeholder="Points to make, one per line" value={s.notes} onValue={(notes) => patch(s.id, { notes })} />
              </div>
              <div className="outline-actions">
                <Btn variant="ghost" size="sm" aria-label="Move section up" disabled={i === 0} icon={<ArrowUp size={15} />} onClick={() => move(i, -1)} />
                <Btn variant="ghost" size="sm" aria-label="Move section down" disabled={i === sections.length - 1} icon={<ArrowDown size={15} />} onClick={() => move(i, 1)} />
                <Btn variant="ghost" size="sm" aria-label="Delete section" icon={<Trash2 size={15} />} onClick={() => setSections((prev) => prev.filter((x) => x.id !== s.id))} />
              </div>
            </section>
          )
        })}
        <div>
          <Btn icon={<Plus size={16} />} onClick={() => setSections((prev) => [...prev, { id: uid(), heading: '', seconds: 60, notes: '' }])}>
            Add section
          </Btn>
        </div>
      </div>

      <aside className="stack sticky">
        <div className="card stack">
          <div>
            <div className="stat-label">Planned runtime</div>
            <div className="stat-value">{fmtTime(total)}</div>
            <div className="stat-hint">{sections.length} sections</div>
          </div>
        </div>
        <div className="card stack">
          <h2 className="card-title">Use this outline</h2>
          <Btn icon={<FileText size={16} />} onClick={toScript}>
            {script.body.trim() ? 'Add to the script' : 'Create script skeleton'}
          </Btn>
          {chapters.length > 0 ? (
            <ConfirmBtn icon={<Clock size={16} />} confirmLabel="Replace existing chapters?" onConfirm={toChapters}>
              Turn into chapters
            </ConfirmBtn>
          ) : (
            <Btn icon={<Clock size={16} />} onClick={toChapters}>
              Turn into chapters
            </Btn>
          )}
          <ConfirmBtn onConfirm={() => setSections([])}>Clear and pick another structure</ConfirmBtn>
        </div>
      </aside>
    </div>
  )
}

export default function Outline() {
  const video = useActiveVideo()
  return (
    <>
      <VideoBar />
      {video ? <Builder key={video.id} video={video} /> : <NeedVideo />}
    </>
  )
}
