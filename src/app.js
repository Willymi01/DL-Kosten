import './styles.css'
import { configured, supabase } from './supabase.js'
import { signIn, signUp, signOut, sendReset, updatePassword, getSession, onAuthChange } from './auth.js'
import { getVendors, saveVendor, deactivateVendor, getEntries, upsertEntry, getPlans, upsertPlan } from './data.js'

const app = document.querySelector('#app')
const months = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
const days = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag']
const euro = n => new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(Number(n)||0)
const number = n => new Intl.NumberFormat('de-DE',{maximumFractionDigits:2}).format(Number(n)||0)

let session = null
let vendors = []
let entries = []
let plans = []
let selectedView = 'dashboard'
let selectedYear = new Date().getFullYear()
let selectedMonth = new Date().getMonth()+1
let selectedWeek = isoWeek(new Date())

function toast(text) {
  const el = document.createElement('div')
  el.className = 'toast'
  el.textContent = text
  document.body.append(el)
  setTimeout(()=>el.remove(), 2600)
}

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const y0 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - y0) / 86400000) + 1) / 7)
}
function weeksInYear(year){ return isoWeek(new Date(year,11,28)) }
function mondayOfWeek(year, week){
  const simple = new Date(year,0,1+(week-1)*7)
  const dow = simple.getDay()
  const monday = new Date(simple)
  monday.setDate(simple.getDate() + (dow<=4 ? 1-dow : 8-dow))
  return monday
}
function fmtDate(d){ return d.toISOString().slice(0,10) }
function monthRange(year,month){
  const from = new Date(year,month-1,1)
  const to = new Date(year,month,0)
  return [fmtDate(from),fmtDate(to)]
}
function weekDates(year,week){
  const start=mondayOfWeek(year,week)
  return days.map((name,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return {name,date:fmtDate(d)}})
}
function canManage(){ return true }

function authScreen(mode='login', message='') {
  app.innerHTML = `<main class="auth-shell"><section class="auth-card">
    <div class="brand"><div class="brand-mark">CP</div><div><strong>CostPilot Secure</strong><small>Geschütztes Kostencontrolling</small></div></div>
    ${!configured?`<div class="message">Supabase ist noch nicht konfiguriert. Kopiere <code>.env.example</code> nach <code>.env</code> und trage URL sowie Anon Key ein.</div>`:''}
    <div class="auth-tabs"><button id="tabLogin" class="${mode==='login'?'active':''}">Anmelden</button><button id="tabSignup" class="${mode==='signup'?'active':''}">Registrieren</button></div>
    ${message?`<div class="message">${message}</div>`:''}
    <form id="authForm" class="form-grid">
      ${mode==='signup'?'<label>Name<input id="fullName" autocomplete="name" required></label>':''}
      <label>E-Mail<input id="email" type="email" autocomplete="email" required></label>
      <label>Passwort<input id="password" type="password" autocomplete="${mode==='login'?'current-password':'new-password'}" minlength="10" required></label>
      <button class="primary" ${!configured?'disabled':''}>${mode==='login'?'Sicher anmelden':'Konto erstellen'}</button>
      ${mode==='login'?'<button id="resetBtn" type="button" class="link-btn">Passwort vergessen?</button>':''}
    </form>
  </section></main>`
  document.querySelector('#tabLogin').onclick=()=>authScreen('login')
  document.querySelector('#tabSignup').onclick=()=>authScreen('signup')
  document.querySelector('#authForm').onsubmit=async e=>{
    e.preventDefault()
    const email=document.querySelector('#email').value.trim()
    const password=document.querySelector('#password').value
    const result = mode==='login'
      ? await signIn(email,password)
      : await signUp(email,password,document.querySelector('#fullName').value.trim())
    if(result.error) return authScreen(mode, result.error.message)
    if(mode==='signup' && !result.data.session) authScreen('login','Bitte bestätige deine E-Mail. Danach kannst du dich anmelden.')
  }
  const reset=document.querySelector('#resetBtn')
  if(reset) reset.onclick=async()=>{
    const email=document.querySelector('#email').value.trim()
    if(!email) return toast('Bitte zuerst die E-Mail-Adresse eintragen.')
    const {error}=await sendReset(email)
    toast(error?error.message:'E-Mail zum Zurücksetzen wurde versendet.')
  }
}

function passwordUpdateScreen(){
  app.innerHTML=`<main class="auth-shell"><section class="auth-card"><div class="brand"><div class="brand-mark">CP</div><div><strong>Neues Passwort</strong><small>Mindestens 10 Zeichen empfohlen</small></div></div><form id="pwForm" class="form-grid"><label>Neues Passwort<input id="newPassword" type="password" minlength="10" required></label><button class="primary">Passwort speichern</button></form></section></main>`
  document.querySelector('#pwForm').onsubmit=async e=>{e.preventDefault();const {error}=await updatePassword(document.querySelector('#newPassword').value);if(error)toast(error.message);else{toast('Passwort aktualisiert.');await loadApp()}}
}

