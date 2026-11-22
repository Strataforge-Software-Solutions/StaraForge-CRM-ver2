import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Check, CircleAlert, KeyRound, LoaderCircle, MailPlus, Pencil, ShieldCheck, Trash2, UserPlus, Users, X } from 'lucide-react'
import { DirectoryHeader } from '../components/DirectoryShared'
import { CustomSelect } from '../components/CustomControls'
import { getCurrentDatabaseWorkspaceId, useDatabaseCollection } from '../lib/database'
import { apiRequest, getCurrentSession } from '../lib/workspaceAccount'
import { emptyProfilePhotos } from '../lib/profilePhoto'

type WorkspaceRole = 'owner' | 'admin' | 'member'
type WorkspaceMember = { userId: string; email: string; displayName: string; role: WorkspaceRole; status: 'active' | 'pending' | 'mfa_setup' | 'disabled'; createdAt: string }
type InviteResult = { ok?: boolean; invite?: { userId: string; email: string; role: WorkspaceRole; displayName: string; setupLink: string; expiresAt: string }; error?: string }

function displayDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function AccessPage({ displayName }: { displayName: string }) {
  const [profilePhotos] = useDatabaseCollection<Record<string, string>>('profilePhotos', emptyProfilePhotos)
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [loading, setLoading] = useState(true)
  const [canManage, setCanManage] = useState(false)
  const [currentUserId, setCurrentUserId] = useState('')
  const [currentUserRole, setCurrentUserRole] = useState<WorkspaceRole>('member')
  const [pageError, setPageError] = useState('')
  const [notice, setNotice] = useState('')
  const [noticeClosing, setNoticeClosing] = useState(false)
  const noticeCloseTimer = useRef<number | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'member' | 'admin'>('member')
  const [sending, setSending] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [manualInviteLink, setManualInviteLink] = useState('')
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false)
  const [setupLinkKind, setSetupLinkKind] = useState<'invite' | 'reset'>('invite')
  const [resetTarget, setResetTarget] = useState<WorkspaceMember | null>(null)
  const [resetting, setResetting] = useState(false)
  const [editTarget, setEditTarget] = useState<WorkspaceMember | null>(null)
  const [editEmail, setEditEmail] = useState('')
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState<'member' | 'admin'>('member')
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState('')
  const [passwordTarget, setPasswordTarget] = useState<WorkspaceMember | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<WorkspaceMember | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const loadMembers = useCallback(async () => {
    setLoading(true); setPageError('')
    try {
      const session = await getCurrentSession()
      if (!session || !getCurrentDatabaseWorkspaceId()) throw new Error('Sign in again to manage workspace users.')
      const activeRole = session.user.user_metadata?.role
      const allowed = activeRole === 'owner' || activeRole === 'admin'
      setCurrentUserId(session.user.id); setCurrentUserRole(activeRole === 'owner' || activeRole === 'admin' ? activeRole : 'member')
      setCanManage(allowed)
      if (!allowed) { setMembers([]); return }
      const result = await apiRequest<{ members?: WorkspaceMember[] }>('/api/auth?action=list', session)
      if (!Array.isArray(result.members)) throw new Error('The users table returned an invalid roster.')
      setMembers(result.members)
    } catch (cause) { setPageError(cause instanceof Error ? cause.message : 'Workspace users could not be loaded.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void loadMembers() }, [loadMembers])
  useEffect(() => {
    setNoticeClosing(false)
    if (noticeCloseTimer.current !== null) { window.clearTimeout(noticeCloseTimer.current); noticeCloseTimer.current = null }
    return () => { if (noticeCloseTimer.current !== null) window.clearTimeout(noticeCloseTimer.current) }
  }, [notice])
  const dismissNotice = () => {
    if (noticeCloseTimer.current !== null) window.clearTimeout(noticeCloseTimer.current)
    setNoticeClosing(true)
    noticeCloseTimer.current = window.setTimeout(() => { setNotice(''); setNoticeClosing(false); noticeCloseTimer.current = null }, 240)
  }
  const closeInvite = () => {
    if (sending) return
    setInviteOpen(false); setReviewing(false); setEmail(''); setRole('member'); setInviteError('')
  }
  const handleReview = (event: FormEvent) => {
    event.preventDefault(); setInviteError('')
    setReviewing(true)
  }
  const sendInvite = async () => {
    const session = await getCurrentSession()
    if (!session) { setInviteError('Your sign-in session expired. Sign in again.'); return }
    setSending(true); setInviteError('')
    try {
      const result = await apiRequest<InviteResult>('/api/auth', session, { method: 'POST', body: JSON.stringify({ action: 'invite', email: email.trim(), role }) })
      if (!result.invite?.setupLink) throw new Error('The user was created, but the setup link was not returned.')
      setNotice(`Invitation created for ${result.invite.email}. Copy the setup link and send it to them.`)
      setManualInviteLink(result.invite.setupLink); setInviteLinkCopied(false); setSetupLinkKind('invite')
      setInviteOpen(false); setReviewing(false); setEmail(''); setRole('member'); setInviteError('')
      await loadMembers()
    } catch (cause) { setInviteError(cause instanceof Error ? cause.message : 'The invitation could not be created.') }
    finally { setSending(false) }
  }
  const copyInviteLink = async () => {
    try { await navigator.clipboard.writeText(manualInviteLink); setInviteLinkCopied(true) }
    catch { setInviteLinkCopied(false) }
  }
  const closeInviteLink = () => { setManualInviteLink(''); setInviteLinkCopied(false) }
  const resetAccount = async () => {
    if (!resetTarget) return
    const session = await getCurrentSession()
    if (!session) { setPageError('Your sign-in session expired. Sign in again.'); setResetTarget(null); return }
    setResetting(true)
    try {
      const result = await apiRequest<{ setupLink: string }>('/api/auth', session, { method: 'POST', body: JSON.stringify({ action: 'reset-account', userId: resetTarget.userId }) })
      setManualInviteLink(result.setupLink); setInviteLinkCopied(false); setSetupLinkKind('reset')
      setNotice(`Access reset for ${resetTarget.email}. Their existing sessions were ended.`)
      setResetTarget(null); await loadMembers()
    } catch (cause) { setPageError(cause instanceof Error ? cause.message : 'Account access could not be reset.'); setResetTarget(null) }
    finally { setResetting(false) }
  }
  const openEdit = (member: WorkspaceMember) => { setEditTarget(member); setEditEmail(member.email); setEditName(member.displayName); setEditRole(member.role === 'admin' ? 'admin' : 'member'); setEditError('') }
  const saveAccount = async (event: FormEvent) => {
    event.preventDefault()
    if (!editTarget) return
    setSavingEdit(true); setEditError('')
    try {
      const session = await getCurrentSession()
      if (!session) throw new Error('Your sign-in session expired. Sign in again.')
      await apiRequest('/api/auth', session, { method: 'POST', body: JSON.stringify({ action: 'update-account', userId: editTarget.userId, email: editEmail, displayName: editName, role: editTarget.role === 'owner' ? 'owner' : editRole }) })
      setNotice(`Account updated for ${editEmail.trim().toLowerCase()}.`); setEditTarget(null); await loadMembers()
    } catch (cause) { setEditError(cause instanceof Error ? cause.message : 'The account could not be updated.') }
    finally { setSavingEdit(false) }
  }
  const savePassword = async (event: FormEvent) => {
    event.preventDefault()
    if (!passwordTarget) return
    if (newPassword !== confirmPassword) { setPasswordError('The passwords do not match.'); return }
    setSavingPassword(true); setPasswordError('')
    try {
      const session = await getCurrentSession()
      if (!session) throw new Error('Your sign-in session expired. Sign in again.')
      await apiRequest('/api/auth', session, { method: 'POST', body: JSON.stringify({ action: 'set-password', userId: passwordTarget.userId, password: newPassword }) })
      const targetEmail = passwordTarget.email
      setPasswordTarget(null); setNewPassword(''); setConfirmPassword('')
      setNotice(`Password updated for ${targetEmail}. Their sessions were ended and authenticator setup is required at next sign-in.`)
      await loadMembers()
    } catch (cause) { setPasswordError(cause instanceof Error ? cause.message : 'The password could not be updated.') }
    finally { setSavingPassword(false) }
  }
  const deleteAccount = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const session = await getCurrentSession()
      if (!session) throw new Error('Your sign-in session expired. Sign in again.')
      await apiRequest('/api/auth', session, { method: 'POST', body: JSON.stringify({ action: 'delete-account', userId: deleteTarget.userId }) })
      setNotice(`Account deleted for ${deleteTarget.email}.`); setDeleteTarget(null); await loadMembers()
    } catch (cause) { setDeleteError(cause instanceof Error ? cause.message : 'The account could not be deleted.') }
    finally { setDeleting(false) }
  }

  return <div className="directory-page admin-page access-page">
    <DirectoryHeader section="ADMINISTRATION" title="Access" description="Manage who can access your StrataForge workspace." action={canManage ? 'Invite member' : undefined} onAction={() => { setNotice(''); setInviteOpen(true) }}/>
    {canManage && !loading && !pageError && <div className="access-summary" aria-label="Workspace access summary"><div><span className="access-summary-icon members"><Users size={19}/></span><span><small>Total members</small><strong>{members.length}</strong><em>Accounts in this workspace</em></span></div><div><span className="access-summary-icon active"><ShieldCheck size={19}/></span><span><small>Active</small><strong>{members.filter(member => member.status === 'active').length}</strong><em>Ready to use the CRM</em></span></div><div><span className="access-summary-icon pending"><KeyRound size={19}/></span><span><small>Setup needed</small><strong>{members.filter(member => member.status === 'pending' || member.status === 'mfa_setup').length}</strong><em>Invitation or authenticator</em></span></div></div>}
    <section className="admin-panel">
      <div className="admin-panel-head"><div><h2><Users size={17}/> Workspace membership</h2><span>Manage people and their access · {members.length} {members.length === 1 ? 'account' : 'accounts'} in this workspace</span></div></div>
      {!canManage && !loading && !pageError && <div className="admin-note access-admin-note"><ShieldCheck size={18}/><div><b>Administrator access required</b><p>Only workspace owners and admins can view the member list or send invitations.</p></div></div>}
      {loading && <div className="admin-empty" role="status"><LoaderCircle size={22} className="workspace-inline-spinner"/><b>Loading workspace members…</b></div>}
      {!loading && pageError && <div className="admin-empty access-error" role="alert"><CircleAlert size={22}/><b>Workspace members could not be loaded</b><span>{pageError}</span><button className="admin-cancel" type="button" onClick={() => void loadMembers()}>Try again</button></div>}
      {!loading && canManage && !pageError && members.length === 0 && <div className="admin-empty"><Users size={22}/><b>No workspace members yet</b><span>Invite a teammate to give them secure access to this workspace.</span></div>}
      {!loading && canManage && !pageError && members.length > 0 && <div className="admin-table-scroll access-members-scroll"><table className="admin-table"><thead><tr><th>Member</th><th>Role</th><th>Status</th><th>Added</th><th>Action</th></tr></thead><tbody>
        {members.map(member => {
          const memberName = member.userId === currentUserId ? displayName.trim() || member.displayName : member.displayName
          const canEditMember = member.role !== 'owner' || currentUserRole === 'owner'
          return <tr key={member.userId}><td><div className="admin-member"><span className="admin-avatar">{profilePhotos[member.userId] ? <img src={profilePhotos[member.userId]} alt=""/> : memberName.slice(0, 1).toUpperCase() || 'U'}</span><span><b>{memberName}</b><small>{member.email}</small></span></div></td><td><span className="admin-role"><ShieldCheck size={14}/>{member.role[0].toUpperCase() + member.role.slice(1)}</span></td><td><span className={`admin-status${member.status !== 'active' ? ' pending' : ''}`}><i/>{member.status === 'pending' ? 'Invitation pending' : member.status === 'mfa_setup' ? 'MFA setup required' : member.status === 'disabled' ? 'Disabled' : 'Active'}</span></td><td>{displayDate(member.createdAt)}</td><td><div className="access-row-actions">{canEditMember && <><button className="admin-cancel access-edit-action" type="button" onClick={() => openEdit(member)}><Pencil size={12}/>Edit</button><button className="admin-cancel access-password-action" type="button" onClick={() => { setPasswordTarget(member); setNewPassword(''); setConfirmPassword(''); setPasswordError('') }}><KeyRound size={12}/>Password</button></>}{member.userId !== currentUserId && member.role !== 'owner' && <><button className="admin-cancel access-reset-action" type="button" onClick={() => setResetTarget(member)}>{member.status === 'pending' ? 'Resend setup' : 'Reset access'}</button><button className="admin-cancel access-delete-action" type="button" onClick={() => { setDeleteTarget(member); setDeleteError('') }}><Trash2 size={12}/>Delete</button></>}</div></td></tr>
        })}
      </tbody></table></div>}
      <div className="admin-panel-foot"><span>New accounts set a password and authenticator before opening workspace data.</span><span>Only owners and admins can invite.</span></div>
    </section>
    {editTarget && <div className="admin-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !savingEdit) setEditTarget(null) }}><section className="admin-invite-modal" role="dialog" aria-modal="true" aria-labelledby="edit-user-title"><header><div><span className="directory-eyebrow">WORKSPACE ACCESS</span><h2 id="edit-user-title">Edit account</h2><p>Update this member’s name, email, and workspace role.</p></div><button className="admin-modal-close" type="button" aria-label="Close account editor" disabled={savingEdit} onClick={() => setEditTarget(null)}><X size={16}/></button></header><form onSubmit={event => void saveAccount(event)}><label className="admin-form-field">Display name<input autoFocus type="text" required maxLength={120} value={editName} onChange={event => setEditName(event.target.value)} /></label><label className="admin-form-field">Email address<input type="email" required maxLength={254} autoComplete="email" value={editEmail} onChange={event => setEditEmail(event.target.value)} /></label><label className="admin-form-field">Workspace role{editTarget.role === 'owner' ? <input readOnly value="Owner"/> : <CustomSelect ariaLabel="Workspace role" className="admin-role-select" value={editRole} options={[{ label: 'Member', value: 'member' }, { label: 'Admin', value: 'admin' }]} onChange={value => setEditRole(value as 'member' | 'admin')}/>}</label>{editError && <p className="admin-form-error" role="alert">{editError}</p>}<footer><button className="admin-cancel" type="button" disabled={savingEdit} onClick={() => setEditTarget(null)}>Cancel</button><button className="admin-submit" type="submit" disabled={savingEdit}>{savingEdit ? <LoaderCircle size={14} className="workspace-inline-spinner"/> : <Check size={14}/>} {savingEdit ? 'Saving…' : 'Save account'}</button></footer></form></section></div>}
    {passwordTarget && <div className="admin-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !savingPassword) setPasswordTarget(null) }}><section className="admin-invite-modal" role="dialog" aria-modal="true" aria-labelledby="set-password-title"><header><div><span className="directory-eyebrow">ACCOUNT SECURITY</span><h2 id="set-password-title">Set a new password</h2><p>For {passwordTarget.email}. Their current sessions will end and they’ll set up an authenticator at next sign-in.</p></div><button className="admin-modal-close" type="button" aria-label="Close password editor" disabled={savingPassword} onClick={() => setPasswordTarget(null)}><X size={16}/></button></header><form onSubmit={event => void savePassword(event)}><label className="admin-form-field">New password<input autoFocus type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} /></label><label className="admin-form-field">Confirm new password<input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} /></label><p className="invite-behavior-note"><ShieldCheck size={15}/> Use at least 12 characters. The password is stored as a one-way hash.</p>{passwordError && <p className="admin-form-error" role="alert">{passwordError}</p>}<footer><button className="admin-cancel" type="button" disabled={savingPassword} onClick={() => setPasswordTarget(null)}>Cancel</button><button className="admin-submit" type="submit" disabled={savingPassword}>{savingPassword ? <LoaderCircle size={14} className="workspace-inline-spinner"/> : <KeyRound size={14}/>} {savingPassword ? 'Updating…' : 'Update password'}</button></footer></form></section></div>}
    {deleteTarget && <div className="admin-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !deleting) setDeleteTarget(null) }}><section className="admin-invite-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-user-title"><header><div><span className="directory-eyebrow">REMOVE WORKSPACE ACCESS</span><h2 id="delete-user-title">Delete this account?</h2><p>This permanently removes {deleteTarget.displayName} ({deleteTarget.email}) from this workspace and ends their access.</p></div><button className="admin-modal-close" type="button" aria-label="Close delete confirmation" disabled={deleting} onClick={() => setDeleteTarget(null)}><X size={16}/></button></header><p className="invite-behavior-note"><CircleAlert size={15}/> This cannot be undone. The account loses workspace access immediately.</p>{deleteError && <p className="admin-form-error" role="alert">{deleteError}</p>}<footer><button className="admin-cancel" type="button" disabled={deleting} onClick={() => { setDeleteTarget(null); setDeleteError('') }}>Cancel</button><button className="admin-submit access-delete-submit" type="button" disabled={deleting} onClick={() => void deleteAccount()}>{deleting ? <LoaderCircle size={14} className="workspace-inline-spinner"/> : <Trash2 size={14}/>} {deleting ? 'Deleting…' : 'Delete account'}</button></footer></section></div>}
    {notice && <div className={`workspace-toast access-toast${noticeClosing ? ' is-dismissing' : ''}`} role="status" aria-live="polite"><Check size={15}/>{notice}<button type="button" aria-label="Dismiss notification" disabled={noticeClosing} onClick={dismissNotice}><X size={14}/></button></div>}
    {manualInviteLink && <div className="admin-modal-backdrop"><section className="admin-invite-modal manual-invite-modal" role="dialog" aria-modal="true" aria-labelledby="manual-invite-title"><header><div><span className="directory-eyebrow">ACCOUNT SETUP</span><h2 id="manual-invite-title">{setupLinkKind === 'invite' ? 'Invitation link ready' : 'Reset link ready'}</h2><p>Copy the one-time setup link and send it to the account holder. It expires in seven days.</p></div><button className="admin-modal-close" type="button" aria-label="Close setup link" onClick={closeInviteLink}><X size={16}/></button></header><label className="admin-form-field">One-time setup link<input className="manual-invite-link-input" type="text" readOnly value={manualInviteLink} onFocus={event => event.currentTarget.select()}/></label><p className="invite-behavior-note"><ShieldCheck size={15}/> Treat this link like a password. Send it only to the account holder.</p><footer><button className="admin-cancel" type="button" onClick={closeInviteLink}>Close</button><button className="admin-submit" type="button" onClick={() => void copyInviteLink()}>{inviteLinkCopied ? <Check size={14}/> : <MailPlus size={14}/>} {inviteLinkCopied ? 'Copied' : 'Copy setup link'}</button></footer></section></div>}
    {resetTarget && <div className="admin-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !resetting) setResetTarget(null) }}><section className="admin-invite-modal" role="alertdialog" aria-modal="true" aria-labelledby="reset-user-title"><header><div><span className="directory-eyebrow">ACCOUNT RECOVERY</span><h2 id="reset-user-title">Reset access?</h2><p>Revoke {resetTarget.displayName}’s current sessions and require a new password and authenticator setup.</p></div><button className="admin-modal-close" type="button" aria-label="Close reset confirmation" disabled={resetting} onClick={() => setResetTarget(null)}><X size={16}/></button></header><div className="invite-review-card"><span>Account</span><b>{resetTarget.email}</b><span>Role</span><b>{resetTarget.role[0].toUpperCase() + resetTarget.role.slice(1)}</b></div><footer><button className="admin-cancel" type="button" disabled={resetting} onClick={() => setResetTarget(null)}>Cancel</button><button className="admin-submit" type="button" disabled={resetting} onClick={() => void resetAccount()}>{resetting ? <LoaderCircle size={14} className="workspace-inline-spinner"/> : <ShieldCheck size={14}/>} {resetting ? 'Resetting…' : 'Reset access'}</button></footer></section></div>}
    {inviteOpen && <div className="admin-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) closeInvite() }}>
      <section className="admin-invite-modal" role="dialog" aria-modal="true" aria-labelledby="invite-title">
        <header><div><span className="directory-eyebrow">WORKSPACE ACCESS</span><h2 id="invite-title">{reviewing ? 'Review invitation' : 'Invite a teammate'}</h2><p>{reviewing ? 'Check the email and access level before creating the account.' : 'Create a pending account and choose the access they need.'}</p></div><button className="admin-modal-close" type="button" aria-label="Close invitation" onClick={closeInvite}><X size={16}/></button></header>
        {!reviewing ? <form onSubmit={handleReview}>
          <label className="admin-form-field">Email address<input autoFocus type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder="teammate@company.com"/></label>
          <label className="admin-form-field">Workspace role<CustomSelect ariaLabel="Workspace role" className="admin-role-select" value={role} options={[{ label: 'Member', value: 'member' }, { label: 'Admin', value: 'admin' }]} onChange={value => setRole(value as 'member' | 'admin')}/></label>
          {inviteError && <p className="admin-form-error" role="alert">{inviteError}</p>}
          <p className="invite-behavior-note"><MailPlus size={15}/> This app creates the account and setup link without sending email. Copy the link and deliver it to the invited person.</p>
          <p className="invite-behavior-note"><ShieldCheck size={15}/> Invitees set a password and authenticator before accessing CRM data.</p>
          <footer><button className="admin-cancel" type="button" onClick={closeInvite}>Cancel</button><button className="admin-submit" type="submit"><UserPlus size={14}/>Review invite</button></footer>
        </form> : <>
          <div className="invite-review-card"><span>Email address</span><b>{email.trim().toLowerCase()}</b><span>Workspace role</span><b>{role === 'admin' ? 'Admin' : 'Member'}</b></div>
          <p className="invite-confirmation-note">This creates a pending account. The invitee follows the setup link, chooses a password, and enables authenticator verification.</p>
          {inviteError && <p className="admin-form-error" role="alert">{inviteError}</p>}
          <footer><button className="admin-cancel" type="button" onClick={() => { setReviewing(false); setInviteError('') }} disabled={sending}>Back</button><button className="admin-submit" type="button" onClick={() => void sendInvite()} disabled={sending}>{sending ? <LoaderCircle size={14} className="workspace-inline-spinner"/> : <MailPlus size={14}/>} {sending ? 'Creating…' : 'Create account'}</button></footer>
        </>}
      </section>
    </div>}
  </div>
}
