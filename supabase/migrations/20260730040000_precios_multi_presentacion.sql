-- Permite varias presentaciones del mismo producto+proveedor (bulto, unidad, etc.).
-- El upsert de la app ahora usa onConflict: 'id'.
-- Si queda un UNIQUE(producto_id, proveedor_id), la segunda presentación falla al subir.

-- Quitar UNIQUE compuesto típico (nombre puede variar según cómo se creó la tabla)
ALTER TABLE IF EXISTS public.precios
  DROP CONSTRAINT IF EXISTS precios_producto_id_proveedor_id_key;

ALTER TABLE IF EXISTS public.precios
  DROP CONSTRAINT IF EXISTS precios_producto_id_proveedor_id_unique;

-- Índice no único para búsquedas (opcional, no bloquea presentaciones)
CREATE INDEX IF NOT EXISTS precios_producto_proveedor_idx
  ON public.precios (producto_id, proveedor_id);

-- Asegurar PK / unique en id (normalmente ya existe)
-- ALTER TABLE public.precios ADD CONSTRAINT precios_pkey PRIMARY KEY (id);
