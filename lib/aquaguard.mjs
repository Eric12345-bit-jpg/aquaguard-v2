import { analyzeReadings } from "./ai.mjs";
import { localizeInsight, normalizeLanguage, translate, translateAlertMessage, translateAlertType } from "./i18n.mjs";
import { locateLeak } from "./leakLocator.mjs";

const FLOW_THRESHOLD = Number(process.env.FLOW_DIFFERENCE_THRESHOLD_LPM || 2);
const MAX_FLOW_LPM = Number(process.env.MAX_FLOW_LPM || 30);
const LEAK_CONFIRMATION_SECONDS = Number(process.env.LEAK_CONFIRMATION_SECONDS || 10);
const OFFLINE_AFTER_SECONDS = Number(process.env.OFFLINE_AFTER_SECONDS || 10);
const DASHBOARD_CACHE_MS = 750;
const deviceCache = new Map();
const recentAlerts = new Map();
let markingOffline = false;
let dashboardCache = { at: 0, key: "", promise: null };

export function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

export function validateReading(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "Payload must be a JSON object.";
  const required = ["device_id", "inlet_flow_lpm", "outlet_flow_lpm", "valve_open", "timestamp"];
  const missing = required.filter(key => payload[key] === undefined || payload[key] === null);
  if (missing.length) return `Missing fields: ${missing.join(", ")}.`;
  if (typeof payload.device_id !== "string" || !/^[A-Za-z0-9._:-]{2,120}$/.test(payload.device_id)) return "device_id must be a short identifier.";
  for (const key of ["inlet_flow_lpm", "outlet_flow_lpm"]) {
    if (typeof payload[key] !== "number" || !Number.isFinite(payload[key]) || payload[key] < 0 || payload[key] > MAX_FLOW_LPM) {
      return `${key} must be a finite number from 0 to ${MAX_FLOW_LPM} L/min.`;
    }
  }
  if (payload.water_level_cm !== undefined && payload.water_level_cm !== null &&
      (typeof payload.water_level_cm !== "number" || !Number.isFinite(payload.water_level_cm) || payload.water_level_cm < 0 || payload.water_level_cm > 450)) {
    return "water_level_cm must be a finite number from 0 to 450 cm.";
  }
  if (typeof payload.valve_open !== "boolean") return "valve_open must be boolean.";
  if (typeof payload.timestamp !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(payload.timestamp)) return "timestamp must be an ISO-8601 UTC string ending in Z.";
  const stamp = Date.parse(payload.timestamp);
  if (!Number.isFinite(stamp)) return "timestamp must be an ISO-8601 date.";
  if (stamp > Date.now() + 60_000) return "timestamp cannot be more than one minute in the future.";
  if (stamp < Date.now() - 24 * 60 * 60 * 1000) return "timestamp is more than 24 hours old; synchronize ESP32 time before sending.";
  if (payload.sensor_health !== undefined && (!payload.sensor_health || typeof payload.sensor_health !== "object" || Array.isArray(payload.sensor_health))) return "sensor_health must be an object when supplied.";
  if (payload.internet_outage_seconds !== undefined && (!Number.isInteger(payload.internet_outage_seconds) || payload.internet_outage_seconds < 0 || payload.internet_outage_seconds > 86400)) return "internet_outage_seconds must be an integer from 0 to 86400.";
  return null;
}

export function supabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function cloudHealth() {
  if (!supabaseConfigured()) return { ok: false, supabaseConfigured: false };
  try {
    await supabaseRequest("devices?select=id&limit=1", { signal: AbortSignal.timeout(3000) });
    return { ok: true, supabaseConfigured: true };
  } catch {
    return { ok: false, supabaseConfigured: true };
  }
}

