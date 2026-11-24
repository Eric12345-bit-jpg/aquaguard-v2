# AquaGuard release verification

## Checks that passed in the release workspace

- `pnpm install --frozen-lockfile` completed with the current lockfile.
- `pnpm test`: **24 tests passed**. Coverage includes leak-section limits, input/timestamp validation, AI/alert localization, notification formatting, cloud health, preferred-language persistence, and dashboard bearer-token enforcement.
- JavaScript syntax checks passed for files in `lib/`, `api/`, `src/`, `scripts/`, and `tests/`.
- `pnpm build` generated the Vercel static output in `public/`.
- `pnpm dev` served `/`, `/src/dashboard.js`, `/lib/i18n.mjs`, `/sw.js`, and `/manus-routes.json` with HTTP 200. With the intentionally empty test `.env`, health/data/language APIs returned HTTP 503 rather than exposing unconfigured data; ESP32 ingestion also rejected requests because no API key was configured.
- Main ESP32 firmware and the separate relay/GSM verification sketches compiled against **ESP32 Arduino core 3.3.10** for generic ESP32 Dev Module (`esp32:esp32:esp32`). The main image used 1,153,964 bytes (88%) of the configured app partition and 52,848 bytes (16%) of dynamic memory.
- Outlet firmware compiled for NodeMCU v2 with ESP8266 Arduino core 3.1.2 (`esp8266:esp8266:nodemcuv2`).
- Temporary dummy credential headers used for compilation were removed afterward; the release contains only safe `.example.h` templates.

Builds succeeded. The third-party `LiquidCrystal_I2C` library emitted non-fatal deprecated binary-literal warnings; the ESP8266 core's Python build utility emitted non-fatal invalid-escape `SyntaxWarning`s.

## Not verified

No device was connected, no code was flashed to the user's hardware, and no valve, relay, sensor, LCD, buzzer, SIM800L, GSM carrier, SIM, 2G service, or UCS2 SMS was physically exercised. The actual board variants may differ from the compile targets above. Confirm the real relay input polarity and NO-contact wiring with the water isolated before connecting or pressurizing the line.

Migrations 001–006 were not applied to a live Supabase project. The production device/zone registration, secrets, Supabase health, cloud ingestion, cloud alert delivery, Vercel build/deployment, Vercel plan support for the one-minute Cron schedule, and `CRON_SECRET` were not verified.

## Timing and output limits

The leak rule uses a 2 L/min inlet/outlet difference sustained for 10 seconds and a five-second stale-outlet timeout. Local flow safety is evaluated before and after network work, but synchronous HTTP calls can still delay a loop pass by about two seconds; SMS discovered during an existing modem transaction waits for that transaction to finish. Cloud-health probes occur every 10 seconds, and the outage alert is queued after 120 seconds from the first failed probe, so the alert can occur later than 120 seconds from the actual WAN/cloud failure. GSM/carrier delivery time is not guaranteed.

SMS is a persistent, bounded 32-entry queue and each new cloud alert/critical-or-warning AI insight gets a separate, single-segment localized SMS; long details are truncated to fit one segment. The LCD rotates compact localized summaries, not full paragraphs. Full explanations remain in the cloud dashboard. Chinese and Hindi SMS use UCS2 if supported by the modem/carrier; the standard 16×2 LCD cannot render those scripts and uses short Latin transliterations.

With two endpoint flow meters and no pressure sensor, acoustic sensor, or intermediate measurement, the system can identify only the monitored 1 m section as suspect. It cannot calculate a trustworthy point within the tube; `distanceFromInletM` is deliberately unknown.
