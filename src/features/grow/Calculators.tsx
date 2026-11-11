import type { ReactNode } from 'react'
import { useStored } from '../../lib/store'
import { useSettings } from '../../lib/data'
import { fmtMoney, fmtNum, fmtTime } from '../../lib/util'
import { Btn, Field, Meter, NumInput, Status, TimeInput } from '../../ui/kit'

interface Calc {
  impressions: number
  clicks: number
  length: number
  avd: number
  revenue: number
  views: number
  monthlyViews: number
  rpm: number
  whViews: number
  whAvd: number
  whGoal: number
}

const DEFAULTS: Calc = { impressions: 0, clicks: 0, length: 0, avd: 0, revenue: 0, views: 0, monthlyViews: 0, rpm: 0, whViews: 0, whAvd: 0, whGoal: 4000 }

function Result({ value, caption }: { value: ReactNode; caption: string }) {
  return (
    <div className="calc-result">
      <div className="calc-value">{value}</div>
      <div className="small muted">{caption}</div>
    </div>
  )
}

export default function Calculators() {
  const [stored, setCalc] = useStored<Calc>('calc', DEFAULTS)
  const c = { ...DEFAULTS, ...stored }
  const set = (p: Partial<Calc>) => setCalc((prev) => ({ ...DEFAULTS, ...prev, ...p }))
  const [settings] = useSettings()
  const money = (n: number) => fmtMoney(Math.round(n * 100) / 100, settings.currency)

  const ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0
  const watched = c.length > 0 ? (c.avd / c.length) * 100 : 0
  const rpm = c.views > 0 ? (c.revenue / c.views) * 1000 : 0
  const monthly = (c.monthlyViews / 1000) * c.rpm
  const hours = (c.whViews * c.whAvd) / 3600
  const hoursLeft = Math.max(0, c.whGoal - hours)
  const viewsNeeded = c.whAvd > 0 ? Math.ceil((hoursLeft * 3600) / c.whAvd) : 0

  return (
    <div className="grid cols-2">
      <section className="card stack">
        <div>
          <h2 className="card-title">Click-through rate</h2>
          <p className="small muted">Of the people shown your thumbnail, how many clicked.</p>
        </div>
        <div className="grid cols-2">
          <Field label="Impressions">
            <NumInput min={0} value={c.impressions} onValue={(impressions) => set({ impressions })} />
          </Field>
          <Field label="Views from impressions">
            <NumInput min={0} value={c.clicks} onValue={(clicks) => set({ clicks })} />
          </Field>
        </div>
        <Result value={`${fmtNum(ctr, 1)}%`} caption="Click-through rate" />
        {c.impressions > 0 &&
          (ctr < 2 ? (
            <Status tone="info">Below the 2% to 10% range that YouTube says half of all channels and videos fall in. A new thumbnail or title is the usual first test.</Status>
          ) : ctr <= 10 ? (
            <Status tone="info">Inside the 2% to 10% range that YouTube says half of all channels and videos fall in.</Status>
          ) : (
            <Status tone="info">Above the 2% to 10% range most channels see. Common when most impressions go to existing subscribers.</Status>
          ))}
      </section>

      <section className="card stack">
        <div>
          <h2 className="card-title">Share of the video watched</h2>
          <p className="small muted">Average view duration as a share of the video&rsquo;s length.</p>
        </div>
        <div className="grid cols-2">
          <Field label="Video length (m:ss)">
            <TimeInput value={c.length} onValue={(length) => set({ length })} />
          </Field>
          <Field label="Average view duration (m:ss)">
            <TimeInput value={c.avd} onValue={(avd) => set({ avd })} />
          </Field>
        </div>
        <Result value={`${fmtNum(watched)}%`} caption="Average share watched" />
        {c.length > 0 && (
          <p className="small muted">
            To reach 50% on this video, the average viewer would need to watch {fmtTime(c.length / 2)}. Compare videos of similar length: longer videos almost always show a lower share.
          </p>
        )}
      </section>

      <section className="card stack">
        <div>
          <h2 className="card-title">RPM</h2>
          <p className="small muted">What you earn per 1,000 views, after YouTube&rsquo;s share, across every income source on the video.</p>
        </div>
        <div className="grid cols-2">
          <Field label={`Revenue (${settings.currency})`}>
            <NumInput min={0} step={0.01} value={c.revenue} onValue={(revenue) => set({ revenue })} />
          </Field>
          <Field label="Views">
            <NumInput min={0} value={c.views} onValue={(views) => set({ views })} />
          </Field>
        </div>
        <Result value={money(rpm)} caption="Revenue per 1,000 views" />
        <div>
          <Btn size="sm" disabled={rpm <= 0} onClick={() => set({ rpm: Math.round(rpm * 100) / 100 })}>
            Use this RPM in the forecast
          </Btn>
        </div>
      </section>

      <section className="card stack">
        <div>
          <h2 className="card-title">Earnings forecast</h2>
          <p className="small muted">A rough projection from monthly views and RPM. Real income moves with season, topic and audience location.</p>
        </div>
        <div className="grid cols-2">
          <Field label="Views a month">
            <NumInput min={0} value={c.monthlyViews} onValue={(monthlyViews) => set({ monthlyViews })} />
          </Field>
          <Field label={`RPM (${settings.currency})`}>
            <NumInput min={0} step={0.01} value={c.rpm} onValue={(v) => set({ rpm: v })} />
          </Field>
        </div>
        <div className="grid cols-2">
          <Result value={money(monthly)} caption="A month" />
          <Result value={money(monthly * 12)} caption="A year at this pace" />
        </div>
      </section>

      <section className="card stack calc-wide">
        <div>
          <h2 className="card-title">Watch hours</h2>
          <p className="small muted">
            Views multiplied by average view duration. The goal starts at 4,000 hours, the long-standing public watch-hour requirement for the YouTube Partner Program&rsquo;s ad revenue. Requirements change,
            so confirm the current ones in YouTube Studio.
          </p>
        </div>
        <div className="grid cols-3">
          <Field label="Views in the last 12 months">
            <NumInput min={0} value={c.whViews} onValue={(whViews) => set({ whViews })} />
          </Field>
          <Field label="Average view duration (m:ss)">
            <TimeInput value={c.whAvd} onValue={(whAvd) => set({ whAvd })} />
          </Field>
          <Field label="Goal (hours)">
            <NumInput min={0} value={c.whGoal} onValue={(whGoal) => set({ whGoal })} />
          </Field>
        </div>
        <div className="grid cols-2">
          <Result value={fmtNum(hours)} caption={`Watch hours, of a ${fmtNum(c.whGoal)} hour goal`} />
          <Result value={fmtNum(viewsNeeded)} caption="More views needed at this average duration" />
        </div>
        <Meter label="Progress to the watch hour goal" value={hours} max={c.whGoal || 1} tone={hours >= c.whGoal && c.whGoal > 0 ? 'good' : undefined} />
        {hours >= c.whGoal && c.whGoal > 0 && <Status tone="good">Goal reached.</Status>}
      </section>
    </div>
  )
}
