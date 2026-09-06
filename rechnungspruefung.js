
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

function euro(n){return new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(Number(n)||0);}
function showToast(text){
  toastEl.textContent=text;toastEl.hidden=false;clearTimeout(showToast.timer);
  showToast.timer=setTimeout(()=>toastEl.hidden=true,2400);
}
function save(){try{GPK.write(GPK.KEYS.invoiceChecks,checks)}catch(_){}}
function statusLabel(s){return ({ok:"OK",diff:"Abweichung",unmatched:"Nicht zugeordnet"})[s]||s;}
function renderChecks(){
  const q=search.value.trim().toLowerCase(), sf=statusFilter.value;
  const filtered=checks.filter(c=>{
    const hay=`${c.invoice} ${c.provider} ${c.operation}`.toLowerCase();
    return (!q||hay.includes(q))&&(!sf||c.status===sf);
  });
  rows.innerHTML=filtered.map(c=>`<tr>
    <td><strong class="table-main">${c.invoice}</strong><small>${c.id}</small></td>
    <td><strong class="table-main">${c.provider}</strong><small>${c.operation||"—"}</small></td>
    <td>${c.date}</td>
    <td><strong class="price-cell">${euro(c.expected)}</strong></td>
    <td><strong class="price-cell">${c.actual?euro(c.actual):"—"}</strong></td>
    <td><strong class="${c.diff>0?"invoice-diff-pos":"invoice-diff-zero"}">${c.diff?("+"+euro(c.diff)):c.status==="unmatched"?"—":"0 €"}</strong></td>
    <td><span class="status-pill ${c.status==="ok"?"active":c.status==="diff"?"future":"inactive"}">${statusLabel(c.status)}</span></td>
    <td class="row-actions"><button class="icon-button" title="Details">›</button></td>
  </tr>`).join("");
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

manualInvoiceForm.addEventListener("submit",e=>{
  e.preventDefault();
  const provider=invProvider.value, date=invDate.value, zip=invZip.value.trim(), transport=invTransport.value;
  const actual=Number(invAmount.value||0);
  const tariff=findLocalTariff(provider,zip,transport);
  if(!tariff){
    showToast("Kein passender Tarif gefunden.");
    return;
  }
  const floater=findFloater(provider,date,tariff.floater);
  const expected=Number(tariff.base||0)*(1+Number(floater.value||0)/100);
  const diff=actual-expected;
  const status=Math.abs(diff)<=2 ? "ok" : "diff";

  resultInvoiceAmount.textContent=euro(actual);
  resultBase.textContent=euro(tariff.base);
  resultFloater.textContent=Number(floater.value).toLocaleString("de-DE")+" %";
  resultFloaterPeriod.textContent=`${deDate(floater.from)} – ${deDate(floater.to)}`;
  resultExpected.textContent=euro(expected);
  resultDifference.textContent=(diff>0?"+":"")+euro(diff);
  resultHeadline.textContent=status==="ok"?"Rechnung stimmt mit Sollpreis überein":"Abweichung festgestellt";
  resultStatusPill.textContent=status==="ok"?"OK":"Abweichung";
  resultStatusPill.className="status-pill "+(status==="ok"?"active":"future");
  resultMeta.textContent=`${provider} · ${transport} · Ziel PLZ ${zip} · Transportdatum ${deDate(date)}${invOperation.value.trim()?" · Vorgang "+invOperation.value.trim():""}`;
  invoiceResultCard.hidden=false;

  const c={
    id:"CHK-"+Date.now(),
    invoice:invNumber.value.trim(),
    provider,date:deDate(date),
    expected:Math.round(expected),actual:Math.round(actual),diff:Math.round(diff),
    status,operation:invOperation.value.trim()||"—",createdAt:new Date().toISOString()
  };
  checks.unshift(c);save();renderChecks();
  showToast("Rechnungsprüfung wurde gespeichert.");
});

chooseInvoiceBtn.addEventListener("click",()=>invoiceFileInput.click());
invoiceFileInput.addEventListener("change",()=>{
  if(invoiceFileInput.files?.[0]){
    showToast(`${invoiceFileInput.files[0].name} ausgewählt. Automatische Erkennung kommt später.`);
  }
});
invoiceDropzone.addEventListener("dragover",e=>{e.preventDefault();invoiceDropzone.classList.add("dragging")});
invoiceDropzone.addEventListener("dragleave",()=>invoiceDropzone.classList.remove("dragging"));
invoiceDropzone.addEventListener("drop",e=>{
  e.preventDefault();invoiceDropzone.classList.remove("dragging");
  if(e.dataTransfer.files?.[0])showToast(`${e.dataTransfer.files[0].name} abgelegt. Automatische Erkennung kommt später.`);
});
[statusFilter,search].forEach(x=>x.addEventListener("input",renderChecks));
exportChecksBtn.addEventListener("click",()=>showToast("Export der Prüfungen wird im nächsten technischen Schritt angebunden."));
renderChecks();
