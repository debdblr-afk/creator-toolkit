import { useEffect, useState } from 'react'
import { FolderOpen, Plus, Printer, Save, Trash2 } from 'lucide-react'
import { useCollection, useStored } from '../../lib/store'
import { DEFAULT_BRAND, useSettings, type Brand } from '../../lib/data'
import { blankInvoice, invoiceTotals, nextInvoiceNumber, type Invoice, type InvoiceItem } from '../../lib/invoice'
import { useRoute } from '../../lib/router'
import { CURRENCIES, fmtDateLong, fmtMoney, fmtNum, today, uid } from '../../lib/util'
import type { VideoStat } from './Analytics'
import { Btn, ConfirmBtn, CopyBtn, Empty, Field, Input, NumInput, Segmented, Select, Stat, Textarea, Toggle, toast } from '../../ui/kit'

// ---------- rate card ----------

interface RateRow {
  id: string
  name: string
  mult: number
}

interface RateDoc {
  views: number
  cpm: number
  pastFee: number
  pastViews: number
  rows: RateRow[]
}

const DEFAULT_RATES: RateDoc = {
  views: 0,
  cpm: 0,
  pastFee: 0,
  pastViews: 0,
  rows: [
    { id: 'r1', name: 'Integrated mention, 30 to 60 seconds', mult: 1 },
    { id: 'r2', name: 'Dedicated video', mult: 2.5 },
    { id: 'r3', name: 'Shorts video', mult: 0.4 },
    { id: 'r4', name: 'Community post', mult: 0.15 },
    { id: 'r5', name: 'Usage rights, 30 days', mult: 0.2 },
    { id: 'r6', name: 'Category exclusivity, 30 days', mult: 0.25 },
  ],
}

const roundNice = (n: number): number => (n >= 1000 ? Math.round(n / 50) * 50 : n >= 100 ? Math.round(n / 10) * 10 : Math.round(n))

