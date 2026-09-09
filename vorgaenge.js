const defaultOperations = [
  {id:"GPK-260906-014",type:"booking",relation:"DE 24939 → BE 2450",provider:"LIT",price:1239,status:"booked",date:"08.09.2026",user:"Disposition",transport:"FTL",customer:"Demo Logistics NV",created:"06.09.2026 · 12:08",note:"Buchung bestätigt. Referenz folgt."},
  {id:"GPK-260906-013",type:"availability",relation:"DE 24941 → NL 5048",provider:"Transimeksa",price:1186,status:"waiting",date:"09.09.2026",user:"Andre Wolter",transport:"Mega",customer:"Benelux Foam BV",created:"06.09.2026 · 11:42",note:"Verfügbarkeit beim Dienstleister angefragt."},
  {id:"GPK-260906-012",type:"price",relation:"DE 22113 → DE 48155",provider:"Bertschi",price:742,status:"open",date:"10.09.2026",user:"Vertrieb",transport:"Teilladung · 5,0 Ldm",customer:"Westfalen Components",created:"06.09.2026 · 10:25",note:"Preisauskunft erstellt, noch keine Folgeaktion."},
  {id:"GPK-260905-011",type:"booking",relation:"DE 24939 → FR 67000",provider:"Dachser",price:1609,status:"confirmed",date:"07.09.2026",user:"Disposition",transport:"Jumbo",customer:"Alsace Industrie SAS",created:"05.09.2026 · 16:50",note:"Dienstleister hat Termin bestätigt."},
  {id:"GPK-260905-010",type:"availability",relation:"DE 24939 → DE 47059",provider:"Raben",price:812,status:"waiting",date:"08.09.2026",user:"Disposition",transport:"Teilladung · 7,5 Ldm",customer:"Rhein Technik GmbH",created:"05.09.2026 · 15:18",note:"Rückmeldung ausstehend."},
  {id:"GPK-260904-009",type:"booking",relation:"DE 24941 → DE 22113",provider:"DSV",price:1098,status:"closed",date:"05.09.2026",user:"Disposition",transport:"FTL",customer:"Hanse Werkstoffe",created:"04.09.2026 · 13:33",note:"Transport abgeschlossen."},
  {id:"GPK-260904-008",type:"price",relation:"DE 24939 → BE 2450",provider:"LIT",price:1218,status:"open",date:"11.09.2026",user:"Vertrieb",transport:"FTL",customer:"Demo Logistics NV",created:"04.09.2026 · 09:20",note:"Preisauskunft gespeichert."},
  {id:"GPK-260903-007",type:"booking",relation:"DE 24939 → NL 5048",provider:"Duvenbeck",price:1352,status:"booked",date:"06.09.2026",user:"Andre Wolter",transport:"FTL",customer:"Benelux Foam BV",created:"03.09.2026 · 14:07",note:"Buchung versendet."}
];
function readStoredOperations(){
  try{
    const data=JSON.parse(localStorage.getItem(GPK.KEYS.operations)||"[]");
    return Array.isArray(data)?data:[];
  }catch(_){return [];}
}
const storedOperations=readStoredOperations();
const knownIds=new Set(storedOperations.map(o=>o.id));
const operations=[...storedOperations,...defaultOperations.filter(o=>!knownIds.has(o.id))];
let activeType="";
const rows=document.getElementById("operationRows");
const search=document.getElementById("operationSearch");
const statusFilter=document.getElementById("operationStatusFilter");
const userFilter=document.getElementById("operationUserFilter");
const periodFilter=document.getElementById("operationPeriodFilter");
const dateFrom=document.getElementById("operationDateFrom");
const dateTo=document.getElementById("operationDateTo");
const periodKpiLabel=document.getElementById("periodKpiLabel");
const applyOperationDates=document.getElementById("applyOperationDates");
const customPeriod=document.getElementById("operationCustomPeriod");
const modal=document.getElementById("operationModal");
const detail=document.getElementById("operationDetail");

