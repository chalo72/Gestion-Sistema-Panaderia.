import { useMemo, useState, type ReactNode } from 'react';
import {
  Briefcase,
  Save,
  ChevronRight,
  Database,
  Link2,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  CrearSeleccionDatos,
  type SeleccionCrear,
} from '@/components/plan-negocio/CrearSeleccionDatos';

/** Título + contexto descriptivo (como Instrucciones del Excel CREAR SENA 2026) */
const SECCIONES = [
  {
    id: 'cabecera',
    n: 0,
    titulo: 'Información del proyecto',
    modulo: 'Auditoría ERP · Módulos 1-3',
    resumen: 'Datos de identificación de la panadería ante el Fondo Emprender.',
    contexto:
      'Aquí se identifica la iniciativa: líder o representante (nombres completos), nombre del negocio, categoría del sector (Economía Campesina u otros), sector/actividad CIIU (ej. 1081 panadería), tipo de proyecto (Individual o Asociativo) y si ya cuenta con lugar de operación en Canalete. Estos datos alimentan el Resumen del Excel y el Módulo 1. Si resulta beneficiario, el lugar de operación debe poder demostrarse (uso de suelo, tradición y libertad o sana posesión).',
  },
  {
    id: 's1',
    n: 1,
    titulo: '1. ¿Quién es el cliente de su iniciativa? (Quién compra mis productos o servicios)',
    modulo: 'Módulos 1-3 (Mercado)',
    resumen: 'Describe quién compra y quién consume el pan, con detalle de vida real.',
    contexto:
      'Identifique al CLIENTE (quien paga) y al CONSUMIDOR (quien come), que pueden ser distintos. Escríbalo con el mayor detalle posible: dónde vive (casco urbano o veredas: El Limón Regado, Nueva Vida, Mata Plátano, etc.), estrato, edad, género, si trabaja y en qué, capacidad de compra, frecuencia (diario en pueblo / semanal en finca), medios de pago y hábitos. La idea es describirlo como a un familiar cercano. Incluya tamaño de mercado de lo general a lo particular. Este perfil nutre Módulos 1-3 y debe cuadrar con Canales (§8) y Ventas (§9).',
  },
  {
    id: 's2',
    n: 2,
    titulo: '2. Planteamiento del problema o necesidad que se pretende solucionar',
    modulo: 'Módulos 1-3 (Mercado)',
    resumen: 'El “dolor” del cliente, no el problema personal del emprendedor.',
    contexto:
      'Responda: ¿cuál es la necesidad no resuelta del cliente del punto 1? ¿Cómo le ayuda Dulce Placer? Ojo: no es “nos falta un horno”; es el problema del vecino o del campesino (pan industrial “puro aire”, poca durabilidad en el campo, oferta insuficiente de pan artesanal nutritivo). Explique por qué fortalecen la iniciativa ahora (demanda validada en 5 años). Este texto justifica la solución del Módulo 4.',
  },
  {
    id: 's3',
    n: 3,
    titulo: '3. La competencia (Quién más lo hace?)',
    modulo: 'Módulos 1-3 (Mercado)',
    resumen: 'Tres competidores + en qué se diferencia Dulce Placer.',
    contexto:
      'Siempre hay competencia: quienes hacen lo mismo o lo sustituyen. Describa tres (3) competidores con nombre, ubicación y qué valoran los clientes de ellos. Luego escriba la conclusión: ventajas competitivas (ubicación frente al parque, harinas premium, ERP/POS, trayectoria). Use marcar/desmarcar al final para decidir qué competidores entran al plan oficial. Alimenta Módulos 1-3 y el pitch.',
  },
  {
    id: 's4',
    n: 4,
    titulo: '4. Descripción del proyecto (Qué es lo que voy a ofrecer?)',
    modulo: 'Módulo 4 (Solución)',
    resumen: 'Qué es el proyecto y la propuesta de valor (Ayuda / Que / Mediante).',
    contexto:
      'Explique en qué consiste el fortalecimiento (horno, panadería móvil, calidad, tecnología) y qué lo hace diferente. Complete la propuesta de valor: Ayuda a… Que sufren… Mediante… Debe ser coherente con el problema (§2) y con productos (§5). Este bloque es el corazón del Módulo 4 (Solución).',
  },
  {
    id: 's5',
    n: 5,
    titulo: '5. Productos o servicios',
    modulo: 'Módulo 4 · Auditoría ERP',
    resumen: 'Máximo tres líneas de producto, con unidad y presentación.',
    contexto:
      'El Excel exige agrupar en únicamente tres (3) productos o servicios. Describa cada línea, unidad de medida (unidad, libra, porción…) y presentación (bolsa familiar, caja, mostrador). Puede basarse en el catálogo real del ERP (Auditoría) y marcar abajo qué referencias del inventario refuerzan cada línea. Estas tres líneas alimentan proceso (§6), ventas (§9) y costos variables (§10).',
  },
  {
    id: 's6',
    n: 6,
    titulo: '6. Proceso técnico',
    modulo: 'Módulo 4 (Solución/Fichas)',
    resumen: 'Paso a paso de cómo se hace el pan, hasta la venta.',
    contexto:
      'Cuente el proceso desde la compra de insumos hasta la entrega: pesaje, moldeo, fermentación, horneado, empaque, registro POS y ruta a veredas. Indique quién lo hace, con qué equipo y, si aplica, capacidad instalada (unidades por hora × horas × días). Incluya lo que lo diferencia (insumos premium, higiene, merma controlada). Debe cuadrar con productos (§5), equipo (§11) e inversión (§12). Se relaciona con fichas técnicas del Módulo 4.',
  },
  {
    id: 's7',
    n: 7,
    titulo: '7. Trámites legales (permisos y licencias)',
    modulo: 'Módulos 5-7',
    resumen: 'Tipo de registro formal y permisos para funcionar legalmente.',
    contexto:
      'Marque una sola forma de registro (Persona Natural, con establecimiento, S.A.S., etc.). Liste normas y permisos: matrícula mercantil, uso de suelo, concepto sanitario, bomberos, INVIMA si aplica. La constitución legal es rubro NO financiable: la paga el emprendedor. Sin esto claro, el evaluador ve riesgo jurídico. Alimenta avances legales (§14) y costos de permisos en (§12).',
  },
  {
    id: 's8',
    n: 8,
    titulo: '8. Canales (¿Cómo van a conocer mi negocio?)',
    modulo: 'Módulos 5-7 (Crecimiento)',
    resumen: 'Cómo se entera el cliente y cuánto cuesta el mercadeo del año 1.',
    contexto:
      'Indique estrategias de comunicación (fachada, motocarro/perifoneo, volantes, emisora, WhatsApp) con costo del primer año. Debe tener sentido con el cliente: si vive en vereda y poco usa Instagram, no base todo en redes. Marque promoción (muestra, puerta a puerta) y distribución (punto de venta, domicilio, distribuidores). Coherente con gastos de administración y ventas (§10) y con Módulos 5-7.',
  },
  {
    id: 's9',
    n: 9,
    titulo: '9. Proyección de ventas (Cuánto se espera vender?)',
    modulo: 'Auditoría ERP · Modelo 4K',
    resumen: 'Cuánto espera vender en 5 años y por qué es realista.',
    contexto:
      'Justifique la proyección con hechos (ventas reales de Auditoría ERP, 5 años en Canalete, demanda de veredas). En el Excel oficial se llenan precios año 1, unidades mes a mes e incrementos (IPC/IPP). Aquí deje la justificación clara y use los datos vivos del ERP como respaldo. Alimenta estado de resultados y TIR/VPN del Modelo financiero.',
  },
  {
    id: 's10',
    n: 10,
    titulo: '10. Costos y gastos',
    modulo: 'Auditoría ERP · Modelo 4K',
    resumen: 'Fijos, variables y gastos de administración/ventas reales.',
    contexto:
      'Separe costos fijos (siguen aunque produzca menos) de variables (harina, azúcar, empaque según volumen) y gastos de administración y ventas (arriendo, publicidad, internet). Use valores de mercado y, preferible, gastos reales del ERP: marque abajo qué categorías entran al plan. Debe cuadrar con Canales (§8) y con la utilidad del Modelo 4K.',
  },
  {
    id: 's11',
    n: 11,
    titulo: '11. Equipo de trabajo',
    modulo: 'Módulos 5-7 · Auditoría ERP',
    resumen: 'Cargos, funciones, sueldos y empleos a crear.',
    contexto:
      'Liste cada cargo (administrador, panadero, conductor/vendedor de ruta), tipo de vinculación, funciones y asignación mensual (con factor prestacional si aplica). Esto se convierte en el indicador de empleos del Fondo Emprender: lo que escriba aquí es lo que se compromete a ejecutar. Puede marcar trabajadores activos del ERP. Relacionado con proceso (§6) y valor de la iniciativa (§13).',
  },
  {
    id: 's12',
    n: 12,
    titulo: '12. Necesidades y requerimientos',
    modulo: 'Módulos 5-7',
    resumen: 'Qué se pide al Fondo Emprender (máquinas, móvil, adecuaciones…).',
    contexto:
      'Registre inversiones fijas y gastos preoperativos financiables: maquinaria, equipos, software, adecuaciones (con topes %), insumos del ciclo, salarios (recomendado ≥4 meses), permisos. No pida lo no financiable (inmuebles, deudas, formación académica, etc.). Cada ítem debe reaparecer en el plan operativo (§15). Marque/desmarque cotizaciones al final para fijar el monto solicitado.',
  },
  {
    id: 's13',
    n: 13,
    titulo: '13. Valor de la iniciativa',
    modulo: 'Topes Montos · Modelo financiero',
    resumen: 'Monto solicitado vs topes de la convocatoria e integrantes/empleos.',
    contexto:
      'Verifique que el valor solicitado (suma de §12 seleccionada), el número de integrantes y los empleos propuestos cumplan los topes de la convocatoria (Acuerdo / términos de referencia). Incluya la contrapartida (ej. ERP propio, muebles). Si no cuadra, el Excel marca “No cumple”. Relacionado con Modelo 4K y hoja Topes Montos.',
  },
  {
    id: 's14',
    n: 14,
    titulo: '14. ¿Qué avances del proyecto se tienen a este momento?',
    modulo: 'Pitch & NDA',
    resumen: 'Qué ya está hecho: legal, comercial, técnico y ambiental.',
    contexto:
      'Describa avances medibles: Legal (permisos, formalización), Comercial (ventas, clientes, pedidos), Técnico (capacidad actual, equipos, arrobas/día), Ambiental (residuos, energía). Puede agregar redes o web. Sirve para demostrar que no es idea en el aire: ya hay panadería andando. Alimenta Pitch y credibilidad ante evaluadores.',
  },
  {
    id: 's15',
    n: 15,
    titulo: '15. Plan operativo',
    modulo: 'Módulos 5-7',
    resumen: 'En qué mes se gasta cada rubro pedido en el punto 12.',
    contexto:
      'Programe mes a mes la ejecución de lo solicitado en Necesidades (§12): compra de horno, adecuación del motocarro, arranque de ruta, mercadeo. Cada peso del Fondo debe tener mes. Muestra orden y capacidad de gestión. Relacionado con Módulos 5-7 y con indicadores de ejecución.',
  },
  {
    id: 's16',
    n: 16,
    titulo: '16. Impacto',
    modulo: 'Pitch & NDA',
    resumen: 'Efectos económico, social, ambiental y tecnológico en la región.',
    contexto:
      'Cuente cómo aporta Dulce Placer: Económico (ingresos, producción, empleo), Social (familias, veredas, alimentación), Ambiental (merma, energía, residuos), Tecnológico (ERP/POS, horno, logística). Debe ser coherente con lo escrito en proceso, equipo e inversión. Fortalece el pitch y la narrativa SENA.',
  },
  {
    id: 's17',
    n: 17,
    titulo: '17. Indicadores',
    modulo: 'Modelo financiero · Resumen',
    resumen: 'Compromisos que salen solos del resto del plan (no inventar cifras).',
    contexto:
      'En el Excel este bloque no se diligencia a mano: se calcula con lo ya escrito (empleos, eventos de mercadeo, contrapartida, presupuesto, producción y ventas año 1). Aquí se muestra un resumen según su selección. Si algo no cuadra, corrija §§ anteriores, no “maquille” este punto.',
  },
  {
    id: 's18',
    n: 18,
    titulo: '18. Mapa de actores',
    modulo: 'Módulos 5-7',
    resumen: 'Quiénes ayudan o se relacionan con el negocio (fuera del SENA).',
    contexto:
      'Liste personas o entidades distintas al SENA: proveedores de harina, Alcaldía, tiendas de vereda, emisoras, clientes ancla, transportadores. Indique tipo de relación y cómo aportan. Muestra red de apoyo para implementar el proyecto. Útil en crecimiento y sostenibilidad (Módulos 5-7).',
  },
  {
    id: 's19',
    n: 19,
    titulo: '19. Asociatividad',
    modulo: 'Integrantes (solo asociativo)',
    resumen: 'Solo si el proyecto es asociativo; si es individual, se deja vacío.',
    contexto:
      'Aplica únicamente a grupos asociativos: justificación de trabajar juntos, impacto en la comunidad, perfil del líder, trayectoria del grupo, toma de decisiones y responsabilidades. Debe coincidir con la hoja Integrantes. Si el tipo de proyecto es Individual (como Dulce Placer hoy), deje este punto vacío, igual que en el Excel.',
  },
] as const;

