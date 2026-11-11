// Thumbnail model and canvas renderer, shared by the designer and the A/B preview.

import type { Brand } from './data'
import { uid } from './util'

export const TW = 1280
export const TH = 720

export interface Bg {
  type: 'solid' | 'gradient' | 'image'
  color: string
  color2: string
  angle: number
  src: string
  dim: number
}

interface Base {
  id: string
  /** centre of the layer, in canvas pixels */
  x: number
  y: number
  rot: number
}

export interface TextLayer extends Base {
  kind: 'text'
  text: string
  font: string
  size: number
  color: string
  stroke: string
  strokeW: number
  shadow: boolean
  align: 'left' | 'center' | 'right'
  upper: boolean
  /** highlight box colour behind the text, or '' for none */
  box: string
}

export interface ImageLayer extends Base {
  kind: 'image'
  src: string
  w: number
  h: number
  border: string
  borderW: number
}

export interface ShapeLayer extends Base {
  kind: 'rect' | 'ellipse'
  w: number
  h: number
  color: string
  opacity: number
}

export type Layer = TextLayer | ImageLayer | ShapeLayer

export interface Design {
  id: string
  name: string
  videoId?: string
  bg: Bg
  layers: Layer[]
  /** 640 x 360 JPEG data URL, refreshed on save */
  preview: string
  updatedAt: number
}

export type Size = { w: number; h: number }

// ---- fonts ----

export const FONTS = [
  { name: 'Anton', family: 'Anton', weight: 400 },
  { name: 'Bebas Neue', family: 'Bebas Neue', weight: 400 },
  { name: 'Archivo Black', family: 'Archivo Black', weight: 400 },
  { name: 'Bricolage Extra Bold', family: 'Bricolage Grotesque Variable', weight: 800 },
  { name: 'Inter Black', family: 'Inter Variable', weight: 900 },
  { name: 'Impact', family: 'Impact', weight: 400 },
  { name: 'Georgia Bold', family: 'Georgia', weight: 700 },
]

export function fontCss(name: string, size: number): string {
  const f = FONTS.find((x) => x.name === name) ?? FONTS[0]
  return `${f.weight} ${size}px "${f.family}", Impact, "Arial Black", sans-serif`
}

const fontsRequested = new Set<string>()

/** Web fonts load lazily; ask for the face and redraw once it arrives. */
export function ensureFont(name: string, onReady: () => void): void {
  if (fontsRequested.has(name) || !document.fonts) return
  fontsRequested.add(name)
  document.fonts
    .load(fontCss(name, 64))
    .then(onReady)
    .catch(() => {})
}

// ---- images ----

const images = new Map<string, HTMLImageElement | 'loading' | 'error'>()
const waiters = new Map<string, Set<() => void>>()

/** Returns the decoded image if it is ready; otherwise starts loading and calls back when it is. */
export function getImage(src: string, onLoad?: () => void): HTMLImageElement | undefined {
  const hit = images.get(src)
  if (hit instanceof HTMLImageElement) return hit
  if (hit === 'error') return undefined
  if (onLoad) {
    const set = waiters.get(src) ?? new Set()
    set.add(onLoad)
    waiters.set(src, set)
  }
  if (!hit) {
    images.set(src, 'loading')
    const img = new Image()
    img.onload = () => {
      images.set(src, img)
      waiters.get(src)?.forEach((cb) => cb())
      waiters.delete(src)
    }
    img.onerror = () => {
      images.set(src, 'error')
      waiters.delete(src)
    }
    img.src = src
  }
  return undefined
}

// ---- factories ----

export function textLayer(p: Partial<TextLayer> = {}): TextLayer {
  return {
    id: uid(),
    kind: 'text',
    x: TW / 2,
    y: TH / 2,
    rot: 0,
    text: 'YOUR TEXT',
    font: 'Anton',
    size: 150,
    color: '#ffffff',
    stroke: '#000000',
    strokeW: 8,
    shadow: true,
    align: 'center',
    upper: true,
    box: '',
    ...p,
  }
}

