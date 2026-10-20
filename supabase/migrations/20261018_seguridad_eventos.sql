-- Bitácora anti-robo de cajas (usada por src/lib/seguridad-nube.ts).
-- Solo se puede AGREGAR y LEER. Nadie puede borrar ni editar eventos desde la app;
-- el único campo editable es "leida".
create table if not exists public.seguridad_eventos (
  id text primary key,
  tipo text not null check (tipo in ('alerta','cuadre','log')),
  nivel text,
  titulo text,
  descripcion text,
  usuario text,
  payload jsonb default '{}'::jsonb,
  dispositivo text,
  fecha timestamptz not null default now(),
  leida boolean not null default false
);
create index if not exists seguridad_eventos_fecha_idx on public.seguridad_eventos (fecha desc);

alter table public.seguridad_eventos enable row level security;

drop policy if exists seg_eventos_select on public.seguridad_eventos;
drop policy if exists seg_eventos_insert on public.seguridad_eventos;
drop policy if exists seg_eventos_update_leida on public.seguridad_eventos;
create policy seg_eventos_select on public.seguridad_eventos for select to anon, authenticated using (true);
create policy seg_eventos_insert on public.seguridad_eventos for insert to anon, authenticated with check (true);
create policy seg_eventos_update_leida on public.seguridad_eventos for update to anon, authenticated using (true) with check (true);

revoke all on public.seguridad_eventos from anon, authenticated;
grant select, insert on public.seguridad_eventos to anon, authenticated;
grant update (leida) on public.seguridad_eventos to anon, authenticated;
