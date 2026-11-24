import { ingestReading, validateReading } from "../../lib/aquaguard.mjs";

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed." });
  const apiKey = process.env.ESP32_API_KEY || "";
  if (!apiKey) return send(res, 503, { error: "ESP32_API_KEY is not configured on the server." });
  if (req.headers.authorization !== `Bearer ${apiKey}`) return send(res, 401, { error: "Invalid bearer token." });

  let payload = req.body;
  try { if (typeof payload === "string") payload = JSON.parse(payload || "{}"); }
  catch { return send(res, 400, { error: "Request body must be valid JSON." }); }
  const error = validateReading(payload);
  if (error) return send(res, 422, { error });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return send(res, 503, { error: "Supabase persistence is not configured." });

  try {
    const result = await ingestReading(payload);
    if (result.missingDevice) return send(res, 404, { error: "Unknown device_id. Register the main ESP32 device before sending readings." });
    return send(res, 202, { accepted: true, ...result });
  } catch (error) {
    console.error(error);
    return send(res, 502, { error: "Supabase persistence failed." });
  }
}