export function shapeLayer(kind: 'rect' | 'ellipse', p: Partial<ShapeLayer> = {}): ShapeLayer {
  return { id: uid(), kind, x: TW / 2, y: TH / 2, rot: 0, w: 420, h: kind === 'rect' ? 180 : 420, color: '#e5432a', opacity: 1, ...p }
}

export function imageLayer(src: string, naturalW: number, naturalH: number, p: Partial<ImageLayer> = {}): ImageLayer {
  const scale = Math.min((TH * 0.8) / naturalH, (TW * 0.6) / naturalW, 1)
  return { id: uid(), kind: 'image', x: TW / 2, y: TH / 2, rot: 0, src, w: Math.round(naturalW * scale), h: Math.round(naturalH * scale), border: '#ffffff', borderW: 0, ...p }
}

type Layout = { name: string; blurb: string; build: (brand: Brand) => Pick<Design, 'bg' | 'layers'> }

const pick = (brand: Brand, i: number, fallback: string) => brand.colors[i] ?? fallback

export const LAYOUTS: Layout[] = [
  {
    name: 'Bold statement',
    blurb: 'Two short lines of huge text.',
    build: (b) => ({
      bg: { type: 'gradient', color: pick(b, 1, '#1a1915'), color2: pick(b, 0, '#e5432a'), angle: 135, src: '', dim: 0.3 },
      layers: [textLayer({ text: 'YOUR BIG\nIDEA', font: b.font, x: 430, y: 360, size: 170, align: 'left' })],
    }),
  },
  {
    name: 'Big number',
    blurb: 'A number on the left, the promise on the right.',
    build: (b) => ({
      bg: { type: 'solid', color: pick(b, 1, '#1a1915'), color2: '#000000', angle: 90, src: '', dim: 0.3 },
      layers: [
        shapeLayer('ellipse', { x: 300, y: 360, w: 460, h: 460, color: pick(b, 0, '#e5432a') }),
        textLayer({ text: '7', font: b.font, x: 300, y: 372, size: 360, strokeW: 0 }),
        textLayer({ text: 'MISTAKES\nTO AVOID', font: b.font, x: 870, y: 360, size: 130, align: 'left', strokeW: 0 }),
      ],
    }),
  },
  {
    name: 'Banner',
    blurb: 'A photo area with a title band along the bottom.',
    build: (b) => ({
      bg: { type: 'gradient', color: '#3a3a3a', color2: '#151515', angle: 90, src: '', dim: 0.2 },
      layers: [
        shapeLayer('rect', { x: TW / 2, y: 610, w: TW, h: 220, color: pick(b, 0, '#e5432a') }),
        textLayer({ text: 'TITLE GOES HERE', font: b.font, x: TW / 2, y: 614, size: 130, strokeW: 0, shadow: false }),
      ],
    }),
  },
  {
    name: 'Blank',
    blurb: 'An empty canvas in your brand colour.',
    build: (b) => ({
      bg: { type: 'solid', color: pick(b, 1, '#1a1915'), color2: '#000000', angle: 90, src: '', dim: 0.3 },
      layers: [],
    }),
  },
]

// ---- rendering ----

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number): void {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight)
  const dw = img.naturalWidth * s
  const dh = img.naturalHeight * s
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh)
}

function drawText(ctx: CanvasRenderingContext2D, l: TextLayer): Size {
  const lines = (l.upper ? l.text.toUpperCase() : l.text).split('\n')
  ctx.font = fontCss(l.font, l.size)
  ctx.textBaseline = 'middle'
  ctx.textAlign = l.align
  const lineHeight = l.size * 1.08
  const w = Math.max(l.size * 0.4, ...lines.map((t) => ctx.measureText(t).width))
  const h = lines.length * lineHeight

  if (l.box) {
    const pad = l.size * 0.18
    ctx.fillStyle = l.box
    ctx.fillRect(-w / 2 - pad, -h / 2 - pad * 0.5, w + pad * 2, h + pad)
  }

  const anchor = l.align === 'left' ? -w / 2 : l.align === 'right' ? w / 2 : 0
  const shadowOn = () => {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)'
    ctx.shadowBlur = l.size * 0.12
    ctx.shadowOffsetY = l.size * 0.05
  }
  const shadowOff = () => {
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0
  }

  lines.forEach((t, i) => {
    const y = -h / 2 + lineHeight * (i + 0.5)
    if (l.strokeW > 0) {
      if (l.shadow) shadowOn()
      ctx.lineJoin = 'round'
      ctx.lineWidth = l.strokeW * 2
      ctx.strokeStyle = l.stroke
      ctx.strokeText(t, anchor, y)
      shadowOff()
    } else if (l.shadow) shadowOn()
    ctx.fillStyle = l.color
    ctx.fillText(t, anchor, y)
    shadowOff()
  })
  return { w, h }
}

