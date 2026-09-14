import React, { useState, useMemo, useEffect } from 'react';
import { Bot, Sparkles, Loader2, Target, Briefcase, TrendingUp, Download, Building2, Users, Factory, FileText, CheckCircle2, Save, Pencil, X, Plus, Trash2, MapPin, Search, Presentation, AlertTriangle, ShieldCheck, Heart, Info, DollarSign, Truck, Timer, Lock, MonitorPlay, Star, Wallet, Database } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { consultarAgente } from '@/constants/agentes';
import { toast } from 'sonner';
import type { Venta, Gasto, Producto, Trabajador, VentaDiaria } from '@/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getVentasDiarias } from '@/lib/finanzas-personales';
import {
  construirSeleccionCrear,
  type SeleccionCrear,
} from '@/components/plan-negocio/CrearSeleccionDatos';
import { CrearExpedienteExcel } from '@/components/plan-negocio/CrearExpedienteExcel';

interface PlanNegocioProps {
  ventas: Venta[];
  gastos: Gasto[];
  productos: Producto[];
  trabajadores: Trabajador[];
  formatCurrency: (val: number) => string;
}

const PDF_COMPETIDORES_BASE = [
  {
    nombre: 'Panadería Mi Ranchito',
    fortalezas: 'Tradición, entre 10 y 20 años en el mercado y alto reconocimiento local.',
    debilidades: 'Decadencia visual y técnica; el local se percibe apagado y se enfocan más en restaurante que en tecnificación panadera.',
  },
  {
    nombre: 'Panadería Ashael',
    fortalezas: 'Diversificación: ofrecen desayunos, comidas rápidas y panadería.',
    debilidades: 'Baja capacidad: producen cerca de 1.5 arrobas diarias, una sola vitrina y poca variedad de pan.',
  },
  {
    nombre: 'Panadería Donde Juan',
    fortalezas: 'Logística con carrito que recorre el pueblo vendiendo sus productos.',
    debilidades: 'Ubicación alejada del flujo principal y procesos poco tecnificados.',
  },
];

const PDF_PRODUCTOS_BASE = [
  {
    nombre: 'Línea de Panadería Tradicional (dulces y salados)',
    descripcion: 'Variedad de panes artesanales de gran tamaño y alta durabilidad, elaborados con harinas premium. Incluye Pan del Abuelo, pan de maíz y pan dulce para consumo diario y bolsas familiares.',
    unidad: 'Unidad (pieza)',
    presentacion: 'Bolsa familiar surtida de 6-12 unidades o venta individual en mostrador',
  },
  {
    nombre: 'Línea de Hojaldres y Especialidades',
    descripcion: 'Croissants, palitos de queso, pastelitos y pan de sal especial horneados diariamente para consumo fresco en el casco urbano.',
    unidad: 'Unidad',
    presentacion: 'Empaque de papel grado alimentario o bolsas de 4 unidades',
  },
  {
    nombre: 'Repostería y Pastelería Institucional',
    descripcion: 'Tortas personalizadas, postres refrigerados y productos para eventos con conservación apoyada en vitrina refrigerada.',
    unidad: 'Unidad / porción',
    presentacion: 'Tortas enteras en caja protectora o postres en envase individual',
  },
];

const PDF_PROCESOS_BASE = [
  'Adquisición y recepción de insumos premium: harinas Tres Castillos y Elite, grasas selectas, azúcar, arequipe y levadura fresca.',
  'Alistamiento y pesaje con recetas tradicionales mejoradas para garantizar sabor, tamaño y durabilidad.',
  'Moldeo y figurado artesanal de panes, hojaldres y especialidades.',
  'Fermentación controlada con bandejas y estantes para crecimiento uniforme.',
  'Horneado tecnificado en horno rotativo industrial para color y textura constantes.',
  'Enfriamiento, control de calidad, empaque y registro POS / App para inventario en tiempo real.',
  'Distribución directa en el local y ruta móvil a veredas de difícil acceso.',
];

