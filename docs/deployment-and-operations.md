# Deployment and operations

## 1. Apply the schema

In the target Supabase SQL editor, review and apply `supabase/migrations/001_initial_schema.sql` through `006_preferred_language.sql` in numerical order. If the first three migrations already ran, apply only 004, 005, and 006. The 004 enum additions are intentionally in a separate migration. Migration 005 adds receipt/health metadata, an index, and a `NOT VALID` flow ceiling for new rows; it does not rewrite or delete historical readings. Migration 006 creates a server-only preferred-language setting table with RLS enabled and no public policy.

Verify that the devices table has an `XXSR69` row and the intended monitoring zone. Only if missing, inspect and run `supabase/seed/register-xxsr69.sql`. It preserves an existing device zone when one is already present. Do not create test readings in a production database.

## 2. Generate separate secrets

Create independent random values for the API bearer key, dashboard read token, and outlet-to-ESP32 local token. Example on a PC with Node:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use a different result for each token. Set the first three in local `.env`/Vercel server settings; copy the API and outlet tokens into the private ESP32 header; copy the outlet token into the private ESP8266 header. Keep Wi-Fi credentials, the alert phone number and TLS CA certificate out of Git. The service-role Supabase key is never put into firmware or the browser.

## 3. Local development on the PC

1. Install Node.js 20.6+ and pnpm.
2. Copy `.env.example` to `.env`, fill `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ESP32_API_KEY`, `DASHBOARD_ACCESS_TOKEN`, thresholds and pipe geometry. Keep `.env` private.
3. Run `pnpm install`, `pnpm test`, then `pnpm dev`; open `http://localhost:3000`.
4. For ESP32 cloud reporting to the local machine, bind the server to the LAN and use the PC's LAN IP in `AQ_AQUAGUARD_ENDPOINT`, not `localhost`. Allow TCP port 3000 through the PC firewall only on the trusted private network.
5. Local `pnpm dev` can continue serving static dashboard files during a WAN outage. Its `/api/health` reaches Supabase before returning success, so it does not misreport a local HTTP listener as working Internet/cloud persistence.

Do not expose a local PC development server publicly. Vercel is the intended public deployment option.

## 4. Vercel configuration

Import the project repository into Vercel and use the committed `vercel.json` build contract: `npm run build`, static output `public/`, serverless routes under `api/`. It schedules `/api/cron/mark-offline` once per minute; the route rejects requests unless `Authorization: Bearer $CRON_SECRET` is present. Confirm the selected Vercel plan supports this cron cadence. Configure these values as server-side project environment variables (Production and Preview as required):

- Required: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ESP32_API_KEY`, `DASHBOARD_ACCESS_TOKEN`, `CRON_SECRET`.
- Optional: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` for backend event notification.
- Numeric settings: `FLOW_DIFFERENCE_THRESHOLD_LPM=2`, `LEAK_CONFIRMATION_SECONDS=10`, `MAX_FLOW_LPM=30`, `OFFLINE_AFTER_SECONDS=10`, `PIPE_LENGTH_M=1`, `PIPE_DIAMETER_MIN_MM=8`, `PIPE_DIAMETER_MAX_MM=12`.

Keep threshold and maximum-flow settings consistent with the firmware and database constraint. Build and deploy only after database setup. Verify `/api/health` returns HTTP 200 with `{ "ok": true }` and authenticated `/api/dashboard/state` returns data after device setup. An absent token or unconfigured database should fail closed rather than return protected data.

For Vercel TLS, set the HTTPS endpoint in the ESP32 private header and insert a trusted root CA PEM that validates the deployed host. The firmware verifies certificates. It intentionally refuses HTTPS when the CA is missing/too short; do not change this to `setInsecure()`.

## 5. Firmware private files and libraries

