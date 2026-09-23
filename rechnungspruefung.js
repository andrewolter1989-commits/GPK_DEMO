
const DEFAULT_CHECKS = [
  {id:"CHK-260901",invoice:"RE-2026-1031",provider:"LIT",date:"01.09.2026",expected:1012,actual:1012,diff:0,status:"ok",operation:"GPK-260901-081204"},
  {id:"CHK-260902",invoice:"RE-2026-1032",provider:"Transimeksa",date:"02.09.2026",expected:1263,actual:1315,diff:52,status:"diff",operation:"GPK-260902-111402"},
  {id:"CHK-260903",invoice:"RE-2026-1034",provider:"Bertschi",date:"03.09.2026",expected:724,actual:724,diff:0,status:"ok",operation:"GPK-260903-090118"},
  {id:"CHK-260904",invoice:"RE-2026-1038",provider:"Duvenbeck",date:"04.09.2026",expected:1352,actual:1398,diff:46,status:"diff",operation:"GPK-260904-143355"},
  {id:"CHK-260905",invoice:"RE-2026-1041",provider:"Dachser",date:"05.09.2026",expected:1609,actual:1609,diff:0,status:"ok",operation:"GPK-260905-105205"},
  {id:"CHK-260906",invoice:"RE-2026-1044",provider:"DSV",date:"06.09.2026",expected:1098,actual:0,diff:0,status:"unmatched",operation:"—"}
];
let checks = (()=>{try{return JSON.parse(localStorage.getItem(GPK.KEYS.invoiceChecks))||DEFAULT_CHECKS}catch(_){return DEFAULT_CHECKS}})();

const rows = document.getElementById("invoiceCheckRows");
const statusFilter = document.getElementById("checkStatusFilter");
const search = document.getElementById("checkSearch");
const toastEl = document.getElementById("invoiceToast");
let editingCheckId="";
const invoiceSubmitBtn=document.getElementById("invoiceSubmitBtn");
const cancelInvoiceEditBtn=document.getElementById("cancelInvoiceEditBtn");
const checkCountEl=document.getElementById("checkCount");
const okCountEl=document.getElementById("okCount");
const diffCountEl=document.getElementById("diffCount");
const clarificationCountEl=document.getElementById("clarificationCount");
const unmatchedCountEl=document.getElementById("unmatchedCount");
const okShareEl=document.getElementById("okShare");
const diffSumEl=document.getElementById("diffSum");
let activeInvoiceKpi="";
const PRICE_EPSILON=0.009;

const CONTINO_TEST_INVOICES={
  "2611120253":{
    invoice:"2611120253",provider:"Contino",invoiceDate:"2026-09-08",dueDate:"2026-10-29",
    externalReference:"2026-08-13751",shipmentNumber:"1504916.1",
    originName:"Flittig.Dk Aps",originCountry:"DK",originPostal:"6000",originCity:"Kolding",
    recipient:"Tchibo GmbH",destCountry:"DE",destPostal:"20537",destCity:"Hamburg Borgfelde",
    pickupDate:"2026-09-01",deliveryDate:"2026-09-02",ldm:13.60,slots:0,weight:0,
    freight:384.00,surchargeName:"Energiekrise Zuschlag",surchargePercent:7,surchargeAmount:26.88,total:410.88,
    transport:"FTL"
  },
  "2611120258":{
    invoice:"2611120258",provider:"Contino",invoiceDate:"2026-09-08",dueDate:"2026-10-29",
    externalReference:"2026-08-13782",shipmentNumber:"1507579.1",
    originName:"Rossmann - ZL Kiel",originCountry:"DE",originPostal:"24109",originCity:"Melsdorf",
    recipient:"Trixie Heimtierbedarf GmbH & Co. KG.",destCountry:"DE",destPostal:"24963",destCity:"Tarp",
    pickupDate:"2026-09-03",deliveryDate:"2026-09-04",ldm:13.60,slots:34,weight:0,
    freight:500.00,surchargeName:"Energiekrise Zuschlag",surchargePercent:7,surchargeAmount:35.00,total:535.00,
    transport:"FTL"
  }
};
let recognizedInvoice=null;

