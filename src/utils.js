export const months = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
export const days = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag']

export const euro = value => new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR'
}).format(Number(value) || 0)

export const number = value => new Intl.NumberFormat('de-DE', {
  maximumFractionDigits: 2
}).format(Number(value) || 0)

export function toast(text) {
  const el = document.createElement('div')
  el.className = 'toast'
  el.textContent = text
  document.body.append(el)
  window.setTimeout(() => el.remove(), 2600)
}

export function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
}

export function isoWeekYear(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  return d.getUTCFullYear()
}

export function weeksInYear(year) {
  return isoWeek(new Date(year, 11, 28))
}

export function mondayOfWeek(year, week) {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Day = jan4.getUTCDay() || 7
  const monday = new Date(jan4)
  monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1) + (week - 1) * 7)
  return monday
}

export function formatIsoDate(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export function monthRange(year, month) {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return [
    `${year}-${String(month).padStart(2, '0')}-01`,
    `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  ]
}

export function weekDates(year, week) {
  const start = mondayOfWeek(year, week)
  return days.map((name, index) => {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + index)
    return { name, date: formatIsoDate(date) }
  })
}

export function weekForMonth(year, month) {
  const date = new Date(year, month - 1, 1)
  return { year: isoWeekYear(date), week: isoWeek(date) }
}

export function weekLabel(dates) {
  const format = value => value.split('-').reverse().join('.')
  return `${format(dates[0].date)} – ${format(dates[6].date)}`
}

export function isRateValid(rate, date) {
  return Boolean(rate?.active) &&
    rate.effective_from <= date &&
    (!rate.effective_to || rate.effective_to >= date)
}

export function entryCost(entry) {
  return Number(entry.hours || 0) * Number(entry.vendor_rates?.hourly_rate || 0)
}
