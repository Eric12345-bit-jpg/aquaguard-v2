#include <HardwareSerial.h>
#include "aquaguard_secrets.h"

// Standalone SIM800L diagnostic. No relay/valve pins are configured.
// Copy the private aquaguard_secrets.h into this sketch folder before compiling.
HardwareSerial gsm(2);
constexpr uint8_t GSM_RX_PIN = 32; // ESP32 RX2 <- SIM800L TX
constexpr uint8_t GSM_TX_PIN = 33; // ESP32 TX2 -> SIM800L RX (use a level shifter)

String command(const char* text, uint32_t timeoutMs = 2500) {
  while (gsm.available()) gsm.read();
  gsm.println(text);
  String response;
  const uint32_t started = millis();
  while (millis() - started < timeoutMs) {
    while (gsm.available()) response += static_cast<char>(gsm.read());
    if (response.indexOf("OK") >= 0 || response.indexOf("ERROR") >= 0) break;
    delay(5);
  }
  Serial.printf("GSM> %s\n%s\n", text, response.c_str());
  return response;
}

bool registered() {
  for (uint8_t attempt = 0; attempt < 30; ++attempt) {
    const String response = command("AT+CREG?", 1200);
    if (response.indexOf("+CREG: 0,1") >= 0 || response.indexOf("+CREG: 0,5") >= 0) return true;
    delay(1000);
  }
  return false;
}

bool sendTestSms() {
  const String pin = command("AT", 1500);
  if (pin.indexOf("OK") < 0) { Serial.println("FAIL: GSM NO REPLY; check power, common GND, RX/TX and baud."); return false; }
  const String sim = command("AT+CPIN?", 2000);
  if (sim.indexOf("READY") < 0) { Serial.println("FAIL: SIM NOT READY; check SIM seating/PIN."); return false; }
  command("AT+CSQ");
  if (!registered()) { Serial.println("FAIL: NO NETWORK; check antenna, 2G service and signal."); return false; }
  command("AT+CMGF=1");
  command("AT+CSCS=\"IRA\"");
  while (gsm.available()) gsm.read();
  gsm.print("AT+CMGS=\""); gsm.print(AQ_ALERT_PHONE_NUMBER); gsm.println("\"");
  String prompt;
  const uint32_t started = millis();
  while (millis() - started < 5000) {
    while (gsm.available()) prompt += static_cast<char>(gsm.read());
    if (prompt.indexOf('>') >= 0 || prompt.indexOf("ERROR") >= 0) break;
    delay(5);
  }
  if (prompt.indexOf('>') < 0) { Serial.printf("FAIL: SMS prompt not received: %s\n", prompt.c_str()); return false; }
  gsm.print("AquaGuard GSM test OK"); gsm.write(26);
  String result;
  const uint32_t sentAt = millis();
  while (millis() - sentAt < 30000) {
    while (gsm.available()) result += static_cast<char>(gsm.read());
    if (result.indexOf("+CMGS:") >= 0 || result.indexOf("ERROR") >= 0) break;
    delay(10);
  }
  if (result.indexOf("+CMGS:") >= 0) { Serial.println("SUCCESS: network accepted one GSM test SMS."); return true; }
  Serial.printf("FAIL: SMS was not accepted: %s\n", result.c_str());
  return false;
}

void setup() {
  Serial.begin(115200);
  gsm.begin(9600, SERIAL_8N1, GSM_RX_PIN, GSM_TX_PIN);
  delay(3000);
  Serial.println("AquaGuard GSM verification ready. Type s then Enter to send exactly one test SMS.");
  Serial.println("The SIM800L needs a suitable supply, shared GND, antenna, an active SIM and 2G service.");
}

void loop() {
  if (Serial.available() && Serial.read() == 's') sendTestSms();
}
