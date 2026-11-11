import { useState } from 'react'
import { Megaphone, Plus, Rocket, Trash2 } from 'lucide-react'
import { useCollection } from '../../lib/store'
import { PROMO_KINDS, promoKindName, useActiveVideo, useVideos, type Promo, type PromoKind } from '../../lib/data'
import { addDays, fmtDate, relativeDay } from '../../lib/util'
import { Btn, CopyBtn, Empty, Input, Segmented, Select, Textarea, VideoBar, toast } from '../../ui/kit'

const STARTERS: Record<PromoKind, (title: string) => string> = {
  community: (title) => `New video this week: ${title}. What is the one thing you would want it to answer?`,
  short: (title) => `15 to 30 seconds: the most surprising moment from “${title}”. End on the question the full video answers.`,
  poll: (title) => `Poll: after “${title}”, what should the next video cover?\nOption 1: \nOption 2: \nOption 3: `,
  social: (title) => `Just published: ${title}. The part I did not expect: [one line]. Link: `,
}

/** A standard launch: tease two days out, a Short the day before, an announcement on the day, a poll after. */
const LAUNCH_SET: { offset: number; kind: PromoKind; text: (title: string) => string }[] = [
  { offset: -2, kind: 'community', text: (title) => `Coming in two days: ${title}. Any guesses what the hardest part was?` },
  { offset: -1, kind: 'short', text: STARTERS.short },
  { offset: 0, kind: 'community', text: (title) => `It is live: ${title}. Watch here: [link]` },
  { offset: 2, kind: 'poll', text: STARTERS.poll },
]

export default function PromoPlanner() {
  const { items: promos, add, update, remove } = useCollection<Promo>('promos')
  const { items: videos } = useVideos()
  const video = useActiveVideo()
  const [scope, setScope] = useState<'video' | 'all'>('video')
  const [kind, setKind] = useState<PromoKind>('community')

  const list = promos
    .filter((p) => scope === 'all' || p.videoId === video?.id)
    .sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'))
  const posted = list.filter((p) => p.status === 'posted').length

  const addOne = () => add({ videoId: video?.id, kind, date: video?.publishDate, text: STARTERS[kind](video?.title ?? 'your video'), status: 'idea' })

  const launchSet = () => {
    if (!video) return
    LAUNCH_SET.forEach((step) =>
      add({ videoId: video.id, kind: step.kind, date: video.publishDate ? addDays(video.publishDate, step.offset) : undefined, text: step.text(video.title), status: 'idea' }),
    )
    toast(video.publishDate ? 'Four posts planned around the publish date' : 'Four posts added. Set a publish date to give them dates.')
  }

  return (
    <>
      <VideoBar />
      <div className="stack">
        <div className="card row spread">
          <div className="row">
            <Select className="promo-kind" aria-label="Kind of post" value={kind} onValue={(v) => setKind(v as PromoKind)}>
              {PROMO_KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </Select>
            <Btn variant="primary" icon={<Plus size={16} />} disabled={!video} onClick={addOne}>
              Add post
            </Btn>
            <Btn icon={<Rocket size={16} />} disabled={!video} onClick={launchSet}>
              Plan a launch set
            </Btn>
          </div>
          <div className="row">
            <span className="small muted num">
              {posted} of {list.length} posted
            </span>
            <Segmented
              label="Posts shown"
              value={scope}
              onChange={setScope}
              options={[
                { value: 'video', label: 'This video' },
                { value: 'all', label: 'All videos' },
              ]}
            />
          </div>
        </div>

        {list.length === 0 ? (
          <Empty icon={<Megaphone size={22} />} title={scope === 'video' ? 'No posts planned for this video' : 'No posts planned yet'}>
            A launch set gives you a teaser two days out, a Short the day before, an announcement on the day and a poll afterwards. Posts with a date also show on the upload calendar.
          </Empty>
        ) : (
          list.map((p) => {
            const forVideo = videos.find((v) => v.id === p.videoId)
            return (
              <article key={p.id} className="card stack">
                <div className="row spread">
                  <div className="row">
                    <Select className="input-sm promo-kind" aria-label="Kind of post" value={p.kind} onValue={(v) => update(p.id, { kind: v as PromoKind })}>
                      {PROMO_KINDS.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.name}
                        </option>
                      ))}
                    </Select>
                    <Input type="date" className="input-sm promo-date" aria-label="Date to post" value={p.date ?? ''} onValue={(v) => update(p.id, { date: v || undefined })} />
                    {p.date && (
                      <span className="small muted">
                        {fmtDate(p.date, { weekday: 'short', day: 'numeric', month: 'short' })} · {relativeDay(p.date)}
                      </span>
                    )}
                  </div>
                  <div className="row">
                    <Segmented
                      label="Status"
                      value={p.status}
                      onChange={(status) => update(p.id, { status })}
                      options={[
                        { value: 'idea', label: 'Idea' },
                        { value: 'drafted', label: 'Drafted' },
                        { value: 'posted', label: 'Posted' },
                      ]}
                    />
                    <CopyBtn size="sm" text={p.text} />
                    <Btn variant="ghost" size="sm" aria-label={`Delete this ${promoKindName(p.kind).toLowerCase()}`} icon={<Trash2 size={15} />} onClick={() => remove(p.id)} />
                  </div>
                </div>
                <Textarea rows={3} aria-label="Post text or idea" value={p.text} onValue={(text) => update(p.id, { text })} />
                {scope === 'all' && forVideo && <p className="tiny muted">For: {forVideo.title}</p>}
              </article>
            )
          })
        )}
      </div>
    </>
  )
}
