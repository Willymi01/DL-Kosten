import { state } from '../state.js'
import { euro, number, months, entryCost } from '../utils.js'
import { refreshPeriod } from '../store.js'
import { upsertMonthlyBudget } from '../data.js'

function totalCost(entries = state.entries) {
  return entries.reduce((sum, entry) => sum + entryCost(entry), 0)
}

function totalHours(entries = state.entries) {
  return entries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0)
}

function vendorTotals() {
  return state.vendors.map(vendor => {
    const related = state.entries.filter(entry => entry.vendor_id === vendor.id)
    return {
      vendor,
      hours: totalHours(related),
      cost: totalCost(related)
    }
  })
}

function vendorAreaBreakdown() {
  return state.vendors
    .filter(vendor => vendor.active)
    .map(vendor => {
      const areas = {}
      state.entries.filter(entry => entry.vendor_id === vendor.id).forEach(entry => {
        const name = entry.vendor_rates?.name || 'Ohne Arbeitsbereich'
        if (!areas[name]) areas[name] = { name, hours: 0, cost: 0 }
        areas[name].hours += Number(entry.hours || 0)
        areas[name].cost += entryCost(entry)
      })
      const rows = Object.values(areas).sort((a, b) => a.name.localeCompare(b.name, 'de'))
      return {
        vendor,
        rows,
        hours: rows.reduce((sum, row) => sum + row.hours, 0),
        cost: rows.reduce((sum, row) => sum + row.cost, 0)
      }
    })
    .filter(group => group.rows.length)
}

function yearlySummary() {
  return months.map((_, index) => {
    const month = index + 1
    const related = state.yearEntries.filter(entry => Number(entry.work_date.slice(5, 7)) === month)
    const actual = totalCost(related)
    const hours = totalHours(related)
    const plan = Number(state.yearBudgets.find(item => Number(item.month) === month)?.amount || 0)
    const variance = actual - plan
    return { month, actual, hours, plan, variance, variancePct: plan ? variance / plan * 100 : 0 }
  })
}

function buildForecast(annual, annualPlan, annualActual) {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const currentDay = now.getDate()
  const currentMonthDays = new Date(currentYear, currentMonth, 0).getDate()

  if (state.selectedYear > currentYear) {
    return {
      available: false,
      annualForecast: 0,
      forecastVariance: -annualPlan,
      remainingUnits: 12,
      allowedAverageRemaining: annualPlan / 12,
      adjustment: 0,
      message: 'Für zukünftige Jahre wird die Prognose angezeigt, sobald Ist-Daten vorhanden sind.'
    }
  }

  if (state.selectedYear < currentYear) {
    return {
      available: true,
      annualForecast: annualActual,
      forecastVariance: annualActual - annualPlan,
      remainingUnits: 0,
      allowedAverageRemaining: 0,
      adjustment: 0,
      message: `Das Jahr ist abgeschlossen. Die endgültige Abweichung beträgt ${euro(annualActual - annualPlan)}.`
    }
  }

  const elapsedUnits = (currentMonth - 1) + (currentDay / currentMonthDays)
  const remainingUnits = Math.max(12 - elapsedUnits, 0)
  if (elapsedUnits <= 0 || annualActual <= 0) {
    return {
      available: false,
      annualForecast: 0,
      forecastVariance: -annualPlan,
      remainingUnits,
      allowedAverageRemaining: remainingUnits ? annualPlan / remainingUnits : 0,
      adjustment: 0,
      message: 'Noch nicht genügend Ist-Daten für eine belastbare Jahresprognose.'
    }
  }

  const annualForecast = annualActual / elapsedUnits * 12
  const forecastVariance = annualForecast - annualPlan
  const adjustment = remainingUnits ? (annualPlan - annualForecast) / remainingUnits : 0
  const remainingBudget = annualPlan - annualActual
  const allowedAverageRemaining = remainingUnits ? remainingBudget / remainingUnits : 0
  const message = adjustment < 0
    ? `Um das Jahresziel zu erreichen, sollten die verbleibenden Monate im Durchschnitt ${euro(Math.abs(adjustment))} günstiger ausfallen als die aktuelle Hochrechnung.`
    : `Bei gleichbleibender Entwicklung könnt ihr in den verbleibenden Monaten durchschnittlich ${euro(adjustment)} mehr ausgeben und das Jahresziel trotzdem erreichen.`

  return { available: true, annualForecast, forecastVariance, remainingUnits, allowedAverageRemaining, adjustment, message }
}


function monthName(month) {
  return months[month - 1]
}

