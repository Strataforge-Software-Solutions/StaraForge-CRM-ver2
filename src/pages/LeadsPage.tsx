import LeadCsvImport from '../components/LeadCsvImport'
import { recordId, overrideFor, related } from '../lib/records'
import type { RecordIdentity } from '../lib/records'
import { Pagination, usePagination } from '../components/Pagination'
import { useEffect, useState } from 'react'
import { ArrowRight, Check, ChevronLeft, ChevronRight, ClipboardList, Phone, Plus, Search, Tag, Users, X } from 'lucide-react'
import { ContactDetails, DirectoryHeader, MetricsStrip, DirectoryTabs, RecordActionButtons, RecordActionDialog, useDrawerExit, type DirectoryAction } from '../components/DirectoryShared'
import { CustomSelect } from '../components/CustomControls'
import { useDatabaseCollection } from '../lib/database'
import { showWorkspaceToast } from '../lib/workspaceToast'
import { leadActivityKey, moveLeadActivityHistory, recordLeadActivity, type LeadActivityMap } from '../lib/leadActivity'

export type LeadDirectoryRow = RecordIdentity & { name: string; client: string; initials: string; email: string; phone: string; source: string; type: string; budget: string; status: string; date: string; tone: string; avatarUrl?: string; location?: string; notes?: string; timeline?: string; followUpDate?: string; tags?: string[]; owner?: string; nextAction?: string; lostReason?: string; stageEnteredAt?: string }
export type LeadPipelineWorkflowProgress = { proposals?: { status?: string }[]; acceptance?: unknown; deposits?: { amount?: number }[] }
export type LeadPipelineWorkflowMap = Record<string, LeadPipelineWorkflowProgress>
type LeadDrawerTab = 'Overview' | 'Activity' | 'Notes'

export const leadDirectory: LeadDirectoryRow[] = []

export function leadWorkflowKey(lead: LeadDirectoryRow) {
  return lead.workflowKey || lead.id || lead.email.trim().toLowerCase() || `${lead.name.trim().toLowerCase()}::${lead.client.trim().toLowerCase()}`
}

export function leadStageBlockReason(lead: LeadDirectoryRow, targetStatus: string, workflows: LeadPipelineWorkflowMap) {
  const stages = ['New Leads', 'Contacted', 'Discovery', 'Proposal sent', 'Awaiting deposit', 'Won', 'Lost']
  const currentIndex = stages.indexOf(lead.status)
  const targetIndex = stages.indexOf(targetStatus)
  if (targetIndex < 1 || targetStatus === 'Lost' || (targetIndex <= currentIndex && lead.status !== 'Lost')) return null

  const workflow = workflows[leadWorkflowKey(lead)]
  const requirements = [
    { stage: 'Contacted', complete: Boolean(lead.email.trim() || lead.phone.trim()), action: 'add an email address or phone number to the lead' },
    { stage: 'Discovery', complete: Boolean(lead.email.trim() || lead.phone.trim()), action: 'add contact details before discovery' },
    { stage: 'Proposal sent', complete: Boolean(workflow?.proposals?.some(proposal => proposal.status === 'Sent' || proposal.status === 'Accepted')), action: 'mark a proposal as sent from the lead record' },
    { stage: 'Awaiting deposit', complete: Boolean(workflow?.acceptance), action: 'record the client’s proposal acceptance' },
    { stage: 'Won', complete: Boolean(workflow?.deposits?.some(deposit => Number(deposit.amount) > 0)), action: 'record a deposit for the accepted proposal' },
  ]
  const missing = requirements.slice(0, targetIndex).find(requirement => !requirement.complete)
  return missing ? `Complete ${missing.stage} first: ${missing.action}.` : null
}

export function LeadAvatar({ lead, className = 'directory-avatar' }: { lead: Pick<LeadDirectoryRow, 'initials' | 'tone' | 'avatarUrl'>; className?: string }) {
  return <span className={`${className} ${lead.tone} ${lead.avatarUrl ? 'has-photo' : ''}`} aria-hidden="true">{lead.avatarUrl ? <img src={lead.avatarUrl} alt=""/> : lead.initials}</span>
}


