
const A = {
  shipments:[],
  operations:GPK.read(GPK.KEYS.operations,[])||[],
  invoices:GPK.read(GPK.KEYS.invoiceChecks,[])||[],
  calculations:GPK.read(GPK.KEYS.calculations,[])||[],
  config:GPK.read(GPK.KEYS.analyticsConfig,{})||{}
};

const CLASS_DEFAULTS={pieceMaxPallets:6,pieceMaxWeight:2500,pieceMaxLdm:2.4,ftlMinPallets:30,ftlMinWeight:20000,ftlMinLdm:11.5};
if(!A.config.transportClassification){
  A.config.transportClassification={...CLASS_DEFAULTS};
  GPK.write(GPK.KEYS.analyticsConfig,A.config);
}

const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const n=v=>{const x=Number(String(v??"").replace(",",".").replace(/[^\d.+-]/g,""));return Number.isFinite(x)?x:null};
const sum=(arr,fn)=>arr.reduce((a,x)=>a+(Number(fn(x))||0),0);
const avg=(arr,fn)=>arr.length?sum(arr,fn)/arr.length:0;
const money=v=>new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(Number(v)||0);
const money2=v=>new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR",minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(v)||0);
const fmt=(v,d=0)=>new Intl.NumberFormat("de-DE",{maximumFractionDigits:d}).format(Number(v)||0);
const pct=v=>`${v>0?"+":""}${fmt(v,1)} %`;
const isoDate=d=>d&&Number.isFinite(d.getTime())?d.toISOString().slice(0,10):"";
const DAY=86400000;

function parseDate(v){
  if(!v)return null;
  if(v instanceof Date)return Number.isFinite(v.getTime())?v:null;
  const s=String(v).trim();
  let m=s.match(/^(\d{4})-(\d{2})-(\d{2})/); if(m)return new Date(+m[1],+m[2]-1,+m[3]);
  m=s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);
  if(m){const y=+m[3]+(m[3].length===2?2000:0);return new Date(y,+m[2]-1,+m[1])}
  const d=new Date(s); return Number.isFinite(d.getTime())?d:null;
}
function dateFromCreated(v){
  if(!v)return null;
  const first=String(v).split("·")[0].trim();return parseDate(first);
}
function parseRelation(rel){
  const s=String(rel||"");
  const p=s.split(/→|->|–>|⇒/).map(x=>x.trim());
  const side=x=>{
    const m=String(x||"").match(/\b([A-Z]{2})\s*[- ]?(\d{2,6})?/i);
    return {country:m?m[1].toUpperCase():"",postal:m?.[2]||"",label:x||""};
  };
  return {origin:side(p[0]),dest:side(p[1]||p[0])};
}
function regionFrom(country,postal,city){
  const c=String(country||"").toUpperCase(),p=String(postal||"").replace(/\D/g,"");
  if(c==="DE"&&p.length>=2)return `DE ${p.slice(0,2)}`;
  if(p.length>=2)return `${c||"—"} ${p.slice(0,2)}`;
  return city?`${c} ${city}`:c||"—";
}
function transportClass(x){
  const raw=String(x.transport||x.service||x.shipmentType||x.product||"").toLowerCase();
  if(/\bftl\b|komplett|full\s*load|mega|jumbo/.test(raw))return "FTL";
  if(/\bltl\b|teillad|part\s*load/.test(raw))return "LTL";
  if(/stückgut|stueckgut|groupage|parcel|paket/.test(raw))return "Stückgut";
  const cfg=A.config.transportClassification||CLASS_DEFAULTS;
  const p=n(x.pallets),w=n(x.weight),l=n(x.ldm),slots=n(x.slots);
  if((p!=null&&p>=cfg.ftlMinPallets)||(w!=null&&w>=cfg.ftlMinWeight)||(l!=null&&l>=cfg.ftlMinLdm)||(slots!=null&&slots>=30))return "FTL";
  if((p!=null&&p>cfg.pieceMaxPallets)||(w!=null&&w>cfg.pieceMaxWeight)||(l!=null&&l>cfg.pieceMaxLdm)||(slots!=null&&slots>6))return "LTL";
  return "Stückgut";
}
function shipmentCost(x){
  const total=n(x.actualTotal);if(total!=null)return total;
  return [x.freight,x.diesel,x.toll,x.otherCharges].reduce((a,v)=>a+(n(v)||0),0);
}
function floaterStatus(x){
  if(x.floaterStatus)return x.floaterStatus;
  return (n(x.floater)||n(x.diesel)||/floater/i.test(String(x.service||x.transport||"")))?"with":"without";
}
function normalizedShipments(){
  return (A.shipments||[]).map((x,i)=>({
    id:x.shipmentId||x.id||`SHIP-${i+1}`,kind:"shipment",eventType:"shipment",
    date:parseDate(x.shipmentDate||x.deliveryDate||x.importedAt),
    originCountry:String(x.originCountry||"").toUpperCase(),originPostal:String(x.originPostal||""),
    destCountry:String(x.destCountry||"").toUpperCase(),destPostal:String(x.destPostal||""),destCity:x.destCity||"",
    recipient:x.customer||x.destCity||x.destPostal||"Unbekannt",
    relation:[x.originCountry,x.originPostal].filter(Boolean).join(" ")+" → "+[x.destCountry,x.destPostal].filter(Boolean).join(" "),
    carrier:x.carrier||"Unbekannt",user:x.user||"",service:x.service||"",
    transport:transportClass(x),floater:floaterStatus(x),
    weight:n(x.weight)||0,pallets:n(x.pallets)||0,ldm:n(x.ldm)||0,volume:n(x.volume)||0,km:n(x.km)||0,
    cost:shipmentCost(x),freight:n(x.freight)||0,diesel:n(x.diesel)||0,toll:n(x.toll)||0,other:n(x.otherCharges)||0,
    region:regionFrom(x.destCountry,x.destPostal,x.destCity),source:"Sendungsdaten",raw:x
  })).filter(x=>x.date);
}
function normalizedOperations(){
  const invoiceMap=new Map((A.invoices||[]).filter(c=>c.operation).map(c=>[c.operation,c]));
  return (A.operations||[]).map((o,i)=>{
    const rel=parseRelation(o.relation),inv=invoiceMap.get(o.id);
    const cost=inv&&n(inv.actual)!=null?n(inv.actual):(n(o.totalPrice)??n(o.price)??0);
    const created=dateFromCreated(o.created)||parseDate(o.createdAt)||parseDate(o.date);
    const pickup=parseDate(o.pickupDate||o.date);
    return {
      id:o.id||`OP-${i+1}`,kind:"operation",eventType:o.type||"",
      date:created,bookingDate:created,pickupDate:pickup,
      originCountry:rel.origin.country,originPostal:rel.origin.postal,
      destCountry:rel.dest.country,destPostal:rel.dest.postal,destCity:"",
      recipient:o.customer||rel.dest.label||"Unbekannt",relation:o.relation||"",
      carrier:o.provider||"Unbekannt",user:o.user||"Unbekannt",service:o.transport||"",
      transport:transportClass(o),floater:(n(o.floaterAmount)||n(o.floaterPercent))?"with":"without",
      weight:n(o.weight)||0,pallets:n(o.pallets)||0,ldm:n(o.ldm)||0,volume:n(o.volume)||0,km:n(o.km)||0,
      cost:cost||0,freight:n(o.basePrice)||n(o.price)||0,diesel:n(o.floaterAmount)||0,toll:n(o.toll)||0,other:n(o.ancillaryAmount)||n(o.manualCorrection)||0,
      region:regionFrom(rel.dest.country,rel.dest.postal,""),source:"Vorgänge",raw:o,invoice:inv||null
    };
  }).filter(x=>x.date);
}
function normalizedOffers(){
  const out=[];
  (A.calculations||[]).forEach((c,ci)=>{
    const arr=c.offers||c.results||c.quotes||c.providers||[];
    if(!Array.isArray(arr))return;
    arr.forEach((q,qi)=>{
      const price=n(q.totalPrice??q.price??q.total??q.amount);
      const carrier=q.provider||q.carrier||q.forwarder||q.name;
      if(price==null||!carrier)return;
      out.push({calcId:c.id||`CALC-${ci+1}`,date:parseDate(c.createdAt||c.date),carrier,price,
        destCountry:String(c.destCountry||c.country||"").toUpperCase(),transport:transportClass(c),floater:(n(q.floater)||n(q.floaterAmount))?"with":"without",
        booked:!!(q.booked||q.selected||carrier===c.selectedProvider),raw:q});
    });
  });
  return out.filter(x=>x.date);
}

