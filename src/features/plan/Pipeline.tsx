import { useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Kanban, Plus } from 'lucide-react'
import { useCollection } from '../../lib/store'
import { STAGES, newVideo, useVideos, type Series, type StageId, type Video } from '../../lib/data'
import { cx, fmtDate, today } from '../../lib/util'
import { Btn, Empty, Input, VideoModal } from '../../ui/kit'

export default function Pipeline() {
  const { items: videos, add, update } = useVideos()
  const { items: series } = useCollection<Series>('series')
  const [title, setTitle] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<StageId | null>(null)
  const editing = videos.find((v) => v.id === editingId)
  const now = today()

  const setStage = (video: Video, stage: StageId) => {
    if (video.stage === stage) return
    // Publishing without a date stamps today, so the upload streak can count it.
    update(video.id, stage === 'published' && !video.publishDate ? { stage, publishDate: now } : { stage })
  }

  const step = (video: Video, dir: -1 | 1) => {
    const next = STAGES[STAGES.findIndex((s) => s.id === video.stage) + dir]
    if (next) setStage(video, next.id)
  }

  const addVideo = () => {
    const t = title.trim()
    if (!t) return
    add(newVideo(t))
    setTitle('')
  }

  return (
    <div className="stack">
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          addVideo()
        }}
      >
        <Input className="grow" style={{ maxWidth: 460 }} aria-label="New video working title" placeholder="New video working title" value={title} onValue={setTitle} />
        <Btn variant="primary" type="submit" icon={<Plus size={16} />} disabled={!title.trim()}>
          Add to Planned
        </Btn>
        <span className="small muted">Drag cards between columns, or use the arrows on each card.</span>
      </form>

      {videos.length === 0 ? (
        <Empty icon={<Kanban size={22} />} title="No videos in production">
          Add a working title above. Each video moves left to right as you script, shoot, edit and publish it.
        </Empty>
      ) : (
        <div className="board">
          {STAGES.map((stage, index) => {
            const list = videos.filter((v) => v.stage === stage.id)
            return (
              <section
                key={stage.id}
                className={cx('board-col', over === stage.id && 'over')}
                aria-label={`${stage.name}, ${list.length} videos`}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (over !== stage.id) setOver(stage.id)
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const video = videos.find((v) => v.id === e.dataTransfer.getData('text/plain'))
                  if (video) setStage(video, stage.id)
                  setOver(null)
                  setDragId(null)
                }}
              >
                <div className="board-col-head">
                  <span>{stage.name}</span>
                  <span className="count">{list.length}</span>
                </div>
                {list.map((v) => {
                  const seriesName = series.find((s) => s.id === v.seriesId)?.name
                  const overdue = !!v.publishDate && v.publishDate < now && v.stage !== 'published'
                  return (
                    <article
                      key={v.id}
                      className={cx('kcard', dragId === v.id && 'dragging')}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', v.id)
                        e.dataTransfer.effectAllowed = 'move'
                        setDragId(v.id)
                      }}
                      onDragEnd={() => {
                        setDragId(null)
                        setOver(null)
                      }}
                    >
                      <button type="button" className="kcard-title" onClick={() => setEditingId(v.id)}>
                        {v.title}
                      </button>
                      {(v.publishDate || seriesName) && (
                        <div className="kcard-meta">
                          {v.publishDate && (
                            <span>
                              <CalendarDays size={12} /> {fmtDate(v.publishDate)}
                            </span>
                          )}
                          {overdue && <span className="badge bad">Overdue</span>}
                          {seriesName && <span className="truncate">{seriesName}</span>}
                        </div>
                      )}
                      <div className="kcard-actions">
                        <Btn
                          variant="ghost"
                          size="sm"
                          disabled={index === 0}
                          aria-label={index === 0 ? 'First stage' : `Move "${v.title}" back to ${STAGES[index - 1].name}`}
                          icon={<ChevronLeft size={15} />}
                          onClick={() => step(v, -1)}
                        />
                        <Btn
                          variant="ghost"
                          size="sm"
                          disabled={index === STAGES.length - 1}
                          aria-label={index === STAGES.length - 1 ? 'Last stage' : `Move "${v.title}" on to ${STAGES[index + 1].name}`}
                          icon={<ChevronRight size={15} />}
                          onClick={() => step(v, 1)}
                        />
                      </div>
                    </article>
                  )
                })}
                {list.length === 0 && <p className="tiny muted">Nothing here</p>}
              </section>
            )
          })}
        </div>
      )}

      {editing && <VideoModal video={editing} onClose={() => setEditingId(null)} />}
    </div>
  )
}
