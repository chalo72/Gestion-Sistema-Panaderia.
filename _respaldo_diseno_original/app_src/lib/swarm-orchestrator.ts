import { consultarAgente } from '@/constants/agentes';
import type { AgenteId } from '@/types/agente-id';
import { db } from '@/lib/database';
import { getTareasPendientesHoyString } from '@/lib/checklists';

// ============================================================================
// 🧠 SWARM ORCHESTRATOR (J.A.R.V.I.S. NATIVE PORT)
// ============================================================================

export interface SwarmResponse {
  resultado: string;
  agentesUsados: string[];
}

/**
 * 1. Genera una Memoria Central (Contexto Global) para que todos los agentes
 *    vean la misma realidad de la Panadería al mismo tiempo.
 */
async function generarContextoGlobal(): Promise<string> {
  // Aquí recolectamos el estado de la panadería en tiempo real.
  const ventasHoy = await db.getAllVentas(); // Suponiendo que exista
  const gastosHoy = await db.getAllGastos(); // o similares
  const tareas = getTareasPendientesHoyString();

  return 
--- CONTEXTO GLOBAL DE DULCE PLACER ---
[VENTAS HOY]:  transacciones.
[GASTOS HOY]:  registrados.
[TAREAS PENDIENTES]:

---------------------------------------
  ;
}

/**
 * 2. NEXUS: El Cerebro Enrutador.
 * Ejecuta el enjambre, coordina los agentes necesarios y devuelve una síntesis.
 */
export async function ejecutarEnjambre(
  promptUsuario: string,
  onStatusUpdate: (status: string) => void
): Promise<SwarmResponse> {
  
  onStatusUpdate('[NEXUS] Analizando petición del Director...');
  const contexto = await generarContextoGlobal();

  // Fase 1: NEXUS decide qué agentes invocar (Simulado con un enrutamiento rápido)
  // En una versión más avanzada, NEXUS le pregunta a la IA qué agentes usar.
  // Por ahora, detectamos palabras clave para invocar al Escuadrón.
  const agentesActivos: AgenteId[] = [];
  const p = promptUsuario.toLowerCase();

  if (p.includes('venta') || p.includes('caja') || p.includes('dinero') || p.includes('cierre')) {
    agentesActivos.push('tax');
    agentesActivos.push('ventas');
  }
  if (p.includes('cámara') || p.includes('emplead') || p.includes('robo') || p.includes('falta')) {
    agentesActivos.push('odysseus');
  }
  if (p.includes('margen') || p.includes('costo') || p.includes('precio') || p.includes('ganancia')) {
    agentesActivos.push('pico-claw');
  }
  if (p.includes('sincroniz') || p.includes('internet') || p.includes('offline') || p.includes('error')) {
    agentesActivos.push('open-claw');
  }
  if (p.includes('voz') || p.includes('comunic') || p.includes('mensaje')) {
    agentesActivos.push('hermes');
  }

  // Si no detectó nada específico, usamos a Arqui-Tech como analista general
  if (agentesActivos.length === 0) {
    agentesActivos.push('arqui-tech');
  }

  onStatusUpdate([NEXUS] Escuadrón activado: );

  // Fase 2: Cross-Talk (Ejecución en paralelo de los agentes)
  const promesas = agentesActivos.map(async (agente) => {
    onStatusUpdate([] Procesando datos locales...);
    const respuesta = await consultarAgente(
      agente, 
      promptUsuario, 
      () => {}, // Silenciamos el chunk individual para no ensuciar la UI
      undefined, 
      contexto
    );
    return { agente, respuesta };
  });

  const resultados = await Promise.all(promesas);

  // Fase 3: NEXUS Sintetiza
  onStatusUpdate('[NEXUS] Consolidando reportes del enjambre...');
  
  let sintesisFinal = 🎯 **REPORTE DEL ENJAMBRE (NEXUS)**\n\n;
  resultados.forEach(r => {
    sintesisFinal += ### 🤖 \n\n\n;
  });

  onStatusUpdate('✨ ¡Procesamiento completado!');

  return {
    resultado: sintesisFinal,
    agentesUsados: agentesActivos
  };
}
