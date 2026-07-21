import { configured } from './supabase.js'
import { signIn, signUpWithInvite, sendReset, updatePassword } from './auth.js'
import { toast } from './utils.js'

const app = document.querySelector('#app')

function inviteTokenFromUrl() {
  return new URLSearchParams(window.location.search).get('invite') || ''
}

function clearInviteFromUrl() {
  const url = new URL(window.location.href)
  url.searchParams.delete('invite')
  window.history.replaceState({}, '', url)
}

export function authScreen(mode = 'login', message = '') {
  const inviteToken = inviteTokenFromUrl()
  if (inviteToken) return invitationScreen(inviteToken, message)

  app.innerHTML = `<main class="auth-shell"><section class="auth-card">
    <div class="brand"><div class="brand-mark">CP</div><div><strong>CostPilot</strong><small>Sicherer Teamzugang</small></div></div>
    ${!configured ? '<div class="message">Supabase ist noch nicht konfiguriert.</div>' : ''}
    ${message ? `<div class="message">${message}</div>` : ''}
    <form id="authForm" class="form-grid">
      <label>E-Mail<input id="email" type="email" autocomplete="username" required></label>
      <label>Passwort<input id="password" type="password" minlength="10" autocomplete="current-password" required></label>
      <button class="primary" ${!configured ? 'disabled' : ''}>Anmelden</button>
      <button id="resetBtn" type="button" class="link-btn">Passwort vergessen?</button>
    </form>
    <p class="auth-note">Neue Zugänge erhalten einen einmaligen Einladungslink vom Administrator.</p>
  </section></main>`

  document.querySelector('#authForm').addEventListener('submit', async event => {
    event.preventDefault()
    const button = event.currentTarget.querySelector('button[type="submit"]')
    button.disabled = true
    button.textContent = 'Anmeldung läuft …'
    const result = await signIn(document.querySelector('#email').value.trim(), document.querySelector('#password').value)
    if (result.error) {
      authScreen('login', result.error.message)
    }
  })

  document.querySelector('#resetBtn').addEventListener('click', async () => {
    const email = document.querySelector('#email').value.trim()
    if (!email) return toast('Bitte E-Mail eintragen.')
    const { error } = await sendReset(email)
    toast(error ? error.message : 'Reset-E-Mail wurde versendet.')
  })
}

function invitationScreen(inviteToken, message = '') {
  app.innerHTML = `<main class="auth-shell"><section class="auth-card">
    <div class="brand"><div class="brand-mark">CP</div><div><strong>CostPilot</strong><small>Einladung aktivieren</small></div></div>
    ${message ? `<div class="message">${message}</div>` : ''}
    <p>Lege jetzt deinen persönlichen Zugang an. Verwende genau die E-Mail-Adresse, an die der Admin die Einladung ausgestellt hat.</p>
    <form id="inviteForm" class="form-grid">
      <label>E-Mail<input id="inviteEmail" type="email" autocomplete="username" required></label>
      <label>Passwort<input id="invitePassword" type="password" minlength="10" autocomplete="new-password" required></label>
      <label>Passwort wiederholen<input id="invitePassword2" type="password" minlength="10" autocomplete="new-password" required></label>
      <button class="primary">Zugang aktivieren</button>
      <button id="backToLogin" type="button" class="link-btn">Zur Anmeldung</button>
    </form>
  </section></main>`

  document.querySelector('#backToLogin').addEventListener('click', () => {
    clearInviteFromUrl()
    authScreen()
  })

  document.querySelector('#inviteForm').addEventListener('submit', async event => {
    event.preventDefault()
    const password = document.querySelector('#invitePassword').value
    const repeat = document.querySelector('#invitePassword2').value
    if (password !== repeat) return toast('Die Passwörter stimmen nicht überein.')
    const button = event.currentTarget.querySelector('button[type="submit"]')
    button.disabled = true
    button.textContent = 'Zugang wird erstellt …'
    const { data, error } = await signUpWithInvite(document.querySelector('#inviteEmail').value.trim(), password, inviteToken)
    if (error) {
      invitationScreen(inviteToken, error.message)
      return
    }
    clearInviteFromUrl()
    if (data.session) window.location.reload()
    else authScreen('login', 'Zugang erstellt. Bitte bestätige gegebenenfalls noch die E-Mail und melde dich danach an.')
  })
}

export function passwordUpdateScreen() {
  app.innerHTML = `<main class="auth-shell"><section class="auth-card"><h2>Neues Passwort</h2><form id="pwForm" class="form-grid"><label>Neues Passwort<input id="newPassword" type="password" minlength="10" required></label><button class="primary">Speichern</button></form></section></main>`
  document.querySelector('#pwForm').addEventListener('submit', async event => {
    event.preventDefault()
    const { error } = await updatePassword(document.querySelector('#newPassword').value)
    if (error) toast(error.message)
    else window.location.reload()
  })
}
