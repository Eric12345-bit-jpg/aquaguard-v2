// Deterministic AquaGuard advisory analysis. It cannot control the valve.
// A statistical baseline is a diagnostic aid, not a substitute for calibrated sensors.
import { locateLeak } from "./leakLocator.mjs";

const MAX_FLOW_LPM = Number(process.env.MAX_FLOW_LPM || 30);
const MIN_SAMPLES = 30;
const num = value => value === null || value === undefined || value === "" ? NaN : Number(value);

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return NaN;
  const m = sorted.length >> 1;
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

function mad(values, center) {
  return median(values.map(value => Math.abs(value - center)));
}

function insight(code, level, params = {}) {
  return { code, level, params };
}

function score(insights) {
  const weight = { critical: 70, warning: 35, info: 0 };
  const riskScore = Math.min(100, insights.reduce((sum, item) => sum + (weight[item.level] || 0), 0));
  return {
    status: riskScore >= 70 ? "alert" : riskScore >= 35 ? "watch" : "normal",
    riskScore,
    insights,
    generatedAt: new Date().toISOString()
  };
}

// rowsNewestFirst is a sensor_readings REST response.
export function analyzeReadings(rowsNewestFirst, {
  threshold = Number(process.env.FLOW_DIFFERENCE_THRESHOLD_LPM || 2),
  pipeLengthM = Number(process.env.PIPE_LENGTH_M || 1),
  pipeDiameterMinMm = Number(process.env.PIPE_DIAMETER_MIN_MM || 8),
  pipeDiameterMaxMm = Number(process.env.PIPE_DIAMETER_MAX_MM || 12),
  outletFresh = true
} = {}) {
  const rows = [...(rowsNewestFirst || [])].reverse().map(row => ({
    inlet: num(row.inlet_flow_lpm),
    outlet: num(row.outlet_flow_lpm),
    level: num(row.water_level),
    valve: row.valve_open,
    t: Date.parse(row.observed_at)
  })).filter(row => Number.isFinite(row.inlet) && Number.isFinite(row.outlet) && row.inlet >= 0 && row.outlet >= 0);

  const n = rows.length;
  const insights = [];
  const recent = rows.slice(-10);
  const lossSeries = rows.map(row => row.inlet - row.outlet);
  const baselineRows = lossSeries.slice(0, -10);
  const baseline = median(baselineRows);
  const recentLoss = median(lossSeries.slice(-10));
  const latest = rows.at(-1);
  const location = latest ? locateLeak({
    inletLpm: latest.inlet,
    outletLpm: latest.outlet,
    valveOpen: latest.valve,
    outletFresh,
    thresholdLpm: threshold,
    lengthM: pipeLengthM,
    diameterMinMm: pipeDiameterMinMm,
    diameterMaxMm: pipeDiameterMaxMm
  }) : locateLeak({ inletValid: false, outletValid: false, outletFresh: false, lengthM: pipeLengthM, diameterMinMm: pipeDiameterMinMm, diameterMaxMm: pipeDiameterMaxMm });

  if (!n) {
    insights.push(insight("learning", "info", { n: 0, min: MIN_SAMPLES }));
    return { ...score(insights), samples: 0, baselineLossLpm: null, leakLocation: location, deviceHealth: { state: "no_data", lastSampleAgeSeconds: null } };
  }

  const sampleAgeSeconds = Number.isFinite(latest?.t) ? Math.max(0, Math.round((Date.now() - latest.t) / 1000)) : null;
  if (n < MIN_SAMPLES) insights.push(insight("learning", "info", { n, min: MIN_SAMPLES }));

  const last20 = rows.slice(-20);
  if (last20.some(row => row.inlet > MAX_FLOW_LPM || row.outlet > MAX_FLOW_LPM)) {
    insights.push(insight("implausible_flow", "critical", { max: MAX_FLOW_LPM }));
  }

  if (recent.length >= 5 && recent.every(row => row.valve === false) && median(recent.map(row => row.inlet)) > 0.5) {
    insights.push(insight("valve_closed_flow", "warning", { flow: median(recent.map(row => row.inlet)).toFixed(1) }));
  }

  if (location.status === "suspected_leak_in_section" && Number.isFinite(recentLoss) && recentLoss >= threshold) {
    const spread = 1.4826 * mad(baselineRows, baseline) + 0.05;
    const z = Number.isFinite(baseline) ? (recentLoss - baseline) / spread : 0;
    const params = { loss: recentLoss.toFixed(1), baseline: Number.isFinite(baseline) ? baseline.toFixed(1) : "0.0" };
    insights.push(insight(z >= 3 ? "leak_pattern" : "loss_always_high", z >= 3 ? "critical" : "warning", params));
  } else if (Number.isFinite(recentLoss) && recentLoss <= -threshold) {
    insights.push(insight("negative_loss", "warning", { excess: Math.abs(recentLoss).toFixed(1) }));
  }

  const levelRows = rows.filter(row => Number.isFinite(row.level) && Number.isFinite(row.t)).slice(-120);
  if (levelRows.length >= 20) {
    const x = levelRows.map(row => (row.t - levelRows[0].t) / 60000);
    const y = levelRows.map(row => row.level);
    const meanX = x.reduce((sum, value) => sum + value, 0) / x.length;
    const meanY = y.reduce((sum, value) => sum + value, 0) / y.length;
    const denominator = x.reduce((sum, value) => sum + (value - meanX) ** 2, 0);
    const slope = denominator > 0 ? x.reduce((sum, value, i) => sum + (value - meanX) * (y[i] - meanY), 0) / denominator : 0;
    if (slope > 3) insights.push(insight("tank_dropping", "warning", { slope: slope.toFixed(1) }));
  }
  if (rows.slice(-30).filter(row => !Number.isFinite(row.level)).length >= 15) {
    insights.push(insight("level_missing", "warning"));
  }
  const last90 = rows.slice(-90);
  if (last90.length === 90 && new Set(last90.map(row => row.inlet)).size === 1 && last90[0].inlet > 0) {
    insights.push(insight("sensor_stuck", "warning"));
  }
  if (sampleAgeSeconds !== null && sampleAgeSeconds > Number(process.env.OFFLINE_AFTER_SECONDS || 10)) {
    insights.push(insight("stale_readings", "warning"));
  }
  if (!outletFresh) insights.push(insight("outlet_node_offline", "critical"));
  if (!insights.length) insights.push(insight("normal", "info"));

  const deviceHealth = {
    state: !outletFresh ? "degraded" : sampleAgeSeconds !== null && sampleAgeSeconds <= Number(process.env.OFFLINE_AFTER_SECONDS || 10) ? "online" : "stale",
    lastSampleAgeSeconds: sampleAgeSeconds,
    inletFlowWithinConfiguredRange: Number.isFinite(latest.inlet) && latest.inlet <= MAX_FLOW_LPM,
    outletFlowWithinConfiguredRange: Number.isFinite(latest.outlet) && latest.outlet <= MAX_FLOW_LPM,
    valveStateIsCommandedNotPhysicallyConfirmed: true,
    pressureSensor: "not_installed"
  };

  return {
    ...score(insights),
    samples: n,
    baselineLossLpm: Number.isFinite(baseline) ? Number(baseline.toFixed(2)) : null,
    leakLocation: location,
    deviceHealth
  };
}
