import { useState } from 'react'
import { ArrowDown, ArrowUp, ListVideo, Plus, X } from 'lucide-react'
import { useCollection } from '../../lib/store'
import { newVideo, useVideos, type Series, type Video } from '../../lib/data'
import { cx, fmtDate } from '../../lib/util'
import { Btn, ConfirmBtn, CopyBtn, Empty, Field, Input, Meter, Select, StageBadge, Textarea, VideoModal } from '../../ui/kit'

export default function SeriesPlanner() {
  const { items: series, add, update, remove } = useCollection<Series>('series')
  const { items: videos, add: addVideo, update: updateVideo, set: setVideos } = useVideos()
  const [selectedId, setSelectedId] = useState('')
  const [name, setName] = useState('')
  const [episodeTitle, setEpisodeTitle] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const selected = series.find((s) => s.id === selectedId) ?? series[0]
  const editing = videos.find((v) => v.id === editingId)
  const episodes = selected ? videos.filter((v) => v.seriesId === selected.id) : []
  const loose = videos.filter((v) => !v.seriesId)
  const published = episodes.filter((v) => v.stage === 'published').length

  const createSeries = () => {
    const n = name.trim()
    if (!n) return
    const created = add({ name: n, premise: '', cadence: '' })
    setSelectedId(created.id)
    setName('')
  }

  const addEpisode = () => {
    const t = episodeTitle.trim()
    if (!t || !selected) return
    addVideo(newVideo(t, { seriesId: selected.id }))
    setEpisodeTitle('')
  }

  // Episode order is the order of the videos themselves, so swap the two records in place.
  const move = (video: Video, dir: -1 | 1) => {
    const other = episodes[episodes.indexOf(video) + dir]
    if (!other) return
    setVideos((prev) => {
      const next = [...prev]
      const a = next.findIndex((v) => v.id === video.id)
      const b = next.findIndex((v) => v.id === other.id)
      if (a < 0 || b < 0) return prev
      ;[next[a], next[b]] = [next[b], next[a]]
      return next
    })
  }

  const deleteSeries = (s: Series) => {
    setVideos((prev) => prev.map((v) => (v.seriesId === s.id ? { ...v, seriesId: undefined } : v)))
    remove(s.id)
    setSelectedId('')
  }

  const playlistText = selected
    ? [selected.name, selected.premise.trim(), selected.cadence.trim() && `New episodes ${selected.cadence.trim()}.`].filter(Boolean).join('\n\n')
    : ''

  return (
    <div className="split narrow-first">
      <aside className="card stack">
        <h2 className="card-title">Series</h2>
        {series.length > 0 && (
          <div className="stack tight">
            {series.map((s) => {
              const count = videos.filter((v) => v.seriesId === s.id).length
              return (
                <button key={s.id} type="button" className={cx('pick', selected?.id === s.id && 'on')} aria-pressed={selected?.id === s.id} onClick={() => setSelectedId(s.id)}>
                  <span className="truncate">{s.name}</span>
                  <span className="muted small num">{count}</span>
                </button>
              )
            })}
          </div>
        )}
        <form
          className="row nowrap"
          onSubmit={(e) => {
            e.preventDefault()
            createSeries()
          }}
        >
          <Input aria-label="New series name" placeholder="New series name" value={name} onValue={setName} />
          <Btn type="submit" variant="primary" aria-label="Create series" icon={<Plus size={16} />} disabled={!name.trim()} />
        </form>
      </aside>

      {!selected ? (
        <Empty icon={<ListVideo size={22} />} title="No series yet">
          A series gives viewers a reason to watch the next video. Name one on the left, then line up its episodes.
        </Empty>
      ) : (
        <div className="stack">
          <section className="card stack">
            <div className="grid cols-2">
              <Field label="Series name">
                <Input value={selected.name} onValue={(v) => update(selected.id, { name: v })} />
              </Field>
              <Field label="Release rhythm">
                <Input placeholder="every second Sunday" value={selected.cadence} onValue={(cadence) => update(selected.id, { cadence })} />
              </Field>
            </div>
            <Field label="Premise" hint="What stays the same every episode, and what changes.">
              <Textarea rows={3} value={selected.premise} onValue={(premise) => update(selected.id, { premise })} />
            </Field>
            <div className="row spread">
              <CopyBtn text={playlistText} label="Copy playlist description" />
              <ConfirmBtn onConfirm={() => deleteSeries(selected)}>Delete series</ConfirmBtn>
            </div>
          </section>

          <section className="card stack">
            <div className="row spread">
              <h2 className="card-title">Episodes</h2>
              <span className="small muted num">
                {published} of {episodes.length} published
              </span>
            </div>
            {episodes.length > 0 && <Meter label="Episodes published" value={published} max={episodes.length} />}
            {episodes.length === 0 && <p className="small muted">No episodes yet. Add the first one below.</p>}
            <ol className="stack tight">
              {episodes.map((v, i) => (
                <li key={v.id} className="episode">
                  <span className="episode-n num">{i + 1}</span>
                  <button type="button" className="episode-title truncate" onClick={() => setEditingId(v.id)}>
                    {v.title}
                  </button>
                  {v.publishDate && <span className="small muted">{fmtDate(v.publishDate)}</span>}
                  <StageBadge stage={v.stage} />
                  <span className="row nowrap" style={{ gap: 0 }}>
                    <Btn variant="ghost" size="sm" aria-label={`Move "${v.title}" earlier`} disabled={i === 0} icon={<ArrowUp size={15} />} onClick={() => move(v, -1)} />
                    <Btn variant="ghost" size="sm" aria-label={`Move "${v.title}" later`} disabled={i === episodes.length - 1} icon={<ArrowDown size={15} />} onClick={() => move(v, 1)} />
                    <Btn variant="ghost" size="sm" aria-label={`Remove "${v.title}" from this series`} icon={<X size={15} />} onClick={() => updateVideo(v.id, { seriesId: undefined })} />
                  </span>
                </li>
              ))}
            </ol>
            <div className="grid cols-2">
              <form
                className="row nowrap"
                onSubmit={(e) => {
                  e.preventDefault()
                  addEpisode()
                }}
              >
                <Input aria-label="New episode title" placeholder="New episode title" value={episodeTitle} onValue={setEpisodeTitle} />
                <Btn type="submit" disabled={!episodeTitle.trim()}>
                  Add
                </Btn>
              </form>
              {loose.length > 0 && (
                <Select aria-label="Add an existing video to this series" value="" onValue={(id) => id && updateVideo(id, { seriesId: selected.id })}>
                  <option value="">Add an existing video</option>
                  {loose.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title}
                    </option>
                  ))}
                </Select>
              )}
            </div>
          </section>
        </div>
      )}

      {editing && <VideoModal video={editing} onClose={() => setEditingId(null)} />}
    </div>
  )
}
