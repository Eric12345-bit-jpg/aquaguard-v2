# AquaGuard Rwanda

AquaGuard is a two-MCU water-loss monitoring system. The ESP8266 measures outlet flow and sends it over a private Wi-Fi link to the ESP32. The ESP32 measures inlet flow, compares both fresh readings, commands the solenoid relay, drives the buzzer/LCD/SIM800L, and serves a local backup dashboard. The cloud backend stores validated readings and produces advisory statistical AI/health insights.

**No pressure sensor is installed.** The monitored tube is approximately 1 m long and 8–12 mm diameter. With only inlet/outlet flow sensors, the system can suspect the *section between the sensors*, but cannot determine an exact location within it. The valve is normally open when unpowered; this means power loss opens it, not closes it.

## Local development

Use Node.js 20.6 or newer and pnpm:

```sh
cp .env.example .env
# Edit .env with your private Supabase URL/service-role key and two distinct random tokens.
pnpm install
pnpm dev
```

Open `http://localhost:3000`. Without the Supabase migrations, URL, and service-role key, the dashboard API and `/api/health` intentionally report that persistence/cloud connectivity is unavailable. Do not expose the service-role key or dashboard token in browser code. `.env` is ignored by Git.

Run checks and produce the Vercel static output with:

```sh
pnpm test
pnpm build
```

The build writes static assets under `public/`. The Vercel functions remain under `api/`.

## Database setup

In the intended Supabase project, apply migrations in this order: `001_initial_schema.sql`, `002_two_mcu_no_pressure.sql`, `003_ultrasonic_water_height.sql`, `004_internet_alert_types.sql`, `005_reading_integrity_and_health.sql`, and `006_preferred_language.sql`. The last three migrations are additive and do not delete historical readings. Migration 005 bounds *new* readings at 30 L/min; change that ceiling consistently in `.env`, both firmware sketches, and SQL only after validating the installed sensors.

The controller uses device ID `XXSR69`. Verify that this device is registered under the intended zone before powering cloud ingestion. An optional idempotent helper is in `supabase/seed/register-xxsr69.sql`; inspect it and use it only if the device/zone are missing. Existing credentials, project URL, and live device records are not bundled.

## Firmware

- `firmware/esp32_main/esp32_main.ino` — main controller, private AP dashboard, inlet/ultrasonic sensing, outlet packet validation, local safety, cloud reporting, AI/alert polling, LCD, buzzer, and GSM SMS.
- `firmware/esp8266_outlet/esp8266_outlet.ino` — outlet sensor and authenticated local telemetry.
- `firmware/esp32_main/relay_verification/relay_verification.ino` — explicit-command-only relay test; do this with the water supply isolated before using the main controller.
- `firmware/esp32_main/gsm_verification/gsm_verification.ino` — one explicit test SMS after typing `s` in the serial monitor; it does not operate the valve.
- `firmware/*/aquaguard_secrets.example.h` — safe templates. Copy each to `aquaguard_secrets.h` in the same sketch folder, edit locally, and never commit the copies. Use one identical outlet shared token in both sketches. The `.gitignore` excludes these private headers.

Select ESP32 Arduino core **3.3.10** for the main controller and install the `LiquidCrystal_I2C` Arduino library. Source compilation was checked with generic ESP32 Dev Module (`esp32:esp32:esp32`) and with NodeMCU v2 / ESP8266 core 3.1.2 (`esp8266:esp8266:nodemcuv2`); select the exact boards installed in your setup if they differ. The relay and GSM verification sketches were also compiled against ESP32 core 3.3.10. See [hardware and local integration](docs/esp32-integration.md), [deployment and operations](docs/deployment-and-operations.md), and [relay behavior](docs/Main%20ESP32%20solenoid%20control.md).

The initial 450 pulses/L value is a starting point only. Calibrate inlet and outlet sensors independently against a measured volume, then set the same maximum accepted flow in both sketches, `.env`, and the SQL constraint. Invalid flow spikes are discarded/rejected; a faulty or missing outlet stream triggers the configured local safety response rather than being silently replaced with a zero measurement.

## Local dashboard and outages

The main ESP32 serves the live standalone fallback at `http://192.168.4.1/` over its private `AquaGuard-ESP32` AP. Join that Wi-Fi network from the browser device first. The cloud dashboard has a direct offline-dashboard link and shows a localized notice after its API remains unavailable for two minutes. The cloud shell is service-worker cached after its first visit; it cannot show fresh cloud readings while disconnected. The ESP32-hosted page remains the independent live local view.

Cloud access is tested through `/api/health`, which also probes Supabase. An outage/recovery SMS is generated locally after a two-minute unreachable interval and on restoration. Local flow safety, buzzer, LCD, SMS, and AP dashboard do not require cloud access. Cloud database history and cloud AI are not available offline; missed readings are not silently backfilled.

## Vercel

Configure server-only variables in Vercel Project Settings: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ESP32_API_KEY`, `DASHBOARD_ACCESS_TOKEN`, and `CRON_SECRET`; optionally add `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`. Also set `FLOW_DIFFERENCE_THRESHOLD_LPM`, `LEAK_CONFIRMATION_SECONDS`, `MAX_FLOW_LPM`, `OFFLINE_AFTER_SECONDS`, `PIPE_LENGTH_M`, `PIPE_DIAMETER_MIN_MM`, and `PIPE_DIAMETER_MAX_MM` to match the calibrated firmware. Apply database migrations before deploying functions. `vercel.json` schedules the authenticated offline-device sweep once per minute; confirm that the selected Vercel plan supports this cron cadence.

`vercel.json` runs `npm run build` and publishes `public/`; Vercel runs API functions from `api/`. The ESP32 endpoint is `<your-domain>/api/esp32/readings`. Configure the firmware TLS trust certificate for an HTTPS endpoint; certificate verification is enabled and there is no insecure TLS fallback. For local hardware tests, point the main ESP32 header at the development PC's **LAN IP**, not `localhost`.

## Safety and verification

A normal operating imbalance of at least 2 L/min must persist for 10 seconds before the ESP32 commands the valve closed; stale outlet telemetry is timed out after 5 seconds. The ESP32 has no valve-position feedback, so the dashboard reports the commanded state only. Reset is guarded by a human confirmation plus five stable balanced samples and a fresh outlet link.

A normally-open solenoid whose coil is switched through the relay's NO contact is commanded open when the relay is de-energized and closed when energized. This exact mapping must be verified with the supplied relay sketch, the actual relay board, and the water supply isolated. The switch contact/current rating, separate coil supply, driver polarity, flyback suppression and common ground must be validated physically. No hardware, service-provider configuration, production data, or Vercel deployment has been tested by this repository.

The nine-language catalog covers AI insight titles/details, alert titles/details, outage/offline controls, and firmware SMS/LCD notification content. The surrounding dashboard navigation and general page copy are currently English; the language selector does not translate every static interface phrase in this release.

See the [verification report](docs/verification-report.md) for exact automated and firmware compile checks, along with behavior that still requires the real hardware, Supabase project, GSM service, and Vercel deployment.
