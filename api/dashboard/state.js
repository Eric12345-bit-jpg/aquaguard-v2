import { getDashboardState } from "../../lib/aquaguard.mjs";
import { dashboardAccessError } from "../../lib/dashboardAuth.mjs";

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, { error: "Method not allowed." });
  const accessError = dashboardAccessError(req);
  if (accessError) return send(res, accessError.status, { error: accessError.error });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return send(res, 503, { error: "Supabase is not configured." });
  const language = req.query?.lang || new URL(req.url || "/", "https://aquaguard.invalid").searchParams.get("lang") || "en";
  try { return send(res, 200, await getDashboardState(language)); }
  catch (error) { console.error("Dashboard state failed:", error.message); return send(res, 502, { error: "Unable to load dashboard state." }); }
}
