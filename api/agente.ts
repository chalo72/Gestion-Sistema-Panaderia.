import Anthropic from '@anthropic-ai/sdk';

export const config = { runtime: 'edge' };

// ── System prompts del Holding Dulce Placer (20 Agentes) ─────────────────────
const PROMPTS: Record<string, string> = {

  gerente: `Eres **NEXUS-VOLT**, Gerente General del Holding Dulce Placer.
  Superior: **Director General**.
  
  Misión: Orquestar a los 19 especialistas para dominar el mercado (Panadería, Heladería).
  
  Especialistas a tu mando:
  - **produccion|inventario|logistica|mantenimiento|calidad|sostenibilidad|contable**
  - **expansion|inversion|creditos|subvenciones|abogado|tax**
  - **marketing|clientes|pitch|nomina|ventas|influencer**

  Formato obligatorio: Responde SIEMPRE con este JSON:
  {
    "saludo": "Saludo ejecutivo estratégico",
    "analisis": "Análisis corporativo de 2 líneas",
    "plan": [
      { "agente": "id_del_agente", "tarea": "Instrucción táctica precisa" }
    ],
    "cierre": "Compromiso de mando"
  }
  Responde ÚNICAMENTE el JSON.`,

  // --- División Operativa ---
  produccion: `Jefe de Producción. Misión: Estandarizar horneado y sabores.`,
  inventario: `Especialista de Inventario. Misión: Control de stocks y alertas críticas.`,
  logistica: `Coordinador de Logística. Misión: Rutas de reparto eficientes.`,
  mantenimiento: `Jefe de Mantenimiento. Misión: Cuidado preventivo de maquinaria y equipos.`,
  calidad: `Auditor de Calidad. Misión: Garantizar higiene y receta maestra.`,
  sostenibilidad: `Especialista en Mermas. Misión: Reducir desperdicios operativos.`,

  // --- División Estratégica & Legal ---
  contable: `Auditor Interno. Misión: Conciliar cajas y flujo del Banco Interno.`,
  tax: `Contador de Impuestos. Misión: Gestión fiscal, balances y cumplimiento DIAN.`,
  abogado: `Abogado Corporativo. Misión: Contratos, leyes laborales y blindaje legal.`,
  inversion: `Analista de Inversión. Misión: Reinvertir excedentes estratégicamente.`,
  creditos: `Negociador de Créditos. Misión: Conseguir financiación bancaria óptima.`,
  subvenciones: `Cazador de Fondos. Misión: Encontrar dinero no reembolsable.`,
  expansion: `Director de Expansión. Misión: Apertura de nuevas sedes y sucursales.`,

  // --- División de Crecimiento & PR ---
  marketing: `Director de Marketing. Misión: Aumentar visibilidad de marca.`,
  influencer: `Gestor de Influencers/PR. Misión: Alianzas con creadores de contenido.`,
  ventas: `Especialista en Ventas Élite. Misión: Cierre de negocios B2B y preventa.`,
  clientes: `Gestor de Fidelización. Misión: Convertir clientes en fans (PQR).`,
  pitch: `Arquitecto de Pitch. Misión: Crear ideas ganadoras para convocatorias.`,
  nomina: `Gestor de RR.HH. Misión: Clima laboral y gestión de personal humano.`,

  // === TRILOGÍA CLAW (Agentes de Élite) ===
  'pico-claw': `Eres **PICO-CLAW**, el Auditor Forense Jefe y Analista de Datos del Holding Dulce Placer.
  Tu misión es la **Vigilancia de Márgenes** y la detección de fugas de dinero.
  Contexto táctico: El sistema opera con +50 productos y +10 proveedores. 
  Debes alertar si los precios de costo (harina, azúcar, paca) suben sin un ajuste correlativo en el precio de venta.
  Tu lenguaje es técnico, financiero y autoritario.`,

  'open-claw': `Eres **OPEN-CLAW**, el Arquitecto de Sistemas e Infraestructura.
  Tu misión es garantizar la **Inviolabilidad de la Persistencia** y la salud de los servidores.
  Contexto táctico: El sistema usa una arquitectura híbrida (Multi-Layer) con IndexedDB y Supabase.
  Debes asegurar que el Protocolo Sentinel (Tombstones) esté operando para evitar 'resurrección' de datos borrados.
  Tu lenguaje es técnico, estructurado y enfocado en seguridad.`,

  'auto-claw': `Eres **AUTO-CLAW**, el Estratega de Crecimiento y Automatización.
  Tu misión es encontrar **Palancas de Escalamiento** y automatizar tareas repetitivas.
  Contexto táctico: El Holding busca expandirse a 5 sedes en Montería.
  Debes proponer flujos de trabajo autónomos (agentes, bots, integraciones) que eliminen la carga operativa del Director General.
  Tu lenguaje es visionario, innovador y enfocado en el crecimiento exponencial.`,
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  
  const { tipo, mensaje, imagen, soberania, aiMode } = await req.json() as { 
    tipo: string; 
    mensaje: string;
    imagen?: string; // Base64
    aiMode?: 'local' | 'hybrid' | 'off';
    soberania?: { 
      directiva?: string; 
      restricciones?: string[]; 
      conocimiento?: string;
      autonomia?: number;
    }
  };

  // 1. INTERRUPTOR DE EMERGENCIA (KILL SWITCH)
  if (aiMode === 'off') {
    return new Response('AI_DISABLED: El Interruptor de Emergencia está activado. Todas las funciones de IA están suspendidas.', { status: 503 });
  }

  let systemPrompt = PROMPTS[tipo] || `Eres un experto en ${tipo} del Holding Dulce Placer.`;
  
  if (soberania) {
    let soberaniaPrompt = "\n\n=== DIRECTIVAS SUPREMAS DEL DIRECTOR GENERAL ===\n";
    if (soberania.directiva) soberaniaPrompt += `DIRECTIVA PRIMARIA: ${soberania.directiva}\n`;
    if (soberania.restricciones?.length) soberaniaPrompt += `RESTRICCIONES ABSOLUTAS: ${soberania.restricciones.join(', ')}\n`;
    if (soberania.conocimiento) soberaniaPrompt += `\nCÁMARA DE CONOCIMIENTO (CONTEXTO ESPECÍFICO):\n${soberania.conocimiento}\n`;
    soberaniaPrompt += `NIVEL DE AUTONOMÍA: ${soberania.autonomia || 50}/100\n`;
    soberaniaPrompt += "===============================================\n\n";
    systemPrompt = soberaniaPrompt + systemPrompt;
  }

  if (!PROMPTS[tipo] && !soberania) return new Response('Agente desconocido', { status: 400 });

  // 2. CONFIGURACIÓN DE PROVEEDORES (TRIPLE-HÍBRIDO)
  const PRIMARY_PROVIDER = process.env.AI_PRIMARY_PROVIDER || 'ollama';
  const OLLAMA_TEXT = process.env.OLLAMA_MODEL_TEXT || 'llama3.2';
  const OLLAMA_VISION = process.env.OLLAMA_MODEL_VISION || 'llama3.2-vision';
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

  const providers = [];
  if (aiMode === 'local') {
    providers.push('ollama');
  } else {
    if (PRIMARY_PROVIDER === 'ollama') {
      providers.push('ollama', 'anthropic');
    } else {
      providers.push('anthropic', 'ollama');
    }
  }

  // Intentar con los proveedores en orden
  for (const provider of providers) {
    try {
      if (provider === 'anthropic' && ANTHROPIC_KEY && ANTHROPIC_KEY !== "sk-ant-xxx") {
        return await handleAnthropic(ANTHROPIC_KEY, tipo, mensaje, imagen, systemPrompt);
      }
      if (provider === 'ollama') {
        const model = imagen ? OLLAMA_VISION : OLLAMA_TEXT;
        return await handleOllama(model, mensaje, imagen, systemPrompt);
      }
    } catch (err) {
      console.error(`Error con proveedor ${provider}, intentando siguiente...`, err);
      continue;
    }
  }

  return new Response(JSON.stringify({ error: 'No hay proveedores de IA disponibles o todos fallaron.' }), { status: 500 });
}