export function PlanNegocio({ ventas, gastos, productos, trabajadores, formatCurrency }: PlanNegocioProps) {
  const [generando, setGenerando] = useState(false);
  const [planGenerado, setPlanGenerado] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [ventasDiarias, setVentasDiarias] = useState<VentaDiaria[]>([]);
  const [activeTab, setActiveTab] = useState('crear-2026');
  const [seleccionCrear, setSeleccionCrear] = useState<SeleccionCrear>(() =>
    construirSeleccionCrear({
      productosErp: [],
      trabajadores: [],
      gastos: [],
      competidoresBase: PDF_COMPETIDORES_BASE,
      procesosBase: PDF_PROCESOS_BASE,
      productosBase: PDF_PRODUCTOS_BASE,
      cotizaciones: [
        { item: 'Adecuación de Panadería Móvil (Vitrinas, eléctrico)', proveedor: 'Metalmecánica Local', valor: '3500000' },
        { item: 'Equipos adicionales (Horno 10 latas, Amasadora)', proveedor: 'Equipos Industriales SAS', valor: '8000000' },
      ],
    })
  );

  /** Evita "$ NaN" y respeta modo claro/oscuro del módulo. */
  const money = (val: unknown) => {
    const n = typeof val === 'number' ? val : Number(val);
    return formatCurrency(Number.isFinite(n) ? n : 0);
  };

  // Estado del Formulario Fondo Emprender
  const [form, setForm] = useState({
    nombreIniciativa: 'Panadería Dulce Placer Fortalecimiento y Crecimiento Productivo',
    liderProyecto: 'Gonzalo Vibanco Rasero',
    localizacion: 'Canalete, Córdoba',
    sectorCiiu: '1081 - Elaboración de productos de panadería',
    categoriaSector: 'Economía Campesina · Agroindustria',
    tipoProyecto: 'Individual',
    lugarOperacion: 'Sí. Cuenta con lugar de operación en Canalete.',
    contrapartida: '10% en especie: Software ERP propio, mobiliario y herramientas (Valor aprox: $3.000.000)',
    perfilCliente: 'Mi cliente ideal es como un vecino de confianza de Canalete o de las veredas El Limón Regado, Nueva Vida, Mata Plátano, Buenos Aires, La Alicia y Paso del Mono. Son principalmente padres y madres de familia entre 25 y 60 años, de estratos 1 y 2. En el pueblo compran diario para desayuno o merienda; en las veredas compran bolsas grandes de pan variado con frecuencia semanal para alimentar a su familia y trabajadores del campo.',
    perfilConsumidor: 'Nuestros consumidores son habitantes de todas las edades de Canalete y de las veredas cercanas. En el casco urbano consumen pan fresco a diario; en el campo necesitan pan duradero que aguante varios días y sirva como bastimento para largas jornadas de trabajo.',
    problemaNecesidad: 'Las familias del casco urbano y de las veredas sufren por la falta de una oferta suficiente de panadería artesanal nutritiva y duradera. El pan industrial traído de Montería se percibe como “puro aire”, con químicos y poca duración. Dulce Placer responde con pan artesanal de alta frescura, mejor nutrición y resistencia para el transporte y el consumo rural.',
    ventajaCompetitiva: 'La ventaja competitiva de Dulce Placer es la convergencia entre ubicación estratégica frente al parque principal, calidad técnica premium con harinas seleccionadas y una capa digital propia (ERP/POS/IA) que ordena producción, ventas, inventario y crecimiento comercial.',
    descripcionProyecto: 'El proyecto consiste en el fortalecimiento técnico, operativo y comercial de la Panadería Dulce Placer en Canalete, Córdoba. Tras 5 años de trayectoria, busca escalar la capacidad de producción con horno rotativo industrial y una panadería andante para atender mejor el casco urbano y las veredas.',
    propuestaValorAyuda: 'A las familias rurales de las veredas y habitantes del casco urbano de Canalete que valoran la tradición y la nutrición.',
    propuestaValorQue: 'Sufren por la baja calidad y poca durabilidad del pan industrial externo y necesitan un alimento que rinda para sus jornadas diarias.',
    propuestaValorMediante: 'Producción artesanal tecnificada con insumos de alta gama, ubicación estratégica y logística de reparto apoyada en tecnología POS e IA.',
    competidores: PDF_COMPETIDORES_BASE,
    productosCrear: PDF_PRODUCTOS_BASE,
    procesosCrear: PDF_PROCESOS_BASE,
    fichasAutogeneradas: [] as any[],
    panaderiaMovil: { vehiculo: 'Motocarro o vehículo utilitario adaptado', rutas: 'Veredas y corregimientos sin acceso a pan fresco.', capacidad: 'Aprox. 500 unidades diarias.' },
    cotizaciones: [
      { item: 'Adecuación de Panadería Móvil (Vitrinas, eléctrico)', proveedor: 'Metalmecánica Local', valor: '3500000' },
      { item: 'Equipos adicionales (Horno 10 latas, Amasadora)', proveedor: 'Equipos Industriales SAS', valor: '8000000' }
    ],
    equipoTrabajo: '1 Administrador (Emprendedor), 2 Panaderos, 1 Conductor/Vendedor para ruta móvil.',
    estrategiaMercadeo: 'Marketing digital (WhatsApp, redes sociales), degustaciones en ruta de panadería móvil y alianzas con tiendas locales.',
    riesgos: [
      { riesgo: 'Alza en precios de harina y azúcar', mitigacion: 'Control exacto con ERP y compras al por mayor con proveedores fijos.' },
      { riesgo: 'Falla del vehículo móvil', mitigacion: 'Mantenimiento preventivo mensual y reserva técnica.' }
    ],
    capPsicologico: 'Resiliencia comprobada con 5 años de operación continua superando fluctuaciones del mercado.',
    capSoporte: 'ERP de gestión propio (IA) que controla recetas, costos y ventas.',
    capSemilla: 'Maquinaria industrial y adecuación de Panadería Móvil para expansión.',
    capSocial: 'Generación de 4 empleos formales y llevar alimento fresco a zonas rurales.',
    tramitesPendientes:
      '1. Constitución Legal (Matrícula Mercantil) — rubro NO financiable, a cargo del emprendedor.\n2. Certificado de Uso del Suelo.\n3. Concepto Sanitario (Secretaría de Salud / INVIMA).\n4. Certificado de Seguridad (Bomberos).\n5. Notificación Sanitaria de Productos (INVIMA), según aplique.',
    canalesPendientes:
      '1. Renovación de fachada y publicidad exterior (letrero iluminado frente al parque).\n2. Publicidad móvil (motocarro) y perifoneo en veredas.\n3. Material impreso, volantes y pauta en emisoras / Facebook locales de Canalete.\nPromoción: muestra de producto y entrega puerta a puerta.\nDistribución: punto de venta + a domicilio (panadería andante).',
    finanzasPendientes:
      'La proyección se fundamenta en 5 años de validación comercial en Canalete. Completar precios año 1, unidades mes a mes e IPC/IPP en el Excel oficial; aquí se marca la justificación y se cruzan costos/equipo del ERP.',
    registroFormal: 'Persona Natural con Establecimiento de Comercio',
    avanceLegal: 'Operación continua 5 años en Canalete; gestiones de formalización y permisos locales en curso según convocatoria CREAR.',
    avanceComercial: 'Ventas constantes en casco urbano y veredas; demanda validada que supera la capacidad actual.',
    avanceTecnico: 'Producción artesanal con recetas estandarizadas; pendiente escalar con horno rotativo y bandejas.',
    avanceAmbiental: 'Buenas prácticas de manejo de residuos y uso eficiente de energía en horneado; empaques familiares.',
    impactoEconomico: 'Aumento de producción y ventas, fortalecimiento de ingresos familiares y empleo local en Canalete.',
    impactoSocial: 'Alimento fresco y nutritivo para familias urbanas y rurales; generación de empleos directos.',
    impactoAmbiental: 'Mejora de eficiencia energética con horno industrial y control de merma con ERP.',
    impactoTecnologico: 'ERP/POS propio con IA para inventarios, costos y marketing; panadería móvil tecnificada.',
    mapaActores:
      'Proveedores de harina (Tres Castillos, Elite), Alcaldía de Canalete, SENA / Fondo Emprender, tiendas de vereda, emisoras locales, clientes del parque principal.',
    planOperativo:
      'Mes 1-2: adquisición horno/amasadora. Mes 2-3: adecuación panadería móvil. Mes 3-4: puesta de ruta a veredas y mercadeo. Mes 4-9: operación estabilizada y seguimiento de indicadores.',
    justificacionVentas:
      'Proyección basada en 5 años de ventas reales en Canalete y veredas aledañas; el fortalecimiento productivo (horno + ruta móvil) permite atender demanda reprimida sin cambiar el mix principal de tres líneas.',
  });

  useEffect(() => {
    const saved = localStorage.getItem('dulce_placer_fondo_emprender');
    if (saved) setPlanGenerado(saved);
    
    const savedForm = localStorage.getItem('dulce_placer_fe_form');
    if (savedForm) {
        try {
          const parsed = JSON.parse(savedForm) as Record<string, unknown>;
          setForm((prev) => {
            const movilPrev = prev.panaderiaMovil;
            const movilRaw = parsed.panaderiaMovil;
            const movil =
              movilRaw && typeof movilRaw === 'object'
                ? { ...movilPrev, ...(movilRaw as typeof movilPrev) }
                : movilPrev;
            return {
              ...prev,
              ...parsed,
              competidores: Array.isArray(parsed.competidores) ? parsed.competidores : prev.competidores,
              productosCrear: Array.isArray(parsed.productosCrear) ? parsed.productosCrear : prev.productosCrear,
              procesosCrear: Array.isArray(parsed.procesosCrear) ? parsed.procesosCrear : prev.procesosCrear,
              fichasAutogeneradas: Array.isArray(parsed.fichasAutogeneradas)
                ? parsed.fichasAutogeneradas
                : prev.fichasAutogeneradas,
              cotizaciones: Array.isArray(parsed.cotizaciones) ? parsed.cotizaciones : prev.cotizaciones,
              riesgos: Array.isArray(parsed.riesgos) ? parsed.riesgos : prev.riesgos,
              panaderiaMovil: movil,
            } as typeof prev;
          });
        } catch {
          /* formulario viejo ilegible: se conserva el valor inicial */
        }
    }
    
    setVentasDiarias(getVentasDiarias());

    try {
      const rawSel = localStorage.getItem('dulce_placer_fe_seleccion');
      const previa = rawSel ? (JSON.parse(rawSel) as SeleccionCrear) : null;
      setSeleccionCrear(
        construirSeleccionCrear({
          productosErp: productos,
          trabajadores,
          gastos,
          competidoresBase: PDF_COMPETIDORES_BASE,
          procesosBase: PDF_PROCESOS_BASE,
          productosBase: PDF_PRODUCTOS_BASE,
          cotizaciones: [
            { item: 'Adecuación de Panadería Móvil (Vitrinas, eléctrico)', proveedor: 'Metalmecánica Local', valor: '3500000' },
            { item: 'Equipos adicionales (Horno 10 latas, Amasadora)', proveedor: 'Equipos Industriales SAS', valor: '8000000' },
          ],
          previa,
        })
      );
    } catch {
      /* selección previa inválida */
    }
  }, []);

  // Refresca opciones cuando llegan datos del ERP, respetando lo ya marcado/desmarcado
  useEffect(() => {
    setSeleccionCrear((prev) =>
      construirSeleccionCrear({
        productosErp: productos,
        trabajadores,
        gastos,
        competidoresBase: Array.isArray(form.competidores) ? form.competidores : PDF_COMPETIDORES_BASE,
        procesosBase: Array.isArray(form.procesosCrear) ? form.procesosCrear : PDF_PROCESOS_BASE,
        productosBase: Array.isArray(form.productosCrear) ? form.productosCrear : PDF_PRODUCTOS_BASE,
        cotizaciones: Array.isArray(form.cotizaciones) ? form.cotizaciones : [],
        previa: prev,
      })
    );
  }, [productos, trabajadores, gastos, form.competidores, form.procesosCrear, form.productosCrear, form.cotizaciones]);

  const handleSave = () => {
    localStorage.setItem('dulce_placer_fondo_emprender', planGenerado);
    localStorage.setItem('dulce_placer_fe_form', JSON.stringify(form));
    localStorage.setItem('dulce_placer_fe_seleccion', JSON.stringify(seleccionCrear));
    setIsEditing(false);
    toast.success('¡Plan y selección guardados!');
  };

  const autogenerarFicha = (productoId: string) => {
    const prod = productos.find(p => p.id === productoId);
    if (!prod) return;
    const costo = prod.costoBase || prod.precioCosto || 0;
    const margen = prod.precioVenta > 0 ? ((prod.precioVenta - costo) / prod.precioVenta * 100).toFixed(1) : '0';
    
    const nuevaFicha = {
      id: prod.id,
      nombre: prod.nombre,
      descripcion: prod.descripcion || 'Producto de panadería',
      precioVenta: prod.precioVenta,
      costoBase: costo,
      margen: margen
    };
    
    setForm(prev => ({
      ...prev,
      fichasAutogeneradas: [...prev.fichasAutogeneradas.filter(f => f.id !== prod.id), nuevaFicha]
    }));
    toast.success(`Ficha técnica de ${prod.nombre} agregada.`);
  };

  // Métrica clave (Idéntico a original)
  const metricasClave = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const hoy = new Date();
    const mesActual = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}`;
    const numEmpleados = trabajadores.filter(t => t.estado === 'Activo').length;
    const numProductos = productos.length;

    const inicioMes = `${mesActual}-01`;
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
    const finMes = `${mesActual}-${pad(ultimoDia)}`;

    let ventasPOSMes = 0;
    const fechasConPOS = new Set<string>();
    ventas.forEach(v => {
      const f = (v.fecha || '').slice(0, 10);
      if (f >= inicioMes && f <= finMes) {
        ventasPOSMes += v.total;
        fechasConPOS.add(f);
      }
    });

    let ventasManualesMes = 0;
    ventasDiarias.forEach(v => {
      if (v.fecha >= inicioMes && v.fecha <= finMes && !fechasConPOS.has(v.fecha)) {
        ventasManualesMes += v.total;
      }
    });
    const ventasMesActual = ventasPOSMes + ventasManualesMes;

    const todasFechasConPOS = new Set<string>();
    let ventasPOSTotal = 0;
    ventas.forEach(v => {
      ventasPOSTotal += v.total;
      todasFechasConPOS.add(v.fecha.slice(0, 10));
    });

    let ventasManualesTotal = 0;
    ventasDiarias.forEach(v => {
      if (!todasFechasConPOS.has(v.fecha)) {
        ventasManualesTotal += v.total;
      }
    });
    const ingresosTotales = ventasPOSTotal + ventasManualesTotal;

    const gastosMesActual = gastos
      .filter(g => g.fecha.slice(0, 7) === mesActual)
      .reduce((s, g) => s + g.monto, 0);

    const cantidadVentas = ventas.length + ventasDiarias.filter(v => !todasFechasConPOS.has(v.fecha)).length;
    const ticketPromedio = cantidadVentas > 0 ? ingresosTotales / cantidadVentas : 0;

    // Métricas por método de pago
    const ventasMetodos = { Efectivo: ventasManualesTotal, Nequi: 0, Tarjeta: 0, Otros: 0 };
    ventas.forEach(v => {
      const met = v.metodo_pago || 'Efectivo';
      if (met === 'Efectivo') ventasMetodos.Efectivo += v.total;
      else if (met.toLowerCase().includes('nequi')) ventasMetodos.Nequi += v.total;
      else if (met.toLowerCase().includes('tarjeta')) ventasMetodos.Tarjeta += v.total;
      else ventasMetodos.Otros += v.total;
    });

    // Gastos fijos vs variables (mes actual)
    let gastosFijosMes = 0;
    let gastosVariablesMes = 0;
    gastos.filter(g => g.fecha.slice(0, 7) === mesActual).forEach(g => {
      const cat = (g.categoria || '').toLowerCase();
      if (cat.includes('fijo') || cat.includes('arriendo') || cat.includes('nómina') || cat.includes('servicio') || cat.includes('empleado')) {
        gastosFijosMes += g.monto;
      } else {
        gastosVariablesMes += g.monto;
      }
    });

    // Top 3 productos más vendidos históricamente
    const conteoProductos: Record<string, { nombre: string, cantidad: number, subtotal: number }> = {};
    ventas.forEach(v => {
      if (Array.isArray(v.items)) {
        v.items.forEach((item: Record<string, unknown>) => {
          const productoId = String(item.producto_id ?? item.productoId ?? item.id ?? '');
          if (!productoId) return;
          const nombre = String(item.nombre ?? item.productoNombre ?? 'Producto');
          const cantidad = Number(item.cantidad) || 0;
          const precioRaw = [
            item.precioUnitario,
            item.precio_unitario,
            item.precio,
            item.precioVenta,
            item.precio_venta,
            item.valorUnitario,
          ]
            .map((x) => Number(x))
            .find((n) => Number.isFinite(n) && n > 0);
          const precioUnit = precioRaw ?? 0;
          const subRaw = Number(item.subtotal);
          const totRaw = Number(item.total);
          const lineaCalc =
            Number.isFinite(subRaw) && subRaw > 0
              ? subRaw
              : Number.isFinite(totRaw) && totRaw > 0
                ? totRaw
                : cantidad > 0 && precioUnit > 0
                  ? cantidad * precioUnit
                  : 0;
          const linea = Number.isFinite(lineaCalc) ? lineaCalc : 0;
          if (!conteoProductos[productoId]) {
            conteoProductos[productoId] = { nombre, cantidad: 0, subtotal: 0 };
          }
          conteoProductos[productoId].cantidad += cantidad;
          conteoProductos[productoId].subtotal += Number.isFinite(linea) ? linea : 0;
          if (!conteoProductos[productoId].nombre || conteoProductos[productoId].nombre === 'Producto') {
            conteoProductos[productoId].nombre = nombre;
          }
        });
      }
    });
    const topProductos = Object.values(conteoProductos)
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 3);

    return {
      ingresosTotales,
      empleados: numEmpleados,
      productosActivos: numProductos,
      ventasMesActual,
      gastosMesActual,
      gastosFijosMes,
      gastosVariablesMes,
      cantidadVentas,
      ticketPromedio,
      ventasMetodos,
      topProductos,
      margenAprox: ventasMesActual > 0 ? ((ventasMesActual - gastosMesActual) / ventasMesActual) * 100 : 0
    };
  }, [ventas, ventasDiarias, gastos, productos, trabajadores]);

  const competidoresSafe = Array.isArray(form.competidores) ? form.competidores : PDF_COMPETIDORES_BASE;
  const productosCrearSafe = Array.isArray(form.productosCrear) ? form.productosCrear : PDF_PRODUCTOS_BASE;
  const procesosCrearSafe = Array.isArray(form.procesosCrear) ? form.procesosCrear : PDF_PROCESOS_BASE;
  const fichasSafe = Array.isArray(form.fichasAutogeneradas) ? form.fichasAutogeneradas : [];
  const cotizacionesSafe = Array.isArray(form.cotizaciones) ? form.cotizaciones : [];
  const riesgosSafe = Array.isArray(form.riesgos) ? form.riesgos : [];
  const catalogoElaborados = Array.isArray(productos) ? productos.filter((p) => p.tipo === 'elaborado') : [];
  const totalSolicitado = cotizacionesSafe.reduce((acc, curr) => acc + (parseFloat(curr.valor) || 0), 0);

  const generarPlan = async () => {
    if (totalSolicitado <= 0) {
      toast.error('Agrega al menos una cotización en el Módulo de Desarrollo.');
      setActiveTab('modulo-5');
      return;
    }

    setGenerando(true);
    setPlanGenerado('');
    localStorage.setItem('dulce_placer_fe_form', JSON.stringify(form));
    
    const contextoData = { ...metricasClave, form, totalSolicitado };

    const prompt = `Actúa como un experto formulador de proyectos MBA especializado en Fondo Emprender SENA.
