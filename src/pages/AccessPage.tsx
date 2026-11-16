import { ExternalLink, ShieldCheck, Users } from 'lucide-react'
import { DirectoryHeader } from '../components/DirectoryShared'

export default function AccessPage() {
  return <div className="directory-page admin-page access-page">
    <DirectoryHeader section="ADMINISTRATION" title="Access" description="Workspace accounts are authenticated by Supabase and restricted by workspace membership."/>
    <section className="admin-panel">
      <div className="admin-panel-head"><div><h2><Users size={17}/> Workspace membership</h2><span>Managed through Supabase Auth and workspace_members</span></div></div>
      <div className="admin-empty"><ShieldCheck size={22}/><b>Member invites are managed in Supabase</b><span>Invite a user in Supabase Authentication, then add their Auth user ID and email to this workspace’s workspace_members table. Their first sign-in requires authenticator setup before CRM access.</span></div>
      <div className="admin-panel-foot"><span>Only authenticated workspace members can access CRM records.</span><a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">Open Supabase Dashboard <ExternalLink size={13}/></a></div>
    </section>
  </div>
}