const labels={price:"Preisanfrage",availability:"Verfügbarkeit",booking:"Buchung"};
const statuses={open:"Offen",waiting:"Warten auf Antwort",confirmed:"Bestätigt",booked:"Gebucht",closed:"Abgeschlossen"};
let currentOperationId=null;
function providerAvatarHtml(name){
  const p=GPK.providerRecord?.(name),src=GPK.providerLogoSrc?.(p)||"",ini=GPK.providerInitials?.(name,p?.alias)||String(name||"?").slice(0,2).toUpperCase();
  return src?`<div class="provider-avatar provider-avatar-logo"><img src="${esc(src)}" alt="${esc(name)} Logo" onerror="this.parentElement.classList.remove('provider-avatar-logo');this.remove();this.parentElement.textContent='${esc(ini)}'"></div>`:`<div class="provider-avatar">${esc(ini)}</div>`;
}
function invoiceChecks(){return GPK.read(GPK.KEYS.invoiceChecks,[])||[]}
function invoiceForOperation(id){return invoiceChecks().filter(c=>String(c.operation||"")===String(id||"")).sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0))[0]||null}
function invoiceStatusHtml(o){
  const c=invoiceForOperation(o.id);
  if(!c)return `<button type="button" class="invoice-operation-status pending invoice-status-action" data-invoice-operation="${esc(o.id)}">Nicht geprüft</button>`;
  if(c.status==="ok")return `<button type="button" class="invoice-operation-status ok invoice-status-action" data-invoice-operation="${esc(o.id)}">OK · ${esc(c.invoice||"Rechnung")}</button>`;
  if(c.status==="diff")return `<button type="button" class="invoice-operation-status diff invoice-status-action" data-invoice-operation="${esc(o.id)}">Abweichung · ${esc(c.invoice||"")}</button>`;
  return `<button type="button" class="invoice-operation-status unmatched invoice-status-action" data-invoice-operation="${esc(o.id)}">Nicht zugeordnet</button>`;
}
function saveOperations(){GPK.write(GPK.KEYS.operations,operations)}

function currentUserName(o){
  return String(window.GPK_CURRENT_USER?.name||o?.user||"Lokale Demo");
}
function isoNow(){return new Date().toISOString()}
function displayDateTime(iso){
  const d=new Date(iso||"");if(isNaN(d))return String(iso||"—");
  return d.toLocaleDateString("de-DE")+" · "+d.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"});
}
function addHistory(o,entry){
  o.history=Array.isArray(o.history)?o.history:[];
  o.history.push({at:isoNow(),user:currentUserName(o),...entry});
}
function operationPriceParts(o){
  const base=Number(o.basePrice);
  const floaterPct=Number(o.floaterPercent)||0;
  const floaterAmt=Number.isFinite(Number(o.floaterAmount))?Number(o.floaterAmount):(Number.isFinite(base)?base*floaterPct/100:0);
  const ancillary=Number(o.ancillaryAmount||o.surchargeAmount||0)||0;
  const calculated=(Number.isFinite(base)?base:Number(o.price)||0)+floaterAmt+ancillary;
  const total=Number(o.price)||0;
  const manualDelta=Number(o.manualPriceDelta);
  return {
    base:Number.isFinite(base)?base:Math.max(0,total-floaterAmt-ancillary),
    floaterPct,floaterAmt,ancillary,total,
    manualDelta:Number.isFinite(manualDelta)?manualDelta:Math.round((total-calculated)*100)/100
  };
}
function timelineTone(event){
  if(event.type==="price")return "price";
  if(event.type==="invoice-ok")return "success";
  if(event.type==="invoice-diff")return "danger";
  if(event.type==="status"&&["booked","confirmed","closed"].includes(event.to))return "success";
  return "info";
}
function timelineHtml(o){
  const items=[{
    at:o.createdAt||o.created,
    user:o.user||"System",
    text:o.note||"Vorgang erstellt.",
    type:"created"
  },...(Array.isArray(o.history)?o.history:[])];
  return items.map((ev,i)=>{
    const tone=timelineTone(ev);
    const user=ev.user?`<small>${esc(ev.user)}</small>`:"";
    return `<div class="timeline-item ${tone} ${i===items.length-1?"active":""}"><span></span><div><strong>${esc(displayDateTime(ev.at))}</strong>${user}<p>${esc(ev.text||"")}</p></div></div>`;
  }).join("");
}


