import { useState } from 'react'
import { Activity, ArrowRight, CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Clock, Plus, X } from 'lucide-react'

type CalendarEvent = { id: number; date: string; time: string; title: string; detail: string; kind: 'Meeting' | 'Task' | 'Project' | 'Lead' }
const initialCalendarEvents: CalendarEvent[] = [
  { id: 1, date: '2026-11-02', time: '9:30 AM', title: 'Landing page review', detail: 'Company ABC Website', kind: 'Project' },
  { id: 2, date: '2026-11-04', time: '1:00 PM', title: 'Follow up with Jollibee2', detail: 'Lead follow-up', kind: 'Lead' },
  { id: 3, date: '2026-11-05', time: '10:00 AM', title: 'Client kickoff', detail: 'Jollibee POS System', kind: 'Meeting' },
  { id: 4, date: '2026-11-05', time: '2:00 PM', title: 'Update the UI', detail: 'Company ABC Website', kind: 'Task' },
  { id: 5, date: '2026-11-06', time: '11:00 AM', title: 'VioTrack progress check', detail: 'VioTrack Monitoring System Website', kind: 'Meeting' },
  { id: 6, date: '2026-11-09', time: '3:30 PM', title: 'Proposal follow-up', detail: 'Mr. Jose', kind: 'Lead' },
  { id: 7, date: '2026-11-12', time: '9:00 AM', title: 'QA checkout flow', detail: 'Jollibee POS System', kind: 'Task' },
  { id: 8, date: '2026-11-18', time: '1:30 PM', title: 'Website handoff', detail: 'VioTrack', kind: 'Project' },
  { id: 9, date: '2026-11-24', time: '10:30 AM', title: 'Discovery call', detail: 'New lead', kind: 'Meeting' },
]

const calendarDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const startOfCalendarWeek = (date: Date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  return start
}

