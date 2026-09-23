(() => {
  "use strict";

  const DEFAULT_CHECKS = [
    {id:"CHK-260901",invoice:"RE-2026-1031",provider:"LIT",date:"01.09.2026",expected:1012,actual:1012,diff:0,status:"ok",operation:"GPK-260901-081204"},
    {id:"CHK-260902",invoice:"RE-2026-1032",provider:"Transimeksa",date:"02.09.2026",expected:1263,actual:1315,diff:52,status:"diff",operation:"GPK-260902-111402"},
    {id:"CHK-260903",invoice:"RE-2026-1034",provider:"Bertschi",date:"03.09.2026",expected:724,actual:724,diff:0,status:"ok",operation:"GPK-260903-090118"},
    {id:"CHK-260904",invoice:"RE-2026-1038",provider:"Duvenbeck",date:"04.09.2026",expected:1352,actual:1398,diff:46,status:"diff",operation:"GPK-260904-143355"},
    {id:"CHK-260905",invoice:"RE-2026-1041",provider:"Dachser",date:"05.09.2026",expected:1609,actual:1609,diff:0,status:"ok",operation:"GPK-260905-105205"},
    {id:"CHK-260906",invoice:"RE-2026-1044",provider:"DSV",date:"06.09.2026",expected:1098,actual:0,diff:0,status:"unmatched",operation:"—"}
  ];

  const PRIMARY="gpk_demo_invoice_checks_v1";
  const BACKUP="gpk_demo_invoice_checks_backup_v1";

  const parse = key => {
    try {
      const raw=localStorage.getItem(key);
      if(!raw) return null;
      const value=JSON.parse(raw);
      return Array.isArray(value)?value:null;
    } catch(_) { return null; }
  };

  const euro = value => new Intl.NumberFormat("de-DE",{
    style:"currency",currency:"EUR",maximumFractionDigits:0
  }).format(Number(value)||0);

  const esc = value => String(value??"").replace(/[&<>"']/g,ch=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[ch]));

  const statusLabel = status => ({
    ok:"OK",diff:"Abweichung",clarification:"In Klärung",
    unmatched:"Nicht zugeordnet",pending:"Nicht geprüft"
  }[status]||status||"Nicht geprüft");

  const statusClass = c => {
    if(c.status==="ok") return "active";
    if(c.status==="diff") return Number(c.diff)>0?"invoice-status-over":"invoice-status-under";
    if(c.status==="clarification") return "review";
    return "inactive";
  };

  function getChecks(){
    const primary=parse(PRIMARY);
    if(primary?.length) return primary;
    const backup=parse(BACKUP);
    if(backup?.length) return backup;
    return DEFAULT_CHECKS.map(x=>({...x}));
  }

  function render(){
    const rows=document.getElementById("invoiceCheckRows");
    if(!rows) return;

    const checks=getChecks();
    window.__GPK_BOOTSTRAP_INVOICE_CHECKS__=checks.map(x=>({...x}));

    rows.innerHTML=checks.map(c=>`<tr class="invoice-history-row" data-check-id="${esc(c.id)}" tabindex="0" title="Prüfung öffnen und bearbeiten">
      <td><strong class="table-main">${esc(c.invoice)}</strong><small>${esc(c.id)}</small></td>
      <td><strong class="table-main">${esc(c.provider)}</strong><small>${esc(c.operation||"—")}</small></td>
      <td>${esc(c.date||"—")}</td>
      <td><strong class="price-cell">${euro(c.expected)}</strong></td>
      <td><strong class="price-cell">${Number(c.actual)>0?euro(c.actual):"—"}</strong></td>
      <td><strong class="${Number(c.diff)>0?"invoice-diff-over":Number(c.diff)<0?"invoice-diff-under":"invoice-diff-zero"}">${Number(c.diff)?`${Number(c.diff)>0?"+":""}${euro(c.diff)}`:(c.status==="unmatched"?"—":"0 €")}</strong></td>
      <td><span class="status-pill ${statusClass(c)}">${statusLabel(c.status)}</span></td>
      <td class="row-actions"><button class="icon-button" type="button" data-edit-check="${esc(c.id)}" title="Prüfung bearbeiten">›</button></td>
    </tr>`).join("");

    const ok=checks.filter(c=>c.status==="ok").length;
    const diff=checks.filter(c=>c.status==="diff").length;
    const clarification=checks.filter(c=>c.status==="clarification").length;
    const unmatched=checks.filter(c=>c.status==="unmatched").length;
    const diffAmount=checks.filter(c=>c.status==="diff").reduce((sum,c)=>sum+Math.abs(Number(c.diff)||0),0);

    const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value};
    set("checkCount",new Intl.NumberFormat("de-DE").format(checks.length));
    set("okCount",new Intl.NumberFormat("de-DE").format(ok));
    set("diffCount",new Intl.NumberFormat("de-DE").format(diff));
    set("clarificationCount",new Intl.NumberFormat("de-DE").format(clarification));
    set("unmatchedCount",new Intl.NumberFormat("de-DE").format(unmatched));
    set("okShare",checks.length?`${Math.round(ok/checks.length*100)} % ohne Abweichung`:"ohne Abweichung");
    set("diffSum",`${euro(diffAmount)} Differenz`);
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",render,{once:true});
  else render();
})();