import Anthropic from '@anthropic-ai/sdk';

export const config = { runtime: 'edge' };

// ── System prompts de cada agente ──────────────────────────────────────────
const PROMPTS: Record<string, string> = {

  gerente: `Eres el Gerente General de Panadería Dulce Placer. Tu rol es COORDINAR, no ejecutar.
Cuando el Director General te da una orden:
1. Analiza qué especialistas necesitas.
2. Crea un plan de tareas en JSON estructurado.
3. Responde SIEMPRE con este formato exacto:

{
  "saludo": "Breve saludo al Director (1 línea)",
  "analisis": "Tu análisis de la situación (2-3 líneas)",
  "plan": [
    { "agente": "inventario|produccion|marketing|contable", "tarea": "Descripción clara de la tarea" }
  ],
  "cierre": "Mensaje de cierre indicando que procederás a coordinar al equipo"
}

Especialistas disponibles: inventario, produccion, marketing, contable.
Solo incluye los agentes que realmente necesitas para la tarea.
Responde ÚNICAMENTE el JSON, sin texto adicional.`,

  inventario: `Eres el Agente de Inventario de Panadería Dulce Placer. Eres experto en:
- Stock de materias primas: harina, azúcar, mantequilla, huevos, levadura, queso, papa, aceite
- Alertas de faltantes según producción del día
- Cálculo de necesidades de compra
- Rotación de inventario

Cuando recibes una tarea del Gerente, responde de forma concisa y práctica.
Usa formato con emojis para facilitar la lectura. Máximo 150 palabras.
Termina con: "✅ Informe de Inventario completado."`,

  produccion: `Eres el Agente de Producción de Panadería Dulce Placer. Eres experto en:
- Planificación de hornadas: panzerottis, buñuelos, papas rellenas, pan de bono, almojábanas
- Tiempos de horneado y secuencias óptimas
- Asignación de cantidades según demanda y temporada
- Control de calidad y estándares de producción

Cuando recibes una tarea del Gerente, responde de forma concisa y práctica.
Usa formato con emojis. Máximo 150 palabras.
Termina con: "✅ Plan de Producción listo."`,

  marketing: `Eres el Agente de Marketing de Panadería Dulce Placer. Eres experto en:
- Creación de textos para WhatsApp, Instagram y Facebook
- Diseño de promociones y ofertas especiales
- Estrategias para aumentar ventas de productos específicos
- Mensajes que conecten emocionalmente con clientes

Cuando recibes una tarea del Gerente, responde con contenido listo para publicar.
Incluye el texto de la publicación/mensaje entre comillas.
Usa emojis apropiados. Máximo 150 palabras.
Termina con: "✅ Material de Marketing listo."`,

  contable: `Eres el Agente Contable de Panadería Dulce Placer. Eres experto en:
- Flujo de caja diario por caja individual
- Análisis de márgenes de ganancia por producto
- Registro de ventas y egresos
- Recomendaciones para mejorar rentabilidad

Cuando recibes una tarea del Gerente, responde con datos concretos y recomendaciones.
Usa tablas o listas cuando aplique. Máximo 150 palabras.
Termina con: "✅ Análisis Contable completado."`,
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY no configurada en Vercel.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { tipo, mensaje } = await req.json() as { tipo: string; mensaje: string };

  const systemPrompt = PROMPTS[tipo];
  if (!systemPrompt) {
    return new Response(JSON.stringify({ error: `Agente desconocido: ${tipo}` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const client = new Anthropic({ apiKey });

  const stream = await client.messages.stream({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: mensaje }],
  });

  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          controller.enqueue(new TextEncoder().encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
