import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { cloudHealth, formatDeviceNotificationText, getDashboardState, getDeviceNotifications, getPreferredLanguage, ingestReading, markOfflineDevices, setPreferredLanguage, supabaseConfigured, telegramTest, validateReading } from "./lib/aquaguard.mjs";
import { dashboardAccessError } from "./lib/dashboardAuth.mjs";
import { LANGUAGES } from "./lib/i18n.mjs";

const rootDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
const port = Number(process.env.PORT || 3000);
const apiKey = process.env.ESP32_API_KEY || "";
const mime = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".ico": "image/x-icon"
};
const routes = new Set(["/", "/index.html", "/live-monitoring", "/devices", "/alerts", "/settings"]);

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

async function readBody(req, maxBytes = 16_384) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) throw new Error("Payload too large.");
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); }
  catch { throw new Error("Request body must be valid JSON."); }
}

async function serveStatic(pathname, res) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const decoded = decodeURIComponent(requested);
  let filePath = resolve(rootDir, `.${decoded}`);
  if (filePath !== rootDir && !filePath.startsWith(`${rootDir}${sep}`)) return json(res, 403, { error: "Forbidden" });
  try {
    const body = await readFile(filePath);
    res.writeHead(200, {
      "content-type": mime[extname(filePath)] || "application/octet-stream",
      "cache-control": pathname === "/sw.js" ? "no-cache" : "public, max-age=0, must-revalidate"
    });
    return res.end(body);
  } catch {
    const publicPath = resolve(rootDir, "public", decoded.replace(/^\/+/, ""));
    try {
      const body = await readFile(publicPath);
      res.writeHead(200, { "content-type": mime[extname(publicPath)] || "application/octet-stream", "cache-control": pathname === "/sw.js" ? "no-cache" : "public, max-age=0, must-revalidate" });
      return res.end(body);
    } catch {}
    if (routes.has(pathname)) {
      const body = await readFile(resolve(rootDir, "index.html"));
      res.writeHead(200, { "content-type": mime[".html"], "cache-control": "no-cache" });
      return res.end(body);
    }
    return json(res, 404, { error: "Not found" });
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const path = url.pathname;
    if (req.method === "GET" && path === "/api/health") {
      const health = await cloudHealth();
      return json(res, health.ok ? 200 : 503, { ...health, service: "aquaguard-api", flowLimitLpm: Number(process.env.MAX_FLOW_LPM || 30) });
    }
    if (req.method === "GET" && path === "/api/dashboard/state") {
      const accessError = dashboardAccessError(req);
      if (accessError) return json(res, accessError.status, { error: accessError.error });
      if (!supabaseConfigured()) return json(res, 503, { error: "Supabase persistence is not configured." });
      return json(res, 200, await getDashboardState(url.searchParams.get("lang") || "en"));
    }
    if ((req.method === "GET" || req.method === "POST") && path === "/api/dashboard/language") {
      const accessError = dashboardAccessError(req);
      if (accessError) return json(res, accessError.status, { error: accessError.error });
      if (!supabaseConfigured()) return json(res, 503, { error: "Supabase persistence is not configured." });
      if (req.method === "GET") return json(res, 200, { language: await getPreferredLanguage() });
      let payload;
      try { payload = await readBody(req, 2048); } catch (error) { return json(res, 400, { error: error.message }); }
      const language = String(payload.language || "").trim().toLowerCase();
      if (!LANGUAGES.some(item => item.code === language)) return json(res, 400, { error: "Unsupported language." });
      return json(res, 200, { saved: true, language: await setPreferredLanguage(language) });
    }
    if (req.method === "GET" && path === "/api/esp32/notifications") {
      if (!apiKey || req.headers.authorization !== `Bearer ${apiKey}`) return json(res, 401, { error: "Invalid bearer token." });
      if (!supabaseConfigured()) return json(res, 503, { error: "Supabase persistence is not configured." });
      const deviceId = url.searchParams.get("device_id") || "";
      const after = Number(url.searchParams.get("after") || 0);
      if (!/^[A-Za-z0-9._:-]{2,120}$/.test(deviceId) || !Number.isSafeInteger(after) || after < 0) return json(res, 400, { error: "Invalid device_id or after cursor." });
      const digest = await getDeviceNotifications(deviceId, url.searchParams.get("lang") || "en", after);
      if (!digest) return json(res, 404, { error: "Unknown device_id." });
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
      return res.end(formatDeviceNotificationText(digest));
    }
    if (req.method === "POST" && path === "/api/esp32/readings") {
      if (!apiKey) return json(res, 503, { error: "ESP32_API_KEY is not configured on the server." });
      if (req.headers.authorization !== `Bearer ${apiKey}`) return json(res, 401, { error: "Invalid bearer token." });
      let payload;
      try { payload = await readBody(req); } catch (error) { return json(res, 400, { error: error.message }); }
      const validationError = validateReading(payload);
      if (validationError) return json(res, 422, { error: validationError });
      if (!supabaseConfigured()) return json(res, 503, { error: "Supabase persistence is not configured." });
      const result = await ingestReading(payload);
      if (result.missingDevice) return json(res, 404, { error: "Unknown device_id. Register the main ESP32 device before sending readings." });
      return json(res, 202, { accepted: true, ...result });
    }
    if (req.method === "POST" && path === "/api/telegram/test") {
      if (!apiKey || req.headers.authorization !== `Bearer ${apiKey}`) return json(res, 401, { error: "Admin authentication required." });
      return (await telegramTest()) ? json(res, 200, { sent: true }) : json(res, 502, { error: "Telegram delivery failed or is not configured." });
    }
    return serveStatic(path, res);
  } catch (error) {
    console.error("AquaGuard request failed:", error.message);
    return json(res, 500, { error: "Unexpected server error." });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`AquaGuard listening on 0.0.0.0:${port}`);
  if (supabaseConfigured()) setInterval(() => markOfflineDevices().catch(error => console.error("Offline check failed:", error.message)), 5000);
});
