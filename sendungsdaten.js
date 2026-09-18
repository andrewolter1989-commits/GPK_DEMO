
const SHIPMENT_KEY=GPK.KEYS.shipments;
const SHIPMENT_IMPORT_KEY=GPK.KEYS.shipmentImports;
let shipments=[];
let shipmentImports=GPK.read(SHIPMENT_IMPORT_KEY,[])||[];
let customFieldDefs=GPK.read(GPK.KEYS.shipmentFields,[])||[];
let importConfig=GPK.read(GPK.KEYS.shipmentImportConfig,{shipmentIdTemplate:""})||{shipmentIdTemplate:""};
let importState={file:null,sheets:[],sheetName:"",rows:[],headerRow:0,headers:[],mapping:{},normalized:[]};

const FIELD_DEFS=[
  ["shipmentId","Sendungsnummer",["sendungsnummer","sdg_nr","sdg","shipment","shipment_id","consignment","consignment_no","consignment_number","shipmentnumber","sending","paketnummer","parcel_number"]],
  ["shipmentDate","Versand-/Abholdatum",["versanddatum","shipment_date","ship_date","datum","abholdatum","pickup_date","shipping_date","versandtag"]],
  ["deliveryDate","Lieferdatum",["lieferdatum","zustelldatum","delivery_date","deliverydate","pod_date"]],
  ["originCountry","Start Land",["origin_country","versender_land","land_versender","abgangsland","country_origin","from_country"]],
  ["originPostal","Start PLZ",["origin_postal","origin_zip","plz_versender","versender_plz","abgangsplz","from_zip","pickup_postcode"]],
  ["originCity","Start Ort",["origin_city","versender_ort","ort_versender","abgangsort","from_city"]],
  ["destCountry","Ziel Land",["destination_country","dest_country","empfaenger_land","land_empfaenger","zielland","country_destination","to_country"]],
  ["destPostal","Ziel PLZ",["destination_postal","dest_postal","dest_zip","plz_empfaenger","empfaenger_plz","ziel_plz","to_zip","postcode"]],
  ["destCity","Ziel Ort",["destination_city","dest_city","empfaenger_ort","ort_empfaenger","zielort","to_city"]],
  ["carrier","Dienstleister",["dienstleister","spediteur","spedition","carrier","forwarder","frachtfuehrer","frachtführer"]],
  ["service","Service / Produkt",["service","produkt","product","versandart","serviceart","service_type","transportart"]],
  ["customer","Empfänger / Kunde",["empfaenger","empfänger","customer","kunde","consignee","receiver"]],
  ["pallets","Paletten",["paletten","palette","pallets","pll","euro_paletten","europaletten"]],
  ["colli","Colli / Packstücke",["colli","packstuecke","packstücke","packages","pieces","anzahl_packstuecke","quantity"]],
  ["weight","Gewicht kg",["gewicht","weight","gewicht_kg","weight_kg","bruttogewicht","kg"]],
  ["ldm","Lademeter",["ldm","lademeter","loading_meters","load_meters"]],
  ["volume","Volumen m³",["volumen","volume","cbm","m3","kubikmeter","cubic_meter"]],
  ["slots","Stellplätze",["stellplaetze","stellplätze","slots","stellplatz","sp"]],
  ["freight","Fracht / Basis",["fracht","freight","freight_cost","basisfracht","transportkosten","logistikkosten","logistics_cost"]],
  ["diesel","Diesel / Fuel",["diesel","fuel","fuel_surcharge","dieselzuschlag","fuel_surcharge_amount"]],
  ["toll","Maut",["maut","toll","road_toll"]],
  ["otherCharges","Nebenkosten",["nebenkosten","other_charges","surcharge","zuschlag","zuschlaege","zuschläge","insurance","versicherung"]],
  ["actualTotal","Gesamtkosten",["gesamtpreis","actual_total","total","revtotal","umsatz","betrag","revenue","total_cost","total_freight"]]
];

