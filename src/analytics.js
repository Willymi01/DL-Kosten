import { state } from './state.js'
import { entryCost, months } from './utils.js'

export function monthlySeries() {
  return months.map((name, index) => {
    const month = index + 1
    const entries = state.yearEntries.filter(entry => Number(entry.work_date.slice(5, 7)) === month)
    const actual = entries.reduce((sum, entry) => sum + entryCost(entry), 0)
    const hours = entries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0)
    const plan = Number(state.yearBudgets.find(item => Number(item.month) === month)?.amount || 0)
    return { month, name, actual, hours, plan, variance: actual - plan }
  })
}

export function providerSeries() {
  return state.vendors.map(vendor => {
    const entries = state.entries.filter(entry => entry.vendor_id === vendor.id)
    return {
      name: vendor.name,
      color: vendor.color,
      cost: entries.reduce((sum, entry) => sum + entryCost(entry), 0),
      hours: entries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0)
    }
  }).filter(item => item.cost > 0).sort((a,b) => b.cost-a.cost)
}

export function buildAlerts() {
  const alerts=[]
  const actual=state.entries.reduce((sum,e)=>sum+entryCost(e),0)
  const hours=state.entries.reduce((sum,e)=>sum+Number(e.hours||0),0)
  const now=new Date()
  const current=state.selectedYear===now.getFullYear() && state.selectedMonth===now.getMonth()+1
  const days=new Date(state.selectedYear,state.selectedMonth,0).getDate()
  const elapsed=current ? now.getDate() : days
  const forecast=current && elapsed ? actual/elapsed*days : actual
  const budget=Number(state.monthlyBudget||0)
  if(!budget) alerts.push({level:'info',title:'Monatsplan fehlt',text:'Für den ausgewählten Monat wurde noch kein Budget eingetragen.'})
  else if(forecast>budget) alerts.push({level:'danger',title:'Budgetüberschreitung erwartet',text:`Die Hochrechnung liegt ${Math.round(forecast-budget).toLocaleString('de-DE')} € über dem Monatsplan.`})
  else if(forecast>budget*.9) alerts.push({level:'warning',title:'Budget fast ausgeschöpft',text:'Die Hochrechnung liegt bereits über 90 % des Monatsplans.'})
  else alerts.push({level:'success',title:'Monat im Plan',text:'Die aktuelle Hochrechnung liegt komfortabel innerhalb des Budgets.'})

  const providers=providerSeries()
  if(providers[0] && actual && providers[0].cost/actual>.5) alerts.push({level:'warning',title:'Hohe Kostenkonzentration',text:`${providers[0].name} verursacht ${Math.round(providers[0].cost/actual*100)} % der Monatskosten.`})
  const avg=hours ? actual/hours : 0
  if(avg>35) alerts.push({level:'warning',title:'Hoher Durchschnittssatz',text:`Der durchschnittliche Stundensatz beträgt ${avg.toLocaleString('de-DE',{style:'currency',currency:'EUR'})}.`})
  const inactiveRates=state.vendors.filter(v=>v.active && !(v.vendor_rates||[]).some(r=>r.active))
  if(inactiveRates.length) alerts.push({level:'info',title:'Preise prüfen',text:`Bei ${inactiveRates.length} aktiven Dienstleister(n) ist kein aktiver Preis markiert.`})
  return alerts
}