function monthlyAnalytics(annual) {
  return annual.map((item, index) => {
    const previous = index > 0 ? annual[index - 1] : null
    const change = previous && previous.actual ? ((item.actual - previous.actual) / previous.actual) * 100 : 0
    const direction = !previous || previous.actual === 0 ? 'neutral' : change > 3 ? 'up' : change < -3 ? 'down' : 'flat'
    return { ...item, change, direction }
  })
}

function lastThreeMonthAverage(annual, selectedMonth) {
  const end = Math.max(1, selectedMonth)
  const start = Math.max(1, end - 2)
  const slice = annual.slice(start - 1, end).filter(item => item.actual > 0)
  if (!slice.length) return 0
  return slice.reduce((sum, item) => sum + item.actual, 0) / slice.length
}

function dashboardStatus(monthlyForecast, monthlyBudget) {
  if (!monthlyBudget) return {
    tone: 'neutral',
    icon: '●',
    label: 'Kein Monatsplan',
    text: 'Für diesen Monat wurde noch kein Plan hinterlegt.'
  }
  const ratio = monthlyForecast / monthlyBudget
  if (ratio <= 0.9) return {
    tone: 'green',
    icon: '●',
    label: 'Alles im Plan',
    text: `Die aktuelle Hochrechnung liegt ${euro(monthlyBudget - monthlyForecast)} unter dem Monatsplan.`
  }
  if (ratio <= 1) return {
    tone: 'yellow',
    icon: '●',
    label: 'Plan beobachten',
    text: `Es verbleiben voraussichtlich noch ${euro(monthlyBudget - monthlyForecast)} Puffer.`
  }
  return {
    tone: 'red',
    icon: '●',
    label: 'Budget gefährdet',
    text: `Die aktuelle Hochrechnung liegt ${euro(monthlyForecast - monthlyBudget)} über dem Monatsplan.`
  }
}

function providerRanking() {
  return vendorTotals()
    .filter(item => item.cost > 0)
    .sort((a, b) => b.cost - a.cost)
}

function workAreaTotals() {
  const areas = {}
  state.entries.forEach(entry => {
    const name = entry.vendor_rates?.name || 'Ohne Arbeitsbereich'
    if (!areas[name]) areas[name] = { name, hours: 0, cost: 0 }
    areas[name].hours += Number(entry.hours || 0)
    areas[name].cost += entryCost(entry)
  })
  return Object.values(areas).sort((a, b) => b.cost - a.cost)
}

function trendLabel(direction) {
  if (direction === 'up') return '↑ steigend'
  if (direction === 'down') return '↓ fallend'
  if (direction === 'flat') return '→ stabil'
  return '–'
}