async function supabaseRequest(path, options = {}) {
  const base = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const response = await fetch(`${base}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      ...(options.headers || {})
    },
    signal: options.signal || AbortSignal.timeout(8000)
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(`Supabase request failed (${response.status}).`);
  return data;
}

async function sendTelegram(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message }),
      signal: AbortSignal.timeout(5000)
    });
    return response.ok;
  } catch { return false; }
}

function zoneNameOf(row) {
  const zone = Array.isArray(row?.monitoring_zones) ? row.monitoring_zones[0] : row?.monitoring_zones;
  return zone?.name || null;
}

function deviceLabel(row) {
  const zone = zoneNameOf(row);
  return zone ? `${row.name} (${zone})` : row.name;
}

async function lookupDevice(deviceId) {
  const cached = deviceCache.get(deviceId);
  if (cached && Date.now() - cached.at < 5000) return cached.device;
  const rows = await supabaseRequest(`devices?device_id=eq.${encodeURIComponent(deviceId)}&select=id,zone_id,name,status,last_seen_at,monitoring_zones(name)`);
  const device = rows?.[0];
  if (device) deviceCache.set(deviceId, { device, at: Date.now() });
  return device;
}

async function insertAlert({ device, type, severity, message, observedAt }) {
  const key = `${type}:${device.id}`;
  const previous = recentAlerts.get(key) || 0;
  if (Date.now() - previous < 30_000) return false;
  recentAlerts.set(key, Date.now());
  await supabaseRequest("alerts", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ device_id: device.id, zone_id: device.zone_id, type, severity, message, observed_at: observedAt })
  });
  await sendTelegram(message);
  return true;
}

async function sustainedLeak(deviceId) {
  const since = new Date(Date.now() - Math.max(LEAK_CONFIRMATION_SECONDS * 3, 30) * 1000).toISOString();
  const rows = await supabaseRequest(`sensor_readings?device_id=eq.${encodeURIComponent(deviceId)}&observed_at=gte.${encodeURIComponent(since)}&select=inlet_flow_lpm,outlet_flow_lpm,observed_at&order=observed_at.desc&limit=30`);
  if (!Array.isArray(rows) || rows.length < 3) return false;
  const series = rows.filter(row => Number(row.inlet_flow_lpm) - Number(row.outlet_flow_lpm) >= FLOW_THRESHOLD);
  if (series.length < 3) return false;
  const oldest = Math.min(...series.map(row => Date.parse(row.observed_at)).filter(Number.isFinite));
  const latest = Math.max(...series.map(row => Date.parse(row.observed_at)).filter(Number.isFinite));
  return Number.isFinite(oldest) && Number.isFinite(latest) && latest - oldest >= LEAK_CONFIRMATION_SECONDS * 1000 &&
    (latest - oldest) / 1000 >= LEAK_CONFIRMATION_SECONDS && series.length >= Math.min(8, Math.ceil(LEAK_CONFIRMATION_SECONDS * 0.5));
}

export async function ingestReading(payload) {
  const device = await lookupDevice(payload.device_id);
  if (!device) return { missingDevice: true };

  const observedAt = new Date(payload.timestamp).toISOString();
  const receivedAt = new Date().toISOString();
  const inlet = Number(payload.inlet_flow_lpm);
  const outlet = Number(payload.outlet_flow_lpm);
  const loss = inlet - outlet;
  const waterLevelCm = payload.water_level_cm === undefined || payload.water_level_cm === null ? null : Number(payload.water_level_cm);
  const sensorHealth = payload.sensor_health || { inlet: true, outlet: true, ultrasonic: waterLevelCm !== null };
  const receivedDeviceHealth = {
    controller: "online",
    internet: payload.internet_connected === false ? "disconnected" : "reachable",
    firmwareVersion: String(payload.firmware_version || "unknown").slice(0, 32),
    sensorHealth
  };

  // Persist the measurement first; only then update device status/alerts.
  await supabaseRequest("sensor_readings", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      device_id: device.id,
      inlet_flow_lpm: inlet,
      outlet_flow_lpm: outlet,
      pressure_bar: null,
      water_level: waterLevelCm,
      pump_status: null,
      valve_open: payload.valve_open,
      observed_at: observedAt,
      received_at: receivedAt,
      sensor_health: sensorHealth,
      source: "live_hardware"
    })
  });

  await supabaseRequest(`devices?id=eq.${encodeURIComponent(device.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      status: "online",
      last_seen_at: receivedAt,
      sensor_availability: {
        inlet_flow: sensorHealth.inlet !== false,
        outlet_flow: sensorHealth.outlet !== false,
        solenoid: true,
        lcd: true,
        buzzer: true,
        ultrasonic_tank_height: sensorHealth.ultrasonic !== false && waterLevelCm !== null
      },
      device_health: receivedDeviceHealth,
      updated_at: receivedAt
    })
  });

  const wasOffline = device.status === "offline" && Boolean(device.last_seen_at);
  device.status = "online";
  device.last_seen_at = receivedAt;
  deviceCache.set(payload.device_id, { device, at: Date.now() });
  dashboardCache = { at: 0, key: "", promise: null };

  const alertsCreated = [];
  if (wasOffline) {
    const message = `${deviceLabel(device)} connection restored.`;
    if (await insertAlert({ device, type: "device_restored", severity: "low", message, observedAt })) alertsCreated.push("device_restored");
  }

  if (loss >= FLOW_THRESHOLD && await sustainedLeak(device.id)) {
    const severity = loss >= FLOW_THRESHOLD * 2 ? "high" : "medium";
    const message = `Sustained water loss in monitored section ${deviceLabel(device)}: ${loss.toFixed(1)} L/min. Exact point location is unavailable from flow-only sensors.`;
    if (await insertAlert({ device, type: "possible_leak", severity, message, observedAt })) alertsCreated.push("possible_leak");
  }

  const outageSeconds = Number(payload.internet_outage_seconds || 0);
  if (outageSeconds >= Number(process.env.INTERNET_NOTICE_AFTER_SECONDS || 120)) {
    const outageAt = new Date(Date.parse(observedAt) - outageSeconds * 1000).toISOString();
    const outageMessage = `Internet/cloud connection was unavailable for approximately ${outageSeconds} seconds at ${deviceLabel(device)}; local ESP32 protection remained active.`;
    if (await insertAlert({ device, type: "internet_outage", severity: "medium", message: outageMessage, observedAt: outageAt })) alertsCreated.push("internet_outage");
    const restoredMessage = `Internet/cloud connection restored at ${deviceLabel(device)} after approximately ${outageSeconds} seconds.`;
    if (await insertAlert({ device, type: "internet_restored", severity: "low", message: restoredMessage, observedAt })) alertsCreated.push("internet_restored");
  }

  return { persisted: true, deviceName: device.name, alertsCreated, waterLossLpm: Number(Math.max(0, loss).toFixed(2)), signedDifferenceLpm: Number(loss.toFixed(2)), waterLevelCm, receivedAt };
}

