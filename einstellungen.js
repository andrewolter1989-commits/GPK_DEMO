
const tabs=[...document.querySelectorAll(".settings-tab")];
const panels=[...document.querySelectorAll(".settings-panel")];
const toast=document.getElementById("settingsToast");

function showToast(text){
  toast.textContent=text;
  toast.hidden=false;
  clearTimeout(showToast.timer);
  showToast.timer=setTimeout(()=>toast.hidden=true,2400);
}
tabs.forEach(btn=>btn.addEventListener("click",()=>{
  tabs.forEach(x=>x.classList.toggle("active",x===btn));
  panels.forEach(p=>p.classList.toggle("active",p.id===`tab-${btn.dataset.tab}`));
}));
document.getElementById("saveSettingsBtn").addEventListener("click",()=>showToast("Einstellungen wurden in der Layout-Demo übernommen."));
document.getElementById("addUserBtn").addEventListener("click",()=>showToast("Benutzerverwaltung wird beim Login-/Backend-Schritt angebunden."));
document.getElementById("addDomainBtn").addEventListener("click",()=>showToast("Domain-Verwaltung wird beim Hosting-Schritt angebunden."));


function renderDemoDataStatus(){
  const grid=document.getElementById("demoDataGrid");
  if(!grid || !window.GPK) return;
  const s=GPK.demoStorageSummary();
  const rows=[
    ["Entladestellen",s.locations],["Dienstleister",s.providers],["Tarife",s.rates],
    ["Floater-Zeiträume",s.floaters],["Kalkulationen",s.calculations],
    ["Vorgänge",s.operations],["Rechnungsprüfungen",s.invoiceChecks]
  ];
  grid.innerHTML=rows.map(([label,value])=>`<div class="demo-data-item"><span>${label}</span><strong>${value}</strong></div>`).join("");
}
document.addEventListener("DOMContentLoaded",renderDemoDataStatus);


const DATA_AREAS = [
  ["locations","Entladestellen"],
  ["providers","Dienstleister"],
  ["rates","Tarife"],
  ["floaters","Diesel / Floater"],
  ["calculations","Kalkulationen"],
  ["operations","Anfragen & Buchungen"],
  ["invoiceChecks","Rechnungsprüfungen"]
];

function renderAdminAreas(){
  const list=document.getElementById("adminAreaList");
  if(!list || !window.GPK) return;
  const summary=GPK.demoStorageSummary();
  list.innerHTML=DATA_AREAS.map(([key,label])=>`
    <div class="area-row">
      <div><strong>${label}</strong><small>${summary[key] ?? 0} lokal gespeicherte Datensätze</small></div>
      <button class="secondary compact-button area-clear-btn" type="button" data-area="${key}">Bereich leeren</button>
    </div>
  `).join("");
}

function renderImportHistory(){
  const list=document.getElementById("importHistoryList");
  if(!list || !window.GPK) return;
  const history=GPK.getImportHistory();
  if(!history.length){
    list.innerHTML='<div class="empty-admin-state">Noch keine Excel-/CSV-Importe protokolliert.</div>';
    return;
  }
  list.innerHTML=history.slice(0,12).map(x=>{
    const d=new Date(x.createdAt);
    const stamp=isNaN(d)?x.createdAt:d.toLocaleString("de-DE",{dateStyle:"short",timeStyle:"short"});
    return `<div class="import-history-row">
      <div><strong>${x.module || "Import"}</strong><small>${x.fileName || "Datei"} · ${stamp}</small></div>
      <span class="import-count">${Number(x.count)||0} Datensätze</span>
    </div>`;
  }).join("");
}

document.addEventListener("click",e=>{
  const btn=e.target.closest(".area-clear-btn");
  if(!btn) return;
  const area=btn.dataset.area;
  const label=DATA_AREAS.find(x=>x[0]===area)?.[1] || area;
  if(!confirm(`${label} wirklich lokal leeren?`)) return;
  GPK.clearArea(area);
  renderAdminAreas();
  renderDemoDataStatus();
  showToast(`${label} wurde lokal geleert.`);
});

