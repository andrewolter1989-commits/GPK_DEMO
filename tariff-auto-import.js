(function(){
  "use strict";

  const RATE_KEY = "gpk_demo_rate_output_v1";
  const ZONE_KEY = "gpk_demo_zone_rules_v1";
  const IMPORT_KEY = "gpk_demo_tariff_imports_v1";
  const PUBLISHED_KEY = "gpk_demo_published_tariffs_v1";

  const MODEL_META = {
    WEIGHT_STEP:{label:"Gewichtsstaffel",unit:"EUR/SHIPMENT"},
    PER_KG:{label:"Preis je kg",unit:"EUR/KG"},
    PER_100KG:{label:"Preis je 100 kg",unit:"EUR/100KG"},
    LDM_STEP:{label:"Lademeterstaffel",unit:"EUR/SHIPMENT"},
    PER_LDM:{label:"Preis je Lademeter",unit:"EUR/LDM"},
    PALLET_STEP:{label:"Paletten / Stellplätze",unit:"EUR/SHIPMENT"},
    PER_PALLET:{label:"Preis je Palette",unit:"EUR/PALLET"},
    DISTANCE_STEP:{label:"Entfernungsstaffel",unit:"EUR/SHIPMENT"},
    PER_KM:{label:"Preis je km",unit:"EUR/KM"},
    FIXED_RELATION:{label:"Fixrelation",unit:"EUR/SHIPMENT"},
    FULL_LOAD:{label:"Komplettladung / FTL",unit:"EUR/SHIPMENT"},
    PACKAGE_WEIGHT_ZONE:{label:"Paketgewicht × Zone",unit:"EUR/PACKAGE"}
  };

  const POSTAL_LENGTH={DE:5,AT:4,BE:4,CH:4,LU:4,FR:5,IT:5,PL:5,CZ:5,SK:5,HU:4,SE:5,DK:4,NO:4,FI:5,ES:5,PT:4,NL:4};
  const PROVIDER_PATTERNS=[
    ["DB Schenker",/\b(?:db\s*)?schenker\b/i],["DHL Freight",/\bdhl(?:\s+freight)?\b/i],["Dachser",/\bdachser\b/i],
    ["Raben",/\braben\b/i],["DSV",/\bdsv\b/i],["DPD",/\bdpd\b/i],["GLS",/\bgls\b/i],
    ["Hellmann",/\bhellmann\b/i],["Tombers",/\btombers\b/i],["Böckmann",/\bb(?:ö|oe)ckmann\b/i],
    ["Noerpel",/\bnoerpel\b/i],["Berghegger",/\bberghegger\b/i],["Marathon Logistics",/\bmarathon\b/i],
    ["Emons",/\bemons\b/i],["Oetjen",/\boetjen\b/i]
  ];

  function esc(v=""){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
  function text(v){return String(v??"").replace(/\s+/g," ").trim();}
  function lower(v){return text(v).toLowerCase().replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue").replace(/ß/g,"ss");}
  function nonEmpty(row){return (row||[]).filter(v=>text(v)!=="");}
  function rowText(row){return nonEmpty(row).map(text).join(" | ");}
  function contextText(rows,i,back=5){return rows.slice(Math.max(0,i-back),i+1).map(rowText).join(" | ");}
  function makeId(prefix){return prefix+"-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8);}
  function num(v){
    if(typeof v==="number" && Number.isFinite(v)) return v;
    let s=text(v); if(!s) return null;
    s=s.replace(/\s/g,"").replace(/[€$£]/g,"");
    if(/^[-+]?\d+(?:\.\d+)?$/.test(s)) return Number(s);
    if(/^[-+]?\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(s)) return Number(s.replace(/\./g,"").replace(",","."));
    if(/^[-+]?\d+(?:,\d+)?$/.test(s)) return Number(s.replace(",","."));
    const m=s.match(/[-+]?\d[\d.,]*/); if(!m) return null;
    let x=m[0];
    if(x.includes(",") && x.includes(".")) x=x.lastIndexOf(",")>x.lastIndexOf(".")?x.replace(/\./g,"").replace(",","."):x.replace(/,/g,"");
    else if(x.includes(",")) x=x.replace(",",".");
    const n=Number(x); return Number.isFinite(n)?n:null;
  }
  function round(n,d=2){const p=10**d;return Math.round((Number(n)+Number.EPSILON)*p)/p;}
  function isPrice(v){const n=num(v);return n!==null && n>=0;}
  function inferCountryFromText(s){
    const t=text(s).toUpperCase();
    let m=t.match(/\b(DE|AT|BE|NL|FR|CH|IT|PL|CZ|SK|HU|SE|DK|NO|FI|ES|PT|LU|GB)\b/);
    if(m) return m[1];
    const names={DE:"DEUTSCHLAND",AT:"ÖSTERREICH",BE:"BELGIEN",NL:"NIEDERLANDE",FR:"FRANKREICH",CH:"SCHWEIZ",IT:"ITALIEN",PL:"POLEN",CZ:"TSCHECH",SE:"SCHWED"};
    return Object.keys(names).find(k=>t.includes(names[k]))||"";
  }
  function inferCountryFromSheet(sheet){
    const s=text(sheet).toUpperCase();
    const m=s.match(/(?:^|\s|_|\()(?:(?:PREISLISTE|TARIF)\s*)?(DE|AT|BE|NL|FR|CH|IT|PL|CZ|SK|HU|SE|DK|NO|FI|ES|PT|LU|GB)(?:\s|_|\)|$)/);
    return m?m[1]:inferCountryFromText(s);
  }
  function parseCountryPostcode(values, fallbackCountry=""){
    const vals=(values||[]).map(text).filter(Boolean);
    let country="",code="";
    for(const v of vals){
      let m=v.toUpperCase().match(/\b([A-Z]{1,2})\s*[- ]\s*(\d{1,5})\b/);
      if(m){country=({D:"DE",A:"AT"}[m[1]]||m[1]);code=m[2];break;}
    }
    if(!country){
      for(const v of vals){if(/^[A-Za-z]{2}$/.test(v)){country=v.toUpperCase();break;}}
    }
    if(!code){
      for(const v of vals){if(/^\d{1,5}$/.test(v)){code=v;break;}}
    }
    country=country||fallbackCountry||"";
    return {country,code};
  }
  function postcodeRange(country,code){
    code=text(code).replace(/\D/g,""); if(!code) return {from:"",to:""};
    const len=POSTAL_LENGTH[country]||Math.max(code.length,5);
    if(code.length>=len) return {from:code.slice(0,len),to:code.slice(0,len)};
    return {from:code.padEnd(len,"0"),to:code.padEnd(len,"9")};
  }
  function expandPrefixExpression(country,expr){
    const out=[]; let s=text(expr).replace(/\s+/g,""); if(!s) return out;
    s=s.replace(/\bund\b/gi,",").replace(/;/g,",");
    for(const token of s.split(",").filter(Boolean)){
      let m=token.match(/^(\d{1,5})-(\d{1,5})$/);
      if(m && m[1].length===m[2].length){
        const a=Number(m[1]),b=Number(m[2]);
        if(b>=a && b-a<=100){for(let x=a;x<=b;x++){const p=String(x).padStart(m[1].length,"0");out.push(postcodeRange(country,p));}}
        else out.push({from:m[1],to:m[2]});
      } else if(/^\d{1,5}$/.test(token)) out.push(postcodeRange(country,token));
    }
    return out;
  }
  function dimensionValue(v,model){
    const t=lower(v); if(!t) return null;
    if(model==="FULL_LOAD" || /\b(ftl|kompl|komplettladung|full load)\b/.test(t)) return {kind:"full",value:null,label:text(v)};
    let n=num(v); if(n===null) return null;
    if(model==="WEIGHT_STEP" || model==="PACKAGE_WEIGHT_ZONE"){
      if(/\b(t|to|tonne|tonnen)\b/.test(t) && !/kg/.test(t)) n*=1000;
      return {kind:/\bab\b/.test(t)?"from":"to",value:round(n,3),label:text(v)};
    }
    if(model==="LDM_STEP") return {kind:/\bab\b/.test(t)?"from":"to",value:round(n,3),label:text(v)};
    if(model==="PALLET_STEP") return {kind:/\bab\b/.test(t)?"from":"to",value:round(n,3),label:text(v)};
    if(model==="DISTANCE_STEP") return {kind:/\bab\b/.test(t)?"from":"to",value:round(n,3),label:text(v)};
    return {kind:"value",value:round(n,3),label:text(v)};
  }
  function modelFromContext(ctx,headerRow){
    const c=lower(ctx+" | "+rowText(headerRow));
    if(/businessparcel|eurobusiness|parcel|paket|express/.test(c) && /(kg|gewicht)/.test(c)) return "PACKAGE_WEIGHT_ZONE";
    if(/lademeter|\bldm\b|plz\s*\/\s*ldm/.test(c)) return "LDM_STEP";
    if(/entfernung|distanz|\bkm\b/.test(c) && !/€\s*\/\s*km|eur\s*\/\s*km|je\s*km|pro\s*km/.test(c)) return "DISTANCE_STEP";
    /* Gewichtssignale haben Vorrang vor beiläufigen Hinweisen auf Paletten/Stellplätze in Tarifbedingungen. */
    if(/frachtpflichtiges gewicht|plz\s*\/\s*(?:kg|tonnen)|gewicht in kg|gewicht.*bis|\bkg\s*bis\b|\btonnen\b/.test(c)) return "WEIGHT_STEP";
    if(/stellplatz|stellplaetze|palette|paletten|euro-paletten|halb-paletten|pll/.test(c)) return "PALLET_STEP";
    return null;
  }
  function directModelFromHeader(row){
    const c=lower(rowText(row));
    if(/(?:€|eur)\s*\/?\s*(?:je\s*)?100\s*kg|je\s*100\s*kg|pro\s*100\s*kg|100\s*kg[- ]?satz/.test(c)) return "PER_100KG";
    if(/(?:€|eur)\s*\/?\s*(?:je\s*)?kg|preis\s*(?:je|pro|\/)\s*kg|je\s*kg|pro\s*kg/.test(c)) return "PER_KG";
    if(/(?:€|eur)\s*\/?\s*(?:je\s*)?ldm|je\s*lademeter|pro\s*lademeter/.test(c)) return "PER_LDM";
    if(/(?:€|eur)\s*\/?\s*(?:je\s*)?km|je\s*km|pro\s*km/.test(c)) return "PER_KM";
    if(/(?:€|eur)\s*\/?\s*(?:je\s*)?(?:palette|pll)|je\s*palette|pro\s*palette/.test(c)) return "PER_PALLET";
    return null;
  }
  function detectProvider(fileName,sheets){
    let sample=text(fileName)+" | ";
    for(const s of sheets.slice(0,6)){
      sample+=s.name+" | "+s.rows.slice(0,25).map(rowText).join(" | ")+" | ";
      if(sample.length>50000) break;
    }
    for(const [name,re] of PROVIDER_PATTERNS) if(re.test(sample)) return name;
    return "";
  }
  function confidenceFor(model,ctx,rateCount,zoneCount,notes=[]){
    let c=0.70;
    const x=lower(ctx);
    const signals={
      WEIGHT_STEP:/frachtpflichtiges gewicht|plz\s*\/\s*(?:kg|tonnen)|gewicht.*bis/,
      LDM_STEP:/lademeter|\bldm\b/,
      PALLET_STEP:/stellplatz|palette|paletten|pll/,
      PACKAGE_WEIGHT_ZONE:/parcel|paket|express/,
      DISTANCE_STEP:/entfernung|distanz|\bkm\b/,
      FULL_LOAD:/ftl|komplettladung|full load/,
      FIXED_RELATION:/ladestelle|entladestelle|relation/,
      PER_KG:/je\s*kg|pro\s*kg|eur\s*\/\s*kg|€\s*\/\s*kg/,
      PER_100KG:/100\s*kg[- ]?satz|je\s*100\s*kg|eur\s*\/\s*100\s*kg/,
      PER_LDM:/je\s*lademeter|eur\s*\/\s*ldm/,
      PER_KM:/je\s*km|eur\s*\/\s*km/,
      PER_PALLET:/je\s*palette|eur\s*\/\s*palette/
    };
    if(signals[model]?.test(x)) c+=0.18;
    if(rateCount>=10) c+=0.07; else if(rateCount>=2)c+=0.03;
    if(zoneCount>=1)c+=0.04;
    if(notes.includes("ambiguous"))c-=0.18;
    if(notes.includes("partial"))c-=0.12;
    return Math.max(0.35,Math.min(0.99,round(c,2)));
  }

  function zoneFromRow(blockId,sheetName,labelValues,fallbackCountry,sourceRow){
    const cp=parseCountryPostcode(labelValues,fallbackCountry);
    if(cp.code){
      const rg=postcodeRange(cp.country,cp.code);
      const zone=(cp.country?cp.country+"-":"")+cp.code;
      return {id:makeId("zone"),blockId,zoneSet:sheetName,ruleType:"POSTCODE",originCountry:"",originPostcodeFrom:"",originPostcodeTo:"",destCountry:cp.country,destPostcodeFrom:rg.from,destPostcodeTo:rg.to,distanceFromKm:"",distanceToKm:"",originName:"",destinationName:"",zone,priority:100,sourceRef:sheetName+"!"+sourceRow};
    }
    const joined=text(labelValues.join(" "));
    const z=joined.match(/\bzone\s*([A-Za-z0-9_-]+)\b/i);
    if(z) return {id:makeId("zone"),blockId,zoneSet:sheetName,ruleType:"SERVICE_ZONE",originCountry:"",originPostcodeFrom:"",originPostcodeTo:"",destCountry:fallbackCountry, destPostcodeFrom:"",destPostcodeTo:"",distanceFromKm:"",distanceToKm:"",originName:"",destinationName:"",zone:"Z"+z[1],priority:70,sourceRef:sheetName+"!"+sourceRow};
    return null;
  }
  function dedupeZones(zones){
    const map=new Map();
    for(const z of zones){const k=[z.ruleType,z.originCountry,z.originPostcodeFrom,z.originPostcodeTo,z.destCountry,z.destPostcodeFrom,z.destPostcodeTo,z.distanceFromKm,z.distanceToKm,z.originName,z.destinationName,z.zone].join("|");if(!map.has(k))map.set(k,z);}
    return [...map.values()];
  }

  function parseHorizontalMatrix(sheetName,rows,headerIdx,model){
    const header=rows[headerIdx]||[]; const ctx=contextText(rows,headerIdx,6); const fallbackCountry=inferCountryFromText(ctx)||inferCountryFromSheet(sheetName);
    const dims=[];
    for(let c=0;c<header.length;c++){
      const d=dimensionValue(header[c],model);
      if(d && (typeof header[c]==="number" || /(kg|ldm|lademeter|tonne|tonnen|palette|stellplatz|km|ftl|kompl|bis|ab)/i.test(text(header[c])))) dims.push({col:c,...d});
    }
    if(dims.length<2) return null;
    const firstCol=Math.min(...dims.map(x=>x.col));
    const priceCols=dims.map(x=>x.col);
    let dataRows=0, emptyStreak=0; const rates=[],zones=[];
    const blockId=makeId("block");
    for(let r=headerIdx+1;r<rows.length;r++){
      const row=rows[r]||[]; const values=priceCols.map(c=>num(row[c])); const priceCount=values.filter(v=>v!==null).length;
      const labels=row.slice(0,firstCol);
      if(priceCount<Math.max(1,Math.floor(priceCols.length*0.25))){
        if(nonEmpty(row).length===0) emptyStreak++; else if(priceCount===0) emptyStreak++;
        if(dataRows>0 && emptyStreak>=3) break;
        continue;
      }
      emptyStreak=0; dataRows++;
      const z=zoneFromRow(blockId,sheetName,labels,fallbackCountry,r+1);
      const zone=z?.zone||text(labels.filter(Boolean).slice(-1)[0])||("ROW-"+(r+1)); if(z) zones.push(z);
      const cp=parseCountryPostcode(labels,fallbackCountry);
      for(const d of dims){
        const price=num(row[d.col]); if(price===null) continue;
        const rm=d.kind==="full"?"FULL_LOAD":model;
        const rate={id:makeId("rate"),blockId,sheet:sheetName,sourceRow:r+1,rateModel:rm,product:rm==="FULL_LOAD"?"FTL":"",subservice:"",originCountry:"",destCountry:cp.country||fallbackCountry,zone,relationName:"",chargeFrom:"",chargeTo:d.value??"",chargeLabel:d.label,unit:MODEL_META[rm]?.unit||"EUR/SHIPMENT",price:round(price),currency:"EUR",priority:rm==="FULL_LOAD"?150:100,sourceRef:sheetName+"!R"+(r+1)+"C"+(d.col+1)};
        rates.push(rate);
      }
    }
    if(dataRows<2 || rates.length<4) return null;
    const dz=dedupeZones(zones); const conf=confidenceFor(model,ctx,rates.length,dz.length);
    return {id:blockId,sheet:sheetName,headerRow:headerIdx+1,model,modelLabel:MODEL_META[model]?.label||model,confidence:conf,status:conf>=0.90?"AUTO_CANDIDATE":"REVIEW",rates,zones:dz,summary:`${rates.length} Preise · ${dz.length} Zonen`,context:text(ctx).slice(0,500)};
  }

  function findZoneHeaderColumns(row){
    const cols=[];
    for(let c=0;c<row.length;c++){
      const t=text(row[c]);
      if(/^\d{1,2}(?:-\d{1,2})?(?:\s*,\s*\d{1,2}(?:-\d{1,2})?)*$/.test(t) || /^zone\s*\w+/i.test(t)) cols.push(c);
    }
    return cols;
  }
  function parseVerticalZoneMatrices(sheetName,rows){
    const blocks=[]; const fallbackCountry=inferCountryFromSheet(sheetName)||inferCountryFromText(rows.slice(0,20).map(rowText).join(" "));
    for(let h=0;h<rows.length;h++){
      const zoneHeaderText=lower(rowText(rows[h]||[]));
      if(!/(plz|postleitzahl|zone)/.test(zoneHeaderText)) continue;
      const zcols=findZoneHeaderColumns(rows[h]||[]); if(zcols.length<2) continue;
      const firstZone=Math.min(...zcols);
      for(let s=h+1;s<Math.min(rows.length,h+35);s++){
        const sub=lower(rowText(rows[s]||[]));
        if(!/(anzahl|palette|paletten|stellplatz|gewicht|kg|ldm|lademeter)/.test(sub)) continue;
        let model=/palette|paletten|stellplatz/.test(sub)?"PALLET_STEP":/ldm|lademeter/.test(sub)?"LDM_STEP":"WEIGHT_STEP";
        const blockId=makeId("block"); const rates=[],zones=[];
        for(let zi=0;zi<zcols.length;zi++){
          const col=zcols[zi], expr=text(rows[h][col]), zone=`${fallbackCountry||"Z"}-${h+1}-${zi+1}`;
          const ranges=expandPrefixExpression(fallbackCountry,expr);
          if(ranges.length){for(const rg of ranges) zones.push({id:makeId("zone"),blockId,zoneSet:sheetName,ruleType:"POSTCODE",originCountry:"",originPostcodeFrom:"",originPostcodeTo:"",destCountry:fallbackCountry,destPostcodeFrom:rg.from,destPostcodeTo:rg.to,distanceFromKm:"",distanceToKm:"",originName:"",destinationName:"",zone,priority:100,sourceRef:sheetName+"!R"+(h+1)+"C"+(col+1)});}
          else zones.push({id:makeId("zone"),blockId,zoneSet:sheetName,ruleType:"SERVICE_ZONE",originCountry:"",originPostcodeFrom:"",originPostcodeTo:"",destCountry:fallbackCountry,destPostcodeFrom:"",destPostcodeTo:"",distanceFromKm:"",distanceToKm:"",originName:"",destinationName:"",zone,priority:70,sourceRef:sheetName+"!R"+(h+1)+"C"+(col+1)});
        }
        let r=s+1, dataRows=0;
        for(;r<rows.length;r++){
          const row=rows[r]||[]; const dimCell=row.slice(0,firstZone).findLast?row.slice(0,firstZone).findLast(v=>text(v)!==""):row.slice(0,firstZone).filter(v=>text(v)!=="").slice(-1)[0];
          const dim=dimensionValue(dimCell,model); const pc=zcols.map(c=>num(row[c])).filter(v=>v!==null).length;
          if(!dim || pc<Math.max(1,Math.floor(zcols.length*0.4))) break;
          dataRows++;
          for(let zi=0;zi<zcols.length;zi++){
            const price=num(row[zcols[zi]]); if(price===null) continue;
            rates.push({id:makeId("rate"),blockId,sheet:sheetName,sourceRow:r+1,rateModel:model,product:text(rows[s].slice(0,firstZone).filter(v=>text(v)).slice(-1)[0]),subservice:"",originCountry:"",destCountry:fallbackCountry,zone:`${fallbackCountry||"Z"}-${h+1}-${zi+1}`,relationName:"",chargeFrom:"",chargeTo:dim.value??"",chargeLabel:dim.label,unit:MODEL_META[model].unit,price:round(price),currency:"EUR",priority:100,sourceRef:sheetName+"!R"+(r+1)+"C"+(zcols[zi]+1)});
          }
        }
        if(dataRows>=2 && rates.length>=4){
          const ctx=contextText(rows,s,8);const dz=dedupeZones(zones);const conf=confidenceFor(model,ctx,rates.length,dz.length);
          blocks.push({id:blockId,sheet:sheetName,headerRow:s+1,model,modelLabel:MODEL_META[model].label,confidence:conf,status:conf>=0.90?"AUTO_CANDIDATE":"REVIEW",rates,zones:dz,summary:`${rates.length} Preise · ${dz.length} Zonen`,context:text(ctx).slice(0,500)});
          /* Eine gemeinsame Zonen-Kopfzeile kann mehrere Produktblöcke haben (z. B. Halbpalette + Europalette). */
          s=Math.max(s,r-1);
        }
      }
    }
    return blocks;
  }

  function parseDirectUnitTable(sheetName,rows,headerIdx,model){
    const header=rows[headerIdx]||[]; const headerNorm=header.map(lower);
    let priceCol=-1;
    const tests={PER_KG:/kg/,PER_100KG:/100\s*kg/,PER_LDM:/ldm|lademeter/,PER_KM:/km/,PER_PALLET:/palette|pll/};
    for(let c=0;c<header.length;c++) if(tests[model].test(headerNorm[c]) && /(€|eur|preis|satz|je|pro|\/)/.test(headerNorm[c])){priceCol=c;break;}
    if(priceCol<0){for(let c=0;c<header.length;c++) if(/preis|fracht/.test(headerNorm[c])){priceCol=c;break;}}
    if(priceCol<0) return null;
    const blockId=makeId("block"),rates=[],zones=[]; const fallbackCountry=inferCountryFromSheet(sheetName)||inferCountryFromText(contextText(rows,headerIdx,5));
    let empty=0;
    for(let r=headerIdx+1;r<rows.length;r++){
      const row=rows[r]||[]; const price=num(row[priceCol]);
      if(price===null){empty++;if(rates.length && empty>=3)break;continue;} empty=0;
      const labels=row.filter((_,c)=>c!==priceCol); const z=zoneFromRow(blockId,sheetName,labels,fallbackCountry,r+1);if(z)zones.push(z);
      const cp=parseCountryPostcode(labels,fallbackCountry);const joined=text(labels.join(" | "));
      rates.push({id:makeId("rate"),blockId,sheet:sheetName,sourceRow:r+1,rateModel:model,product:"",subservice:"",originCountry:"",destCountry:cp.country||fallbackCountry,zone:z?.zone||"",relationName:joined.slice(0,180),chargeFrom:"",chargeTo:"",chargeLabel:"",unit:MODEL_META[model].unit,price:round(price,4),currency:"EUR",priority:100,sourceRef:sheetName+"!R"+(r+1)+"C"+(priceCol+1)});
    }
    if(rates.length<2)return null;const dz=dedupeZones(zones);const ctx=contextText(rows,headerIdx,5);const conf=confidenceFor(model,ctx,rates.length,dz.length);
    return {id:blockId,sheet:sheetName,headerRow:headerIdx+1,model,modelLabel:MODEL_META[model].label,confidence:conf,status:conf>=0.90?"AUTO_CANDIDATE":"REVIEW",rates,zones:dz,summary:`${rates.length} Preise · ${dz.length} Zonen`,context:text(ctx).slice(0,500)};
  }

  function parseFixedRelations(sheetName,rows){
    const blocks=[];
    for(let h=0;h<rows.length;h++){
      const cells=(rows[h]||[]).map(lower);let o=-1,d=-1,p=-1;
      for(let c=0;c<cells.length;c++){
        if(o<0 && /ladestelle|ladeort|origin|^von$/.test(cells[c]))o=c;
        if(d<0 && /entladestelle|entladstelle|destination|ziel|^nach$/.test(cells[c]))d=c;
        if(p<0 && /frachtpreis|preis.*€|preis.*eur|^preis$/.test(cells[c]))p=c;
      }
      if(o<0||d<0||p<0)continue;
      const ctx=contextText(rows,h,7);const isFTL=/ftl|komplettladung|full load|ladung/.test(lower(sheetName+" "+ctx));const model=isFTL?"FULL_LOAD":"FIXED_RELATION";const blockId=makeId("block"),rates=[],zones=[];
      let empty=0;
      for(let r=h+1;r<rows.length;r++){
        const row=rows[r]||[];const origin=text(row[o]),dest=text(row[d]),price=num(row[p]);
        if(!origin&&!dest&&price===null){empty++;if(rates.length&&empty>=2)break;continue;}empty=0;
        if(!origin||!dest||price===null)continue;
        const oc=parseCountryPostcode([origin],"");const dc=parseCountryPostcode([dest],"");const zone="REL-"+(rates.length+1);
        rates.push({id:makeId("rate"),blockId,sheet:sheetName,sourceRow:r+1,rateModel:model,product:isFTL?"FTL":"",subservice:"",originCountry:oc.country,destCountry:dc.country,zone,relationName:origin+" → "+dest,chargeFrom:"",chargeTo:"",chargeLabel:"",unit:"EUR/SHIPMENT",price:round(price),currency:"EUR",priority:1000,sourceRef:sheetName+"!R"+(r+1)+"C"+(p+1)});
        const orgRg=postcodeRange(oc.country,oc.code),dstRg=postcodeRange(dc.country,dc.code);
        zones.push({id:makeId("zone"),blockId,zoneSet:sheetName,ruleType:"FIXED_RELATION",originCountry:oc.country,originPostcodeFrom:orgRg.from,originPostcodeTo:orgRg.to,destCountry:dc.country,destPostcodeFrom:dstRg.from,destPostcodeTo:dstRg.to,distanceFromKm:"",distanceToKm:"",originName:origin,destinationName:dest,zone,priority:1000,sourceRef:sheetName+"!R"+(r+1)});
      }
      if(rates.length){const conf=confidenceFor(model,sheetName+" | "+ctx,rates.length,zones.length);blocks.push({id:blockId,sheet:sheetName,headerRow:h+1,model,modelLabel:MODEL_META[model].label,confidence:conf,status:conf>=0.90?"AUTO_CANDIDATE":"REVIEW",rates,zones:dedupeZones(zones),summary:`${rates.length} Fixrelationen`,context:text(ctx).slice(0,500)});h+=rates.length;}
    }
    return blocks;
  }

  function overlap(a,b){
    if(a.sheet!==b.sheet)return false;
    const a0=a.headerRow,a1=Math.max(a0,...a.rates.map(r=>r.sourceRow||a0)),b0=b.headerRow,b1=Math.max(b0,...b.rates.map(r=>r.sourceRow||b0));
    return Math.max(a0,b0)<=Math.min(a1,b1);
  }
  function analyzeSheet(sheetName,rows){
    const blocks=[];
    blocks.push(...parseFixedRelations(sheetName,rows));
    blocks.push(...parseVerticalZoneMatrices(sheetName,rows));
    for(let i=0;i<rows.length;i++){
      const dm=directModelFromHeader(rows[i]||[]);
      if(dm){const b=parseDirectUnitTable(sheetName,rows,i,dm);if(b&&!blocks.some(x=>overlap(x,b)))blocks.push(b);}
      const model=modelFromContext(contextText(rows,i,5),rows[i]||[]);
      if(model){const b=parseHorizontalMatrix(sheetName,rows,i,model);if(b&&!blocks.some(x=>overlap(x,b)))blocks.push(b);}
    }
    return blocks;
  }

  async function readWorkbook(file){
    const XLSX=await ensureXLSX();
    if(file.name.toLowerCase().endsWith(".csv")){
      const txt=(await file.text()).replace(/^\uFEFF/,"");const rows=parseSimpleCSV(txt);return [{name:"CSV",rows}];
    }
    const data=await file.arrayBuffer();const wb=XLSX.read(data,{type:"array",cellDates:false,cellFormula:false,cellNF:false});
    return wb.SheetNames.map(name=>({name,rows:XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:"",raw:true,blankrows:false})}));
  }

  async function analyzeFile(file){
    const sheets=await readWorkbook(file);let blocks=[];
    for(const sheet of sheets){try{blocks.push(...analyzeSheet(sheet.name,sheet.rows));}catch(err){console.warn("Tariferkennung",sheet.name,err);}}
    blocks=blocks.filter(b=>b.rates.length).sort((a,b)=>a.sheet.localeCompare(b.sheet)||a.headerRow-b.headerRow);
    const provider=detectProvider(file.name,sheets);
    return {fileName:file.name,sheetCount:sheets.length,provider,blocks,rates:blocks.flatMap(b=>b.rates),zones:dedupeZones(blocks.flatMap(b=>b.zones)),sheets:sheets.map(s=>s.name)};
  }

  function installModal(){
    if(document.getElementById("gpkTariffAutoImport"))return;
    document.body.insertAdjacentHTML("beforeend",`
      <div class="modal-backdrop" id="gpkTariffAutoImport" hidden>
        <section class="location-modal tariff-auto-import-modal" role="dialog" aria-modal="true">
          <div class="modal-head"><div><span class="modal-eyebrow">Tarif-Importer</span><h2>Tarif automatisch erkennen</h2><small id="gpkTariffAutoFile" class="import-file-name"></small></div></div>
          <div class="auto-import-topbar">
            <div class="field"><label>Dienstleister</label><input id="gpkTariffAutoProvider" list="gpkTariffProviderList" placeholder="Dienstleister auswählen oder eingeben"><datalist id="gpkTariffProviderList"></datalist></div>
            <div class="auto-import-analyse-note"><strong>Scope v1</strong><span>Preislogik + Tarifmodell + Zonen. Params, Nebenkosten und Floater folgen im nächsten Schritt.</span></div>
          </div>
          <div class="auto-import-summary" id="gpkTariffAutoSummary"></div>
          <div class="auto-import-body">
            <div class="auto-import-blocks"><div class="import-section-head"><div><h3>Erkannte Tarifblöcke</h3><p>Automatische Kandidaten sind vorausgewählt. REVIEW-Blöcke müssen bewusst aktiviert werden.</p></div></div><div id="gpkTariffAutoBlocks" class="auto-import-block-list"></div></div>
            <div class="auto-import-preview"><div class="import-section-head"><div><h3>Normalisierte Vorschau</h3><p id="gpkTariffAutoPreviewMeta"></p></div><div class="preview-toggle"><button class="preview-toggle-btn active" data-auto-preview="rates" type="button">Preise</button><button class="preview-toggle-btn" data-auto-preview="zones" type="button">Zonen</button></div></div><div class="masterdata-table-wrap auto-preview-wrap"><table class="masterdata-table auto-preview-table"><thead id="gpkTariffAutoPreviewHead"></thead><tbody id="gpkTariffAutoPreviewRows"></tbody></table></div></div>
          </div>
          <div class="modal-actions"><button class="secondary compact-button" id="gpkTariffAutoCancel" type="button">Abbrechen</button><button class="primary compact-button" id="gpkTariffAutoConfirm" type="button">Auswahl importieren</button></div>
        </section>
      </div>`);
    document.getElementById("gpkTariffAutoCancel").addEventListener("click",close);
    document.querySelectorAll("[data-auto-preview]").forEach(btn=>btn.addEventListener("click",()=>{state.preview=btn.dataset.autoPreview;document.querySelectorAll("[data-auto-preview]").forEach(x=>x.classList.toggle("active",x===btn));renderPreview();}));
    document.getElementById("gpkTariffAutoConfirm").addEventListener("click",confirmImport);
  }

  const state={file:null,analysis:null,selected:new Set(),preview:"rates"};
  function allProviderNames(){
    const p=(GPK.read(GPK.KEYS.providers,[])||[]).map(x=>x.name).filter(Boolean);
    return [...new Set(["DHL Freight","DB Schenker","Dachser","Raben","DSV","DPD","GLS","Hellmann","Noerpel","Tombers","Böckmann","Berghegger","Marathon Logistics","Emons",...p])].sort();
  }
  function renderProviderList(){document.getElementById("gpkTariffProviderList").innerHTML=allProviderNames().map(x=>`<option value="${esc(x)}"></option>`).join("");}
  function renderSummary(){
    const a=state.analysis;const auto=a.blocks.filter(b=>b.status==="AUTO_CANDIDATE").length,review=a.blocks.length-auto;
    document.getElementById("gpkTariffAutoSummary").innerHTML=`<div><span>Arbeitsblätter</span><strong>${a.sheetCount}</strong></div><div><span>Tarifblöcke</span><strong>${a.blocks.length}</strong></div><div><span>Preise</span><strong>${a.rates.length.toLocaleString("de-DE")}</strong></div><div><span>Zonenregeln</span><strong>${a.zones.length.toLocaleString("de-DE")}</strong></div><div><span>Auto / Review</span><strong>${auto} / ${review}</strong></div>`;
  }
  function renderBlocks(){
    const wrap=document.getElementById("gpkTariffAutoBlocks");
    if(!state.analysis.blocks.length){wrap.innerHTML=`<div class="empty-state auto-import-empty"><strong>Kein unterstützter Tarifblock erkannt.</strong><span>Die Datei kann trotzdem später über ein manuelles Mapping ergänzt werden.</span></div>`;return;}
    wrap.innerHTML=state.analysis.blocks.map((b,idx)=>`<label class="auto-block-card ${b.status==='REVIEW'?'review':''}"><input type="checkbox" data-auto-block="${esc(b.id)}" ${state.selected.has(b.id)?'checked':''}><span class="auto-block-main"><span class="auto-block-title"><strong>${esc(b.modelLabel)}</strong><span class="confidence-pill ${b.status==='REVIEW'?'review':'auto'}">${Math.round(b.confidence*100)} % · ${b.status==='REVIEW'?'REVIEW':'AUTO'}</span></span><span class="auto-block-meta">${esc(b.sheet)} · Zeile ${b.headerRow} · ${esc(b.summary)}</span></span></label>`).join("");
    wrap.querySelectorAll("[data-auto-block]").forEach(cb=>cb.addEventListener("change",()=>{if(cb.checked)state.selected.add(cb.dataset.autoBlock);else state.selected.delete(cb.dataset.autoBlock);renderPreview();updateConfirm();}));
  }
  function selectedBlocks(){return state.analysis?state.analysis.blocks.filter(b=>state.selected.has(b.id)):[];}
  function renderPreview(){
    const bs=selectedBlocks();const rates=bs.flatMap(b=>b.rates),zones=dedupeZones(bs.flatMap(b=>b.zones));const isRates=state.preview==="rates";
    document.getElementById("gpkTariffAutoPreviewMeta").textContent=isRates?`${rates.length.toLocaleString("de-DE")} Preiszeilen in Auswahl`:`${zones.length.toLocaleString("de-DE")} Zonenregeln in Auswahl`;
    const head=document.getElementById("gpkTariffAutoPreviewHead"),body=document.getElementById("gpkTariffAutoPreviewRows");
    if(isRates){head.innerHTML="<tr><th>Modell</th><th>Land / Zone</th><th>Stufe</th><th>Preis</th><th>Quelle</th></tr>";body.innerHTML=rates.slice(0,30).map(r=>`<tr><td><span class="transport-pill">${esc(r.rateModel)}</span></td><td><strong>${esc(r.destCountry||'—')}</strong><small>${esc(r.zone||r.relationName||'—')}</small></td><td>${esc(r.chargeLabel||r.chargeTo||'—')}</td><td><strong class="price-cell">${new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:4}).format(r.price)}</strong><small>${esc(r.unit)}</small></td><td><small>${esc(r.sourceRef)}</small></td></tr>`).join("")||`<tr><td colspan="5" class="empty-state">Keine Preiszeilen ausgewählt.</td></tr>`;}
    else{head.innerHTML="<tr><th>Typ</th><th>Land</th><th>PLZ / Relation</th><th>Zone</th><th>Priorität</th></tr>";body.innerHTML=zones.slice(0,30).map(z=>`<tr><td>${esc(z.ruleType)}</td><td>${esc(z.destCountry||'—')}</td><td><strong>${esc(z.destPostcodeFrom||z.destinationName||'—')}</strong><small>${z.destPostcodeTo&&z.destPostcodeTo!==z.destPostcodeFrom?'– '+esc(z.destPostcodeTo):''}</small></td><td><span class="transport-pill">${esc(z.zone)}</span></td><td>${esc(z.priority)}</td></tr>`).join("")||`<tr><td colspan="5" class="empty-state">Keine Zonen ausgewählt.</td></tr>`;}
  }
  function updateConfirm(){const btn=document.getElementById("gpkTariffAutoConfirm");btn.disabled=!state.selected.size || !text(document.getElementById("gpkTariffAutoProvider").value);}
  function close(){document.getElementById("gpkTariffAutoImport").hidden=true;document.body.classList.remove("modal-open");}
  async function open(file){
    installModal();state.file=file;state.preview="rates";document.getElementById("gpkTariffAutoFile").textContent=file.name;document.getElementById("gpkTariffAutoSummary").innerHTML='<div class="auto-loading"><span class="auto-spinner"></span><strong>Tarif wird analysiert …</strong></div>';document.getElementById("gpkTariffAutoBlocks").innerHTML="";document.getElementById("gpkTariffAutoPreviewRows").innerHTML="";document.getElementById("gpkTariffAutoImport").hidden=false;document.body.classList.add("modal-open");renderProviderList();
    try{state.analysis=await analyzeFile(file);state.selected=new Set(state.analysis.blocks.filter(b=>b.status==="AUTO_CANDIDATE").map(b=>b.id));document.getElementById("gpkTariffAutoProvider").value=state.analysis.provider||"";document.getElementById("gpkTariffAutoProvider").addEventListener("input",updateConfirm,{once:false});renderSummary();renderBlocks();renderPreview();updateConfirm();}
    catch(err){document.getElementById("gpkTariffAutoSummary").innerHTML=`<div class="auto-import-error"><strong>Analyse fehlgeschlagen</strong><span>${esc(err.message)}</span></div>`;document.getElementById("gpkTariffAutoConfirm").disabled=true;}
  }
  function chooseAndOpen(){const input=document.createElement("input");input.type="file";input.accept=".xlsx,.xls,.xlsm,.xlsb,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";input.addEventListener("change",()=>{if(input.files?.[0])open(input.files[0]);},{once:true});input.click();}

  function confirmImport(){
    const provider=text(document.getElementById("gpkTariffAutoProvider").value);if(!provider||!state.analysis)return;
    const blocks=selectedBlocks();if(!blocks.length)return;
    const batchId=makeId("import");const now=new Date().toISOString();
    const newRates=blocks.flatMap(b=>b.rates.map(r=>({...r,id:makeId("rate"),batchId,provider,confidence:b.confidence,reviewStatus:b.status,sourceFile:state.file.name,importedAt:now})));
    const newZones=dedupeZones(blocks.flatMap(b=>b.zones)).map(z=>({...z,id:makeId("zone"),batchId,provider,sourceFile:state.file.name,importedAt:now}));
    const oldRates=GPK.read(RATE_KEY,[])||[],oldZones=GPK.read(ZONE_KEY,[])||[],oldImports=GPK.read(IMPORT_KEY,[])||[];
    GPK.write(RATE_KEY,[...newRates,...oldRates]);GPK.write(ZONE_KEY,[...newZones,...oldZones]);
    const batch={id:batchId,fileName:state.file.name,provider,createdAt:now,sheets:state.analysis.sheets,blocks:blocks.map(b=>({id:b.id,sheet:b.sheet,model:b.model,confidence:b.confidence,status:b.status,rates:b.rates.length,zones:b.zones.length})),ratesCount:newRates.length,zonesCount:newZones.length,reviewCount:blocks.filter(b=>b.status==="REVIEW").length};
    GPK.write(IMPORT_KEY,[batch,...oldImports].slice(0,100));GPK.logImport?.({module:"Tarif-Autoimport",fileName:state.file.name,count:newRates.length,status:"success"});close();try{if(typeof render==="function")render();}catch(_){ }refreshPageStatus();if(window.rateToast){rateToast.textContent=`${newRates.length.toLocaleString('de-DE')} Preise und ${newZones.length.toLocaleString('de-DE')} Zonenregeln importiert.`;rateToast.hidden=false;setTimeout(()=>rateToast.hidden=true,3200);}
  }

  function modelTransport(model){
    if(model==="FULL_LOAD")return "FTL";
    if(["WEIGHT_STEP","PER_KG","PER_100KG","LDM_STEP","PER_LDM","PALLET_STEP","PER_PALLET","DISTANCE_STEP","PER_KM"].includes(model))return "Teilladung";
    if(model==="PACKAGE_WEIGHT_ZONE")return "Paket";
    return "Tarif";
  }
  function syncImportedProviderFilter(imports){
    const sel=document.getElementById("rateProviderFilter");if(!sel)return;
    const have=new Set([...sel.options].map(o=>o.value));
    [...new Set(imports.map(x=>x.provider).filter(Boolean))].sort().forEach(name=>{if(have.has(name))return;const o=document.createElement("option");o.value=name;o.textContent=name;sel.appendChild(o);have.add(name);});
  }
  function filteredImports(imports){
    const q=lower(document.getElementById("rateSearch")?.value||"");
    const pf=text(document.getElementById("rateProviderFilter")?.value||"");
    const tf=text(document.getElementById("rateTransportFilter")?.value||"");
    const sf=text(document.getElementById("rateStatusFilter")?.value||"");
    return imports.filter(x=>{
      const models=(x.blocks||[]).map(b=>b.model);
      const transports=new Set(models.map(modelTransport));
      const hay=lower([x.provider,x.fileName,...(x.sheets||[]),...models].join(" "));
      const status=x.reviewCount?"inactive":"active";
      return (!q||hay.includes(q))&&(!pf||x.provider===pf)&&(!tf||transports.has(tf))&&(!sf||status===sf);
    });
  }
  function appendImportedRows(){
    const tbody=document.getElementById("rateRows");if(!tbody)return;
    tbody.querySelectorAll("tr[data-auto-import-row]").forEach(x=>x.remove());
    const imports=filteredImports(GPK.read(IMPORT_KEY,[])||[]);
    if(imports.length && tbody.querySelector(".empty-state"))tbody.innerHTML="";
    const html=imports.map(x=>{
      const models=[...new Set((x.blocks||[]).map(b=>b.model))];
      const sheets=[...new Set((x.blocks||[]).map(b=>b.sheet).filter(Boolean))];
      return `<tr class="auto-main-table-row" data-auto-import-row="${esc(x.id)}"><td><div class="provider-name-cell"><div class="provider-avatar">${esc((x.provider||"AU").slice(0,2).toUpperCase())}</div><div><strong>${esc(x.provider)}</strong><small>${esc(x.fileName)}</small></div></div></td><td><strong class="table-main">Automatischer Import</strong><small>${esc(sheets.slice(0,3).join(" · ")||"Tarifset")}</small></td><td><strong class="table-main">${Number(x.zonesCount||0).toLocaleString("de-DE")} Zonen</strong><small>normalisiert</small></td><td><div class="auto-model-stack">${models.slice(0,3).map(m=>`<span class="transport-pill">${esc(m)}</span>`).join("")}${models.length>3?`<small>+${models.length-3}</small>`:""}</div></td><td><strong class="price-cell">${Number(x.ratesCount||0).toLocaleString("de-DE")}</strong><small>Preiszeilen</small></td><td><span class="muted-dash">—</span></td><td><strong class="auto-benchmark-label">Benchmark</strong></td><td><span class="status-pill ${x.reviewCount?'inactive':'active'}">${x.reviewCount?'Review':'Importiert'}</span></td><td class="row-actions"><button class="icon-button" data-auto-compare="${esc(x.id)}" title="Mit bestehendem Benchmark vergleichen">⇄</button><button class="icon-button" data-auto-benchmark="${esc(x.id)}" title="Benchmark-Vordruck exportieren">⇩</button><button class="icon-button" data-auto-zones="${esc(x.id)}" title="Zonen-CSV exportieren">⌗</button></td></tr>`;
    }).join("");
    if(html)tbody.insertAdjacentHTML("beforeend",html);
    const visible=document.getElementById("visibleRateCount");if(visible){const count=[...tbody.querySelectorAll("tr")].filter(tr=>!tr.querySelector(".empty-state")).length;visible.textContent=count;}
  }

  function safeFilePart(v){return text(v||"Export").replace(/[^A-Za-z0-9ÄÖÜäöüß_-]+/g,"_").replace(/^_+|_+$/g,"").slice(0,80)||"Export";}
  function benchmarkProduct(r){if(text(r.product))return text(r.product);if(r.rateModel==="PACKAGE_WEIGHT_ZONE")return "Parcel";if(r.rateModel==="FULL_LOAD")return "FTL";return "Road";}
  function benchmarkStep(model){if(["WEIGHT_STEP","PACKAGE_WEIGHT_ZONE","LDM_STEP"].includes(model))return 0.1;if(["PALLET_STEP","DISTANCE_STEP"].includes(model))return 1;if(model==="PER_LDM")return 0.1;return 1;}
  function benchmarkPer(model){return model==="PER_100KG"?100:1;}
  function benchmarkUnit(model,isFirst){
    if(model==="PER_KG"||model==="PER_100KG")return "KG";
    if(model==="PER_LDM")return "LDM";
    if(model==="PER_KM")return "KM";
    if(model==="PER_PALLET")return "PLL";
    if(model==="FIXED_RELATION"||model==="FULL_LOAD")return "Shipment";
    return isFirst?"Minimum":"Shipment";
  }
  function rateZoneKey(r){return text(r.zone)||text(r.relationName)||`${text(r.destCountry)||"#ALL"}|ROW${r.sourceRow||0}`;}
  function buildBenchmarkData(rateRows,zoneRows){
    const MAX_ZONES=150;
    const blocks=[];const blockMap=new Map();
    rateRows.forEach((r,idx)=>{const key=`${r.batchId||""}|${r.blockId||r.sheet||"block"}`;if(!blockMap.has(key)){const b={key,rates:[],zones:[],order:idx};blockMap.set(key,b);blocks.push(b);}blockMap.get(key).rates.push(r);});
    zoneRows.forEach(z=>{const key=`${z.batchId||""}|${z.blockId||z.zoneSet||"block"}`;const b=blockMap.get(key);if(b)b.zones.push(z);});
    const rateOut=[];const zoneOut=[];
    blocks.sort((a,b)=>a.order-b.order).forEach((block,blockIndex)=>{
      const br=block.rates;if(!br.length)return;
      const zoneKeys=[];const zoneSamples=new Map();
      br.slice().sort((a,b)=>(a.sourceRow||0)-(b.sourceRow||0)).forEach(r=>{const k=rateZoneKey(r);if(!zoneSamples.has(k)){zoneKeys.push(k);zoneSamples.set(k,r);}});
      if(zoneKeys.length>MAX_ZONES)throw new Error(`Tarifblock ${br[0].sheet||blockIndex+1} enthält ${zoneKeys.length} Zonen. Der Benchmark unterstützt maximal ${MAX_ZONES}.`);
      const zoneNo=new Map(zoneKeys.map((k,i)=>[k,i+1]));
      const first=br[0];const provider=text(first.provider)||"#ALL";const product=benchmarkProduct(first);const subservice=text(first.subservice)||text(first.sheet)||"#ALL";
      const costItem="Freight";const cllType=first.rateModel==="FULL_LOAD"?"FTL":first.rateModel==="PACKAGE_WEIGHT_ZONE"?"Parcel":"Weight";
      const importMeta=(GPK.read(IMPORT_KEY,[])||[]).find(x=>x.id===first.batchId);
      const version=text(first.version)||text(importMeta?.validity)||"EXT";
      const originCountry=text(br.find(r=>text(r.originCountry))?.originCountry)||"#ALL";
      const modelGroups=new Map();
      br.forEach(r=>{const k=[r.rateModel,text(r.product),text(r.destCountry),r.chargeFrom??"",r.chargeTo??"",text(r.chargeLabel)].join("|");if(!modelGroups.has(k)){modelGroups.set(k,{model:r.rateModel,product:benchmarkProduct(r),destCountry:text(r.destCountry)||"#ALL",chargeFrom:r.chargeFrom,chargeTo:r.chargeTo,chargeLabel:r.chargeLabel,rates:[],sourceRow:r.sourceRow||0});}modelGroups.get(k).rates.push(r);});
      const groups=[...modelGroups.values()].sort((a,b)=>{if(a.model==="FULL_LOAD"&&b.model!=="FULL_LOAD")return 1;if(b.model==="FULL_LOAD"&&a.model!=="FULL_LOAD")return -1;const an=Number(a.chargeTo),bn=Number(b.chargeTo);if(Number.isFinite(an)&&Number.isFinite(bn)&&an!==bn)return an-bn;return a.sourceRow-b.sourceRow;});
      const previousByModel=new Map();
      groups.forEach(g=>{
        const direct=["PER_KG","PER_100KG","PER_LDM","PER_KM","PER_PALLET"].includes(g.model);
        const fixed=["FIXED_RELATION","FULL_LOAD"].includes(g.model);
        const step=benchmarkStep(g.model);let from,to;
        if(g.chargeFrom!==""&&g.chargeFrom!=null)from=Number(g.chargeFrom);
        if(g.chargeTo!==""&&g.chargeTo!=null&&Number.isFinite(Number(g.chargeTo)))to=Number(g.chargeTo);
        if(direct){from=Number.isFinite(from)?from:0;to=Number.isFinite(to)?to:999999;}
        else if(fixed){from=Number.isFinite(from)?from:0;to=Number.isFinite(to)?to:999999;}
        else if(Number.isFinite(to)){const prev=previousByModel.get(g.model);if(!Number.isFinite(from))from=prev==null?0:round(prev+step,3);previousByModel.set(g.model,to);}
        else {from=Number.isFinite(from)?from:0;to=999999;}
        const prices=Array(MAX_ZONES).fill(null);
        g.rates.forEach(r=>{const n=zoneNo.get(rateZoneKey(r));if(n)prices[n-1]=r.price;});
        let unit="KG";
        if(["LDM_STEP","PER_LDM"].includes(g.model))unit="LDM";
        else if(["PALLET_STEP","PER_PALLET"].includes(g.model))unit="PLL";
        else if(["DISTANCE_STEP","PER_KM"].includes(g.model))unit="KM";
        else if(["FIXED_RELATION","FULL_LOAD"].includes(g.model))unit="Shipment";
        // 1:1 zum bisherigen GPK-Benchmarkvordruck: 13 Stammdatenfelder, danach Zone 1..150.
        rateOut.push({__block:block.key,__model:g.model,base:[provider,g.product||product,subservice,costItem,cllType,version,originCountry,g.destCountry||"#ALL",from,to,step,unit,1],prices});
      });
      zoneKeys.forEach((zk,i)=>{
        const sample=zoneSamples.get(zk);const matching=block.zones.find(z=>text(z.zone)&&text(z.zone)===text(sample.zone))||block.zones.find(z=>text(z.sourceRef)&&text(sample.sourceRef)&&text(z.sourceRef).split("C")[0]===text(sample.sourceRef).split("C")[0]);
        const z=matching||{};
        zoneOut.push([provider,text(z.originCountry)||text(sample.originCountry)||"#ALL",text(z.originPostcodeFrom)||0,text(z.originPostcodeTo)||99999,text(z.destCountry)||text(sample.destCountry)||"#ALL",text(z.destPostcodeFrom)||0,text(z.destPostcodeTo)||99999,i+1]);
      });
    });
    return {rateOut,zoneOut,maxZones:150};
  }
  function ensureExcelJS(){
    if(window.ExcelJS)return Promise.resolve(window.ExcelJS);
    if(window.__gpkExcelJSPromise)return window.__gpkExcelJSPromise;
    window.__gpkExcelJSPromise=new Promise((resolve,reject)=>{const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js";s.onload=()=>resolve(window.ExcelJS);s.onerror=()=>reject(new Error("Excel-Exportbibliothek konnte nicht geladen werden."));document.head.appendChild(s);});
    return window.__gpkExcelJSPromise;
  }
  async function saveExcelJSWorkbook(wb,filename){const buf=await wb.xlsx.writeBuffer();const blob=new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},0);}
  function styleBenchmarkSheet(ws,headerCount,zoneStartCol){
    ws.views=[{state:"frozen",ySplit:1,xSplit:zoneStartCol-1}];
    ws.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,ws.rowCount),column:headerCount}};
    const header=ws.getRow(1);header.height=22;
    header.eachCell({includeEmpty:true},cell=>{cell.font={name:"Aptos",size:10,bold:true,color:{argb:"FFFFFFFF"}};cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF004251"}};cell.alignment={vertical:"middle",horizontal:"center"};cell.border={bottom:{style:"thin",color:{argb:"FFB8C9CD"}}};});
    ws.eachRow((row,rowNo)=>{if(rowNo===1)return;row.height=18;row.eachCell({includeEmpty:true},cell=>{cell.font={name:"Aptos",size:9,color:{argb:"FF1F2933"}};cell.alignment={vertical:"middle"};cell.border={bottom:{style:"hair",color:{argb:"FFE6ECEE"}}};if(typeof cell.value==="number")cell.numFmt="0.00########";});});
    for(let c=1;c<=headerCount;c++){const col=ws.getColumn(c);if(c===1)col.width=18;else if(c<=6)col.width=17;else if(c<=13)col.width=12;else col.width=11;}
  }
  async function exportRates(batchId=""){
    const allRates=GPK.read(RATE_KEY,[])||[],allZones=GPK.read(ZONE_KEY,[])||[];
    const rows=batchId?allRates.filter(r=>r.batchId===batchId):allRates;const zones=batchId?allZones.filter(z=>z.batchId===batchId):allZones;
    if(!rows.length)throw new Error("Noch keine normalisierten Tarifpreise vorhanden.");
    const data=buildBenchmarkData(rows,zones);const ExcelJS=await ensureExcelJS();const wb=new ExcelJS.Workbook();wb.creator="GP Kollund";wb.subject="Benchmark-Tarif";wb.created=new Date();
    const rateHeaders=["Forwarder","Product","Sub-Service","Cost Item","CLL Type","Version","Origin CTRY","Dest CTRY","CHG from","CHG to","step","Unit","base",...Array.from({length:150},(_,i)=>`Zone ${i+1}`)];
    const rws=wb.addWorksheet("Rates",{properties:{defaultRowHeight:18}});rws.addRow(rateHeaders);data.rateOut.forEach(r=>rws.addRow([...r.base,...r.prices]));styleBenchmarkSheet(rws,rateHeaders.length,14);
    rws.getColumn(9).numFmt="0.00########";rws.getColumn(10).numFmt="0.00########";rws.getColumn(11).numFmt="0.00########";rws.getColumn(13).numFmt="0.00########";
    const zoneHeaders=["Forwarder","Origin CTRY","Origin From","Origin To","Dest CTRY","Dest From","Dest To","Zone"];
    const zws=wb.addWorksheet("Zones",{properties:{defaultRowHeight:18}});zws.addRow(zoneHeaders);data.zoneOut.forEach(r=>zws.addRow(r));styleBenchmarkSheet(zws,zoneHeaders.length,8);zws.views=[{state:"frozen",ySplit:1}];
    [3,4,6,7].forEach(c=>zws.getColumn(c).numFmt="00000");
    const imp=(GPK.read(IMPORT_KEY,[])||[]).find(x=>x.id===batchId);const stem=imp?`BM_${safeFilePart(imp.provider)}_${safeFilePart(imp.fileName.replace(/\.[^.]+$/,""))}`:"GPK_Benchmark_Import";
    await saveExcelJSWorkbook(wb,stem+".xlsx");
  }
  function csvValue(v){const s=String(v??"");return /[;"\r\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}
  function downloadCsv(filename,rows){const csv="\ufeff"+rows.map(r=>r.map(csvValue).join(";")).join("\r\n");const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},0);}
  async function exportZones(batchId=""){
    const allRates=GPK.read(RATE_KEY,[])||[],allZones=GPK.read(ZONE_KEY,[])||[];const rows=batchId?allRates.filter(r=>r.batchId===batchId):allRates;const zones=batchId?allZones.filter(z=>z.batchId===batchId):allZones;
    if(!rows.length)throw new Error("Noch keine Zonenregeln vorhanden.");const data=buildBenchmarkData(rows,zones);
    const csvRows=[["Forwarder","Origin CTRY","Dest CTRY","Dest From","Dest To","Zone"],...data.zoneOut.map(r=>[r[0],r[1],r[4],r[5],r[6],r[7]])];
    const imp=(GPK.read(IMPORT_KEY,[])||[]).find(x=>x.id===batchId);const stem=imp?`Zones_${safeFilePart(imp.provider)}_${safeFilePart(imp.fileName.replace(/\.[^.]+$/,""))}`:"GPK_Zonen_Export";downloadCsv(stem+".csv",csvRows);
  }

  function normalizeHeader(v){return lower(v).replace(/[^a-z0-9]+/g," ").trim();}
  function benchmarkSheetRows(wb,name){
    const XLSX=window.XLSX;
    const sheetName=wb.SheetNames.find(n=>normalizeHeader(n)===normalizeHeader(name))||wb.SheetNames.find(n=>normalizeHeader(n).includes(normalizeHeader(name)));
    if(!sheetName)return {name:"",rows:[]};
    return {name:sheetName,rows:XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{header:1,defval:"",raw:true,blankrows:false})};
  }
  function findBenchmarkHeader(rows,type){
    const wanted=type==="rates"?["forwarder","product","dest ctry","chg from","chg to","unit"]:["forwarder","dest ctry","dest from","dest to","zone"];
    let best={idx:-1,score:0,map:{}};
    rows.slice(0,30).forEach((row,idx)=>{
      const map={};row.forEach((v,c)=>{const h=normalizeHeader(v);if(h)map[h]=c;});
      const keys=Object.keys(map);let score=0;wanted.forEach(w=>{if(keys.some(k=>k===w||k.replace(/ /g,"")===w.replace(/ /g,"")))score++;});
      if(type==="rates"&&keys.some(k=>/^zone\s*1$/.test(k)))score+=2;
      if(score>best.score)best={idx,score,map};
    });
    return best.score>=3?best:null;
  }
  function headerIndex(map,...aliases){
    const entries=Object.entries(map||{});
    for(const a of aliases){const n=normalizeHeader(a);const hit=entries.find(([k])=>k===n||k.replace(/ /g,"")===n.replace(/ /g,""));if(hit)return hit[1];}
    return -1;
  }
  function compareVal(v){const n=num(v);if(n!==null&&String(v).trim()!=="")return round(n,6);return lower(v);}
  function sameVal(a,b,tol=0.01){
    const an=num(a),bn=num(b);
    if(an!==null&&bn!==null)return Math.abs(an-bn)<=tol;
    return lower(a)===lower(b);
  }
  function generatedRateMatrix(data){
    return data.rateOut.map((r,idx)=>({idx:idx+1,base:r.base,prices:r.prices}));
  }
  function parseExistingRates(rows){
    const h=findBenchmarkHeader(rows,"rates");if(!h)return {header:null,records:[]};
    const m=h.map;
    const idx={
      forwarder:headerIndex(m,"Forwarder"),product:headerIndex(m,"Product"),subservice:headerIndex(m,"Sub-Service","Subservice"),
      costItem:headerIndex(m,"Cost Item"),cll:headerIndex(m,"CLL Type"),version:headerIndex(m,"Version"),origin:headerIndex(m,"Origin CTRY","Origin Country"),dest:headerIndex(m,"Dest CTRY","Destination CTRY"),
      from:headerIndex(m,"CHG from","CHG From"),to:headerIndex(m,"CHG to","CHG To"),step:headerIndex(m,"step"),unit:headerIndex(m,"Unit"),base:headerIndex(m,"base")
    };
    const zoneCols=[];(rows[h.idx]||[]).forEach((v,c)=>{const mt=normalizeHeader(v).match(/^zone\s*(\d+)$/);if(mt)zoneCols.push({no:Number(mt[1]),col:c});});
    const records=[];
    for(let r=h.idx+1;r<rows.length;r++){
      const row=rows[r]||[];if(nonEmpty(row).length===0)continue;
      const base=[idx.forwarder,idx.product,idx.subservice,idx.costItem,idx.cll,idx.version,idx.origin,idx.dest,idx.from,idx.to,idx.step,idx.unit,idx.base].map(c=>c>=0?row[c]:"");
      const prices=Array(150).fill(null);zoneCols.forEach(z=>{if(z.no>=1&&z.no<=150){const v=row[z.col];prices[z.no-1]=text(v)===""?null:v;}});
      records.push({rowNo:r+1,base,prices});
    }
    return {header:h,records};
  }
  function rateCompareKey(base){
    // Version and forwarder are intentionally omitted: old benchmark templates often use a different version label/provider spelling.
    return [base[1],base[2],base[3],base[4],base[6],base[7],compareVal(base[8]),compareVal(base[9]),base[11]].map(v=>lower(v)).join("|");
  }
  function relaxedRateKey(base){return [base[1],base[4],base[7],compareVal(base[8]),compareVal(base[9]),base[11]].map(v=>lower(v)).join("|");}
  function compareRateSheets(generated,existing){
    const diffs=[];const exact=new Map(),relaxed=new Map();
    existing.forEach(r=>{const k=rateCompareKey(r.base);if(!exact.has(k))exact.set(k,[]);exact.get(k).push(r);const rk=relaxedRateKey(r.base);if(!relaxed.has(rk))relaxed.set(rk,[]);relaxed.get(rk).push(r);});
    const used=new Set();let matchedRows=0,matchedCells=0,diffCells=0,generatedPriceCells=0;
    generated.forEach(g=>{
      let candidates=exact.get(rateCompareKey(g.base))||[];if(!candidates.length)candidates=relaxed.get(relaxedRateKey(g.base))||[];
      const e=candidates.find(x=>!used.has(x))||candidates[0];
      if(!e){diffs.push({type:"Fehlende Rate",key:`${g.base[1]} · ${g.base[7]} · ${g.base[8]}–${g.base[9]} ${g.base[11]}`,field:"Zeile",generated:"vorhanden",existing:"fehlt"});return;}
      used.add(e);matchedRows++;
      for(let i=0;i<150;i++){
        const gv=g.prices[i],ev=e.prices[i];if(gv==null&&ev==null)continue;if(gv!=null)generatedPriceCells++;
        if(sameVal(gv,ev)){matchedCells++;continue;}diffCells++;
        if(diffs.length<250)diffs.push({type:"Preisabweichung",key:`${g.base[1]} · ${g.base[7]} · ${g.base[8]}–${g.base[9]}`,field:`Zone ${i+1}`,generated:gv??"—",existing:ev??"—"});
      }
    });
    const extra=existing.filter(r=>!used.has(r));extra.slice(0,100).forEach(e=>diffs.push({type:"Zusätzliche Rate",key:`${e.base[1]} · ${e.base[7]} · ${e.base[8]}–${e.base[9]} ${e.base[11]}`,field:"Zeile",generated:"fehlt",existing:`Zeile ${e.rowNo}`}));
    return {generatedRows:generated.length,existingRows:existing.length,matchedRows,missingRows:generated.length-matchedRows,extraRows:extra.length,generatedPriceCells,matchedCells,diffCells,diffs};
  }
  function parseExistingZones(rows){
    const h=findBenchmarkHeader(rows,"zones");if(!h)return {header:null,records:[]};const m=h.map;
    const idx={forwarder:headerIndex(m,"Forwarder"),origin:headerIndex(m,"Origin CTRY"),ofrom:headerIndex(m,"Origin From"),oto:headerIndex(m,"Origin To"),dest:headerIndex(m,"Dest CTRY"),dfrom:headerIndex(m,"Dest From"),dto:headerIndex(m,"Dest To"),zone:headerIndex(m,"Zone")};
    const records=[];for(let r=h.idx+1;r<rows.length;r++){const row=rows[r]||[];if(nonEmpty(row).length===0)continue;records.push({rowNo:r+1,vals:[idx.forwarder,idx.origin,idx.ofrom,idx.oto,idx.dest,idx.dfrom,idx.dto,idx.zone].map(c=>c>=0?row[c]:"")});}return {header:h,records};
  }
  function zoneKey(v){return [v[1],v[2],v[3],v[4],v[5],v[6],v[7]].map(compareVal).join("|");}
  function compareZoneSheets(generated,existing){
    const gm=new Map(),em=new Map();generated.forEach(v=>gm.set(zoneKey(v),v));existing.forEach(r=>em.set(zoneKey(r.vals),r));
    const diffs=[];let matched=0;gm.forEach((v,k)=>{if(em.has(k))matched++;else if(diffs.length<150)diffs.push({type:"Fehlende Zone",key:`${v[4]} ${v[5]}–${v[6]}`,field:"Zone",generated:v[7],existing:"fehlt"});});
    let extra=0;em.forEach((r,k)=>{if(!gm.has(k)){extra++;if(diffs.length<150)diffs.push({type:"Zusätzliche Zone",key:`${r.vals[4]} ${r.vals[5]}–${r.vals[6]}`,field:"Zone",generated:"fehlt",existing:r.vals[7]});}});
    return {generatedRows:generated.length,existingRows:existing.length,matched,missing:generated.length-matched,extra,diffs};
  }
  function installCompareModal(){
    if(document.getElementById("gpkBenchmarkCompare"))return;
    document.body.insertAdjacentHTML("beforeend",`<div class="modal-backdrop" id="gpkBenchmarkCompare" hidden><section class="location-modal benchmark-compare-modal" role="dialog" aria-modal="true"><div class="modal-head"><div><span class="modal-eyebrow">Benchmark-Prüfung</span><h2>Import mit bestehendem Benchmark vergleichen</h2><small id="gpkBenchmarkCompareFile"></small></div></div><div id="gpkBenchmarkCompareSummary" class="benchmark-compare-summary"></div><div class="benchmark-compare-note" id="gpkBenchmarkCompareNote"></div><div class="masterdata-table-wrap benchmark-compare-wrap"><table class="masterdata-table"><thead><tr><th>Typ</th><th>Rate / Zone</th><th>Feld</th><th>Neu erzeugt</th><th>Bestehender Benchmark</th></tr></thead><tbody id="gpkBenchmarkCompareRows"></tbody></table></div><div class="modal-actions"><button class="secondary compact-button" id="gpkBenchmarkCompareClose" type="button">Schließen</button><button class="primary compact-button" id="gpkBenchmarkPublish" type="button">Für Preisrechner freigeben</button></div></section></div>`);
    document.getElementById("gpkBenchmarkCompareClose").addEventListener("click",()=>{document.getElementById("gpkBenchmarkCompare").hidden=true;document.body.classList.remove("modal-open");});
  }
  function publishBatchToCalculator(batchId){
    const allRates=GPK.read(RATE_KEY,[])||[],allZones=GPK.read(ZONE_KEY,[])||[],imports=GPK.read(IMPORT_KEY,[])||[];
    const rows=allRates.filter(r=>r.batchId===batchId),zones=allZones.filter(z=>z.batchId===batchId);
    if(!rows.length)throw new Error("Für diesen Import sind keine normalisierten Raten vorhanden.");
    const data=buildBenchmarkData(rows,zones);
    const supportedModels=new Set(["WEIGHT_STEP","PER_KG","PER_100KG","LDM_STEP","PER_LDM","PALLET_STEP","PER_PALLET","FULL_LOAD","PACKAGE_WEIGHT_ZONE"]);
    const calculatorRows=data.rateOut.filter(r=>supportedModels.has(r.__model));
    const provider=text(rows[0]?.provider)||text(imports.find(x=>x.id===batchId)?.provider)||"";
    const published=GPK.read(PUBLISHED_KEY,[])||[];
    const entry={id:batchId,provider,publishedAt:new Date().toISOString(),zones:data.zoneOut,rates:calculatorRows.map(r=>({base:r.base,prices:r.prices,model:r.__model}))};
    const next=[entry,...published.filter(x=>x.id!==batchId)].slice(0,100);
    GPK.write(PUBLISHED_KEY,next);
    const imp=imports.find(x=>x.id===batchId);if(imp){imp.publishedAt=entry.publishedAt;imp.publishedZones=data.zoneOut.length;imp.publishedRates=calculatorRows.length;GPK.write(IMPORT_KEY,imports);}
    refreshPageStatus();
    return {zones:data.zoneOut.length,rates:calculatorRows.length,provider};
  }

  function renderCompareResult(batchId,file,result){
    installCompareModal();const modal=document.getElementById("gpkBenchmarkCompare");modal.hidden=false;document.body.classList.add("modal-open");
    document.getElementById("gpkBenchmarkCompareFile").textContent=file.name;
    const r=result.rates,z=result.zones;const denom=Math.max(1,r.generatedPriceCells);const pct=Math.max(0,Math.min(100,Math.round((r.matchedCells/denom)*1000)/10));
    document.getElementById("gpkBenchmarkCompareSummary").innerHTML=`<div><span>Raten erkannt</span><strong>${r.matchedRows}/${r.generatedRows}</strong></div><div><span>Preiszellen identisch</span><strong>${r.matchedCells.toLocaleString("de-DE")}</strong></div><div><span>Preisabweichungen</span><strong>${r.diffCells.toLocaleString("de-DE")}</strong></div><div><span>Zonen identisch</span><strong>${z.matched}/${z.generatedRows}</strong></div><div><span>Trefferquote Preise</span><strong>${pct.toLocaleString("de-DE")} %</strong></div>`;
    document.getElementById("gpkBenchmarkCompareNote").innerHTML=`<strong>${r.missingRows+r.extraRows+z.missing+z.extra+r.diffCells===0?"Benchmark stimmt strukturell und preislich überein.":"Abweichungen gefunden."}</strong><span>Verglichen werden Rate-Modell/Produkt, Relation, CHG-Grenzen, Einheit, Zone 1–150 sowie das Zones-Blatt. Versionsbezeichnung und Schreibweise des Dienstleisters werden bei der Zeilenzuordnung bewusst nicht als harte Schlüssel verwendet.</span>`;
    const diffs=[...r.diffs,...z.diffs];document.getElementById("gpkBenchmarkCompareRows").innerHTML=diffs.slice(0,200).map(d=>`<tr><td><span class="status-pill ${d.type.includes("Preis")||d.type.includes("Fehl")?"inactive":"active"}">${esc(d.type)}</span></td><td>${esc(d.key)}</td><td>${esc(d.field)}</td><td><strong>${esc(d.generated)}</strong></td><td><strong>${esc(d.existing)}</strong></td></tr>`).join("")||`<tr><td colspan="5" class="empty-state"><strong>Keine Abweichungen gefunden.</strong><small>Die erzeugten Daten entsprechen dem hochgeladenen Benchmark.</small></td></tr>`;
    const imports=GPK.read(IMPORT_KEY,[])||[];const x=imports.find(i=>i.id===batchId);if(x){x.lastComparison={fileName:file.name,createdAt:new Date().toISOString(),priceMatchPct:pct,rateMissing:r.missingRows,rateExtra:r.extraRows,priceDiffs:r.diffCells,zoneMissing:z.missing,zoneExtra:z.extra};GPK.write(IMPORT_KEY,imports);refreshPageStatus();}
    const publishBtn=document.getElementById("gpkBenchmarkPublish");
    if(publishBtn){
      const hasDiff=(r.missingRows+r.extraRows+z.missing+z.extra+r.diffCells)>0;
      publishBtn.textContent=hasDiff?"Trotz Abweichungen freigeben":"Für Preisrechner freigeben";
      publishBtn.onclick=()=>{try{const pub=publishBatchToCalculator(batchId);modal.hidden=true;document.body.classList.remove("modal-open");if(window.rateToast){rateToast.textContent=`${pub.provider}: ${pub.zones} Zonen${pub.rates?` und ${pub.rates} Preiszeilen`:""} für den Preisrechner freigegeben.`;rateToast.hidden=false;setTimeout(()=>rateToast.hidden=true,3800);}}catch(err){if(window.rateToast){rateToast.textContent=err.message;rateToast.hidden=false;setTimeout(()=>rateToast.hidden=true,3500);}}};
    }
  }
  async function compareWithBenchmark(batchId){
    const allRates=GPK.read(RATE_KEY,[])||[],allZones=GPK.read(ZONE_KEY,[])||[];const rows=allRates.filter(r=>r.batchId===batchId),zones=allZones.filter(z=>z.batchId===batchId);if(!rows.length)throw new Error("Für diesen Import sind keine normalisierten Raten vorhanden.");
    const file=await new Promise(resolve=>{const inp=document.createElement("input");inp.type="file";inp.accept=".xlsx,.xls,.xlsm,.xlsb,.csv";inp.onchange=()=>resolve(inp.files?.[0]||null);inp.click();});if(!file)return;
    const XLSX=await ensureXLSX();let wb;
    if(file.name.toLowerCase().endsWith(".csv")){const txt=await file.text();wb=XLSX.read(txt,{type:"string"});}else{const buf=await file.arrayBuffer();wb=XLSX.read(buf,{type:"array",cellDates:false,cellFormula:false});}
    const gr=buildBenchmarkData(rows,zones);const rateSheet=benchmarkSheetRows(wb,"Rates"),zoneSheet=benchmarkSheetRows(wb,"Zones");
    if(!rateSheet.rows.length)throw new Error("Im Benchmark wurde kein Blatt 'Rates' gefunden.");
    const er=parseExistingRates(rateSheet.rows);if(!er.header)throw new Error("Die Kopfzeile des Rates-Blatts konnte nicht erkannt werden.");
    const ez=zoneSheet.rows.length?parseExistingZones(zoneSheet.rows):{records:[]};
    const result={rates:compareRateSheets(generatedRateMatrix(gr),er.records),zones:compareZoneSheets(gr.zoneOut,ez.records||[])};renderCompareResult(batchId,file,result);
  }

  function refreshPageStatus(){
    const imports=GPK.read(IMPORT_KEY,[])||[],ratesOut=GPK.read(RATE_KEY,[])||[],zonesOut=GPK.read(ZONE_KEY,[])||[];
    const el=document.getElementById("autoTariffImportStats");if(el)el.innerHTML=`<strong>${imports.length}</strong> Importe · <strong>${ratesOut.length.toLocaleString('de-DE')}</strong> normalisierte Preise · <strong>${zonesOut.length.toLocaleString('de-DE')}</strong> Zonenregeln`;
    const tbody=document.getElementById("autoImportRows");if(tbody)tbody.innerHTML=imports.slice(0,8).map(x=>`<tr><td><strong>${esc(x.provider)}</strong><small>${esc(x.fileName)}</small></td><td>${x.blocks.map(b=>`<span class="transport-pill">${esc(b.model)}</span>`).join(' ')}</td><td><strong>${Number(x.ratesCount||0).toLocaleString('de-DE')}</strong></td><td><strong>${Number(x.zonesCount||0).toLocaleString('de-DE')}</strong></td><td><span class="status-pill ${x.publishedAt?'active':(x.reviewCount?'inactive':'active')}">${x.publishedAt?'Im Rechner':(x.reviewCount?x.reviewCount+' Review':'Erkannt')}</span>${x.publishedAt?`<small>${Number(x.publishedZones||0)} Zonen · ${Number(x.publishedRates||0)} Raten</small>`:""}</td><td>${x.lastComparison?`<strong>${Number(x.lastComparison.priceMatchPct||0).toLocaleString('de-DE')} %</strong><small>${esc(x.lastComparison.fileName||'geprüft')}</small>`:`<button class="secondary compact-button auto-compare-history-btn" data-auto-compare="${esc(x.id)}" type="button">Benchmark prüfen</button>`}</td><td><small>${new Date(x.createdAt).toLocaleString('de-DE')}</small></td></tr>`).join("")||`<tr><td colspan="7" class="empty-state">Noch kein Tarif automatisch importiert.</td></tr>`;
    syncImportedProviderFilter(imports);appendImportedRows();
  }

  window.GPKTariffImport={open,chooseAndOpen,analyzeFile,refreshPageStatus,appendImportedRows,exportRates,exportZones,compareWithBenchmark,publishBatchToCalculator,buildBenchmarkData,keys:{rates:RATE_KEY,zones:ZONE_KEY,imports:IMPORT_KEY},_test:{analyzeSheet,parseHorizontalMatrix,parseVerticalZoneMatrices,parseFixedRelations,dimensionValue,postcodeRange,expandPrefixExpression,buildBenchmarkData,parseExistingRates,compareRateSheets,parseExistingZones,compareZoneSheets}};
  document.addEventListener("DOMContentLoaded",()=>{
    installModal();refreshPageStatus();const historyRows=document.getElementById("autoImportRows");if(historyRows&&!historyRows.dataset.compareHandlers){historyRows.dataset.compareHandlers="1";historyRows.addEventListener("click",async e=>{const c=e.target.closest("[data-auto-compare]");if(!c)return;try{await compareWithBenchmark(c.dataset.autoCompare);}catch(err){if(window.rateToast){rateToast.textContent=err.message;rateToast.hidden=false;setTimeout(()=>rateToast.hidden=true,3500);}}});}
    ["rateSearch","rateProviderFilter","rateTransportFilter","rateStatusFilter"].forEach(id=>document.getElementById(id)?.addEventListener("input",()=>setTimeout(appendImportedRows,0)));
    const mainRows=document.getElementById("rateRows");if(mainRows&&!mainRows.dataset.autoImportHandlers){mainRows.dataset.autoImportHandlers="1";mainRows.addEventListener("click",async e=>{const c=e.target.closest("[data-auto-compare]");const b=e.target.closest("[data-auto-benchmark]");const z=e.target.closest("[data-auto-zones]");try{if(c)await compareWithBenchmark(c.dataset.autoCompare);if(b)await exportRates(b.dataset.autoBenchmark);if(z)await exportZones(z.dataset.autoZones);}catch(err){if(window.rateToast){rateToast.textContent=err.message;rateToast.hidden=false;setTimeout(()=>rateToast.hidden=true,3500);}}});}
    document.getElementById("exportNormalizedRatesBtn")?.addEventListener("click",async()=>{try{await exportRates();}catch(e){if(window.rateToast){rateToast.textContent=e.message;rateToast.hidden=false;setTimeout(()=>rateToast.hidden=true,2600);}}});
    document.getElementById("exportZoneRulesBtn")?.addEventListener("click",async()=>{try{await exportZones();}catch(e){if(window.rateToast){rateToast.textContent=e.message;rateToast.hidden=false;setTimeout(()=>rateToast.hidden=true,2600);}}});
  });
})();
