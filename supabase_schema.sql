-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Users (Managed by Supabase Auth, but we can extend with a profile table if needed)
-- For this app, we'll store app-specific user data in 'public.usuarios' linked to auth.users
create table public.usuarios (
  id uuid references auth.users not null primary key,
  email text unique not null,
  nombre text,
  rol text check (rol in ('ADMIN', 'GERENTE', 'COMPRADOR', 'VENDEDOR')) default 'VENDEDOR',
  activo boolean default true,
  ultimo_acceso timestamptz,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.usuarios enable row level security;

-- Policies for Users
create policy "Users can view their own profile" on public.usuarios
  for select using (auth.uid() = id);

create policy "Admins can view all profiles" on public.usuarios
  for select using (
    exists (select 1 from public.usuarios where id = auth.uid() and rol = 'ADMIN')
  );

-- 2. Products
create table public.productos (
  id uuid default uuid_generate_v4() primary key,
  nombre text not null,
  categoria text not null,
  descripcion text,
  precio_venta numeric(10, 2) default 0,
  margen_utilidad numeric(5, 2) default 30,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Suppliers
create table public.proveedores (
  id uuid default uuid_generate_v4() primary key,
  nombre text not null,
  contacto text,
  telefono text,
  email text,
  direccion text,
  created_at timestamptz default now()
);

-- 4. Prices (Relation Product-Supplier)
create table public.precios (
  id uuid default uuid_generate_v4() primary key,
  producto_id uuid references public.productos(id) on delete cascade not null,
  proveedor_id uuid references public.proveedores(id) on delete cascade not null,
  precio_costo numeric(10, 2) not null,
  fecha_actualizacion timestamptz default now(),
  notas text,
  unique(producto_id, proveedor_id)
);

-- 5. Inventory Items
create table public.inventario (
  id uuid default uuid_generate_v4() primary key,
  producto_id uuid references public.productos(id) on delete cascade unique not null,
  stock_actual integer default 0,
  stock_minimo integer default 5,
  ubicacion text,
  ultimo_movimiento timestamptz default now()
);

-- 6. Inventory Movements
create table public.movimientos (
  id uuid default uuid_generate_v4() primary key,
  producto_id uuid references public.productos(id) on delete cascade not null,
  tipo text check (tipo in ('entrada', 'salida', 'ajuste')) not null,
  cantidad integer not null,
  motivo text,
  fecha timestamptz default now(),
  usuario_id uuid references public.usuarios(id) -- Optional if we track who made the move
);

-- 7. Pre-Orders (PrePedidos)
create table public.prepedidos (
  id uuid default uuid_generate_v4() primary key,
  nombre text not null,
  proveedor_id uuid references public.proveedores(id) on delete  set null,
  total numeric(10, 2) default 0,
  presupuesto_maximo numeric(10, 2) default 0,
  estado text check (estado in ('borrador', 'confirmado', 'rechazado')) default 'borrador',
  notas text,
  fecha_creacion timestamptz default now(),
  fecha_actualizacion timestamptz default now()
);

-- Items inside Pre-Orders
create table public.prepedido_items (
  id uuid default uuid_generate_v4() primary key,
  prepedido_id uuid references public.prepedidos(id) on delete cascade not null,
  producto_id uuid references public.productos(id) not null,
  cantidad integer not null,
  precio_unitario numeric(10, 2) not null,
  subtotal numeric(10, 2) not null
);

-- 8. Price History
create table public.historial_precios (
  id uuid default uuid_generate_v4() primary key,
  producto_id uuid references public.productos(id) on delete cascade not null,
  proveedor_id uuid references public.proveedores(id) on delete cascade not null,
  precio_anterior numeric(10, 2) not null,
  precio_nuevo numeric(10, 2) not null,
  fecha_cambio timestamptz default now()
);

-- 9. Configuration (Single row usually)
create table public.configuracion (
  id text primary key default 'main',
  nombre_negocio text default 'Mi Negocio',
  moneda text default 'EUR',
  margen_utilidad_default numeric(5, 2) default 30,
  impuesto_porcentaje numeric(5, 2) default 0,
  ajuste_automatico boolean default true,
  notificar_subidas boolean default true,
  categorias jsonb default '[]'::jsonb
);

-- Row Level Security (RLS) - Basic Policies
-- Enable RLS on all tables
alter table public.productos enable row level security;
alter table public.proveedores enable row level security;
alter table public.precios enable row level security;
alter table public.inventario enable row level security;
alter table public.movimientos enable row level security;
alter table public.prepedidos enable row level security;
alter table public.prepedido_items enable row level security;
alter table public.historial_precios enable row level security;
alter table public.configuracion enable row level security;

-- Simple policy: Allow authenticated users to read/write everything
-- In a real production app, you might want stricter rules based on roles (ADMIN vs VENDEDOR)
create policy "Enable all access for authenticated users" on public.productos for all using (auth.role() = 'authenticated');
create policy "Enable all access for authenticated users" on public.proveedores for all using (auth.role() = 'authenticated');
create policy "Enable all access for authenticated users" on public.precios for all using (auth.role() = 'authenticated');
create policy "Enable all access for authenticated users" on public.inventario for all using (auth.role() = 'authenticated');
create policy "Enable all access for authenticated users" on public.movimientos for all using (auth.role() = 'authenticated');
create policy "Enable all access for authenticated users" on public.prepedidos for all using (auth.role() = 'authenticated');
create policy "Enable all access for authenticated users" on public.prepedido_items for all using (auth.role() = 'authenticated');
create policy "Enable all access for authenticated users" on public.historial_precios for all using (auth.role() = 'authenticated');
create policy "Enable all access for authenticated users" on public.configuracion for all using (auth.role() = 'authenticated');

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.usuarios (id, email, nombre, rol)
  values (new.id, new.email, new.raw_user_meta_data->>'nombre', 'VENDEDOR');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- ⭐ ANTIGRAVITY MAYORISTAS + AUDITORIA (NUEVO)
-- ============================================================

-- 10. Clients (Mayoristas y Detallistas)
create table if not exists public.clientes (
  id uuid default uuid_generate_v4() primary key,
  nombre text not null,
  identificacion text,
  telefono text,
  email text unique,
  direccion text,
  ciudad text,
  fecha_nacimiento text,
  tipo text check (tipo in ('mayorista', 'detal', 'trabajador')) default 'detal',
  notas text,
  puntos_lealtad integer default 0,
  margen_personalizado numeric(5, 2),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 11. Mayorista Tickets (Ventas pendientes sin cobrar)
create table if not exists public.mayorista_tickets (
  id uuid default uuid_generate_v4() primary key,
  cliente_id uuid references public.clientes(id) on delete cascade,
  usuario_id uuid references public.usuarios(id) on delete set null,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(12, 2) default 0,
  guardado_en timestamptz default now(),
  actualizado_en timestamptz default now()
);

-- 12. Mayorista Sales History (Ventas completadas)
create table if not exists public.mayorista_ventas (
  id uuid default uuid_generate_v4() primary key,
  cliente_id uuid references public.clientes(id) on delete cascade,
  usuario_id uuid references public.usuarios(id) on delete set null,
  items jsonb not null default '[]'::jsonb,
  total numeric(12, 2),
  fecha timestamptz default now(),
  metodo_pago text check (metodo_pago in ('efectivo', 'nequi', 'credito')) default 'efectivo',
  foto_factura text,
  estado text check (estado in ('completada', 'pendiente_credito')) default 'completada',
  abonos jsonb default '[]'::jsonb
);

-- 13. Price Change Audit Log (Auditoría de cambios de precios)
create table if not exists public.price_change_log (
  id uuid default uuid_generate_v4() primary key,
  producto_id uuid references public.productos(id) on delete cascade,
  precio_anterior numeric(10, 2),
  precio_nuevo numeric(10, 2),
  cambio_en timestamptz default now(),
  usuario_id uuid references public.usuarios(id) on delete set null,
  motivo text,
  modulo text check (modulo in ('mayorista', 'proveedores', 'manual')) default 'manual'
);

-- ============================================================
-- INDICES PARA PERFORMANCE
-- ============================================================
create index if not exists idx_mayorista_tickets_cliente on public.mayorista_tickets(cliente_id);
create index if not exists idx_mayorista_tickets_usuario on public.mayorista_tickets(usuario_id);
create index if not exists idx_mayorista_ventas_cliente on public.mayorista_ventas(cliente_id);
create index if not exists idx_mayorista_ventas_usuario on public.mayorista_ventas(usuario_id);
create index if not exists idx_mayorista_ventas_fecha on public.mayorista_ventas(fecha);
create index if not exists idx_price_change_log_producto on public.price_change_log(producto_id);
create index if not exists idx_price_change_log_usuario on public.price_change_log(usuario_id);
create index if not exists idx_price_change_log_fecha on public.price_change_log(cambio_en);
create index if not exists idx_clientes_tipo on public.clientes(tipo);

-- ============================================================
-- RLS MEJORADO (Row Level Security)
-- ============================================================

-- Enable RLS en tablas nuevas
alter table public.clientes enable row level security;
alter table public.mayorista_tickets enable row level security;
alter table public.mayorista_ventas enable row level security;
alter table public.price_change_log enable row level security;

-- RLS Clientes: ADMINs ven todos, VENDEDOR ven sus propios clientes
drop policy if exists "rls_clientes_read" on public.clientes;
create policy "rls_clientes_read" on public.clientes
  for select using (
    exists (select 1 from public.usuarios where id = auth.uid() and rol in ('ADMIN', 'GERENTE'))
    OR auth.uid() = usuario_creador_id
  );

drop policy if exists "rls_clientes_insert" on public.clientes;
create policy "rls_clientes_insert" on public.clientes
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "rls_clientes_update" on public.clientes;
create policy "rls_clientes_update" on public.clientes
  for update using (
    exists (select 1 from public.usuarios where id = auth.uid() and rol = 'ADMIN')
  );

-- RLS Mayorista Tickets: Solo el creador + ADMIN
drop policy if exists "rls_mayorista_tickets_read" on public.mayorista_tickets;
create policy "rls_mayorista_tickets_read" on public.mayorista_tickets
  for select using (
    usuario_id = auth.uid() 
    OR exists (select 1 from public.usuarios where id = auth.uid() and rol = 'ADMIN')
  );

drop policy if exists "rls_mayorista_tickets_insert" on public.mayorista_tickets;
create policy "rls_mayorista_tickets_insert" on public.mayorista_tickets
  for insert with check (
    usuario_id = auth.uid() OR auth.uid()::text = auth.uid()::text
  );

-- RLS Mayorista Ventas: Solo lectura para el creador + ADMIN
drop policy if exists "rls_mayorista_ventas_read" on public.mayorista_ventas;
create policy "rls_mayorista_ventas_read" on public.mayorista_ventas
  for select using (
    usuario_id = auth.uid()
    OR exists (select 1 from public.usuarios where id = auth.uid() and rol = 'ADMIN')
  );

drop policy if exists "rls_mayorista_ventas_insert" on public.mayorista_ventas;
create policy "rls_mayorista_ventas_insert" on public.mayorista_ventas
  for insert with check (usuario_id = auth.uid());

-- RLS Price Change Log: Solo lectura para ADMIN + COMPRADOR
drop policy if exists "rls_price_change_log_read" on public.price_change_log;
create policy "rls_price_change_log_read" on public.price_change_log
  for select using (
    exists (select 1 from public.usuarios where id = auth.uid() and rol in ('ADMIN', 'COMPRADOR'))
  );

drop policy if exists "rls_price_change_log_insert" on public.price_change_log;
create policy "rls_price_change_log_insert" on public.price_change_log
  for insert with check (
    exists (select 1 from public.usuarios where id = auth.uid() and rol in ('ADMIN', 'COMPRADOR'))
  );
