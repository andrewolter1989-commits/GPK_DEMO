
window.GPKImport = window.GPKImport || {};

GPKImport.MODULES = {
  locations: {
    title: "Entladestellen",
    required: ["name","country","zip","city"],
    fields: [
      ["name","Firmenname"],["country","Land"],["zip","PLZ"],["city","Ort"],["street","Straße"],
      ["contact","Ansprechpartner"],["email","E-Mail"],["phone","Telefon"],["time","Zeitfenster"],
      ["notes","Hinweise"],["status","Aktiv"]
    ],
    aliases: {
      name:["firmenname","name","entladestelle"],
      country:["land","country"],
      zip:["plz","postal_code","postcode"],
      city:["ort","city"],
      street:["strasse","straße","strasse_hausnummer","street"],
      contact:["ansprechpartner","contact"],
      email:["e_mail","email"],
      phone:["telefon","phone"],
      time:["zeitfenster","time_window"],
      notes:["rampenhinweis","interne_notiz","hinweise","notes"],
      status:["aktiv","status"]
    },
    transform(row){
      return {
        id: Date.now()+Math.floor(Math.random()*100000),
        name:String(row.name||"").trim(),
        country:String(row.country||"DE").trim().toUpperCase(),
        zip:String(row.zip||"").trim(),
        city:String(row.city||"").trim(),
        street:String(row.street||"").trim(),
        contact:String(row.contact||"").trim(),
        email:String(row.email||"").trim(),
        phone:String(row.phone||"").trim(),
        time:String(row.time||"").trim(),
        notes:String(row.notes||"").trim(),
        status: yesNoToStatus(row.status||"Ja")
      };
    },
    keyFn:x=>`${x.country}|${x.zip}|${x.name}|${x.street}`,
    storageKey:()=>GPK.KEYS.locations
  },
  providers: {
    title:"Dienstleister",
    required:["name"],
    fields:[
      ["name","Dienstleister"],["alias","Alias"],["contact","Ansprechpartner"],["email","E-Mail"],
      ["phone","Telefon"],["rates","Anzahl Tarife"],["floater","Floater"],["status","Aktiv"],
      ["logo","Logo"],["notes","Hinweise"]
    ],
    aliases:{
      name:["dienstleister","name","firmenname"],
      alias:["alias","kuerzel","kürzel"],
      contact:["ansprechpartner","contact"],
      email:["e_mail","email"],
      phone:["telefon","phone"],
      rates:["anzahl_tarife","tarife","rates"],
      floater:["floater","diesel","diesel_floater"],
      status:["aktiv","status"],
      logo:["logo","logo_datei"],
      notes:["hinweise","notizen","notes"]
    },
    transform(row){
      return {
        id:Date.now()+Math.floor(Math.random()*100000),
        name:String(row.name||"").trim(),
        alias:String(row.alias||"").trim(),
        contact:String(row.contact||"").trim(),
        email:String(row.email||"").trim(),
        phone:String(row.phone||"").trim(),
        rates:Number(String(row.rates||0).replace(",","."))||0,
        floater:String(row.floater||"").trim(),
        status:yesNoToStatus(row.status||"Ja"),
        logo:String(row.logo||"").trim(),
        notes:String(row.notes||"").trim()
      };
    },
    keyFn:x=>x.name,
    storageKey:()=>GPK.KEYS.providers
  },
  rates: {
    title:"Tarife",
    required:["provider","country","base"],
    fields:[
      ["provider","Dienstleister"],["country","Land"],["zone","Zone"],["zipFrom","PLZ von"],["zipTo","PLZ bis"],
      ["transport","Transportart"],["ldm","Lademeter"],["base","Basispreis EUR"],["floater","Floater %"],["status","Aktiv"],["notes","Hinweise"]
    ],
    aliases:{
      provider:["dienstleister","provider"],country:["land","country"],zone:["zone"],zipFrom:["plz_von","zip_from","plzvon"],
      zipTo:["plz_bis","zip_to","plzbis"],transport:["transportart","transport"],ldm:["lademeter","ldm","stufe"],
      base:["basispreis","basispreis_eur","preis","base"],floater:["floater","floater_prozent"],status:["aktiv","status"],
      notes:["hinweise","notizen","notes"]
    },
    transform(row){
      return {
        id:Date.now()+Math.floor(Math.random()*100000),
        provider:String(row.provider||"").trim(),
        country:String(row.country||"DE").trim().toUpperCase(),
        zone:String(row.zone||"").trim(),
        zipFrom:String(row.zipFrom||"").trim(),
        zipTo:String(row.zipTo||"").trim(),
        transport:String(row.transport||"FTL").trim(),
        ldm:String(row.ldm||"").trim(),
        base:Number(String(row.base||0).replace(",","."))||0,
        floater:Number(String(row.floater||0).replace(",","."))||0,
        status:yesNoToStatus(row.status||"Ja"),
        notes:String(row.notes||"").trim()
      };
    },
    keyFn:x=>`${x.provider}|${x.country}|${x.zone}|${x.zipFrom}|${x.zipTo}|${x.transport}|${x.ldm}`,
    storageKey:()=>GPK.KEYS.rates
  },
  floaters: {
    title:"Diesel / Floater",
    required:["provider","from","to","value"],
    fields:[
      ["provider","Dienstleister"],["type","Periodentyp"],["from","Gültig ab"],["to","Gültig bis"],["value","Floater %"],["notes","Notiz"]
    ],
    aliases:{
      provider:["dienstleister","provider"],type:["periodentyp","periode","type"],from:["gueltig_ab","gültig_ab","von","from"],
      to:["gueltig_bis","gültig_bis","bis","to"],value:["floater","floater_prozent","diesel"],notes:["notiz","quelle","hinweise","notes"]
    },
    transform(row){
      const rawType=String(row.type||"custom").trim().toLowerCase();
      const type=rawType.replace("2 wochen","2weeks").replace("woche","week").replace("monat","month").replace("halbmonat","halfmonth").replace("individuell","custom");
      return {
        id:Date.now()+Math.floor(Math.random()*100000),
        provider:String(row.provider||"").trim(),
        type,
        from:String(row.from||"").trim(),
        to:String(row.to||"").trim(),
        value:Number(String(row.value||0).replace(",","."))||0,
        notes:String(row.notes||"").trim()
      };
    },
    keyFn:x=>`${x.provider}|${x.from}|${x.to}|${x.type}`,
    storageKey:()=>GPK.KEYS.floaters
  }
};

