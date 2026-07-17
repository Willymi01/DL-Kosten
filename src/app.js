import './styles.css'
import { configured, supabase } from './supabase.js'
import { signIn, signUp, signOut, sendReset, updatePassword, getSession, onAuthChange } from './auth.js'
import { getVendors, saveVendor, deactivateVendor, getEntries, upsertEntry, getMonthlyBudget, getYearBudgets, upsertMonthlyBudget, subscribeToChanges } from './data.js'

const app = document.querySelector('#app')
const months = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
const days = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag']
const euro = n => new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(Number(n)||0)
const number = n => new Intl.NumberFormat('de-DE',{maximumFractionDigits:2}).format(Number(n)||0)

let session = null
let vendors = []
let entries = []
let monthlyBudget = 0
let yearEntries = []
let yearBudgets = []
let weekEntries = []
let renderGeneration = 0
let selectedView = 'dashboard'
let selectedYear = new Date().getFullYear()
let selectedMonth = new Date().getMonth()+1
let selectedWeek = isoWeek(new Date())
let liveChannel = null
let liveTimer = null

function toast(text) { const el=document.createElement('div');el.className='toast';el.textContent=text;document.body.append(el);setTimeout(()=>el.remove(),2600) }
function isoWeek(date){const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));const day=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()+4-day);const y0=new Date(Date.UTC(d.getUTCFullYear(),0,1));return Math.ceil((((d-y0)/86400000)+1)/7)}
function weeksInYear(year){return isoWeek(new Date(year,11,28))}
function mondayOfWeek(year,week){const jan4=new Date(Date.UTC(year,0,4));const jan4Day=jan4.getUTCDay()||7;const monday=new Date(jan4);monday.setUTCDate(jan4.getUTCDate()-(jan4Day-1)+(week-1)*7);return monday}
function fmtDate(d){return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`}
function monthRange(year,month){const lastDay=new Date(Date.UTC(year,month,0)).getUTCDate();return [`${year}-${String(month).padStart(2,'0')}-01`,`${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`]}
function weekDates(year,week){const start=mondayOfWeek(year,week);return days.map((name,i)=>{const d=new Date(start);d.setUTCDate(start.getUTCDate()+i);return{name,date:fmtDate(d)}})}
function isoWeekYear(date){
  const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()))
  const day=d.getUTCDay()||7
  d.setUTCDate(d.getUTCDate()+4-day)
  return d.getUTCFullYear()
}
function weekForMonth(year,month){
  const date=new Date(year,month-1,1)
  return {year:isoWeekYear(date),week:isoWeek(date)}
}
function weekLabel(dates){
  const first=dates[0].date.split('-').reverse().join('.')
  const last=dates[6].date.split('-').reverse().join('.')
  return `${first} – ${last}`
}
async function loadSelectedWeek(){
  const dates=weekDates(selectedYear,selectedWeek)
  weekEntries=await getEntries(dates[0].date,dates[6].date)
}

function isRateValid(rate,date){return rate.active && rate.effective_from<=date && (!rate.effective_to || rate.effective_to>=date)}
function entryCost(e){return Number(e.hours)*Number(e.vendor_rates?.hourly_rate||0)}
function totalCost(){return entries.reduce((s,e)=>s+entryCost(e),0)}
function totalHours(){return entries.reduce((s,e)=>s+Number(e.hours),0)}
function vendorTotals(){return vendors.map(v=>{const related=entries.filter(e=>e.vendor_id===v.id);return{vendor:v,hours:related.reduce((s,e)=>s+Number(e.hours),0),cost:related.reduce((s,e)=>s+entryCost(e),0)}})}

function authScreen(mode='login',message=''){
  app.innerHTML=`<main class="auth-shell"><section class="auth-card"><div class="brand"><div class="brand-mark">CP</div><div><strong>CostPilot Secure</strong><small>Geschütztes Kostencontrolling</small></div></div>${!configured?`<div class="message">Supabase ist noch nicht konfiguriert.</div>`:''}<div class="auth-tabs"><button id="tabLogin" class="${mode==='login'?'active':''}">Anmelden</button><button id="tabSignup" class="${mode==='signup'?'active':''}">Registrieren</button></div>${message?`<div class="message">${message}</div>`:''}<form id="authForm" class="form-grid">${mode==='signup'?'<label>Name<input id="fullName" required></label>':''}<label>E-Mail<input id="email" type="email" required></label><label>Passwort<input id="password" type="password" minlength="10" required></label><button class="primary" ${!configured?'disabled':''}>${mode==='login'?'Sicher anmelden':'Konto erstellen'}</button>${mode==='login'?'<button id="resetBtn" type="button" class="link-btn">Passwort vergessen?</button>':''}</form></section></main>`
  document.querySelector('#tabLogin').onclick=()=>authScreen('login');document.querySelector('#tabSignup').onclick=()=>authScreen('signup')
  document.querySelector('#authForm').onsubmit=async e=>{e.preventDefault();const email=document.querySelector('#email').value.trim(),password=document.querySelector('#password').value;const result=mode==='login'?await signIn(email,password):await signUp(email,password,document.querySelector('#fullName').value.trim());if(result.error)return authScreen(mode,result.error.message);if(mode==='signup'&&!result.data.session)authScreen('login','Bitte bestätige deine E-Mail.')}
  const reset=document.querySelector('#resetBtn');if(reset)reset.onclick=async()=>{const email=document.querySelector('#email').value.trim();if(!email)return toast('Bitte E-Mail eintragen.');const{error}=await sendReset(email);toast(error?error.message:'Reset-E-Mail wurde versendet.')}
}
function passwordUpdateScreen(){app.innerHTML=`<main class="auth-shell"><section class="auth-card"><h2>Neues Passwort</h2><form id="pwForm" class="form-grid"><label>Neues Passwort<input id="newPassword" type="password" minlength="10" required></label><button class="primary">Speichern</button></form></section></main>`;document.querySelector('#pwForm').onsubmit=async e=>{e.preventDefault();const{error}=await updatePassword(document.querySelector('#newPassword').value);if(error)toast(error.message);else await loadApp()}}

function navButton(view,label){return`<button class="nav-btn ${selectedView===view?'active':''}" data-view="${view}">${label}</button>`}
function shell(){
  app.innerHTML=`<div class="app-shell"><aside class="sidebar"><div class="brand"><div class="brand-mark">CP</div><div><strong>CostPilot</strong><small>Secure Cloud</small></div></div><nav>${navButton('dashboard','Übersicht')}${navButton('entry','Zeiterfassung')}${navButton('vendors','Dienstleister & Preise')}</nav><div class="sidebar-footer"><div class="user-chip">${session.user.email}<br><span class="sync-state">● Live-Synchronisierung</span></div><button id="logout" class="secondary">Abmelden</button></div></aside><main class="main"><header class="topbar"><div style="display:flex;gap:10px"><button id="menu" class="secondary mobile-menu">☰</button><div><h1 id="title"></h1><p id="subtitle"></p></div></div><div class="actions"><select id="yearSelect">${Array.from({length:9},(_,i)=>new Date().getFullYear()-4+i).map(y=>`<option ${y===selectedYear?'selected':''}>${y}</option>`).join('')}</select><select id="monthSelect">${months.map((m,i)=>`<option value="${i+1}" ${i+1===selectedMonth?'selected':''}>${m}</option>`).join('')}</select></div></header><section id="content"></section></main></div>`
  document.querySelector('#logout').onclick=()=>signOut();document.querySelector('#menu').onclick=()=>document.querySelector('.sidebar').classList.toggle('open')
  document.querySelectorAll('.nav-btn').forEach(b=>b.onclick=async()=>{
    selectedView=b.dataset.view
    renderGeneration++
    if(selectedView==='entry'){
      const target=weekForMonth(selectedYear,selectedMonth)
      selectedYear=target.year
      selectedWeek=target.week
      document.querySelector('#yearSelect').value=String(selectedYear)
    }
    document.querySelector('.sidebar').classList.remove('open')
    await renderView()
  })
  document.querySelector('#yearSelect').onchange=async e=>{
    selectedYear=+e.target.value
    if(selectedView==='entry'){
      const target=weekForMonth(selectedYear,selectedMonth)
      selectedYear=target.year
      selectedWeek=target.week
      document.querySelector('#yearSelect').value=String(selectedYear)
    }
    await refreshPeriod()
    renderView()
  }
  document.querySelector('#monthSelect').onchange=async e=>{
    selectedMonth=+e.target.value
    if(selectedView==='entry'){
      const target=weekForMonth(selectedYear,selectedMonth)
      selectedYear=target.year
      selectedWeek=target.week
      document.querySelector('#yearSelect').value=String(selectedYear)
    }
    await refreshPeriod()
    renderView()
  }
}

async function refreshData(){vendors=await getVendors();await refreshPeriod()}
async function refreshPeriod(){
  const [from,to]=monthRange(selectedYear,selectedMonth)
  const yearFrom=`${selectedYear}-01-01`
  const yearTo=`${selectedYear}-12-31`
  const [monthEntries, budget, allEntries, budgets] = await Promise.all([
    getEntries(from,to),
    getMonthlyBudget(selectedYear,selectedMonth),
    getEntries(yearFrom,yearTo),
    getYearBudgets(selectedYear)
  ])
  entries=monthEntries
  monthlyBudget=Number(budget?.amount||0)
  yearEntries=allEntries
  yearBudgets=budgets
}
async function renderView(){
  const generation=++renderGeneration
  document.querySelectorAll('.nav-btn').forEach(button=>{
    button.classList.toggle('active',button.dataset.view===selectedView)
  })
  const titles={
    dashboard:['Übersicht','Monat, Dienstleister, Kosten, Stunden und Plan auf einen Blick.'],
    entry:['Zeiterfassung','Stunden für alle Dienstleister wochenweise erfassen.'],
    vendors:['Dienstleister & Preise','Firmen, Arbeitsbereiche und zeitabhängige Preise verwalten.']
  }
  const [title,subtitle]=titles[selectedView]||titles.dashboard
  document.querySelector('#pageTitle').textContent=title
  document.querySelector('#pageSubtitle').textContent=subtitle

  if(selectedView==='dashboard'){
    renderDashboard()
    return
  }
  if(selectedView==='vendors'){
    renderVendors()
    return
  }
  if(selectedView==='entry'){
    await renderEntry(generation)
  }
}
function yearlySummary(){return months.map((_,index)=>yearMonthSummary(index+1))}


function vendorAreaBreakdown(){
  return vendors
    .filter(v=>v.active)
    .map(vendor=>{
      const vendorEntries=entries.filter(e=>e.vendor_id===vendor.id)
      const areas={}
      vendorEntries.forEach(entry=>{
        const rate=rates.find(r=>r.id===entry.rate_id)
        const areaName=rate?.name||'Ohne Arbeitsbereich'
        if(!areas[areaName]) areas[areaName]={name:areaName,hours:0,cost:0}
        areas[areaName].hours+=Number(entry.hours||0)
        areas[areaName].cost+=entryCost(entry)
      })
      const rows=Object.values(areas).sort((a,b)=>a.name.localeCompare(b.name,'de'))
      return {
        vendor,
        rows,
        hours: rows.reduce((sum,row)=>sum+row.hours,0),
        cost: rows.reduce((sum,row)=>sum+row.cost,0)
      }
    })
    .filter(group=>group.rows.length>0 || group.cost>0 || group.hours>0)
}

function renderDashboard(){
  const totals=vendorTotals(),actual=totalCost(),hours=totalHours(),variance=actual-monthlyBudget,variancePct=monthlyBudget?variance/monthlyBudget*100:0,cph=hours?actual/hours:0
  const now=new Date(),isCurrent=selectedYear===now.getFullYear()&&selectedMonth===now.getMonth()+1,daysElapsed=isCurrent?now.getDate():new Date(selectedYear,selectedMonth,0).getDate(),daysMonth=new Date(selectedYear,selectedMonth,0).getDate(),forecast=isCurrent&&daysElapsed?actual/daysElapsed*daysMonth:actual
  const top=[...totals].sort((a,b)=>b.cost-a.cost)[0]
  const annual=yearlySummary()
  const annualPlan=annual.reduce((s,m)=>s+m.plan,0),annualActual=annual.reduce((s,m)=>s+m.actual,0),annualHours=annual.reduce((s,m)=>s+m.hours,0),annualVariance=annualActual-annualPlan

  document.querySelector('#content').innerHTML=`<div class="cards"><article class="card"><span>Ist-Kosten</span><strong>${euro(actual)}</strong><small>${months[selectedMonth-1]} ${selectedYear}</small></article><article class="card"><span>Gesamtstunden</span><strong>${number(hours)}</strong><small>${euro(cph)} je Stunde</small></article><article class="card"><span>Monatsplan</span><strong>${euro(monthlyBudget)}</strong><small class="${variance<=0?'good':'bad'}">${monthlyBudget?`${euro(Math.abs(variance))} ${variance<=0?'unter':'über'} Plan`:'Plan eintragen'}</small></article><article class="card"><span>Hochrechnung</span><strong>${euro(forecast)}</strong><small>${isCurrent?'bis Monatsende':'Monat abgeschlossen'}</small></article></div>
  <div class="grid-two"><article class="panel"><div class="panel-head"><div><h2>Monatsplan gesamt</h2><p>Ein Budget für den ausgewählten Monat.</p></div></div><div class="budget-row"><input id="budgetInput" type="number" min="0" step="100" value="${monthlyBudget||''}" placeholder="z. B. 25000"><button id="saveBudget" class="primary">Plan speichern</button></div><div class="stat-grid"><div><span>Abweichung</span><strong class="${variance<=0?'good':'bad'}">${euro(variance)}</strong></div><div><span>Abweichung %</span><strong class="${variance<=0?'good':'bad'}">${number(variancePct)} %</strong></div><div><span>Größter Anteil</span><strong>${top?.vendor.name||'–'}</strong></div><div><span>Aktive Firmen</span><strong>${vendors.filter(v=>v.active).length}</strong></div></div></article><article class="panel"><div class="panel-head"><div><h2>Planfortschritt</h2><p>Ist im Verhältnis zum Monatsplan</p></div></div><div class="big-progress"><span style="width:${monthlyBudget?Math.min(actual/monthlyBudget*100,100):0}%"></span></div><p><strong>${monthlyBudget?number(actual/monthlyBudget*100):0} %</strong> des Budgets verbraucht</p><p class="muted">Hochrechnung: ${euro(forecast)} · Erwartete Abweichung: ${euro(forecast-monthlyBudget)}</p></article></div>
  <article class="panel"><div class="panel-head"><div><h2>${months[selectedMonth-1]} ${selectedYear} nach Dienstleister und Arbeitsbereich</h2><p>Kosten und Stunden je Arbeitsbereich, Zwischensumme je Dienstleister und Gesamtsumme.</p></div></div><div class="table-wrap"><table class="breakdown-table"><thead><tr><th>Dienstleister</th><th>Arbeitsbereich</th><th>Stunden</th><th>Kosten</th><th>Ø Satz</th><th>Anteil gesamt</th></tr></thead><tbody>${vendorAreaBreakdown().map(group=>`${group.rows.map((row,index)=>`<tr class="area-row"><td>${index===0?`<span class="dot" style="background:${group.vendor.color}"></span>${group.vendor.name}`:''}</td><td>${row.name}</td><td>${number(row.hours)}</td><td>${euro(row.cost)}</td><td>${euro(row.hours?row.cost/row.hours:0)}</td><td>${number(actual?row.cost/actual*100:0)} %</td></tr>`).join('')}<tr class="vendor-subtotal"><td colspan="2">Summe ${group.vendor.name}</td><td>${number(group.hours)}</td><td>${euro(group.cost)}</td><td>${euro(group.hours?group.cost/group.hours:0)}</td><td>${number(actual?group.cost/actual*100:0)} %</td></tr>`).join('')}</tbody><tfoot><tr class="grand-total"><th colspan="2">Gesamt alle Dienstleister</th><th>${number(hours)}</th><th>${euro(actual)}</th><th>${euro(hours?actual/hours:0)}</th><th>100 %</th></tr></tfoot></table></div></article>
  <article class="panel annual-panel"><div class="panel-head"><div><h2>Jahresübersicht ${selectedYear}</h2><p>Alle Monatspläne direkt pflegen und mit Ist-Werten vergleichen.</p></div><div class="annual-totals"><span>Plan: <strong>${euro(annualPlan)}</strong></span><span>Ist: <strong>${euro(annualActual)}</strong></span><span class="${annualVariance<=0?'good':'bad'}">Abweichung: <strong>${euro(annualVariance)}</strong></span></div></div><div class="table-wrap"><table class="annual-table"><thead><tr><th>Monat</th><th>Plan</th><th>Ist</th><th>Stunden</th><th>Abweichung</th><th>Abweichung %</th><th>Status</th></tr></thead><tbody>${annual.map(m=>`<tr class="${m.month===selectedMonth?'selected-month-row':''}"><td><button class="month-link" data-month="${m.month}">${months[m.month-1]}</button></td><td><input class="annual-plan-input" data-month="${m.month}" type="number" min="0" step="100" value="${m.plan||''}" placeholder="0"></td><td>${euro(m.actual)}</td><td>${number(m.hours)}</td><td class="${m.variance<=0?'good':'bad'}">${euro(m.variance)}</td><td class="${m.variance<=0?'good':'bad'}">${m.plan?`${number(m.variancePct)} %`:'–'}</td><td><span class="month-status ${!m.plan?'neutral':m.variance<=0?'under':'over'}">${!m.plan?'Kein Plan':m.variance<=0?'Im Plan':'Über Plan'}</span></td></tr>`).join('')}</tbody><tfoot><tr><th>Gesamt</th><th>${euro(annualPlan)}</th><th>${euro(annualActual)}</th><th>${number(annualHours)}</th><th class="${annualVariance<=0?'good':'bad'}">${euro(annualVariance)}</th><th>${annualPlan?`${number(annualVariance/annualPlan*100)} %`:'–'}</th><th></th></tr></tfoot></table></div><p class="muted annual-save-hint">Pläne werden automatisch gespeichert, sobald du ein Feld verlässt.</p></article>`

  document.querySelector('#saveBudget').onclick=async()=>{
    try{
      await upsertMonthlyBudget(selectedYear,selectedMonth,document.querySelector('#budgetInput').value)
      await refreshPeriod();renderDashboard();toast('Monatsplan gespeichert.')
    }catch(err){toast(err.message)}
  }
  document.querySelectorAll('.annual-plan-input').forEach(input=>input.onchange=async e=>{
    const month=Number(e.target.dataset.month)
    try{
      await upsertMonthlyBudget(selectedYear,month,e.target.value)
      await refreshPeriod();renderDashboard();toast(`${months[month-1]} gespeichert.`)
    }catch(err){toast(err.message)}
  })
  document.querySelectorAll('.month-link').forEach(button=>button.onclick=async e=>{
    selectedMonth=Number(e.currentTarget.dataset.month)
    document.querySelector('#monthSelect').value=String(selectedMonth)
    await refreshPeriod()
    renderDashboard()
    window.scrollTo({top:0,behavior:'smooth'})
  })
}

async function renderEntry(generation=renderGeneration){
  const content=document.querySelector('#content')
  content.innerHTML=`<article class="panel"><p class="muted">Kalenderwoche wird geladen …</p></article>`
  try{
    await loadSelectedWeek()
    if(generation!==renderGeneration || selectedView!=='entry') return
  }catch(err){
    if(generation!==renderGeneration || selectedView!=='entry') return
    content.innerHTML=`<article class="panel"><p class="bad">${err.message}</p></article>`
    return
  }

  const active=vendors.filter(v=>v.active),dates=weekDates(selectedYear,selectedWeek)
  const previousMonday=mondayOfWeek(selectedYear,selectedWeek)
  previousMonday.setUTCDate(previousMonday.getUTCDate()-7)
  const nextMonday=mondayOfWeek(selectedYear,selectedWeek)
  nextMonday.setUTCDate(nextMonday.getUTCDate()+7)

  content.innerHTML=`<article class="panel"><div class="panel-head entry-period-head"><div><h2>Kalenderwoche ${selectedWeek}</h2><p>${weekLabel(dates)} · Vergangene Wochen können jederzeit angesehen und bearbeitet werden.</p></div><div class="week-controls"><button id="previousWeek" class="secondary" title="Vorherige Woche">←</button><select id="weekSelect">${Array.from({length:weeksInYear(selectedYear)},(_,i)=>i+1).map(w=>`<option value="${w}" ${w===selectedWeek?'selected':''}>KW ${w}</option>`).join('')}</select><button id="nextWeek" class="secondary" title="Nächste Woche">→</button></div></div><div class="entry-period-summary"><strong>${months[selectedMonth-1]} ${selectedYear}</strong><span>Die Stunden werden für die oben ausgewählte Kalenderwoche geladen.</span></div><div class="all-vendors-entry">${active.map(v=>renderVendorEntry(v,dates)).join('')}</div></article>`

  document.querySelector('#weekSelect').onchange=async e=>{
    selectedWeek=Number(e.target.value)
    await renderEntry(renderGeneration)
  }
  document.querySelector('#previousWeek').onclick=async()=>{
    selectedYear=isoWeekYear(previousMonday)
    selectedWeek=isoWeek(previousMonday)
    selectedMonth=previousMonday.getUTCMonth()+1
    document.querySelector('#yearSelect').value=String(selectedYear)
    document.querySelector('#monthSelect').value=String(selectedMonth)
    await refreshPeriod()
    await renderEntry(renderGeneration)
  }
  document.querySelector('#nextWeek').onclick=async()=>{
    selectedYear=isoWeekYear(nextMonday)
    selectedWeek=isoWeek(nextMonday)
    selectedMonth=nextMonday.getUTCMonth()+1
    document.querySelector('#yearSelect').value=String(selectedYear)
    document.querySelector('#monthSelect').value=String(selectedMonth)
    await refreshPeriod()
    await renderEntry(renderGeneration)
  }

  document.querySelectorAll('.hours').forEach(input=>input.onchange=async e=>{
    const field=e.target
    const value=Number(String(field.value).replace(',','.'))||0
    field.disabled=true
    try{
      await upsertEntry({
        vendor_id:field.dataset.vendor,
        rate_id:field.dataset.rate,
        work_date:field.dataset.date,
        hours:value
      })
      await Promise.all([refreshPeriod(),loadSelectedWeek()])
      const saved=weekEntries.find(entry=>entry.work_date===field.dataset.date&&entry.vendor_id===field.dataset.vendor&&entry.rate_id===field.dataset.rate)
      field.value=saved&&Number(saved.hours)!==0?number(saved.hours):''
      refreshEntryTotals(dates)
      toast('Gespeichert')
    }catch(err){
      toast(err.message)
    }finally{
      field.disabled=false
    }
  })
}
function refreshEntryTotals(dates){
  vendors.filter(v=>v.active).forEach(vendor=>{
    const vendorTotal=weekEntries.filter(e=>e.vendor_id===vendor.id&&dates.some(d=>d.date===e.work_date)).reduce((s,e)=>s+entryCost(e),0)
    const totalEl=document.querySelector(`[data-vendor-total="${vendor.id}"]`)
    if(totalEl) totalEl.textContent=euro(vendorTotal)
    dates.forEach(d=>{
      const dayCost=weekEntries.filter(e=>e.work_date===d.date&&e.vendor_id===vendor.id).reduce((s,e)=>s+entryCost(e),0)
      const dayEl=document.querySelector(`[data-day-cost="${vendor.id}|${d.date}"]`)
      if(dayEl) dayEl.textContent=euro(dayCost)
    })
  })
}

function renderVendorEntry(vendor,dates){
  const weekRates=(vendor.vendor_rates||[]).filter(r=>dates.some(d=>isRateValid(r,d.date)))
  if(!weekRates.length)return`<section class="vendor-entry-block"><h3><span class="dot" style="background:${vendor.color}"></span>${vendor.name}</h3><p class="muted">Für diese Woche ist kein gültiger Preiszeitraum hinterlegt.</p></section>`
  const total=weekEntries.filter(e=>e.vendor_id===vendor.id&&dates.some(d=>d.date===e.work_date)).reduce((s,e)=>s+entryCost(e),0)
  return`<section class="vendor-entry-block"><div class="vendor-entry-head"><h3><span class="dot" style="background:${vendor.color}"></span>${vendor.name}</h3><strong data-vendor-total="${vendor.id}">${euro(total)}</strong></div><div class="entry-grid"><div class="entry-row entry-header"><div>Tag</div>${weekRates.map(r=>`<div>${r.name}<br><small>${euro(r.hourly_rate)}/h</small></div>`).join('')}<div>Kosten</div></div>${dates.map(d=>{const cells=weekRates.map(r=>{if(!isRateValid(r,d.date))return'<div class="rate-unavailable">–</div>';const existing=weekEntries.find(e=>e.work_date===d.date&&e.vendor_id===vendor.id&&e.rate_id===r.id);return`<input class="hours" data-date="${d.date}" data-vendor="${vendor.id}" data-rate="${r.id}" inputmode="decimal" value="${existing?.hours||''}" placeholder="0,00">`}).join('');const dayCost=weekEntries.filter(e=>e.work_date===d.date&&e.vendor_id===vendor.id).reduce((s,e)=>s+entryCost(e),0);return`<div class="entry-row"><div class="day">${d.name}<br><small>${d.date.split('-').reverse().join('.')}</small></div>${cells}<div data-day-cost="${vendor.id}|${d.date}">${euro(dayCost)}</div></div>`}).join('')}</div></section>`
}

function periodLabel(r){const from=r.effective_from?.split('-').reverse().join('.')||'–',to=r.effective_to?r.effective_to.split('-').reverse().join('.'):'offen';return`${from} – ${to}`}
function renderVendors(){
  document.querySelector('#content').innerHTML=`<article class="panel"><div class="panel-head"><div><h2>Firmen und Preiszeiträume</h2><p>Preisänderungen werden als eigener Zeitraum gespeichert.</p></div><button id="newVendor" class="primary">+ Dienstleister</button></div><div class="vendor-list">${vendors.map(v=>`<div class="vendor-card"><div><strong><span class="dot" style="background:${v.color}"></span>${v.name}</strong>${!v.active?' <span class="badge employee">Inaktiv</span>':''}<div class="price-history">${(v.vendor_rates||[]).sort((a,b)=>b.effective_from.localeCompare(a.effective_from)).map(r=>`<div class="price-period"><span><strong>${r.name}</strong> · ${euro(r.hourly_rate)}/h</span><small>${periodLabel(r)}</small></div>`).join('')}</div></div><div class="actions"><button class="secondary editVendor" data-id="${v.id}">Bearbeiten</button>${v.active?`<button class="danger disableVendor" data-id="${v.id}">Deaktivieren</button>`:''}</div></div>`).join('')}</div></article>`
  document.querySelector('#newVendor').onclick=()=>vendorModal();document.querySelectorAll('.editVendor').forEach(b=>b.onclick=()=>vendorModal(vendors.find(v=>v.id===b.dataset.id)));document.querySelectorAll('.disableVendor').forEach(b=>b.onclick=async()=>{if(confirm('Dienstleister deaktivieren?')){await deactivateVendor(b.dataset.id);await refreshData();renderVendors()}})
}
function rateRow(r={}){return`<div class="rate-period-row"><input class="rName" data-id="${r.id||''}" value="${r.name||''}" placeholder="Tätigkeit" required><input class="rPrice" type="number" min="0" step=".01" value="${r.hourly_rate||''}" placeholder="€/h" required><label>Von<input class="rFrom" type="date" value="${r.effective_from||`${selectedYear}-01-01`}" required></label><label>Bis<input class="rTo" type="date" value="${r.effective_to||''}"></label></div>`}
function vendorModal(vendor=null){const rates=vendor?.vendor_rates?.length?vendor.vendor_rates:[{}],modal=document.createElement('div');modal.className='modal';modal.innerHTML=`<form class="modal-card wide-modal"><h2>${vendor?'Dienstleister bearbeiten':'Dienstleister anlegen'}</h2><label>Firmenname<input id="vName" value="${vendor?.name||''}" required></label><label>Farbe<input id="vColor" type="color" value="${vendor?.color||'#2563eb'}"></label><h3>Preise und Gültigkeitszeiträume</h3><div id="rates">${rates.map(rateRow).join('')}</div><button id="addRate" type="button" class="secondary">+ Neuer Preiszeitraum</button><div class="modal-actions"><button id="cancel" type="button" class="secondary">Abbrechen</button><button class="primary">Speichern</button></div></form>`;document.body.append(modal);modal.querySelector('#cancel').onclick=()=>modal.remove();modal.querySelector('#addRate').onclick=()=>modal.querySelector('#rates').insertAdjacentHTML('beforeend',rateRow());modal.querySelector('form').onsubmit=async e=>{e.preventDefault();const rates=[...modal.querySelectorAll('.rate-period-row')].map(row=>({id:row.querySelector('.rName').dataset.id||undefined,name:row.querySelector('.rName').value.trim(),hourly_rate:Number(row.querySelector('.rPrice').value),effective_from:row.querySelector('.rFrom').value,effective_to:row.querySelector('.rTo').value||null}));try{await saveVendor({id:vendor?.id,name:modal.querySelector('#vName').value.trim(),color:modal.querySelector('#vColor').value,active:true,rates});modal.remove();await refreshData();renderVendors();toast('Gespeichert.')}catch(err){toast(err.message)}}}

async function loadApp(){await refreshData();shell();renderView();if(liveChannel)supabase.removeChannel(liveChannel);liveChannel=subscribeToChanges(()=>{clearTimeout(liveTimer);liveTimer=setTimeout(async()=>{await refreshData();if(selectedView==='entry'){await loadSelectedWeek();const dates=weekDates(selectedYear,selectedWeek);refreshEntryTotals(dates)}else{renderView()}toast('Daten synchronisiert')},350)})}
async function boot(){if(!configured){authScreen();return}const{data}=await getSession();session=data.session;onAuthChange(async(event,newSession)=>{session=newSession;if(event==='PASSWORD_RECOVERY')return passwordUpdateScreen();if(!session)authScreen();else await loadApp()});if(session)await loadApp();else authScreen()}
boot().catch(err=>authScreen('login',err.message))

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(error => console.warn('Service Worker:', error))
  })
}
