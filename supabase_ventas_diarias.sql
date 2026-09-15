-- ═══════════════════════════════════════════════════════════════════
-- Tabla: ventas_diarias
-- "Ventas manuales (mientras el POS no arranca)" — hoy solo vive en
-- localStorage de cada dispositivo (VentaDiaria en src/types/index.ts,
-- finanzas-personales.ts). Esta tabla la sube a Supabase para que
-- sincronice entre celulares de vendedoras y el PC del administrador.
--
-- Cómo aplicar: pegar este script completo en Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.ventas_diarias (
  id uuid default uuid_generate_v4() primary key,
  fecha date not null,
  turno text check (turno in ('Mañana', 'Tarde-Noche', 'Día Completo')),
  evento text,
  total_efectivo numeric(12, 2) default 0,
  total_nequi numeric(12, 2) default 0,
  total_transferencia numeric(12, 2) default 0,
  total_credito numeric(12, 2) default 0,
  total numeric(12, 2) default 0,
  notas text,
  cajas jsonb default '{}'::jsonb,
  usuario_id uuid references public.usuarios(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.ventas_diarias enable row level security;

drop policy if exists "Enable all access for authenticated users" on public.ventas_diarias;
create policy "Enable all access for authenticated users"
  on public.ventas_diarias
  for all
  using (auth.role() = 'authenticated');

-- Índice para las consultas por rango de fechas (ArqueoCajas.tsx, Reportes.tsx)
create index if not exists idx_ventas_diarias_fecha on public.ventas_diarias (fecha);
