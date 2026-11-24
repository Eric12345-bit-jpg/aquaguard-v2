#include <WiFi.h>
#include <WebServer.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Preferences.h>
#include <time.h>
#include <sys/time.h>
#include <math.h>
#include <stdlib.h>
#include "aquaguard_secrets.h"

// AquaGuard two-MCU controller. Local sensing, shutoff, buzzer, LCD and SMS
// do not depend on the cloud. Cloud/AI is advisory; only this MCU commands the valve.
const char* DEVICE_ID = "XXSR69";
const char* ZONE_NAME = "acej_karama path";
const char* OUTLET_DEVICE_ID = "XXSR69-OUTLET";
const IPAddress LOCAL_AP_IP(192, 168, 4, 1);

HardwareSerial gsmSerial(2);
const uint8_t GSM_RX_PIN = 32;
const uint8_t GSM_TX_PIN = 33;
const uint8_t INLET_FLOW_PIN = 25;
const uint8_t SOLENOID_RELAY_PIN = 23;
const uint8_t BUZZER_PIN = 14;
const uint8_t ULTRASONIC_TRIGGER_PIN = 26;
const uint8_t ULTRASONIC_ECHO_PIN = 27;
const uint8_t I2C_SDA_PIN = 21;
const uint8_t I2C_SCL_PIN = 22;
const uint8_t LCD_I2C_ADDRESS = 0x27;
const float ULTRASONIC_MIN_CM = 2.0f;
const float ULTRASONIC_MAX_CM = 450.0f;
const unsigned long INLET_SAMPLE_INTERVAL_MS = 1000UL;
const unsigned long WATER_LEVEL_SAMPLE_INTERVAL_MS = 2000UL;
const unsigned long CLOUD_SEND_INTERVAL_MS = 5000UL;
const unsigned long CLOUD_HEALTH_INTERVAL_MS = 10000UL;
const unsigned long OUTLET_TIMEOUT_MS = 5000UL;
const unsigned long LEAK_CONFIRMATION_MS = 10000UL;
const unsigned long WIFI_RECONNECT_INTERVAL_MS = 5000UL;
const unsigned long LCD_REFRESH_INTERVAL_MS = 1000UL;
const unsigned long SMS_STATUS_INTERVAL_MS = 60000UL;
const unsigned long INTERNET_NOTICE_AFTER_MS = 120000UL;
const unsigned long SMS_RETRY_INTERVAL_MS = 60000UL;
const uint32_t MIN_PULSE_GAP_US = 1500UL;
const float FLOW_PULSES_PER_LITRE_INLET = 450.0f;   // calibrate independently
const float MAX_FLOW_LPM = 30.0f;                   // align with server .env/migration
const float FLOW_DIFFERENCE_THRESHOLD_LPM = 2.0f;
const uint8_t SAFE_RESET_SAMPLES = 5;
const bool RELAY_ACTIVE_LOW = true;
const bool SOLENOID_NORMALLY_OPEN = true;            // unpowered valve passes water
const bool RELAY_LOAD_USES_NO_CONTACT = true;        // relay NO terminal feeds solenoid

WebServer localServer(80);
LiquidCrystal_I2C lcd(LCD_I2C_ADDRESS, 16, 2);
Preferences preferences;
const char* OUTLET_ROUTE = "/outlet-reading";
const char* OUTLET_HEADER_NAME = "X-Outlet-Token";
const char* OUTLET_HEADER_KEYS[] = { OUTLET_HEADER_NAME };

volatile uint32_t inletPulses = 0;
volatile uint32_t lastInletPulseUs = 0;
unsigned long lastInletSampleAt = 0;
unsigned long lastWaterLevelSampleAt = 0;
unsigned long lastCloudSendAt = 0;
unsigned long lastCloudHealthAt = 0;
unsigned long lastNetworkOperationAt = 0;
unsigned long lastLcdRefreshAt = 0;
unsigned long lastWifiReconnectAt = 0;
unsigned long lastOutletAt = 0;
unsigned long abnormalFlowStartedAt = 0;
unsigned long lastStatusSmsAt = 0;
unsigned long lastSmsAttemptAt = 0;
unsigned long lcdOverrideUntil = 0;
unsigned long lastLcdPageAt = 0;
unsigned long cloudUnavailableSince = 0;
uint32_t pendingOutageSeconds = 0;
uint32_t latestOutletSequence = 0;
float latestOutletFlowLpm = NAN;
float latestOutletVolumeLitres = NAN;
float latestInletFlowLpm = 0.0f;
float latestWaterHeightCm = NAN;
bool outletTelemetryValid = false;
bool inletMeasurementValid = true;
bool valveOpen = true;             // commanded state only; there is no valve-position feedback
bool emergencyLock = false;
bool lcdTankPage = false;
bool cloudReachable = false;
bool outageAlertSent = false;
bool gsmBusy = false;
const uint8_t SMS_QUEUE_CAPACITY = 32;
String smsQueue[SMS_QUEUE_CAPACITY];
uint8_t smsQueueHead = 0, smsQueueTail = 0, smsQueueCount = 0;
bool smsPersistenceReady = false;
const uint8_t LCD_NOTICE_CAPACITY = 24;
String lcdNoticeTitles[LCD_NOTICE_CAPACITY], lcdNoticeDetails[LCD_NOTICE_CAPACITY];
uint8_t lcdNoticeHead = 0, lcdNoticeTail = 0, lcdNoticeCount = 0;
unsigned long lastNotificationPollAt = 0;
String recentCloudAlertIds;
String lastCloudInsightSignature;
String lastDecision = "STARTING";
String alertLanguage = "en";
String currentLcdLine0 = "AquaGuard";
String currentLcdLine1 = "Starting...";
String lastSmsStatus = "Not sent yet";
String lastSmsMessage = "";
String lastLocalAlert = "None";
uint32_t cloudAlertCursor = 0;
String cloudAlertDisplayTitle;
String cloudAlertDisplayDetail;

void serviceBackground();
void writeLcdLine(uint8_t row, const String& value);

void IRAM_ATTR onInletPulse() {
  const uint32_t nowUs = micros();
  if (nowUs - lastInletPulseUs < MIN_PULSE_GAP_US) return;
  lastInletPulseUs = nowUs;
  inletPulses = static_cast<uint32_t>(inletPulses + 1U);
}

