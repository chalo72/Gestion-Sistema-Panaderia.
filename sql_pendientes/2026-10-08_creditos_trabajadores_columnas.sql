-- Dulce Placer - 2026-10-08 - Cursor (auditoría Consumo y Préstamos)
-- Para ejecutar en Supabase > SQL Editor. Es seguro repetirlo (IF NOT EXISTS) y NO borra datos.
--
-- Motivo: la app envía estos campos de "Consumo y Préstamos" y la tabla de la nube no los tiene,
-- por eso Supabase rechaza TODO el guardado (hoy hay 0 filas en la nube) y cada aparato
-- (PC / celular) solo ve sus propios registros.
--
-- Nota: la tabla `trabajadores` NO necesita cambios. Su columna de horario se llama `turno`
-- y el cambio de código en supabase-db.ts (pendiente de AUTORIZO) mapea horario <-> turno.

ALTER TABLE public.creditos_trabajadores
  ADD COLUMN IF NOT EXISTS trabajador_nombre    text,
  ADD COLUMN IF NOT EXISTS trabajador_rol       text,
  ADD COLUMN IF NOT EXISTS saldo                numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tipo                 text    DEFAULT 'consumo',
  ADD COLUMN IF NOT EXISTS fecha_vencimiento    text,
  ADD COLUMN IF NOT EXISTS descontar_de_salario boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS foto_evidencia       text,
  ADD COLUMN IF NOT EXISTS usuario_id           text,
  ADD COLUMN IF NOT EXISTS items                jsonb   DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pagos                jsonb   DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at           timestamptz DEFAULT now();

-- Verificación: debe listar las columnas nuevas
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'creditos_trabajadores'
ORDER BY ordinal_position;
