import { useEffect, useMemo, useRef, useState } from 'react'
import { Maximize, Minimize, Pause, Play, RotateCcw } from 'lucide-react'
import { useDoc, useStored } from '../../lib/store'
import { EMPTY_SCRIPT, useActiveVideo, type ScriptDoc } from '../../lib/data'
import { Link } from '../../lib/router'
import { clamp, cx, fmtTime } from '../../lib/util'
import { Btn, Segmented, Textarea, Toggle, VideoBar } from '../../ui/kit'

interface Config {
  speed: number
  size: number
  width: number
  mirror: boolean
  cues: boolean
}

const DEFAULTS: Config = { speed: 60, size: 44, width: 72, mirror: false, cues: false }

type Line = { kind: 'heading' | 'text' | 'gap'; text: string }

function toLines(body: string, showCues: boolean): Line[] {
  const out: Line[] = []
  for (const raw of body.split('\n')) {
    const line = raw.trim()
    if (!line) {
      if (out.length && out[out.length - 1].kind !== 'gap') out.push({ kind: 'gap', text: '' })
    } else if (line.startsWith('#')) {
      out.push({ kind: 'heading', text: line.replace(/^#+\s*/, '') })
    } else {
      const text = showCues ? line : line.replace(/\[[^\]\n]*\]/g, '').replace(/\s{2,}/g, ' ').trim()
      if (text) out.push({ kind: 'text', text })
    }
  }
  return out
}

export default function Teleprompter() {
  const video = useActiveVideo()
  const [script] = useDoc<ScriptDoc>('scripts', video?.id, EMPTY_SCRIPT)
  const [stored, setCfg] = useStored<Config>('teleprompter', DEFAULTS)
  const cfg = { ...DEFAULTS, ...stored }
  const patch = (p: Partial<Config>) => setCfg((prev) => ({ ...DEFAULTS, ...prev, ...p }))

  const [source, setSource] = useState<'script' | 'custom'>(() => (script.body.trim() ? 'script' : 'custom'))
  const [custom, setCustom] = useState('')
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [range, setRange] = useState(0)
  const [full, setFull] = useState(false)

  const stage = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const pos = useRef(0)
  const speed = useRef(cfg.speed)
  speed.current = cfg.speed

  const body = source === 'script' ? script.body : custom
  const lines = useMemo(() => toLines(body, cfg.cues), [body, cfg.cues])

  const measure = () => {
    const el = scroller.current
    if (!el) return
    const max = Math.max(0, el.scrollHeight - el.clientHeight)
    setRange(max)
    setProgress(max ? clamp(el.scrollTop / max, 0, 1) : 0)
  }

  // Re-measure whenever the text or its size changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(measure, [lines, cfg.size, cfg.width, full])

  useEffect(() => {
    if (!playing) return
    const el = scroller.current
    if (!el) return
    let raf = 0
    let last = performance.now()
    pos.current = el.scrollTop
    const tick = (now: number) => {
      // Cap the step so a stalled tab does not jump, but tolerate slow frame rates.
      const dt = Math.min(0.25, (now - last) / 1000)
      last = now
      // If the reader scrolled by hand, carry on from where they left it.
      if (Math.abs(el.scrollTop - pos.current) > 2) pos.current = el.scrollTop
      pos.current += speed.current * dt
      const max = el.scrollHeight - el.clientHeight
      if (pos.current >= max) {
        el.scrollTop = max
        setPlaying(false)
        return
      }
      el.scrollTop = pos.current
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  const restart = () => {
    pos.current = 0
    if (scroller.current) scroller.current.scrollTop = 0
    setProgress(0)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName ?? ''
      if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(tag)) return
      if (e.code === 'Space') {
        e.preventDefault()
        setPlaying((p) => !p)
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        const next = clamp(speed.current + (e.key === 'ArrowUp' ? 5 : -5), 10, 200)
        setCfg((prev) => ({ ...DEFAULTS, ...prev, speed: next }))
      } else if (e.key === 'Home') {
        restart()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setCfg])

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === stage.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else stage.current?.requestFullscreen?.()?.catch(() => {})
  }

  const remaining = cfg.speed > 0 ? (range * (1 - progress)) / cfg.speed : 0

  return (
    <>
      {video && <VideoBar />}
      <div className="row spread">
        <Segmented
          label="Text source"
          value={source}
          onChange={(v) => {
            setSource(v)
            setPlaying(false)
          }}
          options={[
            { value: 'script', label: 'Video script' },
            { value: 'custom', label: 'Pasted text' },
          ]}
        />
        <span className="small muted">Space starts and pauses. Up and down arrows change the speed.</span>
      </div>

      {source === 'custom' && (
        <Textarea className="section-gap" rows={4} aria-label="Text to read" placeholder="Paste the text you want to read from" value={custom} onValue={setCustom} />
      )}

      <div className={cx('tp', full && 'full')} ref={stage}>
        <div className="tp-scroll" ref={scroller} onScroll={measure} style={{ fontSize: cfg.size }} tabIndex={0} aria-label="Teleprompter text">
          <div className={cx('tp-text', cfg.mirror && 'mirror')} style={{ width: `${cfg.width}%` }}>
            {lines.length === 0 ? (
              <p className="tp-empty">
                {source === 'script' ? (
                  <>
                    This video has no script yet. <Link to="/script">Write one in the script editor</Link>, or switch to pasted text.
                  </>
                ) : (
                  'Paste some text above to begin.'
                )}
              </p>
            ) : (
              lines.map((line, i) =>
                line.kind === 'gap' ? (
                  <div key={i} className="tp-gap" />
                ) : line.kind === 'heading' ? (
                  <p key={i} className="tp-heading">
                    {line.text}
                  </p>
                ) : (
                  <p key={i}>
                    {line.text.split(/(\[[^\]\n]*\])/).map((part, j) =>
                      part.startsWith('[') ? (
                        <span key={j} className="tp-cue">
                          {part}
                        </span>
                      ) : (
                        part
                      ),
                    )}
                  </p>
                ),
              )
            )}
          </div>
        </div>
        <div className="tp-guide" aria-hidden="true" />
        <div className="tp-bar">
          <div className="tp-progress">
            <i style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="tp-controls">
            <Btn variant="primary" disabled={!lines.length} icon={playing ? <Pause size={16} /> : <Play size={16} />} onClick={() => setPlaying((p) => !p)}>
              {playing ? 'Pause' : 'Start'}
            </Btn>
            <Btn icon={<RotateCcw size={16} />} onClick={restart}>
              Restart
            </Btn>
            <label className="tp-slider">
              Speed
              <input type="range" min={10} max={200} step={5} value={cfg.speed} onChange={(e) => patch({ speed: Number(e.target.value) })} />
              <b>{cfg.speed}</b>
            </label>
            <label className="tp-slider">
              Text size
              <input type="range" min={24} max={96} step={2} value={cfg.size} onChange={(e) => patch({ size: Number(e.target.value) })} />
              <b>{cfg.size}</b>
            </label>
            <label className="tp-slider">
              Width
              <input type="range" min={40} max={100} step={4} value={cfg.width} onChange={(e) => patch({ width: Number(e.target.value) })} />
              <b>{cfg.width}%</b>
            </label>
            <Toggle checked={cfg.mirror} onChange={(mirror) => patch({ mirror })}>
              Mirror
            </Toggle>
            <Toggle checked={cfg.cues} onChange={(cues) => patch({ cues })}>
              Show cues
            </Toggle>
            <span className="tp-left num">{lines.length ? `${fmtTime(remaining)} left` : ''}</span>
            <Btn icon={full ? <Minimize size={16} /> : <Maximize size={16} />} onClick={toggleFull}>
              {full ? 'Exit full screen' : 'Full screen'}
            </Btn>
          </div>
        </div>
      </div>
    </>
  )
}
