
window.GPKApi = window.GPKApi || {};

GPKApi.base = "/api";

GPKApi.request = async function(path, options={}) {
  const headers = Object.assign({"Content-Type":"application/json"}, options.headers || {});
  const res = await fetch(GPKApi.base + path, Object.assign({}, options, {headers, credentials:"same-origin"}));
  if (res.status === 401) {
    if (!location.pathname.endsWith("/login.html") && !location.pathname.endsWith("login.html")) {
      location.href = "login.html";
    }
    throw new Error("Nicht angemeldet");
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
  if (!res.ok) throw new Error((data && data.error) || `API-Fehler ${res.status}`);
  return data;
};

GPKApi.health = async function() {
  try {
    const r = await fetch("/api/health", {credentials:"same-origin"});
    return r.ok;
  } catch (_) {
    return false;
  }
};

GPKApi.me = () => GPKApi.request("/me");
GPKApi.login = (email,password) => GPKApi.request("/login",{method:"POST",body:JSON.stringify({email,password})});
GPKApi.logout = () => GPKApi.request("/logout",{method:"POST",body:"{}"});

GPKApi.guard = async function() {
  if (location.pathname.endsWith("login.html")) return;
  const backend = await GPKApi.health();
  if (!backend) {
    document.documentElement.classList.add("local-demo-mode");
    return;
  }
  try {
    const me = await GPKApi.me();
    window.GPK_CURRENT_USER = me.user;
    window.GPK_CURRENT_COMPANY = me.company;
    document.documentElement.classList.add("backend-mode");
    document.dispatchEvent(new CustomEvent("gpk:user-ready",{detail:me}));
  } catch (_) {}
};

document.addEventListener("DOMContentLoaded", GPKApi.guard);

GPKApi.users=()=>GPKApi.request("/users");
GPKApi.createUser=data=>GPKApi.request("/users",{method:"POST",body:JSON.stringify(data)});
GPKApi.updateUser=(id,data)=>GPKApi.request(`/users/${id}`,{method:"PUT",body:JSON.stringify(data)});
GPKApi.resetUserPassword=(id,password)=>GPKApi.request(`/users/${id}/reset-password`,{method:"POST",body:JSON.stringify({password})});
GPKApi.deactivateUser=id=>GPKApi.request(`/users/${id}`,{method:"DELETE"});

GPKApi.audit=()=>GPKApi.request("/audit");
GPKApi.bookingStats=()=>GPKApi.request("/stats/bookings-by-user");