let ALL_SHIP=[];
let ALL_OPS=[];
let ALL_OFFERS=[];
let FLOW_BASE=[];
function refreshAnalyticsSources(){
  ALL_SHIP=normalizedShipments();
  ALL_OPS=normalizedOperations();
  ALL_OFFERS=normalizedOffers();
  FLOW_BASE=ALL_SHIP.length?ALL_SHIP:ALL_OPS.filter(x=>x.eventType==="booking");
}
let currentTab="overview";

const state={country:"",region:"",recipient:"",relation:"",transport:"",carrier:"",user:"",floater:"",from:"",to:"",compare:"previous",period:"month"};

function defaultDates(){
  const dates=[...FLOW_BASE,...ALL_OPS].map(x=>x.date).filter(Boolean).sort((a,b)=>a-b);
  const end=dates.at(-1)||new Date(),start=new Date(end);
  start.setDate(1);
  state.from=isoDate(start);state.to=isoDate(end);
  $("anFrom").value=state.from;$("anTo").value=state.to;
}
function syncState(){
  state.period=$("anPeriod").value;state.compare=$("anCompare").value;
  state.from=$("anFrom").value;state.to=$("anTo").value;
  state.country=$("anCountry").value;state.region=$("anRegion").value;state.recipient=$("anRecipient").value;
  state.relation=$("anRelation").value;state.transport=$("anTransport").value;state.carrier=$("anCarrier").value;
  state.user=$("anUser").value;state.floater=$("anFloater").value;
}
function periodPreset(){
  const dates=[...FLOW_BASE,...ALL_OPS].map(x=>x.date).filter(Boolean).sort((a,b)=>a-b);
  const end=dates.at(-1)||new Date(),start=new Date(end),p=$("anPeriod").value;
  if(p==="all"){state.from=dates[0]?isoDate(dates[0]):"";state.to=isoDate(end)}
  else if(p==="week"){start.setDate(end.getDate()-6);state.from=isoDate(start);state.to=isoDate(end)}
  else if(p==="month"){start.setDate(1);state.from=isoDate(start);state.to=isoDate(end)}
  else if(p==="quarter"){start.setMonth(Math.floor(end.getMonth()/3)*3,1);state.from=isoDate(start);state.to=isoDate(end)}
  else if(p==="year"){start.setMonth(0,1);state.from=isoDate(start);state.to=isoDate(end)}
  if(p!=="custom"){$("anFrom").value=state.from;$("anTo").value=state.to}
}
function inDate(x,from,to){
  if(!x.date)return false;const f=from?parseDate(from):null,t=to?parseDate(to):null;
  return (!f||x.date>=f)&&(!t||x.date<=new Date(t.getTime()+DAY-1));
}
function matchDims(x){
  return (!state.country||x.destCountry===state.country)&&(!state.region||x.region===state.region)&&
    (!state.recipient||x.recipient===state.recipient)&&(!state.relation||x.relation===state.relation)&&
    (!state.transport||x.transport===state.transport)&&(!state.carrier||x.carrier===state.carrier)&&
    (!state.user||x.user===state.user)&&(!state.floater||x.floater===state.floater);
}
function filterRows(rows){return rows.filter(x=>inDate(x,state.from,state.to)&&matchDims(x))}
function comparisonRange(){
  const f=parseDate(state.from),t=parseDate(state.to);if(!f||!t||state.compare==="none")return null;
  let cf=new Date(f),ct=new Date(t);
  if(state.compare==="year"){cf.setFullYear(cf.getFullYear()-1);ct.setFullYear(ct.getFullYear()-1)}
  else if(state.compare==="quarter"){cf.setMonth(cf.getMonth()-3);ct.setMonth(ct.getMonth()-3)}
  else if(state.compare==="month"){cf.setMonth(cf.getMonth()-1);ct.setMonth(ct.getMonth()-1)}
  else {const len=t-f+DAY;ct=new Date(f.getTime()-DAY);cf=new Date(ct.getTime()-len+DAY)}
  return {from:isoDate(cf),to:isoDate(ct)};
}
function filterComparison(rows){const r=comparisonRange();return r?rows.filter(x=>inDate(x,r.from,r.to)&&matchDims(x)):[]}
function delta(cur,prev){if(!prev)return null;return (cur-prev)/prev*100}
function metricCard(label,value,sub,deltaValue,filterKey="",filterValue=""){
  const d=deltaValue==null?"":`<span class="kpi-delta ${deltaValue>0?"up":deltaValue<0?"down":""}">${pct(deltaValue)}</span>`;
  return `<button class="analytics-kpi" ${filterKey?`data-cross-key="${filterKey}" data-cross-value="${esc(filterValue)}"`:""}><span>${esc(label)}</span><strong>${value}</strong><small>${esc(sub||"")}</small>${d}</button>`;
}
function metricValues(rows,ops){
  const bookings=ops.filter(x=>x.eventType==="booking").length,prices=ops.filter(x=>x.eventType==="price").length,avail=ops.filter(x=>x.eventType==="availability").length;
  return {
    shipments:rows.length,bookings,prices,avail,weight:sum(rows,x=>x.weight),pallets:sum(rows,x=>x.pallets),ldm:sum(rows,x=>x.ldm),
    cost:sum(rows,x=>x.cost),km:sum(rows,x=>x.km)
  };
}
function renderKpis(){
  const rows=filterRows(FLOW_BASE),ops=filterRows(ALL_OPS),prevRows=filterComparison(FLOW_BASE),prevOps=filterComparison(ALL_OPS);
  const cur=metricValues(rows,ops),prev=metricValues(prevRows,prevOps);
  const cards=[
    ["Sendungen",fmt(cur.shipments), "historische / gebuchte Sendungen",delta(cur.shipments,prev.shipments)],
    ["Buchungen",fmt(cur.bookings),"Vorgänge",delta(cur.bookings,prev.bookings)],
    ["Preisanfragen",fmt(cur.prices),"Vorgänge",delta(cur.prices,prev.prices)],
    ["Verfügbarkeitsanfragen",fmt(cur.avail),"Vorgänge",delta(cur.avail,prev.avail)],
    ["Gesamtgewicht",`${fmt(cur.weight/1000,1)} t`,"",delta(cur.weight,prev.weight)],
    ["Paletten",fmt(cur.pallets),"",delta(cur.pallets,prev.pallets)],
    ["Lademeter",fmt(cur.ldm,1),"LDM",delta(cur.ldm,prev.ldm)],
    ["Gesamtkosten",money(cur.cost),"Ist-/Sendungskosten",delta(cur.cost,prev.cost)],
    ["Kosten / Sendung",rows.length?money2(cur.cost/rows.length):"—","",delta(rows.length?cur.cost/rows.length:0,prevRows.length?prev.cost/prevRows.length:0)],
    ["Kosten / kg",cur.weight?money2(cur.cost/cur.weight):"—","",null],
    ["Kosten / Palette",cur.pallets?money2(cur.cost/cur.pallets):"—","",null],
    ["Kosten / LDM",cur.ldm?money2(cur.cost/cur.ldm):"—","",null],
    ["Kosten / km",cur.km?money2(cur.cost/cur.km):"—","nur wenn km vorhanden",null]
  ];
  $("managementKpis").innerHTML=cards.map(c=>metricCard(...c)).join("");
}
function groupBy(rows,keyFn){
  const m=new Map();rows.forEach(x=>{const k=keyFn(x)||"Unbekannt";if(!m.has(k))m.set(k,[]);m.get(k).push(x)});return [...m.entries()];
}
function barList(elId,groups,metricFn,labelFn,keyName){
  const el=$(elId),vals=groups.map(([k,a])=>({k,a,v:metricFn(a)})).sort((a,b)=>b.v-a.v).slice(0,10),max=Math.max(1,...vals.map(x=>x.v));
  el.innerHTML=vals.length?vals.map(x=>`<button class="analytics-bar-row" data-cross-key="${keyName}" data-cross-value="${esc(x.k)}"><span>${esc(x.k)}</span><i><b style="width:${Math.max(3,x.v/max*100)}%"></b></i><strong>${esc(labelFn(x.v,x.a))}</strong></button>`).join(""):`<div class="analytics-empty">Keine Daten für diese Auswahl.</div>`;
}
function timeKey(d,g){
  if(g==="day")return d.toISOString().slice(0,10);
  if(g==="month")return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  if(g==="quarter")return `${d.getFullYear()} Q${Math.floor(d.getMonth()/3)+1}`;
  const t=new Date(d);t.setHours(0,0,0,0);t.setDate(t.getDate()+3-(t.getDay()+6)%7);const w1=new Date(t.getFullYear(),0,4);const wk=1+Math.round(((t-w1)/DAY-3+(w1.getDay()+6)%7)/7);return `${t.getFullYear()} KW ${String(wk).padStart(2,"0")}`;
}
function lineChart(elId,rows,metricFn,g){
  const groups=groupBy(rows,x=>timeKey(x.date,g)).map(([k,a])=>({k,v:metricFn(a)})).sort((a,b)=>a.k.localeCompare(b.k));
  const el=$(elId);if(!groups.length){el.innerHTML='<div class="analytics-empty">Keine Daten.</div>';return}
  const W=800,H=220,p=28,max=Math.max(1,...groups.map(x=>x.v));
  const pts=groups.map((x,i)=>{const xx=p+(W-2*p)*(groups.length===1?.5:i/(groups.length-1));const yy=H-p-(H-2*p)*(x.v/max);return {x,xx,yy}}); 
  const path=pts.map((p,i)=>`${i?"L":"M"}${p.xx.toFixed(1)},${p.yy.toFixed(1)}`).join(" ");
  const labels=pts.filter((_,i)=>groups.length<=8||i%Math.ceil(groups.length/6)===0||i===groups.length-1).map(p=>`<text x="${p.xx}" y="${H-6}" text-anchor="middle">${esc(p.x.k.replace(/^\d{4}-/,""))}</text>`).join("");
  el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img"><line x1="${p}" y1="${H-p}" x2="${W-p}" y2="${H-p}" class="chart-axis"/><path d="${path}" class="chart-line"/><path d="${path} L${pts.at(-1).xx},${H-p} L${pts[0].xx},${H-p} Z" class="chart-area"/>${pts.map(q=>`<circle cx="${q.xx}" cy="${q.yy}" r="4"><title>${q.x.k}: ${fmt(q.x.v,1)}</title></circle>`).join("")}${labels}</svg>`;
}
function renderOverview(){
  const rows=filterRows(FLOW_BASE);
  lineChart("shipmentTrendChart",rows,a=>a.length,$("trendGranularity").value);
  const tg=groupBy(rows,x=>x.transport);
  const total=rows.length||1,segments=tg.map(([k,a])=>({k,v:a.length,p:a.length/total*100})).sort((a,b)=>b.v-a.v);
  let pos=0;const conic=segments.map(s=>{const a=pos,b=pos+s.p;pos=b;return `var(--mix-${s.k==="FTL"?"ftl":s.k==="LTL"?"ltl":"piece"}) ${a}% ${b}%`}).join(",");
  $("transportMixChart").innerHTML=`<div class="analytics-donut" style="background:conic-gradient(${conic||"#e8eff1 0 100%"})"><div><strong>${fmt(rows.length)}</strong><span>Sendungen</span></div></div><div class="analytics-legend">${segments.map(s=>`<button data-cross-key="transport" data-cross-value="${esc(s.k)}"><i class="${s.k==="FTL"?"ftl":s.k==="LTL"?"ltl":"piece"}"></i><span>${esc(s.k)}</span><strong>${fmt(s.v)} · ${fmt(s.p,0)}%</strong></button>`).join("")}</div>`;
  barList("topRecipients",groupBy(rows,x=>x.recipient),a=>a.length,v=>fmt(v),"recipient");
  barList("topRelations",groupBy(rows,x=>x.relation),a=>a.length,v=>fmt(v),"relation");
  barList("topCountries",groupBy(rows,x=>x.destCountry||"—"),a=>a.length,(v,a)=>`${fmt(v)} · ${money(sum(a,x=>x.cost))}`,"country");
  renderHeatmap();
  renderCostComponents("costComponents");
}
function heatValue(a,m){
  if(m==="weight")return sum(a,x=>x.weight);if(m==="pallets")return sum(a,x=>x.pallets);if(m==="cost")return sum(a,x=>x.cost);
  if(m==="costKg"){const w=sum(a,x=>x.weight);return w?sum(a,x=>x.cost)/w:0}
  if(m==="costPallet"){const p=sum(a,x=>x.pallets);return p?sum(a,x=>x.cost)/p:0}
  return a.length;
}
function renderHeatmap(){
  const rows=filterRows(FLOW_BASE),metric=$("heatMetric").value,groups=groupBy(rows,x=>x.region||x.destCountry||"—").map(([k,a])=>({k,a,v:heatValue(a,metric)})).sort((a,b)=>b.v-a.v).slice(0,30);
  const max=Math.max(1,...groups.map(x=>x.v));
  $("heatmapGrid").innerHTML=groups.length?groups.map(x=>{const level=Math.max(1,Math.ceil(x.v/max*5));return `<button class="heat-cell heat-${level}" data-cross-key="region" data-cross-value="${esc(x.k)}"><strong>${esc(x.k)}</strong><span>${metric==="cost"||metric.startsWith("cost")?money2(x.v):fmt(x.v,metric==="weight"?0:1)}</span><small>${fmt(x.a.length)} Sendungen</small></button>`}).join(""):'<div class="analytics-empty">Keine Regionen vorhanden.</div>';
}
function costParts(rows){
  const parts=[
    ["Grundfracht",sum(rows,x=>x.freight)],
    ["Diesel / Floater",sum(rows,x=>x.diesel)],
    ["Maut",sum(rows,x=>x.toll)],
    ["Sonstige Zuschläge",sum(rows,x=>x.other)]
  ];
  const explicit=sum(parts,x=>x[1]),total=sum(rows,x=>x.cost);
  if(total>explicit+0.01)parts.push(["Nicht aufgeschlüsselt",total-explicit]);
  return parts.filter(x=>x[1]>0);
}
function renderCostComponents(id){
  const rows=filterRows(FLOW_BASE),parts=costParts(rows),max=Math.max(1,...parts.map(x=>x[1])),tot=sum(parts,x=>x[1]);
  $(id).innerHTML=parts.length?parts.map(([k,v])=>`<div class="cost-part-row"><div><span>${esc(k)}</span><strong>${money(v)}</strong></div><i><b style="width:${v/max*100}%"></b></i><small>${tot?fmt(v/tot*100,1):0}%</small></div>`).join(""):'<div class="analytics-empty">Keine aufgeschlüsselten Kosten vorhanden.</div>';
}
function renderFlows(){
  const rows=filterRows(FLOW_BASE);
  const rec=groupBy(rows,x=>x.recipient).map(([k,a])=>({k,a})).sort((a,b)=>b.a.length-a.a.length).slice(0,50);
  $("recipientRows").innerHTML=rec.map(x=>`<tr data-cross-key="recipient" data-cross-value="${esc(x.k)}"><td><strong>${esc(x.k)}</strong></td><td>${fmt(x.a.length)}</td><td>${fmt(sum(x.a,y=>y.weight)/1000,1)} t</td><td>${fmt(sum(x.a,y=>y.pallets),1)}</td><td>${money(sum(x.a,y=>y.cost))}</td><td>${money2(avg(x.a,y=>y.cost))}</td></tr>`).join("")||emptyRow(6);
  const rel=groupBy(rows,x=>x.relation).map(([k,a])=>({k,a})).sort((a,b)=>b.a.length-a.a.length).slice(0,50);
  $("relationRows").innerHTML=rel.map(x=>`<tr data-cross-key="relation" data-cross-value="${esc(x.k)}"><td><strong>${esc(x.k)}</strong></td><td>${fmt(x.a.length)}</td><td>${fmt(sum(x.a,y=>y.weight)/1000,1)} t</td><td>${fmt(sum(x.a,y=>y.pallets),1)}</td><td>${money(sum(x.a,y=>y.cost))}</td></tr>`).join("")||emptyRow(5);
  const reg=groupBy(rows,x=>`${x.destCountry||"—"} · ${x.region||"—"}`).map(([k,a])=>({k,a})).sort((a,b)=>b.a.length-a.a.length).slice(0,80);
  $("regionRows").innerHTML=reg.map(x=>`<tr><td><strong>${esc(x.k)}</strong></td><td>${fmt(x.a.length)}</td><td>${fmt(sum(x.a,y=>y.weight)/1000,1)} t</td><td>${fmt(sum(x.a,y=>y.pallets),1)}</td><td>${fmt(sum(x.a,y=>y.ldm),1)}</td><td>${money(sum(x.a,y=>y.cost))}</td></tr>`).join("")||emptyRow(6);
  lineChart("volumeTrendChart",rows,a=>sum(a,x=>x.weight)/1000,"month");
}
function emptyRow(n){return `<tr><td colspan="${n}" class="analytics-empty">Keine Daten für diese Auswahl.</td></tr>`}
function renderCosts(){
  const rows=filterRows(FLOW_BASE),cost=sum(rows,x=>x.cost),weight=sum(rows,x=>x.weight),pal=sum(rows,x=>x.pallets),ldm=sum(rows,x=>x.ldm),km=sum(rows,x=>x.km);
  $("costKpis").innerHTML=[
    metricCard("Gesamtkosten",money(cost),""),
    metricCard("€/Sendung",rows.length?money2(cost/rows.length):"—",""),
    metricCard("€/kg",weight?money2(cost/weight):"—",""),
    metricCard("€/t",weight?money2(cost/(weight/1000)):"—",""),
    metricCard("€/Palette",pal?money2(cost/pal):"—",""),
    metricCard("€/LDM",ldm?money2(cost/ldm):"—",""),
    metricCard("€/km",km?money2(cost/km):"—","")
  ].join("");
  lineChart("costTrendChart",rows,a=>sum(a,x=>x.cost),"month");
  renderCostComponents("costComponentDetail");
  const dims=[["Land",x=>x.destCountry],["Empfänger",x=>x.recipient],["Dienstleister",x=>x.carrier],["Transportart",x=>x.transport]];
  const all=[];
  dims.forEach(([dn,fn])=>groupBy(rows,fn).forEach(([k,a])=>all.push({dn,k,a,cost:sum(a,x=>x.cost)})));
  all.sort((a,b)=>b.cost-a.cost);
  $("costDimensionRows").innerHTML=all.slice(0,100).map(x=>{const w=sum(x.a,y=>y.weight),p=sum(x.a,y=>y.pallets),l=sum(x.a,y=>y.ldm);return `<tr><td>${esc(x.dn)}</td><td><strong>${esc(x.k)}</strong></td><td>${fmt(x.a.length)}</td><td>${money(x.cost)}</td><td>${money2(x.cost/x.a.length)}</td><td>${w?money2(x.cost/w):"—"}</td><td>${p?money2(x.cost/p):"—"}</td><td>${l?money2(x.cost/l):"—"}</td></tr>`}).join("")||emptyRow(8);
}
function bookingOps(){return filterRows(ALL_OPS).filter(x=>x.eventType==="booking")}
function offerStats(){
  const offers=filterRows(ALL_OFFERS),byCalc=groupBy(offers,x=>x.calcId);
  const stats=new Map();
  offers.forEach(o=>{if(!stats.has(o.carrier))stats.set(o.carrier,{carrier:o.carrier,parts:0,best:0,booked:0,sum:0,gap:0,gapN:0});const s=stats.get(o.carrier);s.parts++;s.sum+=o.price;if(o.booked)s.booked++});
  byCalc.forEach(([id,a])=>{const sorted=a.slice().sort((x,y)=>x.price-y.price),best=sorted[0]?.price||0;sorted.forEach(o=>{const s=stats.get(o.carrier);if(o.price===best)s.best++;if(best){s.gap+=(o.price-best)/best*100;s.gapN++}})});
  return [...stats.values()];
}
function renderCarriers(){
  const bookings=bookingOps(),stats=offerStats(),bookBy=groupBy(bookings,x=>x.carrier);
  const focus=$("providerAnalyticsFocus");
  if(state.carrier){
    const flow=filterRows(FLOW_BASE),ops=filterRows(ALL_OPS),bookingsFocus=ops.filter(x=>x.eventType==="booking");
    /* Wenn für einen neuen Dienstleister noch keine historischen Sendungsdaten
       importiert wurden, bilden die gebuchten Vorgänge bereits die Statistik.
       So erscheinen neu angelegte Contino/Hellmann-Touren sofort. */
    const providerRows=flow.length?flow:bookingsFocus;
    const providerCost=flow.length?sum(flow,x=>x.cost):sum(bookingsFocus,x=>x.cost);
    focus.hidden=false;
    $("providerAnalyticsTitle").textContent=`${state.carrier} · Statistik`;
    $("providerAnalyticsSubtitle").textContent="Touren, Ziele, Mengen und Kosten für die aktuelle Filterauswahl.";
    $("providerAnalyticsKpis").innerHTML=[
      metricCard("Touren / Buchungen",fmt(bookingsFocus.length),"gebuchte Vorgänge",null),
      metricCard("Sendungen",fmt(providerRows.length),flow.length?"historische Sendungsdaten":"aus gebuchten Vorgängen",null),
      metricCard("Gesamtkosten",money(providerCost),flow.length?"Sendungskosten":"gebuchte Preise",null),
      metricCard("Gewicht",`${fmt(sum(providerRows,x=>x.weight)/1000,1)} t`,"",null),
      metricCard("Paletten",fmt(sum(providerRows,x=>x.pallets),1),"",null),
      metricCard("Lademeter",fmt(sum(providerRows,x=>x.ldm),1),"LDM",null)
    ].join("");
    const countries=groupBy(providerRows,x=>x.destCountry||"—").sort((a,b)=>b[1].length-a[1].length).slice(0,10);
    const relations=groupBy(providerRows,x=>x.relation||[x.destCountry,x.destPostal,x.destCity].filter(Boolean).join(" ")||"—").sort((a,b)=>b[1].length-a[1].length).slice(0,10);
    barList("providerCountryBars",countries,a=>a.length,v=>`${fmt(v)} Touren`,"country");
    barList("providerRelationBars",relations,a=>a.length,v=>`${fmt(v)} Touren`,"relation");
  }else{focus.hidden=true;}
  const names=new Set([...stats.map(x=>x.carrier),...bookBy.map(x=>x[0])]);
  const rows=[...names].map(name=>{const s=stats.find(x=>x.carrier===name)||{parts:0,best:0,booked:0,sum:0,gap:0,gapN:0},b=(bookBy.find(x=>x[0]===name)||[null,[]])[1];return {...s,carrier:name,bookings:b.length,bookCost:sum(b,x=>x.cost)}}).sort((a,b)=>b.bookings-a.bookings||b.parts-a.parts);
  $("carrierRows").innerHTML=rows.map(x=>`<tr data-cross-key="carrier" data-cross-value="${esc(x.carrier)}"><td><strong>${esc(x.carrier)}</strong></td><td>${fmt(x.parts)}</td><td>${fmt(x.best)}</td><td>${fmt(x.bookings)}</td><td>${x.parts?fmt(x.bookings/x.parts*100,1)+"%":"—"}</td><td>${x.parts?money2(x.sum/x.parts):"—"}</td><td>${x.gapN?fmt(x.gap/x.gapN,1)+"%":"—"}</td></tr>`).join("")||emptyRow(7);
  barList("carrierBookingBars",bookBy,a=>sum(a,x=>x.cost),v=>money(v),"carrier");
  const flow=filterRows(FLOW_BASE),f=flow.filter(x=>x.floater==="with"),wo=flow.filter(x=>x.floater==="without");
  $("floaterComparison").innerHTML=`<div class="compare-cards"><button data-cross-key="floater" data-cross-value="with"><span>Mit Floater</span><strong>${fmt(f.length)} Sendungen</strong><small>${money(sum(f,x=>x.cost))} · Ø ${f.length?money2(avg(f,x=>x.cost)):"—"}</small></button><button data-cross-key="floater" data-cross-value="without"><span>Ohne Floater</span><strong>${fmt(wo.length)} Sendungen</strong><small>${money(sum(wo,x=>x.cost))} · Ø ${wo.length?money2(avg(wo,x=>x.cost)):"—"}</small></button></div>`;
}
function renderUsers(){
  const ops=filterRows(ALL_OPS),users=groupBy(ops,x=>x.user||"Unbekannt").map(([k,a])=>({k,a})).sort((a,b)=>b.a.length-a.a.length);
  $("userRows").innerHTML=users.map(x=>{const p=x.a.filter(y=>y.eventType==="price").length,av=x.a.filter(y=>y.eventType==="availability").length,b=x.a.filter(y=>y.eventType==="booking"),countries=groupBy(b,y=>y.destCountry).sort((a,z)=>z[1].length-a[1].length),focus=countries[0]?.[0]||"—";return `<tr data-cross-key="user" data-cross-value="${esc(x.k)}"><td><strong>${esc(x.k)}</strong></td><td>${fmt(p)}</td><td>${fmt(av)}</td><td>${fmt(b.length)}</td><td>${fmt(sum(b,y=>y.weight)/1000,1)} t</td><td>${fmt(sum(b,y=>y.pallets),1)}</td><td>${fmt(sum(b,y=>y.ldm),1)}</td><td>${money(sum(b,y=>y.cost))}</td><td>${esc(focus)}</td></tr>`}).join("")||emptyRow(9);
  const bookings=ops.filter(x=>x.eventType==="booking");
  const dayparts=[["Früh morgens",5,8],["Vormittags",8,12],["Mittags",12,14],["Nachmittags",14,18],["Abends",18,24]];
  const timeGroups=dayparts.map(([label,a,b])=>[label,bookings.filter(x=>{const raw=String(x.raw?.created||"");const m=raw.match(/(\d{1,2}):(\d{2})/);const h=m?+m[1]:x.date?.getHours();return h>=a&&h<b})]);
  barList("bookingTimeBars",timeGroups,a=>a.length,v=>fmt(v),"");
  const leadBands=[["Gleicher Tag",0,0],["1 Tag",1,1],["2 Tage",2,2],["3–5 Tage",3,5],[">5 Tage",6,9999]];
  const leadGroups=leadBands.map(([label,a,b])=>[label,bookings.filter(x=>x.bookingDate&&x.pickupDate&&Math.round((x.pickupDate-x.bookingDate)/DAY)>=a&&Math.round((x.pickupDate-x.bookingDate)/DAY)<=b)]);
  barList("leadTimeBars",leadGroups,a=>a.length,v=>fmt(v),"");
}
function renderPricing(){
  const ops=filterRows(ALL_OPS).filter(x=>x.invoice),variances=ops.map(x=>{const expected=n(x.invoice.expected)??n(x.raw?.price)??0,actual=n(x.invoice.actual)??0,diff=actual-expected;return {x,expected,actual,diff,p:expected?diff/expected*100:0}});
  $("pricingKpis").innerHTML=[
    metricCard("Geprüfte Rechnungen",fmt(variances.length),""),
    metricCard("Sollsumme",money(sum(variances,v=>v.expected)),""),
    metricCard("Istsumme",money(sum(variances,v=>v.actual)),""),
    metricCard("Abweichung",money(sum(variances,v=>v.diff)),""),
    metricCard("Ø Abweichung",variances.length?money2(avg(variances,v=>v.diff)):"—","")
  ].join("");
  $("priceVarianceRows").innerHTML=variances.map(v=>`<tr><td><strong>${esc(v.x.id)}</strong></td><td>${esc(v.x.carrier)}</td><td>${money2(v.expected)}</td><td>${money2(v.actual)}</td><td class="${v.diff>0?"variance-bad":v.diff<0?"variance-good":""}">${money2(v.diff)}</td><td>${fmt(v.p,1)}%</td></tr>`).join("")||emptyRow(6);
  const stats=offerStats();
  $("offerComparisonInfo").innerHTML=ALL_OFFERS.length?`<div class="analytics-info-strip"><strong>${fmt(filterRows(ALL_OFFERS).length)} Angebote</strong><span>aus ${fmt(groupBy(filterRows(ALL_OFFERS),x=>x.calcId).length)} Preisvergleichen</span></div>`:`<div class="analytics-info-strip muted"><strong>Noch keine Mehrfachangebote gespeichert</strong><span>Sobald Kalkulationen mehrere Dienstleisterangebote speichern, werden Bestpreis, Teilnahme und Preisabstand hier automatisch ausgewertet.</span></div>`;
  $("offerRows").innerHTML=stats.sort((a,b)=>b.parts-a.parts).map(s=>`<tr data-cross-key="carrier" data-cross-value="${esc(s.carrier)}"><td><strong>${esc(s.carrier)}</strong></td><td>${fmt(s.parts)}</td><td>${fmt(s.best)}</td><td>${s.parts?money2(s.sum/s.parts):"—"}</td><td>${s.gapN?fmt(s.gap/s.gapN,1)+"%":"—"}</td></tr>`).join("")||emptyRow(5);
}
function fillOptions(){
  const all=[...FLOW_BASE,...ALL_OPS];
  const pairs=[
    ["anCountry","destCountry"],["anRegion","region"],["anRecipient","recipient"],["anRelation","relation"],["anTransport","transport"],["anCarrier","carrier"],["anUser","user"]
  ];
  pairs.forEach(([id,key])=>{const el=$(id),label=el.options[0]?.text||"Alle";const vals=[...new Set(all.map(x=>x[key]).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true}));el.innerHTML=`<option value="">${esc(label)}</option>`+vals.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("")});
}
function renderChips(){
  const map={country:"Land",region:"Region",recipient:"Empfänger",relation:"Relation",transport:"Transport",carrier:"Dienstleister",user:"Benutzer",floater:"Floater"};
  $("activeFilterChips").innerHTML=Object.entries(map).filter(([k])=>state[k]).map(([k,l])=>`<button data-chip-clear="${k}"><span>${esc(l)}:</span> ${esc(state[k])} ×</button>`).join("")||'<span class="no-filter">Keine zusätzlichen Filter aktiv</span>';
}
function crossFilter(key,val){
  const ids={country:"anCountry",region:"anRegion",recipient:"anRecipient",relation:"anRelation",transport:"anTransport",carrier:"anCarrier",user:"anUser",floater:"anFloater"};
  if(!ids[key])return;$(ids[key]).value=val;syncState();renderAll();
}
function bindCross(){
  document.querySelectorAll("[data-cross-key]").forEach(el=>el.addEventListener("click",()=>crossFilter(el.dataset.crossKey,el.dataset.crossValue)));
  document.querySelectorAll("[data-chip-clear]").forEach(el=>el.addEventListener("click",()=>{const k=el.dataset.chipClear;const ids={country:"anCountry",region:"anRegion",recipient:"anRecipient",relation:"anRelation",transport:"anTransport",carrier:"anCarrier",user:"anUser",floater:"anFloater"};if(ids[k])$(ids[k]).value="";syncState();renderAll()}));
}
function renderAll(){
  renderChips();renderKpis();
  if(currentTab==="overview")renderOverview();
  if(currentTab==="flows")renderFlows();
  if(currentTab==="costs")renderCosts();
  if(currentTab==="carriers")renderCarriers();
  if(currentTab==="users")renderUsers();
  if(currentTab==="pricing")renderPricing();
  bindCross();
}
function resetFilters(){
  ["anCountry","anRegion","anRecipient","anRelation","anTransport","anCarrier","anUser","anFloater"].forEach(id=>$(id).value="");
  $("anPeriod").value="month";$("anCompare").value="previous";periodPreset();syncState();renderAll();
}
function setTab(tab){
  currentTab=tab;
  document.querySelectorAll(".analytics-tab").forEach(b=>b.classList.toggle("active",b.dataset.anTab===tab));
  ["overview","flows","costs","carriers","users","pricing"].forEach(t=>{$("an"+t[0].toUpperCase()+t.slice(1)+"Panel").hidden=t!==tab});
  renderAll();
}
document.querySelectorAll(".analytics-tab").forEach(b=>b.addEventListener("click",()=>setTab(b.dataset.anTab)));
$("analyticsApply").addEventListener("click",()=>{syncState();renderAll()});
$("analyticsReset").addEventListener("click",resetFilters);$("analyticsResetTop").addEventListener("click",resetFilters);
$("anPeriod").addEventListener("change",()=>{periodPreset();syncState();renderAll()});
["anCountry","anRegion","anRecipient","anRelation","anTransport","anCarrier","anUser","anFloater","anCompare"].forEach(id=>$(id).addEventListener("change",()=>{syncState();renderAll()}));
$("trendGranularity").addEventListener("change",()=>renderOverview());
$("heatMetric").addEventListener("change",renderHeatmap);
$("analyticsExportBtn").addEventListener("click",async()=>{
  const rows=filterRows(FLOW_BASE).map(x=>({Datum:isoDate(x.date),Land:x.destCountry,Region:x.region,Empfaenger:x.recipient,Relation:x.relation,Transportart:x.transport,Dienstleister:x.carrier,Benutzer:x.user,Gewicht_kg:x.weight,Paletten:x.pallets,LDM:x.ldm,Kosten:x.cost,Floater:x.floater}));
  if(!rows.length){const el=$("analyticsToast");el.textContent="Keine gefilterten Daten zum Exportieren.";el.hidden=false;setTimeout(()=>el.hidden=true,2200);return}
  await exportWorkbook("GP_Kollund_Transportanalyse.xlsx",{Analyse:rows});
});
(async function bootstrapAnalytics(){
  A.shipments=await GPK.largeRead(GPK.KEYS.shipments,[]);
  refreshAnalyticsSources();
  fillOptions();defaultDates();periodPreset();
  const params=new URLSearchParams(location.search);
  const requestedCarrier=(params.get("carrier")||"").trim();
  const requestedTab=(params.get("tab")||"").trim();
  const requestedPeriod=(params.get("period")||"").trim();
  if(requestedPeriod&&[...$("anPeriod").options].some(o=>o.value===requestedPeriod)){$("anPeriod").value=requestedPeriod;periodPreset();}
  if(requestedCarrier){
    const carrierSelect=$("anCarrier");
    if(![...carrierSelect.options].some(o=>o.value===requestedCarrier)){const opt=document.createElement("option");opt.value=requestedCarrier;opt.textContent=requestedCarrier;carrierSelect.appendChild(opt);}
    carrierSelect.value=requestedCarrier;
    if(!requestedPeriod){$("anPeriod").value="all";periodPreset();}
  }
  syncState();
  if(requestedTab&&["overview","flows","costs","carriers","users","pricing"].includes(requestedTab))setTab(requestedTab);
  else if(requestedCarrier)setTab("carriers");
  else renderAll();
})();
