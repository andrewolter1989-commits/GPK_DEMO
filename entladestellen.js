
const defaultLocations = [
  {id:1,name:"Andre Wolter",street:"An der Hochschule 4",zip:"24405",city:"Mohrkirch",country:"DE",contact:"Andre Wolter",email:"andre.wolter@example.com",phone:"+49 000 000000",status:"active",time:"",notes:""},
  {id:2,name:"Nordpack GmbH",street:"Werkstraße 18",zip:"24941",city:"Flensburg",country:"DE",contact:"Jana Petersen",email:"dispo@nordpack.example",phone:"+49 461 555010",status:"active",time:"07:00–15:00",notes:"Anmeldung beim Pförtner"},
  {id:3,name:"Demo Logistics NV",street:"Havenlaan 8",zip:"2450",city:"Meerhout",country:"BE",contact:"Tom Vermeulen",email:"warehouse@demo.example",phone:"+32 14 100200",status:"active",time:"08:00–14:00",notes:"Seitliche Entladung möglich"},
  {id:4,name:"Westfalen Components",street:"Industrieweg 31",zip:"48155",city:"Münster",country:"DE",contact:"Sven Krüger",email:"wareneingang@westfalen.example",phone:"+49 251 910020",status:"active",time:"06:00–16:00",notes:""},
  {id:5,name:"Benelux Foam BV",street:"Nijverheidsweg 6",zip:"5048",city:"Tilburg",country:"NL",contact:"Mila de Jong",email:"receiving@foam.example",phone:"+31 13 440010",status:"active",time:"07:30–15:30",notes:""},
  {id:6,name:"Rhein Technik GmbH",street:"Am Hafen 12",zip:"47059",city:"Duisburg",country:"DE",contact:"Markus Hahn",email:"logistik@rhein.example",phone:"+49 203 884400",status:"inactive",time:"",notes:"vorübergehend gesperrt"},
  {id:7,name:"Alsace Industrie SAS",street:"Rue des Ateliers 22",zip:"67000",city:"Strasbourg",country:"FR",contact:"Claire Martin",email:"reception@alsace.example",phone:"+33 3 880000",status:"active",time:"09:00–16:00",notes:""},
  {id:8,name:"Hanse Werkstoffe",street:"Billbrookdeich 77",zip:"22113",city:"Hamburg",country:"DE",contact:"Lea Hansen",email:"lager@hanse.example",phone:"+49 40 300020",status:"active",time:"06:00–14:00",notes:"Rampe 5"}
];

let locations = GPK.read(GPK.KEYS.locations, null) || defaultLocations;
let editingId = null;

const rows = document.getElementById("locationRows");
const search = document.getElementById("locationSearch");
const countryFilter = document.getElementById("countryFilter");
const statusFilter = document.getElementById("statusFilter");
const count = document.getElementById("locationCount");
const modal = document.getElementById("locationModal");
const form = document.getElementById("locationForm");

const LOCATION_AUDIT_KEY = GPK.KEYS.locationAudit || "gpk_demo_location_audit_v1";
let locationAudit = GPK.read(LOCATION_AUDIT_KEY, []) || [];

