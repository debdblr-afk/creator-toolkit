// Shared UI building blocks used by every tool.

import {
  Component,
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { Check, CircleAlert, CircleCheck, Copy, Info, Plus, Star, TriangleAlert, X } from 'lucide-react'
import { clamp, copyText, cx, fmtTime, parseTime } from '../lib/util'
import {
  STAGES,
  deleteVideo,
  newVideo,
  stageName,
  useActiveVideo,
  useVideos,
  type Series,
  type StageId,
  type Video,
} from '../lib/data'
import { useCollection, useStored } from '../lib/store'

// ---- buttons ----

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'ghost' | 'danger'
  size?: 'md' | 'sm'
  icon?: ReactNode
}

export function Btn({ variant = 'default', size = 'md', icon, className, children, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      {...rest}
      className={cx('btn', variant !== 'default' && `btn-${variant}`, size === 'sm' && 'btn-sm', !children && 'btn-icon', className)}
    >
      {icon}
      {children}
    </button>
  )
}

/** A destructive button that asks for a second click before acting. */
export function ConfirmBtn({
  onConfirm,
  children,
  confirmLabel = 'Click again to confirm',
  size = 'md',
  icon,
  ...rest
}: Omit<BtnProps, 'onClick' | 'variant'> & { onConfirm: () => void; confirmLabel?: string }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = window.setTimeout(() => setArmed(false), 3500)
    return () => window.clearTimeout(t)
  }, [armed])
  return (
    <Btn
      {...rest}
      size={size}
      icon={armed ? undefined : icon}
      variant={armed ? 'danger' : 'ghost'}
      onClick={() => {
        if (armed) {
          setArmed(false)
          onConfirm()
        } else setArmed(true)
      }}
    >
      {armed ? confirmLabel : children}
    </Btn>
  )
}

export function CopyBtn({ text, label = 'Copy', size = 'md', variant = 'default' }: { text: string; label?: string; size?: 'md' | 'sm'; variant?: BtnProps['variant'] }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(t)
  }, [copied])
  return (
    <Btn
      size={size}
      variant={variant}
      icon={copied ? <Check size={15} /> : <Copy size={15} />}
      disabled={!text}
      onClick={async () => {
        if (await copyText(text)) setCopied(true)
        else toast('Could not copy. Select the text and copy it manually.')
      }}
    >
      {copied ? 'Copied' : label}
    </Btn>
  )
}

// ---- form controls ----

type WithValue<T> = Omit<T, 'onChange'> & { onValue?: (value: string) => void }

export function Input({ onValue, className, ...rest }: WithValue<InputHTMLAttributes<HTMLInputElement>>) {
  return <input {...rest} className={cx('input', className)} onChange={(e) => onValue?.(e.target.value)} />
}

export function Textarea({ onValue, className, ...rest }: WithValue<TextareaHTMLAttributes<HTMLTextAreaElement>>) {
  return <textarea {...rest} className={cx('input', className)} onChange={(e) => onValue?.(e.target.value)} />
}

export function Select({ onValue, className, children, ...rest }: WithValue<SelectHTMLAttributes<HTMLSelectElement>>) {
  return (
    <select {...rest} className={cx('input', className)} onChange={(e) => onValue?.(e.target.value)}>
      {children}
    </select>
  )
}

type NumProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { value: number; onValue: (n: number) => void }

/** Number field that can be cleared while typing; an empty field counts as 0. */
export function NumInput({ value, onValue, className, ...rest }: NumProps) {
  const [text, setText] = useState(() => (value ? String(value) : ''))
  useEffect(() => {
    if ((parseFloat(text) || 0) !== value) setText(value ? String(value) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <input
      type="number"
      inputMode="decimal"
      placeholder="0"
      {...rest}
      className={cx('input', className)}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        onValue(parseFloat(e.target.value) || 0)
      }}
    />
  )
}

