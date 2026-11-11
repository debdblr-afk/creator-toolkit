import { useEffect, useMemo, useRef, useState } from 'react'
import { Captions, Download, FileText, Merge, Plus, Scissors, Trash2, Upload } from 'lucide-react'
import { useDoc } from '../../lib/store'
import { EMPTY_SCRIPT, spokenText, useActiveVideo, useSettings, type ScriptDoc, type Video } from '../../lib/data'
import { countWords, cx, download, fmtTime, pad2, slugify, uid } from '../../lib/util'
import { Btn, ConfirmBtn, CopyBtn, Empty, Field, Modal, NeedVideo, NumInput, Status, Textarea, VideoBar, toast } from '../../ui/kit'

export interface Cue {
  id: string
  start: number
  end: number
  text: string
}

const EMPTY_CUES: Cue[] = []
const r3 = (n: number): number => Math.round(n * 1000) / 1000

function stamp(sec: number, sep: ',' | '.'): string {
  const ms = Math.max(0, Math.round(sec * 1000))
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}${sep}${String(ms % 1000).padStart(3, '0')}`
}

function parseStamp(text: string): number | null {
  const m = text.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?$/)
  if (!m) return null
  return r3(Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + (m[4] ? Number(m[4].padEnd(3, '0')) / 1000 : 0))
}

/** Reads SRT or WebVTT. Anything without a "start --> end" line is ignored. */
function parseSubs(text: string): Cue[] {
  const cues: Cue[] = []
  for (const block of text.replace(/\r/g, '').split(/\n{2,}/)) {
    const lines = block.split('\n').filter((l) => l.trim() !== '')
    const at = lines.findIndex((l) => l.includes('-->'))
    if (at < 0) continue
    const [from, to = ''] = lines[at].split('-->')
    const start = parseStamp(from)
    const end = parseStamp(to.trim().split(/\s+/)[0] ?? '')
    if (start == null || end == null) continue
    cues.push({ id: uid(), start, end, text: lines.slice(at + 1).join('\n') })
  }
  return cues.sort((a, b) => a.start - b.start)
}

const toSrt = (cues: Cue[]): string => cues.map((c, i) => `${i + 1}\n${stamp(c.start, ',')} --> ${stamp(c.end, ',')}\n${c.text.trim()}\n`).join('\n')
const toVtt = (cues: Cue[]): string => `WEBVTT\n\n${cues.map((c) => `${stamp(c.start, '.')} --> ${stamp(c.end, '.')}\n${c.text.trim()}\n`).join('\n')}`

/** Break a line in two near the middle, at a space. */
function wrapTwo(text: string): string {
  if (text.length <= 42) return text
  const mid = text.length / 2
  let best = -1
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i
  }
  return best < 0 ? text : `${text.slice(0, best)}\n${text.slice(best + 1)}`
}

/** A first draft of captions from the script, timed by speaking pace. Timings need checking against the edit. */
function fromScript(text: string, wpm: number): Cue[] {
  const sentences = text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]*\s*/g) ?? []
  const chunks: string[] = []
  for (const sentence of sentences) {
    let current = ''
    for (const word of sentence.trim().split(' ')) {
      if (current && `${current} ${word}`.length > 84) {
        chunks.push(current)
        current = word
      } else current = current ? `${current} ${word}` : word
    }
    if (current) chunks.push(current)
  }
  let at = 0
  return chunks.map((chunk) => {
    const length = Math.max(1.2, (countWords(chunk) / wpm) * 60)
    const cue: Cue = { id: uid(), start: r3(at), end: r3(at + length - 0.05), text: wrapTwo(chunk) }
    at += length
    return cue
  })
}

function issues(c: Cue, prev: Cue | undefined): string[] {
  const out: string[] = []
  const length = c.end - c.start
  if (length <= 0) out.push('Ends before it starts.')
  if (prev && c.start < prev.end) out.push('Overlaps the caption before it.')
  const lines = c.text.split('\n')
  if (lines.length > 2) out.push('More than two lines.')
  if (lines.some((l) => l.length > 42)) out.push('A line is longer than 42 characters.')
  const chars = c.text.replace(/\s+/g, ' ').trim().length
  if (length > 0 && chars / length > 20) out.push(`Too fast to read comfortably: ${Math.round(chars / length)} characters a second.`)
  if (length > 7) out.push('On screen for more than 7 seconds.')
  return out
}

function StampInput({ value, onValue, label }: { value: number; onValue: (n: number) => void; label: string }) {
  const [text, setText] = useState(() => stamp(value, ','))
  useEffect(() => {
    if (parseStamp(text) !== value) setText(stamp(value, ','))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <input
      className="input input-sm stamp"
      aria-label={label}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        const n = parseStamp(e.target.value)
        if (n != null) onValue(n)
      }}
      onBlur={() => setText(stamp(value, ','))}
    />
  )
}

function Editor({ video }: { video: Video }) {
  const [cues, setCues] = useDoc<Cue[]>('subs', video.id, EMPTY_CUES)
  const [script] = useDoc<ScriptDoc>('scripts', video.id, EMPTY_SCRIPT)
  const [settings] = useSettings()
  const [importing, setImporting] = useState(false)
  const [raw, setRaw] = useState('')
  const [shift, setShift] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  const spoken = spokenText(script.body)
  const parsed = useMemo(() => (raw.trim() ? parseSubs(raw) : []), [raw])
  const flagged = cues.filter((c, i) => issues(c, cues[i - 1]).length > 0).length
  const file = slugify(video.title)

  const patch = (id: string, p: Partial<Cue>) => setCues((prev) => prev.map((c) => (c.id === id ? { ...c, ...p } : c)))

  const generate = () => {
    const next = fromScript(spoken, settings.wpm)
    setCues(next)
    toast(`${next.length} captions drafted from the script. Check the timings against your edit.`)
  }

  const split = (cue: Cue) => {
    const text = cue.text.replace(/\n/g, ' ')
    const mid = text.length / 2
    let best = -1
    for (let i = 0; i < text.length; i++) {
      if (text[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i
    }
    if (best < 0) {
      toast('There is no space to split this caption at.')
      return
    }
    const cut = r3(cue.start + (cue.end - cue.start) * (best / text.length))
    setCues((prev) =>
      prev.flatMap((c) =>
        c.id === cue.id
          ? [
              { ...c, end: r3(Math.max(c.start, cut - 0.04)), text: text.slice(0, best).trim() },
              { id: uid(), start: cut, end: c.end, text: text.slice(best + 1).trim() },
            ]
          : [c],
      ),
    )
  }

  const merge = (index: number) =>
    setCues((prev) => {
      const a = prev[index]
      const b = prev[index + 1]
      if (!a || !b) return prev
      return [...prev.slice(0, index), { ...a, end: b.end, text: `${a.text}\n${b.text}` }, ...prev.slice(index + 2)]
    })

  const addAfter = (index: number) =>
    setCues((prev) => {
      const before = prev[index]
      const start = before ? r3(before.end + 0.1) : 0
      const fresh: Cue = { id: uid(), start, end: r3(start + 2), text: '' }
      return [...prev.slice(0, index + 1), fresh, ...prev.slice(index + 1)]
    })

  const applyShift = () => {
    if (!shift) return
    setCues((prev) => prev.map((c) => ({ ...c, start: Math.max(0, r3(c.start + shift)), end: Math.max(0, r3(c.end + shift)) })))
    toast(`Every caption moved ${Math.abs(shift)} s ${shift > 0 ? 'later' : 'earlier'}`)
  }

  const closeImport = () => {
    setImporting(false)
    setRaw('')
  }

  const importModal = importing && (
    <Modal
      title="Import captions"
      wide
      onClose={closeImport}
      footer={
        <>
          <Btn variant="ghost" onClick={closeImport}>
            Cancel
          </Btn>
          <Btn
            variant="primary"
            disabled={!parsed.length}
            onClick={() => {
              setCues(parsed)
              toast(`${parsed.length} captions imported`)
              closeImport()
            }}
          >
            {cues.length ? `Replace ${cues.length} captions with ${parsed.length}` : `Use ${parsed.length} captions`}
          </Btn>
        </>
      }
    >
      <div className="stack">
        <div>
          <Btn icon={<Upload size={16} />} onClick={() => fileRef.current?.click()}>
            Choose an .srt or .vtt file
          </Btn>
          <input
            ref={fileRef}
            type="file"
            accept=".srt,.vtt,text/plain,text/vtt"
            hidden
            onChange={(e) => {
              const picked = e.target.files?.[0]
              e.target.value = ''
              picked?.text().then(setRaw).catch(() => toast('That file could not be read.'))
            }}
          />
        </div>
        <Field label="Or paste captions here">
          <Textarea rows={10} placeholder={'1\n00:00:00,000 --> 00:00:02,400\nThe first caption'} value={raw} onValue={setRaw} />
        </Field>
        {raw.trim() &&
          (parsed.length ? (
            <Status tone="good">{parsed.length} captions found.</Status>
          ) : (
            <Status tone="bad">No captions found. Each one needs a timing line such as 00:00:01,000 --&gt; 00:00:03,000.</Status>
          ))}
      </div>
    </Modal>
  )

  if (cues.length === 0) {
    return (
      <>
        <Empty
          icon={<Captions size={22} />}
          title="No captions for this video yet"
          action={
            <>
              {spoken && (
                <Btn variant="primary" icon={<FileText size={16} />} onClick={generate}>
                  Draft from the script
                </Btn>
              )}
              <Btn icon={<Upload size={16} />} onClick={() => setImporting(true)}>
                Import SRT or VTT
              </Btn>
              <Btn icon={<Plus size={16} />} onClick={() => addAfter(-1)}>
                Start from scratch
              </Btn>
            </>
          }
        >
          Draft captions from your script, import a file exported by your editor, or write them by hand. Captions help viewers watching without sound.
        </Empty>
        {importModal}
      </>
    )
  }

  return (
    <div className="stack">
      <div className="card stack">
        <div className="row spread">
          <div className="row">
            <Btn variant="primary" icon={<Download size={16} />} onClick={() => download(`${file}.srt`, toSrt(cues))}>
              Export .srt
            </Btn>
            <Btn icon={<Download size={16} />} onClick={() => download(`${file}.vtt`, toVtt(cues), 'text/vtt;charset=utf-8')}>
              Export .vtt
            </Btn>
            <CopyBtn text={toSrt(cues)} label="Copy SRT" />
          </div>
          <div className="row">
            <Btn icon={<Upload size={16} />} onClick={() => setImporting(true)}>
              Import
            </Btn>
            {spoken && (
              <ConfirmBtn icon={<FileText size={16} />} confirmLabel="Replace all captions?" onConfirm={generate}>
                Redraft from script
              </ConfirmBtn>
            )}
            <ConfirmBtn icon={<Trash2 size={16} />} confirmLabel="Delete all captions?" onConfirm={() => setCues([])}>
              Clear
            </ConfirmBtn>
          </div>
        </div>
        <div className="row spread">
          <span className="small muted">
            {cues.length} captions · ends at {fmtTime(cues[cues.length - 1].end)}
          </span>
          <div className="row">
            <span className="small">Move every caption by</span>
            <NumInput className="input-sm shift-input" aria-label="Seconds to move every caption by" step={0.1} value={shift} onValue={setShift} />
            <span className="small">seconds</span>
            <Btn size="sm" disabled={!shift} onClick={applyShift}>
              Apply
            </Btn>
          </div>
        </div>
        {flagged > 0 ? (
          <Status tone="warn">
            {flagged} {flagged === 1 ? 'caption needs' : 'captions need'} a look. The checks follow common captioning guidelines: two lines, 42 characters a line, 20 characters a second.
          </Status>
        ) : (
          <Status tone="good">Every caption passes the length and reading-speed checks.</Status>
        )}
      </div>

      {cues.map((c, i) => {
        const problems = issues(c, cues[i - 1])
        return (
          <div key={c.id} className={cx('card cue', problems.length > 0 && 'flag')}>
            <span className="cue-n num">{i + 1}</span>
            <div className="cue-times">
              <StampInput label={`Caption ${i + 1} start`} value={c.start} onValue={(start) => patch(c.id, { start })} />
              <StampInput label={`Caption ${i + 1} end`} value={c.end} onValue={(end) => patch(c.id, { end })} />
            </div>
            <div className="stack tight grow cue-body">
              <Textarea rows={2} aria-label={`Caption ${i + 1} text`} value={c.text} onValue={(text) => patch(c.id, { text })} />
              {problems.map((p) => (
                <Status key={p} tone="warn">
                  {p}
                </Status>
              ))}
            </div>
            <div className="cue-actions">
              <Btn variant="ghost" size="sm" aria-label={`Split caption ${i + 1} in two`} icon={<Scissors size={15} />} onClick={() => split(c)} />
              <Btn variant="ghost" size="sm" aria-label={`Merge caption ${i + 1} with the next one`} disabled={i === cues.length - 1} icon={<Merge size={15} />} onClick={() => merge(i)} />
              <Btn variant="ghost" size="sm" aria-label={`Add a caption after ${i + 1}`} icon={<Plus size={15} />} onClick={() => addAfter(i)} />
              <Btn variant="ghost" size="sm" aria-label={`Delete caption ${i + 1}`} icon={<Trash2 size={15} />} onClick={() => setCues((prev) => prev.filter((x) => x.id !== c.id))} />
            </div>
          </div>
        )
      })}
      {importModal}
    </div>
  )
}

export default function Subtitles() {
  const video = useActiveVideo()
  return (
    <>
      <VideoBar />
      {video ? <Editor key={video.id} video={video} /> : <NeedVideo />}
    </>
  )
}
