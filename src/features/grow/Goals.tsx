import { useState } from 'react'
import { Plus, Target, Trash2, X } from 'lucide-react'
import { useCollection, useStored } from '../../lib/store'
import { DEFAULT_STREAK, EMPTY_STRINGS, computeStreak, useUploadDates, type StreakConfig } from '../../lib/data'
import { clamp, daysBetween, fmtDateLong, fmtNum, today } from '../../lib/util'
import { UploadHeatmap } from '../../ui/charts'
import { Btn, Empty, Field, Input, Meter, NumInput, Select, Stat, Status } from '../../ui/kit'

export interface Goal {
  id: string
  name: string
  unit: string
  start: number
  current: number
  target: number
  deadline?: string
  createdAt: number
}

const UNITS = ['subscribers', 'views', 'videos published', 'watch hours', 'revenue']

function GoalCard({ goal, onChange, onRemove }: { goal: Goal; onChange: (p: Partial<Goal>) => void; onRemove: () => void }) {
  const span = goal.target - goal.start
  const reached = goal.current >= goal.target
  const progress = span > 0 ? clamp((goal.current - goal.start) / span, 0, 1) : reached ? 1 : 0
  const remaining = Math.max(0, goal.target - goal.current)
  const daysLeft = goal.deadline ? daysBetween(today(), goal.deadline) : null
  const weeksLeft = daysLeft !== null ? Math.max(1, Math.ceil(daysLeft / 7)) : null

  return (
    <article className="card stack">
      <div className="row nowrap">
        <Input className="grow strong" aria-label="Goal name" value={goal.name} onValue={(name) => onChange({ name })} />
        <Btn variant="ghost" size="sm" aria-label={`Delete goal: ${goal.name}`} icon={<Trash2 size={15} />} onClick={onRemove} />
      </div>
      <Meter label={`Progress on ${goal.name}`} value={progress} max={1} tone={reached ? 'good' : undefined} />
      <div className="row spread">
        <span className="small">
          <b className="num">{fmtNum(goal.current)}</b> of {fmtNum(goal.target)} {goal.unit} · {Math.round(progress * 100)}%
        </span>
        <span className="small muted">{goal.deadline ? `By ${fmtDateLong(goal.deadline)}` : 'No deadline'}</span>
      </div>
      <div className="grid cols-2">
        <Field label="Where you are now">
          <NumInput value={goal.current} onValue={(current) => onChange({ current })} />
        </Field>
        <Field label="Deadline">
          <Input type="date" value={goal.deadline ?? ''} onValue={(v) => onChange({ deadline: v || undefined })} />
        </Field>
      </div>
      {reached ? (
        <Status tone="good">Goal reached. Set the next one.</Status>
      ) : daysLeft !== null && daysLeft < 0 ? (
        <Status tone="warn">The deadline has passed with {fmtNum(remaining)} still to go. Move the date or adjust the target.</Status>
      ) : weeksLeft !== null ? (
        <Status tone="info">
          {fmtNum(remaining)} to go. A pace of about {fmtNum(Math.ceil(remaining / weeksLeft))} a week gets you there on time ({daysLeft} days left).
        </Status>
      ) : null}
    </article>
  )
}

export default function Goals() {
  const { items: goals, add, update, remove } = useCollection<Goal>('goals')
  const [cfg, setCfg] = useStored<StreakConfig>('streak', DEFAULT_STREAK)
  const [log, setLog] = useStored<string[]>('uploadLog', EMPTY_STRINGS)
  const dates = useUploadDates()
  const streak = computeStreak(dates, cfg.perWeek)

  const [unit, setUnit] = useState(UNITS[0])
  const [now, setNow] = useState(0)
  const [target, setTarget] = useState(0)
  const [deadline, setDeadline] = useState('')
  const [logDate, setLogDate] = useState(today())

  const addGoal = () => {
    if (target <= 0) return
    add({ name: `Reach ${fmtNum(target)} ${unit}`, unit, start: now, current: now, target, deadline: deadline || undefined, createdAt: Date.now() })
    setNow(0)
    setTarget(0)
    setDeadline('')
  }

  const weeks = (n: number) => `${n} ${n === 1 ? 'week' : 'weeks'}`

  return (
    <div className="split even">
      <div className="stack">
        <div className="grid cols-3">
          <Stat label="Current streak" value={weeks(streak.current)} hint={`Target: ${streak.target} a week`} />
          <Stat label="Best streak" value={weeks(streak.best)} hint="Weeks in a row on target" />
          <Stat
            label="This week"
            value={`${streak.thisWeek} of ${streak.target}`}
            hint={streak.thisWeek >= streak.target ? 'Target met' : `${streak.target - streak.thisWeek} more to keep the streak`}
          />
        </div>

        <figure className="card stack">
          <figcaption>
            <h2 className="card-title">Uploads, last 26 weeks</h2>
            <p className="small muted">Videos marked Published with a publish date count automatically. Each column is a week, Monday at the top.</p>
          </figcaption>
          <UploadHeatmap dates={dates} />
        </figure>

        <section className="card stack">
          <h2 className="card-title">Streak settings</h2>
          <div className="grid cols-2">
            <Field label="Uploads a week to count as on target">
              <NumInput min={1} max={7} value={cfg.perWeek} onValue={(n) => setCfg({ perWeek: clamp(Math.round(n) || 1, 1, 7) })} />
            </Field>
            <Field label="Log an upload made outside this app">
              <div className="row nowrap">
                <Input type="date" max={today()} value={logDate} onValue={setLogDate} />
                <Btn disabled={!logDate || logDate > today()} onClick={() => setLog((prev) => [...prev, logDate].sort())}>
                  Log
                </Btn>
              </div>
            </Field>
          </div>
          {log.length > 0 && (
            <div className="row">
              <span className="small muted">Logged by hand:</span>
              {[...log]
                .reverse()
                .slice(0, 8)
                .map((d, i) => (
                  <span key={`${d}-${i}`} className="chip">
                    {fmtDateLong(d)}
                    <button
                      type="button"
                      aria-label={`Remove upload logged on ${fmtDateLong(d)}`}
                      onClick={() =>
                        setLog((prev) => {
                          const at = prev.lastIndexOf(d)
                          return at < 0 ? prev : [...prev.slice(0, at), ...prev.slice(at + 1)]
                        })
                      }
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
            </div>
          )}
        </section>
      </div>

      <div className="stack">
        <section className="card stack">
          <h2 className="card-title">Set a goal</h2>
          <div className="grid cols-2">
            <Field label="What you are counting">
              <Select value={unit} onValue={setUnit}>
                {UNITS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </Select>
            </Field>
            <Field label="Deadline (optional)">
              <Input type="date" min={today()} value={deadline} onValue={setDeadline} />
            </Field>
            <Field label="Where you are now">
              <NumInput min={0} value={now} onValue={setNow} />
            </Field>
            <Field label="Target">
              <NumInput min={0} value={target} onValue={setTarget} />
            </Field>
          </div>
          <div>
            <Btn variant="primary" icon={<Plus size={16} />} disabled={target <= 0 || target <= now} onClick={addGoal}>
              Add goal
            </Btn>
          </div>
        </section>

        {goals.length === 0 ? (
          <Empty icon={<Target size={22} />} title="No goals yet">
            Pick one number that matters this quarter. A target with a date turns into a weekly pace you can check.
          </Empty>
        ) : (
          goals.map((g) => <GoalCard key={g.id} goal={g} onChange={(p) => update(g.id, p)} onRemove={() => remove(g.id)} />)
        )}
      </div>
    </div>
  )
}
