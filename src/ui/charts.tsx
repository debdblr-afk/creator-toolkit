// Small chart components. One series, one hue; text always wears text colours;
// every value shown in a tooltip is also readable without it (labels or the table below).

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { addDays, clamp, cx, fmtCompact, fmtDate, fmtDateLong, fmtNum, parseISO, today, weekStart } from '../lib/util'

// ---------- ranked horizontal bars ----------

export interface BarDatum {
  key: string
  label: string
  value: number
  display: string
  detail?: string
}

export function BarList({ data, label }: { data: BarDatum[]; label: string }) {
  const host = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<{ x: number; y: number; d: BarDatum } | null>(null)
  const max = Math.max(0, ...data.map((d) => d.value))

  const show = (el: Element, d: BarDatum) => {
    const a = host.current?.getBoundingClientRect()
    if (!a) return
    const b = el.getBoundingClientRect()
    setTip({ x: clamp(b.left - a.left + b.width / 2, 100, Math.max(100, a.width - 100)), y: b.top - a.top, d })
  }

  return (
    <div className="chart" ref={host}>
      <ul className="bars" aria-label={label}>
        {data.map((d) => (
          <li
            key={d.key}
            className="bar-row"
            tabIndex={0}
            onPointerEnter={(e) => show(e.currentTarget, d)}
            onPointerLeave={() => setTip(null)}
            onFocus={(e) => show(e.currentTarget, d)}
            onBlur={() => setTip(null)}
          >
            <span className="bar-label truncate">{d.label}</span>
            <span className="bar-track">
              <i className="bar" style={{ width: `calc((100% - 76px) * ${max > 0 ? Math.max(0, d.value) / max : 0})` }} />
              <span className="bar-value num">{d.display}</span>
            </span>
          </li>
        ))}
      </ul>
      {tip && (
        <div className="chart-tip" style={{ left: tip.x, top: tip.y }}>
          <div className="chart-tip-value">
            <i className="chart-key" />
            {tip.d.display}
          </div>
          <div className="chart-tip-label">{tip.d.label}</div>
          {tip.d.detail && <div className="chart-tip-label">{tip.d.detail}</div>}
        </div>
      )}
    </div>
  )
}

// ---------- single-series line over time ----------

export interface LinePoint {
  date: string
  value: number
}

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    min -= 1
    max += 1
  }
  const raw = (max - min) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6)
  return ticks
}

const H = 240
const PAD = { l: 48, r: 64, t: 14, b: 30 }

export function LineChart({ points, label, unit }: { points: LinePoint[]; label: string; unit: string }) {
  // Held in state (not a ref) so the size observer re-attaches if the chart remounts.
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(640)
  const [active, setActive] = useState<number | null>(null)

  useEffect(() => {
    if (!host) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)))
    ro.observe(host)
    return () => ro.disconnect()
  }, [host])

  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  const n = sorted.length
  if (n < 2) return null

  const times = sorted.map((p) => parseISO(p.date).getTime())
  const t0 = times[0]
  const t1 = times[n - 1]
  const plotW = width - PAD.l - PAD.r
  const x = (i: number) => PAD.l + (t1 === t0 ? 0.5 : (times[i] - t0) / (t1 - t0)) * plotW

  const ticks = niceTicks(Math.min(...sorted.map((p) => p.value)), Math.max(...sorted.map((p) => p.value)))
  const lo = ticks[0]
  const hi = ticks[ticks.length - 1]
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo || 1)) * (H - PAD.t - PAD.b)
  const fmt = (v: number) => (hi >= 10_000 ? fmtCompact(v) : fmtNum(v))

  const line = sorted.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const area = `${line} L${x(n - 1).toFixed(1)},${y(lo).toFixed(1)} L${x(0).toFixed(1)},${y(lo).toFixed(1)} Z`

  // Date labels: both ends, plus any in between that will not collide.
  const dateLabels: number[] = [0]
  for (const i of [Math.round((n - 1) / 3), Math.round(((n - 1) * 2) / 3)]) {
    if (i > 0 && i < n - 1 && x(i) - x(dateLabels[dateLabels.length - 1]) > 80 && x(n - 1) - x(i) > 80) dateLabels.push(i)
  }
  dateLabels.push(n - 1)

  const nearest = (e: PointerEvent<SVGSVGElement>) => {
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left
    let best = 0
    for (let i = 1; i < n; i++) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i
    setActive(best)
  }

  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      setActive((cur) => clamp((cur ?? n - 1) + (e.key === 'ArrowRight' ? 1 : -1), 0, n - 1))
    } else if (e.key === 'Escape') setActive(null)
  }

  const last = sorted[n - 1]
  const focus = active === null ? null : sorted[active]

  return (
    <div className="chart" ref={setHost}>
      <svg
        className="line-chart"
        width={width}
        height={H}
        role="img"
        tabIndex={0}
        aria-label={`${label}. ${n} readings from ${fmtDateLong(sorted[0].date)} to ${fmtDateLong(last.date)}. Latest: ${fmtNum(last.value)} ${unit}. Use the left and right arrow keys to step through readings.`}
        onPointerMove={nearest}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive((cur) => cur ?? n - 1)}
        onBlur={() => setActive(null)}
        onKeyDown={onKey}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={width - PAD.r} y1={y(t)} y2={y(t)} className={t === lo ? 'chart-axis' : 'chart-grid'} />
            <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" className="chart-tick">
              {fmt(t)}
            </text>
          </g>
        ))}
        {dateLabels.map((i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} className="chart-tick">
            {fmtDate(sorted[i].date)}
          </text>
        ))}
        <path d={area} className="chart-area" />
        <path d={line} className="chart-line" />
        {focus && active !== null && (
          <>
            <line x1={x(active)} x2={x(active)} y1={PAD.t} y2={H - PAD.b} className="chart-cross" />
            <circle cx={x(active)} cy={y(focus.value)} r={5} className="chart-dot" />
          </>
        )}
        <circle cx={x(n - 1)} cy={y(last.value)} r={5} className="chart-dot" />
        <text x={x(n - 1) + 10} y={y(last.value) + 4} className="chart-end">
          {fmt(last.value)}
        </text>
      </svg>
      {focus && active !== null && (
        <div className="chart-tip" style={{ left: clamp(x(active), 90, Math.max(90, width - 90)), top: y(focus.value) - 6 }}>
          <div className="chart-tip-value">
            <i className="chart-key" />
            {fmtNum(focus.value)} {unit}
          </div>
          <div className="chart-tip-label">{fmtDateLong(focus.date)}</div>
        </div>
      )}
    </div>
  )
}

