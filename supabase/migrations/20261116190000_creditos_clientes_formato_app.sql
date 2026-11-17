-- 2026-11-16 — Créditos de clientes nunca llegaban a la nube.
-- La tabla `creditos` tenía otro formato (monto_total, saldo_pendiente, abonos) y la app
-- (supabase-db.ts addCreditoCliente) manda cliente_nombre, monto, saldo, items, pagos, estado='activo'.
-- Supabase rechazaba TODOS los guardados → tabla en 0 filas.
-- Esta migración solo agrega columnas y afloja reglas; no borra datos (la tabla estaba vacía).

-- 1) Columnas que usa la app
alter table public.creditos
  add column if not exists cliente_nombre   text,
  add column if not exists cliente_telefono text,
  add column if not exists monto            numeric,
  add column if not exists saldo            numeric,
  add column if not exists descripcion      text,
  add column if not exists fecha            text,
  add column if not exists items            jsonb default '[]'::jsonb,
  add column if not exists foto_evidencia   text,
  add column if not exists pagos            jsonb default '[]'::jsonb,
  add column if not exists usuario_id       text;

-- 2) Las columnas viejas pasan a opcionales (la app no las manda)
alter table public.creditos alter column monto_total     drop not null;
alter table public.creditos alter column saldo_pendiente drop not null;

-- 3) Estado: la app usa 'activo'
alter table public.creditos drop constraint if exists creditos_estado_check;
alter table public.creditos add constraint creditos_estado_check
  check (estado = any (array['activo','pendiente','parcial','pagado','vencido']));

-- 4) Sin llave foránea a clientes: el crédito se sube en paralelo con el cliente y fallaba
--    si el cliente aún no estaba en la nube; además ON DELETE CASCADE borraba la deuda
--    al borrar el cliente. cliente_id se sigue guardando.
alter table public.creditos drop constraint if exists creditos_cliente_id_fkey;

-- 5) Clientes: "Aparece en Consumo / Fiados"
alter table public.clientes add column if not exists en_consumo boolean default false;
