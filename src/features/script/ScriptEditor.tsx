import { Download, ListTree, MonitorPlay } from 'lucide-react'
import { useDoc } from '../../lib/store'
import {
  EMPTY_OUTLINE,
  EMPTY_SCRIPT,
  outlineToScript,
  scriptSections,
  spokenText,
  useActiveVideo,
  useSettings,
  type OutlineSection,
  type ScriptDoc,
  type Video,
} from '../../lib/data'
import { navigate } from '../../lib/router'
import { countWords, download, fmtNum, fmtTime, slugify } from '../../lib/util'
import { Btn, CopyBtn, Field, NeedVideo, VideoBar } from '../../ui/kit'

const PLACEHOLDER = `# Hook
Open with the most interesting sentence you have.

# Intro
[B-roll: finished result]
Tell viewers what they will get and why it matters.

# Main point
Write the way you speak. Short sentences are easier to say on camera.`

function Editor({ video }: { video: Video }) {
  const [doc, setDoc] = useDoc<ScriptDoc>('scripts', video.id, EMPTY_SCRIPT)
  const [outline] = useDoc<OutlineSection[]>('outlines', video.id, EMPTY_OUTLINE)
  const [settings, patchSettings] = useSettings()

  const spoken = spokenText(doc.body)
  const wordCount = countWords(spoken)
  const seconds = (wordCount / settings.wpm) * 60
  const cueCount = (doc.body.match(/\[[^\]\n]*\]/g) ?? []).length
  const sections = scriptSections(doc.body).map((s) => ({ heading: s.heading, words: countWords(spokenText(s.text)) }))

  return (
    <div className="split">
      <div className="card flush">
        <p className="script-help small muted">
          Start a line with <b>#</b> for a section heading. Put notes for yourself in <b>[brackets]</b>: they are left out of the word count and the teleprompter.
        </p>
        <textarea className="script-area" aria-label="Script" placeholder={PLACEHOLDER} spellCheck value={doc.body} onChange={(e) => setDoc({ body: e.target.value })} />
        <p className="script-help small muted">Saved automatically in this browser.</p>
      </div>

      <aside className="stack sticky">
        <div className="card stack">
          <div className="grid cols-2">
            <div>
              <div className="stat-label">Spoken words</div>
              <div className="stat-value">{fmtNum(wordCount)}</div>
            </div>
            <div>
              <div className="stat-label">Estimated runtime</div>
              <div className="stat-value">{fmtTime(seconds)}</div>
            </div>
          </div>
          <Field label={`Speaking pace: ${settings.wpm} words a minute`} hint="Relaxed delivery is around 130, brisk is around 170.">
            <input type="range" min={100} max={200} step={5} value={settings.wpm} onChange={(e) => patchSettings({ wpm: Number(e.target.value) })} />
          </Field>
          <p className="small muted">
            {cueCount} {cueCount === 1 ? 'cue' : 'cues'} in brackets · {fmtNum(doc.body.length)} characters
          </p>
        </div>

        <div className="card stack">
          <h2 className="card-title">Sections</h2>
          {sections.length > 1 || (sections[0] && sections[0].heading !== 'Opening') ? (
            <ul className="section-list">
              {sections.map((s, i) => (
                <li key={i}>
                  <span className="truncate">{s.heading}</span>
                  <span className="small muted num">
                    {s.words} words · {fmtTime((s.words / settings.wpm) * 60)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="small muted">Add a line such as “# Intro” to see how long each part of the video runs.</p>
          )}
        </div>

        <div className="card stack">
          <Btn variant="primary" icon={<MonitorPlay size={16} />} disabled={!spoken} onClick={() => navigate('/teleprompter')}>
            Open in teleprompter
          </Btn>
          <div className="row">
            <CopyBtn text={doc.body} />
            <Btn icon={<Download size={16} />} disabled={!doc.body} onClick={() => download(`${slugify(video.title)}-script.txt`, doc.body)}>
              Download .txt
            </Btn>
          </div>
          {outline.length > 0 && !doc.body.trim() && (
            <Btn icon={<ListTree size={16} />} onClick={() => setDoc({ body: outlineToScript(outline) })}>
              Start from the outline
            </Btn>
          )}
        </div>
      </aside>
    </div>
  )
}

export default function ScriptEditor() {
  const video = useActiveVideo()
  return (
    <>
      <VideoBar />
      {video ? <Editor key={video.id} video={video} /> : <NeedVideo />}
    </>
  )
}
