import { useEffect, useState } from 'react'
import { Bell, Camera, Check, Clock3, Globe2, ImagePlus, LoaderCircle, LockKeyhole, Save, Trash2, UserRound, X } from 'lucide-react'
import { CustomSelect } from '../components/CustomControls'
import { showWorkspaceToast } from '../lib/workspaceToast'
import { announceProfilePhotoChange, getCurrentSession, getOwnProfilePhoto, removeOwnProfilePhoto, uploadOwnProfilePhoto, type SupabaseSession } from '../lib/supabase'
import { useDatabaseCollection } from '../lib/database'

type Preferences = { name: string; language: string; timeZone: string; emailUpdates: boolean; taskReminders: boolean; productUpdates: boolean }
const defaults: Preferences = { name: '', language: 'English', timeZone: 'Asia/Manila (UTC+8)', emailUpdates: true, taskReminders: true, productUpdates: false }

export default function SettingsPage() {
  const [session, setSession] = useState<SupabaseSession | null>(null)
  const [settingsByUser, setSettingsByUser] = useDatabaseCollection<Record<string, Preferences>>('accountSettings', {})
  const [saved, setSaved] = useState(false)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null)
  const [photoLoading, setPhotoLoading] = useState(true)
  const [photoSaving, setPhotoSaving] = useState(false)
  const [photoError, setPhotoError] = useState('')
  useEffect(() => {
    let active = true
    void getCurrentSession().then(async current => {
      if (!active) return
      setSession(current)
      if (!current) { setPhotoLoading(false); return }
      try {
        const url = await getOwnProfilePhoto(current)
        if (active) setPhotoUrl(url)
      } catch (error) {
        if (active) setPhotoError(error instanceof Error ? error.message : 'Profile photo could not be loaded.')
      } finally {
        if (active) setPhotoLoading(false)
      }
    })
    return () => { active = false }
  }, [])
  useEffect(() => () => { if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl) }, [photoPreviewUrl])
  const userId = session?.user.id ?? ''
  const metadata = session?.user.user_metadata as { full_name?: string; name?: string } | undefined
  const profileName = metadata?.full_name ?? metadata?.name ?? session?.user.email?.split('@')[0] ?? ''
  const settings: Preferences = { ...defaults, name: profileName, ...(userId ? settingsByUser[userId] : {}) }
  const initial = settings.name.trim().charAt(0).toUpperCase() || '?'
  const update = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    if (!userId) return
    const next = { ...settings, [key]: value }
    setSettingsByUser(current => ({ ...current, [userId]: next }))
    setSaved(false)
  }
  const restoreDefaults = () => {
    if (userId) setSettingsByUser(current => ({ ...current, [userId]: { ...defaults, name: profileName } }))
    setSaved(false)
  }
  const choosePhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setPhotoError('')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setPhotoError('Choose a JPG, PNG, or WebP image.'); return }
    if (file.size < 1 || file.size > 5 * 1024 * 1024) { setPhotoError('Choose an image up to 5 MB.'); return }
    setPhotoPreviewUrl(URL.createObjectURL(file))
    setPendingPhoto(file)
  }
  const cancelPhotoPreview = () => {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
    setPhotoPreviewUrl(null)
    setPendingPhoto(null)
    setPhotoError('')
  }
  const savePhoto = async () => {
    if (!pendingPhoto) return
    setPhotoSaving(true)
    setPhotoError('')
    try {
      const current = await getCurrentSession()
      if (!current) throw new Error('Your sign-in session expired. Sign in again.')
      const nextUrl = await uploadOwnProfilePhoto(current, pendingPhoto)
      setPhotoUrl(nextUrl)
      announceProfilePhotoChange(nextUrl)
      cancelPhotoPreview()
      showWorkspaceToast('Profile photo updated.')
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'Profile photo could not be uploaded.')
    } finally { setPhotoSaving(false) }
  }
  const removePhoto = async () => {
    setPhotoSaving(true)
    setPhotoError('')
    try {
      const current = await getCurrentSession()
      if (!current) throw new Error('Your sign-in session expired. Sign in again.')
      await removeOwnProfilePhoto(current)
      setPhotoUrl(null)
      announceProfilePhotoChange(null)
      showWorkspaceToast('Profile photo removed.')
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'Profile photo could not be removed.')
    } finally { setPhotoSaving(false) }
  }

  return <div className="directory-page account-settings-page">
    <div className="directory-heading"><div><span className="directory-eyebrow">ACCOUNT</span><h1>Account settings</h1><p>Manage your profile, workspace notifications, and regional preferences.</p></div></div>
    <form className="account-settings-layout" onSubmit={event => { event.preventDefault(); setSaved(true); showWorkspaceToast('Settings saved to Supabase.') }}>
      <section className="account-settings-card">
        <div className="account-settings-head"><span><UserRound size={19}/></span><div><h2>Profile</h2><p>Basic information associated with your account.</p></div></div>
        <div className="account-settings-body"><div className="account-settings-fields"><label>Display name<input required value={settings.name} onChange={event => update('name', event.target.value)} disabled={!userId}/></label><label>Email address<input type="email" value={session?.user.email ?? ''} readOnly/></label></div><div className="account-profile-meta profile-photo-row"><span className="account-settings-avatar profile-photo-preview">{photoPreviewUrl || photoUrl ? <img src={photoPreviewUrl ?? photoUrl ?? ''} alt=""/> : <span>{initial}</span>}</span><span className="profile-photo-copy"><b>Profile photo</b><small>{photoLoading ? 'Loading your photo…' : pendingPhoto ? 'Preview ready. Save to apply this photo.' : 'JPG, PNG, or WebP · up to 5 MB'}</small></span><div className="profile-photo-actions"><label className="profile-photo-button" aria-disabled={!userId || photoSaving}><Camera size={14}/>Change photo<input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose a profile photo" disabled={!userId || photoSaving} onChange={choosePhoto}/></label>{pendingPhoto && <><button type="button" className="profile-photo-save" onClick={() => void savePhoto()} disabled={photoSaving}>{photoSaving ? <LoaderCircle size={13} className="profile-photo-spinner"/> : <ImagePlus size={13}/>}Save photo</button><button type="button" className="profile-photo-cancel" onClick={cancelPhotoPreview} disabled={photoSaving}><X size={13}/>Cancel</button></>}{photoUrl && !pendingPhoto && <button type="button" className="profile-photo-remove" onClick={() => void removePhoto()} disabled={photoSaving}>{photoSaving ? <LoaderCircle size={13} className="profile-photo-spinner"/> : <Trash2 size={13}/>}Remove</button>}</div>{photoError && <div className="profile-photo-error" role="alert">{photoError}</div>}</div></div>
      </section>

      <section className="account-settings-card">
        <div className="account-settings-head"><span className="blue"><Bell size={19}/></span><div><h2>Notifications</h2><p>Choose which updates you want to receive.</p></div></div>
        <div className="account-settings-body settings-option-list">
          <label className="settings-toggle"><span><b>Email activity updates</b><small>Receive important changes to leads, clients, and projects.</small></span><input type="checkbox" checked={settings.emailUpdates} onChange={event => update('emailUpdates', event.target.checked)}/><i aria-hidden="true"/></label>
          <label className="settings-toggle"><span><b>Task reminders</b><small>Get reminders for tasks approaching their due date.</small></span><input type="checkbox" checked={settings.taskReminders} onChange={event => update('taskReminders', event.target.checked)}/><i aria-hidden="true"/></label>
          <label className="settings-toggle"><span><b>Product announcements</b><small>Hear about new workspace features and improvements.</small></span><input type="checkbox" checked={settings.productUpdates} onChange={event => update('productUpdates', event.target.checked)}/><i aria-hidden="true"/></label>
        </div>
      </section>

      <section className="account-settings-card">
        <div className="account-settings-head"><span className="purple"><Globe2 size={19}/></span><div><h2>Regional preferences</h2><p>Set the language and time zone used across your workspace.</p></div></div>
        <div className="account-settings-body"><div className="account-settings-fields"><label>Language<CustomSelect ariaLabel="Language" value={settings.language} options={['English', 'Filipino']} onChange={value => update('language', value)}/></label><label>Time zone<CustomSelect ariaLabel="Time zone" value={settings.timeZone} options={['Asia/Manila (UTC+8)', 'UTC', 'America/New_York (UTC−5)']} onChange={value => update('timeZone', value)}/></label></div><div className="settings-time-note"><Clock3 size={14}/>Dates and times are displayed using {settings.timeZone}.</div></div>
      </section>

      <section className="account-settings-card account-security-card">
        <div className="account-settings-head"><span className="green"><LockKeyhole size={19}/></span><div><h2>Sign-in and security</h2><p>Security controls for your account.</p></div></div>
        <div className="account-settings-body"><div className="security-status-row"><span><b>Password and two-factor authentication</b><small>Sign-in and required TOTP verification are managed by Supabase Auth.</small></span><span className="security-unavailable">Supabase Auth</span></div></div>
      </section>

      <div className="account-settings-actions"><span>{saved ? <><Check size={14}/> Saved to the workspace.</> : 'Preferences are stored in your Supabase workspace.'}</span><div><button type="button" className="settings-reset" onClick={restoreDefaults}>Restore defaults</button><button type="submit" className="settings-save" disabled={!userId}><Save size={15}/>{saved ? 'Saved' : 'Save changes'}</button></div></div>
    </form>
  </div>
}
