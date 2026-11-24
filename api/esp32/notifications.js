import { formatDeviceNotificationText, getDeviceNotifications } from "../../lib/aquaguard.mjs";

function send(res, status, body, contentType = "application/json; charset=utf-8") {
  res.statusCode = status;
  res.setHeader("content-type", contentType);
  res.setHeader("cache-control", "no-store");
  res.end(contentType.startsWith("text/plain") ? body : JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, { error: "Method not allowed." });
  const apiKey = process.env.ESP32_API_KEY || "";
  if (!apiKey) return send(res, 503, { error: "ESP32_API_KEY is not configured on the server." });
  if (req.headers.authorization !== `Bearer ${apiKey}`) return send(res, 401, { error: "Invalid bearer token." });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return send(res, 503, { error: "Supabase persistence is not configured." });
  const query = req.query || Object.fromEntries(new URL(req.url || "/", "https://aquaguard.invalid").searchParams);
  const deviceId = String(query.device_id || "");
  if (!/^[A-Za-z0-9._:-]{2,120}$/.test(deviceId)) return send(res, 400, { error: "A valid device_id is required." });
  const after = Number(query.after || 0);
  if (!Number.isSafeInteger(after) || after < 0) return send(res, 400, { error: "after must be a non-negative Unix timestamp in seconds." });
  try {
    const digest = await getDeviceNotifications(deviceId, query.lang || "en", after);
    if (!digest) return send(res, 404, { error: "Unknown device_id." });
    return send(res, 200, formatDeviceNotificationText(digest), "text/plain; charset=utf-8");
  } catch (error) {
    console.error("ESP32 notification digest failed:", error.message);
    return send(res, 502, { error: "Unable to load device notifications." });
  }
}
