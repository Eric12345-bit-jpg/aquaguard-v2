-- AquaGuard Rwanda: empty-first production schema
-- Apply in Supabase SQL editor or via the Supabase CLI.

create extension if not exists pgcrypto;

create type public.device_status as enum ('online', 'offline');
create type public.alert_severity as enum ('low', 'medium', 'high');
create type public.alert_type as enum ('possible_leak', 'abnormal_pressure', 'low_water_level', 'device_offline', 'device_restored');

create table if not exists public.monitoring_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  device_id text not null unique,
  name text not null,
  zone_id uuid references public.monitoring_zones(id) on delete set null,
  status public.device_status not null default 'offline',
  last_seen_at timestamptz,
  sensor_availability jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sensor_readings (
  id bigint generated always as identity primary key,
  device_id uuid not null references public.devices(id) on delete cascade,
  inlet_flow_lpm numeric(10,2) not null check (inlet_flow_lpm >= 0),
  outlet_flow_lpm numeric(10,2) not null check (outlet_flow_lpm >= 0),
  pressure_bar numeric(10,3) not null check (pressure_bar >= 0),
  water_level numeric(10,3) not null check (water_level >= 0),
  pump_status boolean not null,
  observed_at timestamptz not null,
  source text not null default 'live_hardware' check (source = 'live_hardware'),
  created_at timestamptz not null default now()
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  device_id uuid references public.devices(id) on delete set null,
  zone_id uuid references public.monitoring_zones(id) on delete set null,
  type public.alert_type not null,
  severity public.alert_severity not null,
  message text not null,
  acknowledged_at timestamptz,
  observed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'viewer' check (role in ('admin', 'operator', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sensor_readings_device_time_idx on public.sensor_readings(device_id, observed_at desc);
create index if not exists alerts_created_idx on public.alerts(created_at desc);

alter table public.monitoring_zones enable row level security;
alter table public.devices enable row level security;
alter table public.sensor_readings enable row level security;
alter table public.alerts enable row level security;
alter table public.user_profiles enable row level security;

create or replace function public.is_admin_or_operator()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_profiles where id = auth.uid() and role in ('admin', 'operator'));
$$;

create policy "authenticated users can read zones" on public.monitoring_zones for select to authenticated using (true);
create policy "admins can manage zones" on public.monitoring_zones for all to authenticated using (public.is_admin_or_operator()) with check (public.is_admin_or_operator());
create policy "authenticated users can read devices" on public.devices for select to authenticated using (true);
create policy "authenticated users can manage devices" on public.devices for all to authenticated using (public.is_admin_or_operator()) with check (public.is_admin_or_operator());
create policy "authenticated users can read live readings" on public.sensor_readings for select to authenticated using (true);
create policy "authenticated users can read alerts" on public.alerts for select to authenticated using (true);
create policy "operators can acknowledge alerts" on public.alerts for update to authenticated using (public.is_admin_or_operator()) with check (public.is_admin_or_operator());
create policy "users can read their profile" on public.user_profiles for select to authenticated using (id = auth.uid());

-- ESP32 ingestion must use the server-side service-role client, never the browser anon key.
alter publication supabase_realtime add table public.sensor_readings;
alter publication supabase_realtime add table public.alerts;

-- No INSERT statements are included: the production database intentionally starts empty.
