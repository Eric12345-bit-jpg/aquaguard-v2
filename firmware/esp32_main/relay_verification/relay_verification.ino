#include <Arduino.h>

// Upload this sketch by itself with the water line isolated and pressure removed.
// It does not auto-cycle the relay: the operator must type one explicit command.
const uint8_t SOLENOID_RELAY_PIN = 23;
const bool RELAY_ACTIVE_LOW = true;
void relayEnergized(bool energized) {
  const bool pinHigh = RELAY_ACTIVE_LOW ? !energized : energized;
  digitalWrite(SOLENOID_RELAY_PIN, pinHigh ? HIGH : LOW);
}
void printPrompt() {
  Serial.println();
  Serial.println("Relay test: type 'o' = de-energize relay / NO solenoid should OPEN;");
  Serial.println("            type 'c' = energize relay / NO solenoid should CLOSE;");
  Serial.println("            type '?' = show instructions.");
  Serial.println("No valve-position sensor exists: visually/physically verify; software cannot confirm movement.");
}
void setup() {
  Serial.begin(115200);
  pinMode(SOLENOID_RELAY_PIN, OUTPUT);
  // Start with relay energized so an NO solenoid is commanded closed during the test.
  relayEnergized(true);
  delay(250);
  Serial.println("AquaGuard NO-valve relay verification (GPIO23, active-low relay input).");
  Serial.println("Isolate water/pressure. Confirm relay NO contact switches the solenoid supply.");
  Serial.println("Initial command: relay energized; valve expected CLOSED.");
  printPrompt();
}
void loop() {
  if (!Serial.available()) return;
  const char command = static_cast<char>(Serial.read());
  if (command == 'o' || command == 'O') {
    relayEnergized(false);
    Serial.println("Relay de-energized. NO solenoid is expected to be OPEN (unpowered).");
  } else if (command == 'c' || command == 'C') {
    relayEnergized(true);
    Serial.println("Relay energized. Solenoid is expected to be powered/CLOSED.");
  } else if (command == '?') printPrompt();
}