GPKImport.state = {module:null,file:null,rawRows:[],headers:[],mapping:{},validated:[]};

GPKImport.autoMap = function(moduleKey, headers){
  const cfg=GPKImport.MODULES[moduleKey];
  const normalized=headers.map(h=>normalizeHeader(h));
  const mapping={};
  cfg.fields.forEach(([field])=>{
    const aliases=(cfg.aliases[field]||[]).map(normalizeHeader);
    const idx=normalized.findIndex(h=>aliases.includes(h));
    if(idx>=0) mapping[field]=headers[idx];
  });
  return mapping;
};

GPKImport.open = function(moduleKey,file){
  const cfg=GPKImport.MODULES[moduleKey];
  if(!cfg) throw new Error("Unbekanntes Importmodul.");
  GPKImport.state={module:moduleKey,file,rawRows:[],headers:[],mapping:{},validated:[]};
  document.getElementById("gpkImportTitle").textContent=`${cfg.title} importieren`;
  document.getElementById("gpkImportFileName").textContent=file.name;
  document.getElementById("gpkImportStep1").classList.add("active");
  document.getElementById("gpkImportStep2").classList.remove("active");
  document.getElementById("gpkImportStep3").classList.remove("active");
  document.getElementById("gpkImportManager").hidden=false;
  document.body.classList.add("modal-open");
  return importTabularFile(file).then(data=>{
    if(!data.length) throw new Error("Keine Daten gefunden.");
    const headers=Object.keys(data[0]);
    GPKImport.state.rawRows=data;
    GPKImport.state.headers=headers;
    GPKImport.state.mapping=GPKImport.autoMap(moduleKey,headers);
    GPKImport.renderMapping();
  }).catch(err=>{
    GPKImport.close();
    throw err;
  });
};

