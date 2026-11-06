import { useState } from 'react'
import { Activity, ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronDown, ClipboardList, Layers3, Users } from 'lucide-react'

const leads = [
  { initials: 'JO', name: 'Jollibee2', type: 'Website', source: 'Unspecified', date: 'Nov 4, 2026', status: 'New Lead', color: 'blue' },
  { initials: 'MJ', name: 'Mr. Jose', type: 'Website', source: 'Referral', date: 'Nov 4, 2026', status: 'New Lead', color: 'tan' },
  { initials: 'J', name: 'Jollibee', type: 'Website', source: 'Referral', date: 'Nov 3, 2026', status: 'Won', color: 'brown' },
  { initials: 'V', name: 'VioTrack', type: 'Website', source: 'Social Media: Facebook', date: 'Nov 2, 2026', status: 'Won', color: 'gray' },
  { initials: 'C', name: 'Company ABC', type: 'Website', source: 'Inquiry Form', date: 'Oct 31, 2026', status: 'Won', color: 'brown' },
]

const activities = [
  { title: 'Company ABC: Updated task', time: 'Nov 4, 11:06 PM', icon: ClipboardList, tone: 'blue' },
  { title: 'Jollibee2: Lead updated', time: 'Nov 4, 10:58 PM', icon: Users, tone: 'orange' },
  { title: 'Mr. Jose: Lead updated', time: 'Nov 4, 10:52 PM', icon: Users, tone: 'orange' },
  { title: 'Mr. Jose: Lead updated', time: 'Nov 4, 10:51 PM', icon: Users, tone: 'orange' },
]

const tasks = [
  { title: 'center the div', date: 'Nov 2, 2026' }, { title: 'landing page', date: 'Nov 2, 2026', overdue: true },
  { title: 'Hello', date: 'Nov 3, 2026' }, { title: 'Update the UI', date: 'Nov 4, 2026' },
]

const projects = [
  { name: 'VioTrack Monitoring System Website', target: 'Dec 1, 2026', status: 'Completed', tone: 'green', icon: Layers3 },
  { name: 'Company ABC Website', target: 'Nov 5, 2026', status: 'In progress', tone: 'blue', icon: Layers3 },
  { name: 'Jollibee pos system', target: 'Dec 1, 2026', status: 'Planned', tone: 'orange', icon: Layers3 },
]

function Metric({ icon: Icon, label, value, detail, tone }: { icon: typeof Users; label: string; value: string; detail: string; tone: string }) {
  return <div className="metric"><div className={`metric-icon ${tone}`}><Icon size={16} /></div>
    <div><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-detail">{detail}</div></div>
  </div>
}

function CardTitle({ icon: Icon, title, action }: { icon: typeof Activity; title: string; action?: React.ReactNode }) {
  return <div className="card-title"><div className="title-icon"><Icon size={15} /></div><strong>{title}</strong>{action && <div className="card-action">{action}</div>}</div>
}

function RangeSelect() {
  const [range, setRange] = useState('Last 30 days')
  return <button className="range-select" onClick={() => setRange(range === 'Last 30 days' ? 'Last 7 days' : 'Last 30 days')}>{range}<ChevronDown size={12} /></button>
}

function LeadChart() {
  return <div className="chart-wrap">
    <div className="chart-y-labels"><span>5</span><span>4</span><span>3</span><span>2</span><span>0</span></div>
    <svg className="chart" viewBox="0 0 580 165" preserveAspectRatio="none" role="img" aria-label="Lead performance line chart">
      <defs><linearGradient id="blueFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#347cf2" stopOpacity=".16"/><stop offset="1" stopColor="#347cf2" stopOpacity="0"/></linearGradient></defs>
      {[22,52,82,112,142].map(y => <line key={y} x1="0" x2="580" y1={y} y2={y} stroke="#e9edf2" strokeDasharray="2 5" />)}
      <path d="M0 142 C75 142 95 142 145 142 S220 151 270 142 S333 119 375 94 S434 76 470 76 S530 78 580 82 L580 142 L0 142Z" fill="url(#blueFill)" />
      <path d="M0 142 C75 142 95 142 145 142 S220 151 270 142 S333 119 375 94 S434 76 470 76 S530 78 580 82" fill="none" stroke="#3880f5" strokeWidth="2.5" />
      <path d="M0 142 C140 142 205 142 270 142 S335 119 375 94 S438 65 470 54 S536 32 580 18" fill="none" stroke="#ff5a1f" strokeWidth="2.5" />
    </svg>
    <div className="chart-x-labels"><span>Oct 7</span><span>Oct 21</span><span>Nov 4</span></div>
  </div>
}

function PerformanceCard() {
  return <section className="card performance-card">
    <CardTitle icon={Activity} title="Lead Performance" action={<RangeSelect />} />
    <div className="chart-summary"><div><span className="muted">Total leads</span><b>5</b></div><span className="won-pill"><i />3 won</span></div>
    <LeadChart />
    <div className="chart-legend"><span><i className="orange-dot"/>Leads <b>5</b></span><span><i className="blue-dot"/>Won <b>3</b></span></div>
  </section>
}

