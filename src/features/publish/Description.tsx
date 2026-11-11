import { useState } from 'react'
import { ArrowDown, ArrowUp, Download, Pencil, Plus, X } from 'lucide-react'
import { useDoc, useStored } from '../../lib/store'
import { DEFAULT_BRAND, EMPTY_CHAPTERS, chapterProblems, chaptersText, useActiveVideo, type Brand, type Chapter, type Video } from '../../lib/data'
import { Link } from '../../lib/router'
import { download, fill, fmtNum, slugify, uid } from '../../lib/util'
import { Btn, ConfirmBtn, CopyBtn, Field, Input, Meter, Modal, NeedVideo, Status, Textarea, Toggle, VideoBar } from '../../ui/kit'

export interface DescBlock {
  id: string
  name: string
  body: string
}

export interface DescDoc {
  intro: string
  blockIds: string[]
  chapters: boolean
  hashtags: string
}

const EMPTY_DESC: DescDoc = { intro: '', blockIds: [], chapters: true, hashtags: '' }
const LIMIT = 5000

const DEFAULT_BLOCKS: DescBlock[] = [
  { id: 'about', name: 'About the channel', body: '{channel} publishes new videos every week. Subscribe so you do not miss the next one.' },
  { id: 'links', name: 'Links mentioned', body: 'Links from this video:\n- \n- ' },
  { id: 'gear', name: 'Gear I use', body: 'What I film with:\nCamera: \nMicrophone: \nLights: ' },
  { id: 'social', name: 'Find me elsewhere', body: 'Instagram: \nNewsletter: \nWebsite: ' },
  { id: 'sponsor', name: 'Sponsor disclosure', body: 'This video is sponsored by [brand]. All opinions are my own.' },
  { id: 'affiliate', name: 'Affiliate disclosure', body: 'Some links above are affiliate links. If you buy through them I may earn a small commission at no extra cost to you.' },
]

