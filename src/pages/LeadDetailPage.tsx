import { ArrowLeft, CalendarDays, Check, CircleDollarSign, Mail, Phone, Tag, Users } from 'lucide-react'
import type { LeadDirectoryRow } from './LeadsPage'

const leadStages = ['New Leads', 'Contacted', 'Discovery', 'Proposal sent', 'Awaiting deposit', 'Won']

export default function LeadDetailPage({ lead, onBack }: { lead: LeadDirectoryRow; onBack: () => void }) {
  const activeStage = leadStages.indexOf(lead.status)
  const isLost = lead.status === 'Lost'
  return <div className="directory-page task-detail-page lead-detail-page">
    <button className="task-detail-back" onClick={onBack}><ArrowLeft size={15}/> Back to leads</button>
    <header className="task-detail-heading">
      <div><span className="directory-eyebrow">SALES WORKSPACE / LEADS</span><h1>{lead.name}</h1><p>{lead.client}</p></div>
      <span className={`record-status ${lead.status.toLowerCase().replace(/ /g, '-')}`}>{lead.status}</span>
    </header>

    <div className="task-detail-grid">
      <div className="task-detail-main">
        <section className="task-detail-card">
          <div className="task-detail-card-heading"><span className="task-detail-icon orange"><Users size={17}/></span><div><h2>Lead overview</h2><p>Contact and inquiry details</p></div></div>
          <div className="task-detail-properties">
            <div><span className="task-detail-property-icon blue"><Mail size={16}/></span><div><small>Email</small><b>{lead.email}</b></div></div>
            <div><span className="task-detail-property-icon green"><Phone size={16}/></span><div><small>Phone</small><b>{lead.phone}</b></div></div>
            <div><span className="task-detail-property-icon purple"><Tag size={16}/></span><div><small>Source</small><b>{lead.source}</b></div></div>
            <div><span className="task-detail-property-icon orange"><CircleDollarSign size={16}/></span><div><small>Budget</small><b>{lead.budget}</b></div></div>
            <div><span className="task-detail-property-icon blue"><Check size={16}/></span><div><small>Project type</small><b>{lead.type}</b></div></div>
            <div><span className="task-detail-property-icon green"><CalendarDays size={16}/></span><div><small>Inquiry date</small><b>{lead.date}</b></div></div>
          </div>
        </section>

        <section className="task-detail-card task-progress-card" aria-label={isLost ? 'Lead status: Lost' : `Lead progress: stage ${activeStage + 1} of ${leadStages.length}`}>
          <div className="task-detail-card-heading"><span className="task-detail-icon blue"><Check size={17}/></span><div><h2>Lead progress</h2><p>{isLost ? 'This lead is marked lost' : `Stage ${activeStage + 1} of ${leadStages.length} · ${lead.status}`}</p></div></div>
          {!isLost && <div className="task-progress-steps lead-progress-steps">{leadStages.map((stage, index) => <div className={`task-progress-step ${index < activeStage ? 'complete' : ''} ${index === activeStage ? 'current' : ''}`} key={stage} aria-current={index === activeStage ? 'step' : undefined}><span>{index < activeStage ? <Check size={15}/> : index + 1}</span><b>{stage}</b></div>)}</div>}
        </section>
      </div>

      <aside className="task-detail-side">
        <section className="task-detail-card lead-contact-card">
          <div className="task-detail-card-heading"><span className={`directory-avatar ${lead.tone}`}>{lead.initials}</span><div><h2>{lead.client}</h2><p>Lead contact</p></div></div>
          <div className="lead-contact-note">This inquiry is tracked in the {lead.status} stage.</div>
        </section>
      </aside>
    </div>
  </div>
}