function esc(v=""){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function norm(v=""){return String(v??"").trim().toLowerCase().replace(/[ä]/g,"ae").replace(/[ö]/g,"oe").replace(/[ü]/g,"ue").replace(/[ß]/g,"ss").replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"")}
function num(v){if(v===null||v===undefined||v==="")return null;const x=String(v).replace(/\s/g,"").replace(/\.(?=\d{3}(?:\D|$))/g,"").replace(",",".").replace(/[^\d.+-]/g,"");const n=Number(x);return Number.isFinite(n)?n:null}
function dateText(v){if(!v)return "";const s=String(v).trim();let m=s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/);if(m){const y=m[3].length===2?"20"+m[3]:m[3];return `${y}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`}if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);return s}
function money(v){return new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR",maximumFractionDigits:2}).format(Number(v)||0)}
function intFmt(v){return new Intl.NumberFormat("de-DE",{maximumFractionDigits:0}).format(Number(v)||0)}
function decFmt(v,d=1){return new Intl.NumberFormat("de-DE",{maximumFractionDigits:d}).format(Number(v)||0)}
function showToast(t){const el=document.getElementById("shipmentToast");el.textContent=t;el.hidden=false;setTimeout(()=>el.hidden=true,3000)}
function totalCost(x){const t=num(x.actualTotal);if(t!==null)return t;return [x.freight,x.diesel,x.toll,x.otherCharges].reduce((a,v)=>a+(num(v)||0),0)}
function hasCost(x){return [x.actualTotal,x.freight,x.diesel,x.toll,x.otherCharges].some(v=>num(v)!==null&&num(v)!==0)}
function currentMapValue(row,key){const idx=Number(importState.mapping[key]);return Number.isInteger(idx)&&idx>=0?(row[idx]??""):""}
function colLetter(i){let n=i+1,s="";while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26)}return s}
function displayHeader(i){return `${colLetter(i)} · ${importState.headers[i]||`Spalte ${i+1}`}`}

function autoMap(headers){
  const normalized=headers.map(h=>norm(h));
  const map={};
  FIELD_DEFS.forEach(([key,label,aliases])=>{
    let best=-1,bestScore=0;
    normalized.forEach((h,i)=>{
      if(!h)return;
      let score=0;
      for(const a0 of aliases){
        const a=norm(a0);
        if(h===a)score=Math.max(score,100);
        else if(a.length>=5&&h.length>=5&&(h.startsWith(a+"_")||h.endsWith("_"+a)||h.includes("_"+a+"_")))score=Math.max(score,82);
      }
      if(score>bestScore){bestScore=score;best=i}
    });
    map[key]=best>=0&&bestScore>=80?String(best):"";
  });
  return map;
}
function looksLikeDate(v){return /^\d{1,4}[.\/-]\d{1,2}[.\/-]\d{1,4}/.test(String(v||"").trim())}
function looksLikeDataValue(v){
  const t=String(v??"").trim();
  return /^\d+(?:[.,]\d+)?$/.test(t)||looksLikeDate(t)||/^[A-Z]{2}$/.test(t)||/^\d{4,6}$/.test(t);
}
function headerScore(row,nextRows=[]){
  const cells=(row||[]).map(v=>String(v??"").trim());
  const non=cells.map((v,i)=>({v,i})).filter(x=>x.v);
  if(non.length<3)return -999;
  const mapped=autoMap(cells),known=Object.values(mapped).filter(v=>v!=="").length;
  const textish=non.filter(x=>/[A-Za-zÄÖÜäöüß]/.test(x.v)&&!looksLikeDate(x.v)).length;
  const dataish=non.filter(x=>looksLikeDataValue(x.v)).length;
  const unique=new Set(non.map(x=>norm(x.v))).size;
  let continuation=0;
  for(const r of nextRows.slice(0,3)){
    const vals=(r||[]).filter(v=>String(v??"").trim()!=="");
    if(vals.length>=Math.max(2,non.length*.35))continuation++;
  }
  return known*35+textish*2+unique-dataish*7+continuation*3;
}
function bestHeaderForSheet(rows){
  let best={row:0,score:-999};
  for(let i=0;i<Math.min(50,rows.length);i++){
    const score=headerScore(rows[i],rows.slice(i+1,i+4));
    if(score>best.score)best={row:i,score};
  }
  return best;
}
function candidateHeaderRows(rows,bestRow){
  const scored=[];
  for(let i=0;i<Math.min(50,rows.length);i++){
    const non=(rows[i]||[]).filter(v=>String(v??"").trim()).length;
    if(non<2)continue;
    scored.push({row:i,score:headerScore(rows[i],rows.slice(i+1,i+4))});
  }
  scored.sort((a,b)=>b.score-a.score);
  const chosen=[{row:bestRow,score:scored.find(x=>x.row===bestRow)?.score||0},...scored.filter(x=>x.row!==bestRow).slice(0,9)];
  return chosen.sort((a,b)=>a.row-b.row);
}

