import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowRight, CircleCheck, CircleX, KeyRound, LoaderCircle, LockKeyhole, Mail, RefreshCw, ShieldCheck } from 'lucide-react'
import { configureDatabaseWorkspace } from '../lib/database'
import {
  authChangeEvent, authSessionStorageKey, clearPendingWorkspaceInvite, consumeGoogleCallback, enrollTotp, getCurrentSession, inspectSupabaseConfig,
  getWorkspaceMembership, isSupabaseConfigured, listTotpFactors, removeTotpFactor,
  isPendingWorkspaceInvite, sessionAssurance, signInWithPassword, startGoogleSignIn, signOut, updateOwnPassword, verifyTotp,
  type SupabaseSession,
} from '../lib/supabase'

type AuthPhase = 'loading' | 'sign-in' | 'invite-password' | 'challenge' | 'enrollment' | 'workspace' | 'no-workspace' | 'configuration-error'
type Enrollment = { factorId: string; qrCode: string; secret: string }

export default function WorkspaceAuthGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<AuthPhase>('loading')
  const [session, setSession] = useState<SupabaseSession | null>(null)
  const [factorId, setFactorId] = useState('')
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [invitePassword, setInvitePassword] = useState('')
  const [invitePasswordConfirm, setInvitePasswordConfirm] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [configChecked, setConfigChecked] = useState(false)
  const [checkingConfig, setCheckingConfig] = useState(false)
  const configStatus = inspectSupabaseConfig()
  const configReady = configStatus.projectUrl === 'ready' && configStatus.publishableKey === 'ready'
  const handleConfigurationCheck = async () => {
    if (checkingConfig) return
    setCheckingConfig(true)
    setConfigChecked(false)
    await new Promise(resolve => window.setTimeout(resolve, 550))
    setConfigChecked(true)
    setCheckingConfig(false)
  }

  const authorize = useCallback(async (activeSession: SupabaseSession) => {
    setSession(activeSession)
    setError('')
    if (isPendingWorkspaceInvite()) {
      configureDatabaseWorkspace(null)
      setPhase('invite-password')
      return
    }
    if (sessionAssurance(activeSession) !== 'aal2') {
      configureDatabaseWorkspace(null)
      const factors = await listTotpFactors(activeSession)
      const verifiedFactor = factors.find(factor => factor.status === 'verified')
      if (verifiedFactor) {
        setFactorId(verifiedFactor.id)
        setEnrollment(null)
        setPhase('challenge')
        return
      }
      for (const factor of factors) if (factor.status !== 'verified') await removeTotpFactor(activeSession, factor.id)
      const created = await enrollTotp(activeSession)
      setEnrollment({ factorId: created.id, qrCode: created.totp.qr_code, secret: created.totp.secret })
      setFactorId(created.id)
      setPhase('enrollment')
      return
    }
    const membership = await getWorkspaceMembership(activeSession)
    if (!membership) {
      configureDatabaseWorkspace(null)
      setPhase('no-workspace')
      return
    }
    configureDatabaseWorkspace(membership.workspace_id)
    setPhase('workspace')
  }, [])

  const loadSession = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      configureDatabaseWorkspace(null)
      setPhase('configuration-error')
      return
    }
    setPhase('loading')
    try {
      const callbackSession = await consumeGoogleCallback()
      const activeSession = callbackSession ?? await getCurrentSession()
      if (!activeSession) {
        configureDatabaseWorkspace(null)
        setSession(null)
        setPhase('sign-in')
        return
      }
      await authorize(activeSession)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not connect to Supabase Auth.')
      setPhase('sign-in')
    }
  }, [authorize])

  useEffect(() => {
    void loadSession()
    const handleAuthChange = () => { void loadSession() }
    const handleStorage = (event: StorageEvent) => { if (event.key === authSessionStorageKey) void loadSession() }
    window.addEventListener(authChangeEvent, handleAuthChange)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener(authChangeEvent, handleAuthChange)
      window.removeEventListener('storage', handleStorage)
    }
  }, [loadSession])

  const handlePasswordSignIn = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true); setError('')
    try { await authorize(await signInWithPassword(email.trim(), password)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Sign-in failed.') }
    finally { setBusy(false) }
  }

  const handleInvitePassword = async (event: FormEvent) => {
    event.preventDefault()
    if (!session) return
    if (invitePassword.length < 8) { setError('Use at least 8 characters for your password.'); return }
    if (invitePassword !== invitePasswordConfirm) { setError('The passwords do not match.'); return }
    setBusy(true); setError('')
    try {
      const updatedSession = await updateOwnPassword(session, invitePassword)
      clearPendingWorkspaceInvite()
      setInvitePassword(''); setInvitePasswordConfirm('')
      await authorize(updatedSession)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Your password could not be saved.') }
    finally { setBusy(false) }
  }

  const handleGoogleSignIn = async () => {
    setBusy(true); setError('')
    try { await startGoogleSignIn() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Google sign-in could not start.'); setBusy(false) }
  }

  const handleVerify = async (event: FormEvent) => {
    event.preventDefault()
    if (!session || !factorId || code.trim().length < 6) return
    setBusy(true); setError('')
    try { await authorize(await verifyTotp(session, factorId, code.trim())) ; setCode('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The authenticator code could not be verified.') }
    finally { setBusy(false) }
  }

  const handleSignOut = async () => {
    setBusy(true)
    try { await signOut() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Sign out failed.') }
    finally { setBusy(false) }
  }

  if (phase === 'workspace') return <>{children}</>
  if (phase === 'loading') return <main className="workspace-auth-screen"><section className="workspace-auth-card auth-loading"><LoaderCircle size={24}/><span>Connecting to your workspace…</span></section></main>

  return <main className="workspace-auth-screen">
    <section className={`workspace-auth-card${phase === 'configuration-error' ? ' workspace-setup-card' : ''}`}>
      <header className="workspace-auth-brand"><span className="workspace-auth-logo"><img src="/strataforge-mark.png" alt=""/></span><span className="workspace-auth-brand-copy"><b>STRATAFORGE</b><small>SOFTWARE SOLUTIONS</small></span>{phase === 'configuration-error' && <span className="workspace-setup-status"><i/>Setup required</span>}</header>
      {phase === 'configuration-error' && <div className="workspace-setup-layout">
        <div className="workspace-setup-intro"><span className="directory-eyebrow">WORKSPACE CONNECTION</span><h1>Connect your workspace</h1><p>Connect this CRM to Supabase to enable secure sign-in and shared workspace data.</p>
          <div className="workspace-setup-steps"><div><i>1</i><span><b>Set your Supabase project values</b><small>Use your project URL and publishable key.</small></span></div><div><i>2</i><span><b>Restart or redeploy</b><small>Environment values are loaded when the app is built.</small></span></div></div>
        </div>
        <aside className="workspace-auth-config-panel"><div className="workspace-auth-config-heading"><span><ShieldCheck size={17}/></span><div><b>Required environment variables</b><small>Values are kept outside the app source.</small></div></div><div className="workspace-auth-help"><div><small>Supabase project URL</small><code>VITE_SUPABASE_URL</code></div><div><small>Supabase publishable key</small><code>VITE_SUPABASE_PUBLISHABLE_KEY</code></div></div>
          <div className="workspace-config-checklist" aria-label="Configuration check results">
            <div className={configStatus.projectUrl === 'ready' ? 'ready' : 'attention'}>{configStatus.projectUrl === 'ready' ? <CircleCheck size={14}/> : <CircleX size={14}/>}<span>Project URL</span><b>{configStatus.projectUrl === 'ready' ? 'Looks valid' : configStatus.projectUrl === 'missing' ? 'Missing' : 'Invalid format'}</b></div>
            <div className={configStatus.publishableKey === 'ready' ? 'ready' : 'attention'}>{configStatus.publishableKey === 'ready' ? <CircleCheck size={14}/> : <CircleX size={14}/>}<span>Publishable key</span><b>{configStatus.publishableKey === 'ready' ? 'Looks valid' : configStatus.publishableKey === 'missing' ? 'Missing' : 'Invalid format'}</b></div>
          </div>
          <button type="button" className="workspace-config-check-button" onClick={() => void handleConfigurationCheck()} disabled={checkingConfig} aria-busy={checkingConfig}>{checkingConfig ? <LoaderCircle size={13} className="workspace-inline-spinner"/> : <RefreshCw size={13}/>} {checkingConfig ? 'Checking configuration…' : 'Check configuration'}</button>
          {configChecked && <div className={`workspace-config-check-result ${configReady ? 'ready' : 'attention'}`} role="status">{configReady ? 'Both values look valid. Restart the app to test the Supabase connection.' : 'Setup is incomplete. Fix the items marked above, then restart the app.'}</div>}
          <small className="workspace-config-check-note">This checks local value presence and format. Sign-in verifies the live Supabase connection.</small>
          <div className="workspace-setup-tip"><b>Local setup</b><span>Add these to <code>.env</code>, then restart <code>npm run dev</code>.</span></div><div className="workspace-setup-tip vercel"><b>Vercel setup</b><span>Add them in Project Settings → Environment Variables, then redeploy.</span></div></aside>
      </div>}
      {phase === 'sign-in' && <>
        <h1>Sign in to StrataForge</h1><p>Use your workspace account to access client and project data.</p>
        <form className="workspace-auth-form" onSubmit={handlePasswordSignIn}>
          <label>Email address<span className="workspace-auth-input"><Mail size={15}/><input autoComplete="username" type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@company.com"/></span></label>
          <label>Password<span className="workspace-auth-input"><LockKeyhole size={15}/><input autoComplete="current-password" type="password" required value={password} onChange={event => setPassword(event.target.value)} placeholder="Your password"/></span></label>
          <button className="workspace-auth-primary" type="submit" disabled={busy}>{busy ? <LoaderCircle size={15}/> : null}Sign in</button>
        </form>
        <div className="workspace-auth-divider"><span>or</span></div>
        <button type="button" className="workspace-auth-google" onClick={() => void handleGoogleSignIn()} disabled={busy}><span className="google-g">G</span>Continue with Google</button>
        <small className="workspace-auth-note">Workspace access is limited to invited members.</small>
      </>}
      {phase === 'invite-password' && <>
        <h1>Finish setting up your account</h1><p>Create a password for your StrataForge workspace account. You’ll set up authenticator verification next.</p>
        <form className="workspace-auth-form" onSubmit={handleInvitePassword}>
          <label>Create password<span className="workspace-auth-input"><LockKeyhole size={15}/><input autoFocus autoComplete="new-password" type="password" minLength={8} required value={invitePassword} onChange={event => setInvitePassword(event.target.value)} placeholder="At least 8 characters"/></span></label>
          <label>Confirm password<span className="workspace-auth-input"><LockKeyhole size={15}/><input autoComplete="new-password" type="password" minLength={8} required value={invitePasswordConfirm} onChange={event => setInvitePasswordConfirm(event.target.value)} placeholder="Re-enter your password"/></span></label>
          <button className="workspace-auth-primary" type="submit" disabled={busy || invitePassword.length < 8 || invitePassword !== invitePasswordConfirm}>{busy ? <LoaderCircle size={15}/> : <ShieldCheck size={15}/>}Save password and continue</button>
        </form>
      </>}
      {phase === 'challenge' && <>
        <h1>Verify it’s you</h1><p>Enter the six-digit code from your authenticator app to continue.</p>
        <form className="workspace-auth-form" onSubmit={handleVerify}>
          <label>Authenticator code<span className="workspace-auth-input"><KeyRound size={15}/><input autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000"/></span></label>
          <button className="workspace-auth-primary" type="submit" disabled={busy || code.length !== 6}>{busy ? <LoaderCircle size={15}/> : null}Verify and continue <ArrowRight size={15}/></button>
        </form>
        <button type="button" className="workspace-auth-link" onClick={() => void handleSignOut()}>Sign out</button>
      </>}
      {phase === 'enrollment' && enrollment && <>
        <h1>Set up two-factor sign-in</h1><p>Scan this QR code with an authenticator app, then verify the six-digit code.</p>
        <div className="workspace-auth-qr"><img src={`data:image/svg+xml,${encodeURIComponent(enrollment.qrCode)}`} alt="Authenticator setup QR code"/></div>
        <div className="workspace-auth-secret"><small>If you can’t scan the code, enter this setup key:</small><code>{enrollment.secret}</code></div>
        <form className="workspace-auth-form" onSubmit={handleVerify}>
          <label>Authenticator code<span className="workspace-auth-input"><KeyRound size={15}/><input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000"/></span></label>
          <button className="workspace-auth-primary" type="submit" disabled={busy || code.length !== 6}>{busy ? <LoaderCircle size={15}/> : <ShieldCheck size={15}/>}Enable and continue</button>
        </form>
        <button type="button" className="workspace-auth-link" onClick={() => void handleSignOut()}>Sign out</button>
      </>}
      {phase === 'no-workspace' && <><h1>Workspace access needed</h1><p>This account has signed in, but it hasn’t been added to a StrataForge workspace. Ask a workspace administrator to add your account.</p><button className="workspace-auth-primary" type="button" onClick={() => void handleSignOut()} disabled={busy}>Sign out</button></>}
      {error && <div className="workspace-auth-error" role="alert">{error}</div>}
    </section>
  </main>
}