Escribe un Plan de Negocios ejecutivo y altamente convincente para la Panadería "Dulce Placer" ubicada en ${form.localizacion}.

Usa estrictamente la metodología Fondo Emprender y el Modelo 4K del SENA. Basate EXCLUSIVAMENTE en estos datos de nuestro ERP y del formulario:

* MÓDULO 1 (Datos): CIIU: ${form.sectorCiiu}. Contrapartida 10%: ${form.contrapartida}.
* MÓDULO 2 (Protagonista): Cliente: ${form.perfilCliente}. Consumidor: ${form.perfilConsumidor}.
* MÓDULO 3 (Mercado): Competidores: ${JSON.stringify(form.competidores)}. (Justifica cómo nuestro ERP y estandarización nos hace superiores a la competencia empírica).
* MÓDULO 4 (Solución): ${fichasSafe.length} fichas técnicas clave: ${JSON.stringify(fichasSafe)}. Panadería Móvil: ${JSON.stringify(form.panaderiaMovil)}.
* MÓDULO 5 (Desarrollo): Total solicitado: ${formatCurrency(totalSolicitado)}. Cotizaciones base: ${JSON.stringify(form.cotizaciones)}. Equipo: ${form.equipoTrabajo}.
* MÓDULO 6 (Futuro): Mercadeo: ${form.estrategiaMercadeo}.
* MÓDULO 7 (Riesgos): Riesgos y mitigación: ${JSON.stringify(form.riesgos)}.
* MODELO 4K SENA:
  - Psicológico: ${form.capPsicologico}
  - Soporte: ${form.capSoporte}
  - Semilla: ${form.capSemilla}
  - Social: ${form.capSocial}

