import { useMemo, useState, type DragEvent } from 'react'
import { ChevronLeft, ChevronRight, Megaphone, Plus } from 'lucide-react'
import { useCollection } from '../../lib/store'
import { STAGES, newVideo, promoKindName, stageName, useVideos, type Promo, type Video } from '../../lib/data'
import { Link } from '../../lib/router'
import { cx, fmtDateLong, parseISO, toISO, today } from '../../lib/util'
import { Btn, Field, Input, Modal, Select, StageBadge, VideoModal } from '../../ui/kit'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Whole weeks (Monday first) covering the month. */
function monthDays(year: number, month: number): string[] {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7
  const days = Array.from({ length: 42 }, (_, i) => toISO(new Date(year, month, 1 - offset + i)))
  while (days.length > 28 && parseISO(days[days.length - 7]).getMonth() !== month) days.splice(-7)
  return days
}

function group<T>(items: T[], key: (item: T) => string | undefined): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const k = key(item)
    if (!k) continue
    const list = map.get(k)
    if (list) list.push(item)
    else map.set(k, [item])
  }
  return map
}

export default function UploadCalendar() {
  const { items: videos, add, update } = useVideos()
  const { items: promos } = useCollection<Promo>('promos')
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [over, setOver] = useState<string | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  const [pick, setPick] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const editing = videos.find((v) => v.id === editingId)

  const days = useMemo(() => monthDays(cursor.year, cursor.month), [cursor])
  const byDate = useMemo(() => group(videos, (v) => v.publishDate), [videos])
  const promosByDate = useMemo(() => group(promos, (p) => p.date), [promos])
  const unscheduled = videos.filter((v) => !v.publishDate && v.stage !== 'published')
  const now = today()
  const label = new Date(cursor.year, cursor.month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const inMonth = (iso?: string) => !!iso && parseISO(iso).getMonth() === cursor.month && parseISO(iso).getFullYear() === cursor.year
  const uploadsThisMonth = videos.filter((v) => inMonth(v.publishDate)).length
  const promosThisMonth = promos.filter((p) => inMonth(p.date)).length

  const shift = (delta: number) => {
    const d = new Date(cursor.year, cursor.month + delta, 1)
    setCursor({ year: d.getFullYear(), month: d.getMonth() })
  }

  const closeAdd = () => {
    setAdding(null)
    setPick('')
    setNewTitle('')
  }

  const schedule = () => {
    if (!adding) return
    if (pick) update(pick, { publishDate: adding })
    else if (newTitle.trim()) add(newVideo(newTitle.trim(), { publishDate: adding }))
    closeAdd()
  }

  const dragStart = (e: DragEvent, video: Video) => {
    e.dataTransfer.setData('text/plain', video.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="split">
      <div className="card flush">
        <div className="cal-head">
          <h2>{label}</h2>
          <div className="row nowrap">
            <Btn variant="ghost" size="sm" aria-label="Previous month" icon={<ChevronLeft size={17} />} onClick={() => shift(-1)} />
            <Btn
              size="sm"
              onClick={() => {
                const d = new Date()
                setCursor({ year: d.getFullYear(), month: d.getMonth() })
              }}
            >
              Today
            </Btn>
            <Btn variant="ghost" size="sm" aria-label="Next month" icon={<ChevronRight size={17} />} onClick={() => shift(1)} />
          </div>
        </div>
        <div className="cal-grid">
          {WEEKDAYS.map((d) => (
            <div key={d} className="cal-dow">
              {d}
            </div>
          ))}
          {days.map((iso) => {
            const date = parseISO(iso)
            return (
              <div
                key={iso}
                className={cx('cal-day', date.getMonth() !== cursor.month && 'out', iso === now && 'today', over === iso && 'over')}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (over !== iso) setOver(iso)
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  setOver(null)
                  const id = e.dataTransfer.getData('text/plain')
                  if (id) update(id, { publishDate: iso })
                }}
              >
                <div className="cal-day-head">
                  <span className="cal-date">{date.getDate()}</span>
                  <button type="button" className="cal-add" aria-label={`Schedule a video on ${fmtDateLong(iso)}`} onClick={() => setAdding(iso)}>
                    <Plus size={14} />
                  </button>
                </div>
                {(byDate.get(iso) ?? []).map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    draggable
                    onDragStart={(e) => dragStart(e, v)}
                    className="cal-item"
                    data-stage={v.stage}
                    title={`${v.title} (${stageName(v.stage)})`}
                    onClick={() => setEditingId(v.id)}
                  >
                    {v.title}
                  </button>
                ))}
                {(promosByDate.get(iso) ?? []).map((p) => (
                  <Link key={p.id} to="/promo" className="cal-promo" title={p.text || promoKindName(p.kind)}>
                    <Megaphone size={11} />
                    <span className="truncate">{promoKindName(p.kind)}</span>
                  </Link>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      <aside className="stack">
        <div className="card stack">
          <div>
            <h2 className="card-title">Unscheduled</h2>
            <p className="small muted">Drag a video onto a day, or use the plus on any day.</p>
          </div>
          {unscheduled.length === 0 ? (
            <p className="small muted">{videos.length ? 'Every video in production has a date.' : 'No videos yet. Use the plus on a day to start one.'}</p>
          ) : (
            <div className="stack tight">
              {unscheduled.map((v) => (
                <div key={v.id} className="cal-loose" draggable onDragStart={(e) => dragStart(e, v)}>
                  <button type="button" onClick={() => setEditingId(v.id)}>
                    {v.title}
                  </button>
                  <StageBadge stage={v.stage} />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card stack">
          <h2 className="card-title">{label}</h2>
          <p className="small">
            <b>{uploadsThisMonth}</b> {uploadsThisMonth === 1 ? 'upload' : 'uploads'} and <b>{promosThisMonth}</b> promo {promosThisMonth === 1 ? 'post' : 'posts'} planned.
          </p>
          <ul className="cal-legend">
            {STAGES.map((s) => (
              <li key={s.id}>
                <i className="cal-swatch" data-stage={s.id} />
                {s.name}
              </li>
            ))}
            <li>
              <Megaphone size={12} /> Promo post
            </li>
          </ul>
        </div>
      </aside>

      {adding && (
        <Modal
          title={`Schedule for ${fmtDateLong(adding)}`}
          onClose={closeAdd}
          footer={
            <>
              <Btn variant="ghost" onClick={closeAdd}>
                Cancel
              </Btn>
              <Btn variant="primary" disabled={!pick && !newTitle.trim()} onClick={schedule}>
                Schedule
              </Btn>
            </>
          }
        >
          <div className="stack">
            {unscheduled.length > 0 && (
              <Field label="Pick an unscheduled video">
                <Select value={pick} onValue={setPick}>
                  <option value="">Choose a video</option>
                  {unscheduled.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {!pick && (
              <Field label={unscheduled.length ? 'Or start a new video' : 'Working title for a new video'}>
                <Input autoFocus={!unscheduled.length} placeholder="Working title" value={newTitle} onValue={setNewTitle} onKeyDown={(e) => e.key === 'Enter' && schedule()} />
              </Field>
            )}
          </div>
        </Modal>
      )}

      {editing && <VideoModal video={editing} onClose={() => setEditingId(null)} />}
    </div>
  )
}
