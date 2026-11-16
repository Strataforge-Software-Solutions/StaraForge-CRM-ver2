import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Check, CircleAlert, LoaderCircle, MailPlus, ShieldCheck, UserPlus, Users, X } from 'lucide-react'
import { DirectoryHeader } from '../components/DirectoryShared'
import { CustomSelect } from '../components/CustomControls'
import { getCurrentDatabaseWorkspaceId, useDatabaseCollection } from '../lib/database'
import { getCurrentSession, getWorkspaceMembership } from '../lib/supabase'
import { emptyProfilePhotos } from '../lib/profilePhoto'

type WorkspaceRole = 'owner' | 'admin' | 'member'
type WorkspaceMember = { userId?: string; email: string; displayName: string; role: WorkspaceRole; status: 'active' | 'pending'; createdAt: string }
type InviteResult = { ok?: boolean; inviteSent?: boolean; existingAccount?: boolean; confirmationResent?: boolean; error?: string }

async function apiRequest(path: string, session: { access_token: string }, init: RequestInit = {}) {
  const response = await fetch(path, {
    ...init,
    headers: { Authorization: `Bearer ${session.access_token}`, ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers },
  })
  if (!(response.headers.get('content-type') ?? '').includes('application/json')) throw new Error('Workspace member API is unavailable.')
  const body = await response.json().catch(() => ({})) as Record<string, unknown>
  if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Workspace access could not be loaded.')
  return body
}

function displayDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function AccessPage() {
  const [accountSettings] = useDatabaseCollection<Record<string, { name?: string }>>('accountSettings', {})
  const [profilePhotos] = useDatabaseCollection<Record<string, string>>('profilePhotos', emptyProfilePhotos)
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [loading, setLoading] = useState(true)
  const [canManage, setCanManage] = useState(false)
  const [pageError, setPageError] = useState('')
  const [rosterNotice, setRosterNotice] = useState('')
  const [notice, setNotice] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'member' | 'admin'>('member')
  const [sending, setSending] = useState(false)
  const [inviteError, setInviteError] = useState('')

  const loadMembers = useCallback(async () => {
    setLoading(true)
    setPageError('')
    setRosterNotice('')
    try {
      const workspaceId = getCurrentDatabaseWorkspaceId()
      const session = await getCurrentSession()
      if (!workspaceId || !session) throw new Error('Sign in again to manage workspace members.')
      const membership = await getWorkspaceMembership(session)
      const allowed = membership?.role === 'owner' || membership?.role === 'admin'
      setCanManage(allowed)
      if (!allowed) { setMembers([]); return }
      if (!membership) throw new Error('Your account is not connected to a workspace.')
      const metadata = session.user.user_metadata as { full_name?: unknown; name?: unknown } | undefined
      const ownMember: WorkspaceMember = {
        userId: membership.user_id,
        email: membership.email || session.user.email || '',
        displayName: accountSettings[session.user.id]?.name?.trim() || String(metadata?.full_name ?? metadata?.name ?? membership.display_name ?? session.user.email?.split('@')[0] ?? 'Workspace member'),
        role: membership.role as WorkspaceRole,
        status: 'active',
        createdAt: membership.created_at,
      }
      try {
        const result = await apiRequest(`/api/workspace-members?workspaceId=${encodeURIComponent(workspaceId)}`, session)
        if (!Array.isArray(result.members)) {
          setMembers([ownMember])
          setRosterNotice('Your account is connected, but the full member roster is unavailable in this environment.')
          return
        }
        const roster = result.members as WorkspaceMember[]
        const includesCurrentAccount = roster.some(member => member.email.toLowerCase() === ownMember.email.toLowerCase())
        setMembers(includesCurrentAccount ? roster : [...roster, ownMember])
        if (!includesCurrentAccount) setRosterNotice('Your account is connected and shown below, but it was missing from the roster response.')
      } catch {
        setMembers([ownMember])
        setRosterNotice('Your account is connected, but the full member roster could not be loaded in this environment.')
      }
    } catch (cause) {
      setPageError(cause instanceof Error ? cause.message : 'Workspace members could not be loaded.')
    } finally { setLoading(false) }
  }, [accountSettings])

  useEffect(() => { void loadMembers() }, [loadMembers])

  const closeInvite = () => {
    if (sending) return
    setInviteOpen(false); setReviewing(false); setEmail(''); setRole('member'); setInviteError('')
  }

  const handleReview = (event: FormEvent) => {
    event.preventDefault()
    setInviteError('')
    setReviewing(true)
  }

  const sendInvite = async () => {
    const workspaceId = getCurrentDatabaseWorkspaceId()
    const session = await getCurrentSession()
    if (!workspaceId || !session) { setInviteError('Your sign-in session expired. Sign in again.'); return }
    setSending(true); setInviteError('')
    try {
      const result = await apiRequest('/api/workspace-members', session, {
        method: 'POST',
        body: JSON.stringify({ workspaceId, email: email.trim(), role }),
      }) as InviteResult
      const normalizedEmail = email.trim().toLowerCase()
      setNotice(result.inviteSent
        ? `Invitation email sent to ${normalizedEmail}.`
        : result.confirmationResent
          ? `Account added and confirmation email resent to ${normalizedEmail}.`
          : `Existing account ${normalizedEmail} added to the workspace.`)
      setInviteOpen(false); setReviewing(false); setEmail(''); setRole('member'); setInviteError('')
      await loadMembers()
    } catch (cause) {
      setInviteError(cause instanceof Error ? cause.message : 'The invitation could not be sent.')
    } finally { setSending(false) }
  }

  return <div className="directory-page admin-page access-page">
    <DirectoryHeader section="ADMINISTRATION" title="Access" description="Manage who can access your StrataForge workspace." action={canManage ? 'Invite member' : undefined} onAction={() => { setNotice(''); setInviteOpen(true) }}/>
    <section className="admin-panel">
      <div className="admin-panel-head"><div><h2><Users size={17}/> Workspace membership</h2><span>{members.length} {members.length === 1 ? 'account' : 'accounts'} in this workspace</span></div></div>
      {!canManage && !loading && !pageError && <div className="admin-note access-admin-note"><ShieldCheck size={18}/><div><b>Administrator access required</b><p>Only workspace owners and admins can view the member list or send invitations.</p></div></div>}
      {loading && <div className="admin-empty" role="status"><LoaderCircle size={22} className="workspace-inline-spinner"/><b>Loading workspace members…</b></div>}
      {!loading && pageError && <div className="admin-empty access-error" role="alert"><CircleAlert size={22}/><b>Workspace members could not be loaded</b><span>{pageError}</span><button className="admin-cancel" type="button" onClick={() => void loadMembers()}>Try again</button></div>}
      {!loading && rosterNotice && <div className="admin-note access-admin-note" role="status"><ShieldCheck size={18}/><div><b>Account access confirmed</b><p>{rosterNotice}</p></div></div>}
      {!loading && canManage && !pageError && members.length === 0 && <div className="admin-empty"><Users size={22}/><b>No workspace members yet</b><span>Invite a teammate to give them secure access to this workspace.</span></div>}
      {!loading && canManage && !pageError && members.length > 0 && <div className="admin-table-scroll access-members-scroll"><table className="admin-table"><thead><tr><th>Member</th><th>Role</th><th>Status</th><th>Added</th></tr></thead><tbody>
        {members.map(member => <tr key={member.email}><td><div className="admin-member"><span className="admin-avatar">{member.userId && profilePhotos[member.userId] ? <img src={profilePhotos[member.userId]} alt=""/> : member.displayName.slice(0, 1).toUpperCase() || 'U'}</span><span><b>{member.displayName}</b><small>{member.email}</small></span></div></td><td><span className="admin-role"><ShieldCheck size={14}/>{member.role[0].toUpperCase() + member.role.slice(1)}</span></td><td><span className={`admin-status${member.status === 'pending' ? ' pending' : ''}`}><i/>{member.status === 'pending' ? 'Invitation pending' : 'Active'}</span></td><td>{displayDate(member.createdAt)}</td></tr>)}
      </tbody></table></div>}
      <div className="admin-panel-foot"><span>New invitees set a password and authenticator before opening workspace data.</span><span>Only owners and admins can invite.</span></div>
    </section>
    {notice && <div className="workspace-toast access-toast" role="status" aria-live="polite"><Check size={15}/>{notice}<button type="button" aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={14}/></button></div>}
    {inviteOpen && <div className="admin-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) closeInvite() }}>
      <section className="admin-invite-modal" role="dialog" aria-modal="true" aria-labelledby="invite-title">
        <header><div><span className="directory-eyebrow">WORKSPACE ACCESS</span><h2 id="invite-title">{reviewing ? 'Review invitation' : 'Invite a teammate'}</h2><p>{reviewing ? 'Check the email and access level before continuing.' : 'Choose an email address and the access they need.'}</p></div><button className="admin-modal-close" type="button" aria-label="Close invitation" onClick={closeInvite}><X size={16}/></button></header>
        {!reviewing ? <form onSubmit={handleReview}>
          <label className="admin-form-field">Email address<input autoFocus type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder="teammate@company.com"/></label>
          <label className="admin-form-field">Workspace role<CustomSelect ariaLabel="Workspace role" className="admin-role-select" value={role} options={[{ label: 'Member', value: 'member' }, { label: 'Admin', value: 'admin' }]} onChange={value => setRole(value as 'member' | 'admin')}/></label>
          <p className="invite-behavior-note"><MailPlus size={15}/> New accounts receive an email invitation. Existing accounts are added immediately and won’t receive a new invite email.</p>
          <footer><button className="admin-cancel" type="button" onClick={closeInvite}>Cancel</button><button className="admin-submit" type="submit"><UserPlus size={14}/>Review invite</button></footer>
        </form> : <>
          <div className="invite-review-card"><span>Email address</span><b>{email.trim().toLowerCase()}</b><span>Workspace role</span><b>{role === 'admin' ? 'Admin' : 'Member'}</b></div>
          <p className="invite-confirmation-note">{role === 'admin' ? 'Admins can manage workspace invitations and view CRM data.' : 'Members can access workspace CRM data.'} New accounts get an invitation email. If this email already has an account, it is added immediately.</p>
          {inviteError && <p className="admin-form-error" role="alert">{inviteError}</p>}
          <footer><button className="admin-cancel" type="button" onClick={() => { setReviewing(false); setInviteError('') }} disabled={sending}>Back</button><button className="admin-submit" type="button" onClick={() => void sendInvite()} disabled={sending}>{sending ? <LoaderCircle size={14} className="workspace-inline-spinner"/> : <MailPlus size={14}/>} {sending ? 'Sending…' : 'Send invitation'}</button></footer>
        </>}
      </section>
    </div>}
  </div>
}
