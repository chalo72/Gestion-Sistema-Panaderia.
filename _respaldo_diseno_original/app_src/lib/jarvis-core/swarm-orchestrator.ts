import { consultarAgente } from '@/constants/agentes';
import type { AgenteId } from '@/types/agente-id';
import { getTareasPendientesHoyString } from '@/lib/checklists';

export interface SwarmResponse {
  sintesisNexus: string;
  agentesUsados: string[];
}

async function invocarEcho_SnapshotGlobal(db: any): Promise<string> {
  const ventasHoy = await db.getAllVentas();
  const gastosHoy = await db.getAllGastos();
  const tareas = getTareasPendientesHoyString();

  return `
--- CORE MEMORY (ECHO) - SNAPSHOT DE DULCE PLACER ---
[FECHA]: ${new Date().toLocaleString()}
[VENTAS REGISTRADAS]: ${ventasHoy?.length || 0}
[GASTOS REGISTRADOS]: ${gastosHoy?.length || 0}
[CHECKLISTS PENDIENTES]:
${tareas}
-----------------------------------------------------
  `;
}

export async function ejecutarSwarmJarvis(
  promptDirector: string,
  onLog: (msg: string) => void,
  dbInstance: any
): Promise<SwarmResponse> {
  
  onLog('[NEXUS] Analizando petición del Director...');
  
  onLog('[ECHO] Recuperando Snapshot de la base de datos...');
  const memoriaGlobal = await invocarEcho_SnapshotGlobal(dbInstance);

  const nodosActivos: Set<AgenteId> = new Set();
  const p = promptDirector.toLowerCase();

  if (p.includes('venta') || p.includes('dinero') || p.includes('caja')) nodosActivos.add('contable' as AgenteId);
  if (p.includes('margen') || p.includes('costo') || p.includes('ganancia')) nodosActivos.add('pico-claw' as AgenteId);
  if (p.includes('emplead') || p.includes('rob') || p.includes('cámara')) nodosActivos.add('odysseus' as AgenteId);
  if (p.includes('internet') || p.includes('sync') || p.includes('offline')) nodosActivos.add('open-claw' as AgenteId);
  if (p.includes('habla') || p.includes('voz') || p.includes('mensaje')) nodosActivos.add('hermes' as AgenteId);
  if (p.includes('inventario') || p.includes('harina') || p.includes('stock')) nodosActivos.add('inventario' as AgenteId);
  
  if (nodosActivos.size === 0) {
    nodosActivos.add('arqui-tech' as AgenteId);
  }

  const arrayNodos = Array.from(nodosActivos);
  onLog(`[NEXUS] Nodos requeridos: ${arrayNodos.map(n => n.toUpperCase()).join(', ')}`);

  const promesas = arrayNodos.map(async (nodo) => {
    onLog(`[${nodo.toUpperCase()}] Analizando datos...`);
    const respuesta = await consultarAgente(
      nodo,
      promptDirector,
      () => {},
      undefined,
      memoriaGlobal
    );
    return { nodo, respuesta };
  });

  const resultados = await Promise.all(promesas);

  onLog('[NEXUS] Unificando reportes de los nodos...');
  
  let reporteFinal = `🎯 **REPORTE EJECUTIVO (J.A.R.V.I.S.)**\n\n`;
  resultados.forEach(r => {
    reporteFinal += `### 🤖 ${r.nodo.toUpperCase()}\n${r.respuesta}\n\n`;
  });

  onLog('✨ [JARVIS] Procesamiento completado.');

  return {
    sintesisNexus: reporteFinal,
    agentesUsados: arrayNodos
  };
}
