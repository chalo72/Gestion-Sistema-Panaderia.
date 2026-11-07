-- 2026-11-07: alarma cuando el candado bloquea que un equipo reabra una caja cerrada.
-- Queda anotado en caja_vigilancia (alarma = true) para saber qué equipo trae datos viejos.
-- SECURITY DEFINER: el equipo que guarda no tiene permiso de escribir en caja_vigilancia.
-- Si anotar falla, el guardado de la caja sigue normal (nunca se bloquea por la alarma).
-- Máximo una alarma por caja cada 30 minutos, para no llenar la tabla si un equipo insiste.
create or replace function public.caja_no_reabrir()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if old.estado = 'cerrada' and coalesce(new.estado, 'abierta') <> 'cerrada' then
    new.estado          := 'cerrada';
    new.fecha_cierre    := old.fecha_cierre;
    new.monto_cierre    := old.monto_cierre;
    new.arqueo_por_caja := coalesce(old.arqueo_por_caja, new.arqueo_por_caja);

    begin
      if not exists (
        select 1 from public.caja_vigilancia
        where alarma
          and detalle like '%' || old.id::text || '%'
          and revisado_en > now() - interval '30 minutes'
      ) then
        insert into public.caja_vigilancia (cajas_abiertas_antes, cajas_cerradas, alarma, detalle)
        values (0, 0, true,
          'REAPERTURA BLOQUEADA: un equipo intentó reabrir la caja ' || old.id::text ||
          coalesce(' (' || old.caja_nombre || ')', '') ||
          ' abierta el ' || to_char(old.fecha_apertura at time zone 'America/Bogota', 'YYYY-MM-DD HH24:MI') ||
          '. Ese equipo tiene datos viejos: recargarlo con la versión nueva.');
      end if;
    exception when others then
      null; -- la alarma nunca impide guardar la caja
    end;
  end if;
  return new;
end;
$$;
