import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { ArrowDown, ArrowLeft, ArrowUp, Circle, CopyPlus, Download, Image as ImageIcon, ImagePlus, Square, Trash2, Type } from 'lucide-react'
import { useCollection, useStored } from '../../lib/store'
import { DEFAULT_BRAND, useActiveVideo, useVideos, type Brand } from '../../lib/data'
import {
  FONTS,
  LAYOUTS,
  SELECT_PAD,
  TH,
  TW,
  ensureFont,
  fontCss,
  getImage,
  imageLayer,
  renderDesign,
  renderPreview,
  renderToCanvas,
  shapeLayer,
  textLayer,
  toLocal,
  type Design,
  type ImageLayer,
  type Layer,
  type Pt,
  type ShapeLayer,
  type Size,
  type TextLayer,
} from '../../lib/thumb'
import { clamp, cx, download, fmtBytes, fmtDate, imageFileToDataURL, loadImage, slugify, toISO, uid } from '../../lib/util'
import { Btn, ConfirmBtn, Empty, Field, Input, Segmented, Select, Textarea, Toggle, toast } from '../../ui/kit'

type LayerPatch = Partial<Omit<TextLayer, 'kind'> & Omit<ImageLayer, 'kind'> & Omit<ShapeLayer, 'kind'>>
type Drag = { mode: 'move' | 'resize'; start: Pt; layer: Layer; box: Size }

function ColorField({ label, value, onChange, swatches }: { label: string; value: string; onChange: (v: string) => void; swatches: string[] }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="color-field">
        <input type="color" className="input" aria-label={label} value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} />
        {swatches.map((c) => (
          <button key={c} type="button" className="swatch" style={{ background: c }} title={c} aria-label={`Use brand colour ${c}`} onClick={() => onChange(c)} />
        ))}
      </div>
    </div>
  )
}

