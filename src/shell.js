import { state } from './state.js'
import { months, weekForMonth, isoWeek, isoWeekYear } from './utils.js'
import { refreshPeriod } from './store.js'
import { signOut } from './auth.js'

function navButton(view, label) {
  return `<button class="nav-btn ${state.selectedView === view ? 'active' : ''}" data-view="${view}">${label}</button>`
}

export function renderShell(renderCurrentView) {
  const app = document.querySelector('#app')
  app.innerHTML = `<div class="app-shell">
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark">CP</div><div><strong>CostPilot</strong><small>Secure Cloud</small></div></div>
      <nav>${navButton('dashboard', 'Übersicht')}${navButton('entry', 'Zeiterfassung')}${navButton('vendors', 'Dienstleister & Preise')}${navButton('reports', 'Berichte & Import')}${navButton('insights', 'Analysen & Warnungen')}</nav>
      <div class="sidebar-footer"><div class="user-chip">${state.session.user.email}<br><span class="sync-state">● Live-Synchronisierung</span></div><button id="logout" class="secondary">Abmelden</button></div>
    </aside>
    <main class="main">
      <header class="topbar">
        <div style="display:flex;gap:10px"><button id="menu" class="secondary mobile-menu">☰</button><div><h1 id="title"></h1><p id="subtitle"></p></div></div>
        <div class="actions"><button id="installApp" class="secondary install-button" hidden>App installieren</button>
          <select id="yearSelect">${Array.from({ length: 9 }, (_, index) => new Date().getFullYear() - 4 + index).map(year => `<option ${year === state.selectedYear ? 'selected' : ''}>${year}</option>`).join('')}</select>
          <select id="monthSelect">${months.map((month, index) => `<option value="${index + 1}" ${index + 1 === state.selectedMonth ? 'selected' : ''}>${month}</option>`).join('')}</select>
        </div>
      </header>
      <section id="content"></section>
    </main>
  </div>`

  const installButton = document.querySelector('#installApp')
  if (state.installPrompt && installButton) installButton.hidden = false
  installButton?.addEventListener('click', async () => {
    if (!state.installPrompt) return
    state.installPrompt.prompt()
    await state.installPrompt.userChoice
    state.installPrompt = null
    installButton.hidden = true
  })

  document.querySelector('#logout').addEventListener('click', () => signOut())
  document.querySelector('#menu').addEventListener('click', () => document.querySelector('.sidebar').classList.toggle('open'))

  document.querySelectorAll('.nav-btn').forEach(button => button.addEventListener('click', async () => {
    state.selectedView = button.dataset.view
    state.renderGeneration += 1
    if (state.selectedView === 'entry') {
      const today = new Date()
      state.selectedYear = isoWeekYear(today)
      state.selectedWeek = isoWeek(today)
      state.selectedMonth = today.getMonth() + 1
      document.querySelector('#yearSelect').value = String(state.selectedYear)
      document.querySelector('#monthSelect').value = String(state.selectedMonth)
      await refreshPeriod()
    }
    document.querySelector('.sidebar').classList.remove('open')
    await renderCurrentView()
  }))

  document.querySelector('#yearSelect').addEventListener('change', async event => {
    state.selectedYear = Number(event.currentTarget.value)
    if (state.selectedView === 'entry') {
      const target = weekForMonth(state.selectedYear, state.selectedMonth)
      state.selectedYear = target.year
      state.selectedWeek = target.week
      document.querySelector('#yearSelect').value = String(state.selectedYear)
    }
    await refreshPeriod()
    state.renderGeneration += 1
    await renderCurrentView()
  })

  document.querySelector('#monthSelect').addEventListener('change', async event => {
    state.selectedMonth = Number(event.currentTarget.value)
    if (state.selectedView === 'entry') {
      const target = weekForMonth(state.selectedYear, state.selectedMonth)
      state.selectedYear = target.year
      state.selectedWeek = target.week
      document.querySelector('#yearSelect').value = String(state.selectedYear)
    }
    await refreshPeriod()
    state.renderGeneration += 1
    await renderCurrentView()
  })
}

export function updateShellHeader() {
  const titles = {
    dashboard: ['Übersicht', 'Monat, Dienstleister, Kosten, Stunden und Plan auf einen Blick.'],
    entry: ['Zeiterfassung', 'Stunden für alle Dienstleister wochenweise erfassen.'],
    vendors: ['Dienstleister & Preise', 'Firmen, Arbeitsbereiche und zeitabhängige Preise verwalten.'],
    reports: ['Berichte & Import', 'PDF, Excel, Import und Datensicherung.'],
    insights: ['Analysen & Warnungen', 'Diagramme, Warnungen und Komfortstatus.']
  }
  document.querySelectorAll('.nav-btn').forEach(button => button.classList.toggle('active', button.dataset.view === state.selectedView))
  const [title, subtitle] = titles[state.selectedView] || titles.dashboard
  const titleEl = document.querySelector('#title')
  const subtitleEl = document.querySelector('#subtitle')
  if (titleEl) titleEl.textContent = title
  if (subtitleEl) subtitleEl.textContent = subtitle
}
