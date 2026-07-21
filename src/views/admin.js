import { supabase } from '../supabase.js'
import { sendReset } from '../auth.js'
import { toast } from '../utils.js'

function appBaseUrl() {
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  return url.toString()
}

async function loadAdminData() {
  const [{ data: users, error: usersError }, { data: invites, error: invitesError }] = await Promise.all([
    supabase.from('profiles').select('id, email, full_name, role, active, created_at').order('created_at'),
    supabase.rpc('list_team_invites')
  ])
  if (usersError) throw usersError
  if (invitesError) throw invitesError
  return { users: users || [], invites: invites || [] }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    toast('Einladungslink kopiert.')
  } catch {
    window.prompt('Einladungslink kopieren:', text)
  }
}

function inviteStatus(invite) {
  if (invite.used_at) return 'Verwendet'
  if (invite.revoked_at) return 'Widerrufen'
  if (new Date(invite.expires_at) < new Date()) return 'Abgelaufen'
  return 'Offen'
}

export async function renderAdmin() {
  const content = document.querySelector('#content')
  content.innerHTML = '<article class="panel"><h2>Benutzerverwaltung</h2><p>Zugänge werden geladen …</p></article>'

  try {
    const { users, invites } = await loadAdminData()
    content.innerHTML = `<div class="admin-grid">
      <article class="panel">
        <h2>Benutzer einladen</h2>
        <p class="muted">CostPilot erzeugt einen sieben Tage gültigen Einmal-Link. Der Benutzer legt sein Passwort selbst fest. Eine Edge Function ist nicht erforderlich.</p>
        <form id="createInviteForm" class="form-grid">
          <label>Name<input id="inviteFullName" autocomplete="name" required></label>
          <label>E-Mail<input id="inviteAdminEmail" type="email" autocomplete="off" required></label>
          <button class="primary">Einladungslink erzeugen</button>
        </form>
        <div id="newInviteResult"></div>
      </article>
      <article class="panel">
        <div class="panel-head"><div><h2>Vorhandene Benutzer</h2><p>${users.length} Zugang/Zugänge</p></div></div>
        <div class="user-list">${users.map(user => `<div class="managed-user">
          <div><strong>${user.full_name || user.email}</strong><small>${user.email}</small><span class="role-badge ${user.role}">${user.role === 'admin' ? 'Administrator' : user.active ? 'Aktiv' : 'Gesperrt'}</span></div>
          ${user.role === 'admin' ? '' : `<div class="managed-actions"><button class="secondary reset-user" data-email="${user.email}">Reset-E-Mail</button><button class="${user.active ? 'danger' : 'secondary'} toggle-user" data-id="${user.id}" data-active="${user.active}">${user.active ? 'Sperren' : 'Reaktivieren'}</button></div>`}
        </div>`).join('')}</div>
      </article>
    </div>

    <article class="panel">
      <div class="panel-head"><div><h2>Einladungen</h2><p>Offene und bereits verwendete Links.</p></div></div>
      <div class="user-list">${invites.length ? invites.map(invite => `<div class="managed-user">
        <div><strong>${invite.full_name || invite.email}</strong><small>${invite.email}</small><span class="role-badge member">${inviteStatus(invite)}</span><small>Gültig bis ${new Date(invite.expires_at).toLocaleString('de-DE')}</small></div>
        ${inviteStatus(invite) === 'Offen' ? `<div class="managed-actions"><button class="danger revoke-invite" data-id="${invite.id}">Widerrufen</button></div>` : ''}
      </div>`).join('') : '<p class="muted">Noch keine Einladungen vorhanden.</p>'}</div>
    </article>`

    document.querySelector('#createInviteForm')?.addEventListener('submit', async event => {
      event.preventDefault()
      const button = event.currentTarget.querySelector('button')
      button.disabled = true
      try {
        const email = document.querySelector('#inviteAdminEmail').value.trim()
        const fullName = document.querySelector('#inviteFullName').value.trim()
        const { data, error } = await supabase.rpc('create_team_invite', { p_email: email, p_full_name: fullName })
        if (error) throw error
        const row = data?.[0]
        if (!row?.invite_token) throw new Error('Einladung konnte nicht erzeugt werden.')
        const link = `${appBaseUrl()}?invite=${encodeURIComponent(row.invite_token)}`
        const result = document.querySelector('#newInviteResult')
        result.innerHTML = `<div class="invite-result"><strong>Einladung erstellt</strong><p>Link an ${email} senden:</p><input id="inviteLink" value="${link}" readonly><button id="copyInvite" class="secondary">Link kopieren</button><small>Gültig bis ${new Date(row.expires_at).toLocaleString('de-DE')}</small></div>`
        document.querySelector('#copyInvite').addEventListener('click', () => copyText(link))
        toast('Einladung wurde erstellt.')
      } catch (error) {
        toast(error.message)
        button.disabled = false
      }
    })

    document.querySelectorAll('.reset-user').forEach(button => button.addEventListener('click', async () => {
      const { error } = await sendReset(button.dataset.email)
      toast(error ? error.message : 'Passwort-Reset-E-Mail wurde versendet.')
    }))

    document.querySelectorAll('.toggle-user').forEach(button => button.addEventListener('click', async () => {
      const activate = button.dataset.active !== 'true'
      const { error } = await supabase.rpc('set_team_user_active', { p_user_id: button.dataset.id, p_active: activate })
      if (error) return toast(error.message)
      toast(activate ? 'Zugang wurde reaktiviert.' : 'Zugang wurde gesperrt.')
      await renderAdmin()
    }))

    document.querySelectorAll('.revoke-invite').forEach(button => button.addEventListener('click', async () => {
      const { error } = await supabase.rpc('revoke_team_invite', { p_invite_id: button.dataset.id })
      if (error) return toast(error.message)
      toast('Einladung wurde widerrufen.')
      await renderAdmin()
    }))
  } catch (error) {
    content.innerHTML = `<article class="panel"><h2>Benutzerverwaltung noch nicht eingerichtet</h2><p class="bad">${error.message}</p><p>Bitte im Supabase SQL Editor einmal die Migration <code>004_v15_invitation_access.sql</code> ausführen.</p><button id="retryAdmin" class="primary">Erneut versuchen</button></article>`
    document.querySelector('#retryAdmin')?.addEventListener('click', renderAdmin)
  }
}
