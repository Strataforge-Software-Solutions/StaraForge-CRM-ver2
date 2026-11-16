import { useMemo, useState } from 'react'
import { Activity, CalendarDays, CheckCircle2, ClipboardList, FileClock, Search, ShieldCheck, Users } from 'lucide-react'
import { DirectoryHeader, MetricsStrip } from '../components/DirectoryShared'
import { CustomSelect } from '../components/CustomControls'

type AuditEvent = { actor: string; initials: string; action: string; target: string; category: string; date: string; time: string; tone: string }

const auditEvents: AuditEvent[] = []

const categories = ['All activity', 'Leads', 'Clients', 'Tasks', 'Projects', 'Payments']

export default function AuditHistoryPage() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All activity')
  const [period, setPeriod] = useState('Last 30 days')
  const filtered = useMemo(() => auditEvents.filter(event => {
    const eventDate = new Date(`${event.date} 12:00 PM`)
    const cutoff = new Date(2026, 10, 7)
    if (period !== 'All time') cutoff.setDate(cutoff.getDate() - (period === 'Last 7 days' ? 7 : 30))
    const withinPeriod = period === 'All time' || eventDate >= cutoff
    return withinPeriod && (category === 'All activity' || event.category === category) && `${event.actor} ${event.action} ${event.target} ${event.category}`.toLowerCase().includes(query.toLowerCase())
  }), [category, period, query])

  return <div className="directory-page admin-page audit-page">
    <div className="directory-heading"><div><span className="directory-eyebrow">ADMINISTRATION</span><h1>Audit history</h1><p>Review recent changes recorded across the workspace.</p></div></div>
    <MetricsStrip metrics={[
      { icon: Activity, label: 'Recorded events', value: String(auditEvents.length), detail: 'No events recorded yet', tone: 'orange' },
      { icon: Users, label: 'Actors', value: '0', detail: 'No activity recorded', tone: 'blue' },
      { icon: ShieldCheck, label: 'Activity types', value: '0', detail: 'No activity recorded', tone: 'purple' },
      { icon: CheckCircle2, label: 'Latest update', value: '—', detail: 'No activity recorded', tone: 'green' },
    ]}/>
    <section className="admin-panel">
      <div className="admin-panel-head audit-panel-head"><div><h2>Activity log</h2><span>{filtered.length} {filtered.length === 1 ? 'event' : 'events'}</span></div><div className="audit-controls"><label className="admin-search"><Search size={16}/><input aria-label="Search audit history" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search activity..."/></label><label className="audit-filter"><span>Category</span><CustomSelect ariaLabel="Filter audit history category" value={category} options={categories} onChange={setCategory}/></label><label className="audit-filter period-filter"><span>Period</span><span className="audit-period-icon"><CalendarDays size={15}/><CustomSelect ariaLabel="Audit history period" value={period} options={['Last 7 days', 'Last 30 days', 'All time']} onChange={setPeriod}/></span></label></div></div>
      <div className="audit-list">{filtered.map(event => <article className="audit-event" key={`${event.date}-${event.time}-${event.action}`}>
        <span className={`audit-event-icon ${event.tone}`}>{event.category === 'Tasks' ? <ClipboardList size={17}/> : event.category === 'Payments' ? <CheckCircle2 size={17}/> : event.category === 'Clients' ? <Users size={17}/> : <Activity size={17}/>}</span>
        <div className="audit-event-main"><p><b>{event.actor}</b> {event.action.toLowerCase()}</p><span>{event.target}</span></div>
        <span className="audit-category">{event.category}</span>
        <time dateTime={`${event.date} ${event.time}`}><b>{event.date}</b><span>{event.time}</span></time>
      </article>)}{filtered.length === 0 && <div className="admin-empty"><FileClock size={22}/><b>No matching activity</b><span>Try another search or category.</span></div>}</div>
      <div className="admin-panel-foot"><span>Timestamped audit logging is not enabled yet.</span><span>{filtered.length} of {auditEvents.length} events</span></div>
    </section>
    <div className="audit-disclaimer"><FileClock size={15}/>No example activity is shown. Changes are not yet written to a timestamped audit log.</div>
  </div>
}