async function readShipmentWorkbook(file){
  if(file.name.toLowerCase().endsWith(".csv")){
    const text=await file.text(),rows=parseSimpleCSV(text.replace(/^\uFEFF/,""));
    return [{name:"CSV",rows}];
  }
  const XLSX=await ensureXLSX(),data=await file.arrayBuffer(),wb=XLSX.read(data,{type:"array",cellDates:false});
  return wb.SheetNames.map(name=>({name,rows:XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:"",raw:false})}));
}
function setHeaderRow(rowIndex,remap=true){
  importState.headerRow=Number(rowIndex)||0;
  const row=importState.rows[importState.headerRow]||[];
  importState.headers=row.map((v,i)=>String(v??"").trim()||`Spalte ${i+1}`);
  if(remap)importState.mapping=autoMap(importState.headers);
  renderHeaderControls();
  renderMapping();
  renderCustomFields();
  normalizeImportRows();
  renderPreview();
  const mapped=Object.values(importState.mapping).filter(v=>v!=="").length;
  const info=document.getElementById("shipmentImportInfo");
  if(info&&!info.hidden){
    const blocks=info.querySelectorAll("strong");
    if(blocks[2])blocks[2].textContent=`Zeile ${importState.headerRow+1}`;
    if(blocks[3])blocks[3].textContent=String(mapped);
    if(blocks[4])blocks[4].textContent=importState.normalized.length.toLocaleString("de-DE");
  }
}
function renderHeaderControls(){
  const select=document.getElementById("shipmentHeaderRowSelect");if(!select)return;
  const candidates=candidateHeaderRows(importState.rows,importState.headerRow);
  select.innerHTML=candidates.map(x=>{
    const vals=(importState.rows[x.row]||[]).filter(v=>String(v??"").trim()).slice(0,6).join(" | ");
    return `<option value="${x.row}">Zeile ${x.row+1}: ${esc(vals||"(leer)")}</option>`;
  }).join("");
  select.value=String(importState.headerRow);
  document.getElementById("shipmentHeaderPreview").innerHTML=importState.headers.map((h,i)=>`<span><b>${colLetter(i)}</b>${esc(h)}</span>`).join("");
}
function mappingOptions(selected=""){
  return ['<option value="">Nicht zuordnen</option>',...importState.headers.map((h,i)=>`<option value="${i}" ${String(i)===String(selected)?"selected":""}>${esc(displayHeader(i))}</option>`)].join("");
}
function rowValueByHeader(row,headerName){
  const needle=norm(headerName);
  const idx=importState.headers.findIndex(h=>norm(h)===needle);
  return idx>=0?(row[idx]??""):"";
}
function applyExtract(value,pattern){
  if(!pattern)return value;
  try{
    const re=new RegExp(pattern),m=String(value??"").match(re);
    return m?(m[1]??m[0]):"";
  }catch(_){return value}
}
function templateValue(template,value,row,seq){
  let d=dateText(currentMapValue(row,"shipmentDate"))||dateText(currentMapValue(row,"deliveryDate"));
  const dm=d.match(/^(\d{4})-(\d{2})-(\d{2})$/),yyyy=dm?.[1]||"",mm=dm?.[2]||"",dd=dm?.[3]||"";
  let out=String(template||"");
  const repl={VALUE:value??"",YYYY:yyyy,YY:yyyy.slice(-2),MM:mm,DD:dd,SEQ:String(seq),SEQ4:String(seq).padStart(4,"0"),ROW:String(importState.headerRow+1+seq)};
  Object.entries(repl).forEach(([k,v])=>out=out.replaceAll(`{${k}}`,String(v)));
  out=out.replace(/\{([^{}]+)\}/g,(m,name)=>{
    const v=rowValueByHeader(row,name);
    return v!==""?String(v):m;
  });
  return out;
}
function customValue(def,row,seq){
  const idx=Number(def.sourceIndex),raw=Number.isInteger(idx)&&idx>=0?(row[idx]??""):"";
  const extracted=applyExtract(raw,def.extract||"");
  if(def.mode==="fixed")return def.template||"";
  if(def.mode==="template")return templateValue(def.template||"{VALUE}",extracted,row,seq);
  return extracted;
}
function normalizeImportRows(){
  const out=[];
  const sourceRows=importState.rows.slice(importState.headerRow+1).filter(r=>r.some(v=>String(v??"").trim()!==""));
  sourceRows.forEach((r,i)=>{
    const seq=i+1;
    const x={id:"SHP-"+Date.now()+"-"+i,sourceFile:importState.file?.name||"",sourceSheet:importState.sheetName,sourceRow:importState.headerRow+i+2,importedAt:new Date().toISOString()};
    FIELD_DEFS.forEach(([key])=>x[key]=currentMapValue(r,key));
    const idTemplate=(document.getElementById("shipmentIdTemplate")?.value||importConfig.shipmentIdTemplate||"").trim();
    if(idTemplate)x.shipmentId=templateValue(idTemplate,x.shipmentId||"",r,seq);
    ["pallets","colli","weight","ldm","volume","slots","freight","diesel","toll","otherCharges","actualTotal"].forEach(k=>{const z=num(x[k]);x[k]=z===null?null:z});
    x.shipmentDate=dateText(x.shipmentDate);x.deliveryDate=dateText(x.deliveryDate);
    x.originCountry=String(x.originCountry||"").trim().toUpperCase();x.destCountry=String(x.destCountry||"").trim().toUpperCase();
    x.originPostal=String(x.originPostal||"").trim();x.destPostal=String(x.destPostal||"").trim();
    x.custom={};
    customFieldDefs.forEach(def=>{if(def.enabled!==false)x.custom[def.key]=customValue(def,r,seq)});
    if(Object.values(x).some(v=>v!==null&&String(v).trim()!==""))out.push(x);
  });
  importState.normalized=out;
}
function renderMapping(){
  const grid=document.getElementById("shipmentMappingGrid");if(!grid)return;
  grid.innerHTML=FIELD_DEFS.map(([key,label])=>`<label><span>${esc(label)}</span><select data-map-field="${key}">${mappingOptions(importState.mapping[key])}</select></label>`).join("");
  grid.querySelectorAll("[data-map-field]").forEach(sel=>{
    const key=sel.dataset.mapField;
    sel.addEventListener("change",()=>{importState.mapping[key]=sel.value;normalizeImportRows();renderPreview()});
  });
}
function slug(v){return norm(v||"feld").replace(/^(\d)/,"f_$1")||"feld"}
function renderCustomFields(){
  const wrap=document.getElementById("shipmentCustomFieldRows");if(!wrap)return;
  wrap.innerHTML=customFieldDefs.length?customFieldDefs.map((d,i)=>`<div class="shipment-custom-field-row" data-custom-index="${i}">
    <input data-cf="${i}:label" value="${esc(d.label||"")}" placeholder="Feldname">
    <input data-cf="${i}:key" value="${esc(d.key||"")}" placeholder="technischer Schlüssel">
    <select data-cf="${i}:sourceIndex">${mappingOptions(d.sourceIndex)}</select>
    <select data-cf="${i}:mode">
      <option value="source" ${d.mode==="source"?"selected":""}>Quellwert</option>
      <option value="template" ${d.mode==="template"?"selected":""}>Format / Vorlage</option>
      <option value="fixed" ${d.mode==="fixed"?"selected":""}>Festwert</option>
    </select>
    <input data-cf="${i}:extract" value="${esc(d.extract||"")}" placeholder="Auszug (Regex), z. B. (\\d+)">
    <input data-cf="${i}:template" value="${esc(d.template||"")}" placeholder="z. B. REF-{VALUE}">
    <button type="button" data-cf-delete="${i}" title="Feld löschen">×</button>
  </div>`).join(""):'<div class="shipment-custom-empty">Noch keine eigenen Felder angelegt.</div>';
  wrap.querySelectorAll("[data-cf]").forEach(el=>el.addEventListener("change",()=>{
    const [i,k]=el.dataset.cf.split(":");customFieldDefs[Number(i)][k]=el.value;
    if(k==="label"&&!customFieldDefs[Number(i)].key)customFieldDefs[Number(i)].key=slug(el.value);
    GPK.write(GPK.KEYS.shipmentFields,customFieldDefs);normalizeImportRows();renderPreview();
  }));
  wrap.querySelectorAll("[data-cf-delete]").forEach(btn=>btn.addEventListener("click",()=>{
    customFieldDefs.splice(Number(btn.dataset.cfDelete),1);GPK.write(GPK.KEYS.shipmentFields,customFieldDefs);renderCustomFields();normalizeImportRows();renderPreview();
  }));
}
function renderPreview(){
  normalizeImportRows();
  const rows=importState.normalized.slice(0,12),customCols=customFieldDefs.filter(d=>d.enabled!==false).slice(0,3);
  document.getElementById("shipmentPreviewMeta").textContent=`${importState.sheetName} · Kopfzeile ${importState.headerRow+1} · ${importState.normalized.length.toLocaleString("de-DE")} Datenzeilen`;
  document.getElementById("shipmentPreviewHead").innerHTML="<tr><th>Sendung</th><th>Datum</th><th>Dienstleister</th><th>Relation</th><th>Paletten</th><th>Gewicht</th><th>LDM</th><th>Kosten</th>"+customCols.map(d=>`<th>${esc(d.label)}</th>`).join("")+"</tr>";
  document.getElementById("shipmentPreviewRows").innerHTML=rows.map(x=>`<tr><td>${esc(x.shipmentId||"—")}</td><td>${esc(x.shipmentDate||"—")}</td><td>${esc(x.carrier||"—")}</td><td>${esc([x.originCountry,x.originPostal].filter(Boolean).join(" ")||"—")} → ${esc([x.destCountry,x.destPostal].filter(Boolean).join(" ")||"—")}</td><td>${x.pallets??"—"}</td><td>${x.weight!=null?decFmt(x.weight,1)+" kg":"—"}</td><td>${x.ldm!=null?decFmt(x.ldm,2):"—"}</td><td>${hasCost(x)?money(totalCost(x)):"—"}</td>${customCols.map(d=>`<td>${esc(x.custom?.[d.key]??"—")}</td>`).join("")}</tr>`).join("");
}
function activateTab(name){
  document.querySelectorAll("[data-shipment-tab]").forEach(b=>b.classList.toggle("active",b.dataset.shipmentTab===name));
  ["overview","shipments","benchmark","import"].forEach(n=>{document.getElementById("shipment"+n[0].toUpperCase()+n.slice(1)+"Panel").hidden=n!==name});
}
document.querySelectorAll("[data-shipment-tab]").forEach(b=>b.addEventListener("click",()=>activateTab(b.dataset.shipmentTab)));

