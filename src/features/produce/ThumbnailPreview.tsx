import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { useCollection, useStored } from '../../lib/store'
import { DEFAULT_BRAND, useActiveVideo, type Brand } from '../../lib/data'
import type { Design } from '../../lib/thumb'
import { Link } from '../../lib/router'
import { cx, imageFileToDataURL } from '../../lib/util'
import { Btn, Field, Input, Segmented, Select, Toggle, toast } from '../../ui/kit'

interface Variant {
  /** a design id, 'upload', or '' */
  source: string
  upload: string
  title: string
}

interface FeedItem {
  key: string
  title: string
  channel: string
  meta: string
  len: string
  hue: number
  src?: string
  mine?: 'A' | 'B'
}

// Invented placeholder videos, so your thumbnail is judged next to competition.
const FILLER: FeedItem[] = [
  { key: 'f1', title: 'Weekend desk reset: small changes, big difference', channel: 'Quiet Corner', meta: '48K views · 2 days ago', len: '9:41', hue: 205 },
  { key: 'f2', title: 'I tracked every hour of my week. Here is what changed', channel: 'Plain Method', meta: '120K views · 1 week ago', len: '14:02', hue: 28 },
  { key: 'f3', title: 'Five beginner mistakes I made so you do not have to', channel: 'Second Attempt', meta: '8.1K views · 5 hours ago', len: '11:17', hue: 150 },
  { key: 'f4', title: 'A calm morning routine that fits a normal workday', channel: 'Slow Start', meta: '310K views · 3 weeks ago', len: '7:55', hue: 330 },
  { key: 'f5', title: 'Budget setup tour: everything under one roof', channel: 'North Room', meta: '22K views · 4 days ago', len: '12:30', hue: 265 },
  { key: 'f6', title: 'What nobody tells you about starting from zero', channel: 'Ground Floor', meta: '67K views · 9 days ago', len: '16:48', hue: 95 },
]

