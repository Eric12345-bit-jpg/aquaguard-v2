-- AquaGuard two-MCU architecture: no pressure sensor, local solenoid actuator.
-- Apply after 001_initial_schema.sql.

alter table public.sensor_readings alter column pressure_bar drop not null;
alter table public.sensor_readings alter column water_level drop not null;
alter table public.sensor_readings alter column pump_status drop not null;
alter table public.sensor_readings add column if not exists valve_open boolean not null default true;

comment on column public.sensor_readings.pressure_bar is 'Nullable legacy field; this two-MCU build has no pressure sensor.';
comment on column public.sensor_readings.water_level is 'Nullable legacy field; this two-MCU build has no water-level sensor.';
comment on column public.sensor_readings.pump_status is 'Nullable legacy field; this two-MCU build has no pump telemetry.';
comment on column public.sensor_readings.valve_open is 'Solenoid valve state reported by the main ESP32.';
