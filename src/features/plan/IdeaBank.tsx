import { useMemo, useState } from 'react'
import { ArrowRight, Lightbulb, Pencil, Plus, Search } from 'lucide-react'
import { useCollection, useStored } from '../../lib/store'
import { newVideo, useVideos, type Idea } from '../../lib/data'
import { cx } from '../../lib/util'
import { Btn, ConfirmBtn, Empty, Field, Input, Modal, Segmented, Stars, TagEditor, Textarea, toast } from '../../ui/kit'

export default function IdeaBank() {
  const { items: ideas, add, update, remove } = useCollection<Idea>('ideas')
  const { items: videos, add: addVideo } = useVideos()
  const [, setCurrent] = useStored<string>('currentVideoId', '')
  const [title, setTitle] = useState('')
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('')
  const [sort, setSort] = useState<'new' | 'top'>('new')
  const [show, setShow] = useState<'open' | 'all'>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const editing = ideas.find((i) => i.id === editingId)

  const videoIds = useMemo(() => new Set(videos.map((v) => v.id)), [videos])
  const started = (idea: Idea) => !!idea.videoId && videoIds.has(idea.videoId)

  const allTags = useMemo(() => [...new Set(ideas.flatMap((i) => i.tags))].sort((a, b) => a.localeCompare(b)), [ideas])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return ideas
      .filter((i) => show === 'all' || !(i.videoId && videoIds.has(i.videoId)))
      .filter((i) => !tag || i.tags.includes(tag))
      .filter((i) => !q || i.title.toLowerCase().includes(q) || i.notes.toLowerCase().includes(q))
      .sort((a, b) => (sort === 'top' ? b.rating - a.rating || b.createdAt - a.createdAt : b.createdAt - a.createdAt))
  }, [ideas, query, tag, sort, show, videoIds])

  const addIdea = () => {
    const t = title.trim()
    if (!t) return
    add({ title: t, notes: '', tags: [], rating: 0, createdAt: Date.now() })
    setTitle('')
  }

  const promote = (idea: Idea) => {
    const video = addVideo(newVideo(idea.title, { notes: idea.notes }))
    update(idea.id, { videoId: video.id })
    setCurrent(video.id)
    toast('Project created. It is now on the production kanban.')
  }

  return (
    <div className="stack loose">
      <form
        className="card row"
        onSubmit={(e) => {
          e.preventDefault()
          addIdea()
        }}
      >
        <Input className="grow" aria-label="New idea" placeholder="A video idea, e.g. I edited on a phone for a week" value={title} onValue={setTitle} />
        <Btn variant="primary" type="submit" icon={<Plus size={16} />} disabled={!title.trim()}>
          Add idea
        </Btn>
      </form>

      {ideas.length === 0 ? (
        <Empty icon={<Lightbulb size={22} />} title="No ideas yet">
          Write down every idea, even the rough ones. Rate them later and promote the strongest into a video project.
        </Empty>
      ) : (
        <>
          <div className="row spread">
            <div className="row">
              <div className="search">
                <Search size={15} />
                <Input type="search" aria-label="Search ideas" placeholder="Search ideas" value={query} onValue={setQuery} />
              </div>
              <Segmented
                label="Show"
                value={show}
                onChange={setShow}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'open', label: 'Not started' },
                ]}
              />
              <Segmented
                label="Sort"
                value={sort}
                onChange={setSort}
                options={[
                  { value: 'new', label: 'Newest' },
                  { value: 'top', label: 'Top rated' },
                ]}
              />
            </div>
            <span className="muted small">
              {visible.length} of {ideas.length}
            </span>
          </div>

          {allTags.length > 0 && (
            <div className="row" role="group" aria-label="Filter by tag">
              {allTags.map((t) => (
                <button key={t} type="button" className={cx('chip', tag === t && 'on')} aria-pressed={tag === t} onClick={() => setTag(tag === t ? '' : t)}>
                  {t}
                </button>
              ))}
            </div>
          )}

          <div className="grid cols-auto">
            {visible.map((idea) => (
              <article key={idea.id} className="card idea">
                <div className="row spread nowrap top">
                  <h3 className="idea-title">{idea.title}</h3>
                  <Btn variant="ghost" size="sm" aria-label={`Edit ${idea.title}`} icon={<Pencil size={15} />} onClick={() => setEditingId(idea.id)} />
                </div>
                {idea.notes && <p className="small muted idea-notes">{idea.notes}</p>}
                {idea.tags.length > 0 && (
                  <div className="row">
                    {idea.tags.map((t) => (
                      <span key={t} className="chip">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <div className="row spread idea-foot">
                  <Stars label="Potential" value={idea.rating} onChange={(rating) => update(idea.id, { rating })} />
                  {started(idea) ? (
                    <span className="badge good">In production</span>
                  ) : (
                    <Btn size="sm" icon={<ArrowRight size={15} />} onClick={() => promote(idea)}>
                      Start project
                    </Btn>
                  )}
                </div>
              </article>
            ))}
          </div>
          {visible.length === 0 && <p className="muted">Nothing matches these filters.</p>}
        </>
      )}

      {editing && (
        <Modal
          title="Edit idea"
          onClose={() => setEditingId(null)}
          footer={
            <>
              <ConfirmBtn
                onConfirm={() => {
                  remove(editing.id)
                  setEditingId(null)
                }}
              >
                Delete idea
              </ConfirmBtn>
              <Btn variant="primary" onClick={() => setEditingId(null)}>
                Done
              </Btn>
            </>
          }
        >
          <div className="stack">
            <Field label="Idea">
              <Input autoFocus value={editing.title} onValue={(v) => update(editing.id, { title: v })} />
            </Field>
            <Field label="Notes" hint="The angle, why it would work, references to check.">
              <Textarea rows={4} value={editing.notes} onValue={(notes) => update(editing.id, { notes })} />
            </Field>
            <div className="field">
              <span className="field-label">Tags</span>
              <TagEditor tags={editing.tags} onChange={(tags) => update(editing.id, { tags })} />
            </div>
            <div className="field">
              <span className="field-label">Potential</span>
              <Stars value={editing.rating} onChange={(rating) => update(editing.id, { rating })} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