GPKImport.close = function(){
  const modal=document.getElementById("gpkImportManager");
  if(modal) modal.hidden=true;
  document.body.classList.remove("modal-open");
};

GPKImport.renderMapping = function(){
  const cfg=GPKImport.MODULES[GPKImport.state.module];
  const wrap=document.getElementById("gpkImportMappingRows");
  wrap.innerHTML=cfg.fields.map(([field,label])=>{
    const required=cfg.required.includes(field);
    const opts=['<option value="">— nicht importieren —</option>',...GPKImport.state.headers.map(h=>`<option value="${h.replace(/"/g,'&quot;')}">${h}</option>`)].join("");
    return `<div class="mapping-row">
      <div><strong>${label}${required?' *':''}</strong><small>${required?'Pflichtfeld':'Optional'}</small></div>
      <select data-map-field="${field}">${opts}</select>
    </div>`;
  }).join("");
  wrap.querySelectorAll("[data-map-field]").forEach(sel=>{
    sel.value=GPKImport.state.mapping[sel.dataset.mapField]||"";
    sel.addEventListener("change",()=>{GPKImport.state.mapping[sel.dataset.mapField]=sel.value;});
  });
  document.getElementById("gpkImportMappingCount").textContent=`${GPKImport.state.rawRows.length} Datenzeilen erkannt`;
  document.getElementById("gpkImportStep2").classList.add("active");
};

GPKImport.validate = function(){
  const cfg=GPKImport.MODULES[GPKImport.state.module];
  const result=GPKImport.state.rawRows.map((source,index)=>{
    const mapped={};
    cfg.fields.forEach(([field])=>{
      const sourceHeader=GPKImport.state.mapping[field];
      mapped[field]=sourceHeader ? source[sourceHeader] : "";
    });
    const data=cfg.transform(mapped);
    const errors=[];
    cfg.required.forEach(field=>{
      const value=data[field];
      if(value===undefined || value===null || String(value).trim()==="" || (field==="base" && Number(value)<=0) || (field==="value" && Number(value)<=0)){
        const label=cfg.fields.find(x=>x[0]===field)?.[1]||field;
        errors.push(`${label} fehlt/ungültig`);
      }
    });
    if(GPKImport.state.module==="floaters" && data.from && data.to && data.to<data.from) errors.push("Gültig-bis liegt vor Gültig-ab");
    return {index:index+2,data,errors};
  });
  GPKImport.state.validated=result;
  GPKImport.renderPreview();
};

GPKImport.renderPreview = function(){
  const cfg=GPKImport.MODULES[GPKImport.state.module];
  const rows=GPKImport.state.validated;
  const valid=rows.filter(x=>!x.errors.length);
  const invalid=rows.filter(x=>x.errors.length);
  document.getElementById("gpkImportValidCount").textContent=valid.length;
  document.getElementById("gpkImportInvalidCount").textContent=invalid.length;

  const preview=document.getElementById("gpkImportPreviewRows");
  const cols=cfg.fields.slice(0,5).map(x=>x[0]);
  preview.innerHTML=rows.slice(0,15).map(r=>`
    <tr class="${r.errors.length?'invalid-row':''}">
      <td>${r.index}</td>
      ${cols.map(c=>`<td>${String(r.data[c]??"")}</td>`).join("")}
      <td>${r.errors.length?`<span class="import-error">${r.errors.join("; ")}</span>`:'<span class="import-ok">OK</span>'}</td>
    </tr>`).join("");
  const head=document.getElementById("gpkImportPreviewHead");
  head.innerHTML=`<tr><th>Zeile</th>${cols.map(c=>`<th>${cfg.fields.find(x=>x[0]===c)?.[1]||c}</th>`).join("")}<th>Prüfung</th></tr>`;
  document.getElementById("gpkImportConfirmBtn").disabled=!valid.length;
  document.getElementById("gpkImportStep3").classList.add("active");
};

