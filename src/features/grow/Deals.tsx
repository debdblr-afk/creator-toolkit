import { useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Handshake, Plus, ReceiptText } from 'lucide-react'
import { read, useCollection, write } from '../../lib/store'
import { useSettings, useVideos } from '../../lib/data'
import { EMPTY_INVOICES, blankInvoice, nextInvoiceNumber, type Invoice } from '../../lib/invoice'
import { navigate } from '../../lib/router'
import { CURRENCIES, cx, fmtDate, fmtMoney, today, uid } from '../../lib/util'
import { Btn, ConfirmBtn, Empty, Field, Input, Modal, NumInput, Select, Stat, Textarea, Toggle } from '../../ui/kit'

const STAGES = [
  { id: 'lead', name: 'Lead' },
  { id: 'pitched', name: 'Pitched' },
  { id: 'negotiating', name: 'Negotiating' },
  { id: 'signed', name: 'Signed' },
  { id: 'delivered', name: 'Delivered' },
  { id: 'paid', name: 'Paid' },
  { id: 'lost', name: 'Lost' },
] as const

type DealStage = (typeof STAGES)[number]['id']

export interface Deal {
  id: string
  brand: string
  contact: string
  email: string
  value: number
  stage: DealStage
  deliverable: string
  due?: string
  videoId?: string
  notes: string
  createdAt: number
}

const OPEN: DealStage[] = ['lead', 'pitched', 'negotiating', 'signed', 'delivered']

