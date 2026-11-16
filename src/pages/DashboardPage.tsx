import { useEffect, useRef, useState } from 'react'
import { Activity, ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronDown, ClipboardList, Layers3, Users } from 'lucide-react'
import { useDatabaseCollection } from '../lib/database'
import { leadDirectory, type LeadDirectoryRow } from './LeadsPage'
import { projectDirectory, type ProjectDirectoryRow } from './ProjectsPage'
import { projectTaskRows, type ProjectTaskRecord } from './ProjectTasksPage'

type DashboardRange = 'Last 7 days' | 'Last 30 days' | 'Last 90 days' | 'This year'
const rangeOptions: DashboardRange[] = ['Last 7 days', 'Last 30 days', 'Last 90 days', 'This year']
type DashboardChartData = {
  totalLeads: number; won: number; max: number; leadPoints: number[]; wonPoints: number[]; labels: [string, string, string]
  sources: { label: string; n: number; color: string }[]
}

function leadsInRange(leads: LeadDirectoryRow[], range: DashboardRange) {
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  const start = new Date(end)
  if (range === 'This year') start.setMonth(0, 1)
  else start.setDate(start.getDate() - (range === 'Last 7 days' ? 6 : range === 'Last 30 days' ? 29 : 89))
  start.setHours(0, 0, 0, 0)
  return leads.filter(lead => {
    const date = new Date(lead.date)
    return !Number.isNaN(date.getTime()) && date >= start && date <= end
  })
}

function buildDashboardData(leads: LeadDirectoryRow[], range: DashboardRange): DashboardChartData {
  const rangedLeads = leadsInRange(leads, range)
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  if (range === 'This year') start.setMonth(0, 1)
  else start.setDate(start.getDate() - (range === 'Last 7 days' ? 6 : range === 'Last 30 days' ? 29 : 89))
  const span = Math.max(1, Math.floor((Date.now() - start.getTime()) / 86400000) + 1)
  const leadPoints = Array.from({ length: 7 }, () => 0)
  const wonPoints = Array.from({ length: 7 }, () => 0)
  rangedLeads.forEach(lead => {
    const date = new Date(lead.date)
    const bucket = Math.min(6, Math.max(0, Math.floor(((date.getTime() - start.getTime()) / 86400000 / span) * 7)))
    leadPoints[bucket]++
    if (lead.status === 'Won') wonPoints[bucket]++
  })
  leadPoints.forEach((_, index) => {
    leadPoints[index] = leadPoints.slice(0, index + 1).reduce((total, count) => total + count, 0)
    wonPoints[index] = wonPoints.slice(0, index + 1).reduce((total, count) => total + count, 0)
  })
  const end = new Date()
  const middle = new Date(start.getTime() + (end.getTime() - start.getTime()) / 2)
  const labels = [start, middle, end].map(date => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })) as [string, string, string]
  const sourceNames = [...new Set(rangedLeads.map(lead => lead.source).filter(Boolean))]
  const palette = ['orange', 'blue', 'green', 'purple', 'teal', 'yellow']
  const sources = sourceNames.map((label, index) => ({ label, color: palette[index % palette.length], n: rangedLeads.filter(lead => lead.source === label).length }))
  const won = rangedLeads.filter(lead => lead.status === 'Won').length
  return { totalLeads: rangedLeads.length, won, max: Math.max(1, ...leadPoints), leadPoints, wonPoints, labels, sources }
}

