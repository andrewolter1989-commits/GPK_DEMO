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
const modal=document.getElementById("operationModal");
const detail=document.getElementById("operationDetail");

const labels={price:"Preisanfrage",availability:"Verfügbarkeit",booking:"Buchung"};
const statuses={open:"Offen",waiting:"Warten auf Antwort",confirmed:"Bestätigt",booked:"Gebucht",closed:"Abgeschlossen"};
function esc(v=""){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
function euro(n){return new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(n)}
function render(){
  const q=search.value.trim().toLowerCase(), sf=statusFilter.value, uf=userFilter.value;
  const filtered=operations.filter(o=>{
    const hay=`${o.id} ${o.relation} ${o.provider} ${o.customer} ${o.user} ${o.transport}`.toLowerCase();
    return (!activeType||o.type===activeType)&&(!q||hay.includes(q))&&(!sf||o.status===sf)&&(!uf||o.user===uf);
  });
  openCount.textContent=operations.filter(o=>o.status==="open").length;
  waitingCount.textContent=operations.filter(o=>o.status==="waiting").length;
  bookedCount.textContent=operations.filter(o=>o.status==="booked"||o.status==="confirmed").length;
  weekCount.textContent=operations.length;
  visibleOperationCount.textContent=filtered.length;
  rows.innerHTML=filtered.map(o=>`<tr class="operation-row" data-id="${o.id}">
    <td><div class="operation-id"><strong>${esc(o.id)}</strong><span class="operation-type ${o.type}">${labels[o.type]}</span>${o.createdAt?'<span class="workflow-new">Neu</span>':''}</div><small>${esc(o.created)}</small></td>
    <td><strong class="table-main">${esc(o.relation)}</strong><small>${esc(o.transport)}</small></td>
    <td><div class="provider-name-cell"><div class="provider-avatar">${esc(o.provider.slice(0,2).toUpperCase())}</div><div><strong>${esc(o.provider)}</strong><small>${esc(o.customer)}</small></div></div></td>
    <td><strong class="price-cell total-price">${euro(o.price)}</strong></td>
    <td><span class="operation-status ${o.status}">${statuses[o.status]}</span></td>
    <td><strong class="table-main">${esc(o.date)}</strong><small>Liefertermin</small></td>
    <td><span class="user-chip">${esc(o.user)}</span></td>
    <td class="row-actions"><button class="icon-button" data-open="${o.id}" title="Details">›</button></td>
  </tr>`).join("")||`<tr><td colspan="8" class="empty-state">Keine Vorgänge für diesen Filter gefunden.</td></tr>`;
}
function openOperation(o){
  operationModalTitle.textContent=o.id;
  detail.innerHTML=`
    <div class="operation-summary-grid">
      <div><span>Typ</span><strong>${labels[o.type]}</strong></div><div><span>Status</span><strong>${statuses[o.status]}</strong></div>
      <div><span>Relation</span><strong>${esc(o.relation)}</strong></div><div><span>Transport</span><strong>${esc(o.transport)}</strong></div>
      <div><span>Dienstleister</span><strong>${esc(o.provider)}</strong></div><div><span>Preis</span><strong>${euro(o.price)}</strong></div>
      <div><span>Empfänger</span><strong>${esc(o.customer)}</strong></div><div><span>Liefertermin</span><strong>${esc(o.date)}</strong></div>
    </div>
    <div class="operation-timeline">
      <h3>Verlauf</h3>
      <div class="timeline-item active"><span></span><div><strong>${esc(o.created)}</strong><p>${esc(o.note)}</p></div></div>
      <div class="timeline-item"><span></span><div><strong>Nächster Schritt</strong><p>${o.status==="waiting"?"Antwort des Dienstleisters erfassen.":o.status==="open"?"Verfügbarkeit anfragen oder Buchung starten.":"Status und Referenzen weiterführen."}</p></div></div>
    </div>`;
  modal.hidden=false;document.body.classList.add("modal-open");
}
function closeModal(){modal.hidden=true;document.body.classList.remove("modal-open")}
document.querySelectorAll(".operations-tab").forEach(btn=>btn.addEventListener("click",()=>{
  document.querySelectorAll(".operations-tab").forEach(x=>x.classList.toggle("active",x===btn));activeType=btn.dataset.type;render();
}));
[search,statusFilter,userFilter].forEach(x=>x.addEventListener("input",render));
rows.addEventListener("click",e=>{const btn=e.target.closest("[data-open]");const row=e.target.closest(".operation-row");const id=btn?.dataset.open||row?.dataset.id;if(id){const o=operations.find(x=>x.id===id);if(o)openOperation(o)}});
closeOperationModalBtn.addEventListener("click",closeModal);closeOperationBtn.addEventListener("click",closeModal);modal.addEventListener("click",e=>{if(e.target===modal)closeModal()});
demoActionBtn.addEventListener("click",()=>{const t=document.getElementById("operationToast");t.textContent="Status-Workflow wird beim technischen Schritt angebunden.";t.hidden=false;setTimeout(()=>t.hidden=true,2400)});
render();