
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


const HELLMANN_SAMPLE_INVOICE={
  type:"batch",invoice:"122105",provider:"Hellmann",invoiceDate:"2026-06-22",customerNumber:"0922352",
  sourceLabel:"Hellmann Worldwide Logistics",netTotal:3609.07,vatRate:19,vatAmount:685.72,grossTotal:4294.79,
  positions:[{"pos":"001","date":"11.06.2026","shipment":"23289802","reference":"586926","weight":20.0,"actual":33.52,"destCountry":"DE","destPostal":"30165","destCity":"HANNOVER"},{"pos":"002","date":"12.06.2026","shipment":"23403178","reference":"586919","weight":20.0,"actual":42.55,"destCountry":"DE","destPostal":"35578","destCity":"WETZLAR"},{"pos":"003","date":"12.06.2026","shipment":"23403246","reference":"586802","weight":20.0,"actual":47.55,"destCountry":"DE","destPostal":"60388","destCity":"FRANKFURT"},{"pos":"004","date":"12.06.2026","shipment":"23403291","reference":"587318","weight":20.0,"actual":52.95,"destCountry":"DE","destPostal":"88453","destCity":"EROLZHEIM"},{"pos":"005","date":"15.06.2026","shipment":"23514218","reference":"587641","weight":40.0,"actual":61.57,"destCountry":"DE","destPostal":"45309","destCity":"ESSEN"},{"pos":"006","date":"15.06.2026","shipment":"23514225","reference":"586115","weight":15.0,"actual":44.5,"destCountry":"DE","destPostal":"86167","destCity":"AUGSBURG                                              5,00 % DIESELZUSCHLAG                                      1,76"},{"pos":"007","date":"15.06.2026","shipment":"23514232","reference":"20024276","weight":40.0,"actual":68.47,"destCountry":"DE","destPostal":"06112","destCity":"HALLE                                                                           5,00 % DIESELZUSCHLAG                                      2,53"},{"pos":"008","date":"15.06.2026","shipment":"23514249","reference":"587311","weight":40.0,"actual":61.57,"destCountry":"DE","destPostal":"46342","destCity":"VELEN"},{"pos":"009","date":"15.06.2026","shipment":"23514256","reference":"588120, 588118","weight":80.0,"actual":95.44,"destCountry":"DE","destPostal":"45309","destCity":"ESSEN"},{"pos":"010","date":"15.06.2026","shipment":"23514270","reference":"587173","weight":120.0,"actual":101.91,"destCountry":"DE","destPostal":"36381","destCity":"SCHLUECHTERN"},{"pos":"011","date":"15.06.2026","shipment":"23514294","reference":"587215","weight":20.0,"actual":39.87,"destCountry":"DE","destPostal":"74252","destCity":"MASSENBACHHAUSEN"},{"pos":"012","date":"16.06.2026","shipment":"23631168","reference":"587248, 587302","weight":60.0,"actual":111.23,"destCountry":"DE","destPostal":"85622","destCity":"FELDKIRCHEN"},{"pos":"013","date":"16.06.2026","shipment":"23631175","reference":"587117","weight":20.0,"actual":34.79,"destCountry":"DE","destPostal":"26382","destCity":"WILHELMSHAVEN"},{"pos":"014","date":"16.06.2026","shipment":"23631182","reference":"587297","weight":20.0,"actual":34.79,"destCountry":"DE","destPostal":"51063","destCity":"KOELN"},{"pos":"015","date":"16.06.2026","shipment":"23631199","reference":"587322","weight":20.0,"actual":34.79,"destCountry":"DE","destPostal":"47805","destCity":"KREFELD"},{"pos":"016","date":"16.06.2026","shipment":"23631212","reference":"587301","weight":40.0,"actual":66.76,"destCountry":"DE","destPostal":"63263","destCity":"NEU-ISENBURG"},{"pos":"017","date":"16.06.2026","shipment":"23631229","reference":"588394","weight":20.0,"actual":37.69,"destCountry":"DE","destPostal":"01097","destCity":"DRESDEN"},{"pos":"018","date":"16.06.2026","shipment":"23631236","reference":"586084","weight":50.0,"actual":98.14,"destCountry":"DE","destPostal":"41066","destCity":"MOENCHENGLADBACH"},{"pos":"019","date":"16.06.2026","shipment":"23631243","reference":"586240","weight":90.0,"actual":106.04,"destCountry":"DE","destPostal":"41066","destCity":"MOENCHENGLADBACH"},{"pos":"020","date":"16.06.2026","shipment":"23631250","reference":"585693","weight":20.0,"actual":77.26,"destCountry":"DE","destPostal":"63128","destCity":"DIETZENBACH                                                                     5,00 % DIESELZUSCHLAG                                      2,92"},{"pos":"021","date":"16.06.2026","shipment":"23631267","reference":"587242","weight":200.0,"actual":112.53,"destCountry":"DE","destPostal":"37120","destCity":"BOVENDEN"},{"pos":"022","date":"16.06.2026","shipment":"23631274","reference":"585943, 586494, 586267","weight":80.0,"actual":102.94,"destCountry":"DE","destPostal":"22459","destCity":"HAMBURG                                              5,00 % DIESELZUSCHLAG                                      4,14"},{"pos":"023","date":"16.06.2026","shipment":"23631281","reference":"586351","weight":20.0,"actual":37.79,"destCountry":"DE","destPostal":"58553","destCity":"HALVER"},{"pos":"024","date":"16.06.2026","shipment":"23631298","reference":"587022","weight":30.0,"actual":25.75,"destCountry":"DE","destPostal":"40599","destCity":"DUESSELDORF"},{"pos":"025","date":"17.06.2026","shipment":"23756625","reference":"586618","weight":28.0,"actual":72.93,"destCountry":"DE","destPostal":"70736","destCity":"FELLBACH"},{"pos":"026","date":"17.06.2026","shipment":"23756632","reference":"586352","weight":132.0,"actual":141.74,"destCountry":"DE","destPostal":"87509","destCity":"IMMENSTADT"},{"pos":"027","date":"17.06.2026","shipment":"23756649","reference":"586898","weight":20.0,"actual":45.42,"destCountry":"DE","destPostal":"09114","destCity":"CHEMNITZ"},{"pos":"028","date":"17.06.2026","shipment":"23756656","reference":"586788","weight":20.0,"actual":45.42,"destCountry":"DE","destPostal":"18106","destCity":"ROSTOCK"},{"pos":"029","date":"17.06.2026","shipment":"23756663","reference":"586632","weight":20.0,"actual":44.71,"destCountry":"DE","destPostal":"40549","destCity":"DUESSELDORF"},{"pos":"030","date":"17.06.2026","shipment":"23756670","reference":"586979","weight":60.0,"actual":122.16,"destCountry":"DE","destPostal":"83026","destCity":"ROSENHEIM"},{"pos":"031","date":"17.06.2026","shipment":"23756687","reference":"587018","weight":30.0,"actual":93.79,"destCountry":"DE","destPostal":"20537","destCity":"HAMBURG"},{"pos":"032","date":"17.06.2026","shipment":"23756694","reference":"586915                                                                                                 AVIS AUF TOUR                                  3,00","weight":40.0,"actual":82.67,"destCountry":"DE","destPostal":"99092","destCity":"ERFURT                                                      AVISGEBÜHR                                     7,50"},{"pos":"033","date":"17.06.2026","shipment":"23756700","reference":"UEBELKW25","weight":40.0,"actual":39.2,"destCountry":"DE","destPostal":"66887","destCity":"SANKT JULIAN                                                           5,00 % DIESELZUSCHLAG                                      1,34"},{"pos":"034","date":"17.06.2026","shipment":"23756717","reference":"587362","weight":20.0,"actual":52.95,"destCountry":"DE","destPostal":"79291","destCity":"MERDINGEN"},{"pos":"035","date":"17.06.2026","shipment":"23756724","reference":"587150","weight":20.0,"actual":49.71,"destCountry":"DE","destPostal":"73663","destCity":"BERGLEN"},{"pos":"036","date":"17.06.2026","shipment":"23756731","reference":"587028","weight":30.0,"actual":114.19,"destCountry":"DE","destPostal":"73630","destCity":"REMSHALDEN"},{"pos":"037","date":"17.06.2026","shipment":"23756748","reference":"587326","weight":60.0,"actual":114.57,"destCountry":"DE","destPostal":"93437","destCity":"FURTH IM WALD"},{"pos":"038","date":"18.06.2026","shipment":"23864535","reference":"586358","weight":20.0,"actual":48.26,"destCountry":"DE","destPostal":"71277","destCity":"RUTESHEIM"},{"pos":"039","date":"18.06.2026","shipment":"23864542","reference":"586045","weight":20.0,"actual":45.42,"destCountry":"DE","destPostal":"12359","destCity":"BERLIN"},{"pos":"040","date":"18.06.2026","shipment":"23864559","reference":"586156","weight":40.0,"actual":69.46,"destCountry":"DE","destPostal":"10717","destCity":"BERLIN"},{"pos":"041","date":"18.06.2026","shipment":"23864566","reference":"586189","weight":20.0,"actual":45.42,"destCountry":"DE","destPostal":"12107","destCity":"BERLIN"},{"pos":"042","date":"18.06.2026","shipment":"23864580","reference":"586753","weight":40.0,"actual":82.54,"destCountry":"DE","destPostal":"82256","destCity":"FUERSTENFELDBRUCK"},{"pos":"043","date":"18.06.2026","shipment":"23864597","reference":"586260","weight":40.0,"actual":80.37,"destCountry":"DE","destPostal":"60386","destCity":"FRANKFURT                                            5,00 % DIESELZUSCHLAG                                      3,10"},{"pos":"044","date":"18.06.2026","shipment":"23864603","reference":"586653","weight":20.0,"actual":45.42,"destCountry":"DE","destPostal":"13088","destCity":"BERLIN"},{"pos":"045","date":"19.06.2026","shipment":"23978454","reference":"587350","weight":25.0,"actual":65.98,"destCountry":"DE","destPostal":"52353","destCity":"DUEREN"},{"pos":"046","date":"19.06.2026","shipment":"23978461","reference":"587491","weight":200.0,"actual":147.27,"destCountry":"DE","destPostal":"34253","destCity":"LOHFELDEN"},{"pos":"047","date":"19.06.2026","shipment":"23978478","reference":"587402","weight":20.0,"actual":44.71,"destCountry":"DE","destPostal":"40878","destCity":"RATINGEN"},{"pos":"048","date":"19.06.2026","shipment":"23978492","reference":"587561, 587948","weight":40.0,"actual":77.49,"destCountry":"DE","destPostal":"89407","destCity":"DILLINGEN"},{"pos":"049","date":"19.06.2026","shipment":"23978515","reference":"587404","weight":20.0,"actual":41.84,"destCountry":"DE","destPostal":"51674","destCity":"WIEHL"},{"pos":"050","date":"19.06.2026","shipment":"23978522","reference":"587595","weight":20.0,"actual":45.42,"destCountry":"DE","destPostal":"12277","destCity":"BERLIN"},{"pos":"051","date":"19.06.2026","shipment":"23978539","reference":"587570","weight":100.0,"actual":111.55,"destCountry":"DE","destPostal":"18069","destCity":"ROSTOCK"},{"pos":"052","date":"19.06.2026","shipment":"23978546","reference":"586781","weight":20.0,"actual":53.68,"destCountry":"DE","destPostal":"80686","destCity":"MUENCHEN"},{"pos":"053","date":"19.06.2026","shipment":"23978577","reference":"587650","weight":20.0,"actual":54.38,"destCountry":"DE","destPostal":"83278","destCity":"TRAUNSTEIN"}]
};

