# AquaGuard Rwanda — Implementation Plan

## Product approach
AquaGuard measures water entering and leaving a 1 m monitored pipe segment. The expected clear flexible PVC/silicone tube has an estimated 8–12 mm inside diameter. There are two flow meters and no pressure sensors. A persistent inlet-minus-outlet imbalance can flag a likely leak in the instrumented segment; it cannot identify an exact point along the metre. The UI, SMS, LCD, and AI text must say “section between the sensors,” never fabricate a distance or point.

The main ESP32 remains the only valve actuator and runs local protection, buzzer, LCD, SIM800L SMS, Wi-Fi AP, and an independent local dashboard. The ESP8266 outlet node reports only outlet flow to the ESP32 AP. Internet/cloud analysis is advisory; it never controls the relay. Loss of cloud access for 120 seconds creates a local SMS/LCD notice, and local sensing/shutoff continue. A normally-open valve opens when unpowered, so the specified hardware is not fail-closed during power loss.

The web application keeps the existing AquaGuard hydrological command-console style and vanilla JavaScript architecture. It remains runnable via `pnpm dev` on a local PC and builds static assets for Vercel. Supabase credentials remain server-only. The admin language selection is shared with the ESP32 so cloud AI/alert messages sent by SMS and shown on the LCD use the same language. The requested locales are English, Kinyarwanda, French, Kiswahili, Chinese, Dutch, Italian, Spanish, and Hindi.

## Analysis and evidence limits
`lib/ai.mjs` performs transparent statistical/anomaly and health checks; it is advisory, not a generative model and cannot actuate hardware. `lib/leakLocator.mjs` calculates pipe internal volume and flags a flow imbalance only when both sensor samples are valid and fresh. It reports the monitored section and a null point-distance because two endpoint flow values contain no spatial measurement. Estimation thresholds and flow calibration are configurable; 450 pulses/L is only a common initial calibration value, not a confirmed setting for either installed sensor.

## Offline and notification behavior
The ESP32 hosts `http://192.168.4.1/` on its private AP. That page displays on-device telemetry, commanded valve state, network/cloud state, recent local alert, GSM send status/text, physical LCD lines, language selection, and the guarded reset control without requiring Internet. The cloud app also has a local-dashboard link and caches its static shell after the first visit; it cannot fetch fresh Supabase data while disconnected. The actual ESP32 AP page is the standalone live offline dashboard.

The SIM800L sends an SMS when the local leak or hardware/network fault is recognized and enqueues a one-minute status update. Authenticated ESP32 polling delivers new cloud alerts and critical/warning AI insights to SMS/LCD while cloud access exists. A bounded queue prioritizes faults over periodic reports. GSM registration/coverage, SIM, power, and carrier restrictions can delay or prevent delivery. Chinese/Hindi SMS use UCS2; a standard 16×2 character LCD instead displays short Latin transliterations for scripts it cannot render.

## Serving, persistence and security
- `local-server.mjs` — Node local API/static server, authenticated ingestion, dashboard guard, language preference, device notification digest, and outage marking.
- `api/` — Vercel serverless equivalents. `api/health.js` probes Supabase reachability for the ESP32 outage monitor.
- `lib/aquaguard.mjs` — input validation, Supabase persistence, AI/alert payloads and device notification protocol.
- `lib/ai.mjs`, `lib/i18n.mjs`, `lib/leakLocator.mjs` — statistical diagnostics, locale catalog, flow-only section estimator.
- `src/` — dashboard and existing responsive style system; `public/` — static routes, PWA service worker and Vercel build output.
- `firmware/esp32_main/` — main controller, relay/SMS diagnostics, safe secret template.
- `firmware/esp8266_outlet/` — outlet-node sketch and matching local-secret template.
- `supabase/migrations/` — additive schema changes; apply in numerical order.
- `docs/` — hardware, relay, deployment and operating instructions.

The browser never receives the Supabase service-role key. `ESP32_API_KEY`, `DASHBOARD_ACCESS_TOKEN`, local outlet token, Wi-Fi credentials, phone number, and TLS root certificate belong in private server settings or ignored `aquaguard_secrets.h` copies—not in the public repository. No supplied `.env` or private header is packaged.

## Design direction
Retain the existing **Hydrological command console**: restrained mission-control UI for water infrastructure, calm instrument-panel geometry, clear signal hierarchy, and no decorative imagery in the operations dashboard.

- **Core principles:** one-glance comprehension; honest telemetry provenance and staleness; signal over decoration; explicit human acknowledgement before a guarded reset.
- **Color philosophy:** deep navy for dependable field visibility, cyan for measured flow, green for healthy readings, amber for degraded status, and red only for actionable danger.
- **Layout:** existing fixed navigation rail with a dominant flow/status panel, supporting device and alert modules, and an AI section that exposes its language and evidence limits.
- **Signature elements:** cyan waterline header rule, compact tabular telemetry figures, and restrained status-orb treatment.
- **Interaction and motion:** controls state their effect; the offline link tells the operator to join the ESP32 AP; status transitions use short, subtle fades only.
- **Typography and voice:** preserve Plus Jakarta Sans and tabular numerals; concise, calm, operational microcopy. Brand essence: a trustworthy water-network signal desk for Rwanda's field teams; calm, honest, useful.
- **Brand mark/color:** retain the existing droplet-and-pipe AquaGuard mark and `#57D7E8` measured-water cyan.

## Delivery boundaries
This implementation can be exercised with unit and HTTP smoke tests, but the actual flow sensors, GSM modem/carrier, relay, solenoid, PC LAN address, Supabase project, Vercel secrets, and valve movement must be verified by the operator. A code-level relay test is provided; no physical hardware or production deployment is claimed as completed.
