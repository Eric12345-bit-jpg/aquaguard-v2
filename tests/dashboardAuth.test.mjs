import test from "node:test";
import assert from "node:assert/strict";
import { dashboardAccessError } from "../lib/dashboardAuth.mjs";

test("dashboard access fails closed locally when the token is missing", () => {
  const priorToken = process.env.DASHBOARD_ACCESS_TOKEN;
  const priorVercel = process.env.VERCEL;
  delete process.env.DASHBOARD_ACCESS_TOKEN;
  delete process.env.VERCEL;
  try {
    assert.equal(dashboardAccessError({ headers: {} }).status, 503);
  } finally {
    if (priorToken === undefined) delete process.env.DASHBOARD_ACCESS_TOKEN; else process.env.DASHBOARD_ACCESS_TOKEN = priorToken;
    if (priorVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = priorVercel;
  }
});

test("dashboard requires the configured bearer token on local and hosted modes", () => {
  const priorToken = process.env.DASHBOARD_ACCESS_TOKEN;
  const priorVercel = process.env.VERCEL;
  process.env.DASHBOARD_ACCESS_TOKEN = "unit-test-dashboard-token";
  delete process.env.VERCEL;
  try {
    assert.equal(dashboardAccessError({ headers: {} }).status, 401);
    assert.equal(dashboardAccessError({ headers: { authorization: "Bearer wrong" } }).status, 401);
    assert.equal(dashboardAccessError({ headers: { authorization: "Bearer unit-test-dashboard-token" } }), null);
    process.env.VERCEL = "1";
    assert.equal(dashboardAccessError({ headers: { authorization: "Bearer unit-test-dashboard-token" } }), null);
  } finally {
    if (priorToken === undefined) delete process.env.DASHBOARD_ACCESS_TOKEN; else process.env.DASHBOARD_ACCESS_TOKEN = priorToken;
    if (priorVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = priorVercel;
  }
});
