const ORIGIN_COUNTRY = "DE";
const DEFAULT_ZONE_MODE = "ALL";
const PUBLISHED_TARIFF_KEY = "gpk_demo_published_tariffs_v1";
const PRICE_SENTINEL = 99999; // alte Platzhalterwerte werden weiterhin ignoriert

const POSTAL_PLACEHOLDERS = {
  DE: "z. B. 24939",
  NL: "z. B. 1012 AB",
  BE: "z. B. 1000",
  FR: "z. B. 75008",
  IT: "z. B. 20121",
  DK: "z. B. 8000",
  SE: "z. B. 114 55",
  SK: "z. B. 811 01",
  GB: "z. B. SW1A 1AA",
};

const STATE = {
  rates: [],
  zones: [],
  floaterConfig: {},
  emails: {},
  forwarders: [],
  addresses: [],
  recipientsById: {},
  providers: {},
  latestResults: [],
  chargeRules: [],
};

let CALCULATION_MODE = "planning";

const CALC_FIELD_CONFIG_KEY = "gpk_calculator_field_config_v1";
const DEFAULT_CALC_FIELD_CONFIG = {
  pickupDate:false, deliveryDate:false, pallets:false, slots:false, weight:false,
  length:false, width:false, height:false, volume:false,
  nonStackable:false, avis:false, teilladungLdm:true
};
function getCalcFieldConfig(){
  try{return {...DEFAULT_CALC_FIELD_CONFIG,...JSON.parse(localStorage.getItem(CALC_FIELD_CONFIG_KEY)||"{}")};}
  catch(_){return {...DEFAULT_CALC_FIELD_CONFIG};}
}
function calcFieldLabel(key){
  return ({pickupDate:"Abholdatum",deliveryDate:"Liefertermin",pallets:"Paletten / Stellplätze",
    weight:"Gewicht",pallets:"Paletten",slots:"Stellplätze",length:"Länge",width:"Breite",height:"Höhe",volume:"Volumen",
    nonStackable:"Nicht stapelbar",avis:"Avis",teilladungLdm:"Lademeter"})[key]||key;
}


function setCalculationMode(mode) {
  CALCULATION_MODE = mode === "planning" ? "planning" : "price";
  document.body.classList.toggle("price-mode", CALCULATION_MODE === "price");
  document.body.classList.toggle("planning-mode", CALCULATION_MODE === "planning");
  document.querySelectorAll(".mode-option").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === CALCULATION_MODE);
  });
  if (CALCULATION_MODE === "price") {
    const box = document.getElementById("manualRecipientBox");
    if (box) box.style.display = "none";
  } else {
    renderRecipientSelection();
  }
}

function ensurePlanningForAction(kind) {
  if (CALCULATION_MODE === "planning") return true;
  setCalculationMode("planning");
  const target = document.querySelector(".destination-section");
  target?.scrollIntoView({ behavior: "smooth", block: "start" });
  const message = document.getElementById("messageBox");
  if (message) {
    message.textContent = kind === "booking"
      ? "Für die Buchung bitte noch Tourdetails ergänzen; die Entladestelle kann bei Bedarf ergänzt werden."
      : "Für die Verfügbarkeitsanfrage bitte noch die Tourdetails ergänzen. Eine Entladestelle ist nicht erforderlich.";
    message.className = "notice warn";
    message.style.display = "block";
  }
  return false;
}

const ZONE_MODE_BY_FORWARDER = {
  morrisson: "Morrisson",
};

const SHIPMENT_TYPES = {
  teilladung: { label: "Teilladung", fixedLdm: null },
  ftl: { label: "FTL", fixedLdm: 13.6 },
  mega: { label: "Mega", fixedLdm: 13.7 },
  jumbo: { label: "Jumbo", fixedLdm: 15.0 },
};

function normalizeHeader(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\u0000/g, "")
    .trim()
    .toLowerCase();
}

function normalizeKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizePostal(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .trim();
}

function normalizePostalByCountry(country, value) {
  const normalizedCountry = String(country ?? "").toUpperCase().trim();
  const base = String(value ?? "").toUpperCase().trim();
  if (!base) return "";

  if (["GB", "SE", "SK"].includes(normalizedCountry)) {
    return base.replace(/[^A-Z0-9]/g, "");
  }

  return base.replace(/\s+/g, "");
}

function getGbZoneKey(postalCode) {
  const postal = normalizePostalByCountry("GB", postalCode);
  if (!postal) return "";

  const outwardMatch = postal.match(/^[A-Z]{1,2}\d[A-Z\d]?/);
  const outward = outwardMatch ? outwardMatch[0] : postal;
  return outward.slice(0, 2);
}

function parseNumberFlexible(value) {
  if (value == null) return NaN;
  const raw = String(value).trim();
  if (!raw) return NaN;

  const cleaned = raw.replace(/\s+/g, "");
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  if (hasComma && hasDot) {
    return Number(cleaned.replace(/\./g, "").replace(/,/g, "."));
  }
  if (hasComma) {
    return Number(cleaned.replace(/,/g, "."));
  }
  if (hasDot) {
    const parts = cleaned.split(".");
    if (parts.length === 2 && parts[1].length <= 2) return Number(cleaned);
    return Number(cleaned.replace(/\./g, ""));
  }
  return Number(cleaned);
}

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function money(value) {
  return Number.isFinite(value) ? `${formatNumber(value, 2)} €` : "—";
}

function percent(value) {
  return Number.isFinite(value) ? `${formatNumber(value, 2)} %` : "0,00 %";
}

function formatDisplayDate(value) {
  if (!value) return "—";
  const parts = String(value).split("-");
  if (parts.length !== 3) return value;
  const [year, month, day] = parts;
  return `${day}.${month}.${year}`;
}