function sameId(a,b){ return String(a ?? "") === String(b ?? ""); }
function currentUserName(){ return String(window.GPK_CURRENT_USER?.name || "Lokale Demo"); }
function isoNow(){ return new Date().toISOString(); }
function inferCreatedAt(item){
  if(item?.createdAt) return item.createdAt;
  const m=String(item?.id||"").match(/^LOC-(\d{11,})$/);
  if(m){ const d=new Date(Number(m[1])); if(!isNaN(d)) return d.toISOString(); }
  return "";
}
function formatDateTime(value){
  const d=new Date(value||"");
  if(isNaN(d)) return "—";
  return d.toLocaleDateString("de-DE")+" · "+d.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"});
}
function ensureLocationMetadata(){
  let changed=false;
  locations.forEach(item=>{
    const inferred=inferCreatedAt(item);
    if(!item.createdAt && inferred){ item.createdAt=inferred; changed=true; }
    if(!item.createdBy && inferred){ item.createdBy="Lokale Demo"; changed=true; }
    if(!Array.isArray(item.history)){ item.history=[]; changed=true; }
  });
  if(changed) GPK.write(GPK.KEYS.locations,locations);
}
function addLocationAudit(item, action, details=""){
  const entry={id:`LA-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,locationId:String(item?.id||""),at:isoNow(),user:currentUserName(),action,details};
  locationAudit.unshift(entry);
  locationAudit=locationAudit.slice(0,500);
  GPK.write(LOCATION_AUDIT_KEY,locationAudit);
  if(item){ item.history=Array.isArray(item.history)?item.history:[]; item.history.push({at:entry.at,user:entry.user,action,details}); }
  return entry;
}
function locationHistory(item){
  const local=Array.isArray(item?.history)?item.history:[];
  const global=locationAudit.filter(x=>sameId(x.locationId,item?.id));
  const all=[...local,...global].filter((x,i,a)=>a.findIndex(y=>y.at===x.at&&y.action===x.action&&y.user===x.user)===i);
  return all.sort((a,b)=>new Date(b.at||0)-new Date(a.at||0));
}
function renderLocationAudit(item){
  const panel=document.getElementById("locationAuditPanel"),meta=document.getElementById("locationAuditMeta"),list=document.getElementById("locationAuditList");
  if(!panel||!meta||!list)return;
  if(!item){ panel.hidden=true; return; }
  panel.hidden=false;
  const createdAt=item.createdAt||inferCreatedAt(item), createdBy=item.createdBy||"—";
  meta.textContent=createdAt?`Angelegt ${formatDateTime(createdAt)} · ${createdBy}`:"Anlagedatum für Bestandsdatensatz nicht vorhanden";
  const hist=locationHistory(item);
  list.innerHTML=hist.length?hist.map(x=>`<div><span>${esc(formatDateTime(x.at))}</span><strong>${esc(x.user||"—")}</strong><b>${esc(x.action||"Änderung")}</b>${x.details?`<small>${esc(x.details)}</small>`:""}</div>`).join(""):'<div class="location-audit-empty">Noch keine Änderungen protokolliert.</div>';
}

function esc(v=""){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}

function render(){
  const q = search.value.trim().toLowerCase();
  const country = countryFilter.value;
  const status = statusFilter.value;
  const filtered = locations.filter(x => {
    const hay = `${x.name} ${x.street} ${x.zip} ${x.city} ${x.country} ${x.contact}`.toLowerCase();
    return (!q || hay.includes(q)) && (!country || x.country===country) && (!status || x.status===status);
  });
  count.textContent = filtered.length;
  rows.innerHTML = filtered.map(x => `
    <tr>
      <td>
        <div class="location-name-cell">
          <div class="location-avatar">${esc(x.country)}</div>
          <div><strong>${esc(x.name)}</strong><small>${esc(x.zip)} ${esc(x.city)}</small></div>
        </div>
      </td>
      <td><strong class="table-main">${esc(x.street)}</strong><small>${esc(x.zip)} ${esc(x.city)}</small></td>
      <td><span class="country-pill">${esc(x.country)}</span></td>
      <td><strong class="table-main">${esc(x.contact || "—")}</strong><small>${esc(x.email || x.phone || "Keine Kontaktdaten")}</small></td>
      <td><strong class="table-main">${esc(x.createdAt ? new Date(x.createdAt).toLocaleDateString("de-DE") : "Bestand")}</strong><small>${esc(x.createdBy || "—")}</small></td>
      <td><span class="status-pill ${x.status}">${x.status==="active" ? "Aktiv" : "Inaktiv"}</span></td>
      <td class="row-actions">
        <button class="icon-button" data-edit="${x.id}" title="Bearbeiten">✎</button>
        <button class="icon-button more-button" data-more="${x.id}" title="Weitere Aktionen">•••</button>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="7" class="empty-state">Keine Entladestellen für diesen Filter gefunden.</td></tr>`;
}

function showToast(text){
  const t = document.getElementById("demoToast");
  t.textContent = text; t.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(()=>t.hidden=true, 2600);
}

function openModal(item=null){
  editingId = item?.id ?? null;
  document.getElementById("modalTitle").textContent = item ? "Entladestelle bearbeiten" : "Neue Entladestelle";
  document.getElementById("companyName").value = item?.name ?? "";
  document.getElementById("country").value = item?.country ?? "DE";
  document.getElementById("zip").value = item?.zip ?? "";
  document.getElementById("city").value = item?.city ?? "";
  document.getElementById("street").value = item?.street ?? "";
  document.getElementById("contact").value = item?.contact ?? "";
  document.getElementById("phone").value = item?.phone ?? "";
  document.getElementById("email").value = item?.email ?? "";
  document.getElementById("timeWindow").value = item?.time ?? "";
  document.getElementById("activeState").value = item?.status ?? "active";
  document.getElementById("notes").value = item?.notes ?? "";
  document.getElementById("deleteLocationBtn").hidden = !item;
  renderLocationAudit(item);
  modal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeModal(){
  modal.hidden = true;
  document.body.classList.remove("modal-open");
}

document.getElementById("newLocationBtn").addEventListener("click",()=>openModal());
document.getElementById("closeModalBtn").addEventListener("click",closeModal);
document.getElementById("cancelModalBtn").addEventListener("click",closeModal);


function closeLocationContextMenu(){
  document.getElementById("locationContextMenu")?.remove();
}
function openLocationContextMenu(button,id){
  closeLocationContextMenu();
  const item=locations.find(x=>sameId(x.id,id)); if(!item)return;
  const menu=document.createElement("div");
  menu.id="locationContextMenu"; menu.className="record-context-menu";
  menu.innerHTML=`
    <button type="button" data-action="edit">Bearbeiten</button>
    <button type="button" data-action="toggle">${item.status==="active"?"Deaktivieren":"Aktivieren"}</button>
    <button type="button" class="danger-menu-action" data-action="delete">Löschen</button>`;
  document.body.appendChild(menu);
  const r=button.getBoundingClientRect();
  menu.style.left=Math.max(8,r.right-menu.offsetWidth)+"px";
  menu.style.top=(r.bottom+6)+"px";
  menu.addEventListener("click",ev=>{
    const action=ev.target.closest("[data-action]")?.dataset.action;if(!action)return;
    closeLocationContextMenu();
    if(action==="edit")openModal(item);
    if(action==="toggle"){
      item.status=item.status==="active"?"inactive":"active";
      item.updatedAt=isoNow(); item.updatedBy=currentUserName();
      addLocationAudit(item,item.status==="active"?"Aktiviert":"Deaktiviert");
      GPK.write(GPK.KEYS.locations,locations);render();
      showToast(`Entladestelle ${item.status==="active"?"aktiviert":"deaktiviert"}.`);
    }
    if(action==="delete")deleteLocation(item.id);
  });
}
function deleteLocation(id){
  const item=locations.find(x=>sameId(x.id,id));if(!item)return;
  if(!confirm(`Entladestelle "${item.name}" wirklich löschen? Bestehende Vorgänge bleiben in der Historie erhalten.`))return;
  addLocationAudit(item,"Gelöscht",`${item.country||""} ${item.zip||""} ${item.city||""}`.trim());
  locations=locations.filter(x=>!sameId(x.id,id));
  GPK.write(GPK.KEYS.locations,locations);
  if(sameId(editingId,id))closeModal();
  editingId=null;render();showToast("Entladestelle wurde gelöscht.");
}
rows.addEventListener("click",e=>{
  const edit=e.target.closest("[data-edit]");
  const more=e.target.closest("[data-more]");
  if(edit){const item=locations.find(x=>sameId(x.id,edit.dataset.edit));if(item)openModal(item);return;}
  if(more){openLocationContextMenu(more,more.dataset.more);return;}
});
document.addEventListener("click",e=>{
  if(!e.target.closest("#locationContextMenu")&&!e.target.closest("[data-more]"))closeLocationContextMenu();
});
document.getElementById("deleteLocationBtn").addEventListener("click",()=>deleteLocation(editingId));

form.addEventListener("submit",e=>{
  e.preventDefault();
  const data = {
    name: companyName.value.trim(), country: country.value, zip: zip.value.trim(),
    city: city.value.trim(), street: street.value.trim(), contact: contact.value.trim(),
    phone: phone.value.trim(), email: email.value.trim(), time: timeWindow.value.trim(),
    status: activeState.value, notes: notes.value.trim()
  };
  if(editingId!==null){
    const item=locations.find(x=>sameId(x.id,editingId));
    if(!item){ showToast("Entladestelle konnte nicht gefunden werden."); return; }
    const changed=Object.keys(data).filter(k=>String(item[k]??"")!==String(data[k]??""));
    Object.assign(item,data,{updatedAt:isoNow(),updatedBy:currentUserName()});
    addLocationAudit(item,"Bearbeitet",changed.length?`Geändert: ${changed.join(", ")}`:"Ohne Feldänderung gespeichert");
    showToast("Entladestelle wurde aktualisiert.");
  } else {
    const now=isoNow(), user=currentUserName();
    const item={id:`LOC-${Date.now()}`, ...data, createdAt:now, createdBy:user, updatedAt:now, updatedBy:user, history:[]};
    addLocationAudit(item,"Angelegt",`${item.country} ${item.zip} ${item.city}`);
    locations.unshift(item);
    showToast("Entladestelle wurde angelegt.");
  }
  GPK.write(GPK.KEYS.locations, locations);
  closeModal();
  render();
});

[search,countryFilter,statusFilter].forEach(el=>el.addEventListener("input",render));
document.getElementById("importBtn").addEventListener("click",()=>chooseImportFile(async file=>{
  try{
    await GPKImport.open("locations",file);
    const confirm=document.getElementById("gpkImportConfirmBtn");
    confirm.onclick=()=>{
      const result=GPKImport.confirm();
      locations=GPK.read(GPK.KEYS.locations,[])||[];
      render();
      showToast(result.message);
    };
  }catch(err){showToast("Import fehlgeschlagen: "+err.message);}
}));
document.getElementById("exportBtn").addEventListener("click",async ()=>{
  try{
    await exportWorkbook("GP_Kollund_Entladestellen.xlsx",{
      "Entladestellen":locations.map(x=>({
        "Firmenname":x.name,"Land":x.country,"PLZ":x.zip,"Ort":x.city,"Straße":x.street,
        "Ansprechpartner":x.contact,"E-Mail":x.email,"Telefon":x.phone,"Zeitfenster":x.time,
        "Hinweise":x.notes,"Aktiv":x.status==="active"?"Ja":"Nein",
        "Angelegt am":x.createdAt||"","Angelegt von":x.createdBy||"","Geändert am":x.updatedAt||"","Geändert von":x.updatedBy||""
      }))
    });
    showToast("Entladestellen exportiert.");
  }catch(err){showToast("Export fehlgeschlagen: "+err.message);}
});

ensureLocationMetadata();
render();
