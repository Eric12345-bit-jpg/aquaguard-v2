// Honest, flow-balance-only leak localization for AquaGuard's two-sensor layout.
// Two endpoint flow sensors can identify an imbalanced section, not a coordinate
// within that section. No pressure/acoustic/temperature propagation model is used.
const finite = value => typeof value === "number" && Number.isFinite(value);

export function pipeGeometry({ lengthM = 1, diameterMinMm = 8, diameterMaxMm = 12 } = {}) {
  const length = finite(lengthM) && lengthM > 0 ? lengthM : 1;
  const dMin = finite(diameterMinMm) && diameterMinMm > 0 ? diameterMinMm : 8;
  const dMax = finite(diameterMaxMm) && diameterMaxMm >= dMin ? diameterMaxMm : dMin;
  const volumeLitres = diameterMm => Math.PI * (diameterMm / 1000) ** 2 / 4 * length * 1000;
  return {
    lengthM: length,
    diameterMinMm: dMin,
    diameterMaxMm: dMax,
    internalVolumeLitres: {
      min: Number(volumeLitres(dMin).toFixed(3)),
      max: Number(volumeLitres(dMax).toFixed(3))
    }
  };
}

/**
 * Return a section-level estimate. `thresholdLpm` is the minimum sustained
 * flow imbalance that the system considers actionable; sensor uncertainty and
 * lag must be calibrated on the real installation.
 */
export function locateLeak({
  inletLpm,
  outletLpm,
  lengthM = 1,
  diameterMinMm = 8,
  diameterMaxMm = 12,
  thresholdLpm = 2,
  inletValid = true,
  outletValid = true,
  valveOpen = null,
  outletFresh = true
} = {}) {
  const geometry = pipeGeometry({ lengthM, diameterMinMm, diameterMaxMm });
  const base = {
    method: "flow_balance_between_two_sensors",
    section: "between_inlet_and_outlet_flow_sensors",
    sectionLengthM: geometry.lengthM,
    pipeDiameterMm: { min: geometry.diameterMinMm, max: geometry.diameterMaxMm },
    estimatedPipeVolumeL: geometry.internalVolumeLitres,
    distanceFromInletM: null,
    pointAccuracyM: null,
    pointLocalizationPossible: false,
    disclaimer: "Flow-only readings identify an imbalanced section, not a point within it. Exact point localization requires additional spatially distributed pressure/acoustic sensing or intermediate flow sensors."
  };

  if (!inletValid || !outletValid || !outletFresh || !finite(inletLpm) || !finite(outletLpm) || inletLpm < 0 || outletLpm < 0) {
    return { ...base, status: "insufficient_data", confidence: 0, lossLpm: null, reason: "One or both flow measurements are invalid or stale." };
  }

  const signedDifference = inletLpm - outletLpm;
  const lossLpm = Math.max(0, signedDifference);
  const limit = finite(thresholdLpm) && thresholdLpm >= 0 ? thresholdLpm : 2;

  if (valveOpen === false && inletLpm > Math.max(0.25, limit * 0.1)) {
    return {
      ...base,
      status: "measurement_or_valve_mismatch",
      confidence: 0.35,
      lossLpm: Number(lossLpm.toFixed(2)),
      signedDifferenceLpm: Number(signedDifference.toFixed(2)),
      reason: "Reported closed-valve state conflicts with measured inlet flow; verify relay/valve polarity and sensor noise before localizing."
    };
  }

  if (signedDifference < -limit) {
    return {
      ...base,
      status: "sensor_calibration_mismatch",
      confidence: 0.25,
      lossLpm: 0,
      signedDifferenceLpm: Number(signedDifference.toFixed(2)),
      reason: "Outlet flow exceeds inlet flow beyond the configured tolerance; check calibration, sensor placement and direction."
    };
  }

  if (lossLpm < limit) {
    return {
      ...base,
      status: "no_sustained_imbalance",
      confidence: 0.7,
      lossLpm: Number(lossLpm.toFixed(2)),
      signedDifferenceLpm: Number(signedDifference.toFixed(2)),
      reason: "Current flow difference is below the configured alarm threshold; this does not prove the pipe is leak-free."
    };
  }

  const margin = Math.max(0, lossLpm - limit);
  const confidence = Math.min(0.95, 0.55 + margin / Math.max(limit * 4, 1));
  return {
    ...base,
    status: "suspected_leak_in_section",
    confidence: Number(confidence.toFixed(2)),
    lossLpm: Number(lossLpm.toFixed(2)),
    signedDifferenceLpm: Number(signedDifference.toFixed(2)),
    reason: `A sustained positive flow imbalance of ${lossLpm.toFixed(2)} L/min is consistent with loss somewhere in the ${geometry.lengthM.toFixed(2)} m monitored section. The measured data cannot resolve the position within that section.`
  };
}

export default locateLeak;
