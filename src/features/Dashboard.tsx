import type { ReactNode } from 'react'
import { Sparkles, TriangleAlert } from 'lucide-react'
import { GROUPS, TOOLS } from '../registry'
import { Link } from '../lib/router'
import { useCollection, useStored } from '../lib/store'
import {
  DEFAULT_BRAND,
  DEFAULT_STREAK,
  STAGES,
  computeStreak,
  useUploadDates,
  useVideos,
  type Brand,
  type Idea,
  type StreakConfig,
} from '../lib/data'
import { fmtDate, pad2, relativeDay, today } from '../lib/util'
import { Btn, toast } from '../ui/kit'
import { loadSample } from '../lib/sample'

function Kpi({ to, label, value, hint }: { to: string; label: string; value: ReactNode; hint: ReactNode }) {
  return (
    <Link className="stat" to={to}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-hint truncate">{hint}</div>
    </Link>
  )
}

export default function Dashboard() {
  const { items: videos } = useVideos()
  const { items: ideas } = useCollection<Idea>('ideas')
  const [brand] = useStored<Brand>('brand', DEFAULT_BRAND)
  const [streakCfg] = useStored<StreakConfig>('streak', DEFAULT_STREAK)
  const [backupAt] = useStored<number>('lastBackupAt', 0)
  const streak = computeStreak(useUploadDates(), streakCfg.perWeek)

  const now = today()
  const next = videos
    .filter((v) => v.publishDate && v.stage !== 'published' && v.publishDate >= now)
    .sort((a, b) => (a.publishDate as string).localeCompare(b.publishDate as string))[0]
  const inProduction = videos.filter((v) => v.stage !== 'published').length
  const openIdeas = ideas.filter((i) => !i.videoId).length
  const isEmpty = !videos.length && !ideas.length
  const backupStale = !isEmpty && (!backupAt || Date.now() - backupAt > 14 * 86_400_000)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <>
      <section className="hero">
        <h1>
          {greeting}
          {brand.channel ? `, ${brand.channel}` : ''}
        </h1>
        <p>Thirty tools that take a video from first idea to published and paid. Everything you make is saved in this browser, with no account.</p>
      </section>

      {isEmpty ? (
        <>
          <div className="callout">
            <div className="grow">
              <h2>New here? Try it with a sample channel</h2>
              <p>Loads a small fictional cooking channel so every tool has something in it. You can erase it later from Backup and restore.</p>
            </div>
            <Btn
              variant="primary"
              icon={<Sparkles size={16} />}
              onClick={() => {
                loadSample()
                toast('Sample channel loaded')
              }}
            >
              Load sample channel
            </Btn>
          </div>
          <div className="steps">
            <Link className="step" to="/ideas">
              <span className="step-n">Step 1</span>
              <b>Capture an idea</b>
              <span>Add your first video idea to the idea bank.</span>
            </Link>
            <Link className="step" to="/script">
              <span className="step-n">Step 2</span>
              <b>Write the script</b>
              <span>Start a video project and draft what you will say.</span>
            </Link>
            <Link className="step" to="/calendar">
              <span className="step-n">Step 3</span>
              <b>Pick a publish date</b>
              <span>Put it on the calendar and work backwards.</span>
            </Link>
          </div>
        </>
      ) : (
        <>
          <div className="kpis">
            <Kpi
              to="/calendar"
              label="Next upload"
              value={next?.publishDate ? relativeDay(next.publishDate) : 'Not set'}
              hint={next ? `${next.title} · ${fmtDate(next.publishDate)}` : 'Schedule a video on the calendar'}
            />
            <Kpi to="/pipeline" label="In production" value={inProduction} hint={`${videos.length - inProduction} published so far`} />
            <Kpi to="/ideas" label="Ideas waiting" value={openIdeas} hint={`${ideas.length} captured in total`} />
            <Kpi
              to="/goals"
              label="Upload streak"
              value={`${streak.current} ${streak.current === 1 ? 'week' : 'weeks'}`}
              hint={`Best ${streak.best} · target ${streak.target} a week`}
            />
          </div>
          <Link className="pipeline" to="/pipeline" aria-label="Videos by production stage. Open the production kanban.">
            {STAGES.map((s) => (
              <div className="pipeline-step" key={s.id}>
                <b>{videos.filter((v) => v.stage === s.id).length}</b>
                <span>{s.name}</span>
              </div>
            ))}
          </Link>
          {backupStale && (
            <div className="status warn section-gap">
              <TriangleAlert size={16} />
              <span>
                {backupAt ? 'Your last backup is more than two weeks old.' : 'You have not made a backup yet.'} Clearing browser data would erase your work.{' '}
                <Link to="/backup">Export a backup</Link>.
              </span>
            </div>
          )}
        </>
      )}

      {GROUPS.map((g) => (
        <section key={g.id} className="tool-section" data-group={g.id}>
          <div className="tool-section-head">
            <h2>{g.name}</h2>
            <p className="muted">{g.tagline}</p>
          </div>
          <div className="tool-grid">
            {TOOLS.filter((t) => t.group === g.id).map((t) => (
              <Link key={t.slug} className="tool-card" to={`/${t.slug}`}>
                <span className="tool-icon">
                  <t.icon size={20} />
                </span>
                <span className="tool-name">
                  {t.name}
                  <span className="tool-num">{pad2(t.n)}</span>
                </span>
                <span className="tool-blurb">{t.blurb}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}