document.getElementById("backupAllBtn")?.addEventListener("click",()=>{
  const stamp=new Date().toISOString().slice(0,10);
  GPK.downloadJSON(`GP_Kollund_Backup_${stamp}.json`,GPK.exportBackup());
  showToast("Lokales Backup wurde erstellt.");
});

document.getElementById("restoreBackupBtn")?.addEventListener("click",()=>restoreBackupInput.click());
document.getElementById("restoreBackupInput")?.addEventListener("change",async ()=>{
  const file=restoreBackupInput.files?.[0];
  if(!file) return;
  try{
    const payload=JSON.parse(await file.text());
    GPK.importBackup(payload);
    renderAdminAreas();
    renderDemoDataStatus();
    renderImportHistory();
    showToast("Backup wurde wiederhergestellt.");
  }catch(err){
    showToast("Backup konnte nicht eingelesen werden: "+err.message);
  } finally {
    restoreBackupInput.value="";
  }
});

document.getElementById("resetAllBtn")?.addEventListener("click",()=>{
  if(!confirm("Wirklich alle lokal gespeicherten Demo-Daten löschen?")) return;
  GPK.resetAllLocalData();
  renderAdminAreas();
  renderDemoDataStatus();
  renderImportHistory();
  showToast("Alle lokalen Daten wurden gelöscht. Beim erneuten Öffnen erscheinen die Demo-Ausgangsdaten.");
});

document.getElementById("refreshImportHistoryBtn")?.addEventListener("click",renderImportHistory);

document.addEventListener("DOMContentLoaded",()=>{
  renderAdminAreas();
  renderImportHistory();
});


document.addEventListener("DOMContentLoaded",async()=>{
  const el=document.getElementById("backendServerState");
  if(!el || !window.GPKApi) return;
  const ok=await GPKApi.health();
  el.textContent=ok?"Online":"Nicht gestartet";
  el.classList.toggle("backend-online",ok);
});

