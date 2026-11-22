import { ArrowRight, KeyRound, LockKeyhole, Monitor, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getCurrentSession, type WorkspaceSession } from '../lib/workspaceAccount'

export default function SecurityPage({ onManageAccess, onSignOut }: { onManageAccess: () => void; onSignOut: () => void }) {
  const [session, setSession] = useState<WorkspaceSession | null>(null)
  useEffect(() => { void getCurrentSession().then(setSession) }, [])
  return <div className="directory-page admin-page security-page">
    <div className="directory-heading"><div><span className="directory-eyebrow">ACCOUNT</span><h1>Security</h1><p>Review sign-in protection, two-factor policy, and account recovery.</p></div></div>

    <div className="security-shell"><nav className="settings-section-nav" aria-label="Security sections"><span>ACCOUNT SECURITY</span><a href="#security-overview"><ShieldCheck size={16}/>Overview</a><a href="#security-two-factor"><KeyRound size={16}/>Two-factor authentication</a><a href="#security-recovery"><LockKeyhole size={16}/>Password &amp; recovery</a><a href="#security-sessions"><Monitor size={16}/>Sessions &amp; devices</a></nav><div className="security-content"><section className="security-connection-banner" id="security-overview">
      <span><ShieldAlert size={20}/></span>
      <div><b>Workspace account protection is active</b><p>Standalone workspace accounts use a server-verified session and required TOTP. CRM requests are scoped to the signed-in user’s workspace by the account service.</p></div>
      <strong>Protected</strong>
    </section>

    <div className="security-settings-grid">
      <section className="account-settings-card security-feature-card" id="security-two-factor">
        <div className="account-settings-head"><span className="green"><ShieldCheck size={19}/></span><div><h2>Two-factor authentication</h2><p>Extra verification is required for workspace members.</p></div></div>
        <div className="security-feature-body">
          <div className="security-feature-status"><span className="security-feature-icon green"><KeyRound size={19}/></span><span><b>Required for invitations</b><small>New members are marked for MFA setup before workspace access.</small></span><strong className="security-policy-badge">Required</strong></div>
          <p className="security-feature-note">The app verifies TOTP during sign-in and requires MFA assurance for CRM data requests.</p>
          <button className="security-manage-button" onClick={onManageAccess}>Manage workspace access <ArrowRight size={15}/></button>
        </div>
      </section>

      <section className="account-settings-card security-feature-card" id="security-recovery">
        <div className="account-settings-head"><span className="blue"><LockKeyhole size={19}/></span><div><h2>Password &amp; recovery</h2><p>Protect account credentials and recovery methods.</p></div></div>
        <div className="security-feature-body">
          <div className="security-feature-status"><span className="security-feature-icon blue"><LockKeyhole size={19}/></span><span><b>Password management</b><small>Your password is protected by the workspace account service.</small></span><strong className="security-policy-badge">Protected</strong></div>
          <div className="security-feature-status"><span className="security-feature-icon orange"><ShieldAlert size={19}/></span><span><b>Account recovery</b><small>Contact a workspace administrator if you lose access to your authenticator.</small></span></div>
        </div>
      </section>

      <section className="account-settings-card security-feature-card" id="security-sessions">
        <div className="account-settings-head"><span className="purple"><Monitor size={19}/></span><div><h2>Sessions &amp; devices</h2><p>Review this device’s current sign-in.</p></div></div>
        <div className="security-feature-body">
          <div className="security-current-session"><span className="security-feature-icon blue"><Monitor size={19}/></span><div><b>Current device</b><small>{session?.user.email || 'Loading account…'}</small><small>{session ? `Session expires ${new Date(session.expires_at * 1000).toLocaleString()}` : ''}</small></div><button type="button" onClick={onSignOut}>Sign out</button></div><p className="security-feature-note">Other device history is not available in this workspace yet.</p>
        </div>
      </section>

      <section className="security-admin-note"><ShieldCheck size={18}/><div><b>Workspace admins can help</b><p>Admins can reset your account and issue a fresh setup link from Access.</p></div><button onClick={onManageAccess}>Open Access <ArrowRight size={14}/></button></section>
    </div></div></div>
  </div>
}
