import { useState } from 'react'
import { Activity, ArrowRight, Bell, BriefcaseBusiness, CalendarDays, ChevronLeft, ClipboardList, FolderKanban, LayoutDashboard, Menu, Plus, Search, Settings, ShieldCheck, Users, X } from 'lucide-react'

const navigation = [
  { title: 'WORKSPACE', items: [
    { label: 'Dashboard', icon: LayoutDashboard }, { label: 'Tasks / Deals', icon: ClipboardList },
    { label: 'Project tasks', icon: BriefcaseBusiness }, { label: 'Leads', icon: Users, badge: '5' },
    { label: 'Clients', icon: Users }, { label: 'Projects', icon: FolderKanban },
    { label: 'Calendar', icon: CalendarDays }, { label: 'Reports', icon: Activity },
  ]},
  { title: 'ADMIN', items: [{ label: 'Access', icon: Users }, { label: 'Audit history', icon: Activity }] },
  { title: 'ACCOUNT', items: [{ label: 'Settings', icon: Settings }, { label: 'Security', icon: ShieldCheck }] },
]

function Brand() {
  return <div className="brand">
    <div className="brand-mark"><img src="/strataforge-mark.png" alt="" aria-hidden="true" /></div>
    <div className="brand-name">STRATAFORGE</div><div className="brand-sub">SOFTWARE SOLUTIONS</div>
  </div>
}

export function Sidebar({ collapsed, onToggle, active, onNavigate }: { collapsed: boolean; onToggle: () => void; active: string; onNavigate: (page: string) => void }) {
  return <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
    <Brand />
    <div className="nav-groups">
      {navigation.map((group) => <section className="nav-group" key={group.title}>
        <div className="nav-label">{group.title}</div>
        {group.items.map(({ label, icon: Icon, badge }) => <button
          className={`nav-item ${active === label ? 'active' : ''}`} key={label}
          onClick={() => onNavigate(label)} title={label}>
          <Icon size={14} strokeWidth={1.8} /><span>{label}</span>{badge && <b className="nav-badge">{badge}</b>}
        </button>)}
      </section>)}
    </div>
    <div className="sidebar-footer"><span className="online-dot" /> <span>StrataForge CRM V1</span></div>
  </aside>
}

export function Topbar({ onAdd, onToggle, collapsed }: { onAdd: () => void; onToggle: () => void; collapsed: boolean }) {
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState(false)
  return <header className="topbar">
    <div className="topbar-left">
      <button className="collapse-float" onClick={onToggle} aria-label="Toggle sidebar">
        {collapsed ? <Menu size={15} /> : <ChevronLeft size={15} />}
      </button>
      <span className="mobile-brand">SF</span>
    </div>
    <form className="search-box" onSubmit={(event) => event.preventDefault()}>
      <Search size={15} className="search-icon" />
      <input aria-label="Search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search leads, clients, projects..." />
      <button type="submit">Search</button>
    </form>
    <div className="top-actions">
      <button className="add-button" onClick={onAdd}><Plus size={14} /> <span>Add New</span></button>
      <button className={`icon-button notification ${notice ? 'noticed' : ''}`} onClick={() => setNotice(!notice)} aria-label="Notifications"><Bell size={16} /><i /></button>
      <button className="avatar" title="Ber">B</button>
    </div>
  </header>
}


export function AddNewModal({ onClose }: { onClose: () => void }) {
  const [choice, setChoice] = useState('Lead')
  return <div className="modal-backdrop quick-create-backdrop" onClick={onClose}><div className="modal" onClick={e => e.stopPropagation()}>
    <div className="modal-head"><div><span className="eyebrow">QUICK CREATE</span><h2>Add something new</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={17}/></button></div>
    <p>Choose what you’d like to add to your workspace.</p>
    <div className="create-options">{[['Lead', Users], ['Task', ClipboardList], ['Project', FolderKanban], ['Client', BriefcaseBusiness]].map(([label, Icon]) => {
      const Label = label as string; const Glyph = Icon as typeof Users
      return <button key={Label} className={choice === Label ? 'selected' : ''} onClick={() => setChoice(Label)}><Glyph size={17}/><span>{Label}</span><ArrowRight size={14}/></button>
    })}</div>
    <button className="modal-submit" onClick={onClose}>Continue with {choice}<ArrowRight size={15}/></button>
  </div></div>
}


