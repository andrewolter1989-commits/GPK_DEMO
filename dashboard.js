const toast=document.getElementById("dashboardToast");
const moneyFmt=new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR",maximumFractionDigits:0});
const numFmt=new Intl.NumberFormat("de-DE",{maximumFractionDigits:1});
const palletBands=[{label:"1 PLL",test:n=>n===1},{label:"2 PLL",test:n=>n===2},{label:"3 PLL",test:n=>n===3},{label:"4–6 PLL",test:n=>n>=4&&n<=6},{label:"7–10 PLL",test:n=>n>=7&&n<=10},{label:"11+ PLL",test:n=>n>=11}];

function readCalculations(){try{return GPK.read(GPK.KEYS.calculations,[])||[]}catch(_){return []}}
function readProviders(){try{return GPK.read(GPK.KEYS.providers,[])||[]}catch(_){return []}}
function readTariffImports(){try{return GPK.read(GPK.KEYS.tariffImports,[])||[]}catch(_){return []}}
function readRateOutputs(){try{return GPK.read(GPK.KEYS.rateOutputs,[])||[]}catch(_){return []}}
function readInvoiceChecks(){try{return GPK.read("gpk_demo_invoice_checks_v1",[])||[]}catch(_){return []}}
function readZoneRules(){try{return GPK.read(GPK.KEYS.zoneRules,[])||[]}catch(_){return []}}
function withinPeriod(x){const p=periodSelect.value;if(p==="all")return true;const d=new Date(x.createdAt||0);if(!Number.isFinite(d.getTime()))return true;return Date.now()-d.getTime()<=Number(p)*86400000}
function normalTransport(x){const raw=String(x.shipmentType||x.transport||"").toLowerCase();if(raw.includes("teillad"))return "Teilladung";if(raw.includes("mega"))return "Mega";if(raw.includes("jumbo"))return "Jumbo";if(raw.includes("ftl"))return "FTL";return x.shipmentType||"—"}
function palletValue(x){const n=Number(x.pallets);if(Number.isFinite(n))return n;const m=String(x.transport||"").match(/([\d.,]+)\s*Paletten/i);return m?Number(m[1].replace(",",".")):NaN}
function weightValue(x){const n=Number(x.weight);return Number.isFinite(n)?n:NaN}
function rateType(x){return String(x.rateModel||"").trim()||"Unbekannt"}
function filteredData(){return readCalculations().filter(x=>withinPeriod(x)).filter(x=>!countryFilter.value||x.country===countryFilter.value).filter(x=>!providerFilter.value||x.provider===providerFilter.value).filter(x=>!tariffFilter.value||rateType(x)===tariffFilter.value).filter(x=>!transportFilter.value||normalTransport(x)===transportFilter.value)}
function unique(arr){return [...new Set(arr.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),"de",{numeric:true}))}
function setOptions(sel,values,label){const prev=sel.value;sel.innerHTML=`<option value="">${label}</option>`+values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");if(values.includes(prev))sel.value=prev}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function showToast(t){toast.textContent=t;toast.hidden=false;clearTimeout(showToast.t);showToast.t=setTimeout(()=>toast.hidden=true,2500)}
function avg(a){return a.length?a.reduce((s,n)=>s+n,0)/a.length:0}
function dateText(v){const d=new Date(v||0);return Number.isFinite(d.getTime())?d.toLocaleDateString("de-DE"):"—"}
function ageDays(v){const d=new Date(v||0);return Number.isFinite(d.getTime())?Math.max(0,Math.floor((Date.now()-d.getTime())/86400000)):NaN}
function countryFromRate(r){return String(r?.destCountry||r?.country||"").trim().toUpperCase()}
function metricValue(items){const m=metricFilter.value,prices=items.map(x=>Number(x.price)).filter(Number.isFinite);if(m==="total")return prices.reduce((s,n)=>s+n,0);if(m==="count")return items.length;if(m==="perPallet"){const vals=items.map(x=>{const p=palletValue(x),c=Number(x.price);return Number.isFinite(p)&&p>0&&Number.isFinite(c)?c/p:NaN}).filter(Number.isFinite);return avg(vals)}return avg(prices)}
function metricText(v){if(metricFilter.value==="count")return new Intl.NumberFormat("de-DE").format(v);return moneyFmt.format(v||0)}
function heatColor(v,min,max){if(!Number.isFinite(v))return "transparent";const t=max===min?.5:(v-min)/(max-min);const h=118-(118*t);return `hsl(${h} 72% ${86-18*t}%)`}

function populateFilters(){const all=readCalculations().filter(withinPeriod);setOptions(countryFilter,unique(all.map(x=>x.country)),"Alle Länder");setOptions(providerFilter,unique(all.map(x=>x.provider)),"Alle Dienstleister");setOptions(tariffFilter,unique(all.map(rateType)),"Alle Tariftypen");setOptions(transportFilter,unique(all.map(normalTransport).filter(x=>x!=="—")),"Alle Transportarten")}
function renderKpis(data){const prices=data.map(x=>Number(x.price)).filter(Number.isFinite),pals=data.map(palletValue).filter(Number.isFinite),weights=data.map(weightValue).filter(Number.isFinite);statShipments.textContent=new Intl.NumberFormat("de-DE").format(data.length);statTotalCost.textContent=moneyFmt.format(prices.reduce((s,n)=>s+n,0));statAvgCost.textContent=moneyFmt.format(avg(prices));statAvgPallets.textContent=pals.length?numFmt.format(avg(pals)):"—";statAvgWeight.textContent=weights.length?`${new Intl.NumberFormat("de-DE",{maximumFractionDigits:0}).format(avg(weights))} kg`:"—";statCountries.textContent=unique(data.map(x=>x.country)).length}
function renderHeatmap(data){const countries=unique(data.map(x=>x.country));const cells=[];const matrix=countries.map(country=>palletBands.map(b=>{const items=data.filter(x=>x.country===country&&b.test(palletValue(x)));const v=items.length?metricValue(items):NaN;if(Number.isFinite(v))cells.push(v);return {items,v}}));const min=cells.length?Math.min(...cells):0,max=cells.length?Math.max(...cells):1;heatmapBody.innerHTML=countries.map((country,ri)=>`<tr><th>${esc(country)}</th>${matrix[ri].map(c=>`<td style="background:${heatColor(c.v,min,max)}" title="${c.items.length} Sendungen">${Number.isFinite(c.v)?metricText(c.v):"—"}</td>`).join("")}</tr>`).join("")||`<tr><td colspan="7" class="empty-state">Noch keine Kalkulationsdaten.</td></tr>`;heatmapHint.hidden=data.some(x=>Number.isFinite(palletValue(x)));heatmapSubtitle.textContent=`Wo sind die Kosten hoch? Länder × Palettenklassen · ${metricFilter.options[metricFilter.selectedIndex].text}`}
function renderInsights(data){const byCountry=unique(data.map(x=>x.country)).map(c=>{const arr=data.filter(x=>x.country===c),prices=arr.map(x=>Number(x.price)).filter(Number.isFinite);return {c,count:arr.length,avg:avg(prices)}}).filter(x=>x.count);const overall=avg(data.map(x=>Number(x.price)).filter(Number.isFinite));const topCost=[...byCountry].sort((a,b)=>b.avg-a.avg)[0],topCount=[...byCountry].sort((a,b)=>b.count-a.count)[0];const highPallet=data.filter(x=>palletValue(x)>=4),highAvg=avg(highPallet.map(x=>Number(x.price)).filter(Number.isFinite));const items=[];if(topCost)items.push({tone:"up",title:`${topCost.c} höchste Ø Kosten / Sendung`,text:`Mit ${moneyFmt.format(topCost.avg)} über dem Gesamtmittel von ${moneyFmt.format(overall)}.`});if(highPallet.length)items.push({tone:"up",title:"Ab 4 Paletten steigen die Kosten",text:`Ø ${moneyFmt.format(highAvg)} bei ${highPallet.length} Kalkulationen.`});if(topCount)items.push({tone:"info",title:`${topCount.c} höchste Sendungsanzahl`,text:`${topCount.count} Kalkulationen im gewählten Zeitraum.`});const low=[...byCountry].sort((a,b)=>a.avg-b.avg)[0];if(low&&low!==topCost)items.push({tone:"down",title:`${low.c} aktuell günstigstes Land`,text:`Ø Kosten ${moneyFmt.format(low.avg)}.`});insightRows.innerHTML=(items.length?items:[{tone:"info",title:"Noch zu wenig Daten",text:"Mit neuen Kalkulationen entstehen automatisch Auffälligkeiten."}]).map(i=>`<div class="insight-row ${i.tone}"><span class="insight-icon">${i.tone==="up"?"↑":i.tone==="down"?"↓":"i"}</span><div><strong>${esc(i.title)}</strong><small>${esc(i.text)}</small></div></div>`).join("")}
function renderTransport(data){const names=["Teilladung","FTL","Mega","Jumbo"],total=Math.max(1,data.length);transportBars.innerHTML=names.map(n=>{const c=data.filter(x=>normalTransport(x)===n).length,p=Math.round(c/total*100);return `<div class="transport-bar-row"><strong>${n}</strong><span class="transport-bar-track"><i style="width:${p}%"></i></span><b>${p}%</b></div>`}).join("")}
function dashboardProviderAvatar(name){
  const p=GPK.providerRecord?.(name),src=GPK.providerLogoSrc?.(p)||"",ini=GPK.providerInitials?.(name,p?.alias)||initials(name);
  return src?`<span class="stats-avatar stats-avatar-logo"><img src="${esc(src)}" alt="${esc(name)} Logo" onerror="this.parentElement.classList.remove('stats-avatar-logo');this.remove();this.parentElement.textContent='${esc(ini)}'"></span>`:`<span class="stats-avatar">${esc(ini)}</span>`;
}
function initials(name){return String(name||"?").split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase()}
function renderProviders(data){
  const providers=unique(data.map(x=>x.provider)).map(name=>{
    const arr=data.filter(x=>x.provider===name),prices=arr.map(x=>Number(x.price)).filter(Number.isFinite);
    return {name,avg:avg(prices),wins:arr.length,winRate:data.length?arr.length/data.length*100:0};
  }).sort((a,b)=>b.wins-a.wins).slice(0,7);
  providerBenchmarkRows.innerHTML=providers.map(p=>`<tr><td>${dashboardProviderAvatar(p.name)}<strong>${esc(p.name)}</strong></td><td><strong>${moneyFmt.format(p.avg)}</strong></td><td><div class="quote-cell"><span><i style="width:${Math.min(100,p.winRate)}%"></i></span><b>${Math.round(p.winRate)}%</b></div></td></tr>`).join("")||`<tr><td colspan="3" class="empty-state">Noch keine Daten.</td></tr>`;
}
function renderHotspots(data){const map=new Map;data.forEach(x=>{const key=`${x.country||"—"}|${x.zone||"—"}`,e=map.get(key)||{country:x.country||"—",zone:x.zone||"—",sum:0,count:0};const p=Number(x.price);if(Number.isFinite(p)){e.sum+=p;e.count++}map.set(key,e)});const rows=[...map.values()].filter(x=>x.count).map(x=>({...x,avg:x.sum/x.count})).sort((a,b)=>b.avg-a.avg).slice(0,7);hotspotRows.innerHTML=rows.map(r=>`<tr><td><span class="stats-country-badge">${esc(r.country)}</span></td><td>${esc(String(r.zone).replace(/^Zone\s*/i,"Zone "))}</td><td><strong>${moneyFmt.format(r.avg)}</strong></td><td>${r.count}</td></tr>`).join("")||`<tr><td colspan="4" class="empty-state">Noch keine Zonen-/Kalkulationsdaten.</td></tr>`}

function providerCountryCellValue(provider,country,data,metric){
  const countryRows=data.filter(x=>x.country===country);
  const rows=countryRows.filter(x=>x.provider===provider);
  if(!rows.length)return NaN;
  if(metric==="wins")return rows.length;
  if(metric==="avgPrice")return avg(rows.map(x=>Number(x.price)).filter(Number.isFinite));
  return countryRows.length?rows.length/countryRows.length*100:NaN;
}
function providerCountryCellText(v,metric){
  if(!Number.isFinite(v))return "—";
  if(metric==="wins")return new Intl.NumberFormat("de-DE").format(v);
  if(metric==="avgPrice")return moneyFmt.format(v);
  return `${Math.round(v)} %`;
}
function renderProviderCountryHeatmap(data){
  const metric=providerCountryMetric?.value||"winRate";
  const countries=unique(data.map(x=>x.country)).slice(0,10);
  const providers=unique(data.map(x=>x.provider)).map(name=>({name,wins:data.filter(x=>x.provider===name).length})).sort((a,b)=>b.wins-a.wins).slice(0,10).map(x=>x.name);
  providerCountryHead.innerHTML=`<tr><th>Dienstleister</th>${countries.map(c=>`<th>${esc(c)}</th>`).join("")}</tr>`;
  const vals=[];
  const matrix=providers.map(p=>countries.map(c=>{const v=providerCountryCellValue(p,c,data,metric);if(Number.isFinite(v))vals.push(v);return v}));
  const min=vals.length?Math.min(...vals):0,max=vals.length?Math.max(...vals):1;
  providerCountryBody.innerHTML=providers.map((p,ri)=>`<tr><th>${dashboardProviderAvatar(p)}${esc(p)}</th>${countries.map((c,ci)=>{const v=matrix[ri][ci];return `<td class="provider-country-cell" style="background:${heatColor(v,min,max)}" title="${esc(p)} · ${esc(c)}">${providerCountryCellText(v,metric)}</td>`}).join("")}</tr>`).join("")||`<tr><td colspan="${Math.max(2,countries.length+1)}" class="empty-state">Noch keine Kalkulationsdaten.</td></tr>`;
  providerCountryHint.hidden=Boolean(data.length);
}
function renderSavings(data){
  const rows=data.map(x=>({x,best:Number(x.price),second:Number(x.secondPrice),saving:Number(x.saving)})).filter(r=>Number.isFinite(r.saving)&&r.saving>0);
  const total=rows.reduce((s,r)=>s+r.saving,0),average=avg(rows.map(r=>r.saving)),max=rows.length?Math.max(...rows.map(r=>r.saving)):0;
  savingPotential.textContent=moneyFmt.format(total);savingAverage.textContent=moneyFmt.format(average);savingCases.textContent=new Intl.NumberFormat("de-DE").format(rows.length);savingMax.textContent=moneyFmt.format(max);
  const top=[...rows].sort((a,b)=>b.saving-a.saving).slice(0,6);
  savingOpportunityRows.innerHTML=top.map(r=>`<tr><td><strong>${esc(r.x.relation||`${r.x.country||"—"} ${r.x.postalCode||""}`)}</strong><small>${esc(r.x.provider||"—")}</small></td><td>${moneyFmt.format(r.best)}</td><td>${moneyFmt.format(r.second)}</td><td><strong class="saving-positive">+ ${moneyFmt.format(r.saving)}</strong></td></tr>`).join("")||`<tr><td colspan="4" class="empty-state">Noch kein Bestpreisvorteil gespeichert.</td></tr>`;
}
function tariffCountriesForBatch(batch,rates){
  const fromRates=unique(rates.filter(r=>r.batchId===batch.id).map(countryFromRate));
  if(fromRates.length)return fromRates;
  return unique((batch.blocks||[]).flatMap(b=>Object.keys(b.benchmarkMetaByCountry||{})).filter(x=>x!=="ALL"));
}
function renderTariffMonitor(){
  const providers=readProviders(),imports=readTariffImports(),rates=readRateOutputs();
  const allCountries=unique(rates.map(countryFromRate));
  tariffProviderCount.textContent=providers.length;
  tariffCoveredCount.textContent=providers.filter(p=>imports.some(i=>String(i.provider).toLowerCase()===String(p.name).toLowerCase())).length;
  tariffMissingCount.textContent=providers.filter(p=>!imports.some(i=>String(i.provider).toLowerCase()===String(p.name).toLowerCase())).length;
  tariffReviewCount.textContent=imports.filter(i=>Number(i.reviewCount)>0).length;
  tariffCountryCount.textContent=allCountries.length;
  const rows=providers.map(p=>{
    const pImports=imports.filter(i=>String(i.provider).toLowerCase()===String(p.name).toLowerCase()).sort((a,b)=>new Date(b.updatedAt||b.createdAt||0)-new Date(a.updatedAt||a.createdAt||0));
    const latest=pImports[0],countries=latest?tariffCountriesForBatch(latest,rates):[],days=latest?ageDays(latest.updatedAt||latest.createdAt):NaN;
    let status="Kein Tarif",tone="missing";
    if(String(p.status)==="inactive"){status="Dienstleister inaktiv";tone="inactive"}
    else if(latest?.reviewCount){status="Review";tone="review"}
    else if(latest){status=Number.isFinite(days)&&days>365?"Tarif prüfen":"Aktuell";tone=days>365?"warn":"active"}
    return {p,latest,countries,status,tone,days};
  }).sort((a,b)=>{
    const rank={review:0,missing:1,warn:2,active:3,inactive:4};return (rank[a.tone]??9)-(rank[b.tone]??9)||String(a.p.name).localeCompare(String(b.p.name),"de");
  });
  tariffMonitorRows.innerHTML=rows.map(r=>{
    const areas=unique((r.latest?.blocks||[]).map(b=>b.modelLabel||b.sheet||b.model)).slice(0,3);
    return `<tr><td>${dashboardProviderAvatar(r.p.name)}<div class="tariff-provider-name"><strong>${esc(r.p.name)}</strong><small>${esc(r.p.status==="inactive"?"inaktiv":"aktiv")}</small></div></td><td><strong>${esc(r.latest?.version||"—")}</strong></td><td>${r.latest?dateText(r.latest.updatedAt||r.latest.createdAt):"—"}${Number.isFinite(r.days)?`<small>${r.days} Tage</small>`:""}</td><td>${areas.length?areas.map(a=>`<span class="mini-tariff-chip">${esc(a)}</span>`).join(""):"—"}</td><td>${r.countries.length?r.countries.map(c=>`<span class="stats-country-badge">${esc(c)}</span>`).join(" "):"—"}</td><td><span class="monitor-status ${r.tone}">${esc(r.status)}</span></td></tr>`;
  }).join("")||`<tr><td colspan="6" class="empty-state">Noch keine Dienstleister vorhanden.</td></tr>`;
}

function normalizeInvoiceCause(x){
  const raw=String(x.reason||x.cause||x.issue||x.note||"").toLowerCase();
  if(/floater|diesel/.test(raw))return "Floater";
  if(/zone|plz/.test(raw))return "Zone";
  if(/gewicht|weight|kg/.test(raw))return "Gewicht";
  if(/ldm|lademeter/.test(raw))return "LDM";
  if(/avis/.test(raw))return "Avis";
  if(/maut|toll/.test(raw))return "Maut";
  if(/zuschlag|surcharge|service/.test(raw))return "Zuschlag";
  if(/tarif|version/.test(raw))return "Tarifstand";
  return x.status==="Nicht zugeordnet"?"Nicht zugeordnet":"Sonstiges";
}
function invoiceDeviationValue(x){
  const direct=Number(x.deviation??x.difference??x.delta);
  if(Number.isFinite(direct))return direct;
  const actual=Number(x.invoiceAmount??x.actualAmount??x.amount),expected=Number(x.expectedAmount??x.targetAmount??x.expected);
  return Number.isFinite(actual)&&Number.isFinite(expected)?actual-expected:NaN;
}
function renderInvoiceAnalytics(){
  const rows=readInvoiceChecks();
  const checked=rows.filter(x=>x.status&&x.status!=="Entwurf");
  const deviations=checked.filter(x=>/abweich|nicht zugeordnet/i.test(String(x.status||""))||Math.abs(invoiceDeviationValue(x)||0)>0.01);
  const unmatched=checked.filter(x=>/nicht zugeordnet/i.test(String(x.status||"")));
  const amount=deviations.reduce((s,x)=>s+Math.abs(invoiceDeviationValue(x)||0),0);
  auditChecked.textContent=new Intl.NumberFormat("de-DE").format(checked.length);
  auditDeviationCount.textContent=new Intl.NumberFormat("de-DE").format(deviations.length);
  auditDeviationAmount.textContent=moneyFmt.format(amount);
  auditUnmatched.textContent=new Intl.NumberFormat("de-DE").format(unmatched.length);
  const causes=["Floater","Zone","Gewicht","LDM","Avis","Maut","Zuschlag","Tarifstand","Sonstiges"];
  const providers=unique(deviations.map(x=>x.provider||x.forwarder||x.carrier).filter(Boolean)).slice(0,10);
  invoiceDeviationHead.innerHTML=`<tr><th>Dienstleister</th>${causes.map(c=>`<th>${c}</th>`).join("")}</tr>`;
  const vals=[];
  const matrix=providers.map(p=>causes.map(c=>{const n=deviations.filter(x=>(x.provider||x.forwarder||x.carrier)===p&&normalizeInvoiceCause(x)===c).length;if(n)vals.push(n);return n;}));
  const max=vals.length?Math.max(...vals):1;
  invoiceDeviationBody.innerHTML=providers.map((p,ri)=>`<tr><th>${esc(p)}</th>${causes.map((c,ci)=>{const v=matrix[ri][ci];return `<td class="provider-country-cell" style="background:${heatColor(v,0,max)}">${v||"—"}</td>`}).join("")}</tr>`).join("")||`<tr><td colspan="${causes.length+1}" class="empty-state">Noch keine Rechnungsprüfungen vorhanden.</td></tr>`;
  const top=[...deviations].sort((a,b)=>Math.abs(invoiceDeviationValue(b)||0)-Math.abs(invoiceDeviationValue(a)||0)).slice(0,8);
  auditTopRows.innerHTML=top.map(x=>`<tr><td><strong>${esc(x.provider||x.forwarder||x.carrier||"—")}</strong></td><td>${esc(normalizeInvoiceCause(x))}</td><td><strong>${moneyFmt.format(invoiceDeviationValue(x)||0)}</strong></td></tr>`).join("")||`<tr><td colspan="3" class="empty-state">Noch keine Abweichungen vorhanden.</td></tr>`;
}
function buildZoneRateMatrix(){
  const rates=readRateOutputs().filter(r=>Number.isFinite(Number(r.price)));
  return rates.map(r=>({
    provider:String(r.provider||"—"),
    country:countryFromRate(r)||"—",
    zone:String(r.zone||r.relationName||"—"),
    model:String(r.rateModel||r.product||"—"),
    chargeFrom:r.chargeFrom,chargeTo:r.chargeTo,
    price:Number(r.price)
  }));
}
function renderZoneComparison(){
  const rows=buildZoneRateMatrix();
  const countries=unique(rows.map(x=>x.country)).filter(x=>x!=="—");
  const models=unique(rows.map(x=>x.model)).filter(x=>x!=="—");
  const oldC=zoneCompareCountry.value,oldM=zoneCompareModel.value;
  zoneCompareCountry.innerHTML=`<option value="">Alle</option>${countries.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join("")}`;
  zoneCompareModel.innerHTML=`<option value="">Alle</option>${models.map(m=>`<option value="${esc(m)}">${esc(m)}</option>`).join("")}`;
  if(countries.includes(oldC))zoneCompareCountry.value=oldC;if(models.includes(oldM))zoneCompareModel.value=oldM;
  const filtered=rows.filter(x=>(!zoneCompareCountry.value||x.country===zoneCompareCountry.value)&&(!zoneCompareModel.value||x.model===zoneCompareModel.value));
  const providers=unique(filtered.map(x=>x.provider)).slice(0,12);
  const zones=unique(filtered.map(x=>x.zone)).slice(0,30);
  zoneCompareHead.innerHTML=`<tr><th>Zone</th>${providers.map(p=>`<th>${esc(p)}</th>`).join("")}</tr>`;
  const allVals=[];
  const matrix=zones.map(z=>{
    const byP=providers.map(p=>{
      const vals=filtered.filter(x=>x.zone===z&&x.provider===p).map(x=>x.price);
      const v=vals.length?avg(vals):NaN;if(Number.isFinite(v))allVals.push(v);return v;
    });
    return {z,byP};
  });
  const min=allVals.length?Math.min(...allVals):0,max=allVals.length?Math.max(...allVals):1;
  zoneCompareBody.innerHTML=matrix.map(row=>{
    const valid=row.byP.filter(Number.isFinite),best=valid.length?Math.min(...valid):NaN,median=valid.length?[...valid].sort((a,b)=>a-b)[Math.floor(valid.length/2)]:NaN;
    return `<tr><th>${esc(row.z)}</th>${row.byP.map(v=>{let shown="—",heat=v;if(Number.isFinite(v)){if(zoneCompareMetric.value==="index"){const idx=median?100*v/median:100;shown=`${Math.round(idx)}`;heat=idx}else if(zoneCompareMetric.value==="gap"){const gap=best?100*(v-best)/best:0;shown=`${Math.round(gap)} %`;heat=gap}else shown=moneyFmt.format(v)}return `<td class="provider-country-cell" style="background:${heatColor(heat,zoneCompareMetric.value==="price"?min:0,zoneCompareMetric.value==="price"?max:Math.max(1,...row.byP.filter(Number.isFinite).map(vv=>zoneCompareMetric.value==="index"?(median?100*vv/median:100):(best?100*(vv-best)/best:0))))}">${shown}</td>`}).join("")}</tr>`;
  }).join("")||`<tr><td colspan="${providers.length+1}" class="empty-state">Keine Tarifdaten für diese Auswahl.</td></tr>`;
}
function plausibilityChecks(){
  const rates=readRateOutputs().filter(r=>Number.isFinite(Number(r.price)));
  const zones=readZoneRules();
  const imports=readTariffImports();
  const issues=[];
  // Duplicate numeric zone assignments per provider/country
  const zGroups={};
  zones.forEach(z=>{const k=[z.provider||"",z.destCountry||"",z.manualZoneNumber||z.zone||""].join("|");(zGroups[k]??=[]).push(z)});
  Object.entries(zGroups).forEach(([k,arr])=>{if(arr.length>1&&arr[0].manualZoneNumber)issues.push({sev:"warning",provider:arr[0].provider||"—",scope:arr[0].destCountry||"—",msg:`Zone ${arr[0].manualZoneNumber} mehrfach vergeben.`})});
  // Missing postcode starts / gaps within same provider+country when postcode zones exist
  const byPC={};
  zones.filter(z=>z.destPostcodeFrom&&z.destPostcodeTo).forEach(z=>{const k=[z.provider||"",z.destCountry||""].join("|");(byPC[k]??=[]).push(z)});
  Object.entries(byPC).forEach(([k,arr])=>{
    const sorted=arr.slice().sort((a,b)=>String(a.destPostcodeFrom).localeCompare(String(b.destPostcodeFrom),undefined,{numeric:true}));
    for(let i=1;i<sorted.length;i++){
      const prev=Number(sorted[i-1].destPostcodeTo),cur=Number(sorted[i].destPostcodeFrom);
      if(Number.isFinite(prev)&&Number.isFinite(cur)&&cur>prev+1)issues.push({sev:"info",provider:sorted[i].provider||"—",scope:sorted[i].destCountry||"—",msg:`PLZ-Lücke zwischen ${sorted[i-1].destPostcodeTo} und ${sorted[i].destPostcodeFrom}.`});
    }
  });
  // Price jumps within same provider/model/country/zone by chargeTo
  const groups={};
  rates.forEach(r=>{const k=[r.provider||"",r.rateModel||"",r.destCountry||"",r.zone||""].join("|");(groups[k]??=[]).push(r)});
  Object.values(groups).forEach(arr=>{
    const sorted=arr.filter(r=>Number.isFinite(Number(r.chargeTo))).sort((a,b)=>Number(a.chargeTo)-Number(b.chargeTo));
    for(let i=1;i<sorted.length;i++){
      const a=Number(sorted[i-1].price),b=Number(sorted[i].price);
      if(a>0&&b>0&&b/a>1.6)issues.push({sev:"warning",provider:sorted[i].provider||"—",scope:`${sorted[i].destCountry||"—"} · ${sorted[i].rateModel||"—"}`,msg:`Preissprung +${Math.round((b/a-1)*100)} % bei Staffel ${sorted[i].chargeTo}.`});
      if(a>0&&b>0&&b<a*0.8)issues.push({sev:"warning",provider:sorted[i].provider||"—",scope:`${sorted[i].destCountry||"—"} · ${sorted[i].rateModel||"—"}`,msg:`Preis fällt bei höherer Staffel um ${Math.round((1-b/a)*100)} %.`});
    }
  });
  // Missing FTL after LDM where LDM goes high
  imports.forEach(batch=>{
    const br=rates.filter(r=>r.batchId===batch.id);
    const hasLdm=br.some(r=>/LDM/.test(String(r.rateModel)));
    const maxLdm=Math.max(0,...br.map(r=>Number(r.chargeTo)).filter(Number.isFinite));
    const hasFtl=br.some(r=>r.rateModel==="FULL_LOAD");
    if(hasLdm&&maxLdm>=8&&!hasFtl)issues.push({sev:"info",provider:batch.provider||"—",scope:"LDM/FTL",msg:"LDM-Tarif erkannt, aber kein separater FTL-Block vorhanden."});
    if(Number(batch.reviewCount)>0)issues.push({sev:"critical",provider:batch.provider||"—",scope:"Import",msg:`${batch.reviewCount} Tarifbereich(e) noch im Review.`});
  });
  return issues;
}
function renderPlausibility(){
  const issues=plausibilityChecks();
  plausCritical.textContent=issues.filter(x=>x.sev==="critical").length;
  plausWarning.textContent=issues.filter(x=>x.sev==="warning").length;
  plausInfo.textContent=issues.filter(x=>x.sev==="info").length;
  const rank={critical:0,warning:1,info:2};
  plausibilityRows.innerHTML=issues.sort((a,b)=>rank[a.sev]-rank[b.sev]).slice(0,40).map(x=>`<tr><td><span class="plaus-status ${x.sev}">${x.sev==="critical"?"Kritisch":x.sev==="warning"?"Warnung":"Hinweis"}</span></td><td><strong>${esc(x.provider)}</strong></td><td>${esc(x.scope)}</td><td>${esc(x.msg)}</td></tr>`).join("")||`<tr><td colspan="4" class="empty-state">Keine Auffälligkeiten erkannt.</td></tr>`;
}
function render(){
  populateFilters();
  const data=filteredData();
  renderKpis(data);renderHeatmap(data);renderInsights(data);renderTransport(data);renderProviders(data);renderHotspots(data);
  renderProviderCountryHeatmap(data);renderSavings(data);renderTariffMonitor();
  renderInvoiceAnalytics();renderZoneComparison();renderPlausibility();
}

[periodSelect,countryFilter,providerFilter,tariffFilter,transportFilter,metricFilter,providerCountryMetric,zoneCompareCountry,zoneCompareModel,zoneCompareMetric].forEach(el=>el.addEventListener("change",render));resetDashboardFilters.addEventListener("click",()=>{countryFilter.value=providerFilter.value=tariffFilter.value=transportFilter.value="";metricFilter.value="avg";periodSelect.value="30";render()});refreshDashboardBtn.addEventListener("click",()=>{render();showToast("Statistiken aktualisiert.")});exportDashboardBtn.addEventListener("click",()=>{const data=filteredData();const rows=[["Datum","Land","PLZ","Zone","Dienstleister","Transportart","Tariftyp","Paletten","Gewicht kg","Preis EUR"],...data.map(x=>[x.createdAt||"",x.country||"",x.postalCode||"",x.zone||"",x.provider||"",normalTransport(x),rateType(x),Number.isFinite(palletValue(x))?palletValue(x):"",Number.isFinite(weightValue(x))?weightValue(x):"",Number(x.price)||0])];const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(";")).join("\n");const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`GPK_Statistiken_${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(a.href)});
render();

async function loadBookingUserStats(){if(!window.bookingUserStatsRows||!window.GPKApi)return;try{const d=await GPKApi.bookingStats();bookingUserStatsRows.innerHTML=d.map(x=>`<tr><td><strong>${esc(x.name)}</strong><small>${esc(x.email)}</small></td><td><strong>${x.bookings}</strong></td><td>${GPK.formatEuro(x.volume)}</td><td>${GPK.formatEuro(x.avg_price)}</td></tr>`).join("")||'<tr><td colspan="4" class="empty-state">Noch keine Buchungen vorhanden.</td></tr>'}catch(e){bookingUserStatsRows.innerHTML=`<tr><td colspan="4" class="empty-state">${esc(e.message)}</td></tr>`}}
document.addEventListener("gpk:user-ready",loadBookingUserStats);document.addEventListener("gpk:data-ready",()=>{render();loadBookingUserStats()});
