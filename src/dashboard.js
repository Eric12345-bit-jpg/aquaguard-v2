import { LANGUAGES, translate } from "/lib/i18n.mjs";

const ROUTES = { "/": "Overview", "/live-monitoring": "Live Monitoring", "/devices": "Devices", "/alerts": "Alerts", "/settings": "Settings" };
const PATHS = Object.fromEntries(Object.entries(ROUTES).map(([path, section]) => [section, path]));
const LOCAL_DASHBOARD_URL = "http://192.168.4.1/";
const OUTAGE_NOTICE_MS = 120_000;
const POLL_VISIBLE_MS = 5000;
const POLL_HIDDEN_MS = 10_000;
const state = {
  section: ROUTES[location.pathname] || "Overview",
  mode: "live",
  language: localStorage.getItem("aquaguard-language") || "en",
  languageSyncPending: localStorage.getItem("aquaguard-language-pending") === "1",
  liveReading: null,
  simulationReading: null,
  ai: null,
  devices: [],
  alerts: [],
  openAlertCount: null,
  thresholds: { flowDifference: 2 },
  supabaseConfigured: false,
  connectivityNotice: false,
  backendUnavailable: false,
  cachedAt: null
};
const root = document.querySelector("#app");
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (value, digits = 1) => value === null || value === undefined || !Number.isFinite(Number(value)) ? "—" : Number(value).toFixed(digits);
const currentReading = () => state.mode === "simulation" ? state.simulationReading : state.liveReading;
const isSimulation = () => state.mode === "simulation" && Boolean(state.simulationReading);
const langLabel = () => LANGUAGES.find(item => item.code === state.language)?.label || "English";

function nav(section) {
  state.section = section;
  const path = PATHS[section] || "/";
  if (location.pathname !== path) history.pushState({}, "", path);
  render();
}
window.addEventListener("popstate", () => { state.section = ROUTES[location.pathname] || "Overview"; render(); });

function icon(name, size = 18) {
  const p = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    activity: '<path d="M3 12h4l2.2-7 4.1 14L16 12h5"/>', cpu: '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.8 1.8 0 0 0 .4 2l-1.8 1.8a1.8 1.8 0 0 0-2-.4 1.8 1.8 0 0 0-1.1 1.6v.4h-2.6V20a1.8 1.8 0 0 0-1.1-1.6 1.8 1.8 0 0 0-2 .4L7.4 17a1.8 1.8 0 0 0 .4-2 1.8 1.8 0 0 0-1.6-1.1h-.4v-2.6h.4a1.8 1.8 0 0 0 1.6-1.1 1.8 1.8 0 0 0-.4-2l1.8-1.8a1.8 1.8 0 0 0 2 .4 1.8 1.8 0 0 0 1.1-1.6v-.4h2.6v.4a1.8 1.8 0 0 0 1.1 1.6 1.8 1.8 0 0 0 2-.4l1.8 1.8a1.8 1.8 0 0 0-.4 2 1.8 1.8 0 0 0 1.6 1.1h.4v2.6h-.4a1.8 1.8 0 0 0-1.6 1.1Z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', cloud: '<path d="M7.5 18H17a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.1 8.2 4.5 4.5 0 0 0 7.5 18Z"/>',
    shield: '<path d="M12 3 19 6v5.5c0 4.3-2.9 7.7-7 9.5-4.1-1.8-7-5.2-7-9.5V6l7-3Z"/><path d="m8.5 12 2.2 2.2 4.6-4.7"/>',
    check: '<path d="m5 12 4 4L19 6"/>'
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${p[name] || p.grid}</svg>`;
}

function outageNotice() {
  return `<section class="notice outage-notice" role="alert"><strong>${escapeHtml(translate("internetLost", state.language))}</strong><p>Cloud readings may be stale. Leak detection, valve control, LCD, buzzer and GSM SMS continue locally on the ESP32 while it has power.</p><a class="primary-button" href="${LOCAL_DASHBOARD_URL}" target="_blank" rel="noopener noreferrer">${escapeHtml(translate("enterOffline", state.language))}</a><small>Connect this computer to Wi-Fi <b>AquaGuard-ESP32</b> first; then open <code>http://192.168.4.1/</code>.</small></section>`;
}

