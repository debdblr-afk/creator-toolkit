import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useCollection, useDoc } from '../../lib/store'
import { EMPTY_STRINGS, useActiveVideo } from '../../lib/data'
import { fmtNum } from '../../lib/util'
import { Btn, ConfirmBtn, CopyBtn, Input, Meter, Status, TagEditor, VideoBar, toast } from '../../ui/kit'

export interface TagSet {
  id: string
  name: string
  tags: string[]
}

const LIMIT = 500

/** Roughly how YouTube counts: every character, a comma between tags, and quotes around tags with spaces. */
const tagChars = (tags: string[]): number => tags.reduce((n, t) => n + t.length + (t.includes(' ') ? 2 : 0), 0) + Math.max(0, tags.length - 1)

function merge(current: string[], incoming: string[]): string[] {
  const seen = new Set(current.map((t) => t.toLowerCase()))
  const out = [...current]
  for (const t of incoming) {
    const clean = t.trim()
    if (!clean || seen.has(clean.toLowerCase())) continue
    seen.add(clean.toLowerCase())
    out.push(clean)
  }
  return out
}

const STOP = new Set(['the', 'and', 'for', 'with', 'your', 'you', 'that', 'this', 'from', 'what', 'how', 'why', 'are', 'was', 'into', 'about', 'have'])

export default function TagSets() {
  const { items: sets, add, update, remove } = useCollection<TagSet>('tagSets')
  const video = useActiveVideo()
  const [tags, setTags] = useDoc<string[]>('videoTags', video?.id, EMPTY_STRINGS)
  const [name, setName] = useState('')

  const used = tagChars(tags)
  const tone = used > LIMIT ? 'bad' : used > LIMIT * 0.9 ? 'warn' : undefined

  const fromTitle = () => {
    if (!video) return
    const phrase = video.title.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
    const words = phrase.split(' ').filter((w) => w.length > 3 && !STOP.has(w))
    const next = merge(tags, [phrase, ...words])
    setTags(next)
    toast(`${next.length - tags.length} tags suggested from the title`)
  }

  const createSet = () => {
    const n = name.trim()
    if (!n) return
    add({ name: n, tags: [] })
    setName('')
  }

  return (
    <>
      <VideoBar />
      <div className="split even">
        <section className="card stack">
          <div className="row spread">
            <h2 className="card-title">{video ? 'Tags for this video' : 'Video tags'}</h2>
            <span className="small muted num">
              {tags.length} tags · about {fmtNum(used)} of {LIMIT} characters
            </span>
          </div>
          {video ? (
            <>
              <TagEditor tags={tags} onChange={setTags} placeholder="Type a tag, press Enter or comma" />
              <Meter label="Tag characters used" value={used} max={LIMIT} tone={tone} />
              {used > LIMIT && <Status tone="bad">Over the 500-character limit by about {used - LIMIT}. Remove the least specific tags.</Status>}
              <div className="row">
                <CopyBtn variant="primary" text={tags.join(', ')} label="Copy tags" />
                <Btn onClick={fromTitle}>Suggest from title</Btn>
                {tags.length > 0 && <ConfirmBtn onConfirm={() => setTags([])}>Clear</ConfirmBtn>}
              </div>
              <p className="small muted">
                Put the most specific phrases first. Tags matter far less than the title, thumbnail and description, but they help with common misspellings of your topic.
              </p>
            </>
          ) : (
            <p className="small muted">Name a video project in the bar above to build its tags. Reusable sets on the right work without one.</p>
          )}
        </section>

        <section className="stack">
          <div className="card stack">
            <h2 className="card-title">Reusable sets</h2>
            <p className="small muted">Save the tags you use again and again: the channel name, your niche, a recurring series.</p>
            <form
              className="row nowrap"
              onSubmit={(e) => {
                e.preventDefault()
                createSet()
              }}
            >
              <Input aria-label="New set name" placeholder="New set name, e.g. Channel basics" value={name} onValue={setName} />
              <Btn type="submit" icon={<Plus size={16} />} disabled={!name.trim()}>
                Create
              </Btn>
            </form>
          </div>

          {sets.map((s) => (
            <div key={s.id} className="card stack">
              <div className="row nowrap">
                <Input className="grow strong" aria-label="Set name" value={s.name} onValue={(v) => update(s.id, { name: v })} />
                <ConfirmBtn size="sm" aria-label={`Delete ${s.name}`} confirmLabel="Delete?" icon={<Trash2 size={15} />} onConfirm={() => remove(s.id)} />
              </div>
              <TagEditor tags={s.tags} onChange={(next) => update(s.id, { tags: next })} />
              <div className="row spread">
                <span className="small muted num">
                  {s.tags.length} tags · {tagChars(s.tags)} characters
                </span>
                <Btn
                  size="sm"
                  disabled={!video || !s.tags.length}
                  onClick={() => {
                    const next = merge(tags, s.tags)
                    setTags(next)
                    toast(next.length === tags.length ? 'Those tags are already on this video' : `${next.length - tags.length} tags added to this video`)
                  }}
                >
                  Add to this video
                </Btn>
              </div>
            </div>
          ))}
        </section>
      </div>
    </>
  )
}
