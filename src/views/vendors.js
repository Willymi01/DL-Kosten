import { state } from '../state.js'
import { euro, toast } from '../utils.js'
import { saveVendor, deactivateVendor } from '../data.js'
import { refreshData } from '../store.js'

function periodLabel(rate) {
  const from = rate.effective_from?.split('-').reverse().join('.') || '–'
  const to = rate.effective_to ? rate.effective_to.split('-').reverse().join('.') : 'offen'
  return `${from} – ${to}`
}

function rateRow(rate = {}) {
  return `<div class="rate-period-row">
    <input class="rName" data-id="${rate.id || ''}" value="${rate.name || ''}" placeholder="Tätigkeit" required>
    <input class="rPrice" type="number" min="0" step=".01" value="${rate.hourly_rate || ''}" placeholder="€/h" required>
    <label>Von<input class="rFrom" type="date" value="${rate.effective_from || `${state.selectedYear}-01-01`}" required></label>
    <label>Bis<input class="rTo" type="date" value="${rate.effective_to || ''}"></label>
  </div>`
}

function vendorModal(vendor = null, rerender) {
  const rates = vendor?.vendor_rates?.length ? vendor.vendor_rates : [{}]
  const modal = document.createElement('div')
  modal.className = 'modal'
  modal.innerHTML = `<form class="modal-card wide-modal">
    <h2>${vendor ? 'Dienstleister bearbeiten' : 'Dienstleister anlegen'}</h2>
    <label>Firmenname<input id="vName" value="${vendor?.name || ''}" required></label>
    <label>Farbe<input id="vColor" type="color" value="${vendor?.color || '#2563eb'}"></label>
    <h3>Preise und Gültigkeitszeiträume</h3>
    <div id="rates">${rates.map(rateRow).join('')}</div>
    <button id="addRate" type="button" class="secondary">+ Neuer Preiszeitraum</button>
    <div class="modal-actions"><button id="cancel" type="button" class="secondary">Abbrechen</button><button class="primary">Speichern</button></div>
  </form>`
  document.body.append(modal)

  modal.querySelector('#cancel').addEventListener('click', () => modal.remove())
  modal.querySelector('#addRate').addEventListener('click', () => modal.querySelector('#rates').insertAdjacentHTML('beforeend', rateRow()))
  modal.querySelector('form').addEventListener('submit', async event => {
    event.preventDefault()
    const ratesPayload = [...modal.querySelectorAll('.rate-period-row')].map(row => ({
      id: row.querySelector('.rName').dataset.id || undefined,
      name: row.querySelector('.rName').value.trim(),
      hourly_rate: Number(row.querySelector('.rPrice').value),
      effective_from: row.querySelector('.rFrom').value,
      effective_to: row.querySelector('.rTo').value || null
    }))
    try {
      await saveVendor({
        id: vendor?.id,
        name: modal.querySelector('#vName').value.trim(),
        color: modal.querySelector('#vColor').value,
        active: true,
        rates: ratesPayload
      })
      modal.remove()
      await refreshData()
      rerender()
      toast('Gespeichert.')
    } catch (error) {
      toast(error.message)
    }
  })
}

export function renderVendors() {
  const content = document.querySelector('#content')
  if (!content) return
  content.innerHTML = `<article class="panel">
    <div class="panel-head"><div><h2>Firmen und Preiszeiträume</h2><p>Preisänderungen werden als eigener Zeitraum gespeichert.</p></div><button id="newVendor" class="primary">+ Dienstleister</button></div>
    <div class="vendor-list">${state.vendors.map(vendor => `<div class="vendor-card">
      <div><strong><span class="dot" style="background:${vendor.color}"></span>${vendor.name}</strong>${!vendor.active ? ' <span class="badge employee">Inaktiv</span>' : ''}
        <div class="price-history">${(vendor.vendor_rates || []).sort((a, b) => b.effective_from.localeCompare(a.effective_from)).map(rate => `<div class="price-period"><span><strong>${rate.name}</strong> · ${euro(rate.hourly_rate)}/h</span><small>${periodLabel(rate)}</small></div>`).join('')}</div>
      </div>
      <div class="actions"><button class="secondary editVendor" data-id="${vendor.id}">Bearbeiten</button>${vendor.active ? `<button class="danger disableVendor" data-id="${vendor.id}">Deaktivieren</button>` : ''}</div>
    </div>`).join('')}</div>
  </article>`

  document.querySelector('#newVendor')?.addEventListener('click', () => vendorModal(null, renderVendors))
  document.querySelectorAll('.editVendor').forEach(button => button.addEventListener('click', () => vendorModal(state.vendors.find(vendor => vendor.id === button.dataset.id), renderVendors)))
  document.querySelectorAll('.disableVendor').forEach(button => button.addEventListener('click', async () => {
    if (!window.confirm('Dienstleister deaktivieren?')) return
    await deactivateVendor(button.dataset.id)
    await refreshData()
    renderVendors()
  }))
}
