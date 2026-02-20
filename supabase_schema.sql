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
