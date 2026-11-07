import { useEffect, useRef, useState } from 'react'
import { Activity, ArrowLeft, ArrowRight, Camera, Check, CircleDollarSign, Eye, ImagePlus, Pencil, TrendingUp, X } from 'lucide-react'
import type { LeadDirectoryRow } from './LeadsPage'
import type { ProjectDirectoryRow } from './ProjectsPage'
import { projectTaskRows, type ProjectTaskRecord } from './ProjectTasksPage'
import { CustomSelect } from '../components/CustomControls'

export default function LeadLinkedProjectOverview({ lead, project, statusOverride, onStatusChange, onViewTasks, onOpenProject, onOpenTask }: {
  lead: LeadDirectoryRow
  project: ProjectDirectoryRow
  statusOverride?: string
  onStatusChange: (projectName: string, status: string) => void
  onViewTasks: (projectName: string) => void
  onOpenProject: (projectName: string) => void
  onOpenTask: (task: ProjectTaskRecord) => void
}) {
  const tasks = projectTaskRows.filter(task => task.project === project.name)
  const status = statusOverride ?? project.status
  const match = project.value.match(/^(PHP|USD)\s*([\d,.]+)/)
  const currency = match?.[1] ?? 'PHP'
  const [agreed, setAgreed] = useState(Number(match?.[2]?.replace(/,/g, '') ?? 0))
  const [paid, setPaid] = useState(0)
  const [remaining, setRemaining] = useState(Number(match?.[2]?.replace(/,/g, '') ?? 0))
  const money = (amount: number) => `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return <section className="lead-linked-project">
    <header className="lead-project-heading">
      <div><span className="directory-eyebrow">DELIVERY WORKSPACE / LEADS</span><div className="lead-project-title"><span className="directory-avatar orange">{project.initials}</span><div><h2>{project.name}</h2><p>{project.client} · {lead.name}</p></div></div></div>
      <div className="lead-project-actions"><button className="lead-project-primary" onClick={() => onViewTasks(project.name)}><Activity size={14}/>View tasks</button><button className="lead-project-secondary" onClick={() => onOpenProject(project.name)}><ArrowLeft size={14}/>Projects</button></div>
    </header>
    <section className="lead-project-metrics" aria-label="Project summary">
      <EditableProjectMetric icon={TrendingUp} label="Project status" value={status} detail="Delivery progress" tone="orange" editor="status" rawValue={status} onSave={value => onStatusChange(project.name, value)}/>
      <EditableProjectMetric icon={CircleDollarSign} label="Agreed value" value={money(agreed)} detail="Agreed project value" tone="blue" editor="amount" rawValue={String(agreed)} onSave={value => setAgreed(Number(value))}/>
      <EditableProjectMetric icon={Check} label="Payments received" value={money(paid)} detail={paid ? 'Payment total entered' : 'No receipts recorded'} tone="green" editor="amount" rawValue={String(paid)} onSave={value => setPaid(Number(value))}/>
      <EditableProjectMetric icon={TrendingUp} label="Remaining balance" value={money(remaining)} detail="Balance entered" tone="purple" editor="amount" rawValue={String(remaining)} onSave={value => setRemaining(Number(value))}/>
    </section>
    <div className="lead-project-overview-grid">
      <section className="task-detail-card lead-delivery-plan">
        <div className="lead-project-card-heading"><div><h3 className="delivery-plan-title">Delivery plan</h3></div><span className={`project-record-status ${status.toLowerCase().replace(/ /g, '-')}`}>{status}</span></div>
        <div className="lead-project-dates"><div><small>Start date</small><b>{project.start}</b></div><div><small>Target date</small><b>{project.target}</b></div></div>
        <label className="lead-project-status-control">Update project status<CustomSelect value={status} options={['Planned', 'In progress', 'Completed', 'On hold', 'Cancelled']} onChange={value => onStatusChange(project.name, value)}/></label>
        <div className="lead-project-scope"><b>Accepted scope</b><p>No accepted scope has been added yet.</p></div>
        <button className="lead-project-lead-link" onClick={() => onOpenProject(project.name)}>Lead: {lead.name} <ArrowRight size={13}/></button>
      </section>
      <section className="task-detail-card lead-project-tasks">
        <div className="lead-project-card-heading"><div><h3>Tasks</h3></div><span className="lead-task-count">{tasks.length}</span></div>
        {tasks.length ? <div className="lead-project-task-list">{tasks.map(task => <article key={task.title}><span className={`lead-task-check ${task.status === 'Completed' ? 'done' : ''}`}>{task.status === 'Completed' && <Check size={13}/>}</span><div><b>{task.title}</b><small>Due {task.due}</small></div><button aria-label={`Open task ${task.title}`} onClick={() => onOpenTask(task)}><Eye size={13}/></button></article>)}</div> : <div className="lead-project-empty">No tasks linked to this project yet.</div>}
        <button className="lead-project-text-link" onClick={() => onViewTasks(project.name)}>View all project tasks <ArrowRight size={13}/></button>
      </section>
    </div>
  </section>
}

function EditableProjectMetric({ icon: Icon, label, value, detail, tone, editor, rawValue, onSave }: {
  icon: typeof TrendingUp
  label: string
  value: string
  detail: string
  tone: string
  editor: 'status' | 'amount'
  rawValue: string
  onSave: (value: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(rawValue)
  const startEditing = () => { setDraft(rawValue); setEditing(true) }
  return <article className="lead-project-metric-card">
    <div className={`lead-project-metric-icon ${tone}`}><Icon size={18}/></div>
    <div className="lead-project-metric-content">
      <div className="lead-project-metric-label">{label}</div>
      {editing ? <form className="lead-project-metric-editor" onSubmit={event => { event.preventDefault(); onSave(draft); setEditing(false) }}>
        {editor === 'status' ? <CustomSelect ariaLabel={`Edit ${label}`} value={draft} options={['Planned', 'In progress', 'Completed', 'On hold', 'Cancelled']} onChange={setDraft}/> : <input aria-label={`Edit ${label}`} autoFocus type="number" min="0" step="0.01" required value={draft} onChange={event => setDraft(event.target.value)}/>} 
        <button type="submit" aria-label={`Save ${label}`}><Check size={14}/></button><button type="button" aria-label={`Cancel editing ${label}`} onClick={() => setEditing(false)}><X size={14}/></button>
      </form> : <><div className="lead-project-metric-value">{value}</div><div className="lead-project-metric-detail">{detail}</div></>}
    </div>
    {!editing && <button className="lead-project-metric-edit" type="button" aria-label={`Edit ${label}`} title={`Edit ${label}`} onClick={startEditing}><Pencil size={14}/></button>}
  </article>
}

type ProjectImage = { name: string; url: string }

export function LeadProjectImages() {
  const [images, setImages] = useState<ProjectImage[]>([])
  const imageUrls = useRef<string[]>([])
  const [imageError, setImageError] = useState('')

  useEffect(() => () => imageUrls.current.forEach(url => URL.revokeObjectURL(url)), [])

  const addImages = (files: FileList | null) => {
    if (!files) return
    const selected = Array.from(files)
    const invalid = selected.find(file => !file.type.startsWith('image/') || file.size > 5 * 1024 * 1024)
    if (invalid) {
      setImageError(`${invalid.name} is not a supported image under 5 MB.`)
      return
    }
    setImageError('')
    setImages(current => [...current, ...selected.map(file => {
      const url = URL.createObjectURL(file)
      imageUrls.current.push(url)
      return { name: file.name, url }
    })])
  }

  return <section className="task-detail-card lead-project-images">
    <div className="lead-project-card-heading"><div><h3 className="lead-images-title"><Camera size={15}/>Images</h3><p>Project images stay on this page for the current session.</p></div><span>{images.length} selected</span></div>
    <div className="lead-project-image-picker"><span><ImagePlus size={16}/></span><div><b>Choose project images</b><small>JPG, PNG, or WebP · up to 5 MB each</small></div><input aria-label="Choose project images" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={event => { addImages(event.currentTarget.files); event.currentTarget.value = '' }}/><button type="button" onClick={event => event.currentTarget.parentElement?.querySelector('input')?.click()}>+ Choose images</button></div>
    {imageError && <p className="lead-project-image-error">{imageError}</p>}
    {images.length ? <div className="lead-project-image-list">{images.map((image, index) => <figure key={`${image.name}-${index}`}><img src={image.url} alt={image.name}/><figcaption><span>{image.name}</span><button onClick={() => { URL.revokeObjectURL(image.url); imageUrls.current = imageUrls.current.filter(url => url !== image.url); setImages(current => current.filter((_, itemIndex) => itemIndex !== index)) }} aria-label={`Remove ${image.name}`}>×</button></figcaption></figure>)}</div> : <p className="lead-project-no-images">No project images attached.</p>}
  </section>
}