function shell(){
  const email=session.user.email
  app.innerHTML=`<div class="app-shell">
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark">CP</div><div><strong>CostPilot</strong><small>Secure Cloud</small></div></div>
      <nav>${navButton('dashboard','Übersicht')}${navButton('entry','Zeiterfassung')}${navButton('vendors','Dienstleister')}${navButton('plans','Planzahlen')}</nav>
      <div class="sidebar-footer"><div class="user-chip">${email}</div><button id="logout" class="secondary">Abmelden</button></div>
    </aside>
    <main class="main">
      <header class="topbar"><div style="display:flex;gap:10px"><button id="menu" class="secondary mobile-menu">☰</button><div><h1 id="title"></h1><p id="subtitle"></p></div></div>
      <div class="actions"><select id="yearSelect">${Array.from({length:9},(_,i)=>new Date().getFullYear()-4+i).map(y=>`<option ${y===selectedYear?'selected':''}>${y}</option>`).join('')}</select><select id="monthSelect">${months.map((m,i)=>`<option value="${i+1}" ${i+1===selectedMonth?'selected':''}>${m}</option>`).join('')}</select></div></header>
      <section id="content"></section>
    </main></div>`
  document.querySelector('#logout').onclick=()=>signOut()
  document.querySelector('#menu').onclick=()=>document.querySelector('.sidebar').classList.toggle('open')
  document.querySelectorAll('.nav-btn').forEach(b=>b.onclick=()=>{selectedView=b.dataset.view;renderView();document.querySelector('.sidebar').classList.remove('open')})
  document.querySelector('#yearSelect').onchange=async e=>{selectedYear=+e.target.value;await refreshPeriod();renderView()}
  document.querySelector('#monthSelect').onchange=async e=>{selectedMonth=+e.target.value;await refreshPeriod();renderView()}
}

function navButton(view,label){return `<button class="nav-btn ${selectedView===view?'active':''}" data-view="${view}">${label}</button>`}

async function refreshData(){
  vendors=await getVendors()
  await refreshPeriod()
}
async function refreshPeriod(){
  const [from,to]=monthRange(selectedYear,selectedMonth)
  entries=await getEntries(from,to)
  plans=await getPlans(selectedYear,selectedMonth)
}
function entryCost(e){return Number(e.hours)*Number(e.vendor_rates?.hourly_rate||0)}
function totalCost(){return entries.reduce((s,e)=>s+entryCost(e),0)}
function totalHours(){return entries.reduce((s,e)=>s+Number(e.hours),0)}
function vendorTotals(){
  return vendors.map(v=>{
    const related=entries.filter(e=>e.vendor_id===v.id)
    return {vendor:v,hours:related.reduce((s,e)=>s+Number(e.hours),0),cost:related.reduce((s,e)=>s+entryCost(e),0),plan:Number(plans.find(p=>p.vendor_id===v.id)?.amount||0)}
  })
}

function renderView(){
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===selectedView))
  const titles={dashboard:['Übersicht','Kosten, Stunden und Plan-Ist-Auswertung.'],entry:['Zeiterfassung','Wöchentliche Stunden sicher in der Cloud erfassen.'],vendors:['Dienstleister','Firmen und Stundensätze verwalten.'],plans:['Planzahlen','Monatliche Budgets festlegen.'],team:['Team & Rollen','Berechtigungen der Filiale kontrollieren.']}
  document.querySelector('#title').textContent=titles[selectedView][0]
  document.querySelector('#subtitle').textContent=titles[selectedView][1]
  if(selectedView==='dashboard')renderDashboard()
  if(selectedView==='entry')renderEntry()
  if(selectedView==='vendors')renderVendors()
  if(selectedView==='plans')renderPlans()
  }