let userAdminData=[], editingUserId=null;
function roleLabel(role){return ({admin:"Admin",dispo:"Disposition",sales:"Vertrieb",controlling:"Controlling"})[role]||role;}
function userInitials(name){return String(name||"U").split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase();}
async function loadUsers(){
  const list=document.getElementById("userAdminList"); if(!list) return;
  try{userAdminData=await GPKApi.users(); renderUsers();}
  catch(_){list.innerHTML='<div class="empty-admin-state">Backend und Admin-Login erforderlich.</div>';}
}
function renderUsers(){
  userAdminList.innerHTML=userAdminData.map(u=>`
    <div class="user-row user-admin-row">
      <div class="user-avatar">${userInitials(u.name)}</div>
      <div class="user-main"><strong>${u.name}</strong><small>${u.email}</small></div>
      <span class="role-pill">${roleLabel(u.role)}</span>
      <span class="status-pill ${u.active?"active":"inactive"}">${u.active?"Aktiv":"Inaktiv"}</span>
      <div class="user-actions">
        <button class="icon-button" data-user-edit="${u.id}">✎</button>
        <button class="icon-button" data-user-password="${u.id}">⌁</button>
        <button class="icon-button" data-user-disable="${u.id}">×</button>
      </div>
    </div>`).join("");
}
function renderPermissionEditor(selected=[]){const g=document.getElementById("userPermissionGrid");if(!g)return;const groups={};GPK.PERMISSION_DEFS.forEach(([k,l,gr])=>(groups[gr]??=[]).push([k,l]));g.innerHTML=Object.entries(groups).map(([gr,items])=>`<div class="permission-group"><strong>${gr}</strong>${items.map(([k,l])=>`<label><input type="checkbox" value="${k}" ${selected.includes(k)?"checked":""}> ${l}</label>`).join("")}</div>`).join("")}
function selectedPermissions(){return userFullAccess.checked?["*"]:[...document.querySelectorAll("#userPermissionGrid input:checked")].map(x=>x.value)}
function openUserModal(u=null){editingUserId=u?.id||null;userModalTitle.textContent=u?"Benutzer bearbeiten":"Benutzer hinzufügen";userName.value=u?.name||"";userEmail.value=u?.email||"";userRole.value=u?.role||"dispo";userActive.value=u?.active?"1":"0";userPassword.value="";userPassword.required=!u;const ps=Array.isArray(u?.permissions)?u.permissions:(GPK.ROLE_TEMPLATES[userRole.value]||[]);userFullAccess.checked=ps.includes("*");renderPermissionEditor(ps.includes("*")?[]:ps);userModal.hidden=false;document.body.classList.add("modal-open")}
function closeUserModal(){userModal.hidden=true;document.body.classList.remove("modal-open");}
addUserBtn?.addEventListener("click",()=>openUserModal());
closeUserModalBtn?.addEventListener("click",closeUserModal);
cancelUserModalBtn?.addEventListener("click",closeUserModal);
userForm?.addEventListener("submit",async e=>{
  e.preventDefault();
  try{
    const data={name:userName.value.trim(),email:userEmail.value.trim(),role:userRole.value,active:userActive.value==="1",permissions:selectedPermissions()};
    if(editingUserId){await GPKApi.updateUser(editingUserId,data);if(userPassword.value)await GPKApi.resetUserPassword(editingUserId,userPassword.value);}
    else{data.password=userPassword.value;await GPKApi.createUser(data);}
    closeUserModal();await loadUsers();showToast("Benutzer gespeichert.");
  }catch(err){showToast(err.message);}
});
userAdminList?.addEventListener("click",async e=>{
  const edit=e.target.closest("[data-user-edit]"), pw=e.target.closest("[data-user-password]"), dis=e.target.closest("[data-user-disable]");
  if(edit){const u=userAdminData.find(x=>x.id===Number(edit.dataset.userEdit));if(u)openUserModal(u);}
  if(pw){const pass=prompt("Neues Passwort (mindestens 6 Zeichen):");if(pass){try{await GPKApi.resetUserPassword(Number(pw.dataset.userPassword),pass);showToast("Passwort geändert.");}catch(err){showToast(err.message);}}}
  if(dis){if(confirm("Benutzer deaktivieren?")){try{await GPKApi.deactivateUser(Number(dis.dataset.userDisable));await loadUsers();showToast("Benutzer deaktiviert.");}catch(err){showToast(err.message);}}}
});
document.addEventListener("gpk:user-ready",e=>{if(e.detail.user?.role==="admin")loadUsers();});

userRole?.addEventListener("change",()=>{const ps=GPK.ROLE_TEMPLATES[userRole.value]||[];userFullAccess.checked=ps.includes("*");renderPermissionEditor(ps.includes("*")?[]:ps)});
async function loadAudit(){if(!auditRows)return;try{const data=await GPKApi.audit();auditCount.textContent=data.length;auditBookingCount.textContent=data.filter(x=>String(x.summary||"").includes("Tour gebucht")).length;auditUserCount.textContent=new Set(data.map(x=>x.user_id).filter(Boolean)).size;auditRows.innerHTML=data.map(x=>`<tr><td>${new Date((x.created_at||"").replace(" ","T")+"Z").toLocaleString("de-DE")}</td><td>${x.user_name||"System"}</td><td>${x.action}</td><td>${x.entity_type}</td><td>${x.entity_id||"—"}</td><td>${x.summary||"—"}</td></tr>`).join("")||'<tr><td colspan="6" class="empty-state">Noch keine Aktivitäten.</td></tr>'}catch(e){auditRows.innerHTML=`<tr><td colspan="6" class="empty-state">${e.message}</td></tr>`}}
refreshAuditBtn?.addEventListener("click",loadAudit);document.addEventListener("gpk:user-ready",e=>{const ps=e.detail.user?.permissions||[];if(ps.includes("*")||ps.includes("audit.view"))loadAudit()});
