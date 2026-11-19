-- Despachos (rutas de reparto) y datos de tiendas, cada uno en su propia fila (2026-11-19).
-- Antes todos los despachos iban como UN solo bloque en configuracion: si dos vendedores
-- estaban en ruta a la vez, el último en guardar borraba lo del otro.
-- APLICADA en Supabase el 2026-11-19. Mismo acceso que las demás tablas (allow_all_access).
create table if not exists public.despachos_ruta (
  id text primary key,
  fecha date,
  vendedor text,
  ruta_nombre text,
  estado text,
  data jsonb not null,
  actualizado_en timestamptz not null default now()
);
create index if not exists despachos_ruta_fecha_idx on public.despachos_ruta (fecha desc);
create table if not exists public.tiendas_ruta (
  cliente_id text primary key,
  dueno text,
  whatsapp text,
  barrio text,
  data jsonb,
  actualizado_en timestamptz not null default now()
);
alter table public.despachos_ruta enable row level security;
alter table public.tiendas_ruta enable row level security;
drop policy if exists allow_all_access on public.despachos_ruta;
create policy allow_all_access on public.despachos_ruta for all using (true) with check (true);
drop policy if exists allow_all_access on public.tiendas_ruta;
create policy allow_all_access on public.tiendas_ruta for all using (true) with check (true);
