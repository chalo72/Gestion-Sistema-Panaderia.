-- Habilitamos los triggers reales para las automatizaciones

-- 1. Trigger para cuando el inventario baja del minimo
create trigger on_inventory_change
after update on public.inventario
for each row
when (NEW.stock_actual < NEW.stock_minimo)
execute function public.trigger_workflow_engine();

-- 2. Trigger para cuando se crea una nueva alerta
create trigger on_new_alerta
after insert on public.alertas
for each row
execute function public.trigger_workflow_engine();

-- 3. Trigger para una nueva venta
create trigger on_new_venta
after insert on public.ventas
for each row
execute function public.trigger_workflow_engine();
