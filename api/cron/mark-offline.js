import { markOfflineDevices } from "../../lib/aquaguard.mjs";

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, { error: "Method not allowed." });
  const secret = process.env.CRON_SECRET || "";
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return send(res, 401, { error: "Unauthorized." });
  }
  try {
    await markOfflineDevices();
    return send(res, 200, { ok: true });
  } catch {
    return send(res, 500, { error: "Offline-device sweep failed." });
  }
}
