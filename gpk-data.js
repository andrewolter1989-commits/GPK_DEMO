
window.GPKData = window.GPKData || {};
GPKData.backendOnline = false;
GPKData.suppressSync = false;
GPKData.syncTimers = {};

GPKData.keyToResource = function(key){
  const K=GPK.KEYS;
  return ({
    [K.locations]:"locations",
    [K.providers]:"providers",
    [K.rates]:"rates",
    [K.floaters]:"floaters",
    [K.calculations]:"calculations",
    [K.operations]:"operations",
    [K.invoiceChecks]:"invoiceChecks"
  })[key] || null;
};

GPKData.normalizeFromServer = function(resource, rows){
  if(!Array.isArray(rows)) return [];
  if(resource==="locations") return rows.map(r=>({
    id:r.id,name:r.name,country:r.country,zip:r.zip,city:r.city,street:r.street||"",
    contact:r.contact||"",email:r.email||"",phone:r.phone||"",time:r.time_window||"",
    notes:r.notes||"",status:r.status||"active"
  }));
  if(resource==="providers") return rows.map(r=>({
    id:r.id,name:r.name,alias:r.alias||"",contact:r.contact||"",email:r.email||"",phone:r.phone||"",
    rates:Number(r.rate_count||0),floater:r.current_floater==null?"":String(r.current_floater),
    status:r.status||"active",logo:r.logo||"",notes:r.notes||""
  }));
  if(resource==="rates") return rows.map(r=>({
    id:r.id,provider:r.provider_name,country:r.country,zone:r.zone||"",zipFrom:r.zip_from||"",
    zipTo:r.zip_to||"",transport:r.transport||"FTL",ldm:r.ldm||"",base:Number(r.base_price||0),
    floater:Number(r.floater_percent||0),status:r.status||"active",notes:r.notes||""
  }));
  if(resource==="floaters") return rows.map(r=>({
    id:r.id,provider:r.provider_name,type:r.period_type,from:r.valid_from,to:r.valid_to,
    value:Number(r.value||0),notes:r.notes||""
  }));
  if(resource==="calculations") return rows.map(r=>({
    id:r.external_id,createdAt:r.created_at,provider:r.provider,price:Number(r.price||0),
    secondPrice:Number(r.second_price||0),saving:Number(r.saving||0),relation:r.relation||"",
    transport:r.transport||"",customer:r.customer||""
  }));
  if(resource==="operations") return rows.map(r=>({
    id:r.external_id,type:r.type,relation:r.relation||"",provider:r.provider||"",price:Number(r.price||0),
    status:r.status,transport:r.transport||"",customer:r.customer||"",pickup:r.pickup_date||"",
    delivery:r.delivery_date||"",date:r.delivery_date||"",note:r.note||"",createdAt:r.created_at,
    created:new Date(r.created_at).toLocaleString("de-DE",{dateStyle:"short",timeStyle:"short"})
  }));
  if(resource==="invoiceChecks") return rows.map(r=>({
    id:r.external_id,invoice:r.invoice_number,provider:r.provider,date:r.transport_date||"",
    expected:Number(r.expected||0),actual:Number(r.actual||0),diff:Number(r.difference||0),
    status:r.status,operation:r.operation_external_id||"—",createdAt:r.created_at
  }));
  return rows;
};

GPKData.syncResource = async function(resource, value){
  if(!GPKData.backendOnline || GPKData.suppressSync) return;
  try{
    await GPKApi.request(`/sync/${resource}`,{method:"POST",body:JSON.stringify({items:Array.isArray(value)?value:[]})});
  }catch(err){
    console.warn("Backend-Sync fehlgeschlagen",resource,err);
  }
};

GPKData.scheduleSync = function(resource,value){
  clearTimeout(GPKData.syncTimers[resource]);
  GPKData.syncTimers[resource]=setTimeout(()=>GPKData.syncResource(resource,value),180);
};

GPKData.bootstrapResource = async function(resource,key){
  const serverRows=await GPKApi.request(`/${resource}`);
  if(Array.isArray(serverRows) && serverRows.length){
    const normalized=GPKData.normalizeFromServer(resource,serverRows);
    GPKData.suppressSync=true;
    try{ localStorage.setItem(key,JSON.stringify(normalized)); }
    finally{ GPKData.suppressSync=false; }
    return normalized;
  }
  const local=GPK.read(key,[])||[];
  if(local.length) await GPKData.syncResource(resource,local);
  return local;
};

GPKData.bootstrap = async function(){
  GPKData.backendOnline=await GPKApi.health();
  if(!GPKData.backendOnline) return;
  try{
    await GPKApi.me();
  }catch(_){ return; }

  const pairs=[
    ["locations",GPK.KEYS.locations],["providers",GPK.KEYS.providers],["rates",GPK.KEYS.rates],
    ["floaters",GPK.KEYS.floaters],["calculations",GPK.KEYS.calculations],
    ["operations",GPK.KEYS.operations],["invoiceChecks",GPK.KEYS.invoiceChecks]
  ];
  for(const [resource,key] of pairs){
    try{ await GPKData.bootstrapResource(resource,key); }catch(err){ console.warn(resource,err); }
  }
  document.dispatchEvent(new CustomEvent("gpk:data-ready"));
};

document.addEventListener("gpk:local-write",e=>{
  const resource=GPKData.keyToResource(e.detail?.key);
  if(resource) GPKData.scheduleSync(resource,e.detail.value);
});
document.addEventListener("DOMContentLoaded",()=>setTimeout(GPKData.bootstrap,0));
