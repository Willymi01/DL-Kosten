export const state = {
  session: null,
  vendors: [],
  entries: [],
  yearEntries: [],
  yearBudgets: [],
  weekEntries: [],
  monthlyBudget: 0,
  selectedView: 'dashboard',
  selectedYear: new Date().getFullYear(),
  selectedMonth: new Date().getMonth() + 1,
  selectedWeek: 1,
  renderGeneration: 0,
  liveChannel: null,
  liveTimer: null,
  lastUpdated: null,
  installPrompt: null
}