String languageCode() { return alertLanguage; }
String messagePrefix(const String& code) {
  if (code == "leak") {
    if (alertLanguage == "rw") return "Amazi arasohoka";
    if (alertLanguage == "fr") return "Fuite detectee";
    if (alertLanguage == "sw") return "Uvujaji wa maji";
    if (alertLanguage == "zh") return "AquaGuard 漏水";
    if (alertLanguage == "nl") return "Waterlek alarm";
    if (alertLanguage == "it") return "Perdita acqua";
    if (alertLanguage == "es") return "Fuga de agua";
    if (alertLanguage == "hi") return "जल रिसाव";
    return "AquaGuard leak";
  }
  if (code == "outlet") {
    if (alertLanguage == "rw") return "Outlet ntiyitabye";
    if (alertLanguage == "fr") return "Sortie hors ligne";
    if (alertLanguage == "sw") return "Outlet haipo";
    if (alertLanguage == "zh") return "出口传感器离线";
    if (alertLanguage == "nl") return "Uitlaat offline";
    if (alertLanguage == "it") return "Uscita offline";
    if (alertLanguage == "es") return "Salida sin conexion";
    if (alertLanguage == "hi") return "आउटलेट ऑफ़लाइन";
    return "Outlet node offline";
  }
  if (code == "sensor") {
    if (alertLanguage == "rw") return "Sensor ifite ikibazo";
    if (alertLanguage == "fr") return "Defaut capteur";
    if (alertLanguage == "sw") return "Hitilafu ya sensor";
    if (alertLanguage == "zh") return "传感器故障";
    if (alertLanguage == "nl") return "Sensorfout";
    if (alertLanguage == "it") return "Guasto sensore";
    if (alertLanguage == "es") return "Fallo de sensor";
    if (alertLanguage == "hi") return "सेंसर दोष";
    return "Sensor fault";
  }
  if (code == "reset") {
    if (alertLanguage == "rw") return "Valve yongeye gufunguka";
    if (alertLanguage == "fr") return "Vanne reouverte";
    if (alertLanguage == "sw") return "Valvu imefunguliwa tena";
    if (alertLanguage == "zh") return "阀门已重新打开";
    if (alertLanguage == "nl") return "Klep weer geopend";
    if (alertLanguage == "it") return "Valvola riaperta";
    if (alertLanguage == "es") return "Valvula reabierta";
    if (alertLanguage == "hi") return "Valve phir khula";
    return "Valve reopened";
  }
  if (code == "internet") {
    if (alertLanguage == "rw") return "Internet yabuze";
    if (alertLanguage == "fr") return "Internet perdu";
    if (alertLanguage == "sw") return "Intaneti imekatika";
    if (alertLanguage == "zh") return "互联网中断";
    if (alertLanguage == "nl") return "Internet weg";
    if (alertLanguage == "it") return "Internet assente";
    if (alertLanguage == "es") return "Internet perdido";
    if (alertLanguage == "hi") return "इंटरनेट बंद";
    return "Internet unavailable";
  }
  if (code == "restored") {
    if (alertLanguage == "rw") return "Internet yagarutse";
    if (alertLanguage == "fr") return "Internet retabli";
    if (alertLanguage == "sw") return "Intaneti imerejea";
    if (alertLanguage == "zh") return "互联网已恢复";
    if (alertLanguage == "nl") return "Internet hersteld";
    if (alertLanguage == "it") return "Internet ripristinata";
    if (alertLanguage == "es") return "Internet restaurado";
    if (alertLanguage == "hi") return "इंटरनेट बहाल";
    return "Internet restored";
  }
  if (alertLanguage == "rw") return "Imiterere";
  if (alertLanguage == "fr") return "Etat AquaGuard";
  if (alertLanguage == "sw") return "Hali ya AquaGuard";
  if (alertLanguage == "zh") return "系统状态";
  if (alertLanguage == "nl") return "AquaGuard status";
  if (alertLanguage == "it") return "Stato AquaGuard";
  if (alertLanguage == "es") return "Estado AquaGuard";
  if (alertLanguage == "hi") return "सिस्टम स्थिति";
  return "AquaGuard status";
}

String lcdAlarmText(const String& code) {
  if (code == "leak" || code == "leak_pattern" || code == "loss_always_high" || code == "possible_leak") {
    if (alertLanguage == "rw") return "Amazi arasohoka";
    if (alertLanguage == "fr") return "Fuite detectee";
    if (alertLanguage == "sw") return "Uvujaji wa maji";
    if (alertLanguage == "zh") return "Lou shui alarm";
    if (alertLanguage == "nl") return "Waterlek alarm";
    if (alertLanguage == "it") return "Perdita acqua";
    if (alertLanguage == "es") return "Fuga de agua";
    if (alertLanguage == "hi") return "Jal risav alert";
    return "Leak detected";
  }
  if (code == "outlet" || code == "outlet_node_offline" || code == "device_offline") {
    if (alertLanguage == "rw") return "Outlet ntihari";
    if (alertLanguage == "fr") return "Sortie hors ligne";
    if (alertLanguage == "sw") return "Outlet haipo";
    if (alertLanguage == "zh") return "Chu kou offline";
    if (alertLanguage == "nl") return "Uitlaat offline";
    if (alertLanguage == "it") return "Uscita offline";
    if (alertLanguage == "es") return "Salida sin conexion";
    if (alertLanguage == "hi") return "Outlet offline";
    return "Outlet link lost";
  }
  if (code == "sensor" || code == "sensor_stuck" || code == "implausible_flow" || code == "valve_closed_flow" || code == "negative_loss" || code == "level_missing") {
    if (alertLanguage == "rw") return "Sensor ifite ikibazo";
    if (alertLanguage == "fr") return "Defaut capteur";
    if (alertLanguage == "sw") return "Hitilafu sensor";
    if (alertLanguage == "zh") return "Chuan gan qi gu zhang";
    if (alertLanguage == "nl") return "Sensorstoring";
    if (alertLanguage == "it") return "Guasto sensore";
    if (alertLanguage == "es") return "Fallo de sensor";
    if (alertLanguage == "hi") return "Sensor dosh";
    return "Flow sensor fault";
  }
  if (code == "internet" || code == "internet_outage") {
    if (alertLanguage == "rw") return "Internet yabuze";
    if (alertLanguage == "fr") return "Internet perdu";
    if (alertLanguage == "sw") return "Intaneti imekatika";
    if (alertLanguage == "zh") return "Hu lian wang duan";
    if (alertLanguage == "nl") return "Internet weg";
    if (alertLanguage == "it") return "Internet assente";
    if (alertLanguage == "es") return "Internet perdido";
    if (alertLanguage == "hi") return "Internet band";
    return "Internet unavailable";
  }
  if (code == "tank_dropping") {
    if (alertLanguage == "rw") return "Amazi yo muri tank";
    if (alertLanguage == "fr") return "Niveau baisse";
    if (alertLanguage == "sw") return "Tank maji yanashuka";
    if (alertLanguage == "zh") return "Shui wei xia jiang";
    if (alertLanguage == "nl") return "Tankniveau daalt";
    if (alertLanguage == "it") return "Livello serbatoio";
    if (alertLanguage == "es") return "Baja nivel tanque";
    if (alertLanguage == "hi") return "Tank jal kam";
    return "Tank level falling";
  }
  if (code == "reset" || code == "device_restored" || code == "internet_restored") {
    if (alertLanguage == "rw") return "Valve yongeye gufunguka";
    if (alertLanguage == "fr") return "Systeme restaure";
    if (alertLanguage == "sw") return "Mfumo umerudi";
    if (alertLanguage == "zh") return "Xi tong hui fu";
    if (alertLanguage == "nl") return "Systeem hersteld";
    if (alertLanguage == "it") return "Sistema ripristinato";
    if (alertLanguage == "es") return "Sistema restaurado";
    if (alertLanguage == "hi") return "System bahal";
    return "System restored";
  }
  return "AquaGuard alert";
}

