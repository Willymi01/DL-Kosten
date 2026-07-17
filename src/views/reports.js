import { state } from '../state.js'
import { euro, number, months, entryCost, toast } from '../utils.js'
import { getAllEntries, getAllBudgets, importEntries, importBudgets } from '../data.js'
import { refreshData } from '../store.js'

function downloadBlob(content, filename, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function escapeCsv(value) {
  const text = String(value ?? '')
  return `"${text.replaceAll('"', '""')}"`
}

function rowsToCsv(headers, rows) {
  return '\ufeff' + [headers, ...rows]
    .map(row => row.map(escapeCsv).join(';'))
    .join('\r\n')
}

function monthEntries() {
  return state.entries.map(entry => ({
    date: entry.work_date,
    vendor: entry.vendors?.name || '',
    area: entry.vendor_rates?.name || '',
    hours: Number(entry.hours || 0),
    rate: Number(entry.vendor_rates?.hourly_rate || 0),
    cost: entryCost(entry),
    note: entry.note || ''
  }))
}

function monthlyVendorSummary() {
  const groups = {}
  state.entries.forEach(entry => {
    const vendor = entry.vendors?.name || 'Unbekannt'
    const area = entry.vendor_rates?.name || 'Ohne Arbeitsbereich'
    const key = `${vendor}|||${area}`
    if (!groups[key]) groups[key] = { vendor, area, hours: 0, cost: 0 }
    groups[key].hours += Number(entry.hours || 0)
    groups[key].cost += entryCost(entry)
  })
  return Object.values(groups).sort((a, b) => a.vendor.localeCompare(b.vendor, 'de') || a.area.localeCompare(b.area, 'de'))
}

function exportExcelCsv() {
  const details = monthEntries()
  const csv = rowsToCsv(
    ['Datum', 'Dienstleister', 'Arbeitsbereich', 'Stunden', 'Stundensatz', 'Kosten', 'Notiz'],
    details.map(row => [row.date, row.vendor, row.area, row.hours, row.rate, row.cost, row.note])
  )
  downloadBlob(csv, `CostPilot_${state.selectedYear}_${String(state.selectedMonth).padStart(2, '0')}.csv`, 'text/csv;charset=utf-8')
}

function exportPlansCsv() {
  const csv = rowsToCsv(
    ['Jahr', 'Monat', 'Monatsnummer', 'Plan'],
    state.yearBudgets.map(item => [item.year, months[Number(item.month) - 1], item.month, Number(item.amount || 0)])
  )
  downloadBlob(csv, `CostPilot_Jahresplaene_${state.selectedYear}.csv`, 'text/csv;charset=utf-8')
}

function exportPdf() {
  const summary = monthlyVendorSummary()
  const totalHours = state.entries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0)
  const totalCost = state.entries.reduce((sum, entry) => sum + entryCost(entry), 0)
  const variance = totalCost - state.monthlyBudget
  const printWindow = window.open('', '_blank', 'noopener,noreferrer')
  if (!printWindow) {
    toast('Der Browser hat das Berichtsfenster blockiert. Bitte Pop-ups erlauben.')
    return
  }

  printWindow.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>CostPilot Monatsbericht</title><style>
    body{font-family:Arial,sans-serif;color:#172033;margin:24px}h1{margin-bottom:4px}p{margin:4px 0 16px;color:#536176}
    .metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:20px 0}.metric{border:1px solid #ccd6e3;border-radius:8px;padding:10px}.metric span{display:block;font-size:12px;color:#68778c}.metric strong{display:block;margin-top:5px;font-size:16px}
    table{width:100%;border-collapse:collapse;margin-top:16px;font-size:12px}th,td{border:1px solid #ccd6e3;padding:7px;text-align:left}th{background:#eef3f8}.right{text-align:right}.footer{margin-top:24px;font-size:10px;color:#68778c}
    @media print{body{margin:12mm}.no-print{display:none}}
  </style></head><body>
    <button class="no-print" onclick="window.print()">Drucken / Als PDF speichern</button>
    <h1>CostPilot Monatsbericht</h1><p>${months[state.selectedMonth - 1]} ${state.selectedYear} · Erstellt am ${new Date().toLocaleDateString('de-DE')}</p>
    <div class="metrics">
      <div class="metric"><span>Monatsplan</span><strong>${euro(state.monthlyBudget)}</strong></div>
      <div class="metric"><span>Ist-Kosten</span><strong>${euro(totalCost)}</strong></div>
      <div class="metric"><span>Abweichung</span><strong>${euro(variance)}</strong></div>
      <div class="metric"><span>Stunden</span><strong>${number(totalHours)}</strong></div>
      <div class="metric"><span>Kosten je Stunde</span><strong>${euro(totalHours ? totalCost / totalHours : 0)}</strong></div>
    </div>
    <table><thead><tr><th>Dienstleister</th><th>Arbeitsbereich</th><th class="right">Stunden</th><th class="right">Kosten</th><th class="right">Ø Satz</th></tr></thead><tbody>
      ${summary.length ? summary.map(row => `<tr><td>${row.vendor}</td><td>${row.area}</td><td class="right">${number(row.hours)}</td><td class="right">${euro(row.cost)}</td><td class="right">${euro(row.hours ? row.cost / row.hours : 0)}</td></tr>`).join('') : '<tr><td colspan="5">Keine Daten vorhanden.</td></tr>'}
    </tbody></table><div class="footer">CostPilot · Daten sicher in Supabase gespeichert</div>
  </body></html>`)
  printWindow.document.close()
  printWindow.focus()
}

async function createBackup() {
  const [entries, budgets] = await Promise.all([getAllEntries(), getAllBudgets()])
  const backup = {
    format: 'costpilot-backup',
    version: 1,
    created_at: new Date().toISOString(),
    vendors: state.vendors,
    entries: entries.map(entry => ({
      work_date: entry.work_date,
      hours: Number(entry.hours || 0),
      note: entry.note || null,
      vendor_name: entry.vendors?.name || '',
      rate_name: entry.vendor_rates?.name || '',
      hourly_rate: Number(entry.vendor_rates?.hourly_rate || 0)
    })),
    budgets: budgets.map(item => ({ year: Number(item.year), month: Number(item.month), amount: Number(item.amount || 0) }))
  }
  downloadBlob(JSON.stringify(backup, null, 2), `CostPilot_Backup_${new Date().toISOString().slice(0, 10)}.json`, 'application/json')
}

function findVendorAndRate(vendorName, rateName) {
  const vendor = state.vendors.find(item => item.name.trim().toLowerCase() === String(vendorName || '').trim().toLowerCase())
  if (!vendor) return null
  const rate = (vendor.vendor_rates || []).find(item => item.name.trim().toLowerCase() === String(rateName || '').trim().toLowerCase())
  return rate ? { vendor, rate } : null
}

function normalizeDate(value) {
  const text = String(value || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  const german = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (german) return `${german[3]}-${String(german[2]).padStart(2, '0')}-${String(german[1]).padStart(2, '0')}`
  return ''
}

function parseCsv(text) {
  const delimiter = text.split(/\r?\n/, 1)[0].includes(';') ? ';' : ','
  const rows = []
  let row = [], cell = '', quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]
    if (char === '"' && quoted && next === '"') { cell += '"'; index += 1; continue }
    if (char === '"') { quoted = !quoted; continue }
    if (char === delimiter && !quoted) { row.push(cell.trim()); cell = ''; continue }
    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1
      row.push(cell.trim()); cell = ''
      if (row.some(value => value !== '')) rows.push(row)
      row = []
      continue
    }
    cell += char
  }
  if (cell || row.length) { row.push(cell.trim()); rows.push(row) }
  const headers = (rows.shift() || []).map(item => item.replace(/^\ufeff/, '').trim())
  return rows.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])))
}

function parseImportRows(rows) {
  const valid = [], invalid = []
  rows.forEach((row, index) => {
    const vendorName = row.Dienstleister ?? row.Firma ?? row.vendor ?? row.Vendor
    const rateName = row.Arbeitsbereich ?? row.Tätigkeit ?? row.Taetigkeit ?? row.Bereich
    const date = normalizeDate(row.Datum ?? row.Date ?? row.Arbeitstag)
    const hours = Number(String(row.Stunden ?? row.Hours ?? row.hours ?? '').replace(',', '.'))
    const match = findVendorAndRate(vendorName, rateName)
    if (!match || !date || !Number.isFinite(hours)) {
      invalid.push({ row: index + 2, reason: !match ? 'Dienstleister/Arbeitsbereich nicht gefunden' : !date ? 'Ungültiges Datum' : 'Ungültige Stunden' })
      return
    }
    valid.push({ vendor_id: match.vendor.id, rate_id: match.rate.id, work_date: date, hours, note: row.Notiz ?? row.Note ?? null, vendorName: match.vendor.name, rateName: match.rate.name })
  })
  return { valid, invalid }
}

function showImportPreview(parsed, modal, onComplete) {
  modal.querySelector('#importPreview').innerHTML = `<div class="import-summary"><span class="good"><strong>${parsed.valid.length}</strong> gültige Zeilen</span><span class="${parsed.invalid.length ? 'bad' : 'good'}"><strong>${parsed.invalid.length}</strong> fehlerhafte Zeilen</span></div>
    <div class="table-wrap"><table><thead><tr><th>Datum</th><th>Dienstleister</th><th>Arbeitsbereich</th><th>Stunden</th></tr></thead><tbody>${parsed.valid.slice(0, 20).map(row => `<tr><td>${row.work_date}</td><td>${row.vendorName}</td><td>${row.rateName}</td><td>${number(row.hours)}</td></tr>`).join('')}</tbody></table></div>
    ${parsed.invalid.length ? `<details><summary>Fehler anzeigen</summary><ul>${parsed.invalid.slice(0, 30).map(item => `<li>Zeile ${item.row}: ${item.reason}</li>`).join('')}</ul></details>` : ''}
    <button id="confirmImport" class="primary" ${parsed.valid.length ? '' : 'disabled'}>${parsed.valid.length} Zeilen importieren</button>`
  modal.querySelector('#confirmImport')?.addEventListener('click', async () => {
    try {
      await importEntries(parsed.valid)
      await refreshData()
      modal.remove()
      await onComplete()
      toast(`${parsed.valid.length} Zeilen importiert.`)
    } catch (error) { toast(error.message) }
  })
}

function openCsvImport(onComplete) {
  const modal = document.createElement('div')
  modal.className = 'modal'
  modal.innerHTML = `<div class="modal-card wide-modal"><h2>Excel-/CSV-Import</h2><p>Speichere die Excel-Datei als CSV. Erforderliche Spalten: <strong>Datum, Dienstleister, Arbeitsbereich, Stunden</strong>.</p><input id="csvFile" type="file" accept=".csv,text/csv"><div id="importPreview" class="import-preview"><p class="muted">Nach der Auswahl erscheint hier eine Vorschau.</p></div><div class="modal-actions"><button id="closeImport" class="secondary">Schließen</button></div></div>`
  document.body.append(modal)
  modal.querySelector('#closeImport').addEventListener('click', () => modal.remove())
  modal.querySelector('#csvFile').addEventListener('change', async event => {
    const file = event.currentTarget.files?.[0]
    if (!file) return
    try { showImportPreview(parseImportRows(parseCsv(await file.text())), modal, onComplete) }
    catch (error) { toast(`Datei konnte nicht gelesen werden: ${error.message}`) }
  })
}

function openBackupRestore(onComplete) {
  const input = document.createElement('input')
  input.type = 'file'; input.accept = '.json,application/json'
  input.addEventListener('change', async () => {
    const file = input.files?.[0]
    if (!file) return
    try {
      const backup = JSON.parse(await file.text())
      if (backup.format !== 'costpilot-backup') throw new Error('Keine gültige CostPilot-Sicherung.')
      const entries = [], skipped = []
      for (const item of backup.entries || []) {
        const match = findVendorAndRate(item.vendor_name, item.rate_name)
        if (!match) { skipped.push(item); continue }
        entries.push({ vendor_id: match.vendor.id, rate_id: match.rate.id, work_date: item.work_date, hours: Number(item.hours || 0), note: item.note || null })
      }
      await Promise.all([importEntries(entries), importBudgets(backup.budgets || [])])
      await refreshData(); await onComplete()
      toast(`Sicherung wiederhergestellt: ${entries.length} Einträge${skipped.length ? `, ${skipped.length} übersprungen` : ''}.`)
    } catch (error) { toast(error.message) }
  })
  input.click()
}

export function renderReports({ renderCurrentView }) {
  const content = document.querySelector('#content')
  if (!content) return
  content.innerHTML = `<div class="report-grid">
    <article class="panel report-card"><div><h2>PDF-Monatsbericht</h2><p>Druckoptimierter Bericht mit Plan, Ist, Abweichung und Kostenaufschlüsselung.</p></div><button id="exportPdf" class="primary">Bericht öffnen</button></article>
    <article class="panel report-card"><div><h2>Excel-Export</h2><p>Zeiteinträge als Excel-kompatible CSV-Datei; Jahrespläne separat exportieren.</p></div><div class="report-actions"><button id="exportExcel" class="primary">Monatsdaten</button><button id="exportPlans" class="secondary">Jahrespläne</button></div></article>
    <article class="panel report-card"><div><h2>Excel-/CSV-Import</h2><p>Excel-Liste als CSV speichern, prüfen und anschließend nach Supabase importieren.</p></div><button id="importExcel" class="primary">CSV auswählen</button></article>
    <article class="panel report-card"><div><h2>Datensicherung</h2><p>Alle Zeiteinträge, Planzahlen und Stammdaten als JSON sichern oder wiederherstellen.</p></div><div class="report-actions"><button id="backup" class="primary">Backup erstellen</button><button id="restore" class="secondary">Wiederherstellen</button></div></article>
  </div>
  <article class="panel"><h2>Importvorlage</h2><p>Die erste Zeile muss diese Spaltennamen enthalten:</p><div class="table-wrap"><table><thead><tr><th>Datum</th><th>Dienstleister</th><th>Arbeitsbereich</th><th>Stunden</th><th>Notiz</th></tr></thead><tbody><tr><td>2026-04-01</td><td>Rezent</td><td>Kasse</td><td>8</td><td>optional</td></tr></tbody></table></div><p class="muted">Dienstleister und Arbeitsbereich müssen bereits angelegt sein. Unterstützte Datumsformate: YYYY-MM-DD und TT.MM.JJJJ.</p></article>`
  document.querySelector('#exportPdf').addEventListener('click', exportPdf)
  document.querySelector('#exportExcel').addEventListener('click', exportExcelCsv)
  document.querySelector('#exportPlans').addEventListener('click', exportPlansCsv)
  document.querySelector('#importExcel').addEventListener('click', () => openCsvImport(renderCurrentView))
  document.querySelector('#backup').addEventListener('click', createBackup)
  document.querySelector('#restore').addEventListener('click', () => openBackupRestore(renderCurrentView))
}
