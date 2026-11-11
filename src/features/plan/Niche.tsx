import { CircleCheck, Lightbulb, Plus, Trash2 } from 'lucide-react'
import { useCollection, useStored } from '../../lib/store'
import type { Idea } from '../../lib/data'
import { cx, uid } from '../../lib/util'
import { Btn, CopyBtn, Field, Input, Meter, Textarea, toast } from '../../ui/kit'

interface Pillar {
  id: string
  name: string
  example: string
}

export interface NicheDoc {
  topic: string
  viewer: string
  problem: string
  outcome: string
  angle: string
  formats: string[]
  cadence: string
  length: string
  pillars: Pillar[]
  hangouts: string
  searches: string
}

const EMPTY: NicheDoc = {
  topic: '',
  viewer: '',
  problem: '',
  outcome: '',
  angle: '',
  formats: [],
  cadence: '',
  length: '',
  pillars: [],
  hangouts: '',
  searches: '',
}

const FORMATS = ['Tutorials', 'Reviews', 'Vlogs', 'Video essays', 'Interviews', 'Challenges', 'Listicles', 'News and commentary', 'Behind the scenes']

function statement(n: NicheDoc): string {
  const viewer = n.viewer.trim()
  const outcome = n.outcome.trim().replace(/\.$/, '')
  if (!viewer || !outcome) return ''
  const formats = n.formats.length ? n.formats.slice(0, 2).join(' and ').toLowerCase() : 'videos'
  let text = `I help ${viewer} ${outcome}`
  if (n.topic.trim()) text += ` through ${formats} about ${n.topic.trim()}`
  text += '.'
  if (n.angle.trim()) text += ` What sets the channel apart: ${n.angle.trim().replace(/\.$/, '')}.`
  return text
}