// SIM800L text-mode UCS2: UTF-8 input becomes UTF-16BE hex. This enables Chinese/Hindi SMS.
String utf8ToUcs2Hex(const String& text) {
  String hex;
  hex.reserve(text.length() * 4);
  for (size_t i = 0; i < text.length();) {
    const uint8_t c = static_cast<uint8_t>(text[i++]);
    uint32_t cp = c;
    if ((c & 0xE0) == 0xC0 && i < text.length()) {
      const uint8_t b1 = static_cast<uint8_t>(text[i]);
      if ((b1 & 0xC0) == 0x80) { cp = ((c & 0x1F) << 6) | (b1 & 0x3F); i += 1; }
    } else if ((c & 0xF0) == 0xE0 && i + 1 < text.length()) {
      const uint8_t b1 = static_cast<uint8_t>(text[i]);
      const uint8_t b2 = static_cast<uint8_t>(text[i + 1]);
      if ((b1 & 0xC0) == 0x80 && (b2 & 0xC0) == 0x80) {
        cp = ((c & 0x0F) << 12) | ((b1 & 0x3F) << 6) | (b2 & 0x3F); i += 2;
      }
    } else if ((c & 0xF8) == 0xF0 && i + 2 < text.length()) {
      const uint8_t b1 = static_cast<uint8_t>(text[i]);
      const uint8_t b2 = static_cast<uint8_t>(text[i + 1]);
      const uint8_t b3 = static_cast<uint8_t>(text[i + 2]);
      if ((b1 & 0xC0) == 0x80 && (b2 & 0xC0) == 0x80 && (b3 & 0xC0) == 0x80) {
        cp = ((c & 0x07) << 18) | ((b1 & 0x3F) << 12) | ((b2 & 0x3F) << 6) | (b3 & 0x3F); i += 3;
      }
    }
    if (cp <= 0xFFFF) {
      char unit[5]; snprintf(unit, sizeof(unit), "%04X", static_cast<unsigned>(cp)); hex += unit;
    } else {
      cp -= 0x10000;
      const uint16_t hi = 0xD800 | (cp >> 10), lo = 0xDC00 | (cp & 0x3FF);
      char pair[9]; snprintf(pair, sizeof(pair), "%04X%04X", hi, lo); hex += pair;
    }
  }
  return hex;
}

String ucs2PhoneNumber() {
  String digits = String(AQ_ALERT_PHONE_NUMBER);
  String encoded;
  for (size_t i = 0; i < digits.length(); ++i) {
    char unit[5]; snprintf(unit, sizeof(unit), "%04X", static_cast<unsigned char>(digits[i])); encoded += unit;
  }
  return encoded;
}


String limitSmsUnits(const String& input, uint16_t maxUnits = 67) {
  uint16_t units = 0; size_t index = 0;
  while (index < input.length()) {
    const uint8_t first = static_cast<uint8_t>(input[index]);
    const size_t bytes = (first < 0x80) ? 1 : (first < 0xE0) ? 2 : (first < 0xF0) ? 3 : 4;
    const uint16_t cost = bytes == 4 ? 2 : 1;
    if (units + cost > maxUnits || index + bytes > input.length()) break;
    units += cost; index += bytes;
  }
  String result = input.substring(0, index);
  if (index < input.length()) result += "…";
  return result;
}
void persistSmsQueue() {
  if (!smsPersistenceReady) return;
  String serialized;
  for (uint8_t i = 0; i < smsQueueCount; ++i) {
    if (i) serialized += '\n';
    serialized += smsQueue[(smsQueueHead + i) % SMS_QUEUE_CAPACITY];
  }
  if (serialized.length()) preferences.putString("smsq", serialized);
  else preferences.remove("smsq");
}
void restoreSmsQueue() {
  smsQueueHead = 0; smsQueueTail = 0; smsQueueCount = 0;
  const String serialized = preferences.getString("smsq", "");
  size_t start = 0;
  while (start < serialized.length() && smsQueueCount < SMS_QUEUE_CAPACITY) {
    int end = serialized.indexOf('\n', start);
    if (end < 0) end = serialized.length();
    const String message = serialized.substring(start, end);
    if (message.length()) {
      smsQueue[smsQueueTail] = message;
      smsQueueTail = (smsQueueTail + 1) % SMS_QUEUE_CAPACITY;
      smsQueueCount++;
    }
    start = static_cast<size_t>(end) + 1;
  }
  const String inFlight = preferences.getString("smsFlight", "");
  if (inFlight.length()) {
    bool alreadyQueued = false;
    for (uint8_t i = 0; i < smsQueueCount; ++i) {
      if (smsQueue[(smsQueueHead + i) % SMS_QUEUE_CAPACITY] == inFlight) alreadyQueued = true;
    }
    if (!alreadyQueued) {
      if (smsQueueCount >= SMS_QUEUE_CAPACITY) { smsQueueHead = (smsQueueHead + 1) % SMS_QUEUE_CAPACITY; smsQueueCount--; }
      smsQueueHead = (smsQueueHead + SMS_QUEUE_CAPACITY - 1) % SMS_QUEUE_CAPACITY;
      smsQueue[smsQueueHead] = inFlight; smsQueueCount++;
    }
    preferences.remove("smsFlight");
    smsQueueTail = (smsQueueHead + smsQueueCount) % SMS_QUEUE_CAPACITY;
    persistSmsQueue();
  }
}
bool enqueueSms(const String& message, bool priority = false) {
  if (smsQueueCount >= SMS_QUEUE_CAPACITY) {
    if (!priority) return false;
    smsQueueHead = (smsQueueHead + 1) % SMS_QUEUE_CAPACITY;
    smsQueueCount--;
  }
  if (priority) {
    smsQueueHead = (smsQueueHead + SMS_QUEUE_CAPACITY - 1) % SMS_QUEUE_CAPACITY;
    smsQueue[smsQueueHead] = limitSmsUnits(message);
  } else {
    smsQueue[smsQueueTail] = limitSmsUnits(message);
    smsQueueTail = (smsQueueTail + 1) % SMS_QUEUE_CAPACITY;
  }
  smsQueueCount++;
  persistSmsQueue();
  return true;
}

String compactSms(const String& code, float loss = 0.0f) {
  String text = messagePrefix(code) + " " + String(DEVICE_ID);
  if (code == "leak") text += " L:" + String(loss, 1) + " V:C";
  else if (code == "outlet" || code == "sensor") text += " V:C";
  else if (code == "internet") text += " local=ON";
  else if (code == "restored") text += " sec:" + String(pendingOutageSeconds);
  else if (code == "reset") text += " V:OPEN";
  return text;
}

bool gsmCommand(const char* command, const char* expected, unsigned long timeoutMs, String* response = nullptr) {
  while (gsmSerial.available()) gsmSerial.read();
  gsmSerial.println(command);
  String result;
  const unsigned long started = millis();
  while (millis() - started < timeoutMs) {
    while (gsmSerial.available()) result += static_cast<char>(gsmSerial.read());
    if (result.indexOf(expected) >= 0 || result.indexOf("ERROR") >= 0) break;
    serviceBackground();
    delay(5);
  }
  if (response) *response = result;
  return result.indexOf(expected) >= 0;
}

bool gsmNetworkReady(unsigned long timeoutMs) {
  const unsigned long started = millis();
  while (millis() - started < timeoutMs) {
    String result;
    gsmCommand("AT+CREG?", "OK", 1000, &result);
    if (result.indexOf("+CREG: 0,1") >= 0 || result.indexOf("+CREG: 0,5") >= 0) return true;
    serviceBackground(); delay(100);
  }
  return false;
}

