const providerNames=["LIT","Transimeksa","Bertschi","Duvenbeck","Dachser","Raben","DSV"];const rates=[{id:1,provider:"LIT",country:"DE",zone:"24",zipFrom:"24000",zipTo:"24999",transport:"FTL",ldm:"",base:920,floater:8.5,status:"active"},{id:2,provider:"LIT",country:"DE",zone:"22",zipFrom:"22000",zipTo:"22999",transport:"Mega",ldm:"",base:995,floater:8.5,status:"active"},{id:3,provider:"Transimeksa",country:"BE",zone:"24",zipFrom:"2400",zipTo:"2499",transport:"FTL",ldm:"",base:1180,floater:7,status:"active"},{id:4,provider:"Bertschi",country:"DE",zone:"48",zipFrom:"48000",zipTo:"48999",transport:"Teilladung",ldm:"5,0",base:680,floater:6.5,status:"active"},{id:5,provider:"Duvenbeck",country:"NL",zone:"50",zipFrom:"5000",zipTo:"5099",transport:"FTL",ldm:"",base:1240,floater:9,status:"active"},{id:6,provider:"Dachser",country:"FR",zone:"67",zipFrom:"67000",zipTo:"67999",transport:"Jumbo",ldm:"",base:1490,floater:8,status:"active"},{id:7,provider:"Raben",country:"DE",zone:"47",zipFrom:"47000",zipTo:"47999",transport:"Teilladung",ldm:"7,5",base:755,floater:7.5,status:"active"},{id:8,provider:"DSV",country:"DE",zone:"22",zipFrom:"22000",zipTo:"22999",transport:"FTL",ldm:"",base:1015,floater:8.2,status:"inactive"},{id:9,provider:"LIT",country:"DE",zone:"24",zipFrom:"24000",zipTo:"24999",transport:"Teilladung",ldm:"3,0",base:545,floater:8.5,status:"active"},{id:10,provider:"Transimeksa",country:"DE",zone:"24",zipFrom:"24000",zipTo:"24999",transport:"Mega",ldm:"",base:980,floater:7,status:"active"}];let editingId=null;const rows=document.getElementById("rateRows"),search=document.getElementById("rateSearch"),providerFilter=document.getElementById("rateProviderFilter"),transportFilter=document.getElementById("rateTransportFilter"),statusFilter=document.getElementById("rateStatusFilter"),modal=document.getElementById("rateModal");function esc(v=""){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}function euro(n){return new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(n)}function total(r){return r.base*(1+(Number(r.floater)||0)/100)}function initProviders(){providerNames.forEach(p=>{let a=document.createElement("option");a.value=p;a.textContent=p;providerFilter.appendChild(a);let b=document.createElement("option");b.value=p;b.textContent=p;rateProvider.appendChild(b)})}function render(){let q=search.value.trim().toLowerCase(),pf=providerFilter.value,tf=transportFilter.value,sf=statusFilter.value;let filtered=rates.filter(r=>{let hay=`${r.provider} ${r.country} ${r.zone} ${r.zipFrom} ${r.zipTo} ${r.transport}`.toLowerCase();return(!q||hay.includes(q))&&(!pf||r.provider===pf)&&(!tf||r.transport===tf)&&(!sf||r.status===sf)});activeRateCount.textContent=rates.filter(r=>r.status==="active").length;rateProviderCount.textContent=new Set(rates.map(r=>r.provider)).size;rateCountryCount.textContent=new Set(rates.map(r=>r.country)).size;avgRatePrice.textContent=euro(rates.reduce((s,r)=>s+r.base,0)/rates.length);visibleRateCount.textContent=filtered.length;rows.innerHTML=filtered.map(r=>`<tr><td><div class="provider-name-cell"><div class="provider-avatar">${esc(r.provider.slice(0,2).toUpperCase())}</div><div><strong>${esc(r.provider)}</strong><small>Tarif-ID ${r.id}</small></div></div></td><td><strong class="table-main">${esc(r.country)}</strong><small>${esc(r.zipFrom)}–${esc(r.zipTo)}</small></td><td><strong class="table-main">Zone ${esc(r.zone)}</strong><small>${esc(r.zipFrom)}–${esc(r.zipTo)}</small></td><td><span class="transport-pill">${esc(r.transport)}</span>${r.ldm?`<small>${esc(r.ldm)} Ldm</small>`:""}</td><td><strong class="price-cell">${euro(r.base)}</strong></td><td><span class="floater-pill">${Number(r.floater).toLocaleString("de-DE")} %</span></td><td><strong class="price-cell total-price">${euro(total(r))}</strong></td><td><span class="status-pill ${r.status}">${r.status==="active"?"Aktiv":"Inaktiv"}</span></td><td class="row-actions"><button class="icon-button" data-edit="${r.id}">✎</button><button class="icon-button more-button">•••</button></td></tr>`).join("")||`<tr><td colspan="9" class="empty-state">Keine Tarife für diesen Filter gefunden.</td></tr>`}function toast(text){rateToast.textContent=text;rateToast.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>rateToast.hidden=true,2400)}function openModal(r=null){editingId=r?.id??null;rateModalTitle.textContent=r?"Tarif bearbeiten":"Neuer Tarif";rateProvider.value=r?.provider??providerNames[0];rateStatus.value=r?.status??"active";rateCountry.value=r?.country??"DE";rateZone.value=r?.zone??"";rateZipFrom.value=r?.zipFrom??"";rateZipTo.value=r?.zipTo??"";rateTransport.value=r?.transport??"FTL";rateLdm.value=r?.ldm??"";rateBase.value=r?.base??"";rateFloater.value=r?.floater??"";rateNotes.value=r?.notes??"";modal.hidden=false;document.body.classList.add("modal-open")}function closeModal(){modal.hidden=true;document.body.classList.remove("modal-open")}newRateBtn.addEventListener("click",()=>openModal());closeRateModalBtn.addEventListener("click",closeModal);cancelRateModalBtn.addEventListener("click",closeModal);modal.addEventListener("click",e=>{if(e.target===modal)closeModal()});rows.addEventListener("click",e=>{let b=e.target.closest("[data-edit]");if(!b)return;let r=rates.find(x=>x.id===Number(b.dataset.edit));if(r)openModal(r)});rateForm.addEventListener("submit",e=>{e.preventDefault();let data={provider:rateProvider.value,status:rateStatus.value,country:rateCountry.value,zone:rateZone.value.trim(),zipFrom:rateZipFrom.value.trim(),zipTo:rateZipTo.value.trim(),transport:rateTransport.value,ldm:rateLdm.value.trim(),base:Number(rateBase.value||0),floater:Number(rateFloater.value||0),notes:rateNotes.value.trim()};if(editingId){Object.assign(rates.find(x=>x.id===editingId),data);toast("Tarif wurde in der Layout-Demo aktualisiert.")}else{rates.unshift({id:Date.now(),...data});toast("Tarif wurde in der Layout-Demo angelegt.")}closeModal();render()});[search,providerFilter,transportFilter,statusFilter].forEach(x=>x.addEventListener("input",render));importRatesBtn.addEventListener("click",()=>chooseImportFile(async file=>{
  try{
    await GPKImport.open("rates",file);
    gpkImportConfirmBtn.onclick=()=>{
      const result=GPKImport.confirm();
      rates=GPK.read(GPK.KEYS.rates,[])||[];
      render();
      toast(result.message);
    };
  }catch(err){toast("Import fehlgeschlagen: "+err.message);}
}));exportRatesBtn.addEventListener("click",async ()=>{
  try{
    await exportWorkbook("GP_Kollund_Tarife.xlsx",{
      "Tarife":rates.map(x=>({
        "Dienstleister":x.provider,"Land":x.country,"Zone":x.zone,"PLZ von":x.zipFrom,"PLZ bis":x.zipTo,
        "Transportart":x.transport,"Lademeter":x.ldm,"Basispreis EUR":x.base,"Floater %":x.floater,
        "Aktiv":x.status==="active"?"Ja":"Nein","Hinweise":x.notes||""
      }))
    });
    toast("Tarife exportiert.");
  }catch(err){toast("Export fehlgeschlagen: "+err.message);}
});initProviders();render();

