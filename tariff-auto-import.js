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
  const COUNTRY_NAME_PATTERNS=[
    ["DE",/\b(?:deutschland|germany)\b/i],["AT",/\b(?:oesterreich|österreich|austria)\b/i],
    ["CH",/\b(?:schweiz|switzerland|suisse)\b/i],["PL",/\b(?:polen|poland|polska)\b/i],
    ["CZ",/\b(?:tschechien|tschechische|czech|cesko|česko)\b/i],["SE",/\b(?:schweden|sweden|sverige)\b/i],
    ["NL",/\b(?:niederlande|netherlands|holland)\b/i],["BE",/\b(?:belgien|belgium)\b/i],
    ["FR",/\b(?:frankreich|france)\b/i],["IT",/\b(?:italien|italy|italia)\b/i],
    ["HU",/\b(?:ungarn|hungary)\b/i],["DK",/\b(?:daenemark|dänemark|denmark)\b/i],
    ["NO",/\b(?:norwegen|norway)\b/i],["FI",/\b(?:finnland|finland)\b/i],["SK",/\b(?:slowakei|slovakia)\b/i]
  ];
  function inferCountryFromDestination(v){const t=text(v);for(const [c,re] of COUNTRY_NAME_PATTERNS)if(re.test(t))return c;return inferCountryFromText(t);}
  function destinationPostcode(country,v){
    let t=text(v);if(!country||!t)return "";
    const len=POSTAL_LENGTH[country]||5;
    const candidates=[...t.matchAll(/\b[0-9Xx][0-9Xx\s-]{2,8}\b/g)].map(m=>m[0].replace(/[^0-9Xx]/g,"").toUpperCase());
    const exact=candidates.find(x=>x.replace(/X/g,"").length>=Math.min(3,len));if(!exact)return "";
    return exact.length>len?exact.slice(0,len):exact;
  }
  function providerMasterRecords(){
    const stored=GPK.read(GPK.KEYS.providers,[])||[];
    if(Array.isArray(stored)&&stored.length)return stored.filter(x=>x&&x.name);
    return ["LIT","Transimeksa","Bertschi","Duvenbeck","Dachser","Kuehne + Nagel","Raben","DSV"].map((name,i)=>({id:i+1,name,status:name==="Kuehne + Nagel"?"inactive":"active"}));
  }

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
    /* Schutz gegen eine typische Fehlklassifikation:
       Eine Datenzeile wie "DE-01 | 54,51 | 91,60 | ..." darf nicht als Header
       verwendet werden. Genau das führte dazu, dass DE-01 verschwand und 54,51
       fälschlich als erste Staffelgrenze erschien. */
    const headerAxisText=lower(rowText(header));
    const leftLabels=header.slice(0,firstCol);
    const leftCp=parseCountryPostcode(leftLabels,fallbackCountry);
    const explicitAxisSignal=(
      model==="PALLET_STEP" ? /\b(?:pll|palette|paletten|stellplatz|stellplaetze)\b/.test(headerAxisText) :
      model==="LDM_STEP" ? /\b(?:ldm|lademeter)\b/.test(headerAxisText) :
      model==="WEIGHT_STEP" || model==="PACKAGE_WEIGHT_ZONE" ? /\b(?:kg|gewicht|tonne|tonnen)\b/.test(headerAxisText) :
      model==="DISTANCE_STEP" ? /\b(?:km|entfernung|distanz)\b/.test(headerAxisText) :
      true
    );
    if(leftCp.code && !explicitAxisSignal) return null;
    if(!explicitAxisSignal && priceCols.every(c=>typeof header[c]==="number")) return null;
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
      let z=zoneFromRow(blockId,sheetName,labels,fallbackCountry,r+1);
      const rawLabel=text(labels.filter(Boolean).slice(-1)[0])||text(labels.join(" "));
      if(!z && rawLabel){
        const dc=inferCountryFromDestination(rawLabel)||fallbackCountry||"";const pc=destinationPostcode(dc,rawLabel);
        const rg=pc&&!/X/.test(pc)?postcodeRange(dc,pc):{from:"",to:""};
        const zoneName="DEST-"+(dataRows);
        z={id:makeId("zone"),blockId,zoneSet:sheetName,ruleType:"FIXED_DESTINATION",originCountry:"",originPostcodeFrom:"",originPostcodeTo:"",destCountry:dc,destPostcodeFrom:rg.from,destPostcodeTo:rg.to,distanceFromKm:"",distanceToKm:"",originName:"",destinationName:rawLabel,zone:zoneName,priority:900,sourceRef:sheetName+"!"+(r+1)};
      }
      const zone=z?.zone||rawLabel||("ROW-"+(r+1)); if(z) zones.push(z);
      const cp=parseCountryPostcode(labels,z?.destCountry||fallbackCountry);
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

  function parseClassicPalletZoneSheet(sheetName,rows){
    /* Spezieller, deterministischer Parser für Vordrucke:
       "PLZ / Zone | 1 PLL | 2 PLL | ...".
       Die generische Heuristik bleibt für andere Dateien aktiv, aber diese
       Matrix darf nicht mehr verloren gehen. */
    let headerIdx=-1, zoneCol=-1, dims=[];
    for(let i=0;i<Math.min(rows.length,50);i++){
      const row=rows[i]||[];
      zoneCol=row.findIndex(v=>/^\s*plz\s*\/\s*zone\s*$/i.test(text(v)));
      if(zoneCol<0) continue;
      dims=[];
      for(let c=zoneCol+1;c<row.length;c++){
        const m=text(row[c]).match(/^\s*(\d+(?:[.,]\d+)?)\s*PLL\s*$/i);
        if(m)dims.push({col:c,value:num(m[1]),label:text(row[c])});
      }
      if(dims.length>=2){headerIdx=i;break;}
    }
    if(headerIdx<0 || zoneCol<0 || dims.length<2)return null;

    const blockId=makeId("block"), rates=[], zones=[];
    let dataRows=0, empty=0;
    for(let r=headerIdx+1;r<rows.length;r++){
      const row=rows[r]||[];
      const zoneLabel=text(row[zoneCol]);
      const cp=parseCountryPostcode([zoneLabel],inferCountryFromSheet(sheetName)||"DE");
      const prices=dims.map(d=>num(row[d.col]));
      const priceCount=prices.filter(v=>v!==null).length;
      if(!cp.code || priceCount<Math.max(1,Math.floor(dims.length*0.5))){
        if(nonEmpty(row).length===0)empty++; else empty++;
        if(dataRows>0 && empty>=3)break;
        continue;
      }
      empty=0;dataRows++;
      const rg=postcodeRange(cp.country||"DE",cp.code);
      const zone=(cp.country||"DE")+"-"+cp.code;
      zones.push({
        id:makeId("zone"),blockId,zoneSet:sheetName,ruleType:"POSTCODE",
        originCountry:"",originPostcodeFrom:"",originPostcodeTo:"",
        destCountry:cp.country||"DE",destPostcodeFrom:rg.from,destPostcodeTo:rg.to,
        distanceFromKm:"",distanceToKm:"",originName:"",destinationName:"",
        zone,priority:100,sourceRef:sheetName+"!R"+(r+1)
      });
      for(const d of dims){
        const price=num(row[d.col]);if(price===null)continue;
        rates.push({
          id:makeId("rate"),blockId,sheet:sheetName,sourceRow:r+1,
          rateModel:"PALLET_STEP",product:"Stückgut",subservice:"",
          originCountry:"",destCountry:cp.country||"DE",zone,relationName:"",
          chargeFrom:d.value>1?round(d.value-0.99,2):0,chargeTo:d.value,
          chargeLabel:d.label,unit:"EUR/SHIPMENT",price:round(price),
          currency:"EUR",priority:100,sourceRef:sheetName+"!R"+(r+1)+"C"+(d.col+1)
        });
      }
    }
    if(dataRows<2 || rates.length<4)return null;
    const dz=dedupeZones(zones);
    return {
      id:blockId,sheet:sheetName,headerRow:headerIdx+1,model:"PALLET_STEP",
      modelLabel:"Paletten / Stellplätze",confidence:0.99,status:"AUTO_CANDIDATE",
      rates,zones:dz,summary:`${rates.length} Preise · ${dz.length} Zonen`,
      context:"Klassische Stückgutmatrix: PLZ / Zone × PLL"
    };
  }

  function parseExplicitClassicGrid(sheetName,rows){
    const blocks=[];
    for(let i=0;i<rows.length;i++){
      const row=rows[i]||[];const rt=lower(rowText(row));
      if(!/(plz\s*\/\s*zone|plz\s*\/\s*ldm|plz\s*\/\s*(?:kg|tonnen)|plz\s*\/\s*palette)/.test(rt))continue;
      const after=row.slice(0).map(v=>lower(v));
      let model=null;
      if(after.some(v=>/\b(?:pll|palette|paletten|stellplatz)\b/.test(v)))model="PALLET_STEP";
      else if(after.some(v=>/\b(?:ldm|lademeter)\b/.test(v)))model="LDM_STEP";
      else if(after.some(v=>/\b(?:kg|tonne|tonnen)\b/.test(v)))model="WEIGHT_STEP";
      if(!model)continue;
      const b=parseHorizontalMatrix(sheetName,rows,i,model);if(b)blocks.push(b);
    }
    return blocks;
  }

  function analyzeSheet(sheetName,rows){
    const blocks=[];
    const classicPallet=parseClassicPalletZoneSheet(sheetName,rows);
    if(classicPallet)blocks.push(classicPallet);
    for(const b of parseExplicitClassicGrid(sheetName,rows))if(!blocks.some(x=>overlap(x,b)))blocks.push(b);
    blocks.push(...parseFixedRelations(sheetName,rows).filter(b=>!blocks.some(x=>overlap(x,b))));
    blocks.push(...parseVerticalZoneMatrices(sheetName,rows).filter(b=>!blocks.some(x=>overlap(x,b))));
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

  function parseChargeRulesFromParamsSheet(sheet){
    const rows=sheet.rows||[];let header=-1,cols={};
    for(let i=0;i<Math.min(rows.length,30);i++){
      const norm=(rows[i]||[]).map(v=>lower(v));
      const f=norm.findIndex(v=>v==="forwarder"),fu=norm.findIndex(v=>v.includes("from unit")),cq=norm.findIndex(v=>v.includes("chg qty")),cu=norm.findIndex(v=>v.includes("chg unit"));
      if(f>=0&&fu>=0&&cq>=0&&cu>=0){header=i;cols={forwarder:f,product:norm.findIndex(v=>v==="product"),origin:norm.findIndex(v=>v.includes("origin ctry")),dest:norm.findIndex(v=>v.includes("dest ctry")),fromQty:norm.findIndex(v=>v.includes("from qty")),fromUnit:fu,chgQty:cq,chgUnit:cu};break;}
    }
    if(header<0)return [];
    const rules=[];let currentForwarder="";let lastLdmRule=null;
    for(let r=header+1;r<rows.length;r++){
      const row=rows[r]||[];const joined=rowText(row);if(!joined)continue;
      const fw=text(row[cols.forwarder]);if(fw)currentForwarder=fw;
      const note=lower(joined);const noteThr=note.match(/ab\s*(\d+(?:[.,]\d+)?)\s*(?:paletten|palette|pll)/);
      if(noteThr && !fw && lastLdmRule){lastLdmRule.thresholdPallets=num(noteThr[1]);lastLdmRule.condition="PALLET_THRESHOLD";lastLdmRule.notes=text(joined);continue;}
      const fromUnit=text(row[cols.fromUnit]);const factor=num(row[cols.chgQty]);if(!currentForwarder||!fromUnit||factor===null)continue;
      const u=lower(fromUnit);let type="",condition="ALWAYS",thresholdPallets=null;
      if(/cbm|m3|m³/.test(u))type="KG_PER_CBM";
      else if(/pll|palette/.test(u) && !/ldm/.test(u))type="MIN_KG_PER_PALLET";
      else if(/ldm|lademeter/.test(u)){
        type="KG_PER_LDM";
        const th=u.match(/ab\s*(\d+(?:[.,]\d+)?)\s*(?:pll|palette)/);if(th){thresholdPallets=num(th[1]);condition="PALLET_THRESHOLD";}
        if(/nicht\s*b|nicht\s*stapel/.test(u))condition="NON_STACKABLE";
      }
      if(!type)continue;
      const rule={id:makeId("param"),forwarder:currentForwarder,product:cols.product>=0?text(row[cols.product]):"",originCountry:cols.origin>=0?text(row[cols.origin]):"",destCountry:cols.dest>=0?text(row[cols.dest]):"",type,factor,factorUnit:text(row[cols.chgUnit])||"KG",fromQty:cols.fromQty>=0?num(row[cols.fromQty]):null,fromUnit,condition,thresholdPallets,sourceRef:sheet.name+"!R"+(r+1),notes:""};
      rules.push(rule);if(type==="KG_PER_LDM")lastLdmRule=rule;
    }
    return rules;
  }
  function parseChargeRulesFromFreeText(sheet){
    const rules=[];const rows=sheet.rows||[];for(let r=0;r<rows.length;r++){
      const joined=text(rowText(rows[r]));if(!joined)continue;const n=lower(joined);
      const pairs=[...joined.matchAll(/(\d+(?:[.,]\d+)?)\s*kg\s*(?:\/|je\s+|pro\s+)(cbm|m3|m³|ldm|lademeter|palette|paletten)/gi)];
      pairs.forEach(m=>{const unit=lower(m[2]);let type=/ldm|lademeter/.test(unit)?"KG_PER_LDM":/palette/.test(unit)?"MIN_KG_PER_PALLET":"KG_PER_CBM";rules.push({id:makeId("param"),forwarder:"",product:"",originCountry:"",destCountry:inferCountryFromSheet(sheet.name)||inferCountryFromText(joined),type,factor:num(m[1]),factorUnit:"KG",fromQty:1,fromUnit:m[2],condition:/nicht\s*stapel/.test(n)&&type==="KG_PER_LDM"?"NON_STACKABLE":"ALWAYS",thresholdPallets:null,sourceRef:sheet.name+"!R"+(r+1),notes:joined.slice(0,260)});});
      const th=n.match(/ab\s*(\d+(?:[.,]\d+)?)\s*(?:paletten|palette|pll).*?(?:ldm|lademeter).*?(\d+(?:[.,]\d+)?)\s*kg/i);
      if(th)rules.push({id:makeId("param"),forwarder:"",product:"",originCountry:"",destCountry:inferCountryFromSheet(sheet.name),type:"KG_PER_LDM",factor:num(th[2]),factorUnit:"KG",fromQty:1,fromUnit:"LDM",condition:"PALLET_THRESHOLD",thresholdPallets:num(th[1]),sourceRef:sheet.name+"!R"+(r+1),notes:joined.slice(0,260)});
    }
    return rules;
  }
  function dedupeChargeRules(rules){const seen=new Set();return (rules||[]).filter(r=>{const k=[lower(r.forwarder),lower(r.product),r.originCountry,r.destCountry,r.type,r.factor,r.condition,r.thresholdPallets].join("|");if(seen.has(k))return false;seen.add(k);return true;});}
  function detectChargeRules(sheets){
    let rules=[];for(const sheet of sheets){if(lower(sheet.name)==="params")rules.push(...parseChargeRulesFromParamsSheet(sheet));else rules.push(...parseChargeRulesFromFreeText(sheet));}
    return dedupeChargeRules(rules);
  }

  async function analyzeFile(file){
    const sheets=await readWorkbook(file);let blocks=[];
    for(const sheet of sheets){
      try{
        const found=analyzeSheet(sheet.name,sheet.rows);
        blocks.push(...found);
      }catch(err){console.warn("Tariferkennung",sheet.name,err);}
    }
    blocks=blocks.filter(b=>b.rates.length).sort((a,b)=>a.sheet.localeCompare(b.sheet)||a.headerRow-b.headerRow);
    const provider=detectProvider(file.name,sheets);
    return {fileName:file.name,sheetCount:sheets.length,provider,blocks,rates:blocks.flatMap(b=>b.rates),zones:dedupeZones(blocks.flatMap(b=>b.zones)),sheets:sheets.map(s=>s.name)};
  }

  function installModal(){
    if(document.getElementById("gpkTariffAutoImport"))return;
    document.body.insertAdjacentHTML("beforeend",`
      <div class="modal-backdrop" id="gpkTariffAutoImport" hidden>
        <section class="location-modal tariff-auto-import-modal" role="dialog" aria-modal="true">
          <div class="modal-head tariff-import-modal-head"><div><span class="modal-eyebrow">Tarif-Importer</span><h2>Tarif automatisch erkennen</h2><small id="gpkTariffAutoFile" class="import-file-name"></small></div><button class="modal-x-btn" id="gpkTariffAutoCloseX" type="button" aria-label="Tarifimport schließen">×</button></div>
          <div class="auto-import-topbar">
            <div class="field"><label>Dienstleister</label><div class="import-provider-select-row"><select id="gpkTariffAutoProvider" required></select><button class="secondary compact-button" id="gpkTariffRefreshProviders" type="button" title="Dienstleisterliste aktualisieren">↻</button></div><div id="gpkTariffProviderError" class="field-error" hidden>Bitte zuerst einen Dienstleister auswählen.</div><div class="import-provider-workflow"><small>Tarife können nur einem bestehenden Dienstleister zugeordnet werden.</small><button class="link-button" id="gpkTariffCreateProvider" type="button">+ Dienstleister anlegen</button></div><div class="import-version-field"><label for="gpkTariffImportVersion">Version</label><input id="gpkTariffImportVersion" type="text" placeholder="z. B. 2026-01 / EXT"></div></div>

          </div>
          <div class="auto-import-body">
            <div class="auto-import-blocks"><div class="import-section-head compact-import-head"><div><h3>Importauswahl</h3></div></div><div id="gpkTariffAutoSummary" class="auto-import-summary-compact"></div><div id="gpkTariffAutoBlocks" class="auto-import-block-list"></div><div class="compact-country-panel"><span class="auto-filter-label">Land</span><div id="gpkTariffCountryTabs" class="auto-filter-tabs compact-country-tabs"></div></div></div>
            <div class="auto-import-preview">
              <div class="import-section-head"><div><h3>Ratenblatt prüfen</h3><p id="gpkTariffAutoPreviewMeta"></p></div><div class="preview-toggle"><button class="secondary compact-button" id="gpkTariffEditToggle" type="button">Bearbeiten</button><button class="secondary compact-button" id="gpkTariffAddRateRow" type="button" hidden>+ Zeile am Ende</button><button class="secondary compact-button" id="gpkTariffAddArea" type="button" hidden>+ Bereich</button><button class="secondary compact-button" id="gpkTariffAddZone" type="button" hidden>+ Zone</button><button class="secondary compact-button" id="gpkTariffBenchmarkMetaToggle" type="button" hidden>Benchmark-Felder</button><button class="preview-toggle-btn active" data-auto-preview="rates" type="button">Ratenblatt</button><button class="preview-toggle-btn" data-auto-preview="zones" type="button">Zonenblatt</button></div></div>
              <div id="gpkTariffBlockTabs" hidden></div>
              <div class="benchmark-meta-editor" id="gpkTariffBenchmarkMeta" hidden>
                <div><label>Product<input data-benchmark-meta="product"></label></div><div><label>Sub-Service<input data-benchmark-meta="subservice"></label></div><div><label>Cost Item<input data-benchmark-meta="costItem"></label></div><div><label>CLL Type<input data-benchmark-meta="cllType"></label></div><div><label>Version<input data-benchmark-meta="version"></label></div><div><label>Origin CTRY<input data-benchmark-meta="originCountry"></label></div><div><label>Dest CTRY<input data-benchmark-meta="destCountry" placeholder="AUTO"></label></div><div><label>step<input data-benchmark-meta="step" inputmode="decimal"></label></div><div><label>Unit<input data-benchmark-meta="unit" placeholder="AUTO"></label></div><div><label>base<input data-benchmark-meta="base" inputmode="decimal"></label></div>
              </div>
              <div class="auto-preview-context" id="gpkTariffPreviewContext"></div>
              <div class="masterdata-table-wrap auto-preview-wrap"><table class="masterdata-table auto-preview-table tariff-matrix-table"><thead id="gpkTariffAutoPreviewHead"></thead><tbody id="gpkTariffAutoPreviewRows"></tbody></table></div>
            </div>
          </div>
          <div class="modal-actions"><span class="draft-save-status" id="gpkTariffDraftSaveStatus"></span><button class="secondary compact-button" id="gpkTariffSaveDraft" type="button">Auswahl speichern</button><button class="secondary compact-button" id="gpkTariffAutoCancel" type="button">Abbrechen</button><button class="primary compact-button" id="gpkTariffAutoConfirm" type="button">Auswahl importieren</button></div>
        </section>
      </div>`);
    document.getElementById("gpkTariffAutoCancel").addEventListener("click",()=>close(true));
    document.getElementById("gpkTariffAutoCloseX").addEventListener("click",()=>close(true));
    document.querySelectorAll("[data-auto-preview]").forEach(btn=>btn.addEventListener("click",()=>{state.preview=btn.dataset.autoPreview;document.querySelectorAll("[data-auto-preview]").forEach(x=>x.classList.toggle("active",x===btn));renderPreview();}));
    document.getElementById("gpkTariffEditToggle").addEventListener("click",()=>{state.editing=!state.editing;syncEditControls();renderPreview();});
    document.getElementById("gpkTariffAddRateRow").addEventListener("click",addManualRateRow);
    document.getElementById("gpkTariffAddArea").addEventListener("click",addManualArea);
    document.getElementById("gpkTariffAddZone").addEventListener("click",()=>addManualZoneAt(null));
    document.getElementById("gpkTariffBenchmarkMetaToggle").addEventListener("click",()=>{state.metaOpen=!state.metaOpen;syncEditControls();});
    document.getElementById("gpkTariffSaveDraft").addEventListener("click",saveDraftLongTerm);
    document.querySelectorAll("[data-benchmark-meta]").forEach(el=>el.addEventListener("change",()=>updateBenchmarkMeta(el.dataset.benchmarkMeta,el.value)));
    document.getElementById("gpkTariffRefreshProviders").addEventListener("click",()=>{const current=text(document.getElementById("gpkTariffAutoProvider").value);renderProviderList(current);updateConfirm();persistDraft();});
    document.getElementById("gpkTariffCreateProvider").addEventListener("click",()=>{persistDraft();window.open("dienstleister.html?new=1&return=tarife","_blank");});
    document.getElementById("gpkTariffAutoConfirm").addEventListener("click",confirmImport);
  }

  const DRAFT_KEY="gpk_tariff_import_draft_v1";
  const SAVED_DRAFT_KEY="gpk_tariff_import_saved_v1";
  const state={file:null,analysis:null,selected:new Set(),preview:"rates",country:"",blockId:"",editing:false,_matrix:null,editBatchId:"",metaOpen:false};
  function draftPayload(){
    return {fileName:state.file?.name||state.analysis?.fileName||"Tarif.xlsx",analysis:state.analysis,selected:[...state.selected],preview:state.preview,country:state.country,blockId:state.blockId,provider:text(document.getElementById("gpkTariffAutoProvider")?.value||""),editBatchId:state.editBatchId||"",version:text(document.getElementById("gpkTariffImportVersion")?.value||""),savedAt:new Date().toISOString()};
  }
  function persistDraft(){if(!state.analysis)return;try{sessionStorage.setItem(DRAFT_KEY,JSON.stringify(draftPayload()));}catch(_){}}
  function saveDraftLongTerm(){if(!state.analysis)return;const payload=draftPayload();try{localStorage.setItem(SAVED_DRAFT_KEY,JSON.stringify(payload));sessionStorage.setItem(DRAFT_KEY,JSON.stringify(payload));}catch(_){}const status=document.getElementById("gpkTariffDraftSaveStatus");if(status)status.textContent=`Gespeichert ${new Date().toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})}`;}
  function clearDraft(clearSaved=false){try{sessionStorage.removeItem(DRAFT_KEY);if(clearSaved)localStorage.removeItem(SAVED_DRAFT_KEY);}catch(_){}}
  function restoreDraft(){
    let d=null;try{d=JSON.parse(sessionStorage.getItem(DRAFT_KEY)||localStorage.getItem(SAVED_DRAFT_KEY)||"null");}catch(_){}
    if(!d?.analysis)return false;
    installModal();state.file={name:d.fileName||d.analysis.fileName||"Tarif.xlsx"};state.analysis=d.analysis;state.selected=new Set(d.selected||[]);state.preview=d.preview||"rates";state.country=d.country||"";state.blockId=d.blockId||"";state.editing=false;state._matrix=null;state.editBatchId=d.editBatchId||"";state.metaOpen=false;
    document.getElementById("gpkTariffAutoFile").textContent=state.file.name;document.getElementById("gpkTariffAutoImport").hidden=false;document.body.classList.add("modal-open");renderProviderList(d.provider||state.analysis.provider||"");renderSummary();renderBlocks();ensurePreviewSelection();renderPreview();syncEditControls();updateConfirm();return true;
  }
  function allProviderNames(){
    const p=(GPK.read(GPK.KEYS.providers,[])||[]).map(x=>x.name).filter(Boolean);
    return [...new Set(["DHL Freight","DB Schenker","Dachser","Raben","DSV","DPD","GLS","Hellmann","Noerpel","Tombers","Böckmann","Berghegger","Marathon Logistics","Emons",...p])].sort();
  }
  function renderProviderList(preselect=""){const sel=document.getElementById("gpkTariffAutoProvider");if(!sel)return;const records=providerMasterRecords();const detected=preselect||state.analysis?.provider||"";sel.innerHTML=`<option value="">Dienstleister auswählen …</option>`+records.sort((a,b)=>text(a.name).localeCompare(text(b.name))).map(p=>`<option value="${esc(p.name)}" data-provider-id="${esc(p.id||'')}">${esc(p.name)}${p.status==='inactive'?' · inaktiv':''}</option>`).join("");if(records.some(p=>text(p.name).toLowerCase()===text(detected).toLowerCase()))sel.value=records.find(p=>text(p.name).toLowerCase()===text(detected).toLowerCase()).name;}
  function renderSummary(){
    const a=state.analysis;if(!a)return;
    const auto=a.blocks.filter(b=>b.status==="AUTO_CANDIDATE").length,review=a.blocks.length-auto;
    const countries=[...new Set(a.blocks.flatMap(blockCountries).filter(Boolean))].sort();
    const el=document.getElementById("gpkTariffAutoSummary");if(!el)return;
    el.innerHTML=`<strong>${a.blocks.length} Bereiche</strong><span>${a.rates.length.toLocaleString("de-DE")} Preise</span><span>${a.zones.length.toLocaleString("de-DE")} Zonen</span><span>${countries.length} Länder</span>${review?`<span class="review-text">${review} Review</span>`:""}`;
  }
  function renderBlocks(){
    const wrap=document.getElementById("gpkTariffAutoBlocks");
    if(!state.analysis.blocks.length){wrap.innerHTML=`<div class="empty-state auto-import-empty"><strong>Kein Tarifbereich erkannt.</strong></div>`;return;}
    wrap.innerHTML=state.analysis.blocks.map(b=>`<label class="auto-block-card compact-block-card ${b.id===state.blockId?"active-area":""} ${b.status==="REVIEW"?"review":""}" data-area-card="${esc(b.id)}"><input type="checkbox" data-auto-block="${esc(b.id)}" ${state.selected.has(b.id)?"checked":""}><span class="auto-block-main"><span class="auto-block-title"><strong>${esc(blockAreaLabel(b))}</strong><span class="confidence-pill ${b.status==="REVIEW"?"review":"auto"}">${Math.round(b.confidence*100)}%</span></span></span></label>`).join("");
    wrap.querySelectorAll("[data-auto-block]").forEach(cb=>cb.addEventListener("change",e=>{e.stopPropagation();if(cb.checked)state.selected.add(cb.dataset.autoBlock);else state.selected.delete(cb.dataset.autoBlock);ensurePreviewSelection();renderBlocks();renderPreview();updateConfirm();persistDraft();}));
    wrap.querySelectorAll("[data-area-card]").forEach(card=>card.addEventListener("click",e=>{if(e.target?.matches("input"))return;const id=card.dataset.areaCard;if(!state.selected.has(id))state.selected.add(id);state.blockId=id;const b=state.analysis.blocks.find(x=>x.id===id);const cs=blockCountries(b);if(!cs.includes(state.country))state.country=cs[0]||state.country;renderBlocks();renderPreviewFilters();renderPreview();updateConfirm();persistDraft();}));
  }
  function selectedBlocks(){return state.analysis?state.analysis.blocks.filter(b=>state.selected.has(b.id)):[];}
  function blockCountries(block){
    const vals=[...(block?.rates||[]).map(r=>text(r.destCountry)),...(block?.zones||[]).map(z=>text(z.destCountry))].filter(Boolean).map(x=>x.toUpperCase());
    return [...new Set(vals.length?vals:["ALL"])];
  }
  function countryBlocks(country){
    const bs=selectedBlocks();
    return bs.filter(b=>country==="ALL"?blockCountries(b).includes("ALL"):blockCountries(b).includes(country)||blockCountries(b).includes("ALL"));
  }
  function blockAreaLabel(block){
    const sn=lower(block?.sheet||"");
    if(/stueckgut|stückgut/.test(sn))return "Stückgut";
    if(/export/.test(sn))return "Export";
    if(/ltl.*ftl|ftl.*ltl/.test(sn))return "LTL / FTL";
    const products=[...new Set((block.rates||[]).map(r=>text(r.product)).filter(Boolean))];
    const main=products[0]||block.modelLabel||block.model||"Tarifbereich";
    return products.length>1?`${main} +${products.length-1}`:main;
  }
  function ensurePreviewSelection(){
    const bs=selectedBlocks();
    const countries=[...new Set(bs.flatMap(blockCountries).filter(Boolean))].sort((a,b)=>a==="ALL"?1:b==="ALL"?-1:a.localeCompare(b));
    if(!countries.includes(state.country))state.country=countries[0]||"";
    const cbs=countryBlocks(state.country);
    if(!cbs.some(b=>b.id===state.blockId))state.blockId=cbs[0]?.id||"";
    renderPreviewFilters();
  }
  function renderPreviewFilters(){
    const cWrap=document.getElementById("gpkTariffCountryTabs"),bWrap=document.getElementById("gpkTariffBlockTabs");if(!cWrap)return;
    const bs=selectedBlocks();const countries=[...new Set(bs.flatMap(blockCountries).filter(Boolean))].sort((a,b)=>a==="ALL"?1:b==="ALL"?-1:a.localeCompare(b));
    cWrap.innerHTML=countries.map(c=>`<button type="button" class="auto-filter-tab ${c===state.country?"active":""}" data-auto-country="${esc(c)}">${esc(c==="ALL"?"Allgemein":c)}</button>`).join("")||`<span class="auto-filter-empty">—</span>`;
    cWrap.querySelectorAll("[data-auto-country]").forEach(btn=>btn.addEventListener("click",()=>{state.country=btn.dataset.autoCountry;const cbs=countryBlocks(state.country);if(!cbs.some(b=>b.id===state.blockId))state.blockId=cbs[0]?.id||"";renderBlocks();renderPreviewFilters();renderPreview();syncEditControls();persistDraft();}));
    if(bWrap)bWrap.innerHTML="";
  }
  function activeBlock(){return selectedBlocks().find(b=>b.id===state.blockId)||countryBlocks(state.country)[0]||null;}
  function commonPrefix(a,b){a=text(a);b=text(b);let i=0;while(i<a.length&&i<b.length&&a[i]===b[i])i++;return a.slice(0,i);}
  function compactZoneRegion(z,country){
    const c=text(z?.destCountry||country).toUpperCase();const f=text(z?.destPostcodeFrom),t=text(z?.destPostcodeTo);
    if(c&&f){let p=t?commonPrefix(f,t):f;p=p.replace(/0+$/,'')||f.replace(/0+$/,'');if(!p&&f)p=f.slice(0,2);return c+p;}
    if(c&&z?.destinationName)return `${c} ${text(z.destinationName).slice(0,14)}`;
    const raw=text(z?.zone).replace(/^Z/i,'').replace(/[^A-Za-z0-9]+/g,'');
    if(raw)return (c&& !raw.toUpperCase().startsWith(c)?c:'')+raw;
    return c||"Relation";
  }
  function zoneSort(a,b){
    const za=a.rules?.[0]||{},zb=b.rules?.[0]||{};const ma=Number(za.manualOrder),mb=Number(zb.manualOrder);
    if(Number.isFinite(ma)&&Number.isFinite(mb)&&ma!==mb)return ma-mb;if(Number.isFinite(ma)!==Number.isFinite(mb))return Number.isFinite(ma)?-1:1;
    const pa=text(za.destPostcodeFrom),pb=text(zb.destPostcodeFrom);if(pa&&pb&&pa!==pb)return pa.localeCompare(pb,undefined,{numeric:true});return a.order-b.order;
  }
  function buildZoneColumns(block,country,rates,zones){
    const map=new Map();let order=0;
    const add=(key,rule)=>{key=text(key)||`NOZONE-${order}`;if(!map.has(key))map.set(key,{key,rules:[],order:order++});if(rule)map.get(key).rules.push(rule);};
    zones.forEach(z=>add(z.zone||z.destinationName||z.sourceRef,z));rates.forEach(r=>add(r.zone||r.relationName||r.sourceRef,null));
    const cols=[...map.values()].sort(zoneSort);
    cols.forEach((col,i)=>{
      const manualRegion=(col.rules||[]).map(z=>text(z.manualRegionCode)).find(Boolean);
      const manualNo=(col.rules||[]).map(z=>Number(z.manualZoneNumber)).find(n=>Number.isInteger(n)&&n>=1&&n<=999);
      const legacyLabel=(col.rules||[]).map(z=>text(z.manualZoneLabel)).find(Boolean);const legacyNo=legacyLabel?Number((legacyLabel.match(/\d+/)||[])[0]):null;
      const labels=[...new Set(col.rules.map(z=>compactZoneRegion(z,country)).filter(Boolean))];
      col.region=manualRegion||(labels.length<=2?labels.join(" / "):`${labels[0]} +${labels.length-1}`);
      if(!col.region)col.region=compactZoneRegion({zone:col.key},country);
      col.zoneNumber=(Number.isInteger(manualNo)?manualNo:(Number.isInteger(legacyNo)?legacyNo:i+1));
      col.displayZone=`Zone ${col.zoneNumber}`;
    });
    return cols;
  }
  function dimensionNumber(r){const n=Number(String(r.chargeTo??r.chargeLabel??'').replace(',','.').replace(/[^0-9.-]/g,''));return Number.isFinite(n)?n:null;}
  function matrixRows(block,rates,zoneCols){
    const groups=new Map();
    rates.forEach(r=>{const k=[r.rateModel,text(r.product),text(r.subservice),text(r.chargeFrom),text(r.chargeTo),text(r.chargeLabel),text(r.unit)].join('|');if(!groups.has(k))groups.set(k,{model:r.rateModel,product:text(r.product),subservice:text(r.subservice),from:text(r.chargeFrom),to:text(r.chargeTo),label:text(r.chargeLabel),unit:text(r.unit),prices:new Map(),sample:r,members:[]});const g=groups.get(k);g.prices.set(text(r.zone||r.relationName||r.sourceRef),r.price);g.members.push(r);});
    const arr=[...groups.values()];
    arr.sort((a,b)=>{const af=a.model==="FULL_LOAD"||/\b(?:ftl|kompl|komplettladung)\b/i.test(a.label),bf=b.model==="FULL_LOAD"||/\b(?:ftl|kompl|komplettladung)\b/i.test(b.label);if(af!==bf)return af?1:-1;const ao=Number(a.sample?.manualOrder),bo=Number(b.sample?.manualOrder);if(Number.isFinite(ao)&&Number.isFinite(bo)&&ao!==bo)return ao-bo;const na=dimensionNumber(a.sample),nb=dimensionNumber(b.sample);if(na!=null&&nb!=null&&na!==nb)return na-nb;return (a.label||a.to).localeCompare(b.label||b.to,undefined,{numeric:true});});
    const lastBySeries=new Map();
    arr.forEach(row=>{
      const isFull=row.model==="FULL_LOAD"||/\b(?:ftl|kompl|komplettladung)\b/i.test(row.label);
      if(isFull){
        row.from=text(row.from);row.to=text(row.to);
        row.members.forEach(r=>{if(r.chargeFrom==null)r.chargeFrom="";if(r.chargeTo==null)r.chargeTo="";});
        return;
      }
      const sk=[row.model,row.product,row.subservice,row.unit].join('|');const n=dimensionNumber(row.sample);
      if(n!=null && !row.from){const prev=lastBySeries.get(sk);const step=(row.model==="LDM_STEP"||row.model==="PER_LDM")?0.01:(row.model==="WEIGHT_STEP"||row.model==="PACKAGE_WEIGHT_ZONE")?0.01:0;row.from=prev==null?"0":String(round(prev+step,3));row.to=String(n);row.members.forEach(r=>{r.chargeFrom=row.from;r.chargeTo=row.to;});lastBySeries.set(sk,n);}else if(n!=null){lastBySeries.set(sk,n);row.members.forEach(r=>{if(!r.chargeFrom)r.chargeFrom=row.from;if(!r.chargeTo)r.chargeTo=row.to;});}
      if(!row.to&&row.label)row.to=row.label;
    });
    return arr;
  }

  function syncEditControls(){
    const toggle=document.getElementById("gpkTariffEditToggle"),add=document.getElementById("gpkTariffAddZone"),addRow=document.getElementById("gpkTariffAddRateRow"),addArea=document.getElementById("gpkTariffAddArea"),meta=document.getElementById("gpkTariffBenchmarkMeta"),metaToggle=document.getElementById("gpkTariffBenchmarkMetaToggle");
    if(toggle){toggle.textContent=state.editing?"Bearbeiten beenden":"Bearbeiten";toggle.classList.toggle("active",state.editing);}
    if(add)add.hidden=!state.editing;if(addRow)addRow.hidden=!state.editing;if(addArea)addArea.hidden=!state.editing;
    if(metaToggle){metaToggle.hidden=!state.editing;metaToggle.textContent=state.metaOpen?"Benchmark-Felder schließen":"Benchmark-Felder";metaToggle.classList.toggle("active",state.metaOpen);}
    if(meta)meta.hidden=!(state.editing&&state.metaOpen);renderBenchmarkMeta();
  }

  function defaultBenchmarkMeta(block){
    const first=(block?.rates||[])[0]||{};
    return {product:text(first.product)||benchmarkProduct(first)||"Road",subservice:text(first.subservice)||text(block?.sheet)||"#ALL",costItem:"Freight",cllType:first.rateModel==="FULL_LOAD"?"FTL":first.rateModel==="PACKAGE_WEIGHT_ZONE"?"Parcel":"Weight",version:"EXT",originCountry:text(first.originCountry)||"#ALL",destCountry:"AUTO",step:String(benchmarkStep(block?.model||first.rateModel||"LDM_STEP")),unit:"AUTO",base:"1"};
  }
  function metaCountryKey(country=state.country){const c=text(country).toUpperCase();return c&&c!=="ALL"?c:"ALL";}
  function benchmarkMetaFor(block,country=state.country){if(!block)return {};const key=metaCountryKey(country);block.benchmarkMetaByCountry=block.benchmarkMetaByCountry||{};if(!block.benchmarkMetaByCountry[key]){const base={...defaultBenchmarkMeta(block),...(block.benchmarkMeta||{})};if(key!=="ALL")base.destCountry=key;block.benchmarkMetaByCountry[key]=base;}return block.benchmarkMetaByCountry[key];}
  function renderBenchmarkMeta(){const wrap=document.getElementById("gpkTariffBenchmarkMeta"),block=activeBlock();if(!wrap||!block)return;const meta=benchmarkMetaFor(block,state.country);wrap.querySelectorAll("[data-benchmark-meta]").forEach(el=>{el.value=meta[el.dataset.benchmarkMeta]??"";});}
  function updateBenchmarkMeta(key,value){const block=activeBlock();if(!block)return;const c=metaCountryKey(state.country),meta=benchmarkMetaFor(block,c);meta[key]=text(value);block.rates.filter(r=>c==="ALL"?!text(r.destCountry):text(r.destCountry).toUpperCase()===c).forEach(r=>r.benchmarkMeta={...meta});persistDraft();}
  function addManualRateRow(){
    const block=activeBlock();if(!block)return;const country=state.country==="ALL"?"":state.country;const rates=(block.rates||[]).filter(r=>!country||!text(r.destCountry)||text(r.destCountry).toUpperCase()===country);const zones=dedupeZones((block.zones||[]).filter(z=>!country||!text(z.destCountry)||text(z.destCountry).toUpperCase()===country));const cols=buildZoneColumns(block,state.country,rates,zones);const rows=matrixRows(block,rates,cols);const last=rows.filter(r=>r.model!=="FULL_LOAD").slice(-1)[0];const model=last?.model||block.model||"LDM_STEP";const unit=model==="LDM_STEP"?"EUR/SHIPMENT":last?.unit||"EUR/SHIPMENT";const from=last?.to?String(round(Number(last.to)+0.01,2)):"0";const to=Number.isFinite(Number(from))?String(round(Number(from)+1,2)):"";const order=(rows.length?Math.max(...rows.map((r,i)=>Number(r.sample?.manualOrder)||i))+1:1);const meta={...benchmarkMetaFor(block,state.country)};
    if(!cols.length){window.alert("Bitte zuerst mindestens eine Zone anlegen.");return;}
    cols.forEach(col=>{const zr=col.rules?.[0]||{};block.rates.push({id:makeId("rate"),blockId:block.id,sheet:block.sheet,sourceRow:0,manualOrder:order,rateModel:model,product:last?.product||text(meta.product)||"Road",subservice:last?.subservice||text(meta.subservice),originCountry:text(meta.originCountry)==="#ALL"?"":text(meta.originCountry),destCountry:zr.destCountry||country,zone:col.key,relationName:"",chargeFrom:from,chargeTo:to,chargeLabel:"",unit,price:null,currency:"EUR",priority:100,sourceRef:"MANUAL",benchmarkMeta:meta});});persistDraft();renderPreview();
  }

  function insertManualRateAfter(row){
    const block=activeBlock(),m=state._matrix;if(!block||!row||!m)return;
    const rows=m.rows.slice(),idx=rows.indexOf(row);
    rows.forEach((r,i)=>setRowOrder(r,(i+1)*10));
    const cols=m.cols,meta={...benchmarkMetaFor(block,state.country)};
    const next=rows[idx+1],isFull=row.model==="FULL_LOAD";
    let from=text(row.to),to="";
    if(!isFull){
      const n=Number(String(from).replace(",","."));
      from=Number.isFinite(n)?String(round(n+0.01,2)):from;
      const nn=Number(String(next?.from||"").replace(",","."));
      to=Number.isFinite(nn)?String(round(nn-0.01,2)):"";
    }
    const order=(idx+1)*10+5;
    cols.forEach(col=>{
      const zr=col.rules?.[0]||{};
      block.rates.push({
        id:makeId("rate"),blockId:block.id,sheet:block.sheet,sourceRow:0,manualOrder:order,
        rateModel:isFull?"LDM_STEP":row.model,product:row.product||text(meta.product)||"Road",subservice:row.subservice||text(meta.subservice),
        originCountry:text(meta.originCountry)==="#ALL"?"":text(meta.originCountry),destCountry:zr.destCountry||(state.country==="ALL"?"":state.country),
        zone:col.key,relationName:"",chargeFrom:from,chargeTo:to,chargeLabel:"",unit:row.unit||"EUR/SHIPMENT",
        price:null,currency:"EUR",priority:100,sourceRef:"MANUAL",benchmarkMeta:meta
      });
    });
    persistDraft();renderSummary();renderPreview();
  }

  function addManualArea(){
    if(!state.analysis)return;const current=activeBlock();const name=window.prompt("Name des neuen Tarifbereichs:","Neuer Bereich");if(name===null||!text(name))return;const id=makeId("block");const zones=(current?.zones||[]).map(z=>({...z,id:makeId("zone"),blockId:id,sourceRef:"MANUAL"}));const block={id,sheet:text(name),headerRow:0,model:current?.model||"LDM_STEP",modelLabel:text(name),confidence:1,status:"AUTO_CANDIDATE",rates:[],zones,summary:"manuell angelegt",context:"Manueller Tarifbereich",benchmarkMetaByCountry:JSON.parse(JSON.stringify(current?.benchmarkMetaByCountry||{})),benchmarkMeta:{...benchmarkMetaFor(current||{},state.country),subservice:text(name)}};state.analysis.blocks.push(block);state.selected.add(id);state.blockId=id;state.country=blockCountries(block)[0]||state.country||"ALL";renderSummary();renderBlocks();renderPreview();persistDraft();
  }
  function setRowOrder(row,order){(row.members||[]).forEach(r=>r.manualOrder=order);}
  function moveMatrixRow(row,dir){const block=activeBlock(),m=state._matrix;if(!block||!m)return;const rows=m.rows.slice();const idx=rows.indexOf(row);const next=idx+dir;if(idx<0||next<0||next>=rows.length)return;if(rows[idx].model==="FULL_LOAD"&&dir<0)return;if(rows[next].model==="FULL_LOAD"&&dir>0)return;[rows[idx],rows[next]]=[rows[next],rows[idx]];rows.forEach((r,i)=>setRowOrder(r,i+1));persistDraft();renderPreview();}
  function deleteMatrixRow(row){const block=activeBlock();if(!block)return;const members=new Set(row.members||[]);block.rates=block.rates.filter(r=>!members.has(r));persistDraft();renderPreview();}

  function ensureZoneRule(block,col,country){
    if(col.rules?.length)return col.rules[0];
    const cp=parseCountryPostcode([col.region],country==="ALL"?"":country);
    const rg=postcodeRange(cp.country,cp.code);
    const z={id:makeId("zone"),blockId:block.id,zoneSet:block.sheet,ruleType:cp.code?"POSTCODE":"SERVICE_ZONE",originCountry:"",originPostcodeFrom:"",originPostcodeTo:"",destCountry:cp.country||((country==="ALL")?"":country),destPostcodeFrom:rg.from,destPostcodeTo:rg.to,distanceFromKm:"",distanceToKm:"",originName:"",destinationName:"",zone:col.key,priority:100,sourceRef:"MANUAL"};
    block.zones.push(z);col.rules=[z];return z;
  }
  function updateZoneCode(block,col,country,value){
    const rules=(col.rules?.length?col.rules:[ensureZoneRule(block,col,country)]);
    const code=text(value).toUpperCase().replace(/\s+/g,"");
    const cp=parseCountryPostcode([code],country==="ALL"?"":country);
    const rg=postcodeRange(cp.country,cp.code);
    rules.forEach(z=>{z.manualRegionCode=code; if(cp.country)z.destCountry=cp.country;if(cp.code){z.ruleType="POSTCODE";z.destPostcodeFrom=rg.from;z.destPostcodeTo=rg.to;}});
  }
  function updateZoneNumber(block,col,country,value){
    const n=Math.max(1,Math.min(999,Math.round(Number(value)||0)));if(!n)return;
    const rules=(col.rules?.length?col.rules:[ensureZoneRule(block,col,country)]);
    rules.forEach(z=>{z.manualZoneNumber=n;delete z.manualZoneLabel;});
  }
  function currentZoneColumns(block=activeBlock(),country=state.country){if(!block)return [];const rates=(block.rates||[]).filter(r=>country==="ALL"?!text(r.destCountry):!text(r.destCountry)||text(r.destCountry).toUpperCase()===country);const zones=dedupeZones((block.zones||[]).filter(z=>country==="ALL"?!text(z.destCountry):!text(z.destCountry)||text(z.destCountry).toUpperCase()===country));return buildZoneColumns(block,country,rates,zones);}
  function setZoneOrder(cols){cols.forEach((col,i)=>(col.rules||[]).forEach(z=>z.manualOrder=i+1));}
  function moveZoneColumn(col,dir){const block=activeBlock();if(!block)return;const cols=currentZoneColumns(block,state.country),idx=cols.indexOf(col),next=idx+dir;if(idx<0||next<0||next>=cols.length)return;[cols[idx],cols[next]]=[cols[next],cols[idx]];setZoneOrder(cols);persistDraft();renderPreview();}
  function deleteZoneColumn(col){const block=activeBlock();if(!block)return;if(!window.confirm(`Zone ${col.zoneNumber||""} wirklich löschen? Die Preise dieser Zone werden ebenfalls entfernt.`))return;const ruleSet=new Set(col.rules||[]);block.zones=(block.zones||[]).filter(z=>!ruleSet.has(z));block.rates=(block.rates||[]).filter(r=>text(r.zone||r.relationName||r.sourceRef)!==text(col.key));persistDraft();renderSummary();renderPreview();}
  function addManualZoneAt(afterIndex=null){const block=activeBlock();if(!block)return;const fallback=state.country==="ALL"?"":state.country;const raw=window.prompt("Kurzcode der neuen Zone, z. B. DE01 oder AT10:",fallback||"DE");if(raw===null)return;const code=text(raw).toUpperCase().replace(/\s+/g,"");if(!code)return;const cp=parseCountryPostcode([code],fallback),rg=postcodeRange(cp.country,cp.code),key="MANUAL-"+makeId("z"),cols=currentZoneColumns(block,state.country),insertAt=afterIndex==null?cols.length:Math.max(0,Math.min(cols.length,afterIndex+1));const z={id:makeId("zone"),blockId:block.id,zoneSet:block.sheet,ruleType:cp.code?"POSTCODE":"SERVICE_ZONE",originCountry:"",originPostcodeFrom:"",originPostcodeTo:"",destCountry:cp.country||fallback,destPostcodeFrom:rg.from,destPostcodeTo:rg.to,distanceFromKm:"",distanceToKm:"",originName:"",destinationName:"",zone:key,manualRegionCode:code,manualZoneNumber:insertAt+1,manualOrder:insertAt+1,priority:100,sourceRef:"MANUAL"};block.zones.push(z);const refreshed=currentZoneColumns(block,state.country),added=refreshed.find(c=>c.key===key),ordered=refreshed.filter(c=>c!==added);ordered.splice(insertAt,0,added);setZoneOrder(ordered);persistDraft();renderSummary();renderPreview();}

  function setMatrixPrice(block,row,col,value){
    const n=num(value),zoneKey=col.key;
    let rate=(row.members||[]).find(r=>text(r.zone||r.relationName||r.sourceRef)===zoneKey)||block.rates.find(r=>r.rateModel===row.model&&text(r.product)===row.product&&text(r.subservice)===row.subservice&&text(r.chargeLabel)===row.label&&text(r.unit)===row.unit&&text(r.zone||r.relationName||r.sourceRef)===zoneKey);
    if(n===null){if(rate)block.rates=block.rates.filter(x=>x!==rate);return;}
    if(rate){rate.price=round(n,4);return;}
    const sample=row.sample||block.rates[0];if(!sample)return;
    const zr=(col.rules||[])[0];
    block.rates.push({...sample,id:makeId("rate"),sourceRow:sample.sourceRow||0,rateModel:row.model,product:row.product,subservice:row.subservice,destCountry:zr?.destCountry||sample.destCountry,zone:zoneKey,relationName:"",chargeFrom:row.from,chargeTo:row.to,chargeLabel:row.label,unit:row.unit,price:round(n,4),sourceRef:"MANUAL"});
  }
  function updateMatrixStep(block,row,value){
    const label=text(value);if(!label)return;
    const d=dimensionValue(label,row.model);if(!d)return;
    block.rates.filter(r=>r.rateModel===row.model&&text(r.product)===row.product&&text(r.subservice)===row.subservice&&text(r.chargeFrom)===row.from&&text(r.chargeTo)===row.to&&text(r.chargeLabel)===row.label&&text(r.unit)===row.unit).forEach(r=>{r.chargeLabel=label;r.chargeTo=d.value??r.chargeTo;});
  }
  function updateMatrixBoundary(block,row,field,value){
    const v=text(value).replace(",", ".");
    const members=row.members||block.rates.filter(r=>r.rateModel===row.model&&text(r.product)===row.product&&text(r.subservice)===row.subservice&&text(r.chargeLabel)===row.label&&text(r.unit)===row.unit);
    members.forEach(r=>{if(field==="from")r.chargeFrom=v;else r.chargeTo=v;});
    row[field]=v;
  }
  function bindRateEditor(block,country){
    if(!state.editing)return;
    const m=state._matrix;if(!m)return;
    document.querySelectorAll("[data-matrix-zone-code]").forEach(el=>el.addEventListener("change",()=>{const col=m.cols[Number(el.dataset.matrixZoneCode)];updateZoneCode(block,col,country,el.value);persistDraft();renderPreview();}));
    document.querySelectorAll("[data-matrix-zone-number]").forEach(el=>el.addEventListener("change",()=>{const col=m.cols[Number(el.dataset.matrixZoneNumber)];updateZoneNumber(block,col,country,el.value);persistDraft();renderPreview();}));
    document.querySelectorAll("[data-matrix-step]").forEach(el=>el.addEventListener("change",()=>{const row=m.rows[Number(el.dataset.matrixStep)];updateMatrixStep(block,row,el.value);persistDraft();renderPreview();}));
    document.querySelectorAll("[data-matrix-boundary]").forEach(el=>el.addEventListener("change",()=>{const [ri,field]=el.dataset.matrixBoundary.split(":");updateMatrixBoundary(block,m.rows[Number(ri)],field,el.value);persistDraft();renderPreview();}));
    document.querySelectorAll("[data-matrix-price]").forEach(el=>el.addEventListener("change",()=>{const [ri,ci]=el.dataset.matrixPrice.split(":").map(Number);setMatrixPrice(block,m.rows[ri],m.cols[ci],el.value);persistDraft();renderPreview();}));
    document.querySelectorAll("[data-row-move]").forEach(el=>el.addEventListener("click",()=>{const [ri,dir]=el.dataset.rowMove.split(":").map(Number);moveMatrixRow(m.rows[ri],dir);}));
    document.querySelectorAll("[data-row-insert]").forEach(el=>el.addEventListener("click",()=>insertManualRateAfter(m.rows[Number(el.dataset.rowInsert)])));
    document.querySelectorAll("[data-row-delete]").forEach(el=>el.addEventListener("click",()=>deleteMatrixRow(m.rows[Number(el.dataset.rowDelete)])));
  }
  function bindZoneEditor(block,country,cols){
    if(!state.editing)return;
    document.querySelectorAll("[data-zone-edit]").forEach(el=>el.addEventListener("change",()=>{const [ci,field]=el.dataset.zoneEdit.split(":");const col=cols[Number(ci)],z=ensureZoneRule(block,col,country),v=text(el.value);if(field==="code")updateZoneCode(block,col,country,v);else if(field==="number")updateZoneNumber(block,col,country,v);else if(field==="country")z.destCountry=v.toUpperCase();else if(field==="from")z.destPostcodeFrom=v;else if(field==="to")z.destPostcodeTo=v;else if(field==="target")z.destinationName=v;persistDraft();renderPreview();}));
    document.querySelectorAll("[data-zone-move]").forEach(btn=>btn.addEventListener("click",()=>{const [ci,dir]=btn.dataset.zoneMove.split(":").map(Number);moveZoneColumn(cols[ci],dir);}));
    document.querySelectorAll("[data-zone-insert]").forEach(btn=>btn.addEventListener("click",()=>addManualZoneAt(Number(btn.dataset.zoneInsert))));
    document.querySelectorAll("[data-zone-delete]").forEach(btn=>btn.addEventListener("click",()=>deleteZoneColumn(cols[Number(btn.dataset.zoneDelete)])));
  }

  function renderRateMatrix(block,country){
    const rates=(block.rates||[]).filter(r=>country==="ALL"?!text(r.destCountry):!text(r.destCountry)||text(r.destCountry).toUpperCase()===country);
    const zones=dedupeZones((block.zones||[]).filter(z=>country==="ALL"?!text(z.destCountry):!text(z.destCountry)||text(z.destCountry).toUpperCase()===country));
    const cols=buildZoneColumns(block,country,rates,zones),rows=matrixRows(block,rates,cols);
    state._matrix={block,cols,rows};
    document.getElementById("gpkTariffAutoPreviewMeta").textContent=`${country==="ALL"?'Allgemein':country} · ${blockAreaLabel(block)} · ${rates.length.toLocaleString('de-DE')} Preiszellen · ${cols.length} Zonen`;
    document.getElementById("gpkTariffPreviewContext").innerHTML=`<span><strong>${esc(blockAreaLabel(block))}</strong>${esc(block.sheet)} · ab Zeile ${block.headerRow}${state.editing?' · Bearbeitungsmodus':''}</span><span class="confidence-pill ${block.status==='REVIEW'?'review':'auto'}">${Math.round(block.confidence*100)} % · ${block.status==='REVIEW'?'REVIEW':'AUTO'}</span>`;
    const head=document.getElementById("gpkTariffAutoPreviewHead"),body=document.getElementById("gpkTariffAutoPreviewRows");
    const palletOnly=block.model==="PALLET_STEP";
    const actionHead=state.editing?`<th class="matrix-row-actions-col">↕</th>`:"";
    const leftHead=actionHead+(palletOnly?`<th class="matrix-fixed-col matrix-step-col">Stufe</th>`:`<th class="matrix-fixed-col">von</th><th class="matrix-fixed-col">bis</th><th class="matrix-fixed-col">Einheit</th>`);
    head.innerHTML=`<tr>${leftHead}${cols.map((c,ci)=>`<th class="matrix-zone-head" title="${esc((c.rules||[]).map(z=>[z.destCountry,z.destPostcodeFrom,z.destPostcodeTo,z.destinationName].filter(Boolean).join(' ')).join(' · '))}">${state.editing?`<input class="matrix-head-input matrix-region-input" data-matrix-zone-code="${ci}" value="${esc(c.region)}" aria-label="Zonenkurzcode"><label class="matrix-zone-number-wrap">Zone <input type="number" min="1" max="999" class="matrix-head-input matrix-zone-number-input" data-matrix-zone-number="${ci}" value="${esc(c.zoneNumber)}" aria-label="Zonennummer"></label>`:`<span class="matrix-region">${esc(c.region)}</span><span class="matrix-zone">Zone ${esc(c.zoneNumber)}</span>`}</th>`).join('')}</tr>`;
    body.innerHTML=rows.map((row,ri)=>{
      const isFull=row.model==="FULL_LOAD"||/\b(?:ftl|kompl|komplettladung)\b/i.test(row.label);
      let left;
      if(palletOnly&&!isFull){const stepLabel=row.label||([row.to,"PLL"].filter(Boolean).join(" "));left=`<td class="matrix-step-cell">${state.editing?`<input class="matrix-cell-input matrix-step-input" data-matrix-step="${ri}" value="${esc(stepLabel)}">`:`<strong>${esc(stepLabel||'—')}</strong>`}</td>`;}
      else if(isFull){
        if(palletOnly)left=`<td class="matrix-step-cell"><strong>FTL</strong></td>`;
        else left=`<td>${state.editing?`<input class="matrix-cell-input matrix-range-input" data-matrix-boundary="${ri}:from" value="${esc(row.from||'')}" placeholder="von">`:esc(row.from||'—')}</td><td>${state.editing?`<input class="matrix-cell-input matrix-range-input" data-matrix-boundary="${ri}:to" value="${esc(row.to||'')}" placeholder="bis">`:esc(row.to||'—')}</td><td><strong>FTL</strong></td>`;
      }
      else{left=`<td>${state.editing?`<input class="matrix-cell-input matrix-range-input" data-matrix-boundary="${ri}:from" value="${esc(row.from||'')}">`:esc(row.from||'—')}</td><td>${state.editing?`<input class="matrix-cell-input matrix-range-input" data-matrix-boundary="${ri}:to" value="${esc(row.to||'')}">`:esc(row.to||'—')}</td><td><strong>${esc(row.model==="LDM_STEP"?'LDM':row.unit||row.model)}</strong>${row.product?`<small>${esc(row.product)}</small>`:''}</td>`;}
      const actions=state.editing?`<td class="matrix-row-actions"><button type="button" data-row-move="${ri}:-1" title="nach oben">↑</button><button type="button" data-row-move="${ri}:1" title="nach unten">↓</button><button type="button" data-row-insert="${ri}" title="Zeile darunter einfügen">+</button><button type="button" data-row-delete="${ri}" title="Zeile löschen">×</button></td>`:"";
      return `<tr>${actions}${left}${cols.map((c,ci)=>{const v=row.prices.get(c.key);return `<td class="matrix-price-cell">${state.editing?`<input class="matrix-cell-input matrix-price-input" data-matrix-price="${ri}:${ci}" value="${v==null?'':esc(String(v).replace('.',','))}" placeholder="—">`:(v==null?'—':new Intl.NumberFormat('de-DE',{minimumFractionDigits:2,maximumFractionDigits:4}).format(Number(v)))}</td>`;}).join('')}</tr>`;
    }).join('')||`<tr><td colspan="${(palletOnly?1:3)+cols.length+(state.editing?1:0)}" class="empty-state">Keine Preiszeilen für diese Auswahl.</td></tr>`;
    bindRateEditor(block,country);
  }
  function renderZoneSheet(block,country){
    const zones=dedupeZones((block.zones||[]).filter(z=>country==="ALL"?!text(z.destCountry):!text(z.destCountry)||text(z.destCountry).toUpperCase()===country));const cols=buildZoneColumns(block,country,[],zones),index=new Map(cols.map((c,i)=>[c.key,i+1]));
    document.getElementById("gpkTariffAutoPreviewMeta").textContent=`${country==="ALL"?"Allgemein":country} · ${blockAreaLabel(block)} · ${zones.length.toLocaleString("de-DE")} Zonenregeln`;document.getElementById("gpkTariffPreviewContext").innerHTML=`<span><strong>${esc(block.modelLabel||block.model)}</strong>${esc(block.sheet)} · Zonenauflösung${state.editing?" · Bearbeitungsmodus":""}</span>`;
    const head=document.getElementById("gpkTariffAutoPreviewHead"),body=document.getElementById("gpkTariffAutoPreviewRows");head.innerHTML=state.editing?"<tr><th>↕</th><th>Zone</th><th>Kurzcode</th><th>Land</th><th>PLZ von</th><th>PLZ bis</th><th>Relation / Ziel</th><th>Typ</th></tr>":"<tr><th>Zone</th><th>Kurzcode</th><th>Land</th><th>PLZ von</th><th>PLZ bis</th><th>Relation / Ziel</th><th>Typ</th></tr>";
    body.innerHTML=cols.map((col,ci)=>{const z=col.rules?.[0]||{},number=col.zoneNumber||index.get(col.key)||ci+1,code=text(z.manualRegionCode)||col.region||compactZoneRegion(z,country);if(state.editing)return `<tr><td class="zone-row-actions"><button type="button" data-zone-move="${ci}:-1" title="nach oben">↑</button><button type="button" data-zone-move="${ci}:1" title="nach unten">↓</button><button type="button" data-zone-insert="${ci}" title="Zone darunter einfügen">+</button><button type="button" data-zone-delete="${ci}" title="Zone löschen">×</button></td><td><label class="zone-number-cell">Zone <input type="number" min="1" max="999" class="zone-edit-input zone-number-input" data-zone-edit="${ci}:number" value="${esc(number)}"></label></td><td><input class="zone-edit-input" data-zone-edit="${ci}:code" value="${esc(code)}"></td><td><input class="zone-edit-input zone-country-input" data-zone-edit="${ci}:country" value="${esc(z.destCountry||country||"")}"></td><td><input class="zone-edit-input" data-zone-edit="${ci}:from" value="${esc(z.destPostcodeFrom||"")}"></td><td><input class="zone-edit-input" data-zone-edit="${ci}:to" value="${esc(z.destPostcodeTo||"")}"></td><td><input class="zone-edit-input" data-zone-edit="${ci}:target" value="${esc(z.destinationName||"")}"></td><td><small>${esc(z.ruleType||"POSTCODE")}</small></td></tr>`;return `<tr><td><strong>Zone ${esc(number)}</strong></td><td><span class="transport-pill">${esc(code)}</span></td><td>${esc(z.destCountry||"—")}</td><td>${esc(z.destPostcodeFrom||"—")}</td><td>${esc(z.destPostcodeTo||"—")}</td><td>${esc(z.destinationName||z.zone||"—")}</td><td><small>${esc(z.ruleType||"—")}</small></td></tr>`;}).join("")||`<tr><td colspan="${state.editing?8:7}" class="empty-state">Keine Zonenregeln für diese Auswahl.</td></tr>`;bindZoneEditor(block,country,cols);
  }
  function renderPreview(){
    ensurePreviewSelection();const block=activeBlock();const head=document.getElementById("gpkTariffAutoPreviewHead"),body=document.getElementById("gpkTariffAutoPreviewRows");
    if(!block){document.getElementById("gpkTariffAutoPreviewMeta").textContent="Keine Tarifbereiche ausgewählt.";document.getElementById("gpkTariffPreviewContext").innerHTML="";head.innerHTML="";body.innerHTML=`<tr><td class="empty-state">Keine Preiszeilen ausgewählt.</td></tr>`;return;}
    renderBenchmarkMeta();if(state.preview==="rates")renderRateMatrix(block,state.country);else renderZoneSheet(block,state.country);
  }
  function updateConfirm(){const btn=document.getElementById("gpkTariffAutoConfirm");if(btn)btn.disabled=!state.selected.size;}
  function close(clear=true){document.getElementById("gpkTariffAutoImport").hidden=true;document.body.classList.remove("modal-open");if(clear)clearDraft();}
  async function open(file){
    installModal();state.file=file;state.preview="rates";state.country="";state.blockId="";state.editing=false;state._matrix=null;state.editBatchId="";state.metaOpen=false;document.getElementById("gpkTariffAutoConfirm").textContent="Auswahl importieren";document.getElementById("gpkTariffAutoFile").textContent=file.name;const versionInput=document.getElementById("gpkTariffImportVersion");if(versionInput&&!versionInput.value)versionInput.value="EXT";document.getElementById("gpkTariffAutoSummary").innerHTML='<div class="auto-loading"><span class="auto-spinner"></span><strong>Tarif wird analysiert …</strong></div>';document.getElementById("gpkTariffAutoBlocks").innerHTML="";document.getElementById("gpkTariffAutoPreviewRows").innerHTML="";document.getElementById("gpkTariffAutoImport").hidden=false;document.body.classList.add("modal-open");renderProviderList();syncEditControls();
    try{state.analysis=await analyzeFile(file);state.selected=new Set(state.analysis.blocks.filter(b=>b.status==="AUTO_CANDIDATE").map(b=>b.id));renderProviderList(state.analysis.provider||"");const providerSelect=document.getElementById("gpkTariffAutoProvider");providerSelect.onchange=()=>{const e=document.getElementById("gpkTariffProviderError");if(e)e.hidden=true;providerSelect.classList.remove("input-error");updateConfirm();persistDraft();};document.getElementById("gpkTariffImportVersion")?.addEventListener("change",persistDraft);renderSummary();renderBlocks();ensurePreviewSelection();renderPreview();updateConfirm();}
    catch(err){document.getElementById("gpkTariffAutoSummary").innerHTML=`<div class="auto-import-error"><strong>Analyse fehlgeschlagen</strong><span>${esc(err.message)}</span></div>`;document.getElementById("gpkTariffAutoConfirm").disabled=true;}
  }
  function chooseAndOpen(){const input=document.createElement("input");input.type="file";input.accept=".xlsx,.xls,.xlsm,.xlsb,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";input.addEventListener("change",()=>{if(input.files?.[0])open(input.files[0]);},{once:true});input.click();}


  function showImportMessage(message,kind="error"){
    const e=document.getElementById("gpkTariffProviderError");
    if(e){e.textContent=message;e.hidden=false;e.classList.toggle("success-message",kind==="success");}
  }
  function persistImportData(newRates,newZones,batch,oldRates,oldZones,oldImports){
    let keepImports=[batch,...oldImports].slice(0,100),keepRates=[...newRates,...oldRates],keepZones=[...newZones,...oldZones];
    const attempt=()=>{GPK.write(RATE_KEY,keepRates);GPK.write(ZONE_KEY,keepZones);GPK.write(IMPORT_KEY,keepImports);};
    try{attempt();return;}
    catch(err){
      if(!/quota|storage|exceed/i.test(String(err?.name||"")+" "+String(err?.message||"")))throw err;
      /* Browser-LocalStorage ist begrenzt. Alte Autoimporte werden bei Bedarf
         batchweise entfernt; manuelle Tarife bleiben unangetastet. */
      while(keepImports.length>1){
        const removed=keepImports.pop();if(!removed?.id)continue;
        keepRates=keepRates.filter(r=>r.batchId!==removed.id);
        keepZones=keepZones.filter(z=>z.batchId!==removed.id);
        try{attempt();return;}catch(nextErr){
          if(!/quota|storage|exceed/i.test(String(nextErr?.name||"")+" "+String(nextErr?.message||"")))throw nextErr;
        }
      }
      throw new Error("Lokaler Speicher ist voll. Bitte alte importierte Tarifsets löschen oder den Backend-Modus verwenden.");
    }
  }

  function confirmImport(){
    const providerSelect=document.getElementById("gpkTariffAutoProvider");
    const provider=text(providerSelect?.value);
    if(!provider){
      const e=document.getElementById("gpkTariffProviderError");if(e)e.hidden=false;
      providerSelect?.classList.add("input-error");providerSelect?.focus();
      return;
    }
    if(!state.analysis)return;
    const providerRecord=providerMasterRecords().find(p=>text(p.name)===provider);
    if(!providerRecord){
      const e=document.getElementById("gpkTariffProviderError");if(e){e.textContent="Dienstleister nicht gefunden. Bitte anlegen oder Liste aktualisieren.";e.hidden=false;}
      providerSelect?.classList.add("input-error");
      return;
    }
    const blocks=selectedBlocks();if(!blocks.length)return;
    blocks.forEach(b=>{b.rates.forEach(r=>r.benchmarkMeta={...benchmarkMetaFor(b,text(r.destCountry)||"ALL")});});
    const batchId=state.editBatchId||makeId("import");const now=new Date().toISOString();
    const newRates=blocks.flatMap(b=>b.rates.filter(r=>Number.isFinite(Number(r.price))).map(r=>{const x={...r,id:makeId("rate"),batchId,provider,confidence:b.confidence,reviewStatus:b.status,sourceFile:state.file.name,importedAt:now};delete x.benchmarkMeta;return x;}));
    const newZones=dedupeZones(blocks.flatMap(b=>b.zones)).map(z=>({...z,id:makeId("zone"),batchId,provider,sourceFile:state.file.name,importedAt:now}));
    const allRates=GPK.read(RATE_KEY,[])||[],allZones=GPK.read(ZONE_KEY,[])||[],allImports=GPK.read(IMPORT_KEY,[])||[];
    const oldBatch=allImports.find(x=>x.id===batchId);const oldRates=allRates.filter(r=>r.batchId!==batchId),oldZones=allZones.filter(z=>z.batchId!==batchId),oldImports=allImports.filter(x=>x.id!==batchId);
    const batch={id:batchId,fileName:state.file.name,provider,providerId:providerRecord.id||null,version:importVersion,createdAt:oldBatch?.createdAt||now,updatedAt:now,sheets:state.analysis.sheets,blocks:blocks.map(b=>({id:b.id,sheet:b.sheet,model:b.model,modelLabel:b.modelLabel,headerRow:b.headerRow,confidence:b.confidence,status:b.status,rates:b.rates.filter(r=>Number.isFinite(Number(r.price))).length,zones:b.zones.length,benchmarkMeta:{...benchmarkMetaFor(b,"ALL")},benchmarkMetaByCountry:JSON.parse(JSON.stringify(b.benchmarkMetaByCountry||{}))})),ratesCount:newRates.length,zonesCount:newZones.length,reviewCount:blocks.filter(b=>b.status==="REVIEW").length,publishedAt:oldBatch?.publishedAt||null,publishedZones:oldBatch?.publishedZones||0,publishedRates:oldBatch?.publishedRates||0,lastComparison:oldBatch?.lastComparison||null};
    try{
      persistImportData(newRates,newZones,batch,oldRates,oldZones,oldImports);
      GPK.logImport?.({module:"Tarif-Autoimport",fileName:state.file.name,count:newRates.length,status:"success"});
      state.editBatchId="";clearDraft(true);close(false);
      try{if(typeof render==="function")render();}catch(_){}
      refreshPageStatus();
      if(window.rateToast){rateToast.textContent=`Import erfolgreich: ${newRates.length.toLocaleString("de-DE")} Preise · ${newZones.length.toLocaleString("de-DE")} Zonen.`;rateToast.hidden=false;setTimeout(()=>rateToast.hidden=true,3600);}
    }catch(err){
      console.error("Tarifimport",err);
      showImportMessage(err.message||"Tarif konnte nicht gespeichert werden.");
      if(window.rateToast){rateToast.textContent=err.message||"Tarif konnte nicht gespeichert werden.";rateToast.hidden=false;}
    }
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
  function currentFloaterForProvider(provider){
    const periods=(GPK.read(GPK.KEYS.floaters,[])||[]).filter(x=>lower(x.provider)===lower(provider));if(!periods.length)return null;
    const today=new Date().toISOString().slice(0,10);const current=periods.filter(x=>(!x.from||x.from<=today)&&(!x.to||x.to>=today)).sort((a,b)=>text(b.from).localeCompare(text(a.from)))[0];
    return current||periods.slice().sort((a,b)=>text(b.from).localeCompare(text(a.from)))[0]||null;
  }
  function autoProviderLogoHtml(name){const rec=providerMasterRecords().find(p=>text(p.name)===text(name));const logo=text(rec?.logo);const initials=text(rec?.alias||name||"AU").replace(/[^A-Za-z0-9]/g,"").slice(0,2).toUpperCase()||"AU";if(!logo)return `<div class="provider-avatar">${esc(initials)}</div>`;const src=logo.startsWith("data:")||logo.startsWith("blob:")||logo.includes("/")?logo:`logos/${logo}`;return `<div class="provider-avatar provider-avatar-logo"><img src="${esc(src)}" alt="${esc(name)} Logo" onerror="this.parentElement.classList.remove('provider-avatar-logo');this.remove();this.parentElement.textContent='${esc(initials)}'"></div>`;}
  function importDateLabel(v){try{return new Date(v).toLocaleString("de-DE",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});}catch(_){return "—";}}

  function appendImportedRows(){
    const tbody=document.getElementById("rateRows");if(!tbody)return;
    tbody.querySelectorAll("tr[data-auto-import-row]").forEach(x=>x.remove());
    const imports=filteredImports(GPK.read(IMPORT_KEY,[])||[]);
    if(imports.length && tbody.querySelector(".empty-state"))tbody.innerHTML="";
    const html=imports.map(x=>{
      const models=[...new Set((x.blocks||[]).map(b=>b.model))];
      const sheets=[...new Set((x.blocks||[]).map(b=>b.sheet).filter(Boolean))];
      const fl=currentFloaterForProvider(x.provider);const flText=fl?`${Number(fl.value||0).toLocaleString("de-DE")} %`:"—";
      return `<tr class="auto-main-table-row" data-auto-import-row="${esc(x.id)}"><td><div class="provider-name-cell">${autoProviderLogoHtml(x.provider)}<div><a class="table-main-link" href="dienstleister.html?provider=${encodeURIComponent(x.provider)}"><strong>${esc(x.provider)}</strong></a><small>${esc(x.fileName)}</small></div></div></td><td><strong class="table-main">Tarifset</strong><small>${esc(sheets.slice(0,3).join(" · ")||"Automatischer Import")}</small></td><td><strong class="table-main">${Number(x.zonesCount||0).toLocaleString("de-DE")} Zonen</strong><small>normalisiert</small></td><td><div class="auto-model-stack">${models.slice(0,3).map(m=>`<span class="transport-pill">${esc(m)}</span>`).join("")}${models.length>3?`<small>+${models.length-3}</small>`:""}</div></td><td><div class="auto-floater-cell"><span class="floater-pill">${esc(flText)}</span><button class="table-link-button" data-auto-floater="${esc(x.provider)}" type="button">Floater bearbeiten</button></div></td><td><strong class="table-main">${esc(importDateLabel(x.createdAt))}</strong><small>${Number(x.ratesCount||0).toLocaleString("de-DE")} Preiszeilen</small></td><td><strong class="table-main">${esc(x.version||x.blocks?.[0]?.benchmarkMeta?.version||"EXT")}</strong></td><td><span class="status-pill ${x.reviewCount?'inactive':'active'}">${x.reviewCount?'Review':'Aktiv'}</span><small>importiert</small></td><td class="row-actions"><button class="icon-button" data-auto-edit="${esc(x.id)}" title="Tarifset bearbeiten">✎</button><button class="icon-button" data-auto-compare="${esc(x.id)}" title="Mit bestehendem Benchmark vergleichen">⇄</button><button class="icon-button" data-auto-benchmark="${esc(x.id)}" title="Benchmark-Vordruck exportieren">⇩</button><button class="icon-button" data-auto-zones="${esc(x.id)}" title="Zonen-CSV exportieren">⌗</button><button class="icon-button danger-icon" data-auto-delete="${esc(x.id)}" title="Importierten Tarif löschen">🗑</button></td></tr>`;
    }).join("");
    if(html)tbody.insertAdjacentHTML("beforeend",html);
    const visible=document.getElementById("visibleRateCount");if(visible){const count=[...tbody.querySelectorAll("tr")].filter(tr=>!tr.querySelector(".empty-state")).length;visible.textContent=count;}
  }


  function editImportedTariff(batchId){
    const imports=GPK.read(IMPORT_KEY,[])||[],batch=imports.find(x=>x.id===batchId);if(!batch)throw new Error("Import nicht gefunden.");const storedRates=(GPK.read(RATE_KEY,[])||[]).filter(r=>r.batchId===batchId),storedZones=(GPK.read(ZONE_KEY,[])||[]).filter(z=>z.batchId===batchId);installModal();const blocks=(batch.blocks||[]).map((b,i)=>({id:b.id,sheet:b.sheet||`Bereich ${i+1}`,headerRow:b.headerRow||0,model:b.model||storedRates.find(r=>r.blockId===b.id)?.rateModel||"LDM_STEP",modelLabel:b.modelLabel||b.sheet||b.model,confidence:Number(b.confidence)||1,status:b.status||"AUTO_CANDIDATE",rates:storedRates.filter(r=>r.blockId===b.id).map(r=>({...r})),zones:storedZones.filter(z=>z.blockId===b.id).map(z=>({...z})),summary:`${storedRates.filter(r=>r.blockId===b.id).length} Preise · ${storedZones.filter(z=>z.blockId===b.id).length} Zonen`,benchmarkMeta:{...(b.benchmarkMeta||storedRates.find(r=>r.blockId===b.id)?.benchmarkMeta||{})},benchmarkMetaByCountry:JSON.parse(JSON.stringify(b.benchmarkMetaByCountry||{}))}));state.file={name:batch.fileName};state.analysis={fileName:batch.fileName,sheetCount:(batch.sheets||[]).length,provider:batch.provider,blocks,rates:blocks.flatMap(b=>b.rates),zones:dedupeZones(blocks.flatMap(b=>b.zones)),sheets:batch.sheets||[]};state.selected=new Set(blocks.map(b=>b.id));state.preview="rates";state.country="";state.blockId="";state.editing=true;state.metaOpen=false;state.editBatchId=batchId;document.getElementById("gpkTariffAutoFile").textContent=batch.fileName;document.getElementById("gpkTariffAutoImport").hidden=false;document.body.classList.add("modal-open");document.getElementById("gpkTariffAutoConfirm").textContent="Änderungen speichern";renderProviderList(batch.provider);const ver=document.getElementById("gpkTariffImportVersion");if(ver)ver.value=batch.version||batch.blocks?.[0]?.benchmarkMeta?.version||"EXT";renderSummary();renderBlocks();ensurePreviewSelection();renderPreview();syncEditControls();updateConfirm();
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
      const zoneNo=new Map();const usedZoneNos=new Set();
      zoneKeys.forEach((k,i)=>{
        const sample=zoneSamples.get(k);const zr=block.zones.find(z=>text(z.zone)&&text(z.zone)===text(sample?.zone))||{};
        let n=Number(zr.manualZoneNumber);if(!Number.isInteger(n)||n<1)n=i+1;
        if(n>MAX_ZONES)throw new Error(`Zone ${n} liegt außerhalb des Benchmarkbereichs 1–${MAX_ZONES}.`);
        if(usedZoneNos.has(n))throw new Error(`Zonennummer ${n} ist in einem Tarifblock doppelt vergeben.`);
        usedZoneNos.add(n);zoneNo.set(k,n);
      });
      const first=br[0];const provider=text(first.provider)||"#ALL";const importMeta=(GPK.read(IMPORT_KEY,[])||[]).find(x=>x.id===first.batchId);const storedBlock=importMeta?.blocks?.find(b=>b.id===first.blockId)||{};const modelGroups=new Map();
      br.forEach(r=>{const country=text(r.destCountry)||"ALL",storedCountryMeta=storedBlock?.benchmarkMetaByCountry?.[country]||storedBlock?.benchmarkMeta||{},rateMeta={...storedCountryMeta,...(r.benchmarkMeta||{})},k=[r.rateModel,text(r.product),country,r.chargeFrom??"",r.chargeTo??"",text(r.chargeLabel)].join("|");if(!modelGroups.has(k)){modelGroups.set(k,{model:r.rateModel,product:text(rateMeta.product)||benchmarkProduct(r),subservice:text(rateMeta.subservice)||text(r.subservice)||text(r.sheet)||"#ALL",costItem:text(rateMeta.costItem)||"Freight",cllType:text(rateMeta.cllType)||(r.rateModel==="FULL_LOAD"?"FTL":r.rateModel==="PACKAGE_WEIGHT_ZONE"?"Parcel":"Weight"),version:text(rateMeta.version)||text(r.version)||text(importMeta?.validity)||"EXT",originCountry:text(rateMeta.originCountry)||text(r.originCountry)||"#ALL",destCountry:text(rateMeta.destCountry)&&text(rateMeta.destCountry).toUpperCase()!=="AUTO"?text(rateMeta.destCountry):country||"#ALL",meta:rateMeta,chargeFrom:r.chargeFrom,chargeTo:r.chargeTo,chargeLabel:r.chargeLabel,rates:[],sourceRow:r.sourceRow||0});}modelGroups.get(k).rates.push(r);});
      const groups=[...modelGroups.values()].sort((a,b)=>{if(a.model==="FULL_LOAD"&&b.model!=="FULL_LOAD")return 1;if(b.model==="FULL_LOAD"&&a.model!=="FULL_LOAD")return -1;const an=Number(a.chargeTo),bn=Number(b.chargeTo);if(Number.isFinite(an)&&Number.isFinite(bn)&&an!==bn)return an-bn;return a.sourceRow-b.sourceRow;});
      const previousByModel=new Map();
      groups.forEach(g=>{
        const direct=["PER_KG","PER_100KG","PER_LDM","PER_KM","PER_PALLET"].includes(g.model);
        const fixed=["FIXED_RELATION","FULL_LOAD"].includes(g.model);
        const meta=g.meta||{};const metaStep=Number(String(meta.step??"").replace(",","."));const step=Number.isFinite(metaStep)?metaStep:benchmarkStep(g.model);let from,to;
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
        const metaUnit=text(meta.unit);if(metaUnit&&metaUnit.toUpperCase()!=="AUTO")unit=metaUnit;const baseValue=Number(String(meta.base??"1").replace(",","."));
        // 1:1 zum bisherigen GPK-Benchmarkvordruck: 13 Stammdatenfelder, danach Zone 1..150.
        rateOut.push({__block:block.key,__model:g.model,base:[provider,g.product,g.subservice,g.costItem,g.cllType,g.version,g.originCountry,g.destCountry||"#ALL",from,to,step,unit,Number.isFinite(baseValue)?baseValue:1],prices});
      });
      zoneKeys.forEach((zk,i)=>{
        const sample=zoneSamples.get(zk);const matching=block.zones.find(z=>text(z.zone)&&text(z.zone)===text(sample.zone))||block.zones.find(z=>text(z.sourceRef)&&text(sample.sourceRef)&&text(z.sourceRef).split("C")[0]===text(sample.sourceRef).split("C")[0]);
        const z=matching||{};
        zoneOut.push([provider,text(z.originCountry)||text(sample.originCountry)||"#ALL",text(z.originPostcodeFrom)||0,text(z.originPostcodeTo)||99999,text(z.destCountry)||text(sample.destCountry)||"#ALL",text(z.destPostcodeFrom)||0,text(z.destPostcodeTo)||99999,zoneNo.get(zk)||i+1]);
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
  function installDeleteImportModal(){
    if(document.getElementById("gpkTariffDeleteImport"))return;
    document.body.insertAdjacentHTML("beforeend",`<div class="modal-backdrop" id="gpkTariffDeleteImport" hidden><section class="location-modal delete-import-modal" role="dialog" aria-modal="true"><div class="modal-head"><div><span class="modal-eyebrow">Tarif löschen</span><h2>Automatisch importierten Tarif löschen?</h2><small id="gpkTariffDeleteImportMeta"></small></div></div><div class="delete-import-copy"><strong>Dieser Import wird vollständig entfernt.</strong><span>Gelöscht werden der Import-Eintrag, alle zugehörigen normalisierten Preise und Zonen sowie eine ggf. vorhandene Freigabe für den Preisrechner.</span></div><div class="modal-actions"><button class="secondary compact-button" id="gpkTariffDeleteImportCancel" type="button">Abbrechen</button><button class="danger compact-button" id="gpkTariffDeleteImportConfirm" type="button">Tarif löschen</button></div></section></div>`);
    document.getElementById("gpkTariffDeleteImportCancel").addEventListener("click",()=>{document.getElementById("gpkTariffDeleteImport").hidden=true;document.body.classList.remove("modal-open");});
  }
  function deleteImportedTariff(batchId){
    const imports=GPK.read(IMPORT_KEY,[])||[];
    const target=imports.find(x=>x.id===batchId);
    if(!target)throw new Error("Der Import wurde nicht gefunden.");
    GPK.write(IMPORT_KEY,imports.filter(x=>x.id!==batchId));
    GPK.write(RATE_KEY,(GPK.read(RATE_KEY,[])||[]).filter(r=>r.batchId!==batchId));
    GPK.write(ZONE_KEY,(GPK.read(ZONE_KEY,[])||[]).filter(z=>z.batchId!==batchId));
    GPK.write(PUBLISHED_KEY,(GPK.read(PUBLISHED_KEY,[])||[]).filter(x=>x.id!==batchId));
    try{if(typeof render==="function")render();}catch(_){ }
    refreshPageStatus();
    return target;
  }
  function requestDeleteImportedTariff(batchId){
    installDeleteImportModal();
    const imports=GPK.read(IMPORT_KEY,[])||[];
    const target=imports.find(x=>x.id===batchId);if(!target)throw new Error("Der Import wurde nicht gefunden.");
    const modal=document.getElementById("gpkTariffDeleteImport");modal.hidden=false;document.body.classList.add("modal-open");
    document.getElementById("gpkTariffDeleteImportMeta").textContent=`${target.provider||"Dienstleister"} · ${target.fileName||"Import"} · ${Number(target.ratesCount||0).toLocaleString("de-DE")} Preise · ${Number(target.zonesCount||0).toLocaleString("de-DE")} Zonen`;
    const btn=document.getElementById("gpkTariffDeleteImportConfirm");
    btn.onclick=()=>{try{const deleted=deleteImportedTariff(batchId);modal.hidden=true;document.body.classList.remove("modal-open");if(window.rateToast){rateToast.textContent=`${deleted.provider}: importierter Tarif wurde gelöscht.`;rateToast.hidden=false;setTimeout(()=>rateToast.hidden=true,3200);}}catch(err){if(window.rateToast){rateToast.textContent=err.message;rateToast.hidden=false;setTimeout(()=>rateToast.hidden=true,3200);}}};
  }

  function publishBatchToCalculator(batchId){
    const allRates=GPK.read(RATE_KEY,[])||[],allZones=GPK.read(ZONE_KEY,[])||[],imports=GPK.read(IMPORT_KEY,[])||[];
    const rows=allRates.filter(r=>r.batchId===batchId),zones=allZones.filter(z=>z.batchId===batchId);
    if(!rows.length)throw new Error("Für diesen Import sind keine normalisierten Raten vorhanden.");
    const data=buildBenchmarkData(rows,zones);
    const supportedModels=new Set(["WEIGHT_STEP","PER_KG","PER_100KG","LDM_STEP","PER_LDM","PALLET_STEP","PER_PALLET","FULL_LOAD","PACKAGE_WEIGHT_ZONE"]);
    const calculatorRows=data.rateOut.filter(r=>supportedModels.has(r.__model));
    const imp=imports.find(x=>x.id===batchId);
    const provider=text(rows[0]?.provider)||text(imp?.provider)||"";
    const published=GPK.read(PUBLISHED_KEY,[])||[];
    const entry={id:batchId,provider,publishedAt:new Date().toISOString(),zones:data.zoneOut,rates:calculatorRows.map(r=>({base:r.base,prices:r.prices,model:r.__model}))};
    const next=[entry,...published.filter(x=>x.id!==batchId)].slice(0,100);
    GPK.write(PUBLISHED_KEY,next);
    if(imp){imp.publishedAt=entry.publishedAt;imp.publishedZones=data.zoneOut.length;imp.publishedRates=calculatorRows.length;GPK.write(IMPORT_KEY,imports);}
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
    const tbody=document.getElementById("autoImportRows");if(tbody)tbody.innerHTML=imports.slice(0,8).map(x=>`<tr><td><strong>${esc(x.provider)}</strong><small>${esc(x.fileName)}</small></td><td>${x.blocks.map(b=>`<span class="transport-pill">${esc(b.model)}</span>`).join(' ')}</td><td><strong>${Number(x.ratesCount||0).toLocaleString('de-DE')}</strong></td><td><strong>${Number(x.zonesCount||0).toLocaleString('de-DE')}</strong></td><td><span class="status-pill ${x.publishedAt?'active':(x.reviewCount?'inactive':'active')}">${x.publishedAt?'Im Rechner':(x.reviewCount?x.reviewCount+' Review':'Erkannt')}</span>${x.publishedAt?`<small>${Number(x.publishedZones||0)} Zonen · ${Number(x.publishedRates||0)} Raten</small>`:""}</td><td>${x.lastComparison?`<strong>${Number(x.lastComparison.priceMatchPct||0).toLocaleString('de-DE')} %</strong><small>${esc(x.lastComparison.fileName||'geprüft')}</small>`:`<button class="secondary compact-button auto-compare-history-btn" data-auto-compare="${esc(x.id)}" type="button">Benchmark prüfen</button>`}</td><td><small>${new Date(x.createdAt).toLocaleString('de-DE')}</small></td><td class="row-actions"><button class="icon-button" data-auto-edit="${esc(x.id)}" title="Tarifset bearbeiten">✎</button><button class="icon-button danger-icon" data-auto-delete="${esc(x.id)}" title="Importierten Tarif löschen">🗑</button></td></tr>`).join("")||`<tr><td colspan="8" class="empty-state">Noch kein Tarif automatisch importiert.</td></tr>`;
    syncImportedProviderFilter(imports);appendImportedRows();
  }

  window.GPKTariffImport={open,chooseAndOpen,analyzeFile,refreshPageStatus,appendImportedRows,exportRates,exportZones,compareWithBenchmark,publishBatchToCalculator,deleteImportedTariff,requestDeleteImportedTariff,editImportedTariff,buildBenchmarkData,keys:{rates:RATE_KEY,zones:ZONE_KEY,imports:IMPORT_KEY},_test:{analyzeSheet,parseClassicPalletZoneSheet,parseExplicitClassicGrid,parseHorizontalMatrix,parseVerticalZoneMatrices,parseFixedRelations,dimensionValue,postcodeRange,expandPrefixExpression,buildBenchmarkData,parseExistingRates,compareRateSheets,parseExistingZones,compareZoneSheets,detectChargeRules,parseChargeRulesFromParamsSheet,parseChargeRulesFromFreeText}};
  document.addEventListener("DOMContentLoaded",()=>{
    installModal();if(!document.getElementById("gpkTariffAutoImport").hidden){/* already open */}else{restoreDraft();}refreshPageStatus();const historyRows=document.getElementById("autoImportRows");if(historyRows&&!historyRows.dataset.compareHandlers){historyRows.dataset.compareHandlers="1";historyRows.addEventListener("click",async e=>{const c=e.target.closest("[data-auto-compare]");const d=e.target.closest("[data-auto-delete]");const ed=e.target.closest("[data-auto-edit]");try{if(c)await compareWithBenchmark(c.dataset.autoCompare);if(ed)editImportedTariff(ed.dataset.autoEdit);if(d)requestDeleteImportedTariff(d.dataset.autoDelete);}catch(err){if(window.rateToast){rateToast.textContent=err.message;rateToast.hidden=false;setTimeout(()=>rateToast.hidden=true,3500);}}});}
    ["rateSearch","rateProviderFilter","rateTransportFilter","rateStatusFilter"].forEach(id=>document.getElementById(id)?.addEventListener("input",()=>setTimeout(appendImportedRows,0)));
    const mainRows=document.getElementById("rateRows");if(mainRows&&!mainRows.dataset.autoImportHandlers){mainRows.dataset.autoImportHandlers="1";mainRows.addEventListener("click",async e=>{const c=e.target.closest("[data-auto-compare]");const b=e.target.closest("[data-auto-benchmark]");const z=e.target.closest("[data-auto-zones]");const d=e.target.closest("[data-auto-delete]");const f=e.target.closest("[data-auto-floater]");const ed=e.target.closest("[data-auto-edit]");try{if(ed)editImportedTariff(ed.dataset.autoEdit);if(c)await compareWithBenchmark(c.dataset.autoCompare);if(b)await exportRates(b.dataset.autoBenchmark);if(z)await exportZones(z.dataset.autoZones);if(d)requestDeleteImportedTariff(d.dataset.autoDelete);if(f){if(window.GPKTariffUI?.openFloaterForProvider)window.GPKTariffUI.openFloaterForProvider(f.dataset.autoFloater);else location.href=`tarife.html?tab=floater&provider=${encodeURIComponent(f.dataset.autoFloater)}`;}}catch(err){if(window.rateToast){rateToast.textContent=err.message;rateToast.hidden=false;setTimeout(()=>rateToast.hidden=true,3500);}}});}
    document.getElementById("exportNormalizedRatesBtn")?.addEventListener("click",async()=>{try{await exportRates();}catch(e){if(window.rateToast){rateToast.textContent=e.message;rateToast.hidden=false;setTimeout(()=>rateToast.hidden=true,2600);}}});
    document.getElementById("exportZoneRulesBtn")?.addEventListener("click",async()=>{try{await exportZones();}catch(e){if(window.rateToast){rateToast.textContent=e.message;rateToast.hidden=false;setTimeout(()=>rateToast.hidden=true,2600);}}});
  });
})();
