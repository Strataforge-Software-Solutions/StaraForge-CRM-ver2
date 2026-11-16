import { useEffect, useRef, useState } from 'react'
import { Activity, ArrowRight, Bell, BriefcaseBusiness, CalendarDays, ChevronLeft, ClipboardList, Coffee, FolderKanban, LayoutDashboard, LogOut, Menu, Plus, Search, Settings, ShieldCheck, Users, X, ImagePlus } from 'lucide-react'
import { useState as useFormState } from 'react'
import { CustomSelect } from './CustomControls'
import { prepareProfilePhoto } from '../lib/profilePhoto'

export type GlobalSearchItem = { kind: 'Lead' | 'Client' | 'Project' | 'Task' | 'Page'; title: string; subtitle: string; page: string; key: string }
export type CreateRecordType = 'Lead' | 'Client' | 'Project' | 'Task'
export type WorkspaceNotification = { id: string; title: string; detail: string; page: string; date: string }

const navigation = [
  { title: 'WORKSPACE', items: [
    { label: 'Dashboard', icon: LayoutDashboard }, { label: 'Lead Pipeline', page: 'Tasks / Deals', icon: ClipboardList },
    { label: 'Project tasks', icon: BriefcaseBusiness }, { label: 'Leads', icon: Users, badge: undefined },
    { label: 'Clients', icon: Users }, { label: 'Projects', icon: FolderKanban },
    { label: 'Calendar', icon: CalendarDays }, { label: 'Reports', icon: Activity },
  ]},
  { title: 'ADMIN', items: [{ label: 'Access', icon: Users }, { label: 'Audit history', icon: Activity }] },
  { title: 'ACCOUNT', items: [{ label: 'Settings', icon: Settings }, { label: 'Security', icon: ShieldCheck }] },
]

function Brand({ onClick }: { onClick: () => void }) {
  return <button type="button" className="brand" onClick={onClick} aria-label="Go to dashboard" title="Go to dashboard">
    <div className="brand-mark"><img src="/strataforge-mark.png" alt="" aria-hidden="true" /></div>
    <div className="brand-name">STRATAFORGE</div><div className="brand-sub">SOFTWARE SOLUTIONS</div>
  </button>
}

export function Sidebar({ collapsed, onToggle, active, onNavigate, onLogout }: { collapsed: boolean; onToggle: () => void; active: string; onNavigate: (page: string) => void; onLogout: () => void }) {
  const [hoveredNav, setHoveredNav] = useState<{ label: string; left: number; top: number } | null>(null)
  const showNavTooltip = (button: HTMLButtonElement, label: string) => {
    if (!collapsed) return
    const rect = button.getBoundingClientRect()
    setHoveredNav({ label, left: rect.right + 9, top: rect.top + rect.height / 2 })
  }
  return <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
    <Brand onClick={() => onNavigate('Dashboard')} />
    <div className="nav-groups">
      {navigation.map((group) => <section className="nav-group" key={group.title}>
        <div className="nav-label">{group.title}</div>
        {group.items.map(({ label, page, icon: Icon, badge }) => <button
          className={`nav-item ${active === (page ?? label) ? 'active' : ''}`} key={label}
          onClick={() => onNavigate(page ?? label)} onMouseEnter={event => showNavTooltip(event.currentTarget, label)} onMouseLeave={() => setHoveredNav(null)} onFocus={event => showNavTooltip(event.currentTarget, label)} onBlur={() => setHoveredNav(null)} aria-label={label}>
          <Icon size={14} strokeWidth={1.8} /><span>{label}</span>{badge && <b className="nav-badge">{badge}</b>}
        </button>)}
      </section>)}
    </div>
    {collapsed && hoveredNav && <div className="sidebar-floating-tooltip" role="tooltip" style={{ left: hoveredNav.left, top: hoveredNav.top }}>{hoveredNav.label}</div>}
    <button type="button" className="sidebar-logout" onClick={onLogout} title="Log out" aria-label="Log out"><LogOut size={14} strokeWidth={1.8}/><span>Log out</span></button>
    <div className="sidebar-footer"><span className="online-dot" /> <span>StrataForge CRM V1</span></div>
  </aside>
}

