import { useMemo, useState } from 'react'
import { Activity, ArrowDownToLine, BriefcaseBusiness, CalendarDays, CircleDollarSign, Users } from 'lucide-react'
import { CustomSelect } from '../components/CustomControls'
import { clientDirectory } from './ClientsPage'
import { leadDirectory } from './LeadsPage'
import { projectDirectory, type ProjectDirectoryRow } from './ProjectsPage'
import { projectTaskRows } from './ProjectTasksPage'
import { useDatabaseCollection } from '../lib/database'

type Props = { leadStatusOverrides: Record<string, string>; projectStatusOverrides: Record<string, string>; additionalProjects: ProjectDirectoryRow[] }
const stages = ['New Leads', 'Contacted', 'Discovery', 'Proposal sent', 'Awaiting deposit', 'Won', 'Lost']
const ranges = ['Last 7 days', 'Last 30 days', 'Last 90 days', 'This year']
const moneyParts = (budget: string) => {
  const match = budget.match(/^(PHP|USD)\s*([\d,.]+)/)
  return match ? { currency: match[1], amount: Number(match[2].replace(/,/g, '')) } : null
}

function ReportCard({ icon: Icon, title, action, children, className = '' }: { icon: typeof Users; title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <section className={`report-card ${className}`}><header className="report-card-head"><span className="report-card-icon"><Icon size={16}/></span><h2>{title}</h2>{action && <div className="report-card-action">{action}</div>}</header>{children}</section>
}

export default function ReportsPage({ leadStatusOverrides, projectStatusOverrides, additionalProjects }: Props) {
  const [range, setRange] = useState('Last 30 days')
  const [savedLeads] = useDatabaseCollection('leads', leadDirectory)
  const [clients] = useDatabaseCollection('clients', clientDirectory)
  const [tasks] = useDatabaseCollection('tasks', projectTaskRows)
  const [projectOverrides] = useDatabaseCollection<Record<string, Partial<ProjectDirectoryRow>>>('projectOverrides', {})
  const [deletedProjects] = useDatabaseCollection<string[]>('deletedProjects', [])
  const leads = useMemo(() => savedLeads.map(lead => ({ ...lead, status: leadStatusOverrides[lead.name] ?? lead.status })), [savedLeads, leadStatusOverrides])
  const projects = useMemo(() => [...projectDirectory.filter(project => !additionalProjects.some(extra => extra.name === project.name)), ...additionalProjects]
    .map(project => ({ ...project, ...projectOverrides[project.name], status: projectStatusOverrides[project.name] ?? projectOverrides[project.name]?.status ?? project.status }))
    .filter(project => !deletedProjects.includes(project.name)), [additionalProjects, deletedProjects, projectOverrides, projectStatusOverrides])
  const cutoffDays = range === 'Last 7 days' ? 7 : range === 'Last 90 days' ? 90 : range === 'This year' ? 365 : 30
  const anchor = new Date(2026, 10, 7)
  const periodLeads = leads.filter(lead => {
    const date = new Date(lead.date)
    return !Number.isNaN(date.getTime()) && (anchor.getTime() - date.getTime()) / 86400000 <= cutoffDays
  })
  const sourceCounts = periodLeads.reduce<Record<string, number>>((counts, lead) => { counts[lead.source] = (counts[lead.source] ?? 0) + 1; return counts }, {})
  const sourceEntries = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])
  const pipelineCounts = stages.map(stage => ({ stage, count: leads.filter(lead => lead.status === stage).length }))
  const openLeads = leads.filter(lead => !['Won', 'Lost'].includes(lead.status))
  const wonLeads = leads.filter(lead => lead.status === 'Won')
  const wonAmounts = wonLeads.reduce<Record<string, number>>((totals, lead) => { const part = moneyParts(lead.budget); if (part) totals[part.currency] = (totals[part.currency] ?? 0) + part.amount; return totals }, {})
  const maxStage = Math.max(1, ...pipelineCounts.map(item => item.count))
  const winRate = leads.length ? Math.round(wonLeads.length / leads.length * 100) : 0
  const periodLabel = range === 'This year' ? 'Jan 1 – Nov 7, 2026' : range === 'Last 7 days' ? 'Nov 1 – Nov 7, 2026' : range === 'Last 90 days' ? 'Aug 9 – Nov 7, 2026' : 'Oct 8 – Nov 7, 2026'
  const sourcePalette = ['#f45a22', '#3884f6', '#13b889', '#8a4cf6', '#e6a62d']
  let sourceOffset = 0
  const sourceGradient = sourceEntries.map(([source, count], index) => {
    const start = sourceOffset
    sourceOffset += periodLeads.length ? count / periodLeads.length * 100 : 0
    return `${sourcePalette[index % sourcePalette.length]} ${start}% ${sourceOffset}%`
  }).join(', ')
  const contactRows = clients.map(client => ({ name: client.contact, client: client.name, email: client.email, phone: client.phone }))
  const taskActivity = tasks.slice().sort((a, b) => new Date(b.due).getTime() - new Date(a.due).getTime()).slice(0, 5)

  const exportCsv = () => {
    const rows = [
      ['Report', 'Value'], ['Period', `${range} (${periodLabel})`], ['Leads acquired', String(periodLeads.length)], ['Open pipeline', String(openLeads.length)], ['Win rate', `${winRate}%`],
      ...stages.map(stage => [stage, String(pipelineCounts.find(item => item.stage === stage)?.count ?? 0)]),
      ['Lead sources', ''], ...Object.entries(sourceCounts).map(([source, count]) => [source, String(count)]),
      ['Client contacts', ''], ...contactRows.map(contact => [contact.client, `${contact.name}; ${contact.email}; ${contact.phone}`]),
    ]
    const csv = rows.map(row => row.map(value => `"${value.replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = `strataforge-report-${range.toLowerCase().replace(/\s+/g, '-')}.csv`; link.click(); URL.revokeObjectURL(url)
  }

  return <div className="reports-page">
    <header className="reports-heading"><div><span className="reports-eyebrow">WORKSPACE INSIGHTS</span><h1>Reports</h1><p>Review your pipeline, projects, and recorded payments.</p></div><div className="reports-heading-actions"><label className="reports-period"><CalendarDays size={17}/><span><small>Report period</small><CustomSelect ariaLabel="Report period" value={range} options={ranges} onChange={setRange}/></span></label><button className="reports-export" onClick={exportCsv}><ArrowDownToLine size={16}/>Export report</button></div></header>
    <section className="reports-metrics" aria-label="Report summary">
      <div className="report-metric"><div><span>Leads acquired</span><b>{periodLeads.length}</b><small>Created in selected period</small></div><span className="report-metric-icon orange"><Users size={20}/></span></div>
      <div className="report-metric"><div><span>Open pipeline</span><b>{openLeads.length} leads</b><small>Open opportunities across current stages</small></div><span className="report-metric-icon blue"><CircleDollarSign size={20}/></span></div>
      <div className="report-metric"><div><span>Win rate</span><b>{winRate}%</b><small>{wonLeads.length} won of {leads.length} leads</small></div><span className="report-metric-icon green"><Activity size={20}/></span></div>
      <div className="report-metric"><div><span>Won opportunity value</span><b>{Object.keys(wonAmounts).length ? Object.entries(wonAmounts).map(([currency, amount]) => `${currency} ${amount.toLocaleString('en-US')}`).join(' · ') : '—'}</b><small>Recorded from won lead budgets</small></div><span className="report-metric-icon purple"><BriefcaseBusiness size={20}/></span></div>
    </section>
    <div className="reports-grid">
      <ReportCard icon={Users} title="Lead sources" action={<span className="report-period-caption">{range}</span>}>
        {periodLeads.length ? <div className="reports-source-layout">
          <div className="reports-donut" role="img" aria-label={`${periodLeads.length} leads by source`} style={{ background: `conic-gradient(${sourceGradient})` }}><div className="reports-donut-center"><b>{periodLeads.length}</b><span>Total leads</span></div></div>
          <div className="reports-source-legend">{sourceEntries.map(([source, count], index) => <div className="reports-source-item" key={source}><span className="reports-source-name"><i style={{ background: sourcePalette[index % sourcePalette.length] }}/>{source}</span><b>{Math.round(count / periodLeads.length * 100)}%</b></div>)}</div>
        </div> : <p className="report-empty">No leads in this period.</p>}
      </ReportCard>
      <ReportCard icon={Activity} title="Pipeline by stage"><div className="report-chart-caption"><b>{leads.length}</b><span>total leads</span></div><div className="report-bars pipeline-bars">{pipelineCounts.map(({ stage, count }, index) => <div className="report-bar-row" key={stage}><span>{stage}</span><div className="report-bar-track"><i style={{ width: `${count ? Math.max(6, count / maxStage * 100) : 0}%`, background: ['#f45a22', '#4387f4', '#8a4cf6', '#14b88a', '#e4a629', '#13b889', '#9aa7b5'][index] }}/></div><b>{count}</b></div>)}</div></ReportCard>
      <ReportCard icon={CircleDollarSign} title="Cash received over time" className="report-cash-card" action={<span className="report-period-caption">{range}</span>}>
        <div className="cash-chart" role="img" aria-label="Cash received chart; no payment records available"><div className="cash-axis-labels"><span>PHP / USD</span><span>0</span></div><div className="cash-chart-area"><div className="cash-gridline"/><div className="cash-gridline"/><div className="cash-gridline"/><div className="cash-zero-line"/><span className="cash-no-data">No payment records yet</span></div><div className="cash-x-labels"><span>Oct 12</span><span>Oct 19</span><span>Oct 26</span><span>Nov 2</span><span>Nov 7</span></div></div><p className="report-note">Payment totals will appear here after receipts are recorded.</p>
      </ReportCard>
      <ReportCard icon={Users} title="Client contacts"><div className="report-contact-list">{contactRows.map((contact, index) => <div className="report-contact-row" key={`${contact.client}-${contact.name}`}><span className={`report-contact-avatar tone-${index % 4}`}>{contact.name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase()}</span><div><b>{contact.client}</b><small>{contact.name}</small></div><div className="report-contact-detail"><span>{contact.email}</span><small>{contact.phone}</small></div></div>)}</div></ReportCard>
      <ReportCard icon={BriefcaseBusiness} title="Recent project activity" className="report-activity-card">
        <div className="report-activity-list">
          {taskActivity.map((task, index) => {
            const project = projects.find(item => item.name === task.project)
            return <div className="report-activity-row" key={task.title}>
              <span className={`report-activity-dot activity-${index % 4}`}/>
              <div><b>{task.title}</b><small>{task.project}</small></div>
              <span className={`report-activity-status ${task.status.toLowerCase().replace(/\s/g, '-')}`}>{task.status}</span>
              <time>{task.due}</time>
              {project && <span className="report-project-status">{project.status}</span>}
            </div>
          })}
        </div>
        <p className="report-note">Showing current task and project status. Changes are not yet recorded as a timestamped audit feed.</p>
      </ReportCard>
    </div>
    <footer className="reports-footer"><span>StrataForge CRM · Workspace insights</span><span>Report period: {periodLabel}</span></footer>
  </div>
}