function VariantPicker({ label, value, designs, placeholder, onChange }: { label: 'A' | 'B'; value: Variant; designs: Design[]; placeholder: string; onChange: (v: Variant) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    try {
      onChange({ ...value, source: 'upload', upload: await imageFileToDataURL(file, 1280) })
    } catch {
      toast('That image could not be read.')
    }
  }

  return (
    <div className="card stack">
      <h2 className="card-title">Version {label}</h2>
      <Field label="Thumbnail">
        <Select value={value.source} onValue={(source) => onChange({ ...value, source })}>
          <option value="">Choose a thumbnail</option>
          {designs.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
          {value.upload && <option value="upload">Uploaded image</option>}
        </Select>
      </Field>
      <Field label="Title shown with it">
        <Input placeholder={placeholder} value={value.title} onValue={(title) => onChange({ ...value, title })} />
      </Field>
      <div>
        <Btn size="sm" icon={<Upload size={15} />} onClick={() => fileRef.current?.click()}>
          Upload an image instead
        </Btn>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            void onFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}

function FeedCard({ item, labels }: { item: FeedItem; labels: boolean }) {
  return (
    <div className="feed-card">
      <div className="feed-thumb" style={item.src ? undefined : { background: `linear-gradient(135deg, hsl(${item.hue} 45% 46%), hsl(${item.hue + 35} 50% 26%))` }}>
        {item.src && <img src={item.src} alt="" />}
        {item.mine && !item.src && <span className="feed-missing">Choose version {item.mine} above</span>}
        {item.mine && labels && <span className="feed-tag">{item.mine}</span>}
        <span className="feed-len">{item.len}</span>
      </div>
      <div className="feed-info">
        <span className="feed-avatar" style={{ background: `hsl(${item.hue} 40% 52%)` }}>
          {item.channel.charAt(0).toUpperCase()}
        </span>
        <div className="feed-text">
          <p className="feed-title">{item.title}</p>
          <p className="feed-meta">{item.channel}</p>
          <p className="feed-meta">{item.meta}</p>
        </div>
      </div>
    </div>
  )
}

export default function ThumbnailPreview() {
  const { items: designs } = useCollection<Design>('thumbnails')
  const [brand] = useStored<Brand>('brand', DEFAULT_BRAND)
  const video = useActiveVideo()

  // Designs for the current video first, then the most recently edited.
  const ordered = [...designs].sort((x, y) => Number(y.videoId === video?.id) - Number(x.videoId === video?.id) || y.updatedAt - x.updatedAt)

  const [a, setA] = useState<Variant>(() => ({ source: ordered[0]?.id ?? '', upload: '', title: '' }))
  const [b, setB] = useState<Variant>(() => ({ source: ordered[1]?.id ?? '', upload: '', title: '' }))
  const [layout, setLayout] = useState<'grid' | 'list' | 'phone'>('grid')
  const [show, setShow] = useState<'both' | 'a' | 'b'>('both')
  const [dark, setDark] = useState(false)
  const [grey, setGrey] = useState(false)
  const [squint, setSquint] = useState(false)
  const [labels, setLabels] = useState(true)

  const channel = brand.channel?.trim() || 'Your channel'
  const fallbackTitle = video?.title ?? 'Your video title'
  const srcOf = (v: Variant) => (v.source === 'upload' ? v.upload : (designs.find((d) => d.id === v.source)?.preview ?? ''))
  const mine = (v: Variant, tag: 'A' | 'B'): FeedItem => ({
    key: tag,
    title: v.title.trim() || fallbackTitle,
    channel,
    meta: 'New',
    len: '10:24',
    hue: 15,
    src: srcOf(v) || undefined,
    mine: tag,
  })

  const items = [...FILLER]
  if (show === 'both') {
    items.splice(1, 0, mine(a, 'A'))
    items.splice(4, 0, mine(b, 'B'))
  } else {
    items.splice(1, 0, show === 'a' ? mine(a, 'A') : mine(b, 'B'))
  }
  const visible = items.slice(0, layout === 'phone' ? 5 : 6)

  return (
    <div className="stack">
      <div className="grid cols-2">
        <VariantPicker label="A" value={a} designs={ordered} placeholder={fallbackTitle} onChange={setA} />
        <VariantPicker label="B" value={b} designs={ordered} placeholder={fallbackTitle} onChange={setB} />
      </div>

      <div className="row spread">
        <div className="row">
          <Segmented
            label="Layout"
            value={layout}
            onChange={setLayout}
            options={[
              { value: 'grid', label: 'Home grid' },
              { value: 'list', label: 'Suggested list' },
              { value: 'phone', label: 'Phone' },
            ]}
          />
          <Segmented
            label="Versions shown"
            value={show}
            onChange={setShow}
            options={[
              { value: 'both', label: 'A and B' },
              { value: 'a', label: 'Only A' },
              { value: 'b', label: 'Only B' },
            ]}
          />
        </div>
        <div className="row">
          <Toggle checked={dark} onChange={setDark}>
            Dark feed
          </Toggle>
          <Toggle checked={grey} onChange={setGrey}>
            Greyscale
          </Toggle>
          <Toggle checked={squint} onChange={setSquint}>
            Squint test
          </Toggle>
          <Toggle checked={labels} onChange={setLabels}>
            Label mine
          </Toggle>
        </div>
      </div>

      <div className={cx('feed', `feed-${layout}`, dark && 'dark', grey && 'grey', squint && 'squint')}>
        <div className="feed-inner">
          {visible.map((item) => (
            <FeedCard key={item.key} item={item} labels={labels} />
          ))}
        </div>
      </div>

      <p className="small muted">
        The other videos are invented placeholders. Check which version you notice first, whether the text is readable at the smallest size, and whether it still stands out in greyscale.
        {designs.length === 0 && (
          <>
            {' '}
            No saved designs yet: <Link to="/thumbnail">make one in the thumbnail designer</Link> or upload an image.
          </>
        )}
      </p>
    </div>
  )
}