bool sendSmsNotification(const String& message) {
  lastSmsMessage = limitSmsUnits(message);
  lastSmsStatus = "Sending";
  gsmBusy = true;
  lcdOverrideUntil = millis() + 5000UL;
  writeLcdLine(0, "Sending SMS...");
  writeLcdLine(1, messagePrefix("status").substring(0, 16));
  bool alive = false;
  for (uint8_t i = 0; i < 5 && !alive; ++i) alive = gsmCommand("AT", "OK", 1000);
  bool sent = false;
  if (alive && gsmCommand("AT+CPIN?", "READY", 2500) && gsmNetworkReady(10000UL)) {
    gsmCommand("AT+CMGF=1", "OK", 1000);
    gsmCommand("AT+CSCS=\"UCS2\"", "OK", 1000);
    gsmCommand("AT+CSMP=17,167,0,8", "OK", 1000);
    while (gsmSerial.available()) gsmSerial.read();
    gsmSerial.print("AT+CMGS=\""); gsmSerial.print(ucs2PhoneNumber()); gsmSerial.println("\"");
    String prompt;
    const unsigned long promptAt = millis();
    while (millis() - promptAt < 5000UL) {
      while (gsmSerial.available()) prompt += static_cast<char>(gsmSerial.read());
      if (prompt.indexOf('>') >= 0 || prompt.indexOf("ERROR") >= 0) break;
      serviceBackground(); delay(5);
    }
    if (prompt.indexOf('>') >= 0) {
      gsmSerial.print(utf8ToUcs2Hex(limitSmsUnits(message)));
      gsmSerial.write(26);
      String result;
      const unsigned long sentAt = millis();
      while (millis() - sentAt < 30000UL) {
        while (gsmSerial.available()) result += static_cast<char>(gsmSerial.read());
        if (result.indexOf("+CMGS:") >= 0 || result.indexOf("ERROR") >= 0) break;
        serviceBackground(); delay(5);
      }
      sent = result.indexOf("+CMGS:") >= 0;
    } else {
      gsmSerial.write(27);
    }
  }
  gsmCommand("AT+CSCS=\"IRA\"", "OK", 1000);
  gsmBusy = false;
  if (sent) {
    lastSmsStatus = "Accepted by GSM network";
    Serial.println("GSM SMS accepted by modem.");
    writeLcdLine(0, "SMS SENT"); writeLcdLine(1, "GSM accepted");
    lcdOverrideUntil = millis() + 2500UL;
  } else {
    lastSmsStatus = "Failed; queued alert will retry";
    Serial.println("GSM SMS send failed; it will be retried if it is an alert.");
    writeLcdLine(0, "SMS FAILED"); writeLcdLine(1, "Check SIM/network");
    lcdOverrideUntil = millis() + 3000UL;
  }
  return sent;
}

void queueAlert(const String& code, float loss = 0.0f) {
  lastLocalAlert = compactSms(code, loss);
  enqueueSms(lastLocalAlert, true);
}
void setRelayEnergized(bool energized) {
  const bool high = RELAY_ACTIVE_LOW ? !energized : energized;
  digitalWrite(SOLENOID_RELAY_PIN, high ? HIGH : LOW);
}
void setValveOpen(bool open) {
  // NO solenoid is open with its coil unpowered. The relay's NO contact supplies
  // the coil only while relay is energized, so relay ON means valve CLOSED.
  const bool solenoidEnergized = SOLENOID_NORMALLY_OPEN ? !open : open;
  const bool relayEnergized = RELAY_LOAD_USES_NO_CONTACT ? solenoidEnergized : !solenoidEnergized;
  setRelayEnergized(relayEnergized);
  valveOpen = open;
}
void writeLcdLine(uint8_t row, const String& value) {
  const String clipped = value.substring(0, 16);
  if (row == 0) currentLcdLine0 = clipped; else currentLcdLine1 = clipped;
  lcd.setCursor(0, row); lcd.print("                "); lcd.setCursor(0, row); lcd.print(clipped);
}
String jsonEscape(const String& value) {
  String out; out.reserve(value.length() + 8);
  for (size_t i = 0; i < value.length(); ++i) {
    const char c = value[i];
    if (c == '\\' || c == '"') { out += '\\'; out += c; }
    else if (c == '\n') out += "\\n";
    else if (c == '\r') out += "\\r";
    else if (static_cast<uint8_t>(c) >= 0x20) out += c;
  }
  return out;
}
String numberOrNa(float value, uint8_t digits = 1) { return isfinite(value) ? String(value, static_cast<unsigned int>(digits)) : String("NA"); }
void showLcdMessage(const String& line0, const String& line1, unsigned long durationMs) {
  writeLcdLine(0, line0); writeLcdLine(1, line1); lcdOverrideUntil = millis() + durationMs;
}

void closeWater(const String& alarmCode) {
  const bool newlyClosed = valveOpen || !emergencyLock;
  setValveOpen(false);
  emergencyLock = true;
  abnormalFlowStartedAt = 0;
  lastDecision = alarmCode;
  digitalWrite(BUZZER_PIN, HIGH);
  if (newlyClosed) {
    const float loss = isfinite(latestInletFlowLpm) && isfinite(latestOutletFlowLpm) ? max(0.0f, latestInletFlowLpm - latestOutletFlowLpm) : 0.0f;
    queueAlert(alarmCode == "LEAK DETECTED" ? "leak" : alarmCode == "OUTLET LINK LOST" ? "outlet" : "sensor", loss);
    showLcdMessage(lcdAlarmText(alarmCode == "LEAK DETECTED" ? "leak" : alarmCode == "OUTLET LINK LOST" ? "outlet" : "sensor"), "Valve commanded C", 5000UL);
  }
}

float sampleInletFlow(unsigned long elapsedMs) {
  noInterrupts(); const uint32_t pulses = inletPulses; inletPulses = 0; interrupts();
  const float litres = static_cast<float>(pulses) / FLOW_PULSES_PER_LITRE_INLET;
  const float flow = litres * 60000.0f / static_cast<float>(max(elapsedMs, 1UL));
  if (!isfinite(flow) || flow > MAX_FLOW_LPM) { inletMeasurementValid = false; Serial.println("Inlet flow rejected: above configured maximum; inspect calibration/noise."); return NAN; }
  inletMeasurementValid = true;
  return flow;
}

float measureWaterHeightCm() {
  digitalWrite(ULTRASONIC_TRIGGER_PIN, LOW); delayMicroseconds(3);
  digitalWrite(ULTRASONIC_TRIGGER_PIN, HIGH); delayMicroseconds(10); digitalWrite(ULTRASONIC_TRIGGER_PIN, LOW);
  const unsigned long duration = pulseIn(ULTRASONIC_ECHO_PIN, HIGH, 30000UL);
  if (!duration) return NAN;
  const float distance = static_cast<float>(duration) * 0.0343f / 2.0f;
  return isfinite(distance) && distance >= ULTRASONIC_MIN_CM && distance <= ULTRASONIC_MAX_CM ? distance : NAN;
}

int jsonValueStart(const String& body, const char* key) {
  const String needle = String("\"") + key + "\"";
  const int keyStart = body.indexOf(needle); if (keyStart < 0) return -1;
  const int colon = body.indexOf(':', keyStart + needle.length()); if (colon < 0) return -1;
  int start = colon + 1; while (start < static_cast<int>(body.length()) && isspace(static_cast<unsigned char>(body[start]))) start++;
  return start;
}
bool readJsonNumber(const String& body, const char* key, float& value) {
  const int start = jsonValueStart(body, key); if (start < 0) return false;
  int end = start; while (end < static_cast<int>(body.length()) && body[end] != ',' && body[end] != '}' && !isspace(static_cast<unsigned char>(body[end]))) end++;
  if (end <= start) return false;
  const String token = body.substring(start, end); char* parseEnd = nullptr;
  const double parsed = strtod(token.c_str(), &parseEnd);
  if (parseEnd == token.c_str() || *parseEnd != '\0' || !isfinite(parsed)) return false;
  value = static_cast<float>(parsed); return isfinite(value);
}
bool readJsonUnsigned(const String& body, const char* key, uint32_t& value) {
  float parsed = 0; if (!readJsonNumber(body, key, parsed) || parsed < 0 || floor(parsed) != parsed || parsed > 4294967295.0f) return false;
  value = static_cast<uint32_t>(parsed); return true;
}

