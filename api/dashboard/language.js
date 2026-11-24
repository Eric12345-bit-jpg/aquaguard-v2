import { LANGUAGES } from "../../lib/i18n.mjs";
import { getPreferredLanguage, setPreferredLanguage, supabaseConfigured } from "../../lib/aquaguard.mjs";
import { dashboardAccessError } from "../../lib/dashboardAuth.mjs";

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return send(res, 405, { error: "Method not allowed." });
  const accessError = dashboardAccessError(req);
  if (accessError) return send(res, accessError.status, { error: accessError.error });
  if (!supabaseConfigured()) return send(res, 503, { error: "Supabase persistence is not configured." });
  if (req.method === "GET") {
    try { return send(res, 200, { language: await getPreferredLanguage() }); }
    catch (error) { console.error("Preferred language read failed:", error.message); return send(res, 502, { error: "Could not read preferred language." }); }
  }
  let payload = req.body;
  try { if (typeof payload === "string") payload = JSON.parse(payload || "{}"); }
  catch { return send(res, 400, { error: "Request body must be JSON." }); }
  const language = String(payload?.language || "").trim().toLowerCase();
  if (!LANGUAGES.some(item => item.code === language)) return send(res, 400, { error: "Unsupported language." });
  try { return send(res, 200, { saved: true, language: await setPreferredLanguage(language) }); }
  catch (error) { console.error("Preferred language update failed:", error.message); return send(res, 502, { error: "Could not persist preferred language." }); }
}