type FormCrear = {
  nombreIniciativa: string;
  liderProyecto: string;
  localizacion: string;
  sectorCiiu: string;
  categoriaSector: string;
  tipoProyecto: string;
  lugarOperacion: string;
  contrapartida: string;
  perfilCliente: string;
  perfilConsumidor: string;
  problemaNecesidad: string;
  ventajaCompetitiva: string;
  descripcionProyecto: string;
  propuestaValorAyuda: string;
  propuestaValorQue: string;
  propuestaValorMediante: string;
  competidores: Array<{ nombre: string; fortalezas: string; debilidades: string }>;
  productosCrear: Array<{ nombre: string; descripcion: string; unidad: string; presentacion: string }>;
  procesosCrear: string[];
  cotizaciones: Array<{ item: string; proveedor: string; valor: string }>;
  equipoTrabajo: string;
  estrategiaMercadeo: string;
  tramitesPendientes: string;
  canalesPendientes: string;
  finanzasPendientes: string;
  registroFormal?: string;
  avanceLegal?: string;
  avanceComercial?: string;
  avanceTecnico?: string;
  avanceAmbiental?: string;
  impactoEconomico?: string;
  impactoSocial?: string;
  impactoAmbiental?: string;
  impactoTecnologico?: string;
  mapaActores?: string;
  planOperativo?: string;
  justificacionVentas?: string;
};