export default function CalendarPage() {
  const [events, setEvents] = useState(initialCalendarEvents)
  const [month, setMonth] = useState(new Date(2026, 10, 1))
  const [selectedDate, setSelectedDate] = useState(new Date(2026, 10, 5))
  const [view, setView] = useState<'Month' | 'Week'>('Month')
  const [showCreate, setShowCreate] = useState(false)
  const [draft, setDraft] = useState({ title: '', date: '2026-11-05', time: '9:00 AM', detail: '', kind: 'Meeting' as CalendarEvent['kind'] })
  const [error, setError] = useState('')

  const monthLabel = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const rangeStart = view === 'Month' ? startOfCalendarWeek(new Date(month.getFullYear(), month.getMonth(), 1)) : startOfCalendarWeek(selectedDate)
  const rangeEnd = new Date(rangeStart)
  rangeEnd.setDate(rangeStart.getDate() + 6)
  const weekLabel = `${rangeStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${rangeEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  const monthEventCount = events.filter(event => event.date.startsWith(`${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`)).length
  const visibleDates = Array.from({ length: view === 'Month' ? 42 : 7 }, (_, index) => {
    const date = new Date(rangeStart)
    date.setDate(rangeStart.getDate() + index)
    return date
  })
  const selectedKey = calendarDateKey(selectedDate)
  const selectedEvents = events.filter(event => event.date === selectedKey).sort((a, b) => a.time.localeCompare(b.time))
  const changeMonth = (amount: number) => {
    setMonth(current => new Date(current.getFullYear(), current.getMonth() + amount, 1))
    setSelectedDate(current => {
      const nextMonth = new Date(current.getFullYear(), current.getMonth() + amount, 1)
      const lastDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate()
      return new Date(nextMonth.getFullYear(), nextMonth.getMonth(), Math.min(current.getDate(), lastDay))
    })
  }
  const changePeriod = (amount: number) => {
    if (view === 'Month') { changeMonth(amount); return }
    setSelectedDate(current => {
      const next = new Date(current)
      next.setDate(next.getDate() + amount * 7)
      setMonth(new Date(next.getFullYear(), next.getMonth(), 1))
      return next
    })
  }
  const openCreate = (date = selectedDate) => {
    setDraft({ title: '', date: calendarDateKey(date), time: '9:00 AM', detail: '', kind: 'Meeting' })
    setError('')
    setShowCreate(true)
  }
  const saveEvent = (event: React.FormEvent) => {
    event.preventDefault()
    if (!draft.title.trim() || !draft.date) { setError('Add an event title and date to continue.'); return }
    const item: CalendarEvent = { ...draft, id: Date.now(), title: draft.title.trim(), detail: draft.detail.trim() || draft.kind }
    setEvents(current => [...current, item])
    const date = new Date(`${draft.date}T12:00:00`)
    setSelectedDate(date)
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1))
    setShowCreate(false)
  }

  return <div className="directory-page calendar-page">
    <div className="directory-heading"><div><span className="directory-eyebrow">WORKSPACE</span><h1>Calendar</h1><p>Keep client meetings, project milestones, and tasks in view.</p></div><button className="directory-add" onClick={() => openCreate()}><CalendarPlus size={17}/>Add event</button></div>
    <section className="calendar-panel">
      <div className="calendar-toolbar"><div className="calendar-month-controls"><button className="calendar-icon-button" aria-label={view === 'Month' ? 'Previous month' : 'Previous week'} onClick={() => changePeriod(-1)}><ChevronLeft size={17}/></button><button className="calendar-icon-button" aria-label={view === 'Month' ? 'Next month' : 'Next week'} onClick={() => changePeriod(1)}><ChevronRight size={17}/></button><h2>{view === 'Month' ? monthLabel : weekLabel}</h2><button className="calendar-today" onClick={() => { const today = new Date(2026, 10, 6); setSelectedDate(today); setMonth(new Date(today.getFullYear(), today.getMonth(), 1)) }}>Today</button></div><span className="calendar-event-total">{monthEventCount} scheduled {monthEventCount === 1 ? 'event' : 'events'}</span><div className="calendar-view-toggle" aria-label="Calendar view">{(['Month', 'Week'] as const).map(option => <button key={option} className={view === option ? 'selected' : ''} onClick={() => setView(option)}>{option}</button>)}</div></div>
      <div className="calendar-layout"><div className={`calendar-grid ${view === 'Week' ? 'week-view' : ''}`} role="grid" aria-label={`${monthLabel} ${view.toLowerCase()} view`}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <div className="calendar-weekday" role="columnheader" key={day}>{day}</div>)}
        {visibleDates.map(date => {
          const key = calendarDateKey(date)
          const dayEvents = events.filter(event => event.date === key).slice(0, 3)
          const outsideMonth = view === 'Month' && date.getMonth() !== month.getMonth()
          return <button type="button" role="gridcell" key={key} className={`calendar-day ${outsideMonth ? 'outside' : ''} ${key === selectedKey ? 'selected' : ''}`} onClick={() => { setSelectedDate(date); if (outsideMonth) setMonth(new Date(date.getFullYear(), date.getMonth(), 1)) }} aria-label={`${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}, ${dayEvents.length} events`}>
            <span className="calendar-day-number">{date.getDate()}</span><span className="calendar-day-events">{dayEvents.map(event => <span key={event.id} className={`calendar-event-chip ${event.kind.toLowerCase()}`} title={`${event.time} · ${event.title}`}><i/>{event.title}</span>)}</span>
            {dayEvents.length === 3 && events.filter(event => event.date === key).length > 3 && <small className="calendar-more">+{events.filter(event => event.date === key).length - 3} more</small>}
          </button>
        })}
      </div>
      <aside className="calendar-agenda"><div className="calendar-agenda-heading"><div><span className="directory-eyebrow">AGENDA</span><h3>{selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h3></div><button className="calendar-icon-button" aria-label="Add event on selected day" onClick={() => openCreate(selectedDate)}><Plus size={17}/></button></div>
        {selectedEvents.length ? <div className="calendar-agenda-list">{selectedEvents.map(event => <article className="calendar-agenda-event" key={event.id}><span className={`calendar-event-mark ${event.kind.toLowerCase()}`}/><div><span className="calendar-agenda-time"><Clock size={13}/>{event.time}</span><h4>{event.title}</h4><p>{event.detail}</p><span className={`calendar-kind ${event.kind.toLowerCase()}`}>{event.kind}</span></div></article>)}</div> : <div className="calendar-empty"><span><CalendarDays size={19}/></span><b>No events scheduled</b><p>Keep this day open or add an event.</p><button onClick={() => openCreate(selectedDate)}>Add event</button></div>}
        <div className="calendar-legend"><span><i className="meeting"/>Meetings</span><span><i className="task"/>Tasks</span><span><i className="project"/>Projects</span><span><i className="lead"/>Leads</span></div>
      </aside></div>
    </section>
    {showCreate && <div className="modal-backdrop" onClick={() => setShowCreate(false)}><form className="modal calendar-create-modal" onSubmit={saveEvent} onClick={event => event.stopPropagation()}>
      <div className="modal-head"><div><span className="directory-eyebrow">CALENDAR</span><h2>Add event</h2></div><button className="icon-button" type="button" aria-label="Close" onClick={() => setShowCreate(false)}><X size={16}/></button></div>
      <p>Add a meeting, task, or milestone to your calendar.</p>
      <label className="field-label">Event title<input autoFocus required value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} placeholder="e.g. Client kickoff"/></label>
      <div className="field-pair"><label className="field-label">Date<input type="date" required value={draft.date} onChange={event => setDraft(current => ({ ...current, date: event.target.value }))}/></label><label className="field-label">Type<select value={draft.kind} onChange={event => setDraft(current => ({ ...current, kind: event.target.value as CalendarEvent['kind'] }))}><option>Meeting</option><option>Task</option><option>Project</option><option>Lead</option></select></label></div>
      <label className="field-label">Time<input value={draft.time} onChange={event => setDraft(current => ({ ...current, time: event.target.value }))} placeholder="9:00 AM"/></label>
      <label className="field-label">Related client or project<input value={draft.detail} onChange={event => setDraft(current => ({ ...current, detail: event.target.value }))} placeholder="Optional"/></label>
      {error && <p className="calendar-form-error" role="alert">{error}</p>}
      <button className="modal-submit" type="submit">Save event <ArrowRight size={15}/></button>
    </form></div>}
  </div>
}