export async function getDashboardState(language = "en") {
  const lang = normalizeLanguage(language);
  const now = Date.now();
  const key = lang;
  if (dashboardCache.promise && dashboardCache.key === key && now - dashboardCache.at < DASHBOARD_CACHE_MS) return dashboardCache.promise;
  const promise = loadDashboardStateFromDb(lang).catch(error => {
    if (dashboardCache.promise === promise) dashboardCache = { at: 0, key: "", promise: null };
    throw error;
  });
  dashboardCache = { at: now, key, promise };
  return promise;
}

async function countOpenAlerts() {
  const base = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const response = await fetch(`${base}/rest/v1/alerts?select=id&acknowledged_at=is.null`, {
    method: "HEAD",
    headers: { apikey: key, authorization: `Bearer ${key}`, Prefer: "count=exact", Range: "0-0" },
    signal: AbortSignal.timeout(5000)
  });
  const total = Number((response.headers.get("content-range") || "").split("/")[1]);
  return Number.isFinite(total) ? total : null;
}

async function loadDashboardStateFromDb(language) {
  const [devices, readings, alerts, openAlerts] = await Promise.all([
    supabaseRequest("devices?select=id,device_id,name,status,last_seen_at,zone_id,sensor_availability,device_health,monitoring_zones(name)&order=name.asc"),
    supabaseRequest("sensor_readings?select=inlet_flow_lpm,outlet_flow_lpm,water_level,valve_open,observed_at,received_at,device_id,sensor_health&order=observed_at.desc&limit=300"),
    supabaseRequest("alerts?select=id,type,zone_id,severity,message,acknowledged_at,observed_at,created_at&order=created_at.desc&limit=50"),
    countOpenAlerts().catch(() => null)
  ]);

  const nowMs = Date.now();
  const checkedDevices = (devices || []).map(device => {
    const lastSeen = Date.parse(device.last_seen_at || "");
    const isStale = Number.isFinite(lastSeen) && nowMs - lastSeen > OFFLINE_AFTER_SECONDS * 1000;
    return isStale && device.status === "online" ? { ...device, status: "offline" } : device;
  });
  const allOffline = checkedDevices.length > 0 && checkedDevices.every(device => device.status !== "online");
  const chartRows = (readings || []).slice(0, 30);
  const latest = readings?.[0] || null;
  const outletFresh = latest?.sensor_health?.outlet !== false && Boolean(latest);
  const latestHistory = chartRows.slice().reverse().map(row => ({ inlet: Number(row.inlet_flow_lpm), outlet: Number(row.outlet_flow_lpm) }));

  let analysis;
  if (allOffline) {
    analysis = {
      status: "offline", riskScore: 0,
      insights: [{ code: "offline", level: "info", params: {} }],
      samples: readings?.length || 0,
      baselineLossLpm: null,
      leakLocation: locateLeak({ inletValid: false, outletValid: false, outletFresh: false,
        lengthM: Number(process.env.PIPE_LENGTH_M || 1),
        diameterMinMm: Number(process.env.PIPE_DIAMETER_MIN_MM || 8),
        diameterMaxMm: Number(process.env.PIPE_DIAMETER_MAX_MM || 12) }),
      deviceHealth: { state: "offline", pressureSensor: "not_installed", valveStateIsCommandedNotPhysicallyConfirmed: true }
    };
  } else {
    analysis = analyzeReadings(readings || [], {
      threshold: FLOW_THRESHOLD,
      outletFresh,
      pipeLengthM: Number(process.env.PIPE_LENGTH_M || 1),
      pipeDiameterMinMm: Number(process.env.PIPE_DIAMETER_MIN_MM || 8),
      pipeDiameterMaxMm: Number(process.env.PIPE_DIAMETER_MAX_MM || 12)
    });
  }
  analysis.insights = analysis.insights.map(item => localizeInsight(item, language));
  analysis.localizationLabel = translate("localization", language);
  analysis.selectedLanguage = language;

  const translatedAlerts = (alerts || []).map(alert => ({
    ...alert,
    typeLabel: translateAlertType(alert.type, language),
    localizedMessage: translateAlertMessage(alert.type, alert.message, language),
    zoneName: checkedDevices.find(device => device.zone_id === alert.zone_id)?.monitoring_zones?.name || "—"
  }));

  return {
    devices: checkedDevices,
    ai: analysis,
    readings: allOffline ? {
      inlet: 0, outlet: 0, difference: 0, waterLevelCm: null, valveOpen: null, offline: true,
      updatedAt: latest?.observed_at || null,
      receivedAt: latest?.received_at || null,
      history: latestHistory.map(() => ({ inlet: 0, outlet: 0 })),
      leakLocation: analysis.leakLocation
    } : latest ? {
      inlet: Number(latest.inlet_flow_lpm),
      outlet: Number(latest.outlet_flow_lpm),
      difference: Math.max(0, Number(latest.inlet_flow_lpm) - Number(latest.outlet_flow_lpm)),
      signedDifference: Number(latest.inlet_flow_lpm) - Number(latest.outlet_flow_lpm),
      waterLevelCm: latest.water_level === null || latest.water_level === undefined ? null : Number(latest.water_level),
      valveOpen: latest.valve_open ?? null,
      updatedAt: latest.observed_at,
      receivedAt: latest.received_at || null,
      offline: false,
      history: latestHistory,
      leakLocation: analysis.leakLocation
    } : null,
    alerts: translatedAlerts,
    openAlertCount: openAlerts,
    thresholds: { flowDifference: FLOW_THRESHOLD, maxFlow: MAX_FLOW_LPM, leakConfirmationSeconds: LEAK_CONFIRMATION_SECONDS },
    pipe: { lengthM: Number(process.env.PIPE_LENGTH_M || 1), diameterMinMm: Number(process.env.PIPE_DIAMETER_MIN_MM || 8), diameterMaxMm: Number(process.env.PIPE_DIAMETER_MAX_MM || 12) },
    offlineAfterSeconds: OFFLINE_AFTER_SECONDS,
    language
  };
}

