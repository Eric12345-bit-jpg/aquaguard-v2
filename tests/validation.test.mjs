import test from "node:test";
import assert from "node:assert/strict";
import { validateReading } from "../lib/aquaguard.mjs";

const valid = () => ({
  device_id: "XXSR69",
  inlet_flow_lpm: 4.5,
  outlet_flow_lpm: 3.8,
  valve_open: true,
  timestamp: new Date().toISOString()
});

test("accepts an existing contract-compatible reading", () => {
  assert.equal(validateReading(valid()), null);
});

test("rejects absurd flow spikes before persistence", () => {
  assert.match(validateReading({ ...valid(), inlet_flow_lpm: 1234 }), /0 to 30 L\/min/);
});

test("rejects negative, non-finite, and non-numeric readings", () => {
  assert.ok(validateReading({ ...valid(), outlet_flow_lpm: -0.1 }));
  assert.ok(validateReading({ ...valid(), outlet_flow_lpm: "4" }));
  assert.ok(validateReading({ ...valid(), outlet_flow_lpm: Number.NaN }));
});

test("rejects timestamps that are too old or too far in the future", () => {
  assert.match(validateReading({ ...valid(), timestamp: new Date(Date.now() - 25 * 3600_000).toISOString() }), /24 hours old/);
  assert.match(validateReading({ ...valid(), timestamp: new Date(Date.now() + 2 * 60_000).toISOString() }), /one minute in the future/);
});
