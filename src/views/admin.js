import { supabase } from '../supabase.js'
import { toast } from '../utils.js'

async function callAdmin(body) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body })
  if (error) throw new Error(data?.error || error.message)
  if (data?.error) throw new Error(data.error)
  return data
}

export async function renderAdmin() {
  const content = document.querySelector('#content')
  content.innerHTML = '<article class="panel"><h2>Benutzerverwaltung</h2><p>Benutzer werden geladen …</p></article>'

  try {
    const { users = [] } = await callAdmin({ action: 'list' })
    content.innerHTML = `<div class="admin-grid">
      <article class="panel">
        <h2>Benutzer anlegen</h2>
        <p class="muted">Der neue Benutzer arbeitet im selben CostPilot-Datenbestand. Eine öffentliche Registrierung gibt es nicht.</p>
        <form id="createUserForm" class="form-grid">
          <label>Name<input id="adminFullName" autocomplete="name" required></label>
          <label>E-Mail<input id="adminEmail" type="email" autocomplete="off" required></label>
          <label>Startpasswort<input id="adminPassword" type="password" minlength="10" autocomplete="new-password" required></label>
          <button class="primary">Benutzer anlegen</button>
        </form>
      </article>
      <article class="panel">
        <div class="panel-head"><div><h2>Vorhandene Benutzer</h2><p>${users.length} Zugang/Zugänge</p></div></div>
        <div class="user-list">${users.map(user => `<div class="managed-user">
          <div><strong>${user.full_name || user.email}</strong><small>${user.email}</small><span class="role-badge ${user.role}">${user.role === 'admin' ? 'Administrator' : 'Benutzer'}</span></div>
          ${user.role === 'admin' ? '' : `<div class="managed-actions"><button class="secondary reset-user" data-id="${user.id}">Passwort setzen</button><button class="danger delete-user" data-id="${user.id}" data-name="${user.full_name || user.email}">Entfernen</button></div>`}
        </div>`).join('')}</div>
      </article>
    </div>`

    document.querySelector('#createUserForm')?.addEventListener('submit', async event => {
      event.preventDefault()
      const button = event.currentTarget.querySelector('button')
      button.disabled = true
      try {
        await callAdmin({
          action: 'create',
          full_name: document.querySelector('#adminFullName').value.trim(),
          email: document.querySelector('#adminEmail').value.trim(),
          password: document.querySelector('#adminPassword').value,
        })
        toast('Benutzer wurde angelegt.')
        await renderAdmin()
      } catch (error) {
        toast(error.message)
        button.disabled = false
      }
    })

    document.querySelectorAll('.reset-user').forEach(button => button.addEventListener('click', async () => {
      const password = window.prompt('Neues Passwort (mindestens 10 Zeichen):')
      if (!password) return
      try {
        await callAdmin({ action: 'password', user_id: button.dataset.id, password })
        toast('Passwort wurde aktualisiert.')
      } catch (error) { toast(error.message) }
    }))

    document.querySelectorAll('.delete-user').forEach(button => button.addEventListener('click', async () => {
      if (!window.confirm(`${button.dataset.name} wirklich entfernen?`)) return
      try {
        await callAdmin({ action: 'delete', user_id: button.dataset.id })
        toast('Benutzer wurde entfernt.')
        await renderAdmin()
      } catch (error) { toast(error.message) }
    }))
  } catch (error) {
    content.innerHTML = `<article class="panel"><h2>Benutzerverwaltung nicht verfügbar</h2><p class="bad">${error.message}</p><p>Bitte Migration 003 ausführen und die Edge Function <code>admin-users</code> bereitstellen.</p><button id="retryAdmin" class="primary">Erneut versuchen</button></article>`
    document.querySelector('#retryAdmin')?.addEventListener('click', renderAdmin)
  }
}
