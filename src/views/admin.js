import { supabase } from '../supabase.js'
import { toast } from '../utils.js'

async function adminRequest(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { action, ...payload }
  })
  if (error) {
    const contextMessage = error.context ? await error.context.json().catch(() => null) : null
    throw new Error(contextMessage?.error || error.message || 'Die Benutzerverwaltung ist nicht erreichbar.')
  }
  if (data?.error) throw new Error(data.error)
  return data
}

async function loadUsers() {
  const data = await adminRequest('list')
  return data?.users || []
}

function userStatus(user) {
  if (user.role === 'admin') return 'Administrator'
  return user.active ? 'Aktiv' : 'Gesperrt'
}

function passwordDialog(user, rerender) {
  const modal = document.createElement('div')
  modal.className = 'modal'
  modal.innerHTML = `<div class="modal-card">
    <h2>Passwort setzen</h2>
    <p>Neues Passwort für <strong>${user.email}</strong>.</p>
    <form id="passwordForm" class="form-grid">
      <label>Neues Passwort<input id="managedPassword" type="password" minlength="10" autocomplete="new-password" required></label>
      <label>Passwort wiederholen<input id="managedPasswordRepeat" type="password" minlength="10" autocomplete="new-password" required></label>
      <div class="modal-actions"><button type="button" id="cancelPassword" class="secondary">Abbrechen</button><button class="primary">Passwort speichern</button></div>
    </form>
  </div>`
  document.body.append(modal)
  modal.querySelector('#cancelPassword').addEventListener('click', () => modal.remove())
  modal.querySelector('#passwordForm').addEventListener('submit', async event => {
    event.preventDefault()
    const password = modal.querySelector('#managedPassword').value
    const repeat = modal.querySelector('#managedPasswordRepeat').value
    if (password !== repeat) return toast('Die Passwörter stimmen nicht überein.')
    const button = event.currentTarget.querySelector('button[type="submit"]')
    button.disabled = true
    try {
      await adminRequest('password', { user_id: user.id, password })
      modal.remove()
      toast('Passwort wurde geändert.')
      await rerender()
    } catch (error) {
      toast(error.message)
      button.disabled = false
    }
  })
}

export async function renderAdmin() {
  const content = document.querySelector('#content')
  content.innerHTML = '<article class="panel"><h2>Benutzerverwaltung</h2><p>Zugänge werden geladen …</p></article>'

  try {
    const users = await loadUsers()
    content.innerHTML = `<div class="admin-grid">
      <article class="panel">
        <h2>Benutzer direkt anlegen</h2>
        <p class="muted">Name, E-Mail und Startpasswort eingeben. Der Zugang ist danach sofort verwendbar; eine E-Mail-Bestätigung ist nicht erforderlich.</p>
        <form id="createUserForm" class="form-grid">
          <label>Name<input id="newUserName" autocomplete="name" required></label>
          <label>E-Mail<input id="newUserEmail" type="email" autocomplete="off" required></label>
          <label>Startpasswort<input id="newUserPassword" type="password" minlength="10" autocomplete="new-password" required></label>
          <label>Passwort wiederholen<input id="newUserPasswordRepeat" type="password" minlength="10" autocomplete="new-password" required></label>
          <button class="primary">Benutzer anlegen</button>
        </form>
        <p class="muted"><small>Das Passwort muss mindestens 10 Zeichen lang sein. Der Benutzer sollte es nach der ersten Anmeldung ändern.</small></p>
      </article>

      <article class="panel">
        <div class="panel-head"><div><h2>Vorhandene Benutzer</h2><p>${users.length} Zugang/Zugänge</p></div><button id="reloadUsers" class="secondary">Aktualisieren</button></div>
        <div class="user-list">${users.map(user => `<div class="managed-user">
          <div><strong>${user.full_name || user.email}</strong><small>${user.email}</small><span class="role-badge ${user.role}">${userStatus(user)}</span></div>
          ${user.role === 'admin' ? '' : `<div class="managed-actions">
            <button class="secondary password-user" data-id="${user.id}">Passwort setzen</button>
            <button class="${user.active ? 'danger' : 'secondary'} toggle-user" data-id="${user.id}" data-active="${user.active}">${user.active ? 'Sperren' : 'Reaktivieren'}</button>
            <button class="danger delete-user" data-id="${user.id}">Entfernen</button>
          </div>`}
        </div>`).join('')}</div>
      </article>
    </div>`

    document.querySelector('#reloadUsers')?.addEventListener('click', renderAdmin)

    document.querySelector('#createUserForm')?.addEventListener('submit', async event => {
      event.preventDefault()
      const password = document.querySelector('#newUserPassword').value
      const repeat = document.querySelector('#newUserPasswordRepeat').value
      if (password !== repeat) return toast('Die Passwörter stimmen nicht überein.')
      const button = event.currentTarget.querySelector('button[type="submit"]')
      button.disabled = true
      button.textContent = 'Benutzer wird angelegt …'
      try {
        await adminRequest('create', {
          full_name: document.querySelector('#newUserName').value.trim(),
          email: document.querySelector('#newUserEmail').value.trim(),
          password
        })
        toast('Benutzer wurde angelegt und kann sich sofort anmelden.')
        await renderAdmin()
      } catch (error) {
        toast(error.message)
        button.disabled = false
        button.textContent = 'Benutzer anlegen'
      }
    })

    const byId = id => users.find(user => user.id === id)
    document.querySelectorAll('.password-user').forEach(button => button.addEventListener('click', () => passwordDialog(byId(button.dataset.id), renderAdmin)))

    document.querySelectorAll('.toggle-user').forEach(button => button.addEventListener('click', async () => {
      const activate = button.dataset.active !== 'true'
      try {
        await adminRequest('toggle', { user_id: button.dataset.id, active: activate })
        toast(activate ? 'Zugang wurde reaktiviert.' : 'Zugang wurde gesperrt.')
        await renderAdmin()
      } catch (error) { toast(error.message) }
    }))

    document.querySelectorAll('.delete-user').forEach(button => button.addEventListener('click', async () => {
      const user = byId(button.dataset.id)
      if (!window.confirm(`Zugang ${user.email} wirklich vollständig entfernen?`)) return
      try {
        await adminRequest('delete', { user_id: user.id })
        toast('Benutzer wurde entfernt.')
        await renderAdmin()
      } catch (error) { toast(error.message) }
    }))
  } catch (error) {
    content.innerHTML = `<article class="panel"><h2>Benutzerverwaltung nicht erreichbar</h2><p class="bad">${error.message}</p><p>Bitte Migration <code>005_v15_1_direct_admin_users.sql</code> ausführen und die Edge Function unter dem exakten Namen <code>admin-users</code> bereitstellen.</p><button id="retryAdmin" class="primary">Erneut versuchen</button></article>`
    document.querySelector('#retryAdmin')?.addEventListener('click', renderAdmin)
  }
}