export function Topbar({ onAdd, onToggle, collapsed, searchItems, onSearchSelect, onNavigate, onTimeout, onLogout, accountName, accountEmail, profilePhotoUrl, notifications, readNotificationIds, onMarkNotificationsRead, showAdd = true }: { onAdd: (type?: CreateRecordType) => void; onToggle: () => void; collapsed: boolean; searchItems: GlobalSearchItem[]; onSearchSelect: (item: GlobalSearchItem) => void; onNavigate: (page: string) => void; onTimeout: () => void; onLogout: () => void; accountName: string; accountEmail: string; profilePhotoUrl: string | null; notifications: WorkspaceNotification[]; readNotificationIds: string[]; onMarkNotificationsRead: (ids: string[]) => void; showAdd?: boolean }) {
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState(false)
  const [open, setOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [photoFailed, setPhotoFailed] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const searchRef = useRef<HTMLFormElement>(null)
  const accountMenuRef = useRef<HTMLDivElement>(null)
  const notificationRef = useRef<HTMLDivElement>(null)
  const filtered = query.trim() ? searchItems.filter(item => `${item.title} ${item.subtitle} ${item.kind}`.toLowerCase().includes(query.trim().toLowerCase())) : []
  const defaultPages = searchItems.filter(item => item.kind === 'Page').slice(0, 6)
  const groups = query.trim()
    ? (['Lead', 'Client', 'Project', 'Task', 'Page'] as const).map(kind => ({ kind, items: filtered.filter(item => item.kind === kind).slice(0, 5) })).filter(group => group.items.length)
    : defaultPages.length ? [{ kind: 'Page' as const, items: defaultPages }] : []
  const results = groups.flatMap(group => group.items)
  const accountInitial = accountName.trim().charAt(0).toUpperCase() || '?'
  const showPhoto = Boolean(profilePhotoUrl && !photoFailed)
  const unreadNotificationIds = notifications.filter(item => !readNotificationIds.includes(item.id)).map(item => item.id)
  useEffect(() => { setPhotoFailed(false) }, [profilePhotoUrl])
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) setOpen(false)
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountOpen(false)
      if (!notificationRef.current?.contains(event.target as Node)) setNotice(false)
    }
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') { setAccountOpen(false); setNotice(false) } }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKeyDown) }
  }, [])
  const choose = (item: GlobalSearchItem) => { onSearchSelect(item); setQuery(''); setOpen(false); setActiveIndex(0) }
  return <header className="topbar">
    <div className="topbar-left">
      <button className="collapse-float" onClick={onToggle} aria-label="Toggle sidebar">
        {collapsed ? <Menu size={15} /> : <ChevronLeft size={15} />}
      </button>
      <span className="mobile-brand">SF</span>
    </div>
    <form ref={searchRef} className={`search-box ${open ? 'search-open' : ''}`} onSubmit={(event) => { event.preventDefault(); if (results[activeIndex]) choose(results[activeIndex]) }} onKeyDown={event => {
      if (event.key === 'ArrowDown' && results.length) { event.preventDefault(); setActiveIndex(index => (index + 1) % results.length); setOpen(true) }
      if (event.key === 'ArrowUp' && results.length) { event.preventDefault(); setActiveIndex(index => (index - 1 + results.length) % results.length); setOpen(true) }
      if (event.key === 'Escape') setOpen(false)
    }}>
      <Search size={15} className="search-icon" />
      <input aria-label="Search workspace" aria-expanded={open} aria-controls="global-search-results" role="combobox" autoComplete="off" value={query} onFocus={() => setOpen(true)} onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); setOpen(true) }} placeholder="Search leads, clients, projects..." />
      <button type="submit">Search</button>
      {open && <div className="global-search-results" id="global-search-results" role={query.trim() ? 'listbox' : undefined} aria-label={query.trim() ? 'Workspace search results' : 'Search shortcuts'}>
        {!query.trim() && <section className="global-search-group search-quick-actions">
          <h3>Quick actions</h3>
          <div className="search-quick-action-list">
            {(['Lead', 'Client', 'Project'] as const).map(type => <button type="button" className="search-quick-action" key={type} onClick={() => { setOpen(false); setQuery(''); onAdd(type) }}>
              <span className="global-search-result-icon"><Plus size={14}/></span><span>{type === 'Project' ? 'New project' : `Add ${type.toLowerCase()}`}</span>
            </button>)}
          </div>
        </section>}
        {groups.length ? groups.map(group => <section className="global-search-group" key={group.kind}>
          <h3>{query.trim() ? (group.kind === 'Page' ? 'Pages' : `${group.kind}s`) : 'Go to page'}</h3>
          {group.items.map(item => {
            const index = results.indexOf(item)
            return <button type="button" role={query.trim() ? 'option' : undefined} aria-selected={query.trim() ? activeIndex === index : undefined} className={`global-search-result ${query.trim() && activeIndex === index ? 'active' : ''}`} key={`${item.kind}-${item.key}`} onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(item)}>
              <span className="global-search-result-icon">{item.kind === 'Page' ? <LayoutDashboard size={14}/> : item.kind === 'Task' ? <ClipboardList size={14}/> : item.kind === 'Project' ? <FolderKanban size={14}/> : <Users size={14}/>}</span>
              <span className="global-search-copy"><b>{item.title}</b><small>{item.subtitle}</small></span><span className="global-search-kind">{item.kind}</span>
            </button>
          })}
        </section>) : query.trim() ? <div className="global-search-empty">No matches found for “{query.trim()}”.</div> : null}
        {query.trim() && <div className="global-search-footer"><span>Search workspace</span><span>↑↓ Navigate</span><span>↵ Open</span><span>Esc Close</span></div>}
      </div>}
    </form>
    <div className="top-actions">
      {showAdd && <button className="add-button" onClick={() => onAdd()}><Plus size={14} /> <span>Add New</span></button>}
      <div className="notification-anchor" ref={notificationRef}>
        <button type="button" className={`icon-button notification ${notice ? 'noticed' : ''}`} onClick={() => setNotice(value => !value)} aria-label={`Notifications${unreadNotificationIds.length ? `, ${unreadNotificationIds.length} unread` : ''}`} aria-expanded={notice} aria-controls="workspace-notifications"><Bell size={16} />{unreadNotificationIds.length > 0 && <span className="notification-count">{unreadNotificationIds.length > 9 ? '9+' : unreadNotificationIds.length}</span>}</button>
        {notice && <section className="notification-panel" id="workspace-notifications" aria-label="Notifications">
          <header><div><b>Notifications</b><small>{unreadNotificationIds.length ? `${unreadNotificationIds.length} unread` : 'Your workspace updates'}</small></div><button type="button" onClick={() => onMarkNotificationsRead(unreadNotificationIds)} disabled={!unreadNotificationIds.length}>Mark all read</button></header>
          {notifications.length ? <ul>{notifications.map(item => {
            const unread = !readNotificationIds.includes(item.id)
            return <li key={item.id}><button type="button" className={unread ? 'unread' : ''} onClick={() => { if (unread) onMarkNotificationsRead([item.id]); setNotice(false); onNavigate(item.page) }}><span className="notification-item-dot" aria-hidden="true"/><span><b>{item.title}</b><small>{item.detail}</small><time>{item.date}</time></span></button></li>
          })}</ul> : <div className="notification-empty"><Bell size={18}/><b>You’re all caught up</b><span>New leads and task reminders will appear here.</span></div>}
          <footer>Updates from your workspace</footer>
        </section>}
      </div>
      <div className="account-menu-anchor" ref={accountMenuRef}>
        <button className={`avatar account-avatar ${showPhoto ? 'has-photo' : ''} ${accountOpen ? 'open' : ''}`} title={`Account menu for ${accountName}`} aria-label={`Open account menu for ${accountName}`} aria-haspopup="menu" aria-expanded={accountOpen} onClick={() => setAccountOpen(value => !value)}>{showPhoto ? <img src={profilePhotoUrl ?? ''} alt="" onError={() => setPhotoFailed(true)}/> : <span>{accountInitial}</span>}</button>
        {accountOpen && <div className="account-menu" role="menu" aria-label="Account menu">
          <div className="account-menu-person"><span className="account-menu-avatar">{showPhoto ? <img src={profilePhotoUrl ?? ''} alt="" onError={() => setPhotoFailed(true)}/> : accountInitial}</span><span><b>{accountName}</b><small>{accountEmail || 'Supabase authenticated'}</small></span></div>
          <button role="menuitem" onClick={() => { setAccountOpen(false); onTimeout() }}><Coffee size={15}/>Take a break</button>
          <button role="menuitem" onClick={() => { setAccountOpen(false); onNavigate('Settings') }}><Settings size={15}/>Account settings</button>
          <div className="account-menu-divider" />
          <button className="account-menu-logout" role="menuitem" onClick={() => { setAccountOpen(false); onLogout() }}><LogOut size={15}/>Log out</button>
        </div>}
      </div>
    </div>
  </header>
}


