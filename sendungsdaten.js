
const SHIPMENT_KEY=GPK.KEYS.shipments;
const SHIPMENT_IMPORT_KEY=GPK.KEYS.shipmentImports;
let shipments=GPK.read(SHIPMENT_KEY,[])||[];
let shipmentImports=GPK.read(SHIPMENT_IMPORT_KEY,[])||[];
let importState={file:null,workbook:null,sheets:[],sheetName:"",rows:[],headerRow:0,headers:[],mapping:{},normalized:[]};

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
function showToast(t){const el=document.getElementById("shipmentToast");el.textContent=t;el.hidden=false;setTimeout(()=>el.hidden=true,2600)}
function totalCost(x){const t=num(x.actualTotal);if(t!==null)return t;return [x.freight,x.diesel,x.toll,x.otherCharges].reduce((a,v)=>a+(num(v)||0),0)}
function hasCost(x){return [x.actualTotal,x.freight,x.diesel,x.toll,x.otherCharges].some(v=>num(v)!==null&&num(v)!==0)}
function fieldDef(key){return FIELD_DEFS.find(x=>x[0]===key)}
function currentMapValue(row,key){const header=importState.mapping[key];if(!header)return "";const idx=importState.headers.indexOf(header);return idx>=0?(row[idx]??""):""}

function autoMap(headers){
  const normalized=headers.map(h=>norm(h));
  const map={};
  FIELD_DEFS.forEach(([key,label,aliases])=>{
    let best=-1,bestScore=0;
    normalized.forEach((h,i)=>{
      let score=0;
      for(const a0 of aliases){
        const a=norm(a0);
        if(h===a)score=Math.max(score,100);
        else if(h.includes(a)||a.includes(h))score=Math.max(score,70);
      }
      if(score>bestScore){bestScore=score;best=i}
    });
    map[key]=best>=0&&bestScore>=70?headers[best]:"";
  });
  return map;
}

function headerScore(row){
  const heads=(row||[]).map(v=>String(v??"").trim()).filter(Boolean);
  if(heads.length<3)return 0;
  const mapped=autoMap(heads);
  return Object.values(mapped).filter(Boolean).length*10+Math.min(heads.length,20);
}

async function readShipmentWorkbook(file){
  if(file.name.toLowerCase().endsWith(".csv")){
    const text=await file.text(),rows=parseSimpleCSV(text.replace(/^\uFEFF/,""));
    return [{name:"CSV",rows}];
  }
  const XLSX=await ensureXLSX(),data=await file.arrayBuffer(),wb=XLSX.read(data,{type:"array",cellDates:false});
  return wb.SheetNames.map(name=>({name,rows:XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:"",raw:false})}));
}

function bestHeaderForSheet(rows){
  let best={row:0,score:0};
  for(let i=0;i<Math.min(35,rows.length);i++){const score=headerScore(rows[i]);if(score>best.score)best={row:i,score}}
  return best;
}

function normalizeImportRows(){
  const out=[];
  const sourceRows=importState.rows.slice(importState.headerRow+1).filter(r=>r.some(v=>String(v??"").trim()!==""));
  sourceRows.forEach((r,i)=>{
    const x={id:"SHP-"+Date.now()+"-"+i,sourceFile:importState.file?.name||"",sourceSheet:importState.sheetName,sourceRow:importState.headerRow+i+2,importedAt:new Date().toISOString()};
    FIELD_DEFS.forEach(([key])=>x[key]=currentMapValue(r,key));
    ["pallets","colli","weight","ldm","volume","slots","freight","diesel","toll","otherCharges","actualTotal"].forEach(k=>{const n=num(x[k]);x[k]=n===null?null:n});
    x.shipmentDate=dateText(x.shipmentDate);x.deliveryDate=dateText(x.deliveryDate);
    x.originCountry=String(x.originCountry||"").trim().toUpperCase();x.destCountry=String(x.destCountry||"").trim().toUpperCase();
    x.originPostal=String(x.originPostal||"").trim();x.destPostal=String(x.destPostal||"").trim();
    if(Object.values(x).some(v=>v!==null&&String(v).trim()!==""))out.push(x);
  });
  importState.normalized=out;
}