function SourcesCard() {
  const sources = [{ label: 'Referral', n: 2, pct: 40, color: 'orange' }, { label: 'Unspecified', n: 1, pct: 20, color: 'blue' }, { label: 'Inquiry Form', n: 1, pct: 20, color: 'green' }, { label: 'Social Media: Facebook', n: 1, pct: 20, color: 'purple' }]
  return <section className="card sources-card">
    <CardTitle icon={Activity} title="Lead Sources" action={<RangeSelect />} />
    <div className="source-total"><span className="muted">Total leads</span><b>5</b></div>
    <div className="source-bars">{sources.map(source => <div className="source-row" key={source.label}>
      <span>{source.label}</span><div className="bar-track"><i className={source.color} style={{ width: `${source.pct}%` }} /></div><b>{source.n}</b><small>{source.pct}%</small>
    </div>)}</div>
    <div className="source-chips">{sources.map(s => <span key={s.label}><i className={s.color} />{s.label === 'Social Media: Facebook' ? 'Social Media: Facebook' : s.label}<b>{s.n}</b></span>)}</div>
    <div className="source-insight"><span><i className="orange-dot"/><b>Referral</b> is the leading source</span><strong>2 leads · 40%</strong></div>
  </section>
}

function ActivityCard() {
  return <section className="card activity-card">
    <CardTitle icon={Activity} title="Recent activity" action={<button className="text-link">View leads <ArrowUpRight size={13}/></button>} />
    <div className="activity-list">{activities.map((item, i) => <div className="activity-row" key={`${item.title}-${i}`}>
      <div className={`activity-icon ${item.tone}`}><item.icon size={14}/></div><div><div className="activity-name">{item.title}</div><div className="activity-time">{item.time}</div></div>
    </div>)}</div>
    <div className="activity-foot"><span>4 recent updates shown</span><span>Latest · Nov 4, 11:06 PM</span></div>
    <div className="activity-pagination"><span>1–4 of 4</span><span>Recent activity</span></div>
  </section>
}

function LeadsCard() {
  return <section className="card leads-card">
    <CardTitle icon={Users} title="Recent leads" action={<button className="text-link">View all <ArrowRight size={13}/></button>} />
    <div className="lead-table-wrap"><table><thead><tr><th>Name</th><th>Project type</th><th>Source</th><th>Date</th><th>Status</th></tr></thead>
      <tbody>{leads.map(lead => <tr key={lead.name}><td><span className={`lead-avatar ${lead.color}`}>{lead.initials}</span>{lead.name}</td><td>{lead.type}</td><td>{lead.source}</td><td>{lead.date}</td><td><span className={`status ${lead.status === 'Won' ? 'won' : ''}`}>{lead.status}</span></td></tr>)}</tbody>
    </table></div>
  </section>
}

function TasksCard() {
  const [done, setDone] = useState<string[]>([])
  return <section className="card tasks-card">
    <CardTitle icon={ClipboardList} title="Upcoming tasks" action={<button className="text-link">View all <ArrowRight size={13}/></button>} />
    <div className="task-list">{tasks.map(task => <button className={`task-row ${done.includes(task.title) ? 'complete' : ''}`} key={task.title} onClick={() => setDone(done.includes(task.title) ? done.filter(t => t !== task.title) : [...done, task.title])}>
      <span className="task-check">{done.includes(task.title) && <Check size={11}/>}</span><span className="task-copy"><span>{task.title}</span><small>{task.date}</small>{task.overdue && <em>Assign before completing →</em>}</span>
    </button>)}</div>
  </section>
}

function ProjectsCard() {
  return <section className="card projects-card">
    <CardTitle icon={Layers3} title="Project status" action={<button className="text-link">View all <ArrowRight size={13}/></button>} />
    <div className="project-list">{projects.map(({ name, target, status, tone, icon: Icon }) => <div className="project-row" key={name}>
      <div className={`project-icon ${tone}`}><Icon size={15}/></div><div className="project-copy"><span>{name}</span><small>Target {target}</small></div><span className={`project-status ${tone}`}>{status}</span>
    </div>)}</div>
  </section>
}


export default function DashboardPage() { return <div className="dashboard-content">
        <div className="welcome-row"><div><div className="eyebrow">FOUNDER WORKSPACE</div><h1>Good morning, Ber</h1><p>5 leads · 5 active tasks · 2 ongoing projects</p></div>
          <div className="date-card"><div className="date-icon"><CalendarDays size={17}/></div><div><span>TODAY · MANILA</span><b>Thursday</b><small>Nov 5, 2026</small></div></div>
        </div>
        <section className="metrics-card">
          <Metric icon={Users} label="Total Leads" value="5" detail="All active inquiries" tone="orange" />
          <Metric icon={Layers3} label="Active Projects" value="2" detail="Planned or in delivery" tone="blue" />
          <Metric icon={ClipboardList} label="Pending Tasks" value="5" detail="3 overdue" tone="purple" />
          <Metric icon={Activity} label="Conversion Rate" value="60%" detail="3 won from 5 total leads" tone="green" />
        </section>
        <div className="dashboard-grid top-grid"><PerformanceCard/><SourcesCard/><ActivityCard/></div>
        <div className="dashboard-grid bottom-grid"><LeadsCard/><TasksCard/><ProjectsCard/></div>
        <footer className="page-footer"><span>STRATAFORGE CRM <i>•</i> FOUNDER WORKSPACE</span><span>All data is up to date <b>·</b> Last synced just now</span></footer>
      </div> }
