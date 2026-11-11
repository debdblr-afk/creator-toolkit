import { useState } from 'react'
import { ArrowDownUp, ListTree, Plus, Trash2 } from 'lucide-react'
import { useDoc } from '../../lib/store'
import { EMPTY_CHAPTERS, EMPTY_OUTLINE, chapterProblems, chaptersText, useActiveVideo, type Chapter, type OutlineSection, type Video } from '../../lib/data'
import { parseTime, uid } from '../../lib/util'
import { Btn, ConfirmBtn, CopyBtn, Field, Input, NeedVideo, Status, Textarea, TimeInput, VideoBar, toast } from '../../ui/kit'

/** Pull "1:23 Title" or "Title - 1:23" lines out of rough notes. */
function parseChapters(text: string): Chapter[] {
  const out: Chapter[] = []
  for (const line of text.split('\n')) {
    const m = line.match(/(?:\d{1,2}:)?\d{1,2}:\d{2}/)
    if (!m || m.index === undefined) continue
    const time = parseTime(m[0])
    if (time == null) continue
    const title = `${line.slice(0, m.index)} ${line.slice(m.index + m[0].length)}`
      .replace(/^[\s\-–—:|.)\]]+|[\s\-–—:|(\[]+$/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
    out.push({ id: uid(), time, title })
  }
  return out
}

function Editor({ video }: { video: Video }) {
  const [chapters, setChapters] = useDoc<Chapter[]>('chapters', video.id, EMPTY_CHAPTERS)
  const [outline] = useDoc<OutlineSection[]>('outlines', video.id, EMPTY_OUTLINE)
  const [notes, setNotes] = useState('')

  const patch = (id: string, p: Partial<Chapter>) => setChapters((prev) => prev.map((c) => (c.id === id ? { ...c, ...p } : c)))
  const problems = chapterProblems(chapters)
  const outOfOrder = chapters.some((c, i) => i > 0 && c.time < chapters[i - 1].time)
  const found = notes.trim() ? parseChapters(notes) : []

  const fromOutline = () => {
    let at = 0
    const next: Chapter[] = []
    for (const s of outline) {
      next.push({ id: uid(), time: at, title: s.heading.trim() || 'Untitled section' })
      at += s.seconds
    }
    setChapters(next)
    toast('Chapters created from the outline. Adjust the times to match the final edit.')
  }

  const addChapter = () =>
    setChapters((prev) => {
      const last = prev[prev.length - 1]
      return [...prev, { id: uid(), time: last ? last.time + 60 : 0, title: prev.length ? '' : 'Intro' }]
    })

  return (
    <div className="split even">
      <div className="stack">
        <section className="card stack">
          <div className="row spread">
            <h2 className="card-title">Chapters</h2>
            <div className="row">
              {outOfOrder && (
                <Btn size="sm" icon={<ArrowDownUp size={15} />} onClick={() => setChapters((prev) => [...prev].sort((a, b) => a.time - b.time))}>
                  Sort by time
                </Btn>
              )}
              {outline.length > 0 &&
                (chapters.length ? (
                  <ConfirmBtn size="sm" icon={<ListTree size={15} />} confirmLabel="Replace these chapters?" onConfirm={fromOutline}>
                    From outline
                  </ConfirmBtn>
                ) : (
                  <Btn size="sm" icon={<ListTree size={15} />} onClick={fromOutline}>
                    From outline
                  </Btn>
                ))}
            </div>
          </div>

          {chapters.length === 0 && <p className="small muted">Add the moment each part of the video starts. The first chapter always starts at 0:00.</p>}

          {chapters.map((c, i) => (
            <div key={c.id} className="chapter-row">
              <TimeInput aria-label={`Chapter ${i + 1} start time`} value={c.time} onValue={(time) => patch(c.id, { time })} />
              <Input aria-label={`Chapter ${i + 1} title`} placeholder="Chapter title" value={c.title} onValue={(title) => patch(c.id, { title })} />
              <Btn variant="ghost" size="sm" aria-label={`Delete chapter ${i + 1}`} icon={<Trash2 size={15} />} onClick={() => setChapters((prev) => prev.filter((x) => x.id !== c.id))} />
            </div>
          ))}

          <div>
            <Btn icon={<Plus size={16} />} onClick={addChapter}>
              Add chapter
            </Btn>
          </div>
        </section>

        <section className="card stack">
          <h2 className="card-title">Paste rough notes</h2>
          <Field label="Any lines with a time in them" hint="For example the markers exported from your editor, or notes like “Intro 0:00”.">
            <Textarea rows={4} placeholder={'0:00 Intro\n1:15 What you need\nFirst cut - 3:40'} value={notes} onValue={setNotes} />
          </Field>
          <div className="row">
            <Btn
              disabled={!found.length}
              onClick={() => {
                setChapters((prev) => [...prev, ...found].sort((a, b) => a.time - b.time))
                setNotes('')
                toast(`${found.length} ${found.length === 1 ? 'chapter' : 'chapters'} added`)
              }}
            >
              Add {found.length || ''} {found.length === 1 ? 'chapter' : 'chapters'} from notes
            </Btn>
          </div>
        </section>
      </div>

      <aside className="stack sticky">
        <div className="card stack">
          <h2 className="card-title">Check against YouTube&rsquo;s rules</h2>
          {chapters.length === 0 ? (
            <p className="small muted">The rules are checked as you add chapters: at least three, starting at 0:00, in order, each at least 10 seconds long.</p>
          ) : problems.length ? (
            <div className="stack tight">
              {problems.map((p) => (
                <Status key={p} tone="bad">
                  {p}
                </Status>
              ))}
            </div>
          ) : (
            <Status tone="good">These timestamps meet the rules. Paste them into the description and YouTube will show chapters on the progress bar.</Status>
          )}
        </div>
        <div className="card stack">
          <div className="row spread">
            <h2 className="card-title">Ready to paste</h2>
            <CopyBtn size="sm" text={chaptersText(chapters)} />
          </div>
          {chapters.length ? <div className="desc-out pre num">{chaptersText(chapters)}</div> : <p className="small muted">Your formatted chapter list appears here.</p>}
          <p className="small muted">The description builder includes this list automatically.</p>
        </div>
      </aside>
    </div>
  )
}

export default function Chapters() {
  const video = useActiveVideo()
  return (
    <>
      <VideoBar />
      {video ? <Editor key={video.id} video={video} /> : <NeedVideo />}
    </>
  )
}