// v4.5 – Diesel/Floater-Zeiträume
const defaultFloaterPeriods = [
  {id:101,provider:"LIT",type:"month",from:"2026-09-01",to:"2026-09-30",value:8.5,notes:"September 2026"},
  {id:102,provider:"LIT",type:"month",from:"2026-08-01",to:"2026-08-31",value:8.1,notes:"August 2026"},
  {id:103,provider:"Transimeksa",type:"2weeks",from:"2026-09-01",to:"2026-09-14",value:7.0,notes:"KW 36–37"},
  {id:104,provider:"Transimeksa",type:"2weeks",from:"2026-09-15",to:"2026-09-30",value:7.3,notes:"2. Septemberhälfte"},
  {id:105,provider:"Bertschi",type:"week",from:"2026-09-01",to:"2026-09-07",value:6.5,notes:"Wochenfloater"},
  {id:106,provider:"Duvenbeck",type:"halfmonth",from:"2026-09-01",to:"2026-09-15",value:9.0,notes:"1. Monatshälfte"},
  {id:107,provider:"Duvenbeck",type:"halfmonth",from:"2026-09-16",to:"2026-09-30",value:9.2,notes:"2. Monatshälfte"},
  {id:108,provider:"Dachser",type:"custom",from:"2026-08-20",to:"2026-09-12",value:8.0,notes:"Individueller Gültigkeitszeitraum"}
];
let floaterPeriods = GPK.read(GPK.KEYS.floaters, null) || defaultFloaterPeriods;

