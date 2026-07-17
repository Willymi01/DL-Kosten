import { state } from '../state.js'
import { euro, number } from '../utils.js'
import { monthlySeries, providerSeries, buildAlerts } from '../analytics.js'

function lineChart(series) {
  const values=series.map(x=>x.actual)
  const max=Math.max(...values,1)
  const width=760,height=230,pad=28
  const points=values.map((v,i)=>`${pad+i*((width-pad*2)/11)},${height-pad-(v/max)*(height-pad*2)}`).join(' ')
  const dots=values.map((v,i)=>`<circle cx="${pad+i*((width-pad*2)/11)}" cy="${height-pad-(v/max)*(height-pad*2)}" r="4"><title>${series[i].name}: ${euro(v)}</title></circle>`).join('')
  return `<svg class="cost-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Kostenverlauf"><line x1="${pad}" y1="${height-pad}" x2="${width-pad}" y2="${height-pad}"/><polyline points="${points}"/>${dots}</svg><div class="chart-labels">${series.map(x=>`<span>${x.name.slice(0,3)}</span>`).join('')}</div>`
}

function planBars(series) {
  const max=Math.max(...series.flatMap(x=>[x.actual,x.plan]),1)
  return `<div class="bar-chart">${series.map(x=>`<div class="bar-month"><div class="bar-pair"><span class="bar plan" style="height:${x.plan/max*150}px" title="Plan ${euro(x.plan)}"></span><span class="bar actual ${x.actual>x.plan&&x.plan?'over':''}" style="height:${x.actual/max*150}px" title="Ist ${euro(x.actual)}"></span></div><small>${x.name.slice(0,3)}</small></div>`).join('')}</div><div class="chart-legend"><span><i class="legend-plan"></i>Plan</span><span><i class="legend-actual"></i>Ist</span></div>`
}

export function renderInsights({ renderCurrentView }) {
 const content=document.querySelector('#content'); if(!content)return
 const monthly=monthlySeries(), providers=providerSeries(), alerts=buildAlerts()
 const total=providers.reduce((s,x)=>s+x.cost,0)
 const gradient=providers.length ? providers.reduce((acc,p,i)=>{const before=providers.slice(0,i).reduce((s,x)=>s+x.cost,0)/total*100;const after=(providers.slice(0,i+1).reduce((s,x)=>s+x.cost,0)/total*100);acc.push(`${p.color} ${before}% ${after}%`);return acc},[]).join(',') : '#e2e8f0 0 100%'
 content.innerHTML=`
 <div class="insight-actions"><button id="enableNotifications" class="secondary">Browser-Benachrichtigungen aktivieren</button><button id="refreshInsights" class="secondary">Daten aktualisieren</button></div>
 <div class="alerts-grid">${alerts.map(a=>`<article class="alert-card alert-${a.level}"><span class="alert-icon">${a.level==='danger'?'!':a.level==='warning'?'△':a.level==='success'?'✓':'i'}</span><div><strong>${a.title}</strong><p>${a.text}</p></div></article>`).join('')}</div>
 <div class="analysis-grid">
  <article class="panel"><div class="panel-head"><div><h2>Kostenverlauf ${state.selectedYear}</h2><p>Monatliche Ist-Kosten im Jahresverlauf.</p></div></div>${lineChart(monthly)}</article>
  <article class="panel"><div class="panel-head"><div><h2>Plan gegen Ist</h2><p>Direkter Vergleich für alle zwölf Monate.</p></div></div>${planBars(monthly)}</article>
 </div>
 <div class="analysis-grid">
  <article class="panel"><div class="panel-head"><div><h2>Kostenanteile Dienstleister</h2><p>Verteilung im ausgewählten Monat.</p></div></div><div class="donut-layout"><div class="donut" style="background:conic-gradient(${gradient})"><span>${euro(total)}</span></div><div class="donut-legend">${providers.map(p=>`<div><i style="background:${p.color}"></i><span>${p.name}</span><strong>${number(total?p.cost/total*100:0)} %</strong></div>`).join('')||'<p class="muted">Keine Daten</p>'}</div></div></article>
  <article class="panel"><div class="panel-head"><div><h2>Komfortstatus</h2><p>Installation, Verbindung und Synchronisierung.</p></div></div><div class="comfort-list"><div><span>Verbindung</span><strong id="onlineState">${navigator.onLine?'Online':'Offline'}</strong></div><div><span>Letzte Aktualisierung</span><strong>${state.lastUpdated?new Date(state.lastUpdated).toLocaleString('de-DE'):'–'}</strong></div><div><span>Installierte App</span><strong>${window.matchMedia('(display-mode: standalone)').matches?'Ja':'Browser'}</strong></div><div><span>Aktive Warnungen</span><strong>${alerts.filter(a=>['danger','warning'].includes(a.level)).length}</strong></div></div></article>
 </div>`
 document.querySelector('#refreshInsights')?.addEventListener('click',()=>renderCurrentView(true))
 document.querySelector('#enableNotifications')?.addEventListener('click',async()=>{
   if(!('Notification'in window)) return alert('Dieser Browser unterstützt keine Benachrichtigungen.')
   const permission=await Notification.requestPermission()
   if(permission==='granted') new Notification('CostPilot',{body:alerts[0]?.text||'Benachrichtigungen sind aktiviert.'})
 })
}
