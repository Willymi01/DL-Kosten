import { state } from './state.js'
import { getVendors, getEntries, getMonthlyBudget, getYearBudgets } from './data.js'
import { monthRange, weekDates } from './utils.js'

export async function refreshData() {
  state.vendors = await getVendors()
  await refreshPeriod()
}

export async function refreshPeriod() {
  const [from, to] = monthRange(state.selectedYear, state.selectedMonth)
  const yearFrom = `${state.selectedYear}-01-01`
  const yearTo = `${state.selectedYear}-12-31`
  const [monthEntries, budget, allEntries, budgets] = await Promise.all([
    getEntries(from, to),
    getMonthlyBudget(state.selectedYear, state.selectedMonth),
    getEntries(yearFrom, yearTo),
    getYearBudgets(state.selectedYear)
  ])
  state.entries = monthEntries
  state.monthlyBudget = Number(budget?.amount || 0)
  state.yearEntries = allEntries
  state.yearBudgets = budgets
}

export async function loadSelectedWeek() {
  const dates = weekDates(state.selectedYear, state.selectedWeek)
  state.weekEntries = await getEntries(dates[0].date, dates[6].date)
}
