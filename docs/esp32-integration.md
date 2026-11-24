# AquaGuard two-MCU hardware and local integration

## Architecture

The ESP8266 node measures only outlet flow sensor 2. It joins the private Wi-Fi AP hosted by the main ESP32 and posts JSON to `http://192.168.4.1/outlet-reading` with an `X-Outlet-Token` header. There is no physical data wire between MCUs. The ESP32 samples inlet flow, validates the outlet sequence and freshness, commands the valve, runs local protection, drives a 16×2 LCD and buzzer, sends SIM800L SMS, and posts readings to the configured cloud API. It also hosts a live local dashboard at `http://192.168.4.1/`.

The controller needs **no pressure sensor**. The specified clear flexible PVC/silicone tube is 1 m long and estimated 8–12 mm inside diameter. With endpoint flow meters only, estimated water imbalance can identify the monitored segment as suspect; it cannot resolve a point along that segment. The section's geometric internal volume is about 0.050–0.113 L. That is not a localization accuracy or leak-size claim.

## Pin connections

### ESP8266 outlet node

| Signal | Pin | Notes |
|---|---|---|
| Outlet flow pulse | D5 / GPIO14 | Use the sensor's proper rated supply and signal voltage |
| Flow sensor GND | GND | Common ground with ESP8266 |
| Link to ESP32 | Wi-Fi only | No UART/data cable between MCUs |

### ESP32 main controller

| Signal | Pin | Notes |
|---|---:|---|
| Inlet flow pulse | GPIO25 | 3.3 V-safe input; internal pull-up enabled |
| Relay input | GPIO23 | Never power the solenoid coil from a GPIO |
| Active buzzer | GPIO14 | This firmware assumes active-high output; verify module polarity |
| LCD SDA / SCL | GPIO21 / GPIO22 | `Wire.begin(21, 22)`; default I²C address `0x27` |
| Ultrasonic TRIG / ECHO | GPIO26 / GPIO27 | HC-SR04-like ECHO commonly needs a resistor divider to 3.3 V |
| SIM800L ESP32 RX / TX | GPIO32 / GPIO33 | ESP32 RX2 ← modem TX; ESP32 TX2 → modem RX through a suitable level interface |

Supply the solenoid and SIM800L with properly rated power supplies; SIM800L current peaks require a stable supply beyond ordinary ESP32 3.3 V. Keep grounds common where required. Add flyback suppression for a DC valve, use a rated driver/relay, and protect every ESP32/ESP8266 input from overvoltage. Do not connect HC-SR04 5 V ECHO directly to GPIO27.

## Private firmware settings

For each sketch folder, copy its `aquaguard_secrets.example.h` to `aquaguard_secrets.h`. Put real values only in the ignored private copy. Configure the main ESP32's Wi-Fi SSID/password, local AP name/password, outlet shared token, server API bearer key, endpoint, alert phone number, and (for HTTPS) a trusted root certificate. Configure the ESP8266 with the same local AP and same non-empty outlet token. **Never commit the private files.**

The local AP defaults to `192.168.4.1` and SSID label `AquaGuard-ESP32`; choose a private AP password of at least eight characters. The API endpoint must end in `/api/esp32/readings`. For local `pnpm dev`, use the development PC's LAN IPv4 address and plain HTTP on a trusted private network, e.g. `http://192.168.1.50:3000/api/esp32/readings` (replace the example IP with the PC's real address). `localhost` from the ESP32 means the ESP32 itself, not the PC. For Vercel HTTPS, install a valid CA PEM in the private ESP32 header; the code deliberately rejects HTTPS when no trust certificate is configured and never disables certificate verification.

## Local outlet protocol

A sample body is:

```json
{"device_id":"XXSR69-OUTLET","outlet_flow_lpm":4.25,"total_volume_l":18.642,"sequence":42,"sample_ms":1000}
```

