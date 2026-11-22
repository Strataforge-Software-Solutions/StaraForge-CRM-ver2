import { useMemo, useState } from 'react'
import { Activity, CalendarDays, CheckCircle2, ClipboardList, FileClock, Search, ShieldCheck, Users } from 'lucide-react'
import { DirectoryHeader, MetricsStrip } from '../components/DirectoryShared'
import { CustomSelect } from '../components/CustomControls'
import { useDatabaseCollection } from '../lib/database'
import { leadActivityKey, type LeadActivityMap } from '../lib/leadActivity'
import { leadDirectory, type LeadDirectoryRow } from './LeadsPage'

type AuditEvent = { id: string; actor: string; initials: string; action: string; target: string; category: string; date: string; time: string; createdAt: string; tone: string }

const categories = ['All activity', 'Leads', 'Clients', 'Tasks', 'Projects', 'Payments']

export default function AuditHistoryPage() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All activity')
  const [period, setPeriod] = useState('Last 30 days')
  const [recordHistory] = useDatabaseCollection<any[]>('recordHistory', [])
  const [activities] = useDatabaseCollection<LeadActivityMap>('leadActivities', {})
  const [leads] = useDatabaseCollection<LeadDirectoryRow[]>('leads', leadDirectory)
  const events = useMemo<AuditEvent[]>(() => {
    const names = new Map(leads.map(lead => [leadActivityKey(lead.name), lead.name]))
    const recorded: AuditEvent[] = recordHistory.map(entry => ({ id: entry.id, actor: entry.actor, initials: entry.actor?.slice(0, 2).toUpperCase() || 'WM', action: entry.action, target: entry.detail, category: ({ leads: 'Leads', clients: 'Clients', contacts: 'Clients', interactions: 'Clients', tasks: 'Tasks', projects: 'Projects', payments: 'Payments', paymentSchedules: 'Payments', leadWorkflows: 'Leads' } as Record<string, string>)[entry.collection] || 'Projects', date: new Date(entry.createdAt).toLocaleDateString(), time: new Date(entry.createdAt).toLocaleTimeString(), createdAt: entry.createdAt, tone: 'blue' }))
    return [...recorded, ...Object.entries(activities).flatMap(([leadKey, entries]) => entries.map(entry => {
      const createdAt = new Date(entry.createdAt)
      return {
        id: entry.id,
        actor: 'Workspace member',
        initials: 'WM',
        action: entry.action,
        target: `${names.get(leadKey) ?? leadKey} · ${entry.detail}`,
        category: 'Leads',
        date: createdAt.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
        time: createdAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        createdAt: entry.createdAt,
        tone: 'orange',
      }
    }))].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [activities, leads, recordHistory])
  const filtered = useMemo(() => events.filter(event => {
    const eventDate = new Date(event.createdAt)
    const cutoff = new Date()
    cutoff.setHours(0, 0, 0, 0)
    if (period !== 'All time') cutoff.setDate(cutoff.getDate() - (period === 'Last 7 days' ? 6 : 29))
    const withinPeriod = period === 'All time' || (eventDate >= cutoff && eventDate <= new Date())
    return withinPeriod && (category === 'All activity' || event.category === category) && `${event.actor} ${event.action} ${event.target} ${event.category}`.toLowerCase().includes(query.toLowerCase())
  }), [category, events, period, query])
  const actorCount = new Set(events.map(event => event.actor)).size
  const activityTypeCount = new Set(events.map(event => event.action)).size
  const latestEvent = events[0]

  return <div className="directory-page admin-page audit-page">
    <div className="directory-heading"><div><span className="directory-eyebrow">ADMINISTRATION</span><h1>Audit history</h1><p>Review recent changes recorded across the workspace.</p></div></div>
    <MetricsStrip metrics={[
      { icon: Activity, label: 'Recorded events', value: String(events.length), detail: events.length ? 'Saved workspace updates' : 'No events recorded yet', tone: 'orange' },
      { icon: Users, label: 'Actors', value: String(actorCount), detail: actorCount ? 'Workspace contributors' : 'No activity recorded', tone: 'blue' },
      { icon: ShieldCheck, label: 'Activity types', value: String(activityTypeCount), detail: activityTypeCount ? 'Recorded change types' : 'No activity recorded', tone: 'purple' },
      { icon: CheckCircle2, label: 'Latest update', value: latestEvent?.date ?? '—', detail: latestEvent?.time ?? 'No activity recorded', tone: 'green' },
    ]}/>
    <section className="admin-panel">
      <div className="admin-panel-head audit-panel-head"><div><h2>Activity log</h2><span>{filtered.length} {filtered.length === 1 ? 'event' : 'events'}</span></div><div className="audit-controls"><label className="admin-search"><Search size={16}/><input aria-label="Search audit history" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search activity..."/></label><label className="audit-filter"><span>Category</span><CustomSelect ariaLabel="Filter audit history category" value={category} options={categories} onChange={setCategory}/></label><label className="audit-filter period-filter"><span>Period</span><span className="audit-period-icon"><CalendarDays size={15}/><CustomSelect ariaLabel="Audit history period" value={period} options={['Last 7 days', 'Last 30 days', 'All time']} onChange={setPeriod}/></span></label></div></div>
      <div className="audit-list">{filtered.map(event => <article className="audit-event" key={event.id}>
        <span className={`audit-event-icon ${event.tone}`}>{event.category === 'Tasks' ? <ClipboardList size={17}/> : event.category === 'Payments' ? <CheckCircle2 size={17}/> : event.category === 'Clients' ? <Users size={17}/> : <Activity size={17}/>}</span>
        <div className="audit-event-main"><p><b>{event.actor}</b> {event.action.toLowerCase()}</p><span>{event.target}</span></div>
        <span className="audit-category">{event.category}</span>
        <time dateTime={event.createdAt}><b>{event.date}</b><span>{event.time}</span></time>
      </article>)}{filtered.length === 0 && <div className="admin-empty audit-empty"><span className="audit-empty-icon"><FileClock size={23}/></span><b>{events.length ? 'No activity matches these filters' : 'No activity recorded yet'}</b><span>{events.length ? 'Try a different category, period, or search term.' : 'Lead, client, project, and task changes will appear here when recorded.'}</span>{events.length > 0 && <button type="button" onClick={() => { setQuery(''); setCategory('All activity'); setPeriod('All time') }}>Clear filters</button>}</div>}</div>
      <div className="admin-panel-foot"><span>Recorded changes in your workspace</span><span>{filtered.length} of {events.length} events</span></div>
    </section>
    <div className="audit-disclaimer"><FileClock size={15}/>Lead changes, notes, tags, and stage updates appear here as they are recorded.</div>
  </div>
}
