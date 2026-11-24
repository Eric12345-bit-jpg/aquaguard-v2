#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <math.h>
#include "aquaguard_secrets.h"

// Outlet flow node. It connects only to the ESP32's private AP; internet is not required.
const char* ESP32_LOCAL_URL = "http://192.168.4.1/outlet-reading";
const char* OUTLET_DEVICE_ID = "XXSR69-OUTLET";
const uint8_t OUTLET_FLOW_PIN = D5; // GPIO14
const uint32_t DEBUG_BAUD = 115200;
const unsigned long SEND_INTERVAL_MS = 1000UL;
const unsigned long WIFI_RECONNECT_INTERVAL_MS = 5000UL;
const uint32_t MIN_PULSE_GAP_US = 1500UL;
const float FLOW_PULSES_PER_LITRE_OUTLET = 450.0f; // calibrate independently from inlet
const float MAX_FLOW_LPM = 30.0f;                 // keep aligned with ESP32/server

volatile uint32_t outletPulses = 0;
volatile uint32_t lastPulseUs = 0;
unsigned long lastSendAt = 0;
unsigned long lastWifiAttemptAt = 0;
uint32_t sequenceNumber = 0;
float totalVolumeLitres = 0.0f;

void IRAM_ATTR onOutletPulse() {
  const uint32_t nowUs = micros();
  if (nowUs - lastPulseUs < MIN_PULSE_GAP_US) return;
  lastPulseUs = nowUs;
  outletPulses++;
}
float measureOutletFlowLpm(unsigned long elapsedMs, float& litresThisSample) {
  noInterrupts(); const uint32_t pulses = outletPulses; outletPulses = 0; interrupts();
  litresThisSample = static_cast<float>(pulses) / FLOW_PULSES_PER_LITRE_OUTLET;
  if (!elapsedMs) return 0.0f;
  const float flow = litresThisSample * 60000.0f / static_cast<float>(elapsedMs);
  if (!isfinite(flow) || flow > MAX_FLOW_LPM) return NAN;
  return flow;
}
void keepWifiConnected() {
  if (WiFi.status() == WL_CONNECTED) return;
  const unsigned long now = millis();
  if (now - lastWifiAttemptAt < WIFI_RECONNECT_INTERVAL_MS) return;
  lastWifiAttemptAt = now; WiFi.disconnect(); WiFi.begin(AQ_LOCAL_AP_SSID, AQ_LOCAL_AP_PASSWORD);
}
void sendOutletReading(float flow, unsigned long sampleMs) {
  if (WiFi.status() != WL_CONNECTED || !isfinite(flow) || flow < 0 || !isfinite(totalVolumeLitres)) return;
  WiFiClient client; HTTPClient http;
  if (!http.begin(client, ESP32_LOCAL_URL)) return;
  http.setTimeout(2000); http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Outlet-Token", AQ_OUTLET_SHARED_TOKEN);
  sequenceNumber++;
  String payload = "{\"device_id\":\"" + String(OUTLET_DEVICE_ID) + "\",\"outlet_flow_lpm\":" + String(flow, 2) +
    ",\"total_volume_l\":" + String(totalVolumeLitres, 3) + ",\"sequence\":" + String(sequenceNumber) + ",\"sample_ms\":" + String(sampleMs) + "}";
  const int status = http.POST(payload);
  Serial.printf("ESP32 outlet receiver status: %d, sequence: %lu\n", status, static_cast<unsigned long>(sequenceNumber));
  http.end();
}
void setup() {
  Serial.begin(DEBUG_BAUD); pinMode(OUTLET_FLOW_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(OUTLET_FLOW_PIN), onOutletPulse, RISING);
  WiFi.mode(WIFI_STA); WiFi.setSleepMode(WIFI_NONE_SLEEP); WiFi.persistent(false); WiFi.setAutoReconnect(true);
  WiFi.begin(AQ_LOCAL_AP_SSID, AQ_LOCAL_AP_PASSWORD); lastSendAt = millis();
  Serial.println("AquaGuard ESP8266 outlet node ready; flow limit 30 L/min.");
}
void loop() {
  keepWifiConnected();
  const unsigned long now = millis();
  const unsigned long elapsed = now - lastSendAt;
  if (elapsed < SEND_INTERVAL_MS) { delay(5); return; }
  lastSendAt = now;
  float litres = 0.0f;
  const float flow = measureOutletFlowLpm(elapsed, litres);
  if (!isfinite(flow)) Serial.println("Outlet flow rejected as implausible; sample volume discarded and ESP32 will close on missing data.");
  else { totalVolumeLitres += litres; sendOutletReading(flow, elapsed); }
}
