import { flushDatabaseWrites } from '../lib/database'
import { Mail, Phone, Eye, Pencil, Trash2, X, Users, Plus, ImagePlus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CustomDatePicker, CustomSelect } from './CustomControls'
import { showWorkspaceToast } from '../lib/workspaceToast'
import { prepareProfilePhoto } from '../lib/profilePhoto'

export function DirectoryHeader({ section, title, description, action, onAction }: { section: string; title: string; description: string; action?: string; onAction?: () => void }) {
  return <div className="directory-heading"><div><span className="directory-eyebrow">{section}</span><h1>{title}</h1><p>{description}</p></div>{action && onAction && <button className="directory-add" onClick={onAction}><Plus size={17}/>{action}</button>}</div>
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

export function useDrawerExit(onClose: () => void) {
  const [closing, setClosing] = useState(false)
  const timer = useRef<number | null>(null)
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current) }, [])
  const close = (after?: () => void) => {
    if (closing) return
    setClosing(true)
    timer.current = window.setTimeout(() => { timer.current = null; onClose(); after?.() }, 220)
  }
  return { closing, close }
}

export function DirectoryTabs({ tabs, active, onChange }: { tabs: { label: string; value: string; count: number }[]; active: string; onChange: (value: string) => void }) {
  return <div className="directory-tabs" role="group" aria-label="Filter records">{tabs.map(tab => <button type="button" key={tab.value} className={active === tab.value ? 'selected' : ''} aria-pressed={active === tab.value} aria-label={`${tab.label}, ${tab.count}`} onClick={() => onChange(tab.value)}>{tab.label}<span aria-hidden="true">{tab.count}</span></button>)}</div>
}

export function ContactDetails({ email, phone }: { email: string; phone: string }) {
  return <div className="contact-details"><span><Mail size={13}/>{email}</span><span><Phone size={13}/>{phone}</span></div>
}

export type DirectoryAction = {
  mode: 'view' | 'edit' | 'delete'
  name: string
  fields: [string, string][]
  editTitle?: string
  editDescription?: string
  editNote?: string
  modalClassName?: string
  editSections?: { title: string; description?: string; fields: EditField[] }[]
  onSave: (values: Record<string, string>) => boolean | void
  onDelete: () => void
}

export type EditField = { key: string; label: string; value: string; type?: 'text' | 'email' | 'tel' | 'date' | 'number' | 'textarea' | 'select' | 'image'; placeholder?: string; options?: string[]; wide?: boolean }

export function RecordActionButtons({ name, onAction }: { name: string; onAction: (mode: DirectoryAction['mode']) => void }) {
  return <div className="record-actions">
    <button className="record-action-icon" aria-label={`View ${name}`} title="View" onClick={() => onAction('view')}><Eye size={15}/></button>
    <button className="record-action-icon" aria-label={`Edit ${name}`} title="Edit" onClick={() => onAction('edit')}><Pencil size={15}/></button>
    <button className="record-action-icon danger" aria-label={`Delete ${name}`} title="Delete" onClick={() => onAction('delete')}><Trash2 size={15}/></button>
  </div>
}

