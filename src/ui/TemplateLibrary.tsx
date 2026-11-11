// A fill-in-the-blank template library. Used by the hook library and the
// end screen / pinned comment templates.

import { useState, type ReactNode } from 'react'
import { Plus, Search, Star, Trash2 } from 'lucide-react'
import { useCollection, useStored } from '../lib/store'
import { EMPTY_STRINGS } from '../lib/data'
import { cx, fill } from '../lib/util'
import { Btn, CopyBtn, Field, Input, Select, Textarea } from './kit'

export interface Template {
  id: string
  category: string
  text: string
}

export interface TemplateVar {
  key: string
  label: string
  placeholder: string
}

interface Props {
  storageKey: string
  categories: string[]
  builtin: Template[]
  variables: TemplateVar[]
  action?: { label: string; icon?: ReactNode; run: (text: string) => void }
}

const NO_VARS: Record<string, string> = {}

/** Render a template with filled-in values highlighted and empty {tokens} marked. */
function Preview({ text, vars }: { text: string; vars: Record<string, string> }) {
  return (
    <p className="tpl-text">
      {text.split(/(\{[^{}]+\})/).map((part, i) => {
        const key = part.startsWith('{') && part.endsWith('}') ? part.slice(1, -1) : null
        if (key === null) return part
        const value = vars[key]?.trim()
        return value ? (
          <mark key={i} className="tpl-filled">
            {value}
          </mark>
        ) : (
          <span key={i} className="tpl-token">
            {key}
          </span>
        )
      })}
    </p>
  )
}

export function TemplateLibrary({ storageKey, categories, builtin, variables, action }: Props) {
  const [vars, setVars] = useStored<Record<string, string>>(`${storageKey}:vars`, NO_VARS)
  const [favs, setFavs] = useStored<string[]>(`${storageKey}:favs`, EMPTY_STRINGS)
  const { items: custom, add, remove } = useCollection<Template>(`${storageKey}:custom`)
  const [category, setCategory] = useState('All')
  const [query, setQuery] = useState('')
  const [newText, setNewText] = useState('')
  const [newCategory, setNewCategory] = useState(categories[0])

  const customIds = new Set(custom.map((t) => t.id))
  const q = query.trim().toLowerCase()
  const visible = [...custom, ...builtin].filter((t) => {
    if (category === 'Saved' ? !favs.includes(t.id) : category !== 'All' && t.category !== category) return false
    return !q || t.text.toLowerCase().includes(q)
  })

  const toggleFav = (id: string) => setFavs((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const addCustom = () => {
    const text = newText.trim()
    if (!text) return
    add({ category: newCategory, text })
    setNewText('')
    setCategory(newCategory)
  }

  return (
    <div className="split narrow-first">
      <aside className="stack sticky">
        <div className="card stack">
          <div>
            <h2 className="card-title">Your details</h2>
            <p className="small muted">Fill these in once and every template updates.</p>
          </div>
          {variables.map((v) => (
            <Field key={v.key} label={v.label}>
              <Input placeholder={v.placeholder} value={vars[v.key] ?? ''} onValue={(value) => setVars((prev) => ({ ...prev, [v.key]: value }))} />
            </Field>
          ))}
        </div>
        <div className="card stack">
          <h2 className="card-title">Add your own</h2>
          <Field label="Category">
            <Select value={newCategory} onValue={setNewCategory}>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Template" hint={`Use ${variables.slice(0, 2).map((v) => `{${v.key}}`).join(' or ')} as blanks.`}>
            <Textarea rows={3} value={newText} onValue={setNewText} />
          </Field>
          <Btn icon={<Plus size={16} />} disabled={!newText.trim()} onClick={addCustom}>
            Save template
          </Btn>
        </div>
      </aside>

      <div className="stack">
        <div className="row spread">
          <div className="row" role="group" aria-label="Category">
            {['All', 'Saved', ...categories].map((c) => (
              <button key={c} type="button" className={cx('chip', category === c && 'on')} aria-pressed={category === c} onClick={() => setCategory(c)}>
                {c}
              </button>
            ))}
          </div>
          <div className="search">
            <Search size={15} />
            <Input type="search" aria-label="Search templates" placeholder="Search" value={query} onValue={setQuery} />
          </div>
        </div>

        {visible.length === 0 && (
          <p className="muted">{category === 'Saved' ? 'Nothing saved yet. Use the star on a template to keep it here.' : 'No templates match.'}</p>
        )}

        {visible.map((t) => {
          const filled = fill(t.text, vars)
          const fav = favs.includes(t.id)
          return (
            <article key={t.id} className="card tpl">
              <div className="row spread nowrap top">
                <span className="mini-label">{t.category}</span>
                <span className="row nowrap" style={{ gap: 2 }}>
                  <Btn
                    variant="ghost"
                    size="sm"
                    aria-label={fav ? 'Remove from saved' : 'Save template'}
                    aria-pressed={fav}
                    className={cx(fav && 'tpl-fav')}
                    icon={<Star size={15} fill={fav ? 'currentColor' : 'none'} />}
                    onClick={() => toggleFav(t.id)}
                  />
                  {customIds.has(t.id) && <Btn variant="ghost" size="sm" aria-label="Delete template" icon={<Trash2 size={15} />} onClick={() => remove(t.id)} />}
                </span>
              </div>
              <Preview text={t.text} vars={vars} />
              <div className="row">
                <CopyBtn size="sm" text={filled} />
                {action && (
                  <Btn size="sm" icon={action.icon} onClick={() => action.run(filled)}>
                    {action.label}
                  </Btn>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
