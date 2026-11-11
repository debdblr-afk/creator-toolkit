import { useEffect, useRef, useState } from 'react'
import { Download, Mic, Square, Trash2 } from 'lucide-react'
import { deleteBlob, getBlob, putBlob, useCollection, useDoc } from '../../lib/store'
import { EMPTY_SCRIPT, spokenText, useActiveVideo, useVideos, type ScriptDoc } from '../../lib/data'
import { Link } from '../../lib/router'
import { cx, download, fmtBytes, fmtDate, fmtTime, slugify, toISO, uid } from '../../lib/util'
import { Btn, ConfirmBtn, Input, Status, VideoBar, toast } from '../../ui/kit'

export interface Take {
  id: string
  name: string
  videoId?: string
  seconds: number
  size: number
  mime: string
  createdAt: number
}

function TakePlayer({ id }: { id: string }) {
  const [url, setUrl] = useState('')
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let live = true
    let made = ''
    getBlob(id).then((blob) => {
      if (!live) return
      if (!blob) {
        setMissing(true)
        return
      }
      made = URL.createObjectURL(blob)
      setUrl(made)
    })
    return () => {
      live = false
      if (made) URL.revokeObjectURL(made)
    }
  }, [id])

  if (missing) return <p className="small muted">The audio for this take is no longer stored in this browser.</p>
  return url ? <audio className="take-audio" controls preload="metadata" src={url} /> : <p className="small muted">Loading audio…</p>
}