function Range({ label, value, min, max, step = 1, unit = '', onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <label className="field">
      <span className="field-label row spread">
        <span>{label}</span>
        <span className="num muted">
          {Math.round(value * 100) / 100}
          {unit}
        </span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

function drawSelection(ctx: CanvasRenderingContext2D, l: Layer, box: Size): void {
  const w = box.w + SELECT_PAD * 2
  const h = box.h + SELECT_PAD * 2
  ctx.save()
  ctx.translate(l.x, l.y)
  ctx.rotate((l.rot * Math.PI) / 180)
  ctx.lineWidth = 7
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.strokeRect(-w / 2, -h / 2, w, h)
  ctx.lineWidth = 3
  ctx.strokeStyle = '#2a78d6'
  ctx.strokeRect(-w / 2, -h / 2, w, h)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(w / 2 - 12, h / 2 - 12, 24, 24)
  ctx.strokeRect(w / 2 - 12, h / 2 - 12, 24, 24)
  ctx.restore()
}

const layerLabel = (l: Layer): string =>
  l.kind === 'text' ? l.text.split('\n')[0] || 'Empty text' : l.kind === 'image' ? 'Image' : l.kind === 'rect' ? 'Rectangle' : 'Ellipse'

function Editor({ initial, brand, onSave, onClose }: { initial: Design; brand: Brand; onSave: (d: Design) => void; onClose: () => void }) {
  const { items: videos } = useVideos()
  const [draft, setDraft] = useState(initial)
  const [selId, setSelId] = useState<string | null>(null)
  const [, setTick] = useState(0)
  const draftRef = useRef(initial)
  const dirty = useRef(false)
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sizes = useRef(new Map<string, Size>())
  const drag = useRef<Drag | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const bgFileRef = useRef<HTMLInputElement>(null)

  const redraw = useCallback(() => setTick((n) => n + 1), [])
  const selected = draft.layers.find((l) => l.id === selId)
  const swatches = brand.colors.slice(0, 6)

  const change = useCallback((fn: (d: Design) => Design) => {
    const next = fn(draftRef.current)
    draftRef.current = next
    dirty.current = true
    setDraft(next)
  }, [])

  const save = useCallback(() => {
    if (!dirty.current) return
    dirty.current = false
    const d = draftRef.current
    onSaveRef.current({ ...d, preview: renderPreview(d), updatedAt: Date.now() })
  }, [])

  // Autosave shortly after the last change, and once more when leaving the editor.
  useEffect(() => {
    const t = window.setTimeout(save, 600)
    return () => window.clearTimeout(t)
  }, [draft, save])
  useEffect(() => () => save(), [save])

  // A brand-new design has no preview yet: make one once fonts have had a moment to load.
  useEffect(() => {
    if (initial.preview) return
    const t = window.setTimeout(() => {
      dirty.current = true
      save()
    }, 700)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Paint on every render: cheap, and it keeps the canvas in step with the draft and the selection.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    for (const l of draft.layers) if (l.kind === 'text') ensureFont(l.font, redraw)
    sizes.current.clear()
    renderDesign(ctx, draft, (src) => getImage(src, redraw), sizes.current)
    if (selected) {
      const box = sizes.current.get(selected.id)
      if (box) drawSelection(ctx, selected, box)
    }
  })

  const patchLayer = (id: string, p: LayerPatch) => change((d) => ({ ...d, layers: d.layers.map((l) => (l.id === id ? ({ ...l, ...p } as Layer) : l)) }))
  const setBg = (p: Partial<Design['bg']>) => change((d) => ({ ...d, bg: { ...d.bg, ...p } }))

  const addLayer = (l: Layer) => {
    change((d) => ({ ...d, layers: [...d.layers, l] }))
    setSelId(l.id)
  }

  const removeLayer = (id: string) => {
    change((d) => ({ ...d, layers: d.layers.filter((l) => l.id !== id) }))
    setSelId(null)
  }

  const reorder = (id: string, dir: -1 | 1) =>
    change((d) => {
      const i = d.layers.findIndex((l) => l.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= d.layers.length) return d
      const layers = [...d.layers]
      ;[layers[i], layers[j]] = [layers[j], layers[i]]
      return { ...d, layers }
    })

  const addImage = async (file: File | undefined, asBackground: boolean) => {
    if (!file) return
    try {
      const src = await imageFileToDataURL(file, asBackground ? 1920 : 1400)
      if (asBackground) {
        setBg({ type: 'image', src })
        return
      }
      const img = await loadImage(src)
      addLayer(imageLayer(src, img.naturalWidth, img.naturalHeight))
    } catch {
      toast('That image could not be read.')
    }
  }

  const addLogo = async () => {
    try {
      const img = await loadImage(brand.logo)
      const w = 200
      addLayer(imageLayer(brand.logo, img.naturalWidth, img.naturalHeight, { w, h: Math.round((img.naturalHeight / img.naturalWidth) * w), x: TW - 150, y: 110 }))
    } catch {
      toast('The logo in your brand kit could not be loaded.')
    }
  }

  const exportAs = (type: 'image/png' | 'image/jpeg') => {
    renderToCanvas(draftRef.current).toBlob(
      (blob) => {
        if (!blob) {
          toast('Export failed. Try again.')
          return
        }
        download(`${slugify(draftRef.current.name)}.${type === 'image/png' ? 'png' : 'jpg'}`, blob)
        toast(`Exported 1280 × 720, ${fmtBytes(blob.size)}${blob.size > 2_000_000 ? '. That is over 2 MB: export as JPG instead.' : ''}`)
      },
      type,
      0.92,
    )
  }

  // ---- pointer + keyboard on the canvas ----

  const point = (e: PointerEvent<HTMLCanvasElement>): Pt => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: ((e.clientX - r.left) * TW) / r.width, y: ((e.clientY - r.top) * TH) / r.height }
  }

  const hit = (p: Pt): Layer | undefined => {
    const layers = draftRef.current.layers
    for (let i = layers.length - 1; i >= 0; i--) {
      const box = sizes.current.get(layers[i].id)
      if (!box) continue
      const q = toLocal(layers[i], p)
      if (Math.abs(q.x) <= box.w / 2 + SELECT_PAD && Math.abs(q.y) <= box.h / 2 + SELECT_PAD) return layers[i]
    }
    return undefined
  }

  const onDown = (e: PointerEvent<HTMLCanvasElement>) => {
    const p = point(e)
    e.currentTarget.setPointerCapture(e.pointerId)
    const current = draftRef.current.layers.find((l) => l.id === selId)
    const box = current && sizes.current.get(current.id)
    if (current && box) {
      const q = toLocal(current, p)
      if (Math.abs(q.x - (box.w / 2 + SELECT_PAD)) < 30 && Math.abs(q.y - (box.h / 2 + SELECT_PAD)) < 30) {
        drag.current = { mode: 'resize', start: p, layer: current, box }
        return
      }
    }
    const target = hit(p)
    setSelId(target?.id ?? null)
    drag.current = target ? { mode: 'move', start: p, layer: target, box: sizes.current.get(target.id) ?? { w: 1, h: 1 } } : null
  }

  const onMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current
    if (!d) return
    const p = point(e)
    const l = d.layer
    if (d.mode === 'move') {
      let x = l.x + p.x - d.start.x
      let y = l.y + p.y - d.start.y
      if (Math.abs(x - TW / 2) < 12) x = TW / 2
      if (Math.abs(y - TH / 2) < 12) y = TH / 2
      patchLayer(l.id, { x: Math.round(x), y: Math.round(y) })
      return
    }
    const q = toLocal(l, p)
    if (l.kind === 'text') {
      const k = clamp((q.x - SELECT_PAD) / (d.box.w / 2), 0.15, 8)
      patchLayer(l.id, { size: clamp(Math.round(l.size * k), 16, 500) })
    } else if (l.kind === 'image') {
      const k = clamp((q.x - SELECT_PAD) / (l.w / 2), 0.05, 20)
      patchLayer(l.id, { w: Math.max(20, Math.round(l.w * k)), h: Math.max(20, Math.round(l.h * k)) })
    } else {
      patchLayer(l.id, { w: Math.max(20, Math.round((q.x - SELECT_PAD) * 2)), h: Math.max(20, Math.round((q.y - SELECT_PAD) * 2)) })
    }
  }

  const onUp = (e: PointerEvent<HTMLCanvasElement>) => {
    drag.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }

  const onKey = (e: KeyboardEvent<HTMLCanvasElement>) => {
    if (!selected) return
    const step = e.shiftKey ? 20 : 2
    const nudge: Record<string, LayerPatch> = {
      ArrowLeft: { x: selected.x - step },
      ArrowRight: { x: selected.x + step },
      ArrowUp: { y: selected.y - step },
      ArrowDown: { y: selected.y + step },
    }
    if (nudge[e.key]) {
      e.preventDefault()
      patchLayer(selected.id, nudge[e.key])
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      removeLayer(selected.id)
    } else if (e.key === 'Escape') setSelId(null)
  }

  const fromTop = [...draft.layers].reverse()

  return (
    <div className="stack">
      <div className="row spread">
        <div className="row grow">
          <Btn variant="ghost" icon={<ArrowLeft size={16} />} onClick={onClose}>
            All thumbnails
          </Btn>
          <Input className="thumb-name" aria-label="Thumbnail name" value={draft.name} onValue={(name) => change((d) => ({ ...d, name }))} />
          <Select className="thumb-video" aria-label="Video this thumbnail is for" value={draft.videoId ?? ''} onValue={(v) => change((d) => ({ ...d, videoId: v || undefined }))}>
            <option value="">Not linked to a video</option>
            {videos.map((v) => (
              <option key={v.id} value={v.id}>
                {v.title}
              </option>
            ))}
          </Select>
        </div>
        <div className="row">
          <Btn variant="primary" icon={<Download size={16} />} onClick={() => exportAs('image/png')}>
            PNG
          </Btn>
          <Btn icon={<Download size={16} />} onClick={() => exportAs('image/jpeg')}>
            JPG
          </Btn>
        </div>
      </div>

      <div className="thumb-editor">
        <div className="stack">
          <div className="row">
            <Btn size="sm" icon={<Type size={15} />} onClick={() => addLayer(textLayer({ font: brand.font }))}>
              Text
            </Btn>
            <Btn size="sm" icon={<ImagePlus size={15} />} onClick={() => fileRef.current?.click()}>
              Image
            </Btn>
            <Btn size="sm" icon={<Square size={15} />} onClick={() => addLayer(shapeLayer('rect', { color: swatches[0] ?? '#e5432a' }))}>
              Rectangle
            </Btn>
            <Btn size="sm" icon={<Circle size={15} />} onClick={() => addLayer(shapeLayer('ellipse', { color: swatches[0] ?? '#e5432a' }))}>
              Ellipse
            </Btn>
            {brand.logo && (
              <Btn size="sm" onClick={() => void addLogo()}>
                Logo
              </Btn>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                void addImage(e.target.files?.[0], false)
                e.target.value = ''
              }}
            />
            <input
              ref={bgFileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                void addImage(e.target.files?.[0], true)
                e.target.value = ''
              }}
            />
          </div>
          <canvas
            ref={canvasRef}
            className="thumb-canvas"
            width={TW}
            height={TH}
            tabIndex={0}
            aria-label="Thumbnail canvas. Click a layer to select it, drag to move it, use the arrow keys to nudge it."
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onKeyDown={onKey}
          />
          <p className="small muted">Drag a layer to move it; it snaps to the centre lines. Drag the square handle to resize. Saved automatically.</p>
        </div>

        <aside className="stack">
          <div className="card stack">
            <h2 className="card-title">Layers</h2>
            <ul className="stack tight">
              {fromTop.map((l) => {
                const index = draft.layers.indexOf(l)
                return (
                  <li key={l.id} className={cx('layer-row', l.id === selId && 'on')}>
                    <button type="button" className="layer-pick" aria-pressed={l.id === selId} onClick={() => setSelId(l.id)}>
                      {l.kind === 'text' ? <Type size={14} /> : l.kind === 'image' ? <ImageIcon size={14} /> : l.kind === 'rect' ? <Square size={14} /> : <Circle size={14} />}
                      <span className="truncate">{layerLabel(l)}</span>
                    </button>
                    <Btn variant="ghost" size="sm" aria-label="Bring forward" disabled={index === draft.layers.length - 1} icon={<ArrowUp size={14} />} onClick={() => reorder(l.id, 1)} />
                    <Btn variant="ghost" size="sm" aria-label="Send backward" disabled={index === 0} icon={<ArrowDown size={14} />} onClick={() => reorder(l.id, -1)} />
                    <Btn variant="ghost" size="sm" aria-label="Duplicate layer" icon={<CopyPlus size={14} />} onClick={() => addLayer({ ...l, id: uid(), x: l.x + 30, y: l.y + 30 })} />
                    <Btn variant="ghost" size="sm" aria-label="Delete layer" icon={<Trash2 size={14} />} onClick={() => removeLayer(l.id)} />
                  </li>
                )
              })}
              <li className={cx('layer-row', !selected && 'on')}>
                <button type="button" className="layer-pick" aria-pressed={!selected} onClick={() => setSelId(null)}>
                  <span className="layer-bg" style={{ background: draft.bg.color }} />
                  <span>Background</span>
                </button>
              </li>
            </ul>
          </div>

          <div className="card stack">
            {!selected && (
              <>
                <h2 className="card-title">Background</h2>
                <Segmented
                  label="Background type"
                  value={draft.bg.type}
                  onChange={(type) => setBg({ type })}
                  options={[
                    { value: 'solid', label: 'Solid' },
                    { value: 'gradient', label: 'Gradient' },
                    { value: 'image', label: 'Photo' },
                  ]}
                />
                <ColorField label={draft.bg.type === 'gradient' ? 'From' : 'Colour'} value={draft.bg.color} swatches={swatches} onChange={(color) => setBg({ color })} />
                {draft.bg.type === 'gradient' && (
                  <>
                    <ColorField label="To" value={draft.bg.color2} swatches={swatches} onChange={(color2) => setBg({ color2 })} />
                    <Range label="Angle" unit="°" min={0} max={360} step={5} value={draft.bg.angle} onChange={(angle) => setBg({ angle })} />
                  </>
                )}
                {draft.bg.type === 'image' && (
                  <>
                    <Btn icon={<ImagePlus size={16} />} onClick={() => bgFileRef.current?.click()}>
                      {draft.bg.src ? 'Replace photo' : 'Choose a photo'}
                    </Btn>
                    <Range label="Darken" min={0} max={0.8} step={0.05} value={draft.bg.dim} onChange={(dim) => setBg({ dim })} />
                  </>
                )}
              </>
            )}

            {selected?.kind === 'text' && (
              <>
                <h2 className="card-title">Text</h2>
                <Field label="Words" hint="Three to five words read best at small sizes.">
                  <Textarea rows={3} value={selected.text} onValue={(text) => patchLayer(selected.id, { text })} />
                </Field>
                <Field label="Font">
                  <Select value={selected.font} onValue={(font) => patchLayer(selected.id, { font })}>
                    {FONTS.map((f) => (
                      <option key={f.name}>{f.name}</option>
                    ))}
                  </Select>
                </Field>
                <Segmented
                  label="Alignment"
                  value={selected.align}
                  onChange={(align) => patchLayer(selected.id, { align })}
                  options={[
                    { value: 'left', label: 'Left' },
                    { value: 'center', label: 'Centre' },
                    { value: 'right', label: 'Right' },
                  ]}
                />
                <Range label="Size" min={30} max={420} step={2} value={selected.size} onChange={(size) => patchLayer(selected.id, { size })} />
                <ColorField label="Colour" value={selected.color} swatches={swatches} onChange={(color) => patchLayer(selected.id, { color })} />
                <ColorField label="Outline" value={selected.stroke} swatches={swatches} onChange={(stroke) => patchLayer(selected.id, { stroke })} />
                <Range label="Outline width" min={0} max={30} value={selected.strokeW} onChange={(strokeW) => patchLayer(selected.id, { strokeW })} />
                <div className="row">
                  <Toggle checked={selected.shadow} onChange={(shadow) => patchLayer(selected.id, { shadow })}>
                    Shadow
                  </Toggle>
                  <Toggle checked={selected.upper} onChange={(upper) => patchLayer(selected.id, { upper })}>
                    Capitals
                  </Toggle>
                  <Toggle checked={!!selected.box} onChange={(on) => patchLayer(selected.id, { box: on ? (swatches[0] ?? '#000000') : '' })}>
                    Highlight box
                  </Toggle>
                </div>
                {selected.box && <ColorField label="Box colour" value={selected.box} swatches={swatches} onChange={(box) => patchLayer(selected.id, { box })} />}
              </>
            )}

            {selected?.kind === 'image' && (
              <>
                <h2 className="card-title">Image</h2>
                <Range
                  label="Width"
                  unit=" px"
                  min={40}
                  max={1600}
                  step={4}
                  value={selected.w}
                  onChange={(w) => patchLayer(selected.id, { w, h: Math.round((selected.h / selected.w) * w) })}
                />
                <Range label="Border width" min={0} max={40} value={selected.borderW} onChange={(borderW) => patchLayer(selected.id, { borderW })} />
                {selected.borderW > 0 && <ColorField label="Border colour" value={selected.border} swatches={swatches} onChange={(border) => patchLayer(selected.id, { border })} />}
              </>
            )}

            {(selected?.kind === 'rect' || selected?.kind === 'ellipse') && (
              <>
                <h2 className="card-title">{selected.kind === 'rect' ? 'Rectangle' : 'Ellipse'}</h2>
                <ColorField label="Colour" value={selected.color} swatches={swatches} onChange={(color) => patchLayer(selected.id, { color })} />
                <Range label="Width" unit=" px" min={20} max={TW} step={4} value={selected.w} onChange={(w) => patchLayer(selected.id, { w })} />
                <Range label="Height" unit=" px" min={20} max={TH} step={4} value={selected.h} onChange={(h) => patchLayer(selected.id, { h })} />
                <Range label="Opacity" min={0.1} max={1} step={0.05} value={selected.opacity} onChange={(opacity) => patchLayer(selected.id, { opacity })} />
              </>
            )}

            {selected && (
              <>
                <Range label="Rotate" unit="°" min={-45} max={45} value={selected.rot} onChange={(rot) => patchLayer(selected.id, { rot })} />
                <Btn size="sm" onClick={() => patchLayer(selected.id, { x: TW / 2, y: TH / 2 })}>
                  Centre on the canvas
                </Btn>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

function LayoutThumb({ layout, brand }: { layout: (typeof LAYOUTS)[number]; brand: Brand }) {
  const [src, setSrc] = useState('')
  const colors = brand.colors.join(',')
  useEffect(() => {
    let live = true
    const draw = () => {
      if (live) setSrc(renderToCanvas(layout.build(brand), 320).toDataURL('image/jpeg', 0.8))
    }
    draw()
    document.fonts?.load(fontCss(brand.font, 64)).then(draw).catch(() => {})
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, brand.font, colors])
  return src ? <img className="layout-thumb" src={src} alt="" /> : <div className="layout-thumb" />
}

export default function ThumbnailDesigner() {
  const { items: designs, add, update, remove } = useCollection<Design>('thumbnails')
  const [activeId, setActiveId] = useStored<string>('thumbnails:active', '')
  const [stored] = useStored<Brand>('brand', DEFAULT_BRAND)
  const brand: Brand = { ...DEFAULT_BRAND, ...stored }
  const video = useActiveVideo()
  const active = designs.find((d) => d.id === activeId)

  if (active) {
    return <Editor key={active.id} initial={active} brand={brand} onSave={(d) => update(d.id, d)} onClose={() => setActiveId('')} />
  }

  const create = (layout: (typeof LAYOUTS)[number]) => {
    const design = add({
      name: video ? video.title : `Thumbnail ${designs.length + 1}`,
      videoId: video?.id,
      ...layout.build(brand),
      preview: '',
      updatedAt: Date.now(),
    })
    setActiveId(design.id)
  }

  const duplicate = (d: Design) => {
    const { id: _omit, ...rest } = d
    add({ ...rest, name: `${d.name} copy`, layers: d.layers.map((l) => ({ ...l, id: uid() })), updatedAt: Date.now() })
  }

  const sorted = [...designs].sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <div className="stack loose">
      <section className="stack">
        <h2 className="card-title">Start a new thumbnail</h2>
        <div className="grid cols-4">
          {LAYOUTS.map((l) => (
            <button key={l.name} type="button" className="card preset" onClick={() => create(l)}>
              <LayoutThumb layout={l} brand={brand} />
              <strong>{l.name}</strong>
              <span className="small muted">{l.blurb}</span>
            </button>
          ))}
        </div>
        <p className="small muted">
          New thumbnails start from your brand kit colours and font{video ? ` and are linked to “${video.title}”` : ''}.
        </p>
      </section>

      <section className="stack">
        <h2 className="card-title">Your thumbnails</h2>
        {designs.length === 0 ? (
          <Empty icon={<ImagePlus size={22} />} title="No thumbnails yet">
            Pick a starting layout above. Designs are saved here so you can make a second version and compare them in the A/B preview.
          </Empty>
        ) : (
          <div className="grid cols-auto">
            {sorted.map((d) => (
              <article key={d.id} className="card flush thumb-card">
                <button type="button" className="thumb-open" aria-label={`Open ${d.name}`} onClick={() => setActiveId(d.id)}>
                  {d.preview ? <img src={d.preview} alt="" /> : <div className="layout-thumb" />}
                </button>
                <div className="thumb-card-foot">
                  <div className="grow">
                    <div className="strong truncate">{d.name}</div>
                    <div className="tiny muted">Edited {fmtDate(toISO(new Date(d.updatedAt)))}</div>
                  </div>
                  <Btn variant="ghost" size="sm" aria-label={`Duplicate ${d.name}`} icon={<CopyPlus size={15} />} onClick={() => duplicate(d)} />
                  <ConfirmBtn size="sm" aria-label={`Delete ${d.name}`} confirmLabel="Delete?" icon={<Trash2 size={15} />} onConfirm={() => remove(d.id)} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