async function fetchTextSmart(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${url} konnte nicht geladen werden (HTTP ${response.status})`);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  let encoding = "utf-8";
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) encoding = "utf-16le";
  else if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) encoding = "utf-16be";

  return new TextDecoder(encoding).decode(buffer);
}

function detectDelimiter(text) {
  const sample = text.split(/\r?\n/).slice(0, 5).join("\n");
  const counts = {
    ";": (sample.match(/;/g) || []).length,
    "\t": (sample.match(/\t/g) || []).length,
    ",": (sample.match(/,/g) || []).length,
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] || ";";
}

function parseCsv(text) {
  const delimiter = detectDelimiter(text);
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  const rows = [];

  for (const line of lines) {
    const cells = [];
    let current = "";
    let quoted = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (quoted && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          quoted = !quoted;
        }
      } else if (char === delimiter && !quoted) {
        cells.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    cells.push(current.trim());
    rows.push(cells);
  }

  return rows;
}


async function loadProviderConfig() {
  try {
    const response = await fetch("providers.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`providers.json: HTTP ${response.status}`);
    const data = await response.json();
    const providers = Array.isArray(data?.providers) ? data.providers : [];
    STATE.providers = {};
    providers.forEach((provider) => {
      const keys = [provider.name, ...(provider.aliases || [])].filter(Boolean);
      keys.forEach((key) => { STATE.providers[normalizeKey(key)] = provider; });
    });
  } catch {
    STATE.providers = {};
  }
  try{
    const localProviders=GPK.read(GPK.KEYS.providers,[])||[];
    localProviders.forEach((p)=>{
      const localLogo=GPK.providerLogoSrc?.(p)||"";
      [p.name,p.alias].filter(Boolean).forEach((key)=>{
        const nk=normalizeKey(key),base=STATE.providers[nk]||{};
        STATE.providers[nk]={...base,name:p.name||base.name||key,short:p.alias||base.short||"",logo:localLogo||base.logo||""};
      });
    });
  }catch(_){}
}

function getProviderMeta(forwarder) {
  return STATE.providers[normalizeKey(forwarder)] || {
    name: forwarder,
    logo: "",
    short: "",
  };
}

function providerInitials(name) {
  const parts = String(name || "").replace(/[^A-Za-z0-9ÄÖÜäöüß\s-]/g, " ").split(/[\s-]+/).filter(Boolean);
  if (!parts.length) return "SP";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function providerVisualHtml(forwarder, sizeClass = "") {
  const meta = getProviderMeta(forwarder);
  const label = escapeHtml(meta.name || forwarder);
  const cls = sizeClass ? ` ${sizeClass}` : "";
  if (meta.logo) {
    return `<span class="provider-visual${cls}"><img src="${escapeHtml(meta.logo)}" alt="${label} Logo" onerror="this.parentElement.classList.add('logo-fallback');this.remove();"><span>${escapeHtml(providerInitials(meta.short || meta.name || forwarder))}</span></span>`;
  }
  return `<span class="provider-visual logo-fallback${cls}"><span>${escapeHtml(providerInitials(meta.short || meta.name || forwarder))}</span></span>`;
}

async function loadAddresses() {
  const text = await fetchTextSmart("data/Adressen.csv");
  const rows = parseCsv(text);
  if (!rows.length) return;
  const headers = rows[0].map((h) => String(h || "").trim());
  const idx = (name) => headers.findIndex((h) => h === name);

  STATE.addresses = rows.slice(1).map((cells, index) => ({
    id: String(cells[idx("Empfänger-ID")] || `addr-${index}`).trim(),
    name1: String(cells[idx("NAME1")] || "").trim(),
    name2: String(cells[idx("NAME2")] || "").trim(),
    strasse: String(cells[idx("STRASSE")] || "").trim(),
    plz: normalizePostal(cells[idx("PLZ")] || ""),
    stadt: String(cells[idx("STADT")] || "").trim(),
    land: String(cells[idx("LAND")] || "").trim().toUpperCase(),
  })).filter((r) => r.plz);
}

function formatRecipientOption(r) {
  const name = [r.name1, r.name2].filter(Boolean).join(" ");
  const address = [r.strasse, `${r.plz || ""} ${r.stadt || ""}`.trim()].filter(Boolean).join(", ");
  return [name, address].filter(Boolean).join(" – ");
}

function renderRecipientSelection() {
  const select = document.getElementById("recipientSelect");
  const box = document.getElementById("manualRecipientBox");
  const hint = document.getElementById("recipientHint");
  const country = String(document.getElementById("destCountry")?.value || "").toUpperCase();
  const postal = normalizePostal(document.getElementById("postalCode")?.value || "");
  if (!select) return;

  STATE.recipientsById = {};
  if (!country || !postal) {
    select.disabled = true;
    select.innerHTML = '<option value="">Bitte zuerst Land und PLZ eingeben</option>';
    if (box) box.style.display = "none";
    if (hint) hint.textContent = "Entladestelle ist für Preisvergleich und Verfügbarkeitsanfrage optional.";
    return;
  }

  const matches = STATE.addresses.filter((r) => r.land === country && r.plz === postal);
  matches.forEach((r) => { STATE.recipientsById[r.id] = r; });
  select.disabled = false;

  const optional = '<option value="" selected>Ohne Entladestelle</option>';
  const existing = matches.map((r) => `<option value="${escapeHtml(r.id)}">${escapeHtml(formatRecipientOption(r))}</option>`).join("");
  select.innerHTML = optional + existing + '<option value="manual">+ Neuer Empfänger</option>';
  if (box) box.style.display = "none";
  if (hint) hint.textContent = matches.length
    ? `${matches.length} passende Entladestelle${matches.length === 1 ? "" : "n"} gefunden · Auswahl optional.`
    : "Keine bekannte Entladestelle gefunden · für Verfügbarkeitsanfragen kann ohne Entladestelle fortgefahren werden.";
}

function onRecipientSelectChange() {
  const select = document.getElementById("recipientSelect");
  const box = document.getElementById("manualRecipientBox");
  if (box) box.style.display = select?.value === "manual" ? "block" : "none";
}

function getSelectedRecipient() {
  const select = document.getElementById("recipientSelect");
  if (!select?.value) return null;
  if (select.value !== "manual") return STATE.recipientsById[select.value] || null;
  return {
    id: "manual",
    name1: document.getElementById("recipientName")?.value?.trim() || "",
    name2: "",
    strasse: document.getElementById("recipientStreet")?.value?.trim() || "",
    plz: normalizePostal(document.getElementById("postalCode")?.value || ""),
    stadt: document.getElementById("recipientCity")?.value?.trim() || "",
    land: String(document.getElementById("destCountry")?.value || "").toUpperCase(),
  };
}

function detectZoneColumns(headers) {
  const columns = [];
  headers.forEach((header, index) => {
    const match = String(header).trim().match(/^zone\s*(\d+)$/i);
    if (match) columns.push({ index, zone: Number(match[1]) });
  });
  return columns;
}

function getZoneMode(forwarder) {
  return ZONE_MODE_BY_FORWARDER[normalizeKey(forwarder)] || DEFAULT_ZONE_MODE;
}

function getFloaterPercent(forwarder) {
  const key = normalizeKey(forwarder);
  const value = STATE.floaterConfig[key];
  return Number.isFinite(value) ? value : 0;
}

function isNumericZoneValue(value) {
  return /^\d+$/.test(String(value ?? "").trim());
}

async function loadZones() {
  const rows = parseCsv(await fetchTextSmart("zones.csv"));
  const headers = rows[0].map(normalizeHeader);
  const iForwarder = headers.indexOf("forwarder");
  const iOrigin = headers.indexOf("origin ctry");
  const iDest = headers.indexOf("dest ctry");
  const iFrom = headers.indexOf("dest from");
  const iTo = headers.indexOf("dest to");
  const iZone = headers.indexOf("zone");

  if ([iForwarder, iOrigin, iDest, iFrom, iTo, iZone].some((i) => i < 0)) {
    throw new Error("zones.csv: Header konnte nicht gelesen werden.");
  }

  STATE.zones = rows.slice(1)
    .filter((row) => row[iForwarder])
    .map((row) => {
      const fromRaw = String(row[iFrom] ?? "").trim();
      const toRaw = String(row[iTo] ?? "").trim();
      return {
        forwarder: String(row[iForwarder] ?? "").trim(),
        originCountry: String(row[iOrigin] ?? "").trim(),
        destCountry: String(row[iDest] ?? "").trim(),
        fromNorm: normalizePostalByCountry(row[iDest], fromRaw),
        toNorm: normalizePostalByCountry(row[iDest], toRaw),
        numericFrom: isNumericZoneValue(fromRaw) ? Number.parseInt(fromRaw, 10) : null,
        numericTo: isNumericZoneValue(toRaw) ? Number.parseInt(toRaw, 10) : null,
        zone: Number.parseInt(String(row[iZone]).trim(), 10),
      };
    })
    .filter((row) => Number.isFinite(row.zone));

  try {
    const published=JSON.parse(localStorage.getItem(PUBLISHED_TARIFF_KEY)||"[]");
    const providers=new Set((published||[]).map(x=>normalizeKey(x.provider)).filter(Boolean));
    if(providers.size) STATE.zones=STATE.zones.filter(z=>!providers.has(normalizeKey(z.forwarder)));
    (published||[]).forEach(entry=>(entry.zones||[]).forEach(r=>{
      const fromRaw=String(r[5]??"").trim(),toRaw=String(r[6]??"").trim(),dest=String(r[4]??"").trim();
      const zone=Number.parseInt(String(r[7]??"").trim(),10);if(!Number.isFinite(zone))return;
      STATE.zones.push({forwarder:String(r[0]??entry.provider??"").trim(),originCountry:String(r[1]??"").trim(),destCountry:dest,fromNorm:normalizePostalByCountry(dest,fromRaw),toNorm:normalizePostalByCountry(dest,toRaw),numericFrom:isNumericZoneValue(fromRaw)?Number.parseInt(fromRaw,10):null,numericTo:isNumericZoneValue(toRaw)?Number.parseInt(toRaw,10):null,zone});
    }));
  } catch(err){ console.warn("Freigegebene Zonen konnten nicht geladen werden",err); }
}

async function loadRates() {
  const rows = parseCsv(await fetchTextSmart("rates.csv"));
  const headersRaw = rows[0];
  const headers = headersRaw.map(normalizeHeader);
  const iForwarder = headers.indexOf("forwarder");
  const iOrigin = headers.indexOf("origin ctry");
  const iDest = headers.indexOf("dest ctry");
  const iFrom = headers.indexOf("chg from");
  const iTo = headers.indexOf("chg to");
  const iUnit = headers.indexOf("unit");
  const zoneCols = detectZoneColumns(headersRaw);

  if ([iForwarder, iOrigin, iDest, iFrom, iTo, iUnit].some((i) => i < 0) || zoneCols.length === 0) {
    throw new Error("rates.csv: Header konnte nicht gelesen werden.");
  }

  STATE.rates = rows.slice(1)
    .filter((row) => row[iForwarder])
    .map((row) => {
      const zonePrices = new Map();
      zoneCols.forEach(({ index, zone }) => {
        const rawCell = String(row[index] ?? "").trim();
        if (!rawCell) return; // leere Zellen bedeuten: kein Angebot in dieser Zone

        const amount = parseNumberFlexible(rawCell);
        if (Number.isFinite(amount)) zonePrices.set(zone, amount);
      });

      return {
        forwarder: String(row[iForwarder] ?? "").trim(),
        originCountry: String(row[iOrigin] ?? "").trim(),
        destCountry: String(row[iDest] ?? "").trim(),
        from: parseNumberFlexible(row[iFrom]),
        to: parseNumberFlexible(row[iTo]),
        unit: String(row[iUnit] ?? "").trim(),
        model: "LDM_STEP",
        zonePrices,
      };
    })
    .filter((row) => Number.isFinite(row.from) && Number.isFinite(row.to));

  try {
    const published=JSON.parse(localStorage.getItem(PUBLISHED_TARIFF_KEY)||"[]");
    STATE.chargeRules=(published||[]).flatMap(entry=>(entry.chargeRules||[]).map(rule=>({...rule,provider:entry.provider||rule.forwarder||"",batchId:entry.id||""})));
    const providers=new Set((published||[]).filter(x=>(x.rates||[]).length).map(x=>normalizeKey(x.provider)).filter(Boolean));
    if(providers.size) STATE.rates=STATE.rates.filter(r=>!providers.has(normalizeKey(r.forwarder)));
    (published||[]).forEach(entry=>(entry.rates||[]).forEach(pr=>{
      const b=pr.base||[];const from=Number(b[8]),to=Number(b[9]);if(!Number.isFinite(from)||!Number.isFinite(to))return;
      const zonePrices=new Map();(pr.prices||[]).forEach((v,i)=>{const n=Number(v);if(Number.isFinite(n))zonePrices.set(i+1,n);});
      STATE.rates.push({forwarder:String(b[0]??entry.provider??"").trim(),originCountry:String(b[6]??"").trim(),destCountry:String(b[7]??"").trim(),from,to,unit:String(b[11]??"LDM").trim(),model:String(pr.model||"LDM_STEP"),zonePrices});
    }));
  } catch(err){ console.warn("Freigegebene Tarife konnten nicht geladen werden",err); }

  STATE.forwarders = Array.from(new Set(
    STATE.rates
      .filter((row) => row.originCountry === ORIGIN_COUNTRY)
      .map((row) => row.forwarder),
  )).sort((a, b) => a.localeCompare(b, "de"));
}

async function loadFloaterConfig() {
  const text = await fetchTextSmart("floater.json");
  const data = JSON.parse(text);
  const normalized = {};
  Object.entries(data || {}).forEach(([key, value]) => {
    const num = Number(value);
    normalized[normalizeKey(key)] = Number.isFinite(num) ? num : 0;
  });
  STATE.floaterConfig = normalized;
}

async function loadEmailConfig() {
  try {
    const text = await fetchTextSmart("emails.json");
    const data = JSON.parse(text);
    const normalized = {};

    Object.entries(data || {}).forEach(([key, value]) => {
      const nk = normalizeKey(key);

      if (typeof value === "string") {
        normalized[nk] = {
          all: {
            availability: value.trim(),
            booking: ""
          }
        };
        return;
      }

      // Neue Struktur mit national / international / Ländern / all erhalten
      normalized[nk] = value || {};
    });

    STATE.emails = normalized;
  } catch {
    STATE.emails = {};
  }
}
function postalMatchesZone(row, postalCode) {
  const country = String(row.destCountry ?? "").toUpperCase().trim();
  const postal = normalizePostalByCountry(country, postalCode);
  if (!postal) return false;

  if (country === "GB") {
    const gbKey = getGbZoneKey(postal);
    if (!gbKey) return false;
    const from = row.fromNorm;
    const to = row.toNorm;
    if (!from || !to) return false;
    if (from === to) return gbKey === from;
    return gbKey >= from && gbKey <= to;
  }

  if (row.numericFrom != null && row.numericTo != null && /^\d+$/.test(postal)) {
    const postalNum = Number.parseInt(postal, 10);
    return postalNum >= row.numericFrom && postalNum <= row.numericTo;
  }

  const from = row.fromNorm;
  const to = row.toNorm;
  if (!from || !to) return false;

  if (from === to) return postal.startsWith(from);

  if (from.length === to.length && postal.length >= from.length) {
    const prefix = postal.slice(0, from.length);
    return prefix >= from && prefix <= to;
  }

  return postal >= from && postal <= to;
}

function findZone(forwarder, destCountry, postalCode) {
  const zoneMode = getZoneMode(forwarder);
  const matches = STATE.zones.filter((row) => (
    normalizeKey(row.forwarder) === normalizeKey(zoneMode)
    && row.originCountry === ORIGIN_COUNTRY
    && row.destCountry === destCountry
    && postalMatchesZone(row, postalCode)
  ));

  if (!matches.length) return null;

  matches.sort((a, b) => {
    const aLen = a.fromNorm.length;
    const bLen = b.fromNorm.length;
    if (bLen !== aLen) return bLen - aLen;
    const aWidth = (a.numericTo ?? 0) - (a.numericFrom ?? 0);
    const bWidth = (b.numericTo ?? 0) - (b.numericFrom ?? 0);
    return aWidth - bWidth;
  });

  return {
    zone: matches[0].zone,
    zoneMode,
  };
}

function isWeightRateModel(model) {
  return ["WEIGHT_STEP", "PER_KG", "PER_100KG"].includes(String(model || "").toUpperCase());
}

function chargeRulesFor(forwarder, destCountry, model) {
  if (!isWeightRateModel(model)) return [];
  const fk = normalizeKey(forwarder);
  return (STATE.chargeRules || []).filter((rule) => {
    const rk = normalizeKey(rule.forwarder || rule.provider || "");
    if (rk && rk !== fk) return false;
    const dc = String(rule.destCountry || "").trim().toUpperCase();
    if (dc && dc !== "#ALL" && dc !== String(destCountry || "").toUpperCase()) return false;
    return ["KG_PER_CBM", "KG_PER_LDM", "MIN_KG_PER_PALLET"].includes(String(rule.type || "").toUpperCase());
  });
}

function calculateChargeableWeight(forwarder, destCountry, model, input) {
  const real = Number.isFinite(input.weight) ? input.weight : NaN;
  if (!isWeightRateModel(model)) return { value: real, applied: false, basis: Number.isFinite(real) ? "Realgewicht" : "", candidates: [] };
  const rules = chargeRulesFor(forwarder, destCountry, model);
  if (!rules.length) return { value: real, applied: false, basis: Number.isFinite(real) ? "Realgewicht" : "", candidates: [] };

  const candidates = [];
  if (Number.isFinite(real)) candidates.push({ label: "Realgewicht", value: real });

  rules.forEach((rule) => {
    const type = String(rule.type || "").toUpperCase();
    const factor = Number(rule.factor);
    if (!Number.isFinite(factor) || factor <= 0) return;
    if (type === "KG_PER_CBM" && Number.isFinite(input.volume)) {
      candidates.push({ label: `${String(input.volume).replace('.', ',')} m³ × ${factor.toLocaleString('de-DE')} kg/m³`, value: input.volume * factor, rule });
    }
    if (type === "MIN_KG_PER_PALLET" && Number.isFinite(input.pallets)) {
      candidates.push({ label: `${String(input.pallets).replace('.', ',')} PLL × ${factor.toLocaleString('de-DE')} kg`, value: input.pallets * factor, rule });
    }
    if (type === "KG_PER_LDM" && Number.isFinite(input.loadMeters)) {
      const condition = String(rule.condition || "ALWAYS").toUpperCase();
      if (condition === "NON_STACKABLE" && !input.nonStackable) return;
      if (condition === "PALLET_THRESHOLD") {
        const threshold = Number(rule.thresholdPallets);
        if (!Number.isFinite(input.pallets) || !Number.isFinite(threshold) || input.pallets < threshold) return;
      }
      candidates.push({ label: `${String(input.loadMeters).replace('.', ',')} LDM × ${factor.toLocaleString('de-DE')} kg/LDM`, value: input.loadMeters * factor, rule });
    }
  });

  if (!candidates.length) return { value: real, applied: false, basis: Number.isFinite(real) ? "Realgewicht" : "", candidates: [] };
  candidates.sort((a,b)=>b.value-a.value);
  const best=candidates[0];
  return { value: best.value, applied: !Number.isFinite(real) || best.value > real + 0.0001, basis: best.label, candidates };
}

function rateMetricForModel(model, input) {
  const m = String(model || "LDM_STEP").toUpperCase();
  if (["WEIGHT_STEP", "PER_KG", "PER_100KG", "PACKAGE_WEIGHT_ZONE"].includes(m)) return input.weight;
  if (["PALLET_STEP", "PER_PALLET"].includes(m)) return input.pallets;
  if (["LDM_STEP", "PER_LDM"].includes(m)) return input.loadMeters;
  if (m === "FULL_LOAD") return 1;
  return NaN;
}

function rateMetricForRow(row, input) {
  const model = String(row.model || "LDM_STEP").toUpperCase();
  if (isWeightRateModel(model)) {
    return calculateChargeableWeight(row.forwarder, row.destCountry, model, input).value;
  }
  return rateMetricForModel(model, input);
}

function getRateRows(forwarder, destCountry, input) {
  return STATE.rates.filter((row) => {
    if (normalizeKey(row.forwarder) !== normalizeKey(forwarder) || row.originCountry !== ORIGIN_COUNTRY || row.destCountry !== destCountry) return false;
    const metric = rateMetricForRow(row, input);
    if (!Number.isFinite(metric)) return false;
    return metric >= row.from && metric <= row.to;
  });
}

function isPlaceholderPrice(value) {
  return Number.isFinite(value) && value >= PRICE_SENTINEL;
}

function calculateModelPrice(model, tariffPrice, metric) {
  const m = String(model || "LDM_STEP").toUpperCase();
  if (!Number.isFinite(tariffPrice)) return null;
  if (m === "PER_KG") return tariffPrice * metric;
  if (m === "PER_100KG") return tariffPrice * (metric / 100);
  if (m === "PER_LDM") return tariffPrice * metric;
  if (m === "PER_PALLET") return tariffPrice * metric;
  return tariffPrice;
}

function findRate(forwarder, destCountry, input, zone) {
  const tariffRows = getRateRows(forwarder, destCountry, input)
    .filter((row) => normalizeKey(row.unit) !== "minimum");
  if (!tariffRows.length) return null;

  tariffRows.sort((a, b) => {
    const am = rateMetricForRow(a, input), bm = rateMetricForRow(b, input);
    const aw = a.to - a.from, bw = b.to - b.from;
    if (aw !== bw) return aw - bw;
    return (a.to - b.to) || (am - bm);
  });

  for (const rateRow of tariffRows) {
    const tariffPrice = rateRow.zonePrices.get(zone);
    if (!Number.isFinite(tariffPrice) || isPlaceholderPrice(tariffPrice)) continue;
    const metric = rateMetricForRow(rateRow, input);
    const chargeable = isWeightRateModel(rateRow.model) ? calculateChargeableWeight(rateRow.forwarder, rateRow.destCountry, rateRow.model, input) : null;
    const appliedBasePrice = calculateModelPrice(rateRow.model, tariffPrice, metric);
    if (!Number.isFinite(appliedBasePrice)) continue;
    return {
      rateRow,
      tariffPrice,
      minimumPrice: null,
      appliedBasePrice: round2(appliedBasePrice),
      priceSource: String(rateRow.model || "LDM_STEP"),
      metric,
      model: String(rateRow.model || "LDM_STEP"),
      chargeable,
    };
  }
  return null;
}

function getSelectedShipmentType() {
  const selected = document.querySelector('input[name="shipmentType"]:checked');
  return selected?.value || "ftl";
}

function getEffectiveLoadMeters(shipmentType, loadMetersInput) {
  const config = SHIPMENT_TYPES[shipmentType] || SHIPMENT_TYPES.teilladung;
  if (config.fixedLdm != null) return config.fixedLdm;
  return parseNumberFlexible(loadMetersInput);
}

function validateInput({ destCountry, postalCode, shipmentType, loadMeters, weight, pallets, slots, volume, nonStackable, avis }) {
  if (!destCountry) return "Bitte zuerst ein Land wählen.";
  if (!postalCode || String(postalCode).trim().length < 2) return "Bitte eine gültige PLZ eingeben.";
  if (CALCULATION_MODE === "planning" && document.getElementById("recipientSelect")?.value === "manual" && !document.getElementById("recipientName")?.value?.trim()) return "Bitte bei einer neuen Entladestelle mindestens den Namen eingeben.";
  if (!SHIPMENT_TYPES[shipmentType]) return "Bitte eine Transportart wählen.";
  const cfg=getCalcFieldConfig();
  if (shipmentType === "teilladung" && cfg.teilladungLdm && !Number.isFinite(loadMeters)) return "Bitte Lademeter eingeben.";
  const checks={
    weight:Number.isFinite(weight),pallets:Number.isFinite(pallets),slots:Number.isFinite(slots),volume:Number.isFinite(volume),
    pickupDate:Boolean(document.getElementById("pickupDate")?.value),
    deliveryDate:Boolean(document.getElementById("deliveryDate")?.value),
    length:Number.isFinite(parseNumberFlexible(document.getElementById("shipmentLength")?.value||"")),
    width:Number.isFinite(parseNumberFlexible(document.getElementById("shipmentWidth")?.value||"")),
    height:Number.isFinite(parseNumberFlexible(document.getElementById("shipmentHeight")?.value||"")),
    nonStackable:Boolean(nonStackable),avis:Boolean(avis)
  };
  for(const key of ["pickupDate","deliveryDate","pallets","slots","weight","length","width","height","volume","nonStackable","avis"]){
    if(cfg[key] && !checks[key]) return `Bitte das Pflichtfeld „${calcFieldLabel(key)}“ ausfüllen.`;
  }
  const pickupRaw=document.getElementById("pickupDate")?.value||"";
  const deliveryRaw=document.getElementById("deliveryDate")?.value||"";
  const todayIso=new Date().toISOString().slice(0,10);
  if(pickupRaw&&pickupRaw<todayIso)return "Abholdatum kann nicht in der Vergangenheit liegen.";
  if(deliveryRaw&&deliveryRaw<todayIso)return "Liefertermin kann nicht in der Vergangenheit liegen.";
  if(pickupRaw&&deliveryRaw&&deliveryRaw<pickupRaw)return "Liefertermin darf nicht vor dem Abholdatum liegen.";
  const enteredHeight=parseNumberFlexible(document.getElementById("shipmentHeight")?.value||"");
  if(Number.isFinite(pallets)&&pallets>100)return "Maximal 100 Paletten pro Sendung.";
  const maxSlots=shipmentType==="jumbo"?38:34;
  if(Number.isFinite(slots)&&slots>maxSlots)return `Maximal ${maxSlots} Stellplätze bei ${SHIPMENT_TYPES[shipmentType]?.label||shipmentType}.`;
  const maxHeightCm=(shipmentType==="jumbo"||shipmentType==="mega")?300:270;
  if(Number.isFinite(enteredHeight)&&enteredHeight>maxHeightCm)return `Maximale Höhe ${String(maxHeightCm/100).replace(".",",")} m bei ${SHIPMENT_TYPES[shipmentType]?.label||shipmentType}.`;
  if (shipmentType === "teilladung" && !([loadMeters, weight, pallets, slots].some(Number.isFinite))) return "Bitte mindestens Lademeter, Gewicht, Paletten oder Stellplätze eingeben.";
  return null;
}

function diagnoseNoResults(destCountry, postalCode, input) {
  const zoneHits = [];
  const tariffHits = [];

  STATE.forwarders.forEach((forwarder) => {
    const zoneResult = findZone(forwarder, destCountry, postalCode);
    if (zoneResult) {
      zoneHits.push({ forwarder, zone: zoneResult.zone });
      const rateResult = findRate(forwarder, destCountry, input, zoneResult.zone);
      if (rateResult && Number.isFinite(rateResult.appliedBasePrice)) {
        tariffHits.push(forwarder);
      }
    }
  });

  if (!zoneHits.length) {
    return `Keine Zone gefunden. Für ${destCountry} ist die PLZ ${postalCode} in der zones.csv aktuell nicht abgedeckt.`;
  }
  if (!tariffHits.length) {
    return `Zone gefunden (${zoneHits[0].zone}), aber kein passender Tarif für die eingegebenen Mengen. Bitte Gewicht, Lademeter oder Paletten prüfen.`;
  }
  return "Für diese Kombination wurde kein berechenbarer Dienstleister gefunden.";
}

function buildCalculationForForwarder(forwarder, destCountry, postalCode, input) {
  const zoneResult = findZone(forwarder, destCountry, postalCode);
  if (!zoneResult) {
    return { forwarder, success: false, reason: "Keine Zone gefunden." };
  }

  const rateResult = findRate(forwarder, destCountry, input, zoneResult.zone);
  if (!rateResult) {
    return { forwarder, success: false, reason: "Kein Tarifband gefunden." };
  }

  if (!Number.isFinite(rateResult.appliedBasePrice)) {
    return { forwarder, success: false, reason: `Für Zone ${zoneResult.zone} ist in rates.csv kein Preis hinterlegt.` };
  }

  const floaterPercent = getFloaterPercent(forwarder);
  const floaterAmount = round2(rateResult.appliedBasePrice * (floaterPercent / 100));
  const total = round2(rateResult.appliedBasePrice + floaterAmount);

  return {
    forwarder,
    success: true,
    zone: zoneResult.zone,
    zoneMode: zoneResult.zoneMode,
    basePrice: rateResult.appliedBasePrice,
    floaterPercent,
    floaterAmount,
    total,
    priceSource: rateResult.priceSource,
    rateModel: rateResult.model,
    rateMetric: rateResult.metric,
    chargeable: rateResult.chargeable || null,
  };
}

function renderEmptyRow(text = "Noch keine Berechnung.") {
  const tbody = document.getElementById("resultsBody");
  if (!tbody) return;
  tbody.innerHTML = `<tr id="noResults"><td colspan="8" class="muted">${text}</td></tr>`;
}

function getEmailConfig(forwarder, destCountry) {
  const cfg = STATE.emails[normalizeKey(forwarder)];
  if (!cfg) return { availability: "", booking: "" };

  const country = String(destCountry || "").toUpperCase();
  const relationKey = country === "DE" ? "national" : "international";

  // Alte einfache Struktur weiter unterstützen:
  // "Emons": { "availability": "...", "booking": "..." }
  if (cfg.availability !== undefined || cfg.booking !== undefined) {
    return {
      availability: String(cfg.availability || "").trim(),
      booking: String(cfg.booking || "").trim(),
    };
  }

  const selected =
    cfg[country] ||
    cfg[relationKey] ||
    cfg.export ||
    cfg.all ||
    {};

  return {
    availability: String(selected.availability || "").trim(),
    booking: String(selected.booking || "").trim(),
  };
}

function createEmailButton(kind, forwarder) {
  const destCountry = document.getElementById("destCountry")?.value || "";
  const cfg = getEmailConfig(forwarder, destCountry);

  const address = kind === "booking" ? cfg.booking : cfg.availability;
  const label = kind === "booking" ? "Sendung buchen" : "Verfügbarkeit anfragen";

  if (!address) {
    return `<span class="email-missing">Keine E-Mail hinterlegt</span>`;
  }

  return `<button type="button" class="email-btn" onclick="createEmailRequest('${escapeJs(forwarder)}','${kind}')">${label}</button>`;
}

function createOfferAction(kind, forwarder, primary = false) {
  const destCountry = document.getElementById("destCountry")?.value || "";
  const cfg = getEmailConfig(forwarder, destCountry);
  const address = kind === "booking" ? cfg.booking : cfg.availability;
  const label = kind === "booking" ? "Sendung buchen" : "Verfügbarkeit anfragen";
  if (!address) return `<span class="offer-action unavailable">${label} · nicht hinterlegt</span>`;
  return `<button type="button" class="offer-action ${primary ? "primary-offer-action" : ""}" onclick="createEmailRequest('${escapeJs(forwarder)}','${kind}')">${label}</button>`;
}

function renderOfferCards(results) {
  const host = document.getElementById("offerCards");
  if (!host) return;
  host.innerHTML = "";
  const visible = results.slice(0, Math.min(3, results.length));

  visible.forEach((result, index) => {
    const card = document.createElement("article");
    card.className = `offer-card ${index === 0 ? "recommended" : ""}`;
    const saving = index > 0 ? round2(result.total - results[0].total) : 0;
    card.innerHTML = `
      <div class="offer-card-top">
        <div class="offer-provider-block">
          ${index === 0 ? '<span class="recommendation-badge">Empfohlen · Bestpreis</span>' : `<span class="alternative-badge">Alternative ${index + 1}</span>`}
          <div class="provider-name-row">${providerVisualHtml(result.forwarder)}<h3>${escapeHtml(result.forwarder)}</h3></div>
        </div>
        <div class="offer-price-wrap">
          <span class="offer-price-label">Gesamtpreis</span>
          <strong class="offer-price">${money(result.total)}</strong>
          ${index > 0 ? `<span class="offer-difference">+ ${money(saving)} zum Bestpreis</span>` : '<span class="offer-difference best">Niedrigster berechneter Preis</span>'}
        </div>
      </div>
      <div class="offer-breakdown">
        <div><span>Basisfracht</span><strong>${money(result.basePrice)}</strong></div>
        <div><span>Floater</span><strong>${percent(result.floaterPercent)}</strong></div>
        <div><span>Floater €</span><strong>${money(result.floaterAmount)}</strong></div>
      </div>
      ${result.chargeable && Number.isFinite(result.chargeable.value) && result.chargeable.candidates?.length ? `<div class="offer-chargeable-note"><strong>Frachtpflichtiges Gewicht: ${Math.ceil(result.chargeable.value).toLocaleString('de-DE')} kg</strong><br>${escapeHtml(result.chargeable.basis)}${result.chargeable.applied ? ' · Sperrigkeit/Mindestgewicht greift' : ' · Realgewicht bleibt maßgeblich'}</div>` : ''}
      <div class="offer-actions">
        ${createOfferAction("availability", result.forwarder, false)}
        ${createOfferAction("booking", result.forwarder, index === 0)}
      </div>
    `;
    host.appendChild(card);
  });
}

function renderResults(results) {
  const tbody = document.getElementById("resultsBody");
  if (!tbody) return;

  tbody.innerHTML = "";
  renderOfferCards(results);

  if (!results.length) {
    renderEmptyRow("Keine berechenbaren Ergebnisse gefunden.");
    return;
  }

  results.forEach((result, index) => {
    const tr = document.createElement("tr");
    if (index === 0) tr.className = "best-row";
    tr.innerHTML = `
      <td>
        ${index === 0 ? '<span class="rank-badge">Bestpreis</span>' : ''}
        <span class="provider-table-name">${providerVisualHtml(result.forwarder, "provider-visual-sm")}<span class="provider-name">${escapeHtml(result.forwarder)}</span></span>
      </td>
      <td class="right">${escapeHtml(result.zone)}</td>
      <td class="right">${money(result.basePrice)}</td>
      <td class="right">${percent(result.floaterPercent)}</td>
      <td class="right">${money(result.floaterAmount)}</td>
      <td class="right total-strong">${money(result.total)}</td>
      <td>${createEmailButton("availability", result.forwarder)}</td>
      <td>${createEmailButton("booking", result.forwarder)}</td>
    `;
    tbody.appendChild(tr);
  });
}


const GPK_STORAGE = {
  calculations: GPK.KEYS.calculations,
  operations: GPK.KEYS.operations,
};

function readDemoStore(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function writeDemoStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (_) {}
}

function makeOperationId() {
  const KEY="gpk_operation_numbering_v1",now=new Date();
  let cfg={prefix:"GPK",format:"date-seq",next:1};try{cfg={...cfg,...JSON.parse(localStorage.getItem(KEY)||"{}")};}catch(_){}
  const prefix=String(cfg.prefix||"GPK").trim().toUpperCase()||"GPK",yy=String(now.getFullYear()).slice(-2),mm=String(now.getMonth()+1).padStart(2,"0"),dd=String(now.getDate()).padStart(2,"0");
  if(cfg.format==="datetime"){const time=String(now.getHours()).padStart(2,"0")+String(now.getMinutes()).padStart(2,"0")+String(now.getSeconds()).padStart(2,"0");return `${prefix}-${yy}${mm}${dd}-${time}`;}
  const seq=Math.max(1,Number(cfg.next)||1);cfg.next=seq+1;try{localStorage.setItem(KEY,JSON.stringify(cfg));}catch(_){}
  const n=String(seq).padStart(4,"0");
  if(cfg.format==="custom"){
    const pattern=String(cfg.custom||"{PREFIX}-{YY}{MM}{DD}-{SEQ4}");
    return pattern.replaceAll("{PREFIX}",prefix).replaceAll("{YYYY}",String(now.getFullYear())).replaceAll("{YY}",yy).replaceAll("{MM}",mm).replaceAll("{DD}",dd).replaceAll("{SEQ4}",n).replaceAll("{SEQ}",String(seq));
  }
  return cfg.format==="seq"?`${prefix}-${n}`:`${prefix}-${yy}${mm}${dd}-${n}`;
}

function getCurrentOffer(forwarder) {
  return (STATE.latestResults || []).find((r) => r.forwarder === forwarder) || null;
}

function getCurrentWorkflowData(forwarder) {
  const country = document.getElementById("destCountry")?.value?.trim() || "";
  const plz = document.getElementById("postalCode")?.value?.trim() || "";
  const shipmentType = getSelectedShipmentType();
  const shipmentLabel = SHIPMENT_TYPES[shipmentType]?.label || shipmentType;
  const effectiveLoadMeters = getEffectiveLoadMeters(shipmentType, document.getElementById("loadMeters")?.value || "");
  const weight = parseNumberFlexible(document.getElementById("shipmentWeight")?.value || "");
  const pallets = parseNumberFlexible(document.getElementById("shipmentPallets")?.value || "");
  const slots = parseNumberFlexible(document.getElementById("shipmentSlots")?.value || "");
  const volume = parseNumberFlexible(document.getElementById("shipmentVolume")?.value || "");
  const nonStackable = Boolean(document.getElementById("shipmentNonStackable")?.checked);
  const avis = Boolean(document.getElementById("shipmentAvis")?.checked);
  const recipient = getSelectedRecipient();
  const offer = getCurrentOffer(forwarder);
  const deliveryRaw = document.getElementById("deliveryDate")?.value || "";
  const pickupRaw = document.getElementById("pickupDate")?.value || "";
  const customer = recipient ? (recipient.name || recipient.company || formatRecipientOption(recipient)) : "Nicht angegeben";
  const transportParts = [shipmentLabel];
  if (shipmentType === "teilladung" && Number.isFinite(effectiveLoadMeters)) transportParts.push(`${String(effectiveLoadMeters).replace(".", ",")} Ldm`);
  if (Number.isFinite(weight)) transportParts.push(`${weight.toLocaleString("de-DE")} kg`);
  if (Number.isFinite(pallets)) transportParts.push(`${String(pallets).replace(".", ",")} Paletten`);
  if (Number.isFinite(slots)) transportParts.push(`${String(slots).replace(".", ",")} Stellplätze`);
  if (Number.isFinite(volume)) transportParts.push(`${String(volume).replace(".", ",")} m³`);
  if (nonStackable) transportParts.push(`nicht stapelbar`);
  if (avis) transportParts.push(`Avis`);
  const transport = transportParts.join(" · ");

  return {
    country,
    plz,
    provider: forwarder,
    price: offer?.total || 0,
    basePrice: offer?.basePrice || 0,
    floaterPercent: offer?.floaterPercent || 0,
    floaterAmount: offer?.floaterAmount || 0,
    relation: `${ORIGIN_COUNTRY} → ${country} ${plz}`.trim(),
    transport,
    customer,
    pickupRaw,
    deliveryRaw,
    pickup: formatDisplayDate(pickupRaw),
    delivery: formatDisplayDate(deliveryRaw),
    loadMeters: Number.isFinite(effectiveLoadMeters)?effectiveLoadMeters:null,
    weight,pallets,slots,volume,nonStackable,avis,
    length:parseNumberFlexible(document.getElementById("shipmentLength")?.value||""),
    width:parseNumberFlexible(document.getElementById("shipmentWidth")?.value||""),
    height:parseNumberFlexible(document.getElementById("shipmentHeight")?.value||""),
    note: document.getElementById("freeText")?.value?.trim() || "",
  };
}

function saveCalculationSnapshot(results) {
  if (!results?.length) return;
  const best = results[0];
  const d = getCurrentWorkflowData(best.forwarder);
  const list = readDemoStore(GPK_STORAGE.calculations);
  const now = new Date();
  list.unshift({
    id: makeOperationId().replace("GPK-", "CALC-"),
    createdAt: now.toISOString(),
    provider: best.forwarder,
    price: best.total,
    basePrice: best.basePrice,
    floaterPercent: best.floaterPercent,
    secondPrice: results[1]?.total ?? best.total,
    saving: results[1] ? Math.max(0, results[1].total - best.total) : 0,
    country: d.country,
    postalCode: d.plz,
    zone: best.zone || "",
    rateModel: best.rateModel || best.priceSource || "",
    shipmentType: getSelectedShipmentType(),
    pallets: parseNumberFlexible(document.getElementById("shipmentPallets")?.value || ""),
    slots: parseNumberFlexible(document.getElementById("shipmentSlots")?.value || ""),
    weight: parseNumberFlexible(document.getElementById("shipmentWeight")?.value || ""),
    volume: parseNumberFlexible(document.getElementById("shipmentVolume")?.value || ""),
    relation: d.relation,
    transport: d.transport,
    customer: d.customer,
    pickup: d.pickup,
    delivery: d.delivery,
    mode: CALCULATION_MODE,
  });
  writeDemoStore(GPK_STORAGE.calculations, list.slice(0, 500));
}

function saveWorkflowOperation(forwarder, kind) {
  const d = getCurrentWorkflowData(forwarder);
  const list = readDemoStore(GPK_STORAGE.operations);
  const now = new Date();
  const operation = {
    id: makeOperationId(),
    type: kind === "booking" ? "booking" : "availability",
    relation: d.relation,
    provider: d.provider,
    price: Math.round((d.price || 0)*100)/100,
    status: kind === "booking" ? "booked" : "waiting",
    date: d.delivery || "—",
    user: "Disposition",
    transport: d.transport,
    customer: d.customer,
    created: now.toLocaleDateString("de-DE") + " · " + now.toLocaleTimeString("de-DE", {hour:"2-digit", minute:"2-digit"}),
    createdAt: now.toISOString(),
    note: kind === "booking"
      ? "Buchung aus der Kalkulation erstellt."
      : "Verfügbarkeitsanfrage aus der Kalkulation erstellt.",
    pickup: d.pickup,
    delivery: d.delivery,
    basePrice: d.basePrice,
    floaterPercent: d.floaterPercent,
    floaterAmount: d.floaterAmount,
    ancillaryAmount: Number(d.ancillaryAmount||0)||0,
    loadMeters:d.loadMeters,
    weight:d.weight,pallets:d.pallets,slots:d.slots,volume:d.volume,
    length:d.length,width:d.width,height:d.height,nonStackable:d.nonStackable,avis:d.avis,
    history: [],
  };
  list.unshift(operation);
  writeDemoStore(GPK_STORAGE.operations, list.slice(0, 500));
  return operation;
}

function showMissingEmail(forwarder, kind) {
  const label = kind === "booking" ? "Buchung" : "Verfügbarkeit";
  alert(`Für ${forwarder} ist noch keine E-Mail-Adresse für ${label} in emails.json hinterlegt.`);
}

function createEmailRequest(forwarder, kind) {
  if (!ensurePlanningForAction(kind)) return;
  const country = document.getElementById("destCountry")?.value?.trim() || "";
  const cfg = getEmailConfig(forwarder, country);
  const to = kind === "booking" ? cfg.booking : cfg.availability;
  if (!to) {
    showMissingEmail(forwarder, kind);
    return;
  }


  const plz = document.getElementById("postalCode")?.value?.trim() || "";
  const shipmentType = getSelectedShipmentType();
  const shipmentLabel = SHIPMENT_TYPES[shipmentType]?.label || shipmentType;
  const effectiveLoadMeters = getEffectiveLoadMeters(shipmentType, document.getElementById("loadMeters")?.value || "");
const pickupDate = formatDisplayDate(document.getElementById("pickupDate")?.value || "");
const deliveryDate = formatDisplayDate(document.getElementById("deliveryDate")?.value || "");
const freeText = document.getElementById("freeText")?.value?.trim() || "";

  const subjectPrefix = kind === "booking" ? "Sendungsbuchung" : "Verfügbarkeitsanfrage";
  const subject = encodeURIComponent(`${subjectPrefix} ${country} ${plz}`.trim());

  let bodyText = `Guten Tag zusammen,

ich benötige für folgende Relation ${kind === "booking" ? "eine Buchung" : "eine Verfügbarkeitsprüfung"}:

`;
  bodyText += `Land ${country || "-"}
`;
  bodyText += `PLZ ${plz || "-"}\n`;
  const recipient = getSelectedRecipient();
  if (recipient) {
    bodyText += `Entladestelle ${formatRecipientOption(recipient) || "-"}\n`;
  }
  bodyText += `Transportart ${shipmentLabel}
`;
  if (shipmentType === "teilladung") {
    bodyText += `Lademeter ${Number.isFinite(effectiveLoadMeters) ? String(effectiveLoadMeters).replace('.', ',') : "-"}
`;
  }
  const emailWeight = parseNumberFlexible(document.getElementById("shipmentWeight")?.value || "");
  const emailPallets = parseNumberFlexible(document.getElementById("shipmentPallets")?.value || "");
  const emailSlots = parseNumberFlexible(document.getElementById("shipmentSlots")?.value || "");
  if (Number.isFinite(emailWeight)) bodyText += `Gewicht ${emailWeight.toLocaleString("de-DE")} kg\n`;
  if (Number.isFinite(emailPallets)) bodyText += `Paletten / Stellplätze ${String(emailPallets).replace('.', ',')}\n`;
bodyText += `Abholdatum ${pickupDate}
`;
bodyText += `Liefertermin ${deliveryDate}
`;
  if (freeText) bodyText += `Hinweis ${freeText}
`;
  bodyText += `
Vielen Dank und kurze Rückmeldung.`;

  const body = encodeURIComponent(bodyText);
  const savedOperation = saveWorkflowOperation(forwarder, kind);
  try {
    sessionStorage.setItem("gpk_last_operation_id", savedOperation.id);
  } catch (_) {}
  window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
}

function updatePostalPlaceholder() {
  const countrySelect = document.getElementById("destCountry");
  const postalInput = document.getElementById("postalCode");
  if (!countrySelect || !postalInput) return;

  const country = String(countrySelect.value || "").toUpperCase();
  postalInput.placeholder = POSTAL_PLACEHOLDERS[country] || "z. B. 24939";
}

function updateTransportUi() {
  const shipmentType = getSelectedShipmentType();
  const loadMetersField = document.getElementById("loadMetersField");
  const summaryLdmRow = document.getElementById("summaryLdmRow");

  document.querySelectorAll(".transport-option").forEach((el) => {
    const input = el.querySelector("input");
    el.classList.toggle("active", !!input?.checked);
  });

  if (loadMetersField) {
    loadMetersField.style.display = shipmentType === "teilladung" ? "grid" : "none";
  }
  if (summaryLdmRow) {
    summaryLdmRow.style.display = shipmentType === "teilladung" ? "flex" : "none";
  }
}

function initCalculatorPage() {
  const form = document.getElementById("calculatorForm");
  if (!form) return;

  const countrySelect = document.getElementById("destCountry");
  const postalInput = document.getElementById("postalCode");
  const loadMetersInput = document.getElementById("loadMeters");
  const shipmentWeightInput = document.getElementById("shipmentWeight");
  const shipmentPalletsInput = document.getElementById("shipmentPallets");
  const shipmentSlotsInput = document.getElementById("shipmentSlots");
  const shipmentVolumeInput = document.getElementById("shipmentVolume");
  const shipmentLengthInput = document.getElementById("shipmentLength");
  const shipmentWidthInput = document.getElementById("shipmentWidth");
  const shipmentHeightInput = document.getElementById("shipmentHeight");
  const shipmentNonStackableInput = document.getElementById("shipmentNonStackable");
  const shipmentAvisInput = document.getElementById("shipmentAvis");
  const shipmentDimensions = document.getElementById("shipmentDimensions");
  const shipmentVolumeModeBtn = document.getElementById("shipmentVolumeModeBtn");
const pickupDateInput = document.getElementById("pickupDate");
const deliveryDateInput = document.getElementById("deliveryDate");
const freeTextInput = document.getElementById("freeText");
  const messageBox = document.getElementById("messageBox");
  const summaryBox = document.getElementById("summaryBox");
  const summaryStatus = document.getElementById("summaryStatus");
  const resultsSection = document.getElementById("resultsSection");
  const transportSwitch = document.getElementById("transportSwitch");
  const toggleComparison = document.getElementById("toggleComparison");
  const comparisonTable = document.getElementById("comparisonTable");
  const detailComparisonSection = document.getElementById("detailComparisonSection");
  toggleComparison?.addEventListener("click", () => {
    const opening = detailComparisonSection?.style.display === "none";
    if (detailComparisonSection) detailComparisonSection.style.display = opening ? "block" : "none";
    if (toggleComparison) toggleComparison.innerHTML = opening
      ? 'Detailvergleich ausblenden <span aria-hidden="true">↑</span>'
      : 'Detailvergleich anzeigen <span aria-hidden="true">↓</span>';
  });

  document.querySelectorAll(".mode-option").forEach((button) => {
    button.addEventListener("click", () => setCalculationMode(button.dataset.mode));
  });
  setCalculationMode("planning");

  const countries = Array.from(new Set(
    STATE.rates
      .filter((row) => row.originCountry === ORIGIN_COUNTRY)
      .map((row) => row.destCountry),
  )).sort();

  countries.forEach((country) => {
    const option = document.createElement("option");
    option.value = country;
    option.textContent = country;
    countrySelect.appendChild(option);
  });


  function refreshLdmSuggestions(){
    const list=document.getElementById("loadMetersSuggestions");if(!list)return;
    const dest=String(countrySelect?.value||"").toUpperCase();
    const values=new Set();
    /* Zuerst tatsächlich vorhandene LDM-Tarifgrenzen anbieten. */
    (STATE.rates||[]).forEach(r=>{
      const model=String(r.model||"").toUpperCase();
      if(!["LDM_STEP","PER_LDM"].includes(model))return;
      if(dest&&r.destCountry&&String(r.destCountry).toUpperCase()!==dest)return;
      [r.from,r.to].forEach(v=>{const n=Number(v);if(Number.isFinite(n)&&n>0&&n<=15)values.add(Math.round(n*100)/100);});
    });
    /* Frei editierbar bleibt es trotzdem; diese üblichen Stufen helfen bei dünnen Tarifen. */
    for(let n=.5;n<=13.6;n+=.5)values.add(Math.round(n*10)/10);
    [7.5,8,9,10,11,12,12.5,13,13.2,13.6].forEach(v=>values.add(v));
    list.innerHTML=[...values].sort((a,b)=>a-b).map(v=>`<option value="${String(v).replace(".",",")}"></option>`).join("");
  }

  function showMessage(text, kind = "warn") {
    messageBox.textContent = text;
    messageBox.className = `notice ${kind}`;
    messageBox.style.display = text ? "block" : "none";
  }

  function applyCalcFieldConfig(){
    const cfg=getCalcFieldConfig();
    document.querySelectorAll("[data-calc-field]").forEach(wrap=>{
      const key=wrap.dataset.calcField;
      wrap.classList.toggle("required-field",Boolean(cfg[key]));
      const label=wrap.querySelector("label, strong");
      if(label && cfg[key] && !label.querySelector?.(".required-star")){
        if(label.tagName==="LABEL")label.insertAdjacentHTML("beforeend",' <span class="required-star">*</span>');
      }
    });
    const ldmWrap=document.getElementById("loadMetersField");
    ldmWrap?.classList.toggle("required-field",Boolean(cfg.teilladungLdm));
  }
  function autoCalculateVolume(){
    const l=parseNumberFlexible(shipmentLengthInput?.value||"");
    const w=parseNumberFlexible(shipmentWidthInput?.value||"");
    const h=parseNumberFlexible(shipmentHeightInput?.value||"");
    if([l,w,h].every(Number.isFinite) && l>0 && w>0 && h>0 && shipmentVolumeInput){
      shipmentVolumeInput.value=String(Math.round((l*w*h/1000000)*1000)/1000).replace(".",",");
      shipmentVolumeInput.dataset.autoCalculated="1";
    }
  }
  [shipmentLengthInput,shipmentWidthInput,shipmentHeightInput].forEach(el=>el?.addEventListener("input",autoCalculateVolume));
  shipmentVolumeInput?.addEventListener("input",()=>{shipmentVolumeInput.dataset.autoCalculated="0";});
  shipmentVolumeModeBtn?.addEventListener("click",()=>{const show=Boolean(shipmentDimensions?.hidden);if(shipmentDimensions)shipmentDimensions.hidden=!show;shipmentVolumeModeBtn.textContent=show?"Maße schließen":"Maße öffnen";if(show)shipmentLengthInput?.focus();});
  applyCalcFieldConfig();

  countrySelect?.addEventListener("change", () => { updatePostalPlaceholder(); renderRecipientSelection(); refreshLdmSuggestions(); });
  postalInput?.addEventListener("change", renderRecipientSelection);
  postalInput?.addEventListener("blur", renderRecipientSelection);
  document.getElementById("recipientSelect")?.addEventListener("change", onRecipientSelectChange);
  transportSwitch?.addEventListener("change", updateTransportUi);
  updatePostalPlaceholder();
  updateTransportUi();
  refreshLdmSuggestions();


  function setCalcFieldError(input, message, errorEl){
    if(!input)return;
    input.classList.toggle("input-error",Boolean(message));
    input.closest(".field")?.classList.toggle("field-has-error",Boolean(message));
    if(errorEl){errorEl.textContent=message||"";errorEl.hidden=!message;}
  }
  function validateOperationalLimitsLive(){
    const shipmentType=getSelectedShipmentType();
    const slots=parseNumberFlexible(shipmentSlotsInput?.value||"");
    const height=parseNumberFlexible(shipmentHeightInput?.value||"");
    const maxSlots=shipmentType==="jumbo"?38:34;
    const maxHeight=(shipmentType==="jumbo"||shipmentType==="mega")?300:270;
    setCalcFieldError(shipmentSlotsInput,Number.isFinite(slots)&&slots>maxSlots?`Maximal ${maxSlots} Stellplätze.`:"",document.getElementById("shipmentSlotsError"));
    setCalcFieldError(shipmentHeightInput,Number.isFinite(height)&&height>maxHeight?`Maximal ${String(maxHeight/100).replace(".",",")} m.`:"",document.getElementById("shipmentHeightError"));
  }
  [shipmentSlotsInput,shipmentHeightInput].forEach(el=>el?.addEventListener("input",validateOperationalLimitsLive));
  transportSwitch?.addEventListener("change",validateOperationalLimitsLive);
  [pickupDateInput,deliveryDateInput].forEach(el=>el?.addEventListener("change",()=>{
    const today=new Date().toISOString().slice(0,10);
    if(el.value&&el.value<today){el.classList.add("input-error");showMessage(el===pickupDateInput?"Abholdatum kann nicht in der Vergangenheit liegen.":"Liefertermin kann nicht in der Vergangenheit liegen.","danger");}
    else el.classList.remove("input-error");
  }));

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const shipmentType = getSelectedShipmentType();
    const effectiveLoadMeters = getEffectiveLoadMeters(shipmentType, loadMetersInput.value);
    const input = {
      destCountry: countrySelect.value,
      postalCode: postalInput.value.trim(),
      shipmentType,
      loadMeters: effectiveLoadMeters,
      weight: parseNumberFlexible(shipmentWeightInput?.value || ""),
      pallets: parseNumberFlexible(shipmentPalletsInput?.value || ""),
      slots: parseNumberFlexible(shipmentSlotsInput?.value || ""),
      volume: parseNumberFlexible(shipmentVolumeInput?.value || ""),
      nonStackable: Boolean(shipmentNonStackableInput?.checked),
      avis: Boolean(shipmentAvisInput?.checked),
    };

    const validationError = validateInput(input);
    if (validationError) {
      showMessage(validationError, "danger");
      messageBox.scrollIntoView({behavior:"smooth",block:"center"});
      validateOperationalLimitsLive();
      if(validationError.includes("Stellplätze"))shipmentSlotsInput?.focus();
      else if(validationError.includes("Abholdatum"))pickupDateInput?.focus();
      else if(validationError.includes("Liefertermin"))deliveryDateInput?.focus();
      resultsSection.style.display = "none";
      document.body.classList.remove("has-results");
      if (detailComparisonSection) detailComparisonSection.style.display = "none";
      if (toggleComparison) toggleComparison.innerHTML = 'Detailvergleich anzeigen <span aria-hidden="true">↓</span>';
      summaryBox.style.display = "none";
      renderEmptyRow();
      return;
    }

    const successfulResults = [];
    const errors = [];

    STATE.forwarders.forEach((forwarder) => {
      const result = buildCalculationForForwarder(forwarder, input.destCountry, input.postalCode, input);
      if (result.success) successfulResults.push(result);
      else errors.push(`${forwarder}: ${result.reason}`);
    });

    successfulResults.sort((a, b) => a.total - b.total || a.forwarder.localeCompare(b.forwarder, "de"));

    if (!successfulResults.length) {
      showMessage(diagnoseNoResults(input.destCountry, input.postalCode, input), "danger");
      resultsSection.style.display = "none";
      document.body.classList.remove("has-results");
      if (detailComparisonSection) detailComparisonSection.style.display = "none";
      if (toggleComparison) toggleComparison.innerHTML = 'Detailvergleich anzeigen <span aria-hidden="true">↓</span>';
      summaryBox.style.display = "none";
      renderEmptyRow();
      return;
    }

    STATE.latestResults = successfulResults;
    renderResults(successfulResults);
    if (comparisonTable) comparisonTable.style.display = "none";
    if (toggleComparison) toggleComparison.innerHTML = 'Alle Angebote im Detail vergleichen <span aria-hidden="true">↓</span>';

    const cheapest = successfulResults[0];
    saveCalculationSnapshot(successfulResults);
    const shipmentLabel = SHIPMENT_TYPES[shipmentType]?.label || "—";
    document.getElementById("summaryCountry").textContent = input.destCountry;
    document.getElementById("summaryPostal").textContent = input.postalCode;
    const selectedRecipient = getSelectedRecipient();
    document.getElementById("summaryRecipient").textContent = selectedRecipient
      ? formatRecipientOption(selectedRecipient)
      : (CALCULATION_MODE === "price" ? "Nicht erforderlich · Preisauskunft" : "—");
    document.getElementById("summaryShipmentType").textContent = shipmentLabel;
document.getElementById("summaryLdm").textContent = Number.isFinite(input.loadMeters) ? String(input.loadMeters).replace('.', ',') : "—";
document.getElementById("summaryWeight").textContent = Number.isFinite(input.weight) ? `${input.weight.toLocaleString("de-DE")} kg` : "—";
document.getElementById("summaryPallets").textContent = Number.isFinite(input.pallets) ? String(input.pallets).replace('.', ',') : "—";
document.getElementById("summarySlots").textContent = Number.isFinite(input.slots) ? String(input.slots).replace('.', ',') : "—";
document.getElementById("summaryVolume").textContent = Number.isFinite(input.volume) ? `${String(input.volume).replace('.', ',')} m³` : "—";
document.getElementById("summaryServices").textContent = [input.nonStackable?"Nicht stapelbar":"",input.avis?"Avis":""].filter(Boolean).join(" · ") || "—";
document.getElementById("summaryPickupDate").textContent = formatDisplayDate(pickupDateInput.value);
document.getElementById("summaryDeliveryDate").textContent = formatDisplayDate(deliveryDateInput.value);
    document.getElementById("summaryFreeText").textContent = freeTextInput.value.trim() || "—";
    document.getElementById("summaryCount").textContent = String(successfulResults.length);
    document.getElementById("summaryBest").innerHTML = `<span class="summary-provider-brand">${providerVisualHtml(cheapest.forwarder, "provider-visual-lg")}<span><span class="summary-provider-name">${escapeHtml(cheapest.forwarder)}</span><span class="summary-provider-price">${money(cheapest.total)}</span></span></span>`;

    updateTransportUi();
    summaryBox.style.display = "grid";
    resultsSection.style.display = "block";
    document.body.classList.add("has-results");
    if (detailComparisonSection) detailComparisonSection.style.display = "none";
    if (toggleComparison) toggleComparison.innerHTML = 'Detailvergleich anzeigen <span aria-hidden="true">↓</span>';


    showMessage("", "success");
    if (summaryStatus) {
      summaryStatus.textContent = errors.length
        ? `Berechnung erfolgreich · ${successfulResults.length} Angebote · ${errors.length} ohne Ergebnis`
        : `Berechnung erfolgreich · ${successfulResults.length} Angebote`;
    }
  });

  form.addEventListener("reset", () => {
    setTimeout(() => {
      const ftlRadio = document.querySelector('input[name="shipmentType"][value="ftl"]');
      if (ftlRadio) ftlRadio.checked = true;
if (pickupDateInput) pickupDateInput.value = "";
if (deliveryDateInput) deliveryDateInput.value = "";
if (freeTextInput) freeTextInput.value = "";
      ["recipientName","recipientStreet","recipientCity"].forEach((id) => { const el = document.getElementById(id); if (el) el.value = ""; });
      updatePostalPlaceholder();
      renderRecipientSelection();
      updateTransportUi();
      showMessage("", "warn");
      summaryBox.style.display = "none";
      resultsSection.style.display = "none";
      document.body.classList.remove("has-results");
      if (detailComparisonSection) detailComparisonSection.style.display = "none";
      if (toggleComparison) toggleComparison.innerHTML = 'Detailvergleich anzeigen <span aria-hidden="true">↓</span>';
      if (comparisonTable) comparisonTable.style.display = "none";
      renderEmptyRow();
    }, 0);
  });
}

async function boot() {
  await Promise.all([loadZones(), loadRates(), loadFloaterConfig(), loadEmailConfig(), loadAddresses(), loadProviderConfig()]);
  initCalculatorPage();
}

window.addEventListener("DOMContentLoaded", () => {
  boot().catch((error) => {
    const el = document.getElementById("fatalError");
    if (el) {
      el.textContent = `Fehler beim Laden der Daten: ${error.message}`;
      el.style.display = "block";
      el.className = "notice danger";
    } else {
      alert(`Fehler beim Laden der Daten: ${error.message}`);
    }
    console.error(error);
  });
});


function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeJs(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}