function shell(content) {
  const items = [["Overview", "grid"], ["Live Monitoring", "activity"], ["Devices", "cpu"], ["Alerts", "bell"], ["Settings", "settings"]];
  root.innerHTML = `<div class="app-shell"><aside class="sidebar" id="sidebar"><div class="brand"><div class="brand-mark">${icon("shield", 28)}</div><div class="brand-name">AquaGuard<span>Rwanda</span></div></div><div class="nav-label">Workspace</div><nav class="nav" aria-label="Primary navigation">${items.map(([label, glyph]) => `<button class="nav-item ${state.section === label ? "active" : ""}" data-nav="${label}">${icon(glyph)}<span>${label}</span></button>`).join("")}</nav><div class="sidebar-foot"><strong>Smart Water Network</strong><span>Local-first monitoring</span></div></aside><main class="main"><header class="topbar"><div class="breadcrumb"><strong>AquaGuard Rwanda</strong><span>/</span><span>${escapeHtml(state.section)}</span></div><div class="top-actions"><div class="pulse-status"><span class="status-dot ${state.backendUnavailable ? "offline" : ""}"></span>${state.backendUnavailable ? "Cloud/API unavailable" : state.mode === "simulation" ? "Simulation active" : state.liveReading ? "Receiving live data" : "Awaiting connection"}</div><a class="ghost-button local-dashboard-link" href="${LOCAL_DASHBOARD_URL}" target="_blank" rel="noopener noreferrer">${escapeHtml(translate("offline", state.language))}</a><button class="icon-button mobile-menu" id="mobileMenu" aria-label="Open navigation">${icon("menu")}</button></div></header><div class="content">${state.connectivityNotice ? outageNotice() : ""}${content}</div></main><div class="toast" id="toast" role="status"></div></div>`;
  document.querySelectorAll("[data-nav]").forEach(button => button.addEventListener("click", () => nav(button.dataset.nav)));
  document.querySelector("#mobileMenu")?.addEventListener("click", () => document.querySelector("#sidebar").classList.toggle("open"));
}
function pageHeading(title, subtitle, description, tools = "") {
  return `<div class="page-heading"><div><div class="eyebrow">Water network command desk</div><h1>${title}${subtitle ? `<span>${subtitle}</span>` : ""}</h1><p class="page-description">${description}</p></div><div class="header-tools">${tools}</div></div>`;
}
function summaryCard(label, value, unit, helper, glyph, tone = "") {
  return `<div class="summary-card"><div class="summary-card-label">${icon(glyph, 15)}<span>${label}</span></div><div class="summary-value ${tone}">${value}<small>${unit}</small></div><div class="summary-helper">${helper}</div></div>`;
}

