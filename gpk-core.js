
window.GPK = window.GPK || {};

GPK.VERSION = "6.3";

GPK.KEYS = Object.freeze({
  locations: "gpk_demo_locations_v1",
  providers: "gpk_demo_providers_v1",
  rates: "gpk_demo_rates_v1",
  floaters: "gpk_demo_floaters_v1",
  calculations: "gpk_demo_calculations_v1",
  operations: "gpk_demo_operations_v1",
  invoiceChecks: "gpk_demo_invoice_checks_v1",
  settings: "gpk_demo_settings_v1"
});

GPK.read = function(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const value = JSON.parse(raw);
    return value ?? fallback;
  } catch (_) {
    return fallback;
  }
};

GPK.write = function(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    document.dispatchEvent(new CustomEvent("gpk:local-write",{detail:{key,value}}));
    return true;
  } catch (_) {
    return false;
  }
};

GPK.remove = function(key) {
  try { localStorage.removeItem(key); } catch (_) {}
};

GPK.dedupe = function(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = String(keyFn(item) ?? "").trim().toLowerCase();
    if (!key) continue;
    if (!map.has(key)) map.set(key, item);
  }
  return [...map.values()];
};

GPK.formatEuro = function(value, digits = 0) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: digits
  }).format(Number(value) || 0);
};

GPK.demoStorageSummary = function() {
  return {
    locations: (GPK.read(GPK.KEYS.locations, []) || []).length,
    providers: (GPK.read(GPK.KEYS.providers, []) || []).length,
    rates: (GPK.read(GPK.KEYS.rates, []) || []).length,
    floaters: (GPK.read(GPK.KEYS.floaters, []) || []).length,
    calculations: (GPK.read(GPK.KEYS.calculations, []) || []).length,
    operations: (GPK.read(GPK.KEYS.operations, []) || []).length,
    invoiceChecks: (GPK.read(GPK.KEYS.invoiceChecks, []) || []).length
  };
};

GPK.setActiveNavigation = function() {
  const current = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  document.querySelectorAll(".side-nav a.nav-item").forEach(a => {
    const href = (a.getAttribute("href") || "").toLowerCase();
    a.classList.toggle("active", href === current);
  });
};

GPK.installDemoBadge = function() {
  const footer = document.querySelector(".sidebar-foot");
  if (!footer) return;
  footer.innerHTML = '<span class="status-dot"></span> Prototype v6.3 <span class="sidebar-demo-label">· Lokal</span>';
};

document.addEventListener("DOMContentLoaded", () => {
  GPK.setActiveNavigation();
  GPK.installDemoBadge();
});


GPK.exportBackup = function() {
  const payload = {
    app: "GP Kollund Prototype",
    version: GPK.VERSION,
    exportedAt: new Date().toISOString(),
    data: {}
  };
  Object.entries(GPK.KEYS).forEach(([name, key]) => {
    payload.data[name] = GPK.read(key, []);
  });
  return payload;
};

GPK.importBackup = function(payload) {
  if (!payload || typeof payload !== "object" || !payload.data) {
    throw new Error("Ungültige Backup-Datei.");
  }
  Object.entries(GPK.KEYS).forEach(([name, key]) => {
    if (payload.data[name] !== undefined) {
      GPK.write(key, payload.data[name]);
    }
  });
  return true;
};

GPK.clearArea = function(area) {
  const key = GPK.KEYS[area];
  if (!key) throw new Error("Unbekannter Datenbereich.");
  GPK.remove(key);
};

GPK.resetAllLocalData = function() {
  Object.values(GPK.KEYS).forEach(key => GPK.remove(key));
};

GPK.downloadJSON = function(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], {type:"application/json;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
};

GPK.logImport = function(entry) {
  const key = "gpk_demo_import_history_v1";
  const list = GPK.read(key, []);
  list.unshift({
    id: Date.now(),
    createdAt: new Date().toISOString(),
    ...entry
  });
  GPK.write(key, list.slice(0,100));
};

GPK.getImportHistory = function() {
  return GPK.read("gpk_demo_import_history_v1", []);
};


