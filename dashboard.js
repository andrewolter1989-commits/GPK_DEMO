
const periodData = {
  "30": {calc:124,book:41,avg:"1.086 €",save:"8.740 €",open:9,invoice:"1,9 %"},
  "90": {calc:361,book:118,avg:"1.102 €",save:"23.480 €",open:14,invoice:"2,1 %"},
  "365": {calc:1486,book:497,avg:"1.119 €",save:"91.360 €",open:22,invoice:"2,4 %"}
};
const select = document.getElementById("periodSelect");
const toast = document.getElementById("dashboardToast");

function readStore(key){
  try{const x=JSON.parse(localStorage.getItem(key)||"[]");return Array.isArray(x)?x:[];}catch(_){return [];}
}
function withinDays(item, days){
  if(!item.createdAt) return true;
  const age=(Date.now()-new Date(item.createdAt).getTime())/86400000;
  return age<=Number(days);
}
function applyPeriod(){
  const d = periodData[select.value];
  const calculations=GPK.read(GPK.KEYS.calculations, []).filter(x=>withinDays(x,select.value));
  const operations=GPK.read(GPK.KEYS.operations, []).filter(x=>withinDays(x,select.value));
  const bookings=operations.filter(x=>x.type==="booking");
  const openOps=operations.filter(x=>x.status==="open"||x.status==="waiting");
  const avgExtra=calculations.length?calculations.reduce((s,x)=>s+Number(x.price||0),0)/calculations.length:0;
  const savingsExtra=calculations.reduce((s,x)=>s+Number(x.saving||0),0);
  const calcTotal=d.calc+calculations.length;
  const bookingTotal=d.book+bookings.length;
  const avgDisplay=calculations.length
    ? new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(avgExtra)
    : d.avg;
  const saveBase=Number(String(d.save).replace(/[^\d]/g,""))||0;
  const savingDisplay=new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(saveBase+savingsExtra);
  kpiCalculations.textContent = calcTotal;
  kpiBookings.textContent = bookingTotal;
  kpiAvgPrice.textContent = avgDisplay;
  kpiSavings.textContent = savingDisplay;
  kpiOpen.textContent = d.open + openOps.length;
  kpiInvoice.textContent = d.invoice;
}
function showToast(text){
  toast.textContent=text;
  toast.hidden=false;
  clearTimeout(showToast.timer);
  showToast.timer=setTimeout(()=>toast.hidden=true,2200);
}
select.addEventListener("change", applyPeriod);
exportDashboardBtn.addEventListener("click", ()=>showToast("Dashboard-Export wird später als Excel/PDF angebunden."));
applyPeriod();


async function applyBackendDashboard(){
  if(!window.GPKApi || !await GPKApi.health()) return;
  try{
    const d=await GPKApi.request("/dashboard");
    kpiCalculations.textContent=d.calculations;
    kpiBookings.textContent=d.bookings;
    kpiAvgPrice.textContent=GPK.formatEuro(d.avgPrice);
    kpiSavings.textContent=GPK.formatEuro(d.saving);
    kpiOpen.textContent=d.open;
    const invoiceText=d.invoiceChecks ? GPK.formatEuro(d.invoiceDifference) : "0 €";
    kpiInvoice.textContent=invoiceText;
    const small=kpiInvoice.closest(".kpi-card")?.querySelector("small");
    if(small) small.textContent="Abweichung aus gespeicherten Prüfungen";
  }catch(err){ console.warn("Dashboard API",err); }
}
document.addEventListener("gpk:data-ready",applyBackendDashboard);

async function loadBookingUserStats(){if(!bookingUserStatsRows||!window.GPKApi)return;try{const d=await GPKApi.bookingStats();bookingUserStatsRows.innerHTML=d.map(x=>`<tr><td><strong>${x.name}</strong><small>${x.email}</small></td><td><strong>${x.bookings}</strong></td><td>${GPK.formatEuro(x.volume)}</td><td>${GPK.formatEuro(x.avg_price)}</td></tr>`).join("")||'<tr><td colspan="4" class="empty-state">Noch keine Buchungen vorhanden.</td></tr>'}catch(e){bookingUserStatsRows.innerHTML=`<tr><td colspan="4" class="empty-state">${e.message}</td></tr>`}}
document.addEventListener("gpk:user-ready",loadBookingUserStats);document.addEventListener("gpk:data-ready",loadBookingUserStats);
