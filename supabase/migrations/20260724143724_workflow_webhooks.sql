-- Habilitar extensión pg_net para hacer llamadas HTTP desde la base de datos
create extension if not exists pg_net;

-- Función genérica para disparar el motor de workflows (Edge Function)
create or replace function public.trigger_workflow_engine()
returns trigger as $$
begin
  -- Llamada a la Edge Function "workflow-engine"
  -- Nota: En producción, 'workflow_id' debería obtenerse dinámicamente o pasarse como argumento
  perform net.http_post(
    -- La URL de la función edge (se debe reemplazar con el project ref real o pasarlo por entorno)
    url := 'https://hurlzmarkmkjhwmkwqld.supabase.co/functions/v1/workflow-engine',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'data', row_to_json(NEW)
    )
  );
  return NEW;
end;
$$ language plpgsql security definer;

-- ==========================================
-- EJEMPLOS DE TRIGGERS
-- Puedes descomentar y adaptar estos triggers para las tablas que necesites monitorear.
-- ==========================================

-- Trigger para cuando entra un nuevo mensaje de WhatsApp (tabla de comunicaciones)
/*
create trigger on_new_whatsapp_message
after insert on public.comunicaciones
for each row
execute function public.trigger_workflow_engine();
*/

-- Trigger para cuando el inventario baja (tabla de inventario)
/*
create trigger on_inventory_change
after update on public.inventario
for each row
when (NEW.cantidad < NEW.minimo)
execute function public.trigger_workflow_engine();
*/
