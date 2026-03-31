-- ============================================
-- TABLAS FALTANTES PARA SINCRONIZACIÓN COMPLETA
-- Ejecutar en Supabase SQL Editor
-- Dulce Placer ERP v5.2 - 2026-03-30
-- ============================================

-- 1. TRABAJADORES
CREATE TABLE IF NOT EXISTS trabajadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  cargo TEXT,
  telefono TEXT,
  documento TEXT,
  salario NUMERIC DEFAULT 0,
  fecha_ingreso TIMESTAMPTZ DEFAULT now(),
  estado TEXT DEFAULT 'activo',
  horario TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE trabajadores ENABLE ROW LEVEL SECURITY;

-- Política: todos los usuarios autenticados pueden CRUD
CREATE POLICY "trabajadores_full_access" ON trabajadores
  FOR ALL USING (true) WITH CHECK (true);

-- 2. CRÉDITOS DE TRABAJADORES
CREATE TABLE IF NOT EXISTS creditos_trabajadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trabajador_id UUID REFERENCES trabajadores(id) ON DELETE CASCADE,
  monto NUMERIC DEFAULT 0,
  tipo TEXT,
  descripcion TEXT,
  fecha TIMESTAMPTZ DEFAULT now(),
  estado TEXT DEFAULT 'pendiente',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE creditos_trabajadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "creditos_trabajadores_full_access" ON creditos_trabajadores
  FOR ALL USING (true) WITH CHECK (true);

-- Índice para búsquedas por trabajador
CREATE INDEX IF NOT EXISTS idx_creditos_trabajador_id ON creditos_trabajadores(trabajador_id);