let editingFloaterId = null;
const tariffSubtabs = [...document.querySelectorAll(".tariff-subtab")];
const tariffRatesPanel = document.getElementById("tariffRatesPanel");
const tariffFloaterPanel = document.getElementById("tariffFloaterPanel");
const floaterRows = document.getElementById("floaterRows");

function isoToDE(v){
  if(!v) return "—";
  const [y,m,d]=v.split("-");
  return `${d}.${m}.${y}`;
}
function periodTypeLabel(v){
  return ({week:"Woche","2weeks":"2 Wochen",month:"Monat",halfmonth:"Halbmonat",custom:"Individuell"})[v] || v;
}
function floaterState(p){
  const today = new Date("2026-09-06T12:00:00");
  const from = new Date(p.from+"T00:00:00"), to = new Date(p.to+"T23:59:59");
  if(today < from) return "future";
  if(today > to) return "past";
  return "current";
}
function stateLabel(s){
  return ({current:"Aktuell",future:"Zukünftig",past:"Historisch"})[s];
}
function initFloaterProviders(){
  providerNames.forEach(p=>{
    const a=document.createElement("option");a.value=p;a.textContent=p;floaterProviderFilter.appendChild(a);
    const b=document.createElement("option");b.value=p;b.textContent=p;floaterProvider.appendChild(b);
  });
}
function renderFloaters(){
  const q=floaterSearch.value.trim().toLowerCase();
  const pf=floaterProviderFilter.value, tf=floaterTypeFilter.value, sf=floaterStatusFilter.value;
  const filtered=floaterPeriods.filter(p=>{
    const s=floaterState(p);
    const hay=`${p.provider} ${p.from} ${p.to} ${p.notes}`.toLowerCase();
    return (!q||hay.includes(q))&&(!pf||p.provider===pf)&&(!tf||p.type===tf)&&(!sf||s===sf);
  });

  currentFloaterCount.textContent=floaterPeriods.filter(p=>floaterState(p)==="current").length;
  floaterPeriodCount.textContent=floaterPeriods.length;
  floaterProviderCount.textContent=new Set(floaterPeriods.map(p=>p.provider)).size;
  const future=floaterPeriods.filter(p=>floaterState(p)==="future").sort((a,b)=>a.from.localeCompare(b.from));
  nextFloaterChange.textContent=future.length?isoToDE(future[0].from):"—";
  visibleFloaterCount.textContent=filtered.length;

  floaterRows.innerHTML=filtered.map(p=>{
    const s=floaterState(p);
    return `<tr>
      <td><div class="provider-name-cell"><div class="provider-avatar">${esc(p.provider.slice(0,2).toUpperCase())}</div><div><strong>${esc(p.provider)}</strong><small>Floater-ID ${p.id}</small></div></div></td>
      <td><strong class="table-main">${isoToDE(p.from)} – ${isoToDE(p.to)}</strong><small>${Math.round((new Date(p.to)-new Date(p.from))/86400000)+1} Tage</small></td>
      <td><span class="transport-pill">${periodTypeLabel(p.type)}</span></td>
      <td><strong class="floater-value">${Number(p.value).toLocaleString("de-DE")} %</strong></td>
      <td><span class="status-pill ${s==="current"?"active":s==="past"?"inactive":"future"}">${stateLabel(s)}</span></td>
      <td><span class="floater-note">${esc(p.notes||"—")}</span></td>
      <td class="row-actions"><button class="icon-button" data-edit-floater="${p.id}" title="Bearbeiten">✎</button><button class="icon-button more-button">•••</button></td>
    </tr>`;
  }).join("") || `<tr><td colspan="7" class="empty-state">Keine Floater-Zeiträume für diesen Filter gefunden.</td></tr>`;
}

