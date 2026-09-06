
const path=require("path");
const fs=require("fs");
const express=require("express");
const cookieParser=require("cookie-parser");
const jwt=require("jsonwebtoken");
const bcrypt=require("bcryptjs");
const Database=require("better-sqlite3");

const ROOT=path.resolve(__dirname,"..");
const DATA_DIR=path.join(__dirname,"data");
fs.mkdirSync(DATA_DIR,{recursive:true});
const db=new Database(path.join(DATA_DIR,"gpk.sqlite"));
db.pragma("journal_mode = WAL");
db.exec(fs.readFileSync(path.join(__dirname,"schema.sql"),"utf8"));

const JWT_SECRET=process.env.GPK_JWT_SECRET || "change-this-secret-before-production";
const PORT=Number(process.env.PORT||3000);

function seed(){
  let company=db.prepare("SELECT * FROM companies WHERE slug=?").get("gpk-demo");
  if(!company){
    const r=db.prepare("INSERT INTO companies(name,slug) VALUES(?,?)").run("GP Kollund","gpk-demo");
    company={id:r.lastInsertRowid,name:"GP Kollund",slug:"gpk-demo"};
  }
  const existing=db.prepare("SELECT * FROM users WHERE email=?").get("admin@gpk.local");
  if(!existing){
    db.prepare("INSERT INTO users(company_id,name,email,password_hash,role) VALUES(?,?,?,?,?)")
      .run(company.id,"Demo Admin","admin@gpk.local",bcrypt.hashSync("demo1234",10),"admin");
  }
}
seed();
const seededAdmin=db.prepare("SELECT * FROM users WHERE email=?").get("admin@gpk.local");
if(seededAdmin) db.prepare("INSERT OR IGNORE INTO user_permissions(company_id,user_id,permission,allowed) VALUES(?,?,' *'.trim(),1)").run(seededAdmin.company_id,seededAdmin.id);

const app=express();
app.use(express.json({limit:"5mb"}));
app.use(cookieParser());

function signUser(user){
  return jwt.sign({uid:user.id,cid:user.company_id,role:user.role},JWT_SECRET,{expiresIn:"12h"});
}
function auth(req,res,next){
  try{
    const token=req.cookies.gpk_session;
    if(!token) return res.status(401).json({error:"Nicht angemeldet"});
    req.auth=jwt.verify(token,JWT_SECRET);
    next();
  }catch(_){res.status(401).json({error:"Sitzung ungültig oder abgelaufen"});}
}

const ROLE_TEMPLATES={admin:["*"],dispo:["calc.view","calc.create","operations.view","operations.create","operations.edit","locations.view","locations.edit","providers.view","rates.view","dashboard.view"],sales:["calc.view","calc.create","operations.view","operations.create","locations.view","providers.view","dashboard.view"],controlling:["providers.view","rates.view","dashboard.view","invoice.view","invoice.create"]};
function getUserPermissions(uid,role){const r=db.prepare("SELECT permission FROM user_permissions WHERE user_id=? AND allowed=1").all(uid);return r.length?r.map(x=>x.permission):(ROLE_TEMPLATES[role]||[])}
function requirePermission(permission){return (req,res,next)=>{const a=getUserPermissions(req.auth.uid,req.auth.role);if(!(a.includes("*")||a.includes(permission)))return res.status(403).json({error:"Keine Berechtigung für diese Aktion"});next()}}
function audit(req,action,type,id,summary,before=null,after=null){const u=db.prepare("SELECT name FROM users WHERE id=?").get(req.auth.uid);db.prepare(`INSERT INTO audit_logs(company_id,user_id,user_name,action,entity_type,entity_id,summary,before_json,after_json) VALUES(?,?,?,?,?,?,?,?,?)`).run(req.auth.cid,req.auth.uid,u?.name||"",action,type,String(id||""),summary||"",before?JSON.stringify(before):null,after?JSON.stringify(after):null)}

app.get("/api/health",(req,res)=>res.json({ok:true,version:"6.3"}));

