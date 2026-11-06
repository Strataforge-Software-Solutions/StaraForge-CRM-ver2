import { Mail, Phone, Eye, Pencil, Trash2, X, Users, Plus } from 'lucide-react'
import { useState } from 'react'

export function DirectoryHeader({ section, title, description, action, onAction }: { section: string; title: string; description: string; action: string; onAction: () => void }) {
  return <div className="directory-heading"><div><span className="directory-eyebrow">{section}</span><h1>{title}</h1><p>{description}</p></div><button className="directory-add" onClick={onAction}><Plus size={17}/>{action}</button></div>
}

export function DirectoryStat({ icon: Icon, label, value, detail, tone }: { icon: typeof Users; label: string; value: string; detail: string; tone: string }) {
  return <div className="directory-stat"><span className={`directory-stat-icon ${tone}`}><Icon size={20}/></span><div><span>{label}</span><b>{value}</b><small>{detail}</small></div></div>
}

export type MetricItem = { icon: typeof Users; label: string; value: string; detail: string; tone: string }

export function MetricsStrip({ metrics }: { metrics: MetricItem[] }) {
  return <section className="metrics-card directory-metrics-strip" aria-label="Page summary">
    {metrics.map(({ icon: Icon, label, value, detail, tone }) => <div className="metric" key={label}>
      <div className={`metric-icon ${tone}`}><Icon size={16}/></div>
      <div><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-detail">{detail}</div></div>
    </div>)}
  </section>
}

export function DirectoryTabs({ tabs, active, onChange }: { tabs: { label: string; value: string; count: number }[]; active: string; onChange: (value: string) => void }) {
  return <div className="directory-tabs">{tabs.map(tab => <button key={tab.value} className={active === tab.value ? 'selected' : ''} onClick={() => onChange(tab.value)}>{tab.label}<span>{tab.count}</span></button>)}</div>
}

export function ContactDetails({ email, phone }: { email: string; phone: string }) {
  return <div className="contact-details"><span><Mail size={13}/>{email}</span><span><Phone size={13}/>{phone}</span></div>
}

export type DirectoryAction = {
  mode: 'view' | 'edit' | 'delete'
  name: string
  fields: [string, string][]
  onSave: (name: string) => void
  onDelete: () => void
}

export function RecordActionButtons({ name, onAction }: { name: string; onAction: (mode: DirectoryAction['mode']) => void }) {
  return <div className="record-actions">
    <button className="record-action-icon" aria-label={`View ${name}`} title="View" onClick={() => onAction('view')}><Eye size={15}/></button>
    <button className="record-action-icon" aria-label={`Edit ${name}`} title="Edit" onClick={() => onAction('edit')}><Pencil size={15}/></button>
    <button className="record-action-icon danger" aria-label={`Delete ${name}`} title="Delete" onClick={() => onAction('delete')}><Trash2 size={15}/></button>
  </div>
}

export function RecordActionDialog({ action, onClose }: { action: DirectoryAction; onClose: () => void }) {
  const [name, setName] = useState(action.name)
  const title = action.mode === 'view' ? `View ${action.name}` : action.mode === 'edit' ? `Edit ${action.name}` : `Delete ${action.name}?`
  return <div className="modal-backdrop" onClick={onClose}><form className="modal record-action-modal" onClick={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); if (action.mode === 'edit') action.onSave(name.trim() || action.name); if (action.mode === 'delete') action.onDelete(); onClose() }}>
    <div className="modal-head"><div><span className="directory-eyebrow">{action.mode === 'delete' ? 'CONFIRM ACTION' : 'DIRECTORY RECORD'}</span><h2>{title}</h2></div><button className="icon-button" type="button" aria-label="Close" onClick={onClose}><X size={16}/></button></div>
    {action.mode === 'view' && <dl className="record-detail-list">{action.fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
    {action.mode === 'edit' && <><label className="field-label">Name<input autoFocus value={name} onChange={event => setName(event.target.value)}/></label><p>Changes are saved in this page session.</p></>}
    {action.mode === 'delete' && <p>This will remove <b>{action.name}</b> from the current directory view.</p>}
    <div className="record-dialog-footer"><button type="button" className="record-dialog-cancel" onClick={onClose}>Cancel</button>{action.mode !== 'view' && <button className={`record-dialog-submit ${action.mode === 'delete' ? 'delete' : ''}`} type="submit">{action.mode === 'delete' ? 'Delete' : 'Save changes'}</button>}</div>
  </form></div>
}


