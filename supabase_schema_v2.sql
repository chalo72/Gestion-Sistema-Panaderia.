-- 10. Alertas
create table public.alertas (
  id uuid default uuid_generate_v4() primary key,
  producto_id uuid references public.productos(id) on delete cascade not null,
  proveedor_id uuid references public.proveedores(id) on delete cascade not null,
  tipo text check (tipo in ('subida', 'bajada')) not null,
  precio_anterior numeric(10, 2) not null,
  precio_nuevo numeric(10, 2) not null,
  diferencia numeric(10, 2) not null,
  porcentaje_cambio numeric(5, 2) not null,
  fecha timestamptz default now(),
  leida boolean default false
);

-- Enable RLS for Alertas
alter table public.alertas enable row level security;
create policy "Enable all access for authenticated users" on public.alertas for all using (auth.role() = 'authenticated');

-- 11. Recepciones
create table public.recepciones (
  id uuid default uuid_generate_v4() primary key,
  pre_pedido_id uuid references public.prepedidos(id) on delete set null,
  proveedor_id uuid references public.proveedores(id) on delete cascade not null,
  numero_factura text,
  fecha_factura date,
  total_factura numeric(10, 2) default 0,
  estado text check (estado in ('en_proceso', 'completada', 'con_incidencias')) default 'en_proceso',
  recibido_por text,
  firma text,
  observaciones text,
  fecha_recepcion timestamptz default now(),
  imagen_factura text,
  items jsonb default '[]'::jsonb -- Storing items as JSONB for simplicity, or normalize if needed
);

-- Enable RLS for Recepciones
alter table public.recepciones enable row level security;
create policy "Enable all access for authenticated users" on public.recepciones for all using (auth.role() = 'authenticated');
