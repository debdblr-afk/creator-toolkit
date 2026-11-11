import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, Upload } from 'lucide-react'
import { useStored } from '../../lib/store'
import { DEFAULT_BRAND, type Brand } from '../../lib/data'
import { FONTS } from '../../lib/thumb'
import { contrastRatio, imageFileToDataURL, readableOn } from '../../lib/util'
import { Btn, CopyBtn, Field, Input, Select, Status, Textarea, toast } from '../../ui/kit'

const isHex = (s: string): boolean => /^#[0-9a-f]{6}$/i.test(s)

function HexInput({ value, onChange, label }: { value: string; onChange: (hex: string) => void; label: string }) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  return (
    <input
      className="input hex"
      aria-label={label}
      spellCheck={false}
      maxLength={7}
      value={text}
      onChange={(e) => {
        const next = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`
        setText(next)
        if (isHex(next)) onChange(next.toLowerCase())
      }}
      onBlur={() => setText(value)}
    />
  )
}

export default function BrandKit() {
  const [stored, setBrand] = useStored<Brand>('brand', DEFAULT_BRAND)
  const brand: Brand = { ...DEFAULT_BRAND, ...stored }
  const patch = (p: Partial<Brand>) => setBrand((prev) => ({ ...DEFAULT_BRAND, ...prev, ...p }))
  const [fg, setFg] = useState(2)
  const [bg, setBg] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  const colors = brand.colors
  const setColor = (i: number, hex: string) => patch({ colors: colors.map((c, j) => (j === i ? hex : c)) })
  const font = FONTS.find((f) => f.name === brand.font) ?? FONTS[0]
  const textColor = colors[Math.min(fg, colors.length - 1)] ?? '#ffffff'
  const backColor = colors[Math.min(bg, colors.length - 1)] ?? '#000000'
  const ratio = contrastRatio(textColor, backColor)

  const onLogo = async (file: File | undefined) => {
    if (!file) return
    try {
      patch({ logo: await imageFileToDataURL(file, 512) })
    } catch {
      toast('That image could not be read.')
    }
  }

  return (
    <div className="split">
      <div className="stack">
        <section className="card stack">
          <h2 className="card-title">Identity</h2>
          <div className="grid cols-2">
            <Field label="Channel name">
              <Input placeholder="Tiny Kitchen Lab" value={brand.channel} onValue={(channel) => patch({ channel })} />
            </Field>
            <Field label="Tagline">
              <Input placeholder="Big meals from small kitchens" value={brand.tagline} onValue={(tagline) => patch({ tagline })} />
            </Field>
          </div>
          <Field label="Voice" hint="Three words for how you sound, plus anything you always or never say.">
            <Textarea rows={3} placeholder="Warm, direct, a bit dry. Always metric. Never 'smash that like button'." value={brand.voice} onValue={(voice) => patch({ voice })} />
          </Field>
        </section>

        <section className="card stack">
          <div className="row spread">
            <h2 className="card-title">Colours</h2>
            <span className="small muted">The first two are used for new thumbnail backgrounds</span>
          </div>
          <div className="brand-colors">
            {colors.map((c, i) => (
              <div key={i} className="brand-color">
                <div className="brand-chip" style={{ background: c, color: readableOn(c) }}>
                  Aa
                </div>
                <div className="row nowrap">
                  <input type="color" className="input" aria-label={`Colour ${i + 1}`} value={isHex(c) ? c : '#000000'} onChange={(e) => setColor(i, e.target.value)} />
                  <HexInput label={`Colour ${i + 1} hex value`} value={c} onChange={(hex) => setColor(i, hex)} />
                  <Btn variant="ghost" size="sm" aria-label={`Remove colour ${i + 1}`} disabled={colors.length <= 2} icon={<Trash2 size={15} />} onClick={() => patch({ colors: colors.filter((_, j) => j !== i) })} />
                </div>
              </div>
            ))}
          </div>
          <div className="row">
            <Btn icon={<Plus size={16} />} disabled={colors.length >= 8} onClick={() => patch({ colors: [...colors, '#3a7bd5'] })}>
              Add colour
            </Btn>
            <CopyBtn text={colors.join(', ')} label="Copy hex values" />
          </div>
        </section>

        <section className="card stack">
          <h2 className="card-title">Contrast check</h2>
          <p className="small muted">Thumbnail text has to be readable at a glance. Pick a text colour and a background from your palette.</p>
          <div className="grid cols-2">
            <Field label="Text colour">
              <Select value={String(Math.min(fg, colors.length - 1))} onValue={(v) => setFg(Number(v))}>
                {colors.map((c, i) => (
                  <option key={i} value={i}>
                    Colour {i + 1} ({c})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Background">
              <Select value={String(Math.min(bg, colors.length - 1))} onValue={(v) => setBg(Number(v))}>
                {colors.map((c, i) => (
                  <option key={i} value={i}>
                    Colour {i + 1} ({c})
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="contrast-sample" style={{ background: backColor, color: textColor, fontFamily: `"${font.family}", sans-serif`, fontWeight: font.weight }}>
            READ ME FAST
          </div>
          {ratio >= 4.5 ? (
            <Status tone="good">Contrast {ratio.toFixed(1)} to 1. Readable at any size.</Status>
          ) : ratio >= 3 ? (
            <Status tone="warn">Contrast {ratio.toFixed(1)} to 1. Fine for large, heavy text; add an outline for anything smaller.</Status>
          ) : (
            <Status tone="bad">Contrast {ratio.toFixed(1)} to 1. Too low: the text will disappear at thumbnail size.</Status>
          )}
        </section>

        <section className="card stack">
          <h2 className="card-title">Thumbnail font and logo</h2>
          <div className="grid cols-2">
            <Field label="Default thumbnail font">
              <Select value={font.name} onValue={(name) => patch({ font: name })}>
                {FONTS.map((f) => (
                  <option key={f.name}>{f.name}</option>
                ))}
              </Select>
            </Field>
            <div className="field">
              <span className="field-label">Logo or watermark</span>
              <div className="row">
                {brand.logo && <img className="brand-logo" src={brand.logo} alt="Current logo" />}
                <Btn icon={<Upload size={16} />} onClick={() => fileRef.current?.click()}>
                  {brand.logo ? 'Replace' : 'Upload'}
                </Btn>
                {brand.logo && (
                  <Btn variant="ghost" onClick={() => patch({ logo: '' })}>
                    Remove
                  </Btn>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    void onLogo(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
              </div>
            </div>
          </div>
        </section>
      </div>

      <aside className="stack sticky">
        <div className="card stack">
          <h2 className="card-title">Preview</h2>
          <div className="brand-preview" style={{ background: `linear-gradient(135deg, ${colors[1] ?? '#1a1915'}, ${colors[0] ?? '#e5432a'})` }}>
            <span style={{ fontFamily: `"${font.family}", sans-serif`, fontWeight: font.weight, color: readableOn(colors[1] ?? '#1a1915') }}>
              YOUR BIG
              <br />
              IDEA
            </span>
          </div>
          <div className="brand-row">
            {brand.logo ? (
              <img className="brand-avatar" src={brand.logo} alt="" />
            ) : (
              <span className="brand-avatar" style={{ background: colors[0] ?? '#e5432a', color: readableOn(colors[0] ?? '#e5432a') }}>
                {(brand.channel.trim().charAt(0) || 'C').toUpperCase()}
              </span>
            )}
            <div className="grow">
              <div className="strong truncate">{brand.channel.trim() || 'Your channel name'}</div>
              <div className="small muted truncate">{brand.tagline.trim() || 'Your tagline'}</div>
            </div>
          </div>
          <p className="small muted">The thumbnail designer starts every new design from these colours, this font and this logo.</p>
        </div>
      </aside>
    </div>
  )
}
