-- Protocolo Antigravity: Esquema para el Módulo de Escandallos (BOM)
-- Ejecuta este script en el editor SQL de Supabase para habilitar la funcionalidad de recetas.

-- 1. Actualizar tabla de productos con campos para BOM
ALTER TABLE productos 
ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'ingrediente',
ADD COLUMN IF NOT EXISTS costo_base DECIMAL(12,2) DEFAULT 0;

-- 2. Crear tabla de recetas (Escandallos)
CREATE TABLE IF NOT EXISTS recetas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    producto_id UUID REFERENCES productos(id) ON DELETE CASCADE,
    ingredientes JSONB DEFAULT '[]'::jsonb,
    porciones_resultantes DECIMAL(12,2) DEFAULT 1,
    instrucciones TEXT,
    fecha_actualizacion TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(producto_id)
);

-- 3. Habilitar Seguridad de Nivel de Fila (RLS)
ALTER TABLE recetas ENABLE ROW LEVEL SECURITY;

-- 4. Crear Políticas de Acceso para usuarios autenticados
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'recetas' AND policyname = 'Allow authenticated full access to recetas'
    ) THEN
        CREATE POLICY "Allow authenticated full access to recetas" 
        ON recetas FOR ALL 
        TO authenticated 
        USING (true) 
        WITH CHECK (true);
    END IF;
END $$;

COMMENT ON TABLE recetas IS 'Almacena la composición de productos elaborados (BOM) y sus costos calculados.';
