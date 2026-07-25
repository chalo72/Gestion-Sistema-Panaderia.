import Anthropic from '@anthropic-ai/sdk';

export const config = { runtime: 'edge' };

// ── System prompts del Holding Dulce Placer (20 Agentes) ─────────────────────
const PROMPTS: Record<string, string> = {

  gerente: `Eres **NEXUS-VOLT**, el Orquestador Supremo de Inteligencia Artificial (basado en el Ecosistema Nexus Core v5.0).
  Superior: **Director General** (quien te habla).
  
  Identidad: Ya no eres solo un gerente básico, eres una IA avanzada con memoria persistente (Engram), escudo de telemetría y protocolos de Antigravity.
  Tono: Natural, conversacional, amigable pero brillante. Habla como un colega avanzado y de confianza, NO como un robot frío entregando un informe militar.
  Misión: Orquestar a los especialistas para resolver problemas técnicos, operativos o crear estrategias maestras.
  
  Especialistas a tu mando:
  - **produccion|inventario|logistica|mantenimiento|calidad|sostenibilidad|contable**
  - **expansion|inversion|creditos|subvenciones|abogado|tax**
  - **marketing|clientes|pitch|nomina|ventas|influencer**
  - **pico-claw|open-claw|auto-claw|hermes|odysseus|vigia-app|arqui-tech**

  Formato obligatorio: Responde SIEMPRE con este JSON:
  {
    "razonamiento": "Piensa tu estrategia en silencio aquí.",
    "respuesta_natural": "Tu respuesta en formato CHAT cara a cara. OBLIGATORIO: Si vas a delegar tareas, EXPLICAR DETALLADAMENTE AL DIRECTOR: 1) QUÉ agente lo hará. 2) CÓMO lo va a hacer. 3) DÓNDE lo va a hacer (qué parte del sistema). 4) PARA QUÉ (el por qué y la mejora esperada). Usa un lenguaje natural, directo, sin sonar como un robot, pero dale toda esa visibilidad.",
    "plan": [
      { "agente": "id_del_agente", "tarea": "Instrucción exacta para el agente en segundo plano" }
    ]
  }
  Responde ÚNICAMENTE el JSON sin formateos raros. Si no necesitas agentes adicionales, el plan puede estar vacío.`,

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

  hermes: `Eres **HERMES**, el Agente de Vigilancia de Comportamiento e Interacciones (UX/UI y Ventas).
  Tu misión es monitorear qué hace el personal en la app, ayudar a los vendedores a facturar rápido dictando órdenes por voz y alertar de deudores fugitivos que entran al local.
  Analiza las comandas dictadas y tradúcelas a un borrador estructurado de productos.
  Tu tono es servicial, ágil y de alerta activa.`,

  odysseus: `Eres **ODYSSEUS**, el Copiloto Administrativo del Negocio (Estrategia, Proveedores y Finanzas).
  Tu misión es supervisar el correcto funcionamiento de la panadería, recordar pedidos a proveedores, auditar la contabilidad (conciliación de cajas, créditos y gastos) y documentar desfalcos o cobros no registrados.
  Tu tono es profesional, analítico y estratégico.`,
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  
  const { tipo, mensaje, imagen, soberania, aiMode, contexto } = await req.json() as {
    tipo: string;
    mensaje: string;
    imagen?: string;
    aiMode?: 'local' | 'hybrid' | 'off';
    contexto?: string; // Datos reales del negocio inyectados desde la app
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

  // Inyectar datos reales del negocio si vienen del frontend
  if (contexto) {
    systemPrompt += `\n\n=== DATOS REALES DEL NEGOCIO HOY (${new Date().toLocaleDateString('es-CO')}) ===\n${contexto}\n=== FIN DE DATOS ===\n\nAnáliza los datos anteriores para responder con información precisa y real del negocio. No inventes cifras.`;
  }

  if (!PROMPTS[tipo] && !soberania) return new Response('Agente desconocido', { status: 400 });

  // 2. CONFIGURACIÓN DE PROVEEDORES (TRIPLE-HÍBRIDO)
  const PRIMARY_PROVIDER = process.env.AI_PRIMARY_PROVIDER || 'ollama';
  const OLLAMA_TEXT = process.env.OLLAMA_MODEL_TEXT || 'llama3.2';
  const OLLAMA_VISION = process.env.OLLAMA_MODEL_VISION || 'llama3.2-vision';
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  const OPENAI_KEY = process.env.OPENAI_API_KEY;

  const providers = [];
  if (aiMode === 'local') {
    providers.push('ollama');
  } else {
    // Add available providers
    if (PRIMARY_PROVIDER === 'ollama') {
      providers.push('ollama');
      if (OPENAI_KEY) providers.push('openai');
      if (ANTHROPIC_KEY && ANTHROPIC_KEY !== "sk-ant-xxx") providers.push('anthropic');
    } else {
      if (OPENAI_KEY) providers.push('openai');
      if (ANTHROPIC_KEY && ANTHROPIC_KEY !== "sk-ant-xxx") providers.push('anthropic');
      providers.push('ollama');
    }
  }

  // Intentar con los proveedores en orden
  for (const provider of providers) {
    try {
      if (provider === 'openai' && OPENAI_KEY) {
        // Standard OpenAI-compatible API call (works for OpenAI, DeepSeek, Together, etc)
        return await handleOpenAI(OPENAI_KEY, tipo, mensaje, imagen, systemPrompt);
      }
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

async function handleOpenAI(apiKey: string, tipo: string, mensaje: string, imagen: string | undefined, systemPrompt: string) {
  const isGroq = apiKey.startsWith('gsk_');
  const isDeepSeek = apiKey.length === 32 && !apiKey.startsWith('sk-proj-') && !isGroq;

  let model = ['gerente', 'pico-claw', 'open-claw', 'auto-claw'].includes(tipo)
    ? (isGroq ? 'llama-3.3-70b-versatile' : 'gpt-4o')
    : (isGroq ? 'llama-3.1-8b-instant' : 'gpt-4o-mini');

  const actualModel = isDeepSeek ? 'deepseek-chat' : model;
  
  const baseUrl = isDeepSeek 
    ? 'https://api.deepseek.com/chat/completions' 
    : isGroq 
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';

  const content: any[] = [{ type: 'text', text: mensaje }];
  if (imagen && !isDeepSeek && !isGroq) { // DeepSeek/Groq text models might not support vision via this exact format
    content.push({
      type: 'image_url',
      image_url: { url: imagen.includes(',') ? imagen : `data:image/jpeg;base64,${imagen}` }
    });
  }

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: actualModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content }
      ],
      stream: true,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) throw new Error(`OpenAI/DeepSeek error: ${response.statusText}`);

  const reader = response.body!.getReader();
  const decoder = new TextDecoder('utf-8');

  const readable = new ReadableStream({
    async start(controller) {
      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep the last incomplete line in the buffer
          
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('data: ')) {
              const data = trimmedLine.slice(6);
              if (data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                const text = parsed.choices[0]?.delta?.content || '';
                if (text) {
                  controller.enqueue(new TextEncoder().encode(text));
                }
              } catch (e) {
                console.error("Error parsing chunk:", data);
              }
            }
          }
        }
        controller.close();
      } catch (e) { controller.error(e); }
    },
  });

  return new Response(readable, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
