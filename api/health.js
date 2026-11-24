import { cloudHealth } from "../../lib/aquaguard.mjs";

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
}

export default async function handler(_req, res) {
  const health = await cloudHealth();
  send(res, health.ok ? 200 : 503, { ...health, service: "aquaguard-api" });
}
