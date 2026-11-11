import { useState } from 'react'
import { ChartColumn, Download, Plus, Trash2, TrendingDown, TrendingUp } from 'lucide-react'
import { useCollection } from '../../lib/store'
import { useSettings, useVideos } from '../../lib/data'
import { download, fmtCompact, fmtDateLong, fmtMoney, fmtNum, today } from '../../lib/util'
import { BarList, LineChart, type BarDatum } from '../../ui/charts'
import { Btn, Empty, Input, NumInput, Segmented, Select, Stat, TimeInput } from '../../ui/kit'

export interface VideoStat {
  id: string
  videoId?: string
  title: string
  date: string
  views: number
  impressions: number
  /** impressions click-through rate, in percent */
  ctr: number
  /** average view duration, seconds */
  avd: number
  /** video length, seconds */
  length: number
  subs: number
  revenue: number
}

export interface ChannelStat {
  id: string
  date: string
  subs: number
  views: number
}

type Metric = 'views' | 'ctr' | 'retention' | 'revenue'

const METRICS: { value: Metric; label: string }[] = [
  { value: 'views', label: 'Views' },
  { value: 'ctr', label: 'Click-through rate' },
  { value: 'retention', label: 'Share watched' },
  { value: 'revenue', label: 'Revenue' },
]

const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0)
const retention = (s: VideoStat): number => (s.length > 0 ? (s.avd / s.length) * 100 : 0)

/** Quote a CSV cell and neutralise anything a spreadsheet would run as a formula. */
const csvCell = (value: string | number): string => {
  const text = String(value)
  return `"${(/^[=+\-@]/.test(text) && typeof value === 'string' ? `'${text}` : text).replace(/"/g, '""')}"`
}

