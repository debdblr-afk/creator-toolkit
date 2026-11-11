// Small shared helpers: ids, dates, numbers, time codes, text and file I/O.

export const uid = (): string => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

export const cx = (...parts: (string | false | null | undefined)[]): string => parts.filter(Boolean).join(' ')

export const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))

export const pad2 = (n: number): string => String(n).padStart(2, '0')

// ---- dates (always local, stored as YYYY-MM-DD) ----

export const toISO = (d: Date): string => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

export const today = (): string => toISO(new Date())

export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y || 1970, (m || 1) - 1, d || 1)
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

export const daysBetween = (a: string, b: string): number =>
  Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86_400_000)

/** Monday of the week that contains the date. */
export function weekStart(iso: string): string {
  const d = parseISO(iso)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return toISO(d)
}

export function fmtDate(iso?: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }): string {
  return iso ? parseISO(iso).toLocaleDateString(undefined, opts) : ''
}

export const fmtDateLong = (iso?: string): string => fmtDate(iso, { day: 'numeric', month: 'short', year: 'numeric' })

export function relativeDay(iso: string): string {
  const n = daysBetween(today(), iso)
  if (n === 0) return 'Today'
  if (n === 1) return 'Tomorrow'
  if (n === -1) return 'Yesterday'
  return n > 0 ? `In ${n} days` : `${-n} days ago`
}

// ---- numbers ----

export const fmtNum = (n: number, digits = 0): string =>
  (Number.isFinite(n) ? n : 0).toLocaleString(undefined, { maximumFractionDigits: digits })

export const fmtCompact = (n: number): string =>
  new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(Number.isFinite(n) ? n : 0)

export function fmtMoney(n: number, currency: string): string {
  const value = Number.isFinite(n) ? n : 0
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    }).format(value)
  } catch {
    return `${currency} ${fmtNum(value, 2)}`
  }
}

export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED']

export function defaultCurrency(): string {
  const region = (navigator.language.split('-')[1] ?? '').toUpperCase()
  const map: Record<string, string> = {
    IN: 'INR', US: 'USD', GB: 'GBP', AU: 'AUD', CA: 'CAD', SG: 'SGD', AE: 'AED',
    DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', IE: 'EUR',
  }
  return map[region] ?? 'USD'
}

// ---- time codes ----

/** 75 -> "1:15", 3725 -> "1:02:05" */
export function fmtTime(sec: number): string {
  const total = Math.max(0, Math.round(sec))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`
}

/** "1:15" -> 75, "90" -> 90, anything else -> null */
export function parseTime(text: string): number | null {
  const t = text.trim()
  if (!/^\d+(:\d{1,2}){0,2}$/.test(t)) return null
  return t.split(':').map(Number).reduce((acc, n) => acc * 60 + n, 0)
}

/** Seconds as a spoken duration: "4 min 10 s" */
export function fmtSpan(sec: number): string {
  const total = Math.max(0, Math.round(sec))
  const m = Math.floor(total / 60)
  const s = total % 60
  if (!m) return `${s} s`
  return s ? `${m} min ${s} s` : `${m} min`
}

// ---- text ----

export const countWords = (s: string): number => (s.trim().match(/\S+/g) ?? []).length

/** Replace {tokens} with values; unknown or empty tokens are left as they are. */
export function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([^{}]+)\}/g, (match, key: string) => vars[key]?.trim() || match)
}

export const slugify = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled'

/** Only http(s) links are ever rendered as clickable; anything else returns null. */
export function safeUrl(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  try {
    const url = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch {
    return null
  }
}

export const fmtBytes =(n: number): string =>
  n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(0)} KB` : n < 1024 ** 3 ? `${(n / 1024 ** 2).toFixed(1)} MB` : `${(n / 1024 ** 3).toFixed(2)} GB`

// ---- colour ----

/** WCAG relative luminance of a #rrggbb colour. */
export function luminance(hex: string): number {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) return 0
  const [r, g, b] = m.slice(1).map((h) => {
    const v = parseInt(h, 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Black or white, whichever reads better on the given colour. */
export const readableOn = (hex: string): string => (contrastRatio(hex, '#000000') >= contrastRatio(hex, '#ffffff') ? '#000000' : '#ffffff')

// ---- file I/O ----

export function download(name: string, data: string | Blob, type = 'text/plain;charset=utf-8'): void {
  const blob = typeof data === 'string' ? new Blob([data], { type }) : data
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    ta.remove()
    return ok
  }
}

export function readAsDataURL(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error ?? new Error('Could not read file'))
    r.readAsDataURL(file)
  })
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Image failed to load'))
    img.src = src
  })
}

/** Read an image file as a data URL, downscaled so the longest side is at most `max` pixels. */
export async function imageFileToDataURL(file: File, max = 1600): Promise<string> {
  const src = await readAsDataURL(file)
  if (file.type === 'image/svg+xml') return src
  const img = await loadImage(src)
  const longest = Math.max(img.naturalWidth, img.naturalHeight)
  if (longest <= max && file.size < 1_200_000) return src
  const scale = Math.min(1, max / longest)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
  canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
  const keepAlpha = file.type === 'image/png' || file.type === 'image/webp'
  return canvas.toDataURL(keepAlpha ? 'image/png' : 'image/jpeg', 0.9)
}

/** Approximate byte size of a base64 data URL. */
export const dataURLBytes = (url: string): number => Math.round(((url.length - url.indexOf(',') - 1) * 3) / 4)