export async function markOfflineDevices() {
  if (!supabaseConfigured() || markingOffline) return;
  markingOffline = true;
  try {
    const cutoff = new Date(Date.now() - OFFLINE_AFTER_SECONDS * 1000).toISOString();
    const devices = await supabaseRequest(`devices?status=eq.online&last_seen_at=lt.${encodeURIComponent(cutoff)}&select=id,zone_id,name,last_seen_at,monitoring_zones(name)`);
    for (const device of devices || []) {
      await supabaseRequest(`devices?id=eq.${encodeURIComponent(device.id)}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: "offline", updated_at: new Date().toISOString(), device_health: { ...(device.device_health || {}), controller: "offline" } })
      });
      const key = `device_offline:${device.id}`;
      if ((recentAlerts.get(key) || 0) + 60_000 > Date.now()) continue;
      const message = `${deviceLabel(device)} is offline. Last communication: ${device.last_seen_at}.`;
      await insertAlert({ device, type: "device_offline", severity: "medium", message, observedAt: new Date().toISOString() });
      deviceCache.delete(device.device_id);
    }
    dashboardCache = { at: 0, key: "", promise: null };
  } finally { markingOffline = false; }
}

export async function telegramTest() {
  return sendTelegram("AquaGuard test notification: secure Telegram delivery is configured.");
}

export async function getDeviceNotifications(deviceId, language = "en", afterSeconds = 0) {
  const device = await lookupDevice(deviceId);
  if (!device) return null;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const cursor = Number.isSafeInteger(Number(afterSeconds)) && Number(afterSeconds) > 0
    ? Number(afterSeconds) : nowSeconds - 60;
  const since = new Date(Math.max(0, cursor - 1) * 1000).toISOString();
  const requestedLanguage = normalizeLanguage(language);
  const [alerts, dashboard, settings] = await Promise.all([
    supabaseRequest(`alerts?device_id=eq.${encodeURIComponent(device.id)}&created_at=gte.${encodeURIComponent(since)}&select=id,type,severity,message,created_at&order=created_at.asc&limit=20`),
    getDashboardState(requestedLanguage),
    supabaseRequest("system_settings?key=eq.preferred_language&select=value&limit=1")
  ]);
  const storedLanguage = settings?.[0]?.value?.code;
  const lang = normalizeLanguage(storedLanguage || requestedLanguage);
  const localizedDashboard = lang === requestedLanguage ? dashboard : await getDashboardState(lang);
  const localizedAlerts = (alerts || []).map(alert => ({
    id: alert.id,
    type: alert.type,
    severity: alert.severity,
    createdAt: alert.created_at,
    title: translateAlertType(alert.type, lang),
    detail: translateAlertMessage(alert.type, alert.message, lang)
  }));
  const insights = (localizedDashboard.ai?.insights || [])
    .filter(item => item.level === "critical" || item.level === "warning")
    .map(item => ({ code: item.code, level: item.level, title: item.title, detail: item.detail }));
  return { cursor: nowSeconds, language: lang, alerts: localizedAlerts, insights };
}

const safeLine = value => String(value ?? "").replace(/[|\r\n]+/g, " ").trim();
export function formatDeviceNotificationText(digest) {
  const lines = [`C|${Number(digest?.cursor || 0)}`, `L|${safeLine(digest?.language || "en")}`];
  for (const alert of digest?.alerts || []) {
    lines.push(["A", alert.id, alert.type, alert.severity || "medium", alert.title, alert.detail].map(safeLine).join("|"));
  }
  for (const item of digest?.insights || []) {
    lines.push(["I", item.code, item.level, item.title, item.detail].map(safeLine).join("|"));
  }
  return `${lines.join("\n")}\n`;
}

export async function setPreferredLanguage(language) {
  const lang = normalizeLanguage(language);
  const updatedAt = new Date().toISOString();
  await supabaseRequest("system_settings?on_conflict=key", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ key: "preferred_language", value: { code: lang }, updated_at: updatedAt }])
  });
  dashboardCache = { at: 0, key: "", promise: null };
  return lang;
}

export async function getPreferredLanguage() {
  const rows = await supabaseRequest("system_settings?key=eq.preferred_language&select=value&limit=1");
  return normalizeLanguage(rows?.[0]?.value?.code || "en");
}
