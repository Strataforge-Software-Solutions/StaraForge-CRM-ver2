import { useMemo, useState, type FormEvent } from 'react'
import { AlertCircle, ArrowRight, BriefcaseBusiness, CalendarDays, Check, CheckCircle2, CircleDollarSign, CreditCard, FileText, Plus, ReceiptText } from 'lucide-react'
import { CustomDatePicker, CustomSelect } from '../components/CustomControls'
import { useDatabaseCollection } from '../lib/database'
import { showWorkspaceToast } from '../lib/workspaceToast'
import type { LeadDirectoryRow } from './LeadsPage'
import type { ProjectDirectoryRow } from './ProjectsPage'

type Proposal = { id: number; name: string; amount: number; created: string; status: 'Draft' | 'Sent' | 'Accepted' }
type Acceptance = { proposalId: number; method: string; evidence: string; note: string; date: string }
type Deposit = { amount: number; date: string; note: string }
type LeadWorkflowData = { proposals: Proposal[]; selectedProposal: number | null; acceptance: Acceptance | null; deposits: Deposit[]; createdProject: boolean; projectName?: string; clientType?: string; startDate?: string; targetDate?: string }
const emptyWorkflow: LeadWorkflowData = { proposals: [], selectedProposal: null, acceptance: null, deposits: [], createdProject: false }
const emptyWorkflows: Record<string, LeadWorkflowData> = {}

function workflowKeyFor(lead: LeadDirectoryRow) {
  return lead.email.trim().toLowerCase() || `${lead.name.trim().toLowerCase()}::${lead.client.trim().toLowerCase()}`
}

