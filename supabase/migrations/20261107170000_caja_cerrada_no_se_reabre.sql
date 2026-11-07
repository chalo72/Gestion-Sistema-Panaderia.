-- 2026-11-07: un dispositivo con copia vieja reabría cajas ya cerradas
-- (el cron de las 3:05 a. m. cerró 11 cajas del día anterior y a las 11:18 a. m.
-- el PC las volvió a subir como "abierta"). La app no tiene función de reabrir:
-- una caja cerrada se queda cerrada y conserva sus datos de cierre.
create or replace function public.caja_no_reabrir()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if old.estado = 'cerrada' and coalesce(new.estado, 'abierta') <> 'cerrada' then
    new.estado          := 'cerrada';
    new.fecha_cierre    := old.fecha_cierre;
    new.monto_cierre    := old.monto_cierre;
    new.arqueo_por_caja := coalesce(old.arqueo_por_caja, new.arqueo_por_caja);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_caja_no_reabrir on public.caja;
create trigger trg_caja_no_reabrir
  before update on public.caja
  for each row execute function public.caja_no_reabrir();

-- Re-cerrar las cajas de días anteriores que el PC reabrió (todas en $0, sin ventas).
update public.caja
set estado = 'cerrada',
    fecha_cierre = now(),
    monto_cierre = coalesce(monto_cierre, 0),
    arqueo_por_caja = coalesce(arqueo_por_caja, '{}'::jsonb)
        || jsonb_build_object('notaLimpieza',
           'Re-cerrada 2026-11-07: un dispositivo la había reabierto con datos viejos.')
where estado = 'abierta'
  and (fecha_apertura at time zone 'America/Bogota')::date
      < (now() at time zone 'America/Bogota')::date;
