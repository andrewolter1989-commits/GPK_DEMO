const defaultProviders = [
  {id:1,name:"LIT",alias:"LIT",status:"active",street:"An der Hochschule 4",zip:"24943",city:"Flensburg",country:"DE",rates:24,floater:"8,5 %",logo:"lit.png",notes:"",contacts:[
    {id:11,name:"Disposition",emails:"booking@lit.example, dispo@lit.example",phone:"+49 000 100100",purposes:["booking","availability"],countries:"DE, BE, NL"},
    {id:12,name:"Anfragen",emails:"rates@lit.example",phone:"+49 000 100110",purposes:["price"],countries:"*"}
  ]},
  {id:2,name:"Transimeksa",alias:"TR",status:"active",street:"",zip:"",city:"Vilnius",country:"LT",rates:18,floater:"7,0 %",logo:"",notes:"",contacts:[{id:21,name:"Sales Desk",emails:"sales@transimeksa.example",phone:"+370 000 200200",purposes:["price","availability","booking"],countries:"BE, NL, DE"}]},
  {id:3,name:"Bertschi",alias:"BE",status:"active",street:"",zip:"",city:"",country:"CH",rates:11,floater:"6,5 %",logo:"",notes:"",contacts:[{id:31,name:"Customer Service",emails:"service@bertschi.example",phone:"+41 000 300300",purposes:["price","availability","booking"],countries:"*"}]},
  {id:4,name:"Duvenbeck",alias:"DU",status:"active",street:"",zip:"",city:"",country:"DE",rates:16,floater:"9,0 %",logo:"",notes:"",contacts:[{id:41,name:"Disposition",emails:"dispo@duvenbeck.example",phone:"+49 000 400400",purposes:["booking","availability"],countries:"DE, NL"}]},
  {id:5,name:"Dachser",alias:"DA",status:"active",street:"",zip:"",city:"",country:"DE",rates:9,floater:"8,0 %",logo:"",notes:"",contacts:[{id:51,name:"Road Logistics",emails:"road@dachser.example",phone:"+49 000 500500",purposes:["booking","availability","price"],countries:"FR, DE"}]},
  {id:6,name:"Kuehne + Nagel",alias:"KN",status:"inactive",street:"",zip:"",city:"",country:"DE",rates:0,floater:"",logo:"",notes:"",contacts:[]},
  {id:7,name:"Raben",alias:"RA",status:"active",street:"",zip:"",city:"",country:"DE",rates:12,floater:"7,5 %",logo:"",notes:"",contacts:[{id:71,name:"Disposition",emails:"dispo@raben.example",phone:"+49 000 700700",purposes:["booking","availability"],countries:"DE"}]},
  {id:8,name:"DSV",alias:"DS",status:"active",street:"",zip:"",city:"",country:"DK",rates:14,floater:"8,2 %",logo:"",notes:"",contacts:[{id:81,name:"Road",emails:"road@dsv.example",phone:"+45 000 800800",purposes:["booking","availability","price"],countries:"*"}]}
];
let providers=GPK.read(GPK.KEYS.providers,null); if(!Array.isArray(providers)||!providers.length) providers=defaultProviders;
providers=providers.map(p=>({...p,contacts:Array.isArray(p.contacts)?p.contacts:(p.contact||p.email||p.phone?[{id:Date.now()+Math.random(),name:p.contact||"",emails:p.email||"",phone:p.phone||"",purposes:["booking","availability","price"],countries:"*"}]:[])}));
let editingId=null;
const rows=document.getElementById("providerRows"),search=document.getElementById("providerSearch"),statusFilter=document.getElementById("providerStatusFilter"),rateFilter=document.getElementById("providerRateFilter"),modal=document.getElementById("providerModal"),form=document.getElementById("providerForm");
function esc(v=""){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
function initials(p){return(p.alias||p.name.split(/\s+/).map(x=>x[0]).join("").slice(0,2)).toUpperCase();}
function primaryContact(p){return (p.contacts||[])[0]||{};}
function providerTariffCountries(providerName){
  const rates=GPK.read(GPK.KEYS.rates,[])||[];
  return [...new Set(rates.filter(r=>r.provider===providerName && r.country).map(r=>String(r.country).toUpperCase()))].sort();
}
function providerRateCount(providerName){
  return (GPK.read(GPK.KEYS.rates,[])||[]).filter(r=>r.provider===providerName).length;
}
function providerLogoSrc(p){
  const logo=String(p.logo||"").trim();
  if(!logo)return "";
  if(logo.startsWith("data:")||logo.startsWith("blob:"))return logo;
  return logo.includes("/")?logo:`logos/${logo}`;
}
function providerAvatarMarkup(p){
  const src=providerLogoSrc(p);
  return src
    ? `<div class="provider-avatar provider-avatar-logo"><img src="${esc(src)}" alt="${esc(p.name)} Logo" onerror="this.parentElement.classList.remove('provider-avatar-logo');this.remove();this.parentElement.textContent='${esc(initials(p))}'"></div>`
    : `<div class="provider-avatar">${esc(initials(p))}</div>`;
}
function updateProviderLogoPreview(value){
  const box=document.getElementById("providerLogoPreview");if(!box)return;
  const src=String(value||"").trim();
  box.innerHTML=src?`<img src="${esc(src.startsWith("data:")||src.includes("/")?src:`logos/${src}`)}" alt="Logo Vorschau">`:"<span>Logo</span>";
}
function countryOptionsForContact(providerName,selectedRaw="*"){
  const countries=providerTariffCountries(providerName);
  const selected=String(selectedRaw||"*").split(",").map(x=>x.trim().toUpperCase()).filter(Boolean);
  if(!countries.length){
    return `<div class="tariff-country-empty">Noch keine Tarif-Länder hinterlegt. Länder werden automatisch angezeigt, sobald Tarife vorhanden sind.</div>
      <input type="hidden" data-contact-field="countries" value="${esc(selectedRaw||"*")}">`;
  }
  const all=selected.includes("*");
  return `<div class="contact-country-routing">
    <label class="country-option country-option-all"><input type="checkbox" data-country-all ${all?"checked":""}> Alle Tarifländer</label>
    <div class="country-option-grid">
      ${countries.map(c=>`<label class="country-option"><input type="checkbox" data-country="${esc(c)}" ${all||selected.includes(c)?"checked":""}> ${esc(c)}</label>`).join("")}
    </div>
    <small>Verfügbare Länder kommen automatisch aus den Tarifen von ${esc(providerName||"diesem Dienstleister")}.</small>
  </div>`;
}

function render(){
  providers.forEach(p=>{p.rates=providerRateCount(p.name);});
  const q=search.value.trim().toLowerCase(),status=statusFilter.value,rf=rateFilter.value;
  const filtered=providers.filter(p=>{
    const contacts=(p.contacts||[]).map(c=>`${c.name} ${c.emails} ${c.phone} ${c.countries}`).join(" ");
    const tariffCountries=providerTariffCountries(p.name).join(" ");
    const hay=`${p.name} ${p.alias} ${p.city||""} ${p.country||""} ${contacts} ${tariffCountries}`.toLowerCase();
    const rateOK=!rf||(rf==="with"?p.rates>0:p.rates===0);
    return(!q||hay.includes(q))&&(!status||p.status===status)&&rateOK
  });
  providerCount.textContent=filtered.length;
  activeProviderCount.textContent=filtered.filter(p=>p.status==="active").length;
  ratedProviderCount.textContent=filtered.filter(p=>p.rates>0).length;
  missingMailCount.textContent=filtered.filter(p=>!(p.contacts||[]).some(c=>String(c.emails||"").trim())).length;
  visibleProviderCount.textContent=filtered.length;
  rows.innerHTML=filtered.map(p=>{
    const c=primaryContact(p);
    const countries=providerTariffCountries(p.name);
    return `<tr>
      <td><div class="provider-name-cell">${providerAvatarMarkup(p)}<div><strong>${esc(p.name)}</strong><small>${esc(p.alias||"Kein Alias")} · ${esc(p.country||"—")} ${esc(p.city||"")}</small></div></div></td>
      <td><strong class="table-main">${esc(c.name||"—")}</strong><small>${esc(c.emails||c.phone||"Keine Kontaktdaten")}${(p.contacts||[]).length>1?` · +${p.contacts.length-1} weitere`:""}</small>${countries.length?`<small class="provider-tariff-countries">Tarif-Länder: ${countries.map(esc).join(", ")}</small>`:""}</td>
      <td><strong class="provider-number">${p.rates}</strong><a class="inline-add-link" href="tarife.html?provider=${encodeURIComponent(p.name)}&new=1">+ Tarif hinzufügen</a></td>
      <td><span class="floater-pill">${esc(p.floater||"—")}</span></td>
      <td><span class="status-pill ${p.status}">${p.status==="active"?"Aktiv":"Inaktiv"}</span></td>
      <td class="row-actions"><button class="icon-button" data-edit="${p.id}" title="Bearbeiten">✎</button><button class="icon-button more-button" data-provider-more="${p.id}" title="Weitere Aktionen">•••</button></td>
    </tr>`
  }).join("")||`<tr><td colspan="6" class="empty-state">Keine Dienstleister für diesen Filter gefunden.</td></tr>`;
}
function toast(text){providerToast.textContent=text;providerToast.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>providerToast.hidden=true,2400)}
function contactRow(c={}){
  const id=c.id||Date.now()+Math.floor(Math.random()*9999),ps=c.purposes||[];
  const currentProviderName=document.getElementById("providerName")?.value?.trim()||providers.find(x=>x.id===editingId)?.name||"";
  return `<div class="provider-contact-card" data-contact-id="${id}">
    <div class="provider-contact-top"><strong>Ansprechpartner</strong><button class="icon-button remove-provider-contact" type="button" title="Entfernen">×</button></div>
    <div class="location-form-grid">
      <div class="field"><label>Name / Funktion</label><input data-contact-field="name" value="${esc(c.name||"")}" placeholder="z. B. Disposition"></div>
      <div class="field"><label>Telefon</label><input data-contact-field="phone" value="${esc(c.phone||"")}" placeholder="+49 ..."></div>
      <div class="field span-2"><label>E-Mail-Adresse(n)</label><input data-contact-field="emails" value="${esc(c.emails||"")}" placeholder="booking@..., dispo@..."><span class="field-hint">Mehrere Adressen durch Komma trennen.</span></div>
      <div class="field span-2"><label>Für welche Tarif-Länder?</label>${countryOptionsForContact(currentProviderName,c.countries||"*")}</div>
      <div class="field span-2"><label>Verwendung</label><div class="contact-purpose-list">
        <label><input type="checkbox" data-purpose="booking" ${ps.includes("booking")?"checked":""}> Buchungen</label>
        <label><input type="checkbox" data-purpose="availability" ${ps.includes("availability")?"checked":""}> Verfügbarkeitsanfragen</label>
        <label><input type="checkbox" data-purpose="price" ${ps.includes("price")?"checked":""}> Preisanfragen</label>
      </div></div>
    </div>
  </div>`;
}
function renderContacts(list=[]){providerContacts.innerHTML=(list.length?list:[{}]).map(contactRow).join("");}
function collectContacts(){
  return [...providerContacts.querySelectorAll(".provider-contact-card")].map(card=>{
    const all=card.querySelector("[data-country-all]")?.checked;
    const selected=[...card.querySelectorAll("[data-country]:checked")].map(x=>x.dataset.country);
    const hidden=card.querySelector('[data-contact-field="countries"]');
    return {
      id:Number(card.dataset.contactId)||Date.now(),
      name:card.querySelector('[data-contact-field="name"]').value.trim(),
      phone:card.querySelector('[data-contact-field="phone"]').value.trim(),
      emails:card.querySelector('[data-contact-field="emails"]').value.trim(),
      countries:all?"*":(selected.join(", ")||(hidden?.value||"*")),
      purposes:[...card.querySelectorAll('[data-purpose]:checked')].map(x=>x.dataset.purpose)
    };
  }).filter(c=>c.name||c.emails||c.phone);
}
function openModal(p=null){editingId=p?.id??null;providerModalTitle.textContent=p?"Dienstleister bearbeiten":"Neuer Dienstleister";providerName.value=p?.name??"";providerAlias.value=p?.alias??"";providerStatus.value=p?.status??"active";providerStreet.value=p?.street??"";providerZip.value=p?.zip??"";providerCity.value=p?.city??"";providerCountry.value=p?.country??"DE";providerLogo.value=p?.logo??"";updateProviderLogoPreview(providerLogo.value);providerNotes.value=p?.notes??"";renderContacts(p?.contacts||[]);deleteProviderBtn.hidden=!p;modal.hidden=false;document.body.classList.add("modal-open");}
function closeModal(){modal.hidden=true;document.body.classList.remove("modal-open")}
newProviderBtn.addEventListener("click",()=>openModal());closeProviderModalBtn.addEventListener("click",closeModal);cancelProviderModalBtn.addEventListener("click",closeModal);modal.addEventListener("click",e=>{if(e.target===modal)closeModal()});addProviderContactBtn.addEventListener("click",()=>providerContacts.insertAdjacentHTML("beforeend",contactRow({})));providerContacts.addEventListener("click",e=>{const b=e.target.closest(".remove-provider-contact");if(b&&providerContacts.children.length>1)b.closest(".provider-contact-card").remove();});function closeProviderContextMenu(){document.getElementById("providerContextMenu")?.remove();}
function deleteProvider(id){
  const p=providers.find(x=>x.id===Number(id));if(!p)return;
  const rates=GPK.read(GPK.KEYS.rates,[])||[];
  const floaters=GPK.read(GPK.KEYS.floaters,[])||[];
  const relatedRates=rates.filter(r=>r.provider===p.name).length;
  const relatedFloaters=floaters.filter(f=>f.provider===p.name).length;
  const extra=(relatedRates||relatedFloaters)?`\n\nDabei werden auch ${relatedRates} zugehörige Tarife und ${relatedFloaters} Floater-Zeiträume entfernt.`:"";
  if(!confirm(`Dienstleister "${p.name}" wirklich löschen?${extra}`))return;
  providers=providers.filter(x=>x.id!==Number(id));
  if(relatedRates)GPK.write(GPK.KEYS.rates,rates.filter(r=>r.provider!==p.name));
  if(relatedFloaters)GPK.write(GPK.KEYS.floaters,floaters.filter(f=>f.provider!==p.name));
  GPK.write(GPK.KEYS.providers,providers);
  if(editingId===Number(id))closeModal();
  editingId=null;render();toast("Dienstleister wurde gelöscht.");
}
function openProviderContextMenu(button,id){
  closeProviderContextMenu();
  const p=providers.find(x=>x.id===Number(id));if(!p)return;
  const menu=document.createElement("div");menu.id="providerContextMenu";menu.className="record-context-menu";
  menu.innerHTML=`<button type="button" data-action="edit">Bearbeiten</button><button type="button" data-action="toggle">${p.status==="active"?"Deaktivieren":"Aktivieren"}</button><button type="button" class="danger-menu-action" data-action="delete">Löschen</button>`;
  document.body.appendChild(menu);
  const r=button.getBoundingClientRect();menu.style.left=Math.max(8,r.right-menu.offsetWidth)+"px";menu.style.top=(r.bottom+6)+"px";
  menu.addEventListener("click",ev=>{
    const action=ev.target.closest("[data-action]")?.dataset.action;if(!action)return;closeProviderContextMenu();
    if(action==="edit")openModal(p);
    if(action==="toggle"){p.status=p.status==="active"?"inactive":"active";GPK.write(GPK.KEYS.providers,providers);render();toast(`Dienstleister ${p.status==="active"?"aktiviert":"deaktiviert"}.`);}
    if(action==="delete")deleteProvider(p.id);
  });
}
rows.addEventListener("click",e=>{
  const edit=e.target.closest("[data-edit]"),more=e.target.closest("[data-provider-more]");
  if(edit){const p=providers.find(x=>x.id===Number(edit.dataset.edit));if(p)openModal(p);return;}
  if(more){openProviderContextMenu(more,more.dataset.providerMore);return;}
});
document.addEventListener("click",e=>{if(!e.target.closest("#providerContextMenu")&&!e.target.closest("[data-provider-more]"))closeProviderContextMenu();});
deleteProviderBtn.addEventListener("click",()=>deleteProvider(editingId));