let invoiceQueue=[];
let activeRecognizedKey="";
let reviewInvoiceKey="";

function invoiceNumberFromFile(file){
  const name=String(file?.name||"");
  const m=name.match(/(?:Rechnungen[_ -])?(\d{10})(?:_|\.|$)/i);
  return m?.[1]||"";
}
function recognizedKey(inv){return `${inv?.provider||""}|${inv?.invoice||""}`.toLowerCase()}
function providerExists(name){return !!GPK.providerRecord(name)}
function findExistingCheckByInvoice(inv){
  const needle=String(inv?.invoice||"").trim().toLowerCase();
  return checks.find(c=>String(c.invoice||"").trim().toLowerCase()===needle)||null;
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
function findTariffForRecognized(inv){
  const all=[...(GPK.read(GPK.KEYS.rates,[])||[]),...(GPK.read(GPK.KEYS.rateOutputs,[])||[])];
  const provider=String(inv?.provider||"").toLowerCase(),country=String(inv?.destCountry||"").toUpperCase();
  return all.find(r=>{
    const rp=String(r.provider||r.provider_name||r.Forwarder||"").toLowerCase();
    const rc=String(r.destCountry||r.country||r.Land||r["Dest CTRY"]||"").toUpperCase();
    return rp===provider&&(!rc||rc===country)&&Number.isFinite(Number(r.price));
  })||null;
}
function makeQueueItem(file){
  const no=invoiceNumberFromFile(file),base=CONTINO_TEST_INVOICES[no];
  if(base){
    const inv={...base,sourceFile:file.name};
    return {key:recognizedKey(inv),fileName:file.name,status:"recognized",recognized:true,invoice:inv};
  }
  const lower=String(file?.name||"").toLowerCase();
  if(lower.includes("hellmann")||lower.includes("122105")){
    const inv={...HELLMANN_SAMPLE_INVOICE,positions:HELLMANN_SAMPLE_INVOICE.positions.map(p=>({...p})),sourceFile:file.name};
    return {key:recognizedKey(inv),fileName:file.name,status:"recognized",recognized:true,invoice:inv};
  }
  return {key:`file|${file.name}|${file.size}`,fileName:file.name,status:"review",recognized:false};
}
function mergeInvoiceFiles(files){
  [...files].map(makeQueueItem).forEach(item=>{
    const duplicate=invoiceQueue.find(x=>x.key===item.key);
    if(duplicate){duplicate.fileName=item.fileName;}
    else invoiceQueue.push(item);
  });
  renderInvoiceQueue();
}

function isBatchInvoice(inv){return inv?.type==="batch"&&Array.isArray(inv.positions)}
function findOperationForBatchPosition(pos,provider){
  const ops=GPK.read(GPK.KEYS.operations,[])||[];
  const ref=String(pos.reference||"").toLowerCase();
  const shipment=String(pos.shipment||"").toLowerCase();
  return ops.find(o=>{
    if(provider&&String(o.provider||"").trim().toLowerCase()!==String(provider).trim().toLowerCase())return false;
    const hay=`${o.id||""} ${o.externalReference||""} ${o.reference||""} ${o.shipmentNumber||""} ${o.note||""}`.toLowerCase();
    return (ref&&hay.includes(ref))||(shipment&&hay.includes(shipment));
  })||null;
}
function batchPositionState(pos,provider){
  const op=findOperationForBatchPosition(pos,provider);
  if(!op)return {status:"unmatched",label:"Nicht zugeordnet",op:null,expected:null,diff:null};
  const expected=Number(op.price);
  if(!(expected>0))return {status:"pending",label:"Nicht geprüft",op,expected:null,diff:null};
  const diff=Math.round((Number(pos.actual||0)-expected)*100)/100;
  if(Math.abs(diff)<=PRICE_EPSILON)return {status:"ok",label:"OK",op,expected,diff};
  if(diff>0)return {status:"over",label:"Abweichung",op,expected,diff};
  return {status:"under",label:"Abweichung",op,expected,diff};
}
function batchCounts(inv){
  const out={ok:0,over:0,under:0,pending:0,clarification:0,unmatched:0};
  (inv.positions||[]).forEach(p=>{const s=batchPositionState(p,inv.provider).status;out[s]=(out[s]||0)+1});
  return out;
}
function batchOverallStatus(inv){
  const c=batchCounts(inv);
  if(c.unmatched)return "Nicht zugeordnet";
  if(c.clarification)return "In Klärung";
  if(c.pending)return "Nicht geprüft";
  if(c.over||c.under)return "Abweichung";
  return "OK";
}
function batchStatusClass(status){
  return status==="ok"?"ok":status==="over"?"over":status==="under"?"under":status==="clarification"?"clarification":status==="unmatched"?"unmatched":"pending";
}
function openBatchReview(key){
  const item=queueItem(key);if(!item?.recognized||!isBatchInvoice(item.invoice))return;
  const inv=item.invoice;
  reviewInvoiceKey=key;
  invoiceReviewWorkspace.hidden=true;
  invoiceBatchReviewWorkspace.hidden=false;
  batchReviewTitle.textContent=`Rechnung ${inv.invoice} · ${inv.provider}`;
  batchReviewSubtitle.textContent=`${inv.positions.length} Sendungspositionen · Belegdatum ${deDate(inv.invoiceDate)} · jede Position wird separat geprüft.`;
  invoiceBatchSummary.innerHTML=`<div><span>Positionen</span><strong>${inv.positions.length}</strong></div><div><span>Netto</span><strong>${euro2(inv.netTotal)}</strong></div><div><span>MwSt. ${inv.vatRate}%</span><strong>${euro2(inv.vatAmount)}</strong></div><div><span>Gesamt</span><strong>${euro2(inv.grossTotal)}</strong></div>`;
  renderBatchRows();
  invoiceBatchReviewWorkspace.scrollIntoView({behavior:"smooth",block:"start"});
}
function renderBatchRows(){
  const item=queueItem(reviewInvoiceKey);if(!item?.recognized||!isBatchInvoice(item.invoice))return;
  const inv=item.invoice,c=batchCounts(inv);
  invoiceBatchStatusbar.innerHTML=`<span class="batch-status ok">OK <strong>${c.ok}</strong></span><span class="batch-status over">Zu hoch <strong>${c.over}</strong></span><span class="batch-status under">Zu niedrig <strong>${c.under}</strong></span><span class="batch-status pending">Nicht geprüft <strong>${c.pending}</strong></span><span class="batch-status clarification">In Klärung <strong>${c.clarification}</strong></span><span class="batch-status unmatched">Nicht zugeordnet <strong>${c.unmatched}</strong></span><span class="batch-overall">Gesamtstatus: <strong>${batchOverallStatus(inv)}</strong></span>`;
  invoiceBatchRows.innerHTML=inv.positions.map(pos=>{
    const s=batchPositionState(pos,inv.provider);
    const diff=s.diff==null?"—":`${s.diff>0?"+":""}${euro2(s.diff)}`;
    const expected=s.expected==null?"—":euro2(s.expected);
    return `<tr class="batch-row-${batchStatusClass(s.status)}"><td>${escapeInvoice(pos.pos)}</td><td>${escapeInvoice(pos.date)}</td><td>${escapeInvoice(pos.reference)}</td><td>${escapeInvoice(pos.shipment)}</td><td>${escapeInvoice(pos.destCountry)} ${escapeInvoice(pos.destPostal)} ${escapeInvoice(pos.destCity)}</td><td><strong>${euro2(pos.actual)}</strong></td><td>${expected}</td><td>${diff}</td><td><span class="batch-line-status ${batchStatusClass(s.status)}">${s.label}</span>${s.op?`<small>${escapeInvoice(s.op.id)}</small>`:""}</td></tr>`;
  }).join("");
}
function saveBatchInvoiceCheck(finalize=false){
  const item=queueItem(reviewInvoiceKey);if(!item?.recognized||!isBatchInvoice(item.invoice))return;
  const inv=item.invoice,existing=findExistingCheckByInvoice(inv),counts=batchCounts(inv);
  const record={
    id:existing?.id||("CHK-"+Date.now()),invoice:inv.invoice,provider:inv.provider,date:deDate(inv.invoiceDate),
    zip:"",transport:"Sammelrechnung",expected:inv.netTotal,actual:inv.netTotal,diff:0,
    status:counts.unmatched?"unmatched":counts.clarification?"clarification":counts.pending?"pending":(counts.over||counts.under)?"diff":"ok",
    operation:"Sammelrechnung",priceSource:"positionen",priceSourceNote:`${inv.positions.length} Rechnungspositionen`,
    sourceFile:inv.sourceFile,positionCount:inv.positions.length,batchCounts:counts,netTotal:inv.netTotal,vatAmount:inv.vatAmount,grossTotal:inv.grossTotal,
    positions:inv.positions.map(p=>{const st=batchPositionState(p,inv.provider);return {...p,matchOperation:st.op?.id||"",expected:st.expected,diff:st.diff,lineStatus:st.status}}),
    createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()
  };
  if(existing)checks=checks.map(c=>c.id===existing.id?record:c);else checks.unshift(record);
  save();renderChecks();renderInvoiceQueue();renderBatchRows();
  showToast(finalize?"Sammelrechnung wurde gespeichert.":"Prüfstand wurde gespeichert.");
}
function queueStats(){
  return {
    files:invoiceQueue.length,
    recognized:invoiceQueue.filter(x=>x.recognized).length,
    ready:invoiceQueue.filter(x=>{
      if(!x.recognized||!providerExists(x.invoice.provider))return false;
      if(isBatchInvoice(x.invoice))return x.invoice.positions.some(p=>!!findOperationForBatchPosition(p,x.invoice.provider));
      return !!findOperationForRecognized(x.invoice);
    }).length,
    review:invoiceQueue.filter(x=>!x.recognized||!providerExists(x.invoice?.provider)).length
  };
}
function escapeInvoice(v=""){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function fmtInvoice(v,d=0){return new Intl.NumberFormat("de-DE",{maximumFractionDigits:d}).format(Number(v)||0)}
function queueItem(key){return invoiceQueue.find(x=>x.key===key)||null}
function renderInvoiceQueue(){
  const s=queueStats();
  document.getElementById("invoiceQueueCount").textContent=s.files;
  document.getElementById("invoiceRecognizedCount").textContent=s.recognized;
  document.getElementById("invoiceReadyCount").textContent=s.ready;
  document.getElementById("invoiceReviewCount").textContent=s.review;
  const list=document.getElementById("invoiceRecognitionList");
  if(!invoiceQueue.length){list.innerHTML='<div class="invoice-empty-workspace">Noch keine Rechnung geladen.</div>';return}
  list.innerHTML=invoiceQueue.map(item=>{
    if(!item.recognized)return `<article class="invoice-queue-card review"><div class="invoice-queue-main"><div><span class="modal-eyebrow">Review</span><h3>${escapeInvoice(item.fileName)}</h3></div><span class="status-pill review">Format unbekannt</span></div><p>Für dieses Rechnungsformat ist noch kein Parser hinterlegt. Bitte manuell erfassen.</p><div class="invoice-queue-actions"><button class="secondary compact-button" type="button" data-open-manual="${escapeInvoice(item.key)}">Manuell erfassen</button></div></article>`;
    const inv=item.invoice,existing=findExistingCheckByInvoice(inv),known=providerExists(inv.provider);
    if(isBatchInvoice(inv)){
      const counts=batchCounts(inv),state=existing?"Bereits geprüft":!known?"Dienstleister fehlt":batchOverallStatus(inv);
      return `<article class="invoice-queue-card invoice-queue-card-batch" data-invoice-key="${escapeInvoice(item.key)}">
        <div class="invoice-queue-main"><div><span class="modal-eyebrow">${escapeInvoice(inv.provider)}</span><h3>Rechnung ${escapeInvoice(inv.invoice)}</h3><p>${inv.positions.length} Positionen · Netto ${euro2(inv.netTotal)} · Gesamt ${euro2(inv.grossTotal)}</p></div><span class="status-pill ${existing?"active":!known?"future":"active"}">${state}</span></div>
        <div class="invoice-batch-mini"><span class="ok">OK <b>${counts.ok}</b></span><span class="over">Zu hoch <b>${counts.over}</b></span><span class="under">Zu niedrig <b>${counts.under}</b></span><span class="pending">Nicht geprüft <b>${counts.pending}</b></span><span class="unmatched">Nicht zugeordnet <b>${counts.unmatched}</b></span></div>
        ${!known?`<div class="invoice-queue-notice warning">Dienstleister „${escapeInvoice(inv.provider)}“ ist noch nicht in den Stammdaten angelegt.</div>`:""}
        <div class="invoice-queue-actions">${!known?`<button class="secondary compact-button" type="button" data-create-provider="${escapeInvoice(item.key)}">+ Dienstleister anlegen</button>`:""}<button class="primary compact-button" type="button" data-review-batch="${escapeInvoice(item.key)}">${existing?"Prüfung öffnen":"Positionen prüfen"}</button></div>
      </article>`;
    }
    const op=findOperationForRecognized(inv);
    const state=existing?(op?"Bereits geprüft":"Prüfung vorhanden · Vorgang fehlt"):!known?"Dienstleister fehlt":op?"Prüfbereit":"Vorgang fehlt";
    const stateClass=existing&&op?"active":(!known||!op)?"future":"active";
    return `<article class="invoice-queue-card" data-invoice-key="${escapeInvoice(item.key)}">
      <div class="invoice-queue-main">
        <div><span class="modal-eyebrow">${escapeInvoice(inv.provider)}</span><h3>Rechnung ${escapeInvoice(inv.invoice)}</h3><p>${escapeInvoice(inv.originCountry)} ${escapeInvoice(inv.originPostal)} → ${escapeInvoice(inv.destCountry)} ${escapeInvoice(inv.destPostal)} · ${escapeInvoice(inv.shipmentNumber)}</p></div>
        <span class="status-pill ${stateClass}">${state}</span>
      </div>
      <div class="invoice-queue-facts">
        <span><small>Referenz</small><strong>${escapeInvoice(inv.externalReference)}</strong></span>
        <span><small>Grundfracht</small><strong>${euro2(inv.freight)}</strong></span>
        <span><small>Zuschlag</small><strong>${euro2(inv.surchargeAmount)}</strong></span>
        <span><small>Gesamt</small><strong>${euro2(inv.total)}</strong></span>
      </div>
      ${existing?`<div class="invoice-queue-notice ${op?"success":"warning"}">${op?`Prüfung ${escapeInvoice(existing.id)} ist gespeichert und mit einem Vorgang verknüpft.`:`Prüfung ${escapeInvoice(existing.id)} ist gespeichert, aber noch keinem Vorgang zugeordnet. Sie kann geöffnet, korrigiert und nachträglich verknüpft werden.`}</div>`:""}
      ${!known?`<div class="invoice-queue-notice warning">Dienstleister „${escapeInvoice(inv.provider)}“ ist noch nicht in den Stammdaten angelegt.</div>`:""}
      ${known&&!op?`<div class="invoice-queue-notice warning">Kein passender Vorgang gefunden. Die Preisprüfung kann bestehen, die operative Zuordnung ist aber noch offen.</div>`:""}
      ${op?`<div class="invoice-queue-notice success">Vorgang gefunden: ${escapeInvoice(op.id)} · Soll ${euro2(op.price||0)}</div>`:""}
      <div class="invoice-queue-actions">
        ${!known?`<button class="secondary compact-button" type="button" data-create-provider="${escapeInvoice(item.key)}">+ Dienstleister anlegen</button>`:""}
        ${known&&!op?`<button class="secondary compact-button" type="button" data-create-operation="${escapeInvoice(item.key)}">+ Vorgang anlegen / zuordnen</button>`:""}
        <button class="primary compact-button" type="button" data-review-invoice="${escapeInvoice(item.key)}">${existing?"Prüfung öffnen":"In Prüfung übernehmen"}</button>
      </div>
    </article>`;
  }).join("");
  bindQueueActions();
}
function bindQueueActions(){
  document.querySelectorAll("[data-review-invoice]").forEach(b=>b.addEventListener("click",()=>openRecognizedReview(b.dataset.reviewInvoice)));
  document.querySelectorAll("[data-review-batch]").forEach(b=>b.addEventListener("click",()=>openBatchReview(b.dataset.reviewBatch)));
  document.querySelectorAll("[data-create-operation]").forEach(b=>b.addEventListener("click",()=>openInvoiceOperationModalFor(b.dataset.createOperation)));
  document.querySelectorAll("[data-create-provider]").forEach(b=>b.addEventListener("click",()=>openInvoiceProviderModalFor(b.dataset.createProvider)));
  document.querySelectorAll("[data-open-manual]").forEach(b=>b.addEventListener("click",()=>setInvoiceMode("manual")));
}
function setInvoiceMode(mode){
  document.querySelectorAll("[data-invoice-mode]").forEach(b=>b.classList.toggle("active",b.dataset.invoiceMode===mode));
  document.getElementById("invoiceUploadMode").hidden=mode!=="upload";
  document.getElementById("invoiceManualMode").hidden=mode!=="manual";
}
function openRecognizedReview(key){
  const item=queueItem(key);if(!item?.recognized)return;
  const inv=item.invoice;
  if(!providerExists(inv.provider)){showToast(`Bitte zuerst Dienstleister ${inv.provider} anlegen.`);openInvoiceProviderModalFor(key);return}
  reviewInvoiceKey=key;
  const op=findOperationForRecognized(inv),existing=findExistingCheckByInvoice(inv),tariff=findTariffForRecognized(inv);
  const ws=document.getElementById("invoiceReviewWorkspace");
  ws.hidden=false;
  document.getElementById("invoiceReviewTitle").textContent=`Rechnung ${inv.invoice} prüfen`;
  document.getElementById("invoiceReviewSubtitle").textContent=`${inv.provider} · ${inv.externalReference} · Sendung ${inv.shipmentNumber}`;
  document.getElementById("invoiceReviewIdentity").innerHTML=`<div><span>Vorgang</span><strong>${escapeInvoice(op?.id||"Nicht zugeordnet")}</strong></div><div><span>Relation</span><strong>${inv.originCountry} ${inv.originPostal} → ${inv.destCountry} ${inv.destPostal}</strong></div><div><span>LDM / Stellplätze</span><strong>${fmtInvoice(inv.ldm,2)} LDM${inv.slots?` · ${inv.slots} SP`:""}</strong></div><div><span>Datei</span><strong>${escapeInvoice(inv.sourceFile)}</strong></div>`;
  document.getElementById("invoiceActualBreakdown").innerHTML=`<div><span>Grundfracht</span><strong>${euro2(inv.freight)}</strong></div><div><span>${escapeInvoice(inv.surchargeName||"Zuschlag")}</span><strong>${euro2(inv.surchargeAmount)}${inv.surchargePercent?` · ${inv.surchargePercent}%`:""}</strong></div><div class="total"><span>Rechnung gesamt</span><strong>${euro2(inv.total)}</strong></div>`;
  const priceSource=document.getElementById("reviewPriceSource"),expected=document.getElementById("reviewExpectedAmount"),note=document.getElementById("reviewPriceSourceNote");
  const bookingPrice=Number(op?.price);
  if(existing){
    priceSource.value=existing.priceSource||"manual";expected.value=Number(existing.expected||0).toFixed(2);note.value=existing.priceSourceNote||"";
  }else if(Number.isFinite(bookingPrice)&&bookingPrice>0){
    priceSource.value="booking";expected.value=bookingPrice.toFixed(2);note.value=`Vorgang ${op.id}`;
  }else if(tariff){
    priceSource.value="tariff";expected.value=Number(tariff.price||0).toFixed(2);note.value="Tarif / Ratenblatt";
  }else{
    priceSource.value="phone";expected.value="";note.value="";
  }
  document.getElementById("openLinkedOperationBtn").hidden=!op;
  document.getElementById("saveRecognizedCheckBtn").textContent=existing?"Prüfung aktualisieren":"Prüfung speichern";
  renderReviewEvidence();renderReviewResult();
  ws.scrollIntoView({behavior:"smooth",block:"start"});
}
function renderReviewEvidence(){
  const item=queueItem(reviewInvoiceKey);if(!item?.recognized)return;
  const inv=item.invoice,op=findOperationForRecognized(inv),tariff=findTariffForRecognized(inv),source=document.getElementById("reviewPriceSource").value;
  let text="";
  if(source==="booking")text=op?`Buchung ${op.id} · gespeicherter Preis ${euro2(op.price||0)}`:"Kein Buchungsvorgang vorhanden.";
  if(source==="tariff")text=tariff?`Passender Tarifdatensatz gefunden · ${euro2(tariff.price||0)}`:"Kein passendes Ratenblatt gefunden. Bitte andere Sollpreisquelle wählen.";
  if(source==="phone")text="Telefonische Preisvereinbarung: Betrag und Nachweis/Notiz manuell dokumentieren.";
  if(source==="manual")text="Manueller Sollpreis: Betrag und Herkunft im Notizfeld dokumentieren.";
  document.getElementById("invoiceSourceEvidence").textContent=text;
}
function renderReviewResult(){
  const item=queueItem(reviewInvoiceKey);if(!item?.recognized)return;
  const actual=Number(item.invoice.total||0),expected=Number(document.getElementById("reviewExpectedAmount").value||0),diff=Math.round((actual-expected)*100)/100,pct=expected?diff/expected*100:0;
  const status=!expected?"unmatched":Math.abs(diff)<=PRICE_EPSILON?"ok":diff>0?"over":"under";
  const el=document.getElementById("invoiceReviewResult");el.className=`invoice-review-result ${status}`;
  el.innerHTML=`<div><span>Soll</span><strong>${expected?euro2(expected):"—"}</strong></div><div><span>Ist</span><strong>${euro2(actual)}</strong></div><div><span>Abweichung</span><strong>${expected?`${diff>0?"+":""}${euro2(diff)} · ${pct>0?"+":""}${fmtInvoice(pct,1)}%`:"Sollpreis fehlt"}</strong></div><div><span>Status</span><strong>${status==="over"||status==="under"?"Abweichung":statusLabel(status)}</strong></div>`;
}
function saveRecognizedReview(){
  const item=queueItem(reviewInvoiceKey);if(!item?.recognized)return;
  const inv=item.invoice;
  if(!providerExists(inv.provider)){showToast("Dienstleister muss zuerst in den Stammdaten angelegt werden.");return}
  const expected=Number(document.getElementById("reviewExpectedAmount").value||0);
  if(!(expected>0)){showToast("Bitte einen Sollpreis eintragen.");return}
  const source=document.getElementById("reviewPriceSource").value,note=document.getElementById("reviewPriceSourceNote").value.trim();
  const documentedNote=note||({phone:"Telefonische Preisvereinbarung",manual:"Manuell hinterlegter Sollpreis"}[source]||"");
  const op=findOperationForRecognized(inv),actual=Number(inv.total||0),diff=Math.round((actual-expected)*100)/100,existing=findExistingCheckByInvoice(inv);
  const record={
    id:existing?.id||("CHK-"+Date.now()),invoice:inv.invoice,provider:inv.provider,date:deDate(inv.deliveryDate||inv.invoiceDate),
    zip:inv.destPostal,transport:inv.transport,expected:Math.round(expected*100)/100,actual:Math.round(actual*100)/100,diff,
    basePrice:inv.freight,floaterPercent:inv.surchargePercent||0,floaterAmount:inv.surchargeAmount||0,ancillaryAmount:inv.surchargeAmount||0,
    status:Math.abs(diff)<=PRICE_EPSILON?"ok":"diff",varianceDirection:Math.abs(diff)<=PRICE_EPSILON?"equal":diff>0?"over":"under",operation:op?.id||"—",priceSource:source,priceSourceNote:documentedNote,
    externalReference:inv.externalReference,shipmentNumber:inv.shipmentNumber,sourceFile:inv.sourceFile,
    createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()
  };
  if(existing)checks=checks.map(c=>c.id===existing.id?record:c);else checks.unshift(record);
  save();
  if(op){
    const ops=GPK.read(GPK.KEYS.operations,[])||[];
    GPK.write(GPK.KEYS.operations,ops.map(o=>o.id===op.id?{...o,invoiceStatus:record.status,invoiceDirection:record.varianceDirection,invoiceNumber:inv.invoice,invoiceCheckId:record.id}:o));
  }
  renderChecks();renderInvoiceQueue();openRecognizedReview(reviewInvoiceKey);
  showToast(existing?"Prüfung wurde aktualisiert.":"Rechnung wurde geprüft und gespeichert.");
}
function openInvoiceProviderModalFor(key){
  const item=queueItem(key);if(!item?.recognized)return;
  activeRecognizedKey=key;const inv=item.invoice;
  document.getElementById("invoiceProviderName").value=inv.provider||"";
  document.getElementById("invoiceProviderAlias").value=(inv.provider||"").replace(/[^A-Za-z0-9]/g,"").slice(0,2).toUpperCase();
  document.getElementById("invoiceProviderCountry").value=inv.originCountry||(isBatchInvoice(inv)?"DE":"");
  document.getElementById("invoiceProviderStreet").value="";document.getElementById("invoiceProviderZip").value="";document.getElementById("invoiceProviderCity").value="";
  document.getElementById("invoiceProviderNotes").value=`Aus Rechnungsimport ${inv.invoice} angelegt.`;
  document.getElementById("invoiceProviderModal").hidden=false;document.body.classList.add("modal-open");
}
function closeInvoiceProviderModal(){document.getElementById("invoiceProviderModal").hidden=true;document.body.classList.remove("modal-open")}
function saveInvoiceProvider(event){
  event.preventDefault();
  const name=document.getElementById("invoiceProviderName").value.trim();if(!name)return;
  if(providerExists(name)){closeInvoiceProviderModal();renderInvoiceQueue();return}
  const providers=GPK.read(GPK.KEYS.providers,[])||[],maxId=providers.reduce((m,p)=>Math.max(m,Number(p.id)||0),0);
  const provider={
    id:maxId+1,name,alias:document.getElementById("invoiceProviderAlias").value.trim()||name.slice(0,2).toUpperCase(),status:"active",
    street:document.getElementById("invoiceProviderStreet").value.trim(),zip:document.getElementById("invoiceProviderZip").value.trim(),city:document.getElementById("invoiceProviderCity").value.trim(),
    country:document.getElementById("invoiceProviderCountry").value.trim().toUpperCase(),rates:0,floater:"",logo:"",notes:document.getElementById("invoiceProviderNotes").value.trim(),
    contacts:[],createdAt:new Date().toISOString(),createdBy:"Lokale Demo"
  };
  if(!GPK.write(GPK.KEYS.providers,[...providers,provider])){showToast("Dienstleister konnte nicht gespeichert werden.");return}
  closeInvoiceProviderModal();renderInvoiceQueue();showToast(`Dienstleister ${name} wurde in den Stammdaten angelegt.`);
}
function openInvoiceOperationModalFor(key){
  const item=queueItem(key);if(!item?.recognized)return;
  activeRecognizedKey=key;const inv=item.invoice,existing=findOperationForRecognized(inv);
  if(existing){showToast(`Vorgang ${existing.id} existiert bereits.`);renderInvoiceQueue();return}
  document.getElementById("newOpReference").value=inv.externalReference||"";
  document.getElementById("newOpShipment").value=inv.shipmentNumber||"";
  document.getElementById("newOpProvider").value=inv.provider||"";
  document.getElementById("newOpRelation").value=`${inv.originCountry} ${inv.originPostal} ${inv.originCity||""} → ${inv.destCountry} ${inv.destPostal} ${inv.destCity||""}`.replace(/\s+/g," ").trim();
  document.getElementById("newOpPickup").value=inv.pickupDate||"";document.getElementById("newOpDelivery").value=inv.deliveryDate||"";
  document.getElementById("newOpLdm").value=inv.ldm??"";document.getElementById("newOpSlots").value=inv.slots??"";
  document.getElementById("newOpTransport").value=inv.transport||"FTL";document.getElementById("newOpExpected").value="";
  document.getElementById("newOpBase").value="";document.getElementById("newOpAncillary").value="";
  document.getElementById("newOpNote").value=`Aus Rechnung ${inv.invoice} angelegt · Referenz ${inv.externalReference} · Sendung ${inv.shipmentNumber}`;
  document.getElementById("invoiceOperationSource").innerHTML=`<strong>${escapeInvoice(inv.provider)} · Rechnung ${escapeInvoice(inv.invoice)}</strong><span>Rechnung Ist ${euro2(inv.total)} · Sollpreis bitte aus Buchung, Telefonvereinbarung oder Angebot eintragen.</span>`;
  document.getElementById("invoiceOperationModal").hidden=false;document.body.classList.add("modal-open");
}
function closeInvoiceOperationModal(){document.getElementById("invoiceOperationModal").hidden=true;document.body.classList.remove("modal-open")}
function saveOperationFromRecognized(event){
  event.preventDefault();
  const item=queueItem(activeRecognizedKey);if(!item?.recognized)return;
  const inv=item.invoice,existing=findOperationForRecognized(inv);
  if(existing){closeInvoiceOperationModal();showToast(`Vorgang ${existing.id} existiert bereits. Es wurde kein Duplikat angelegt.`);renderInvoiceQueue();return}
  if(!providerExists(inv.provider)){showToast("Dienstleister muss zuerst angelegt werden.");return}
  const expected=Number(document.getElementById("newOpExpected").value||0);
  if(!(expected>0)){showToast("Bitte den vereinbarten Soll-/Buchungspreis eintragen.");return}
  const op={
    id:makeInvoiceOperationId(inv),type:"booking",status:"closed",relation:document.getElementById("newOpRelation").value,provider:inv.provider,
    price:Math.round(expected*100)/100,basePrice:Math.round(Number(document.getElementById("newOpBase").value||expected)*100)/100,
    ancillaryAmount:Math.round(Number(document.getElementById("newOpAncillary").value||0)*100)/100,floaterAmount:0,floaterPercent:0,
    date:deDate(inv.deliveryDate),pickupDate:inv.pickupDate,delivery:inv.deliveryDate,deliveryDate:inv.deliveryDate,
    created:new Date().toLocaleDateString("de-DE")+" · "+new Date().toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"}),
    createdAt:new Date().toISOString(),user:currentInvoiceUser(),transport:document.getElementById("newOpTransport").value,customer:inv.recipient||"",
    note:document.getElementById("newOpNote").value,externalReference:inv.externalReference,shipmentNumber:inv.shipmentNumber,invoiceNumber:inv.invoice,
    invoiceActual:inv.total,invoiceFreight:inv.freight,invoiceSurchargeAmount:inv.surchargeAmount,invoiceSurchargeName:inv.surchargeName,invoiceStatus:"pending",
    originName:inv.originName,originCountry:inv.originCountry,originPostal:inv.originPostal,destCountry:inv.destCountry,destPostal:inv.destPostal,
    ldm:Number(document.getElementById("newOpLdm").value||0),slots:Number(document.getElementById("newOpSlots").value||0),weight:Number(inv.weight||0),priceSource:"manual/phone"
  };
  const ops=GPK.read(GPK.KEYS.operations,[])||[];
  if(!GPK.write(GPK.KEYS.operations,[op,...ops])){showToast("Vorgang konnte nicht gespeichert werden.");return}
  const oldCheck=findExistingCheckByInvoice(inv);
  if(oldCheck){checks=checks.map(c=>c.id===oldCheck.id?{...c,operation:op.id,updatedAt:new Date().toISOString()}:c);save();renderChecks();}
  closeInvoiceOperationModal();renderInvoiceQueue();openRecognizedReview(item.key);showToast(`Vorgang ${op.id} angelegt und mit der Rechnung verknüpft.`);
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

/* v6.61: Prüfungen dürfen nicht "verschwinden", wenn ein früherer Build zwar
   den Vorgang mit Rechnungsdaten aktualisiert hat, aber der separate Check-
   Datensatz fehlte. In diesem Fall wird die Prüfung aus dem verknüpften
   Vorgang rekonstruiert. Bestehende Prüfungen haben immer Vorrang. */
function reconcileChecksFromOperations(){
  const ops=GPK.read(GPK.KEYS.operations,[])||[];
  if(!Array.isArray(ops))return;
  const existingInvoices=new Set(checks.map(c=>String(c.invoice||'').trim().toLowerCase()).filter(Boolean));
  let changed=false;
  ops.forEach(o=>{
    const invoice=String(o.invoiceNumber||'').trim();
    if(!invoice||existingInvoices.has(invoice.toLowerCase()))return;
    const actual=Number(o.invoiceActual);
    const expected=Number(o.price);
    const explicitStatus=String(o.invoiceStatus||'').trim();
    if(!Number.isFinite(actual)||actual<=0||!Number.isFinite(expected)||expected<=0)return;
    if(!explicitStatus||explicitStatus==='pending'||explicitStatus==='unmatched')return;
    const diff=Math.round((actual-expected)*100)/100;
    const status=Math.abs(diff)<=PRICE_EPSILON?'ok':explicitStatus==='clarification'?'clarification':'diff';
    checks.unshift({
      id:o.invoiceCheckId||`CHK-REC-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
      invoice,provider:o.provider||'Unbekannt',date:deDate(o.deliveryDate||o.delivery||o.date),
      zip:relationZip(o),transport:o.transport||'',expected,actual,diff,status,operation:o.id||'—',
      varianceDirection:Math.abs(diff)<=PRICE_EPSILON?'equal':diff>0?'over':'under',
      priceSource:o.priceSource||'booking',priceSourceNote:`Aus Vorgang ${o.id||''} rekonstruiert`,
      externalReference:o.externalReference||'',shipmentNumber:o.shipmentNumber||'',
      createdAt:o.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),recovered:true
    });
    existingInvoices.add(invoice.toLowerCase());changed=true;
  });
  if(changed)GPK.write(GPK.KEYS.invoiceChecks,checks);
}
reconcileChecksFromOperations();
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
    <td><strong class="${c.diff>PRICE_EPSILON?"invoice-diff-over":c.diff<-PRICE_EPSILON?"invoice-diff-under":"invoice-diff-zero"}">${c.diff?((c.diff>0?"+":"")+euro(c.diff)):c.status==="unmatched"?"—":"0 €"}</strong></td>
    <td><span class="status-pill ${c.status==="ok"?"active":c.status==="diff"?(Number(c.diff)>0?"invoice-status-over":"invoice-status-under"):c.status==="clarification"?"review":"inactive"}">${statusLabel(c.status)}</span></td>
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
  setInvoiceMode("manual");
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
  const duplicate=!existing?checks.find(c=>String(c.invoice||"").trim().toLowerCase()===String(invNumber.value||"").trim().toLowerCase()):null;
  if(duplicate){showToast(`Rechnung ${invNumber.value.trim()} ist bereits als Prüfung ${duplicate.id} vorhanden.`);startCheckEdit(duplicate);return;}
  const c={
    id:existing?.id||("CHK-"+Date.now()),
    invoice:invNumber.value.trim(),
    provider,date:deDate(date),zip,transport,
    expected:Math.round(expected*100)/100,actual:Math.round(actual*100)/100,diff:Math.round(diff*100)/100,
    basePrice:Math.round(base*100)/100,floaterPercent:Number(floater.value)||0,floaterAmount:Math.round(floaterAmount*100)/100,
    ancillaryAmount:Math.round(storedAncillary*100)/100,
    status,varianceDirection:Math.abs(diff)<=PRICE_EPSILON?"equal":diff>0?"over":"under",operation:invOperation.value.trim()||"—",
    createdAt:existing?.createdAt||new Date().toISOString(),
    updatedAt:new Date().toISOString()
  };
  if(existing){checks=checks.map(x=>x.id===editingCheckId?c:x);}
  else checks.unshift(c);
  save();renderChecks();
  showToast(existing?"Rechnungsprüfung wurde aktualisiert.":"Rechnungsprüfung wurde gespeichert.");
  endCheckEdit();
});

document.querySelectorAll("[data-invoice-mode]").forEach(btn=>btn.addEventListener("click",()=>setInvoiceMode(btn.dataset.invoiceMode)));
chooseInvoiceBtn.addEventListener("click",()=>invoiceFileInput.click());
invoiceFileInput.addEventListener("change",()=>{if(invoiceFileInput.files?.length)mergeInvoiceFiles(invoiceFileInput.files)});
invoiceDropzone.addEventListener("dragover",e=>{e.preventDefault();invoiceDropzone.classList.add("dragging")});
invoiceDropzone.addEventListener("dragleave",()=>invoiceDropzone.classList.remove("dragging"));
invoiceDropzone.addEventListener("drop",e=>{e.preventDefault();invoiceDropzone.classList.remove("dragging");if(e.dataTransfer.files?.length)mergeInvoiceFiles(e.dataTransfer.files)});
document.getElementById("reviewPriceSource").addEventListener("change",()=>{
  const item=queueItem(reviewInvoiceKey),op=item?.recognized?findOperationForRecognized(item.invoice):null,tariff=item?.recognized?findTariffForRecognized(item.invoice):null;
  if(reviewPriceSource.value==="booking"&&op)reviewExpectedAmount.value=Number(op.price||0).toFixed(2);
  if(reviewPriceSource.value==="tariff"&&tariff)reviewExpectedAmount.value=Number(tariff.price||0).toFixed(2);
  renderReviewEvidence();renderReviewResult();
});
reviewExpectedAmount.addEventListener("input",renderReviewResult);
saveRecognizedCheckBtn.addEventListener("click",saveRecognizedReview);
closeInvoiceReviewBtn.addEventListener("click",()=>{invoiceReviewWorkspace.hidden=true;reviewInvoiceKey=""});
closeBatchReviewBtn.addEventListener("click",()=>{invoiceBatchReviewWorkspace.hidden=true;reviewInvoiceKey=""});
saveBatchDraftBtn.addEventListener("click",()=>saveBatchInvoiceCheck(false));
saveBatchCheckBtn.addEventListener("click",()=>saveBatchInvoiceCheck(true));
openLinkedOperationBtn.addEventListener("click",()=>{
  const item=queueItem(reviewInvoiceKey),op=item?.recognized?findOperationForRecognized(item.invoice):null;
  if(op)location.href=`vorgaenge.html?operation=${encodeURIComponent(op.id)}`;
});
invoiceProviderForm.addEventListener("submit",saveInvoiceProvider);
closeInvoiceProviderModal.addEventListener("click",closeInvoiceProviderModal);
cancelInvoiceProviderModal.addEventListener("click",closeInvoiceProviderModal);
invoiceProviderModal.addEventListener("click",e=>{if(e.target===invoiceProviderModal)closeInvoiceProviderModal()});
invoiceOperationForm.addEventListener("submit",saveOperationFromRecognized);
closeInvoiceOperationModal.addEventListener("click",closeInvoiceOperationModal);
cancelInvoiceOperationModal.addEventListener("click",closeInvoiceOperationModal);
invoiceOperationModal.addEventListener("click",e=>{if(e.target===invoiceOperationModal)closeInvoiceOperationModal()});
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
renderInvoiceQueue();

(function(){const op=new URLSearchParams(location.search).get("operation");if(op)prefillFromOperation(op);})();
