import './styles.css'
import { configured, supabase } from './supabase.js'
import { getSession, getProfile, onAuthChange } from './auth.js'
import { subscribeToChanges } from './data.js'
import { state } from './state.js'
import { isoWeek, toast } from './utils.js'
import { refreshData, loadSelectedWeek } from './store.js'
import { renderShell, updateShellHeader } from './shell.js'
import { authScreen, passwordUpdateScreen } from './auth-ui.js'
import { renderDashboard } from './views/dashboard.js'
import { renderEntry } from './views/entry.js'
import { renderVendors } from './views/vendors.js'
import { renderReports } from './views/reports.js'
import { renderInsights } from './views/insights.js'
import { renderAdmin } from './views/admin.js'

state.selectedWeek = isoWeek(new Date())

async function renderCurrentView(forceRefresh = false) {
  if (forceRefresh) { await refreshData(); state.lastUpdated = new Date().toISOString() }
  const generation = ++state.renderGeneration
  updateShellHeader()

  try {
    if (state.selectedView === 'dashboard') {
      renderDashboard({ toast })
      return
    }
    if (state.selectedView === 'vendors') {
      renderVendors()
      return
    }
    if (state.selectedView === 'insights') {
      renderInsights({ renderCurrentView })
      return
    }
    if (state.selectedView === 'admin') {
      if (state.profile?.role !== 'admin') throw new Error('Nur Administratoren dürfen diese Seite öffnen.')
      await renderAdmin()
      return
    }
    if (state.selectedView === 'reports') {
      renderReports({ renderCurrentView })
      return
    }
    await renderEntry({ generation, toast, renderCurrentView })
  } catch (error) {
    console.error(error)
    const content = document.querySelector('#content')
    if (content) {
      content.innerHTML = `<article class="panel"><h2>Ansicht konnte nicht geladen werden</h2><p class="bad">${error.message}</p><button id="retryView" class="primary">Erneut versuchen</button></article>`
      document.querySelector('#retryView')?.addEventListener('click', () => renderCurrentView())
    }
  }
}

async function loadApp() {
  const { data: profile, error: profileError } = await getProfile()
  if (profileError || !profile?.active) throw new Error('Dieser Zugang ist nicht aktiv.')
  state.profile = profile
  await refreshData()
  state.lastUpdated = new Date().toISOString()
  renderShell(renderCurrentView)
  await renderCurrentView()

  if (state.liveChannel) supabase.removeChannel(state.liveChannel)
  state.liveChannel = subscribeToChanges(() => {
    window.clearTimeout(state.liveTimer)
    state.liveTimer = window.setTimeout(async () => {
      try {
        await refreshData()
        if (state.selectedView === 'entry') await loadSelectedWeek()
        await renderCurrentView()
        toast('Daten synchronisiert')
      } catch (error) {
        console.warn('Live-Synchronisierung fehlgeschlagen:', error)
      }
    }, 350)
  })
}

async function boot() {
  if (!configured) {
    authScreen()
    return
  }

  const { data } = await getSession()
  state.session = data.session

  onAuthChange(async (event, newSession) => {
    state.session = newSession
    if (event === 'PASSWORD_RECOVERY') {
      passwordUpdateScreen()
      return
    }
    if (!state.session) authScreen()
    else await loadApp()
  })

  if (state.session) await loadApp()
  else authScreen()
}

boot().catch(error => authScreen('login', error.message))

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(error => console.warn('Service Worker:', error))
  })
}


window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault()
  state.installPrompt = event
  const button = document.querySelector('#installApp')
  if (button) button.hidden = false
})

function updateConnectionBanner() {
  let banner = document.querySelector('#connectionBanner')
  if (!navigator.onLine) {
    if (!banner) {
      banner = document.createElement('div')
      banner.id = 'connectionBanner'
      banner.className = 'connection-banner'
      banner.textContent = 'Offline – bereits geladene Ansichten bleiben verfügbar. Änderungen werden erst online gespeichert.'
      document.body.append(banner)
    }
  } else if (banner) {
    banner.remove()
    toast('Verbindung wiederhergestellt')
  }
  const onlineState = document.querySelector('#onlineState')
  if (onlineState) onlineState.textContent = navigator.onLine ? 'Online' : 'Offline'
}
window.addEventListener('online', updateConnectionBanner)
window.addEventListener('offline', updateConnectionBanner)
updateConnectionBanner()
