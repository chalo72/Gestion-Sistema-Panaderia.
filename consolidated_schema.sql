-- Consolidated Supabase Schema for Bakery Price Control System
-- Run this script in the Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Users
create table if not exists public.usuarios (
  id uuid references auth.users not null primary key,
  email text unique not null,
  nombre text,
  rol text check (rol in ('ADMIN', 'GERENTE', 'COMPRADOR', 'VENDEDOR')) default 'VENDEDOR',
  activo boolean default true,
  ultimo_acceso timestamptz,
  created_at timestamptz default now()
);

alter table public.usuarios enable row level security;

-- 2. Products
create table if not exists public.productos (
  id uuid default uuid_generate_v4() primary key,
  nombre text not null,
  categoria text not null,
  descripcion text,
  precio_venta numeric(10, 2) default 0,
  margen_utilidad numeric(5, 2) default 30,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.productos enable row level security;

-- 3. Suppliers
create table if not exists public.proveedores (
  id uuid default uuid_generate_v4() primary key,
  nombre text not null,
  contacto text,
  telefono text,
  email text,
  direccion text,
  created_at timestamptz default now()
);

alter table public.proveedores enable row level security;

-- 4. Prices
create table if not exists public.precios (
  id uuid default uuid_generate_v4() primary key,
  producto_id uuid references public.productos(id) on delete cascade not null,
  proveedor_id uuid references public.proveedores(id) on delete cascade not null,
  precio_costo numeric(10, 2) not null,
  fecha_actualizacion timestamptz default now(),
  notas text,
  unique(producto_id, proveedor_id)
);

alter table public.precios enable row level security;

-- 5. Inventory
create table if not exists public.inventario (
  id uuid default uuid_generate_v4() primary key,
  producto_id uuid references public.productos(id) on delete cascade unique not null,
  stock_actual integer default 0,
  stock_minimo integer default 5,
  ubicacion text,
  ultimo_movimiento timestamptz default now()
);

alter table public.inventario enable row level security;

-- 6. Movements
create table if not exists public.movimientos (
  id uuid default uuid_generate_v4() primary key,
  producto_id uuid references public.productos(id) on delete cascade not null,
  tipo text check (tipo in ('entrada', 'salida', 'ajuste')) not null,
  cantidad integer not null,
  motivo text,
  fecha timestamptz default now(),
  usuario_id uuid references public.usuarios(id),
  usuario text default 'system'
);

alter table public.movimientos enable row level security;

-- 7. PrePedidos
create table if not exists public.prepedidos (
  id uuid default uuid_generate_v4() primary key,
  nombre text not null,
  proveedor_id uuid references public.proveedores(id) on delete set null,
  total numeric(10, 2) default 0,
  presupuesto_maximo numeric(10, 2) default 0,
  estado text check (estado in ('borrador', 'confirmado', 'rechazado', 'completado')) default 'borrador',
  notas text,
  fecha_creacion timestamptz default now(),
  fecha_actualizacion timestamptz default now()
);

alter table public.prepedidos enable row level security;

-- 8. PrePedido Items
create table if not exists public.prepedido_items (
  id uuid default uuid_generate_v4() primary key,
  prepedido_id uuid references public.prepedidos(id) on delete cascade not null,
  producto_id uuid references public.productos(id) not null,
  cantidad integer not null,
  precio_unitario numeric(10, 2) not null,
  subtotal numeric(10, 2) not null
);

alter table public.prepedido_items enable row level security;

-- 9. History
create table if not exists public.historial_precios (
  id uuid default uuid_generate_v4() primary key,
  producto_id uuid references public.productos(id) on delete cascade not null,
  proveedor_id uuid references public.proveedores(id) on delete cascade not null,
  precio_anterior numeric(10, 2) not null,
  precio_nuevo numeric(10, 2) not null,
  fecha_cambio timestamptz default now()
);

alter table public.historial_precios enable row level security;

-- 10. Configuration
create table if not exists public.configuracion (
  id text primary key default 'main',
  nombre_negocio text default 'Mi Negocio',
  direccion_negocio text,
  telefono_negocio text,
  email_negocio text,
  moneda text default 'EUR',
  margen_utilidad_default numeric(5, 2) default 30,
  impuesto_porcentaje numeric(5, 2) default 0,
  umbral_alerta numeric(5, 2) default 5,
  ajuste_automatico boolean default true,
  notificar_subidas boolean default true,
  mostrar_utilidad_en_lista boolean default true,
  categorias jsonb default '[]'::jsonb
);

alter table public.configuracion enable row level security;

-- 11. Alertas
create table if not exists public.alertas (
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

alter table public.alertas enable row level security;

-- 12. Recepciones
create table if not exists public.recepciones (
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
  items jsonb default '[]'::jsonb
);

alter table public.recepciones enable row level security;

-- Basic RLS Policies (Allow all authenticated users for now)
do $$
declare
    t text;
begin
    for t in select table_name 
             from information_schema.tables 
             where table_schema = 'public' 
             and table_type = 'BASE TABLE'
    loop
        execute format('drop policy if exists "Enable all access for authenticated users" on public.%I', t);
        execute format('create policy "Enable all access for authenticated users" on public.%I for all using (auth.role() = ''authenticated'')', t);
    end loop;
end $$;

-- Policies for usuarios table specifically
drop policy if exists "Users can view their own profile" on public.usuarios;
create policy "Users can view their own profile" on public.usuarios for select using (auth.uid() = id);

drop policy if exists "Admins can view all profiles" on public.usuarios;
create policy "Admins can view all profiles" on public.usuarios for select using (
    exists (select 1 from public.usuarios where id = auth.uid() and rol = 'ADMIN')
);

-- Trigger for new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.usuarios (id, email, nombre, rol)
  values (new.id, new.email, new.raw_user_meta_data->>'nombre', 'VENDEDOR');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
