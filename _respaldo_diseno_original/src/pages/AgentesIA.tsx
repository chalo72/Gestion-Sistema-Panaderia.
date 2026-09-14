import { useState, useRef, useEffect, useCallback } from 'react';
import {
  BrainCircuit, Mic, Zap, Shield, Eye, Cpu,
  Loader2, CheckCircle2, AlertTriangle, Activity,
  TrendingUp, Package, DollarSign, X, GitMerge, Trash2, Target, Utensils, ShoppingCart, MessageSquare, Truck, Users, Building, ClipboardList, Server
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { AGENTES_CONFIG as AGENTES, consultarAgente as llamarAgente } from '@/constants/agentes';
import type { AgenteId } from '@/constants/agentes';
import { AgentPanel } from '@/components/agentes/AgentPanel';
import { useCentinela } from '@/components/providers/CentinelaProvider';
import { VigiApp } from '@/components/agentes/VigiApp';
import { ArquiTech } from '@/components/agentes/ArquiTech';
import { ProtocolosArsenal } from '@/components/agentes/ProtocolosArsenal';
import { ConstructorNodos } from '@/components/agentes/ConstructorNodos';
import { BitacoraIA } from '@/components/agentes/BitacoraIA';
import { getIncidentes, getLogsActividad } from '@/lib/security-agent';
import { db } from '@/lib/database';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AsistenteVirtual } from '@/components/agentes/AsistenteVirtual';
import {
  cargarDatosCasas,
  contextoGerente,
  contextoParaAgente,
  esTareaSensible,
  capturarMemoriaDesdeRespuestaInventario,
  notificarTelemetriaOpcional,
  type DatosCasas,
} from '@/lib/agentes-casas';

type EstadoAgente = 'idle' | 'working' | 'done' | 'error' | 'blocked';
type PanelDerecho = 'bitacora' | 'vigia' | 'arquitech' | 'protocolos' | 'clientbot' | null;

interface TareaAgente {
  agente: AgenteId;
  tarea: string;
  respuesta?: string;
  estado: EstadoAgente;
  requiereAprobacion?: boolean;
}

interface SesionIA {
  id: number;
  comando: string;
  analisisGerente?: string;
  tareas: TareaAgente[];
  completado: boolean;
  timestamp: Date;
}

type PlanPendiente = {
  sesionId: number;
  plan: { agente: AgenteId; tarea: string }[];
  datos: DatosCasas;
  sensibles: { agente: AgenteId; tarea: string }[];
};

// Acciones rápidas conectadas al sistema real
const ACCIONES_RAPIDAS = [
  { label: 'Consejo Élite (Reporte 360)', icon: BrainCircuit, color: 'text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/10', prompt: 'Activa a tus agentes principales (Producción, Ventas, Inventario, Contable y Marketing). Necesito un análisis completo de 360 grados del estado actual de la panadería.' },
  { label: 'Revisar Caja del Día', icon: DollarSign, color: 'text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10', prompt: 'Delega SOLO al agente contable (Banco Interno). Con su casa (caja): ¿caja abierta?, ventas, gastos, métodos de pago y 3 acciones si algo no cuadra.' },
  { label: 'Stock Crítico', icon: Package, color: 'text-orange-400 border-orange-500/30 hover:bg-orange-500/10', prompt: 'Delega SOLO al agente inventario. Usa stock + memoria de faltantes previos. Lista críticos, pedido corto y 3 acciones. Números en nombres (40*30) son texto.' },
  { label: 'Horno / Producción', icon: Utensils, color: 'text-amber-200 border-amber-500/30 hover:bg-amber-500/10', prompt: 'Delega SOLO al agente produccion (Jefe de Horno). Con órdenes abiertas, formulaciones e insumos críticos: prioridad de horneado, riesgos y 3 acciones concretas.' },
  { label: 'Ventas del Día', icon: ShoppingCart, color: 'text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/10', prompt: 'Delega SOLO al agente ventas. Con tickets de hoy, ticket promedio, métodos de pago y top productos: ESTADO, TOP, PAGO y 3 ACCIONES para vender más en mostrador. No inventes cifras.' },
  { label: 'Hermes / Comanda', icon: MessageSquare, color: 'text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/10', prompt: 'Delega SOLO al agente hermes. Usa el top de productos del día como referencia y explícame cómo armar una comanda rápida por voz (ejemplo: dos pan de bono y una gaseosa). Formato ÍTEMS / NOTA / SIGUIENTE.' },
  { label: 'Compras / OC', icon: Truck, color: 'text-violet-400 border-violet-500/30 hover:bg-violet-500/10', prompt: 'Delega SOLO al agente logistica. Con proveedores, órdenes de compra abiertas, recepciones y faltantes: ESTADO, PRIORIDAD, PROVEEDOR sugerido y 3 ACCIONES (abrir Pre-Pedidos / crear OC / recibir). Pedidos grandes ≥$500.000 requieren mi confirmación.' },
  { label: 'Cartera Clientes', icon: Users, color: 'text-pink-400 border-pink-500/30 hover:bg-pink-500/10', prompt: 'Delega SOLO al agente clientes. Con el maestro de clientes: ESTADO, DESTACADOS y 3 ACCIONES de fidelización. Si hay fiados, remite a créditos sin inventar saldos.' },
  { label: 'Fiados / Deudas', icon: Building, color: 'text-blue-400 border-blue-500/30 hover:bg-blue-500/10', prompt: 'Delega SOLO al agente creditos. Con fiados activos: saldo pendiente, top deudores, vencidos y 3 ACCIONES de cobro. No inventes deudas. Borrar/anular requiere mi confirmación.' },
  { label: 'Nómina / Equipo', icon: ClipboardList, color: 'text-sky-400 border-sky-500/30 hover:bg-sky-500/10', prompt: 'Delega SOLO al agente nomina. Con trabajadores activos, roles, adelantos y nóminas recientes: ESTADO, EQUIPO, ADELANTOS y 3 ACCIONES. No inventes salarios. Cambios sensibles requieren mi confirmación.' },
  { label: 'Márgenes / Precios', icon: TrendingUp, color: 'text-rose-400 border-rose-500/30 hover:bg-rose-500/10', prompt: 'Delega SOLO al agente pico-claw. Con ventas/gastos del día y productos con markup < 15%: ESTADO, ALERTA y 3 ACCIONES. Usa markup (venta-costo)/costo. No inventes precios.' },
  { label: 'Salud Sistema', icon: Server, color: 'text-teal-400 border-teal-500/30 hover:bg-teal-500/10', prompt: 'Delega SOLO al agente open-claw. Con el resumen de sistema (online/offline, conteos, caja): ESTADO, RIESGO y 3 ACCIONES. Recuerda LOCAL SIEMPRE GANA, tombstones y que lo crítico es /api/agente.' },
  { label: 'Debate Márgenes', icon: TrendingUp, color: 'text-fuchsia-400 border-fuchsia-500/30 hover:bg-fuchsia-500/10', prompt: '__DEBATE_MARGENES__' },
  { label: 'Misión Larga (Meta)', icon: Target, color: 'text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10', prompt: '/meta (Goal Loop): Auditar toda la contabilidad del mes y proponer estrategias de ahorro. Ejecuta subtareas con los especialistas y repórtame cuando hayas logrado el objetivo completo.' },
];

