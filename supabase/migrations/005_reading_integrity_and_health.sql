-- Apply after 004_internet_alert_types.sql. This is additive and does not delete or rewrite history.
alter table public.sensor_readings
  add column if not exists received_at timestamptz not null default now(),
  add column if not exists sensor_health jsonb not null default '{}'::jsonb;

alter table public.devices
  add column if not exists device_health jsonb not null default '{}'::jsonb;

create index if not exists sensor_readings_received_at_idx
  on public.sensor_readings(received_at desc);
create index if not exists alerts_open_created_idx
  on public.alerts(created_at desc) where acknowledged_at is null;

-- NOT VALID avoids failing because of historical bad data, while enforcing this limit
-- for all new readings. Match MAX_FLOW_LPM in .env and firmware after calibration.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sensor_readings_flow_lpm_upper_bound'
      and conrelid = 'public.sensor_readings'::regclass
  ) then
    alter table public.sensor_readings
      add constraint sensor_readings_flow_lpm_upper_bound
      check (inlet_flow_lpm <= 30 and outlet_flow_lpm <= 30) not valid;
  end if;
end $$;