/**
 * Draw a design at 1280 x 720 (scale the context first for other sizes).
 * `sizes` receives each layer's unrotated bounding box, for hit-testing.
 */
export function renderDesign(
  ctx: CanvasRenderingContext2D,
  d: Pick<Design, 'bg' | 'layers'>,
  image: (src: string) => HTMLImageElement | undefined,
  sizes?: Map<string, Size>,
): void {
  const { bg } = d
  ctx.save()
  if (bg.type === 'gradient') {
    const a = (bg.angle * Math.PI) / 180
    const half = (Math.abs(TW * Math.cos(a)) + Math.abs(TH * Math.sin(a))) / 2
    const dx = Math.cos(a) * half
    const dy = Math.sin(a) * half
    const g = ctx.createLinearGradient(TW / 2 - dx, TH / 2 - dy, TW / 2 + dx, TH / 2 + dy)
    g.addColorStop(0, bg.color)
    g.addColorStop(1, bg.color2)
    ctx.fillStyle = g
  } else ctx.fillStyle = bg.color
  ctx.fillRect(0, 0, TW, TH)

  if (bg.type === 'image' && bg.src) {
    const img = image(bg.src)
    if (img) drawCover(ctx, img, TW, TH)
    if (bg.dim > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${bg.dim})`
      ctx.fillRect(0, 0, TW, TH)
    }
  }

  for (const l of d.layers) {
    ctx.save()
    ctx.translate(l.x, l.y)
    ctx.rotate((l.rot * Math.PI) / 180)
    if (l.kind === 'text') {
      // Draw first, then record: `sizes?.set(id, drawText())` would skip the drawing when no map is passed.
      const size = drawText(ctx, l)
      sizes?.set(l.id, size)
    } else if (l.kind === 'image') {
      if (l.borderW > 0) {
        ctx.fillStyle = l.border
        ctx.fillRect(-l.w / 2 - l.borderW, -l.h / 2 - l.borderW, l.w + l.borderW * 2, l.h + l.borderW * 2)
      }
      const img = image(l.src)
      if (img) ctx.drawImage(img, -l.w / 2, -l.h / 2, l.w, l.h)
      sizes?.set(l.id, { w: l.w, h: l.h })
    } else {
      ctx.globalAlpha = l.opacity
      ctx.fillStyle = l.color
      if (l.kind === 'rect') ctx.fillRect(-l.w / 2, -l.h / 2, l.w, l.h)
      else {
        ctx.beginPath()
        ctx.ellipse(0, 0, l.w / 2, l.h / 2, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      sizes?.set(l.id, { w: l.w, h: l.h })
    }
    ctx.restore()
  }
  ctx.restore()
}

/** Render to an offscreen canvas at the given width (16:9). */
export function renderToCanvas(d: Pick<Design, 'bg' | 'layers'>, width = TW): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = Math.round((width * TH) / TW)
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.scale(width / TW, width / TW)
    renderDesign(ctx, d, (src) => getImage(src))
  }
  return canvas
}

export const renderPreview = (d: Pick<Design, 'bg' | 'layers'>): string => renderToCanvas(d, 640).toDataURL('image/jpeg', 0.82)

// ---- geometry ----

export type Pt = { x: number; y: number }

/** A canvas point expressed in a layer's own unrotated space (origin at its centre). */
export function toLocal(l: Layer, p: Pt): Pt {
  const a = (-l.rot * Math.PI) / 180
  const dx = p.x - l.x
  const dy = p.y - l.y
  return { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) }
}

export const SELECT_PAD = 8