export default function LeadConversionWorkflow({ lead, onConvert, onLeadStatusChange }: { lead: LeadDirectoryRow; onConvert: (project: ProjectDirectoryRow) => void; onLeadStatusChange: (status: string) => void }) {
  const [workflows, setWorkflows] = useDatabaseCollection<Record<string, LeadWorkflowData>>('leadWorkflows', emptyWorkflows)
  const workflowKey = workflowKeyFor(lead)
  const workflow = workflows[workflowKey] ?? emptyWorkflow
  const { proposals, selectedProposal, acceptance, deposits, createdProject } = workflow
  const updateWorkflow = (patch: Partial<LeadWorkflowData>) => setWorkflows(current => ({ ...current, [workflowKey]: { ...(current[workflowKey] ?? emptyWorkflow), ...patch } }))
  const [showProposalForm, setShowProposalForm] = useState(false)
  const [showAcceptanceForm, setShowAcceptanceForm] = useState(false)
  const [showDepositForm, setShowDepositForm] = useState(false)
  const [proposalName, setProposalName] = useState('')
  const [proposalAmount, setProposalAmount] = useState('')
  const [evidenceMethod, setEvidenceMethod] = useState('Approval message')
  const [evidence, setEvidence] = useState('')
  const [acceptanceNote, setAcceptanceNote] = useState('')
  const [depositAmount, setDepositAmount] = useState('')
  const [depositDate, setDepositDate] = useState('')
  const [depositNote, setDepositNote] = useState('')
  const projectName = workflow.projectName ?? `${lead.client} website`
  const clientType = workflow.clientType ?? 'Organization'
  const startDate = workflow.startDate ?? ''
  const targetDate = workflow.targetDate ?? ''
  const accepted = Boolean(acceptance)
  const deposited = deposits.reduce((total, item) => total + item.amount, 0)
  const currentProposal = acceptance ? proposals.find(item => item.id === acceptance.proposalId) ?? null : proposals.find(item => item.id === selectedProposal) ?? proposals[proposals.length - 1] ?? null
  const currency = lead.budget.match(/^(PHP|USD)/)?.[1] ?? 'PHP'
  const formatMoney = (amount: number) => `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const stageShowsProposalSent = lead.status === 'Proposal sent' && !proposals.some(item => item.status === 'Sent' || item.status === 'Accepted')
  const progress = createdProject ? 4 : deposited > 0 ? 3 : accepted ? 2 : proposals.some(item => item.status === 'Sent') || stageShowsProposalSent ? 1 : proposals.length ? 0 : -1
  const progressLabels = ['Draft', 'Sent', 'Accepted', 'Deposit recorded']
  const progressDescription = progress < 0 ? 'No proposal has been created yet.' : `${progressLabels[Math.min(progress, 3)]} · ${currentProposal?.name ?? 'Proposal'}`
  const versions = useMemo(() => [...proposals].sort((a, b) => b.id - a.id), [proposals])

  const createProposal = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const amount = Number(proposalAmount)
    if (!proposalName.trim() || !Number.isFinite(amount) || amount <= 0) return
    const proposal = { id: Date.now(), name: proposalName.trim(), amount, created: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), status: 'Draft' as const }
    updateWorkflow({ proposals: [...proposals, proposal], selectedProposal: proposal.id })
    setProposalName('')
    setProposalAmount('')
    setShowProposalForm(false)
    if (lead.status !== 'Proposal sent' && !proposals.some(item => item.status === 'Sent' || item.status === 'Accepted')) onLeadStatusChange('Discovery')
    showWorkspaceToast('Proposal draft created.')
  }

  const sendProposal = (proposal: Proposal) => {
    updateWorkflow({ proposals: proposals.map(item => item.id === proposal.id ? { ...item, status: 'Sent' } : item), selectedProposal: proposal.id })
    onLeadStatusChange('Proposal sent')
    showWorkspaceToast('Proposal marked as sent.')
  }

  const recordAcceptance = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!currentProposal || !evidence.trim() || !acceptanceNote.trim()) return
    const nextAcceptance = { proposalId: currentProposal.id, method: evidenceMethod, evidence: evidence.trim(), note: acceptanceNote.trim(), date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
    updateWorkflow({ acceptance: nextAcceptance, proposals: proposals.map(item => item.id === currentProposal.id ? { ...item, status: 'Accepted' } : item) })
    onLeadStatusChange('Awaiting deposit')
    setShowAcceptanceForm(false)
    showWorkspaceToast('Client acceptance recorded.')
  }

  const recordDeposit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const amount = Number(depositAmount)
    if (!accepted || !Number.isFinite(amount) || amount <= 0 || !depositDate) return
    updateWorkflow({ deposits: [...deposits, { amount, date: depositDate, note: depositNote.trim() }] })
    onLeadStatusChange('Won')
    setDepositAmount('')
    setDepositNote('')
    setShowDepositForm(false)
    showWorkspaceToast('Deposit record saved.')
  }

  const createProject = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!accepted || deposited <= 0 || !projectName.trim()) return
    const initials = lead.client.trim().split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase()
    const project: ProjectDirectoryRow = {
      name: projectName.trim(), client: lead.client, initials, type: lead.type,
      start: startDate ? new Date(`${startDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set',
      target: targetDate ? new Date(`${targetDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set',
      value: formatMoney(currentProposal?.amount ?? 0),
      status: 'Planned', tone: lead.tone,
    }
    updateWorkflow({ createdProject: true })
    showWorkspaceToast('Project setup is complete.')
    onConvert(project)
  }

  return <div className="lead-conversion-workflow">
    <div className={`lead-workflow-grid ${accepted ? 'has-payment-step' : 'proposal-only'}`}>
      <section className="task-detail-card proposal-progress-panel">
        <div className="workflow-step-heading"><div><span className="workflow-step-kicker">STEP 1: PROPOSAL</span><h2>Proposal progress</h2></div><span className={`workflow-state ${progress >= 3 ? 'complete' : ''}`}>{progress >= 3 ? 'Deposit recorded' : progress >= 2 ? 'Accepted' : progress >= 1 ? 'Sent' : proposals.length ? 'Draft' : 'Not started'}</span></div>
        <div className="proposal-stage-track" aria-label="Proposal workflow">
          {progressLabels.map((label, index) => <div className={`proposal-stage ${index < progress ? 'complete' : ''} ${index === progress ? 'current' : ''}`} key={label}><span>{index < progress ? <Check size={13}/> : index + 1}</span><b>{label}</b></div>)}
        </div>
      </section>

      <section className="task-detail-card proposal-versions-panel">
        <div className="workflow-section-heading"><div><span className="workflow-step-kicker">VERSION HISTORY</span><h2>Proposal versions</h2><p>Create priced versions, then record when a proposal is sent or accepted.</p></div><button className="workflow-quiet-button" onClick={() => setShowProposalForm(value => !value)}><Plus size={14}/>{showProposalForm ? 'Cancel' : 'Create version'}</button></div>
        {showProposalForm && <form className="workflow-form proposal-create-form" onSubmit={createProposal}><label>Version name<input required value={proposalName} onChange={event => setProposalName(event.target.value)} placeholder="e.g. Website build"/></label><label>Proposal amount<input required min="0.01" step="0.01" type="number" value={proposalAmount} onChange={event => setProposalAmount(event.target.value)} placeholder="0.00"/></label><button className="workflow-primary-button" type="submit">Save draft</button></form>}
        {stageShowsProposalSent && versions.length > 0 && <div className="workflow-empty compact"><AlertCircle size={17}/><span>The lead is marked Proposal sent, but no saved version is marked Sent. Add the missing version details below; the existing lead stage will stay unchanged.</span></div>}
        {versions.length ? <div className="proposal-version-list">{versions.map(version => <article className={`proposal-version ${selectedProposal === version.id ? 'selected' : ''}`} key={version.id}>
          <div className="proposal-version-top"><div><b>{version.name}</b><small>Version {versions.length - versions.indexOf(version)} · {version.status}</small></div><b className="workflow-money">{formatMoney(version.amount)}</b></div>
          <div className="proposal-version-meta">Created {version.created}<span className={`workflow-state ${version.status === 'Accepted' ? 'complete' : ''}`}>{version.status}</span></div>
          <div className="proposal-version-actions">{version.status === 'Draft' && <button onClick={() => sendProposal(version)}>Mark sent</button>}{version.status === 'Sent' && !accepted && <button onClick={() => { updateWorkflow({ selectedProposal: version.id }); setShowAcceptanceForm(true) }}>Record acceptance</button>}</div>
        </article>)}</div> : stageShowsProposalSent ? <div className="workflow-empty"><FileText size={19}/><b>Proposal marked as sent</b><span>The lead stage is Proposal sent, but version name, amount, and send date have not been recorded.</span><button className="workflow-quiet-button" onClick={() => setShowProposalForm(true)}>Add version details</button></div> : <div className="workflow-empty"><FileText size={19}/><b>No proposal versions yet</b><span>Create a draft to start tracking proposal progress.</span></div>}
        {showAcceptanceForm && <form className="workflow-form acceptance-form" onSubmit={recordAcceptance}><div className="workflow-form-title"><CheckCircle2 size={16}/><b>Record client acceptance</b></div><label>Evidence type<CustomSelect ariaLabel="Evidence type" value={evidenceMethod} options={['Approval message', 'Signed file']} onChange={setEvidenceMethod}/></label><label>Evidence reference<input required value={evidence} onChange={event => setEvidence(event.target.value)} placeholder={evidenceMethod === 'Signed file' ? 'File name or storage reference' : 'Message, email, or approval reference'}/></label><label className="wide">Acceptance note<textarea required rows={2} value={acceptanceNote} onChange={event => setAcceptanceNote(event.target.value)} placeholder="Add a short note about the client’s approval."/></label><button className="workflow-primary-button" type="submit">Save acceptance</button></form>}
        {acceptance && <div className="acceptance-record"><div><CheckCircle2 size={15}/><b>Client acceptance recorded</b><span>{acceptance.date}</span></div><p><span>{acceptance.method}</span>{acceptance.evidence}</p><p><span>Acceptance note</span>{acceptance.note}</p></div>}
        <p className="workflow-footnote">Proposal versions, approvals, and payment records are saved to your Supabase workspace.</p>
      </section>

      {accepted && <section className="task-detail-card deposit-panel">
        <div className="workflow-step-heading"><div><span className="workflow-step-kicker">STEP 2: PAYMENT CHECKPOINT</span><h2>Accepted proposal and deposit</h2></div><span className={`workflow-state ${accepted ? 'complete' : ''}`}>{accepted ? 'Accepted' : 'Waiting for acceptance'}</span></div>
        {accepted ? <div className="accepted-proposal-card"><div><span>Accepted proposal</span><b>Version {versions.length - versions.findIndex(item => item.id === currentProposal?.id)} · {currentProposal?.name}</b><small>{acceptance?.method} · {acceptance?.date}</small></div><strong>{formatMoney(currentProposal?.amount ?? 0)}</strong></div> : <div className="workflow-empty compact"><AlertCircle size={17}/><span>Record client acceptance to unlock deposit tracking.</span></div>}
        <div className="deposit-summary"><div><span>Amount deposited</span><b>{formatMoney(deposited)}</b></div><button className="workflow-quiet-button" disabled={!accepted} onClick={() => setShowDepositForm(value => !value)}><CreditCard size={14}/>{showDepositForm ? 'Cancel' : 'Record deposit'}</button></div>
        {showDepositForm && <form className="workflow-form deposit-form" onSubmit={recordDeposit}><label>Amount deposited<input required min="0.01" step="0.01" type="number" value={depositAmount} onChange={event => setDepositAmount(event.target.value)} placeholder="0.00"/></label><label>Date received<CustomDatePicker ariaLabel="Date received" value={depositDate} onChange={setDepositDate}/></label><label className="wide">Receipt note<input value={depositNote} onChange={event => setDepositNote(event.target.value)} placeholder="Optional reference"/></label><button className="workflow-primary-button" type="submit">Save deposit</button></form>}
        {deposits.map((deposit, index) => <div className="deposit-record" key={`${deposit.date}-${index}`}><span className="deposit-check"><Check size={13}/></span><div><b>Deposit recorded</b><small>{deposit.date}{deposit.note ? ` · ${deposit.note}` : ''}</small></div><strong>{formatMoney(deposit.amount)}</strong></div>)}
        <p className="workflow-footnote">Record receipts manually. Online payment collection is not enabled.</p>
      </section>}

      {accepted && deposited > 0 && <section className="task-detail-card project-setup-panel">
        <div className="workflow-step-heading"><div><span className="workflow-step-kicker">STEP 3: PROJECT SETUP</span><h2>Convert to website project</h2><p>Set project details once proposal acceptance and a deposit are recorded.</p></div><span className={`workflow-state ${createdProject ? 'complete' : accepted && deposited > 0 ? 'ready' : ''}`}>{createdProject ? 'Created' : accepted && deposited > 0 ? 'Ready' : 'Locked'}</span></div>
        {!accepted || deposited <= 0 ? <div className="workflow-empty compact"><BriefcaseBusiness size={17}/><span>Accept a proposal and record a deposit before setting up the project.</span></div> : createdProject ? <div className="project-created-notice"><CheckCircle2 size={17}/><div><b>{projectName}</b><span>Project saved to your Projects page.</span></div></div> : <form className="workflow-form project-setup-form" onSubmit={createProject}>
          <label className="wide">Project name<input required value={projectName} onChange={event => updateWorkflow({ projectName: event.target.value })} placeholder="Website project name"/></label>
          <label>Existing client<input value={lead.client} readOnly/></label>
          <label>Client type<CustomSelect ariaLabel="Client type" value={clientType} options={['Organization', 'Individual']} onChange={value => updateWorkflow({ clientType: value })}/></label>
          <label>Start date <small>Optional</small><CustomDatePicker ariaLabel="Start date" value={startDate} onChange={value => updateWorkflow({ startDate: value })}/></label>
          <label>Target date <small>Optional</small><CustomDatePicker ariaLabel="Target date" value={targetDate} onChange={value => updateWorkflow({ targetDate: value })}/></label>
          <div className="project-setup-value"><ReceiptText size={15}/><span>Agreed value</span><b>{formatMoney(currentProposal?.amount ?? 0)}</b></div>
          <button className="workflow-primary-button" type="submit"><BriefcaseBusiness size={14}/>Convert to project <ArrowRight size={14}/></button>
        </form>}
      </section>}
    </div>
  </div>
}
