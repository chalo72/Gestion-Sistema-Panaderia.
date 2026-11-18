import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

console.log("Iniciando Cerebro Gerente (IA 24/7)...");

async function ejecutarCerebro() {
  console.log('Ejecutando análisis del Cerebro Gerente...');
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase credentials");
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    const fechaAyer = ayer.toISOString();

    const { data: ventas } = await supabase.from('ventas').select('total, fecha').gte('fecha', fechaAyer);
    const { data: gastos } = await supabase.from('gastos').select('monto, concepto, categoria').gte('fecha', fechaAyer);

    const totalVentas = (ventas || []).reduce((acc: number, v: any) => acc + (v.total || 0), 0);
    const totalGastos = (gastos || []).reduce((acc: number, g: any) => acc + (g.monto || 0), 0);

    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) {
      throw new Error("Falta GEMINI_API_KEY en los secretos de Supabase");
    }

    const promptText = `
Eres el Gerente General IA (Nivel 5) de la "Panadería Dulce Placer".
Tu trabajo es revisar los números diarios mientras el dueño duerme y generar hallazgos o alertas accionables.

Resumen de las últimas 24 horas:
- Ventas totales: $${totalVentas} COP
- Gastos totales: $${totalGastos} COP
- Detalle de gastos: ${(gastos || []).map((g: any) => g.concepto).join(', ')}

Genera un reporte corto de máximo 2 párrafos con:
1. Un análisis rápido del balance.
2. Una alerta o recomendación clara para hoy.
`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${geminiKey}`;
    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }]
      })
    });

    const geminiData = await geminiResponse.json();
    const iaInsight = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "No se pudo generar análisis.";

    const nuevoHallazgo = {
      id: crypto.randomUUID(),
      agente_id: 'gerente-ia',
      mision_id: 'cierre-diario',
      tipo: 'insight',
      gravedad: 'media',
      titulo: 'Corte Diario y Estrategia',
      descripcion: iaInsight,
      fecha: new Date().toISOString(),
      revisado: false
    };

    const { error: errInsert } = await supabase.from('agente_hallazgos').insert([nuevoHallazgo]);
    if (errInsert) {
      console.error("Error guardando el hallazgo:", errInsert);
      throw errInsert;
    }

    return new Response(JSON.stringify({ success: true, insight: iaInsight }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error en Cerebro Gerente:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
}

// 1. Ejecución Autónoma programada (Todos los días a las 11:59 PM hora Colombia / 4:59 AM UTC)
// Deno.cron usa horario UTC.
Deno.cron('Cierre Diario IA', '59 4 * * *', () => {
  ejecutarCerebro();
});

// 2. Ejecución Manual (Para cuando Gonzalo quiera forzar el análisis desde la app)
serve(async (req) => {
  return await ejecutarCerebro();
});