function renderDashboard(){
  const totals=vendorTotals(), plan=totals.reduce((s,x)=>s+x.plan,0), actual=totalCost()
  document.querySelector('#content').innerHTML=`<div class="cards">
    <article class="card"><span>Monatskosten</span><strong>${euro(actual)}</strong><small class="${actual<=plan?'good':'bad'}">${plan?`${euro(Math.abs(actual-plan))} ${actual<=plan?'unter':'über'} Plan`:'Kein Plan gesetzt'}</small></article>
    <article class="card"><span>Stunden</span><strong>${number(totalHours())}</strong><small>im ausgewählten Monat</small></article>
    <article class="card"><span>Monatsplan</span><strong>${euro(plan)}</strong><small>${months[selectedMonth-1]} ${selectedYear}</small></article>
    <article class="card"><span>Dienstleister</span><strong>${vendors.filter(v=>v.active).length}</strong><small>aktive Firmen</small></article></div>
    <div class="grid-two"><article class="panel"><div class="panel-head"><div><h2>Dienstleistervergleich</h2><p>Stunden und Kosten</p></div></div><div class="table-wrap"><table><thead><tr><th>Firma</th><th>Stunden</th><th>Ist</th><th>Plan</th><th>Abweichung</th></tr></thead><tbody>${totals.map(x=>`<tr><td><span class="dot" style="background:${x.vendor.color}"></span>${x.vendor.name}</td><td>${number(x.hours)}</td><td>${euro(x.cost)}</td><td>${euro(x.plan)}</td><td class="${x.cost<=x.plan?'good':'bad'}">${euro(x.cost-x.plan)}</td></tr>`).join('')}</tbody></table></div></article>
    <article class="panel"><div class="panel-head"><div><h2>Zugriffsschutz</h2><p>Aktuelle Sitzung</p></div></div><p><strong>Konto:</strong> ${session.user.email}</p><p class="muted">Alle Daten gehören ausschließlich diesem Benutzerkonto und sind durch Row-Level-Security geschützt.</p></article></div>`
}

function renderEntry(){
  const active=vendors.filter(v=>v.active)
  document.querySelector('#content').innerHTML=`<article class="panel"><div class="panel-head"><div><h2>KW ${selectedWeek}</h2><p>Änderungen werden direkt gespeichert.</p></div><div class="actions"><select id="weekSelect">${Array.from({length:weeksInYear(selectedYear)},(_,i)=>i+1).map(w=>`<option ${w===selectedWeek?'selected':''}>${w}</option>`).join('')}</select><select id="vendorSelect">${active.map(v=>`<option value="${v.id}">${v.name}</option>`).join('')}</select></div></div><div id="entryArea"></div></article>`
  document.querySelector('#weekSelect').onchange=e=>{selectedWeek=+e.target.value;renderEntryGrid()}
  document.querySelector('#vendorSelect').onchange=renderEntryGrid
  renderEntryGrid()
}
function renderEntryGrid(){
  const vendor=vendors.find(v=>v.id===document.querySelector('#vendorSelect')?.value)||vendors.find(v=>v.active)
  const area=document.querySelector('#entryArea')
  if(!vendor){area.innerHTML='<p>Kein aktiver Dienstleister vorhanden.</p>';return}
  const rates=(vendor.vendor_rates||[]).filter(r=>r.active)
  const dates=weekDates(selectedYear,selectedWeek)
  area.innerHTML=`<div class="entry-grid"><div class="entry-row header"><div>Tag</div>${rates.map(r=>`<div>${r.name}<br>${euro(r.hourly_rate)}/h</div>`).join('')}<div>Kosten</div></div>${dates.map(d=>{
    const inputs=rates.map(r=>{const existing=entries.find(e=>e.work_date===d.date&&e.vendor_id===vendor.id&&e.rate_id===r.id);return `<input class="hours" data-date="${d.date}" data-vendor="${vendor.id}" data-rate="${r.id}" inputmode="decimal" value="${existing?.hours||''}" placeholder="0,00">`}).join('')
    const dayCost=entries.filter(e=>e.work_date===d.date&&e.vendor_id===vendor.id).reduce((s,e)=>s+entryCost(e),0)
    return `<div class="entry-row"><div class="day">${d.name}<br><small>${d.date.split('-').reverse().join('.')}</small></div>${inputs}<div>${euro(dayCost)}</div></div>`
  }).join('')}</div>`
  document.querySelectorAll('.hours').forEach(input=>input.onchange=async e=>{
    const value=Number(e.target.value.replace(',','.'))||0
    try{
      await upsertEntry({vendor_id:e.target.dataset.vendor,rate_id:e.target.dataset.rate,work_date:e.target.dataset.date,hours:value})
      await refreshPeriod();renderEntryGrid();toast('Gespeichert')
    }catch(err){toast(err.message)}
  })
}