void handleOutletReading() {
  if (!localServer.hasHeader(OUTLET_HEADER_NAME) || localServer.header(OUTLET_HEADER_NAME) != String(AQ_OUTLET_SHARED_TOKEN)) {
    localServer.send(401, "application/json", "{\"accepted\":false,\"error\":\"unauthorized\"}"); return;
  }
  const String body = localServer.arg("plain");
  float flow = NAN, total = NAN, sampleMs = NAN; uint32_t sequence = 0;
  if (!readJsonNumber(body, "outlet_flow_lpm", flow) || flow < 0 || flow > MAX_FLOW_LPM ||
      !readJsonNumber(body, "total_volume_l", total) || total < 0 ||
      !readJsonUnsigned(body, "sequence", sequence) || !readJsonNumber(body, "sample_ms", sampleMs) || sampleMs < 250 || sampleMs > 5000) {
    localServer.send(422, "application/json", "{\"accepted\":false,\"error\":\"invalid telemetry\"}"); return;
  }
  const unsigned long now = millis();
  const bool newEpoch = !outletTelemetryValid || now - lastOutletAt > OUTLET_TIMEOUT_MS * 2UL;
  if (outletTelemetryValid && !newEpoch && static_cast<int32_t>(sequence - latestOutletSequence) <= 0) {
    localServer.send(409, "application/json", "{\"accepted\":false,\"error\":\"duplicate_or_outdated_sequence\"}"); return;
  }
  latestOutletFlowLpm = flow; latestOutletVolumeLitres = total; latestOutletSequence = sequence;
  lastOutletAt = now; outletTelemetryValid = true;
  localServer.send(202, "application/json", "{\"accepted\":true}");
}

const char LOCAL_DASHBOARD_HTML[] PROGMEM = R"HTML(<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AquaGuard Local Dashboard</title><style>body{font:16px system-ui;background:#071321;color:#eef7fb;margin:0;padding:20px;max-width:800px;margin:auto}h1{color:#57d7e8}.card{background:#10253a;border:1px solid #29445a;border-radius:14px;padding:16px;margin:12px 0}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.v{font-size:1.5rem;font-weight:700}button,select{padding:10px;border-radius:8px;border:1px solid #527083;background:#132f48;color:white;margin:4px}button{cursor:pointer}small{color:#a9c1d1}.danger{color:#ff8787}.ok{color:#73e1ad}</style><h1>AquaGuard · Local fallback</h1><p>Hosted by the ESP32 access point. Internet is not required. The ESP32 controls the relay, buzzer, LCD and GSM SMS locally.</p><div class="card"><div id="health">Loading local state…</div><div class="grid"><div>Inlet <div class="v" id="inlet">—</div></div><div>Outlet <div class="v" id="outlet">—</div></div><div>Difference <div class="v" id="loss">—</div></div><div>Tank distance <div class="v" id="tank">—</div></div></div><p>Valve command: <b id="valve">—</b> · Buzzer <b id="buzzer">—</b></p><p>Cloud link: <b id="cloud">—</b></p><p>Decision: <b id="decision">—</b></p><p>Last alert: <b id="lastAlert">—</b></p><p>SMS: <b id="smsStatus">—</b><br><small id="smsText"></small></p><p>Physical LCD: <code id="lcdLines">—</code></p></div><div class="card"><label>On-device alert language <select id="lang"><option value="en">English</option><option value="rw">Kinyarwanda</option><option value="fr">Français</option><option value="sw">Kiswahili</option><option value="zh">中文</option><option value="nl">Nederlands</option><option value="it">Italiano</option><option value="es">Español</option><option value="hi">हिन्दी</option></select></label><button onclick="saveLang()">Save language</button><p><small>Chinese and Hindi SMS use UCS2; the 16×2 character LCD shows a short Latin transliteration for scripts it cannot render.</small></p></div><div class="card"><button id="reset" onclick="resetSystem()">Acknowledge and reopen valve</button><p><small>Only works with a fresh outlet link, valid inlet measurement, and five stable flow samples. Verify the cause is repaired first. NO valve position is not physically sensed.</small></p><p><small id="result"></small></p></div><script>async function update(){try{const r=await fetch('/api/state',{cache:'no-store'});const d=await r.json();document.querySelector('#health').textContent=d.outletFresh?'Local sensors connected':'Outlet link lost · safety latch active';document.querySelector('#inlet').textContent=d.inletValid?d.inletLpm.toFixed(2)+' L/min':'INVALID';document.querySelector('#outlet').textContent=d.outletFresh?d.outletLpm.toFixed(2)+' L/min':'STALE';document.querySelector('#loss').textContent=d.outletFresh?(d.inletLpm-d.outletLpm).toFixed(2)+' L/min':'—';document.querySelector('#tank').textContent=d.tankCm===null?'—':d.tankCm.toFixed(1)+' cm';document.querySelector('#valve').textContent=d.valveOpen?'OPEN (command)':'CLOSED (command)';document.querySelector('#buzzer').textContent=d.buzzer?'ON':'OFF';document.querySelector('#cloud').textContent=d.internetOK?'AVAILABLE':'UNAVAILABLE';document.querySelector('#decision').textContent=d.decision;document.querySelector('#lastAlert').textContent=d.lastAlert;document.querySelector('#smsStatus').textContent=d.smsStatus;document.querySelector('#smsText').textContent=d.smsText||'No SMS attempted';document.querySelector('#lcdLines').textContent=d.lcd0+' / '+d.lcd1;document.querySelector('#lang').value=d.language;document.querySelector('#reset').disabled=!d.canReset}catch(e){document.querySelector('#health').textContent='Local controller unavailable'}}async function saveLang(){const lang=document.querySelector('#lang').value;const r=await fetch('/api/config/language',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'lang='+encodeURIComponent(lang)});document.querySelector('#result').textContent=r.ok?'Language saved':'Could not save language'}async function resetSystem(){if(!confirm('Have you inspected/repaired the cause and verified the pipe is safe to reopen?'))return;const r=await fetch('/api/reset',{method:'POST'});const d=await r.json();document.querySelector('#result').textContent=d.message||'Reset requested';update()}update();setInterval(update,1000);</script></html>)HTML";