/**
 * Escuadrón Élite — IDs reales de AgenteId (antes había ids inventados
 * como chef-bot/bank-bot que no existían y el menú los ocultaba).
 * Orden = ruta paso a paso por casa de la panadería.
 */
const ESCUADRON_ELITE: { id: AgenteId; descripcion: string; casa: string }[] = [
  { id: 'gerente', descripcion: 'Orquestador de Operaciones', casa: 'Centro de Mando' },
  { id: 'odysseus', descripcion: 'Centinela CCTV', casa: 'Videovigilancia' },
  { id: 'contable', descripcion: 'Auditor de Caja y Banco Interno', casa: 'Caja / Bóveda' },
  { id: 'inventario', descripcion: 'Control de stocks y faltantes', casa: 'Inventario' },
  { id: 'produccion', descripcion: 'Horno, hornadas y recetas', casa: 'Producción' },
  { id: 'ventas', descripcion: 'Ventas POS y B2B', casa: 'Ventas' },
  { id: 'hermes', descripcion: 'Comandas por voz y POS rápido', casa: 'Ventas / Voz' },
  { id: 'pico-claw', descripcion: 'Márgenes y fugas de dinero', casa: 'Precios / Márgenes' },
  { id: 'logistica', descripcion: 'Compras, rutas y proveedores', casa: 'Compras' },
  { id: 'clientes', descripcion: 'Fidelización y PQR', casa: 'Clientes' },
  { id: 'creditos', descripcion: 'Fiados y cobro a deudores', casa: 'Créditos' },
  { id: 'nomina', descripcion: 'Personal y turnos', casa: 'Nómina' },
  { id: 'open-claw', descripcion: 'Datos, sync y backups', casa: 'Sistemas' },
  { id: 'auto-claw', descripcion: 'Automatización y escala', casa: 'Sistemas' },
  { id: 'vigia-app', descripcion: 'Uso de módulos de la app', casa: 'Sistema' },
  { id: 'arqui-tech', descripcion: 'Salud de código y UI', casa: 'Sistema' },
];

