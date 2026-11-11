import { useEffect, useRef, useState } from 'react'
import { Download, ShieldCheck, Sparkles, Upload } from 'lucide-react'
import { exportData, importData, storageKind, useStored, wipe } from '../../lib/store'
import { loadSample } from '../../lib/sample'
import { download, fmtBytes, fmtDateLong, toISO, today } from '../../lib/util'
import { Btn, ConfirmBtn, Status, toast } from '../../ui/kit'

const COUNTS: { key: string; label: string }[] = [
  { key: 'videos', label: 'Video projects' },
  { key: 'ideas', label: 'Ideas' },
  { key: 'scripts', label: 'Scripts' },
  { key: 'series', label: 'Series' },
  { key: 'competitors', label: 'Competitor channels' },
  { key: 'thumbnails', label: 'Thumbnail designs' },
  { key: 'subs', label: 'Caption files' },
  { key: 'voTakes', label: 'Voiceover takes' },
  { key: 'promos', label: 'Promo posts' },
  { key: 'videoStats', label: 'Video results' },
  { key: 'deals', label: 'Brand deals' },
  { key: 'invoices', label: 'Saved invoices' },
  { key: 'goals', label: 'Goals' },
]

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const sizeOf = (x: unknown): number => (Array.isArray(x) ? x.length : isObject(x) ? Object.keys(x).length : 0)

interface Pending {
  name: string
  exportedAt: string
  data: Record<string, unknown>
}