bool outletFreshNow() { return outletTelemetryValid && millis() - lastOutletAt <= OUTLET_TIMEOUT_MS && isfinite(latestOutletFlowLpm); }
uint8_t safeFlowSamples = 0;
unsigned long lastSafeSampleAt = 0;
void updateSafeResetCount() {
  const unsigned long now = millis();
  if (now - lastSafeSampleAt < INLET_SAMPLE_INTERVAL_MS) return;
  lastSafeSampleAt = now;
  if (inletMeasurementValid && outletFreshNow() && isfinite(latestInletFlowLpm) && fabsf(latestInletFlowLpm - latestOutletFlowLpm) < FLOW_DIFFERENCE_THRESHOLD_LPM) {
    if (safeFlowSamples < SAFE_RESET_SAMPLES) safeFlowSamples++;
  } else safeFlowSamples = 0;
}
void handleLocalState() {
  const bool fresh = outletFreshNow();
  String body = "{";
  body += "\"inletLpm\":" + String(isfinite(latestInletFlowLpm) ? latestInletFlowLpm : 0.0f, 2) + ",";
  body += "\"outletLpm\":" + String(fresh ? latestOutletFlowLpm : 0.0f, 2) + ",";
  body += "\"tankCm\":" + String(isfinite(latestWaterHeightCm) ? String(latestWaterHeightCm, 1) : String("null")) + ",";
  body += "\"inletValid\":" + String(inletMeasurementValid ? "true" : "false") + ",";
  body += "\"outletFresh\":" + String(fresh ? "true" : "false") + ",";
  body += "\"valveOpen\":" + String(valveOpen ? "true" : "false") + ",";
  body += "\"buzzer\":" + String(digitalRead(BUZZER_PIN) == HIGH ? "true" : "false") + ",";
  body += "\"locked\":" + String(emergencyLock ? "true" : "false") + ",";
  body += "\"canReset\":" + String((emergencyLock && safeFlowSamples >= SAFE_RESET_SAMPLES && fresh && inletMeasurementValid) ? "true" : "false") + ",";
  body += "\"internetOK\":" + String(cloudReachable ? "true" : "false") + ",";
  body += "\"language\":\"" + jsonEscape(alertLanguage) + "\",\"decision\":\"" + jsonEscape(lastDecision) + "\",";
  body += "\"lastAlert\":\"" + jsonEscape(lastLocalAlert) + "\",\"smsStatus\":\"" + jsonEscape(lastSmsStatus) + "\",\"smsText\":\"" + jsonEscape(lastSmsMessage) + "\",";
  body += "\"lcd0\":\"" + jsonEscape(currentLcdLine0) + "\",\"lcd1\":\"" + jsonEscape(currentLcdLine1) + "\"}";
  localServer.send(200, "application/json", body);
}
void handleLanguage() {
  String value = localServer.arg("lang"); value.toLowerCase();
  if (value != "en" && value != "rw" && value != "fr" && value != "sw" && value != "zh" && value != "nl" && value != "it" && value != "es" && value != "hi") {
    localServer.send(400, "application/json", "{\"saved\":false,\"message\":\"unsupported language\"}"); return;
  }
  alertLanguage = value; preferences.putString("lang", alertLanguage);
  localServer.send(200, "application/json", "{\"saved\":true}");
}
void handleReset() {
  if (!emergencyLock) { localServer.send(409, "application/json", "{\"ok\":false,\"message\":\"No safety lock is active.\"}"); return; }
  if (!outletFreshNow() || !inletMeasurementValid || safeFlowSamples < SAFE_RESET_SAMPLES) {
    localServer.send(409, "application/json", "{\"ok\":false,\"message\":\"Reset denied: need a fresh outlet link, valid inlet flow, and five balanced samples.\"}"); return;
  }
  emergencyLock = false; abnormalFlowStartedAt = 0; digitalWrite(BUZZER_PIN, LOW);
  setValveOpen(true); lastDecision = "MANUAL RESET"; safeFlowSamples = 0;
  queueAlert("reset");
  localServer.send(200, "application/json", "{\"ok\":true,\"message\":\"Safety latch cleared; valve OPEN command issued. Observe the pipe and valve.\"}");
}
void handleRoot() { localServer.send_P(200, "text/html; charset=utf-8", LOCAL_DASHBOARD_HTML); }

void serviceWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  const unsigned long now = millis();
  if (now - lastWifiReconnectAt < WIFI_RECONNECT_INTERVAL_MS) return;
  lastWifiReconnectAt = now; WiFi.disconnect(false, false); WiFi.begin(AQ_INTERNET_WIFI_SSID, AQ_INTERNET_WIFI_PASSWORD);
}
String cloudHealthUrl() {
  String endpoint = String(AQ_AQUAGUARD_ENDPOINT);
  const int api = endpoint.indexOf("/api/");
  if (api < 0) return "";
  return endpoint.substring(0, api) + "/api/health";
}
bool beginHttp(HTTPClient& http, WiFiClient& plain, WiFiClientSecure& secure, const String& url) {
  const bool https = url.startsWith("https://");
  if (https) {
    if (strlen(AQ_ROOT_CA_PEM) < 100) { Serial.println("HTTPS disabled: configure AQ_ROOT_CA_PEM; certificate checks stay enabled."); return false; }
    secure.setCACert(AQ_ROOT_CA_PEM);
    return http.begin(secure, url);
  }
  return http.begin(plain, url);
}
void updateCloudReachability(bool reachable) {
  const unsigned long now = millis();
  if (reachable) {
    if (!cloudReachable && cloudUnavailableSince > 0) {
      const uint32_t duration = static_cast<uint32_t>((now - cloudUnavailableSince) / 1000UL);
      pendingOutageSeconds = duration;
      if (outageAlertSent && duration >= 120) queueAlert("restored");
      cloudUnavailableSince = 0; outageAlertSent = false;
    }
    cloudReachable = true;
    return;
  }
  cloudReachable = false;
  if (cloudUnavailableSince == 0) cloudUnavailableSince = now;
  if (!outageAlertSent && now - cloudUnavailableSince >= INTERNET_NOTICE_AFTER_MS) {
    outageAlertSent = true;
    queueAlert("internet");
    showLcdMessage(lcdAlarmText("internet"), "Local control ON", 7000UL);
  }
}
void probeCloudHealth() {
  if (WiFi.status() != WL_CONNECTED) { updateCloudReachability(false); return; }
  const String url = cloudHealthUrl(); if (!url.length()) { updateCloudReachability(false); return; }
  WiFiClient plain; WiFiClientSecure secure; HTTPClient http;
  http.setConnectTimeout(1000); http.setTimeout(1000);
  lastNetworkOperationAt = millis();
  if (!beginHttp(http, plain, secure, url)) { updateCloudReachability(false); return; }
  const int code = http.GET(); http.end();
  updateCloudReachability(code >= 200 && code < 400);
}

bool getIsoTimestamp(char* out, size_t size) {
  timeval tv; gettimeofday(&tv, nullptr);
  if (tv.tv_sec < 1700000000) return false;
  tm utc; gmtime_r(&tv.tv_sec, &utc);
  char base[24]; strftime(base, sizeof(base), "%Y-%m-%dT%H:%M:%S", &utc);
  snprintf(out, size, "%s.%03ldZ", base, static_cast<long>(tv.tv_usec / 1000));
  return true;
}
void sendToCloud() {
  const unsigned long now = millis();
  if (now - lastCloudHealthAt >= CLOUD_HEALTH_INTERVAL_MS) {
    lastCloudHealthAt = now;
    probeCloudHealth();
    lastCloudSendAt = millis();
    return;
  }
  if (now - lastCloudSendAt < CLOUD_SEND_INTERVAL_MS) return;
  lastCloudSendAt = now;
  if (!cloudReachable || WiFi.status() != WL_CONNECTED || !outletFreshNow() || !inletMeasurementValid || !isfinite(latestInletFlowLpm)) return;
  char timestamp[32]; if (!getIsoTimestamp(timestamp, sizeof(timestamp))) return;
  const bool ultrasonicValid = isfinite(latestWaterHeightCm);
  String payload = "{";
  payload += "\"device_id\":\"" + String(DEVICE_ID) + "\",\"inlet_flow_lpm\":" + String(latestInletFlowLpm, 2) + ",";
  payload += "\"outlet_flow_lpm\":" + String(latestOutletFlowLpm, 2) + ",";
  if (ultrasonicValid) payload += "\"water_level_cm\":" + String(latestWaterHeightCm, 1) + ",";
  payload += "\"valve_open\":" + String(valveOpen ? "true" : "false") + ",";
  payload += "\"timestamp\":\"" + String(timestamp) + "\",\"internet_connected\":" + String(cloudReachable ? "true" : "false") + ",";
  payload += "\"internet_outage_seconds\":" + String(pendingOutageSeconds) + ",\"firmware_version\":\"1.1.0-esp32-core-3.3.10\",";
  payload += "\"sensor_health\":{\"inlet\":true,\"outlet\":true,\"ultrasonic\":" + String(ultrasonicValid ? "true" : "false") + "}}";
  WiFiClient plain; WiFiClientSecure secure; HTTPClient http;
  http.setConnectTimeout(750); http.setTimeout(1000);
  lastNetworkOperationAt = millis();
  if (!beginHttp(http, plain, secure, String(AQ_AQUAGUARD_ENDPOINT))) return;
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + AQ_ESP32_API_KEY);
  const int code = http.POST(payload); http.end();
  if (code < 200 || code >= 300) Serial.printf("Cloud POST failed: HTTP %d\n", code);
  else if (pendingOutageSeconds) pendingOutageSeconds = 0;
}