For `firmware/esp32_main/` and `firmware/esp8266_outlet/`, copy the local `aquaguard_secrets.example.h` to `aquaguard_secrets.h`. Enter settings in the copies and keep them untracked. The main sketch requires ESP32 Arduino core **3.3.10** and the `LiquidCrystal_I2C` library. The outlet sketch needs the ESP8266 board core. The supplied `relay_verification.ino` and `gsm_verification.ino` are separate test programs, not additional files to compile into the main sketch.

The local AP runs at `192.168.4.1`. Set its password to a private value of at least eight characters. A client joining that AP can view the local state and request the guarded reset. Reset has no second application passcode: AP access is privileged and must be limited to authorized operators.

## 6. Operating messages and outage behavior

The ESP32 sends one status SMS at boot and then schedules a status SMS every 60 seconds while the SMS queue/modem/carrier permit. A local fault queues a high-priority SMS immediately after its detection rule (two-flow imbalance: 2 L/min for 10 seconds; outlet link loss: 5 seconds; cloud-health loss: 120 seconds from the first failed probe). Cloud-health probes run every 10 seconds; therefore outage detection can lag a real WAN/cloud loss by about one probe interval plus request timeout. Cloud alert/AI polling is every 15 seconds when available. Requests are synchronous but bounded to about 2 seconds and the loop performs at most one HTTP operation per pass, so sample/safety actions can be delayed by up to that bound. A fault detected while another GSM send is in progress cannot preempt that modem transaction. Pending SMS are stored in ESP32 Preferences and retried after reboot; GSM/carrier acceptance is still not guaranteed. The 32-entry queue can displace its oldest pending item if a higher-priority alert arrives while full.

To open the independent offline page, connect the browser to the ESP32 AP and visit `http://192.168.4.1/`. The cloud dashboard link cannot make a browser join Wi-Fi automatically. Service-worker caching only preserves the cloud site's static shell after a previous visit; it is not a source of new sensor values. The ESP32 page is the fresh local view. Cloud storage, cloud AI, and cloud notifications need a functioning cloud link. Missed readings are not buffered for later upload.

Each new cloud alert and warning/critical AI insight gets its own localized single-segment SMS and a rotating LCD summary. To fit one SMS and the 16×2 display, long SMS details and LCD text are truncated; the cloud dashboard retains the full explanation. Chinese and Hindi phone notifications use UTF-16BE/UCS2 encoding, subject to SIM800L/carrier support. The LCD cannot display CJK/Devanagari glyphs; it shows short Latin transliterations. The cloud dashboard AI language switch persists the single global locale, which the ESP32 polls and applies to subsequent notifications.

## 7. Leak estimates and safety boundary

A positive inlet-minus-outlet difference can flag the 1 m monitored section. With no intermediate sensor, acoustic signal, pressure wave or known leak propagation measurement, the position within the tube is unobservable; the app returns `distanceFromInletM: null`. The 8–12 mm geometry estimates approximately 0.050–0.113 L internal volume only. It does not determine leak rate or leak location.

The relay test verifies electrical/command mapping only. The NO valve physically opens when its coil loses power; this is a user-confirmed configuration but it means a power failure does not shut the line. Confirm physical movement with the water isolated and remain at the system during initial low-pressure test. The firmware only knows the commanded valve state. It cannot verify an open/closed mechanical position or prove water has stopped.

## 8. Release checks

`pnpm test` covers bounded telemetry, timestamps, localization, flow-only leak evidence, AI output metadata, device notification framing, cloud-health behavior and dashboard-token enforcement. `pnpm build` checks Vercel static output. Local HTTP smoke checks cover static assets, route manifest and safe API failures. Main ESP32 and relay/GSM verification sketches compiled against ESP32 core 3.3.10; the outlet node compiled for NodeMCU v2 with ESP8266 core 3.1.2. These software checks do not substitute for flashing/physical verification, relay and sensor calibration, actual SMS receipt, migrations on the target Supabase project, or a Vercel deployment.