function invoiceNumberFromFile(file){
  const name=String(file?.name||"");
  const m=name.match(/(?:Rechnungen[_ -])?(\d{10})(?:_|\.|$)/i);
  return m?.[1]||"";
}
function findOperationForRecognized(inv){
  const ops=GPK.read(GPK.KEYS.operations,[])||[];
  if(!Array.isArray(ops))return null;
  const ref=String(inv?.externalReference||"").toLowerCase();
  const shipment=String(inv?.shipmentNumber||"").toLowerCase();
  return ops.find(o=>{
    const hay=`${o.id||""} ${o.externalReference||""} ${o.reference||""} ${o.shipmentNumber||""} ${o.note||""}`.toLowerCase();
    return (ref&&hay.includes(ref))||(shipment&&hay.includes(shipment));
  })||null;
}
function setInvoiceProvider(name){
  ensureProviderOption(name);
  invProvider.value=name||"";
}
function fillManualFromRecognized(inv,operation=null){
  if(!inv)return;
  invNumber.value=inv.invoice||"";
  setInvoiceProvider(inv.provider||"");
  invDate.value=inv.deliveryDate||inv.pickupDate||inv.invoiceDate||"";
  invZip.value=inv.destPostal||"";
  invTransport.value=inv.transport||"FTL";
  invAmount.value=Number(inv.total||0).toFixed(2);
  invOperation.value=operation?.id||"";
  invReviewStatus.value="auto";
  manualInvoiceForm.closest(".manual-card")?.scrollIntoView({behavior:"smooth",block:"start"});
}
function renderRecognizedInvoice(inv,file){
  recognizedInvoice=inv;
  const card=document.getElementById("invoiceRecognitionCard");
  if(!card)return;
  card.hidden=false;
  document.getElementById("recognizedInvoiceHeadline").textContent=`Rechnung ${inv.invoice} · ${inv.provider}`;
  document.getElementById("recognizedInvoiceGrid").innerHTML=`
    <div><span>Referenz</span><strong>${inv.externalReference||"—"}</strong></div>
    <div><span>Sendung</span><strong>${inv.shipmentNumber||"—"}</strong></div>
    <div><span>Relation</span><strong>${inv.originCountry} ${inv.originPostal} → ${inv.destCountry} ${inv.destPostal}</strong></div>
    <div><span>Transport</span><strong>${Number(inv.ldm||0).toLocaleString("de-DE")} LDM${inv.slots?` · ${inv.slots} Stellplätze`:""}</strong></div>
    <div><span>Grundfracht</span><strong>${euro2(inv.freight)}</strong></div>
    <div><span>${inv.surchargeName||"Zuschlag"}</span><strong>${euro2(inv.surchargeAmount)}${inv.surchargePercent?` · ${inv.surchargePercent}%`:""}</strong></div>
    <div><span>Rechnung gesamt</span><strong>${euro2(inv.total)}</strong></div>
    <div><span>Datei</span><strong>${file?.name||"—"}</strong></div>`;
  const op=findOperationForRecognized(inv);
  const match=document.getElementById("recognizedOperationMatch");
  const createBtn=document.getElementById("createOperationFromInvoiceBtn");
  if(op){
    match.className="invoice-recognition-match matched";
    match.innerHTML=`<strong>Passender Vorgang gefunden:</strong> ${op.id} · ${op.provider||"—"} · Soll ${euro2(op.price||0)}`;
    createBtn.hidden=true;
    document.getElementById("recognizedInvoiceStatus").textContent="Vorgang gefunden";
  }else{
    match.className="invoice-recognition-match unmatched";
    match.innerHTML=`<strong>Keine passende Sendung / kein Vorgang gefunden.</strong> Über „Vorgang aus Rechnung anlegen“ kann für den Test direkt eine Buchung erzeugt werden.`;
    createBtn.hidden=false;
    document.getElementById("recognizedInvoiceStatus").textContent="Nicht zugeordnet";
  }
}
function recognizeInvoiceFile(file){
  const no=invoiceNumberFromFile(file);
  const inv=CONTINO_TEST_INVOICES[no];
  if(inv){
    renderRecognizedInvoice({...inv,sourceFile:file.name},file);
    showToast(`Contino Rechnung ${no} erkannt.`);
    return;
  }
  recognizedInvoice=null;
  const card=document.getElementById("invoiceRecognitionCard");
  if(card){
    card.hidden=false;
    document.getElementById("recognizedInvoiceHeadline").textContent="PDF noch nicht automatisch erkannt";
    document.getElementById("recognizedInvoiceGrid").innerHTML=`<div class="span-all"><span>Datei</span><strong>${file?.name||"—"}</strong></div>`;
    document.getElementById("recognizedOperationMatch").innerHTML="Für dieses Rechnungsformat ist noch kein Parser hinterlegt. Die manuelle Erfassung bleibt verfügbar.";
    document.getElementById("createOperationFromInvoiceBtn").hidden=true;
    document.getElementById("useRecognizedInvoiceBtn").hidden=true;
    document.getElementById("recognizedInvoiceStatus").textContent="Review";
  }
}
function euro2(n){return new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR",minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n)||0);}
function currentInvoiceUser(){
  return window.GPK_CURRENT_USER?.name||"Lokale Demo";
}
function makeInvoiceOperationId(inv){
  const d=String(inv.deliveryDate||inv.invoiceDate||"").replaceAll("-","").slice(2);
  const suffix=String(Date.now()).slice(-4);
  return `GPK-${d}-${suffix}`;
}
function openInvoiceOperationModal(){
  if(!recognizedInvoice)return;
  const inv=recognizedInvoice;
  document.getElementById("newOpReference").value=inv.externalReference||"";
  document.getElementById("newOpShipment").value=inv.shipmentNumber||"";
  document.getElementById("newOpProvider").value=inv.provider||"";
  document.getElementById("newOpRelation").value=`${inv.originCountry} ${inv.originPostal} ${inv.originCity||""} → ${inv.destCountry} ${inv.destPostal} ${inv.destCity||""}`.replace(/\s+/g," ").trim();
  document.getElementById("newOpPickup").value=inv.pickupDate||"";
  document.getElementById("newOpDelivery").value=inv.deliveryDate||"";
  document.getElementById("newOpLdm").value=inv.ldm??"";
  document.getElementById("newOpSlots").value=inv.slots??"";
  document.getElementById("newOpTransport").value=inv.transport||"FTL";
  document.getElementById("newOpExpected").value=Number(inv.total||0).toFixed(2);
  document.getElementById("newOpBase").value=Number(inv.freight||0).toFixed(2);
  document.getElementById("newOpAncillary").value=Number(inv.surchargeAmount||0).toFixed(2);
  document.getElementById("newOpNote").value=`Aus Rechnung ${inv.invoice} angelegt · Referenz ${inv.externalReference} · Sendung ${inv.shipmentNumber}`;
  document.getElementById("invoiceOperationSource").innerHTML=`<strong>${inv.provider} · Rechnung ${inv.invoice}</strong><span>Ist ${euro2(inv.total)} · ${inv.originCountry} ${inv.originPostal} → ${inv.destCountry} ${inv.destPostal}</span>`;
  document.getElementById("invoiceOperationModal").hidden=false;
  document.body.classList.add("modal-open");
}
function closeInvoiceOperationModal(){
  document.getElementById("invoiceOperationModal").hidden=true;
  document.body.classList.remove("modal-open");
}
function saveOperationFromRecognized(event){
  event.preventDefault();
  const inv=recognizedInvoice;if(!inv)return;
  const expected=Number(document.getElementById("newOpExpected").value||0);
  const base=Number(document.getElementById("newOpBase").value||0);
  const ancillary=Number(document.getElementById("newOpAncillary").value||0);
  const op={
    id:makeInvoiceOperationId(inv),type:"booking",status:"closed",
    relation:document.getElementById("newOpRelation").value,
    provider:inv.provider,price:Math.round(expected*100)/100,
    basePrice:Math.round(base*100)/100,ancillaryAmount:Math.round(ancillary*100)/100,
    floaterAmount:0,floaterPercent:0,
    date:deDate(inv.deliveryDate),pickupDate:inv.pickupDate,delivery:inv.deliveryDate,
    deliveryDate:inv.deliveryDate,created:new Date().toLocaleDateString("de-DE")+" · "+new Date().toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"}),
    createdAt:new Date().toISOString(),user:currentInvoiceUser(),
    transport:document.getElementById("newOpTransport").value,
    customer:inv.recipient||"",note:document.getElementById("newOpNote").value,
    externalReference:inv.externalReference,shipmentNumber:inv.shipmentNumber,
    invoiceNumber:inv.invoice,invoiceActual:inv.total,
    invoiceFreight:inv.freight,invoiceSurchargeAmount:inv.surchargeAmount,
    invoiceSurchargeName:inv.surchargeName,
    originName:inv.originName,originCountry:inv.originCountry,originPostal:inv.originPostal,
    destCountry:inv.destCountry,destPostal:inv.destPostal,
    ldm:Number(document.getElementById("newOpLdm").value||0),
    slots:Number(document.getElementById("newOpSlots").value||0),
    weight:Number(inv.weight||0)
  };
  const ops=GPK.read(GPK.KEYS.operations,[])||[];
  if(!GPK.write(GPK.KEYS.operations,[op,...ops])){
    showToast("Vorgang konnte nicht gespeichert werden.");
    return;
  }
  closeInvoiceOperationModal();
  fillManualFromRecognized(inv,op);
  renderRecognizedInvoice(inv,{name:inv.sourceFile||""});
  showToast(`Vorgang ${op.id} angelegt. Rechnung ist zur Prüfung vorbereitet.`);
}




function euro(n){return new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(Number(n)||0);}
function showToast(text){
  toastEl.textContent=text;toastEl.hidden=false;clearTimeout(showToast.timer);
  showToast.timer=setTimeout(()=>toastEl.hidden=true,2400);
}
function save(){try{GPK.write(GPK.KEYS.invoiceChecks,checks)}catch(_){}}
function statusLabel(s){return ({ok:"OK",diff:"Abweichung",clarification:"In Klärung",unmatched:"Nicht zugeordnet"})[s]||s;}
function hasPriceDeviation(c){
  return Number.isFinite(Number(c?.diff))&&Math.abs(Number(c.diff))>PRICE_EPSILON;
}
function normalizeCheckStatus(c){
  if(!c)return c;
  if(c.status==="ok"&&hasPriceDeviation(c))c.status="diff";
  if(c.status==="diff"&&!hasPriceDeviation(c))c.status="ok";
  return c;
}
checks=checks.map(normalizeCheckStatus);
save();

function renderInvoiceKpis(){
  const total=checks.length;
  const ok=checks.filter(c=>c.status==="ok").length;
  const diff=checks.filter(c=>c.status==="diff").length;
  const clarification=checks.filter(c=>c.status==="clarification").length;
  const unmatched=checks.filter(c=>c.status==="unmatched").length;
  const diffAmount=checks.filter(c=>c.status==="diff").reduce((sum,c)=>sum+Math.abs(Number(c.diff)||0),0);
  checkCountEl.textContent=new Intl.NumberFormat("de-DE").format(total);
  okCountEl.textContent=new Intl.NumberFormat("de-DE").format(ok);
  diffCountEl.textContent=new Intl.NumberFormat("de-DE").format(diff);
  clarificationCountEl.textContent=new Intl.NumberFormat("de-DE").format(clarification);
  unmatchedCountEl.textContent=new Intl.NumberFormat("de-DE").format(unmatched);
  okShareEl.textContent=total?`${Math.round(ok/total*100)} % ohne Abweichung`:"ohne Abweichung";
  diffSumEl.textContent=`${euro(diffAmount)} Differenz`;
  document.querySelectorAll("[data-invoice-kpi]").forEach(btn=>{
    const active=(btn.dataset.invoiceKpi||"")===activeInvoiceKpi;
    btn.classList.toggle("active",active);
    btn.setAttribute("aria-pressed",active?"true":"false");
  });
}


function operationStatusForCheck(c){const o=findOperationById?.(c.operation);return o?.status||""}
function operationStatusLabel(v){return ({open:"Offen",waiting:"Warten auf Antwort",confirmed:"Bestätigt",booked:"Gebucht",closed:"Abgeschlossen"})[v]||"—"}
function renderChecks(){
  const q=search.value.trim().toLowerCase(), sf=statusFilter.value;
  const effectiveStatus=activeInvoiceKpi||sf;
  const filtered=checks.filter(c=>{
    const hay=`${c.invoice} ${c.provider} ${c.operation}`.toLowerCase();
    return (!q||hay.includes(q))&&(!effectiveStatus||c.status===effectiveStatus);
  });
  rows.innerHTML=filtered.map(c=>`<tr class="invoice-history-row" data-check-id="${c.id}" tabindex="0" title="Prüfung öffnen und bearbeiten">
    <td><strong class="table-main">${c.invoice}</strong><small>${c.id}</small></td>
    <td><strong class="table-main">${c.provider}</strong><small>${c.operation||"—"}</small></td>
    <td>${c.date}</td>
    <td><strong class="price-cell">${euro(c.expected)}</strong></td>
    <td><strong class="price-cell">${c.actual?euro(c.actual):"—"}</strong></td>
    <td><strong class="${c.diff>0?"invoice-diff-pos":"invoice-diff-zero"}">${c.diff?((c.diff>0?"+":"")+euro(c.diff)):c.status==="unmatched"?"—":"0 €"}</strong></td>
    <td><span class="status-pill ${c.status==="ok"?"active":c.status==="diff"?"future":c.status==="clarification"?"review":"inactive"}">${statusLabel(c.status)}</span></td>
    <td class="row-actions"><button class="icon-button" type="button" data-edit-check="${c.id}" title="Prüfung bearbeiten">›</button></td>
  </tr>`).join("");
  renderInvoiceKpis();
}

function findLocalTariff(provider, zip, transport){
  try{
    const local=JSON.parse(localStorage.getItem(GPK.KEYS.rates)||"[]");
    if(Array.isArray(local)&&local.length){
      const hit=local.find(r=>r.provider===provider && r.transport===transport && (!r.zipFrom||String(zip)>=String(r.zipFrom)) && (!r.zipTo||String(zip)<=String(r.zipTo)) && r.status!=="inactive");
      if(hit)return hit;
    }
  }catch(_){}
  const fallback={
    "LIT":{base:920,floater:8.5},"Transimeksa":{base:1180,floater:7.0},"Bertschi":{base:680,floater:6.5},
    "Duvenbeck":{base:1240,floater:9.0},"Dachser":{base:1490,floater:8.0},"Raben":{base:755,floater:7.5},"DSV":{base:1015,floater:8.2}
  };
  return fallback[provider]?{provider,base:fallback[provider].base,floater:fallback[provider].floater}:null;
}
function findFloater(provider,date,fallback){
  try{
    const periods=JSON.parse(localStorage.getItem(GPK.KEYS.floaters)||"[]");
    if(Array.isArray(periods)){
      const hit=periods.find(p=>p.provider===provider && p.from<=date && p.to>=date);
      if(hit)return {value:Number(hit.value)||0,from:hit.from,to:hit.to};
    }
  }catch(_){}
  return {value:Number(fallback)||0,from:"2026-09-01",to:"2026-09-30"};
}
function deDate(iso){if(!iso)return "—";const [y,m,d]=iso.split("-");return `${d}.${m}.${y}`;}


function findOperationById(id){
  if(!id||id==="—")return null;
  try{
    const ops=GPK.read(GPK.KEYS.operations,[])||[];
    return Array.isArray(ops)?ops.find(o=>String(o.id)===String(id))||null:null;
  }catch(_){return null}
}
function relationZip(operation){
  const m=String(operation?.relation||"").match(/(?:→|->)\s*[A-Z]{2}\s*(\d{4,5})/);
  return m?.[1]||"";
}
function ensureProviderOption(name){
  if(!name||!invProvider)return;
  if(![...invProvider.options].some(o=>o.value===name)){
    const opt=document.createElement("option");opt.value=name;opt.textContent=name;invProvider.appendChild(opt);
  }
}
function prefillFromOperation(id){
  const o=findOperationById(id);if(!o)return;
  ensureProviderOption(o.provider);invProvider.value=o.provider||"";
  invOperation.value=o.id||id;
  invZip.value=relationZip(o);
  const tr=String(o.transport||"").toLowerCase();
  if(tr.includes("mega"))invTransport.value="Mega";
  else if(tr.includes("jumbo"))invTransport.value="Jumbo";
  else if(tr.includes("teillad"))invTransport.value="Teilladung";
  else invTransport.value="FTL";
  const iso=String(o.delivery||o.date||"");
  const m=iso.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if(m)invDate.value=`${m[3]}-${m[2]}-${m[1]}`;
  else if(/^\d{4}-\d{2}-\d{2}$/.test(iso))invDate.value=iso;
}

function isoDateFromDe(v){
  const m=String(v||"").match(/^(\d{2})\.(\d{2})\.(\d{4})$/);return m?`${m[3]}-${m[2]}-${m[1]}`:"";
}
function startCheckEdit(c){
  if(!c)return;
  editingCheckId=c.id;
  ensureProviderOption(c.provider);invProvider.value=c.provider||"";
  invNumber.value=c.invoice||"";
  invDate.value=isoDateFromDe(c.date);
  invAmount.value=Number(c.actual)||0;
  invOperation.value=c.operation&&c.operation!=="—"?c.operation:"";
  invReviewStatus.value=c.status||"auto";
  if(c.zip)invZip.value=c.zip;
  if(c.transport)invTransport.value=c.transport;
  else if(c.operation&&c.operation!=="—")prefillFromOperation(c.operation);
  invoiceSubmitBtn.textContent="Prüfung aktualisieren";
  cancelInvoiceEditBtn.hidden=false;
  manualInvoiceForm.closest(".manual-card")?.scrollIntoView({behavior:"smooth",block:"start"});
  invNumber.focus();
}
function endCheckEdit(){
  editingCheckId="";
  manualInvoiceForm.reset();
  invReviewStatus.value="auto";
  invoiceSubmitBtn.textContent="Rechnung prüfen";
  cancelInvoiceEditBtn.hidden=true;
}
cancelInvoiceEditBtn?.addEventListener("click",endCheckEdit);
rows.addEventListener("click",e=>{
  const id=e.target.closest("[data-edit-check]")?.dataset.editCheck||e.target.closest("[data-check-id]")?.dataset.checkId;
  if(id)startCheckEdit(checks.find(c=>c.id===id));
});
rows.addEventListener("keydown",e=>{
  if(e.key!=="Enter"&&e.key!==" ")return;
  const id=e.target.closest("[data-check-id]")?.dataset.checkId;
  if(id){e.preventDefault();startCheckEdit(checks.find(c=>c.id===id));}
});

manualInvoiceForm.addEventListener("submit",e=>{
  e.preventDefault();
  const provider=invProvider.value, date=invDate.value, zip=invZip.value.trim(), transport=invTransport.value;
  const actual=Number(invAmount.value||0);
  const linkedOperation=findOperationById(invOperation.value.trim());
  const tariff=findLocalTariff(provider,zip,transport);
  if(!tariff&&!linkedOperation){
    showToast("Kein passender Tarif oder Vorgang gefunden.");
    return;
  }
  const storedBase=Number(linkedOperation?.basePrice);
  const storedFloaterPct=Number(linkedOperation?.floaterPercent);
  const storedFloaterAmount=Number(linkedOperation?.floaterAmount);
  const storedAncillary=Number(linkedOperation?.ancillaryAmount||linkedOperation?.surchargeAmount||0)||0;
  const floater=findFloater(provider,date,Number.isFinite(storedFloaterPct)?storedFloaterPct:tariff?.floater);
  const base=Number.isFinite(storedBase)?storedBase:Number(tariff?.base||0);
  const floaterAmount=Number.isFinite(storedFloaterAmount)?storedFloaterAmount:base*(Number(floater.value||0)/100);
  const expected=Number(linkedOperation?.price)||base+floaterAmount+storedAncillary;
  const diff=actual-expected;
  const selectedReview=document.getElementById("invReviewStatus")?.value||"auto";
  let status=selectedReview==="auto"?(Math.abs(diff)<=PRICE_EPSILON?"ok":"diff"):selectedReview;
  if(status==="ok"&&Math.abs(diff)>PRICE_EPSILON){
    status="diff";
    document.getElementById("invReviewStatus").value="diff";
    showToast("OK ist bei einer Preisabweichung nicht möglich. Status wurde auf „Abweichung“ gesetzt.");
  }else if(status==="diff"&&Math.abs(diff)<=PRICE_EPSILON){
    status="ok";
    document.getElementById("invReviewStatus").value="ok";
    showToast("Ohne Preisabweichung ist der Prüfstatus „OK“.");
  }

  resultInvoiceAmount.textContent=euro(actual);
  resultBase.textContent=euro(base);
  resultFloater.textContent=Number(floater.value).toLocaleString("de-DE")+" %";
  resultFloaterPeriod.textContent=`${deDate(floater.from)} – ${deDate(floater.to)}`;
  resultExpected.textContent=euro(expected);
  resultDifference.textContent=(diff>0?"+":"")+euro(diff);
  resultHeadline.textContent=statusLabel(status);
  resultStatusPill.textContent=statusLabel(status);
  resultStatusPill.className="status-pill "+(status==="ok"?"active":status==="diff"?"future":status==="clarification"?"review":"inactive");
  resultMeta.textContent=`${provider} · ${transport} · Ziel PLZ ${zip} · Transportdatum ${deDate(date)}${invOperation.value.trim()?" · Vorgang "+invOperation.value.trim():""}`;
  invoiceResultCard.hidden=false;

  const existing=editingCheckId?checks.find(c=>c.id===editingCheckId):null;
  const c={
    id:existing?.id||("CHK-"+Date.now()),
    invoice:invNumber.value.trim(),
    provider,date:deDate(date),zip,transport,
    expected:Math.round(expected*100)/100,actual:Math.round(actual*100)/100,diff:Math.round(diff*100)/100,
    basePrice:Math.round(base*100)/100,floaterPercent:Number(floater.value)||0,floaterAmount:Math.round(floaterAmount*100)/100,
    ancillaryAmount:Math.round(storedAncillary*100)/100,
    status,operation:invOperation.value.trim()||"—",
    createdAt:existing?.createdAt||new Date().toISOString(),
    updatedAt:new Date().toISOString()
  };
  if(existing){checks=checks.map(x=>x.id===editingCheckId?c:x);}
  else checks.unshift(c);
  save();renderChecks();
  showToast(existing?"Rechnungsprüfung wurde aktualisiert.":"Rechnungsprüfung wurde gespeichert.");
  endCheckEdit();
});

chooseInvoiceBtn.addEventListener("click",()=>invoiceFileInput.click());
invoiceFileInput.addEventListener("change",()=>{
  if(invoiceFileInput.files?.[0])recognizeInvoiceFile(invoiceFileInput.files[0]);
});
invoiceDropzone.addEventListener("dragover",e=>{e.preventDefault();invoiceDropzone.classList.add("dragging")});
invoiceDropzone.addEventListener("dragleave",()=>invoiceDropzone.classList.remove("dragging"));
invoiceDropzone.addEventListener("drop",e=>{
  e.preventDefault();invoiceDropzone.classList.remove("dragging");
  if(e.dataTransfer.files?.[0])recognizeInvoiceFile(e.dataTransfer.files[0]);
});
document.getElementById("useRecognizedInvoiceBtn")?.addEventListener("click",()=>{
  if(!recognizedInvoice)return;
  const op=findOperationForRecognized(recognizedInvoice);
  fillManualFromRecognized(recognizedInvoice,op);
  showToast(op?"Rechnung und Vorgang in Prüfung übernommen.":"Rechnung übernommen. Vorgang fehlt noch.");
});
document.getElementById("createOperationFromInvoiceBtn")?.addEventListener("click",openInvoiceOperationModal);
document.getElementById("invoiceOperationForm")?.addEventListener("submit",saveOperationFromRecognized);
document.getElementById("closeInvoiceOperationModal")?.addEventListener("click",closeInvoiceOperationModal);
document.getElementById("cancelInvoiceOperationModal")?.addEventListener("click",closeInvoiceOperationModal);
document.getElementById("invoiceOperationModal")?.addEventListener("click",e=>{if(e.target?.id==="invoiceOperationModal")closeInvoiceOperationModal();});
[statusFilter,search].forEach(x=>x.addEventListener("input",()=>{
  if(x===statusFilter)activeInvoiceKpi=statusFilter.value||"";
  renderChecks();
}));
statusFilter.addEventListener("change",()=>{activeInvoiceKpi=statusFilter.value||"";renderChecks();});
document.querySelectorAll("[data-invoice-kpi]").forEach(btn=>btn.addEventListener("click",()=>{
  const next=btn.dataset.invoiceKpi||"";
  activeInvoiceKpi=(activeInvoiceKpi===next&&next!=="")?"":next;
  statusFilter.value=activeInvoiceKpi;
  renderChecks();
}));
exportChecksBtn.addEventListener("click",()=>showToast("Export der Prüfungen wird im nächsten technischen Schritt angebunden."));
renderChecks();

(function(){const op=new URLSearchParams(location.search).get("operation");if(op)prefillFromOperation(op);})();
