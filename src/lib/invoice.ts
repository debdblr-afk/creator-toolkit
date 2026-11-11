// Invoice model, shared by the invoice tool and the sponsorship CRM.

import { addDays, today, uid } from './util'

export interface InvoiceItem {
  id: string
  desc: string
  qty: number
  rate: number
}

export interface Invoice {
  id: string
  number: string
  issued: string
  due: string
  /** your name, address and tax details, as free text */
  from: string
  client: string
  clientDetails: string
  items: InvoiceItem[]
  taxLabel: string
  taxRate: number
  notes: string
  currency: string
  paid: boolean
}

export const EMPTY_INVOICES: Invoice[] = []

export function nextInvoiceNumber(existing: Invoice[]): string {
  const year = new Date().getFullYear()
  const prefix = `INV-${year}-`
  const highest = existing.reduce((max, inv) => {
    const n = inv.number.startsWith(prefix) ? parseInt(inv.number.slice(prefix.length), 10) : NaN
    return Number.isFinite(n) && n > max ? n : max
  }, 0)
  return `${prefix}${String(highest + 1).padStart(3, '0')}`
}

export function blankInvoice(currency: string, from: string, number: string, seed: Partial<Invoice> = {}): Invoice {
  return {
    id: uid(),
    number,
    issued: today(),
    due: addDays(today(), 30),
    from,
    client: '',
    clientDetails: '',
    items: [{ id: uid(), desc: '', qty: 1, rate: 0 }],
    taxLabel: 'Tax',
    taxRate: 0,
    notes: '',
    currency,
    paid: false,
    ...seed,
  }
}

export function invoiceTotals(inv: Invoice): { subtotal: number; tax: number; total: number } {
  const subtotal = inv.items.reduce((sum, item) => sum + item.qty * item.rate, 0)
  const tax = (subtotal * inv.taxRate) / 100
  return { subtotal, tax, total: subtotal + tax }
}