function RateCard() {
  const [stored, setDoc] = useStored<RateDoc>('rateCard', DEFAULT_RATES)
  const doc = { ...DEFAULT_RATES, ...stored }
  const patch = (p: Partial<RateDoc>) => setDoc((prev) => ({ ...DEFAULT_RATES, ...prev, ...p }))
  const patchRow = (id: string, p: Partial<RateRow>) => patch({ rows: doc.rows.map((r) => (r.id === id ? { ...r, ...p } : r)) })
  const [settings, patchSettings] = useSettings()
  const [brand] = useStored<Brand>('brand', DEFAULT_BRAND)
  const { items: stats } = useCollection<VideoStat>('videoStats')

  const money = (n: number) => fmtMoney(n, settings.currency)
  const base = (doc.views / 1000) * doc.cpm
  const price = (row: RateRow) => roundNice(base * row.mult)
  const loggedAverage = stats.length ? Math.round(stats.reduce((sum, s) => sum + s.views, 0) / stats.length) : 0
  const derived = doc.pastViews > 0 ? Math.round((doc.pastFee / doc.pastViews) * 1000 * 100) / 100 : 0
  const channel = brand.channel?.trim() || 'Your channel'
  const asText = [`${channel}: sponsorship rates`, ...doc.rows.map((r) => `${r.name}: ${money(price(r))}`)].join('\n')

  return (
    <div className="split even">
      <div className="stack no-print">
        <section className="card stack">
          <h2 className="card-title">Your numbers</h2>
          <div className="grid cols-2">
            <Field label="Average views per video" hint="Views in the first 30 days are the usual basis.">
              <NumInput min={0} value={doc.views} onValue={(views) => patch({ views })} />
            </Field>
            <Field label={`Rate per 1,000 views (${settings.currency})`} hint="Your sponsorship CPM.">
              <NumInput min={0} step={0.5} value={doc.cpm} onValue={(cpm) => patch({ cpm })} />
            </Field>
          </div>
          <div className="row">
            {loggedAverage > 0 && (
              <Btn size="sm" onClick={() => patch({ views: loggedAverage })}>
                Use my logged average ({fmtNum(loggedAverage)})
              </Btn>
            )}
            <label className="row nowrap small">
              Currency
              <Select className="input-sm" style={{ width: 92 }} value={settings.currency} onValue={(currency) => patchSettings({ currency })}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </label>
          </div>
        </section>

        <section className="card stack">
          <div>
            <h2 className="card-title">Not sure what rate to use?</h2>
            <p className="small muted">Work it out from a deal you, or a creator you trust, has actually done. Rates differ a lot between niches and countries.</p>
          </div>
          <div className="grid cols-2">
            <Field label={`Fee paid (${settings.currency})`}>
              <NumInput min={0} value={doc.pastFee} onValue={(pastFee) => patch({ pastFee })} />
            </Field>
            <Field label="Views that video got">
              <NumInput min={0} value={doc.pastViews} onValue={(pastViews) => patch({ pastViews })} />
            </Field>
          </div>
          {derived > 0 && (
            <div className="row">
              <span className="small">
                That deal worked out at <b>{money(derived)}</b> per 1,000 views.
              </span>
              <Btn size="sm" onClick={() => patch({ cpm: derived })}>
                Use this rate
              </Btn>
            </div>
          )}
        </section>

        <section className="card stack">
          <div>
            <h2 className="card-title">Packages</h2>
            <p className="small muted">Each price is your base rate times a multiplier. The multipliers are starting points to adjust, not market data.</p>
          </div>
          {doc.rows.map((r) => (
            <div key={r.id} className="rate-row">
              <Input aria-label="Package name" value={r.name} onValue={(name) => patchRow(r.id, { name })} />
              <NumInput aria-label={`Multiplier for ${r.name}`} title="Multiplier" min={0} step={0.05} value={r.mult} onValue={(mult) => patchRow(r.id, { mult })} />
              <span className="num strong">{money(price(r))}</span>
              <Btn variant="ghost" size="sm" aria-label={`Remove ${r.name}`} icon={<Trash2 size={15} />} onClick={() => patch({ rows: doc.rows.filter((x) => x.id !== r.id) })} />
            </div>
          ))}
          <div>
            <Btn icon={<Plus size={16} />} onClick={() => patch({ rows: [...doc.rows, { id: uid(), name: 'New package', mult: 1 }] })}>
              Add package
            </Btn>
          </div>
        </section>
      </div>

      <aside className="stack sticky">
        <div className="paper print-area">
          <div className="paper-head">
            <div>
              <div className="paper-title">{channel}</div>
              <div className="paper-muted">Sponsorship rates · {fmtDateLong(today())}</div>
            </div>
          </div>
          <table className="paper-table">
            <thead>
              <tr>
                <th>Package</th>
                <th className="r">Rate</th>
              </tr>
            </thead>
            <tbody>
              {doc.rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td className="r">{base > 0 ? money(price(r)) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="paper-muted paper-notes">
            {doc.views > 0 ? `Based on an average of ${fmtNum(doc.views)} views per video. ` : ''}Rates are valid for 30 days and exclude taxes.
          </p>
        </div>
        {base <= 0 && <p className="small muted no-print">Enter your average views and a rate per 1,000 views to fill in the prices.</p>}
        <div className="row no-print">
          <Btn variant="primary" icon={<Printer size={16} />} onClick={() => window.print()}>
            Print or save as PDF
          </Btn>
          <CopyBtn text={asText} label="Copy as text" />
        </div>
      </aside>
    </div>
  )
}

// ---------- invoice ----------

function InvoicePaper({ inv }: { inv: Invoice }) {
  const { subtotal, tax, total } = invoiceTotals(inv)
  const money = (n: number) => fmtMoney(Math.round(n * 100) / 100, inv.currency)
  return (
    <div className="paper print-area">
      <div className="paper-head">
        <div>
          <div className="paper-title">Invoice</div>
          <div className="paper-muted">{inv.number}</div>
        </div>
        {inv.paid && <div className="paper-stamp">Paid</div>}
      </div>
      <div className="paper-cols">
        <div>
          <div className="paper-label">From</div>
          <div className="pre">{inv.from.trim() || 'Your name and address'}</div>
        </div>
        <div>
          <div className="paper-label">Bill to</div>
          <div className="strong">{inv.client.trim() || 'Client name'}</div>
          <div className="pre">{inv.clientDetails}</div>
        </div>
        <div>
          <div className="paper-label">Issued</div>
          <div>{fmtDateLong(inv.issued)}</div>
          <div className="paper-label" style={{ marginTop: 8 }}>
            Due
          </div>
          <div>{fmtDateLong(inv.due)}</div>
        </div>
      </div>
      <table className="paper-table">
        <thead>
          <tr>
            <th>Description</th>
            <th className="r">Qty</th>
            <th className="r">Rate</th>
            <th className="r">Amount</th>
          </tr>
        </thead>
        <tbody>
          {inv.items.map((item) => (
            <tr key={item.id}>
              <td className="pre">{item.desc || '–'}</td>
              <td className="r">{fmtNum(item.qty, 2)}</td>
              <td className="r">{money(item.rate)}</td>
              <td className="r">{money(item.qty * item.rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="paper-totals">
        <div>
          <span>Subtotal</span>
          <span>{money(subtotal)}</span>
        </div>
        {inv.taxRate > 0 && (
          <div>
            <span>
              {inv.taxLabel.trim() || 'Tax'} ({fmtNum(inv.taxRate, 2)}%)
            </span>
            <span>{money(tax)}</span>
          </div>
        )}
        <div className="paper-total">
          <span>{inv.paid ? 'Total' : 'Total due'}</span>
          <span>{money(total)}</span>
        </div>
      </div>
      {inv.notes.trim() && (
        <div className="paper-notes">
          <div className="paper-label">Notes and payment details</div>
          <div className="pre">{inv.notes}</div>
        </div>
      )}
    </div>
  )
}

function InvoiceEditor() {
  const [settings] = useSettings()
  const { items: saved, add, update } = useCollection<Invoice>('invoices')
  const [from, setFrom] = useStored<string>('invoiceFrom', '')
  const [draft, setDraft] = useStored<Invoice | null>('invoiceDraft', null)

  useEffect(() => {
    if (!draft) setDraft(blankInvoice(settings.currency, from, nextInvoiceNumber(saved)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])

  if (!draft) return null
  const inv = draft
  const patch = (p: Partial<Invoice>) => setDraft((prev) => (prev ? { ...prev, ...p } : prev))
  const patchItem = (id: string, p: Partial<InvoiceItem>) => patch({ items: inv.items.map((i) => (i.id === id ? { ...i, ...p } : i)) })
  const isSaved = saved.some((s) => s.id === inv.id)
  const money = (n: number) => fmtMoney(Math.round(n * 100) / 100, inv.currency)

  const save = () => {
    if (isSaved) update(inv.id, inv)
    else add(inv)
    toast(isSaved ? 'Saved invoice updated' : 'Invoice saved')
  }

  const startNew = () => setDraft(blankInvoice(settings.currency, from, nextInvoiceNumber(saved)))

  return (
    <div className="split even">
      <div className="stack no-print">
        <section className="card stack">
          <h2 className="card-title">Who it is from and to</h2>
          <Field label="Your details" hint="Name, address, tax number. Remembered for your next invoice.">
            <Textarea
              rows={4}
              placeholder={'Your name or business\nAddress\nTax number'}
              value={inv.from}
              onValue={(v) => {
                patch({ from: v })
                setFrom(v)
              }}
            />
          </Field>
          <div className="grid cols-2">
            <Field label="Client">
              <Input placeholder="Brand or agency name" value={inv.client} onValue={(client) => patch({ client })} />
            </Field>
            <Field label="Invoice number">
              <Input value={inv.number} onValue={(number) => patch({ number })} />
            </Field>
          </div>
          <Field label="Client details" hint="Contact, address, their tax number.">
            <Textarea rows={3} value={inv.clientDetails} onValue={(clientDetails) => patch({ clientDetails })} />
          </Field>
          <div className="grid cols-3">
            <Field label="Issued">
              <Input type="date" value={inv.issued} onValue={(v) => patch({ issued: v || today() })} />
            </Field>
            <Field label="Due">
              <Input type="date" value={inv.due} onValue={(v) => patch({ due: v || today() })} />
            </Field>
            <Field label="Currency">
              <Select value={inv.currency} onValue={(currency) => patch({ currency })}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
          </div>
        </section>

        <section className="card stack">
          <h2 className="card-title">Line items</h2>
          {inv.items.map((item, i) => (
            <div key={item.id} className="item-row">
              <Input aria-label={`Line ${i + 1} description`} placeholder="What you delivered" value={item.desc} onValue={(desc) => patchItem(item.id, { desc })} />
              <NumInput aria-label={`Line ${i + 1} quantity`} title="Quantity" min={0} step={0.5} value={item.qty} onValue={(qty) => patchItem(item.id, { qty })} />
              <NumInput aria-label={`Line ${i + 1} rate`} title="Rate" min={0} step={0.01} value={item.rate} onValue={(rate) => patchItem(item.id, { rate })} />
              <span className="num">{money(item.qty * item.rate)}</span>
              <Btn
                variant="ghost"
                size="sm"
                aria-label={`Remove line ${i + 1}`}
                disabled={inv.items.length === 1}
                icon={<Trash2 size={15} />}
                onClick={() => patch({ items: inv.items.filter((x) => x.id !== item.id) })}
              />
            </div>
          ))}
          <div>
            <Btn icon={<Plus size={16} />} onClick={() => patch({ items: [...inv.items, { id: uid(), desc: '', qty: 1, rate: 0 }] })}>
              Add line
            </Btn>
          </div>
          <div className="grid cols-2">
            <Field label="Tax name">
              <Input placeholder="GST, VAT, sales tax" value={inv.taxLabel} onValue={(taxLabel) => patch({ taxLabel })} />
            </Field>
            <Field label="Tax rate (%)">
              <NumInput min={0} max={100} step={0.5} value={inv.taxRate} onValue={(taxRate) => patch({ taxRate })} />
            </Field>
          </div>
          <Field label="Notes and payment details" hint="Bank or UPI details, payment terms, a thank-you.">
            <Textarea rows={3} value={inv.notes} onValue={(notes) => patch({ notes })} />
          </Field>
          <Toggle checked={inv.paid} onChange={(paid) => patch({ paid })}>
            Mark as paid
          </Toggle>
        </section>
      </div>

      <aside className="stack sticky">
        <InvoicePaper inv={inv} />
        <div className="row no-print">
          <Btn variant="primary" icon={<Printer size={16} />} onClick={() => window.print()}>
            Print or save as PDF
          </Btn>
          <Btn icon={<Save size={16} />} onClick={save}>
            {isSaved ? 'Update saved copy' : 'Save invoice'}
          </Btn>
          {isSaved ? (
            <Btn icon={<Plus size={16} />} onClick={startNew}>
              New invoice
            </Btn>
          ) : (
            <ConfirmBtn icon={<Plus size={16} />} confirmLabel="Discard this unsaved invoice?" onConfirm={startNew}>
              New invoice
            </ConfirmBtn>
          )}
        </div>
      </aside>
    </div>
  )
}

function SavedInvoices({ onOpen }: { onOpen: () => void }) {
  const { items, update, remove } = useCollection<Invoice>('invoices')
  const [, setDraft] = useStored<Invoice | null>('invoiceDraft', null)

  // Invoices can be in different currencies, so totals are kept per currency.
  const sumBy = (list: Invoice[]): string => {
    const byCurrency = new Map<string, number>()
    for (const inv of list) byCurrency.set(inv.currency, (byCurrency.get(inv.currency) ?? 0) + invoiceTotals(inv).total)
    return [...byCurrency].map(([currency, total]) => fmtMoney(Math.round(total * 100) / 100, currency)).join(' + ') || '–'
  }

  if (items.length === 0) {
    return (
      <Empty title="No saved invoices">
        Build an invoice on the Invoice tab and choose Save invoice. Saved invoices are listed here so you can reopen them and mark them paid.
      </Empty>
    )
  }

  const unpaid = items.filter((i) => !i.paid)
  const now = today()

  return (
    <div className="stack">
      <div className="grid cols-3">
        <Stat label="Outstanding" value={sumBy(unpaid)} hint={`${unpaid.length} unpaid`} />
        <Stat label="Paid" value={sumBy(items.filter((i) => i.paid))} hint={`${items.length - unpaid.length} paid`} />
        <Stat label="Overdue" value={unpaid.filter((i) => i.due < now).length} hint="Unpaid and past the due date" />
      </div>
      <div className="card flush">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Client</th>
                <th>Issued</th>
                <th>Due</th>
                <th className="r">Total</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {[...items].reverse().map((inv) => (
                <tr key={inv.id}>
                  <td className="strong">{inv.number}</td>
                  <td>{inv.client || '–'}</td>
                  <td>{fmtDateLong(inv.issued)}</td>
                  <td>{fmtDateLong(inv.due)}</td>
                  <td className="r">{fmtMoney(Math.round(invoiceTotals(inv).total * 100) / 100, inv.currency)}</td>
                  <td>
                    <span className="row nowrap">
                      <Toggle checked={inv.paid} onChange={(paid) => update(inv.id, { paid })}>
                        Paid
                      </Toggle>
                      {!inv.paid && inv.due < now && <span className="badge bad">Overdue</span>}
                    </span>
                  </td>
                  <td>
                    <span className="row nowrap" style={{ justifyContent: 'flex-end', gap: 2 }}>
                      <Btn
                        size="sm"
                        icon={<FolderOpen size={15} />}
                        onClick={() => {
                          setDraft(inv)
                          onOpen()
                        }}
                      >
                        Open
                      </Btn>
                      <ConfirmBtn size="sm" aria-label={`Delete invoice ${inv.number}`} confirmLabel="Delete?" icon={<Trash2 size={15} />} onConfirm={() => remove(inv.id)} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

type Tab = 'rates' | 'invoice' | 'saved'

export default function InvoiceTool() {
  const route = useRoute()
  const [tab, setTab] = useState<Tab>(() => (route.includes('tab=invoice') ? 'invoice' : route.includes('tab=saved') ? 'saved' : 'rates'))

  return (
    <div className="stack">
      <div className="no-print">
        <Segmented
          label="Section"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'rates', label: 'Rate card' },
            { value: 'invoice', label: 'Invoice' },
            { value: 'saved', label: 'Saved invoices' },
          ]}
        />
      </div>
      {tab === 'rates' && <RateCard />}
      {tab === 'invoice' && <InvoiceEditor />}
      {tab === 'saved' && <SavedInvoices onOpen={() => setTab('invoice')} />}
    </div>
  )
}