GPKImport.confirm = function(){
  const cfg=GPKImport.MODULES[GPKImport.state.module];
  const valid=GPKImport.state.validated.filter(x=>!x.errors.length).map(x=>x.data);
  const existing=GPK.read(cfg.storageKey(),[])||[];
  const merged=GPK.dedupe([...valid,...existing],cfg.keyFn);
  const added=Math.max(0,merged.length-existing.length);
  GPK.write(cfg.storageKey(),merged);
  if(window.GPK && GPK.logImport){
    GPK.logImport({module:cfg.title,fileName:GPKImport.state.file?.name||"Datei",count:added,status:"success"});
  }
  const msg=`${added} Datensätze importiert${valid.length-added>0?`, ${valid.length-added} Dubletten übersprungen`:""}.`;
  GPKImport.close();
  return {added,valid:valid.length,message:msg};
};

GPKImport.install = function(){
  if(document.getElementById("gpkImportManager")) return;
  const html=`
  <div class="modal-backdrop" id="gpkImportManager" hidden>
    <section class="location-modal import-manager-modal" role="dialog" aria-modal="true">
      <div class="modal-head">
        <div><span class="modal-eyebrow">Import-Manager</span><h2 id="gpkImportTitle">Daten importieren</h2><small id="gpkImportFileName" class="import-file-name"></small></div>
        <button class="modal-close" id="gpkImportCloseBtn" type="button">×</button>
      </div>
      <div class="import-steps">
        <span id="gpkImportStep1" class="import-step active">1 Datei</span>
        <span id="gpkImportStep2" class="import-step">2 Spalten</span>
        <span id="gpkImportStep3" class="import-step">3 Prüfen</span>
      </div>
      <div class="import-manager-body">
        <div class="import-section">
          <div class="import-section-head"><div><h3>Spalten zuordnen</h3><p id="gpkImportMappingCount"></p></div></div>
          <div id="gpkImportMappingRows" class="mapping-list"></div>
          <div class="import-manager-actions"><button class="secondary compact-button" id="gpkImportValidateBtn" type="button">Daten prüfen</button></div>
        </div>
        <div class="import-section">
          <div class="import-section-head"><div><h3>Vorschau & Prüfung</h3><p><span class="import-ok" id="gpkImportValidCount">0</span> gültig · <span class="import-error" id="gpkImportInvalidCount">0</span> fehlerhaft</p></div></div>
          <div class="masterdata-table-wrap import-preview-wrap">
            <table class="masterdata-table import-preview-table">
              <thead id="gpkImportPreviewHead"></thead>
              <tbody id="gpkImportPreviewRows"><tr><td class="empty-state">Nach der Zuordnung „Daten prüfen“ wählen.</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="modal-actions">
        <button class="secondary compact-button" id="gpkImportCancelBtn" type="button">Abbrechen</button>
        <button class="primary compact-button" id="gpkImportConfirmBtn" type="button" disabled>Import bestätigen</button>
      </div>
    </section>
  </div>`;
  document.body.insertAdjacentHTML("beforeend",html);

  gpkImportCloseBtn.addEventListener("click",GPKImport.close);
  gpkImportCancelBtn.addEventListener("click",GPKImport.close);
  gpkImportManager.addEventListener("click",e=>{if(e.target===gpkImportManager)GPKImport.close();});
  gpkImportValidateBtn.addEventListener("click",GPKImport.validate);
};
document.addEventListener("DOMContentLoaded",GPKImport.install);