/** Duration field in m:ss (or h:mm:ss); the value is seconds. */
export function TimeInput({ value, onValue, className, ...rest }: NumProps) {
  const [text, setText] = useState(() => fmtTime(value))
  useEffect(() => {
    if ((parseTime(text) ?? 0) !== value) setText(fmtTime(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <input
      inputMode="numeric"
      placeholder="0:00"
      {...rest}
      className={cx('input', className)}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        if (!e.target.value.trim()) onValue(0)
        else {
          const s = parseTime(e.target.value)
          if (s != null) onValue(s)
        }
      }}
      onBlur={() => setText(fmtTime(value))}
    />
  )
}

export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx('field', className)}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode }[]
  label?: string
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} className={cx('seg-btn', o.value === value && 'on')} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function TagEditor({ tags, onChange, placeholder = 'Type a tag, press Enter' }: { tags: string[]; onChange: (tags: string[]) => void; placeholder?: string }) {
  const [text, setText] = useState('')
  const commit = (raw: string) => {
    const incoming = raw.split(',').map((t) => t.trim()).filter(Boolean)
    setText('')
    if (!incoming.length) return
    const seen = new Set(tags.map((t) => t.toLowerCase()))
    const merged = [...tags]
    for (const t of incoming) {
      if (seen.has(t.toLowerCase())) continue
      seen.add(t.toLowerCase())
      merged.push(t)
    }
    if (merged.length !== tags.length) onChange(merged)
  }
  return (
    <div className="tag-editor">
      {tags.map((t) => (
        <span key={t} className="chip">
          {t}
          <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))}>
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        value={text}
        placeholder={placeholder}
        aria-label="Add tag"
        onChange={(e) => (e.target.value.includes(',') ? commit(e.target.value) : setText(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit(text)
          } else if (e.key === 'Backspace' && !text && tags.length) onChange(tags.slice(0, -1))
        }}
        onBlur={() => commit(text)}
      />
    </div>
  )
}

export function Stars({ value, onChange, label = 'Rating' }: { value: number; onChange?: (n: number) => void; label?: string }) {
  return (
    <span className="stars" role="group" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!onChange} aria-label={`${n} of 5`} aria-pressed={n === value} className={cx(n <= value && 'on')} onClick={() => onChange?.(n === value ? 0 : n)}>
          <Star size={15} fill={n <= value ? 'currentColor' : 'none'} />
        </button>
      ))}
    </span>
  )
}

// ---- layout pieces ----

export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={cx('modal', wide && 'modal-wide')} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <Btn variant="ghost" size="sm" aria-label="Close" icon={<X size={18} />} onClick={onClose} />
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Empty({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      {icon && <div className="empty-icon">{icon}</div>}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  )
}

/** Stat tile: a label, one value and an optional line of context. */
export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  )
}

/** Progress meter. The track is a lighter step of the fill colour, so state reads across the whole bar. */
export function Meter({ value, max = 1, tone, label }: { value: number; max?: number; tone?: 'good' | 'warn' | 'bad'; label: string }) {
  const pct = max > 0 ? clamp((value / max) * 100, 0, 100) : 0
  return (
    <div className={cx('meter', tone && `meter-${tone}`)} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
      <i style={{ width: `${pct}%` }} />
    </div>
  )
}

export type Tone = 'good' | 'warn' | 'bad' | 'info'

/** A status line: always an icon plus words, never colour on its own. */
export function Status({ tone, children }: { tone: Tone; children: ReactNode }) {
  const Icon = tone === 'good' ? CircleCheck : tone === 'warn' ? TriangleAlert : tone === 'bad' ? CircleAlert : Info
  return (
    <div className={`status ${tone}`}>
      <Icon size={15} />
      <span>{children}</span>
    </div>
  )
}

export function StageBadge({ stage }: { stage: StageId }) {
  return (
    <span className="badge" data-stage={stage}>
      {stageName(stage)}
    </span>
  )
}

// ---- toasts ----

let pushToast: (msg: string) => void = () => {}

export function toast(msg: string): void {
  pushToast(msg)
}