GPK.installUserPanel = function(){
  const sidebar=document.querySelector(".sidebar");
  if(!sidebar || document.querySelector(".sidebar-user")) return;
  const panel=document.createElement("div");
  panel.className="sidebar-user";
  panel.innerHTML='<div class="sidebar-user-avatar">DA</div><div class="sidebar-user-copy"><strong>Lokale Demo</strong><small>ohne Backend</small></div>';
  const foot=sidebar.querySelector(".sidebar-foot");
  sidebar.insertBefore(panel,foot);
};

document.addEventListener("DOMContentLoaded",GPK.installUserPanel);
document.addEventListener("gpk:user-ready",e=>{
  const panel=document.querySelector(".sidebar-user");
  if(!panel) return;
  const user=e.detail.user, company=e.detail.company;
  const initials=(user.name||"U").split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase();
  panel.innerHTML=`<div class="sidebar-user-avatar">${initials}</div><div class="sidebar-user-copy"><strong>${user.name}</strong><small>${company.name} · ${user.role}</small></div><button class="sidebar-logout" id="sidebarLogoutBtn" type="button" title="Abmelden">↪</button>`;
  document.getElementById("sidebarLogoutBtn")?.addEventListener("click",async()=>{
    try{await GPKApi.logout();}catch(_){}
    location.href="login.html";
  });
});




GPK.PERMISSION_DEFS=[
["calc.view","Kalkulation ansehen","Kalkulation"],["calc.create","Kalkulation durchführen","Kalkulation"],
["operations.view","Vorgänge ansehen","Anfragen & Buchungen"],["operations.create","Tour / Anfrage anlegen","Anfragen & Buchungen"],["operations.edit","Tour / Anfrage ändern","Anfragen & Buchungen"],
["locations.view","Entladestellen ansehen","Stammdaten"],["locations.edit","Entladestellen verwalten","Stammdaten"],
["providers.view","Dienstleister ansehen","Stammdaten"],["providers.edit","Dienstleister verwalten","Stammdaten"],
["rates.view","Tarife ansehen","Tarife"],["rates.edit","Tarife verwalten","Tarife"],["floaters.edit","Diesel / Floater verwalten","Tarife"],
["dashboard.view","Auswertungen ansehen","Auswertungen"],["invoice.view","Rechnungsprüfung ansehen","Rechnungsprüfung"],["invoice.create","Rechnungsprüfung durchführen","Rechnungsprüfung"],
["settings.view","Einstellungen ansehen","Administration"],["users.manage","Benutzer & Rechte verwalten","Administration"],["audit.view","Aktivitätslog ansehen","Administration"]];
GPK.ROLE_TEMPLATES={admin:["*"],dispo:["calc.view","calc.create","operations.view","operations.create","operations.edit","locations.view","locations.edit","providers.view","rates.view","dashboard.view"],sales:["calc.view","calc.create","operations.view","operations.create","locations.view","providers.view","dashboard.view"],controlling:["providers.view","rates.view","dashboard.view","invoice.view","invoice.create"]};
GPK.permissionForHref=h=>({"index.html":"calc.view","vorgaenge.html":"operations.view","entladestellen.html":"locations.view","dienstleister.html":"providers.view","tarife.html":"rates.view","dashboard.html":"dashboard.view","rechnungspruefung.html":"invoice.view","einstellungen.html":"settings.view"})[h]||null;
GPK.hasPermission=p=>{const u=window.GPK_CURRENT_USER;if(!u)return true;const a=Array.isArray(u.permissions)?u.permissions:[];return a.includes("*")||a.includes(p)};
GPK.applyPermissions=()=>{if(!window.GPK_CURRENT_USER)return;document.querySelectorAll('.side-nav a.nav-item').forEach(a=>{const p=GPK.permissionForHref((a.getAttribute('href')||'').split('/').pop());if(p&&!GPK.hasPermission(p))a.classList.add('permission-hidden')});document.querySelectorAll('[data-permission]').forEach(e=>{if(!GPK.hasPermission(e.dataset.permission))e.classList.add('permission-hidden')})};
document.addEventListener('gpk:user-ready',GPK.applyPermissions);
