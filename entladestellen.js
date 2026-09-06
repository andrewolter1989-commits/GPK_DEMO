
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
      <td><span class="status-pill ${x.status}">${x.status==="active" ? "Aktiv" : "Inaktiv"}</span></td>
      <td class="row-actions">
        <button class="icon-button" data-edit="${x.id}" title="Bearbeiten">✎</button>
        <button class="icon-button more-button" title="Weitere Aktionen">•••</button>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="6" class="empty-state">Keine Entladestellen für diesen Filter gefunden.</td></tr>`;
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
modal.addEventListener("click",e=>{if(e.target===modal)closeModal();});

rows.addEventListener("click",e=>{
  const btn = e.target.closest("[data-edit]");
  if(!btn) return;
  const item = locations.find(x=>x.id===Number(btn.dataset.edit));
  if(item) openModal(item);
});

form.addEventListener("submit",e=>{
  e.preventDefault();
  const data = {
    name: companyName.value.trim(), country: country.value, zip: zip.value.trim(),
    city: city.value.trim(), street: street.value.trim(), contact: contact.value.trim(),
    phone: phone.value.trim(), email: email.value.trim(), time: timeWindow.value.trim(),
    status: activeState.value, notes: notes.value.trim()
  };
  if(editingId){
    Object.assign(locations.find(x=>x.id===editingId), data);
    showToast("Entladestelle wurde in der Layout-Demo aktualisiert.");
  } else {
    locations.unshift({id:Date.now(), ...data});
    showToast("Entladestelle wurde in der Layout-Demo angelegt.");
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
        "Hinweise":x.notes,"Aktiv":x.status==="active"?"Ja":"Nein"
      }))
    });
    showToast("Entladestellen exportiert.");
  }catch(err){showToast("Export fehlgeschlagen: "+err.message);}
});

render();