export function AddNewModal({ onClose, initialChoice, clients = [], projects = [], onCreate }: { onClose: () => void; initialChoice?: CreateRecordType | null; clients?: string[]; projects?: string[]; onCreate?: (type: CreateRecordType, values: Record<string, string>) => Promise<void> }) {
  const [choice, setChoice] = useFormState<CreateRecordType>(initialChoice ?? 'Lead')
  const [step, setStep] = useFormState<'choose' | 'form'>(initialChoice ? 'form' : 'choose')
  const [client, setClient] = useFormState('')
  const [saved, setSaved] = useFormState(false)
  const [saveError, setSaveError] = useFormState('')
  const [leadPhoto, setLeadPhoto] = useFormState('')
  const [leadPhotoPreparing, setLeadPhotoPreparing] = useFormState(false)
  const [leadForm, setLeadForm] = useFormState({ company: '', contact: '', email: '', phone: '', location: '', notes: '', source: '', projectType: 'Website', timeline: '', followUpDate: '', budgetFrom: '', budgetTo: '', currency: 'PHP' })
  const [clientForm, setClientForm] = useFormState({ name: '', contact: '', role: '', email: '', phone: '', website: '', notes: '', type: 'Organization', status: 'Active' })
  const [projectForm, setProjectForm] = useFormState({ name: '', start: '', target: '', scope: '' })
  const [taskName, setTaskName] = useFormState('')
  const [taskProject, setTaskProject] = useFormState('')
  const showPicker = step === 'choose' || !(['Lead', 'Client', 'Project'] as string[]).includes(choice) && !initialChoice
  const field = (label: string, value: string, onChange: (value: string) => void, opts: { type?: string; placeholder?: string; wide?: boolean; required?: boolean } = {}) => <label className={`create-field ${opts.wide ? 'wide' : ''}`} key={label}>{label}<input required={opts.required} type={opts.type ?? 'text'} placeholder={opts.placeholder} value={value} onChange={event => onChange(event.target.value)} /></label>
  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaveError('')
    try {
      const values = choice === 'Lead' ? { ...leadForm, client, avatarUrl: leadPhoto } : choice === 'Client' ? clientForm : choice === 'Project' ? { ...projectForm, client } : { title: taskName, project: taskProject }
      await onCreate?.(choice, values as Record<string, string>)
      setSaved(true)
      window.setTimeout(onClose, 450)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save this record.')
    }
  }
  const chooseLeadPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setSaveError('')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setSaveError('Choose a JPG, PNG, or WebP profile photo.'); return }
    if (file.size < 1 || file.size > 5 * 1024 * 1024) { setSaveError('Choose a profile photo up to 5 MB.'); return }
    setLeadPhotoPreparing(true)
    try { setLeadPhoto(await prepareProfilePhoto(file)) }
    catch (error) { setSaveError(error instanceof Error ? error.message : 'Could not prepare this profile photo.') }
    finally { setLeadPhotoPreparing(false) }
  }
  const heading = choice === 'Lead' ? ['Add a website inquiry', 'Capture the request and primary contact.'] : choice === 'Client' ? ['Add a client', 'Enter client and primary contact details.'] : choice === 'Project' ? ['New project', 'Choose an existing client and approved work to set up a project.'] : ['Add a task', 'Create a task for your workspace.']
  return <div className="modal-backdrop quick-create-backdrop create-record-backdrop" onClick={onClose}><form className={`modal create-record-modal ${showPicker ? 'quick-create-picker' : ''}`} onClick={event => event.stopPropagation()} onSubmit={save}>
    <header className="create-record-head"><div><span className="directory-eyebrow">{showPicker ? 'QUICK CREATE' : 'STRATAFORGE WORKSPACE'}</span><h2>{showPicker ? 'Add something new' : heading[0]}</h2><p>{showPicker ? 'Choose what you’d like to add to your workspace.' : heading[1]}</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={17}/></button></header>
    {showPicker ? <div className="create-record-body"><div className="create-options">{([{ type: 'Lead', label: 'New lead', icon: Users }, { type: 'Client', label: 'New client', icon: BriefcaseBusiness }, { type: 'Project', label: 'New project', icon: FolderKanban }] as const).map(({ type, label, icon: Icon }) => <button type="button" key={type} className={choice === type ? 'selected' : ''} onClick={() => setChoice(type)}><Icon size={17}/><span>{label}</span><ArrowRight size={14}/></button>)}</div><button className="modal-submit" type="button" onClick={() => setStep('form')}>Continue with {choice === 'Lead' ? 'New lead' : choice === 'Client' ? 'New client' : 'New project'}<ArrowRight size={15}/></button></div> : <>
      <div className="create-record-body">
        {choice === 'Lead' && <><div className="create-section"><div className="create-section-heading"><b>Inquiry</b><span>Capture what the client wants to build and how to reach them.</span></div><div className="create-fields"><label className="create-field wide">Link to existing client <small>Optional</small><CustomSelect value={client || 'No existing client'} options={['No existing client', ...clients]} onChange={value => setClient(value === 'No existing client' ? '' : value)} ariaLabel="Link to existing client"/></label>{field('Company or client name *',leadForm.company,v=>setLeadForm({...leadForm,company:v}),{required:true})}{field('Primary contact *',leadForm.contact,v=>setLeadForm({...leadForm,contact:v}),{placeholder:'First and last name',required:true})}{field('Email address *',leadForm.email,v=>setLeadForm({...leadForm,email:v}),{type:'email',required:true})}{field('Phone',leadForm.phone,v=>setLeadForm({...leadForm,phone:v}),{type:'tel'})}{field('Location',leadForm.location,v=>setLeadForm({...leadForm,location:v}))}<label className="create-field wide">Notes *<textarea required value={leadForm.notes} onChange={event => setLeadForm({...leadForm,notes:event.target.value})}/></label></div></div><div className="create-section"><div className="create-section-heading"><b>Follow-up and budget</b><span>Leave these blank until the client has shared the details.</span></div><div className="create-fields"><label className="create-field">Source<CustomSelect value={leadForm.source || 'Select a source'} options={['Select a source','Referral','Unspecified','Inquiry Form','Social Media: Facebook']} onChange={value => setLeadForm({...leadForm,source:value === 'Select a source' ? '' : value})}/></label>{field('Project type',leadForm.projectType,v=>setLeadForm({...leadForm,projectType:v}))}{field('Timeline',leadForm.timeline,v=>setLeadForm({...leadForm,timeline:v}),{placeholder:'e.g. 1–2 months'})}{field('Next follow-up date',leadForm.followUpDate,v=>setLeadForm({...leadForm,followUpDate:v}),{type:'date'})}{field('Budget from',leadForm.budgetFrom,v=>setLeadForm({...leadForm,budgetFrom:v}),{type:'number'})}{field('Budget to',leadForm.budgetTo,v=>setLeadForm({...leadForm,budgetTo:v}),{type:'number'})}<label className="create-field">Budget currency<CustomSelect value={leadForm.currency} options={['PHP','USD']} onChange={value => setLeadForm({...leadForm,currency:value})}/></label></div></div><div className="create-upload lead-photo-upload">{leadPhoto ? <img className="lead-photo-upload-preview" src={leadPhoto} alt="Lead profile preview"/> : <ImagePlus size={18}/>}<div><b>Lead profile photo</b><span>{leadPhoto ? 'This image will appear as the lead’s avatar.' : 'JPG, PNG, or WebP · up to 5 MB'}</span></div><label className="create-upload-button">＋ Choose photo<input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose lead profile photo" onChange={event => void chooseLeadPhoto(event)}/></label></div></>}
        {choice === 'Client' && <div className="create-fields client-create-fields">{field('Client name *',clientForm.name,v=>setClientForm({...clientForm,name:v}),{required:true})}{field('Contact person',clientForm.contact,v=>setClientForm({...clientForm,contact:v}))}{field('Role / title',clientForm.role,v=>setClientForm({...clientForm,role:v}))}{field('Email',clientForm.email,v=>setClientForm({...clientForm,email:v}),{type:'email'})}{field('Phone',clientForm.phone,v=>setClientForm({...clientForm,phone:v}),{type:'tel'})}{field('Website',clientForm.website,v=>setClientForm({...clientForm,website:v}))}{field('Notes',clientForm.notes,v=>setClientForm({...clientForm,notes:v}))}<label className="create-field">Client type<CustomSelect value={clientForm.type} options={['Organization','Individual','Small business','Enterprise','Nonprofit','Government','Education','Other']} onChange={value=>setClientForm({...clientForm,type:value})}/></label><label className="create-field">Relationship status<CustomSelect value={clientForm.status} options={['Active','On hold','Inactive']} onChange={value=>setClientForm({...clientForm,status:value})}/></label><div className="create-upload wide"><ImagePlus size={18}/><div><b>Images</b><span>JPG, PNG, or WebP · up to 5 MB each</span></div><label className="create-upload-button">＋ Choose images<input type="file" accept="image/png,image/jpeg,image/webp" multiple/></label></div></div>}
        {choice === 'Project' && <div className="project-create-fields"><label className="create-field wide">Existing client *<CustomSelect value={client || 'Choose a client'} options={['Choose a client', ...clients]} onChange={value=>setClient(value==='Choose a client'?'':value)} ariaLabel="Existing client"/></label>{client && <><label className="create-field wide">Approved work<CustomSelect value="Select approved work" options={['Select approved work','Website','Web application','Software development']} ariaLabel="Approved work"/></label>{field('Project name *',projectForm.name,v=>setProjectForm({...projectForm,name:v}),{required:true})}{field('Start date',projectForm.start,v=>setProjectForm({...projectForm,start:v}),{type:'date'})}{field('Target date',projectForm.target,v=>setProjectForm({...projectForm,target:v}),{type:'date'})}{field('Accepted scope',projectForm.scope,v=>setProjectForm({...projectForm,scope:v}),{wide:true})}</>}</div>}
        {choice === 'Task' && <div className="create-fields">{field('Task name *',taskName,setTaskName,{wide:true,required:true})}<label className="create-field wide">Project *<CustomSelect ariaLabel="Project" value={taskProject || 'Choose a project'} options={['Choose a project', ...projects]} onChange={value => setTaskProject(value === 'Choose a project' ? '' : value)}/></label></div>}
        {saveError && <div className="create-error-message" role="alert">{saveError}</div>}
        {saved && <div className="create-saved-message" role="status">Saved to the workspace.</div>}
      </div>
      <footer className="create-record-footer"><button type="button" className="create-cancel" onClick={onClose}>Cancel</button>{choice !== 'Project' || client ? <button className="create-save" type="submit" disabled={leadPhotoPreparing || (choice === 'Task' && (!taskProject || projects.length === 0))}>{choice === 'Lead' ? leadPhotoPreparing ? 'Preparing photo…' : 'Save lead' : choice === 'Client' ? 'Save client' : choice === 'Project' ? 'Create project' : 'Save task'}</button> : null}</footer>
    </>}
  </form></div>
}


