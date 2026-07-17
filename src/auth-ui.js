import { configured } from './supabase.js'
import { signIn, signUp, sendReset, updatePassword } from './auth.js'
import { toast } from './utils.js'

const app = document.querySelector('#app')

export function authScreen(mode = 'login', message = '') {
  app.innerHTML = `<main class="auth-shell"><section class="auth-card">
    <div class="brand"><div class="brand-mark">CP</div><div><strong>CostPilot Secure</strong><small>Geschütztes Kostencontrolling</small></div></div>
    ${!configured ? '<div class="message">Supabase ist noch nicht konfiguriert.</div>' : ''}
    <div class="auth-tabs"><button id="tabLogin" class="${mode === 'login' ? 'active' : ''}">Anmelden</button><button id="tabSignup" class="${mode === 'signup' ? 'active' : ''}">Registrieren</button></div>
    ${message ? `<div class="message">${message}</div>` : ''}
    <form id="authForm" class="form-grid">
      ${mode === 'signup' ? '<label>Name<input id="fullName" required></label>' : ''}
      <label>E-Mail<input id="email" type="email" required></label>
      <label>Passwort<input id="password" type="password" minlength="10" required></label>
      <button class="primary" ${!configured ? 'disabled' : ''}>${mode === 'login' ? 'Sicher anmelden' : 'Konto erstellen'}</button>
      ${mode === 'login' ? '<button id="resetBtn" type="button" class="link-btn">Passwort vergessen?</button>' : ''}
    </form>
  </section></main>`

  document.querySelector('#tabLogin').addEventListener('click', () => authScreen('login'))
  document.querySelector('#tabSignup').addEventListener('click', () => authScreen('signup'))
  document.querySelector('#authForm').addEventListener('submit', async event => {
    event.preventDefault()
    const email = document.querySelector('#email').value.trim()
    const password = document.querySelector('#password').value
    const result = mode === 'login'
      ? await signIn(email, password)
      : await signUp(email, password, document.querySelector('#fullName').value.trim())
    if (result.error) return authScreen(mode, result.error.message)
    if (mode === 'signup' && !result.data.session) authScreen('login', 'Bitte bestätige deine E-Mail.')
  })

  document.querySelector('#resetBtn')?.addEventListener('click', async () => {
    const email = document.querySelector('#email').value.trim()
    if (!email) return toast('Bitte E-Mail eintragen.')
    const { error } = await sendReset(email)
    toast(error ? error.message : 'Reset-E-Mail wurde versendet.')
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
