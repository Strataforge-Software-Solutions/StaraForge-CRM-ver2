import { ArrowRight, KeyRound, LockKeyhole, Monitor, ShieldAlert, ShieldCheck } from 'lucide-react'

export default function SecurityPage({ onManageAccess }: { onManageAccess: () => void }) {
  return <div className="directory-page admin-page security-page">
    <div className="directory-heading"><div><span className="directory-eyebrow">ACCOUNT</span><h1>Security</h1><p>Review sign-in protection, two-factor policy, and account recovery.</p></div></div>

    <section className="security-connection-banner">
      <span><ShieldAlert size={20}/></span>
      <div><b>Supabase Auth protects this workspace</b><p>CRM data requires an authenticated workspace member with a verified TOTP factor. Membership and data access are enforced by Supabase row-level security.</p></div>
      <strong>Protected</strong>
    </section>

    <div className="security-settings-grid">
      <section className="account-settings-card security-feature-card">
        <div className="account-settings-head"><span className="green"><ShieldCheck size={19}/></span><div><h2>Two-factor authentication</h2><p>Extra verification is required for workspace members.</p></div></div>
        <div className="security-feature-body">
          <div className="security-feature-status"><span className="security-feature-icon green"><KeyRound size={19}/></span><span><b>Required for invitations</b><small>New members are marked for MFA setup before workspace access.</small></span><strong className="security-policy-badge">Required</strong></div>
          <p className="security-feature-note">The app verifies TOTP during sign-in and requires MFA assurance for CRM data requests.</p>
          <button className="security-manage-button" onClick={onManageAccess}>Manage workspace access <ArrowRight size={15}/></button>
        </div>
      </section>

      <section className="account-settings-card security-feature-card">
        <div className="account-settings-head"><span className="blue"><LockKeyhole size={19}/></span><div><h2>Password &amp; recovery</h2><p>Protect account credentials and recovery methods.</p></div></div>
        <div className="security-feature-body">
          <div className="security-feature-status"><span className="security-feature-icon blue"><LockKeyhole size={19}/></span><span><b>Password management</b><small>Password changes and recovery are handled by Supabase Auth.</small></span><strong className="security-unavailable">Supabase Auth</strong></div>
          <div className="security-feature-status"><span className="security-feature-icon orange"><ShieldAlert size={19}/></span><span><b>Account recovery</b><small>Contact a workspace administrator if you lose access to your authenticator.</small></span></div>
        </div>
      </section>

      <section className="account-settings-card security-feature-card">
        <div className="account-settings-head"><span className="purple"><Monitor size={19}/></span><div><h2>Sessions &amp; devices</h2><p>Review where your account is signed in.</p></div></div>
        <div className="security-feature-body">
          <div className="security-empty-state"><Monitor size={22}/><b>Session list isn’t available in this app</b><span>Supabase manages the active authentication session; this screen does not yet show device history.</span></div>
        </div>
      </section>

      <section className="security-admin-note"><ShieldCheck size={18}/><div><b>Workspace admins can help</b><p>Admins can view member 2FA status and mark an enrollment for reset from Access.</p></div><button onClick={onManageAccess}>Open Access <ArrowRight size={14}/></button></section>
    </div>
  </div>
}
