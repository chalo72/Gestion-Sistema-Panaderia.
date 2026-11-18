-- Consumo y Préstamos entre aparatos (2026-11-16, AUTORIZO Gonzalo)
-- 1) updated_at: sin esta fecha la app no sabía qué versión era más nueva y cada aparato
--    resubía todos sus registros en cada sincronización (≈6.000 envíos al día).
-- 2) tiene_foto: la lista ya no descarga las fotos (pesaban casi 10 MB); con esta columna
--    la app sabe que hay foto y la trae solo cuando se toca.
alter table public.creditos_trabajadores
  add column if not exists updated_at timestamptz;

update public.creditos_trabajadores
  set updated_at = coalesce(created_at, fecha, now())
  where updated_at is null;

alter table public.creditos_trabajadores
  add column if not exists tiene_foto boolean
  generated always as (foto_evidencia is not null and foto_evidencia <> '') stored;
