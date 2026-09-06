
const defaultProviders = [
  {id:1,name:"LIT",alias:"LIT",contact:"Disposition",email:"dispo@lit.example",phone:"+49 000 100100",rates:24,floater:"8,5 %",status:"active",logo:"lit.png",notes:""},
  {id:2,name:"Transimeksa",alias:"TR",contact:"Sales Desk",email:"sales@transimeksa.example",phone:"+370 000 200200",rates:18,floater:"7,0 %",status:"active",logo:"",notes:""},
  {id:3,name:"Bertschi",alias:"BE",contact:"Customer Service",email:"service@bertschi.example",phone:"+41 000 300300",rates:11,floater:"6,5 %",status:"active",logo:"",notes:""},
  {id:4,name:"Duvenbeck",alias:"DU",contact:"Disposition",email:"dispo@duvenbeck.example",phone:"+49 000 400400",rates:16,floater:"9,0 %",status:"active",logo:"",notes:""},
  {id:5,name:"Dachser",alias:"DA",contact:"Road Logistics",email:"road@dachser.example",phone:"+49 000 500500",rates:9,floater:"8,0 %",status:"active",logo:"",notes:""},
  {id:6,name:"Kuehne + Nagel",alias:"KN",contact:"",email:"",phone:"",rates:0,floater:"",status:"inactive",logo:"",notes:""},
  {id:7,name:"Raben",alias:"RA",contact:"Disposition",email:"dispo@raben.example",phone:"+49 000 700700",rates:12,floater:"7,5 %",status:"active",logo:"",notes:""},
  {id:8,name:"DSV",alias:"DS",contact:"Road",email:"road@dsv.example",phone:"+45 000 800800",rates:14,floater:"8,2 %",status:"active",logo:"",notes:""}
];
let providers = GPK.read(GPK.KEYS.providers, null) || defaultProviders;
let editingId = null;

const rows = document.getElementById("providerRows");
const search = document.getElementById("providerSearch");
const statusFilter = document.getElementById("providerStatusFilter");
const rateFilter = document.getElementById("providerRateFilter");
const modal = document.getElementById("providerModal");
const form = document.getElementById("providerForm");

