-- Optional only: inspect existing rows first; do not re-register an existing device.
-- This inserts the known controller/zone when missing and preserves an existing zone.
insert into public.monitoring_zones (name, description)
values ('acej_karama path', 'AquaGuard monitored water section; no pressure sensor installed.')
on conflict (name) do nothing;

insert into public.devices (device_id, name, zone_id, status)
select 'XXSR69', 'ESP32 DevKit V1', z.id, 'offline'::public.device_status
from public.monitoring_zones z
where z.name = 'acej_karama path'
on conflict (device_id) do update
set name = excluded.name,
    zone_id = coalesce(public.devices.zone_id, excluded.zone_id),
    updated_at = now();