export default function Niche() {
  const [stored, setDoc] = useStored<NicheDoc>('niche', EMPTY)
  const doc = { ...EMPTY, ...stored }
  const { items: ideas, add: addIdea } = useCollection<Idea>('ideas')
  const patch = (p: Partial<NicheDoc>) => setDoc((prev) => ({ ...EMPTY, ...prev, ...p }))
  const setPillar = (id: string, p: Partial<Pillar>) => patch({ pillars: doc.pillars.map((x) => (x.id === id ? { ...x, ...p } : x)) })

  const checks: [string, boolean][] = [
    ['Subject', !!doc.topic.trim()],
    ['Viewer', !!doc.viewer.trim()],
    ['Their problem', !!doc.problem.trim()],
    ['The outcome', !!doc.outcome.trim()],
    ['Your angle', !!doc.angle.trim()],
    ['At least one format', doc.formats.length > 0],
    ['Upload cadence', !!doc.cadence.trim()],
    ['Three content pillars', doc.pillars.filter((p) => p.name.trim()).length >= 3],
  ]
  const done = checks.filter(([, ok]) => ok).length
  const text = statement(doc)

  const sendExamples = () => {
    const existing = new Set(ideas.map((i) => i.title.toLowerCase()))
    const fresh = doc.pillars.filter((p) => p.example.trim() && !existing.has(p.example.trim().toLowerCase()))
    fresh.forEach((p) => addIdea({ title: p.example.trim(), notes: '', tags: p.name.trim() ? [p.name.trim()] : [], rating: 0, createdAt: Date.now() }))
    toast(fresh.length ? `${fresh.length} ${fresh.length === 1 ? 'idea' : 'ideas'} added to the idea bank` : 'Those examples are already in the idea bank')
  }

  return (
    <div className="split">
      <div className="stack loose">
        <section className="card stack">
          <h2 className="card-title">The promise</h2>
          <div className="grid cols-2">
            <Field label="Who is the channel for?" hint="One specific kind of person.">
              <Input placeholder="students cooking in shared kitchens" value={doc.viewer} onValue={(viewer) => patch({ viewer })} />
            </Field>
            <Field label="What do they get from watching?" hint="Start with a verb.">
              <Input placeholder="cook real meals in under 20 minutes" value={doc.outcome} onValue={(outcome) => patch({ outcome })} />
            </Field>
            <Field label="The subject">
              <Input placeholder="small-space cooking" value={doc.topic} onValue={(topic) => patch({ topic })} />
            </Field>
            <Field label="What gets in their way today?">
              <Input placeholder="no time, tiny kitchen, small budget" value={doc.problem} onValue={(problem) => patch({ problem })} />
            </Field>
          </div>
          <Field label="Why you? Your angle" hint="Experience, access, personality or a format nobody else is using.">
            <Textarea rows={2} placeholder="I cook everything on one hob in a 4 square metre kitchen" value={doc.angle} onValue={(angle) => patch({ angle })} />
          </Field>
        </section>

        <section className="card stack">
          <h2 className="card-title">Format and rhythm</h2>
          <div className="field">
            <span className="field-label">Formats you will make</span>
            <div className="row" role="group" aria-label="Formats">
              {FORMATS.map((f) => {
                const on = doc.formats.includes(f)
                return (
                  <button
                    key={f}
                    type="button"
                    className={cx('chip', on && 'on')}
                    aria-pressed={on}
                    onClick={() => patch({ formats: on ? doc.formats.filter((x) => x !== f) : [...doc.formats, f] })}
                  >
                    {f}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="grid cols-2">
            <Field label="Upload cadence">
              <Input placeholder="one video every Thursday" value={doc.cadence} onValue={(cadence) => patch({ cadence })} />
            </Field>
            <Field label="Typical video length">
              <Input placeholder="8 to 12 minutes" value={doc.length} onValue={(length) => patch({ length })} />
            </Field>
          </div>
        </section>

        <section className="card stack">
          <div className="card-head" style={{ marginBottom: 0 }}>
            <h2 className="card-title">Content pillars</h2>
            <span className="small muted">Three to five recurring themes</span>
          </div>
          {doc.pillars.map((p, i) => (
            <div key={p.id} className="pillar">
              <span className="pillar-n">{i + 1}</span>
              <Input aria-label={`Pillar ${i + 1} name`} placeholder="Pillar, e.g. One-pan dinners" value={p.name} onValue={(name) => setPillar(p.id, { name })} />
              <Input aria-label={`Pillar ${i + 1} example video`} placeholder="Example video for this pillar" value={p.example} onValue={(example) => setPillar(p.id, { example })} />
              <Btn variant="ghost" size="sm" aria-label={`Remove pillar ${i + 1}`} icon={<Trash2 size={15} />} onClick={() => patch({ pillars: doc.pillars.filter((x) => x.id !== p.id) })} />
            </div>
          ))}
          <div className="row">
            <Btn icon={<Plus size={16} />} disabled={doc.pillars.length >= 5} onClick={() => patch({ pillars: [...doc.pillars, { id: uid(), name: '', example: '' }] })}>
              Add pillar
            </Btn>
            <Btn variant="ghost" icon={<Lightbulb size={16} />} disabled={!doc.pillars.some((p) => p.example.trim())} onClick={sendExamples}>
              Send examples to idea bank
            </Btn>
          </div>
        </section>

        <section className="card stack">
          <h2 className="card-title">Where to find them</h2>
          <div className="grid cols-2">
            <Field label="Where do they hang out online?">
              <Textarea rows={3} placeholder="Subreddits, forums, other channels, hashtags" value={doc.hangouts} onValue={(hangouts) => patch({ hangouts })} />
            </Field>
            <Field label="What do they type into search?">
              <Textarea rows={3} placeholder="One search phrase per line" value={doc.searches} onValue={(searches) => patch({ searches })} />
            </Field>
          </div>
        </section>
      </div>

      <aside className="stack sticky">
        <div className="card stack">
          <h2 className="card-title">Positioning statement</h2>
          {text ? <p className="niche-statement">{text}</p> : <p className="small muted">Fill in who the channel is for and what they get, and a one-line statement appears here.</p>}
          <CopyBtn text={text} label="Copy statement" />
        </div>
        <div className="card stack">
          <div className="row spread">
            <h2 className="card-title">Worksheet progress</h2>
            <span className="small muted num">
              {done} of {checks.length}
            </span>
          </div>
          <Meter label="Worksheet progress" value={done} max={checks.length} />
          <ul className="stack tight">
            {checks.map(([name, ok]) => (
              <li key={name} className={cx('check-line', ok && 'done')}>
                <CircleCheck size={15} />
                {name}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  )
}
