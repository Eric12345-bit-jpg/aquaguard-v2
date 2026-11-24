import test from "node:test";
import assert from "node:assert/strict";
import { locateLeak, pipeGeometry } from "../lib/leakLocator.mjs";

test("computes plausible internal volume for the specified 1 m, 8–12 mm pipe", () => {
  const geometry = pipeGeometry({ lengthM: 1, diameterMinMm: 8, diameterMaxMm: 12 });
  assert.equal(geometry.lengthM, 1);
  assert.equal(geometry.internalVolumeLitres.min, 0.05);
  assert.equal(geometry.internalVolumeLitres.max, 0.113);
});

test("reports only the monitored section when inlet flow exceeds outlet flow", () => {
  const result = locateLeak({ inletLpm: 6, outletLpm: 2, lengthM: 1, thresholdLpm: 2 });
  assert.equal(result.status, "suspected_leak_in_section");
  assert.equal(result.sectionLengthM, 1);
  assert.equal(result.distanceFromInletM, null);
  assert.equal(result.pointLocalizationPossible, false);
  assert.equal(result.lossLpm, 4);
});

test("does not call stale/missing readings a leak", () => {
  const result = locateLeak({ inletLpm: 10, outletLpm: 0, outletFresh: false });
  assert.equal(result.status, "insufficient_data");
  assert.equal(result.confidence, 0);
});

test("flags the contradictory closed-valve state for inspection first", () => {
  const result = locateLeak({ inletLpm: 1, outletLpm: 0, valveOpen: false, thresholdLpm: 2 });
  assert.equal(result.status, "measurement_or_valve_mismatch");
});

test("does not classify outlet-greater-than-inlet as a leak", () => {
  const result = locateLeak({ inletLpm: 1, outletLpm: 5, thresholdLpm: 2 });
  assert.equal(result.status, "sensor_calibration_mismatch");
});
