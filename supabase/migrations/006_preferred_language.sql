-- Apply after 005_reading_integrity_and_health.sql.
-- The service-role API stores the admin's chosen language so the ESP32 notification
-- poller can localize SMS/LCD summaries consistently with the cloud dashboard.
create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.system_settings enable row level security;

insert into public.system_settings (key, value)
values ('preferred_language', '{"code":"en"}'::jsonb)
on conflict (key) do nothing;