function renderVendors(){
  document.querySelector('#content').innerHTML=`<article class="panel"><div class="panel-head"><div><h2>Firmen und Preise</h2><p>${canManage()?'Preise dürfen durch deine Rolle bearbeitet werden.':'Nur lesender Zugriff.'}</p></div>${canManage()?'<button id="newVendor" class="primary">+ Dienstleister</button>':''}</div><div class="vendor-list">${vendors.map(v=>`<div class="vendor-card"><div><strong><span class="dot" style="background:${v.color}"></span>${v.name}</strong>${!v.active?' <span class="badge employee">Inaktiv</span>':''}<div class="chips">${(v.vendor_rates||[]).map(r=>`<span class="chip">${r.name}: ${euro(r.hourly_rate)}/h</span>`).join('')}</div></div>${canManage()?`<div class="actions"><button class="secondary editVendor" data-id="${v.id}">Bearbeiten</button>${v.active?`<button class="danger disableVendor" data-id="${v.id}">Deaktivieren</button>`:''}</div>`:''}</div>`).join('')}</div></article>`
  if(canManage()){
    document.querySelector('#newVendor').onclick=()=>vendorModal()
    document.querySelectorAll('.editVendor').forEach(b=>b.onclick=()=>vendorModal(vendors.find(v=>v.id===b.dataset.id)))
    document.querySelectorAll('.disableVendor').forEach(b=>b.onclick=async()=>{if(confirm('Dienstleister deaktivieren?')){await deactivateVendor(b.dataset.id);await refreshData();renderVendors()}})
  }
}
function vendorModal(vendor=null){
  const rates=vendor?.vendor_rates?.length?vendor.vendor_rates:[{name:'Kasse',hourly_rate:0}]
  const modal=document.createElement('div');modal.className='modal'
  modal.innerHTML=`<form class="modal-card"><h2>${vendor?'Dienstleister bearbeiten':'Dienstleister anlegen'}</h2><label>Firmenname<input id="vName" value="${vendor?.name||''}" required></label><label>Farbe<input id="vColor" type="color" value="${vendor?.color||'#2563eb'}"></label><div id="rates">${rates.map(r=>`<div class="rate-row"><input class="rName" data-id="${r.id||''}" value="${r.name||''}" placeholder="Tätigkeit" required><input class="rPrice" type="number" min="0" step=".01" value="${r.hourly_rate||0}" required></div>`).join('')}</div><button id="addRate" type="button" class="secondary">+ Tätigkeit</button><div class="modal-actions"><button id="cancel" type="button" class="secondary">Abbrechen</button><button class="primary">Speichern</button></div></form>`
  document.body.append(modal)
  modal.querySelector('#cancel').onclick=()=>modal.remove()
  modal.querySelector('#addRate').onclick=()=>modal.querySelector('#rates').insertAdjacentHTML('beforeend','<div class="rate-row"><input class="rName" placeholder="Tätigkeit" required><input class="rPrice" type="number" min="0" step=".01" required></div>')
  modal.querySelector('form').onsubmit=async e=>{
    e.preventDefault()
    const rates=[...modal.querySelectorAll('.rate-row')].map(row=>({id:row.querySelector('.rName').dataset.id||undefined,name:row.querySelector('.rName').value.trim(),hourly_rate:Number(row.querySelector('.rPrice').value)}))
    try{await saveVendor({id:vendor?.id,name:modal.querySelector('#vName').value.trim(),color:modal.querySelector('#vColor').value,active:true,rates});modal.remove();await refreshData();renderVendors();toast('Dienstleister gespeichert.')}catch(err){toast(err.message)}
  }
}

function renderPlans(){
  const totals=vendorTotals()
  document.querySelector('#content').innerHTML=`<article class="panel"><div class="panel-head"><div><h2>${months[selectedMonth-1]} ${selectedYear}</h2><p>${canManage()?'Budgets können geändert werden.':'Nur lesender Zugriff.'}</p></div></div><div class="table-wrap"><table><thead><tr><th>Dienstleister</th><th>Plan</th><th>Ist</th><th>Abweichung</th></tr></thead><tbody>${totals.map(x=>`<tr><td>${x.vendor.name}</td><td>${canManage()?`<input class="planInput" data-vendor="${x.vendor.id}" type="number" min="0" step="50" value="${x.plan||''}">`:euro(x.plan)}</td><td>${euro(x.cost)}</td><td class="${x.cost<=x.plan?'good':'bad'}">${euro(x.cost-x.plan)}</td></tr>`).join('')}</tbody></table></div></article>`
  if(canManage())document.querySelectorAll('.planInput').forEach(i=>i.onchange=async e=>{try{await upsertPlan(e.target.dataset.vendor,selectedYear,selectedMonth,e.target.value);await refreshPeriod();renderPlans();toast('Plan gespeichert.')}catch(err){toast(err.message)}})
}

async function loadApp(){
  await refreshData()
  shell()
  renderView()
}

async function boot(){
  if(!configured){authScreen();return}
  const {data}=await getSession();session=data.session
  onAuthChange(async(event,newSession)=>{
    session=newSession
    if(event==='PASSWORD_RECOVERY')return passwordUpdateScreen()
    if(!session)authScreen()
    else await loadApp()
  })
  if(session)await loadApp();else authScreen()
}
boot().catch(err=>authScreen('login',err.message))
