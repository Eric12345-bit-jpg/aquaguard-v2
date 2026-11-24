#pragma once
// Copy to aquaguard_secrets.h (ignored by Git) and fill locally. Never commit the copy.
#define AQ_INTERNET_WIFI_SSID "REPLACE_WITH_WIFI_SSID"
#define AQ_INTERNET_WIFI_PASSWORD "REPLACE_WITH_WIFI_PASSWORD"
#define AQ_LOCAL_AP_SSID "AquaGuard-ESP32"
#define AQ_LOCAL_AP_PASSWORD "REPLACE_WITH_PRIVATE_AP_PASSWORD_MIN_8_CHARS"
#define AQ_OUTLET_SHARED_TOKEN "REPLACE_WITH_RANDOM_SHARED_TOKEN"
#define AQ_ESP32_API_KEY "REPLACE_WITH_SERVER_ESP32_API_KEY"
#define AQ_AQUAGUARD_ENDPOINT "http://192.168.1.50:3000/api/esp32/readings"
#define AQ_ALERT_PHONE_NUMBER "+2507XXXXXXXX"
// For a Vercel HTTPS endpoint, paste the certificate-authority PEM that validates
// that endpoint here. Local development uses the LAN HTTP endpoint above. HTTPS
// certificate verification is intentionally enabled; there is no insecure fallback.
static const char AQ_ROOT_CA_PEM[] PROGMEM = "";