function chartPath(points: number[], max: number) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${(index * 580) / (points.length - 1)} ${142 - (point / max) * 124}`).join(' ')
}

function Metric({ icon: Icon, label, value, detail, tone }: { icon: typeof Users; label: string; value: string; detail: string; tone: string }) {
  return <div className="metric"><div className={`metric-icon ${tone}`}><Icon size={16} /></div>
    <div><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-detail">{detail}</div></div>
  </div>
}

function CardTitle({ icon: Icon, title, action }: { icon: typeof Activity; title: string; action?: React.ReactNode }) {
  return <div className="card-title"><div className="title-icon"><Icon size={15} /></div><strong>{title}</strong>{action && <div className="card-action">{action}</div>}</div>
}

function RangeSelect({ range, onChange }: { range: DashboardRange; onChange: (range: DashboardRange) => void }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])
  return <div className="range-select-wrap" ref={menuRef} onKeyDown={event => { if (event.key === 'Escape') setOpen(false) }}>
    <button type="button" className="range-select" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(current => !current)}>{range}<ChevronDown size={12} /></button>
    {open && <div className="range-select-menu" role="listbox" aria-label="Date range">{rangeOptions.map(option => <button type="button" role="option" aria-selected={range === option} className={range === option ? 'selected' : ''} key={option} onClick={() => { onChange(option); setOpen(false) }}>{option}{range === option && <Check size={12}/>}</button>)}</div>}
  </div>
}

type PerformanceMetric = 'leads' | 'won'

function LeadChart({ activeMetric, onMetricHover, data }: { activeMetric: PerformanceMetric | null; onMetricHover: (metric: PerformanceMetric | null) => void; data: DashboardChartData }) {
  const frameRef = useRef(data)
  const animationRef = useRef<number | null>(null)
  const [frame, setFrame] = useState(data)
  useEffect(() => {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current)
    const from = frameRef.current
    if (from === data) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      frameRef.current = data
      animationRef.current = null
      setFrame(data)
      return
    }

    const start = performance.now()
    const duration = 520
    const animate = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      const blend = (previous: number[], next: number[]) => next.map((value, index) => previous[index] + (value - previous[index]) * eased)
      const nextFrame = {
        totalLeads: Math.round(from.totalLeads + (data.totalLeads - from.totalLeads) * eased),
        won: Math.round(from.won + (data.won - from.won) * eased),
        max: from.max + (data.max - from.max) * eased,
        leadPoints: blend(from.leadPoints, data.leadPoints),
        wonPoints: blend(from.wonPoints, data.wonPoints),
        labels: data.labels,
        sources: data.sources,
      }
      frameRef.current = nextFrame
      setFrame(nextFrame)
      if (progress < 1) animationRef.current = requestAnimationFrame(animate)
      else {
        frameRef.current = data
        animationRef.current = null
      }
    }
    animationRef.current = requestAnimationFrame(animate)
    return () => { if (animationRef.current !== null) cancelAnimationFrame(animationRef.current) }
  }, [data])

  const wonPath = chartPath(frame.wonPoints, frame.max)
  const leadPath = chartPath(frame.leadPoints, frame.max)
  const yLabels = [frame.max, Math.round(frame.max * .75), Math.round(frame.max * .5), Math.round(frame.max * .25), 0]
  return <div className="chart-wrap">
    <div className="chart-y-labels">{yLabels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}</div>
    <svg className="chart" viewBox="0 0 580 165" preserveAspectRatio="none" role="img" aria-label="Lead performance line chart">
      <defs>
        <linearGradient id="blueFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#347cf2" stopOpacity=".16"/><stop offset="1" stopColor="#347cf2" stopOpacity="0"/></linearGradient>
        <linearGradient id="orangeFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#ff5a1f" stopOpacity=".14"/><stop offset="1" stopColor="#ff5a1f" stopOpacity="0"/></linearGradient>
      </defs>
      {[22,52,82,112,142].map(y => <line key={y} x1="0" x2="580" y1={y} y2={y} stroke="#e9edf2" strokeDasharray="2 5" />)}
      <path d={`${wonPath} L580 142 L0 142Z`} fill="url(#blueFill)" pointerEvents="none" />
      <path d={`${leadPath} L580 142 L0 142Z`} fill="url(#orangeFill)" pointerEvents="none" />
      <path className="performance-line won-line" d={wonPath} fill="none" stroke="#3880f5" strokeWidth="2.5" pointerEvents="stroke" style={{ opacity: activeMetric && activeMetric !== 'won' ? .32 : 1, strokeWidth: activeMetric === 'won' ? 3.8 : 2.5 }} onPointerEnter={() => onMetricHover('won')} onPointerLeave={() => onMetricHover(null)} />
      <path className="performance-line leads-line" d={leadPath} fill="none" stroke="#ff5a1f" strokeWidth="2.5" pointerEvents="stroke" style={{ opacity: activeMetric && activeMetric !== 'leads' ? .32 : 1, strokeWidth: activeMetric === 'leads' ? 3.8 : 2.5 }} onPointerEnter={() => onMetricHover('leads')} onPointerLeave={() => onMetricHover(null)} />
    </svg>
    <div className="chart-x-labels">{frame.labels.map(label => <span key={label}>{label}</span>)}</div>
  </div>
}

function PerformanceCard({ range, onRangeChange, leads }: { range: DashboardRange; onRangeChange: (range: DashboardRange) => void; leads: LeadDirectoryRow[] }) {
  const [hoveredMetric, setHoveredMetric] = useState<PerformanceMetric | null>(null)
  const data = buildDashboardData(leads, range)
  return <section className="card performance-card">
    <CardTitle icon={Activity} title="Lead Performance" action={<RangeSelect range={range} onChange={onRangeChange} />} />
    <div className="chart-summary"><div><span className="muted">Total leads</span><b>{data.totalLeads}</b></div><span className="won-pill"><i />{data.won} won</span></div>
    <LeadChart activeMetric={hoveredMetric} onMetricHover={setHoveredMetric} data={data}/>
    <div className="chart-legend">{([{ key: 'leads', label: 'Leads', count: data.totalLeads, dot: 'orange-dot' }, { key: 'won', label: 'Won', count: data.won, dot: 'blue-dot' }] as const).map(item => <button type="button" key={item.key} className={`chart-legend-item${hoveredMetric === item.key ? ' is-active' : ''}`} onPointerEnter={() => setHoveredMetric(item.key)} onPointerLeave={() => setHoveredMetric(null)} onFocus={() => setHoveredMetric(item.key)} onBlur={() => setHoveredMetric(null)}><i className={item.dot}/>{item.label}<b>{item.count}</b></button>)}</div>
  </section>
}

function SourcesCard({ range, onRangeChange, leads }: { range: DashboardRange; onRangeChange: (range: DashboardRange) => void; leads: LeadDirectoryRow[] }) {
  const [hoveredSource, setHoveredSource] = useState<string | null>(null)
  const data = buildDashboardData(leads, range)
  const sources = data.sources.map(source => ({ ...source, displayLabel: source.label.replace(/^Social Media:\s*/i, ''), pct: data.totalLeads ? Math.round((source.n / data.totalLeads) * 100) : 0 }))
  const leadingSource = [...sources].sort((a, b) => b.n - a.n)[0] ?? { label: '', displayLabel: 'No source data', color: 'gray', n: 0, pct: 0 }
  return <section className="card sources-card">
    <CardTitle icon={Activity} title="Lead Sources" action={<RangeSelect range={range} onChange={onRangeChange} />} />
    <div className="source-total"><span className="muted">Total leads</span><b>{data.totalLeads}</b></div>
    {sources.length ? <div className="source-bars">{sources.map(source => <div className={`source-row${hoveredSource === source.label ? ' is-active' : ''}`} key={source.label} onPointerEnter={() => setHoveredSource(source.label)} onPointerLeave={() => setHoveredSource(null)} onFocus={() => setHoveredSource(source.label)} onBlur={() => setHoveredSource(null)} tabIndex={0} aria-label={`${source.displayLabel}: ${source.n} leads, ${source.pct}%`}>
      <span>{source.displayLabel}</span><div className="bar-track"><i className={source.color} style={{ width: `${source.pct}%` }} /></div><b>{source.n}</b><small>{source.pct}%</small>
    </div>)}</div> : <div className="dashboard-empty-state">Lead source information will appear after your first lead is added.</div>}
    {sources.length > 0 && <div className="source-chips">{sources.map(s => <span key={s.label} className={hoveredSource === s.label ? 'is-active' : ''} onPointerEnter={() => setHoveredSource(s.label)} onPointerLeave={() => setHoveredSource(null)} onFocus={() => setHoveredSource(s.label)} onBlur={() => setHoveredSource(null)} tabIndex={0} aria-label={`${s.displayLabel}: ${s.n} leads`}><i className={s.color} />{s.displayLabel}<b>{s.n}</b></span>)}</div>}
    {sources.length > 0 && <div className="source-insight"><span><i className={`${leadingSource.color}-dot`}/><b>{leadingSource.displayLabel}</b> is the leading source</span><strong>{leadingSource.n} leads · {leadingSource.pct}%</strong></div>}
  </section>
}

function ActivityCard() {
  return <section className="card activity-card">
    <CardTitle icon={Activity} title="Recent activity" action={<button className="text-link">View leads <ArrowUpRight size={13}/></button>} />
    <div className="dashboard-empty-state">Activity will appear here as you update records.</div>
    <div className="activity-foot"><span>No recent updates</span><span>Workspace activity</span></div>
    <div className="activity-pagination"><span>0 updates</span><span>Recent activity</span></div>
  </section>
}

function LeadsCard({ leads, onOpenLead }: { leads: LeadDirectoryRow[]; onOpenLead: (lead: LeadDirectoryRow) => void }) {
  return <section className="card leads-card">
    <CardTitle icon={Users} title="Recent leads" action={<button className="text-link">View all <ArrowRight size={13}/></button>} />
    <div className="lead-table-wrap"><table><thead><tr><th>Name</th><th>Project type</th><th>Source</th><th>Date</th><th>Status</th></tr></thead>
      <tbody>{leads.map(lead => <tr key={lead.name}><td><span className={`lead-avatar ${lead.tone}`}>{lead.initials}</span><button type="button" className="dashboard-lead-link" onClick={() => onOpenLead(lead)} aria-label={`Open ${lead.name} lead`}>{lead.name}</button></td><td>{lead.type}</td><td>{lead.source}</td><td>{lead.date}</td><td><span className={`status ${lead.status === 'Won' ? 'won' : ''}`}>{lead.status}</span></td></tr>)}</tbody>
    </table></div>
  </section>
}

function TasksCard({ tasks }: { tasks: ProjectTaskRecord[] }) {
  const [done, setDone] = useState<string[]>([])
  return <section className="card tasks-card">
    <CardTitle icon={ClipboardList} title="Upcoming tasks" action={<button className="text-link">View all <ArrowRight size={13}/></button>} />
    <div className="task-list">{tasks.filter(task => task.status !== 'Completed').slice(0, 5).map(task => <button className={`task-row ${done.includes(task.title) ? 'complete' : ''}`} key={task.title} onClick={() => setDone(done.includes(task.title) ? done.filter(t => t !== task.title) : [...done, task.title])}>
      <span className="task-check">{done.includes(task.title) && <Check size={11}/>}</span><span className="task-copy"><span>{task.title}</span><small className="task-project-context">Project: {task.project}</small><small>{task.due}</small>{task.overdue && <em>Assign before completing →</em>}</span>
    </button>)}</div>
  </section>
}

function ProjectsCard({ projects }: { projects: ProjectDirectoryRow[] }) {
  return <section className="card projects-card">
    <CardTitle icon={Layers3} title="Project status" action={<button className="text-link">View all <ArrowRight size={13}/></button>} />
    <div className="project-list">{projects.map(({ name, target, status, tone }) => <div className="project-row" key={name}>
      <div className={`project-icon ${tone}`}><Layers3 size={15}/></div><div className="project-copy"><span>{name}</span><small>Target {target}</small></div><span className={`project-status ${tone}`}>{status}</span>
    </div>)}</div>
  </section>
}


export default function DashboardPage({ onOpenLead }: { onOpenLead: (lead: LeadDirectoryRow) => void }) {
  const [performanceRange, setPerformanceRange] = useState<DashboardRange>('Last 30 days')
  const [sourcesRange, setSourcesRange] = useState<DashboardRange>('Last 30 days')
  const [savedLeads] = useDatabaseCollection('leads', leadDirectory)
  const [savedTasks] = useDatabaseCollection('tasks', projectTaskRows)
  const [additionalProjects] = useDatabaseCollection<ProjectDirectoryRow[]>('projects', [])
  const [projectOverrides] = useDatabaseCollection<Record<string, Partial<ProjectDirectoryRow>>>('projectOverrides', {})
  const [deletedProjects] = useDatabaseCollection<string[]>('deletedProjects', [])
  const [projectStatusOverrides] = useDatabaseCollection<Record<string, string>>('projectStatusOverrides', {})
  const dashboardProjects = [...projectDirectory.filter(project => !additionalProjects.some(extra => extra.name === project.name)), ...additionalProjects]
    .map(project => ({ ...project, ...projectOverrides[project.name], status: projectStatusOverrides[project.name] ?? projectOverrides[project.name]?.status ?? project.status }))
    .filter(project => !deletedProjects.includes(project.name)).slice(0, 3)
  const wonCount = savedLeads.filter(lead => lead.status === 'Won').length
  const pendingTasks = savedTasks.filter(task => task.status !== 'Completed')
  const today = new Date()
  return <div className="dashboard-content">
        <div className="welcome-row"><div><div className="eyebrow">FOUNDER WORKSPACE</div><h1>Workspace overview</h1><p>{savedLeads.length} leads · {pendingTasks.length} active tasks · {dashboardProjects.length} ongoing projects</p></div>
          <div className="date-card"><div className="date-icon"><CalendarDays size={17}/></div><div><span>TODAY · MANILA</span><b>{today.toLocaleDateString('en-US', { weekday: 'long' })}</b><small>{today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</small></div></div>
        </div>
        <section className="metrics-card">
          <Metric icon={Users} label="Total Leads" value={String(savedLeads.length)} detail="All active inquiries" tone="orange" />
          <Metric icon={Layers3} label="Active Projects" value={String(dashboardProjects.filter(project => project.status !== 'Completed' && project.status !== 'Cancelled').length)} detail="Planned or in delivery" tone="blue" />
          <Metric icon={ClipboardList} label="Pending Tasks" value={String(pendingTasks.length)} detail={`${pendingTasks.filter(task => task.overdue).length} overdue`} tone="purple" />
          <Metric icon={Activity} label="Conversion Rate" value={`${savedLeads.length ? Math.round((wonCount / savedLeads.length) * 100) : 0}%`} detail={`${wonCount} won from ${savedLeads.length} total leads`} tone="green" />
        </section>
        <div className="dashboard-grid top-grid"><PerformanceCard range={performanceRange} onRangeChange={setPerformanceRange} leads={savedLeads}/><SourcesCard range={sourcesRange} onRangeChange={setSourcesRange} leads={savedLeads}/><ActivityCard/></div>
        <div className="dashboard-grid bottom-grid"><LeadsCard leads={savedLeads} onOpenLead={onOpenLead}/><TasksCard tasks={savedTasks}/><ProjectsCard projects={dashboardProjects}/></div>
        <footer className="page-footer"><span>STRATAFORGE CRM <i>•</i> FOUNDER WORKSPACE</span><span>All data is up to date <b>·</b> Last synced just now</span></footer>
      </div>
}