tariffSubtabs.forEach(btn=>btn.addEventListener("click",()=>{
  tariffSubtabs.forEach(x=>x.classList.toggle("active",x===btn));
  const showRates=btn.dataset.tariffTab==="rates";
  tariffRatesPanel.hidden=!showRates;
  tariffFloaterPanel.hidden=showRates;
  if(!showRates) renderFloaters();
}));

function openFloaterModal(p=null){
  editingFloaterId=p?.id??null;
  floaterModalTitle.textContent=p?"Zeitraum bearbeiten":"Neuer Zeitraum";
  floaterProvider.value=p?.provider??providerNames[0];
  floaterPeriodType.value=p?.type??"month";
  floaterValue.value=p?.value??"";
  floaterFrom.value=p?.from??"";
  floaterTo.value=p?.to??"";
  floaterNotes.value=p?.notes??"";
  floaterModal.hidden=false;
  document.body.classList.add("modal-open");
}
function closeFloaterModal(){
  floaterModal.hidden=true;
  document.body.classList.remove("modal-open");
}
newFloaterBtn.addEventListener("click",()=>openFloaterModal());
closeFloaterModalBtn.addEventListener("click",closeFloaterModal);
cancelFloaterModalBtn.addEventListener("click",closeFloaterModal);
floaterModal.addEventListener("click",e=>{if(e.target===floaterModal)closeFloaterModal();});
floaterRows.addEventListener("click",e=>{
  const btn=e.target.closest("[data-edit-floater]"); if(!btn)return;
  const p=floaterPeriods.find(x=>x.id===Number(btn.dataset.editFloater)); if(p)openFloaterModal(p);
});
floaterForm.addEventListener("submit",e=>{
  e.preventDefault();
  const data={provider:floaterProvider.value,type:floaterPeriodType.value,from:floaterFrom.value,to:floaterTo.value,
    value:Number(floaterValue.value||0),notes:floaterNotes.value.trim()};
  if(data.to < data.from){ toast("Das Bis-Datum muss nach dem Ab-Datum liegen."); return; }
  if(editingFloaterId){
    Object.assign(floaterPeriods.find(x=>x.id===editingFloaterId),data);
    toast("Floater-Zeitraum wurde in der Layout-Demo aktualisiert.");
  }else{
    floaterPeriods.unshift({id:Date.now(),...data});
    toast("Floater-Zeitraum wurde in der Layout-Demo angelegt.");
  }
  GPK.write(GPK.KEYS.floaters,floaterPeriods);
  closeFloaterModal(); renderFloaters();
});
[floaterSearch,floaterProviderFilter,floaterTypeFilter,floaterStatusFilter].forEach(x=>x.addEventListener("input",renderFloaters));
importFloaterBtn.addEventListener("click",()=>chooseImportFile(async file=>{
  try{
    await GPKImport.open("floaters",file);
    gpkImportConfirmBtn.onclick=()=>{
      const result=GPKImport.confirm();
      floaterPeriods=GPK.read(GPK.KEYS.floaters,[])||[];
      renderFloaters();
      toast(result.message);
    };
  }catch(err){toast("Import fehlgeschlagen: "+err.message);}
}));
exportFloaterBtn.addEventListener("click",async ()=>{
  try{
    await exportWorkbook("GP_Kollund_Diesel_Floater.xlsx",{
      "Diesel_Floater":floaterPeriods.map(x=>({
        "Dienstleister":x.provider,"Periodentyp":periodTypeLabel(x.type),"Gültig ab":x.from,
        "Gültig bis":x.to,"Floater %":x.value,"Notiz":x.notes||""
      }))
    });
    toast("Floater-Historie exportiert.");
  }catch(err){toast("Export fehlgeschlagen: "+err.message);}
});
initFloaterProviders();
renderFloaters();
