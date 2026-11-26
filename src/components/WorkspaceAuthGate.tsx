import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowRight, Check, Eye, EyeOff, KeyRound, LoaderCircle, LockKeyhole, Mail, ShieldCheck, Smartphone, X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { configureDatabaseWorkspace } from '../lib/database'
import { authChangeEvent, authSessionStorageKey, completeInvite, getBootstrapStatus, getCurrentSession, setBootstrapPassword, signInWithPassword, signOut, verifyTotp, type WorkspaceSession } from '../lib/workspaceAccount'

type Phase = 'loading' | 'sign-in' | 'enrollment' | 'challenge' | 'invite-password' | 'bootstrap' | 'workspace'
const pendingInviteStorageKey = 'strataforge.workspace.pending-invite'

export default function WorkspaceAuthGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [session, setSession] = useState<WorkspaceSession | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showBootstrapPassword, setShowBootstrapPassword] = useState(false)
  const [showBootstrapPasswordConfirm, setShowBootstrapPasswordConfirm] = useState(false)
  const [showSignInPassword, setShowSignInPassword] = useState(false)
  const [showInvitePassword, setShowInvitePassword] = useState(false)
  const [showInvitePasswordConfirm, setShowInvitePasswordConfirm] = useState(false)
  const [bootstrapToken, setBootstrapToken] = useState('')
  const [inviteToken, setInviteToken] = useState('')
  const [challengeToken, setChallengeToken] = useState('')
  const [totpSecret, setTotpSecret] = useState('')
  const [totpUri, setTotpUri] = useState('')
  const [totpSetupMethod, setTotpSetupMethod] = useState<'qr' | 'manual'>('qr')
  const [showLargeQr, setShowLargeQr] = useState(false)
  const qrDialogRef = useRef<HTMLDialogElement>(null)
  const codeInputRef = useRef<HTMLInputElement>(null)
  const authInputTimers = useRef(new WeakMap<HTMLElement, number>())
  const [code, setCode] = useState('')
  const [codeAnimationStart, setCodeAnimationStart] = useState(-1)
  const [codeAnimationId, setCodeAnimationId] = useState(0)
  const [busy, setBusy] = useState(false)
  const [signInFailed, setSignInFailed] = useState(false)
  const [bootstrapAvailable, setBootstrapAvailable] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const animateAuthInput = (event: FormEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const currentTimer = authInputTimers.current.get(input)
    if (currentTimer) window.clearTimeout(currentTimer)
    input.classList.remove('workspace-auth-input-text-typing')
    void input.offsetWidth
    input.classList.add('workspace-auth-input-text-typing')
    authInputTimers.current.set(input, window.setTimeout(() => input.classList.remove('workspace-auth-input-text-typing'), 280))
  }

  const updateAuthenticatorCode = (rawValue: string) => {
    const nextCode = rawValue.replace(/\D/g, '').slice(0, 6)
    let firstChangedDigit = nextCode.length
    for (let index = 0; index < nextCode.length; index += 1) {
      if (nextCode[index] !== code[index]) { firstChangedDigit = index; break }
    }
    if (firstChangedDigit < nextCode.length) {
      setCodeAnimationStart(firstChangedDigit)
      setCodeAnimationId(current => current + 1)
    } else setCodeAnimationStart(-1)
    setCode(nextCode)
  }

  useEffect(() => {
    const dialog = qrDialogRef.current
    if (!dialog) return
    if (showLargeQr && phase === 'enrollment' && !dialog.open) dialog.showModal()
    else if ((!showLargeQr || phase !== 'enrollment') && dialog.open) dialog.close()
  }, [showLargeQr, phase])

  const loadSession = useCallback(async () => {
    const params = new URLSearchParams(window.location.search)
    const fragment = new URLSearchParams(window.location.hash.slice(1))
    localStorage.removeItem('strataforge.auth.session')
    const oldAuthCallback = params.has('code') || params.has('token_hash') || fragment.has('access_token') || fragment.has('refresh_token')
    if (oldAuthCallback) {
      window.history.replaceState({}, document.title, window.location.pathname)
      configureDatabaseWorkspace(null); setSession(null); setError('This sign-in link is from the previous account system. Ask a workspace admin for a new setup link.'); setPhase('sign-in'); return
    }
    const inviteFromUrl = params.get('invite') ?? fragment.get('invite')
    const invite = inviteFromUrl || sessionStorage.getItem(pendingInviteStorageKey)
    const googleStage = params.get('auth_stage') ?? fragment.get('auth_stage')
    const challenge = params.get('challenge') ?? fragment.get('challenge')
    const secret = params.get('secret') ?? fragment.get('secret')
    const authError = params.get('auth_error') ?? fragment.get('auth_error')
    if (authError) {
      window.history.replaceState({}, document.title, window.location.pathname)
      configureDatabaseWorkspace(null); setSession(null); setError('Google sign-in did not complete. Confirm that this email has workspace access, then try again.'); setPhase('sign-in'); return
    }
    if (invite) {
      sessionStorage.setItem(pendingInviteStorageKey, invite)
      window.history.replaceState({}, document.title, window.location.pathname)
      setInviteToken(invite); setPhase('invite-password'); configureDatabaseWorkspace(null); return
    }
    if ((googleStage === 'challenge' || googleStage === 'enrollment') && challenge) {
      window.history.replaceState({}, document.title, window.location.pathname)
      let resolvedSecret = secret ?? ''
      let resolvedUri = ''
      if (googleStage === 'enrollment') {
        try {
          const response = await fetch(`/api/auth?action=enrollment-secret&challengeToken=${encodeURIComponent(challenge)}`)
          const body = await response.json() as { secret?: string; uri?: string; email?: string; error?: string }
          if (!response.ok) throw new Error(body.error ?? 'Authenticator setup could not be loaded.')
          resolvedSecret = resolvedSecret || body.secret || ''
          resolvedUri = body.uri ?? ''
          if (body.email) setEmail(body.email)
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'Authenticator setup could not be loaded.') }
      }
      setChallengeToken(challenge); setTotpSecret(resolvedSecret); setTotpUri(resolvedUri); setTotpSetupMethod(resolvedUri ? 'qr' : 'manual'); setPhase(googleStage); configureDatabaseWorkspace(null); return
    }
    const activeSession = await getCurrentSession()
    if (activeSession) {
      const workspaceId = activeSession.user.user_metadata?.workspace_id
      if (workspaceId) {
        setSession(activeSession); configureDatabaseWorkspace(workspaceId); setPhase('workspace'); return
      }
    }
    try { const bootstrapStatus = await getBootstrapStatus(); setBootstrapAvailable(bootstrapStatus.available) }
    catch { setBootstrapAvailable(false) }
    configureDatabaseWorkspace(null); setSession(null); setPhase('sign-in')
  }, [])

  useEffect(() => {
    void loadSession()
    const handleAuthChange = () => { void loadSession() }
    const handleStorage = (event: StorageEvent) => { if (event.key === authSessionStorageKey) void loadSession() }
    window.addEventListener(authChangeEvent, handleAuthChange)
    window.addEventListener('storage', handleStorage)
    return () => { window.removeEventListener(authChangeEvent, handleAuthChange); window.removeEventListener('storage', handleStorage) }
  }, [loadSession])

  const beginStage = (stage: 'challenge' | 'enrollment', challenge: string, secret = '', uri = '') => {
    setChallengeToken(challenge); setTotpSecret(secret); setTotpUri(uri); setTotpSetupMethod(uri ? 'qr' : 'manual'); setCode(''); setCodeAnimationStart(-1); setError(''); setPhase(stage)
  }
  const handleSignIn = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setSignInFailed(false); setError('')
    try { const result = await signInWithPassword(email.trim(), password); beginStage(result.stage, result.challengeToken, result.secret, result.uri) }
    catch (cause) { const message = cause instanceof Error ? cause.message : 'Sign-in failed.'; setSignInFailed(message === 'Email or password is incorrect, or this account needs administrator setup.'); setError(message) }
    finally { setBusy(false) }
  }
  const handleInvite = async (event: FormEvent) => {
    event.preventDefault()
    if (password.length < 12) { setError('Use at least 12 characters for your password.'); return }
    if (password !== passwordConfirm) { setError('The passwords do not match.'); return }
    setBusy(true); setError('')
    try { const result = await completeInvite(inviteToken, password); sessionStorage.removeItem(pendingInviteStorageKey); setInviteToken(''); setPassword(''); setPasswordConfirm(''); beginStage(result.stage, result.challengeToken, result.secret, result.uri) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The invitation could not be completed.') }
    finally { setBusy(false) }
  }
  const handleVerify = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const next = await verifyTotp(null, challengeToken, code)
      setSession(next)
      const workspaceId = next.user.user_metadata?.workspace_id
      if (!workspaceId) throw new Error('This account is not connected to a workspace.')
      configureDatabaseWorkspace(workspaceId); setCode(''); setPhase('workspace')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The authenticator code could not be verified.') }
    finally { setBusy(false) }
  }
  const handleBootstrap = async (event: FormEvent) => {
    event.preventDefault()
    if (password.length < 12 || password !== passwordConfirm) { setError(password.length < 12 ? 'Use at least 12 characters for your password.' : 'The passwords do not match.'); return }
    setBusy(true); setError('')
    try { await setBootstrapPassword(email.trim(), password, bootstrapToken); setBootstrapAvailable(false); setNotice('Admin password saved. Sign in to set up authenticator verification.'); setPassword(''); setPasswordConfirm(''); setBootstrapToken(''); setPhase('sign-in') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Owner account setup failed.') }
    finally { setBusy(false) }
  }
  const handleSignOut = async () => { await signOut(); configureDatabaseWorkspace(null); setSession(null); setError(''); setPhase('sign-in') }

  if (phase === 'workspace' && session) return <>{children}</>
  if (phase === 'loading') return <main className="workspace-auth-screen workspace-auth-loading-screen"><section className="workspace-auth-loading-state" role="status" aria-live="polite" aria-busy="true"><div className="workspace-auth-loading-indicator" aria-hidden="true"><span/><LoaderCircle size={27}/><i/></div><h1>Connecting to your workspace</h1><p>Checking your secure session and preparing your dashboard.</p><div className="workspace-auth-loading-progress" aria-hidden="true"><span/></div><small>SECURE WORKSPACE ACCESS</small></section></main>

  return <main className="workspace-auth-screen"><section className={`workspace-auth-card${phase === 'sign-in' || phase === 'bootstrap' || phase === 'enrollment' || phase === 'challenge' || phase === 'invite-password' ? ' workspace-auth-card-featured' : ''}${phase === 'challenge' ? ' workspace-auth-card-challenge' : ''}${phase === 'invite-password' ? ' workspace-auth-card-invite' : ''}`}>
    <div className={`workspace-auth-content${phase === 'invite-password' ? ' workspace-auth-content-invite' : ''}`}>
      <header className="workspace-auth-brand"><span className="workspace-auth-wordmark-frame"><img className="workspace-auth-wordmark" src="/strataforge-wordmark.png" alt="StrataForge Software Solutions"/></span></header>
      {phase === 'sign-in' && <>
        <div className="workspace-auth-intro"><span className="workspace-auth-eyebrow">WORKSPACE ACCESS</span><h1>Welcome back</h1><p>Sign in to access your StrataForge workspace.</p></div>
        <button type="button" className="workspace-auth-google" disabled aria-label="Google sign-in coming soon"><span className="workspace-auth-google-label"><img className="workspace-auth-google-logo" src="/google-g-logo.png" alt="" aria-hidden="true"/>Continue with Google</span><span className="workspace-auth-coming-soon">Coming soon</span></button>
        <div className="workspace-auth-divider"><span>or sign in with email</span></div>
        <form className="workspace-auth-form" onSubmit={handleSignIn}>
          <label>Email address<span className="workspace-auth-input"><Mail size={15}/><input autoComplete="username" type="email" required maxLength={254} value={email} onChange={event => { setEmail(event.target.value); if (signInFailed) { setSignInFailed(false); setError('') } }} placeholder="you@company.com"/></span></label>
          <label>Password<span className={`workspace-auth-input${signInFailed ? ' workspace-auth-input-error' : ''}`}><LockKeyhole size={15}/><input id="signin-password" autoComplete="current-password" type={showSignInPassword ? 'text' : 'password'} required aria-invalid={signInFailed} value={password} onChange={event => { setPassword(event.target.value); if (signInFailed) { setSignInFailed(false); setError('') } }} placeholder="Your password"/><button className="workspace-auth-password-toggle" type="button" aria-label={showSignInPassword ? 'Hide password' : 'Show password'} aria-pressed={showSignInPassword} aria-controls="signin-password" onClick={() => setShowSignInPassword(show => !show)}>{showSignInPassword ? <EyeOff size={16} aria-hidden="true"/> : <Eye size={16} aria-hidden="true"/>}</button></span></label>
          <button className="workspace-auth-primary" type="submit" disabled={busy} aria-busy={busy}>{busy ? <><LoaderCircle className="workspace-auth-spinner" size={15}/>Signing In…</> : 'Sign in'}</button>
        </form>
        <small className="workspace-auth-note">Workspace access is limited to invited members.</small>
        {bootstrapAvailable && <button type="button" className="workspace-auth-link" onClick={() => { setError(''); setPhase('bootstrap') }}>Set up the first workspace admin</button>}
      </>}
      {phase === 'bootstrap' && <>
      <span className="directory-eyebrow">ONE-TIME ADMIN SETUP</span><h1>Set admin password</h1><p>Use the email for an existing workspace admin and the one-time setup key configured on the server.</p>
      <form className="workspace-auth-form" onSubmit={handleBootstrap}>
        <label>Admin email<span className="workspace-auth-input"><Mail size={15}/><input autoFocus autoComplete="email" type="email" required value={email} onChange={event => setEmail(event.target.value)}/></span></label>
        <label>Setup key<span className="workspace-auth-input"><KeyRound size={15}/><input autoComplete="off" type="password" required value={bootstrapToken} onChange={event => setBootstrapToken(event.target.value)}/></span></label>
        <label>New password<span className="workspace-auth-input"><LockKeyhole size={15}/><input id="bootstrap-password" autoComplete="new-password" type={showBootstrapPassword ? 'text' : 'password'} minLength={12} required value={password} onChange={event => setPassword(event.target.value)}/><button className="workspace-auth-password-toggle" type="button" aria-label={showBootstrapPassword ? 'Hide new password' : 'Show new password'} aria-pressed={showBootstrapPassword} aria-controls="bootstrap-password" onClick={() => setShowBootstrapPassword(show => !show)}>{showBootstrapPassword ? <EyeOff size={16} aria-hidden="true"/> : <Eye size={16} aria-hidden="true"/>}</button></span></label>
        <label>Confirm password<span className="workspace-auth-input"><LockKeyhole size={15}/><input id="bootstrap-password-confirm" autoComplete="new-password" type={showBootstrapPasswordConfirm ? 'text' : 'password'} minLength={12} required value={passwordConfirm} onChange={event => setPasswordConfirm(event.target.value)}/><button className="workspace-auth-password-toggle" type="button" aria-label={showBootstrapPasswordConfirm ? 'Hide confirmation password' : 'Show confirmation password'} aria-pressed={showBootstrapPasswordConfirm} aria-controls="bootstrap-password-confirm" onClick={() => setShowBootstrapPasswordConfirm(show => !show)}>{showBootstrapPasswordConfirm ? <EyeOff size={16} aria-hidden="true"/> : <Eye size={16} aria-hidden="true"/>}</button></span></label>
        <button className="workspace-auth-primary" type="submit" disabled={busy}>{busy ? <LoaderCircle className="workspace-auth-spinner" size={15}/> : <ShieldCheck size={15}/>}Save admin password</button>
      </form><button type="button" className="workspace-auth-link" onClick={() => { setError(''); setPhase('sign-in') }}>Back to sign in</button>
      </>}
      {phase === 'invite-password' && <>
      <span className="workspace-auth-eyebrow invite-auth-eyebrow">SECURE INVITATION · STEP 1 OF 2</span>
      <h1>Choose your password</h1><p>Create a password to secure your workspace account. Next, connect your authenticator app.</p>
      <ol className="workspace-auth-stepper" aria-label="Account setup progress">
        <li className="current" aria-current="step"><span>01</span><div><b>Create password</b><small>Current step</small></div></li>
        <span className="workspace-auth-stepper-line" aria-hidden="true"/>
        <li><span>02</span><div><b>Authenticator</b><small>Next step</small></div></li>
      </ol>
      <form className="workspace-auth-form" onSubmit={handleInvite}>
        <label>Create password<span className="workspace-auth-input"><LockKeyhole size={15}/><input id="invite-password" autoFocus autoComplete="new-password" type={showInvitePassword ? 'text' : 'password'} minLength={12} maxLength={128} required aria-describedby="invite-password-guidance" value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 12 characters"/><button className="workspace-auth-password-toggle" type="button" aria-label={showInvitePassword ? 'Hide password' : 'Show password'} aria-pressed={showInvitePassword} aria-controls="invite-password" onClick={() => setShowInvitePassword(show => !show)}>{showInvitePassword ? <EyeOff size={16} aria-hidden="true"/> : <Eye size={16} aria-hidden="true"/>}</button></span></label>
        <div className={`workspace-auth-password-check${password.length >= 12 ? ' met' : ''}`} id="invite-password-guidance" aria-live="polite"><span>{password.length >= 12 && <Check size={13}/>}</span><small>{password.length >= 12 ? 'Password meets the 12-character minimum.' : 'Use 12–128 characters.'}</small></div>
        <label>Confirm password<span className={`workspace-auth-input${passwordConfirm && password !== passwordConfirm ? ' workspace-auth-input-mismatch' : ''}${passwordConfirm && password === passwordConfirm ? ' workspace-auth-input-valid' : ''}`}><LockKeyhole size={15}/><input id="invite-password-confirm" autoComplete="new-password" type={showInvitePasswordConfirm ? 'text' : 'password'} minLength={12} maxLength={128} required aria-invalid={Boolean(passwordConfirm && password !== passwordConfirm)} aria-describedby="invite-password-match" value={passwordConfirm} onChange={event => setPasswordConfirm(event.target.value)} placeholder="Re-enter your password"/><button className="workspace-auth-password-toggle" type="button" aria-label={showInvitePasswordConfirm ? 'Hide confirmation password' : 'Show confirmation password'} aria-pressed={showInvitePasswordConfirm} aria-controls="invite-password-confirm" onClick={() => setShowInvitePasswordConfirm(show => !show)}>{showInvitePasswordConfirm ? <EyeOff size={16} aria-hidden="true"/> : <Eye size={16} aria-hidden="true"/>}</button></span></label>
        <div className={`workspace-auth-password-check${passwordConfirm && password === passwordConfirm ? ' met' : ''}${passwordConfirm && password !== passwordConfirm ? ' mismatch' : ''}`} id="invite-password-match" aria-live="polite"><span>{passwordConfirm && password === passwordConfirm && <Check size={13}/>}</span><small>{!passwordConfirm ? 'Re-enter the same password to confirm.' : password === passwordConfirm ? 'Passwords match.' : 'Passwords do not match yet.'}</small></div>
        <button className="workspace-auth-primary" type="submit" disabled={busy || password.length < 12 || password !== passwordConfirm}>{busy ? <LoaderCircle className="workspace-auth-spinner" size={15}/> : <ShieldCheck size={15}/>}Continue to authenticator setup</button>
      </form>
      </>}
      {(phase === 'enrollment' || phase === 'challenge') && <>
      <h1>{phase === 'enrollment' ? 'Set up two-factor sign-in' : 'Enter your code'}</h1>
      <p>{phase === 'enrollment' ? 'Add this key to your authenticator app, then enter its six-digit code.' : 'Enter the six-digit code from your authenticator app to continue.'}</p>
      {phase === 'enrollment' && <ol className="workspace-auth-stepper workspace-auth-stepper-enrollment" aria-label="Account setup progress"><li className="complete"><span><Check size={13}/></span><div><b>Create password</b><small>Complete</small></div></li><span className="workspace-auth-stepper-line" aria-hidden="true"/><li className="current" aria-current="step"><span>02</span><div><b>Authenticator</b><small>Current step</small></div></li></ol>}
      {phase === 'enrollment' && <div className="workspace-auth-setup">
        <div className="workspace-auth-setup-tabs" role="tablist" aria-label="Authenticator setup method">
          <button id="authenticator-qr-tab" type="button" role="tab" aria-selected={totpSetupMethod === 'qr'} aria-controls="authenticator-qr-panel" disabled={!totpUri} onClick={() => setTotpSetupMethod('qr')}>Scan QR code</button>
          <button id="authenticator-manual-tab" type="button" role="tab" aria-selected={totpSetupMethod === 'manual'} aria-controls="authenticator-manual-panel" onClick={() => { setShowLargeQr(false); setTotpSetupMethod('manual') }}>Enter setup key</button>
        </div>
        {totpSetupMethod === 'qr' && totpUri ? <div className="workspace-auth-qr-panel workspace-auth-method-slide workspace-auth-method-slide-left" id="authenticator-qr-panel" role="tabpanel" aria-labelledby="authenticator-qr-tab">
          <div className="workspace-auth-qr"><button type="button" className="workspace-auth-qr-trigger" aria-label="Enlarge authenticator QR code" onClick={() => setShowLargeQr(true)}><QRCodeSVG value={totpUri} size={144} level="M" includeMargin title="Authenticator setup QR code"/><span>Click to enlarge</span></button></div>
          <div><b>Scan with your authenticator</b><small>Open your authenticator app and scan this code. Click the QR image to enlarge it.</small></div>
        </div> : <div className="workspace-auth-secret workspace-auth-method-slide workspace-auth-method-slide-right" id="authenticator-manual-panel" role="tabpanel" aria-labelledby="authenticator-manual-tab"><small>Authenticator setup key</small><code>{totpSecret}</code></div>}
        <small className="workspace-auth-setup-account">Account: {email || 'your invited workspace email'}</small>
        <dialog ref={qrDialogRef} className="workspace-auth-qr-dialog" aria-labelledby="authenticator-qr-dialog-title" onCancel={event => { event.preventDefault(); setShowLargeQr(false) }} onClose={() => setShowLargeQr(false)} onClick={event => { if (event.target === event.currentTarget) setShowLargeQr(false) }}>
          <div className="workspace-auth-qr-dialog-content">
            <header><div><h2 id="authenticator-qr-dialog-title">Scan your authenticator QR code</h2><p>Scan this code with your authenticator app.</p></div><button type="button" aria-label="Close enlarged QR code" onClick={() => setShowLargeQr(false)}><X size={18}/></button></header>
            <div className="workspace-auth-qr-large"><QRCodeSVG value={totpUri} size={320} level="M" includeMargin title="Enlarged authenticator setup QR code"/></div>
            <small>Keep this code private. You can also use the manual setup key.</small>
          </div>
        </dialog>
      </div>}
      <form className="workspace-auth-form" onSubmit={handleVerify}>
        <label>Authenticator code<span className="workspace-auth-code-entry" onClick={() => { const input = codeInputRef.current; input?.focus(); input?.setSelectionRange(code.length, code.length) }}><span className="workspace-auth-code-cells" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => { const entering = index >= codeAnimationStart && index < code.length; return <Fragment key={entering ? `${index}-${codeAnimationId}` : index}><span className="workspace-auth-code-cell" data-active={index === Math.min(code.length, 5)} data-filled={index < code.length} data-entering={entering}>{code[index] ?? '0'}</span>{index === 2 && <span className="workspace-auth-code-separator">–</span>}</Fragment> })}</span><input ref={codeInputRef} className="workspace-auth-code-native" autoFocus inputMode="numeric" autoComplete="one-time-code" aria-label="Authenticator code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={event => updateAuthenticatorCode(event.target.value)}/></span></label>
        <button className="workspace-auth-primary" type="submit" disabled={busy || code.length !== 6}>{busy ? <LoaderCircle className="workspace-auth-spinner" size={15}/> : <ArrowRight size={15}/>} {phase === 'enrollment' ? 'Enable and continue' : 'Verify and continue'}</button>
      </form><button type="button" className="workspace-auth-link" onClick={() => void handleSignOut()}>Back to sign in</button>
      </>}
      {notice && <div className="workspace-config-check-result ready" role="status">{notice}</div>}
      {error && <div className="workspace-auth-error" role="alert">{error}</div>}
    </div>
    {(phase === 'sign-in' || phase === 'bootstrap' || phase === 'enrollment' || phase === 'challenge' || phase === 'invite-password') && <aside key={phase} className="workspace-auth-visual" aria-labelledby="workspace-auth-visual-title" onCopy={event => event.preventDefault()}>
      {phase === 'invite-password' ? <div className="workspace-invite-art" aria-hidden="true">
        <div className="workspace-invite-art-heading"><span>STRATAFORGE / ACCESS PATH</span><i>SETUP</i></div>
        <div className="workspace-invite-route">
          <div className="workspace-invite-route-top"><span>WORKSPACE INVITATION</span><span className="workspace-invite-route-status"><i/> READY TO SET UP</span></div>
          <div className="workspace-invite-route-step current"><span className="workspace-invite-route-number">01</span><div><b>Create your password</b><small>Make this account yours</small></div><span className="workspace-invite-route-state">NOW</span></div>
          <div className="workspace-invite-route-connector"><i/></div>
          <div className="workspace-invite-route-step"><span className="workspace-invite-route-number">02</span><div><b>Connect authenticator</b><small>Use your authenticator app</small></div><span className="workspace-invite-route-state">NEXT</span></div>
          <div className="workspace-invite-route-connector muted"><i/></div>
          <div className="workspace-invite-destination"><span className="workspace-invite-destination-icon"><ArrowRight size={18}/></span><div><small>DESTINATION</small><b>Your StrataForge workspace</b></div><span className="workspace-invite-destination-arrow">↗</span></div>
        </div>
        <div className="workspace-invite-key-card"><div className="workspace-invite-key-icon"><KeyRound size={19}/></div><div><small>ACCOUNT PASSWORD</small><b>Private to you</b><span><i/><i/><i/><i/><i/><i/><i/><i/></span></div><span className="workspace-invite-key-lock"><LockKeyhole size={14}/></span></div>
        <span className="workspace-invite-art-spark invite-spark-one"/><span className="workspace-invite-art-spark invite-spark-two"/>
      </div> : <div className={`workspace-login-art${phase === 'enrollment' || phase === 'challenge' ? ' workspace-auth-security-art' : ''}`} aria-hidden="true">
        {(phase === 'enrollment' || phase === 'challenge') ? <div className="workspace-security-illustration">
          <div className="workspace-security-orbit"/>
          <svg className="workspace-security-circuit-layer" viewBox="0 0 520 490" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><path d="M42 216h61q17 0 17-17v-76q0-17 17-17h220q18 0 18 18v91q0 18-18 18h-26M357 251v77q0 18-18 18H177q-18 0-18-18v-33M118 106h-34q-18 0-18 18v28"/><path className="workspace-security-circuit-accent" d="M177 351h-34q-16 0-16-16v-23"/><circle cx="42" cy="216" r="5"/><circle cx="357" cy="106" r="5"/><circle cx="159" cy="318" r="5"/><circle className="workspace-security-circuit-node-accent" cx="127" cy="335" r="4"/></svg>
          <div className="workspace-security-back-card"><span/><span/><span/></div>
          <div className="workspace-security-methods"><small>STRATAFORGE ACCESS</small><div><span>01</span><b>Password</b><i/><span>02</span><b>One-time code</b></div><em>Two-step verification for each sign-in</em></div>
          <div className="workspace-security-shield"><ShieldCheck size={52}/></div>
          <div className="workspace-security-phone"><Smartphone size={27}/><span>AUTHENTICATOR</span><div className="workspace-security-code"><i/><i/><i/><i/><i/><i/></div><small>One-time code</small></div>
          <div className="workspace-security-status"><span><ShieldCheck size={16}/></span><div><small>SECURITY CHECK</small><b>Authenticator app</b><em>One-time code required</em></div><i/></div>
          <span className="workspace-login-art-spark spark-one"/><span className="workspace-login-art-spark spark-two"/>
        </div> : <>
        <div className="workspace-login-art-orbit"/>
        <svg className="workspace-login-circuit-layer" viewBox="0 0 520 390" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><path d="M12 204h44q18 0 18-18v-82q0-18 18-18h107M178 345h-58q-18 0-18-18v-26M349 70h68q18 0 18 18v43q0 16 16 16h46M432 299h26q17 0 17-17v-39"/><circle cx="12" cy="204" r="5"/><circle cx="199" cy="86" r="5"/><circle cx="349" cy="70" r="5"/><circle cx="432" cy="299" r="5"/><circle className="workspace-login-circuit-node-accent" cx="96" cy="301" r="4"/></svg>
        <div className="workspace-login-board">
          <div className="workspace-login-board-heading"><span>STRATAFORGE / WORKSPACE MAP</span><i/><i/><i/></div>
          <div className="workspace-login-flow">
            <div className="workspace-login-flow-card"><span className="workspace-login-flow-icon leads">L</span><b>Leads</b><small>Capture inquiries</small></div>
            <span className="workspace-login-flow-arrow"/>
            <div className="workspace-login-flow-card"><span className="workspace-login-flow-icon clients">C</span><b>Clients</b><small>Build relationships</small></div>
            <span className="workspace-login-flow-arrow"/>
            <div className="workspace-login-flow-card"><span className="workspace-login-flow-icon projects">P</span><b>Projects</b><small>Deliver the work</small></div>
          </div>
          <div className="workspace-login-board-footer"><span/><span/><span/></div>
        </div>
        <div className="workspace-login-float-card workspace-login-inquiry-card"><span className="workspace-login-inquiry-avatar">J</span><div><small>NEW INQUIRY</small><b>Website project</b><em>Contact details ready</em></div><i>↗</i></div>
        <div className="workspace-login-float-card workspace-login-workflow-card"><div className="workspace-login-workflow-heading"><span>STRATAFORGE WORKFLOW</span><i>OVERVIEW</i></div><div className="workspace-login-workflow-steps"><b>Capture</b><span/><b>Connect</b><span/><b>Deliver</b></div><small>One path from inquiry to delivery</small></div>
        <div className="workspace-login-system-pill"><i/><span>WORKSPACE IN SYNC</span></div>
        <span className="workspace-login-art-spark spark-one"/><span className="workspace-login-art-spark spark-two"/>
        </>}
      </div>}
      <div className="workspace-auth-visual-copy"><span>{phase === 'bootstrap' ? 'SECURE WORKSPACE SETUP' : phase === 'enrollment' ? 'TWO-FACTOR SECURITY' : phase === 'challenge' ? 'SECURE SIGN-IN' : phase === 'invite-password' ? 'YOUR WAY INTO STRATAFORGE' : 'STRATAFORGE WORKSPACE'}</span><h2 id="workspace-auth-visual-title">{phase === 'bootstrap' ? 'Set up your secure workspace access.' : phase === 'enrollment' ? 'Add a second layer of protection.' : phase === 'challenge' ? 'Your workspace is protected.' : phase === 'invite-password' ? 'A clear path into your workspace.' : 'From first inquiry to project delivery.'}</h2><p>{phase === 'bootstrap' ? 'Create your admin password, then finish authenticator setup before opening the workspace.' : phase === 'enrollment' ? 'Pair your authenticator app, then verify with a six-digit code.' : phase === 'challenge' ? 'Enter the current authenticator code to continue.' : phase === 'invite-password' ? 'Choose your password, connect an authenticator, and get ready to work.' : 'Keep client relationships and delivery work connected in one place.'}</p></div>
    </aside>}
  </section></main>
}