export function renderDashboard({ toast }) {
  const content = document.querySelector('#content')
  if (!content) return

  const actual = totalCost()
  const hours = totalHours()
  const variance = actual - state.monthlyBudget
  const variancePct = state.monthlyBudget ? variance / state.monthlyBudget * 100 : 0
  const costPerHour = hours ? actual / hours : 0
  const now = new Date()
  const isCurrent = state.selectedYear === now.getFullYear() && state.selectedMonth === now.getMonth() + 1
  const daysInMonth = new Date(state.selectedYear, state.selectedMonth, 0).getDate()
  const daysElapsed = isCurrent ? now.getDate() : daysInMonth
  const monthlyForecast = isCurrent && daysElapsed ? actual / daysElapsed * daysInMonth : actual
  const topVendor = [...vendorTotals()].sort((a, b) => b.cost - a.cost)[0]

  const annual = yearlySummary()
  const annualPlan = annual.reduce((sum, month) => sum + month.plan, 0)
  const annualActual = annual.reduce((sum, month) => sum + month.actual, 0)
  const annualHours = annual.reduce((sum, month) => sum + month.hours, 0)
  const annualVariance = annualActual - annualPlan
  const forecast = buildForecast(annual, annualPlan, annualActual)
  const analytics = monthlyAnalytics(annual)
  const threeMonthAverage = lastThreeMonthAverage(annual, state.selectedMonth)
  const selectedTrend = analytics[state.selectedMonth - 1] || { direction: 'neutral', change: 0 }
  const status = dashboardStatus(monthlyForecast, state.monthlyBudget)
  const ranking = providerRanking()
  const areaTotals = workAreaTotals()
  const maxVendorCost = ranking[0]?.cost || 0
  const maxAreaCost = areaTotals[0]?.cost || 0

  content.innerHTML = `
    <div class="cards">
      <article class="card"><span>Ist-Kosten</span><strong>${euro(actual)}</strong><small>${months[state.selectedMonth - 1]} ${state.selectedYear}</small></article>
      <article class="card"><span>Gesamtstunden</span><strong>${number(hours)}</strong><small>${euro(costPerHour)} je Stunde</small></article>
      <article class="card"><span>Monatsplan</span><strong>${euro(state.monthlyBudget)}</strong><small class="${variance <= 0 ? 'good' : 'bad'}">${state.monthlyBudget ? `${euro(Math.abs(variance))} ${variance <= 0 ? 'unter' : 'über'} Plan` : 'Plan eintragen'}</small></article>
      <article class="card"><span>Hochrechnung</span><strong>${euro(monthlyForecast)}</strong><small>${isCurrent ? 'bis Monatsende' : 'Monat abgeschlossen'}</small></article>
    </div>

    <div class="grid-two">
      <article class="panel">
        <div class="panel-head"><div><h2>Monatsplan gesamt</h2><p>Ein Budget für den ausgewählten Monat.</p></div></div>
        <div class="budget-row"><input id="budgetInput" type="number" min="0" step="100" value="${state.monthlyBudget || ''}" placeholder="z. B. 25000"><button id="saveBudget" class="primary">Plan speichern</button></div>
        <div class="stat-grid">
          <div><span>Abweichung</span><strong class="${variance <= 0 ? 'good' : 'bad'}">${euro(variance)}</strong></div>
          <div><span>Abweichung %</span><strong class="${variance <= 0 ? 'good' : 'bad'}">${number(variancePct)} %</strong></div>
          <div><span>Größter Anteil</span><strong>${topVendor?.vendor.name || '–'}</strong></div>
          <div><span>Aktive Firmen</span><strong>${state.vendors.filter(vendor => vendor.active).length}</strong></div>
        </div>
      </article>
      <article class="panel">
        <div class="panel-head"><div><h2>Planfortschritt</h2><p>Ist im Verhältnis zum Monatsplan.</p></div></div>
        <div class="big-progress"><span style="width:${state.monthlyBudget ? Math.min(actual / state.monthlyBudget * 100, 100) : 0}%"></span></div>
        <p><strong>${state.monthlyBudget ? number(actual / state.monthlyBudget * 100) : 0} %</strong> des Budgets verbraucht</p>
        <p class="muted">Hochrechnung: ${euro(monthlyForecast)} · Erwartete Abweichung: ${euro(monthlyForecast - state.monthlyBudget)}</p>
      </article>
    </div>

    <article class="panel">
      <div class="panel-head"><div><h2>${months[state.selectedMonth - 1]} ${state.selectedYear} nach Dienstleister und Arbeitsbereich</h2><p>Kosten und Stunden je Arbeitsbereich, Zwischensumme je Dienstleister und Gesamtsumme.</p></div></div>
      <div class="table-wrap">
        <table class="breakdown-table">
          <thead><tr><th>Dienstleister</th><th>Arbeitsbereich</th><th>Stunden</th><th>Kosten</th><th>Ø Satz</th><th>Anteil gesamt</th></tr></thead>
          <tbody>${vendorAreaBreakdown().map(group => `
            ${group.rows.map((row, index) => `<tr class="area-row"><td>${index === 0 ? `<span class="dot" style="background:${group.vendor.color}"></span>${group.vendor.name}` : ''}</td><td>${row.name}</td><td>${number(row.hours)}</td><td>${euro(row.cost)}</td><td>${euro(row.hours ? row.cost / row.hours : 0)}</td><td>${number(actual ? row.cost / actual * 100 : 0)} %</td></tr>`).join('')}
            <tr class="vendor-subtotal"><td colspan="2">Summe ${group.vendor.name}</td><td>${number(group.hours)}</td><td>${euro(group.cost)}</td><td>${euro(group.hours ? group.cost / group.hours : 0)}</td><td>${number(actual ? group.cost / actual * 100 : 0)} %</td></tr>
          `).join('')}</tbody>
          <tfoot><tr class="grand-total"><th colspan="2">Gesamt alle Dienstleister</th><th>${number(hours)}</th><th>${euro(actual)}</th><th>${euro(hours ? actual / hours : 0)}</th><th>${actual ? '100 %' : '0 %'}</th></tr></tfoot>
        </table>
      </div>
    </article>


    <section class="control-dashboard">
      <article class="panel status-panel status-${status.tone}">
        <div class="status-line"><span class="status-dot">${status.icon}</span><div><h2>${status.label}</h2><p>${status.text}</p></div></div>
        <div class="status-metrics">
          <div><span>3-Monats-Ø</span><strong>${threeMonthAverage ? euro(threeMonthAverage) : '–'}</strong></div>
          <div><span>Trend zum Vormonat</span><strong class="trend-${selectedTrend.direction}">${trendLabel(selectedTrend.direction)}</strong><small>${selectedTrend.direction !== 'neutral' ? `${number(Math.abs(selectedTrend.change))} %` : ''}</small></div>
          <div><span>Kosten je Stunde</span><strong>${euro(costPerHour)}</strong></div>
        </div>
      </article>

      <div class="analysis-grid">
        <article class="panel">
          <div class="panel-head"><div><h2>Dienstleister-Ranking</h2><p>Nach Kosten im ausgewählten Monat.</p></div></div>
          <div class="ranking-list">
            ${ranking.length ? ranking.map((item, index) => `<div class="ranking-row">
              <div class="ranking-title"><span class="rank-number">${index + 1}</span><span class="dot" style="background:${item.vendor.color}"></span><strong>${item.vendor.name}</strong><span>${euro(item.cost)}</span></div>
              <div class="mini-track"><span style="width:${maxVendorCost ? item.cost / maxVendorCost * 100 : 0}%"></span></div>
              <small>${number(item.hours)} Std. · ${number(actual ? item.cost / actual * 100 : 0)} % Anteil</small>
            </div>`).join('') : '<p class="muted">Noch keine Ist-Daten vorhanden.</p>'}
          </div>
        </article>

        <article class="panel">
          <div class="panel-head"><div><h2>Arbeitsbereiche</h2><p>Wo entstehen die meisten Kosten?</p></div></div>
          <div class="ranking-list">
            ${areaTotals.length ? areaTotals.map((item, index) => `<div class="ranking-row">
              <div class="ranking-title"><span class="rank-number">${index + 1}</span><strong>${item.name}</strong><span>${euro(item.cost)}</span></div>
              <div class="mini-track"><span style="width:${maxAreaCost ? item.cost / maxAreaCost * 100 : 0}%"></span></div>
              <small>${number(item.hours)} Std. · Ø ${euro(item.hours ? item.cost / item.hours : 0)}/h</small>
            </div>`).join('') : '<p class="muted">Noch keine Ist-Daten vorhanden.</p>'}
          </div>
        </article>
      </div>

      <article class="panel">
        <div class="panel-head"><div><h2>Monat-zu-Monat-Vergleich</h2><p>Plan, Ist, Abweichung und Entwicklung im Jahresverlauf.</p></div></div>
        <div class="table-wrap">
          <table class="comparison-table">
            <thead><tr><th>Monat</th><th>Plan</th><th>Ist</th><th>Abweichung</th><th>Trend</th><th>Status</th></tr></thead>
            <tbody>${analytics.map(item => `<tr class="${item.month === state.selectedMonth ? 'selected-month-row' : ''}">
              <td>${monthName(item.month)}</td>
              <td>${euro(item.plan)}</td>
              <td>${euro(item.actual)}</td>
              <td class="${item.variance <= 0 ? 'good' : 'bad'}">${euro(item.variance)}</td>
              <td class="trend-${item.direction}">${trendLabel(item.direction)}${item.direction !== 'neutral' ? ` (${number(Math.abs(item.change))} %)` : ''}</td>
              <td><span class="month-status ${!item.plan ? 'neutral' : item.variance <= 0 ? 'under' : 'over'}">${!item.plan ? 'Kein Plan' : item.variance <= 0 ? 'Im Plan' : 'Über Plan'}</span></td>
            </tr>`).join('')}</tbody>
          </table>
        </div>
      </article>
    </section>

    <article class="panel annual-panel">
      <div class="panel-head">
        <div><h2>Jahresübersicht ${state.selectedYear}</h2><p>Alle Monatspläne direkt pflegen, Ist-Werte vergleichen und das Jahresergebnis prognostizieren.</p></div>
        <div class="annual-totals"><span>Plan: <strong>${euro(annualPlan)}</strong></span><span>Ist: <strong>${euro(annualActual)}</strong></span><span class="${annualVariance <= 0 ? 'good' : 'bad'}">Aktuelle Differenz: <strong>${euro(annualVariance)}</strong></span></div>
      </div>

      <div class="year-forecast-grid">
        <div class="forecast-card"><span>Jahresziel</span><strong>${euro(annualPlan)}</strong><small>Summe aller Monatspläne</small></div>
        <div class="forecast-card"><span>Prognose Jahreskosten</span><strong>${forecast.available ? euro(forecast.annualForecast) : '–'}</strong><small>${state.selectedYear < now.getFullYear() ? 'Tatsächlicher Jahreswert' : 'Hochrechnung aus dem bisherigen Verlauf'}</small></div>
        <div class="forecast-card"><span>Erwartete Jahresabweichung</span><strong class="${forecast.forecastVariance <= 0 ? 'good' : 'bad'}">${forecast.available ? euro(forecast.forecastVariance) : '–'}</strong><small>${forecast.available ? (forecast.forecastVariance <= 0 ? 'voraussichtlich unter Plan' : 'voraussichtlich über Plan') : 'Prognose noch nicht möglich'}</small></div>
        <div class="forecast-card"><span>Verfügbar je Restmonat</span><strong class="${forecast.allowedAverageRemaining >= 0 ? 'good' : 'bad'}">${forecast.remainingUnits > 0 ? euro(forecast.allowedAverageRemaining) : '–'}</strong><small>${forecast.remainingUnits > 0 ? `für noch ${number(forecast.remainingUnits)} Monatsanteile` : 'Keine Restmonate'}</small></div>
      </div>

      <div class="forecast-callout ${!forecast.available ? 'neutral' : forecast.adjustment < 0 ? 'warning' : 'positive'}">
        <strong>${!forecast.available ? 'Prognose' : forecast.adjustment < 0 ? 'Sparbedarf' : 'Zusätzlicher Spielraum'}</strong>
        <span>${forecast.message}</span>
      </div>

      <div class="table-wrap">
        <table class="annual-table">
          <thead><tr><th>Monat</th><th>Plan</th><th>Ist</th><th>Stunden</th><th>Abweichung</th><th>Abweichung %</th><th>Status</th></tr></thead>
          <tbody>${annual.map(month => `<tr class="${month.month === state.selectedMonth ? 'selected-month-row' : ''}">
            <td><button class="month-link" data-month="${month.month}">${months[month.month - 1]}</button></td>
            <td><input class="annual-plan-input" data-month="${month.month}" type="number" min="0" step="100" value="${month.plan || ''}" placeholder="0"></td>
            <td>${euro(month.actual)}</td><td>${number(month.hours)}</td>
            <td class="${month.variance <= 0 ? 'good' : 'bad'}">${euro(month.variance)}</td>
            <td class="${month.variance <= 0 ? 'good' : 'bad'}">${month.plan ? `${number(month.variancePct)} %` : '–'}</td>
            <td><span class="month-status ${!month.plan ? 'neutral' : month.variance <= 0 ? 'under' : 'over'}">${!month.plan ? 'Kein Plan' : month.variance <= 0 ? 'Im Plan' : 'Über Plan'}</span></td>
          </tr>`).join('')}</tbody>
          <tfoot><tr><th>Gesamt</th><th>${euro(annualPlan)}</th><th>${euro(annualActual)}</th><th>${number(annualHours)}</th><th class="${annualVariance <= 0 ? 'good' : 'bad'}">${euro(annualVariance)}</th><th>${annualPlan ? `${number(annualVariance / annualPlan * 100)} %` : '–'}</th><th></th></tr></tfoot>
        </table>
      </div>
      <p class="muted annual-save-hint">Pläne werden automatisch gespeichert, sobald du ein Feld verlässt.</p>
    </article>
  `

  document.querySelector('#saveBudget')?.addEventListener('click', async () => {
    try {
      await upsertMonthlyBudget(state.selectedYear, state.selectedMonth, document.querySelector('#budgetInput').value)
      await refreshPeriod()
      renderDashboard({ toast })
      toast('Monatsplan gespeichert.')
    } catch (error) {
      toast(error.message)
    }
  })

  document.querySelectorAll('.annual-plan-input').forEach(input => {
    input.addEventListener('change', async event => {
      const month = Number(event.currentTarget.dataset.month)
      try {
        await upsertMonthlyBudget(state.selectedYear, month, event.currentTarget.value)
        await refreshPeriod()
        renderDashboard({ toast })
        toast(`${months[month - 1]} gespeichert.`)
      } catch (error) {
        toast(error.message)
      }
    })
  })

  document.querySelectorAll('.month-link').forEach(button => {
    button.addEventListener('click', async event => {
      state.selectedMonth = Number(event.currentTarget.dataset.month)
      const monthSelect = document.querySelector('#monthSelect')
      if (monthSelect) monthSelect.value = String(state.selectedMonth)
      await refreshPeriod()
      renderDashboard({ toast })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  })
}