REGLA DE ORO (INQUEBRANTABLE):
Los siguientes datos numéricos provienen directamente de nuestra base de datos. DEBES USARLOS EXACTAMENTE COMO ESTÁN ESCRITOS. ESTÁ ESTRICTAMENTE PROHIBIDO ALTERARLOS, REDONDEARLOS O INVENTAR OTROS NÚMEROS AL REDACTAR EL DOCUMENTO.

Métricas ERP Históricas Reales (Ventaja competitiva tecnológica de Dulce Placer):
- Ingresos registrados totales: ${formatCurrency(metricasClave.ingresosTotales)}
- Ventas mes actual: ${formatCurrency(metricasClave.ventasMesActual)}
- Ticket Promedio: ${formatCurrency(metricasClave.ticketPromedio)}
- Margen Operativo: ${metricasClave.margenAprox.toFixed(1)}%
- Gastos Fijos (mes): ${formatCurrency(metricasClave.gastosFijosMes)}
- Gastos Operativos/Insumos (mes): ${formatCurrency(metricasClave.gastosVariablesMes)}
- Top 3 Productos Estrella: ${metricasClave.topProductos.map(p => `${p.nombre} (${p.cantidad} uds)`).join(', ')}
- Tendencia de pagos (Efectivo vs Digital): Efectivo ${formatCurrency(metricasClave.ventasMetodos.Efectivo)}, Digital (Nequi/Tarjeta) ${formatCurrency(metricasClave.ventasMetodos.Nequi + metricasClave.ventasMetodos.Tarjeta)}
- Cantidad de Productos Estandarizados: ${metricasClave.productosActivos}

ESTRUCTURA OBLIGATORIA DEL PLAN GENERADO (Markdown):
Eres un estructurador profesional de proyectos (MBA). Exijo que redactes un documento sumamente FORMAL, TÉCNICO y ESTRUCTURADO.
Cada sección debe estar profundamente desarrollada usando viñetas, tablas markdown, negritas para conceptos clave y un lenguaje ejecutivo.
NO OMITAS los Objetivos.

# Plan de Negocio Estructurado: Panadería Dulce Placer

## Resumen Ejecutivo
(Redacta al menos 3 párrafos potentes que resuman la trayectoria de 5 años, la ventaja competitiva tecnológica (ERP propio), los ingresos reales demostrables y la solicitud de capital).

## 1. Naturaleza y Datos Generales del Proyecto
- **Misión y Visión:** (Defínelas basándote en la innovación y estandarización de procesos).
- **Objetivos:** (General y Específicos claros y medibles).
- **Datos:** CIIU, Localización y Contrapartida.

## 2. ¿Quién es el Protagonista? (Análisis de Clientes y Consumidores)
(Define técnica y sociodemográficamente al cliente y consumidor. Usa viñetas para separar perfiles).

## 3. ¿Existe Oportunidad en el Mercado? (Análisis Competitivo)
(Analiza profundamente la competencia empírica. Subraya de manera categórica cómo nuestro ERP de IA y nuestras métricas financieras registradas destruyen cualquier ventaja que tenga la competencia local).

## 4. ¿Cuál es mi Solución? (Innovación y Portafolio)
(Desarrolla la estrategia de la Panadería Móvil. Menciona nuestro catálogo exacto de ${metricasClave.productosActivos} productos estandarizados y presenta las fichas técnicas y los productos estrella).

## 5. ¿Cómo Desarrollo mi Solución? (Requerimientos de Inversión y Operación)
(Estructura el plan operativo: menciona la inversión exacta solicitada, el desglose de cotizaciones y el equipo de trabajo requerido).

## 6. ¿Cuál es el Futuro de mi Negocio? (Estrategia de Crecimiento)
(Desarrolla el plan de mercadeo, expansión territorial y proyecciones de adopción de pagos digitales).

## 7. ¿Qué Riesgos Enfrento? (Matriz de Mitigación)
(Crea una tabla o sub-sección clara con los riesgos identificados y la estrategia exacta para mitigarlos operativamente).

## 8. Alineación Modelo 4K (Metodología SENA)
- **Capital Psicológico:** (Resiliencia de 5 años).
- **Capital Soporte:** (Redes y equipo).
- **Capital Semilla:** (Uso del recurso).
- **Capital Social:** (Impacto en Canalete y empleos).