export default function Backup() {
  const [backupAt, setBackupAt] = useStored<number>('lastBackupAt', 0)
  const [pending, setPending] = useState<Pending | null>(null)
  const [error, setError] = useState('')
  const [usage, setUsage] = useState<number | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [, setVersion] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const refresh = () => setVersion((n) => n + 1)

  useEffect(() => {
    navigator.storage
      ?.estimate?.()
      .then((e) => setUsage(e.usage ?? null))
      .catch(() => {})
    navigator.storage
      ?.persisted?.()
      .then(setPersisted)
      .catch(() => {})
  }, [])

  const data = exportData()
  const json = JSON.stringify({ app: 'creator-toolkit', version: 1, exportedAt: new Date().toISOString(), data }, null, 2)
  const hasData = Object.keys(data).length > 0

  const doExport = () => {
    download(`creator-toolkit-backup-${today()}.json`, json, 'application/json')
    setBackupAt(Date.now())
  }

  const onFile = async (file: File | undefined) => {
    setError('')
    setPending(null)
    if (!file) return
    try {
      const parsed: unknown = JSON.parse(await file.text())
      if (!isObject(parsed) || parsed.app !== 'creator-toolkit' || !isObject(parsed.data)) {
        setError('That file is not a Creator Toolkit backup.')
        return
      }
      setPending({ name: file.name, exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : '', data: parsed.data })
    } catch {
      setError('That file could not be read. Choose a .json file exported from this page.')
    }
  }

  const restore = async (mode: 'merge' | 'replace') => {
    if (!pending) return
    await importData(pending.data, mode)
    setPending(null)
    refresh()
    toast(mode === 'merge' ? 'Backup merged into your data' : 'Your data was replaced with the backup')
  }

  const keepData = async () => {
    const ok = await navigator.storage?.persist?.()
    setPersisted(!!ok)
    toast(ok ? 'The browser will keep this data unless you clear it yourself' : 'The browser declined for now. Regular backups are the safe option.')
  }

  return (
    <div className="split even">
      <div className="stack">
        <section className="card stack">
          <div>
            <h2 className="card-title">Export a backup</h2>
            <p className="small muted">
              One file with everything: videos, scripts, designs, deals and settings. Keep it somewhere safe, or use it to move to another browser or computer.
            </p>
          </div>
          <div className="row">
            <Btn variant="primary" icon={<Download size={16} />} disabled={!hasData} onClick={doExport}>
              Download backup
            </Btn>
            <span className="small muted">{hasData ? `About ${fmtBytes(json.length)}` : 'Nothing to back up yet'}</span>
          </div>
          {backupAt > 0 ? (
            <Status tone="good">Last backup: {fmtDateLong(toISO(new Date(backupAt)))}.</Status>
          ) : (
            hasData && <Status tone="warn">No backup made yet. Your work exists only in this browser.</Status>
          )}
          <p className="small muted">Voiceover recordings are audio files and are not included. Download the takes you want to keep from the voiceover recorder.</p>
        </section>

        <section className="card stack">
          <div>
            <h2 className="card-title">Restore from a backup</h2>
            <p className="small muted">Choose a backup file. You decide whether to merge it with what is here or replace everything.</p>
          </div>
          <div>
            <Btn icon={<Upload size={16} />} onClick={() => fileRef.current?.click()}>
              Choose backup file
            </Btn>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                void onFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </div>
          {error && <Status tone="bad">{error}</Status>}
          {pending && (
            <div className="note stack">
              <div>
                <b>{pending.name}</b>
                <div className="small">
                  {pending.exportedAt ? `Exported ${fmtDateLong(pending.exportedAt.slice(0, 10))}. ` : ''}
                  {sizeOf(pending.data.videos)} video projects, {sizeOf(pending.data.ideas)} ideas, {Object.keys(pending.data).length} data sets in total.
                </div>
              </div>
              <div className="row">
                <Btn variant="primary" onClick={() => void restore('merge')}>
                  Merge with my data
                </Btn>
                <ConfirmBtn confirmLabel="Replace everything here?" onConfirm={() => void restore('replace')}>
                  Replace my data
                </ConfirmBtn>
                <Btn variant="ghost" onClick={() => setPending(null)}>
                  Cancel
                </Btn>
              </div>
              <p className="small">Merging keeps what you have and adds the backup; where both have the same item, the backup wins.</p>
            </div>
          )}
        </section>

        <section className="card stack">
          <div>
            <h2 className="card-title">Sample channel</h2>
            <p className="small muted">Adds a small fictional cooking channel so you can see every tool with data in it. It is added alongside your own work.</p>
          </div>
          <div>
            <Btn
              icon={<Sparkles size={16} />}
              onClick={() => {
                loadSample()
                refresh()
                toast('Sample channel loaded')
              }}
            >
              Load sample channel
            </Btn>
          </div>
        </section>

        <section className="card stack">
          <div>
            <h2 className="card-title">Erase everything</h2>
            <p className="small muted">Deletes all data this app has stored in this browser, including voiceover takes. This cannot be undone, so export a backup first.</p>
          </div>
          <div>
            <ConfirmBtn
              confirmLabel="Yes, erase all my data"
              onConfirm={() => {
                void wipe().then(() => {
                  refresh()
                  toast('All data erased')
                })
              }}
            >
              Erase all data
            </ConfirmBtn>
          </div>
        </section>
      </div>

      <aside className="stack sticky">
        <div className="card stack">
          <h2 className="card-title">What is stored</h2>
          <table className="table">
            <tbody>
              {COUNTS.map((c) => (
                <tr key={c.key}>
                  <td>{c.label}</td>
                  <td className="r">{sizeOf(data[c.key])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card stack">
          <h2 className="card-title">Where it lives</h2>
          <p className="small">
            In this browser on this device, using {storageKind() === 'indexeddb' ? 'IndexedDB' : 'local storage'}. Nothing is sent to a server, and there is no account.
            {usage !== null && ` This site is using about ${fmtBytes(usage)}.`}
          </p>
          {persisted ? (
            <Status tone="good">The browser has agreed to keep this data until you clear it yourself.</Status>
          ) : (
            <>
              <Status tone="info">Browsers can clear a site&rsquo;s data when the device runs low on space, and clearing your browsing data removes it too.</Status>
              {typeof navigator.storage?.persist === 'function' && (
                <div>
                  <Btn size="sm" icon={<ShieldCheck size={15} />} onClick={() => void keepData()}>
                    Ask the browser to keep it
                  </Btn>
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
