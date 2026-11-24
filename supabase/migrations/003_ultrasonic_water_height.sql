-- AquaGuard optional source-tank ultrasonic measurement.
-- The existing nullable water_level column stores the measured distance from
-- the ultrasonic sensor to the water surface, in centimetres. A null value
-- means the ESP32 did not receive a valid echo for that sample.

comment on column public.sensor_readings.water_level is 'Optional source-tank ultrasonic distance in centimetres; null when no valid echo is available. Pressure remains unused in the two-MCU architecture.';
