import { useMemo, useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { useDoc } from '../../lib/store'
import { EMPTY_STRINGS, useActiveVideo, useVideos } from '../../lib/data'
import { cx } from '../../lib/util'
import { Btn, CopyBtn, Field, Input, NumInput, Status, VideoBar, toast, type Tone } from '../../ui/kit'

const MINOR = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'for', 'with', 'on', 'at', 'by', 'vs'])

/** Capitalise a phrase for a title, leaving words that already contain capitals (iPhone, DSLR) alone. */
function titleCase(phrase: string): string {
  return phrase
    .trim()
    .split(/\s+/)
    .map((w, i) => (/[A-Z]/.test(w) || (i > 0 && MINOR.has(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
}

type Need = 'topic' | 'goal' | 'alt'

const FORMULAS: { text: string; needs: Need[] }[] = [
  { text: '{Topic} for Beginners: Start Here', needs: ['topic'] },
  { text: '{N} {Topic} Mistakes to Avoid', needs: ['topic'] },
  { text: '{Topic} Explained in {N} Minutes', needs: ['topic'] },
  { text: 'The Truth About {Topic}', needs: ['topic'] },
  { text: 'Everything I Wish I Knew About {Topic}', needs: ['topic'] },
  { text: 'Is {Topic} Worth It in {Year}?', needs: ['topic'] },
  { text: '{N} {Topic} Tips That Actually Work', needs: ['topic'] },
  { text: 'What Nobody Tells You About {Topic}', needs: ['topic'] },
  { text: 'I Tried {Topic} for {N} Days', needs: ['topic'] },
  { text: 'My Honest {Topic} Review After {N} Months', needs: ['topic'] },
  { text: 'The {N}-Step {Topic} Method', needs: ['topic'] },
  { text: 'Stop Doing This With {Topic}', needs: ['topic'] },
  { text: '{Topic} vs {Alt}: Which Is Better?', needs: ['topic', 'alt'] },
  { text: 'How to {Goal} (Step by Step)', needs: ['goal'] },
  { text: 'How to {Goal} Without the Usual Mistakes', needs: ['goal'] },
  { text: '{N} Ways to {Goal}', needs: ['goal'] },
  { text: 'The Fastest Way to {Goal}', needs: ['goal'] },
  { text: 'Watch This Before You {Goal}', needs: ['goal'] },
  { text: '{Topic}: How to {Goal}', needs: ['topic', 'goal'] },
]

function analyse(title: string, keyword: string): { tone: Tone; text: string }[] {
  const len = title.trim().length
  if (!len) return []
  const out: { tone: Tone; text: string }[] = []
  if (len > 100) out.push({ tone: 'bad', text: `${len} characters. YouTube allows 100 at most.` })
  else if (len > 70) out.push({ tone: 'warn', text: `${len} characters. Expect it to be cut off in search and suggested videos.` })
  else if (len > 60) out.push({ tone: 'warn', text: `${len} characters. It may be cut off on smaller screens.` })
  else out.push({ tone: 'good', text: `${len} characters. Short enough to show in full in most places.` })

  const kw = keyword.trim().toLowerCase()
  if (kw) {
    const at = title.toLowerCase().indexOf(kw)
    if (at < 0) out.push({ tone: 'warn', text: 'The topic is missing from the title.' })
    else if (at <= 25) out.push({ tone: 'good', text: 'The topic appears early, where it is hardest to miss.' })
    else out.push({ tone: 'info', text: 'The topic appears late. Try moving it nearer the start.' })
  }

  const caps = (title.match(/\b[A-Z]{3,}\b/g) ?? []).length
  if (caps > 2) out.push({ tone: 'warn', text: `${caps} words in capitals. One or two is plenty.` })
  if (/[!?]{2,}/.test(title)) out.push({ tone: 'warn', text: 'Repeated punctuation reads as clickbait.' })
  out.push(
    /\d/.test(title)
      ? { tone: 'good', text: 'Includes a number, which makes the promise concrete.' }
      : { tone: 'info', text: 'No number. That is fine; a number can make a promise more concrete.' },
  )
  return out
}

export default function Titles() {
  const { update } = useVideos()
  const video = useActiveVideo()
  const [shortlist, setShortlist] = useDoc<string[]>('titles', video?.id, EMPTY_STRINGS)
  const [topic, setTopic] = useState('')
  const [goal, setGoal] = useState('')
  const [alt, setAlt] = useState('')
  const [n, setN] = useState(5)
  const [focus, setFocus] = useState('')

  const candidates = useMemo(() => {
    const has: Record<Need, boolean> = { topic: !!topic.trim(), goal: !!goal.trim(), alt: !!alt.trim() }
    const values: Record<string, string> = {
      Topic: titleCase(topic),
      Goal: titleCase(goal),
      Alt: titleCase(alt),
      N: String(n || 5),
      Year: String(new Date().getFullYear()),
    }
    return FORMULAS.filter((f) => f.needs.every((k) => has[k])).map((f) => f.text.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? ''))
  }, [topic, goal, alt, n])

  const inspect = focus.trim()
  const findings = analyse(inspect, topic)

  const save = (title: string) => {
    const t = title.trim()
    if (!t || !video) return
    setShortlist((prev) => (prev.includes(t) ? prev : [...prev, t]))
  }

  const applyTitle = (title: string) => {
    if (!video) return
    update(video.id, { title })
    toast('Video title updated')
  }

  return (
    <>
      <VideoBar />
      <div className="split even">
        <div className="stack">
          <section className="card stack">
            <h2 className="card-title">Generate options</h2>
            <div className="grid cols-2">
              <Field label="Topic" hint="A thing: a noun phrase.">
                <Input placeholder="sourdough bread" value={topic} onValue={setTopic} />
              </Field>
              <Field label="Goal" hint="An action: starts with a verb.">
                <Input placeholder="bake your first loaf" value={goal} onValue={setGoal} />
              </Field>
              <Field label="Number to use">
                <NumInput min={1} value={n} onValue={setN} />
              </Field>
              <Field label="Compared with" hint="Optional, for a versus title.">
                <Input placeholder="yeast bread" value={alt} onValue={setAlt} />
              </Field>
            </div>
          </section>

          <section className="card stack">
            <div className="row spread">
              <h2 className="card-title">Options</h2>
              <span className="small muted">{candidates.length} titles</span>
            </div>
            {candidates.length === 0 ? (
              <p className="small muted">Enter a topic or a goal above to see title options built from common formulas.</p>
            ) : (
              <ul className="title-list">
                {candidates.map((c) => (
                  <li key={c}>
                    <button type="button" className={cx('title-pick', inspect === c && 'on')} aria-pressed={inspect === c} onClick={() => setFocus(c)}>
                      {c}
                    </button>
                    <span className="small muted num">{c.length}</span>
                    {c.length > 60 && <span className="badge warn">Long</span>}
                    <Btn
                      variant="ghost"
                      size="sm"
                      aria-label={`Add "${c}" to the shortlist`}
                      disabled={!video || shortlist.includes(c)}
                      icon={shortlist.includes(c) ? <Check size={15} /> : <Plus size={15} />}
                      onClick={() => save(c)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="stack">
          <section className="card stack">
            <h2 className="card-title">Check a title</h2>
            <Input aria-label="Title to check" placeholder="Type a title, or pick one from the options" value={focus} onValue={setFocus} />
            {inspect ? (
              <>
                <div className="stack tight">
                  {findings.map((f, i) => (
                    <Status key={i} tone={f.tone}>
                      {f.text}
                    </Status>
                  ))}
                </div>
                <div className="title-previews">
                  <div className="title-preview">
                    <div className="title-thumb" />
                    <p className="title-clamp">{inspect}</p>
                    <span className="tiny muted">Home feed card</span>
                  </div>
                  <div className="title-preview side">
                    <div className="title-thumb" />
                    <div>
                      <p className="title-clamp">{inspect}</p>
                      <span className="tiny muted">Suggested list</span>
                    </div>
                  </div>
                </div>
                <div className="row">
                  <Btn icon={<Plus size={16} />} disabled={!video || shortlist.includes(inspect)} onClick={() => save(inspect)}>
                    Add to shortlist
                  </Btn>
                  <CopyBtn text={inspect} />
                </div>
              </>
            ) : (
              <p className="small muted">You will see a length check, a few style checks and a preview of where the title gets cut off.</p>
            )}
          </section>

          <section className="card stack">
            <h2 className="card-title">Shortlist{video ? ` for “${video.title}”` : ''}</h2>
            {!video ? (
              <p className="small muted">Name a video project in the bar above to keep a shortlist for it.</p>
            ) : shortlist.length === 0 ? (
              <p className="small muted">Nothing shortlisted yet. Keep three to five strong options, then choose.</p>
            ) : (
              <ul className="title-list">
                {shortlist.map((s) => (
                  <li key={s}>
                    <button type="button" className={cx('title-pick', inspect === s && 'on')} aria-pressed={inspect === s} onClick={() => setFocus(s)}>
                      {s}
                    </button>
                    {video.title === s ? (
                      <span className="badge good">Current title</span>
                    ) : (
                      <Btn size="sm" onClick={() => applyTitle(s)}>
                        Use as title
                      </Btn>
                    )}
                    <Btn variant="ghost" size="sm" aria-label={`Remove "${s}" from the shortlist`} icon={<X size={15} />} onClick={() => setShortlist((prev) => prev.filter((x) => x !== s))} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  )
}