let loading = false;
let lastSignature = "";
let lastHealthAt = 0;
let tokenPrompted = false;
let languagePreferenceLoaded = false;
function recordApiFailure() {
  state.backendUnavailable = true;
  const stored = Number(localStorage.getItem("aquaguard-api-down-since"));
  const since = Number.isFinite(stored) && stored > 0 ? stored : Date.now();
  if (!stored) localStorage.setItem("aquaguard-api-down-since", String(since));
  if (!state.connectivityNotice && Date.now() - since >= OUTAGE_NOTICE_MS) {
    state.connectivityNotice = true;
    render();
  }
}
async function saveLanguagePreference() {
  const token = localStorage.getItem("aquaguard-dashboard-token") || "";
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const response = await fetch("/api/dashboard/language", {
      method: "POST", headers, body: JSON.stringify({ language: state.language }), cache: "no-store"
    });
    if (!response.ok) return false;
    state.languageSyncPending = false;
    languagePreferenceLoaded = true;
    localStorage.removeItem("aquaguard-language-pending");
    return true;
  } catch { return false; }
}
function promptForDashboardToken() {
  if (tokenPrompted) return false;
  tokenPrompted = true;
  const entered = window.prompt("Enter the AquaGuard dashboard access token configured by the administrator:");
  if (!entered) return false;
  localStorage.setItem("aquaguard-dashboard-token", entered.trim());
  tokenPrompted = false;
  return true;
}
async function loadDashboardState() {
  if (state.mode === "simulation" || loading) return;
  loading = true;
  try {
    const dashboardToken = localStorage.getItem("aquaguard-dashboard-token") || "";
    const headers = dashboardToken ? { Authorization: `Bearer ${dashboardToken}` } : {};
    if (state.languageSyncPending) {
      await saveLanguagePreference();
    } else if (!languagePreferenceLoaded) {
      const preferenceResponse = await fetch("/api/dashboard/language", { cache: "no-store", headers });
      if (preferenceResponse.status === 401 && promptForDashboardToken()) {
        loading = false;
        return loadDashboardState();
      }
      if (preferenceResponse.ok) {
        const preference = await preferenceResponse.json();
        if (LANGUAGES.some(item => item.code === preference.language)) {
          state.language = preference.language;
          localStorage.setItem("aquaguard-language", state.language);
          lastSignature = "";
        }
        languagePreferenceLoaded = true;
      } else if (preferenceResponse.status === 503 || preferenceResponse.status === 404) {
        languagePreferenceLoaded = true;
      } else throw new Error(`Language preference status ${preferenceResponse.status}`);
    }
    const [response, healthResponse] = await Promise.all([
      fetch(`/api/dashboard/state?lang=${encodeURIComponent(state.language)}`, { cache: "no-store", headers }),
      Date.now() - lastHealthAt > 30_000 ? fetch("/api/health", { cache: "no-store" }) : Promise.resolve(null)
    ]);
    if (response.status === 401 && promptForDashboardToken()) {
      loading = false;
      return loadDashboardState();
    }
    if (!response.ok) throw new Error(`API status ${response.status}`);
    const data = await response.json();
    state.backendUnavailable = false;
    tokenPrompted = false;
    state.connectivityNotice = false;
    localStorage.removeItem("aquaguard-api-down-since");
    if (healthResponse) {
      const health = healthResponse.ok ? await healthResponse.json() : {};
      state.supabaseConfigured = Boolean(health.supabaseConfigured);
      lastHealthAt = Date.now();
    }
    const signature = JSON.stringify([data, state.supabaseConfigured, state.language]);
    if (signature !== lastSignature) {
      lastSignature = signature;
      state.liveReading = data.readings;
      state.ai = data.ai;
      state.openAlertCount = data.openAlertCount;
      state.thresholds = data.thresholds || state.thresholds;
      state.pipe = data.pipe;
      state.devices = (data.devices || []).map(device => ({
        name: device.name, deviceId: device.device_id, zone: device.monitoring_zones?.name || "Unassigned",
        online: device.status === "online", last: device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : "Not yet connected",
        health: device.device_health || {}, sensors: device.sensor_availability || {}
      }));
      state.alerts = (data.alerts || []).map(alert => ({
        type: alert.typeLabel || String(alert.type).replaceAll("_", " "),
        message: alert.localizedMessage || alert.message, zone: alert.zoneName || "—",
        time: new Date(alert.observed_at || alert.created_at).toLocaleString(),
        severity: String(alert.severity || "info").toUpperCase(), ack: Boolean(alert.acknowledged_at)
      }));
      localStorage.setItem("aquaguard-last-dashboard-state", JSON.stringify({ data, at: Date.now() }));
      render();
    }
  } catch {
    recordApiFailure();
  } finally { loading = false; }
}

