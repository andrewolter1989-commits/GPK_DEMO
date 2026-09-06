
const GPK_XLSX_CDN = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";

function ensureXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GPK_XLSX_CDN}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.XLSX), {once:true});
      existing.addEventListener("error", reject, {once:true});
      return;
    }
    const s = document.createElement("script");
    s.src = GPK_XLSX_CDN;
    s.async = true;
    s.onload = () => resolve(window.XLSX);
    s.onerror = () => reject(new Error("Excel-Bibliothek konnte nicht geladen werden."));
    document.head.appendChild(s);
  });
}

function chooseImportFile(onFile) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  input.addEventListener("change", () => {
    if (input.files && input.files[0]) onFile(input.files[0]);
  }, {once:true});
  input.click();
}

function normalizeHeader(v) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/[ä]/g,"ae").replace(/[ö]/g,"oe").replace(/[ü]/g,"ue").replace(/[ß]/g,"ss")
    .replace(/[^a-z0-9]+/g,"_")
    .replace(/^_+|_+$/g,"");
}

function rowsToObjects(rows) {
  if (!rows || rows.length < 2) return [];
  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1)
    .filter(row => row.some(v => String(v ?? "").trim() !== ""))
    .map(row => {
      const o = {};
      headers.forEach((h,i) => { if (h) o[h] = row[i] ?? ""; });
      return o;
    });
}

function parseSimpleCSV(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i=0;i<text.length;i++) {
    const c=text[i], n=text[i+1];
    if (c === '"') {
      if (quoted && n === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (c === "," || c === ";")) {
      row.push(cell); cell = "";
    } else if (!quoted && (c === "\n" || c === "\r")) {
      if (c === "\r" && n === "\n") i++;
      row.push(cell); rows.push(row); row=[]; cell="";
    } else {
      cell += c;
    }
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

async function importTabularFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    const text = await file.text();
    return rowsToObjects(parseSimpleCSV(text.replace(/^\uFEFF/,"")));
  }
  const XLSX = await ensureXLSX();
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, {type:"array", cellDates:false});
  const first = wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[first], {header:1, defval:"", raw:false});
  return rowsToObjects(rows);
}

async function exportWorkbook(filename, sheets) {
  const XLSX = await ensureXLSX();
  const wb = XLSX.utils.book_new();
  Object.entries(sheets).forEach(([sheetName, rows]) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0,31));
  });
  XLSX.writeFile(wb, filename);
}

function saveLocalArray(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
}

function loadLocalArray(key) {
  try {
    const x = JSON.parse(localStorage.getItem(key) || "null");
    return Array.isArray(x) ? x : null;
  } catch (_) {
    return null;
  }
}

function pick(obj, names, fallback="") {
  for (const name of names) {
    if (obj[name] !== undefined && String(obj[name]).trim() !== "") return obj[name];
  }
  return fallback;
}

function yesNoToStatus(v, fallback="active") {
  const s = String(v ?? "").trim().toLowerCase();
  if (["nein","no","0","false","inaktiv","inactive"].includes(s)) return "inactive";
  if (["ja","yes","1","true","aktiv","active"].includes(s)) return "active";
  return fallback;
}


function logImportHistory(moduleName, fileName, count, status="success") {
  if (window.GPK && typeof GPK.logImport === "function") {
    GPK.logImport({module: moduleName, fileName, count, status});
  }
}