function renderMapping(){
  const grid=document.getElementById("shipmentMappingGrid");if(!grid)return;
  const options=['<option value="">Nicht zuordnen</option>',...importState.headers.map(h=>`<option value="${esc(h)}">${esc(h)}</option>`)].join("");
  grid.innerHTML=FIELD_DEFS.map(([key,label])=>`<label><span>${esc(label)}</span><select data-map-field="${key}">${options}</select></label>`).join("");
  grid.querySelectorAll("[data-map-field]").forEach(sel=>{
    const key=sel.dataset.mapField;sel.value=importState.mapping[key]||"";
    sel.addEventListener("change",()=>{importState.mapping[key]=sel.value;normalizeImportRows();renderPreview();});
  });
}

function renderPreview(){
  normalizeImportRows();
  const rows=importState.normalized.slice(0,12);
  document.getElementById("shipmentPreviewMeta").textContent=`${importState.sheetName} · ${importState.normalized.length.toLocaleString("de-DE")} Datenzeilen · Vorschau der ersten ${rows.length}`;
  document.getElementById("shipmentPreviewHead").innerHTML="<tr><th>Sendung</th><th>Datum</th><th>Dienstleister</th><th>Relation</th><th>Paletten</th><th>Gewicht</th><th>LDM</th><th>Kosten</th></tr>";
  document.getElementById("shipmentPreviewRows").innerHTML=rows.map(x=>`<tr><td>${esc(x.shipmentId||"—")}</td><td>${esc(x.shipmentDate||"—")}</td><td>${esc(x.carrier||"—")}</td><td>${esc([x.originCountry,x.originPostal].filter(Boolean).join(" ")||"—")} → ${esc([x.destCountry,x.destPostal].filter(Boolean).join(" ")||"—")}</td><td>${x.pallets??"—"}</td><td>${x.weight!=null?decFmt(x.weight,1)+" kg":"—"}</td><td>${x.ldm!=null?decFmt(x.ldm,2):"—"}</td><td>${hasCost(x)?money(totalCost(x)):"—"}</td></tr>`).join("");
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
    if(!best||best.score<20){showToast("Keine brauchbare Tabellenstruktur erkannt.");return}
    importState.file=file;importState.sheets=sheets;importState.sheetName=best.sh.name;importState.rows=best.sh.rows;importState.headerRow=best.row;
    importState.headers=(best.sh.rows[best.row]||[]).map((v,i)=>String(v??"").trim()||`Spalte ${i+1}`);
    importState.mapping=autoMap(importState.headers);
    normalizeImportRows();
    const mapped=Object.values(importState.mapping).filter(Boolean).length;
    document.getElementById("shipmentImportInfo").hidden=false;
    document.getElementById("shipmentImportInfo").innerHTML=`<div><span>Datei</span><strong>${esc(file.name)}</strong></div><div><span>Arbeitsblatt</span><strong>${esc(best.sh.name)}</strong></div><div><span>Kopfzeile</span><strong>Zeile ${best.row+1}</strong></div><div><span>Felder erkannt</span><strong>${mapped}</strong></div><div><span>Datenzeilen</span><strong>${importState.normalized.length.toLocaleString("de-DE")}</strong></div>`;
    document.getElementById("shipmentMappingCard").hidden=false;document.getElementById("shipmentPreviewCard").hidden=false;
    renderMapping();renderPreview();activateTab("import");
  }catch(err){console.error(err);showToast("Datei konnte nicht gelesen werden.")}
}