String notificationsUrl() {
  String endpoint = String(AQ_AQUAGUARD_ENDPOINT);
  const int api = endpoint.indexOf("/api/");
  if (api < 0) return "";
  return endpoint.substring(0, api) + "/api/esp32/notifications";
}
String fieldBetween(const String& line, int& cursor) {
  const int end = line.indexOf('|', cursor);
  if (end < 0) { String part = line.substring(cursor); cursor = line.length(); return part; }
  String part = line.substring(cursor, end); cursor = end + 1; return part;
}
String lcdCodeForCloud(const String& codeOrType) {
  if (codeOrType == "possible_leak") return "leak";
  if (codeOrType == "device_offline") return "outlet";
  if (codeOrType == "device_restored") return "device_restored";
  if (codeOrType == "internet_outage") return "internet";
  if (codeOrType == "internet_restored") return "internet_restored";
  if (codeOrType == "low_water_level") return "tank_dropping";
  if (codeOrType == "abnormal_pressure") return "sensor";
  return codeOrType;
}
void queueLcdNotice(const String& title, const String& detail) {
  if (lcdNoticeCount >= LCD_NOTICE_CAPACITY) {
    lcdNoticeHead = (lcdNoticeHead + 1) % LCD_NOTICE_CAPACITY;
    lcdNoticeCount--;
  }
  lcdNoticeTitles[lcdNoticeTail] = title;
  lcdNoticeDetails[lcdNoticeTail] = detail;
  lcdNoticeTail = (lcdNoticeTail + 1) % LCD_NOTICE_CAPACITY;
  lcdNoticeCount++;
}
void queueCloudNotification(const String& code, const String& title, const String& detail) {
  const String sms = limitSmsUnits(String("AquaGuard ") + String(DEVICE_ID) + ": " + title + (detail.length() ? String(". ") + detail : String("")));
  lastLocalAlert = sms;
  enqueueSms(sms, true);
  cloudAlertDisplayTitle = lcdAlarmText(lcdCodeForCloud(code)); cloudAlertDisplayDetail = detail;
  queueLcdNotice(cloudAlertDisplayTitle, detail.length() ? detail : (alertLanguage == "fr" ? "Voir SMS details" : alertLanguage == "sw" ? "Angalia SMS" : alertLanguage == "rw" ? "Reba SMS" : alertLanguage == "zh" ? "Kan SMS xiangqing" : alertLanguage == "nl" ? "Zie SMS details" : alertLanguage == "it" ? "Vedi SMS details" : alertLanguage == "es" ? "Ver detalles SMS" : alertLanguage == "hi" ? "SMS vivaran dekhein" : "See SMS details"));
}
void rememberCloudAlertId(const String& id) {
  const String token = String("|") + id + "|";
  if (id.length() == 0 || recentCloudAlertIds.indexOf(token) >= 0) return;
  recentCloudAlertIds += token;
  while (recentCloudAlertIds.length() > 700) {
    const int first = recentCloudAlertIds.indexOf('|', 1);
    const int second = first < 0 ? -1 : recentCloudAlertIds.indexOf('|', first + 1);
    if (second < 0) { recentCloudAlertIds = token; break; }
    recentCloudAlertIds.remove(0, second + 1);
  }
  preferences.putString("alertIds", recentCloudAlertIds);
}
void pollCloudNotifications() {
  const unsigned long now = millis();
  if (now - lastNotificationPollAt < 15000UL || !cloudReachable || WiFi.status() != WL_CONNECTED) return;
  lastNotificationPollAt = now;
  const String base = notificationsUrl(); if (!base.length()) return;
  const String url = base + "?device_id=" + String(DEVICE_ID) + "&lang=" + alertLanguage + "&after=" + String(cloudAlertCursor);
  WiFiClient plain; WiFiClientSecure secure; HTTPClient http;
  http.setConnectTimeout(750); http.setTimeout(1000);
  lastNetworkOperationAt = millis();
  if (!beginHttp(http, plain, secure, url)) return;
  http.addHeader("Authorization", String("Bearer ") + AQ_ESP32_API_KEY);
  const int status = http.GET();
  const String body = status == 200 ? http.getString() : String("");
  http.end();
  if (status != 200 || !body.length()) return;
  String insightSignature;
  const uint8_t MAX_CLOUD_INSIGHTS = 8;
  String insightCodes[MAX_CLOUD_INSIGHTS], insightLevels[MAX_CLOUD_INSIGHTS];
  String insightTitles[MAX_CLOUD_INSIGHTS], insightDetails[MAX_CLOUD_INSIGHTS];
  uint8_t insightCount = 0;
  int start = 0;
  while (start < body.length()) {
    int end = body.indexOf('\n', start); if (end < 0) end = body.length();
    String line = body.substring(start, end); line.trim(); start = end + 1;
    if (line.startsWith("C|")) { cloudAlertCursor = static_cast<uint32_t>(line.substring(2).toInt()); continue; }
    if (line.startsWith("L|")) {
      String lang = line.substring(2); lang.trim();
      if (lang == "en" || lang == "rw" || lang == "fr" || lang == "sw" || lang == "zh" || lang == "nl" || lang == "it" || lang == "es" || lang == "hi") {
        alertLanguage = lang; preferences.putString("lang", alertLanguage);
      }
      continue;
    }
    int cursor = 0; const String kind = fieldBetween(line, cursor);
    if (kind == "A") {
      const String id = fieldBetween(line, cursor);
      const String type = fieldBetween(line, cursor);
      const String severity = fieldBetween(line, cursor);
      const String title = fieldBetween(line, cursor);
      const String detail = fieldBetween(line, cursor);
      if (recentCloudAlertIds.indexOf(String("|") + id + "|") < 0) {
        queueCloudNotification(type, title, detail);
        rememberCloudAlertId(id);
      }
      (void)type; (void)severity;
    } else if (kind == "I") {
      const String code = fieldBetween(line, cursor);
      const String level = fieldBetween(line, cursor);
      const String title = fieldBetween(line, cursor);
      const String detail = fieldBetween(line, cursor);
      insightSignature += code + "|" + level + "\n";
      if (insightCount < MAX_CLOUD_INSIGHTS) {
        insightCodes[insightCount] = code; insightLevels[insightCount] = level;
        insightTitles[insightCount] = title; insightDetails[insightCount] = detail;
        insightCount++;
      }
    }
  }
  if (insightSignature != lastCloudInsightSignature) {
    for (uint8_t i = 0; i < insightCount; ++i) {
      const String key = insightCodes[i] + "|" + insightLevels[i] + "\n";
      if (lastCloudInsightSignature.indexOf(key) < 0)
        queueCloudNotification(insightCodes[i], "AI: " + insightTitles[i], insightDetails[i]);
    }
    lastCloudInsightSignature = insightSignature;
    preferences.putString("aiSignature", lastCloudInsightSignature);
  }
  preferences.putULong("alertCursor", cloudAlertCursor);
}

