import { state } from '../state.js'
import { euro, number, months, weekDates, weekLabel, weeksInYear, mondayOfWeek, isoWeek, isoWeekYear, isRateValid, entryCost } from '../utils.js'
import { loadSelectedWeek, refreshPeriod } from '../store.js'
import { upsertEntry } from '../data.js'

function refreshEntryTotals(dates) {
  state.vendors.filter(vendor => vendor.active).forEach(vendor => {
    const vendorTotal = state.weekEntries
      .filter(entry => entry.vendor_id === vendor.id && dates.some(day => day.date === entry.work_date))
      .reduce((sum, entry) => sum + entryCost(entry), 0)
    const totalEl = document.querySelector(`[data-vendor-total="${vendor.id}"]`)
    if (totalEl) totalEl.textContent = euro(vendorTotal)

    dates.forEach(day => {
      const dayCost = state.weekEntries
        .filter(entry => entry.work_date === day.date && entry.vendor_id === vendor.id)
        .reduce((sum, entry) => sum + entryCost(entry), 0)
      const dayEl = document.querySelector(`[data-day-cost="${vendor.id}|${day.date}"]`)
      if (dayEl) dayEl.textContent = euro(dayCost)
    })
  })
}

function renderVendorEntry(vendor, dates) {
  const weekRates = (vendor.vendor_rates || []).filter(rate => dates.some(day => isRateValid(rate, day.date)))
  if (!weekRates.length) {
    return `<section class="vendor-entry-block"><h3><span class="dot" style="background:${vendor.color}"></span>${vendor.name}</h3><p class="muted">Für diese Woche ist kein gültiger Preiszeitraum hinterlegt.</p></section>`
  }

  const total = state.weekEntries
    .filter(entry => entry.vendor_id === vendor.id && dates.some(day => day.date === entry.work_date))
    .reduce((sum, entry) => sum + entryCost(entry), 0)

  return `<section class="vendor-entry-block">
    <div class="vendor-entry-head"><h3><span class="dot" style="background:${vendor.color}"></span>${vendor.name}</h3><strong data-vendor-total="${vendor.id}">${euro(total)}</strong></div>
    <div class="entry-grid">
      <div class="entry-row entry-header"><div>Tag</div>${weekRates.map(rate => `<div>${rate.name}<br><small>${euro(rate.hourly_rate)}/h</small></div>`).join('')}<div>Kosten</div></div>
      ${dates.map(day => {
        const cells = weekRates.map(rate => {
          if (!isRateValid(rate, day.date)) return '<div class="rate-unavailable">–</div>'
          const existing = state.weekEntries.find(entry => entry.work_date === day.date && entry.vendor_id === vendor.id && entry.rate_id === rate.id)
          return `<input class="hours" data-date="${day.date}" data-vendor="${vendor.id}" data-rate="${rate.id}" inputmode="decimal" value="${existing && Number(existing.hours) !== 0 ? number(existing.hours) : ''}" placeholder="0,00">`
        }).join('')
        const dayCost = state.weekEntries
          .filter(entry => entry.work_date === day.date && entry.vendor_id === vendor.id)
          .reduce((sum, entry) => sum + entryCost(entry), 0)
        return `<div class="entry-row"><div class="day">${day.name}<br><small>${day.date.split('-').reverse().join('.')}</small></div>${cells}<div data-day-cost="${vendor.id}|${day.date}">${euro(dayCost)}</div></div>`
      }).join('')}
    </div>
  </section>`
}

export async function renderEntry({ generation, toast, renderCurrentView }) {
  const content = document.querySelector('#content')
  if (!content) return
  content.innerHTML = '<article class="panel"><p class="muted">Kalenderwoche wird geladen …</p></article>'

  try {
    await loadSelectedWeek()
    if (generation !== state.renderGeneration || state.selectedView !== 'entry') return
  } catch (error) {
    if (generation !== state.renderGeneration || state.selectedView !== 'entry') return
    content.innerHTML = `<article class="panel"><p class="bad">${error.message}</p></article>`
    return
  }

  const dates = weekDates(state.selectedYear, state.selectedWeek)
  const previousMonday = mondayOfWeek(state.selectedYear, state.selectedWeek)
  previousMonday.setUTCDate(previousMonday.getUTCDate() - 7)
  const nextMonday = mondayOfWeek(state.selectedYear, state.selectedWeek)
  nextMonday.setUTCDate(nextMonday.getUTCDate() + 7)

  content.innerHTML = `<article class="panel">
    <div class="panel-head entry-period-head">
      <div><h2>Kalenderwoche ${state.selectedWeek}</h2><p>${weekLabel(dates)} · Vergangene Wochen können jederzeit angesehen und bearbeitet werden.</p></div>
      <div class="week-controls"><button id="previousWeek" class="secondary" title="Vorherige Woche">←</button><select id="weekSelect">${Array.from({ length: weeksInYear(state.selectedYear) }, (_, index) => index + 1).map(week => `<option value="${week}" ${week === state.selectedWeek ? 'selected' : ''}>KW ${week}</option>`).join('')}</select><button id="nextWeek" class="secondary" title="Nächste Woche">→</button></div>
    </div>
    <div class="entry-period-summary"><strong>${months[state.selectedMonth - 1]} ${state.selectedYear}</strong><span>Die Stunden werden für die oben ausgewählte Kalenderwoche geladen.</span></div>
    <div class="all-vendors-entry">${state.vendors.filter(vendor => vendor.active).map(vendor => renderVendorEntry(vendor, dates)).join('')}</div>
  </article>`

  document.querySelector('#weekSelect')?.addEventListener('change', async event => {
    state.selectedWeek = Number(event.currentTarget.value)
    state.renderGeneration += 1
    await renderCurrentView()
  })

  document.querySelector('#previousWeek')?.addEventListener('click', async () => {
    state.selectedYear = isoWeekYear(previousMonday)
    state.selectedWeek = isoWeek(previousMonday)
    state.selectedMonth = previousMonday.getUTCMonth() + 1
    document.querySelector('#yearSelect').value = String(state.selectedYear)
    document.querySelector('#monthSelect').value = String(state.selectedMonth)
    await refreshPeriod()
    state.renderGeneration += 1
    await renderCurrentView()
  })

  document.querySelector('#nextWeek')?.addEventListener('click', async () => {
    state.selectedYear = isoWeekYear(nextMonday)
    state.selectedWeek = isoWeek(nextMonday)
    state.selectedMonth = nextMonday.getUTCMonth() + 1
    document.querySelector('#yearSelect').value = String(state.selectedYear)
    document.querySelector('#monthSelect').value = String(state.selectedMonth)
    await refreshPeriod()
    state.renderGeneration += 1
    await renderCurrentView()
  })

  document.querySelectorAll('.hours').forEach(input => {
    input.addEventListener('change', async event => {
      const field = event.currentTarget
      const value = Number(String(field.value).replace(',', '.')) || 0
      field.disabled = true
      try {
        await upsertEntry({
          vendor_id: field.dataset.vendor,
          rate_id: field.dataset.rate,
          work_date: field.dataset.date,
          hours: value
        })
        await Promise.all([refreshPeriod(), loadSelectedWeek()])
        const saved = state.weekEntries.find(entry =>
          entry.work_date === field.dataset.date &&
          entry.vendor_id === field.dataset.vendor &&
          entry.rate_id === field.dataset.rate
        )
        field.value = saved && Number(saved.hours) !== 0 ? number(saved.hours) : ''
        refreshEntryTotals(dates)
        toast('Gespeichert')
      } catch (error) {
        toast(error.message)
      } finally {
        field.disabled = false
      }
    })
  })
}