function esc(v=""){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
function initials(p){
  return (p.alias || p.name.split(/\s+/).map(x=>x[0]).join("").slice(0,2)).toUpperCase();
}
function render(){
  const q = search.value.trim().toLowerCase();
  const status = statusFilter.value;
  const rf = rateFilter.value;
  const filtered = providers.filter(p=>{
    const hay = `${p.name} ${p.alias} ${p.contact} ${p.email}`.toLowerCase();
    const rateOK = !rf || (rf==="with" ? p.rates>0 : p.rates===0);
    return (!q || hay.includes(q)) && (!status || p.status===status) && rateOK;
  });
  document.getElementById("providerCount").textContent = providers.length;
  document.getElementById("activeProviderCount").textContent = providers.filter(p=>p.status==="active").length;
  document.getElementById("ratedProviderCount").textContent = providers.filter(p=>p.rates>0).length;
  document.getElementById("missingMailCount").textContent = providers.filter(p=>!p.email).length;
  document.getElementById("visibleProviderCount").textContent = filtered.length;

  rows.innerHTML = filtered.map(p=>`
    <tr>
      <td>
        <div class="provider-name-cell">
          <div class="provider-avatar">${esc(initials(p))}</div>
          <div><strong>${esc(p.name)}</strong><small>${esc(p.alias || "Kein Alias")}</small></div>
        </div>
      </td>
      <td><strong class="table-main">${esc(p.contact || "—")}</strong><small>${esc(p.email || p.phone || "Keine Kontaktdaten")}</small></td>
      <td><strong class="provider-number">${p.rates}</strong><small>${p.rates===1 ? "Tarif" : "Tarife"} hinterlegt</small></td>
      <td><span class="floater-pill">${esc(p.floater || "—")}</span></td>
      <td><span class="status-pill ${p.status}">${p.status==="active" ? "Aktiv" : "Inaktiv"}</span></td>
      <td class="row-actions">
        <button class="icon-button" data-edit="${p.id}" title="Bearbeiten">✎</button>
        <button class="icon-button more-button" title="Weitere Aktionen">•••</button>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="6" class="empty-state">Keine Dienstleister für diesen Filter gefunden.</td></tr>`;
}
function toast(text){
  const t=document.getElementById("providerToast");
  t.textContent=text;t.hidden=false;
  clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.hidden=true,2400);
}
function openModal(p=null){
  editingId=p?.id??null;
  providerModalTitle.textContent=p?"Dienstleister bearbeiten":"Neuer Dienstleister";
  providerName.value=p?.name??"";
  providerAlias.value=p?.alias??"";
  providerStatus.value=p?.status??"active";
  providerContact.value=p?.contact??"";
  providerPhone.value=p?.phone??"";
  providerEmail.value=p?.email??"";
  providerRates.value=p?.rates??0;
  providerFloater.value=p?.floater??"";
  providerLogo.value=p?.logo??"";
  providerNotes.value=p?.notes??"";
  modal.hidden=false;document.body.classList.add("modal-open");
}
function closeModal(){modal.hidden=true;document.body.classList.remove("modal-open");}
newProviderBtn.addEventListener("click",()=>openModal());
closeProviderModalBtn.addEventListener("click",closeModal);
cancelProviderModalBtn.addEventListener("click",closeModal);
modal.addEventListener("click",e=>{if(e.target===modal)closeModal();});
rows.addEventListener("click",e=>{
  const btn=e.target.closest("[data-edit]");if(!btn)return;
  const p=providers.find(x=>x.id===Number(btn.dataset.edit));if(p)openModal(p);
});
form.addEventListener("submit",e=>{
  e.preventDefault();
  const data={
    name:providerName.value.trim(),alias:providerAlias.value.trim(),status:providerStatus.value,
    contact:providerContact.value.trim(),phone:providerPhone.value.trim(),email:providerEmail.value.trim(),
    rates:Number(providerRates.value||0),floater:providerFloater.value.trim(),
    logo:providerLogo.value.trim(),notes:providerNotes.value.trim()
  };
  if(editingId){Object.assign(providers.find(x=>x.id===editingId),data);toast("Dienstleister wurde in der Layout-Demo aktualisiert.");}
  else{providers.unshift({id:Date.now(),...data});toast("Dienstleister wurde in der Layout-Demo angelegt.");}
  GPK.write(GPK.KEYS.providers,providers);
  closeModal();render();
});
[search,statusFilter,rateFilter].forEach(x=>x.addEventListener("input",render));
importProvidersBtn.addEventListener("click",()=>chooseImportFile(async file=>{
  try{
    await GPKImport.open("providers",file);
    gpkImportConfirmBtn.onclick=()=>{
      const result=GPKImport.confirm();
      providers=GPK.read(GPK.KEYS.providers,[])||[];
      render();
      toast(result.message);
    };
  }catch(err){toast("Import fehlgeschlagen: "+err.message);}
}));
exportProvidersBtn.addEventListener("click",async ()=>{
  try{
    await exportWorkbook("GP_Kollund_Dienstleister.xlsx",{
      "Dienstleister":providers.map(x=>({
        "Dienstleister":x.name,"Alias":x.alias,"Ansprechpartner":x.contact,"E-Mail":x.email,
        "Telefon":x.phone,"Anzahl Tarife":x.rates,"Floater":x.floater,"Aktiv":x.status==="active"?"Ja":"Nein",
        "Logo":x.logo,"Hinweise":x.notes
      }))
    });
    toast("Dienstleister exportiert.");
  }catch(err){toast("Export fehlgeschlagen: "+err.message);}
});
render();
