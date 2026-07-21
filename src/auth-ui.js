import { configured } from './supabase.js'
import { signIn, sendReset, updatePassword } from './auth.js'
import { toast } from './utils.js'

const app = document.querySelector('#app')

export function authScreen(mode = 'login', message = '') {
  app.innerHTML = `<main class="auth-shell"><section class="auth-card">
    <div class="brand"><div class="brand-mark">CP</div><div><strong>CostPilot</strong><small>Admin-verwalteter Zugang</small></div></div>
    ${!configured ? '<div class="message">Supabase ist noch nicht konfiguriert.</div>' : ''}
    ${message ? `<div class="message">${message}</div>` : ''}
    <form id="authForm" class="form-grid">
      <label>E-Mail<input id="email" type="email" autocomplete="username" required></label>
      <label>Passwort<input id="password" type="password" minlength="10" autocomplete="current-password" required></label>
      <button type="submit" class="primary" ${!configured ? 'disabled' : ''}>Anmelden</button>
      <button id="resetBtn" type="button" class="link-btn">Passwort vergessen?</button>
    </form>
    <p class="auth-note">Neue Zugänge werden ausschließlich durch den Administrator angelegt.</p>
  </section></main>`

  document.querySelector('#authForm').addEventListener('submit', async event => {
    event.preventDefault()
    const form = event.currentTarget
    const button = form.querySelector('button[type="submit"]') || form.querySelector('button.primary')
    if (button) {
      button.disabled = true
      button.textContent = 'Anmeldung läuft …'
    }

    try {
      const result = await signIn(
        form.querySelector('#email').value.trim(),
        form.querySelector('#password').value
      )
      if (result.error) authScreen('login', result.error.message)
    } catch (error) {
      authScreen('login', error?.message || 'Die Anmeldung ist fehlgeschlagen.')
    }
  })

  document.querySelector('#resetBtn').addEventListener('click', async () => {
    const email = document.querySelector('#email').value.trim()
    if (!email) return toast('Bitte E-Mail eintragen.')
    const { error } = await sendReset(email)
    toast(error ? error.message : 'Reset-E-Mail wurde versendet.')
  })
}

export function passwordUpdateScreen() {
  app.innerHTML = `<main class="auth-shell"><section class="auth-card"><h2>Neues Passwort</h2><form id="pwForm" class="form-grid"><label>Neues Passwort<input id="newPassword" type="password" minlength="10" required></label><button type="submit" class="primary">Speichern</button></form></section></main>`
  document.querySelector('#pwForm').addEventListener('submit', async event => {
    event.preventDefault()
    const { error } = await updatePassword(document.querySelector('#newPassword').value)
    if (error) toast(error.message)
    else window.location.reload()
  })
}