export default function LeadsPage({ onAdd, onFullWorkflow, statusOverrides = {} }: { onAdd: () => void; onFullWorkflow: (lead: LeadDirectoryRow) => void; statusOverrides?: Record<string, string> }) {
  const [active, setActive] = useState('all')
  const [search, setSearch] = useState('')
  const [clients] = useDatabaseCollection<{ id?: string; name: string }[]>('clients', [])
  const [rows, setRows] = useDatabaseCollection('leads', leadDirectory)
  const [leadWorkflows] = useDatabaseCollection<LeadPipelineWorkflowMap>('leadWorkflows', {})
  const [action, setAction] = useState<DirectoryAction | null>(null)
  const [selectedLead, setSelectedLead] = useState<LeadDirectoryRow | null>(null)
  const countStatus = (status: string) => rows.filter(row => row.status === status).length
  const tabs = [
    { label: 'All Leads', value: 'all', count: rows.length }, { label: 'New Leads', value: 'New Leads', count: countStatus('New Leads') },
    { label: 'Contacted', value: 'Contacted', count: countStatus('Contacted') }, { label: 'Discovery', value: 'Discovery', count: countStatus('Discovery') },
    { label: 'Proposal sent', value: 'Proposal sent', count: countStatus('Proposal sent') }, { label: 'Awaiting deposit', value: 'Awaiting deposit', count: countStatus('Awaiting deposit') },
    { label: 'Won', value: 'Won', count: countStatus('Won') }, { label: 'Lost', value: 'Lost', count: countStatus('Lost') },
  ]
  const visible = rows.filter(row => (active === 'all' || row.status === active) && `${row.name} ${row.client} ${row.email} ${row.source}`.toLowerCase().includes(search.toLowerCase()))
  const paging = usePagination(visible, `${active}:${search}`)
  const openAction = (row: LeadDirectoryRow, mode: DirectoryAction['mode']) => {
    const budgetMatch = row.budget.match(/^(PHP|USD)\s*([\d,.]+)/)
    const currency = budgetMatch?.[1] ?? 'PHP'
    const amount = budgetMatch?.[2]?.replace(/,/g, '') ?? ''
    setAction({
      mode, name: row.name,
      fields: [['Client', row.client], ['Email', row.email], ['Phone', row.phone], ['Source', row.source], ['Project type', row.type], ['Budget', row.budget], ['Status', row.status], ['Date', row.date]],
      editTitle: 'Edit website inquiry',
      editDescription: 'Update the contact, request, and follow-up details for this lead.',
      editSections: mode === 'edit' ? [
        { title: 'Inquiry', description: 'Capture what the client wants to build and how to reach them.', fields: [
          { key: 'avatarUrl', label: 'Profile photo', value: row.avatarUrl ?? '', type: 'image', wide: true },
          { key: 'company', label: 'Company or client name', value: row.client },
          { key: 'owner', label: 'Opportunity owner', value: row.owner || '', placeholder: 'Responsible team member' },
          { key: 'nextAction', label: 'Next action', value: row.nextAction || '', placeholder: 'e.g. Send discovery questions' },
          { key: 'lostReason', label: 'Lost reason', value: row.lostReason || '', placeholder: 'Required when marking Lost' },
          { key: 'contact', label: 'Primary contact', value: row.name },
          { key: 'email', label: 'Email address', value: row.email, type: 'email' },
          { key: 'phone', label: 'Phone', value: row.phone, type: 'tel' },
          { key: 'location', label: 'Location', value: row.location ?? '', placeholder: 'City or region' },
          { key: 'notes', label: 'Notes', value: row.notes ?? 'Other inquiry for this client', type: 'textarea' },
        ] },
        { title: 'Follow-up and budget', description: 'Leave these blank until the client has shared the details.', fields: [
          { key: 'source', label: 'Source', value: row.source, type: 'select', options: ['Referral', 'Unspecified', 'Inquiry Form', 'Social Media: Facebook'] },
          { key: 'type', label: 'Project type', value: row.type },
          { key: 'timeline', label: 'Timeline', value: row.timeline ?? '', placeholder: 'e.g. 1–2 months' },
          { key: 'followUpDate', label: 'Next follow-up date', value: row.followUpDate ?? '', type: 'date' },
          { key: 'budgetFrom', label: 'Budget from', value: amount, type: 'number', placeholder: '0.00' },
          { key: 'budgetTo', label: 'Budget to', value: amount, type: 'number', placeholder: '0.00' },
          { key: 'currency', label: 'Budget currency', value: currency, type: 'select', options: ['PHP', 'USD'] },
          { key: 'status', label: 'Opportunity stage', value: row.status, type: 'select', options: ['New Leads', 'Contacted', 'Discovery', 'Proposal sent', 'Awaiting deposit', 'Won', 'Lost'] },
        ] },
      ] : undefined,
      onSave: values => {
        const activeLead = { ...row, status: row.status }
        if (values.status === 'Lost' && !values.lostReason?.trim()) { showWorkspaceToast('Add a reason before marking this opportunity Lost.'); return false }
        const blockedReason = leadStageBlockReason(activeLead, values.status, leadWorkflows)
        if (blockedReason) { showWorkspaceToast(blockedReason); return false }
        const updateRow = (item: LeadDirectoryRow): LeadDirectoryRow => ({
          ...item,
          name: values.contact.trim() || item.name,
          client: values.company.trim() || item.client, clientId: values.company.trim() === item.client ? item.clientId : clients.find(client => client.name === values.company.trim())?.id,
          avatarUrl: values.avatarUrl || undefined,
          initials: (values.contact.trim() || item.name).trim().split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase(),
          email: values.email.trim(), phone: values.phone.trim(), location: values.location.trim(), notes: values.notes.trim(),
          source: values.source, type: values.type.trim(), timeline: values.timeline.trim(), followUpDate: values.followUpDate,
          budget: values.budgetFrom.replace(/,/g, '') ? `${values.currency} ${Number(values.budgetFrom.replace(/,/g, '')).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${values.budgetTo.replace(/,/g, '') && values.budgetTo.replace(/,/g, '') !== values.budgetFrom.replace(/,/g, '') ? ` – ${values.currency} ${Number(values.budgetTo.replace(/,/g, '')).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}` : 'Not discussed',
          status: values.status, owner: values.owner.trim(), nextAction: values.nextAction.trim(), lostReason: values.lostReason.trim(),
        })
        setRows(current => current.map(item => recordId(item) === recordId(row) ? updateRow(item) : item))
        setSelectedLead(current => current?.name === row.name ? updateRow(current) : current)
        const updated = updateRow(row)
        if (updated.name !== row.name) void moveLeadActivityHistory(row.name, updated.name)
        if (updated.status !== activeLead.status) void recordLeadActivity(updated.name, 'Stage changed', `Opportunity stage changed to ${updated.status}.`)
        else void recordLeadActivity(updated.name, 'Lead updated', 'Lead contact and opportunity details were updated.')
      },
      onDelete: () => setRows(current => current.filter(item => recordId(item) !== recordId(row))),
    })
  }
  return <div className="directory-page">
    <DirectoryHeader section="SALES WORKSPACE" title="Leads" description="Manage website inquiries and move promising conversations toward a real project." action="Add Lead" onAction={onAdd}/>
    <MetricsStrip metrics={[
      { icon: Users, label: 'Total Leads', value: String(rows.length), detail: 'All active inquiries', tone: 'orange' },
      { icon: ClipboardList, label: 'New Leads', value: String(countStatus('New Leads')), detail: 'Awaiting first contact', tone: 'blue' },
      { icon: Phone, label: 'Contacted', value: String(countStatus('Contacted')), detail: 'Conversation started', tone: 'green' },
      { icon: Check, label: 'Converted', value: String(countStatus('Won')), detail: 'Confirmed projects', tone: 'purple' },
    ]}/>
    <DirectoryTabs tabs={tabs} active={active} onChange={setActive}/>
    <section className="directory-panel"><div className="directory-panel-head"><div><h2>{active === 'all' ? 'All Leads' : active}</h2><span>{visible.length} {visible.length === 1 ? 'lead' : 'leads'}</span></div><form className="directory-search" onSubmit={event => event.preventDefault()}><Search size={17}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search leads..."/><button>Search</button></form></div>
      <div className="directory-table-wrap"><table className="directory-table leads-table"><thead><tr><th>Name</th><th>Contact</th><th>Source</th><th>Project Type</th><th>Budget</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead><tbody>
        {paging.items.map(row => <tr key={recordId(row)}><td><div className="person-cell"><LeadAvatar lead={row}/><div><b>{row.name}</b><small>{row.client}</small><em>Other inquiry for this client</em></div></div></td><td><ContactDetails email={row.email} phone={row.phone}/></td><td>{row.source}</td><td><span className="type-chip">{row.type}</span></td><td>{row.budget}</td><td><span className={`record-status ${row.status.toLowerCase().replace(/ /g, '-')}`}>{row.status}</span></td><td>{row.date}</td><td><RecordActionButtons name={row.name} onAction={mode => mode === 'view' ? setSelectedLead(row) : openAction(row, mode)}/></td></tr>)}
      </tbody></table>{visible.length === 0 && <div className="directory-empty">No leads match your search.</div>}</div>
      <Pagination paging={paging} noun="leads"/>
    </section>
    {action && <RecordActionDialog key={`${action.mode}-${action.name}`} action={action} onClose={() => setAction(null)}/>}
    {selectedLead && <LeadDetailDrawer key={selectedLead.name} lead={selectedLead} onClose={() => setSelectedLead(null)} onFullWorkflow={onFullWorkflow} onEdit={() => { const lead = selectedLead; setSelectedLead(null); openAction(lead, 'edit') }}/>}
  </div>
}

function LeadDetailDrawer({ lead, onClose, onFullWorkflow, onEdit }: { lead: LeadDirectoryRow; onClose: () => void; onFullWorkflow: (lead: LeadDirectoryRow) => void; onEdit: () => void }) {
  const { closing, close } = useDrawerExit(onClose)
  const [tab, setTab] = useState<LeadDrawerTab>('Overview')
  const [savedLeads, setSavedLeads] = useDatabaseCollection<LeadDirectoryRow[]>('leads', leadDirectory)
  const currentLead = savedLeads.find(item => recordId(item) === recordId(lead)) ?? lead
  const tags = currentLead.tags ?? []
  const [tagDraft, setTagDraft] = useState('')
  const [noteDraft, setNoteDraft] = useState('')
  const [notes, setNotes] = useState<string[]>([])
  const [activityByLead] = useDatabaseCollection<LeadActivityMap>('leadActivities', {})
  const activities = activityByLead[leadActivityKey(lead.name)] ?? []
  const addTag = (event: React.FormEvent) => {
    event.preventDefault()
    const tag = tagDraft.trim()
    if (!tag || tags.length >= 12 || tags.some(item => item.toLowerCase() === tag.toLowerCase())) return
    setSavedLeads(current => current.map(item => recordId(item) === recordId(lead) ? { ...item, tags: [...(item.tags ?? []), tag] } : item))
    setTagDraft('')
    void recordLeadActivity(lead.name, 'Tag added', `Added the “${tag}” tag.`)
    showWorkspaceToast('Lead tag added.')
  }
  const saveNote = (event: React.FormEvent) => {
    event.preventDefault()
    const note = noteDraft.trim()
    if (!note) return
    setNotes(current => [note, ...current])
    setNoteDraft('')
    void recordLeadActivity(lead.name, 'Note added', note)
    showWorkspaceToast('Lead note added.')
  }
  const tabs: LeadDrawerTab[] = ['Overview', 'Activity', 'Notes']
  return <div className={`client-drawer-backdrop lead-drawer-backdrop${closing ? ' is-closing' : ''}`} onClick={() => close()}><aside className={`client-detail-drawer lead-detail-drawer${closing ? ' is-closing' : ''}`} role="dialog" aria-modal="true" aria-label={`${lead.name} lead details`} onClick={event => event.stopPropagation()}>
    <header className="client-drawer-header"><LeadAvatar lead={lead}/><div className="client-drawer-title"><h2>{lead.name}</h2><span>{lead.client} · {lead.status}</span></div><button className="client-drawer-close" aria-label="Close lead details" onClick={() => close()}><X size={17}/></button></header>
    <nav className="client-drawer-tabs lead-drawer-tabs" aria-label="Lead details tabs" role="tablist">{tabs.map(item => <button key={item} role="tab" aria-selected={tab === item} className={tab === item ? 'selected' : ''} onClick={() => setTab(item)}>{item}</button>)}<button className="lead-full-workflow" onClick={() => close(() => onFullWorkflow(lead))}>Full workflow <ArrowRight size={12}/></button></nav>
    <div className="client-drawer-content">
      {tab === 'Overview' && <>
        <section className="lead-stage-card"><span>Opportunity stage</span><div><b className={`record-status ${lead.status.toLowerCase().replace(/ /g, '-')}`}>{lead.status}</b><button onClick={() => close(() => onFullWorkflow(lead))}>Manage stage in workflow <ArrowRight size={12}/></button></div></section>
        <section className="client-drawer-section lead-fields-grid">
          <div><small>Contact name</small><b>{lead.client}</b></div><div><small>Email</small><b>{lead.email}</b></div>
          <div><small>Phone</small><b>{lead.phone}</b></div><div><small>Source</small><b>{lead.source}</b></div>
          <div><small>Project type</small><b>{lead.type}</b></div><div><small>Estimated budget</small><b>{lead.budget}</b></div>
          <div><small>Next follow-up</small><b>Not set</b></div><div><small>Created</small><b>{lead.date}</b></div>
          <div><small>Timeline</small><b>Not set</b></div><div><small>Location</small><b>Not provided</b></div>
        </section>
        <section className="client-drawer-section"><h3>About this opportunity</h3><div className="lead-opportunity-summary">Other inquiry for this client</div></section>
        <section className="client-drawer-section"><div className="client-section-heading"><h3>Tags</h3><span>{tags.length}/12</span></div>{tags.length ? <div className="client-tag-list">{tags.map(tag => <button key={tag} onClick={() => { setSavedLeads(current => current.map(item => recordId(item) === recordId(lead) ? { ...item, tags: (item.tags ?? []).filter(existing => existing !== tag) } : item)); void recordLeadActivity(lead.name, 'Tag removed', `Removed the “${tag}” tag.`); showWorkspaceToast('Lead tag removed.') }}>{tag}<X size={12}/></button>)}</div> : <p className="client-muted">No tags yet.</p>}<form className="client-tag-form" onSubmit={addTag}><input value={tagDraft} onChange={event => setTagDraft(event.target.value)} maxLength={24} placeholder="Add a tag..." aria-label="New lead tag"/><button type="submit" disabled={tags.length >= 12}><Plus size={13}/> Add tag</button></form></section>
        <section className="client-drawer-section"><div className="client-section-heading"><h3>Recent activity</h3><button onClick={() => setTab('Activity')}>View all <span>→</span></button></div><LeadActivityList activities={activities.slice(0, 3)}/></section>
      </>}
      {tab === 'Activity' && <section className="client-drawer-section"><div className="client-section-heading"><h3>Activity</h3><span>{activities.length} {activities.length === 1 ? 'update' : 'updates'}</span></div><LeadActivityList activities={activities}/></section>}
      {tab === 'Notes' && <section className="client-drawer-section"><h3>Notes</h3><form className="client-note-form" onSubmit={saveNote}><textarea value={noteDraft} onChange={event => setNoteDraft(event.target.value)} placeholder="Write a note about this lead..." rows={4}/><button type="submit" disabled={!noteDraft.trim()}>Save note</button></form>{notes.length ? <div className="client-notes-list">{notes.map((note, index) => <article key={`${index}-${note}`}><span>Workspace member · Just now</span><p>{note}</p></article>)}</div> : <div className="client-drawer-empty">No notes yet.</div>}</section>}
    </div>
    <footer className="lead-drawer-footer"><button className="lead-edit-button" onClick={() => close(onEdit)}><Tag size={14}/>Edit lead</button><button className="lead-open-project" onClick={() => close(() => onFullWorkflow(lead))}>Open full workflow <ArrowRight size={14}/></button></footer>
  </aside></div>
}

function LeadActivityList({ activities }: { activities: { id: string; action: string; detail: string; createdAt: string }[] }) {
  if (!activities.length) return <div className="client-drawer-empty activity-empty">No activity has been recorded for this lead yet.</div>
  return <div className="client-notes-list lead-activity-list">{activities.map(activity => <article key={activity.id}><span>{new Date(activity.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span><b>{activity.action}</b><p>{activity.detail}</p></article>)}</div>
}