The ESP32 accepts only authenticated finite flow values in `[0, 30]` L/min, nonnegative volume, monotonic sequence numbers, and a sample interval of 250–5000 ms. A reconnect can begin a new sequence epoch only after the prior stream has timed out. Rejected spikes are not sent as good samples; a missing or stale outlet sample is not turned into a valid zero. The ESP32 closes the valve command and latches a safety fault after the five-second outlet timeout. Cloud requests are bounded to about two seconds and one HTTP operation runs per loop pass, but local sample/safety evaluation can be delayed by up to that request bound.

## Cloud API contract

```text
POST <base-url>/api/esp32/readings
Authorization: Bearer <ESP32_API_KEY>
Content-Type: application/json
```

Required fields: `device_id`, finite `inlet_flow_lpm` and `outlet_flow_lpm` from 0–30, boolean `valve_open`, and an ISO-8601 UTC `timestamp`. Optional `water_level_cm` is the valid ultrasonic distance from sensor to water surface (0–450 cm), not a percentage or tank volume. Optional `sensor_health` and internet-outage duration are reported when available. Pressure remains null/unused. The API stores only actual validated hardware readings; dashboard simulation stays in browser memory.

The ESP32 checks `/api/health` every 10 seconds. The health endpoint returns success only when its configured Supabase persistence endpoint responds. If unreachable for 120 seconds after the first failed probe, the ESP32 queues a local outage SMS and LCD notice; outage notification may lag a real outage by roughly one probe interval plus request timeout. On recovery it queues a restored notice and reports the measured outage duration on the next accepted sample. These checks may also identify a cloud/database failure even if the Wi-Fi router remains available.

## Local offline dashboard and controls

Join the ESP32 AP with a browser and open `http://192.168.4.1/`. The page reports current inlet/outlet balance, tank distance if valid, commanded valve state, buzzer, cloud link, most recent alert, latest SMS result/text, and the last physical LCD lines. It does not need a PC server or Internet. It supports the nine locales for on-device messages and saves the selected language in ESP32 preferences. If cloud notification polling is available, the persisted dashboard preference can synchronize to the controller.

The page's “Acknowledge and reopen valve” action is guarded: it requires an active safety lock, a valid inlet measurement, a fresh outlet link, and five stable balanced samples; it also asks for explicit operator confirmation. The shared AP password is the only access boundary for this page and reset control; anyone who joins the AP can request the guarded reset. Inspect and repair the cause before resetting. There is no physical valve-position sensor.

## Installation and calibration

1. Apply Supabase migrations `001` through `006` in order; verify controller `XXSR69` exists in the intended zone.
2. Install Arduino ESP32 core **3.3.10**, `LiquidCrystal_I2C`, select the exact board, and create the private headers. Install the ESP8266 board package for the outlet sketch.
3. With water isolated, compile/flash the relay verification sketch first. Confirm active-low relay input and that de-energizing the relay opens the NO valve while energizing it closes the valve via relay NO contact.
4. Flash the main ESP32 sketch; join its AP and verify the local dashboard, relay command, LCD, buzzer, Wi-Fi, and local reset guard.
5. Flash the ESP8266 outlet node; verify fresh authenticated posts and sequence increments in the main ESP32 serial monitor.
6. Calibrate each flow meter independently with a measured volume. Change each `FLOW_PULSES_PER_LITRE_*` value for the installed sensors. Do not assume the 450 pulses/L starting value is accurate.
7. Confirm the 30 L/min maximum, 2 L/min imbalance threshold, and 10-second persistence match `.env`, SQL constraint and both sketches. Test rejection of implausible spikes.
8. Run the standalone GSM test (`gsm_verification.ino`) by typing `s` only after SIM, antenna, 2G service, modem power and phone number are verified. Confirm one received SMS before connecting normal automation.
9. Test water-shutoff behavior only under appropriate supervision, beginning without water pressure, then with a controlled low-pressure flow. Verify the valve physically; firmware cannot.

No physical hardware/water-line test or cloud-provider deployment has been performed in this project workspace.