type Props = {
  form: FormCrear;
  setForm: (next: FormCrear) => void;
  seleccion: SeleccionCrear;
  onSeleccionChange: (next: SeleccionCrear) => void;
  formatCurrency: (n: number) => string;
  onGuardar: () => void;
  onIrModulo: (tab: string) => void;
};

const celda = 'bg-slate-100 dark:bg-slate-800/80 border border-slate-300/80 dark:border-slate-600 rounded-lg';

function SeccionShell({
  id,
  titulo,
  modulo,
  resumen,
  contexto,
  children,
  abierta,
  onToggle,
  onIrModulo,
  tabDestino,
}: {
  id: string;
  titulo: string;
  modulo: string;
  resumen?: string;
  contexto?: string;
  children: ReactNode;
  abierta: boolean;
  onToggle: () => void;
  onIrModulo: (tab: string) => void;
  tabDestino?: string;
}) {
  return (
    <Card id={id} className="border-slate-300 dark:border-white/10 bg-white dark:bg-card/50 scroll-mt-24">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-900/40 rounded-t-xl"
      >
        <ChevronRight
          className={cn('w-5 h-5 mt-0.5 shrink-0 text-emerald-700 transition-transform', abierta && 'rotate-90')}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-slate-900 dark:text-slate-100 leading-snug">{titulo}</p>
          {resumen ? (
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">{resumen}</p>
          ) : null}
          <p className="text-[11px] text-muted-foreground mt-1.5 flex flex-wrap items-center gap-1">
            <Link2 className="w-3 h-3" />
            Se relaciona con: <span className="font-semibold text-emerald-700 dark:text-emerald-400">{modulo}</span>
          </p>
        </div>
      </button>
      {abierta ? (
        <CardContent className="space-y-4 border-t border-slate-200 dark:border-white/10 pt-4">
          {contexto ? (
            <div className="text-sm text-slate-700 dark:text-slate-200 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/40 rounded-xl p-4 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-800 dark:text-amber-300">
                Qué pedir este punto (como el Excel)
              </p>
              <p className="leading-relaxed whitespace-pre-line">{contexto}</p>
            </div>
          ) : null}
          {tabDestino ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-[11px] font-bold uppercase gap-1"
              onClick={() => onIrModulo(tabDestino)}
            >
              Ver módulo relacionado <ChevronRight className="w-3 h-3" />
            </Button>
          ) : null}
          {children}
        </CardContent>
      ) : null}
    </Card>
  );
}