function esc(v=""){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
function euro(n){return new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(n)}
function operationDate(o){
  if(o.createdAt){ const d=new Date(o.createdAt); if(!isNaN(d)) return d; }
  const raw=String(o.created||"").match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if(raw) return new Date(Number(raw[3]),Number(raw[2])-1,Number(raw[1]));
  return null;
}
function periodMatches(o){
  const d=operationDate(o); if(!periodFilter?.value || !d) return !periodFilter?.value || !!d;
  const now=new Date(); now.setHours(23,59,59,999);
  const startDay=x=>new Date(x.getFullYear(),x.getMonth(),x.getDate());
  const value=periodFilter.value;
  if(value==="today") return startDay(d).getTime()===startDay(now).getTime();
  if(value==="week"){ const n=startDay(now); const day=(n.getDay()+6)%7; const from=new Date(n); from.setDate(n.getDate()-day); return d>=from && d<=now; }
  if(value==="month") return d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth();
  if(value==="30days"){ const from=new Date(now); from.setDate(from.getDate()-29); from.setHours(0,0,0,0); return d>=from && d<=now; }
  if(value==="custom"){
    const from=dateFrom?.value ? new Date(dateFrom.value+"T00:00:00") : null;
    const to=dateTo?.value ? new Date(dateTo.value+"T23:59:59") : null;
    return (!from||d>=from)&&(!to||d<=to);
  }
  return true;
}
function render(){
  const q=search.value.trim().toLowerCase(), sf=statusFilter.value, uf=userFilter.value;
  const filtered=operations.filter(o=>{
    const hay=`${o.id} ${o.relation} ${o.provider} ${o.customer} ${o.user} ${o.transport}`.toLowerCase();
    return (!activeType||o.type===activeType)&&(!q||hay.includes(q))&&(!sf||o.status===sf)&&(!uf||o.user===uf)&&periodMatches(o);
  });
  openCount.textContent=filtered.filter(o=>o.status==="open").length;
  waitingCount.textContent=filtered.filter(o=>o.status==="waiting").length;
  bookedCount.textContent=filtered.filter(o=>o.status==="booked"||o.status==="confirmed").length;
  weekCount.textContent=filtered.length;
  if(periodKpiLabel){
    const labels={today:"Heute",week:"Diese Woche",month:"Dieser Monat","30days":"Letzte 30 Tage",custom:"Eigener Zeitraum"};
    periodKpiLabel.textContent=labels[periodFilter?.value]||"Gesamt";
  }
  visibleOperationCount.textContent=filtered.length;
  rows.innerHTML=filtered.map(o=>`<tr class="operation-row" data-id="${o.id}">
    <td><div class="operation-id"><strong>${esc(o.id)}</strong><span class="operation-type ${o.type}">${labels[o.type]}</span>${o.createdAt?'<span class="workflow-new">Neu</span>':''}</div><small>${esc(o.created)}</small></td>
    <td><strong class="table-main">${esc(o.relation)}</strong><small>${esc(o.transport)}</small></td>
    <td><div class="provider-name-cell">${providerAvatarHtml(o.provider)}<div><strong>${esc(o.provider)}</strong><small>${esc(o.customer)}</small></div></div></td>
    <td><strong class="price-cell total-price">${euro(o.price)}</strong></td>
    <td><span class="operation-status ${o.status}">${statuses[o.status]}</span></td>
    <td><strong class="table-main">${esc(o.date)}</strong><small>Liefertermin</small></td>
    <td><span class="user-chip">${esc(o.user)}</span></td>
    <td>${invoiceStatusHtml(o)}</td>
    <td class="row-actions"><button class="icon-button" data-open="${o.id}" title="Details">›</button></td>
  </tr>`).join("")||`<tr><td colspan="9" class="empty-state">Keine Vorgänge für diesen Filter gefunden.</td></tr>`;
}
function openOperation(o){
  currentOperationId=o.id;
  operationModalTitle.textContent=o.id;
  const inv=invoiceForOperation(o.id),parts=operationPriceParts(o);
  const ancillaryRow=parts.ancillary?`<div><span>Nebenkosten</span><strong>${euro(parts.ancillary)}</strong></div>`:"";
  const manualRow=Math.abs(parts.manualDelta)>.01?`<div class="price-part-adjustment"><span>Manuelle Korrektur</span><strong>${parts.manualDelta>0?"+":""}${euro(parts.manualDelta)}</strong></div>`:"";
  const invoiceBlock=inv?`
    <div class="operation-invoice-card ${inv.status}">
      <div><span>Rechnung</span><strong>${esc(inv.invoice||"—")}</strong></div>
      <div><span>Prüfstatus</span><strong>${inv.status==="ok"?"OK":inv.status==="diff"?"Abweichung":"Nicht zugeordnet"}</strong></div>
      <div><span>Soll</span><strong>${euro(inv.expected)}</strong></div>
      <div><span>Ist</span><strong>${inv.actual?euro(inv.actual):"—"}</strong></div>
      <div><span>Differenz</span><strong>${inv.diff?((inv.diff>0?"+":"")+euro(inv.diff)):"0 €"}</strong></div>
      <a class="secondary compact-button operations-link" href="rechnungspruefung.html?operation=${encodeURIComponent(o.id)}">Prüfung öffnen</a>
    </div>`:`
    <div class="operation-invoice-card pending">
      <div><span>Rechnung</span><strong>Noch nicht geprüft</strong></div>
      <a class="secondary compact-button operations-link" href="rechnungspruefung.html?operation=${encodeURIComponent(o.id)}">Rechnung prüfen</a>
    </div>`;
  detail.innerHTML=`
    <div class="operation-summary-grid">
      <div><span>Typ</span><strong>${labels[o.type]}</strong></div><div><span>Status</span><strong>${statuses[o.status]}</strong></div>
      <div><span>Relation</span><strong>${esc(o.relation)}</strong></div><div><span>Transport</span><strong>${esc(o.transport)}</strong></div>
      <div><span>Dienstleister</span><strong>${esc(o.provider)}</strong></div><div><span>Gesamtpreis</span><strong>${euro(o.price)}</strong></div>
      <div><span>Empfänger</span><strong>${esc(o.customer)}</strong></div><div><span>Liefertermin</span><strong>${esc(o.date)}</strong></div>
    </div>

    <div class="operation-price-section">
      <div class="operation-section-head"><div><h3>Preiszusammensetzung</h3><p>Tarifbasis und Zuschläge des gespeicherten Vorgangs.</p></div></div>
      <div class="operation-price-parts">
        <div><span>Basisfracht</span><strong>${euro(parts.base)}</strong></div>
        <div><span>Diesel / Floater</span><strong>${euro(parts.floaterAmt)}</strong><small>${parts.floaterPct.toLocaleString("de-DE")} %</small></div>
        ${ancillaryRow}
        ${manualRow}
        <div class="price-part-total"><span>Gesamt</span><strong>${euro(parts.total)}</strong></div>
      </div>
      <div class="operation-manual-price">
        <label for="operationEditPrice">Gesamtpreis manuell bearbeiten</label>
        <div class="operation-price-edit-row"><div class="input-suffix"><input id="operationEditPrice" type="number" min="0" step="0.01" value="${Number(o.price)||0}"><span>€</span></div><small>Änderungen werden mit Datum und Benutzer im Verlauf protokolliert.</small></div>
      </div>
    </div>

    <div class="operation-edit-grid">
      <div class="field"><label for="operationEditType">Vorgangsart</label><select id="operationEditType"><option value="price" ${o.type==="price"?"selected":""}>Preisanfrage</option><option value="availability" ${o.type==="availability"?"selected":""}>Verfügbarkeit angefragt</option><option value="booking" ${o.type==="booking"?"selected":""}>Buchung</option></select></div>
      <div class="field"><label for="operationEditStatus">Status</label><select id="operationEditStatus"><option value="open" ${o.status==="open"?"selected":""}>Offen</option><option value="waiting" ${o.status==="waiting"?"selected":""}>Warten auf Antwort</option><option value="confirmed" ${o.status==="confirmed"?"selected":""}>Bestätigt</option><option value="booked" ${o.status==="booked"?"selected":""}>Gebucht</option><option value="closed" ${o.status==="closed"?"selected":""}>Abgeschlossen</option></select></div>
    </div>
    <div class="operation-invoice-section" id="operationInvoiceSection"><h3>Rechnungsprüfung</h3>${invoiceBlock}</div>
    <div class="operation-timeline">
      <h3>Verlauf</h3>
      ${timelineHtml(o)}
      <div class="timeline-item next"><span></span><div><strong>Nächster Schritt</strong><p>${o.status==="waiting"?"Antwort des Dienstleisters erfassen.":o.status==="open"?"Verfügbarkeit anfragen oder Buchung starten.":"Status und Referenzen weiterführen."}</p></div></div>
    </div>`;
  modal.hidden=false;document.body.classList.add("modal-open");
}
function closeModal(){modal.hidden=true;document.body.classList.remove("modal-open")}
document.querySelectorAll(".operations-tab").forEach(btn=>btn.addEventListener("click",()=>{
  document.querySelectorAll(".operations-tab").forEach(x=>x.classList.toggle("active",x===btn));activeType=btn.dataset.type;render();
}));
[search,statusFilter,userFilter].forEach(x=>x?.addEventListener("input",render));
periodFilter?.addEventListener("change",()=>{customPeriod.hidden=periodFilter.value!=="custom";if(periodFilter.value!=="custom")render();});
applyOperationDates?.addEventListener("click",render);
clearOperationDates?.addEventListener("click",()=>{dateFrom.value="";dateTo.value="";periodFilter.value="";customPeriod.hidden=true;render();});
rows.addEventListener("click",e=>{
  const inv=e.target.closest("[data-invoice-operation]");
  if(inv){e.stopPropagation();location.href=`rechnungspruefung.html?operation=${encodeURIComponent(inv.dataset.invoiceOperation)}`;return;}
  const btn=e.target.closest("[data-open]"),row=e.target.closest(".operation-row"),id=btn?.dataset.open||row?.dataset.id;
  if(id){const o=operations.find(x=>x.id===id);if(o)openOperation(o)}
});
closeOperationModalBtn.addEventListener("click",closeModal);closeOperationBtn.addEventListener("click",closeModal);
demoActionBtn.addEventListener("click",()=>{
  const o=operations.find(x=>x.id===currentOperationId);if(!o)return;
  const type=document.getElementById("operationEditType")?.value;
  const status=document.getElementById("operationEditStatus")?.value;
  const price=Number(document.getElementById("operationEditPrice")?.value);
  const oldType=o.type,oldStatus=o.status,oldPrice=Number(o.price)||0;

  if(type&&type!==oldType){
    o.type=type;
    addHistory(o,{type:"type",from:oldType,to:type,text:`Vorgangsart geändert: ${labels[oldType]||oldType} → ${labels[type]||type}.`});
  }
  if(status&&status!==oldStatus){
    o.status=status;
    addHistory(o,{type:"status",from:oldStatus,to:status,text:`Status geändert: ${statuses[oldStatus]||oldStatus} → ${statuses[status]||status}.`});
  }
  if(Number.isFinite(price)&&price>=0&&Math.abs(price-oldPrice)>.009){
    o.price=Math.round(price*100)/100;
    const partsBefore=operationPriceParts({...o,price:oldPrice});
    const calculated=partsBefore.base+partsBefore.floaterAmt+partsBefore.ancillary;
    o.manualPriceDelta=Math.round((o.price-calculated)*100)/100;
    addHistory(o,{type:"price",from:oldPrice,to:o.price,text:`Preis händisch geändert: ${euro(oldPrice)} → ${euro(o.price)}.`});
  }
  o.updatedAt=isoNow();
  saveOperations();render();openOperation(o);
  const t=document.getElementById("operationToast");t.textContent="Vorgang aktualisiert und protokolliert.";t.hidden=false;setTimeout(()=>t.hidden=true,2400);
});
render();