app.post("/api/login",(req,res)=>{
  const {email,password}=req.body||{};
  const user=db.prepare("SELECT * FROM users WHERE email=? AND active=1").get(String(email||"").toLowerCase());
  if(!user || !bcrypt.compareSync(String(password||""),user.password_hash)){
    return res.status(401).json({error:"E-Mail oder Passwort ist falsch"});
  }
  res.cookie("gpk_session",signUser(user),{
    httpOnly:true,sameSite:"lax",secure:false,maxAge:12*60*60*1000
  });
  res.json({ok:true});
});
app.post("/api/logout",(req,res)=>{res.clearCookie("gpk_session");res.json({ok:true});});
app.get("/api/me",auth,(req,res)=>{const user=db.prepare("SELECT id,company_id,name,email,role,active FROM users WHERE id=?").get(req.auth.uid);user.permissions=getUserPermissions(user.id,user.role);const company=db.prepare("SELECT id,name,slug FROM companies WHERE id=?").get(req.auth.cid);res.json({user,company});});





app.get("/api/users",auth,requirePermission("users.manage"),(req,res)=>{const rows=db.prepare(`SELECT id,company_id,name,email,role,active,created_at FROM users WHERE company_id=? ORDER BY active DESC,name ASC`).all(req.auth.cid);for(const u of rows)u.permissions=getUserPermissions(u.id,u.role);res.json(rows)});
app.post("/api/users",auth,requirePermission("users.manage"),(req,res)=>{const {name,email,password,role="dispo",active=true,permissions}=req.body||{};if(!name||!email||!password)return res.status(400).json({error:"Name, E-Mail und Passwort sind Pflicht"});try{const r=db.prepare(`INSERT INTO users(company_id,name,email,password_hash,role,active) VALUES(?,?,?,?,?,?)`).run(req.auth.cid,String(name).trim(),String(email).trim().toLowerCase(),bcrypt.hashSync(String(password),10),role,active?1:0);const uid=Number(r.lastInsertRowid),ps=Array.isArray(permissions)?permissions:(ROLE_TEMPLATES[role]||[]),ins=db.prepare("INSERT OR REPLACE INTO user_permissions(company_id,user_id,permission,allowed) VALUES(?,?,?,1)");for(const x of ps)ins.run(req.auth.cid,uid,x);audit(req,"create","user",uid,`Benutzer ${name} angelegt`,null,{name,email,role,permissions:ps});const u=db.prepare(`SELECT id,company_id,name,email,role,active,created_at FROM users WHERE id=?`).get(uid);u.permissions=getUserPermissions(uid,role);res.status(201).json(u)}catch(e){if(String(e.message).includes("UNIQUE"))return res.status(409).json({error:"E-Mail bereits vorhanden"});throw e}});
app.put("/api/users/:id",auth,requirePermission("users.manage"),(req,res)=>{const id=Number(req.params.id),u=db.prepare("SELECT * FROM users WHERE id=? AND company_id=?").get(id,req.auth.cid);if(!u)return res.status(404).json({error:"Benutzer nicht gefunden"});const before={name:u.name,email:u.email,role:u.role,active:u.active,permissions:getUserPermissions(id,u.role)},name=req.body.name??u.name,email=(req.body.email??u.email).toLowerCase(),role=req.body.role??u.role,active=req.body.active===undefined?u.active:(req.body.active?1:0);db.prepare("UPDATE users SET name=?,email=?,role=?,active=? WHERE id=? AND company_id=?").run(name,email,role,active,id,req.auth.cid);if(Array.isArray(req.body.permissions)){db.prepare("DELETE FROM user_permissions WHERE user_id=?").run(id);const ins=db.prepare("INSERT INTO user_permissions(company_id,user_id,permission,allowed) VALUES(?,?,?,1)");for(const x of req.body.permissions)ins.run(req.auth.cid,id,x)}const after={name,email,role,active,permissions:getUserPermissions(id,role)};audit(req,"update","user",id,`Benutzer ${name} geändert`,before,after);const out=db.prepare(`SELECT id,company_id,name,email,role,active,created_at FROM users WHERE id=?`).get(id);out.permissions=after.permissions;res.json(out)});
app.post("/api/users/:id/reset-password",auth,requirePermission("users.manage"),(req,res)=>{const pw=String(req.body?.password||"");if(pw.length<6)return res.status(400).json({error:"Passwort muss mindestens 6 Zeichen haben"});const r=db.prepare("UPDATE users SET password_hash=? WHERE id=? AND company_id=?").run(bcrypt.hashSync(pw,10),Number(req.params.id),req.auth.cid);if(!r.changes)return res.status(404).json({error:"Benutzer nicht gefunden"});audit(req,"password_reset","user",req.params.id,"Passwort neu gesetzt");res.json({ok:true})});
app.delete("/api/users/:id",auth,requirePermission("users.manage"),(req,res)=>{const id=Number(req.params.id);if(id===req.auth.uid)return res.status(400).json({error:"Eigenen Benutzer nicht deaktivieren"});const u=db.prepare("SELECT name FROM users WHERE id=? AND company_id=?").get(id,req.auth.cid),r=db.prepare("UPDATE users SET active=0 WHERE id=? AND company_id=?").run(id,req.auth.cid);if(!r.changes)return res.status(404).json({error:"Benutzer nicht gefunden"});audit(req,"deactivate","user",id,`Benutzer ${u?.name||id} deaktiviert`);res.json({ok:true})});
app.get("/api/audit",auth,requirePermission("audit.view"),(req,res)=>res.json(db.prepare(`SELECT id,user_id,user_name,action,entity_type,entity_id,summary,created_at FROM audit_logs WHERE company_id=? ORDER BY id DESC LIMIT 100`).all(req.auth.cid)));
app.get("/api/stats/bookings-by-user",auth,requirePermission("dashboard.view"),(req,res)=>res.json(db.prepare(`SELECT u.id user_id,u.name,u.email,COUNT(o.id) bookings,COALESCE(SUM(o.price),0) volume,COALESCE(AVG(o.price),0) avg_price FROM users u LEFT JOIN operations o ON o.company_id=u.company_id AND o.created_by=u.id AND o.type='booking' WHERE u.company_id=? GROUP BY u.id,u.name,u.email ORDER BY bookings DESC,u.name`).all(req.auth.cid)));

