export function dashboardAccessError(request) {
  const token = process.env.DASHBOARD_ACCESS_TOKEN || "";
  if (!token) return { status: 503, error: "DASHBOARD_ACCESS_TOKEN is required before exposing service-role-backed dashboard data." };
  if (token && request.headers.authorization !== `Bearer ${token}`) return { status: 401, error: "Dashboard read token required." };
  return null;
}