async function loadShipmentFile(file){
  try{
    const sheets=await readShipmentWorkbook(file);
    const scored=sheets.map(sh=>({sh,...bestHeaderForSheet(sh.rows)})).sort((a,b)=>b.score-a.score);
    const best=scored[0];
    if(!best||best.score<0){showToast("Keine brauchbare Tabellenstruktur erkannt.");return}
    importState.file=file;importState.sheets=sheets;importState.sheetName=best.sh.name;importState.rows=best.sh.rows;
    importState.headerRow=best.row;importState.headers=(best.sh.rows[best.row]||[]).map((v,i)=>String(v??"").trim()||`Spalte ${i+1}`);
    importState.mapping=autoMap(importState.headers);
    document.getElementById("shipmentIdTemplate").value=importConfig.shipmentIdTemplate||"";
    normalizeImportRows();
    const mapped=Object.values(importState.mapping).filter(v=>v!=="").length;
    document.getElementById("shipmentImportInfo").hidden=false;
    document.getElementById("shipmentImportInfo").innerHTML=`<div><span>Datei</span><strong>${esc(file.name)}</strong></div><div><span>Arbeitsblatt</span><strong>${esc(best.sh.name)}</strong></div><div><span>Kopfzeile</span><strong>Zeile ${best.row+1}</strong></div><div><span>Felder erkannt</span><strong>${mapped}</strong></div><div><span>Datenzeilen</span><strong>${importState.normalized.length.toLocaleString("de-DE")}</strong></div>`;
    document.getElementById("shipmentMappingCard").hidden=false;document.getElementById("shipmentPreviewCard").hidden=false;
    renderHeaderControls();renderMapping();renderCustomFields();renderPreview();activateTab("import");
  }catch(err){console.error(err);showToast("Datei konnte nicht gelesen werden.")}
}