const resources={
  locations:{
    table:"delivery_locations",
    fields:["name","country","zip","city","street","contact","email","phone","time_window","notes","status"]
  },
  providers:{
    table:"providers",
    fields:["name","alias","contact","email","phone","logo","notes","status"]
  },
  rates:{
    table:"rates",
    fields:["provider_name","country","zone","zip_from","zip_to","transport","ldm","base_price","floater_percent","status","notes","valid_from","valid_to"]
  },
  floaters:{
    table:"floater_periods",
    fields:["provider_name","period_type","valid_from","valid_to","value","notes"]
  }
};

for(const [name,cfg] of Object.entries(resources)){
  app.get(`/api/${name}`,auth,(req,res)=>{
    let rows;
    if(name==="providers"){
      rows=db.prepare(`SELECT p.*,
        (SELECT COUNT(*) FROM rates r WHERE r.company_id=p.company_id AND r.provider_name=p.name) AS rate_count,
        (SELECT fp.value FROM floater_periods fp WHERE fp.company_id=p.company_id AND fp.provider_name=p.name AND date('now') BETWEEN fp.valid_from AND fp.valid_to ORDER BY fp.valid_from DESC LIMIT 1) AS current_floater
        FROM providers p WHERE p.company_id=? ORDER BY p.id DESC`).all(req.auth.cid);
    }else{
      rows=db.prepare(`SELECT * FROM ${cfg.table} WHERE company_id=? ORDER BY id DESC`).all(req.auth.cid);
    }
    res.json(rows);
  });
  app.post(`/api/${name}`,auth,(req,res)=>{
    const body=req.body||{};
    const fields=cfg.fields.filter(f=>body[f]!==undefined);
    if(!fields.length) return res.status(400).json({error:"Keine Felder übergeben"});
    const cols=["company_id",...fields];
    const vals=[req.auth.cid,...fields.map(f=>body[f])];
    const marks=cols.map(()=>"?").join(",");
    const result=db.prepare(`INSERT INTO ${cfg.table}(${cols.join(",")}) VALUES(${marks})`).run(...vals);
    res.status(201).json(db.prepare(`SELECT * FROM ${cfg.table} WHERE id=?`).get(result.lastInsertRowid));
  });
  app.put(`/api/${name}/:id`,auth,(req,res)=>{
    const body=req.body||{};
    const fields=cfg.fields.filter(f=>body[f]!==undefined);
    if(!fields.length) return res.status(400).json({error:"Keine Felder übergeben"});
    const set=fields.map(f=>`${f}=?`).join(",");
    const vals=[...fields.map(f=>body[f]),Number(req.params.id),req.auth.cid];
    db.prepare(`UPDATE ${cfg.table} SET ${set} WHERE id=? AND company_id=?`).run(...vals);
    res.json(db.prepare(`SELECT * FROM ${cfg.table} WHERE id=? AND company_id=?`).get(Number(req.params.id),req.auth.cid));
  });
  app.delete(`/api/${name}/:id`,auth,(req,res)=>{
    db.prepare(`DELETE FROM ${cfg.table} WHERE id=? AND company_id=?`).run(Number(req.params.id),req.auth.cid);
    res.json({ok:true});
  });
}


