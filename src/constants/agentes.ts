import { 
  BrainCircuit, Utensils, Package, Megaphone, Users, TrendingUp, Wallet, 
  Truck, CheckCircle, Wrench, MessageSquare, Leaf, Rocket, Building, 
  Clipboard, Lightbulb, Scale, FileText, Target, Instagram
} from 'lucide-react';
import { db } from '@/lib/database';
import type { AgenteId } from '@/lib/database';
export type { AgenteId };

export const AGENTES_CONFIG: Record<AgenteId, { nombre: string; cargo: string; emoji: string; color: string; bg: string; icon: any; shadow: string; misionPanaderia: string; plantillas: string[] }> = {
  gerente:      { nombre: 'NEXUS-VOLT',     cargo: 'Gerente General', emoji: '👑', color: 'text-[#DAA520]', bg: 'bg-[#DAA520]/10 border-[#DAA520]/20', icon: BrainCircuit, shadow: 'shadow-[#DAA520]/20', misionPanaderia: 'Orquestación de apertura de sucursales y mando global.', plantillas: ['Plan Estratégico de Expansión 2024', 'Informe de Desempeño Operativo Semanal', 'Análisis de Competencia en el Barrio'] },
  produccion:   { nombre: 'PRODUCCIÓN',     cargo: 'Jefe de Horno',   emoji: '🥖', color: 'text-[#F5DEB3]', bg: 'bg-[#F5DEB3]/10 border-[#F5DEB3]/20', icon: Utensils, shadow: 'shadow-[#F5DEB3]/20', misionPanaderia: 'Estandarización de horneado y garantía de receta maestra.', plantillas: ['Reporte de Horneado y Mermas Directas', 'Cronograma de Producción para Festivos', 'Auditoría de Calidad del Pan de Bono'] },
  inventario:   { nombre: 'INVENTARIO',     cargo: 'Control Stocks',  emoji: '📦', color: 'text-[#fbbf24]', bg: 'bg-[#fbbf24]/10 border-[#fbbf24]/20', icon: Package, shadow: 'shadow-[#fbbf24]/20', misionPanaderia: 'Alertas críticas de materia prima antes de que suba el precio.', plantillas: ['Hoja de Pedido a Proveedores (Harina/Azúcar)', 'Alerta de Caducidad de Insumos', 'Informe de Stock Crítico para PDF'] },
  marketing:    { nombre: 'MARKETING',      cargo: 'Dir. Creativo',   emoji: '📣', color: 'text-[#00FFFF]', bg: 'bg-[#00FFFF]/10 border-[#00FFFF]/20', icon: Megaphone, shadow: 'shadow-[#00FFFF]/20', misionPanaderia: 'Campañas visuales para que todo el barrio quiera su pan.', plantillas: ['Campaña de Redes: El Martes del Dulce Placer', 'Estrategia de Fidelización Local', 'Diseño de Ofertas para Panadería'] },
  nomina:       { nombre: 'NÓMINA & RRHH',   cargo: 'Gesto. Talento',  emoji: '👥', color: 'text-[#87CEEB]', bg: 'bg-[#87CEEB]/10 border-[#87CEEB]/20', icon: Users, shadow: 'shadow-[#87CEEB]/20', misionPanaderia: 'Gestión de personal y clima laboral del equipo humano.', plantillas: ['Reporte de Horas Extra y Turnos de Panaderos', 'Plan de Incentivos por Puntualidad', 'Evaluación de Desempeño del Personal'] },
  inversion:    { nombre: 'INVERSIÓN',      cargo: 'Analista Exced.',  emoji: '📈', color: 'text-[#10b981]', bg: 'bg-[#10b981]/10 border-[#10b981]/20', icon: TrendingUp, shadow: 'shadow-[#10b981]/20', misionPanaderia: 'Reinversión estratégica en maquinaria industrial eficiente.', plantillas: ['Análisis de Retorno de Inversión (Nuevo Horno)', 'Plan de Inversión de Excedentes Mensuales', 'Informe de Ahorro por Eficiencia Energética'] },
  contable:     { nombre: 'BANCO INTERNO',  cargo: 'Audit. Financ.',  emoji: '💰', color: 'text-[#C0C0C0]', bg: 'bg-[#C0C0C0]/10 border-[#C0C0C0]/20', icon: Wallet, shadow: 'shadow-[#C0C0C0]/20', misionPanaderia: 'Auditoría de flujo de caja para evitar fugas de dinero.', plantillas: ['Cierre de Caja y Conciliación Bancaria', 'Informe de Gastos no Operativos', 'Previsión de Flujo para el Próximo Mes'] },
  logistica:    { nombre: 'LOGÍSTICA',      cargo: 'Control Reparto', emoji: '🚚', color: 'text-[#A855F7]', bg: 'bg-[#A855F7]/10 border-[#A855F7]/20', icon: Truck, shadow: 'shadow-[#A855F7]/20', misionPanaderia: 'Optimización de rutas para gastar menos gasolina.', plantillas: ['Mapa de Rutas para Reparto de Pan de Mañana', 'Reporte de Consumo de Combustible', 'Control de Entregas a Puntos de Venta'] },
  calidad:      { nombre: 'CALIDAD',        cargo: 'Auditor Sabor',   emoji: '🧼', color: 'text-[#84CC16]', bg: 'bg-[#84CC16]/10 border-[#84CC16]/20', icon: CheckCircle, shadow: 'shadow-[#84CC16]/20', misionPanaderia: 'Garantizar higiene y cumplimiento de normas de salud.', plantillas: ['Lista de Chequeo Sanitario para PDF', 'Auditoría de Insumos Orgánicos', 'Informe de Quejas de Sabor y Color'] },
  mantenimiento:{ nombre: 'MANTENIMIENTO',  cargo: 'Jefe Equipos',    emoji: '🔧', color: 'text-[#94A3B8]', bg: 'bg-[#94A3B8]/10 border-[#94A3B8]/20', icon: Wrench, shadow: 'shadow-[#94A3B8]/20', misionPanaderia: 'Revisiones preventivas para que el horno nunca falle.', plantillas: ['Plan de Mantenimiento Preventivo de Hornos', 'Reporte de Averías y Repuestos Críticos', 'Checklist de Seguridad de Maquinaria'] },
  clientes:     { nombre: 'CLIENTES',       cargo: 'Gestor PQR',      emoji: '💬', color: 'text-[#EC4899]', bg: 'bg-[#EC4899]/10 border-[#EC4899]/20', icon: MessageSquare, shadow: 'shadow-[#EC4899]/20', misionPanaderia: 'Conversión de clientes en fans y gestión de puntos.', plantillas: ['Encuesta de Satisfacción del Cliente', 'Estrategia de Recuperación de Clientes', 'Plan de Fidelización: El Fan Panadero'] },
  sostenibilidad:{ nombre: 'SOSTENIBILIDAD', cargo: 'Control Merma',   emoji: '🌱', color: 'text-[#22C55E]', bg: 'bg-[#22C55E]/10 border-[#22C55E]/20', icon: Leaf, shadow: 'shadow-[#22C55E]/20', misionPanaderia: 'Estrategias para no perder dinero con el pan sobrante.', plantillas: ['Informe de Merma Cero y Desperdicio', 'Plan de Reutilización Creativa de Insumos', 'Auditoría de Impacto Ambiental'] },
  expansion:    { nombre: 'EXPANSIÓN',      cargo: 'Estudio Sedes',   emoji: '🚀', color: 'text-[#6366F1]', bg: 'bg-[#6366F1]/10 border-[#6366F1]/20', icon: Rocket, shadow: 'shadow-[#6366F1]/20', misionPanaderia: 'Estudio de tráfico para ubicar el próximo punto de éxito.', plantillas: ['Análisis de Ubicación para Sucursal 2', 'Estudio de Mercado de Montería', 'Informe de Viabilidad de Apertura'] },
  creditos:     { nombre: 'CRÉDITOS',       cargo: 'Negoc. Bancario', emoji: '🏦', color: 'text-[#3B82F6]', bg: 'bg-[#3B82F6]/10 border-[#3B82F6]/20', icon: Building, shadow: 'shadow-[#3B82F6]/20', misionPanaderia: 'Conseguir créditos a la tasa más baja para financiarse.', plantillas: ['Carpeta para Solicitud de Crédito Bancario', 'Carta de Negociación de Tasas de Interés', 'Estrategia de Apalancamiento Financiero'] },
  subvenciones: { nombre: 'SUBVENCIONES',   cargo: 'Cazador Fondos',  emoji: '📋', color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/10 border-[#F59E0B]/20', icon: Clipboard, shadow: 'shadow-[#F59E0B]/20', misionPanaderia: 'Dinero regalado no reembolsable para modernización.', plantillas: ['Formulario de Postulación a Fondos Públicos', 'Búsqueda Activa de Convocatorias del SENA', 'Redacción de Proyecto para Dinero de Paz'] },
  pitch:        { nombre: 'IDEA & PITCH',   cargo: 'Arquitecto Proy', emoji: '✍️', color: 'text-[#F43F5E]', bg: 'bg-[#F43F5E]/10 border-[#F43F5E]/20', icon: Lightbulb, shadow: 'shadow-[#F43F5E]/20', misionPanaderia: 'Discurso ganador para premios y concursos nacionales.', plantillas: ['Pitch de 3 Minutos para Inversores', 'Presentación de Marca para Franquicias', 'Resumen Ejecutivo de la Panadería Élite'] },
  abogado:      { nombre: 'LEGAL',          cargo: 'Abogado Corp.',   emoji: '⚖️', color: 'text-[#ef4444]', bg: 'bg-[#ef4444]/10 border-[#ef4444]/20', icon: Scale, shadow: 'shadow-[#ef4444]/20', misionPanaderia: 'Blindaje legal contra demandas y contratos laborales.', plantillas: ['Contrato de Trabajo para Panaderos de Élite', 'Manual de Convivencia y Legalidad', 'Blindaje contra Reclamaciones de Clientes'] },
  tax:          { nombre: 'FISCAL',         cargo: 'Contador Imp.',   emoji: '📑', color: 'text-[#0ea5e9]', bg: 'bg-[#0ea5e9]/10 border-[#0ea5e9]/20', icon: FileText, shadow: 'shadow-[#0ea5e9]/20', misionPanaderia: 'Gestión tributaria inteligente para pagar lo justo.', plantillas: ['Calendario Tributario Mensual', 'Simulación de Pago de IVA e ICA', 'Estrategia de Reducción de Impuestos'] },
  ventas:       { nombre: 'VENTAS ÉLITE',   cargo: 'Cierre B2B',      emoji: '🎯', color: 'text-[#facc15]', bg: 'bg-[#facc15]/10 border-[#facc15]/20', icon: Target, shadow: 'shadow-[#facc15]/20', misionPanaderia: 'Cierre de contratos con hoteles y colegios a diario.', plantillas: ['Lista de Precios para Hoteles y Restaurantes', 'Acuerdo de Suministro Mensual de Pan', 'Plan de Comisiones para Vendedores'] },
  influencer:   { nombre: 'INFLUENCER/PR',  cargo: 'Gestor Marca',    emoji: '🤳', color: 'text-[#e879f9]', bg: 'bg-[#e879f9]/10 border-[#e879f9]/20', icon: Instagram, shadow: 'shadow-[#e879f9]/20', misionPanaderia: 'Traída masiva de clientes vía redes sociales.', plantillas: ['Guion para Reels e Historias de Instagram', 'Contrato de Alianza con Influencers de Comida', 'Plan de Prensa para Evento de Inauguración'] },
  
  // === TRILOGÍA CLAW (Agentes de Élite MCP) ===
  'pico-claw':  { nombre: 'PICO-CLAW',      cargo: 'Data Analyst CS', emoji: '🦅', color: 'text-[#FF3366]', bg: 'bg-[#FF3366]/10 border-[#FF3366]/20', icon: TrendingUp, shadow: 'shadow-[#FF3366]/40', misionPanaderia: 'Análisis forense de KPIs y protección de márgenes en tiempo real.', plantillas: ['Auditoría de Fugatividad de Precios', 'Proyección de Ventas con IA', 'Reporte de Salud Financiera Profunda'] },
  'open-claw':  { nombre: 'OPEN-CLAW',      cargo: 'Sys Architect',   emoji: '🛡️', color: 'text-[#00FF99]', bg: 'bg-[#00FF99]/10 border-[#00FF99]/20', icon: Rocket, shadow: 'shadow-[#00FF99]/40', misionPanaderia: 'Optimización de infraestructura y seguridad del ecosistema Dulce Placer.', plantillas: ['Diagnóstico de Estado de Servidores', 'Mapa de Arquitectura de Datos', 'Plan de Seguridad de Backups'] },
  'auto-claw':  { nombre: 'AUTO-CLAW',      cargo: 'Growth Autom.',   emoji: '⚡', color: 'text-[#CCFF00]', bg: 'bg-[#CCFF00]/10 border-[#CCFF00]/20', icon: BrainCircuit, shadow: 'shadow-[#CCFF00]/40', misionPanaderia: 'Automatización de flujos de trabajo y escalamiento agresivo del negocio.', plantillas: ['Plan de Automatización de Pedidos', 'Estrategia de Escalamiento Masivo', 'Flujo de Notificaciones Críticas'] },
};

export async function consultarAgente(
  tipo: AgenteId, 
  mensaje: string, 
  onChunk: (text: string) => void,
  imagen?: string // Base64 de la imagen
): Promise<string> {
  const [config, sysConfig] = await Promise.all([
    db.getAgenteConfig(tipo),
    db.getConfiguracion()
  ]);

  const res = await fetch('/api/agente', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      tipo, 
      mensaje,
      imagen,
      aiMode: sysConfig?.aiMode || 'hybrid',
      soberania: config ? {
        directiva: config.directivaPrimaria,
        restricciones: config.restricciones,
        conocimiento: config.conocimientoInyectado,
        autonomia: config.autonomia
      } : null
    }),
  });

  if (!res.ok) {
    let errorMsg = `Error ${res.status}`;
    try {
      const errorJson = await res.json();
      errorMsg = errorJson.error || errorMsg;
    } catch {
      const text = await res.text();
      errorMsg = text || errorMsg;
    }
    throw new Error(errorMsg);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    fullText += chunk;
    onChunk(chunk);
  }

  return fullText;
}
