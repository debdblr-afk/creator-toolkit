import { useState } from 'react'
import { Binoculars, ExternalLink, Lightbulb, Pencil, Plus } from 'lucide-react'
import { useCollection } from '../../lib/store'
import type { Idea } from '../../lib/data'
import { fmtCompact, safeUrl } from '../../lib/util'
import { Btn, ConfirmBtn, Empty, Field, Input, Modal, NumInput, Textarea, toast } from '../../ui/kit'

export interface Competitor {
  id: string
  name: string
  url: string
  subs: number
  cadence: string
  strengths: string
  gaps: string
  ideas: string
  updatedAt: number
}

export default function Competitors() {
  const { items, add, update, remove } = useCollection<Competitor>('competitors')
  const { items: ideas, add: addIdea } = useCollection<Idea>('ideas')
  const [editingId, setEditingId] = useState<string | null>(null)
  const editing = items.find((c) => c.id === editingId)
  const sorted = [...items].sort((a, b) => b.subs - a.subs)

  const create = () => {
    const created = add({ name: '', url: '', subs: 0, cadence: '', strengths: '', gaps: '', ideas: '', updatedAt: Date.now() })
    setEditingId(created.id)
  }

  const patch = (id: string, p: Partial<Competitor>) => update(id, { ...p, updatedAt: Date.now() })

  const saveIdeas = (c: Competitor) => {
    const existing = new Set(ideas.map((i) => i.title.toLowerCase()))
    const lines = c.ideas.split('\n').map((l) => l.trim()).filter((l) => l && !existing.has(l.toLowerCase()))
    lines.forEach((title) => addIdea({ title, notes: c.name ? `Sparked by ${c.name}` : '', tags: ['competitor gap'], rating: 0, createdAt: Date.now() }))
    toast(lines.length ? `${lines.length} ${lines.length === 1 ? 'idea' : 'ideas'} added to the idea bank` : 'Nothing new to add')
  }

  const close = () => {
    // Drop a card the user opened and left completely blank.
    if (editing && !editing.name.trim() && !editing.url.trim() && !editing.strengths.trim() && !editing.gaps.trim() && !editing.ideas.trim()) remove(editing.id)
    setEditingId(null)
  }

  return (
    <div className="stack">
      <div className="row spread">
        <p className="small muted">Study channels your viewers already watch. Note what earns them views and what they leave uncovered.</p>
        <Btn variant="primary" icon={<Plus size={16} />} onClick={create}>
          Add channel
        </Btn>
      </div>

      {items.length === 0 ? (
        <Empty icon={<Binoculars size={22} />} title="No channels tracked yet">
          Pick three to five channels in your niche. For each, write down what works and one gap you could fill.
        </Empty>
      ) : (
        <div className="grid cols-auto">
          {sorted.map((c) => {
            const href = safeUrl(c.url)
            return (
              <article key={c.id} className="card stack">
                <div className="row spread nowrap top">
                  <div className="grow">
                    <h3 className="card-title truncate">{c.name || 'Unnamed channel'}</h3>
                    <p className="small muted">
                      {c.subs ? `${fmtCompact(c.subs)} subscribers` : 'Subscribers not noted'}
                      {c.cadence && ` · ${c.cadence}`}
                    </p>
                  </div>
                  {href && (
                    <a className="btn btn-ghost btn-sm btn-icon" href={href} target="_blank" rel="noopener noreferrer" aria-label={`Open ${c.name || 'channel'} in a new tab`}>
                      <ExternalLink size={15} />
                    </a>
                  )}
                  <Btn variant="ghost" size="sm" aria-label={`Edit ${c.name || 'channel'}`} icon={<Pencil size={15} />} onClick={() => setEditingId(c.id)} />
                </div>
                {c.strengths && (
                  <div>
                    <div className="mini-label">What works</div>
                    <p className="small pre">{c.strengths}</p>
                  </div>
                )}
                {c.gaps && (
                  <div>
                    <div className="mini-label">Gaps</div>
                    <p className="small pre">{c.gaps}</p>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      {editing && (
        <Modal
          title="Channel notes"
          onClose={close}
          wide
          footer={
            <>
              <ConfirmBtn
                onConfirm={() => {
                  remove(editing.id)
                  setEditingId(null)
                }}
              >
                Delete channel
              </ConfirmBtn>
              <Btn variant="primary" onClick={close}>
                Done
              </Btn>
            </>
          }
        >
          <div className="stack">
            <div className="grid cols-2">
              <Field label="Channel name">
                <Input autoFocus value={editing.name} onValue={(name) => patch(editing.id, { name })} />
              </Field>
              <Field label="Link">
                <Input type="url" placeholder="https://" value={editing.url} onValue={(url) => patch(editing.id, { url })} />
              </Field>
              <Field label="Subscribers">
                <NumInput min={0} value={editing.subs} onValue={(subs) => patch(editing.id, { subs })} />
              </Field>
              <Field label="How often they upload">
                <Input placeholder="twice a week" value={editing.cadence} onValue={(cadence) => patch(editing.id, { cadence })} />
              </Field>
            </div>
            <div className="grid cols-2">
              <Field label="What works for them" hint="Formats, titles, thumbnails, pacing.">
                <Textarea rows={4} value={editing.strengths} onValue={(strengths) => patch(editing.id, { strengths })} />
              </Field>
              <Field label="Gaps you could fill" hint="Questions in their comments, topics they skip.">
                <Textarea rows={4} value={editing.gaps} onValue={(gaps) => patch(editing.id, { gaps })} />
              </Field>
            </div>
            <Field label="Video ideas this sparks" hint="One per line.">
              <Textarea rows={3} value={editing.ideas} onValue={(v) => patch(editing.id, { ideas: v })} />
            </Field>
            <div>
              <Btn icon={<Lightbulb size={16} />} disabled={!editing.ideas.trim()} onClick={() => saveIdeas(editing)}>
                Send these to the idea bank
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