function syncReplace(table,cid,items,insertFn){
  const tx=db.transaction(()=>{
    db.prepare(`DELETE FROM ${table} WHERE company_id=?`).run(cid);
    for(const item of items) insertFn(item);
  });
  tx();
}

app.post("/api/sync/locations",auth,(req,res)=>{
  const items=Array.isArray(req.body?.items)?req.body.items:[];
  syncReplace("delivery_locations",req.auth.cid,items,(x)=>{
    db.prepare(`INSERT INTO delivery_locations(company_id,name,country,zip,city,street,contact,email,phone,time_window,notes,status)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(req.auth.cid,x.name||"",x.country||"",x.zip||"",x.city||"",x.street||"",x.contact||"",x.email||"",x.phone||"",x.time||"",x.notes||"",x.status||"active");
  });
  res.json({ok:true,count:items.length});
});
app.post("/api/sync/providers",auth,(req,res)=>{
  const items=Array.isArray(req.body?.items)?req.body.items:[];
  syncReplace("providers",req.auth.cid,items,(x)=>{
    db.prepare(`INSERT INTO providers(company_id,name,alias,contact,email,phone,logo,notes,status)
      VALUES(?,?,?,?,?,?,?,?,?)`).run(req.auth.cid,x.name||"",x.alias||"",x.contact||"",x.email||"",x.phone||"",x.logo||"",x.notes||"",x.status||"active");
  });
  res.json({ok:true,count:items.length});
});
app.post("/api/sync/rates",auth,(req,res)=>{
  const items=Array.isArray(req.body?.items)?req.body.items:[];
  syncReplace("rates",req.auth.cid,items,(x)=>{
    db.prepare(`INSERT INTO rates(company_id,provider_name,country,zone,zip_from,zip_to,transport,ldm,base_price,floater_percent,status,notes)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(req.auth.cid,x.provider||"",x.country||"",x.zone||"",x.zipFrom||"",x.zipTo||"",x.transport||"FTL",x.ldm||"",Number(x.base||0),Number(x.floater||0),x.status||"active",x.notes||"");
  });
  res.json({ok:true,count:items.length});
});
app.post("/api/sync/floaters",auth,(req,res)=>{
  const items=Array.isArray(req.body?.items)?req.body.items:[];
  syncReplace("floater_periods",req.auth.cid,items,(x)=>{
    db.prepare(`INSERT INTO floater_periods(company_id,provider_name,period_type,valid_from,valid_to,value,notes)
      VALUES(?,?,?,?,?,?,?)`).run(req.auth.cid,x.provider||"",x.type||"custom",x.from||"",x.to||"",Number(x.value||0),x.notes||"");
  });
  res.json({ok:true,count:items.length});
});
app.post("/api/sync/calculations",auth,(req,res)=>{
  const items=Array.isArray(req.body?.items)?req.body.items:[];
  syncReplace("calculations",req.auth.cid,items,(x)=>{
    db.prepare(`INSERT INTO calculations(company_id,external_id,provider,price,second_price,saving,relation,transport,customer,created_by,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(req.auth.cid,String(x.id||`CALC-${Date.now()}`),x.provider||"",Number(x.price||0),Number(x.secondPrice||0),Number(x.saving||0),x.relation||"",x.transport||"",x.customer||"",req.auth.uid,x.createdAt||new Date().toISOString());
  });
  res.json({ok:true,count:items.length});
});
app.post("/api/sync/operations",auth,requirePermission("operations.create"),(req,res)=>{const items=Array.isArray(req.body?.items)?req.body.items:[],existingRows=db.prepare("SELECT * FROM operations WHERE company_id=?").all(req.auth.cid),existing=new Map(existingRows.map(x=>[x.external_id,x])),insert=db.prepare(`INSERT INTO operations(company_id,external_id,type,relation,provider,price,status,transport,customer,pickup_date,delivery_date,note,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`),update=db.prepare(`UPDATE operations SET type=?,relation=?,provider=?,price=?,status=?,transport=?,customer=?,pickup_date=?,delivery_date=?,note=? WHERE company_id=? AND external_id=?`);const tx=db.transaction(()=>{for(const x of items){const eid=String(x.id||`GPK-${Date.now()}-${Math.floor(Math.random()*9999)}`),old=existing.get(eid);if(!old){insert.run(req.auth.cid,eid,x.type||"availability",x.relation||"",x.provider||"",Number(x.price||0),x.status||"open",x.transport||"",x.customer||"",x.pickup||"",x.delivery||x.date||"",x.note||"",req.auth.uid,x.createdAt||new Date().toISOString());audit(req,"create","operation",eid,(x.type==="booking"?"Tour gebucht":"Vorgang angelegt")+` · ${x.provider||""} · ${x.relation||""}`,null,x)}else{const changed=Number(old.price)!==Number(x.price||0)||old.status!==(x.status||"open")||old.provider!==(x.provider||"")||old.relation!==(x.relation||"");if(changed){update.run(x.type||"availability",x.relation||"",x.provider||"",Number(x.price||0),x.status||"open",x.transport||"",x.customer||"",x.pickup||"",x.delivery||x.date||"",x.note||"",req.auth.cid,eid);audit(req,"update","operation",eid,`Vorgang ${eid} geändert`,old,x)}}}});tx();res.json({ok:true,count:items.length})});
app.post("/api/sync/invoiceChecks",auth,(req,res)=>{
  const items=Array.isArray(req.body?.items)?req.body.items:[];
  syncReplace("invoice_checks",req.auth.cid,items,(x)=>{
    db.prepare(`INSERT INTO invoice_checks(company_id,external_id,invoice_number,provider,transport_date,expected,actual,difference,status,operation_external_id,created_by,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(req.auth.cid,String(x.id||`CHK-${Date.now()}`),x.invoice||"",x.provider||"",x.date||"",Number(x.expected||0),Number(x.actual||0),Number(x.diff||0),x.status||"unmatched",x.operation||"",req.auth.uid,x.createdAt||new Date().toISOString());
  });
  res.json({ok:true,count:items.length});
});

app.get("/api/dashboard",auth,requirePermission("dashboard.view"),(req,res)=>{
  const cid=req.auth.cid;
  const calculations=db.prepare("SELECT COUNT(*) c, COALESCE(AVG(price),0) avg_price, COALESCE(SUM(saving),0) saving FROM calculations WHERE company_id=?").get(cid);
  const bookings=db.prepare("SELECT COUNT(*) c FROM operations WHERE company_id=? AND type='booking'").get(cid);
  const open=db.prepare("SELECT COUNT(*) c FROM operations WHERE company_id=? AND status IN ('open','waiting')").get(cid);
  const checks=db.prepare("SELECT COUNT(*) c, COALESCE(SUM(CASE WHEN difference>0 THEN difference ELSE 0 END),0) diff FROM invoice_checks WHERE company_id=?").get(cid);
  res.json({calculations:calculations.c,avgPrice:calculations.avg_price,saving:calculations.saving,bookings:bookings.c,open:open.c,invoiceChecks:checks.c,invoiceDifference:checks.diff});
});

app.use(express.static(ROOT,{extensions:["html"]}));
app.get("/",(req,res)=>res.sendFile(path.join(ROOT,"login.html")));

app.listen(PORT,()=>console.log(`GP Kollund v6.3 läuft auf http://localhost:${PORT}`));