## 9. Análisis Financiero Soportado en ERP (Conclusión del Proyecto)
(Esta es la sección más importante. Cierra el documento demostrando la viabilidad a través de nuestros datos reales: Menciona explícitamente nuestros Ingresos históricos, la relación entre Gastos Fijos y Variables, y el volumen de nuestros Productos Estrella. Usa las cifras exactas indicadas en la Regla de Oro. El ERP es nuestra mayor garantía de escalabilidad).`;

    let promptFinal = prompt;

    try {
      await consultarAgente(
        'pico-claw',
        promptFinal,
        (chunk) => { setPlanGenerado(prev => prev + chunk); },
        undefined,
        JSON.stringify(contextoData)
      );
      toast.success('¡Plan estructurado! Revisa la pestaña de Generación.');
      setActiveTab('generacion');
    } catch (error) {
      toast.error('Error al generar el plan con IA');
    } finally {
      setGenerando(false);
    }
  };

  const descargarMarkdown = () => {
    const blob = new Blob([planGenerado], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Plan_Negocios_Fondo_Emprender.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto pb-32">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-indigo-500 flex items-center gap-3">
            <Target className="h-8 w-8 text-emerald-500" />
            Fondo Emprender SENA
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Asistente estructurado bajo los 7 módulos oficiales y el Modelo 4K.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-emerald-500/10 border-emerald-500/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-emerald-500/20 rounded-xl">
              <TrendingUp className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-emerald-700 dark:text-emerald-400/80 font-bold uppercase">Tracción Mensual</p>
              <p className="text-xl font-black text-emerald-900 dark:text-emerald-100">{money(metricasClave.ventasMesActual)}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-indigo-500/10 border-indigo-500/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-indigo-500/20 rounded-xl">
              <DollarSign className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-xs text-indigo-700 dark:text-indigo-400/80 font-bold uppercase">Capital Semilla Solicitado</p>
              <p className="text-xl font-black text-indigo-900 dark:text-indigo-100">{money(totalSolicitado)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-500/10 border-blue-500/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <ShieldCheck className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-blue-700 dark:text-blue-400/80 font-bold uppercase">Operación Demostrada</p>
              <p className="text-xl font-black text-blue-900 dark:text-blue-100">5 Años</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-500/10 border-amber-500/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-amber-500/20 rounded-xl">
              <Factory className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-amber-700 dark:text-amber-400/80 font-bold uppercase">Ventaja Competitiva</p>
              <p className="text-sm font-black text-amber-900 dark:text-amber-100 mt-1">ERP y POS Propio (IA)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full h-auto flex flex-wrap bg-slate-200/90 dark:bg-slate-900/80 p-1 mb-6 border border-slate-300/80 dark:border-white/10 rounded-2xl text-slate-700 dark:text-slate-300">
          <TabsTrigger value="auditoria-erp" className="flex-1 py-3 text-xs sm:text-sm data-[state=active]:bg-cyan-600 data-[state=active]:text-white dark:data-[state=active]:bg-cyan-500/20 dark:data-[state=active]:text-cyan-300 rounded-xl">Auditoría ERP (Real)</TabsTrigger>
          <TabsTrigger value="crear-2026" className="flex-1 py-3 text-xs sm:text-sm data-[state=active]:bg-emerald-700 data-[state=active]:text-white dark:data-[state=active]:bg-emerald-500/20 dark:data-[state=active]:text-emerald-300 rounded-xl">CREAR 2026</TabsTrigger>
          <TabsTrigger value="modulos-1-3" className="flex-1 py-3 text-xs sm:text-sm data-[state=active]:bg-indigo-600 data-[state=active]:text-white dark:data-[state=active]:bg-indigo-500/20 dark:data-[state=active]:text-indigo-300 rounded-xl">Módulos 1-3 (Mercado)</TabsTrigger>
          <TabsTrigger value="modulo-4" className="flex-1 py-3 text-xs sm:text-sm data-[state=active]:bg-emerald-600 data-[state=active]:text-white dark:data-[state=active]:bg-emerald-500/20 dark:data-[state=active]:text-emerald-300 rounded-xl">Módulo 4 (Solución/Fichas)</TabsTrigger>
          <TabsTrigger value="modulo-5" className="flex-1 py-3 text-xs sm:text-sm data-[state=active]:bg-amber-600 data-[state=active]:text-white dark:data-[state=active]:bg-amber-500/20 dark:data-[state=active]:text-amber-300 rounded-xl">Módulos 5-7 (Crecimiento)</TabsTrigger>
          <TabsTrigger value="modelo-4k" className="flex-1 py-3 text-xs sm:text-sm data-[state=active]:bg-blue-600 data-[state=active]:text-white dark:data-[state=active]:bg-blue-500/20 dark:data-[state=active]:text-blue-300 rounded-xl">Modelo 4K SENA</TabsTrigger>
          <TabsTrigger value="pitch-nda" className="flex-1 py-3 text-xs sm:text-sm data-[state=active]:bg-purple-600 data-[state=active]:text-white dark:data-[state=active]:bg-purple-500/20 dark:data-[state=active]:text-purple-300 rounded-xl">Pitch & NDA</TabsTrigger>
          <TabsTrigger value="generacion" className="flex-1 py-3 text-xs sm:text-sm data-[state=active]:bg-pink-600 data-[state=active]:text-white dark:data-[state=active]:bg-pink-500/20 dark:data-[state=active]:text-pink-300 rounded-xl flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4" /> Generar Plan
          </TabsTrigger>
        </TabsList>

        {/* ========================================================= */}
        {/* TAB 0: Auditoría ERP */}
        {/* ========================================================= */}
        <TabsContent value="auditoria-erp" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="border-cyan-600/30 bg-cyan-50 dark:bg-cyan-950/40 dark:border-cyan-500/30 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-cyan-800 dark:text-cyan-300">
                  <TrendingUp className="w-5 h-5"/> Gastos: Fijos vs Variables
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center border-b border-cyan-200/80 dark:border-white/10 pb-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Gastos Fijos (Mes)</span>
                  <span className="font-bold text-slate-900 dark:text-white">{money(metricasClave.gastosFijosMes)}</span>
                </div>
                <div className="flex justify-between items-center border-b border-cyan-200/80 dark:border-white/10 pb-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Gastos Variables/Operativos</span>
                  <span className="font-bold text-slate-900 dark:text-white">{money(metricasClave.gastosVariablesMes)}</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Total Gastos</span>
                  <span className="font-black text-cyan-800 dark:text-cyan-300">{money(metricasClave.gastosMesActual)}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-cyan-600/30 bg-cyan-50 dark:bg-cyan-950/40 dark:border-cyan-500/30 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-cyan-800 dark:text-cyan-300">
                  <Star className="w-5 h-5"/> Top 3 Productos Estrella
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {metricasClave.topProductos.map((p, idx) => (
                  <div key={idx} className="flex justify-between items-center border-b border-cyan-200/80 dark:border-white/10 pb-2 last:border-0 last:pb-0">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">{p.nombre}</span>
                      <span className="text-xs text-slate-600 dark:text-slate-400">{p.cantidad} unidades vendidas</span>
                    </div>
                    <span className="font-black text-emerald-700 dark:text-emerald-400">{money(p.subtotal)}</span>
                  </div>
                ))}
                {metricasClave.topProductos.length === 0 && (
                  <div className="text-sm text-slate-600 dark:text-slate-400 italic">No hay suficientes ventas registradas.</div>
                )}
              </CardContent>
            </Card>

            <Card className="border-cyan-600/30 bg-cyan-50 dark:bg-cyan-950/40 dark:border-cyan-500/30 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-cyan-800 dark:text-cyan-300">
                  <Wallet className="w-5 h-5"/> Métodos de Pago
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center border-b border-cyan-200/80 dark:border-white/10 pb-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Efectivo</span>
                  <span className="font-bold text-slate-900 dark:text-white">{money(metricasClave.ventasMetodos.Efectivo)}</span>
                </div>
                <div className="flex justify-between items-center border-b border-cyan-200/80 dark:border-white/10 pb-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Nequi / Bancolombia</span>
                  <span className="font-bold text-slate-900 dark:text-white">{money(metricasClave.ventasMetodos.Nequi)}</span>
                </div>
                <div className="flex justify-between items-center border-b border-cyan-200/80 dark:border-white/10 pb-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Tarjetas</span>
                  <span className="font-bold text-slate-900 dark:text-white">{money(metricasClave.ventasMetodos.Tarjeta)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="bg-cyan-100 dark:bg-cyan-500/10 border border-cyan-400/50 dark:border-cyan-500/30 p-4 rounded-xl mt-6">
            <p className="text-sm text-cyan-950 dark:text-cyan-100 flex items-start gap-2">
              <Database className="w-5 h-5 text-cyan-700 dark:text-cyan-400 shrink-0 mt-0.5" />
              <span>Esta es la información extraída directamente de la base de datos de la aplicación. Estos datos formarán la columna vertebral de tu Plan de Negocios (Módulo 9 de Análisis Financiero), dándole respaldo real y profesional ante inversionistas.</span>
            </p>
          </div>
        </TabsContent>

        {/* ========================================================= */}
        {/* TAB CREAR 2026 */}
        {/* ========================================================= */}
        <TabsContent value="crear-2026" className="space-y-6">
          <CrearExpedienteExcel
            form={form}
            setForm={(next) => setForm((prev) => ({ ...prev, ...next }))}
            seleccion={seleccionCrear}
            onSeleccionChange={(next) => {
              setSeleccionCrear(next);
              localStorage.setItem('dulce_placer_fe_seleccion', JSON.stringify(next));
            }}
            formatCurrency={money}
            onGuardar={handleSave}
            onIrModulo={setActiveTab}
          />
        </TabsContent>

        {/* ========================================================= */}
        {/* TAB 1: Módulos 1 a 3 */}
        {/* ========================================================= */}
        <TabsContent value="modulos-1-3" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-white/5 bg-card/30 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-indigo-700 dark:text-indigo-400"><MapPin className="w-5 h-5"/> Módulo 1: Datos Generales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Localización</Label>
                  <Input value={form.localizacion} onChange={e => setForm({...form, localizacion: e.target.value})} className="bg-background/50 border-white/5"/>
                </div>
                <div className="space-y-2">
                  <Label>Sector CIIU</Label>
                  <Input value={form.sectorCiiu} onChange={e => setForm({...form, sectorCiiu: e.target.value})} className="bg-background/50 border-white/5"/>
                </div>
                <div className="space-y-2">
                  <Label>Aporte Contrapartida (Tú pones el 10%)</Label>
                  <Textarea value={form.contrapartida} onChange={e => setForm({...form, contrapartida: e.target.value})} className="h-20 bg-background/50 border-white/5 resize-none"/>
                  <p className="text-xs text-muted-foreground">Ej: Software ERP, muebles, experiencia adquirida.</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/5 bg-card/30 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-indigo-700 dark:text-indigo-400"><Users className="w-5 h-5"/> Módulo 2: Protagonista</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Perfil del Cliente (Quien paga)</Label>
                  <Textarea value={form.perfilCliente} onChange={e => setForm({...form, perfilCliente: e.target.value})} className="h-24 bg-background/50 border-white/5 resize-none"/>
                </div>
                <div className="space-y-2">
                  <Label>Perfil del Consumidor (Quien come)</Label>
                  <Textarea value={form.perfilConsumidor} onChange={e => setForm({...form, perfilConsumidor: e.target.value})} className="h-24 bg-background/50 border-white/5 resize-none"/>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/5 bg-card/30 backdrop-blur-md lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-indigo-700 dark:text-indigo-400"><Search className="w-5 h-5"/> Módulo 3: Competencia</CardTitle>
                <CardDescription>Analiza quiénes venden pan en tu zona y por qué tú eres mejor.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {competidoresSafe.map((comp, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-white/5 rounded-xl border border-white/5 relative">
                    <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6 text-red-400 hover:bg-red-500/20" 
                      onClick={() => setForm({...form, competidores: form.competidores.filter((_, i) => i !== idx)})}>
                      <Trash2 className="w-4 h-4"/>
                    </Button>
                    <div className="space-y-2">
                      <Label>Competidor</Label>
                      <Input value={comp.nombre} onChange={e => {
                        const newC = [...form.competidores]; newC[idx].nombre = e.target.value; setForm({...form, competidores: newC});
                      }} className="bg-background/50"/>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Fortalezas</Label>
                      <Input value={comp.fortalezas} onChange={e => {
                        const newC = [...form.competidores]; newC[idx].fortalezas = e.target.value; setForm({...form, competidores: newC});
                      }} className="bg-background/50"/>
                    </div>
                    <div className="space-y-2">
                      <Label>Debilidades</Label>
                      <Input value={comp.debilidades} onChange={e => {
                        const newC = [...form.competidores]; newC[idx].debilidades = e.target.value; setForm({...form, competidores: newC});
                      }} className="bg-background/50"/>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setForm({...form, competidores: [...form.competidores, {nombre:'', fortalezas:'', debilidades:''}]})} className="border-indigo-500/30 text-indigo-400">
                  <Plus className="w-4 h-4 mr-2" /> Agregar Competidor
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ========================================================= */}
        {/* TAB 2: Módulo 4 (Solución / Fichas) */}
        {/* ========================================================= */}
        <TabsContent value="modulo-4" className="space-y-6">
          <Card className="border-white/5 bg-card/30 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-emerald-700 dark:text-emerald-400"><Presentation className="w-5 h-5"/> Módulo 4: Fichas Técnicas (Solución)</CardTitle>
              <CardDescription>Genera fichas técnicas automáticamente desde tus recetas del ERP para adjuntar al plan.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-4">
                <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-2"><Truck className="w-4 h-4" /> Panadería Móvil (Nuevo Canal)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Vehículo / Medio</Label>
                    <Input value={form.panaderiaMovil?.vehiculo ?? ''} onChange={e => setForm({...form, panaderiaMovil: {...(form.panaderiaMovil ?? { vehiculo: '', rutas: '', capacidad: '' }), vehiculo: e.target.value}})} className="bg-background/50"/>
                  </div>
                  <div className="space-y-2">
                    <Label>Rutas / Cobertura</Label>
                    <Input value={form.panaderiaMovil?.rutas ?? ''} onChange={e => setForm({...form, panaderiaMovil: {...(form.panaderiaMovil ?? { vehiculo: '', rutas: '', capacidad: '' }), rutas: e.target.value}})} className="bg-background/50"/>
                  </div>
                  <div className="space-y-2">
                    <Label>Capacidad de Venta Diaria</Label>
                    <Input value={form.panaderiaMovil?.capacidad ?? ''} onChange={e => setForm({...form, panaderiaMovil: {...(form.panaderiaMovil ?? { vehiculo: '', rutas: '', capacidad: '' }), capacidad: e.target.value}})} className="bg-background/50"/>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                  <div className="flex-1 space-y-2">
                    <Label>Selecciona un producto del catálogo para autogenerar su ficha</Label>
                    <Select onValueChange={autogenerarFicha}>
                      <SelectTrigger className="bg-background/50 border-white/5">
                        <SelectValue placeholder="Seleccionar producto..." />
                      </SelectTrigger>
                      <SelectContent>
                        {catalogoElaborados.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {fichasSafe.map((f, i) => (
                    <div key={i} className="p-4 bg-emerald-50 dark:bg-white/5 border border-emerald-200 dark:border-white/10 rounded-xl relative">
                       <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6 text-red-500 hover:bg-red-500/20" 
                        onClick={() => setForm({...form, fichasAutogeneradas: form.fichasAutogeneradas.filter((_, idx) => idx !== i)})}>
                        <X className="w-4 h-4"/>
                      </Button>
                      <h4 className="font-bold text-emerald-800 dark:text-emerald-400 text-sm mb-2">{f.nombre}</h4>
                      <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2 mb-3">{f.descripcion}</p>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-600 dark:text-muted-foreground">Costo: <strong className="text-slate-900 dark:text-white">{money(f.costoBase)}</strong></span>
                        <span className="text-slate-600 dark:text-muted-foreground">Venta: <strong className="text-slate-900 dark:text-white">{money(f.precioVenta)}</strong></span>
                      </div>
                      <div className="mt-2 text-xs bg-emerald-500/15 text-emerald-800 dark:text-emerald-400 p-1.5 rounded text-center font-bold">
                        Margen Bruto: {f.margen}%
                      </div>
                    </div>
                  ))}
                  {fichasSafe.length === 0 && (
                    <div className="col-span-full py-8 text-center border border-dashed border-white/20 rounded-xl text-muted-foreground text-sm">
                      No has agregado fichas técnicas. Selecciona un producto arriba.
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================= */}
        {/* TAB 3: Módulos 5, 6 y 7 */}
        {/* ========================================================= */}
        <TabsContent value="modulo-5" className="space-y-6">
          <Card className="border-white/5 bg-card/30 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-amber-800 dark:text-amber-400"><DollarSign className="w-5 h-5"/> Módulo 5: Desarrollo (3 Cotizaciones)</CardTitle>
              <CardDescription>Para que el Fondo apruebe, necesitas sustentar la inversión con cotizaciones reales.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {cotizacionesSafe.map((cot, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 bg-white/5 rounded-xl border border-white/5 relative">
                  <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6 text-red-400 hover:bg-red-500/20" 
                    onClick={() => setForm({...form, cotizaciones: form.cotizaciones.filter((_, i) => i !== idx)})}>
                    <Trash2 className="w-4 h-4"/>
                  </Button>
                  <div className="space-y-2 md:col-span-5">
                    <Label>Item a Financiar (Ej. Horno)</Label>
                    <Input value={cot.item} onChange={e => {
                      const newC = [...form.cotizaciones]; newC[idx].item = e.target.value; setForm({...form, cotizaciones: newC});
                    }} className="bg-background/50"/>
                  </div>
                  <div className="space-y-2 md:col-span-4">
                    <Label>Proveedor</Label>
                    <Input value={cot.proveedor} onChange={e => {
                      const newC = [...form.cotizaciones]; newC[idx].proveedor = e.target.value; setForm({...form, cotizaciones: newC});
                    }} className="bg-background/50"/>
                  </div>
                  <div className="space-y-2 md:col-span-3">
                    <Label>Valor Total ($)</Label>
                    <Input type="number" value={cot.valor} onChange={e => {
                      const newC = [...form.cotizaciones]; newC[idx].valor = e.target.value; setForm({...form, cotizaciones: newC});
                    }} className="bg-background/50"/>
                  </div>
                </div>
              ))}
              <div className="flex justify-between items-center mt-2">
                <Button variant="outline" size="sm" onClick={() => setForm({...form, cotizaciones: [...form.cotizaciones, {item:'', proveedor:'', valor:''}]})} className="border-amber-500/30 text-amber-400">
                  <Plus className="w-4 h-4 mr-2" /> Agregar Cotización
                </Button>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground uppercase font-bold">Total Solicitado</p>
                  <p className="text-xl font-black text-amber-800 dark:text-amber-400">{money(totalSolicitado)}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5 mt-4">
                <Label>Equipo de Trabajo Proyectado</Label>
                <Textarea value={form.equipoTrabajo} onChange={e => setForm({...form, equipoTrabajo: e.target.value})} className="mt-2 h-20 bg-background/50 border-white/5 resize-none"/>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-white/5 bg-card/30 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-amber-800 dark:text-amber-400"><TrendingUp className="w-5 h-5"/> Módulo 6: Futuro</CardTitle>
              </CardHeader>
              <CardContent>
                <Label>Estrategia de Crecimiento y Mercadeo</Label>
                <Textarea value={form.estrategiaMercadeo} onChange={e => setForm({...form, estrategiaMercadeo: e.target.value})} className="mt-2 h-24 bg-background/50 border-white/5 resize-none"/>
              </CardContent>
            </Card>

            <Card className="border-white/5 bg-card/30 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-amber-800 dark:text-amber-400"><AlertTriangle className="w-5 h-5"/> Módulo 7: Riesgos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {riesgosSafe.map((r, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3 bg-white/5 rounded-xl border border-white/5 relative">
                    <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-5 w-5 text-red-400 hover:bg-red-500/20" 
                      onClick={() => setForm({...form, riesgos: form.riesgos.filter((_, i) => i !== idx)})}>
                      <Trash2 className="w-3 h-3"/>
                    </Button>
                    <div className="space-y-1">
                      <Label className="text-xs">Riesgo (Qué puede pasar)</Label>
                      <Input value={r.riesgo} onChange={e => {
                        const newR = [...form.riesgos]; newR[idx].riesgo = e.target.value; setForm({...form, riesgos: newR});
                      }} className="bg-background/50 h-8 text-xs"/>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Mitigación (Qué harás)</Label>
                      <Input value={r.mitigacion} onChange={e => {
                        const newR = [...form.riesgos]; newR[idx].mitigacion = e.target.value; setForm({...form, riesgos: newR});
                      }} className="bg-background/50 h-8 text-xs"/>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setForm({...form, riesgos: [...form.riesgos, {riesgo:'', mitigacion:''}]})} className="border-amber-500/30 text-amber-400 w-full">
                  <Plus className="w-4 h-4 mr-2" /> Agregar Riesgo
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ========================================================= */}
        {/* TAB 4: Modelo 4K */}
        {/* ========================================================= */}
        <TabsContent value="modelo-4k" className="space-y-6">
          <Card className="border-blue-600/30 bg-blue-50 dark:bg-blue-950/40 dark:border-blue-500/30 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-blue-800 dark:text-blue-300"><Heart className="w-5 h-5"/> Modelo 4K del SENA</CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">Este es el corazón del Fondo Emprender. Define tus 4 capitales.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-blue-800 dark:text-blue-300 font-bold">1. Capital Psicológico</Label>
                <Textarea value={form.capPsicologico} onChange={e => setForm({...form, capPsicologico: e.target.value})} className="h-24 bg-background/50 border-slate-200 dark:border-white/5 resize-none text-slate-900 dark:text-slate-100"/>
                <p className="text-[10px] text-slate-600 dark:text-muted-foreground">Tu resiliencia, motivación, historia emprendedora.</p>
              </div>
              <div className="space-y-2">
                <Label className="text-indigo-800 dark:text-indigo-300 font-bold">2. Capital de Soporte</Label>
                <Textarea value={form.capSoporte} onChange={e => setForm({...form, capSoporte: e.target.value})} className="h-24 bg-background/50 border-slate-200 dark:border-white/5 resize-none text-slate-900 dark:text-slate-100"/>
                <p className="text-[10px] text-slate-600 dark:text-muted-foreground">Tus redes, asesores, sistema ERP propio.</p>
              </div>
              <div className="space-y-2">
                <Label className="text-emerald-800 dark:text-emerald-300 font-bold">3. Capital Semilla</Label>
                <Textarea value={form.capSemilla} onChange={e => setForm({...form, capSemilla: e.target.value})} className="h-24 bg-background/50 border-slate-200 dark:border-white/5 resize-none text-slate-900 dark:text-slate-100"/>
                <p className="text-[10px] text-slate-600 dark:text-muted-foreground">Los recursos tangibles e intangibles que necesitas.</p>
              </div>
              <div className="space-y-2">
                <Label className="text-pink-800 dark:text-pink-300 font-bold">4. Capital Social</Label>
                <Textarea value={form.capSocial} onChange={e => setForm({...form, capSocial: e.target.value})} className="h-24 bg-background/50 border-slate-200 dark:border-white/5 resize-none text-slate-900 dark:text-slate-100"/>
                <p className="text-[10px] text-slate-600 dark:text-muted-foreground">El impacto en la comunidad de Canalete, generación de empleo.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>


        {/* ========================================================= */}
        {/* TAB Pitch & NDA */}
        {/* ========================================================= */}
        <TabsContent value="pitch-nda" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-purple-600/30 bg-purple-50 dark:bg-purple-950/30 dark:border-purple-500/30 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-purple-800 dark:text-purple-400"><Timer className="w-5 h-5"/> Pitch: Regla Lata Coca-Cola (2 Min)</CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-400">Explica tu negocio de forma segura sin revelar tu propiedad intelectual.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-slate-800 dark:text-slate-300">
                <div className="bg-white/80 dark:bg-background/50 p-4 rounded-xl border border-purple-200/70 dark:border-white/5 space-y-3">
                  <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">Minuto 1: Problema y Oportunidad</h4>
                  <p className="italic text-slate-700 dark:text-slate-300">"En {form.localizacion}, nuestro cliente principal son {form.perfilCliente}. Hemos identificado que los competidores tienen debilidades como: {competidoresSafe.map(c=>c.debilidades).join(', ')}. Este es un mercado desatendido al que Dulce Placer, con 5 años de operación, le ofrece una solución de alta calidad."</p>
                </div>
                <div className="bg-white/80 dark:bg-background/50 p-4 rounded-xl border border-purple-200/70 dark:border-white/5 space-y-3">
                  <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">Minuto 2: Solución e Inversión</h4>
                  <p className="italic text-slate-700 dark:text-slate-300">"Por eso, integramos productos tradicionales y nuestro nuevo canal: {form.panaderiaMovil?.vehiculo || 'ruta móvil'} para llegar a más zonas. Contamos con un ERP propio que nos da eficiencia técnica superior. Hoy solicitamos {money(totalSolicitado)} para {cotizacionesSafe.map(c=>c.item).join(', ')}. Con esto generaremos empleos y consolidaremos un crecimiento escalable."</p>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-white/5 bg-card/30 backdrop-blur-md">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-slate-800 dark:text-slate-200"><MonitorPlay className="w-5 h-5"/> Guion: Demo del Sistema (Caja Negra)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                  <p><strong>Si te preguntan cómo funciona tu software:</strong></p>
                  <p className="italic border-l-2 border-slate-300 dark:border-slate-500 pl-3 text-slate-600 dark:text-slate-400">"Nuestro ERP está diseñado para optimizar la producción y reducir mermas. Integra gestión de inventarios y recetas. Es una herramienta desarrollada a partir de nuestra experiencia de 5 años. Los detalles técnicos de su lógica son propiedad intelectual (Know-how), pero el resultado es que nos permite escalar de manera controlada y maximizar nuestros márgenes."</p>
                </CardContent>
              </Card>

              <Card className="border-red-500/20 bg-red-500/5 backdrop-blur-md">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-red-700 dark:text-red-400"><Lock className="w-5 h-5"/> Acuerdo de Confidencialidad (NDA)</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-700 dark:text-slate-300 mb-4">Descarga un modelo estándar para exigir la protección de tus recetas y código fuente ante los evaluadores.</p>
                  <Button variant="outline" className="w-full border-red-500/30 text-red-700 dark:text-red-400 hover:bg-red-500/10" onClick={() => {
                    const ndaText = 'ACUERDO DE CONFIDENCIALIDAD (NDA)\n\nConste por el presente documento que la información técnica, lógica de software (ERP/POS), recetas y procesos productivos presentados por Panadería Dulce Placer durante el proceso de evaluación del Fondo Emprender SENA, constituyen "Secreto Empresarial".\n\nEl evaluador se compromete a no divulgar, copiar, ni reproducir esta información con fines personales o comerciales de terceros.';
                    const blob = new Blob([ndaText], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = 'NDA_Dulce_Placer.txt'; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1000);
                  }}>
                    <Download className="w-4 h-4 mr-2"/> Descargar NDA (TXT)
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ========================================================= */}
        {/* TAB 5: Generación */}
        {/* ========================================================= */}
        <TabsContent value="generacion" className="space-y-6">
          <Card className="border-pink-500/20 bg-pink-500/5 backdrop-blur-md min-h-[600px] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-4">
              <div>
                <CardTitle className="text-xl flex items-center gap-2 text-pink-400">
                  <Bot className="w-6 h-6" />
                  Redactor Inteligente (Fondo Emprender)
                </CardTitle>
                <CardDescription>
                  Toda la información llenada en los tabs anteriores se fusionará con tus métricas ERP.
                </CardDescription>
              </div>
              <Button 
                onClick={generarPlan} 
                disabled={generando || totalSolicitado <= 0}
                className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white shadow-lg shadow-pink-500/20 px-6 py-6"
              >
                {generando ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Escribiendo Plan...</>
                ) : (
                  <><Sparkles className="w-5 h-5 mr-2" /> ¡Redactar Plan Final!</>
                )}
              </Button>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col pt-6">
              {planGenerado && !generando && (
                <div className="flex items-center justify-end gap-2 mb-4">
                  {!isEditing ? (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} className="border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/10">
                        <Pencil className="w-4 h-4 mr-2" /> Editar
                      </Button>
                      <Button size="sm" onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                        <CheckCircle2 className="w-4 h-4 mr-2" /> Guardar Avance
                      </Button>
                      <Button size="sm" variant="outline" onClick={descargarMarkdown} className="border-white/10 hidden md:flex">
                        <Download className="w-4 h-4 mr-2" /> Exportar a Markdown
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} className="text-muted-foreground">
                        <X className="w-4 h-4 mr-2" /> Cancelar
                      </Button>
                      <Button size="sm" onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                        <Save className="w-4 h-4 mr-2" /> Guardar Cambios
                      </Button>
                    </>
                  )}
                </div>
              )}

              {!planGenerado && !generando && (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground space-y-4 py-20">
                  <div className="p-4 bg-white/5 rounded-full"><FileText className="w-12 h-12 opacity-30" /></div>
                  <p className="text-center max-w-md text-sm">
                    Revisa que todos los Tabs anteriores estén llenos. Asegúrate de incluir al menos 1 cotización en Módulo 5. Al darle clic a Redactar, el asistente escribirá el documento completo en formato Fondo Emprender.
                  </p>
                </div>
              )}
              
              {generando && !planGenerado && (
                <div className="flex-1 flex flex-col items-center justify-center text-pink-400 space-y-4 py-20">
                  <Loader2 className="w-16 h-16 animate-spin opacity-50" />
                  <p className="text-sm font-medium animate-pulse uppercase tracking-widest">Estructurando los 7 Módulos...</p>
                </div>
              )}

              {planGenerado && (
                <div className="flex-1 flex flex-col min-h-0 bg-slate-900/50 rounded-xl border border-white/5 overflow-hidden shadow-2xl">
                  {isEditing ? (
                    <Textarea
                      value={planGenerado}
                      onChange={(e) => setPlanGenerado(e.target.value)}
                      className="flex-1 h-full min-h-[600px] font-mono text-sm resize-none bg-transparent border-0 focus-visible:ring-0 p-6"
                      placeholder="Edita tu documento Markdown aquí..."
                    />
                  ) : (
                    <div className="flex-1 overflow-y-auto p-6 lg:p-10 prose prose-sm md:prose-base dark:prose-invert text-slate-300 max-w-none prose-headings:text-pink-400 prose-a:text-blue-400 whitespace-pre-wrap">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {planGenerado}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