void showLcd() {
  const unsigned long now = millis();
  if (static_cast<long>(lcdOverrideUntil - now) > 0 || now - lastLcdRefreshAt < LCD_REFRESH_INTERVAL_MS) return;
  lastLcdRefreshAt = now;
  if (lcdNoticeCount) {
    const String title = lcdNoticeTitles[lcdNoticeHead];
    const String detail = lcdNoticeDetails[lcdNoticeHead];
    lcdNoticeHead = (lcdNoticeHead + 1) % LCD_NOTICE_CAPACITY; lcdNoticeCount--;
    showLcdMessage(title, detail, 4000UL);
    return;
  }
  if (!outletFreshNow()) {
    writeLcdLine(0, lcdAlarmText("outlet"));
    writeLcdLine(1, String("Valve:") + (valveOpen ? "OPEN" : "CLOSED"));
    return;
  }
  if (now - lastLcdPageAt >= 4000UL) { lastLcdPageAt = now; lcdTankPage = !lcdTankPage; }
  if (lcdTankPage) {
    writeLcdLine(0, String("Tank:") + numberOrNa(latestWaterHeightCm) + "cm");
    writeLcdLine(1, String("Valve:") + (valveOpen ? "OPEN" : "CLOSED") + (emergencyLock ? " LOCK" : ""));
  } else {
    writeLcdLine(0, String("I:") + numberOrNa(latestInletFlowLpm) + " O:" + numberOrNa(latestOutletFlowLpm));
    writeLcdLine(1, String("Loss:") + numberOrNa(latestInletFlowLpm - latestOutletFlowLpm) + " L/m");
  }
}
void evaluateSafety() {
  const unsigned long now = millis();
  if (!outletFreshNow()) {
    abnormalFlowStartedAt = 0;
    if (!emergencyLock && now - lastOutletAt > OUTLET_TIMEOUT_MS) closeWater("OUTLET LINK LOST");
    return;
  }
  if (!inletMeasurementValid || !isfinite(latestInletFlowLpm)) { closeWater("FLOW SENSOR FAULT"); return; }
  updateSafeResetCount();
  if (emergencyLock) return;
  const float delta = latestInletFlowLpm - latestOutletFlowLpm;
  if (!valveOpen && latestInletFlowLpm > max(0.25f, FLOW_DIFFERENCE_THRESHOLD_LPM * 0.1f)) { closeWater("FLOW SENSOR FAULT"); return; }
  if (delta >= FLOW_DIFFERENCE_THRESHOLD_LPM) {
    if (abnormalFlowStartedAt == 0) abnormalFlowStartedAt = now;
    else if (now - abnormalFlowStartedAt >= LEAK_CONFIRMATION_MS) closeWater("LEAK DETECTED");
  } else abnormalFlowStartedAt = 0;
}
void processSmsQueue() {
  const unsigned long now = millis();
  if (gsmBusy || now - lastSmsAttemptAt < 5000UL) return;
  if (now - lastStatusSmsAt >= SMS_STATUS_INTERVAL_MS) {
    const String status = messagePrefix("status") + " " + String(DEVICE_ID) + " I:" + numberOrNa(latestInletFlowLpm) + " O:" + numberOrNa(latestOutletFlowLpm) + " L:" + numberOrNa(latestInletFlowLpm - latestOutletFlowLpm) + " V:" + (valveOpen ? "O" : "C") + " N:" + (cloudReachable ? "OK" : "OFF");
    if (enqueueSms(status, false)) lastStatusSmsAt = now;
  }
  if (!smsQueueCount) return;
  const String message = smsQueue[smsQueueHead];
  smsQueueHead = (smsQueueHead + 1) % SMS_QUEUE_CAPACITY; smsQueueCount--;
  preferences.putString("smsFlight", message);
  persistSmsQueue();
  lastSmsAttemptAt = now;
  if (sendSmsNotification(message)) preferences.remove("smsFlight");
  else enqueueSms(message, true);
}

void setup() {
  Serial.begin(115200); delay(500);
  pinMode(SOLENOID_RELAY_PIN, OUTPUT); pinMode(BUZZER_PIN, OUTPUT);
  pinMode(ULTRASONIC_TRIGGER_PIN, OUTPUT); pinMode(ULTRASONIC_ECHO_PIN, INPUT); pinMode(INLET_FLOW_PIN, INPUT_PULLUP);
  digitalWrite(BUZZER_PIN, LOW); digitalWrite(ULTRASONIC_TRIGGER_PIN, LOW);
  setValveOpen(true); valveOpen = true; // NO solenoid unpowered = open; exact behavior must pass relay test

  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN); lcd.init(); lcd.backlight();
  writeLcdLine(0, "AquaGuard" ); writeLcdLine(1, "Starting...");
  preferences.begin("aquaguard", false); smsPersistenceReady = true; alertLanguage = preferences.getString("lang", "en");
  cloudAlertCursor = preferences.getULong("alertCursor", 0);
  recentCloudAlertIds = preferences.getString("alertIds", "");
  lastCloudInsightSignature = preferences.getString("aiSignature", "");
  restoreSmsQueue();
  if (alertLanguage != "en" && alertLanguage != "rw" && alertLanguage != "fr" && alertLanguage != "sw" && alertLanguage != "zh" && alertLanguage != "nl" && alertLanguage != "it" && alertLanguage != "es" && alertLanguage != "hi") alertLanguage = "en";

  WiFi.mode(WIFI_AP_STA); WiFi.softAPConfig(LOCAL_AP_IP, LOCAL_AP_IP, IPAddress(255,255,255,0));
  WiFi.softAP(AQ_LOCAL_AP_SSID, AQ_LOCAL_AP_PASSWORD);
  WiFi.begin(AQ_INTERNET_WIFI_SSID, AQ_INTERNET_WIFI_PASSWORD);
  configTime(0, 0, "pool.ntp.org", "time.google.com");

  localServer.collectHeaders(OUTLET_HEADER_KEYS, 1);
  localServer.on("/", HTTP_GET, handleRoot);
  localServer.on("/api/state", HTTP_GET, handleLocalState);
  localServer.on("/api/config/language", HTTP_POST, handleLanguage);
  localServer.on("/api/reset", HTTP_POST, handleReset);
  localServer.on(OUTLET_ROUTE, HTTP_POST, handleOutletReading);
  localServer.begin();
  attachInterrupt(digitalPinToInterrupt(INLET_FLOW_PIN), onInletPulse, FALLING);

  lastInletSampleAt = millis(); lastWaterLevelSampleAt = millis();
  lastCloudHealthAt = millis() - CLOUD_HEALTH_INTERVAL_MS;
  lastStatusSmsAt = millis(); lastSmsAttemptAt = millis() - SMS_RETRY_INTERVAL_MS;
  gsmSerial.begin(9600, SERIAL_8N1, GSM_RX_PIN, GSM_TX_PIN);
  Serial.println("AquaGuard ESP32 ready. Local dashboard: http://192.168.4.1/");
  enqueueSms(compactSms("status"), true); // immediate boot status; recurring status follows every minute
}

void serviceBackground() {
  localServer.handleClient(); serviceWifi();
  const unsigned long now = millis();
  if (now - lastInletSampleAt >= INLET_SAMPLE_INTERVAL_MS) {
    const unsigned long elapsed = now - lastInletSampleAt; lastInletSampleAt = now;
    latestInletFlowLpm = sampleInletFlow(elapsed);
  }
  if (now - lastWaterLevelSampleAt >= WATER_LEVEL_SAMPLE_INTERVAL_MS) {
    lastWaterLevelSampleAt = now; latestWaterHeightCm = measureWaterHeightCm();
  }
  updateSafeResetCount(); evaluateSafety(); showLcd();
  // Keep local safety active during modem waits and evaluate it before cloud work.
  if (!gsmBusy) {
    const unsigned long previousNetworkOperationAt = lastNetworkOperationAt;
    sendToCloud();
    if (lastNetworkOperationAt == previousNetworkOperationAt) pollCloudNotifications();
  }
}
void loop() {
  serviceBackground();
  evaluateSafety();
  processSmsQueue();
}