async function handleAnthropic(apiKey: string, tipo: string, mensaje: string, imagen: string | undefined, systemPrompt: string) {
  const client = new Anthropic({ apiKey });
  const model = ['gerente', 'pico-claw', 'open-claw', 'auto-claw'].includes(tipo)
    ? 'claude-3-5-sonnet-latest'
    : 'claude-3-5-haiku-latest';

  const content: any[] = [{ type: 'text', text: mensaje }];
  if (imagen) {
    const base64Data = (imagen.includes(',') ? imagen.split(',')[1] : imagen);
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: base64Data },
    });
  }

  const stream = await client.messages.stream({
    model,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content }],
  });

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(new TextEncoder().encode(chunk.delta.text));
          }
        }
        controller.close();
      } catch (e) { controller.error(e); }
    },
  });
  return new Response(readable, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

async function handleOllama(model: string, mensaje: string, imagen: string | undefined, systemPrompt: string) {
  const oMessage: any = { role: 'user', content: mensaje };
  if (imagen) {
    oMessage.images = [(imagen.includes(',') ? imagen.split(',')[1] : imagen)];
  }

  const response = await fetch("http://localhost:11434/api/chat", {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        oMessage
      ],
      stream: true,
    }),
  });

  if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(l => l.trim());
          for (const line of lines) {
            try {
              const json = JSON.parse(line);
              if (json.message?.content) {
                controller.enqueue(new TextEncoder().encode(json.message.content));
              }
            } catch (e) {}
          }
        }
        controller.close();
      } catch (e) { controller.error(e); }
    }
  });

  return new Response(readable, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
