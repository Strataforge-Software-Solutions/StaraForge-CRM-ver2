import { UserRound, ArrowRight, CalendarDays, Check, Save, MessageSquare } from 'lucide-react'
import { useState } from 'react'
import { CustomDatePicker } from './CustomControls'
import { updateDatabaseCollection, useDatabaseCollection } from '../lib/database'
import { recordId } from '../lib/records'
import type { LeadDirectoryRow } from '../pages/LeadsPage'
function FollowUpDateField({ initialValue }: { initialValue: string }) {
  const [date, setDate] = useState(initialValue)
  return <div className="next-date next-date-field">
    <span className="next-date-label"><CalendarDays size={14}/>Follow-up date</span>
    <CustomDatePicker value={date} onChange={setDate} ariaLabel="Follow-up date"/>
    <input type="hidden" name="followUpDate" value={date}/>
    {date && <button type="button" className="next-date-clear" onClick={() => setDate('')}>Clear date</button>}
  </div>
}

export default function LeadNextAction({ lead }: { lead: LeadDirectoryRow }) {
  const [leads] = useDatabaseCollection<LeadDirectoryRow[]>('leads', [])
  const current = leads.find(row => recordId(row) === recordId(lead)) || lead
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [saved, setSaved] = useState(false)
  return <section className="crm-panel next-action-panel"><header className="crm-section-header"><span className="crm-section-icon"><UserRound size={19}/></span><div><h3>Owner and next action</h3><p>Give this opportunity a clear owner and a next step.</p></div></header><form className="crm-form next-action-form" key={current.id} onSubmit={async event => { event.preventDefault(); const data = new FormData(event.currentTarget); setError(''); setBusy(true); setSaved(false); try { await updateDatabaseCollection<LeadDirectoryRow[]>('leads', [], rows => rows.map(row => recordId(row) === recordId(lead) ? { ...row, owner: String(data.get('owner')).trim(), nextAction: String(data.get('nextAction')).trim(), followUpDate: String(data.get('followUpDate')), lostReason: String(data.get('lostReason')).trim() } : row)); setSaved(true) } catch (cause) { setError((cause as Error).message) } finally { setBusy(false) } }}><label className="next-owner"><span><UserRound size={14}/>Responsible person</span><input name="owner" defaultValue={current.owner} placeholder="Team member name"/></label><label className="next-step"><span><ArrowRight size={14}/>Next action</span><input name="nextAction" defaultValue={current.nextAction} placeholder="What needs to happen next?"/></label><FollowUpDateField initialValue={current.followUpDate || ''}/><label className="next-context"><span><MessageSquare size={14}/>Lost reason / follow-up context <em>Optional</em></span><input name="lostReason" defaultValue={current.lostReason} placeholder="Add context for the next conversation"/></label><footer className="next-action-footer"><div aria-live="polite">{error ? <p role="alert" className="next-action-error">{error}</p> : saved ? <span className="next-action-saved"><Check size={15}/> Next action saved</span> : <span>Keep the next step up to date as the conversation progresses.</span>}</div><button className="next-action-save" disabled={busy}><Save size={15}/>{busy ? 'Saving…' : 'Save next action'}</button></footer></form></section>
}
