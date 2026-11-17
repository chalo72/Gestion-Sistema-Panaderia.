-- Create table for IA insights (agente_hallazgos) if it doesn't exist
CREATE TABLE IF NOT EXISTS public.agente_hallazgos (
    id UUID PRIMARY KEY,
    agente_id TEXT NOT NULL,
    mision_id TEXT,
    tipo TEXT NOT NULL,
    gravedad TEXT,
    titulo TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revisado BOOLEAN NOT NULL DEFAULT FALSE
);

-- Enable RLS
ALTER TABLE public.agente_hallazgos ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view insights
CREATE POLICY "Permitir lectura a usuarios autenticados" 
ON public.agente_hallazgos FOR SELECT 
TO authenticated 
USING (true);

-- Allow authenticated users to mark as read
CREATE POLICY "Permitir actualización a usuarios autenticados" 
ON public.agente_hallazgos FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

-- Allow the Service Role to insert insights
CREATE POLICY "Permitir inserción al service role" 
ON public.agente_hallazgos FOR INSERT 
TO service_role 
WITH CHECK (true);
