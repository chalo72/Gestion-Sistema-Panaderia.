import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, Pencil, Trash2, X, AlertTriangle, ChevronUp, ChevronDown, CalendarDays, FileText, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { verificarPinGerente } from '@/lib/security-agent';
import { CAJAS_POS_DEFAULT } from '@/lib/boveda-pos-sync';
import { getBovedas, type Boveda } from '@/lib/boveda-store';
import { db } from '@/lib/database';
import type {
    CajaSesion,
    Gasto,
    GastoCategoria,
    MetodoPago,
    PrecioProveedor,
    Producto,
    Proveedor,
} from '@/types';

/** De dónde sale el dinero: cajón POS (Ventas del día) o cuenta de Tesorería/Bóveda */
export type OrigenGastoDiario = 'pos' | 'tesoreria';

export interface FacturaItem {
    id: string;
    productoId?: string;
    productoLibre?: string;
    cantidad: number;
    precioUnitario: number;
    total: number;
    nombre: string;
}

/** Acepta "1200,5" o "1.200,50" y deja un número usable. */
const parseMontoFlexible = (raw: string): number => {
    const t = (raw || '').trim().replace(/\s/g, '');
    if (!t) return NaN;
    // Si hay coma, asumimos formato CO: puntos = miles, coma = decimal
    if (t.includes(',')) {
        const sinMiles = t.replace(/\./g, '').replace(',', '.');
        return parseFloat(sinMiles);
    }
    return parseFloat(t);
};

const facturaItemDesdeGasto = (
    item: NonNullable<Gasto['facturaItems']>[number] & {
        precioUnitario?: number;
        productoId?: string;
        productoLibre?: string;
    }
): FacturaItem => {
    const cantidad = Number(item.cantidad) > 0 ? Number(item.cantidad) : 1;
    const total = Number(item.total) || 0;
    const precioUnitario =
        Number(item.precioUnitario) > 0
            ? Number(item.precioUnitario)
            : Number(item.subtotal) > 0
              ? Number(item.subtotal)
              : cantidad > 0
                ? Math.round((total / cantidad) * 100) / 100
                : 0;
    return {
        id: item.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        productoId: item.productoId,
        productoLibre: item.productoLibre,
        cantidad,
        precioUnitario,
        total: total || Math.round(cantidad * precioUnitario * 100) / 100,
        nombre: item.nombre || 'Ítem',
    };
};

export interface GastoDiarioFormData {
    descripcion: string;
    monto: number;
    categoria: GastoCategoria;
    metodoPago: MetodoPago;
    cajaId?: string;
    /** Id de bóveda cuando origenTipo = tesoreria */
    bovedaId?: string;
    origenTipo?: OrigenGastoDiario;
    proveedorId?: string;
    
    // Campos para gasto simple individual (legacy o para gastos sin ítems como servicios)
    productoId?: string;
    productoLibre?: string;
    cantidad?: number;
    precioUnitario?: number;
    
    // Lista de ítems para factura múltiple
    facturaItems?: FacturaItem[];

    /** Fecha del gasto YYYY-MM-DD (hora local Colombia) */
    fecha?: string;
    esIngreso: false;
}

export type PeriodoListaGastos = 'dia' | 'semana' | 'mes' | 'anio';

interface GastoDiarioFormProps {
    onSave: (data: GastoDiarioFormData) => Promise<void>;
    /** Cambia la fecha de un gasto ya guardado */
    onCambiarFecha?: (gastoId: string, fechaYYYYMMDD: string) => Promise<void>;
    /** Anula un gasto (con motivo). PIN ya validado en el formulario si no es ADMIN */
    onAnular?: (gastoId: string, motivo: string) => Promise<void>;
    /** Permite editar un gasto de manera completa */
    onUpdateGasto?: (gastoId: string, updates: Partial<Gasto>) => Promise<void>;
    proveedores?: Proveedor[];
    productos?: Producto[];
    precios?: PrecioProveedor[];
    cajaActiva?: CajaSesion;
    sesionesCaja?: CajaSesion[];
    gastos?: Gasto[];
    hoyStr?: string;
    formatCurrency?: (n: number) => string;
}

const CATS: GastoCategoria[] = [
    'Materia Prima',
    'Servicios',
    'Nómina',
    'Arriendo',
    'Mantenimiento',
    'Otros',
];

const fieldChrome =
    'h-12 max-w-full rounded-2xl border border-rose-200/70 dark:border-rose-800/50 bg-white/95 dark:bg-slate-900/90 px-4 text-sm font-bold text-slate-800 dark:text-slate-100 shadow-sm outline-none transition-[width,box-shadow,border-color] duration-300 ease-out focus:ring-2 focus:ring-rose-400/40 focus:border-rose-400/80 focus:shadow-md';

const selectCls = cn(fieldChrome, 'appearance-auto cursor-pointer');
const inputCls = cn(fieldChrome, 'placeholder:text-slate-400 placeholder:font-medium');

/**
 * Ancho holgado y profesional: crece con el nombre, con mínimo cómodo al tacto.
 * (No apretado: padding generoso + mínimos táctiles para A23.)
 */
const anchoPorTexto = (
    texto: string,
    minCh = 14,
    maxCh = 30,
    paddingCh = 10
): string => {
    const len = (texto || '').trim().length + paddingCh;
    return `${Math.min(maxCh, Math.max(minCh, len))}ch`;
};

const fieldLabelCls =
    'text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400 px-0.5';

const monedaDefault = (n: number) =>
    `$${Math.round(n).toLocaleString('es-CO')}`;

const CAJAS_CATALOGO_DEFAULT = [
    'Caja Principal',
    'Helados',
    'Fritos',
    'Micheladas',
    'Tortas',
    'Tinto/Capuchinos',
    'Tortas Especiales',
];

const esNombreCajaBasura = (raw?: string): boolean => {
    const t = (raw || '').trim();
    if (!t) return true;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) return true;
    if (/-id$/i.test(t)) return true;
    if (/^owner-/i.test(t)) return true;
    if (/^user[-_]/i.test(t)) return true;
    if (/^panadero-/i.test(t)) return true;
    if (t.length > 40 && !/\s/.test(t)) return true;
    return false;
};

const cargarCatalogoCajas = (): string[] => {
    try {
        const raw = localStorage.getItem('dp_cajas_config');
        if (raw) {
            const lista = JSON.parse(raw) as Array<{ nombre?: string }>;
            const nombres = lista
                .map((c) => (c?.nombre || '').trim())
                .filter((n) => n && !esNombreCajaBasura(n));
            if (nombres.length > 0) return nombres;
        }
    } catch {
        /* ignorar */
    }
    return CAJAS_CATALOGO_DEFAULT;
};

const fechaLocalHoy = (): string =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

const parseFechaLocal = (yyyyMmDd: string): Date => {
    const [y, m, d] = yyyyMmDd.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
};

const inicioSemana = (ref: Date): Date => {
    const d = new Date(ref);
    const day = d.getDay(); // 0 domingo
    const diff = day === 0 ? -6 : 1 - day; // lunes
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
};

const finSemana = (ref: Date): Date => {
    const ini = inicioSemana(ref);
    const f = new Date(ini);
    f.setDate(f.getDate() + 6);
    f.setHours(23, 59, 59, 999);
    return f;
};