// ---------- upload heatmap (one hue, more is stronger) ----------

export function UploadHeatmap({ dates, weeks = 26 }: { dates: string[]; weeks?: number }) {
  const host = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<{ x: number; y: number; text: string; when: string } | null>(null)

  const counts = new Map<string, number>()
  for (const d of dates) counts.set(d, (counts.get(d) ?? 0) + 1)
  const now = today()
  const start = addDays(weekStart(now), -(weeks - 1) * 7)
  const columns = Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)))

  const show = (el: Element, iso: string, count: number) => {
    const a = host.current?.getBoundingClientRect()
    if (!a) return
    const b = el.getBoundingClientRect()
    setTip({
      x: clamp(b.left - a.left + b.width / 2, 80, Math.max(80, a.width - 80)),
      y: b.top - a.top,
      text: count === 0 ? 'No uploads' : `${count} ${count === 1 ? 'upload' : 'uploads'}`,
      when: fmtDate(iso, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
    })
  }

  let lastMonth = -1
  return (
    <div className="chart" ref={host}>
      <div className="heat-scroll">
        <div className="heat-months" style={{ gridTemplateColumns: `repeat(${weeks}, 14px)` }}>
          {columns.map((col) => {
            const month = parseISO(col[0]).getMonth()
            const text = month !== lastMonth ? fmtDate(col[0], { month: 'short' }) : ''
            lastMonth = month
            return <span key={col[0]}>{text}</span>
          })}
        </div>
        <div className="heat" role="img" aria-label={`Uploads per day over the last ${weeks} weeks. ${dates.filter((d) => d >= start).length} uploads in total.`}>
          {columns.map((col) =>
            col.map((iso) => {
              const count = counts.get(iso) ?? 0
              return (
                <i
                  key={iso}
                  className={cx('heat-cell', count > 0 && `l${Math.min(count, 3)}`, iso > now && 'future')}
                  onPointerEnter={(e) => iso <= now && show(e.currentTarget, iso, count)}
                  onPointerLeave={() => setTip(null)}
                />
              )
            }),
          )}
        </div>
      </div>
      <div className="heat-legend">
        <span>
          <i className="heat-cell" /> None
        </span>
        <span>
          <i className="heat-cell l1" /> 1 upload
        </span>
        <span>
          <i className="heat-cell l2" /> 2
        </span>
        <span>
          <i className="heat-cell l3" /> 3 or more
        </span>
      </div>
      {tip && (
        <div className="chart-tip" style={{ left: tip.x, top: tip.y }}>
          <div className="chart-tip-value">{tip.text}</div>
          <div className="chart-tip-label">{tip.when}</div>
        </div>
      )}
    </div>
  )
}