export default function AgentesIA() {
  const [comando, setComando] = useState('');
  const [sesiones, setSesiones] = useState<SesionIA[]>(() => {
    try {
      const saved = localStorage.getItem('nexus_chat_history');
      if (saved) {
        return JSON.parse(saved).map((s: any) => ({ ...s, timestamp: new Date(s.timestamp) }));
      }
    } catch {}
    return [];
  });

  useEffect(() => {
    localStorage.setItem('nexus_chat_history', JSON.stringify(sesiones));
  }, [sesiones]);

  useEffect(() => {
    const handleStart = (e: any) => {
      const { comando, id } = e.detail;
      const nuevaSesion: SesionIA = { id, comando, tareas: [], completado: false, timestamp: new Date() };
      setSesiones(prev => [...prev, nuevaSesion]);
      setPanelDerecho('bitacora');
    };
    
    const handleEnd = () => {
      setSesiones(prev => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        return prev.map(s => s.id === last.id ? { ...s, completado: true } : s);
      });
    };

    const handleTask = (e: any) => {
      const { agente, tarea, estado, respuesta } = e.detail;
      setSesiones(prev => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        
        let tareas = [...last.tareas];
        const existingIdx = tareas.findIndex(t => t.agente === agente && t.tarea === tarea);
        
        if (existingIdx >= 0) {
          tareas[existingIdx] = { ...tareas[existingIdx], estado, respuesta: respuesta || tareas[existingIdx].respuesta };
        } else {
          tareas.push({ agente, tarea, estado, respuesta });
        }
        
        return prev.map(s => s.id === last.id ? { ...s, tareas } : s);
      });
    };

    window.addEventListener('nexus-engine-start', handleStart);
    window.addEventListener('nexus-engine-end', handleEnd);
    window.addEventListener('nexus-engine-task', handleTask);

    return () => {
      window.removeEventListener('nexus-engine-start', handleStart);
      window.removeEventListener('nexus-engine-end', handleEnd);
      window.removeEventListener('nexus-engine-task', handleTask);
    };
  }, []);
  const [ejecutando, setEjecutando] = useState(false);
  const [textoGerente, setTextoGerente] = useState('');
  const [agenteSeleccionado, setAgenteSeleccionado] = useState<AgenteId | null>(null);
  const [panelDerecho, setPanelDerecho] = useState<PanelDerecho>(null);
  const [showNodosModal, setShowNodosModal] = useState(false);
  const [aprobacionPendiente, setAprobacionPendiente] = useState<PlanPendiente | null>(null);
  const sesionIdRef = useRef(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const datosCasasRef = useRef<DatosCasas | null>(null);

  const { hallazgos, isVigilando } = useCentinela();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sesiones, textoGerente]);

  // ── Voice Recording (Web Speech API) ──
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  const toggleRecording = () => {
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Tu navegador no soporta reconocimiento de voz nativo.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'es-ES';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    
    recognition.onstart = () => {
      setIsRecording(true);
      toast.info('🎙️ Escuchando... Habla ahora');
    };
    
    recognition.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      setComando(p => p + (p ? ' ' : '') + text);
      toast.success('Voz transcrita');
    };
    
    recognition.onerror = (e: any) => {
      if (e.error !== 'aborted') toast.error(`Error de voz: ${e.error}`);
      setIsRecording(false);
    };
    
    recognition.onend = () => setIsRecording(false);
    
    recognition.start();
  };

  const ejecutarTareasPlan = useCallback(async (
    id: number,
    planItems: { agente: AgenteId; tarea: string }[],
    datos: DatosCasas,
    omitirSensiblesSinAprobar = true,
    marcarCompletado = true
  ) => {
    for (const { agente, tarea } of planItems) {
      if (omitirSensiblesSinAprobar && esTareaSensible(agente, tarea)) {
        setSesiones((prev) =>
          prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  tareas: s.tareas.map((t) =>
                    t.agente === agente && t.tarea === tarea
                      ? {
                          ...t,
                          estado: 'blocked' as EstadoAgente,
                          requiereAprobacion: true,
                          respuesta: '⏸ Esperando confirmación del Director (acción sensible).',
                        }
                      : t
                  ),
                }
              : s
          )
        );
        continue;
      }

      setSesiones((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                tareas: s.tareas.map((t) =>
                  t.agente === agente && t.tarea === tarea ? { ...t, estado: 'working' as EstadoAgente } : t
                ),
              }
            : s
        )
      );

      window.dispatchEvent(
        new CustomEvent('nexus-task', { detail: { agente, tarea, estado: 'working' } })
      );

      try {
        let agentResponse = '';
        const ctxCasa = contextoParaAgente(agente, datos);
        await llamarAgente(
          agente,
          tarea,
          (chunk) => {
            agentResponse += chunk;
            setSesiones((prev) =>
              prev.map((s) =>
                s.id === id
                  ? {
                      ...s,
                      tareas: s.tareas.map((t) =>
                        t.agente === agente && t.tarea === tarea
                          ? { ...t, respuesta: agentResponse }
                          : t
                      ),
                    }
                  : s
              )
            );
          },
          undefined,
          ctxCasa
        );

        if (agente === 'inventario') {
          capturarMemoriaDesdeRespuestaInventario(agentResponse);
        }

        setSesiones((prev) =>
          prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  tareas: s.tareas.map((t) =>
                    t.agente === agente && t.tarea === tarea
                      ? { ...t, estado: 'done' as EstadoAgente, respuesta: agentResponse }
                      : t
                  ),
                }
              : s
          )
        );

        window.dispatchEvent(
          new CustomEvent('nexus-task', {
            detail: { agente, tarea, estado: 'done', respuesta: 'Completado con éxito' },
          })
        );
      } catch {
        setSesiones((prev) =>
          prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  tareas: s.tareas.map((t) =>
                    t.agente === agente && t.tarea === tarea
                      ? {
                          ...t,
                          estado: 'error' as EstadoAgente,
                          respuesta: 'Error al procesar la tarea.',
                        }
                      : t
                  ),
                }
              : s
          )
        );
        window.dispatchEvent(
          new CustomEvent('nexus-task', {
            detail: { agente, tarea, estado: 'error', respuesta: 'Error al procesar' },
          })
        );
      }
    }

    if (marcarCompletado) {
      setSesiones((prev) => prev.map((s) => (s.id === id ? { ...s, completado: true } : s)));
    }
  }, []);

  /** Debate corto: Pico-Claw → Contable → Gerente resume (sin localhost). */
  const ejecutarDebateMargenes = async () => {
    if (ejecutando) return;
    const id = ++sesionIdRef.current;
    const comandoFinal = 'Debate márgenes: Pico-Claw alerta → Contable responde con caja → Gerente resume';
    setEjecutando(true);
    setTextoGerente('Iniciando debate corto…');
    setSesiones((prev) => [
      ...prev,
      {
        id,
        comando: comandoFinal,
        analisisGerente: 'Debate corto en 3 rondas (Pico-Claw → Contable → NEXUS-VOLT).',
        tareas: [
          { agente: 'pico-claw', tarea: 'Alertar márgenes / fugas', estado: 'idle' },
          { agente: 'contable', tarea: 'Responder con caja del día', estado: 'idle' },
          { agente: 'gerente', tarea: 'Resumir al Director', estado: 'idle' },
        ],
        completado: false,
        timestamp: new Date(),
      },
    ]);

    try {
      const datos = await cargarDatosCasas(db);
      datosCasasRef.current = datos;

      const updateTarea = (agente: AgenteId, patch: Partial<TareaAgente>) => {
        setSesiones((prev) =>
          prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  tareas: s.tareas.map((t) => (t.agente === agente ? { ...t, ...patch } : t)),
                }
              : s
          )
        );
      };

      updateTarea('pico-claw', { estado: 'working' });
      let pico = '';
      await llamarAgente(
        'pico-claw',
        'Con el contexto de márgenes: ¿hay señal de margen bajo o fuga de dinero hoy? Responde en 4–6 líneas, sin proponer borrar nada.',
        (c) => {
          pico += c;
          updateTarea('pico-claw', { respuesta: pico });
          setTextoGerente(`Pico-Claw: ${pico.slice(0, 120)}…`);
        },
        undefined,
        contextoParaAgente('pico-claw', datos)
      );
      updateTarea('pico-claw', { estado: 'done', respuesta: pico });

      updateTarea('contable', { estado: 'working' });
      let cont = '';
      await llamarAgente(
        'contable',
        `Pico-Claw dice:\n${pico}\n\nResponde SOLO con la caja del día (abierta/cerrada, ventas, gastos, métodos). ¿La alerta de márgenes se sostiene con el dinero real de hoy? 4–6 líneas.`,
        (c) => {
          cont += c;
          updateTarea('contable', { respuesta: cont });
          setTextoGerente(`Contable: ${cont.slice(0, 120)}…`);
        },
        undefined,
        contextoParaAgente('contable', datos)
      );
      updateTarea('contable', { estado: 'done', respuesta: cont });

      updateTarea('gerente', { estado: 'working' });
      let resume = '';
      await llamarAgente(
        'gerente',
        `Resume para el Director en chat natural (sin JSON si puedes; si usas JSON pon el resumen en respuesta_natural). Debate:\nPICO-CLAW:\n${pico}\n\nCONTABLE:\n${cont}\n\nDa 3 acciones concretas y claras.`,
        (c) => {
          resume += c;
          updateTarea('gerente', { respuesta: resume });
          setTextoGerente(resume.slice(0, 200));
        },
        undefined,
        contextoGerente(datos)
      );
      updateTarea('gerente', { estado: 'done', respuesta: resume });

      let analisis = resume;
      try {
        const match = resume.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]) as { respuesta_natural?: string };
          if (parsed.respuesta_natural) analisis = parsed.respuesta_natural;
        }
      } catch {
        /* texto libre ok */
      }

      setSesiones((prev) =>
        prev.map((s) => (s.id === id ? { ...s, analisisGerente: analisis, completado: true } : s))
      );
      toast.success('Debate de márgenes listo');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error en debate';
      toast.error(msg);
      setSesiones((prev) => prev.map((s) => (s.id === id ? { ...s, completado: true } : s)));
    } finally {
      setEjecutando(false);
      setTextoGerente('');
    }
  };

  const confirmarAprobacion = async (aceptar: boolean) => {
    const pendiente = aprobacionPendiente;
    if (!pendiente) return;
    setAprobacionPendiente(null);

    if (!aceptar) {
      setSesiones((prev) =>
        prev.map((s) =>
          s.id === pendiente.sesionId
            ? {
                ...s,
                completado: true,
                tareas: s.tareas.map((t) =>
                  t.requiereAprobacion || t.estado === 'blocked'
                    ? {
                        ...t,
                        estado: 'error' as EstadoAgente,
                        respuesta: '❌ El Director rechazó esta acción sensible.',
                      }
                    : t
                ),
              }
            : s
        )
      );
      toast.message('Acciones sensibles canceladas');
      setEjecutando(false);
      return;
    }

    setEjecutando(true);
    try {
      // Las tareas seguras ya se ejecutaron al detectar la pausa; solo corremos las sensibles.
      await ejecutarTareasPlan(pendiente.sesionId, pendiente.sensibles, pendiente.datos, false);
      toast.success('✅ Operación aprobada y completada');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error';
      toast.error(msg);
    } finally {
      setEjecutando(false);
    }
  };

  // ── Ejecutar Comando con NEXUS-VOLT (solo /api/agente) ──
  const ejecutarComando = async (comandoOverride?: string) => {
    const comandoFinal = (comandoOverride || comando).trim();
    if (!comandoFinal || ejecutando) return;

    if (comandoFinal === '__DEBATE_MARGENES__') {
      await ejecutarDebateMargenes();
      return;
    }

    const id = ++sesionIdRef.current;
    setComando('');
    setEjecutando(true);
    setTextoGerente('');

    const nuevaSesion: SesionIA = {
      id,
      comando: comandoFinal,
      tareas: [],
      completado: false,
      timestamp: new Date(),
    };
    setSesiones((prev) => [...prev, nuevaSesion]);

    try {
      const datos = await cargarDatosCasas(db);
      datosCasasRef.current = datos;
      const contexto = contextoGerente(datos);
      // Telemetría opcional (VITE_NEXUS_TELEMETRY_URL). Lo crítico es solo /api/agente.
      notificarTelemetriaOpcional(comandoFinal, contexto);

      const mensajeCompleto = `[INFO DE SISTEMA: ${contexto}]\nNOTA: Si el Director solo saluda, responde natural sin inventar tareas. Al delegar, respeta el grafo por casa (contable=caja, inventario=stock, odysseus=cámaras, produccion=horno).\n\nDirector: ${comandoFinal}`;

      let plan: {
        respuesta_natural?: string;
        analisis?: string;
        plan: { agente: AgenteId; tarea: string }[];
      };

      let respuestaGerente = '';
      await llamarAgente(
        'gerente',
        mensajeCompleto,
        (chunk) => {
          respuestaGerente += chunk;
          let display = respuestaGerente;
          const matchAnalisis =
            display.match(/"analisis"\s*:\s*"([^"]*)/) ||
            display.match(/"respuesta_natural"\s*:\s*"([^"]*)/);
          const matchRazonamiento = display.match(/"razonamiento"\s*:\s*"([^"]*)/);
          if (matchAnalisis) {
            display = matchAnalisis[1];
          } else if (matchRazonamiento) {
            display = `💭 ${matchRazonamiento[1]}`;
          } else if (display.trim().startsWith('{')) {
            display = 'Escribiendo...';
          }
          setTextoGerente(display.replace(/\\n/g, '\n'));
        },
        undefined,
        contexto
      );

      try {
        const match = respuestaGerente.match(/\{[\s\S]*\}/);
        if (match) {
          plan = JSON.parse(match[0]);
        } else {
          throw new Error('No JSON found');
        }
      } catch {
        setSesiones((prev) =>
          prev.map((s) =>
            s.id === id
              ? { ...s, analisisGerente: respuestaGerente, tareas: [], completado: true }
              : s
          )
        );
        return;
      }

      const planItems = plan.plan || [];
      const sensibles = planItems.filter((p) => esTareaSensible(p.agente, p.tarea));

      setSesiones((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                analisisGerente: plan.respuesta_natural || plan.analisis,
                tareas: planItems.map((p) => ({
                  agente: p.agente,
                  tarea: p.tarea,
                  estado: (esTareaSensible(p.agente, p.tarea) ? 'blocked' : 'idle') as EstadoAgente,
                  requiereAprobacion: esTareaSensible(p.agente, p.tarea),
                })),
              }
            : s
        )
      );

      if (sensibles.length > 0) {
        setAprobacionPendiente({
          sesionId: id,
          plan: planItems,
          datos,
          sensibles,
        });
        toast.message('Hay acciones sensibles: confirma o rechaza abajo');
        // Ejecuta solo las no sensibles mientras espera
        const seguras = planItems.filter((p) => !esTareaSensible(p.agente, p.tarea));
        if (seguras.length > 0) {
          // No marcar completado: faltan las sensibles por aprobar
          await ejecutarTareasPlan(id, seguras, datos, false, false);
        }
        setEjecutando(false);
        setTextoGerente('');
        return;
      }

      await ejecutarTareasPlan(id, planItems, datos, false, true);
      toast.success('✅ Operación completada');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error';
      toast.error(`Error: ${msg}`);
    } finally {
      setEjecutando(false);
      setTextoGerente('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) ejecutarComando();
  };

  // ── Alertas del Feed Derecho ──
  const incidentes = getIncidentes();
  const alertasCount = hallazgos.length + incidentes.filter(i => !i.revisado).length;

  return (
    <div className="flex-1 h-screen overflow-hidden bg-[#020617] text-slate-200 font-sans flex flex-col">
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 0)', backgroundSize: '40px 40px' }} />

      {/* Header */}
      <header className="shrink-0 border-b border-white/10 bg-slate-900/70 backdrop-blur-xl px-6 py-3 flex items-center justify-between z-20">
        <div className="flex items-center gap-4">
          <div className="h-7 w-1 bg-[#DAA520] rounded-full shadow-[0_0_10px_#DAA520]" />
          <div>
            <h1 className="text-lg font-black tracking-tighter text-white uppercase italic leading-none">
              Centro de Mando <span className="text-[#DAA520]">Superior</span>
            </h1>
            <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mt-0.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              NEXUS-VOLT ACTIVO · Alianza Dulce Placer
            </p>
          </div>
        </div>

        {/* Acciones de Cabecera (Botones Flotantes en lugar de sidebar) */}
        <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-xl border border-white/5 ml-auto">
          <button
            onClick={() => { setSesiones([]); localStorage.removeItem('nexus_chat_history'); toast.success('Memoria caché borrada') }}
            className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:text-red-300 transition-colors text-[10px] font-black uppercase tracking-widest flex items-center gap-2 mr-2"
            title="Limpiar Consola"
          >
            <Trash2 className="w-3.5 h-3.5" /> Limpiar
          </button>
          
          {alertasCount > 0 && (
            <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/20 text-[9px] font-black uppercase px-2 py-1 mr-2 animate-pulse">
              ⚠️ {alertasCount} alertas
            </Badge>
          )}

          <div className="h-6 w-px bg-white/10 mx-1" />
          
          <button onClick={() => setPanelDerecho(p => p === 'bitacora' ? null : 'bitacora')} className={cn('p-2.5 rounded-xl transition-all', panelDerecho === 'bitacora' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-500 hover:text-slate-300 border border-transparent')} title="Bitácora de Tareas"><Activity className="w-4 h-4" /></button>
          <div className="h-6 w-px bg-white/10 mx-1" />
          <button onClick={() => setPanelDerecho(p => p === 'vigia' ? null : 'vigia')} className={cn('p-2.5 rounded-xl transition-all', panelDerecho === 'vigia' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-500 hover:text-slate-300 border border-transparent')} title="VIGÍA-APP"><Eye className="w-4 h-4" /></button>
          <button onClick={() => setPanelDerecho(p => p === 'arquitech' ? null : 'arquitech')} className={cn('p-2.5 rounded-xl transition-all', panelDerecho === 'arquitech' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'text-slate-500 hover:text-slate-300 border border-transparent')} title="ARQUI-TECH"><Cpu className="w-4 h-4" /></button>
          <button onClick={() => setPanelDerecho(p => p === 'protocolos' ? null : 'protocolos')} className={cn('p-2.5 rounded-xl transition-all', panelDerecho === 'protocolos' ? 'bg-[#DAA520]/20 text-[#DAA520] border border-[#DAA520]/30' : 'text-slate-500 hover:text-slate-300 border border-transparent')} title="Protocolos"><Shield className="w-4 h-4" /></button>
          <button onClick={() => setPanelDerecho(p => p === 'clientbot' ? null : 'clientbot')} className={cn('p-2.5 rounded-xl transition-all', panelDerecho === 'clientbot' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'text-slate-500 hover:text-slate-300 border border-transparent')} title="Asistente de Pedidos (ClientBot)"><span className="text-sm">🤖</span></button>
          <button onClick={() => setShowNodosModal(true)} className="p-2.5 rounded-xl text-slate-500 hover:text-slate-300 ml-1 border border-transparent" title="Constructor de Workflows"><GitMerge className="w-4 h-4" /></button>
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex-1 flex overflow-hidden relative z-10">

        {/* SIDEBAR IZQUIERDO COLAPSABLE */}
        <div className="w-[76px] hover:w-72 transition-[width] duration-300 ease-in-out bg-black/80 backdrop-blur-xl border-r border-white/5 flex flex-col group/sidebar z-20 shrink-0">
          <div className="overflow-y-auto overflow-x-hidden custom-scrollbar flex-1 pb-6">
            
            {/* Escuadrón Élite */}
            <div className="p-3 pb-2">
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1 mb-3 mt-2 whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity">⚡ Escuadrón Élite</p>
              <div className="space-y-1.5">
                {ESCUADRON_ELITE.map(({ id, descripcion, casa }) => {
                  const cfg = AGENTES[id];
                  if (!cfg) return null;
                  return (
                    <button
                      key={id}
                      onClick={() => setAgenteSeleccionado(id)}
                      className="w-full p-2 rounded-2xl hover:bg-white/5 border border-transparent hover:border-white/10 cursor-pointer flex items-center gap-3.5 transition-all text-left"
                      title={casa}
                    >
                      <div className={cn("p-2.5 rounded-xl shrink-0 flex items-center justify-center", cfg.bg)}>
                        <cfg.icon className={cn("w-5 h-5", cfg.color)} />
                      </div>
                      <div className="flex-1 min-w-0 opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300 w-48">
                        <p className="text-xs font-black uppercase text-white truncate leading-none mb-1.5">{cfg.nombre}</p>
                        <p className="text-[9px] text-slate-400 truncate leading-tight">{descripcion}</p>
                        <p className="text-[8px] text-slate-600 truncate leading-tight mt-0.5 uppercase tracking-wider">{casa}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mx-4 my-2 h-px bg-white/5" />

            {/* Especialistas */}
            <div className="px-3 flex-1">
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1 mb-3 mt-4 whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity">👥 Especialistas</p>
              <div className="space-y-1">
                {Object.keys(AGENTES)
                  .filter(id => !ESCUADRON_ELITE.map(e => e.id).includes(id))
                  .map(id => {
                    const cfg = AGENTES[id as AgenteId];
                    return (
                      <button
                        key={id}
                        onClick={() => setAgenteSeleccionado(id as AgenteId)}
                        className="w-full p-2 rounded-xl hover:bg-white/5 flex items-center gap-4 transition-all text-left"
                      >
                        <div className="p-2 shrink-0 flex items-center justify-center rounded-xl bg-slate-800/50">
                          <cfg.icon className={cn("w-4 h-4 opacity-70", cfg.color)} />
                        </div>
                        <span className="text-[11px] font-bold text-slate-400 opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300 truncate w-48">{cfg.nombre}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>

        {/* PANEL CENTRAL: Chat con NEXUS-VOLT */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="absolute inset-0 bg-gradient-to-b from-[#DAA520]/3 to-transparent pointer-events-none z-0" />

          {/* Chat Output */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar relative z-10 w-full">
            {/* NEXUS-VOLT Header */}
            <div className="max-w-7xl mx-auto mb-10">
              <div className="flex flex-col md:flex-row md:items-center gap-6 p-6 sm:p-8 bg-slate-900/60 backdrop-blur-2xl rounded-[2rem] border border-[#DAA520]/20 shadow-[0_0_50px_rgba(218,165,32,0.03)] hover:shadow-[0_0_60px_rgba(218,165,32,0.06)] transition-all duration-500">
                <div className="flex items-center gap-5 md:w-1/2">
                  <div className="p-4 rounded-3xl bg-gradient-to-br from-[#DAA520]/20 to-[#DAA520]/5 border border-[#DAA520]/30 shrink-0 shadow-inner">
                    <BrainCircuit className="w-12 h-12 text-[#DAA520]" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-wider leading-none mb-2">NEXUS-VOLT</h2>
                    <p className="text-[10px] text-[#DAA520] font-black uppercase tracking-[0.25em]">Gran Orquestador · A sus órdenes, Director</p>
                    <div className="flex items-center gap-2 mt-3">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]" />
                      <span className="text-[10px] font-bold text-green-500 uppercase tracking-wider">Sistema Online</span>
                    </div>
                  </div>
                </div>

                {/* Acciones Rápidas Horizontales */}
                <div className="md:w-1/2 flex flex-col gap-2">
                  {textoGerente && (
                     <p className="text-sm text-slate-300 font-bold italic leading-relaxed bg-black/30 p-3 rounded-xl border border-white/5">{textoGerente}</p>
                  )}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {ACCIONES_RAPIDAS.map(({ label, icon: Icon, color, prompt }) => (
                      <button
                        key={label}
                        onClick={() => ejecutarComando(prompt)}
                        disabled={ejecutando}
                        className={cn(
                          'flex items-center gap-2 px-3 py-3 rounded-xl border bg-black/40 backdrop-blur-md transition-all duration-300 text-left hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-40 group',
                          color
                        )}
                      >
                        <Icon className="w-4 h-4 shrink-0 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-wider truncate">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Sesiones estilo Chat */}
            <div className="max-w-7xl mx-auto space-y-10">
              {sesiones.map(sesion => (
                <div key={sesion.id} className="space-y-4">
                  {/* Burbuja del Usuario */}
                  <div className="flex justify-end">
                    <div className="bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-5 py-3 max-w-[85%] shadow-lg">
                      <p className="text-base leading-relaxed">{sesion.comando}</p>
                      <p className="text-[10px] text-indigo-200 mt-2 text-right font-bold tracking-widest">
                        {sesion.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  {/* Burbuja de NEXUS-VOLT */}
                  {(sesion.analisisGerente || sesion.tareas.length > 0) && (
                    <div className="flex justify-start">
                      <div className="flex items-end gap-3 max-w-[90%]">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#DAA520]/20 to-[#DAA520]/5 border border-[#DAA520]/40 shadow-[0_0_15px_rgba(218,165,32,0.15)] flex items-center justify-center shrink-0 mb-1">
                          <BrainCircuit className="w-5 h-5 text-[#DAA520]" />
                        </div>
                        <div className="bg-slate-900/80 backdrop-blur-md border border-[#DAA520]/20 text-slate-200 rounded-2xl rounded-tl-sm px-6 py-4 shadow-xl overflow-hidden min-w-[200px]">
                          {sesion.analisisGerente && (
                            <div className="text-base leading-relaxed prose prose-invert prose-p:my-1 prose-h3:text-[#DAA520] prose-strong:text-white max-w-none">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {(() => {
                                  try {
                                    const parsed = JSON.parse(sesion.analisisGerente);
                                    return parsed.respuesta_natural || sesion.analisisGerente;
                                  } catch {
                                    return sesion.analisisGerente;
                                  }
                                })()}
                              </ReactMarkdown>
                            </div>
                          )}
                          
                          {/* Sub-Agentes (Tareas) renderizados en el chat */}
                          {sesion.tareas && sesion.tareas.length > 0 && (
                            <div className="mt-6 space-y-4">
                              {sesion.tareas.map((tarea, idx) => {
                                const agenteConf = AGENTES[tarea.agente];
                                const AgenteIcon = agenteConf?.icon || BrainCircuit;
                                return (
                                  <div key={idx} className={cn("p-4 rounded-xl border bg-black/60 shadow-inner", agenteConf?.bg || "border-slate-700")}>
                                    <div className="flex items-center gap-2 mb-3">
                                      <AgenteIcon className={cn("w-5 h-5", agenteConf?.color || "text-slate-400")} />
                                      <span className={cn("text-xs font-black uppercase tracking-widest", agenteConf?.color || "text-slate-400")}>
                                        {agenteConf?.nombre || tarea.agente}
                                      </span>
                                      {tarea.estado === 'working' && <Loader2 className="w-4 h-4 animate-spin text-slate-400 ml-auto" />}
                                      {tarea.estado === 'done' && <CheckCircle2 className="w-4 h-4 text-emerald-400 ml-auto" />}
                                      {tarea.estado === 'error' && <AlertTriangle className="w-4 h-4 text-red-400 ml-auto" />}
                                      {tarea.estado === 'blocked' && <AlertTriangle className="w-4 h-4 text-amber-400 ml-auto" />}
                                    </div>
                                    <div className="text-sm text-slate-200">
                                      {tarea.respuesta ? (
                                        <div className="prose prose-invert prose-p:my-1 prose-sm prose-strong:text-white max-w-none">
                                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {(() => {
                                              try {
                                                const parsed = JSON.parse(tarea.respuesta);
                                                return parsed.respuesta_natural || tarea.respuesta;
                                              } catch {
                                                return tarea.respuesta;
                                              }
                                            })()}
                                          </ReactMarkdown>
                                        </div>
                                      ) : (
                                        <span className="text-slate-500 italic flex items-center gap-2">
                                          Analizando datos <span className="flex gap-1"><span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce" /><span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce [animation-delay:0.2s]" /><span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce [animation-delay:0.4s]" /></span>
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {/* Auto-scroll anchor */}
            <div ref={chatEndRef} className="h-4" />
          </div>

          {/* Aprobación humana (acciones sensibles) */}
          {aprobacionPendiente && (
            <div className="shrink-0 mx-4 sm:mx-8 mb-3 p-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 backdrop-blur-md z-30">
              <p className="text-sm font-bold text-amber-200 mb-2">
                El agente propone algo delicado. ¿Confirmas, Director?
              </p>
              <ul className="text-xs text-slate-300 space-y-1 mb-3 list-disc pl-5">
                {aprobacionPendiente.sensibles.map((s, i) => (
                  <li key={i}>
                    <span className="text-amber-300 font-black uppercase">{s.agente}</span>: {s.tarea}
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Button
                  onClick={() => void confirmarAprobacion(true)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  Sí, autorizo
                </Button>
                <Button
                  onClick={() => void confirmarAprobacion(false)}
                  variant="outline"
                  className="border-red-500/40 text-red-300 hover:bg-red-500/10"
                >
                  No, cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="shrink-0 px-4 sm:px-8 py-5 bg-slate-950/90 backdrop-blur-xl border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-20 relative">
            <div className="max-w-7xl mx-auto relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-[#DAA520]/30 via-transparent to-indigo-600/20 rounded-2xl blur-md opacity-60 pointer-events-none" />
              <div className="relative bg-black/90 border border-white/10 rounded-2xl p-3 flex items-end gap-3 shadow-2xl transition-all focus-within:border-[#DAA520]/40">
                <Textarea
                  value={comando}
                  onChange={e => setComando(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isRecording ? '🎙️ Escuchando tu directiva...' : 'Escribe una orden para el escuadrón · Ctrl+Enter para enviar'}
                  className="bg-transparent border-none text-base text-white placeholder:text-slate-600 focus-visible:ring-0 resize-none min-h-[52px] font-medium py-3 px-4 leading-snug"
                  disabled={ejecutando || isRecording}
                />
                <div className="flex gap-2 shrink-0 pr-1 pb-1">
                  <Button
                    onClick={toggleRecording}
                    variant="outline"
                    className={cn('h-[52px] w-[52px] rounded-xl border transition-all',
                      isRecording ? 'bg-red-500/20 border-red-500 text-red-400 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white hover:bg-slate-800'
                    )}
                  >
                    <Mic className="w-6 h-6" />
                  </Button>
                  <Button
                    onClick={() => ejecutarComando()}
                    disabled={!comando.trim() || ejecutando || isRecording}
                    className="h-[52px] px-8 rounded-xl bg-gradient-to-r from-[#DAA520] to-[#B8860B] text-black font-black uppercase text-sm tracking-widest shadow-[0_0_20px_rgba(218,165,32,0.3)] hover:scale-105 hover:shadow-[0_0_30px_rgba(218,165,32,0.5)] active:scale-95 transition-all"
                  >
                    {ejecutando ? <Loader2 className="w-6 h-6 animate-spin" /> : <>Desplegar <Zap className="w-5 h-5 ml-2 fill-black" /></>}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PANEL DERECHO: Feed Inteligente (Oculto por defecto, Toggleable) */}
        {panelDerecho && (
          <div className="w-[400px] bg-slate-950/95 backdrop-blur-2xl border-l border-white/10 flex flex-col shrink-0 z-30 shadow-2xl animate-in slide-in-from-right-8 duration-300">
            {/* Header del Panel */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/40">
              <div className="flex items-center gap-3">
                {panelDerecho === 'bitacora' && <Activity className="w-5 h-5 text-emerald-400" />}
                {panelDerecho === 'vigia' && <Eye className="w-5 h-5 text-indigo-400" />}
                {panelDerecho === 'arquitech' && <Cpu className="w-5 h-5 text-purple-400" />}
                {panelDerecho === 'protocolos' && <Shield className="w-5 h-5 text-[#DAA520]" />}
                <h3 className="text-[11px] font-black uppercase text-white tracking-widest">{panelDerecho}</h3>
              </div>
              <button onClick={() => setPanelDerecho(null)} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Contenido del Panel */}
            <div className="flex-1 p-0 overflow-y-auto custom-scrollbar flex flex-col relative bg-gradient-to-b from-black/40 to-transparent">
              {panelDerecho === 'bitacora' && <div className="p-4"><BitacoraIA sesiones={sesiones} /></div>}
              {panelDerecho === 'vigia' && <div className="p-4"><VigiApp /></div>}
              {panelDerecho === 'arquitech' && <div className="p-4"><ArquiTech /></div>}
              {panelDerecho === 'protocolos' && <div className="p-4"><ProtocolosArsenal /></div>}
              {panelDerecho === 'clientbot' && <div className="h-full"><AsistenteVirtual onClose={() => setPanelDerecho(null)} onSaveOrder={async (order) => {
                 try {
                   await db.addVenta({
                     productos: [{ id: 'auto', nombre: order.productoSeleccionado, cantidad: order.cantidad, precioUnitario: order.total! / order.cantidad! }],
                     total: order.total,
                     metodoPago: 'efectivo',
                     descuento: 0
                   });
                   toast.success('Pedido insertado en DB (Ventas) correctamente.');
                 } catch (e) {
                   toast.error('Error guardando pedido: ' + e);
                 }
              }} /></div>}
            </div>
          </div>
        )}
      </div>

      {/* Panel de Control del Agente (Sidebar deslizable) */}
      {agenteSeleccionado && (
        <AgentPanel
          agenteId={agenteSeleccionado}
          onClose={() => setAgenteSeleccionado(null)}
        />
      )}

      {/* Modal Constructor de Nodos */}
      {showNodosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-8">
          <div className="w-full h-full max-w-[1400px] bg-slate-950 border border-white/10 rounded-2xl overflow-hidden relative shadow-2xl flex flex-col animate-in fade-in zoom-in duration-200">
            <ConstructorNodos onClose={() => setShowNodosModal(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
