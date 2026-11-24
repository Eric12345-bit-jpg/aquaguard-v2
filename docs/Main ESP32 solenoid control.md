# Main ESP32 solenoid control — normally-open valve

The installed actuator is specified as a normally-open (NO) solenoid valve: its water path is open when the solenoid coil is unpowered. The relay's **NO contact** supplies the solenoid coil. Firmware constants are `SOLENOID_NORMALLY_OPEN=true`, `RELAY_LOAD_USES_NO_CONTACT=true`, and `RELAY_ACTIVE_LOW=true`.

With this wiring, relay de-energized means the relay NO contact is open, the valve coil is unpowered, and the valve is expected OPEN. To command the valve CLOSED, the ESP32 energizes the relay, which closes its NO contact and energizes the valve coil. This is not a fail-closed arrangement: losing ESP32/relay/coil power leaves the NO valve open. There is no physical valve-position feedback; “OPEN/CLOSED” in the dashboard and telemetry is the commanded state only.

## Verify before connecting water

1. Isolate the pipe and remove pressure. Ensure the coil's voltage/current, relay contact rating, driver, fuse, and flyback protection are appropriate. Do not power the coil from an ESP32 GPIO.
2. Flash `firmware/esp32_main/relay_verification/relay_verification.ino` alone to the main ESP32. It does not automatically cycle the relay. In the serial monitor, `o` de-energizes the relay and should open the NO valve; `c` energizes the relay and should close it. Confirm the **physical valve**, relay indicator/contact and water path under safe conditions.
3. If observed behavior differs, stop. Correct the relay input active polarity, contact wiring, or valve type before flashing the main sketch. Do not invert firmware constants based only on an LED.
4. Once verified, flash `firmware/esp32_main/esp32_main.ino`. It commands OPEN at startup, and commands CLOSED/latches a fault after a sustained ≥2 L/min inlet–outlet imbalance for 10 seconds, invalid inlet measurement, or outlet telemetry timeout (5 seconds). Local alert processing continues without Internet.
5. Reset from the ESP32 local page only after inspecting the cause. The page requires a fresh outlet connection, valid inlet flow, five stable balanced one-second samples, and an explicit confirmation.

The local timer, SMS and LCD indicate commands/detections, not proof of valve travel or water shutoff. Keep an operator present during commissioning. A normally-open valve necessarily opens on loss of electrical power; if the installation requires closure on power loss, use a properly engineered different valve/power/safety arrangement and revalidate the complete design with a qualified installer.