export function RecordActionDialog({ action, onClose }: { action: DirectoryAction; onClose: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries((action.editSections ?? []).flatMap(section => section.fields.map(field => [field.key, field.value]))))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [photoError, setPhotoError] = useState('')
  const [preparingPhoto, setPreparingPhoto] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (action.mode !== 'edit') return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [action.mode])
  const title = action.mode === 'view' ? `View ${action.name}` : action.mode === 'edit' ? action.editTitle ?? `Edit ${action.name}` : `Delete ${action.name}?`
  const recordLabel = (action.editTitle ?? 'Record').replace(/^Edit\s+/i, '')
  const preparePhoto = async (fieldKey: string, file: File | undefined) => {
    if (!file) return
    setPhotoError('')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setPhotoError('Choose a JPG, PNG, or WebP image.'); return }
    if (file.size < 1 || file.size > 5 * 1024 * 1024) { setPhotoError('Choose an image up to 5 MB.'); return }
    setPreparingPhoto(true)
    try { const avatarUrl = await prepareProfilePhoto(file); setValues(current => ({ ...current, [fieldKey]: avatarUrl })) }
    catch (error) { setPhotoError(error instanceof Error ? error.message : 'Could not prepare this photo.') }
    finally { setPreparingPhoto(false) }
  }
  return <div className={`modal-backdrop ${action.mode === 'edit' ? 'record-edit-backdrop' : ''}`} onClick={onClose}><form className={`modal record-action-modal ${action.mode === 'edit' ? 'is-edit' : ''} ${action.modalClassName ?? ''}`} onClick={event => event.stopPropagation()} onSubmit={async event => { event.preventDefault(); if (saving || preparingPhoto) return; setSaving(true); setSaveError(''); try { if (action.mode === 'edit' && action.onSave(values) === false) return; if (action.mode === 'delete') action.onDelete(); await flushDatabaseWrites(); showWorkspaceToast(`${recordLabel} ${action.mode === 'delete' ? 'deleted' : 'updated'}.`); onClose() } catch (error) { setSaveError(error instanceof Error ? error.message : 'Could not save. Please retry.') } finally { setSaving(false) } }}>
    <div className="modal-head"><div><span className="directory-eyebrow">{action.mode === 'delete' ? 'CONFIRM ACTION' : action.mode === 'edit' ? 'STRATAFORGE WORKSPACE' : 'DIRECTORY RECORD'}</span><h2>{title}</h2>{action.mode === 'edit' && action.editDescription && <p>{action.editDescription}</p>}</div><button className="icon-button" type="button" aria-label="Close" onClick={onClose}><X size={16}/></button></div>
    {action.mode === 'view' && <dl className="record-detail-list">{action.fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
    {action.mode === 'edit' && <div className="record-edit-body">{action.editSections?.map((section, sectionIndex) => <section className="record-edit-section" key={section.title}><div className="record-edit-section-heading"><b>{section.title}</b>{section.description && <p>{section.description}</p>}</div><div className="record-edit-fields">{section.fields.map((field, index) => field.type === 'image' ? <div className="record-edit-field record-edit-photo-field wide" key={field.key}><span>{field.label}</span><div className="record-edit-photo-preview">{values[field.key] ? <img src={values[field.key]} alt={`${field.label} preview`}/> : <Users size={22}/>}</div><div className="record-edit-photo-actions"><button type="button" className="record-dialog-cancel" onClick={() => photoInputRef.current?.click()} disabled={preparingPhoto}><ImagePlus size={14}/>{preparingPhoto ? 'Preparing photo…' : values[field.key] ? 'Change photo' : 'Choose photo'}</button>{values[field.key] && <button type="button" className="record-dialog-cancel" onClick={() => { setValues(current => ({ ...current, [field.key]: '' })); setPhotoError('') }}>Remove</button>}<input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden aria-label={`Choose ${field.label.toLowerCase()}`} onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void preparePhoto(field.key, file) }}/></div>{photoError && <small className="record-edit-photo-error" role="alert">{photoError}</small>}<small className="record-edit-photo-help">JPG, PNG, or WebP · up to 5 MB</small></div> : <label className={`record-edit-field ${field.type === 'textarea' || field.wide ? 'wide' : ''}`} key={field.key}>{field.label}{field.type === 'textarea' ? <textarea rows={4} autoFocus={sectionIndex === 0 && index === 0} value={values[field.key] ?? ''} placeholder={field.placeholder} onChange={event => setValues(current => ({ ...current, [field.key]: event.target.value }))}/> : field.type === 'select' ? <CustomSelect ariaLabel={field.label} value={values[field.key] ?? field.options?.[0] ?? ''} options={field.options ?? []} onChange={value => setValues(current => ({ ...current, [field.key]: value }))}/> : field.type === 'date' ? <CustomDatePicker ariaLabel={field.label} value={values[field.key] ?? ''} onChange={value => setValues(current => ({ ...current, [field.key]: value }))}/> : <input autoFocus={sectionIndex === 0 && index === 0} type={field.type === 'number' ? 'text' : field.type ?? 'text'} inputMode={field.type === 'number' ? 'decimal' : undefined} value={values[field.key] ?? ''} placeholder={field.placeholder} onChange={event => setValues(current => ({ ...current, [field.key]: event.target.value }))}/>}</label>)}</div></section>)}<p className="record-edit-note">{action.editNote ?? 'Changes are saved in this page session.'}</p></div>}
    {action.mode === 'delete' && <p>This will remove <b>{action.name}</b> from the current directory view.</p>}
    {saveError && <p role="alert" className="record-edit-photo-error">{saveError}</p>}
    <div className="record-dialog-footer"><button type="button" className="record-dialog-cancel" onClick={onClose}>Cancel</button>{action.mode !== 'view' && <button className={`record-dialog-submit ${action.mode === 'delete' ? 'delete' : ''}`} type="submit" disabled={preparingPhoto || saving}>{saving ? 'Saving…' : action.mode === 'delete' ? 'Delete' : preparingPhoto ? 'Preparing photo…' : 'Save changes'}</button>}</div>
  </form></div>
}


