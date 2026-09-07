(function(){
  "use strict";

  const RATE_KEY = "gpk_demo_rate_output_v1";
  const ZONE_KEY = "gpk_demo_zone_rules_v1";
  const IMPORT_KEY = "gpk_demo_tariff_imports_v1";

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
    GPK.write(IMPORT_KEY,[batch,...oldImports].slice(0,100));GPK.logImport?.({module:"Tarif-Autoimport",fileName:state.file.name,count:newRates.length,status:"success"});close();refreshPageStatus();if(window.rateToast){rateToast.textContent=`${newRates.length.toLocaleString('de-DE')} Preise und ${newZones.length.toLocaleString('de-DE')} Zonenregeln importiert.`;rateToast.hidden=false;setTimeout(()=>rateToast.hidden=true,3200);}
  }

  function refreshPageStatus(){
    const imports=GPK.read(IMPORT_KEY,[])||[],rates=GPK.read(RATE_KEY,[])||[],zones=GPK.read(ZONE_KEY,[])||[];
    const el=document.getElementById("autoTariffImportStats");if(el)el.innerHTML=`<strong>${imports.length}</strong> Importe · <strong>${rates.length.toLocaleString('de-DE')}</strong> normalisierte Preise · <strong>${zones.length.toLocaleString('de-DE')}</strong> Zonenregeln`;
    const tbody=document.getElementById("autoImportRows");if(tbody)tbody.innerHTML=imports.slice(0,8).map(x=>`<tr><td><strong>${esc(x.provider)}</strong><small>${esc(x.fileName)}</small></td><td>${x.blocks.map(b=>`<span class="transport-pill">${esc(b.model)}</span>`).join(' ')}</td><td><strong>${Number(x.ratesCount||0).toLocaleString('de-DE')}</strong></td><td><strong>${Number(x.zonesCount||0).toLocaleString('de-DE')}</strong></td><td><span class="status-pill ${x.reviewCount?'inactive':'active'}">${x.reviewCount?x.reviewCount+' Review':'Erkannt'}</span></td><td><small>${new Date(x.createdAt).toLocaleString('de-DE')}</small></td></tr>`).join("")||`<tr><td colspan="6" class="empty-state">Noch kein Tarif automatisch importiert.</td></tr>`;
  }
  async function exportRates(){const rows=GPK.read(RATE_KEY,[])||[];if(!rows.length)throw new Error("Noch keine normalisierten Tarifpreise vorhanden.");await exportWorkbook("GP_Kollund_Rate_Output.xlsx",{"Rates":rows.map(r=>({"Dienstleister":r.provider,"Quelle":r.sourceFile,"Sheet":r.sheet,"Rate Model":r.rateModel,"Produkt":r.product,"Zielland":r.destCountry,"Zone":r.zone,"Relation":r.relationName,"CHG from":r.chargeFrom,"CHG to":r.chargeTo,"Stufe Original":r.chargeLabel,"Unit":r.unit,"Preis":r.price,"Währung":r.currency,"Priorität":r.priority,"Confidence":r.confidence,"Review":r.reviewStatus,"Source Ref":r.sourceRef}))});}
  async function exportZones(){const rows=GPK.read(ZONE_KEY,[])||[];if(!rows.length)throw new Error("Noch keine Zonenregeln vorhanden.");await exportWorkbook("GP_Kollund_Zone_Output.xlsx",{"Zones":rows.map(z=>({"Dienstleister":z.provider,"Quelle":z.sourceFile,"Zone Set":z.zoneSet,"Rule Type":z.ruleType,"Origin CTRY":z.originCountry,"Origin PLZ von":z.originPostcodeFrom,"Origin PLZ bis":z.originPostcodeTo,"Dest CTRY":z.destCountry,"Dest PLZ von":z.destPostcodeFrom,"Dest PLZ bis":z.destPostcodeTo,"Distance from KM":z.distanceFromKm,"Distance to KM":z.distanceToKm,"Origin Name":z.originName,"Destination Name":z.destinationName,"Zone":z.zone,"Priority":z.priority,"Source Ref":z.sourceRef}))});}

  window.GPKTariffImport={open,chooseAndOpen,analyzeFile,refreshPageStatus,exportRates,exportZones,keys:{rates:RATE_KEY,zones:ZONE_KEY,imports:IMPORT_KEY},_test:{analyzeSheet,parseHorizontalMatrix,parseVerticalZoneMatrices,parseFixedRelations,dimensionValue,postcodeRange,expandPrefixExpression}};
  document.addEventListener("DOMContentLoaded",()=>{installModal();refreshPageStatus();document.getElementById("exportNormalizedRatesBtn")?.addEventListener("click",async()=>{try{await exportRates();}catch(e){if(window.rateToast){rateToast.textContent=e.message;rateToast.hidden=false;setTimeout(()=>rateToast.hidden=true,2600);}}});document.getElementById("exportZoneRulesBtn")?.addEventListener("click",async()=>{try{await exportZones();}catch(e){if(window.rateToast){rateToast.textContent=e.message;rateToast.hidden=false;setTimeout(()=>rateToast.hidden=true,2600);}}});});
})();