function Videos() {
  const { items: stats, add, update, remove } = useCollection<VideoStat>('videoStats')
  const { items: videos } = useVideos()
  const [settings] = useSettings()
  const [metric, setMetric] = useState<Metric>('views')
  const money = (n: number) => fmtMoney(n, settings.currency)

  const totalViews = sum(stats.map((s) => s.views))
  const totalImpressions = sum(stats.map((s) => s.impressions))
  const avgCtr = totalImpressions > 0 ? sum(stats.map((s) => s.impressions * s.ctr)) / totalImpressions : 0
  const watched = stats.filter((s) => s.length > 0 && s.avd > 0)
  const avgRetention = watched.length ? sum(watched.map(retention)) / watched.length : 0
  const revenue = sum(stats.map((s) => s.revenue))
  const rpm = totalViews > 0 ? (revenue / totalViews) * 1000 : 0

  const value = (s: VideoStat) => (metric === 'views' ? s.views : metric === 'ctr' ? s.ctr : metric === 'retention' ? retention(s) : s.revenue)
  const display = (s: VideoStat) =>
    metric === 'views' ? fmtNum(s.views) : metric === 'ctr' ? `${fmtNum(s.ctr, 1)}%` : metric === 'retention' ? `${fmtNum(retention(s))}%` : money(s.revenue)

  const bars: BarDatum[] = stats
    .filter((s) => value(s) > 0)
    .sort((a, b) => value(b) - value(a))
    .slice(0, 12)
    .map((s) => ({ key: s.id, label: s.title || 'Untitled video', value: value(s), display: display(s), detail: `Published ${fmtDateLong(s.date)}` }))

  const blank = { title: '', date: today(), views: 0, impressions: 0, ctr: 0, avd: 0, length: 0, subs: 0, revenue: 0 }
  const untracked = videos.filter((v) => v.stage === 'published' && !stats.some((s) => s.videoId === v.id))

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ['Video', 'Published', 'Views', 'Impressions', 'CTR %', 'Average view duration (s)', 'Length (s)', 'Subscribers gained', 'Revenue'],
      ...stats.map((s) => [s.title, s.date, s.views, s.impressions, s.ctr, s.avd, s.length, s.subs, s.revenue]),
    ]
    download(`video-analytics-${today()}.csv`, rows.map((r) => r.map(csvCell).join(',')).join('\n'), 'text/csv;charset=utf-8')
  }

  return (
    <div className="stack">
      {stats.length === 0 ? (
        <Empty
          icon={<ChartColumn size={22} />}
          title="No video results logged yet"
          action={
            <Btn variant="primary" icon={<Plus size={16} />} onClick={() => add(blank)}>
              Log a video
            </Btn>
          }
        >
          A week after each upload, copy the numbers across from YouTube Studio. A few videos in, you will see which topics and titles earn the views.
        </Empty>
      ) : (
        <>
          <div className="grid cols-4">
            <Stat label="Total views" value={fmtCompact(totalViews)} hint={`${stats.length} ${stats.length === 1 ? 'video' : 'videos'} logged`} />
            <Stat label="Click-through rate" value={`${fmtNum(avgCtr, 1)}%`} hint="Weighted by impressions" />
            <Stat label="Average share watched" value={`${fmtNum(avgRetention)}%`} hint="View duration over length" />
            <Stat label="Revenue" value={money(revenue)} hint={`${money(Math.round(rpm * 100) / 100)} per 1,000 views`} />
          </div>

          <div className="row">
            <Segmented label="Metric to rank videos by" value={metric} onChange={setMetric} options={METRICS} />
          </div>

          <figure className="card stack">
            <figcaption>
              <h2 className="card-title">{METRICS.find((m) => m.value === metric)?.label} by video</h2>
              <p className="small muted">Highest first, top {Math.min(12, bars.length)}. Every figure is also in the table below.</p>
            </figcaption>
            {bars.length ? <BarList data={bars} label={`${metric} by video, highest first`} /> : <p className="small muted">No videos have a value for this metric yet.</p>}
          </figure>
        </>
      )}

      {stats.length > 0 && (
        <section className="card flush">
          <div className="card-head pad">
            <h2 className="card-title">Results by video</h2>
            <div className="row">
              {untracked.length > 0 && (
                <Select
                  className="input-sm"
                  style={{ width: 220 }}
                  aria-label="Add one of your published videos"
                  value=""
                  onValue={(id) => {
                    const v = videos.find((x) => x.id === id)
                    if (v) add({ ...blank, videoId: v.id, title: v.title, date: v.publishDate ?? today() })
                  }}
                >
                  <option value="">Add a published video</option>
                  {untracked.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title}
                    </option>
                  ))}
                </Select>
              )}
              <Btn size="sm" icon={<Plus size={15} />} onClick={() => add(blank)}>
                Add row
              </Btn>
              <Btn size="sm" icon={<Download size={15} />} onClick={exportCsv}>
                CSV
              </Btn>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table stats-table">
              <thead>
                <tr>
                  <th>Video</th>
                  <th>Published</th>
                  <th>Views</th>
                  <th>Impressions</th>
                  <th>CTR %</th>
                  <th>Avg view</th>
                  <th>Length</th>
                  <th className="r">Watched</th>
                  <th>Subs gained</th>
                  <th>Revenue</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.id}>
                    <td className="wide">
                      <Input className="input-sm" aria-label="Video title" placeholder="Video title" value={s.title} onValue={(title) => update(s.id, { title })} />
                    </td>
                    <td>
                      <Input className="input-sm" type="date" aria-label="Publish date" value={s.date} onValue={(date) => update(s.id, { date: date || today() })} />
                    </td>
                    <td>
                      <NumInput className="input-sm" min={0} aria-label="Views" value={s.views} onValue={(views) => update(s.id, { views })} />
                    </td>
                    <td>
                      <NumInput className="input-sm" min={0} aria-label="Impressions" value={s.impressions} onValue={(impressions) => update(s.id, { impressions })} />
                    </td>
                    <td>
                      <NumInput className="input-sm" min={0} max={100} step={0.1} aria-label="Click-through rate in percent" value={s.ctr} onValue={(ctr) => update(s.id, { ctr })} />
                    </td>
                    <td>
                      <TimeInput className="input-sm" aria-label="Average view duration" value={s.avd} onValue={(avd) => update(s.id, { avd })} />
                    </td>
                    <td>
                      <TimeInput className="input-sm" aria-label="Video length" value={s.length} onValue={(length) => update(s.id, { length })} />
                    </td>
                    <td className="r">{s.length > 0 && s.avd > 0 ? `${fmtNum(retention(s))}%` : '–'}</td>
                    <td>
                      <NumInput className="input-sm" aria-label="Subscribers gained" value={s.subs} onValue={(subs) => update(s.id, { subs })} />
                    </td>
                    <td>
                      <NumInput className="input-sm" min={0} step={0.01} aria-label={`Revenue in ${settings.currency}`} value={s.revenue} onValue={(v) => update(s.id, { revenue: v })} />
                    </td>
                    <td>
                      <Btn variant="ghost" size="sm" aria-label={`Delete ${s.title || 'row'}`} icon={<Trash2 size={15} />} onClick={() => remove(s.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

function Channel() {
  const { items, add, update, remove } = useCollection<ChannelStat>('channelStats')
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date))
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const change = sorted.length > 1 ? last.subs - first.subs : 0
  const addReading = () => add({ date: today(), subs: last?.subs ?? 0, views: last?.views ?? 0 })

  if (sorted.length === 0) {
    return (
      <Empty
        icon={<ChartColumn size={22} />}
        title="No channel readings yet"
        action={
          <Btn variant="primary" icon={<Plus size={16} />} onClick={addReading}>
            Add today&rsquo;s reading
          </Btn>
        }
      >
        Once a week, note your subscriber count and total views. Two readings are enough to start drawing the trend.
      </Empty>
    )
  }

  return (
    <div className="stack">
      <div className="grid cols-3">
        <Stat
          label="Subscribers"
          value={fmtNum(last.subs)}
          hint={
            sorted.length > 1 ? (
              <span className={change >= 0 ? 'delta up' : 'delta down'}>
                {change >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {change >= 0 ? '+' : '−'}
                {fmtNum(Math.abs(change))} since {fmtDateLong(first.date)}
              </span>
            ) : (
              'Add a second reading to see the change'
            )
          }
        />
        <Stat label="Total views" value={fmtCompact(last.views)} hint={`As of ${fmtDateLong(last.date)}`} />
        <Stat label="Readings" value={sorted.length} hint={`Since ${fmtDateLong(first.date)}`} />
      </div>

      <figure className="card stack">
        <figcaption>
          <h2 className="card-title">Subscribers over time</h2>
          <p className="small muted">Hover or use the arrow keys to read a point. Every reading is in the table below.</p>
        </figcaption>
        {sorted.length > 1 ? (
          <LineChart label="Subscribers over time" unit="subscribers" points={sorted.map((r) => ({ date: r.date, value: r.subs }))} />
        ) : (
          <p className="small muted">The line appears once there are two readings on different dates.</p>
        )}
      </figure>

      <section className="card flush">
        <div className="card-head pad">
          <h2 className="card-title">Readings</h2>
          <Btn size="sm" icon={<Plus size={15} />} onClick={addReading}>
            Add reading
          </Btn>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Subscribers</th>
                <th>Total views</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {[...sorted].reverse().map((r) => (
                <tr key={r.id}>
                  <td>
                    <Input className="input-sm" type="date" aria-label="Date of reading" value={r.date} onValue={(date) => update(r.id, { date: date || today() })} />
                  </td>
                  <td>
                    <NumInput className="input-sm" min={0} aria-label="Subscribers" value={r.subs} onValue={(subs) => update(r.id, { subs })} />
                  </td>
                  <td>
                    <NumInput className="input-sm" min={0} aria-label="Total views" value={r.views} onValue={(views) => update(r.id, { views })} />
                  </td>
                  <td>
                    <Btn variant="ghost" size="sm" aria-label={`Delete reading from ${fmtDateLong(r.date)}`} icon={<Trash2 size={15} />} onClick={() => remove(r.id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default function Analytics() {
  const [tab, setTab] = useState<'videos' | 'channel'>('videos')
  return (
    <div className="stack">
      <div className="row spread">
        <Segmented
          label="View"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'videos', label: 'Videos' },
            { value: 'channel', label: 'Channel' },
          ]}
        />
        <span className="small muted">Numbers are typed in by you from YouTube Studio. Nothing connects to your account.</span>
      </div>
      {tab === 'videos' ? <Videos /> : <Channel />}
    </div>
  )
}