const formatearFechaCorta = (isoOrDay: string): string => {
    const day = (isoOrDay || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return '—';
    return parseFechaLocal(day).toLocaleDateString('es-CO', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
};

const etiquetaCaja = (g: Gasto): string => {
    const tag = (g.metadata?.etiquetas || []).find((e) => e.startsWith('caja:'));
    if (tag) return tag.slice(5);
    return g.cajaId ? 'caja' : '';
};

/**
 * Formulario de gasto diario (Mi Quincena):
 * caja + fecha + lista por día/semana/mes/año + anular con PIN (excepto ADMIN).
 */
export function GastoDiarioForm({
    onSave,
    onCambiarFecha,
    onAnular,
    onUpdateGasto,
    proveedores = [],
    productos = [],
    precios = [],
    cajaActiva,
    sesionesCaja = [],
    gastos = [],
    hoyStr,
    formatCurrency = monedaDefault,
}: GastoDiarioFormProps) {
    const { role } = useAuth();
    const esAdmin = role === 'ADMIN';

    const [cantidad, setCantidad] = useState('1');
    const [precioUnitario, setPrecioUnitario] = useState('');
    const [nota, setNota] = useState('');
    const [categoria, setCat] = useState<GastoCategoria>('Materia Prima');
    const [origenTipo, setOrigenTipo] = useState<OrigenGastoDiario>('pos');
    const [cajaId, setCajaId] = useState('');
    const [bovedaId, setBovedaId] = useState('');
    const [bovedasLista, setBovedasLista] = useState<Boveda[]>(() => getBovedas());
    const [proveedorId, setProveedorId] = useState('');
    const [productoId, setProductoId] = useState('');
    const [noEnLista, setNoEnLista] = useState(false);
    const [productoLibre, setProductoLibre] = useState('');
    const [saving, setSaving] = useState(false);
    const [catalogoCajas, setCatalogoCajas] = useState<string[]>(() => cargarCatalogoCajas());
    const [fechaGasto, setFechaGasto] = useState(() => hoyStr || fechaLocalHoy());
    const [periodo, setPeriodo] = useState<PeriodoListaGastos>('semana');
    const [editandoId, setEditandoId] = useState<string | null>(null);
    const [editFecha, setEditFecha] = useState('');
    const [anulando, setAnulando] = useState<Gasto | null>(null);
    const [motivoAnular, setMotivoAnular] = useState('');
    const [pinAnular, setPinAnular] = useState('');
    const [anulandoBusy, setAnulandoBusy] = useState(false);
    const [errorAnular, setErrorAnular] = useState('');
    const [facturaItems, setFacturaItems] = useState<FacturaItem[]>([]);
    const [esFactura, setEsFactura] = useState(false);
    const [totalFacturaOverride, setTotalFacturaOverride] = useState('');
    const [editandoGastoIdCompleto, setEditandoGastoIdCompleto] = useState<string | null>(null);
    const [editandoFacturaItemId, setEditandoFacturaItemId] = useState<string | null>(null);
    const [actualizarCatalogo, setActualizarCatalogo] = useState(false);
    const cantRef = useRef<HTMLInputElement>(null);
    const listaFacturaRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setCatalogoCajas(cargarCatalogoCajas());
        setBovedasLista(getBovedas());
        const onStorage = (e: StorageEvent) => {
            if (e.key === 'dp_cajas_config') setCatalogoCajas(cargarCatalogoCajas());
            if (e.key === 'dp_bovedas_lista' || e.key === 'dp_bovedas_movimientos') {
                setBovedasLista(getBovedas());
            }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    /** Cajas POS = mismas del arqueo «Ventas del día» (+ turno abierto si coincide). */
    const cajasPosOpciones = useMemo(() => {
        const porNombre = new Map<string, { id: string; label: string }>();

        const add = (nombreCaja: string, id: string, sufijo?: string) => {
            const nombre = nombreCaja.trim();
            if (!nombre || esNombreCajaBasura(nombre)) return;
            const key = nombre.toLowerCase();
            const label = sufijo ? `${nombre} ${sufijo}` : nombre;
            const prev = porNombre.get(key);
            if (!prev) {
                porNombre.set(key, { id, label });
                return;
            }
            const prevEsNombre = prev.id.startsWith('nombre:');
            const nuevoEsSesion = !id.startsWith('nombre:');
            if (prevEsNombre && nuevoEsSesion) {
                porNombre.set(key, { id, label });
            } else if (sufijo && !prev.label.includes('abierta') && !prev.label.includes('turno')) {
                porNombre.set(key, { id: prev.id, label });
            }
        };

        for (const nombre of CAJAS_POS_DEFAULT) {
            add(nombre, `nombre:${nombre}`);
        }
        // Catálogo local extra (cajas creadas en Control de Caja) que no estén en el POS fijo
        for (const nombre of catalogoCajas) {
            add(nombre, `nombre:${nombre}`);
        }
        for (const c of sesionesCaja) {
            const nombre = (c.cajaNombre || '').trim();
            if (esNombreCajaBasura(nombre) || !c.id) continue;
            const sufijo = c.estado === 'abierta' ? '(abierta)' : undefined;
            add(nombre, c.id, sufijo);
        }
        if (cajaActiva?.id) {
            const nombre = (cajaActiva.cajaNombre || '').trim();
            if (!esNombreCajaBasura(nombre)) {
                add(nombre, cajaActiva.id, '(turno actual)');
            }
        }

        const lista = Array.from(porNombre.values());
        lista.sort((a, b) => {
            const ap = /principal/i.test(a.label) ? 0 : 1;
            const bp = /principal/i.test(b.label) ? 0 : 1;
            if (ap !== bp) return ap - bp;
            return a.label.localeCompare(b.label, 'es');
        });
        return lista;
    }, [cajaActiva, sesionesCaja, catalogoCajas]);

    const cajasOpciones = origenTipo === 'pos' ? cajasPosOpciones : [];

    useEffect(() => {
        if (origenTipo !== 'pos') return;
        if (cajaId && cajasPosOpciones.some((o) => o.id === cajaId)) return;
        const activa = cajasPosOpciones.find((o) => o.id === cajaActiva?.id);
        if (activa) {
            setCajaId(activa.id);
            return;
        }
        const principal = cajasPosOpciones.find((o) =>
            o.label.toLowerCase().includes('principal')
        );
        if (principal) setCajaId(principal.id);
        else if (cajasPosOpciones[0]) setCajaId(cajasPosOpciones[0].id);
    }, [origenTipo, cajaId, cajaActiva?.id, cajasPosOpciones]);

    useEffect(() => {
        if (origenTipo !== 'tesoreria') return;
        if (bovedaId && bovedasLista.some((b) => b.id === bovedaId)) return;
        const principal = bovedasLista.find((b) =>
            /principal/i.test(b.nombre)
        );
        setBovedaId(principal?.id || bovedasLista[0]?.id || '');
    }, [origenTipo, bovedaId, bovedasLista]);

    const insumos = useMemo(() => {
        const ingredientes = productos.filter((p) => p.tipo === 'ingrediente');
        const base =
            ingredientes.length > 0
                ? ingredientes
                : productos.filter((p) => p.tipo !== 'elaborado');
        if (!proveedorId) {
            return [...base].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
        }
        const idsDelProveedor = new Set(
            precios.filter((pr) => pr.proveedorId === proveedorId).map((pr) => pr.productoId)
        );
        const filtrados = base.filter((p) => idsDelProveedor.has(p.id));
        return [...filtrados].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    }, [productos, precios, proveedorId]);

    useEffect(() => {
        if (!productoId || noEnLista) return;
        const prod = productos.find(p => p.id === productoId);
        const delProv = precios.find(
            (pr) => pr.productoId === productoId && (!proveedorId || pr.proveedorId === proveedorId)
        );
        const cualquiera = precios.find((pr) => pr.productoId === productoId);
        const precio = delProv?.precioCosto ?? cualquiera?.precioCosto ?? prod?.precioCompra ?? prod?.costoBase;
        
        if (precio != null && Number(precio) > 0) {
            setPrecioUnitario(String(precio));
        } else {
            setPrecioUnitario('');
        }
    }, [productoId, proveedorId, precios, productos, noEnLista]);

    const cantNum = parseMontoFlexible(cantidad);
    const unitNum = parseMontoFlexible(precioUnitario);
    
    const sobrecostoWarning = useMemo(() => {
        if (!productoId || !precioUnitario || noEnLista) return null;
        const prod = insumos.find(p => p.id === productoId);
        if (!prod || !prod.costoBase) return null;
        const currentPrice = Number(precioUnitario);
        if (isNaN(currentPrice) || currentPrice <= 0) return null;
        
        const existingPrecio = precios?.find(p => p.productoId === productoId && p.proveedorId === proveedorId);
        const costoAnterior = existingPrecio ? existingPrecio.precioCosto : prod.costoBase;
        
        if (costoAnterior > 0 && currentPrice > costoAnterior * 1.05) {
            const pct = Math.round(((currentPrice - costoAnterior) / costoAnterior) * 100);
            return `Cuidado: Este insumo subió un ${pct}% respecto al costo anterior ($${formatCurrency ? formatCurrency(costoAnterior) : costoAnterior}).`;
        }
        return null;
    }, [productoId, precioUnitario, noEnLista, insumos, precios, proveedorId, formatCurrency]);

    const productoSugerido = useMemo(() => {
        if (!noEnLista || !productoLibre || productoLibre.trim().length < 3) return null;
        const search = productoLibre.toLowerCase().trim();
        
        let bestMatch: Producto | null = null;
        for (const prod of insumos) {
            const pName = prod.nombre.toLowerCase();
            if (pName === search) return prod;
            if (pName.includes(search) || search.includes(pName)) {
                if (!bestMatch || prod.nombre.length < bestMatch.nombre.length) {
                    bestMatch = prod;
                }
            }
        }
        return bestMatch;
    }, [noEnLista, productoLibre, insumos]);

    const totalLista = facturaItems.reduce((acc, item) => acc + item.total, 0);

    const totalCalculado =
        Number.isFinite(cantNum) &&
        cantNum > 0 &&
        Number.isFinite(unitNum) &&
        unitNum > 0
            ? Math.round(cantNum * unitNum * 100) / 100
            : 0;

    const faltaInsumo =
        !noEnLista && !productoId
            ? true
            : noEnLista && !productoLibre.trim();
    const faltaPrecio = !(Number.isFinite(unitNum) && unitNum > 0);
    const faltaCantidad = !(Number.isFinite(cantNum) && cantNum > 0);
    const puedeAnadirAFactura = !faltaInsumo && !faltaPrecio && !faltaCantidad;

    const motivoBloqueoAnadir = faltaInsumo
        ? 'Elige un insumo de la lista, o marca «No está en la lista» y escribe el nombre.'
        : faltaPrecio
          ? 'Escribe el precio unitario (ej. 45000).'
          : faltaCantidad
            ? 'La cantidad debe ser mayor que 0.'
            : null;

    // Sin catálogo de insumos: abrir modo nombre libre para no dejar el botón muerto
    useEffect(() => {
        if (insumos.length === 0 && !noEnLista && !productoId) {
            setNoEnLista(true);
        }
    }, [insumos.length, noEnLista, productoId]);

    const listo =
        (facturaItems.length > 0 ||
            (totalCalculado > 0 && (noEnLista ? productoLibre.trim().length > 0 : !!productoId))) &&
        (origenTipo === 'tesoreria' ? !!bovedaId : !!cajaId);

    const montoAGuardar = facturaItems.length > 0 ? totalLista : totalCalculado;

    const refDia = fechaGasto || hoyStr || fechaLocalHoy();
    const refDate = parseFechaLocal(refDia);

    const gastosFiltrados = useMemo(() => {
        const activos = (gastos || []).filter((g) => g.estado !== 'anulado');
        const enPeriodo = activos.filter((g) => {
            const f = (g.fecha || '').slice(0, 10);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return false;
            const gd = parseFechaLocal(f);
            if (periodo === 'dia') return f === refDia;
            if (periodo === 'semana') {
                return gd >= inicioSemana(refDate) && gd <= finSemana(refDate);
            }
            if (periodo === 'mes') {
                return (
                    gd.getFullYear() === refDate.getFullYear() &&
                    gd.getMonth() === refDate.getMonth()
                );
            }
            // año
            return gd.getFullYear() === refDate.getFullYear();
        });
        return enPeriodo.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    }, [gastos, periodo, refDia, refDate]);

    const totalPeriodo = useMemo(
        () => gastosFiltrados.reduce((s, g) => s + (Number(g.monto) || 0), 0),
        [gastosFiltrados]
    );

    const gruposPorDia = useMemo(() => {
        const map = new Map<string, Gasto[]>();
        for (const g of gastosFiltrados) {
            const day = (g.fecha || '').slice(0, 10);
            const list = map.get(day) || [];
            list.push(g);
            map.set(day, list);
        }
        return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
    }, [gastosFiltrados]);

    const tituloPeriodo =
        periodo === 'dia'
            ? `Gastos del ${formatearFechaCorta(refDia)}`
            : periodo === 'semana'
              ? 'Gastos de la semana'
              : periodo === 'mes'
                ? `Gastos de ${refDate.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}`
                : `Gastos de ${refDate.getFullYear()}`;

    const handleAddAFactura = () => {
        if (!puedeAnadirAFactura) {
            toast.error(motivoBloqueoAnadir || 'Completa insumo, cantidad y precio antes de añadir.');
            return;
        }
        
        let nombreItem = '';
        if (noEnLista) {
            nombreItem = productoLibre.trim();
        } else {
            const p = insumos.find(x => x.id === productoId);
            nombreItem = p ? p.nombre : 'Desconocido';
        }

        if (editandoFacturaItemId) {
            setFacturaItems(prev => prev.map(item => 
                item.id === editandoFacturaItemId 
                    ? { ...item, productoId: noEnLista ? undefined : productoId, productoLibre: noEnLista ? productoLibre.trim() : undefined, cantidad: cantNum, precioUnitario: unitNum, total: totalCalculado, nombre: nombreItem }
                    : item
            ));
            setEditandoFacturaItemId(null);
            toast.success(`Ítem actualizado: ${nombreItem}`);
        } else {
            const newItem: FacturaItem = {
                id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
                productoId: noEnLista ? undefined : productoId,
                productoLibre: noEnLista ? productoLibre.trim() : undefined,
                cantidad: cantNum,
                precioUnitario: unitNum,
                total: totalCalculado,
                nombre: nombreItem
            };
            setFacturaItems(prev => [...prev, newItem]);
            setEsFactura(true);
            toast.success(`Añadido a la factura: ${cantNum}× ${nombreItem}`);
        }
        
        // Actualizar catálogo si está marcado
        if (actualizarCatalogo && productoId && !noEnLista && unitNum > 0) {
            const prod = productos?.find(p => p.id === productoId);
            if (prod) {
                // Actualizar costoBase y recalcular precioVenta si hay margen (asumiendo lógica básica)
                const nuevoPrecioVenta = Math.round(unitNum * (1 + (prod.margenUtilidad || 0) / 100) / 100) * 100;
                db.updateProducto({ ...prod, costoBase: unitNum, precioVenta: nuevoPrecioVenta, updatedAt: new Date().toISOString() }).catch(() => {});
                
                // Actualizar precio de proveedor
                const existingPrecio = precios?.find(p => p.productoId === productoId && p.proveedorId === proveedorId);
                const now = new Date().toISOString();
                if (existingPrecio) {
                    if (existingPrecio.precioCosto !== unitNum) {
                        db.updatePrecio({ ...existingPrecio, precioCosto: unitNum, fechaActualizacion: now }).catch(() => {});
                        db.addHistorial({
                            id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
                            productoId,
                            proveedorId: proveedorId || '',
                            precioAnterior: existingPrecio.precioCosto,
                            precioNuevo: unitNum,
                            fechaCambio: now
                        }).catch(() => {});
                    }
                } else if (proveedorId) {
                    db.addPrecio({ id: Date.now().toString() + Math.random().toString(36).slice(2, 7), productoId, proveedorId, precioCosto: unitNum, fechaActualizacion: now }).catch(() => {});
                    db.addHistorial({
                        id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
                        productoId,
                        proveedorId: proveedorId || '',
                        precioAnterior: 0,
                        precioNuevo: unitNum,
                        fechaCambio: now
                    }).catch(() => {});
                }
                toast.success(`Catálogo actualizado para: ${nombreItem}`);
            }
        } else if (noEnLista && unitNum > 0 && proveedorId && !editandoFacturaItemId) {
            // Guardar automáticamente el nuevo producto en el catálogo
            const newProdId = 'prod-' + Date.now().toString(36);
            const now = new Date().toISOString();
            const nuevoProd: Producto = {
                id: newProdId,
                nombre: nombreItem,
                tipo: 'ingrediente',
                costoBase: unitNum,
                precioVenta: Math.round(unitNum * 1.3 / 100) * 100, // 30% margen inicial por defecto
                categoria: 'Materia Prima',
                proveedoresIds: [proveedorId],
                inventario: {
                    cantidadActual: cantNum,
                    cantidadMinima: 0,
                    unidadMedida: 'un',
                },
                createdAt: now,
                updatedAt: now
            };
            db.addProducto(nuevoProd).catch(() => {});
            db.addPrecio({
                id: 'prec-' + Date.now().toString(36),
                productoId: newProdId,
                proveedorId,
                precioCosto: unitNum,
                fechaActualizacion: now
            }).catch(() => {});
            db.addHistorial({
                id: 'hist-' + Date.now().toString(36),
                productoId: newProdId,
                proveedorId,
                precioAnterior: 0,
                precioNuevo: unitNum,
                fechaCambio: now
            }).catch(() => {});
            toast.success(`'${nombreItem}' se guardó en el catálogo para futuras compras.`);
            
            // Actualizar el item recién añadido para que tenga el ID del producto
            setFacturaItems(prev => prev.map((item, idx) => 
                idx === prev.length - 1 ? { ...item, productoId: newProdId, productoLibre: undefined } : item
            ));
        }

        // Reset product form
        setCantidad('1');
        setPrecioUnitario('');
        setProductoId('');
        setProductoLibre('');
        setNoEnLista(insumos.length === 0);
        setActualizarCatalogo(false);
        requestAnimationFrame(() => {
            listaFacturaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
    };

    const handleRemoveFacturaItem = (id: string) => {
        const quitado = facturaItems.find((i) => i.id === id);
        setFacturaItems(prev => prev.filter(i => i.id !== id));
        if (editandoFacturaItemId === id) {
            setEditandoFacturaItemId(null);
            setCantidad('1');
            setPrecioUnitario('');
            setProductoId('');
            setProductoLibre('');
            setNoEnLista(insumos.length === 0);
        }
        toast.success(quitado ? `Quitado de la factura: ${quitado.nombre}` : 'Ítem quitado de la factura');
    };

    const handleEditFacturaItem = (id: string) => {
        const item = facturaItems.find(i => i.id === id);
        if (!item) return;
        setEditandoFacturaItemId(id);
        setProductoId(item.productoId || '');
        setProductoLibre(item.productoLibre || '');
        setNoEnLista(!!item.productoLibre);
        setCantidad(String(item.cantidad || 1));
        setPrecioUnitario(String(item.precioUnitario || ''));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const resetForm = () => {
        setCantidad('1');
        setPrecioUnitario('');
        setNota('');
        setProductoId('');
        setProductoLibre('');
        setNoEnLista(false);
        setFacturaItems([]);
        setEsFactura(false);
        setTotalFacturaOverride('');
        setEditandoGastoIdCompleto(null);
        setEditandoFacturaItemId(null);
    };

    const handleEditGastoCompleto = (g: Gasto) => {
        setEditandoGastoIdCompleto(g.id);
        setCat((g.categoria as GastoCategoria) || 'Materia Prima');
        setOrigenTipo(g.bovedaId ? 'tesoreria' : 'pos');
        setCajaId(g.cajaId || '');
        setBovedaId(g.bovedaId || '');
        setProveedorId(g.proveedorId || '');
        setNoEnLista(!!g.productoLibre);
        setProductoId(g.productoId || '');
        setProductoLibre(g.productoLibre || '');
        setCantidad(g.cantidad ? String(g.cantidad) : '1');
        setPrecioUnitario(g.precioUnitario ? String(g.precioUnitario) : (g.monto ? String(g.monto) : ''));
        setNota(g.descripcion || '');
        setFechaGasto(g.fecha ? g.fecha.slice(0, 10) : fechaLocalHoy());
        setEsFactura(g.esFactura || false);
        if (g.facturaItems && g.facturaItems.length > 0) {
            setFacturaItems(g.facturaItems.map((it) => facturaItemDesdeGasto(it)));
            const sumItems = g.facturaItems.reduce((acc, it) => acc + (it.total || (it.cantidad || 1) * (it.precioUnitario || 0)), 0);
            if (g.monto && Math.abs(sumItems - g.monto) > 0.01) {
                setTotalFacturaOverride(String(g.monto));
            } else {
                setTotalFacturaOverride('');
            }
        } else {
            setFacturaItems([]);
            setTotalFacturaOverride('');
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSave = async (e: React.FormEvent) => {
        if (!listo || saving) return;
        setSaving(true);
        try {
            const hasCart = facturaItems.length > 0;
            const singleItemTotal = totalCalculado;
            const overrideNum = parseFloat(totalFacturaOverride);
            const montoFinal = hasCart 
                ? (!isNaN(overrideNum) && totalFacturaOverride.trim() !== '' ? overrideNum : totalLista) 
                : totalCalculado;

            if (montoFinal <= 0) {
                toast.error('El total del gasto debe ser mayor a 0. Añade ítems a la factura o escribe precio.');
                return;
            }

            let descripcionGasto = nota.trim();
            if (hasCart) {
                const itemResumen = facturaItems.map(i => `${i.cantidad}x ${i.nombre}`).join(', ');
                if (descripcionGasto) {
                    descripcionGasto += ` - ${itemResumen}`;
                } else {
                    descripcionGasto = itemResumen;
                }
            } else {
                if (!descripcionGasto) {
                    if (noEnLista) {
                        descripcionGasto = productoLibre;
                    } else if (productoId) {
                        const p = insumos.find((x) => x.id === productoId);
                        descripcionGasto = p ? p.nombre : 'Gasto sin detalle';
                    } else {
                        descripcionGasto = categoria;
                    }
                }
            }

            setSaving(true);
            const payload = {
                descripcion: descripcionGasto,
                monto: montoFinal,
                categoria,
                metodoPago: 'efectivo' as const,
                origenTipo,
                cajaId: origenTipo === 'pos' ? cajaId || undefined : undefined,
                bovedaId: origenTipo === 'tesoreria' ? bovedaId || undefined : undefined,
                proveedorId: proveedorId || undefined,
                productoId: hasCart ? undefined : (noEnLista ? undefined : productoId),
                productoLibre: hasCart ? undefined : (noEnLista ? productoLibre.trim() : undefined),
                cantidad: hasCart ? undefined : cantNum,
                precioUnitario: hasCart ? undefined : unitNum,
                fecha: fechaGasto || fechaLocalHoy(),
                esIngreso: false,
                facturaItems: hasCart
                    ? facturaItems.map((it) => ({
                          ...it,
                          subtotal: it.precioUnitario,
                      }))
                    : undefined,
                esFactura: hasCart ? true : esFactura,
            };

            if (editandoGastoIdCompleto && onUpdateGasto) {
                await onUpdateGasto(editandoGastoIdCompleto, payload);
            } else {
                await onSave(payload);
            }

            resetForm();
            cantRef.current?.focus();
        } finally {
            setSaving(false);
        }
    };

    const guardarFechaEditada = async (gastoId: string) => {
        if (!onCambiarFecha || !/^\d{4}-\d{2}-\d{2}$/.test(editFecha)) return;
        await onCambiarFecha(gastoId, editFecha);
        setEditandoId(null);
        setEditFecha('');
    };

    const confirmarAnular = async () => {
        if (!anulando || !onAnular) return;
        const motivo = motivoAnular.trim();
        if (motivo.length < 5) {
            setErrorAnular('Escribe el motivo (mínimo 5 caracteres).');
            return;
        }
        if (!esAdmin && !verificarPinGerente(pinAnular)) {
            setErrorAnular('PIN incorrecto o no configurado en Seguridad.');
            return;
        }
        setAnulandoBusy(true);
        setErrorAnular('');
        try {
            await onAnular(anulando.id, motivo);
            setAnulando(null);
            setMotivoAnular('');
            setPinAnular('');
        } catch {
            setErrorAnular('No se pudo eliminar. Intenta de nuevo.');
        } finally {
            setAnulandoBusy(false);
        }
    };

    const labelCaja =
        cajasPosOpciones.find((c) => c.id === cajaId)?.label || 'Sin caja / otro';
    const labelBoveda =
        bovedasLista.find((b) => b.id === bovedaId)?.nombre || 'Elegir bóveda';
    const labelProveedor =
        proveedores.find((p) => p.id === proveedorId)?.nombre || 'Sin proveedor';
    const labelProducto = noEnLista
        ? productoLibre || 'Escribe el insumo…'
        : insumos.find((p) => p.id === productoId)?.nombre || 'Elegir insumo';

    return (
        <div className="w-full max-w-full min-w-0 overflow-x-hidden space-y-5">
            {/* Origen: Caja POS (Ventas del día) o Tesorería/Bóveda */}
            <div className="space-y-2">
                <span className={fieldLabelCls}>¿De dónde sale el dinero?</span>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => setOrigenTipo('pos')}
                        className={cn(
                            'h-11 px-4 rounded-2xl text-xs font-black uppercase tracking-wide border transition-colors',
                            origenTipo === 'pos'
                                ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                                : 'bg-white/90 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 border-rose-200/70 dark:border-rose-800/50'
                        )}
                    >
                        Caja POS
                    </button>
                    <button
                        type="button"
                        onClick={() => setOrigenTipo('tesoreria')}
                        className={cn(
                            'h-11 px-4 rounded-2xl text-xs font-black uppercase tracking-wide border transition-colors',
                            origenTipo === 'tesoreria'
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                : 'bg-white/90 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 border-rose-200/70 dark:border-rose-800/50'
                        )}
                    >
                        Tesorería / Bóveda
                    </button>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                    {origenTipo === 'pos'
                        ? 'Cajas del arqueo (Principal, Helados…). Se descuenta y queda alineado con Ventas del día / Bóveda.'
                        : 'Cuentas fuertes o banco del módulo Bóveda (no es el cajón del mostrador).'}
                </p>
            </div>

            {/* Fila 1: fecha + caja/bóveda */}
            <div className="flex flex-wrap items-start gap-4">
                <label className="inline-flex flex-col gap-1.5 shrink-0">
                    <span className={fieldLabelCls}>Fecha del gasto</span>
                    <input
                        type="date"
                        value={fechaGasto}
                        onChange={(e) => setFechaGasto(e.target.value)}
                        className={inputCls}
                        style={{ width: '11.5rem' }}
                    />
                </label>

                {origenTipo === 'pos' ? (
                    <label className="inline-flex flex-col gap-1.5 min-w-[12rem] flex-1 max-w-md">
                        <span className={fieldLabelCls}>Caja POS</span>
                        <select
                            className={cn(selectCls, 'w-full')}
                            value={cajaId}
                            onChange={(e) => setCajaId(e.target.value)}
                            style={{
                                width: '100%',
                                maxWidth: anchoPorTexto(labelCaja, 18, 34, 12),
                            }}
                        >
                            <option value="">Sin caja / otro</option>
                            {cajasOpciones.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.label}
                                </option>
                            ))}
                        </select>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug pl-0.5">
                            Baja el saldo de esa caja en Bóveda; si hay turno abierto, también del cajón.
                        </p>
                    </label>
                ) : (
                    <label className="inline-flex flex-col gap-1.5 min-w-[12rem] flex-1 max-w-md">
                        <span className={fieldLabelCls}>Cuenta de Tesorería</span>
                        <select
                            className={cn(selectCls, 'w-full')}
                            value={bovedaId}
                            onChange={(e) => setBovedaId(e.target.value)}
                            style={{
                                width: '100%',
                                maxWidth: anchoPorTexto(labelBoveda, 18, 34, 12),
                            }}
                        >
                            <option value="">Elegir bóveda…</option>
                            {bovedasLista.map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.nombre} ({b.tipo})
                                </option>
                            ))}
                        </select>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug pl-0.5">
                            Se registra un egreso en esa bóveda.
                        </p>
                    </label>
                )}
            </div>

            {/* Fila 2: proveedor + categoría */}
            <div className="flex flex-wrap items-start gap-4">
                <label className="inline-flex flex-col gap-1.5 min-w-[12rem] flex-1 max-w-lg">
                    <div className="flex items-center justify-between w-full">
                        <span className={fieldLabelCls}>Proveedor de insumos</span>
                        <button
                            type="button"
                            onClick={() => window.dispatchEvent(new CustomEvent('navigateView', { detail: 'proveedores' }))}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-1 uppercase tracking-wider"
                        >
                            <Pencil className="w-3 h-3" />
                            Gestionar
                        </button>
                    </div>
                    <select
                        className={cn(selectCls, 'w-full')}
                        value={proveedorId}
                        onChange={(e) => {
                            setProveedorId(e.target.value);
                            setProductoId('');
                        }}
                        style={{
                            width: '100%',
                            maxWidth: anchoPorTexto(labelProveedor, 18, 38, 12),
                        }}
                    >
                        <option value="">Sin proveedor</option>
                        {[...proveedores]
                            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
                            .map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.nombre}
                                </option>
                            ))}
                    </select>
                </label>

                <label className="inline-flex flex-col gap-1.5 shrink-0">
                    <span className={cn(fieldLabelCls, 'text-slate-500 dark:text-slate-400')}>
                        Categoría
                    </span>
                    <select
                        className={selectCls}
                        value={categoria}
                        onChange={(e) => setCat(e.target.value as GastoCategoria)}
                        style={{ width: anchoPorTexto(categoria, 14, 22, 10) }}
                    >
                        {CATS.map((c) => (
                            <option key={c} value={c}>
                                {c}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            {/* Fila 3: insumo */}
            <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={fieldLabelCls}>¿Qué se compró?</span>
                    <label className="flex items-center gap-2 h-9 px-3 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={noEnLista}
                            onChange={(e) => {
                                setNoEnLista(e.target.checked);
                                if (e.target.checked) setProductoId('');
                            }}
                            className="rounded border-slate-300 text-rose-600 focus:ring-rose-400"
                        />
                        No está en la lista
                    </label>
                </div>

                {noEnLista ? (
                    <div className="w-full max-w-xl space-y-1">
                        <input
                            value={productoLibre}
                            onChange={(e) => setProductoLibre(e.target.value)}
                            placeholder="Escribe el insumo..."
                            className={cn(inputCls, 'w-full')}
                        />
                        {productoSugerido && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50/80 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-800/50 rounded-xl text-[11px] font-medium text-blue-700 dark:text-blue-400 animate-in fade-in slide-in-from-top-1">
                                <span className="flex-1">
                                    💡 ¿Quisiste decir <strong>{productoSugerido.nombre}</strong>?
                                </span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setNoEnLista(false);
                                        setProductoLibre('');
                                        setProductoId(productoSugerido.id);
                                    }}
                                    className="px-2 py-1 bg-blue-100 hover:bg-blue-200 dark:bg-blue-800/50 dark:hover:bg-blue-700 text-blue-800 dark:text-blue-300 rounded-lg font-bold transition-colors shadow-sm"
                                >
                                    Usar existente
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <select
                        className={cn(selectCls, 'w-full max-w-xl')}
                        value={productoId}
                        onChange={(e) => setProductoId(e.target.value)}
                        style={{
                            width: '100%',
                            maxWidth: anchoPorTexto(labelProducto, 20, 42, 12),
                        }}
                    >
                        <option value="">Elegir insumo (obligatorio para factura)</option>
                        {insumos.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.nombre}
                            </option>
                        ))}
                    </select>
                )}
                {insumos.length === 0 && !noEnLista && (
                    <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                        No hay insumos en el catálogo. Marca «No está en la lista» y escribe el nombre.
                    </p>
                )}
            </div>

            {/* Fila 4: cantidad · precio · total (bloque premium) */}
            <div className="flex flex-wrap items-stretch gap-3 p-3 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/50 dark:border-rose-900/40">
                <div className="flex flex-wrap gap-4 w-full">
                    <div className="flex-1 min-w-[6rem] space-y-1.5">
                        <span className={fieldLabelCls}>Cantidad</span>
                        <div className="relative">
                            <input
                                type="number"
                                min="0.01"
                                step="any"
                                className={cn(inputCls, 'w-full pr-8 font-black')}
                                value={cantidad}
                                onChange={(e) => setCantidad(e.target.value)}
                                ref={cantRef}
                            />
                            <div className="absolute right-2 top-0 bottom-0 flex flex-col justify-center text-slate-400">
                                <button
                                    type="button"
                                    tabIndex={-1}
                                    onClick={() =>
                                        setCantidad(String((Number.isFinite(cantNum) ? cantNum : 0) + 1))
                                    }
                                    className="hover:text-slate-600 dark:hover:text-slate-200"
                                >
                                    <ChevronUp className="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    tabIndex={-1}
                                    onClick={() =>
                                        setCantidad(
                                            String(Math.max(1, (Number.isFinite(cantNum) ? cantNum : 1) - 1))
                                        )
                                    }
                                    className="hover:text-slate-600 dark:hover:text-slate-200"
                                >
                                    <ChevronDown className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 min-w-[8rem] space-y-1.5">
                        <span className={fieldLabelCls}>Precio unitario</span>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 font-bold text-rose-500/50 dark:text-rose-400/50">
                                $
                            </span>
                            <input
                                type="text"
                                inputMode="decimal"
                                placeholder="Ej. 45000"
                                className={cn(inputCls, 'w-full pl-7 font-black')}
                                value={precioUnitario}
                                onChange={(e) => setPrecioUnitario(e.target.value)}
                            />
                        </div>
                        {sobrecostoWarning && (
                            <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 leading-tight mt-1 animate-in fade-in slide-in-from-top-1 px-1">
                                <AlertTriangle className="w-3 h-3 inline mr-1" />
                                {sobrecostoWarning}
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-[10rem] flex flex-col justify-end gap-2">
                        {editandoFacturaItemId && (
                            <button
                                type="button"
                                onClick={() => {
                                    setEditandoFacturaItemId(null);
                                    setCantidad('1');
                                    setPrecioUnitario('');
                                    setProductoId('');
                                    setProductoLibre('');
                                    setNoEnLista(insumos.length === 0);
                                }}
                                className="h-10 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors whitespace-nowrap"
                            >
                                Cancelar
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleAddAFactura}
                            className={cn(
                                "h-11 px-4 font-bold rounded-xl transition-colors whitespace-nowrap",
                                puedeAnadirAFactura
                                    ? editandoFacturaItemId
                                        ? "bg-amber-100 hover:bg-amber-200 text-amber-700 dark:bg-amber-900/30 dark:hover:bg-amber-800/50 dark:text-amber-300"
                                        : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm"
                                    : "bg-emerald-100/80 text-emerald-800/80 dark:bg-emerald-900/20 dark:text-emerald-300/80 ring-1 ring-emerald-300/60 dark:ring-emerald-700/50"
                            )}
                        >
                            {editandoFacturaItemId ? 'Actualizar ítem' : 'Añadir a Factura'}
                        </button>
                    </div>
                </div>
                {productoId && !noEnLista && proveedorId && Number(precioUnitario) > 0 && (
                    <div className="w-full mt-2 flex items-center gap-2 px-1">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-emerald-700 dark:text-emerald-400 select-none">
                            <input
                                type="checkbox"
                                checked={actualizarCatalogo}
                                onChange={(e) => setActualizarCatalogo(e.target.checked)}
                                className="rounded border-emerald-300 dark:border-emerald-700/50 text-emerald-600 focus:ring-emerald-500 bg-white/50 dark:bg-black/20"
                            />
                            Actualizar precio unitario en el catálogo del proveedor
                        </label>
                    </div>
                )}
                {motivoBloqueoAnadir && (
                    <p className="w-full text-[11px] font-semibold text-rose-600 dark:text-rose-400 mt-2">
                        Para añadir a la lista: {motivoBloqueoAnadir}
                    </p>
                )}
            </div>

            <div ref={listaFacturaRef}>
            {facturaItems.length > 0 ? (
                <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/50 dark:border-slate-800/50 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Ítems en Factura</h4>
                        <span className="text-xs font-bold text-slate-400">{facturaItems.length} ítems</span>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {[...facturaItems].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es')).map(item => (
                            <div key={item.id} className={cn(
                                "flex items-center justify-between p-2 rounded-xl shadow-sm border",
                                editandoFacturaItemId === item.id 
                                    ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50" 
                                    : "bg-white dark:bg-slate-950 border-slate-100 dark:border-slate-800"
                            )}>
                                <div className="flex flex-col min-w-0 flex-1 mr-4">
                                    <span className="text-sm font-bold truncate text-slate-700 dark:text-slate-300">
                                        {item.cantidad}x {item.nombre}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-medium">
                                        {formatCurrency(item.precioUnitario)} c/u
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-black text-rose-600 dark:text-rose-400 tabular-nums">
                                        {formatCurrency(item.total)}
                                    </span>
                                    <button 
                                        type="button" 
                                        title="Editar ítem"
                                        onClick={() => handleEditFacturaItem(item.id)}
                                        className="h-9 w-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button 
                                        type="button" 
                                        title="Eliminar ítem de la factura"
                                        onClick={() => handleRemoveFacturaItem(item.id)}
                                        className="h-9 w-9 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-900/30 flex items-center justify-center text-rose-500 hover:text-rose-600 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <p className="text-[11px] text-slate-500 font-medium px-1">
                    La lista de la factura aparecerá aquí cuando pulses «Añadir a Factura».
                </p>
            )}
            </div>

            <div className="space-y-1.5 flex-1">
                <span className={fieldLabelCls}>Total Factura (Real)</span>
                <div className="h-16 flex flex-col items-center justify-center bg-white dark:bg-slate-950 rounded-2xl border-2 border-rose-100 dark:border-rose-900/30 shadow-sm shadow-rose-100/50 dark:shadow-rose-900/20">
                    {facturaItems.length > 0 ? (
                        <div className="flex flex-col items-center">
                            <div className="flex items-center gap-1">
                                <span className="text-xl font-black text-rose-600 dark:text-rose-500">$</span>
                                <input
                                    type="number"
                                    placeholder={String(totalLista)}
                                    value={totalFacturaOverride}
                                    onChange={(e) => setTotalFacturaOverride(e.target.value)}
                                    className="w-24 bg-transparent text-2xl font-black text-rose-600 dark:text-rose-500 tabular-nums text-center focus:outline-none placeholder:text-rose-300 dark:placeholder:text-rose-700/50"
                                    title="Modifica este valor si el total de la factura física es diferente"
                                />
                            </div>
                            {totalFacturaOverride !== '' && parseFloat(totalFacturaOverride) !== totalLista && (
                                <span className="text-[9px] font-bold text-slate-400">
                                    Suma de ítems: ${formatCurrency(totalLista)}
                                </span>
                            )}
                        </div>
                    ) : (
                        <span className="text-2xl font-black text-rose-600 dark:text-rose-500 tabular-nums tracking-tight">
                            $ {formatCurrency(totalCalculado)}
                        </span>
                    )}
                    {facturaItems.length === 0 && totalCalculado > 0 && (
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            Solo 1 ítem
                        </span>
                    )}
                    {facturaItems.length > 0 && totalCalculado > 0 && (
                        <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest mt-0.5 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Tienes un ítem sin añadir a la factura
                        </span>
                    )}
                </div>
            </div>

            <label className="inline-flex flex-col gap-1.5 w-full max-w-xl">
                <span className={cn(fieldLabelCls, 'text-slate-500 dark:text-slate-400')}>
                    Nota (opcional)
                </span>
                <input
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                    placeholder="Detalle corto…"
                    className={cn(inputCls, 'w-full')}
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                />
            </label>

            <button
                type="button"
                onClick={handleSave}
                disabled={!listo || saving}
                className={cn(
                    'h-14 w-full px-4 rounded-2xl flex items-center justify-center gap-2 text-sm font-black shrink-0 transition-all duration-200',
                    listo && !saving
                        ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-md hover:shadow-lg active:scale-[0.99]'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                )}
            >
                {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                    <>
                        <Check className="w-5 h-5" />
                        Guardar gasto · {formatCurrency(montoAGuardar)}
                    </>
                )}
            </button>

            {/* Lista con filtros */}
            <div className="rounded-xl border border-rose-200 dark:border-rose-800/50 bg-white/80 dark:bg-slate-950/40 overflow-hidden">
                <div className="px-3 py-2 border-b border-rose-100 dark:border-rose-900/40 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400">
                            {tituloPeriodo}
                        </p>
                        <p className="text-xs font-black text-rose-700 dark:text-rose-300 tabular-nums">
                            {gastosFiltrados.length} · {formatCurrency(totalPeriodo)}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {(
                            [
                                ['dia', 'Día'],
                                ['semana', 'Semana'],
                                ['mes', 'Mes'],
                                ['anio', 'Año'],
                            ] as const
                        ).map(([key, label]) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setPeriodo(key)}
                                className={cn(
                                    'h-8 px-3 rounded-lg text-[11px] font-black uppercase tracking-wide transition-colors',
                                    periodo === key
                                        ? 'bg-rose-600 text-white'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <p className="text-[10px] text-slate-500">
                        La fecha de arriba marca el día de referencia (y la semana/mes/año).
                    </p>
                </div>

                {gastosFiltrados.length === 0 ? (
                    <p className="px-3 py-4 text-xs text-slate-500 font-medium text-center">
                        No hay gastos en este periodo. Guarda uno o cambia el filtro.
                    </p>
                ) : (
                    <div className="max-h-72 overflow-y-auto">
                        {gruposPorDia.map(([dia, items]) => {
                            const facturas = items.filter(g => g.esFactura).sort((a, b) => (a.descripcion || '').localeCompare(b.descripcion || '', 'es'));
                            const otrosGastos = items.filter(g => !g.esFactura).sort((a, b) => (a.descripcion || '').localeCompare(b.descripcion || '', 'es'));

                            const groups = [
                                { 
                                    type: 'factura', 
                                    title: 'Facturas de Proveedores', 
                                    items: facturas, 
                                    icon: <FileText className="w-4 h-4" />, 
                                    colorClass: 'text-emerald-700 dark:text-emerald-400', 
                                    bgClass: 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700',
                                    borderContainer: 'border-2 border-emerald-200 dark:border-emerald-800 shadow-md mb-6'
                                },
                                { 
                                    type: 'gasto', 
                                    title: 'Otros Gastos', 
                                    items: otrosGastos, 
                                    icon: <Receipt className="w-4 h-4" />, 
                                    colorClass: 'text-slate-600 dark:text-slate-300', 
                                    bgClass: 'bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700',
                                    borderContainer: 'border-2 border-slate-200 dark:border-slate-700/70 shadow-md mb-6'
                                }
                            ];

                            return (
                                <div key={dia} className="mb-8">
                                    {periodo !== 'dia' && (
                                        <div className="sticky top-0 z-[1] px-3 py-2 bg-rose-50/95 dark:bg-rose-950/80 border-y-2 border-rose-200 dark:border-rose-800 shadow-sm mb-4">
                                            <p className="text-[11px] font-black uppercase tracking-widest text-rose-600 flex items-center justify-between">
                                                <span>{formatearFechaCorta(dia)}</span>
                                                <span>
                                                    {formatCurrency(items.reduce((s, g) => s + (Number(g.monto) || 0), 0))}
                                                </span>
                                            </p>
                                        </div>
                                    )}
                                    <div className="px-2 mt-4">
                                        {groups.map(group => {
                                            if (group.items.length === 0) return null;
                                            return (
                                                <div key={group.type} className={`border rounded-xl shadow-sm overflow-hidden ${group.borderContainer}`}>
                                                    <div className={`px-3 py-2 border-b flex items-center justify-between ${group.bgClass}`}>
                                                        <p className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${group.colorClass}`}>
                                                            {group.icon} {group.title} ({group.items.length})
                                                        </p>
                                                        <p className={`text-[10px] font-black ${group.colorClass}`}>
                                                            {formatCurrency(group.items.reduce((s, g) => s + (Number(g.monto) || 0), 0))}
                                                        </p>
                                                    </div>
                                                    <ul className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-950/40">
                                                        {group.items.map((g) => {
                                                            const cajaTxt = etiquetaCaja(g);
                                                            const editando = editandoId === g.id;
                                                            return (
                                                                <li
                                                                    key={g.id}
                                                                    className="px-3 py-3 flex items-start justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors"
                                                                >
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                                                                            {g.descripcion || 'Gasto'}
                                                                        </p>
                                                                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 flex items-center gap-1 flex-wrap mt-0.5">
                                                                            <span>{formatearFechaCorta(g.fecha)} · {g.categoria}</span>
                                                                            {cajaTxt ? <span> · {cajaTxt}</span> : null}
                                                                        </p>
                                                                        {g.facturaItems && g.facturaItems.length > 0 && (
                                                                            <div className="mt-2.5 space-y-1 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                                                                                {[...g.facturaItems].sort((a: any, b: any) => (a.nombre || '').localeCompare(b.nombre || '', 'es')).map((item: any, idx: number) => (
                                                                                    <div key={idx} className="flex justify-between items-center text-[10.5px]">
                                                                                        <span className="font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                                                                                            <span className="text-slate-400">{item.cantidad}x</span> 
                                                                                            <span className="uppercase">{item.nombre}</span>
                                                                                        </span>
                                                                                        <span className="font-black text-slate-700 dark:text-slate-200 tabular-nums">
                                                                                            {formatCurrency(item.total || item.subtotal || item.precioUnitario || 0)}
                                                                                        </span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                        {editando && (
                                                                            <div className="mt-2.5 flex flex-wrap items-center gap-2">
                                                                                <input
                                                                                    type="date"
                                                                                    value={editFecha}
                                                                                    onChange={(e) =>
                                                                                        setEditFecha(e.target.value)
                                                                                    }
                                                                                    className={cn(inputCls, 'h-9 max-w-[160px]')}
                                                                                />
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() =>
                                                                                        void guardarFechaEditada(g.id)
                                                                                    }
                                                                                    className="h-9 px-3 rounded-lg bg-rose-600 text-white text-[11px] font-black"
                                                                                >
                                                                                    Guardar fecha
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setEditandoId(null);
                                                                                        setEditFecha('');
                                                                                    }}
                                                                                    className="h-9 px-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                                                                                >
                                                                                    <X className="w-4 h-4" />
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                                                                        <p className="text-[13px] font-black text-rose-600 dark:text-rose-400 tabular-nums">
                                                                            {formatCurrency(Number(g.monto) || 0)}
                                                                        </p>
                                                                        <div className="flex items-center gap-1 mt-1">
                                                                            {onUpdateGasto && (
                                                                                <button
                                                                                    type="button"
                                                                                    title="Editar gasto"
                                                                                    onClick={() => handleEditGastoCompleto(g)}
                                                                                    className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                                                                                >
                                                                                    <Pencil className="w-3.5 h-3.5" />
                                                                                </button>
                                                                            )}
                                                                            {onCambiarFecha && (
                                                                                <button
                                                                                    type="button"
                                                                                    title="Cambiar fecha"
                                                                                    onClick={() => {
                                                                                        setEditandoId(g.id);
                                                                                        setEditFecha(
                                                                                            (g.fecha || '').slice(0, 10)
                                                                                        );
                                                                                    }}
                                                                                    className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                                                                                >
                                                                                    <CalendarDays className="w-3.5 h-3.5" />
                                                                                </button>
                                                                            )}
                                                                            {onAnular && (
                                                                                <button
                                                                                    type="button"
                                                                                    title="Eliminar"
                                                                                    onClick={() => {
                                                                                        setAnulando(g);
                                                                                        setMotivoAnular('');
                                                                                        setPinAnular('');
                                                                                        setErrorAnular('');
                                                                                    }}
                                                                                    className="h-7 w-7 rounded-lg flex items-center justify-center text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:text-rose-300 dark:hover:bg-rose-950/40 transition-colors"
                                                                                >
                                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal anular */}
            {anulando && (
                <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 p-3">
                    <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <p className="text-sm font-black text-slate-800 dark:text-white">
                                    Eliminar gasto
                                </p>
                                <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                                    {anulando.descripcion} ·{' '}
                                    {formatCurrency(Number(anulando.monto) || 0)}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setAnulando(null)}
                                className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <label className="block space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-rose-600">
                                ¿Por qué lo eliminas?
                            </span>
                            <textarea
                                value={motivoAnular}
                                onChange={(e) => setMotivoAnular(e.target.value)}
                                rows={3}
                                placeholder="Ej: se digitó dos veces / era de otro día…"
                                className={cn(inputCls, 'w-full h-auto py-2 resize-none')}
                            />
                        </label>

                        {!esAdmin && (
                            <label className="block space-y-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">
                                    PIN de gerente (obligatorio)
                                </span>
                                <input
                                    type="password"
                                    inputMode="numeric"
                                    value={pinAnular}
                                    onChange={(e) =>
                                        setPinAnular(e.target.value.replace(/\D/g, '').slice(0, 8))
                                    }
                                    placeholder="••••"
                                    className={cn(inputCls, 'w-full')}
                                />
                            </label>
                        )}

                        {esAdmin && (
                            <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                Eres administrador: no necesitas PIN. Sí debes justificar el motivo.
                            </p>
                        )}

                        {errorAnular && (
                            <p className="text-xs font-bold text-rose-600">{errorAnular}</p>
                        )}

                        <div className="flex gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => setAnulando(null)}
                                className="flex-1 h-11 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-black text-slate-600"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={anulandoBusy}
                                onClick={() => void confirmarAnular()}
                                className="flex-1 h-11 rounded-xl bg-rose-600 text-white text-sm font-black disabled:opacity-60"
                            >
                                {anulandoBusy ? 'Eliminando…' : 'Eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
