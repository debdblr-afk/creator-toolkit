import { useState } from 'react'
import { Clapperboard, FileText, Plus, Trash2 } from 'lucide-react'
import { useDoc } from '../../lib/store'
import { EMPTY_SCRIPT, useActiveVideo, type ScriptDoc, type Video } from '../../lib/data'
import { cx, uid } from '../../lib/util'
import { Btn, CopyBtn, Empty, Input, Meter, NeedVideo, Select, VideoBar, toast } from '../../ui/kit'

export interface Shot {
  id: string
  type: string
  desc: string
  location: string
  done: boolean
}

const TYPES = ['A-roll', 'B-roll', 'Screen recording', 'Insert', 'Graphic']
const EMPTY_SHOTS: Shot[] = []

/** "[Screen: settings page]" -> a screen recording called "settings page". */
function fromCue(cue: string): { type: string; desc: string } {
  const m = cue.match(/^\s*(a-roll|b-roll|screen(?: recording)?|insert|graphic)\s*[:\-]\s*(.+)$/i)
  if (!m) return { type: 'B-roll', desc: cue.trim() }
  const key = m[1].toLowerCase()
  const type = key.startsWith('screen') ? 'Screen recording' : TYPES.find((t) => t.toLowerCase() === key) ?? 'B-roll'
  return { type, desc: m[2].trim() }
}

function List({ video }: { video: Video }) {
  const [shots, setShots] = useDoc<Shot[]>('shots', video.id, EMPTY_SHOTS)
  const [script] = useDoc<ScriptDoc>('scripts', video.id, EMPTY_SCRIPT)
  const [type, setType] = useState('B-roll')
  const [desc, setDesc] = useState('')
  const [location, setLocation] = useState('')
  const [filter, setFilter] = useState('All')

  const patch = (id: string, p: Partial<Shot>) => setShots((prev) => prev.map((s) => (s.id === id ? { ...s, ...p } : s)))
  const done = shots.filter((s) => s.done).length
  const visible = filter === 'All' ? shots : filter === 'To do' ? shots.filter((s) => !s.done) : shots.filter((s) => s.type === filter)
  const cues = (script.body.match(/\[[^\]\n]*\]/g) ?? []).map((c) => c.slice(1, -1).trim()).filter(Boolean)

  const addShot = () => {
    if (!desc.trim()) return
    setShots((prev) => [...prev, { id: uid(), type, desc: desc.trim(), location: location.trim(), done: false }])
    setDesc('')
  }

  const pullCues = () => {
    const have = new Set(shots.map((s) => s.desc.toLowerCase()))
    const fresh: Shot[] = []
    for (const cue of cues) {
      const parsed = fromCue(cue)
      if (!parsed.desc || have.has(parsed.desc.toLowerCase())) continue
      have.add(parsed.desc.toLowerCase())
      fresh.push({ id: uid(), ...parsed, location: '', done: false })
    }
    if (fresh.length) setShots((prev) => [...prev, ...fresh])
    toast(fresh.length ? `${fresh.length} ${fresh.length === 1 ? 'shot' : 'shots'} added from the script` : 'Every cue in the script is already on the list')
  }

  const asText = shots.map((s) => `[${s.done ? 'x' : ' '}] ${s.type}: ${s.desc}${s.location ? ` (${s.location})` : ''}`).join('\n')

  return (
    <div className="stack">
      <form
        className="card shot-form"
        onSubmit={(e) => {
          e.preventDefault()
          addShot()
        }}
      >
        <Select aria-label="Shot type" value={type} onValue={setType}>
          {TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
        <Input aria-label="Shot description" placeholder="What the shot shows" value={desc} onValue={setDesc} />
        <Input aria-label="Location" placeholder="Location (optional)" value={location} onValue={setLocation} />
        <Btn variant="primary" type="submit" icon={<Plus size={16} />} disabled={!desc.trim()}>
          Add shot
        </Btn>
      </form>

      {shots.length === 0 ? (
        <Empty
          icon={<Clapperboard size={22} />}
          title="No shots listed yet"
          action={
            cues.length > 0 && (
              <Btn icon={<FileText size={16} />} onClick={pullCues}>
                Pull {cues.length} {cues.length === 1 ? 'cue' : 'cues'} from the script
              </Btn>
            )
          }
        >
          List the talking-head shots, B-roll, screen recordings and graphics you need. Anything written in [brackets] in the script can be pulled in automatically.
        </Empty>
      ) : (
        <>
          <div className="card stack">
            <div className="row spread">
              <span className="strong">
                {done} of {shots.length} shots captured
              </span>
              <div className="row">
                {cues.length > 0 && (
                  <Btn size="sm" icon={<FileText size={15} />} onClick={pullCues}>
                    Pull cues from script
                  </Btn>
                )}
                <CopyBtn size="sm" text={asText} label="Copy list" />
              </div>
            </div>
            <Meter label="Shots captured" value={done} max={shots.length} />
          </div>

          <div className="row" role="group" aria-label="Filter shots">
            {['All', 'To do', ...TYPES.filter((t) => shots.some((s) => s.type === t))].map((f) => (
              <button key={f} type="button" className={cx('chip', filter === f && 'on')} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {f}
              </button>
            ))}
          </div>

          <div className="card flush">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Done</th>
                    <th>Type</th>
                    <th>Shot</th>
                    <th>Location</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((s) => (
                    <tr key={s.id} className={cx(s.done && 'shot-done')}>
                      <td>
                        <input type="checkbox" className="check" aria-label={`Mark "${s.desc}" as captured`} checked={s.done} onChange={(e) => patch(s.id, { done: e.target.checked })} />
                      </td>
                      <td>
                        <Select className="input-sm" aria-label="Shot type" value={s.type} onValue={(v) => patch(s.id, { type: v })}>
                          {TYPES.map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </Select>
                      </td>
                      <td style={{ width: '50%' }}>
                        <Input className="input-sm" aria-label="Shot description" value={s.desc} onValue={(v) => patch(s.id, { desc: v })} />
                      </td>
                      <td>
                        <Input className="input-sm" aria-label="Location" value={s.location} onValue={(v) => patch(s.id, { location: v })} />
                      </td>
                      <td>
                        <Btn variant="ghost" size="sm" aria-label={`Delete "${s.desc}"`} icon={<Trash2 size={15} />} onClick={() => setShots((prev) => prev.filter((x) => x.id !== s.id))} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {visible.length === 0 && <p className="small muted" style={{ padding: 14 }}>No shots match this filter.</p>}
          </div>
        </>
      )}
    </div>
  )
}

export default function ShotList() {
  const video = useActiveVideo()
  return (
    <>
      <VideoBar />
      {video ? <List key={video.id} video={video} /> : <NeedVideo />}
    </>
  )
}
