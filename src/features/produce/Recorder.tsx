import { useEffect, useRef, useState } from 'react'
import { Camera, Circle, Download, Monitor, Pause, Play, Square, Trash2 } from 'lucide-react'
import { cx, download, fmtBytes, fmtTime, slugify, uid } from '../../lib/util'
import { Btn, Input, Segmented, Status, Toggle } from '../../ui/kit'

interface Clip {
  id: string
  name: string
  url: string
  blob: Blob
  seconds: number
  ext: string
}

type Phase = 'idle' | 'ready' | 'recording' | 'paused'

function pickMime(): string {
  const options = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
  return options.find((m) => MediaRecorder.isTypeSupported(m)) ?? ''
}

export default function Recorder() {
  const [mode, setMode] = useState<'screen' | 'camera'>('screen')
  const [mic, setMic] = useState(true)
  const [phase, setPhase] = useState<Phase>('idle')
  const [seconds, setSeconds] = useState(0)
  const [clips, setClips] = useState<Clip[]>([])
  const [error, setError] = useState('')
  const [note, setNote] = useState('')

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const sources = useRef<MediaStream[]>([])
  const audioCtx = useRef<AudioContext | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const elapsed = useRef(0)
  const clipsRef = useRef<Clip[]>([])
  clipsRef.current = clips

  const supported = typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
  const canScreen = supported && typeof navigator.mediaDevices.getDisplayMedia === 'function'

  // Everything below touches refs only, so stale closures (the "ended" listener, unmount) stay correct.
  const release = () => {
    sources.current.forEach((s) => s.getTracks().forEach((t) => t.stop()))
    sources.current = []
    streamRef.current = null
    audioCtx.current?.close().catch(() => {})
    audioCtx.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }

  const stop = () => {
    const rec = recorder.current
    if (rec && rec.state !== 'inactive') rec.stop()
    recorder.current = null
    release()
    setPhase('idle')
  }

  useEffect(() => {
    if (phase !== 'recording') return
    const t = window.setInterval(() => {
      elapsed.current += 1
      setSeconds(elapsed.current)
    }, 1000)
    return () => window.clearInterval(t)
  }, [phase])

  useEffect(
    () => () => {
      const rec = recorder.current
      if (rec && rec.state !== 'inactive') {
        rec.onstop = null
        rec.stop()
      }
      release()
      clipsRef.current.forEach((c) => URL.revokeObjectURL(c.url))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const prepare = async () => {
    setError('')
    setNote('')
    try {
      let out: MediaStream
      if (mode === 'screen') {
        const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
        sources.current.push(display)
        const tracks: MediaStreamTrack[] = [...display.getVideoTracks()]
        const audio: MediaStream[] = display.getAudioTracks().length ? [display] : []
        if (mic) {
          try {
            const voice = await navigator.mediaDevices.getUserMedia({ audio: true })
            sources.current.push(voice)
            audio.push(voice)
          } catch {
            setNote('The microphone was not available, so this recording will have no narration.')
          }
        }
        if (audio.length === 1) {
          tracks.push(audio[0].getAudioTracks()[0])
        } else if (audio.length > 1) {
          // Screen audio and the microphone are mixed into one track; recorders keep only the first.
          const ctx = new AudioContext()
          audioCtx.current = ctx
          const mix = ctx.createMediaStreamDestination()
          audio.forEach((s) => ctx.createMediaStreamSource(s).connect(mix))
          tracks.push(mix.stream.getAudioTracks()[0])
        }
        display.getVideoTracks()[0]?.addEventListener('ended', stop)
        out = new MediaStream(tracks)
      } else {
        out = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: mic })
        sources.current.push(out)
      }
      streamRef.current = out
      if (videoRef.current) {
        videoRef.current.srcObject = out
        videoRef.current.play().catch(() => {})
      }
      setPhase('ready')
    } catch (err) {
      release()
      const name = err instanceof DOMException ? err.name : ''
      setError(
        name === 'NotAllowedError'
          ? 'Access was not granted. Allow it in the browser prompt and try again.'
          : name === 'NotFoundError'
            ? 'No camera or microphone was found on this device.'
            : 'Capture could not start in this browser.',
      )
    }
  }

  const start = () => {
    const stream = streamRef.current
    if (!stream) return
    const mime = pickMime()
    let rec: MediaRecorder
    try {
      rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    } catch {
      setError('This browser cannot record that source.')
      return
    }
    chunks.current = []
    elapsed.current = 0
    setSeconds(0)
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.current.push(e.data)
    }
    rec.onstop = () => {
      const type = rec.mimeType || mime || 'video/webm'
      const blob = new Blob(chunks.current, { type })
      chunks.current = []
      if (!blob.size) return
      const clip: Clip = {
        id: uid(),
        name: `Recording ${clipsRef.current.length + 1}`,
        url: URL.createObjectURL(blob),
        blob,
        seconds: elapsed.current,
        ext: type.includes('mp4') ? 'mp4' : 'webm',
      }
      setClips((prev) => [clip, ...prev])
    }
    rec.start(1000)
    recorder.current = rec
    setPhase('recording')
  }

  const removeClip = (clip: Clip) => {
    URL.revokeObjectURL(clip.url)
    setClips((prev) => prev.filter((c) => c.id !== clip.id))
  }

  const live = phase !== 'idle'

  return (
    <div className="split">
      <div className="stack">
        <div className="rec-stage">
          <video ref={videoRef} className={cx('rec-video', mode === 'camera' && 'mirror')} muted playsInline />
          {!live && (
            <div className="rec-idle">
              {mode === 'screen' ? <Monitor size={30} /> : <Camera size={30} />}
              <p>{mode === 'screen' ? 'Choose what to share, then start recording.' : 'Turn on the camera, then start recording.'}</p>
            </div>
          )}
          {(phase === 'recording' || phase === 'paused') && (
            <div className="rec-timer">
              <i className={cx('rec-dot', phase === 'paused' && 'paused')} />
              <span className="num">{fmtTime(seconds)}</span>
              {phase === 'paused' && <span>Paused</span>}
            </div>
          )}
        </div>

        <div className="row">
          {phase === 'idle' && (
            <Btn variant="primary" disabled={mode === 'screen' ? !canScreen : !supported} onClick={() => void prepare()}>
              {mode === 'screen' ? 'Choose screen or window' : 'Turn on camera'}
            </Btn>
          )}
          {phase === 'ready' && (
            <>
              <Btn variant="primary" icon={<Circle size={14} fill="currentColor" />} onClick={start}>
                Start recording
              </Btn>
              <Btn onClick={stop}>Cancel</Btn>
            </>
          )}
          {phase === 'recording' && (
            <Btn
              icon={<Pause size={16} />}
              onClick={() => {
                recorder.current?.pause()
                setPhase('paused')
              }}
            >
              Pause
            </Btn>
          )}
          {phase === 'paused' && (
            <Btn
              icon={<Play size={16} />}
              onClick={() => {
                recorder.current?.resume()
                setPhase('recording')
              }}
            >
              Resume
            </Btn>
          )}
          {(phase === 'recording' || phase === 'paused') && (
            <Btn variant="primary" icon={<Square size={14} fill="currentColor" />} onClick={stop}>
              Stop and save
            </Btn>
          )}
        </div>

        {!supported && <Status tone="bad">This browser does not support in-browser recording. Try a current desktop version of Chrome, Edge, Firefox or Safari.</Status>}
        {supported && !canScreen && mode === 'screen' && <Status tone="warn">Screen recording is not available on this device. Camera recording still works.</Status>}
        {error && <Status tone="bad">{error}</Status>}
        {note && <Status tone="warn">{note}</Status>}
      </div>

      <aside className="stack">
        <div className="card stack">
          <h2 className="card-title">Source</h2>
          <Segmented
            label="Source"
            value={mode}
            onChange={(m) => {
              if (!live) setMode(m)
            }}
            options={[
              { value: 'screen', label: 'Screen' },
              { value: 'camera', label: 'Camera' },
            ]}
          />
          <Toggle checked={mic} onChange={(v) => !live && setMic(v)}>
            Record the microphone
          </Toggle>
          <p className="small muted">
            {live
              ? 'Stop or cancel to change the source.'
              : 'Nothing is uploaded. The recording is made and kept on this device until you download it.'}
          </p>
        </div>

        <div className="card stack">
          <h2 className="card-title">Recordings</h2>
          {clips.length === 0 ? (
            <p className="small muted">Finished recordings appear here. They live in this tab only, so download the ones you want before closing it.</p>
          ) : (
            clips.map((c) => (
              <div key={c.id} className="clip">
                <video src={c.url} controls preload="metadata" />
                <Input className="input-sm" aria-label="Recording name" value={c.name} onValue={(name) => setClips((prev) => prev.map((x) => (x.id === c.id ? { ...x, name } : x)))} />
                <div className="row spread">
                  <span className="small muted num">
                    {fmtTime(c.seconds)} · {fmtBytes(c.blob.size)}
                  </span>
                  <span className="row nowrap">
                    <Btn size="sm" icon={<Download size={15} />} onClick={() => download(`${slugify(c.name)}.${c.ext}`, c.blob)}>
                      Download
                    </Btn>
                    <Btn variant="ghost" size="sm" aria-label={`Discard ${c.name}`} icon={<Trash2 size={15} />} onClick={() => removeClip(c)} />
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  )
}
