-- Apply after 003_ultrasonic_water_height.sql.
-- Postgres enum additions are additive and retain historical alert rows.
alter type public.alert_type add value if not exists 'internet_outage';
alter type public.alert_type add value if not exists 'internet_restored';
