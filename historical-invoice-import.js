(function(){
"use strict";
const PDFJS_CDN="https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js";
const PDFJS_WORKER="https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
const TESSERACT_CDN="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
let state={files:[],positions:[],filter:"all",busy:false};
const $=id=>document.getElementById(id);

function ensureScript(src,globalName){
  if(window[globalName])return Promise.resolve(window[globalName]);
  return new Promise((resolve,reject)=>{
    const old=[...document.scripts].find(s=>s.src===src);
    if(old){old.addEventListener("load",()=>resolve(window[globalName]),{once:true});old.addEventListener("error",reject,{once:true});return}
    const s=document.createElement("script");s.src=src;s.async=true;s.crossOrigin="anonymous";s.onload=()=>{if(window[globalName])resolve(window[globalName]);else reject(new Error(`${globalName} wurde geladen, ist aber nicht verfügbar.`))};s.onerror=()=>reject(new Error(`${globalName} konnte nicht geladen werden. Internetverbindung/CDN prüfen.`));document.head.appendChild(s);
  });
}
async function ensurePdf(){
  const lib=await ensureScript(PDFJS_CDN,"pdfjsLib");
  try{
    await ensureScript(PDFJS_WORKER,"pdfjsWorker");
    lib.GlobalWorkerOptions.workerSrc=PDFJS_WORKER;
  }catch(err){
    lib.GlobalWorkerOptions.workerSrc=PDFJS_WORKER;
    console.warn("PDF.js Worker konnte nicht vorab geladen werden:",err);
  }
  return lib;
}
async function ensureTesseract(){return ensureScript(TESSERACT_CDN,"Tesseract")}
function cleanText(s=""){return String(s||"").replace(/\u00ad/g,"").replace(/[ \t]+/g," ").replace(/ *\n */g,"\n").replace(/\n{3,}/g,"\n\n").trim()}
function flatText(s=""){return cleanText(s).replace(/\n/g," ").replace(/\s+/g," ")}
function escH(v=""){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function n(v){if(v===null||v===undefined||v==="")return null;let s=String(v).trim().replace(/\s/g,"").replace(/EUR|€/gi,"");if(/^[-+]?\d{1,3}(?:\.\d{3})*,\d+$/.test(s))s=s.replace(/\./g,"").replace(",",".");else if(/^[-+]?\d{1,3}(?:,\d{3})*\.\d+$/.test(s))s=s.replace(/,/g,"");else s=s.replace(",",".").replace(/[^\d.+-]/g,"");const x=Number(s);return Number.isFinite(x)?x:null}
function dateIso(v=""){const s=String(v).trim();let m=s.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);if(m){let y=m[3];if(y.length===2)y="20"+y;return `${y}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`}m=s.match(/(\d{4})-(\d{2})-(\d{2})/);return m?`${m[1]}-${m[2]}-${m[3]}`:""}
function euro(v){return v===null||v===undefined||v===""?"—":new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR",maximumFractionDigits:2}).format(Number(v)||0)}
function pickFirst(text,regs){for(const r of regs){const m=text.match(r);if(m&&m[1])return String(m[1]).trim()}return ""}

function labeledLine(text,labelRe){
  const lines=cleanText(text).split("\n").map(v=>v.trim()).filter(Boolean);
  for(let i=0;i<lines.length;i++){
    const line=lines[i],m=line.match(labelRe); if(!m)continue;
    let val=line.slice((m.index||0)+m[0].length).replace(/^\s*[:#\-]?\s*/,"").trim();
    if(val)return {value:val,index:i,lines};
    if(lines[i+1])return {value:lines[i+1].trim(),index:i+1,lines};
  }
  return {value:"",index:-1,lines};
}
function lineStartingValue(text,labels){
  const lines=cleanText(text).split("\n");
  for(const label of labels){
    const r=new RegExp("^\\s*(?:"+label+")\\s*[:#\\-]?\\s*(.+)$","i");
    for(const line of lines){const m=line.match(r);if(m&&m[1])return m[1].trim()}
  }
  return "";
}
function dateNearLabel(text,label){
  const lines=cleanText(text).split("\n").map(v=>v.trim()).filter(Boolean),r=new RegExp(label,"i");
  for(let i=0;i<lines.length;i++){
    if(!r.test(lines[i]))continue;
    const d0=dateIso(lines[i]);if(d0)return d0;
    for(let j=i+1;j<Math.min(lines.length,i+3);j++){const d=dateIso(lines[j]);if(d)return d}
  }
  return "";
}
function normalizePartyRaw(v=""){
  return String(v||"").replace(/\b(?:Leistungsdatum|Rechnungsdatum|Rechnungs-Nr|Kunde|Kunden-Nr).*$/i,"").replace(/\s{2,}/g," ").trim();
}
function lineAfter(text,labelRe){const lines=cleanText(text).split("\n");for(let i=0;i<lines.length;i++){if(labelRe.test(lines[i])){const same=lines[i].replace(labelRe,"").replace(/^\s*[:\-]?\s*/,"").trim();if(same)return same;for(let j=i+1;j<Math.min(lines.length,i+3);j++)if(lines[j].trim())return lines[j].trim()}}return ""}
function amountFromLine(text,labelRe){const lines=cleanText(text).split("\n");for(const line of lines){if(labelRe.test(line)){const vals=[...line.matchAll(/(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+(?:[.,]\d{2}))/g)].map(m=>n(m[1])).filter(v=>v!==null);if(vals.length)return vals[vals.length-1]}}return null}
function addressParts(raw=""){
  const s=String(raw||"").replace(/\s+/g," ").trim();
  let country="",postal="",city="",name=s,m=null;
  m=s.match(/\b(?:([A-Z]{2})[-\s])?(\d{5})\s+([^,;|]+)/i);
  if(m){
    country=(m[1]||"DE").toUpperCase();postal=m[2];city=String(m[3]||"").trim();
  }else{
    m=s.match(/\b(?:([A-Z]{2})[-\s])?(\d{4})\s*([A-Z]{2})\s+([^,;|]+)/i);
    if(m){country=(m[1]||"NL").toUpperCase();postal=`${m[2]} ${m[3].toUpperCase()}`;city=String(m[4]||"").trim()}
    else{
      m=s.match(/\b(?:([A-Z]{2})[-\s])?(\d{4})\s+([^,;|]+)/i);
      if(m){country=(m[1]||"").toUpperCase();postal=m[2];city=String(m[3]||"").trim()}
    }
  }
  if(m){const idx=m.index||0;name=s.slice(0,idx).replace(/[,:;\-]+$/g,"").trim()||s}
  name=name.replace(/^(?:Ladestelle|Entladestelle|Abholort|Entladeort|Beladen|Entladen|Empfänger|Von|Nach)\s*[:#-]?\s*/i,"").trim();
  return {raw:s,name,country,postal,city};
}
function detectCarrier(text,file=""){
  const t=(text+" "+file).toLowerCase();
  const defs=[[/raben/,"Raben"],[/dachser/,"Dachser"],[/go!?\s*express/,"GO! Express"],[/finsterwalder/,"Finsterwalder"],[/gö\s*sped|goe\s*sped|gösped/,"Gösped"],[/exway/,"EXWAY Logistics"],[/yalin/,"YALIN Logistik"],[/tafu/,"TAFU Logistik"],[/lifa/,"LIFA Logistik"],[/schäfer|schaefer/,"Leopold Schäfer"],[/fme|frachtmanagement europa/,"FME Frachtmanagement Europa"],[/wächter|waechter/,"Fahrlogistik Wächter"],[/emons/,"Emons"],[/bmz/,"BMZ Bagger und Transporte"],[/philip+p? seid|seidler/,"Philipp Seidler Transportmanagement"]];
  for(const [r,nm] of defs)if(r.test(t))return nm;return "Unbekannt";
}
function invoiceNo(text,file){return pickFirst(flatText(text),[/Rechnungs(?:-|\s*)Nr\.?\s*[:#]?\s*([A-Z0-9_\/-]+)/i,/Rechnung\s+(?:Nr\.?\s*)?([A-Z]{0,4}\d[A-Z0-9_\/-]*)/i,/Belegnummer\s*[:#]?\s*([A-Z0-9_\/-]+)/i,/Beleg-Nr\.?\s*[:#]?\s*([A-Z0-9_\/-]+)/i])||String(file||"").replace(/\.pdf$/i,"").match(/(?:Rechnung\s*)?([A-Z]{0,4}[\d_/-]{4,})/i)?.[1]||""}
function findDate(text,labels){const f=flatText(text);for(const label of labels){const re=new RegExp(label+"\\s*[:#]?\\s*(\\d{1,2}[.\\/-]\\d{1,2}[.\\/-]\\d{2,4})","i"),m=f.match(re);if(m)return dateIso(m[1])}return ""}
function namedValue(text,labels,pattern="[^\\n|]{1,80}") {
  for(const l of labels){
    const re=new RegExp(l+"\\s*[:#]?\\s*("+pattern+")","i"),m=cleanText(text).match(re);
    if(m){
      const v=String(m[1]??"").trim();
      if(v)return v;
    }
  }
  return "";
}
function extractGeneric(text,file,positionNo=1){
  const f=flatText(text),carrier=detectCarrier(text,file),inv=invoiceNo(text,file);
  const originRaw=normalizePartyRaw(lineStartingValue(text,["Ladestelle(?:\(n\))?","Ladeort","Abholort","Beladen","Von"])||namedValue(text,["Ladestelle(?:\(n\))?","Ladeort","Abholort","Beladen"],"[^\n]{3,120}")||pickFirst(f,[/(?:\bvon\s*:|\bab\s*:)\s*([^;]{0,80}\b\d{4,5}\s+[^;]{2,80})/i]));
  const destRaw=normalizePartyRaw(lineStartingValue(text,["Entladestelle(?:\(n\))?","Entldestelle","Entladeort","Entladen","An","Nach","Empfänger"])||namedValue(text,["Entladestelle(?:\(n\))?","Entldestelle","Entladeort","Entladen","Empfänger"],"[^\n]{3,140}")||pickFirst(f,[/(?:\ban\s*:|\bnach\s*:|empf\.?\s*:)\s*([^;]{0,90}\b\d{4,5}\s+[^;]{2,90})/i]));
  const o=addressParts(originRaw),d=addressParts(destRaw);
  const service=pickFirst(f,[/\b(Komplettladung|Teilladung|Sattelzug|Charter|Overnight|Express|Fracht)\b/i]);
  const x={
    id:"HIST-"+Date.now()+"-"+Math.random().toString(36).slice(2,8),sourceType:"historical_invoice_pdf",historicalOnly:true,invoiceAudit:false,sourceFile:file,carrier,invoiceNumber:inv,invoicePosition:String(positionNo),
    invoiceDate:findDate(text,["Rechnungsdatum","Rech\\.-Datum","Rech-Datum","Beleg-Datum","Datum"]),serviceDate:findDate(text,["Leistungsdatum","Leistungstag","Leist\\.-Dat\\.","Leist\\.datum"]),shipmentDate:findDate(text,["Abhol(?:datum)?","Abholung","Datum"]),deliveryDate:findDate(text,["Zustell(?:datum)?","Zustellung"]),
    orderNo:pickFirst(f,[/Auftrags?(?:nummer|nr\.?|gruppe)?\s*[:#]?\s*([A-Z0-9_\/-]+)/i,/Auftr\.\s*[:#]?\s*([A-Z0-9_\/-]+)/i]),
    shipmentId:pickFirst(f,[/Sendung(?:snummer)?\s*[:#]?\s*([A-Z0-9_\/-]+)/i]),waybillNo:pickFirst(f,[/Frachtbrief(?:-Nr\.|nummer)?\s*[:#]?\s*([A-Z0-9_\/-]+)/i]),referenceNo:pickFirst(f,[/Referenz(?:nummer|nr\.)?\s*[:#]?\s*([A-Z0-9_\/-]+)/i,/Ref\.-?Nr\.?\s*[:#]?\s*([A-Z0-9_\/-]+)/i]),
    originName:o.name,originAddressRaw:o.raw,originCountry:o.country,originPostal:o.postal,originCity:o.city,destName:d.name,customer:d.name,destAddressRaw:d.raw,destCountry:d.country,destPostal:d.postal,destCity:d.city,service:service||"",
    pallets:n(pickFirst(f,[/(\d+(?:[.,]\d+)?)\s*(?:EW\s*)?(?:Euro[- ]?)?Paletten?/i])),colli:n(pickFirst(f,[/(\d+(?:[.,]\d+)?)\s*(?:Kolli|Packst(?:ü|u)cke|LDG)\b/i])),slots:n(pickFirst(f,[/(\d+(?:[.,]\d+)?)\s*(?:SP|Stellpl(?:ä|a)tze?)\b/i])),
    weight:n(pickFirst(f,[/(\d{1,3}(?:[. ]\d{3})*(?:,\d+)?|\d+(?:[.,]\d+)?)\s*kg\b/i])),ldm:n(pickFirst(f,[/(\d+(?:[.,]\d+)?)\s*(?:LDM|Ldm|Lademeter)\b/i])),volume:n(pickFirst(f,[/(\d+(?:[.,]\d+)?)\s*(?:CBM|m³|m3)\b/i])),distanceKm:n(pickFirst(f,[/(\d+(?:[.,]\d+)?)\s*km\b/i])),
    freight:amountFromLine(text,/\bFracht\b(?!brief)/i),diesel:amountFromLine(text,/Diesel|Treibstoffzuschlag/i),toll:amountFromLine(text,/\bMaut\b/i),insurance:amountFromLine(text,/Versicherung|Versicherungsschutz/i),noticeFee:amountFromLine(text,/\bAvis|Avisierung/i),customs:amountFromLine(text,/\bZoll\b/i),expressFee:amountFromLine(text,/\bExpress\b/i),tailLiftFee:amountFromLine(text,/Hebeb(?:ü|u)hne/i),waitingFee:amountFromLine(text,/Wartezeit/i),areaSurcharge:amountFromLine(text,/Insel|Gebietszuschlag/i),palletExchangeFee:amountFromLine(text,/Palettentausch|Verpackung/i),otherCharges:null,
    originalChargeLabels:"",actualTotal:null,invoiceTax:null,invoiceGross:null,rawText:text
  };
  // Common fixed-price formats use the last value in "Fracht lt. Vereinbarung" line.
  const agreed=amountFromLine(text,/Fracht\s+(?:lt\.?|laut)\s+Vereinbarung/i);if(agreed!==null)x.freight=agreed;
  const costs=[x.freight,x.diesel,x.toll,x.insurance,x.noticeFee,x.customs,x.expressFee,x.tailLiftFee,x.waitingFee,x.areaSurcharge,x.palletExchangeFee,x.otherCharges].filter(v=>v!==null);
  if(costs.length)x.actualTotal=costs.reduce((a,b)=>a+(Number(b)||0),0);
  if(x.actualTotal===null){const net=amountFromLine(text,/\bNetto\b|Gesamt\s*netto|Zwischensumme\s*\(netto\)/i);if(net!==null)x.actualTotal=net}
  const tax=amountFromLine(text,/MwSt\.?|Umsatzsteuer\s*19/i);if(tax!==null)x.invoiceTax=tax;
  const gross=amountFromLine(text,/Gesamtbetrag|Gesamtsumme|Endbetrag|Rechnungsbetrag/i);if(gross!==null)x.invoiceGross=gross;
  if(!x.shipmentDate)x.shipmentDate=x.serviceDate||x.invoiceDate;
  return x;
}
function parseGoExpress(text,file){
  const f=flatText(text),matches=[...f.matchAll(/(\d{1,2}[.]\d{1,2}[.]\d{4})\s+Frachtbrief-Nr\.?\s*([A-Z0-9_\/-]+)/gi)];
  if(matches.length<2)return [extractGeneric(text,file,1)];
  const out=[];for(let i=0;i<matches.length;i++){const start=matches[i].index,end=i+1<matches.length?matches[i+1].index:f.length,block=f.slice(start,end);const x=extractGeneric(block,file,i+1);x.carrier="GO! Express";x.invoiceNumber=invoiceNo(text,file);x.shipmentDate=dateIso(matches[i][1]);x.waybillNo=matches[i][2];const sums=[...block.matchAll(/Summe\s+EUR\s+([\d.,]+)/gi)];if(sums.length)x.actualTotal=n(sums[sums.length-1][1]);out.push(x)}return out;
}

function firstMatch(text,re,group=1){const m=String(text||"").match(re);return m&&m[group]!=null?String(m[group]).trim():""}
function normalizeInvoiceReference(v=""){const s=String(v||"").replace(/\s+/g," ").trim();if(!s)return "";if(/^(und|nummer|fracht|charter|teilladung|komplettladung|ladung|dienstleistung|ladestelle|entladestelle)$/i.test(s))return "";if(/allgemeinen|bestimmungen|vereinbart|ust-?id|zahlungsziel/i.test(s))return "";return s}
function setPartyFields(x,side,name="",country="",postal="",city=""){const c=v=>String(v||"").replace(/\s+/g," ").replace(/[;,]+$/,"").trim();name=c(name);country=c(country).toUpperCase();postal=c(postal);city=c(city);if(side==="origin"){if(name)x.originName=name;if(country)x.originCountry=country;if(postal)x.originPostal=postal;if(city)x.originCity=city}else{if(name){x.destName=name;x.customer=name}if(country)x.destCountry=country;if(postal)x.destPostal=postal;if(city)x.destCity=city}}

function providerTune(x,text){
  const f=flatText(text),ct=cleanText(text);

  if(x.carrier==="YALIN Logistik"){
    x.invoiceNumber=firstMatch(f,/\bRechnung\s+([0-9]{4,})\b/i)||x.invoiceNumber;
    x.invoiceDate=dateIso(firstMatch(f,/\bBeleg-?Datum\s+(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/i))||x.invoiceDate;
    x.serviceDate=dateIso(firstMatch(f,/\bLeistungstag\s+(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/i))||x.serviceDate;
    x.shipmentDate=x.serviceDate||x.shipmentDate||x.invoiceDate;
    x.orderNo=firstMatch(f,/\bAuftragsnummer\s+([0-9]{6,})\b/i)||x.orderNo;
    x.referenceNo=normalizeInvoiceReference(firstMatch(f,/\bReferenznummer\s+(.+?)(?=\s+(?:Ladestelle|Entladestelle|Ware|200\b|Fracht\s+lt\.))/i))||normalizeInvoiceReference(x.referenceNo);
    const route=f.match(/\bLadestelle\s+(.+?)\s+Entladestelle\s+(.+?)(?=\s+(?:Ware|200\b|Fracht\s+lt\.|Netto\b))/i);
    if(route){
      let o=route[1],d=route[2],m=o.match(/^(.*?)\s+(?:D[-\s])?(\d{5})\s+(.+)$/i);
      if(m)setPartyFields(x,"origin",m[1],"DE",m[2],m[3]);
      m=d.match(/^(.*?)\s+(PL|DE)[-\s]?(\d{2}-?\d{3}|\d{5})\s+(.+)$/i);
      if(m)setPartyFields(x,"dest",m[1],m[2],m[3],m[4]);
    }
    const wt=firstMatch(f,/\b([\d.]+(?:,\d+)?)\s*kg\b/i);if(wt)x.weight=n(wt);
    const fr=lastMoney(/\bFracht\s+lt\.?\s+Vereinbarung\b.*?([\d.]+,\d{2})/gi);if(fr!==null){x.freight=fr;x.actualTotal=fr}
    x.service="";
  }

  if(x.carrier==="TAFU Logistik"){
    x.invoiceNumber=firstMatch(f,/\bRechnung\s+([0-9]{4,})\b/i)||x.invoiceNumber;
    x.invoiceDate=dateIso(firstMatch(f,/\bBeleg-?Datum\s+(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/i))||x.invoiceDate;
    x.serviceDate=dateIso(firstMatch(f,/\bLeistungstag\s+(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/i))||x.serviceDate;
    x.shipmentDate=x.serviceDate||x.shipmentDate||x.invoiceDate;
    x.orderNo=firstMatch(f,/\bAuftragsnummer\s+([0-9]{6,})\b/i)||x.orderNo;
    x.referenceNo=normalizeInvoiceReference(firstMatch(f,/\bReferenznummer\s+(.+?)(?=\s+(?:Ladestelle|Entladestelle|Ware|200\b|Fracht\s+lt\.))/i))||normalizeInvoiceReference(x.referenceNo);
    const route=f.match(/\bLadestelle\s+(.+?)\s+Entladestelle\s+(.+?)(?=\s+(?:Ware|200\b|Fracht\s+lt\.|Netto\b))/i);
    if(route){
      let m=route[1].match(/^(.*?)\s+(?:D[-\s])?(\d{5})\s+(.+)$/i);if(m)setPartyFields(x,"origin",m[1],"DE",m[2],m[3]);
      m=route[2].match(/^(.*?)\s+(?:D[-\s])?(\d{5})\s+(.+)$/i);if(m)setPartyFields(x,"dest",m[1],"DE",m[2],m[3]);
    }
    const p=firstMatch(f,/\bWare\s+(\d+(?:[.,]\d+)?)\s+Einwegpaletten?/i);if(p)x.pallets=n(p);
    const wt=firstMatch(f,/\b([\d.]+(?:,\d+)?)\s*kg\b/i);if(wt)x.weight=n(wt);
    const fr=lastMoney(/\bFracht\s+lt\.?\s+Vereinbarung\b.*?([\d.]+,\d{2})/gi);if(fr!==null){x.freight=fr;x.actualTotal=fr}
    x.service="";
  }

  if(x.carrier==="Raben"){
    x.invoiceNumber=firstMatch(f,/\bRECHNUNGS-?NR\.?\s*([0-9]{6,})/i)||x.invoiceNumber;
    x.invoiceDate=dateIso(firstMatch(f,/\bRechnungsdatum\s*:?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/i))||x.invoiceDate;
    x.serviceDate=dateIso(firstMatch(f,/\bLeistungsdatum\s*:?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/i))||x.serviceDate;
    const row=f.match(/\bAbhol\.?\s+Sendung\s+Referenznummer\s+Zustell\.?\s+Inc\s+Anzahl\s+LDM\s+PP\s+CBM\s+KM\s+(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})\s+([A-Z0-9_-]+)\s+(.+?)\s+(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})\s+([A-Z]{2,4})\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/i);
    if(row){x.shipmentDate=dateIso(row[1]);x.shipmentId=row[2];x.referenceNo=normalizeInvoiceReference(row[3]);x.deliveryDate=dateIso(row[4]);x.colli=n(row[6]);x.ldm=n(row[7]);x.slots=n(row[8]);x.volume=n(row[9]);x.distanceKm=n(row[10])}
    const route=f.match(/\bVon:\s+(.+?)\s+An:\s+(.+?)(?=\s+(?:Gewicht|Aktivität|Bezeichnung|Nebenkosten))/i);
    if(route){
      let m=route[1].match(/^(.*?)\s+(?:D[-\s])?(\d{5})\s+(.+)$/i);if(m)setPartyFields(x,"origin",m[1],"DE",m[2],m[3]);
      m=route[2].match(/^(.*?)\s+(?:D[-\s])?(\d{5})\s+(.+)$/i);if(m)setPartyFields(x,"dest",m[1],"DE",m[2],m[3]);
    }
    const wm=f.match(/\bGewicht\s+([\d.,]+)(?:\s+([\d.,]+))?/i);if(wm)x.weight=n(wm[1]);
    const fr=lastMoney(/\bSpeditionsdienste\s+Charter\b.*?([\d.]+,\d{2})/gi);if(fr!==null)x.freight=fr;
    const ins=lastMoney(/\bGebühr\s+Beschaffung\s+Transp-?Vers\b.*?([\d.]+,\d{2})/gi);if(ins!==null){x.insurance=ins;x.originalChargeLabels="Gebühr Beschaffung Transp-Vers"}
    const net=lastMoney(/\bGesamt\s*netto\s*:?\s*([\d.]+,\d{2})/gi);if(net!==null)x.actualTotal=net;
    x.service="Charter";
  }
  const setParty=(side,raw)=>{if(!raw)return;const p=addressParts(normalizePartyRaw(raw));if(side==="origin"){x.originName=p.name||x.originName;x.originAddressRaw=p.raw||x.originAddressRaw;x.originCountry=p.country||x.originCountry;x.originPostal=p.postal||x.originPostal;x.originCity=p.city||x.originCity}else{x.destName=p.name||x.destName;x.customer=p.name||x.customer;x.destAddressRaw=p.raw||x.destAddressRaw;x.destCountry=p.country||x.destCountry;x.destPostal=p.postal||x.destPostal;x.destCity=p.city||x.destCity}};
  const lastMoney=(re)=>{const m=[...f.matchAll(re)];return m.length?n(m[m.length-1][1]):null};

  if(x.carrier==="Raben"){
    x.invoiceDate=x.invoiceDate||findDate(text,["Rechnungsdatum"]);x.serviceDate=x.serviceDate||findDate(text,["Leistungsdatum"]);
    x.shipmentDate=dateNearLabel(text,"^Abhol")||x.shipmentDate||x.serviceDate||x.invoiceDate;x.deliveryDate=dateNearLabel(text,"^Zustell")||x.deliveryDate;
    setParty("origin",lineStartingValue(text,["Von"]));setParty("dest",lineStartingValue(text,["An"]));
    x.shipmentId=x.shipmentId||pickFirst(f,[/\bSendung\s+([A-Z0-9_-]{6,})/i]);
    const row=f.match(/\bAbhol\.?\s+Sendung\s+Referenznummer\s+Zustell\.?.*?\s+(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})\s+([A-Z0-9_-]+)\s+(.+?)\s+(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})\s+\S+\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/i);
    if(row){x.shipmentDate=dateIso(row[1])||x.shipmentDate;x.shipmentId=row[2]||x.shipmentId;x.referenceNo=(row[3]||"").trim()||x.referenceNo;x.deliveryDate=dateIso(row[4])||x.deliveryDate;x.colli=n(row[5]);x.ldm=n(row[6]);x.slots=n(row[7]);x.volume=n(row[8]);x.distanceKm=n(row[9])}
    const wt=pickFirst(f,[/\bGewicht\s+([\d.,]+)/i]);if(wt)x.weight=n(wt);
    const fr=amountFromLine(text,/Speditionsdienste\s+Charter/i);if(fr!==null)x.freight=fr;
    const ins=amountFromLine(text,/Gebühr\s+Beschaffung\s+Transp-Vers/i);if(ins!==null){x.insurance=ins;x.originalChargeLabels="Gebühr Beschaffung Transp-Vers"}
    const net=lastMoney(/\bGesamt\s*netto\s*:?\s*([\d.]+,\d{2})/gi);x.actualTotal=net!==null?net:[x.freight,x.insurance].filter(v=>v!==null).reduce((a,b)=>a+(b||0),0)||x.actualTotal;
  }
  if(x.carrier==="Philipp Seidler Transportmanagement"){
    const load=ct.match(/Ladestelle\s*:\s*([^\n]+)\n?\s*(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})?/i);if(load){setParty("origin",load[1]);if(load[2])x.shipmentDate=dateIso(load[2])}
    const dest=f.match(/Entl(?:ade|de)stelle\s*:\s*(.+?\b\d{4,5}\s+[A-Za-zÄÖÜäöüß -]+?)\s+(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/i);if(dest){setParty("dest",dest[1]);x.deliveryDate=dateIso(dest[2])}
    x.invoiceDate=x.invoiceDate||findDate(text,["Datum"]);x.service=x.service||"Transport lt. Auftragserteilung";
    const fr=lastMoney(/Zwischensumme\s*\(netto\)\s*([\d.]+,\d{2})/gi);if(fr!==null){x.freight=fr;x.actualTotal=fr}
  }
  if(x.carrier==="FME Frachtmanagement Europa"){
    x.invoiceDate=x.invoiceDate||findDate(text,["Rech\\.-Datum","Rech-Datum","Druckdatum"]);x.serviceDate=x.serviceDate||findDate(text,["Leistungstag"]);
    setParty("origin",lineStartingValue(text,["Ladestelle"]));setParty("dest",lineStartingValue(text,["Entladestelle"]));
    x.orderNo=x.orderNo||pickFirst(f,[/\bAuftrag\s+([A-Z0-9_-]+)/i]);x.referenceNo=x.referenceNo||pickFirst(f,[/\bRef\.-Nr\.?\s+([A-Z0-9_-]+)/i]);
    const km=pickFirst(f,[/\bgefahrene\s+KM\s*:?\s*([\d.,]+)/i]);if(km)x.distanceKm=n(km);const wt=pickFirst(f,[/\btats\.?\s*Gew\.?\s*:?\s*([\d.,]+)\s*kg/i]);if(wt)x.weight=n(wt);
    const fr=lastMoney(/\bFracht\b.*?([\d.]+,\d{2})/gi);if(fr!==null)x.freight=fr;const net=lastMoney(/\bNetto\s+([\d.]+,\d{2})/gi);if(net!==null)x.actualTotal=net;else if(x.freight!==null)x.actualTotal=x.freight;
  }
  if(x.carrier==="EXWAY Logistics"){
    x.invoiceDate=findDate(text,["Rechnungsdatum"])||x.invoiceDate;
    x.serviceDate=findDate(text,["Leistungsdatum"])||dateNearLabel(text,"Leistungsdatum")||x.serviceDate;
    x.shipmentDate=x.serviceDate||x.shipmentDate||x.invoiceDate;
    x.service=pickFirst(f,[/\b(Komplettladung|Teilladung)\b/i])||x.service;

    const order=pickFirst(f,[/\b(AB\d{4,})\b/i]);
    if(order)x.orderNo=order;
    const ref=pickFirst(f,[/\bReferenz\s*:?\s*([A-Z0-9_-]{2,})/i]);
    if(ref&&!/^(Teilladung|Komplettladung|Ladestelle|Dienstleistung)$/i.test(ref))x.referenceNo=ref;
    else if(/^(Teilladung|Komplettladung|Ladestelle|Dienstleistung)$/i.test(x.referenceNo||""))x.referenceNo="";

    const lines=ct.split("\n").map(v=>v.trim()).filter(Boolean);
    const collectAfter=(label,max=6)=>{
      const i=lines.findIndex(v=>new RegExp("^"+label+"\\b","i").test(v));
      if(i<0)return "";
      const out=[];
      const same=lines[i].replace(new RegExp("^"+label+"\\b\\s*:?\\s*","i"),"").trim();
      if(same)out.push(same);
      for(let j=i+1;j<Math.min(lines.length,i+1+max);j++){
        if(/^(Beladen|Entladen|Preis|Zwischensumme|Steuern|Rechnungsdatum|Fälligkeitsdatum|Leistungsdatum|Auftrag|Ladestelle|Dienstleistung|Steuerschlüssel|Netto)\b/i.test(lines[j]))break;
        out.push(lines[j]);
      }
      return out.join(" ");
    };
    const origin=collectAfter("Beladen",5),dest=collectAfter("Entladen",7);
    if(origin)setParty("origin",origin);
    if(dest)setParty("dest",dest);

    const km=pickFirst(f,[/\bEntfernung\s*:?\s*([\d.,]+)\s*km/i]);if(km)x.distanceKm=n(km);
    const fr=lastMoney(/\bZwischensumme\s+([\d.]+,\d{2})/gi) ?? lastMoney(/\bPreis\b.*?([\d.]+,\d{2})/gi);
    if(fr!==null){x.freight=fr;x.actualTotal=fr}
    if(/^(Ladestelle|Auftrag|Dienstleistung|Netto)$/i.test(x.orderNo||""))x.orderNo=order||"";
  }
  if(x.carrier==="Dachser"){
    x.invoiceDate=x.invoiceDate||findDate(text,["Datum"]);const dt=pickFirst(f,[/\b(\d{1,2}[.]\d{1,2}[.]\d{2,4})\s+SALUX\b/i]);if(dt)x.shipmentDate=dateIso(dt);
    const p=f.match(/\bSALUX\s+GMBH\s+D\s+(\d{5})\s+([A-ZÄÖÜß -]+?)\s+GLOBUS\s+BAUMARKT\s+D\s+(\d{5})\s+([A-ZÄÖÜß -]+?)(?=\s+\d{2,4}\b)/i);if(p){setParty("origin",`SALUX GMBH D-${p[1]} ${String(p[2]||"").trim()}`);setParty("dest",`GLOBUS BAUMARKT D-${p[3]} ${String(p[4]||"").trim()}`)}
    x.orderNo=x.orderNo||pickFirst(f,[/\bAuf-Nr\.?\s*:?\s*([A-Z0-9_-]+)/i]);x.shipmentId=x.shipmentId||pickFirst(f,[/\bLf-Nr\.?\s*:?\s*([A-Z0-9_-]+)/i]);
    const fr=lastMoney(/\bFracht\s+ab\s+Werk\s+bis\s+Empfangsort\s+([\d.]+,\d{2})/gi);if(fr!==null)x.freight=fr;
    const pe=lastMoney(/\bPackmitteltauschgeb(?:ü|u)hr\s+([\d.]+,\d{2})/gi);if(pe!==null)x.palletExchangeFee=pe;
    const net=lastMoney(/\bNetto(?:\s+EUR)?\s+([\d.]+,\d{2})/gi);if(net!==null)x.actualTotal=net;else if(x.freight!==null)x.actualTotal=(x.freight||0)+(x.palletExchangeFee||0);
  }
  if(x.carrier==="Leopold Schäfer"){const p=amountFromLine(text,/Festfracht|Fracht/i);if(p!==null)x.freight=p;const sys=amountFromLine(text,/Systemgebühr/i);if(sys!==null){x.otherCharges=sys;x.originalChargeLabels="Systemgebühr"}x.actualTotal=[x.freight,x.otherCharges].filter(v=>v!==null).reduce((a,b)=>a+(b||0),0)||x.actualTotal}
  if(x.carrier==="Emons"){const base=amountFromLine(text,/Pauschale/i);if(base!==null)x.freight=base;const diesel=amountFromLine(text,/Dieselzuschlag/i);if(diesel!==null)x.diesel=diesel;const toll=amountFromLine(text,/Maut/i);if(toll!==null)x.toll=toll;const co2=amountFromLine(text,/CO2-Aussto(?:ß|ss)/i);if(co2!==null){x.otherCharges=(x.otherCharges||0)+co2;x.originalChargeLabels=[x.originalChargeLabels,"Anteiliger CO2-Ausstoß"].filter(Boolean).join("; ")}x.actualTotal=[x.freight,x.diesel,x.toll,x.otherCharges].filter(v=>v!==null).reduce((a,b)=>a+(b||0),0)||x.actualTotal}
  if(x.carrier==="Gösped"){const fr=amountFromLine(text,/Fracht\s*:/i);if(fr!==null)x.freight=fr;const di=amountFromLine(text,/Dieselzuschlag/i);if(di!==null)x.diesel=di;x.actualTotal=[x.freight,x.diesel].filter(v=>v!==null).reduce((a,b)=>a+(b||0),0)||x.actualTotal}
  x.orderNo=normalizeInvoiceReference(x.orderNo);
  x.referenceNo=normalizeInvoiceReference(x.referenceNo);
  x.originName=normalizeInvoiceReference(x.originName);
  x.destName=normalizeInvoiceReference(x.destName);
  x.customer=x.destName||x.customer;
  return x;
}
function parsePositions(text,file){let out=detectCarrier(text,file)==="GO! Express"?parseGoExpress(text,file):[extractGeneric(text,file,1)];return out.map(x=>providerTune(x,text))}
function idNorm(v){return String(v||"").trim().toLowerCase().replace(/[^a-z0-9]/g,"")}
function fallbackSignature(x){const dt=x.shipmentDate||x.serviceDate||x.invoiceDate||"",dest=(x.destCountry||"")+"|"+(x.destPostal||"")+"|"+(x.destCity||"").toLowerCase(),w=x.weight!=null?Math.round(Number(x.weight)*10)/10:"",c=x.actualTotal!=null?Math.round(Number(x.actualTotal)*100)/100:"";if(!dt||!dest.replace(/\|/g,"")||(!w&&!c))return "";return `${dt}|${dest}|${w}|${c}`}
function findDuplicate(x,existing){
  const ids=[x.shipmentId,x.orderNo,x.waybillNo,x.referenceNo].map(idNorm).filter(v=>v.length>=4);
  for(const e of existing){const eids=[e.shipmentId,e.orderNo,e.waybillNo,e.referenceNo].map(idNorm).filter(Boolean);const hit=ids.find(v=>eids.includes(v));if(hit)return {record:e,reason:`Kennung bereits vorhanden (${hit})`};if(x.invoiceNumber&&e.invoiceNumber&&idNorm(x.invoiceNumber)===idNorm(e.invoiceNumber)&&String(x.invoicePosition||"1")===String(e.invoicePosition||"1"))return {record:e,reason:`Rechnung ${x.invoiceNumber}, Position ${x.invoicePosition||1} bereits importiert`}}
  const sig=fallbackSignature(x);if(sig){const e=existing.find(y=>fallbackSignature(y)===sig);if(e)return {record:e,reason:"Datum + Ziel + Gewicht/Betrag stimmen mit vorhandener Sendung überein"}}
  return null;
}
function finalizeQuality(x,existing,batchBefore){
  const dup=findDuplicate(x,[...existing,...batchBefore.filter(y=>y.importStatus!=="duplicate")]);
  if(dup){x.importStatus="duplicate";x.selected=false;x.duplicateReason=dup.reason;x.duplicateOf=dup.record?.shipmentId||dup.record?.orderNo||dup.record?.invoiceNumber||"vorhandene Sendung";return x}
  const missing=[];if(!(x.shipmentDate||x.serviceDate||x.invoiceDate))missing.push("Datum");if(!(x.destPostal||x.destCity||x.customer||x.destName))missing.push("Ziel");if(x.actualTotal===null||x.actualTotal===undefined)missing.push("Netto-Kosten");x.missingFields=missing;x.dataQuality=missing.length?"Unvollständig":"Vollständig";x.importStatus=missing.length?"review":"new";x.selected=!missing.length;return x;
}
async function pageText(page){const tc=await page.getTextContent();let lastY=null,line="",lines=[];for(const it of tc.items){const y=Math.round(it.transform?.[5]||0);if(lastY!==null&&Math.abs(y-lastY)>3){if(line.trim())lines.push(line.trim());line=""}line+=(line?" ":"")+it.str;lastY=y}if(line.trim())lines.push(line.trim());return lines.join("\n")}
async function ocrPage(page,progressCb){const T=await ensureTesseract();const viewport=page.getViewport({scale:2.25});const canvas=document.createElement("canvas"),ctx=canvas.getContext("2d");canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await page.render({canvasContext:ctx,viewport}).promise;const result=await T.recognize(canvas,"deu+eng",{logger:m=>{if(m.status==="recognizing text"&&progressCb)progressCb(Math.round((m.progress||0)*100))}});return result?.data?.text||""}
async function extractPdf(file,onStage,forceOcr=false){
  const pdfjs=await ensurePdf(),data=new Uint8Array(await file.arrayBuffer()),pdf=await pdfjs.getDocument({data}).promise;
  let parts=[],textChars=0;
  for(let p=1;p<=pdf.numPages;p++){
    onStage?.(`Seite ${p}/${pdf.numPages} lesen`,null);
    const page=await pdf.getPage(p),t=await pageText(page);parts.push(t);textChars+=t.replace(/\s/g,"").length;
  }
  let text=cleanText(parts.join("\n\n")),usedOcr=false,ocrError="";
  if((forceOcr||textChars<120)&&$("historicalOcrEnabled")?.checked){
    try{
      usedOcr=true;parts=[];
      for(let p=1;p<=pdf.numPages;p++){
        const page=await pdf.getPage(p);
        const t=await ocrPage(page,pc=>onStage?.(`OCR Seite ${p}/${pdf.numPages}`,pc));parts.push(t);
      }
      const ocrText=cleanText(parts.join("\n\n"));
      if(ocrText.replace(/\s/g,"").length>40)text=ocrText;
      else{usedOcr=false;ocrError="OCR lieferte zu wenig verwertbaren Text."}
    }catch(err){console.warn("OCR fehlgeschlagen",err);usedOcr=false;ocrError=err?.message||String(err)}
  }
  return {text,usedOcr,pages:pdf.numPages,textChars,ocrError};
}
function updateProgress(done,total,label,subPct=null){$("historicalProgress").hidden=false;$("historicalProgressText").textContent=label||"Analyse …";$("historicalProgressCount").textContent=`${done} / ${total}`;const base=total?done/total*100:0,extra=subPct!=null&&total?subPct/100/total*100:0;$("historicalProgressBar").value=Math.min(100,base+extra)}
function recognitionScore(x){
  let score=0;if(x&&x.carrier&&x.carrier!=="Unbekannt")score++;if(x&&x.invoiceNumber)score++;if(x&&(x.shipmentDate||x.serviceDate||x.invoiceDate))score++;if(x&&(x.destPostal||x.destCity||x.destName||x.customer))score++;if(x&&x.actualTotal!==null&&x.actualTotal!==undefined&&x.actualTotal!=="")score++;if(x&&(x.orderNo||x.shipmentId||x.referenceNo||x.waybillNo))score++;return score;
}
function shouldRetryWithOcr(ps,ext){
  if(!$("historicalOcrEnabled")?.checked||ext?.usedOcr)return false;
  if(!Array.isArray(ps)||!ps.length)return true;
  const best=Math.max(...ps.map(recognitionScore));
  const essentialOk=ps.some(x=>(x.shipmentDate||x.serviceDate||x.invoiceDate)&&(x.destPostal||x.destCity||x.destName||x.customer)&&(x.actualTotal!==null&&x.actualTotal!==undefined&&x.actualTotal!==""));
  return !essentialOk||best<4;
}
async function analyzeFiles(files){if(state.busy)return;state.busy=true;state.files=[...files].filter(f=>/\.pdf$/i.test(f.name));state.positions=[];$("historicalResultArea").hidden=true;if(!state.files.length){showToast("Bitte mindestens eine PDF-Datei auswählen.");state.busy=false;return}const existing=Array.isArray(shipments)?shipments:[];
  for(let i=0;i<state.files.length;i++){const file=state.files[i];updateProgress(i,state.files.length,`${file.name} wird analysiert …`);try{let ext=await extractPdf(file,(stage,pct)=>updateProgress(i,state.files.length,`${file.name}: ${stage}`,pct),false);let ps=parsePositions(ext.text,file.name);if(!ps.length)ps=[extractGeneric(ext.text,file.name,1)];
      if(shouldRetryWithOcr(ps,ext)){
        updateProgress(i,state.files.length,`${file.name}: Texterkennung unvollständig – OCR wird automatisch gestartet …`,0);
        const ocrExt=await extractPdf(file,(stage,pct)=>updateProgress(i,state.files.length,`${file.name}: ${stage}`,pct),true);
        if(ocrExt.usedOcr){const candidate=parsePositions(ocrExt.text,file.name);const next=candidate.length?candidate:[extractGeneric(ocrExt.text,file.name,1)];const oldScore=Math.max(...ps.map(recognitionScore)),newScore=Math.max(...next.map(recognitionScore));if(newScore>=oldScore){ext=ocrExt;ps=next}}
        else if(ocrExt.ocrError){ext.ocrError=ocrExt.ocrError}
      }const pdfKey=`gpk_historical_invoice_pdf_v1::${Date.now()}_${i}_${Math.random().toString(36).slice(2,7)}`;ps.forEach((x,idx)=>{x.invoicePosition=x.invoicePosition||String(idx+1);x.pdfKeyPending=pdfKey;x._fileIndex=i;x._ocr=ext.usedOcr;x._ocrError=ext.ocrError||"";x._pages=ext.pages;finalizeQuality(x,existing,state.positions);state.positions.push(x)})}catch(err){console.error(err);const msg=err?.message||String(err);let hint="PDF konnte nicht analysiert werden";if(/pdfjsLib|pdfjsWorker|geladen|cdn|worker/i.test(msg))hint="PDF-Engine konnte nicht geladen werden";else if(/tesseract|ocr/i.test(msg))hint="OCR konnte nicht gestartet werden";const x={id:"HIST-ERR-"+Date.now()+"-"+i,sourceType:"historical_invoice_pdf",sourceFile:file.name,carrier:detectCarrier("",file.name),invoiceNumber:"",invoicePosition:"1",importStatus:"review",selected:false,missingFields:[hint],dataQuality:"Fehler",analysisError:msg,_fileIndex:i};state.positions.push(x)}}
  updateProgress(state.files.length,state.files.length,"Analyse abgeschlossen");setTimeout(()=>{$("historicalProgress").hidden=true},1200);state.busy=false;renderResults();}
function statusBadge(x){if(x.importStatus==="new")return '<span class="historical-status ok">Neu</span>';if(x.importStatus==="duplicate")return '<span class="historical-status conflict">Bereits vorhanden</span>';return '<span class="historical-status warning">Prüfen</span>'}
function relation(x){const o=[x.originCountry,x.originPostal,x.originCity].filter(Boolean).join(" "),d=[x.destCountry,x.destPostal,x.destCity].filter(Boolean).join(" ");return `${o||"—"} → ${d||x.customer||"—"}`}
function sizeText(x){return [x.pallets!=null?`${x.pallets} PLL`:"",x.colli!=null?`${x.colli} Colli`:"",x.weight!=null?`${x.weight} kg`:"",x.ldm!=null?`${x.ldm} LDM`:"",x.volume!=null?`${x.volume} CBM`:""].filter(Boolean).join(" · ")||"—"}
function renderResults(){const all=state.positions,view=state.filter==="all"?all:all.filter(x=>x.importStatus===state.filter);$("historicalResultArea").hidden=false;$("historicalTotalCount").textContent=all.length;$("historicalNewCount").textContent=all.filter(x=>x.importStatus==="new").length;$("historicalDuplicateCount").textContent=all.filter(x=>x.importStatus==="duplicate").length;$("historicalReviewCount").textContent=all.filter(x=>x.importStatus==="review").length;const dups=all.filter(x=>x.importStatus==="duplicate");$("historicalDuplicateAlert").hidden=!dups.length;$("historicalDuplicateAlert").innerHTML=dups.length?`<strong>${dups.length} bereits vorhandene Sendung${dups.length===1?"":"en"} erkannt.</strong> Diese Positionen werden nicht überschrieben und sind für den Import gesperrt.`:"";$("historicalPreviewMeta").textContent=`${all.length} Positionen aus ${state.files.length} PDF-Datei${state.files.length===1?"":"en"} · keine Rechnungsprüfung`;
  $("historicalPreviewRows").innerHTML=view.map(x=>{const idx=all.indexOf(x),reason=x.analysisError?`${(x.missingFields||[])[0]||"Analysefehler"}: ${x.analysisError}`:x.importStatus==="duplicate"?x.duplicateReason:(x.missingFields||[]).length?`Fehlt: ${x.missingFields.join(", ")}`:"Bereit für Import";return `<tr class="historical-row ${x.importStatus}"><td><input type="checkbox" data-historical-select="${idx}" ${x.selected?"checked":""} ${x.importStatus==="duplicate"?"disabled":""}></td><td>${statusBadge(x)}<small>${escH(reason)}</small></td><td><strong>${escH(x.carrier||"—")}</strong></td><td><strong>${escH(x.invoiceNumber||"—")}</strong><small>Pos. ${escH(x.invoicePosition||"1")}</small></td><td>${escH(x.shipmentDate||x.serviceDate||x.invoiceDate||"—")}</td><td class="historical-party-cell"><strong>${escH(x.originName||"—")}</strong><small>${escH([x.originCountry,x.originPostal,x.originCity].filter(Boolean).join(" "))}</small></td><td class="historical-party-cell"><strong>${escH(x.destName||x.customer||"—")}</strong><small>${escH([x.destCountry,x.destPostal,x.destCity].filter(Boolean).join(" "))}</small></td><td>${escH(sizeText(x))}</td><td><strong>${euro(x.actualTotal)}</strong><small>${x.freight!=null?`Fracht ${euro(x.freight)}`:""}${x.diesel!=null?` · Diesel ${euro(x.diesel)}`:""}${x.toll!=null?` · Maut ${euro(x.toll)}`:""}</small></td><td><button class="shipment-source-link" type="button" data-open-pending-pdf="${x._fileIndex}">PDF ansehen</button><small>temporär · ${x._ocr?"OCR":"Text"} · ${x._pages||"?"} S.</small></td><td><div class="historical-row-actions"><button class="secondary compact-button" type="button" data-historical-detail="${idx}">Details</button>${x.analysisError?`<button class="secondary compact-button" type="button" data-historical-retry="${x._fileIndex}">Erneut analysieren</button>`:""}</div></td></tr>`}).join("")||'<tr><td colspan="11" class="empty-state">Keine Positionen für diesen Filter.</td></tr>';
  $("historicalPreviewRows").querySelectorAll("[data-historical-select]").forEach(el=>el.addEventListener("change",()=>{state.positions[Number(el.dataset.historicalSelect)].selected=el.checked}));
  $("historicalPreviewRows").querySelectorAll("[data-open-pending-pdf]").forEach(el=>el.addEventListener("click",()=>{const f=state.files[Number(el.dataset.openPendingPdf)];if(!f)return;const url=URL.createObjectURL(f);window.open(url,"_blank","noopener");setTimeout(()=>URL.revokeObjectURL(url),60000)}));
  $("historicalPreviewRows").querySelectorAll("[data-historical-detail]").forEach(el=>el.addEventListener("click",()=>openDetail(Number(el.dataset.historicalDetail))));$("historicalPreviewRows").querySelectorAll("[data-historical-retry]").forEach(el=>el.addEventListener("click",()=>{const f=state.files[Number(el.dataset.historicalRetry)];if(f)analyzeFiles([f])}));
}

const EDIT_FIELDS=[
["orderNo","Auftragsnummer","text"],["shipmentId","Sendungsnummer","text"],["waybillNo","Frachtbriefnummer","text"],["referenceNo","Referenznummer","text"],
["invoiceDate","Rechnungsdatum","date"],["serviceDate","Leistungsdatum","date"],["shipmentDate","Abholdatum","date"],["deliveryDate","Lieferdatum","date"],
["originName","Absender Name","text"],["originCountry","Absender Land","text"],["originPostal","Absender PLZ","text"],["originCity","Absender Ort","text"],
["destName","Empfänger Name","text"],["destCountry","Empfänger Land","text"],["destPostal","Empfänger PLZ","text"],["destCity","Empfänger Ort","text"],
["service","Transportart","text"],["pallets","Paletten","number"],["colli","Kolli","number"],["slots","Stellplätze","number"],["weight","Gewicht kg","number"],["ldm","LDM","number"],["volume","CBM","number"],["distanceKm","Kilometer","number"],
["freight","Fracht netto","number"],["diesel","Diesel netto","number"],["toll","Maut netto","number"],["insurance","Versicherung netto","number"],["noticeFee","Avis netto","number"],["customs","Zoll netto","number"],["expressFee","Express netto","number"],["tailLiftFee","Hebebühne netto","number"],["waitingFee","Wartezeit netto","number"],["areaSurcharge","Insel-/Gebietszuschlag netto","number"],["palletExchangeFee","Palettentausch / Verpackung netto","number"],["otherCharges","Sonstige Nebenkosten netto","number"],["actualTotal","Gesamtsumme netto","number"],["originalChargeLabels","Originalbezeichnung Nebenkosten","text"]
];
let detailIndex=-1,detailEditing=false;
function fieldInput(x,key,label,type){const v=x[key]??"",step=type==="number"?' step="0.01"':"";return `<label class="historical-edit-field"><span>${escH(label)}</span><input data-historical-edit="${escH(key)}" type="${type}"${step} value="${escH(v)}"></label>`}
function readOnlyField(label,value){return `<div class="historical-read-field"><span>${escH(label)}</span><strong>${value===null||value===undefined||value===""?"—":escH(value)}</strong></div>`}
function renderDetail(){
 const x=state.positions[detailIndex];if(!x)return;
 $("historicalDetailSubtitle").textContent=`${x.carrier||"Unbekannter Spediteur"} · Rechnung ${x.invoiceNumber||"—"} · Position ${x.invoicePosition||1}`;
 const byKeys=keys=>EDIT_FIELDS.filter(f=>keys.includes(f[0])).map(([k,l,t])=>fieldInput(x,k,l,t)).join("");
 const cell=(k,l)=>readOnlyField(l,x[k]);
 if(detailEditing){
  $("historicalDetailBody").innerHTML=`<div class="historical-detail-headbar">${readOnlyField("Projekt",document.getElementById("shipmentImportProject")?.value||x.projectName)}${readOnlyField("Status",x.importStatus)}${readOnlyField("Spediteur",x.carrier)}${readOnlyField("Rechnung",x.invoiceNumber)}</div>
  <section class="historical-detail-section"><h3>Referenzen & Termine</h3><div class="historical-edit-grid">${byKeys(["orderNo","shipmentId","waybillNo","referenceNo","invoiceDate","serviceDate","shipmentDate","deliveryDate"])}</div></section>
  <section class="historical-detail-section"><h3>Absender</h3><div class="historical-edit-grid">${byKeys(["originName","originCountry","originPostal","originCity"])}</div></section>
  <section class="historical-detail-section"><h3>Empfänger</h3><div class="historical-edit-grid">${byKeys(["destName","destCountry","destPostal","destCity"])}</div></section>
  <section class="historical-detail-section"><h3>Sendung</h3><div class="historical-edit-grid">${byKeys(["service","pallets","colli","slots","weight","ldm","volume","distanceKm"])}</div></section>
  <section class="historical-detail-section"><h3>Kosten netto</h3><div class="historical-edit-grid">${byKeys(["freight","diesel","toll","insurance","noticeFee","customs","expressFee","tailLiftFee","waitingFee","areaSurcharge","palletExchangeFee","otherCharges","actualTotal","originalChargeLabels"])}</div></section>`;
 }else{
  $("historicalDetailBody").innerHTML=`<div class="historical-detail-headbar">${readOnlyField("Projekt",document.getElementById("shipmentImportProject")?.value||x.projectName)}${readOnlyField("Status",x.importStatus)}${readOnlyField("Datenqualität",x.dataQuality)}${readOnlyField("Fehlende Felder",(x.missingFields||[]).join(", ")||"Keine")}${x.analysisError?readOnlyField("Analysefehler",x.analysisError):""}</div>
  <section class="historical-detail-section"><h3>Referenzen & Termine</h3><div class="historical-read-grid">${cell("orderNo","Auftragsnummer")}${cell("shipmentId","Sendungsnummer")}${cell("waybillNo","Frachtbriefnummer")}${cell("referenceNo","Referenznummer")}${cell("invoiceDate","Rechnungsdatum")}${cell("serviceDate","Leistungsdatum")}${cell("shipmentDate","Abholdatum")}${cell("deliveryDate","Lieferdatum")}</div></section>
  <div class="historical-party-panels"><section class="historical-detail-section"><h3>Absender</h3><div class="historical-read-grid">${cell("originName","Name")}${cell("originCountry","Land")}${cell("originPostal","PLZ")}${cell("originCity","Ort")}</div></section><section class="historical-detail-section"><h3>Empfänger</h3><div class="historical-read-grid">${cell("destName","Name")}${cell("destCountry","Land")}${cell("destPostal","PLZ")}${cell("destCity","Ort")}</div></section></div>
  <section class="historical-detail-section"><h3>Sendung</h3><div class="historical-read-grid">${cell("service","Transportart")}${cell("pallets","Paletten")}${cell("colli","Kolli")}${cell("slots","Stellplätze")}${cell("weight","Gewicht kg")}${cell("ldm","LDM")}${cell("volume","CBM")}${cell("distanceKm","Kilometer")}</div></section>
  <section class="historical-detail-section"><h3>Kosten netto</h3><div class="historical-read-grid">${cell("freight","Fracht")}${cell("diesel","Diesel")}${cell("toll","Maut")}${cell("insurance","Versicherung")}${cell("noticeFee","Avis")}${cell("customs","Zoll")}${cell("expressFee","Express")}${cell("tailLiftFee","Hebebühne")}${cell("waitingFee","Wartezeit")}${cell("areaSurcharge","Gebietszuschlag")}${cell("palletExchangeFee","Palettentausch / Verpackung")}${cell("otherCharges","Sonstige Nebenkosten")}${cell("actualTotal","Gesamtsumme netto")}${cell("originalChargeLabels","Originalbezeichnung")}</div></section>`;
 }
 $("editHistoricalDetailBtn").hidden=detailEditing;$("saveHistoricalDetailBtn").hidden=!detailEditing;$("cancelHistoricalEditBtn").hidden=!detailEditing;
}
function recalcEditedPosition(x){if(x.importStatus==="duplicate")return;const missing=[];if(!(x.shipmentDate||x.serviceDate||x.invoiceDate))missing.push("Datum");if(!(x.destPostal||x.destCity||x.destName||x.customer))missing.push("Ziel");if(x.actualTotal===null||x.actualTotal===undefined||x.actualTotal==="")missing.push("Netto-Kosten");x.missingFields=missing;x.dataQuality=missing.length?"Unvollständig":"Vollständig";x.importStatus=missing.length?"review":"new";if(!missing.length)x.selected=true}
function saveDetailEdits(){const x=state.positions[detailIndex];if(!x)return;$("historicalDetailBody").querySelectorAll("[data-historical-edit]").forEach(inp=>{const key=inp.dataset.historicalEdit;let v=inp.value.trim();if(inp.type==="number")v=v===""?null:Number(v);x[key]=v});x.customer=x.destName||x.customer;recalcEditedPosition(x);detailEditing=false;renderDetail();renderResults();showToast("Erkannte Sendungsposition wurde gespeichert.")}
function openDetail(i){if(!state.positions[i])return;detailIndex=i;detailEditing=false;renderDetail();$("historicalDetailModal").hidden=false}
function closeDetail(){$("historicalDetailModal").hidden=true}
function clearImport(){state={files:[],positions:[],filter:"all",busy:false};$("historicalResultArea").hidden=true;$("historicalProgress").hidden=true;$("historicalPdfInput").value=""}
async function confirmImport(){
  const projectName=(document.getElementById("shipmentImportProject")?.value||"").trim();
  if(!projectName){showToast("Bitte zuerst ein Projekt auswählen oder ein neues Projekt anlegen.");return}
  const selected=state.positions.filter(x=>x.selected&&x.importStatus!=="duplicate");
  const dups=state.positions.filter(x=>x.importStatus==="duplicate").length;
  if(!selected.length){showToast(dups?`${dups} Position(en) bereits vorhanden – nichts Neues ausgewählt.`:"Keine Positionen zum Import ausgewählt.");return}
  const batchId="HISTPDF-"+Date.now(),now=new Date().toISOString();
  try{
    const rows=selected.map((x,i)=>{
      const y={...x,batchId,projectName,importedAt:now,sourceFileName:x.sourceFile||state.files[x._fileIndex]?.name||""};
      delete y.rawText;
      delete y.pdfKeyPending;
      delete y.sourcePdfKey;
      delete y._fileIndex;
      delete y._ocr;
      delete y._ocrError;
      delete y._pages;
      delete y.selected;
      delete y.duplicateOf;
      delete y.duplicateReason;
      delete y.analysisError;
      y.id=y.id||`HIST-${Date.now()}-${i}`;
      if(!y.shipmentId)y.shipmentId=y.waybillNo||y.orderNo||y.referenceNo||`${y.invoiceNumber||"INV"}-${y.invoicePosition||i+1}`;
      return y
    });
    const next=[...rows,...shipments];
    await GPK.largeWrite(GPK.KEYS.shipments,next);
    shipments=next;
    shipmentImports.unshift({id:batchId,fileName:`${state.files.length} PDF-Rechnungen`,sheetName:"Historischer PDF-Import",source:"Historische Rechnungen",projectName,count:rows.length,importedAt:now,duplicates:dups,reviewed:selected.filter(x=>x.importStatus==="review").length});
    GPK.write(GPK.KEYS.shipmentImports,shipmentImports.slice(0,100));
    renderAll();
    showToast(`${rows.length} Sendungen übernommen${dups?` · ${dups} Dublette(n) ausgelassen`:""}. PDF-Dateien wurden nicht dauerhaft gespeichert.`);
    clearImport();
    activateTab("overview");
  }catch(err){
    console.error(err);
    showToast("Historische Sendungsdaten konnten nicht gespeichert werden.");
  }
}
function showHistoricalMode(){$("historicalImportArea").hidden=false;$("tabularImportArea").hidden=true;$("historicalModeBtn").classList.add("active");$("tabularModeBtn").classList.remove("active")}
function showTabularMode(){$("historicalImportArea").hidden=true;$("tabularImportArea").hidden=false;$("historicalModeBtn").classList.remove("active");$("tabularModeBtn").classList.add("active")}
function bind(){
  $("historicalModeBtn").addEventListener("click",showHistoricalMode);$("tabularModeBtn").addEventListener("click",showTabularMode);$("chooseHistoricalPdfsBtn").addEventListener("click",()=>$("historicalPdfInput").click());$("historicalPdfInput").addEventListener("change",()=>{if($("historicalPdfInput").files.length)analyzeFiles($("historicalPdfInput").files)});
  const drop=$("historicalPdfDrop");drop.addEventListener("dragover",e=>{e.preventDefault();drop.classList.add("dragover")});drop.addEventListener("dragleave",()=>drop.classList.remove("dragover"));drop.addEventListener("drop",e=>{e.preventDefault();drop.classList.remove("dragover");if(e.dataTransfer.files.length)analyzeFiles(e.dataTransfer.files)});
  document.querySelectorAll("[data-historical-filter]").forEach(btn=>btn.addEventListener("click",()=>{state.filter=btn.dataset.historicalFilter;document.querySelectorAll("[data-historical-filter]").forEach(b=>b.classList.toggle("active",b===btn));renderResults()}));
  $("clearHistoricalImportBtn").addEventListener("click",clearImport);$("confirmHistoricalImportBtn").addEventListener("click",confirmImport);$("closeHistoricalDetailBtn").addEventListener("click",closeDetail);$("closeHistoricalDetailFooterBtn").addEventListener("click",closeDetail);$("editHistoricalDetailBtn").addEventListener("click",()=>{detailEditing=true;renderDetail()});$("saveHistoricalDetailBtn").addEventListener("click",saveDetailEdits);$("cancelHistoricalEditBtn").addEventListener("click",()=>{detailEditing=false;renderDetail()});$("openHistoricalDetailPdfBtn").addEventListener("click",()=>{const x=state.positions[detailIndex],f=x&&state.files[x._fileIndex];if(!f)return;const u=URL.createObjectURL(f);window.open(u,"_blank","noopener");setTimeout(()=>URL.revokeObjectURL(u),60000)});$("historicalDetailModal").addEventListener("click",e=>{if(e.target===$("historicalDetailModal"))closeDetail()});
}
window.GPKHistoricalImport={showHistoricalMode,showTabularMode,analyzeFiles};bind();showHistoricalMode();
})();