export function CrearExpedienteExcel({
  form,
  setForm,
  seleccion,
  onSeleccionChange,
  formatCurrency,
  onGuardar,
  onIrModulo,
}: Props) {
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = { cabecera: true, s1: true, s5: true, s12: true, s13: true };
    return init;
  });

  const toggle = (id: string) => setAbiertas((p) => ({ ...p, [id]: !p[id] }));

  const totales = useMemo(() => {
    const sum = (g: keyof SeleccionCrear) =>
      seleccion[g].filter((i) => i.seleccionado).reduce((s, i) => s + (Number(i.monto) || 0), 0);
    const cnt = (g: keyof SeleccionCrear) => seleccion[g].filter((i) => i.seleccionado).length;
    return {
      inversion: sum('inversiones'),
      costos: sum('costosFijos'),
      productos: cnt('productos'),
      equipo: cnt('equipo'),
      competidores: cnt('competidores'),
    };
  }, [seleccion]);

  const irA = (id: string) => {
    setAbiertas((p) => ({ ...p, [id]: true }));
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const patch = (partial: Partial<FormCrear>) => setForm({ ...form, ...partial });

  return (
    <div className="space-y-4">
      {/* Encabezado tipo Excel */}
      <Card className="border-emerald-600/40 bg-emerald-50 dark:bg-emerald-950/30">
        <CardHeader className="pb-2">
          <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-emerald-800/80">
            Coordinación Nacional de Emprendimiento · Dirección de Empleo y Trabajo (2026)
          </CardDescription>
          <CardTitle className="text-base sm:text-lg text-emerald-950 dark:text-emerald-100 flex items-center gap-2">
            <Briefcase className="w-5 h-5 shrink-0" />
            Iniciativa productiva · Plan de negocio a CREAR
          </CardTitle>
          <CardDescription className="text-sm">
            Misma estructura que el Excel/PDF del SENA (hoja Proyecto: secciones 1 a 19). Diligencie las celdas grises.
            Lo marcado en productos, costos y equipo alimenta los módulos y el Generar Plan.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button type="button" onClick={onGuardar} className="bg-emerald-700 hover:bg-emerald-800 text-white gap-2">
            <Save className="w-4 h-4" /> Guardar expediente
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onIrModulo('auditoria-erp')} className="gap-1">
            <Database className="w-3.5 h-3.5" /> Ver datos reales (Auditoría ERP)
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onIrModulo('generacion')}>
            Ir a Generar Plan
          </Button>
        </CardContent>
      </Card>

      {/* Flujo: de dónde viene → a dónde va */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
        <button
          type="button"
          onClick={() => onIrModulo('auditoria-erp')}
          className="rounded-xl border border-cyan-300 bg-cyan-50 dark:bg-cyan-950/40 p-3 text-left hover:ring-2 hover:ring-cyan-400"
        >
          <p className="font-black text-cyan-800 dark:text-cyan-300">1. Auditoría ERP</p>
          <p className="text-muted-foreground mt-1">Caja, productos, gastos y equipo reales de la panadería.</p>
        </button>
        <div className="rounded-xl border border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-3">
          <p className="font-black text-emerald-800 dark:text-emerald-300">2. Este expediente CREAR</p>
          <p className="text-muted-foreground mt-1">Eliges qué entra al plan (como el Excel). Totales solo con lo marcado.</p>
        </div>
        <button
          type="button"
          onClick={() => onIrModulo('modulos-1-3')}
          className="rounded-xl border border-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 p-3 text-left hover:ring-2 hover:ring-indigo-400"
        >
          <p className="font-black text-indigo-800 dark:text-indigo-300">3. Módulos / Generar Plan</p>
          <p className="text-muted-foreground mt-1">Mercado, solución, crecimiento y documento final usan esta selección.</p>
        </button>
      </div>

      {/* Índice rápido 1–19 */}
      <Card className="border-slate-200 dark:border-white/10">
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Índice del Excel (salta a la sección)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1.5 pb-4">
          {SECCIONES.map((s) => (
            <button
              key={s.id}
              type="button"
              title={`${s.titulo}\n\n${s.resumen}`}
              onClick={() => irA(s.id)}
              className="text-[10px] font-bold uppercase px-2.5 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-slate-200 dark:border-white/10"
            >
              {s.n === 0 ? 'Datos' : s.n}
            </button>
          ))}
        </CardContent>
        <CardContent className="pt-0 pb-4">
          <p className="text-[11px] text-muted-foreground">
            Pase el cursor sobre cada número para ver de qué trata el punto. Al abrirlo verá la guía completa del Excel.
          </p>
        </CardContent>
      </Card>

      {/* Resumen selección */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
        <div className="rounded-xl bg-white dark:bg-slate-900 border p-2">
          <p className="font-black text-emerald-700">{totales.productos}</p>
          <p className="text-muted-foreground">Productos §5</p>
        </div>
        <div className="rounded-xl bg-white dark:bg-slate-900 border p-2">
          <p className="font-black text-emerald-700">{totales.competidores}</p>
          <p className="text-muted-foreground">Competidores §3</p>
        </div>
        <div className="rounded-xl bg-white dark:bg-slate-900 border p-2">
          <p className="font-black text-emerald-700">{totales.equipo}</p>
          <p className="text-muted-foreground">Equipo §11</p>
        </div>
        <div className="rounded-xl bg-white dark:bg-slate-900 border p-2">
          <p className="font-black text-emerald-700">{formatCurrency(totales.costos)}</p>
          <p className="text-muted-foreground">Costos §10</p>
        </div>
        <div className="rounded-xl bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-300 p-2 col-span-2 sm:col-span-1">
          <p className="font-black text-emerald-800 dark:text-emerald-200">{formatCurrency(totales.inversion)}</p>
          <p className="text-muted-foreground">Inversión §12–13</p>
        </div>
      </div>

      {/* —— Cabecera —— */}
      <SeccionShell
        id="cabecera"
        titulo={SECCIONES[0].titulo}
        modulo={SECCIONES[0].modulo}
        resumen={SECCIONES[0].resumen}
        contexto={SECCIONES[0].contexto}
        abierta={!!abiertas.cabecera}
        onToggle={() => toggle('cabecera')}
        onIrModulo={onIrModulo}
        tabDestino="modulos-1-3"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[11px] font-black uppercase">Nombres y apellidos del líder</Label>
            <Input className={celda} value={form.liderProyecto} onChange={(e) => patch({ liderProyecto: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-black uppercase">Nombre de la iniciativa</Label>
            <Input className={celda} value={form.nombreIniciativa} onChange={(e) => patch({ nombreIniciativa: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-black uppercase">Categoría del sector económico</Label>
            <Input className={celda} value={form.categoriaSector} onChange={(e) => patch({ categoriaSector: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-black uppercase">Sector / actividad (CIIU)</Label>
            <Input className={celda} value={form.sectorCiiu} onChange={(e) => patch({ sectorCiiu: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-black uppercase">Tipo de proyecto</Label>
            <Input className={celda} value={form.tipoProyecto} onChange={(e) => patch({ tipoProyecto: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-black uppercase">¿Cuenta con lugar de operaciones?</Label>
            <Input className={celda} value={form.lugarOperacion} onChange={(e) => patch({ lugarOperacion: e.target.value })} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-[11px] font-black uppercase">Localización</Label>
            <Input className={celda} value={form.localizacion} onChange={(e) => patch({ localizacion: e.target.value })} />
          </div>
        </div>
      </SeccionShell>

      {/* —— 1 Cliente —— */}
      <SeccionShell
        id="s1"
        titulo={SECCIONES[1].titulo}
        modulo={SECCIONES[1].modulo}
        resumen={SECCIONES[1].resumen}
        contexto={SECCIONES[1].contexto}
        abierta={!!abiertas.s1}
        onToggle={() => toggle('s1')}
        onIrModulo={onIrModulo}
        tabDestino="modulos-1-3"
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="font-black">CLIENTE</Label>
            <Textarea className={cn(celda, 'min-h-[140px]')} value={form.perfilCliente} onChange={(e) => patch({ perfilCliente: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="font-black">CONSUMIDOR</Label>
            <Textarea className={cn(celda, 'min-h-[120px]')} value={form.perfilConsumidor} onChange={(e) => patch({ perfilConsumidor: e.target.value })} />
          </div>
        </div>
      </SeccionShell>

      {/* —— 2 Problema —— */}
      <SeccionShell
        id="s2"
        titulo={SECCIONES[2].titulo}
        modulo={SECCIONES[2].modulo}
        resumen={SECCIONES[2].resumen}
        contexto={SECCIONES[2].contexto}
        abierta={!!abiertas.s2}
        onToggle={() => toggle('s2')}
        onIrModulo={onIrModulo}
        tabDestino="modulos-1-3"
      >
        <Textarea className={cn(celda, 'min-h-[160px]')} value={form.problemaNecesidad} onChange={(e) => patch({ problemaNecesidad: e.target.value })} />
      </SeccionShell>

      {/* —— 3 Competencia —— */}
      <SeccionShell
        id="s3"
        titulo={SECCIONES[3].titulo}
        modulo={SECCIONES[3].modulo}
        resumen={SECCIONES[3].resumen}
        contexto={SECCIONES[3].contexto}
        abierta={!!abiertas.s3}
        onToggle={() => toggle('s3')}
        onIrModulo={onIrModulo}
        tabDestino="modulos-1-3"
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {(form.competidores || []).map((comp, idx) => (
            <div key={idx} className={cn(celda, 'p-3 space-y-2')}>
              <Label className="text-[10px] font-black uppercase">Nombre del competidor</Label>
              <Input
                value={comp.nombre}
                onChange={(e) => {
                  const nuevos = [...form.competidores];
                  nuevos[idx] = { ...nuevos[idx], nombre: e.target.value };
                  patch({ competidores: nuevos });
                }}
              />
              <Label className="text-[10px] font-black uppercase">Fortalezas</Label>
              <Textarea
                className="min-h-[80px]"
                value={comp.fortalezas}
                onChange={(e) => {
                  const nuevos = [...form.competidores];
                  nuevos[idx] = { ...nuevos[idx], fortalezas: e.target.value };
                  patch({ competidores: nuevos });
                }}
              />
              <Label className="text-[10px] font-black uppercase">Debilidades</Label>
              <Textarea
                className="min-h-[80px]"
                value={comp.debilidades}
                onChange={(e) => {
                  const nuevos = [...form.competidores];
                  nuevos[idx] = { ...nuevos[idx], debilidades: e.target.value };
                  patch({ competidores: nuevos });
                }}
              />
            </div>
          ))}
        </div>
        <div className="space-y-1">
          <Label className="font-black">Conclusión: ventajas competitivas frente a la competencia</Label>
          <Textarea className={cn(celda, 'min-h-[120px]')} value={form.ventajaCompetitiva} onChange={(e) => patch({ ventajaCompetitiva: e.target.value })} />
        </div>
      </SeccionShell>

      {/* —— 4 Descripción —— */}
      <SeccionShell
        id="s4"
        titulo={SECCIONES[4].titulo}
        modulo={SECCIONES[4].modulo}
        resumen={SECCIONES[4].resumen}
        contexto={SECCIONES[4].contexto}
        abierta={!!abiertas.s4}
        onToggle={() => toggle('s4')}
        onIrModulo={onIrModulo}
        tabDestino="modulo-4"
      >
        <div className="space-y-1">
          <Label className="font-black">El proyecto consiste en:</Label>
          <Textarea className={cn(celda, 'min-h-[120px]')} value={form.descripcionProyecto} onChange={(e) => patch({ descripcionProyecto: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label>Ayuda:</Label>
            <Textarea className={cn(celda, 'min-h-[90px]')} value={form.propuestaValorAyuda} onChange={(e) => patch({ propuestaValorAyuda: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Que:</Label>
            <Textarea className={cn(celda, 'min-h-[90px]')} value={form.propuestaValorQue} onChange={(e) => patch({ propuestaValorQue: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Mediante:</Label>
            <Textarea className={cn(celda, 'min-h-[90px]')} value={form.propuestaValorMediante} onChange={(e) => patch({ propuestaValorMediante: e.target.value })} />
          </div>
        </div>
      </SeccionShell>

      {/* —— 5 Productos —— */}
      <SeccionShell
        id="s5"
        titulo={SECCIONES[5].titulo}
        modulo={SECCIONES[5].modulo}
        resumen={SECCIONES[5].resumen}
        contexto={SECCIONES[5].contexto}
        abierta={!!abiertas.s5}
        onToggle={() => toggle('s5')}
        onIrModulo={onIrModulo}
        tabDestino="modulo-4"
      >
        <div className="space-y-3">
          {(form.productosCrear || []).slice(0, 3).map((producto, idx) => (
            <div key={idx} className={cn(celda, 'p-3 space-y-2')}>
              <Label className="text-[10px] font-black uppercase">Nombre del producto o servicio {idx + 1}</Label>
              <Input
                value={producto.nombre}
                onChange={(e) => {
                  const nuevos = [...form.productosCrear];
                  nuevos[idx] = { ...nuevos[idx], nombre: e.target.value };
                  patch({ productosCrear: nuevos });
                }}
              />
              <Label className="text-[10px] font-black uppercase">Descripción</Label>
              <Textarea
                className="min-h-[90px]"
                value={producto.descripcion}
                onChange={(e) => {
                  const nuevos = [...form.productosCrear];
                  nuevos[idx] = { ...nuevos[idx], descripcion: e.target.value };
                  patch({ productosCrear: nuevos });
                }}
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] font-black uppercase">Unidad de medida</Label>
                  <Input
                    value={producto.unidad}
                    onChange={(e) => {
                      const nuevos = [...form.productosCrear];
                      nuevos[idx] = { ...nuevos[idx], unidad: e.target.value };
                      patch({ productosCrear: nuevos });
                    }}
                  />
                </div>
                <div>
                  <Label className="text-[10px] font-black uppercase">Presentación</Label>
                  <Input
                    value={producto.presentacion}
                    onChange={(e) => {
                      const nuevos = [...form.productosCrear];
                      nuevos[idx] = { ...nuevos[idx], presentacion: e.target.value };
                      patch({ productosCrear: nuevos });
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </SeccionShell>

      {/* —— 6 Proceso —— */}
      <SeccionShell
        id="s6"
        titulo={SECCIONES[6].titulo}
        modulo={SECCIONES[6].modulo}
        resumen={SECCIONES[6].resumen}
        contexto={SECCIONES[6].contexto}
        abierta={!!abiertas.s6}
        onToggle={() => toggle('s6')}
        onIrModulo={onIrModulo}
        tabDestino="modulo-4"
      >
        <div className="space-y-2">
          {(form.procesosCrear || []).map((paso, idx) => (
            <div key={idx} className="flex gap-2 items-start">
              <span className="h-7 w-7 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center shrink-0 mt-1">
                {idx + 1}
              </span>
              <Textarea
                className={cn(celda, 'min-h-[72px] flex-1')}
                value={paso}
                onChange={(e) => {
                  const nuevos = [...form.procesosCrear];
                  nuevos[idx] = e.target.value;
                  patch({ procesosCrear: nuevos });
                }}
              />
            </div>
          ))}
        </div>
      </SeccionShell>

      {/* —— 7 Trámites —— */}
      <SeccionShell
        id="s7"
        titulo={SECCIONES[7].titulo}
        modulo={SECCIONES[7].modulo}
        resumen={SECCIONES[7].resumen}
        contexto={SECCIONES[7].contexto}
        abierta={!!abiertas.s7}
        onToggle={() => toggle('s7')}
        onIrModulo={onIrModulo}
        tabDestino="modulo-5"
      >
        <div className="space-y-1">
          <Label className="font-black">Tipo de registro formal (una opción)</Label>
          <Input
            className={celda}
            value={form.registroFormal || 'Persona Natural con Establecimiento de Comercio'}
            onChange={(e) => patch({ registroFormal: e.target.value })}
            placeholder="Ej: Persona Natural con Establecimiento de Comercio"
          />
        </div>
        <div className="space-y-1">
          <Label className="font-black">Normas, permisos, licencias y registros</Label>
          <Textarea className={cn(celda, 'min-h-[140px]')} value={form.tramitesPendientes} onChange={(e) => patch({ tramitesPendientes: e.target.value })} />
        </div>
      </SeccionShell>

      {/* —— 8 Canales —— */}
      <SeccionShell
        id="s8"
        titulo={SECCIONES[8].titulo}
        modulo={SECCIONES[8].modulo}
        resumen={SECCIONES[8].resumen}
        contexto={SECCIONES[8].contexto}
        abierta={!!abiertas.s8}
        onToggle={() => toggle('s8')}
        onIrModulo={onIrModulo}
        tabDestino="modulo-5"
      >
        <Textarea className={cn(celda, 'min-h-[140px]')} value={form.canalesPendientes} onChange={(e) => patch({ canalesPendientes: e.target.value })} />
        <div className="space-y-1">
          <Label>Estrategia de mercadeo (resumen)</Label>
          <Textarea className={cn(celda, 'min-h-[80px]')} value={form.estrategiaMercadeo} onChange={(e) => patch({ estrategiaMercadeo: e.target.value })} />
        </div>
      </SeccionShell>

      {/* —— 9 Ventas —— */}
      <SeccionShell
        id="s9"
        titulo={SECCIONES[9].titulo}
        modulo={SECCIONES[9].modulo}
        resumen={SECCIONES[9].resumen}
        contexto={SECCIONES[9].contexto}
        abierta={!!abiertas.s9}
        onToggle={() => toggle('s9')}
        onIrModulo={onIrModulo}
        tabDestino="auditoria-erp"
      >
        <Textarea
          className={cn(celda, 'min-h-[120px]')}
          value={form.justificacionVentas || form.finanzasPendientes}
          onChange={(e) => patch({ justificacionVentas: e.target.value, finanzasPendientes: e.target.value })}
          placeholder="Justificación de la proyección de ventas…"
        />
        <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Las tablas mes×mes del Excel se completan aquí en texto o se exportan después al archivo oficial.
        </p>
      </SeccionShell>

      {/* —— 10 Costos —— */}
      <SeccionShell
        id="s10"
        titulo={SECCIONES[10].titulo}
        modulo={SECCIONES[10].modulo}
        resumen={SECCIONES[10].resumen}
        contexto={SECCIONES[10].contexto}
        abierta={!!abiertas.s10}
        onToggle={() => toggle('s10')}
        onIrModulo={onIrModulo}
        tabDestino="auditoria-erp"
      >
        <p className="text-sm font-bold">Total costos fijos seleccionados: {formatCurrency(totales.costos)}</p>
      </SeccionShell>

      {/* —— 11 Equipo —— */}
      <SeccionShell
        id="s11"
        titulo={SECCIONES[11].titulo}
        modulo={SECCIONES[11].modulo}
        resumen={SECCIONES[11].resumen}
        contexto={SECCIONES[11].contexto}
        abierta={!!abiertas.s11}
        onToggle={() => toggle('s11')}
        onIrModulo={onIrModulo}
        tabDestino="modulo-5"
      >
        <Textarea className={cn(celda, 'min-h-[100px]')} value={form.equipoTrabajo} onChange={(e) => patch({ equipoTrabajo: e.target.value })} />
        <p className="text-sm">Personas marcadas del ERP: <strong>{totales.equipo}</strong></p>
      </SeccionShell>

      {/* —— 12 Necesidades —— */}
      <SeccionShell
        id="s12"
        titulo={SECCIONES[12].titulo}
        modulo={SECCIONES[12].modulo}
        resumen={SECCIONES[12].resumen}
        contexto={SECCIONES[12].contexto}
        abierta={!!abiertas.s12}
        onToggle={() => toggle('s12')}
        onIrModulo={onIrModulo}
        tabDestino="modulo-5"
      >
        <div className="space-y-2">
          {(form.cotizaciones || []).map((c, idx) => (
            <div key={idx} className={cn(celda, 'p-3 grid grid-cols-1 md:grid-cols-3 gap-2')}>
              <Input
                placeholder="Ítem / rubro"
                value={c.item}
                onChange={(e) => {
                  const nuevos = [...form.cotizaciones];
                  nuevos[idx] = { ...nuevos[idx], item: e.target.value };
                  patch({ cotizaciones: nuevos });
                }}
              />
              <Input
                placeholder="Proveedor"
                value={c.proveedor}
                onChange={(e) => {
                  const nuevos = [...form.cotizaciones];
                  nuevos[idx] = { ...nuevos[idx], proveedor: e.target.value };
                  patch({ cotizaciones: nuevos });
                }}
              />
              <Input
                placeholder="Valor $"
                value={c.valor}
                onChange={(e) => {
                  const nuevos = [...form.cotizaciones];
                  nuevos[idx] = { ...nuevos[idx], valor: e.target.value };
                  patch({ cotizaciones: nuevos });
                }}
              />
            </div>
          ))}
        </div>
      </SeccionShell>

      {/* —— 13 Valor —— */}
      <SeccionShell
        id="s13"
        titulo={SECCIONES[13].titulo}
        modulo={SECCIONES[13].modulo}
        resumen={SECCIONES[13].resumen}
        contexto={SECCIONES[13].contexto}
        abierta={!!abiertas.s13}
        onToggle={() => toggle('s13')}
        onIrModulo={onIrModulo}
        tabDestino="modelo-4k"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className={cn(celda, 'p-3')}>
            <p className="text-[10px] font-black uppercase text-muted-foreground">Tipo</p>
            <p className="font-bold mt-1">{form.tipoProyecto || 'Individual'}</p>
          </div>
          <div className={cn(celda, 'p-3')}>
            <p className="text-[10px] font-black uppercase text-muted-foreground">Valor solicitado (selección §12)</p>
            <p className="font-black text-emerald-700 text-lg mt-1">{formatCurrency(totales.inversion)}</p>
          </div>
          <div className={cn(celda, 'p-3')}>
            <p className="text-[10px] font-black uppercase text-muted-foreground">Contrapartida</p>
            <Textarea className="min-h-[60px] mt-1 border-0 bg-transparent p-0" value={form.contrapartida} onChange={(e) => patch({ contrapartida: e.target.value })} />
          </div>
        </div>
      </SeccionShell>

      {/* —— 14 Avances —— */}
      <SeccionShell
        id="s14"
        titulo={SECCIONES[14].titulo}
        modulo={SECCIONES[14].modulo}
        resumen={SECCIONES[14].resumen}
        contexto={SECCIONES[14].contexto}
        abierta={!!abiertas.s14}
        onToggle={() => toggle('s14')}
        onIrModulo={onIrModulo}
        tabDestino="pitch-nda"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(
            [
              ['avanceLegal', 'Legal'],
              ['avanceComercial', 'Comercial'],
              ['avanceTecnico', 'Técnico'],
              ['avanceAmbiental', 'Ambiental'],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="space-y-1">
              <Label className="font-black">{label}</Label>
              <Textarea
                className={cn(celda, 'min-h-[80px]')}
                value={form[key] || ''}
                onChange={(e) => patch({ [key]: e.target.value })}
              />
            </div>
          ))}
        </div>
      </SeccionShell>

      {/* —— 15 Plan operativo —— */}
      <SeccionShell
        id="s15"
        titulo={SECCIONES[15].titulo}
        modulo={SECCIONES[15].modulo}
        resumen={SECCIONES[15].resumen}
        contexto={SECCIONES[15].contexto}
        abierta={!!abiertas.s15}
        onToggle={() => toggle('s15')}
        onIrModulo={onIrModulo}
        tabDestino="modulo-5"
      >
        <Textarea
          className={cn(celda, 'min-h-[120px]')}
          value={form.planOperativo || ''}
          onChange={(e) => patch({ planOperativo: e.target.value })}
          placeholder="Ej: Mes 1–2 horno y amasadora; Mes 3 adecuación móvil; Mes 4 arranque ruta…"
        />
      </SeccionShell>

      {/* —— 16 Impacto —— */}
      <SeccionShell
        id="s16"
        titulo={SECCIONES[16].titulo}
        modulo={SECCIONES[16].modulo}
        resumen={SECCIONES[16].resumen}
        contexto={SECCIONES[16].contexto}
        abierta={!!abiertas.s16}
        onToggle={() => toggle('s16')}
        onIrModulo={onIrModulo}
        tabDestino="pitch-nda"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(
            [
              ['impactoEconomico', 'Económico'],
              ['impactoSocial', 'Social'],
              ['impactoAmbiental', 'Ambiental'],
              ['impactoTecnologico', 'Tecnológico'],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="space-y-1">
              <Label className="font-black">{label}</Label>
              <Textarea
                className={cn(celda, 'min-h-[80px]')}
                value={form[key] || ''}
                onChange={(e) => patch({ [key]: e.target.value })}
              />
            </div>
          ))}
        </div>
      </SeccionShell>

      {/* —— 17 Indicadores —— */}
      <SeccionShell
        id="s17"
        titulo={SECCIONES[17].titulo}
        modulo={SECCIONES[17].modulo}
        resumen={SECCIONES[17].resumen}
        contexto={SECCIONES[17].contexto}
        abierta={!!abiertas.s17}
        onToggle={() => toggle('s17')}
        onIrModulo={onIrModulo}
        tabDestino="modelo-4k"
      >
        <ul className="text-sm space-y-2">
          <li className="flex justify-between border-b pb-1"><span>Empleos a crear (equipo marcado)</span><strong>{totales.equipo}</strong></li>
          <li className="flex justify-between border-b pb-1"><span>Presupuesto solicitado</span><strong>{formatCurrency(totales.inversion)}</strong></li>
          <li className="flex justify-between border-b pb-1"><span>Líneas de producto en plan</span><strong>{Math.min(3, totales.productos || (form.productosCrear || []).length)}</strong></li>
          <li className="flex justify-between"><span>Contrapartida</span><strong className="text-right max-w-[60%] text-xs">{form.contrapartida}</strong></li>
        </ul>
      </SeccionShell>

      {/* —— 18 Actores —— */}
      <SeccionShell
        id="s18"
        titulo={SECCIONES[18].titulo}
        modulo={SECCIONES[18].modulo}
        resumen={SECCIONES[18].resumen}
        contexto={SECCIONES[18].contexto}
        abierta={!!abiertas.s18}
        onToggle={() => toggle('s18')}
        onIrModulo={onIrModulo}
        tabDestino="modulo-5"
      >
        <Textarea
          className={cn(celda, 'min-h-[120px]')}
          value={form.mapaActores || ''}
          onChange={(e) => patch({ mapaActores: e.target.value })}
          placeholder="Proveedores de harina, Alcaldía, SENA, tiendas de vereda, emisoras locales…"
        />
      </SeccionShell>

      {/* —— 19 Asociatividad —— */}
      <SeccionShell
        id="s19"
        titulo={SECCIONES[19].titulo}
        modulo={SECCIONES[19].modulo}
        resumen={SECCIONES[19].resumen}
        contexto={SECCIONES[19].contexto}
        abierta={!!abiertas.s19}
        onToggle={() => toggle('s19')}
        onIrModulo={onIrModulo}
      >
        <p className="text-sm text-muted-foreground">
          Tipo actual: <strong>{form.tipoProyecto}</strong>. Si cambia a asociativo, complete la hoja Integrantes y esta justificación en el Excel oficial.
        </p>
      </SeccionShell>

      {/* Selección ERP al final, ligada a §§ 3,5,6,10,11,12 */}
      <Card className="border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20">
        <CardHeader>
          <CardTitle className="text-base text-emerald-900 dark:text-emerald-200">
            Marcar / desmarcar datos que entran al expediente
          </CardTitle>
          <CardDescription>
            Igual que elegir filas del Excel: solo lo marcado cuenta en totales (§10, §12–13) y en Generar Plan.
            Productos vienen del ERP; competidores y procesos del plan; costos de gastos reales.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CrearSeleccionDatos seleccion={seleccion} onChange={onSeleccionChange} formatCurrency={formatCurrency} />
        </CardContent>
      </Card>
    </div>
  );
}