function renderAll(){
  const data=shipments;
  shipmentCount.textContent=intFmt(data.length);
  shipmentCostTotal.textContent=money(data.reduce((s,x)=>s+(hasCost(x)?totalCost(x):0),0));
  shipmentWeightTotal.textContent=intFmt(data.reduce((s,x)=>s+(num(x.weight)||0),0))+" kg";
  shipmentCountryCount.textContent=new Set(data.map(x=>x.destCountry).filter(Boolean)).size;
  const completeness=[["Ziel-PLZ","destPostal"],["Gewicht","weight"],["Paletten","pallets"],["LDM","ldm"],["Volumen","volume"],["Kosten","actualTotal"],["Dienstleister","carrier"],["Datum","shipmentDate"]];
  shipmentCompleteness.innerHTML=completeness.map(([label,key])=>{const c=data.filter(x=>x[key]!==null&&x[key]!==undefined&&String(x[key]).trim()!=="").length,p=data.length?Math.round(c/data.length*100):0;return `<div><span>${label}</span><strong>${p}%</strong><div><i style="width:${p}%"></i></div></div>`}).join("");
  shipmentImportRows.innerHTML=shipmentImports.slice().sort((a,b)=>new Date(b.importedAt)-new Date(a.importedAt)).slice(0,8).map(x=>`<tr><td><strong>${esc(x.fileName)}</strong></td><td>${esc(x.sheetName||"—")}</td><td>${intFmt(x.count)}</td><td>${new Date(x.importedAt).toLocaleDateString("de-DE")}</td></tr>`).join("")||'<tr><td colspan="4" class="empty-state">Noch keine Sendungsdaten importiert.</td></tr>';
  const carriers=[...new Set(data.map(x=>x.carrier).filter(Boolean))].sort(),countries=[...new Set(data.map(x=>x.destCountry).filter(Boolean))].sort();
  shipmentCarrierFilter.innerHTML='<option value="">Alle Dienstleister</option>'+carriers.map(v=>`<option>${esc(v)}</option>`).join("");
  shipmentCountryFilter.innerHTML='<option value="">Alle Länder</option>'+countries.map(v=>`<option>${esc(v)}</option>`).join("");
  renderShipmentTable();renderBenchmark();
}
function renderShipmentTable(){
  const q=shipmentSearch.value.trim().toLowerCase(),carrier=shipmentCarrierFilter.value,country=shipmentCountryFilter.value,cost=shipmentCostFilter.value;
  const filtered=shipments.filter(x=>{const custom=Object.values(x.custom||{}).join(" ");const hay=`${x.shipmentId} ${x.carrier} ${x.originPostal} ${x.destPostal} ${x.destCity} ${x.customer} ${x.service} ${custom}`.toLowerCase();return (!q||hay.includes(q))&&(!carrier||x.carrier===carrier)&&(!country||x.destCountry===country)&&(!cost||(cost==="with"?hasCost(x):!hasCost(x)))});
  visibleShipmentCount.textContent=intFmt(filtered.length);
  shipmentRows.innerHTML=filtered.slice(0,1000).map(x=>`<tr><td><strong>${esc(x.shipmentId||"—")}</strong><small>${esc(x.sourceFile||"")}</small></td><td>${esc(x.shipmentDate||"—")}</td><td>${esc(x.carrier||"—")}</td><td><strong>${esc([x.destCountry,x.destPostal].filter(Boolean).join(" ")||"—")}</strong><small>${esc(x.destCity||x.customer||"")}</small></td><td>${esc(x.service||"—")}</td><td>${x.pallets!=null?`${decFmt(x.pallets,1)} PLL`:x.colli!=null?`${decFmt(x.colli,1)} Colli`:"—"}</td><td>${x.weight!=null?`${decFmt(x.weight,1)} kg`:"—"}</td><td>${x.ldm!=null?`${decFmt(x.ldm,2)} LDM`:x.volume!=null?`${decFmt(x.volume,2)} m³`:"—"}</td><td><strong>${hasCost(x)?money(totalCost(x)):"—"}</strong></td></tr>`).join("")||'<tr><td colspan="9" class="empty-state">Keine Sendungen für diese Auswahl.</td></tr>';
}
function renderBenchmark(){
  const data=shipments,costData=data.filter(hasCost),weightData=data.filter(x=>num(x.weight)!==null),palData=data.filter(x=>num(x.pallets)!==null),ldmData=data.filter(x=>num(x.ldm)!==null);
  avgShipmentCost.textContent=costData.length?money(costData.reduce((s,x)=>s+totalCost(x),0)/costData.length):"—";
  avgShipmentWeight.textContent=weightData.length?`${decFmt(weightData.reduce((s,x)=>s+(num(x.weight)||0),0)/weightData.length,0)} kg`:"—";
  avgShipmentPallets.textContent=palData.length?decFmt(palData.reduce((s,x)=>s+(num(x.pallets)||0),0)/palData.length,1):"—";
  avgShipmentLdm.textContent=ldmData.length?`${decFmt(ldmData.reduce((s,x)=>s+(num(x.ldm)||0),0)/ldmData.length,2)} LDM`:"—";
  const countries=[...new Set(data.map(x=>x.destCountry).filter(Boolean))].sort();
  shipmentCountryBenchmarkRows.innerHTML=countries.map(c=>{const a=data.filter(x=>x.destCountry===c),w=a.reduce((s,x)=>s+(num(x.weight)||0),0),costs=a.filter(hasCost),cs=costs.reduce((s,x)=>s+totalCost(x),0);return `<tr><td><strong>${esc(c)}</strong></td><td>${intFmt(a.length)}</td><td>${intFmt(w)} kg</td><td>${costs.length?money(cs):"—"}</td><td>${costs.length?money(cs/costs.length):"—"}</td></tr>`}).join("")||'<tr><td colspan="5" class="empty-state">Noch keine Daten.</td></tr>';
  const bands=[["0–1",0,1],["2–3",1.0001,3],["4–10",3.0001,10],["11–20",10.0001,20],[">20",20.0001,Infinity]];
  shipmentPalletBenchmarkRows.innerHTML=bands.map(([label,min,max])=>{const a=data.filter(x=>{const p=num(x.pallets);return p!==null&&p>=min&&p<=max}),costs=a.filter(hasCost),cs=costs.reduce((s,x)=>s+totalCost(x),0),share=data.length?Math.round(a.length/data.length*100):0;return `<tr><td><strong>${label} PLL</strong></td><td>${intFmt(a.length)}</td><td>${share}%</td><td>${costs.length?money(cs/costs.length):"—"}</td></tr>`}).join("");
}

