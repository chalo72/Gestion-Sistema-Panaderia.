import { useEffect, useRef } from 'react';
import { db } from '@/lib/database';
import { consultarAgente } from '@/constants/agentes';
import type { DBMisionAgent, DBHallazgoAgente } from '@/lib/database';
import { toast } from 'sonner';

/**
 * AgenteMissionDispatcher (v1.0.1 - NEXUS CORE + EAGLE EYES 🦅👁️)
 * Componente autónomo que orquesta la ejecución de misiones en segundo plano.
 * Transforma a PICO-CLAW, OPEN-CLAW y AUTO-CLAW en centinelas activos con visión.
 */
export function AgentMissionDispatcher() {
    const isRunning = useRef(false);

    useEffect(() => {
        // Inicializar misiones por defecto si no existen
        const initMisiones = async () => {
            const existentes = await db.getAgenteMisiones('pico-claw');
            if (existentes.length === 0) {
                console.log("🦅 [Dispatcher] Inicializando misiones primordiales para PICO-CLAW...");
                
                // Misión 1: Auditoría Financiera
                await db.saveAgenteMision({
                    id: 'mision-primordial-pico',
                    agenteId: 'pico-claw',
                    creadaPor: 'sistema',
                    misionExplicita: 'Vigilar márgenes de utilidad de productos de panadería y detectar stock bajo o inconsistencias en precios de proveedores.',
                    frecuencia: '5min',
                    estado: 'espera',
                    ultimaEjecucion: new Date(0).toISOString(),
                    proximaEjecucion: new Date().toISOString(),
                    metadata: { tipo: 'autónoma' }
                });

                // Misión 2: Shadowing Visual (Aprendizaje)
                await db.saveAgenteMision({
                    id: 'mision-shadowing-pico',
                    agenteId: 'pico-claw',
                    creadaPor: 'sistema',
                    misionExplicita: 'Observar visualmente cómo los trabajadores usan la aplicación. Identificar posibles errores operativos, lentitud en procesos o áreas donde el sistema podría ser más intuitivo para apoyarlos.',
                    frecuencia: '1h',
                    estado: 'espera',
                    ultimaEjecucion: new Date(0).toISOString(),
                    proximaEjecucion: new Date(Date.now() + 60000).toISOString(),
                    metadata: { tipo: 'visual-learning' }
                });
            }
        };

        initMisiones();

        // Ciclo de patrullaje cada 2 minutos
        const interval = setInterval(patrullarMisiones, 120000);
        
        // Primera patrulla tras 30 segundos
        const initialTimeout = setTimeout(patrullarMisiones, 30000);

        return () => {
            clearInterval(interval);
            clearTimeout(initialTimeout);
        };
    }, []);

    const patrullarMisiones = async () => {
        if (isRunning.current) return;
        isRunning.current = true;

        try {
            const misiones = await db.getAgenteMisiones();
            const ahora = new Date().toISOString();

            const misionesPendientes = misiones.filter(m => 
                m.estado === 'espera' && m.proximaEjecucion <= ahora
            );

            for (const mision of misionesPendientes) {
                await ejecutarMision(mision);
            }
        } catch (error) {
            console.error('❌ [Dispatcher] Error en patrulla:', error);
        } finally {
            isRunning.current = false;
        }
    };

    const ejecutarMision = async (mision: DBMisionAgent) => {
        console.log(`🦅 [Dispatcher] Ejecutando misión: ${mision.misionExplicita} para ${mision.agenteId}`);
        
        try {
            await db.saveAgenteMision({ ...mision, estado: 'ejecutando' });

            const productos = await db.getAllProductos();
            const inventario = await db.getAllInventario();
            const facturas = await db.getAllFacturasEscaneadas();
            
            // --- PROTOCOLO: MEMORIA PROFUNDA (Engram Sync) ---
            const hallazgosPrevios = await db.getAgenteHallazgos(5);
            const engramas = hallazgosPrevios
                .filter(h => h.agenteId === mision.agenteId)
                .map(h => `- [${h.fecha}] ${h.titulo}: ${h.descripcion.substring(0, 100)}...`)
                .join('\n');

            const contexto = `
                SITUACIÓN ACTUAL DEL NEGOCIO:
                - Productos en catálogo: ${productos.length}
                - Ítems en inventario: ${inventario.length}
                - Alertas de stock crítico: ${inventario.filter(i => i.stockActual <= i.stockMinimo).length}
                - Facturas procesadas hoy: ${facturas.filter(f => f.fechaEscaneo.startsWith(new Date().toISOString().split('T')[0])).length}

                HISTORIAL DE INTELIGENCIA (ENGRAMAS):
                ${engramas || 'No hay hallazgos previos registrados.'}
            `;

            // 3. Consultar al Agente (PICO-CLAW / OPEN-CLAW / AUTO-CLAW)
            const imagen = (window as any).__LAST_PICO_VISION__;
            
            const promptMision = `
                MISIÓN ASIGNADA: ${mision.misionExplicita}
                ${contexto}
                
                ${imagen ? 'OBSERVACIÓN VISUAL: Se adjunta una captura de pantalla del estado actual de la aplicación que están usando los trabajadores. Úsala para aprender sus procesos y detectar errores visuales o de flujo.' : ''}

                Analiza los datos ${imagen ? 'y la imagen ' : ''}y genera un HALLAZGO (Finding) siguiendo estrictamente este formato JSON:
                {
                    "titulo": "Título corto y táctico",
                    "descripcion": "Análisis profundo de la situación detectada",
                    "gravedad": "critica|alta|media|baja|info",
                    "tipo": "visual|financiero|operativo|alerta"
                }
                Si no hay nada relevante que reportar, responde con un JSON vacío {} o indica que todo está bajo control.
            `;

            const respuestaRaw = await consultarAgente(mision.agenteId, promptMision, () => {}, imagen);
            
            try {
                const jsonMatch = respuestaRaw.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const hallazgoData = JSON.parse(jsonMatch[0]);
                    
                    if (hallazgoData.titulo) {
                        // --- PROTOCOLO: JUICIO ADVERSARIO (Judgment Day) ---
                        const promptCritica = `
                            ACTÚA COMO JUEZ ADVERSARIO:
                            Acabas de generar este hallazgo: "${hallazgoData.titulo}: ${hallazgoData.descripcion}".
                            
                            Critica este hallazgo basándote en los datos:
                            - ¿Es realmente una alerta válida o podría ser un error de interpretación?
                            - ¿Hay algún dato que contradiga este hallazgo?
                            
                            Responde estrictamente con un JSON:
                            {
                                "esValido": true/false,
                                "refinamiento": "Versión corregida del hallazgo si es necesario",
                                "justificacion": "Por qué es válido o por qué se descarta"
                            }
                        `;

                        const respuestaCriticaRaw = await consultarAgente(mision.agenteId, promptCritica, () => {});
                        const criticaMatch = respuestaCriticaRaw.match(/\{[\s\S]*\}/);
                        
                        if (criticaMatch) {
                            const criticaData = JSON.parse(criticaMatch[0]);
                            
                            if (criticaData.esValido) {
                                // 4. Registrar Hallazgo Validado
                                const nuevoHallazgo: DBHallazgoAgente = {
                                    id: crypto.randomUUID(),
                                    agenteId: mision.agenteId,
                                    misionId: mision.id,
                                    tipo: hallazgoData.tipo || 'alerta',
                                    gravedad: hallazgoData.gravedad || 'info',
                                    titulo: criticaData.refinamiento || hallazgoData.titulo,
                                    descripcion: `${hallazgoData.descripcion}\n\n[VALIDACIÓN ADVERSARIA]: ${criticaData.justificacion}`,
                                    fecha: new Date().toISOString(),
                                    revisado: false,
                                    metadata: { validado: true }
                                };

                                await db.saveAgenteHallazgo(nuevoHallazgo);
                                
                                // Notificar al usuario (Solo si es grave)
                                if (['critica', 'alta'].includes(nuevoHallazgo.gravedad)) {
                                    toast.error(`AGENTE ${mision.agenteId.toUpperCase()} (VALIDADO): ${nuevoHallazgo.titulo}`, {
                                        description: nuevoHallazgo.descripcion,
                                        duration: 10000
                                    });
                                } else {
                                    toast.info(`Reporte Validado: ${nuevoHallazgo.titulo}`);
                                }
                            } else {
                                console.log(`🦅 [Judgment Day] Hallazgo descartado por baja fidelidad: ${hallazgoData.titulo}`);
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn(`⚠️ [Dispatcher] No se pudo parsear hallazgo de ${mision.agenteId}:`, respuestaRaw);
            }

            const proxima = calcularProximaEjecucion(mision.frecuencia);
            await db.saveAgenteMision({
                ...mision,
                estado: 'espera',
                ultimaEjecucion: new Date().toISOString(),
                proximaEjecucion: proxima
            });

        } catch (error) {
            console.error(`❌ [Dispatcher] Error ejecutando misión ${mision.id}:`, error);
            await db.saveAgenteMision({
                ...mision,
                estado: 'espera',
                proximaEjecucion: new Date(Date.now() + 300000).toISOString()
            });
        }
    };

    const calcularProximaEjecucion = (frecuencia: string): string => {
        const ahora = Date.now();
        switch (frecuencia) {
            case '5min': return new Date(ahora + 300000).toISOString();
            case '1h': return new Date(ahora + 3600000).toISOString();
            case 'diaria': return new Date(ahora + 86400000).toISOString();
            case 'semanal': return new Date(ahora + 604800000).toISOString();
            default: return new Date(ahora + 86400000).toISOString();
        }
    };

    return null;
}