export default function Deals() {
  const { items: deals, add, update, remove } = useCollection<Deal>('deals')
  const { items: videos } = useVideos()
  const [settings, patchSettings] = useSettings()
  const [showLost, setShowLost] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<DealStage | null>(null)
  const editing = deals.find((d) => d.id === editingId)
  const money = (n: number) => fmtMoney(n, settings.currency)
  const now = today()

  const total = (stages: DealStage[]) => deals.filter((d) => stages.includes(d.stage)).reduce((sum, d) => sum + d.value, 0)
  const won = deals.filter((d) => ['signed', 'delivered', 'paid'].includes(d.stage)).length
  const lost = deals.filter((d) => d.stage === 'lost').length
  const columns = STAGES.filter((s) => s.id !== 'lost' || showLost)

  const create = () => {
    const deal = add({ brand: '', contact: '', email: '', value: 0, stage: 'lead', deliverable: '', notes: '', createdAt: Date.now() })
    setEditingId(deal.id)
  }

  const step = (deal: Deal, dir: -1 | 1) => {
    const next = STAGES[STAGES.findIndex((s) => s.id === deal.stage) + dir]
    if (next && (next.id !== 'lost' || showLost)) update(deal.id, { stage: next.id })
  }

  const close = () => {
    if (editing && !editing.brand.trim() && !editing.value && !editing.notes.trim() && !editing.deliverable.trim()) remove(editing.id)
    setEditingId(null)
  }

  const toInvoice = (deal: Deal) => {
    const saved = read<Invoice[]>('invoices', EMPTY_INVOICES)
    const invoice = blankInvoice(settings.currency, read<string>('invoiceFrom', ''), nextInvoiceNumber(saved), {
      client: deal.brand,
      clientDetails: [deal.contact, deal.email].filter(Boolean).join('\n'),
      items: [{ id: uid(), desc: deal.deliverable.trim() || 'Sponsored integration', qty: 1, rate: deal.value }],
    })
    write<Invoice | null>('invoiceDraft', invoice, null)
    navigate('/invoice?tab=invoice')
  }

  return (
    <div className="stack">
      <div className="row spread">
        <div className="row">
          <Btn variant="primary" icon={<Plus size={16} />} onClick={create}>
            Add deal
          </Btn>
          <Toggle checked={showLost} onChange={setShowLost}>
            Show lost deals
          </Toggle>
        </div>
        <label className="row nowrap small">
          Currency
          <Select className="input-sm" style={{ width: 92 }} value={settings.currency} onValue={(currency) => patchSettings({ currency })}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </label>
      </div>

      {deals.length === 0 ? (
        <Empty icon={<Handshake size={22} />} title="No brand deals yet">
          Track every conversation with a brand here, from the first email to the payment landing. When a deal is signed, turn it into an invoice in one click.
        </Empty>
      ) : (
        <>
          <div className="grid cols-4">
            <Stat label="Open pipeline" value={money(total(OPEN))} hint={`${deals.filter((d) => OPEN.includes(d.stage)).length} deals in progress`} />
            <Stat label="Awaiting payment" value={money(total(['signed', 'delivered']))} hint="Signed or delivered" />
            <Stat label="Paid" value={money(total(['paid']))} hint={`${deals.filter((d) => d.stage === 'paid').length} deals`} />
            <Stat label="Win rate" value={won + lost > 0 ? `${Math.round((won / (won + lost)) * 100)}%` : '–'} hint={`${won} won, ${lost} lost`} />
          </div>

          <div className="board">
            {columns.map((stage, index) => {
              const list = deals.filter((d) => d.stage === stage.id)
              return (
                <section
                  key={stage.id}
                  className={cx('board-col', over === stage.id && 'over')}
                  aria-label={`${stage.name}, ${list.length} deals`}
                  onDragOver={(e) => {
                    e.preventDefault()
                    if (over !== stage.id) setOver(stage.id)
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    const id = e.dataTransfer.getData('text/plain')
                    if (deals.some((d) => d.id === id)) update(id, { stage: stage.id })
                    setOver(null)
                    setDragId(null)
                  }}
                >
                  <div className="board-col-head">
                    <span>{stage.name}</span>
                    <span className="count num">{money(list.reduce((sum, d) => sum + d.value, 0))}</span>
                  </div>
                  {list.map((d) => (
                    <article
                      key={d.id}
                      className={cx('kcard', dragId === d.id && 'dragging')}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', d.id)
                        e.dataTransfer.effectAllowed = 'move'
                        setDragId(d.id)
                      }}
                      onDragEnd={() => {
                        setDragId(null)
                        setOver(null)
                      }}
                    >
                      <button type="button" className="kcard-title" onClick={() => setEditingId(d.id)}>
                        {d.brand || 'Unnamed brand'}
                      </button>
                      <div className="kcard-meta">
                        <span className="strong num">{money(d.value)}</span>
                        {d.deliverable && <span className="truncate">{d.deliverable}</span>}
                      </div>
                      {d.due && (
                        <div className="kcard-meta">
                          <span>
                            <CalendarDays size={12} /> Due {fmtDate(d.due)}
                          </span>
                          {d.due < now && !['paid', 'lost', 'delivered'].includes(d.stage) && <span className="badge bad">Overdue</span>}
                        </div>
                      )}
                      <div className="kcard-actions">
                        <Btn variant="ghost" size="sm" aria-label={`Move ${d.brand || 'deal'} back a stage`} disabled={index === 0} icon={<ChevronLeft size={15} />} onClick={() => step(d, -1)} />
                        <Btn
                          variant="ghost"
                          size="sm"
                          aria-label={`Move ${d.brand || 'deal'} on a stage`}
                          disabled={index === columns.length - 1}
                          icon={<ChevronRight size={15} />}
                          onClick={() => step(d, 1)}
                        />
                      </div>
                    </article>
                  ))}
                  {list.length === 0 && <p className="tiny muted">Nothing here</p>}
                </section>
              )
            })}
          </div>
        </>
      )}

      {editing && (
        <Modal
          title="Deal details"
          wide
          onClose={close}
          footer={
            <>
              <ConfirmBtn
                onConfirm={() => {
                  remove(editing.id)
                  setEditingId(null)
                }}
              >
                Delete deal
              </ConfirmBtn>
              <div className="row">
                <Btn icon={<ReceiptText size={16} />} disabled={!editing.brand.trim()} onClick={() => toInvoice(editing)}>
                  Create invoice
                </Btn>
                <Btn variant="primary" onClick={close}>
                  Done
                </Btn>
              </div>
            </>
          }
        >
          <div className="stack">
            <div className="grid cols-2">
              <Field label="Brand">
                <Input autoFocus value={editing.brand} onValue={(brand) => update(editing.id, { brand })} />
              </Field>
              <Field label="Stage">
                <Select value={editing.stage} onValue={(v) => update(editing.id, { stage: v as DealStage })}>
                  {STAGES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Contact name">
                <Input value={editing.contact} onValue={(contact) => update(editing.id, { contact })} />
              </Field>
              <Field label="Contact email">
                <Input type="email" value={editing.email} onValue={(email) => update(editing.id, { email })} />
              </Field>
              <Field label={`Fee (${settings.currency})`}>
                <NumInput min={0} value={editing.value} onValue={(value) => update(editing.id, { value })} />
              </Field>
              <Field label="Due date">
                <Input type="date" value={editing.due ?? ''} onValue={(v) => update(editing.id, { due: v || undefined })} />
              </Field>
            </div>
            <Field label="What you are delivering">
              <Input placeholder="60-second integration in one video" value={editing.deliverable} onValue={(deliverable) => update(editing.id, { deliverable })} />
            </Field>
            <Field label="Video">
              <Select value={editing.videoId ?? ''} onValue={(v) => update(editing.id, { videoId: v || undefined })}>
                <option value="">Not linked to a video</option>
                {videos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Notes" hint="Talking points, usage rights, exclusivity, payment terms.">
              <Textarea rows={4} value={editing.notes} onValue={(notes) => update(editing.id, { notes })} />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  )
}