[shipmentSearch,shipmentCarrierFilter,shipmentCountryFilter,shipmentCostFilter].forEach(el=>{el.addEventListener("input",renderShipmentTable);el.addEventListener("change",renderShipmentTable)});
openShipmentImportBtn.addEventListener("click",()=>{activateTab("import");shipmentFileInput.click()});
chooseShipmentFileBtn.addEventListener("click",()=>shipmentFileInput.click());
shipmentFileInput.addEventListener("change",()=>{if(shipmentFileInput.files[0])loadShipmentFile(shipmentFileInput.files[0])});
shipmentImportDrop.addEventListener("dragover",e=>{e.preventDefault();shipmentImportDrop.classList.add("dragover")});
shipmentImportDrop.addEventListener("dragleave",()=>shipmentImportDrop.classList.remove("dragover"));
shipmentImportDrop.addEventListener("drop",e=>{e.preventDefault();shipmentImportDrop.classList.remove("dragover");if(e.dataTransfer.files[0])loadShipmentFile(e.dataTransfer.files[0])});
shipmentHeaderRowSelect.addEventListener("change",()=>setHeaderRow(Number(shipmentHeaderRowSelect.value),true));
shipmentIdTemplate.addEventListener("change",()=>{importConfig.shipmentIdTemplate=shipmentIdTemplate.value.trim();GPK.write(GPK.KEYS.shipmentImportConfig,importConfig);normalizeImportRows();renderPreview()});
addShipmentCustomField.addEventListener("click",()=>{
  const nr=customFieldDefs.length+1;customFieldDefs.push({label:`Eigenes Feld ${nr}`,key:`custom_${nr}`,sourceIndex:"",mode:"source",extract:"",template:"",enabled:true});
  GPK.write(GPK.KEYS.shipmentFields,customFieldDefs);renderCustomFields();
});
cancelShipmentImportBtn.addEventListener("click",()=>{importState={file:null,sheets:[],sheetName:"",rows:[],headerRow:0,headers:[],mapping:{},normalized:[]};shipmentMappingCard.hidden=true;shipmentPreviewCard.hidden=true;shipmentImportInfo.hidden=true});
confirmShipmentImportBtn.addEventListener("click",async()=>{
  if(!importState.normalized.length){showToast("Keine Sendungen zum Importieren.");return}
  const batchId="SHIPIMP-"+Date.now(),now=new Date().toISOString(),rows=importState.normalized.map(x=>({...x,batchId}));
  const next=[...rows,...shipments];
  try{
    await GPK.largeWrite(SHIPMENT_KEY,next);
    shipments=next;
    shipmentImports.unshift({id:batchId,fileName:importState.file.name,sheetName:importState.sheetName,count:rows.length,importedAt:now,headerRow:importState.headerRow+1,mapping:{...importState.mapping},customFields:customFieldDefs.map(x=>({...x}))});
    if(!GPK.write(SHIPMENT_IMPORT_KEY,shipmentImports.slice(0,100))){showToast("Sendungen gespeichert; Import-Historie konnte nicht vollständig gespeichert werden.")}
    else showToast(`${rows.length.toLocaleString("de-DE")} Sendungen importiert.`);
    renderAll();activateTab("overview");
  }catch(err){console.error(err);showToast("Sendungsdaten konnten im großen Datenspeicher nicht gespeichert werden.")}
});
exportShipmentsBtn.addEventListener("click",async()=>{
  if(!shipments.length){showToast("Keine Sendungsdaten zum Exportieren.");return}
  const flat=shipments.map(x=>({...x,...Object.fromEntries(Object.entries(x.custom||{}).map(([k,v])=>[`custom_${k}`,v])),custom:undefined}));
  await exportWorkbook("GP_Kollund_Sendungsdaten.xlsx",{Sendungen:flat});
});
(async function init(){
  shipments=await GPK.largeRead(SHIPMENT_KEY,[]);
  renderAll();
})();