function renderAll(){
  const data=shipments;
  shipmentCount.textContent=intFmt(data.length);
  shipmentCostTotal.textContent=money(data.reduce((s,x)=>s+(hasCost(x)?totalCost(x):0),0));
  shipmentWeightTotal.textContent=intFmt(data.reduce((s,x)=>s+(num(x.weight)||0),0))+" kg";
  shipmentCountryCount.textContent=new Set(data.map(x=>x.destCountry).filter(Boolean)).size;

  const completeness=[
    ["Ziel-PLZ","destPostal"],["Gewicht","weight"],["Paletten","pallets"],["LDM","ldm"],["Volumen","volume"],["Kosten","actualTotal"],["Dienstleister","carrier"],["Datum","shipmentDate"]
  ];
  shipmentCompleteness.innerHTML=completeness.map(([label,key])=>{const c=data.filter(x=>x[key]!==null&&x[key]!==undefined&&String(x[key]).trim()!=="").length,p=data.length?Math.round(c/data.length*100):0;return `<div><span>${label}</span><strong>${p}%</strong><div><i style="width:${p}%"></i></div></div>`}).join("");

  shipmentImportRows.innerHTML=shipmentImports.slice().sort((a,b)=>new Date(b.importedAt)-new Date(a.importedAt)).slice(0,8).map(x=>`<tr><td><strong>${esc(x.fileName)}</strong></td><td>${esc(x.sheetName||"—")}</td><td>${intFmt(x.count)}</td><td>${new Date(x.importedAt).toLocaleDateString("de-DE")}</td></tr>`).join("")||'<tr><td colspan="4" class="empty-state">Noch keine Sendungsdaten importiert.</td></tr>';

  const carriers=[...new Set(data.map(x=>x.carrier).filter(Boolean))].sort(),countries=[...new Set(data.map(x=>x.destCountry).filter(Boolean))].sort();
  shipmentCarrierFilter.innerHTML='<option value="">Alle Dienstleister</option>'+carriers.map(v=>`<option>${esc(v)}</option>`).join("");
  shipmentCountryFilter.innerHTML='<option value="">Alle Länder</option>'+countries.map(v=>`<option>${esc(v)}</option>`).join("");
  renderShipmentTable();renderBenchmark();
}

function renderShipmentTable(){
  const q=shipmentSearch.value.trim().toLowerCase(),carrier=shipmentCarrierFilter.value,country=shipmentCountryFilter.value,cost=shipmentCostFilter.value;
  const filtered=shipments.filter(x=>{
    const hay=`${x.shipmentId} ${x.carrier} ${x.originPostal} ${x.destPostal} ${x.destCity} ${x.customer} ${x.service}`.toLowerCase();
    return (!q||hay.includes(q))&&(!carrier||x.carrier===carrier)&&(!country||x.destCountry===country)&&(!cost||(cost==="with"?hasCost(x):!hasCost(x)));
  });
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
cancelShipmentImportBtn.addEventListener("click",()=>{importState={file:null,sheets:[],sheetName:"",rows:[],headerRow:0,headers:[],mapping:{},normalized:[]};shipmentMappingCard.hidden=true;shipmentPreviewCard.hidden=true;shipmentImportInfo.hidden=true});
confirmShipmentImportBtn.addEventListener("click",()=>{
  if(!importState.normalized.length){showToast("Keine Sendungen zum Importieren.");return}
  const batchId="SHIPIMP-"+Date.now(),now=new Date().toISOString();
  const rows=importState.normalized.map(x=>({...x,batchId}));
  shipments=[...rows,...shipments];
  shipmentImports.unshift({id:batchId,fileName:importState.file.name,sheetName:importState.sheetName,count:rows.length,importedAt:now,mapping:{...importState.mapping}});
  if(!GPK.write(SHIPMENT_KEY,shipments)||!GPK.write(SHIPMENT_IMPORT_KEY,shipmentImports)){showToast("Lokaler Speicher ist voll.");return}
  showToast(`${rows.length.toLocaleString("de-DE")} Sendungen importiert.`);
  renderAll();activateTab("overview");
});
exportShipmentsBtn.addEventListener("click",async()=>{
  if(!shipments.length){showToast("Keine Sendungsdaten zum Exportieren.");return}
  await exportWorkbook("GP_Kollund_Sendungsdaten.xlsx",{Sendungen:shipments});
});
renderAll();