function flowChart(reading) {
  if (!reading) return `<div class="chart-empty"><span>Waiting for validated sensor data.</span></div>`;
  const pts = reading.history || [];
  if (!pts.length) return `<div class="chart-empty"><span>Waiting for validated sensor data.</span></div>`;
  const max = Math.max(10, ...pts.flatMap(p => [Number(p.inlet) || 0, Number(p.outlet) || 0]));
  const x = i => 20 + i / Math.max(pts.length - 1, 1) * 540;
  const y = val => 154 - (Number(val) / max) * 125;
  const points = key => pts.map((point, i) => `${x(i).toFixed(1)},${y(point[key]).toFixed(1)}`).join(" ");
  const grid = [29, 71, 113, 154].map(v => `<line x1="20" y1="${v}" x2="560" y2="${v}" stroke="rgba(137,192,216,.12)"/>`).join("");
  return `<svg viewBox="0 0 580 178" preserveAspectRatio="none" role="img" aria-label="Inlet and outlet flow chart">${grid}<polyline points="${points("inlet")}" fill="none" stroke="#57D7E8" stroke-width="2.2"/><polyline points="${points("outlet")}" fill="none" stroke="#6FE0A9" stroke-width="2.2"/></svg>`;
}
function statusBlock(reading) {
  if (!reading) return { title: "AWAITING DATA", tone: "warning", copy: "No validated live reading is available yet." };
  if (reading.offline) return { title: "OFFLINE", tone: "warning", copy: "The controller is offline. Flow values are zeroed; valve and tank state are unknown." };
  const delta = Math.abs(Number(reading.signedDifference ?? reading.difference) || 0);
  if (delta >= state.thresholds.flowDifference * 2) return { title: "POSSIBLE LEAK", tone: "danger", copy: "A sustained difference should be confirmed locally before repair decisions." };
  if (delta >= state.thresholds.flowDifference) return { title: "CHECK REQUIRED", tone: "warning", copy: "A flow imbalance is above the configured threshold." };
  return { title: "NORMAL", tone: "green", copy: "Current validated flow difference is below threshold." };
}
function aiPanel() {
  const ai = state.ai;
  if (!ai || state.mode === "simulation") return "";
  const tone = ai.status === "alert" ? "red" : ai.status === "watch" ? "yellow" : ai.status === "offline" ? "offline" : "green";
  const insights = (ai.insights || []).map(item => `<div class="list-row"><div class="list-main"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.detail)}</span></div><span class="badge ${item.level === "critical" ? "red" : item.level === "warning" ? "yellow" : "green"}">${escapeHtml(item.level)}</span></div>`).join("");
  const health = ai.deviceHealth || {};
  const location = ai.leakLocation || {};
  const locationStatus = location.status === "suspected_leak_in_section" ? "Suspected imbalance" : location.status === "no_sustained_imbalance" ? "No sustained imbalance" : location.status || "Insufficient data";
  return `<section class="panel panel-pad ai-panel"><div class="panel-heading"><div><h2>${escapeHtml(translate("insights", state.language))}</h2><p class="panel-kicker">Statistical anomaly and device-health checks; advisory only</p></div><div class="ai-controls"><label for="aiLanguage">${escapeHtml(translate("language", state.language))}</label><select id="aiLanguage" aria-label="AI insight language">${LANGUAGES.map(language => `<option value="${language.code}" ${language.code === state.language ? "selected" : ""}>${escapeHtml(language.label)}</option>`).join("")}</select><span class="badge ${tone}">Risk ${Number(ai.riskScore || 0)}/100</span></div></div><div class="list">${insights}</div><div class="status-facts ai-health"><div><div class="fact-label">${escapeHtml(translate("health", state.language))}</div><div class="fact-value">${escapeHtml(health.state || "unknown")} · last sample ${health.lastSampleAgeSeconds ?? "—"} s ago</div></div><div><div class="fact-label">${escapeHtml(translate("localization", state.language))}</div><div class="fact-value">${escapeHtml(locationStatus)} · ${escapeHtml(String(location.sectionLengthM ?? state.pipe?.lengthM ?? 1))} m between sensors</div></div></div><p class="localization-caveat">${escapeHtml(translate("noExactPoint", state.language))}</p><p class="localization-caveat">Valve telemetry is commanded state; there is no physical valve-position feedback.</p></section>`;
}
function deviceRows() {
  if (!state.devices.length) return `<div class="empty-state"><strong>No registered ESP32 devices</strong><p>Register the main MCU in Supabase and assign its monitoring zone.</p></div>`;
  return `<div class="list">${state.devices.map(device => `<div class="list-row"><div class="list-main"><strong>${escapeHtml(device.name)} · ${escapeHtml(device.deviceId)}</strong><span>${escapeHtml(device.zone)} · Last communication ${escapeHtml(device.last)}</span></div><span class="badge ${device.online ? "green" : "offline"}">${device.online ? "Online" : "Offline"}</span></div>`).join("")}</div>`;
}
function overviewPage() {
  const reading = currentReading();
  const status = statusBlock(reading);
  const online = state.devices.filter(device => device.online).length;
  const open = state.openAlertCount ?? state.alerts.filter(alert => !alert.ack).length;
  const source = isSimulation() ? "Simulation data" : state.backendUnavailable ? "Cached cloud data" : "Live sensor data";
  const toolbar = `<div class="mode-switch"><button class="${state.mode === "live" ? "active" : ""}" data-mode="live">Live Hardware</button><button class="${state.mode === "simulation" ? "active" : ""}" data-mode="simulation">Simulation</button></div>${state.mode === "simulation" && !reading ? `<button class="primary-button" id="simulate">Run preview simulation</button>` : state.mode === "simulation" ? `<button class="ghost-button" id="clearSimulation">Clear simulation</button>` : ""}`;
  return `${pageHeading("AquaGuard Rwanda", "Smart Water Network Monitoring", "Monitor flow balance, device health and the evidence behind a suspected leak.", toolbar)}<div class="summary-grid">${summaryCard("Registered Devices", state.devices.length, "devices", "Configured controllers", "cpu")}${summaryCard("Online Devices", online, "online", online ? "Connected now" : "Waiting for ESP32", "cloud", online ? "green" : "")}${summaryCard("Monitoring Status", status.title.toLowerCase(), "", status.copy, "activity", status.tone)}${summaryCard("Active Alerts", open, "open", open ? "Review required" : "No open alerts", "bell", open ? "danger" : "")}</div><section class="panel primary-panel"><div class="panel-heading"><div><h2>Water monitoring</h2><p class="panel-kicker">${reading?.offline ? "Offline data is zeroed; no current readings are implied." : "The monitored section at a glance"}</p></div><span class="source-tag">${escapeHtml(source)}</span></div><div class="measurements"><div class="measurement"><div class="measurement-label">Inlet flow rate</div><div class="measurement-value">${fmt(reading?.inlet)} <span class="measurement-unit">L/min</span></div></div><div class="measurement"><div class="measurement-label">Outlet flow rate</div><div class="measurement-value">${fmt(reading?.outlet)} <span class="measurement-unit">L/min</span></div></div><div class="measurement"><div class="measurement-label">Water loss</div><div class="measurement-value">${fmt(reading?.difference)} <span class="measurement-unit">L/min</span></div></div><div class="measurement"><div class="measurement-label">Tank distance</div><div class="measurement-value">${fmt(reading?.waterLevelCm)} <span class="measurement-unit">cm</span></div></div><div class="measurement"><div class="measurement-label">Valve command</div><div class="measurement-value">${reading?.valveOpen === null || reading?.valveOpen === undefined ? "—" : reading.valveOpen ? "OPEN" : "CLOSED"}</div></div></div><div class="chart-layout"><div class="chart-box"><div class="chart-title-row"><h3>Flow comparison</h3><div class="chart-legend"><span class="legend-item"><i class="legend-line"></i>Inlet</span><span class="legend-item"><i class="legend-line outlet"></i>Outlet</span></div></div><div class="chart-frame">${flowChart(reading)}</div><div class="chart-meta"><span>Observed: ${escapeHtml(reading?.updatedAt || "No update")}</span><span>Received: ${escapeHtml(reading?.receivedAt || "—")}</span></div></div><div class="inline-note"><strong>${status.title}</strong><p>${escapeHtml(status.copy)}</p><p>Location estimate: section only; the 1 m pipe cannot be spatially resolved with endpoint flow sensors.</p></div></div></section><div class="lower-grid"><section class="panel panel-pad"><div class="panel-heading"><div><h2>Leak detection status</h2><p class="panel-kicker">Threshold ${fmt(state.thresholds.flowDifference, 1)} L/min</p></div>${icon("shield", 19)}</div><div class="status-row"><div class="status-orb ${status.tone}">${icon(status.tone === "green" ? "check" : "activity", 21)}</div><div><div class="status-title ${status.tone}">${status.title}</div><p class="status-copy">${escapeHtml(status.copy)}</p></div></div></section><section class="panel panel-pad device-list"><div class="panel-heading"><div><h2>Device connection</h2><p class="panel-kicker">ESP32 controller status</p></div></div>${deviceRows()}</section></div>${aiPanel()}`;
}
function devicesPage() {
  return `${pageHeading("Devices", "Registration and health", "The ESP32 is the only cloud-registered MCU. The ESP8266 outlet node reports through the ESP32 over its private Wi-Fi network.", "")}<section class="panel subpage-card"><div class="page-section-title"><div><h2>Registered devices</h2><p>Server state comes from Supabase; registration is not a browser-only draft.</p></div></div>${deviceRows()}</section>`;
}
function alertsPage() {
  const rows = state.alerts.map(alert => `<div class="list-row"><div class="list-main"><strong>${escapeHtml(alert.type)}</strong><span>${escapeHtml(alert.zone)} · ${escapeHtml(alert.time)} · ${alert.ack ? "Acknowledged" : "Unacknowledged"}</span>${alert.message ? `<span>${escapeHtml(alert.message)}</span>` : ""}</div><span class="badge ${alert.severity === "HIGH" ? "red" : alert.severity === "LOW" ? "green" : "yellow"}">${escapeHtml(alert.severity)}</span></div>`).join("");
  return `${pageHeading("Alerts", "History and acknowledgement", "Cloud alerts are persisted in Supabase. Local SMS alerts continue from the ESP32 modem even when this page cannot reach the cloud.", "")}<section class="panel subpage-card">${rows || `<div class="empty-state"><strong>No cloud alerts loaded</strong><p>Alerts appear when the device is registered and the cloud API is reachable.</p></div>`}</section>`;
}
function settingsPage() {
  return `${pageHeading("Settings", "System readiness", "Configuration values are server-side. Apply the database migrations before deploying the updated ingestion schema.", "")}<div class="subpage-grid"><section class="panel subpage-card"><div class="page-section-title"><div><h2>Services</h2><p>Secret values are not sent to the browser.</p></div></div><div class="settings-list"><div class="setting-row"><div class="setting-copy"><strong>Supabase</strong><span>${state.supabaseConfigured ? "Configured on server" : "Not configured"}</span></div><span class="badge ${state.supabaseConfigured ? "green" : "offline"}">${state.supabaseConfigured ? "Ready" : "Unavailable"}</span></div><div class="setting-row"><div class="setting-copy"><strong>Cloud/API link</strong><span>${state.backendUnavailable ? "Unavailable; outage timer is active" : "Polling every 5 seconds while visible"}</span></div><span class="badge ${state.backendUnavailable ? "yellow" : "green"}">${state.backendUnavailable ? "Degraded" : "Active"}</span></div><div class="setting-row"><div class="setting-copy"><strong>Local ESP32 dashboard</strong><span>Join the AquaGuard-ESP32 Wi-Fi and open 192.168.4.1</span></div><a class="ghost-button" href="${LOCAL_DASHBOARD_URL}" target="_blank" rel="noopener noreferrer">Open local view</a></div></div></section><section class="panel subpage-card"><div class="page-section-title"><div><h2>Calibration and safety</h2><p>Use the measured pulse-per-litre constant for each actual sensor.</p></div></div><div class="notice"><strong>Do not assume 450 pulses/L is exact.</strong> It is only the YF-S201 starting value. Calibrate each sensor independently using a measured volume and set the accepted maximum flow consistently in firmware and .env. A normally-open valve opens when unpowered; this is not fail-closed on power loss.</div></section></div>`;
}
function render() {
  const content = state.section === "Overview" || state.section === "Live Monitoring" ? overviewPage() : state.section === "Devices" ? devicesPage() : state.section === "Alerts" ? alertsPage() : settingsPage();
  shell(content);
  document.querySelectorAll("[data-mode]").forEach(button => button.addEventListener("click", () => { state.mode = button.dataset.mode; render(); if (state.mode === "live") loadDashboardState(); }));
  document.querySelector("#simulate")?.addEventListener("click", runSimulation);
  document.querySelector("#clearSimulation")?.addEventListener("click", () => { state.simulationReading = null; render(); });
  document.querySelector("#aiLanguage")?.addEventListener("change", event => {
    state.language = event.target.value;
    localStorage.setItem("aquaguard-language", state.language);
    state.languageSyncPending = true;
    localStorage.setItem("aquaguard-language-pending", "1");
    lastSignature = "";
    render();
    void saveLanguagePreference();
    loadDashboardState();
  });
}
function runSimulation() {
  const inlet = 4.8, outlet = 0.8;
  const history = Array.from({ length: 12 }, (_, i) => ({ inlet: inlet + Math.sin(i * .75) * .3, outlet: outlet + Math.sin(i * .75 + .24) * .2 }));
  state.simulationReading = { inlet, outlet, difference: inlet - outlet, waterLevelCm: null, valveOpen: false, zone: "Simulation", updatedAt: new Date().toISOString(), history };
  render();
}

render();
loadDashboardState();
window.setInterval(() => { if (!document.hidden) loadDashboardState(); }, POLL_VISIBLE_MS);
window.setInterval(() => { if (document.hidden) loadDashboardState(); }, POLL_HIDDEN_MS);
document.addEventListener("visibilitychange", () => { if (!document.hidden) loadDashboardState(); });
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
