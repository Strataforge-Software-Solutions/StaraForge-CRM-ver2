import { useEffect, useState } from 'react'
import { Bell, Camera, Check, Clock3, Globe2, ImagePlus, LoaderCircle, LockKeyhole, Save, Trash2, UserRound, X } from 'lucide-react'
import { showWorkspaceToast } from '../lib/workspaceToast'
import { getCurrentSession, type WorkspaceSession } from '../lib/workspaceAccount'
import { updateDatabaseCollection, useDatabaseCollection } from '../lib/database'
import { emptyProfilePhotos, prepareProfilePhoto } from '../lib/profilePhoto'

type Preferences = { name: string; language: string; timeZone: string; emailUpdates: boolean; taskReminders: boolean; productUpdates: boolean }
const defaults: Preferences = { name: '', language: 'English', timeZone: 'Asia/Manila (UTC+8)', emailUpdates: true, taskReminders: true, productUpdates: false }

export default function SettingsPage() {
  const [session, setSession] = useState<WorkspaceSession | null>(null)
  const [settingsByUser] = useDatabaseCollection<Record<string, Preferences>>('accountSettings', {})
  const [draft, setDraft] = useState<Preferences | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [profilePhotos] = useDatabaseCollection<Record<string, string>>('profilePhotos', emptyProfilePhotos)
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
      if (!current) setPhotoLoading(false)
    })
    return () => { active = false }
  }, [])
  useEffect(() => () => { if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl) }, [photoPreviewUrl])
  const userId = session?.user.id ?? ''
  useEffect(() => {
    if (!userId) return
    setPhotoUrl(profilePhotos[userId] ?? null)
    setPhotoLoading(false)
  }, [profilePhotos, userId])
  const metadata = session?.user.user_metadata as { full_name?: string; name?: string } | undefined
  const profileName = metadata?.full_name ?? metadata?.name ?? session?.user.email?.split('@')[0] ?? ''
  const persisted: Preferences = { ...defaults, name: profileName, ...(userId ? settingsByUser[userId] : {}) }
  useEffect(() => { if (userId && !dirty) setDraft(persisted) }, [userId, settingsByUser, profileName, dirty])
  const settings = draft ?? persisted
  const initial = settings.name.trim().charAt(0).toUpperCase() || '?'
  const update = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    if (!userId) return
    setDraft(current => ({ ...(current ?? persisted), [key]: value }))
    setDirty(true)
    setSaved(false)
    setSaveError('')
  }
  const restoreDefaults = () => {
    if (userId) { setDraft({ ...defaults, name: profileName }); setDirty(true) }
    setSaved(false)
    setSaveError('')
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
      const nextUrl = await prepareProfilePhoto(pendingPhoto)
      await updateDatabaseCollection<Record<string, string>>('profilePhotos', {}, photos => ({ ...photos, [current.user.id]: nextUrl }))
      setPhotoUrl(nextUrl)
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
      await updateDatabaseCollection<Record<string, string>>('profilePhotos', {}, photos => {
        const next = { ...photos }
        delete next[current.user.id]
        return next
      })
      setPhotoUrl(null)
      showWorkspaceToast('Profile photo removed.')
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'Profile photo could not be removed.')
    } finally { setPhotoSaving(false) }
  }

  return <div className="directory-page account-settings-page">
    <div className="directory-heading"><div><span className="directory-eyebrow">ACCOUNT</span><h1>Account settings</h1><p>Manage your profile, workspace notifications, and regional preferences.</p></div></div>
    <div className="settings-shell"><nav className="settings-section-nav" aria-label="Settings sections"><span>YOUR ACCOUNT</span><a href="#settings-profile"><UserRound size={16}/>Profile</a><a href="#settings-notifications"><Bell size={16}/>Notifications</a><a href="#settings-regional"><Globe2 size={16}/>Regional preferences</a><a href="#settings-security"><LockKeyhole size={16}/>Sign-in and security</a></nav><form className="account-settings-layout" onSubmit={async event => { event.preventDefault(); if (!userId || !dirty || saving) return; setSaving(true); setSaveError(''); try { await updateDatabaseCollection<Record<string, Preferences>>('accountSettings', {}, current => ({ ...current, [userId]: settings })); setDirty(false); setSaved(true); showWorkspaceToast('Settings saved to the workspace.') } catch (cause) { setSaveError(cause instanceof Error ? cause.message : 'Settings could not be saved.') } finally { setSaving(false) } }}>
      <section className="account-settings-card" id="settings-profile">
        <div className="account-settings-head"><span><UserRound size={19}/></span><div><h2>Profile</h2><p>Basic information associated with your account.</p></div></div>
        <div className="account-settings-body"><div className="account-settings-fields"><label>Display name<input required value={settings.name} onChange={event => update('name', event.target.value)} disabled={!userId}/></label><label>Email address<input type="email" value={session?.user.email ?? ''} readOnly/></label></div><div className="account-profile-meta profile-photo-row"><span className="account-settings-avatar profile-photo-preview">{photoPreviewUrl || photoUrl ? <img src={photoPreviewUrl ?? photoUrl ?? ''} alt=""/> : <span>{initial}</span>}</span><span className="profile-photo-copy"><b>Profile photo</b><small>{photoLoading ? 'Loading your photo…' : pendingPhoto ? 'Preview ready. Save to apply this photo.' : 'JPG, PNG, or WebP · up to 5 MB'}</small></span><div className="profile-photo-actions"><label className="profile-photo-button" aria-disabled={!userId || photoSaving}><Camera size={14}/>Change photo<input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose a profile photo" disabled={!userId || photoSaving} onChange={choosePhoto}/></label>{pendingPhoto && <><button type="button" className="profile-photo-save" onClick={() => void savePhoto()} disabled={photoSaving}>{photoSaving ? <LoaderCircle size={13} className="profile-photo-spinner"/> : <ImagePlus size={13}/>}Save photo</button><button type="button" className="profile-photo-cancel" onClick={cancelPhotoPreview} disabled={photoSaving}><X size={13}/>Cancel</button></>}{photoUrl && !pendingPhoto && <button type="button" className="profile-photo-remove" onClick={() => void removePhoto()} disabled={photoSaving}>{photoSaving ? <LoaderCircle size={13} className="profile-photo-spinner"/> : <Trash2 size={13}/>}Remove</button>}</div>{photoError && <div className="profile-photo-error" role="alert">{photoError}</div>}</div></div>
      </section>

      <section className="account-settings-card" id="settings-notifications">
        <div className="account-settings-head"><span className="blue"><Bell size={19}/></span><div><h2>Notifications</h2><p>Choose which updates you want to receive.</p></div></div>
        <div className="account-settings-body settings-option-list">
          <label className="settings-toggle"><span><b>Workspace activity</b><small>Show lead and follow-up updates in notifications.</small></span><input type="checkbox" checked={settings.emailUpdates} onChange={event => update('emailUpdates', event.target.checked)}/><i aria-hidden="true"/></label>
          <label className="settings-toggle"><span><b>Task reminders</b><small>Show reminders for tasks approaching their due date.</small></span><input type="checkbox" checked={settings.taskReminders} onChange={event => update('taskReminders', event.target.checked)}/><i aria-hidden="true"/></label>

        </div>
      </section>

      <section className="account-settings-card" id="settings-regional">
        <div className="account-settings-head"><span className="purple"><Globe2 size={19}/></span><div><h2>Regional preferences</h2><p>Current language and reporting time zone.</p></div></div>
        <div className="account-settings-body"><div className="settings-region-readonly"><div><span>Language</span><b>English</b></div><div><span>Workspace time zone</span><b>Asia/Manila (UTC+8)</b></div></div><div className="settings-time-note"><Clock3 size={14}/>The CRM currently uses English and Manila time for shared records and reports.</div></div>
      </section>

      <section className="account-settings-card account-security-card" id="settings-security">
        <div className="account-settings-head"><span className="green"><LockKeyhole size={19}/></span><div><h2>Sign-in and security</h2><p>Security controls for your account.</p></div></div>
        <div className="account-settings-body"><div className="security-status-row"><span><b>Password and two-factor authentication</b><small>Password sign-in and required authenticator verification use your standalone workspace account.</small></span><span className="security-policy-badge">Required</span></div></div>
      </section>

      <div className="account-settings-actions"><span>{saveError ? <span role="alert" className="settings-save-error">{saveError}</span> : saved ? <><Check size={14}/> Saved to the workspace.</> : dirty ? 'You have unsaved changes.' : 'Preferences are stored in your workspace.'}</span><div><button type="button" className="settings-reset" onClick={restoreDefaults}>Restore defaults</button><button type="submit" className="settings-save" disabled={!userId || !dirty || saving}><Save size={15}/>{saving ? 'Saving…' : saved ? 'Saved' : 'Save changes'}</button></div></div>
    </form></div>
  </div>
}