/** "cooking, small kitchen #Tips" -> "#cooking #smallkitchen #Tips" */
function hashtags(raw: string): string {
  return raw
    .split(/[,\n]+|\s+(?=#)/)
    .map((t) => t.replace(/[#\s]+/g, ''))
    .filter(Boolean)
    .map((t) => `#${t}`)
    .join(' ')
}

function Builder({ video }: { video: Video }) {
  const [stored, setDoc] = useDoc<DescDoc>('descriptions', video.id, EMPTY_DESC)
  const doc = { ...EMPTY_DESC, ...stored }
  const [blocks, setBlocks] = useStored<DescBlock[]>('descBlocks', DEFAULT_BLOCKS)
  const [chapters] = useDoc<Chapter[]>('chapters', video.id, EMPTY_CHAPTERS)
  const [brand] = useStored<Brand>('brand', DEFAULT_BRAND)
  const [editingId, setEditingId] = useState<string | null>(null)
  const editing = blocks.find((b) => b.id === editingId)

  const patch = (p: Partial<DescDoc>) => setDoc((prev) => ({ ...EMPTY_DESC, ...prev, ...p }))
  const patchBlock = (id: string, p: Partial<DescBlock>) => setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...p } : b)))

  const chosen = doc.blockIds.map((id) => blocks.find((b) => b.id === id)).filter((b): b is DescBlock => !!b)
  const available = blocks.filter((b) => !doc.blockIds.includes(b.id))
  const vars = { channel: brand.channel?.trim() || 'This channel', title: video.title }
  const chapterText = doc.chapters && chapters.length ? chaptersText(chapters) : ''
  const chapterIssues = chapters.length ? chapterProblems([...chapters].sort((a, b) => a.time - b.time)) : []

  const output = [doc.intro.trim(), chapterText, ...chosen.map((b) => fill(b.body.trim(), vars)), hashtags(doc.hashtags)].filter(Boolean).join('\n\n')
  const firstLines = output.split('\n').filter(Boolean).slice(0, 2).join('\n')

  const move = (index: number, dir: -1 | 1) => {
    const ids = [...doc.blockIds]
    const target = index + dir
    if (target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    patch({ blockIds: ids })
  }

  const createBlock = () => {
    const block: DescBlock = { id: uid(), name: 'New block', body: '' }
    setBlocks((prev) => [...prev, block])
    setEditingId(block.id)
  }

  return (
    <div className="split even">
      <div className="stack">
        <section className="card stack">
          <h2 className="card-title">Opening lines</h2>
          <Field label="What the video delivers" hint="Only the first couple of lines show before a viewer expands the description, so lead with the point and your main keyword.">
            <Textarea rows={4} placeholder="In this video I show you…" value={doc.intro} onValue={(intro) => patch({ intro })} />
          </Field>
        </section>

        <section className="card stack">
          <div className="row spread">
            <h2 className="card-title">Chapters</h2>
            <Toggle checked={doc.chapters} onChange={(v) => patch({ chapters: v })}>
              Include
            </Toggle>
          </div>
          {chapters.length === 0 ? (
            <p className="small muted">
              This video has no chapters yet. <Link to="/chapters">Add them in the chapter generator</Link> and they appear here automatically.
            </p>
          ) : chapterIssues.length ? (
            <Status tone="warn">
              {chapters.length} chapters, but YouTube will not recognise them yet: {chapterIssues[0]} <Link to="/chapters">Fix in the chapter generator</Link>.
            </Status>
          ) : (
            <Status tone="good">{chapters.length} valid chapters will be placed after the opening lines.</Status>
          )}
        </section>

        <section className="card stack">
          <div className="row spread">
            <h2 className="card-title">Blocks</h2>
            <Btn size="sm" icon={<Plus size={15} />} onClick={createBlock}>
              New block
            </Btn>
          </div>
          <p className="small muted">Reusable text you write once and drop into any description.</p>
          {chosen.length > 0 && (
            <ul className="stack tight">
              {chosen.map((b, i) => (
                <li key={b.id} className="block-row on">
                  <span className="grow truncate strong">{b.name}</span>
                  <Btn variant="ghost" size="sm" aria-label={`Move ${b.name} up`} disabled={i === 0} icon={<ArrowUp size={15} />} onClick={() => move(i, -1)} />
                  <Btn variant="ghost" size="sm" aria-label={`Move ${b.name} down`} disabled={i === chosen.length - 1} icon={<ArrowDown size={15} />} onClick={() => move(i, 1)} />
                  <Btn variant="ghost" size="sm" aria-label={`Edit ${b.name}`} icon={<Pencil size={15} />} onClick={() => setEditingId(b.id)} />
                  <Btn variant="ghost" size="sm" aria-label={`Remove ${b.name} from this description`} icon={<X size={15} />} onClick={() => patch({ blockIds: doc.blockIds.filter((id) => id !== b.id) })} />
                </li>
              ))}
            </ul>
          )}
          {available.length > 0 && (
            <ul className="stack tight">
              {available.map((b) => (
                <li key={b.id} className="block-row">
                  <span className="grow truncate">{b.name}</span>
                  <Btn variant="ghost" size="sm" aria-label={`Edit ${b.name}`} icon={<Pencil size={15} />} onClick={() => setEditingId(b.id)} />
                  <Btn size="sm" icon={<Plus size={15} />} onClick={() => patch({ blockIds: [...doc.blockIds, b.id] })}>
                    Add
                  </Btn>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card stack">
          <h2 className="card-title">Hashtags</h2>
          <Field label="Up to three is plenty" hint="Separate with commas. They are added on the last line.">
            <Input placeholder="cooking, smallkitchen, mealprep" value={doc.hashtags} onValue={(v) => patch({ hashtags: v })} />
          </Field>
        </section>
      </div>

      <aside className="stack sticky">
        <div className="card stack">
          <div className="row spread">
            <h2 className="card-title">Description</h2>
            <span className="small muted num">
              {fmtNum(output.length)} of {fmtNum(LIMIT)} characters
            </span>
          </div>
          <Meter label="Characters used" value={output.length} max={LIMIT} tone={output.length > LIMIT ? 'bad' : undefined} />
          {output.length > LIMIT && <Status tone="bad">Over YouTube&rsquo;s 5,000-character limit by {fmtNum(output.length - LIMIT)}.</Status>}
          {output ? (
            <>
              <div>
                <div className="mini-label">Shown before the viewer expands it</div>
                <p className="desc-fold pre">{firstLines}</p>
              </div>
              <div>
                <div className="mini-label">Full description</div>
                <div className="desc-out pre">{output}</div>
              </div>
            </>
          ) : (
            <p className="small muted">Write the opening lines and add a block or two. The finished description builds up here.</p>
          )}
          <div className="row">
            <CopyBtn variant="primary" text={output} label="Copy description" />
            <Btn icon={<Download size={16} />} disabled={!output} onClick={() => download(`${slugify(video.title)}-description.txt`, output)}>
              Download
            </Btn>
          </div>
        </div>
      </aside>

      {editing && (
        <Modal
          title="Edit block"
          onClose={() => setEditingId(null)}
          footer={
            <>
              <ConfirmBtn
                onConfirm={() => {
                  setBlocks((prev) => prev.filter((b) => b.id !== editing.id))
                  setEditingId(null)
                }}
              >
                Delete block
              </ConfirmBtn>
              <Btn variant="primary" onClick={() => setEditingId(null)}>
                Done
              </Btn>
            </>
          }
        >
          <div className="stack">
            <Field label="Block name">
              <Input autoFocus value={editing.name} onValue={(name) => patchBlock(editing.id, { name })} />
            </Field>
            <Field label="Text" hint="{channel} and {title} are filled in for you. Changes apply to every description that uses this block.">
              <Textarea rows={7} value={editing.body} onValue={(body) => patchBlock(editing.id, { body })} />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default function Description() {
  const video = useActiveVideo()
  return (
    <>
      <VideoBar />
      {video ? <Builder key={video.id} video={video} /> : <NeedVideo />}
    </>
  )
}