export function Toaster() {
  const [items, setItems] = useState<{ id: number; msg: string }[]>([])
  useEffect(() => {
    pushToast = (msg) => {
      const id = Date.now() + Math.random()
      setItems((prev) => [...prev, { id, msg }])
      window.setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), 2800)
    }
    return () => {
      pushToast = () => {}
    }
  }, [])
  return (
    <div className="toasts no-print" aria-live="polite">
      {items.map((i) => (
        <div key={i.id} className="toast">
          {i.msg}
        </div>
      ))}
    </div>
  )
}

// ---- video picker shared by every per-video tool ----

export function VideoBar({ children }: { children?: ReactNode }) {
  const { items: videos, add } = useVideos()
  const [, setCurrent] = useStored<string>('currentVideoId', '')
  const active = useActiveVideo()
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')

  const create = () => {
    const t = title.trim()
    if (!t) return
    const video = add(newVideo(t))
    setCurrent(video.id)
    setTitle('')
    setCreating(false)
  }

  if (!active || creating) {
    return (
      <form
        className="videobar no-print"
        onSubmit={(e) => {
          e.preventDefault()
          create()
        }}
      >
        <span className="videobar-label">{videos.length ? 'New video' : 'Start a video project'}</span>
        <Input autoFocus={creating} aria-label="Working title" placeholder="Working title, e.g. My first desk setup tour" value={title} onValue={setTitle} />
        <Btn variant="primary" type="submit" disabled={!title.trim()}>
          Create
        </Btn>
        {videos.length > 0 && (
          <Btn variant="ghost" onClick={() => setCreating(false)}>
            Cancel
          </Btn>
        )}
      </form>
    )
  }

  return (
    <div className="videobar no-print">
      <span className="videobar-label">Working on</span>
      <Select aria-label="Video project" value={active.id} onValue={setCurrent}>
        {videos.map((v) => (
          <option key={v.id} value={v.id}>
            {v.title}
          </option>
        ))}
      </Select>
      <StageBadge stage={active.stage} />
      <Btn variant="ghost" size="sm" icon={<Plus size={15} />} onClick={() => setCreating(true)}>
        New video
      </Btn>
      {children && <div className="videobar-extra">{children}</div>}
    </div>
  )
}

export function NeedVideo() {
  return (
    <Empty title="Name a video project to begin">
      This tool saves its work per video. Give your video a working title in the bar above and everything you do here stays attached to it.
    </Empty>
  )
}

export function VideoModal({ video, onClose }: { video: Video; onClose: () => void }) {
  const { update } = useVideos()
  const { items: series } = useCollection<Series>('series')
  return (
    <Modal
      title="Video details"
      onClose={onClose}
      footer={
        <>
          <ConfirmBtn
            onConfirm={() => {
              deleteVideo(video.id)
              onClose()
            }}
          >
            Delete video
          </ConfirmBtn>
          <Btn variant="primary" onClick={onClose}>
            Done
          </Btn>
        </>
      }
    >
      <div className="stack">
        <Field label="Working title">
          <Input value={video.title} onValue={(title) => update(video.id, { title })} />
        </Field>
        <div className="grid cols-2">
          <Field label="Stage">
            <Select value={video.stage} onValue={(v) => update(video.id, { stage: v as StageId })}>
              {STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Publish date">
            <Input type="date" value={video.publishDate ?? ''} onValue={(v) => update(video.id, { publishDate: v || undefined })} />
          </Field>
        </div>
        <Field label="Series">
          <Select value={video.seriesId ?? ''} onValue={(v) => update(video.id, { seriesId: v || undefined })}>
            <option value="">Not part of a series</option>
            {series.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notes">
          <Textarea rows={4} value={video.notes ?? ''} onValue={(notes) => update(video.id, { notes })} />
        </Field>
      </div>
    </Modal>
  )
}

// ---- error boundary so one broken tool never blanks the whole app ----

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <Empty title="This tool hit a problem">
          {this.state.error.message || 'Something went wrong.'} Reload the page to try again. Your saved data is not affected.
        </Empty>
      )
    }
    return this.props.children
  }
}
