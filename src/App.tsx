import { Suspense, useEffect, useRef, useState } from 'react'
import { LayoutDashboard, Menu, Moon, Search, Sun } from 'lucide-react'
import { GROUPS, TOOLS, type Tool } from './registry'
import { Link, navigate, useRoute } from './lib/router'
import { cx, pad2 } from './lib/util'
import { Btn, Empty, ErrorBoundary, Toaster } from './ui/kit'
import Dashboard from './features/Dashboard'

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <path d="M9 9.5h9.5M9 16h6.5M9 22.5h9.5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M19.5 12.2v7.6l5.6-3.8z" fill="#fff" />
    </svg>
  )
}

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'))
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem('ct-theme', next)
    } catch {
      /* theme just won't persist */
    }
    setTheme(next)
  }
  return [theme, toggle] as const
}

export default function App() {
  const route = useRoute()
  const slug = route.replace(/^\/+/, '').split(/[/?]/)[0]
  const tool = TOOLS.find((t) => t.slug === slug)
  const group = tool && GROUPS.find((g) => g.id === tool.group)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [theme, toggleTheme] = useTheme()
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setOpen(false)
    window.scrollTo(0, 0)
  }, [route])

  useEffect(() => {
    document.title = tool ? `${tool.name} · Creator Toolkit` : 'Creator Toolkit'
  }, [tool])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const needle = query.trim().toLowerCase()
  const matches = (t: Tool) => !needle || t.name.toLowerCase().includes(needle) || t.blurb.toLowerCase().includes(needle)
  const found = TOOLS.filter(matches)
  const View = tool?.view

  return (
    <div className="app">
      <header className="topbar no-print">
        <Btn variant="ghost" aria-label="Open menu" icon={<Menu size={20} />} onClick={() => setOpen(true)} />
        <Link to="/" className="brand">
          <BrandMark />
          Creator Toolkit
        </Link>
      </header>

      {open && <div className="scrim no-print" onClick={() => setOpen(false)} />}

      <aside className={cx('side no-print', open && 'open')}>
        <Link to="/" className="brand">
          <BrandMark />
          Creator Toolkit
        </Link>

        <div className="side-search">
          <Search size={15} />
          <input
            ref={searchRef}
            className="input"
            type="search"
            placeholder="Find a tool"
            aria-label="Find a tool"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && needle && found[0]) {
                navigate(`/${found[0].slug}`)
                setQuery('')
              }
            }}
          />
          {!query && <kbd>⌘K</kbd>}
        </div>

        <nav className="nav" aria-label="Tools">
          {!needle && (
            <Link to="/" className={cx('nav-link', !slug && 'on')} aria-current={!slug ? 'page' : undefined}>
              <LayoutDashboard size={16} />
              Dashboard
            </Link>
          )}
          {GROUPS.map((g) => {
            const tools = found.filter((t) => t.group === g.id)
            if (!tools.length) return null
            return (
              <div key={g.id} className="nav-group" data-group={g.id}>
                <div className="nav-group-title">{g.name}</div>
                {tools.map((t) => (
                  <Link key={t.slug} to={`/${t.slug}`} className={cx('nav-link', t.slug === slug && 'on')} aria-current={t.slug === slug ? 'page' : undefined}>
                    <t.icon size={16} />
                    <span>{t.name}</span>
                    <span className="nav-num">{pad2(t.n)}</span>
                  </Link>
                ))}
              </div>
            )
          })}
          {needle && !found.length && <p className="muted small" style={{ padding: '8px 10px' }}>No tool matches “{query}”.</p>}
        </nav>

        <div className="side-foot">
          <button type="button" className="nav-link" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <p className="tiny muted">
            Your work is saved in this browser only. <Link to="/backup">Back it up</Link>.
          </p>
        </div>
      </aside>

      <main className="main" data-group={tool?.group}>
        <div className="main-inner">
          {tool && group && View ? (
            <>
              <header className="page-head">
                <div className="eyebrow">
                  <Link to="/">All tools</Link>
                  <span aria-hidden="true">/</span>
                  {group.name} · {pad2(tool.n)} of {TOOLS.length}
                </div>
                <h1>{tool.name}</h1>
                <p>{tool.blurb}</p>
              </header>
              <ErrorBoundary key={tool.slug}>
                <Suspense fallback={<div className="loading">Loading…</div>}>
                  <View />
                </Suspense>
              </ErrorBoundary>
            </>
          ) : slug ? (
            <Empty title="That page does not exist" action={<Link className="btn btn-primary" to="/">Back to the dashboard</Link>}>
              The link may be out of date. All 30 tools are listed on the dashboard.
            </Empty>
          ) : (
            <Dashboard />
          )}
        </div>
      </main>

      <Toaster />
    </div>
  )
}