export default function Voiceover() {
  const { items: takes, add, update, remove } = useCollection<Take>('voTakes')
  const { items: videos } = useVideos()
  const video = useActiveVideo()
  const [script] = useDoc<ScriptDoc>('scripts', video?.id, EMPTY_SCRIPT)
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')

  const meterRef = useRef<HTMLElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const recRef = useRef<MediaRecorder | null>(null)
  const rafRef = useRef(0)
  const chunks = useRef<Blob[]>([])
  const elapsed = useRef(0)
  const countRef = useRef(0)
  countRef.current = takes.length
  const videoIdRef = useRef<string | undefined>(undefined)
  videoIdRef.current = video?.id

  const supported = typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
  const reading = spokenText(script.body)

  const release = () => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    ctxRef.current?.close().catch(() => {})
    ctxRef.current = null
    if (meterRef.current) meterRef.current.style.transform = 'scaleX(0)'
  }

  useEffect(() => {
    if (!recording) return
    const t = window.setInterval(() => {
      elapsed.current += 1
      setSeconds(elapsed.current)
    }, 1000)
    return () => window.clearInterval(t)
  }, [recording])

  useEffect(
    () => () => {
      const rec = recRef.current
      if (rec && rec.state !== 'inactive') {
        rec.onstop = null
        rec.stop()
      }
      release()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const start = async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      streamRef.current = stream

      // Live input level, drawn straight to the DOM so it never re-renders the page.
      const ctx = new AudioContext()
      ctxRef.current = ctx
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 1024
      ctx.createMediaStreamSource(stream).connect(analyser)
      const buf = new Uint8Array(analyser.fftSize)
      const loop = () => {
        analyser.getByteTimeDomainData(buf)
        let sum = 0
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128
          sum += v * v
        }
        const level = Math.min(1, Math.sqrt(sum / buf.length) * 3.2)
        if (meterRef.current) meterRef.current.style.transform = `scaleX(${level.toFixed(3)})`
        rafRef.current = requestAnimationFrame(loop)
      }
      loop()

      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported(m)) ?? ''
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunks.current = []
      elapsed.current = 0
      setSeconds(0)
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data)
      }
      rec.onstop = () => {
        const type = rec.mimeType || mime || 'audio/webm'
        const blob = new Blob(chunks.current, { type })
        chunks.current = []
        if (!blob.size) return
        const id = uid()
        putBlob(id, blob).then(() => {
          add({ id, name: `Take ${countRef.current + 1}`, videoId: videoIdRef.current, seconds: elapsed.current, size: blob.size, mime: type, createdAt: Date.now() })
        })
      }
      rec.start(500)
      recRef.current = rec
      setRecording(true)
    } catch (err) {
      release()
      const name = err instanceof DOMException ? err.name : ''
      setError(
        name === 'NotAllowedError'
          ? 'Microphone access was not granted. Allow it in the browser prompt and try again.'
          : name === 'NotFoundError'
            ? 'No microphone was found on this device.'
            : 'Recording could not start in this browser.',
      )
    }
  }

  const stop = () => {
    const rec = recRef.current
    if (rec && rec.state !== 'inactive') rec.stop()
    recRef.current = null
    release()
    setRecording(false)
  }

  const save = async (take: Take) => {
    const blob = await getBlob(take.id)
    if (!blob) {
      toast('The audio for this take is no longer stored.')
      return
    }
    download(`${slugify(take.name)}.${take.mime.includes('mp4') ? 'm4a' : 'webm'}`, blob)
  }

  const discard = (take: Take) => {
    void deleteBlob(take.id)
    remove(take.id)
  }

  const sorted = [...takes].sort((a, b) => b.createdAt - a.createdAt)

  return (
    <>
      {videos.length > 0 && <VideoBar />}
      <div className="split even">
        <div className="stack">
          <div className="card stack vo-recorder">
            <div className={cx('vo-time num', recording && 'live')}>{fmtTime(seconds)}</div>
            <div className="vo-meter" role="img" aria-label="Microphone level">
              <i ref={meterRef} />
            </div>
            <p className="small muted">{recording ? 'Aim for the bar to sit around the middle and never pin to the right.' : 'Use headphones and record somewhere soft and quiet.'}</p>
            <div className="row" style={{ justifyContent: 'center' }}>
              {recording ? (
                <Btn variant="primary" icon={<Square size={14} fill="currentColor" />} onClick={stop}>
                  Stop and keep take
                </Btn>
              ) : (
                <Btn variant="primary" disabled={!supported} icon={<Mic size={16} />} onClick={() => void start()}>
                  Record a take
                </Btn>
              )}
            </div>
            {!supported && <Status tone="bad">This browser does not support in-browser audio recording.</Status>}
            {error && <Status tone="bad">{error}</Status>}
          </div>

          <div className="card stack">
            <div className="row spread">
              <h2 className="card-title">Takes</h2>
              <span className="small muted">{takes.length} saved in this browser</span>
            </div>
            {sorted.length === 0 && <p className="small muted">Your takes are kept here between visits. Download the one you want to use in your editor.</p>}
            {sorted.map((t) => {
              const forVideo = videos.find((v) => v.id === t.videoId)
              return (
                <div key={t.id} className="take">
                  <div className="row nowrap">
                    <Input className="input-sm grow" aria-label="Take name" value={t.name} onValue={(name) => update(t.id, { name })} />
                    <Btn size="sm" aria-label={`Download ${t.name}`} icon={<Download size={15} />} onClick={() => void save(t)} />
                    <ConfirmBtn size="sm" aria-label={`Delete ${t.name}`} confirmLabel="Delete?" icon={<Trash2 size={15} />} onConfirm={() => discard(t)} />
                  </div>
                  <TakePlayer id={t.id} />
                  <p className="tiny muted">
                    {fmtTime(t.seconds)} · {fmtBytes(t.size)} · {fmtDate(toISO(new Date(t.createdAt)))}
                    {forVideo && ` · ${forVideo.title}`}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        <aside className="card stack sticky">
          <h2 className="card-title">Script to read{video ? `: ${video.title}` : ''}</h2>
          {reading ? (
            <div className="vo-script">
              {reading.split(/\n{2,}/).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          ) : (
            <p className="small muted">
              {video ? 'This video has no script yet.' : 'No video project yet.'} <Link to="/script">Write one in the script editor</Link> and it shows up here to read from. Notes in [brackets] and
              section headings are left out.
            </p>
          )}
        </aside>
      </div>
    </>
  )
}