providerContacts.addEventListener("change",e=>{
  const all=e.target.closest("[data-country-all]");
  if(all){
    all.closest(".contact-country-routing")?.querySelectorAll("[data-country]").forEach(cb=>{cb.checked=all.checked;cb.disabled=all.checked;});
  }
});
chooseProviderLogoBtn.addEventListener("click",()=>providerLogoFile.click());
providerLogoFile.addEventListener("change",()=>{
  const file=providerLogoFile.files?.[0];if(!file)return;
  if(file.size>2*1024*1024){toast("Logo ist zu groß. Maximal 2 MB.");providerLogoFile.value="";return;}
  const reader=new FileReader();
  reader.onload=()=>{providerLogo.value=String(reader.result||"");updateProviderLogoPreview(providerLogo.value);};
  reader.readAsDataURL(file);
});
removeProviderLogoBtn.addEventListener("click",()=>{providerLogo.value="";providerLogoFile.value="";updateProviderLogoPreview("");});
providerName.addEventListener("change",()=>renderContacts(collectContacts()));
form.addEventListener("submit",e=>{e.preventDefault();const contacts=collectContacts();const data={name:providerName.value.trim(),alias:providerAlias.value.trim(),status:providerStatus.value,street:providerStreet.value.trim(),zip:providerZip.value.trim(),city:providerCity.value.trim(),country:providerCountry.value.trim().toUpperCase(),logo:providerLogo.value.trim(),notes:providerNotes.value.trim(),contacts,contact:contacts[0]?.name||"",phone:contacts[0]?.phone||"",email:contacts[0]?.emails?.split(",")[0]?.trim()||""};if(editingId){Object.assign(providers.find(x=>x.id===editingId),data);toast("Dienstleister aktualisiert.")}else{providers.unshift({id:Date.now(),rates:0,floater:"",...data});toast("Dienstleister angelegt.")}GPK.write(GPK.KEYS.providers,providers);closeModal();render();});
[search,statusFilter,rateFilter].forEach(x=>x.addEventListener("input",render));
importProvidersBtn.addEventListener("click",()=>chooseImportFile(async file=>{try{await GPKImport.open("providers",file);gpkImportConfirmBtn.onclick=()=>{const result=GPKImport.confirm();providers=(GPK.read(GPK.KEYS.providers,[])||[]).map(p=>({...p,contacts:p.contacts||[]}));render();toast(result.message);};}catch(err){toast("Import fehlgeschlagen: "+err.message);}}));
exportProvidersBtn.addEventListener("click",async()=>{try{await exportWorkbook("GP_Kollund_Dienstleister.xlsx",{"Dienstleister":providers.map(x=>({"Dienstleister":x.name,"Alias":x.alias,"Straße":x.street||"","PLZ":x.zip||"","Ort":x.city||"","Land":x.country||"","Ansprechpartner":primaryContact(x).name||"","E-Mail":primaryContact(x).emails||"","Telefon":primaryContact(x).phone||"","Anzahl Kontakte":(x.contacts||[]).length,"Anzahl Tarife":x.rates,"Floater":x.floater,"Aktiv":x.status==="active"?"Ja":"Nein","Logo":x.logo,"Hinweise":x.notes}))});toast("Dienstleister exportiert.")}catch(err){toast("Export fehlgeschlagen: "+err.message);}});render();