import test from "node:test";
import assert from "node:assert/strict";
import { analyzeReadings } from "../lib/ai.mjs";

const samples = ({ inlet, outlet, valve = true } = {}) => Array.from({ length: 40 }, (_, i) => ({
  inlet_flow_lpm: inlet ?? (i < 30 ? 2 : 8),
  outlet_flow_lpm: outlet ?? (i < 30 ? 2 : 2),
  valve_open: valve,
  water_level: 42,
  observed_at: new Date(Date.now() - (39 - i) * 1000).toISOString()
})).reverse();

test("identifies only the instrumented section for a sustained flow imbalance", () => {
  const analysis = analyzeReadings(samples(), { threshold: 2, outletFresh: true });
  assert.equal(analysis.leakLocation.status, "suspected_leak_in_section");
  assert.equal(analysis.leakLocation.distanceFromInletM, null);
  assert.equal(analysis.deviceHealth.pressureSensor, "not_installed");
  assert.ok(analysis.insights.some(item => item.code === "leak_pattern"));
});

test("marks stale outlet data as degraded rather than estimating a leak", () => {
  const analysis = analyzeReadings(samples({ inlet: 5, outlet: 0 }), { outletFresh: false });
  assert.equal(analysis.leakLocation.status, "insufficient_data");
  assert.equal(analysis.deviceHealth.state, "degraded");
  assert.ok(analysis.insights.some(item => item.code === "outlet_node_offline"));
});
