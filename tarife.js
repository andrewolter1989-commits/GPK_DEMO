const providerNames=[...new Set(["LIT","Transimeksa","Bertschi","Duvenbeck","Dachser","Raben","DSV",...(GPK.read(GPK.KEYS.providers,[])||[]).map(p=>p.name).filter(Boolean)])];const defaultRates=[{id:1,provider:"LIT",country:"DE",zone:"24",zipFrom:"24000",zipTo:"24999",transport:"FTL",ldm:"",base:920,floater:8.5,status:"active"},{id:2,provider:"LIT",country:"DE",zone:"22",zipFrom:"22000",zipTo:"22999",transport:"Mega",ldm:"",base:995,floater:8.5,status:"active"},{id:3,provider:"Transimeksa",country:"BE",zone:"24",zipFrom:"2400",zipTo:"2499",transport:"FTL",ldm:"",base:1180,floater:7,status:"active"},{id:4,provider:"Bertschi",country:"DE",zone:"48",zipFrom:"48000",zipTo:"48999",transport:"Teilladung",ldm:"5,0",base:680,floater:6.5,status:"active"},{id:5,provider:"Duvenbeck",country:"NL",zone:"50",zipFrom:"5000",zipTo:"5099",transport:"FTL",ldm:"",base:1240,floater:9,status:"active"},{id:6,provider:"Dachser",country:"FR",zone:"67",zipFrom:"67000",zipTo:"67999",transport:"Jumbo",ldm:"",base:1490,floater:8,status:"active"},{id:7,provider:"Raben",country:"DE",zone:"47",zipFrom:"47000",zipTo:"47999",transport:"Teilladung",ldm:"7,5",base:755,floater:7.5,status:"active"},{id:8,provider:"DSV",country:"DE",zone:"22",zipFrom:"22000",zipTo:"22999",transport:"FTL",ldm:"",base:1015,floater:8.2,status:"inactive"},{id:9,provider:"LIT",country:"DE",zone:"24",zipFrom:"24000",zipTo:"24999",transport:"Teilladung",ldm:"3,0",base:545,floater:8.5,status:"active"},{id:10,provider:"Transimeksa",country:"DE",zone:"24",zipFrom:"24000",zipTo:"24999",transport:"Mega",ldm:"",base:980,floater:7,status:"active"}];let rates=GPK.read(GPK.KEYS.rates,null)||defaultRates;let editingId=null;const rows=document.getElementById("rateRows"),search=document.getElementById("rateSearch"),providerFilter=document.getElementById("rateProviderFilter"),transportFilter=document.getElementById("rateTransportFilter"),statusFilter=document.getElementById("rateStatusFilter"),modal=document.getElementById("rateModal");function esc(v=""){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}function euro(n){return new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(n)}function total(r){return r.base*(1+(Number(r.floater)||0)/100)}function initProviders(){providerNames.forEach(p=>{let a=document.createElement("option");a.value=p;a.textContent=p;providerFilter.appendChild(a);let b=document.createElement("option");b.value=p;b.textContent=p;rateProvider.appendChild(b)})}function render(){let q=search.value.trim().toLowerCase(),pf=providerFilter.value,tf=transportFilter.value,sf=statusFilter.value;let filtered=rates.filter(r=>{let hay=`${r.provider} ${r.country} ${r.zone} ${r.zipFrom} ${r.zipTo} ${r.transport}`.toLowerCase();return(!q||hay.includes(q))&&(!pf||r.provider===pf)&&(!tf||r.transport===tf)&&(!sf||r.status===sf)});activeRateCount.textContent=rates.filter(r=>r.status==="active").length;rateProviderCount.textContent=new Set(rates.map(r=>r.provider)).size;rateCountryCount.textContent=new Set(rates.map(r=>r.country)).size;avgRatePrice.textContent=euro(rates.reduce((s,r)=>s+r.base,0)/rates.length);visibleRateCount.textContent=filtered.length;rows.innerHTML=filtered.map(r=>`<tr><td><div class="provider-name-cell"><div class="provider-avatar">${esc(r.provider.slice(0,2).toUpperCase())}</div><div><strong>${esc(r.provider)}</strong><small>Tarif-ID ${r.id}</small></div></div></td><td><strong class="table-main">${esc(r.country)}</strong><small>${esc(r.zipFrom)}–${esc(r.zipTo)}</small></td><td><strong class="table-main">Zone ${esc(r.zone)}</strong><small>${esc(r.zipFrom)}–${esc(r.zipTo)}</small></td><td><span class="transport-pill">${esc(r.transport)}</span>${r.ldm?`<small>${esc(r.ldm)} Ldm</small>`:""}</td><td><strong class="price-cell">${euro(r.base)}</strong></td><td><span class="floater-pill">${Number(r.floater).toLocaleString("de-DE")} %</span></td><td><strong class="price-cell total-price">${euro(total(r))}</strong></td><td><span class="status-pill ${r.status}">${r.status==="active"?"Aktiv":"Inaktiv"}</span></td><td class="row-actions"><button class="icon-button" data-edit="${r.id}">✎</button><button class="icon-button more-button" data-rate-menu="${r.id}" title="Weitere Aktionen">•••</button></td></tr>`).join("")||`<tr><td colspan="9" class="empty-state">Keine Tarife für diesen Filter gefunden.</td></tr>`}function toast(text){rateToast.textContent=text;rateToast.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>rateToast.hidden=true,2400)}function openModal(r=null){editingId=r?.id??null;rateModalTitle.textContent=r?"Tarif bearbeiten":"Neuer Tarif";rateProvider.value=r?.provider??providerNames[0];rateStatus.value=r?.status??"active";rateCountry.value=r?.country??"DE";rateZone.value=r?.zone??"";rateZipFrom.value=r?.zipFrom??"";rateZipTo.value=r?.zipTo??"";rateTransport.value=r?.transport??"FTL";rateLdm.value=r?.ldm??"";rateBase.value=r?.base??"";rateFloater.value=r?.floater??"";rateNotes.value=r?.notes??"";modal.hidden=false;document.body.classList.add("modal-open")}function closeModal(){modal.hidden=true;document.body.classList.remove("modal-open")}newRateBtn.addEventListener("click",()=>openModal());closeRateModalBtn.addEventListener("click",closeModal);cancelRateModalBtn.addEventListener("click",closeModal);rows.addEventListener("click",e=>{
  const edit=e.target.closest("[data-edit]");
  if(edit){const r=rates.find(x=>x.id===Number(edit.dataset.edit));if(r)openModal(r);return;}
  const more=e.target.closest("[data-rate-menu]");
  if(more)openRateMenu(more,Number(more.dataset.rateMenu));
});rateForm.addEventListener("submit",e=>{e.preventDefault();let data={provider:rateProvider.value,status:rateStatus.value,country:rateCountry.value,zone:rateZone.value.trim(),zipFrom:rateZipFrom.value.trim(),zipTo:rateZipTo.value.trim(),transport:rateTransport.value,ldm:rateLdm.value.trim(),base:Number(rateBase.value||0),floater:Number(rateFloater.value||0),notes:rateNotes.value.trim()};if(editingId){Object.assign(rates.find(x=>x.id===editingId),data);toast("Tarif wurde in der Layout-Demo aktualisiert.")}else{rates.unshift({id:Date.now(),...data});toast("Tarif wurde in der Layout-Demo angelegt.")}GPK.write(GPK.KEYS.rates,rates);closeModal();render()});[search,providerFilter,transportFilter,statusFilter].forEach(x=>x.addEventListener("input",render));importRatesBtn.addEventListener("click",()=>GPKTariffImport.chooseAndOpen());exportRatesBtn.addEventListener("click",async ()=>{
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
      <td class="row-actions"><button class="icon-button" data-edit-floater="${p.id}" title="Bearbeiten">✎</button></td>
    </tr>`;
  }).join("") || `<tr><td colspan="7" class="empty-state">Keine Floater-Zeiträume für diesen Filter gefunden.</td></tr>`;
}

tariffSubtabs.forEach(btn=>btn.addEventListener("click",()=>{
  tariffSubtabs.forEach(x=>x.classList.toggle("active",x===btn));
  const tab=btn.dataset.tariffTab;
  tariffRatesPanel.hidden=tab!=="rates";
  tariffFloaterPanel.hidden=tab!=="floater";
  tariffSurchargePanel.hidden=tab!=="surcharges";
  if(tab==="floater") renderFloaters();
  if(tab==="surcharges") renderSurcharges();
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


// v6.4 – Tarif Kontextmenü
function openRateMenu(anchor,id){
  const r=rates.find(x=>x.id===id); if(!r)return;
  tariffContextMenu.innerHTML=`<button data-menu-action="duplicate">Tarif duplizieren</button><button data-menu-action="toggle">${r.status==="active"?"Tarif deaktivieren":"Tarif aktivieren"}</button>`;
  tariffContextMenu.dataset.rateId=id;
  const rect=anchor.getBoundingClientRect();
  tariffContextMenu.style.left=Math.max(10,rect.right-190)+"px";
  tariffContextMenu.style.top=(rect.bottom+5)+"px";
  tariffContextMenu.hidden=false;
}
document.addEventListener("click",e=>{if(!e.target.closest("#tariffContextMenu")&&!e.target.closest("[data-rate-menu]"))tariffContextMenu.hidden=true;});
tariffContextMenu.addEventListener("click",e=>{const action=e.target.dataset.menuAction;if(!action)return;const id=Number(tariffContextMenu.dataset.rateId),r=rates.find(x=>x.id===id);if(!r)return;if(action==="duplicate"){rates.unshift({...r,id:Date.now(),notes:(r.notes||"")+" · Duplikat"});toast("Tarif wurde dupliziert.");}if(action==="toggle"){r.status=r.status==="active"?"inactive":"active";toast(r.status==="active"?"Tarif aktiviert.":"Tarif deaktiviert.");}GPK.write(GPK.KEYS.rates,rates);tariffContextMenu.hidden=true;render();});

// v6.9 – Nebenkosten mit flexibler Berechnungsbasis
const SURCHARGE_KEY=GPK.KEYS.surcharges||"gpk_demo_surcharges_v1";
const defaultSurcharges=[
 {id:201,provider:"LIT",type:"Maut",value:0.19,calcMode:"per_km",trigger:"automatic",country:"DE",zone:"*",transport:"FTL",from:"2026-01-01",to:"2026-12-31",status:"active",notes:"je mautpflichtigem Kilometer"},
 {id:202,provider:"LIT",type:"Wartezeit",value:65,calcMode:"per_hour",trigger:"optional",country:"*",zone:"*",transport:"*",from:"2026-01-01",to:"2026-12-31",status:"active",notes:"je angefangene Stunde"},
 {id:203,provider:"Transimeksa",type:"ADR",value:7.5,calcMode:"percent_freight",trigger:"optional",country:"BE",zone:"*",transport:"*",from:"2026-01-01",to:"2026-12-31",status:"active",notes:"Gefahrgut"},
 {id:204,provider:"Dachser",type:"Avis",value:25,calcMode:"fixed",trigger:"optional",country:"FR",zone:"*",transport:"*",from:"2026-01-01",to:"2026-12-31",status:"active",notes:"einmalig pro Sendung"}
];
let surcharges=GPK.read(SURCHARGE_KEY,null)||defaultSurcharges,editingSurchargeId=null;
surcharges=surcharges.map(x=>({...x,calcMode:x.calcMode||(x.unit==="percent"?"percent_base":"fixed"),trigger:x.trigger||"automatic"}));
function initSurchargeProviders(){providerNames.forEach(p=>{for(const sel of [surchargeProviderFilter,surchargeProvider]){const o=document.createElement("option");o.value=p;o.textContent=p;sel.appendChild(o);}})}
function surchargeCalcLabel(x){const v=Number(x.value||0).toLocaleString("de-DE");return ({fixed:`${v} € / Sendung`,percent_base:`${v} % von Basisfracht`,percent_freight:`${v} % von Fracht + Floater`,per_km:`${v} € / km`,per_ldm:`${v} € / Lademeter`,per_hour:`${v} € / Stunde`,per_stop:`${v} € / zusätzliche Entladestelle`,per_pallet:`${v} € / Palette`})[x.calcMode]||`${v} €`;}
function surchargeTriggerLabel(x){return x.trigger==="optional"?"bei Bedarf":"automatisch";}
function updateSurchargeCalcUi(){const m=surchargeCalcMode.value;const meta={fixed:["Betrag €","Einmaliger Betrag pro Sendung."],percent_base:["Prozent %","Prozent nur auf die Basisfracht."],percent_freight:["Prozent %","Prozent auf Basisfracht plus Diesel/Floater."],per_km:["Betrag €/km","Wird mit den relevanten Kilometern multipliziert."],per_ldm:["Betrag €/Lademeter","Wird mit den Lademetern multipliziert."],per_hour:["Betrag €/Stunde","Wird mit der erfassten Zeit multipliziert."],per_stop:["Betrag €/Stopp","Je zusätzlicher Entladestelle."],per_pallet:["Betrag €/Palette","Wird mit der Palettenanzahl multipliziert."]}[m]||["Wert",""];surchargeValueLabel.textContent=meta[0];surchargeCalcHint.textContent=meta[1];}
function renderSurcharges(){const q=surchargeSearch.value.trim().toLowerCase(),pf=surchargeProviderFilter.value,sf=surchargeStatusFilter.value;const f=surcharges.filter(x=>{const h=`${x.provider} ${x.type} ${x.country} ${x.zone} ${x.transport} ${x.notes} ${x.calcMode}`.toLowerCase();return(!q||h.includes(q))&&(!pf||x.provider===pf)&&(!sf||x.status===sf)});activeSurchargeCount.textContent=f.filter(x=>x.status==="active").length;surchargeProviderCount.textContent=new Set(f.map(x=>x.provider)).size;surchargeTypeCount.textContent=new Set(f.map(x=>x.type)).size;surchargeHistoryCount.textContent=f.length;visibleSurchargeCount.textContent=f.length;surchargeRows.innerHTML=f.map(x=>`<tr><td><strong class="table-main">${esc(x.provider)}</strong></td><td><strong class="table-main">${esc(x.type)}</strong><small>${esc(x.notes||"—")}</small></td><td><strong>${esc(x.country||"*")}</strong><small>${esc(x.zone||"*")} · ${esc(x.transport||"*")}</small></td><td><strong class="price-cell">${esc(surchargeCalcLabel(x))}</strong><small>${esc(surchargeTriggerLabel(x))}</small></td><td><strong class="table-main">${isoToDE(x.from)} – ${isoToDE(x.to)}</strong></td><td><span class="status-pill ${x.status}">${x.status==="active"?"Aktiv":"Inaktiv"}</span></td><td class="row-actions"><button class="icon-button" data-edit-surcharge="${x.id}">✎</button></td></tr>`).join("")||`<tr><td colspan="7" class="empty-state">Keine Nebenkosten für diesen Filter gefunden.</td></tr>`;}
function openSurchargeModal(x=null){editingSurchargeId=x?.id??null;surchargeModalTitle.textContent=x?"Nebenkosten bearbeiten":"Neue Nebenkosten";surchargeProvider.value=x?.provider??providerNames[0];surchargeType.value=x?.type??"Maut";surchargeCalcMode.value=x?.calcMode??"fixed";surchargeValue.value=x?.value??"";surchargeTrigger.value=x?.trigger??"automatic";surchargeCountry.value=x?.country??"*";surchargeZone.value=x?.zone??"*";surchargeTransport.value=x?.transport??"*";surchargeFrom.value=x?.from??"";surchargeTo.value=x?.to??"";surchargeStatus.value=x?.status??"active";surchargeNotes.value=x?.notes??"";updateSurchargeCalcUi();surchargeModal.hidden=false;document.body.classList.add("modal-open");}
function closeSurcharge(){surchargeModal.hidden=true;document.body.classList.remove("modal-open")}
newSurchargeBtn.addEventListener("click",()=>openSurchargeModal());closeSurchargeModalBtn.addEventListener("click",closeSurcharge);cancelSurchargeModalBtn.addEventListener("click",closeSurcharge);surchargeRows.addEventListener("click",e=>{const b=e.target.closest("[data-edit-surcharge]");if(!b)return;const x=surcharges.find(v=>v.id===Number(b.dataset.editSurcharge));if(x)openSurchargeModal(x)});
surchargeForm.addEventListener("submit",e=>{e.preventDefault();const data={provider:surchargeProvider.value,type:surchargeType.value,value:Number(surchargeValue.value||0),calcMode:surchargeCalcMode.value,trigger:surchargeTrigger.value,country:surchargeCountry.value.trim()||"*",zone:surchargeZone.value.trim()||"*",transport:surchargeTransport.value,from:surchargeFrom.value,to:surchargeTo.value,status:surchargeStatus.value,notes:surchargeNotes.value.trim()};if(data.to&&data.from&&data.to<data.from){toast("Das Bis-Datum muss nach dem Ab-Datum liegen.");return;}if(editingSurchargeId)Object.assign(surcharges.find(x=>x.id===editingSurchargeId),data);else surcharges.unshift({id:Date.now(),...data});GPK.write(SURCHARGE_KEY,surcharges);closeSurcharge();renderSurcharges();toast("Nebenkosten gespeichert.");});
surchargeCalcMode.addEventListener("change",updateSurchargeCalcUi);[surchargeSearch,surchargeProviderFilter,surchargeStatusFilter].forEach(x=>x.addEventListener("input",renderSurcharges));initSurchargeProviders();renderSurcharges();

/* v6.8 – Sprung vom Dienstleister direkt zu neuem Tarif */
(function handleProviderTariffShortcut(){
  const params=new URLSearchParams(location.search);
  const provider=params.get("provider");
  const create=params.get("new")==="1";
  if(!provider)return;
  if(!providerNames.includes(provider)){
    providerNames.push(provider);
    const a=document.createElement("option");a.value=provider;a.textContent=provider;providerFilter.appendChild(a);
    const b=document.createElement("option");b.value=provider;b.textContent=provider;rateProvider.appendChild(b);
  }
  providerFilter.value=provider;
  render();
  if(create){
    openModal();
    rateProvider.value=provider;
  }
})();
