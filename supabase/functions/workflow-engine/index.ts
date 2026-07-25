import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

console.log("Edge Function de Workflows iniciada.");

serve(async (req) => {
  try {
    // 1. Recibir Payload del Webhook
    const payload = await req.json();
    console.log("Evento recibido en el Cerebro:", payload);
    
    // Payload esperado: { type: 'INSERT', table: 'ventas', data: {...} }
    const tableName = payload.table;
    const eventType = payload.type;

    // 2. Conectar a Supabase usando el SERVICE_ROLE para tener permisos totales
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 3. Obtener TODOS los workflows activos
    const { data: workflows, error } = await supabaseClient
      .from('workflows')
      .select('*')
      .eq('active', true);

    if (error || !workflows) {
      console.error("Error al obtener workflows:", error);
      return new Response(JSON.stringify({ error: "No se pudieron obtener workflows" }), { status: 500 });
    }

    console.log(`Buscando flujos que escuchen a la tabla: ${tableName}... (Activos totales: ${workflows.length})`);

    let ejecutados = 0;
    const resultados = [];
    
    // 4. Ejecutar workflows que coincidan
    for (const w of workflows) {
        const nodes = w.nodes || [];
        const edges = w.edges || [];
        
        // Determinar si este flujo debe ejecutarse para este evento
        let debeEjecutarse = false;
        
        // Buscar el nodo inicial
        const triggerNode = nodes.find((n: any) => n.id === '1' || n.type === 'trigger' || n.data?.category?.includes('Trigger') || n.data?.title?.includes('Trigger'));
        if (triggerNode) {
            const triggerLabel = (triggerNode.data?.label || triggerNode.data?.title || '').toLowerCase();
            const triggerAction = (triggerNode.data?.action || triggerNode.data?.description || '').toLowerCase();
            
            if (tableName === 'ventas' && (triggerLabel.includes('venta') || triggerAction.includes('venta'))) debeEjecutarse = true;
            if (tableName === 'inventario' && (triggerLabel.includes('inventario') || triggerAction.includes('inventario') || triggerLabel.includes('stock'))) debeEjecutarse = true;
            if (tableName === 'alertas' && (triggerLabel.includes('alerta') || triggerAction.includes('alerta'))) debeEjecutarse = true;
            
            // Si el nombre del flujo tiene la tabla, también lo tomamos por si acaso
            if (w.name.toLowerCase().includes(tableName)) debeEjecutarse = true;
        } else {
            // Si no hay un nodo trigger obvio pero el flujo es activo, lo ejecutamos igual para la prueba
            debeEjecutarse = true; 
        }
        
        if (debeEjecutarse) {
            console.log(`🚀 Ejecutando flujo [${w.name}] para evento en ${tableName}...`);
            ejecutados++;
            
            // ==========================================
            // LOGICA DEL MOTOR (BFS)
            // ==========================================
            const targets = new Set(edges.map((e: any) => e.target));
            let startNodes = nodes.filter((n: any) => !targets.has(n.id));
            
            let queue = startNodes.map((n: any) => ({ node: n, inputData: payload.data || {} }));
            let executionLog = [];

            while (queue.length > 0) {
              const { node, inputData } = queue.shift()!;
              console.log(`- Nodo: ${node.data?.title || node.id}`);
              
              let finalResult: any = '';
              const nodeCategory = node.data?.category || '';
              const nodeTitle = node.data?.title || '';
              
              try {
                if (nodeCategory === 'Trigger' || nodeCategory === 'Eventos (Triggers)' || nodeTitle.includes('Trigger')) {
                  finalResult = inputData;
                } else if (nodeCategory === 'Lógica') {
                  if (nodeTitle.includes('Código') || nodeTitle.includes('Script')) {
                      const code = node.data?.code || 'return input;';
                      const fn = new Function('input', `return (async () => { ${code} })();`);
                      finalResult = await fn(inputData);
                  } else {
                      finalResult = inputData;
                  }
                } else if (nodeTitle.includes('HTTP Request') || nodeTitle.includes('Webhook')) {
                  const method = node.data?.httpMethod || 'GET';
                  const url = node.data?.httpUrl;
                  if (url) {
                    const options: RequestInit = { method };
                    if (method !== 'GET' && method !== 'HEAD' && inputData) {
                        options.headers = { 'Content-Type': 'application/json' };
                        options.body = typeof inputData === 'string' ? inputData : JSON.stringify(inputData);
                    }
                    const res = await fetch(url, options);
                    try {
                       finalResult = await res.json();
                    } catch (e) {
                       finalResult = await res.text();
                    }
                  }
                } else {
                   finalResult = inputData;
                }
              } catch (err: any) {
                console.error(`Error en nodo ${node.id}:`, err);
                finalResult = { error: err.message };
              }

              const logString = typeof finalResult === 'object' ? JSON.stringify(finalResult) : String(finalResult);
              executionLog.push({ nodeId: node.id, title: nodeTitle, result: logString });

              // Encontrar siguientes
              const outgoingEdges = edges.filter((e: any) => e.source === node.id);
              for (const edge of outgoingEdges) {
                const targetNode = nodes.find((n: any) => n.id === edge.target);
                if (targetNode) queue.push({ node: targetNode, inputData: finalResult });
              }
            }
            
            console.log(`✅ Flujo [${w.name}] completado.`);
            resultados.push({ name: w.name, log: executionLog });
        }
    }

    return new Response(JSON.stringify({ success: true, ejecutados, resultados }), {
      headers: { "Content-Type": "application/json" },
    });
    
  } catch (error: any) {
    console.error("Error fatal:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
