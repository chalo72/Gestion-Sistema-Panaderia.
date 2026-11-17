import { generateUUID } from '@/lib/safe-utils';
import { useState, useMemo, useRef, useEffect, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import {
    DndContext,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    arrayMove,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCan, useAuth } from '@/contexts/AuthContext';
import {
    CheckCircle, X, Plus, Calendar,
    Search, Eye, Download, Image as ImageIcon,
    ArrowLeft, ArrowRight, Package, GitCompareArrows, AlertTriangle,
    TrendingUp, TrendingDown, Sparkles, Loader2,
    Camera, Zap, Check, FolderOpen,
    Trash2, ZoomIn, Filter, History,
    Truck, Receipt, ClipboardCheck, ChevronDown, Pencil, GripVertical
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { db } from '@/lib/database';
import type { Producto, Proveedor, Recepcion, RecepcionItem, PrePedido, FacturaEscaneada, PrecioProveedor, MetodoPago, CajaSesion, Gasto } from '@/types';
import { procesarImagenFactura, matchProductoEnCatalogo, matchProveedorEnCatalogo } from '@/lib/ocr-service';
import { ProductFormModal } from '@/components/productos/ProductFormModal';
import type { Categoria as CategoriaTipo } from '@/types';
import { ymdLocal, hoyLocal } from '@/lib/fecha-local';
import { cuadreFactura } from '@/lib/cuadre-factura';
import { MarcaPrecioModificado } from '@/components/precios/MarcaPrecioModificado';
import { ultimoCambioPrecio, useCambiosPrecio } from '@/lib/cambio-precio-catalogo';

/** "139.990" y "169.980" son pesos colombianos, no decimales. */
function parsearPesosCol(raw: string): number {
    const limpio = raw.replace(/[$]/g, '').replace(/\s/g, '');
    if (!limpio) return 0;
    const tienePunto = limpio.includes('.');
    const tieneComa = limpio.includes(',');
    let numero = limpio;
    if (tienePunto && tieneComa) {
        numero = limpio.lastIndexOf(',') > limpio.lastIndexOf('.')
            ? limpio.replace(/\./g, '').replace(',', '.')
            : limpio.replace(/,/g, '');
    } else if (tieneComa) {
        const partes = limpio.split(',');
        numero = partes.length === 2 && partes[1]?.length !== 3
            ? limpio.replace(',', '.')
            : limpio.replace(/,/g, '');
    } else if (tienePunto) {
        const grupos = limpio.split('.');
        const miles = grupos.length > 2 || (grupos.length === 2 && grupos[1]?.length === 3);
        if (miles) numero = limpio.replace(/\./g, '');
    }
    const n = parseFloat(numero);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

type AsaArrastre = HTMLAttributes<HTMLButtonElement> & {
    ref: (element: HTMLElement | null) => void;
};

/** El número del ticket se agarra y se suelta en otro puesto, como en la factura de papel. */
function FilaOrdenable({ id, children }: { id: string; children: (asa: AsaArrastre) => ReactNode }) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style: CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 30 : undefined,
        background: isDragging ? 'rgba(99,102,241,0.22)' : undefined,
    };
    return (
        <div ref={setNodeRef} style={style}>
            {children({ ref: setActivatorNodeRef, ...attributes, ...listeners })}
        </div>
    );
}

interface BorradorPestaña {
    id: string;
    editandoId: string | null;
    step: number;
    form: {
        proveedorId: string;
        prePedidoId?: string;
        numeroFactura: string;
        fechaFactura: string;
        imagenFactura: string | null;
        items: RecepcionItem[];
        observaciones: string;
        metodoPago: MetodoPago;
        cajaId?: string;
        incluyeIva: boolean;
        porcentajeIva: number;
        descuentoFactura: number;
        totalImpreso: string;
        /**
         * Fecha real en que entró la mercancía (día, formato YYYY-MM-DD).
         * Vacía = se usa la hora actual. Permite registrar o corregir una recepción con fecha vieja.
         */
        fechaRecepcion?: string;
    };
}

function BarraRecepcionesAbiertas({
    pestañas,
    onIr,
    onCerrar,
    onNueva,
}: {
    pestañas: { id: string; nombre: string; productos: number; activa: boolean }[];
    onIr: (id: string) => void;
    onCerrar: (id: string) => void;
    onNueva: () => void;
}) {
    return (
        <div className="flex items-center gap-2 overflow-x-auto px-3 py-2 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
            {pestañas.map(p => (
                <div key={p.id} className={cn(
                    "shrink-0 h-9 pl-3 pr-1 rounded-xl flex items-center gap-1 text-xs font-black",
                    p.activa ? "bg-indigo-600 text-white" : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200"
                )}>
                    <button type="button" onClick={() => onIr(p.id)} className="max-w-[150px] truncate">
                        {p.nombre}{p.productos > 0 ? ` · ${p.productos}` : ''}
                    </button>
                    <button type="button" onClick={() => onCerrar(p.id)} title="Cerrar esta pestaña" className="w-6 h-6 rounded-lg flex items-center justify-center opacity-70 hover:opacity-100">
                        <X className="w-3 h-3" />
                    </button>
                </div>
            ))}
            <button type="button" onClick={onNueva} className="shrink-0 h-9 px-3 rounded-xl bg-emerald-600 text-white text-xs font-black flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Otro proveedor
            </button>
        </div>
    );
}

function textoPrecio(n: number): string {
    if (!n) return '';
    return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(n);
}

interface RecepcionesProps {
    recepciones: Recepcion[];
    proveedores: Proveedor[];
    productos: Producto[];
    precios: PrecioProveedor[];
    prepedidos: PrePedido[];
    categorias: CategoriaTipo[];
    cajasAbiertas?: CajaSesion[];
    onAddRecepcion: (data: Omit<Recepcion, 'id'>) => Promise<Recepcion>;
    onConfirmarRecepcion: (recepcion: Recepcion) => Promise<void>;
    onUpdateRecepcion?: (id: string, updates: Partial<Recepcion>) => Promise<void>;
    onAjustarStock?: (productoId: string, cantidad: number, tipo: 'entrada' | 'salida' | 'ajuste', motivo: string) => Promise<void>;
    gastos?: Gasto[];
    onUpdateGasto?: (id: string, updates: Partial<Gasto>) => Promise<void>;
    onAddProducto: (producto: Omit<Producto, 'id'>) => Promise<Producto | null | void>;
    onUpdateProducto: (id: string, updates: Partial<Producto>) => Promise<void>;
    onAddOrUpdatePrecio?: (data: {
        id?: string;
        productoId: string;
        proveedorId: string;
        precioCosto: number;
        notas?: string;
        destino?: 'venta' | 'insumo';
        tipoEmbalaje?: string;
        cantidadEmbalaje?: number;
    }) => Promise<void>;
    getProveedorById: (id: string) => Proveedor | undefined;
    getProductoById: (id: string) => Producto | undefined;
    formatCurrency: (value: number) => string;
    onUpdatePrePedido?: (id: string, updates: Partial<PrePedido>) => Promise<void>;
    onAddCategoria?: (nombre: string, color: string, tipo: 'venta' | 'insumo') => Promise<CategoriaTipo>;
}

export default function Recepciones({
    recepciones, proveedores, productos, precios, prepedidos, categorias,
    cajasAbiertas = [],
    onAddRecepcion, onConfirmarRecepcion, onUpdateRecepcion, onAjustarStock, gastos, onUpdateGasto, onAddProducto, onUpdateProducto, onAddOrUpdatePrecio,
    getProveedorById, getProductoById, formatCurrency, onUpdatePrePedido, onAddCategoria
}: RecepcionesProps) {
    const { check } = useCan();
    const { usuario } = useAuth();
    const sensoresOrden = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
    const [view, setView] = useState<'list' | 'new' | 'details' | 'galeria'>('list');
    const [editandoId, setEditandoId] = useState<string | null>(null);
    const [selectedRecepcion, setSelectedRecepcion] = useState<Recepcion | null>(null);
    const [busqueda, setBusqueda] = useState('');
    const [proveedorFiltro, setProveedorFiltro] = useState<string>('todos');
    const [filtroFecha, setFiltroFecha] = useState<'todos' | 'hoy' | 'ayer' | 'semana' | 'mes'>('todos');
    const [filtroEstado, setFiltroEstado] = useState<'todos' | 'ok' | 'incidencias'>('todos');
    // Rango de fechas libres: para encontrar una recepción vieja por su día exacto.
    const [filtroFechaDesde, setFiltroFechaDesde] = useState('');
    const [filtroFechaHasta, setFiltroFechaHasta] = useState('');
    const [prePedidoSeleccionado, setPrePedidoSeleccionado] = useState<string>('');
    
    // === ESTADO PRODUCT FORM MODAL ===
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const historialPrecios = useCambiosPrecio(precios);
    const [productToEdit, setProductToEdit] = useState<Producto | null>(null);

    // === ESTADO GALERÍA DE FACTURAS ===
    const [facturasGuardadas, setFacturasGuardadas] = useState<FacturaEscaneada[]>([]);
    const [facturaSeleccionada, setFacturaSeleccionada] = useState<FacturaEscaneada | null>(null);
    const [filtroGaleriaProveedor, setFiltroGaleriaProveedor] = useState<string>('todos');
    const [filtroGaleriaFechaDesde, setFiltroGaleriaFechaDesde] = useState<string>('');
    const [filtroGaleriaFechaHasta, setFiltroGaleriaFechaHasta] = useState<string>('');

    // Cargar facturas guardadas
    useEffect(() => {
        const cargarFacturas = async () => {
            try {
                const facturas = await db.getAllFacturasEscaneadas();
                setFacturasGuardadas(facturas);
            } catch (error) {
                console.error('Error cargando facturas:', error);
            }
        };
        cargarFacturas();
    }, [view]);

    // Facturas filtradas para la galería
    const facturasFiltradas = useMemo(() => {
        return facturasGuardadas.filter(f => {
            const matchProveedor = filtroGaleriaProveedor === 'todos' || f.proveedorId === filtroGaleriaProveedor;
            const fechaEscaneo = new Date(f.fechaEscaneo);
            const matchFechaDesde = !filtroGaleriaFechaDesde || fechaEscaneo >= new Date(filtroGaleriaFechaDesde);
            const matchFechaHasta = !filtroGaleriaFechaHasta || fechaEscaneo <= new Date(filtroGaleriaFechaHasta + 'T23:59:59');
            return matchProveedor && matchFechaDesde && matchFechaHasta;
        }).sort((a, b) => new Date(b.fechaEscaneo).getTime() - new Date(a.fechaEscaneo).getTime());
    }, [facturasGuardadas, filtroGaleriaProveedor, filtroGaleriaFechaDesde, filtroGaleriaFechaHasta]);

    // Agrupar facturas por proveedor para la galería
    const facturasPorProveedor = useMemo(() => {
        const grupos: Record<string, FacturaEscaneada[]> = {};
        facturasFiltradas.forEach(f => {
            if (!grupos[f.proveedorNombre]) grupos[f.proveedorNombre] = [];
            grupos[f.proveedorNombre].push(f);
        });
        return grupos;
    }, [facturasFiltradas]);

    // Función para guardar factura en archivo
    const guardarFacturaEnArchivo = async (recepcion: Recepcion, imagenBase64: string) => {
        const proveedor = getProveedorById(recepcion.proveedorId);
        const facturaArchivo: FacturaEscaneada = {
            id: generateUUID(),
            recepcionId: recepcion.id,
            proveedorId: recepcion.proveedorId,
            proveedorNombre: proveedor?.nombre || 'Sin proveedor',
            numeroFactura: recepcion.numeroFactura,
            imagenBase64: imagenBase64,
            fechaFactura: recepcion.fechaFactura,
            fechaEscaneo: new Date().toISOString(),
            totalFactura: recepcion.totalFactura,
            cantidadProductos: recepcion.items.length,
        };
        await db.addFacturaEscaneada(facturaArchivo);
        setFacturasGuardadas(prev => [facturaArchivo, ...prev]);
        return facturaArchivo;
    };

    // Función para eliminar factura
    const eliminarFactura = async (id: string) => {
        try {
            await db.deleteFacturaEscaneada(id);
            setFacturasGuardadas(prev => prev.filter(f => f.id !== id));
            setFacturaSeleccionada(null);
            toast.success('Factura eliminada del archivo');
        } catch (error) {
            toast.error('Error al eliminar la factura');
        }
    };

    // Preventas que ya se armaron y todavía no se reciben.
    // 'enviado' también entra: marcarlo en preventa no debe esconderlo aquí.
    const prepedidosConfirmados = useMemo(() =>
        prepedidos
            .filter(p => p.estado === 'confirmado' || p.estado === 'enviado')
            .sort((a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime()),
        [prepedidos]);

    // Proveedores ordenados por última recepción (el más reciente primero)
    const proveedoresOrdenados = useMemo(() => {
        return [...proveedores].sort((a, b) => {
            const lastA = recepciones.filter(r => r.proveedorId === a.id)
                .sort((x, y) => new Date(y.fechaRecepcion).getTime() - new Date(x.fechaRecepcion).getTime())[0]?.fechaRecepcion;
            const lastB = recepciones.filter(r => r.proveedorId === b.id)
                .sort((x, y) => new Date(y.fechaRecepcion).getTime() - new Date(x.fechaRecepcion).getTime())[0]?.fechaRecepcion;
            if (!lastA && !lastB) return a.nombre.localeCompare(b.nombre);
            if (!lastA) return 1;
            if (!lastB) return -1;
            return new Date(lastB).getTime() - new Date(lastA).getTime();
        });
    }, [proveedores, recepciones]);

    // Estado para nueva recepción — debe declararse ANTES de los useMemos que lo usan
    const [newRecepcion, setNewRecepcion] = useState<{
        proveedorId: string;
        prePedidoId?: string;
        numeroFactura: string;
        fechaFactura: string;
        imagenFactura: string | null;
        items: RecepcionItem[];
        observaciones: string;
        metodoPago: MetodoPago;
        cajaId?: string;
        incluyeIva: boolean;
        porcentajeIva: number;
        descuentoFactura: number;
        totalImpreso: string;
        fechaRecepcion?: string;
    }>({
        proveedorId: '',
        prePedidoId: undefined,
        numeroFactura: '',
        fechaFactura: hoyLocal(),
        imagenFactura: null,
        items: [],
        observaciones: '',
        metodoPago: 'efectivo',
        incluyeIva: false,
        porcentajeIva: 19,
        descuentoFactura: 0,
        totalImpreso: '',
    });
    const [pestañaId, setPestañaId] = useState(() => generateUUID());
    const [pestañasEnEspera, setPestañasEnEspera] = useState<BorradorPestaña[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const imagenFileRef = useRef<File | null>(null);

    // === ESTADO PARA WIZARD (FLUJO GUIADO) ===
    const [step, setStep] = useState(1);
    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);
    const [busquedaProveedor, setBusquedaProveedor] = useState('');
    const [busquedaProducto, setBusquedaProducto] = useState('');
    const [precioDraft, setPrecioDraft] = useState<Record<string, string>>({});
    const [mostrarDropProducto, setMostrarDropProducto] = useState(false);
    const [categoriaFiltroRecepcion, setCategoriaFiltroRecepcion] = useState('');
    const [mobilePanelRec, setMobilePanelRec] = useState<'productos' | 'ticket'>('productos');
    const [pantallaFactura, setPantallaFactura] = useState(false);
    const [categoriasExpandidas, setCategoriasExpandidas] = useState<Set<string>>(new Set());
    const [preciosAActualizar, setPreciosAActualizar] = useState<Set<string>>(new Set());
    const [draftRestorado, setDraftRestorado] = useState(false);
    const [scanStep, setScanStep] = useState('');
    const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
    // formData para ProductFormModal (necesita su propio estado)
    const FORM_DATA_VACIO = {
        nombre: '', categoria: '', descripcion: '', precioVenta: '',
        margenUtilidad: '30', proveedorId: '', precioCosto: '', notasPrecio: '', imagen: '',
        tipo: 'elaborado' as 'elaborado' | 'ingrediente', unidadMedida: '',
        useHeladeriaCalc: false, costoCaja: '', unidadesPorCaja: '', costoInsumoExtra: '',
        stockActual: '', stockMinimo: '5', descuentoMayorista: ''
    };
    const [formDataModal, setFormDataModal] = useState(FORM_DATA_VACIO);

    // Precios del proveedor seleccionado (sincrónico desde prop — sin async)
    const preciosDelProveedor = useMemo(() =>
        newRecepcion.proveedorId
            ? precios.filter(p => p.proveedorId === newRecepcion.proveedorId)
            : [],
    [precios, newRecepcion.proveedorId]);

    // Cargar desde la última recepción del proveedor
    const cargarUltimaRecepcion = (proveedorId: string) => {
        const ultima = recepciones
            .filter(r => r.proveedorId === proveedorId)
            .sort((a, b) => new Date(b.fechaRecepcion).getTime() - new Date(a.fechaRecepcion).getTime())[0];
        if (!ultima) { toast.error('No hay recepciones anteriores para este proveedor'); return; }
        const items: RecepcionItem[] = ultima.items.map(i => ({
            ...i,
            id: generateUUID(),
            cantidadRecibida: i.cantidadRecibida,
            precioFacturado: i.precioFacturado,
            embalajeOk: true,
            productoOk: true,
        }));
        setNewRecepcion(prev => ({ ...prev, items }));
        toast.success(`${items.length} productos cargados desde última recepción`);
    };

    // Proveedores filtrados por búsqueda en paso 1
    const proveedoresFiltrados = useMemo(() => {
        if (!busquedaProveedor.trim()) return proveedoresOrdenados;
        return proveedoresOrdenados.filter(p =>
            p.nombre.toLowerCase().includes(busquedaProveedor.toLowerCase())
        );
    }, [proveedoresOrdenados, busquedaProveedor]);

    // Productos filtrados para autocomplete en paso 3
    const productosFiltradosAutocomplete = useMemo(() => {
        const idsEnRecepcion = new Set(newRecepcion.items.map(i => i.productoId));
        const base = productos.filter(p => !idsEnRecepcion.has(p.id));
        if (!busquedaProducto.trim()) return base.slice(0, 8);
        return base.filter(p =>
            p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase()) ||
            (p.categoria || '').toLowerCase().includes(busquedaProducto.toLowerCase())
        ).slice(0, 10);
    }, [productos, busquedaProducto, newRecepcion.items]);

    // Categorías únicas de productos (para chips del mini POS)
    const categoriasProductos = useMemo(() => {
        const cats = [...new Set(productos.map(p => p.categoria).filter(Boolean))].sort() as string[];
        return cats;
    }, [productos]);

    // Productos para el panel mini-POS (filtrados por búsqueda + categoría)
    const productosParaPanel = useMemo(() => {
        const idsEnRecepcion = new Set(newRecepcion.items.map(i => i.productoId));
        let base = productos.filter(p => !idsEnRecepcion.has(p.id));
        if (categoriaFiltroRecepcion) {
            base = base.filter(p => p.categoria === categoriaFiltroRecepcion);
        }
        if (busquedaProducto.trim()) {
            const q = busquedaProducto.toLowerCase();
            base = base.filter(p =>
                p.nombre.toLowerCase().includes(q) ||
                (p.categoria || '').toLowerCase().includes(q)
            );
        }
        return base;
    }, [productos, busquedaProducto, newRecepcion.items, categoriaFiltroRecepcion]);

    // Productos del proveedor seleccionado (fuente: PrecioProveedor + historial recepciones)
    const productosAgrupados = useMemo(() => {
        const enTicket = new Set(newRecepcion.items.map(i => i.productoId));
        if (!newRecepcion.proveedorId) return { delProveedor: [], otros: [] };

        // IDs con precio configurado para este proveedor (fuente principal)
        const idsConPrecio = new Set(preciosDelProveedor.map(p => p.productoId));
        // IDs del historial de recepciones (fuente secundaria)
        recepciones
            .filter(r => r.proveedorId === newRecepcion.proveedorId)
            .forEach(r => r.items.forEach(i => idsConPrecio.add(i.productoId)));

        const base = productos.filter(p => !enTicket.has(p.id));

        if (busquedaProducto.trim()) {
            const q = busquedaProducto.toLowerCase();
            const todos = base.filter(p =>
                p.nombre.toLowerCase().includes(q) || (p.categoria || '').toLowerCase().includes(q)
            );
            return { delProveedor: [], otros: todos };
        }

        const delProveedor = base.filter(p => idsConPrecio.has(p.id));
        // "otros" se muestra colapsado solo si el usuario busca — no se lista por defecto
        return { delProveedor, otros: [] };
    }, [newRecepcion.proveedorId, newRecepcion.items, productos, recepciones, busquedaProducto, preciosDelProveedor]);

    // Cambios de precio detectados
    const cambiosPrecio = useMemo(() => {
        return newRecepcion.items.filter(item => {
            if (!item.precioFacturado) return false;
            const pp = preciosDelProveedor.find(p => p.productoId === item.productoId);
            const prod = getProductoById(item.productoId);
            const base = pp?.precioCosto || prod?.costoBase || 0;
            if (!base) return false;
            return Math.abs((item.precioFacturado - base) / base) > 0.02;
        });
    }, [newRecepcion.items, preciosDelProveedor, getProductoById]);

    const handleSubmitModal = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formDataModal.nombre || !formDataModal.categoria) {
            toast.error('Nombre y categoría son obligatorios');
            return;
        }
        const precioVenta = parseFloat(formDataModal.precioVenta) || 0;
        const costo = parseFloat(formDataModal.precioCosto) || 0;
        const productoData = {
            nombre: formDataModal.nombre,
            categoria: formDataModal.categoria,
            descripcion: formDataModal.descripcion,
            precioVenta,
            costoBase: costo,
            imagen: formDataModal.imagen,
            tipo: formDataModal.tipo || 'elaborado',
            unidadMedida: formDataModal.unidadMedida || 'unidad',
            stockActual: formDataModal.stockActual === '' ? undefined : parseInt(formDataModal.stockActual) || 0,
            stockMinimo: parseInt(formDataModal.stockMinimo) || 5,
        };
        const productoExistiaAntes = !productToEdit && productos.some(
            p => p.nombre.trim().toLocaleLowerCase('es-CO') === productoData.nombre.trim().toLocaleLowerCase('es-CO')
        );
        try {
            if (productToEdit) {
                await onUpdateProducto(productToEdit.id, productoData);
                toast.success('Producto actualizado');
            } else {
                let productoCreado: Producto | null = null;
                let falloSecundario = false;
                try {
                    productoCreado = (await onAddProducto(productoData)) ?? null;
                } catch {
                    // addProducto puede persistir el producto antes de fallar al crear su inventario.
                    falloSecundario = true;
                }

                if (!productoCreado) {
                    const normalizar = (nombre: string) => nombre.trim().toLocaleLowerCase('es-CO');
                    const existentes = await db.getAllProductos().catch(() => productos);
                    productoCreado = existentes.find(p => normalizar(p.nombre) === normalizar(productoData.nombre)) ?? null;
                }
                if (!productoCreado) throw new Error('No se encontró el producto guardado');

                handleAddItem(productoCreado.id, productoCreado);
                if (falloSecundario) {
                    toast.message('El producto se guardó. Revisa su inventario al terminar la recepción.');
                }

                const proveedorId = formDataModal.proveedorId || newRecepcion.proveedorId;
                if (onAddOrUpdatePrecio && proveedorId && costo > 0) {
                    try {
                        await onAddOrUpdatePrecio({
                            productoId: productoCreado.id,
                            proveedorId,
                            precioCosto: Math.round(costo * 100) / 100,
                            destino: productoCreado.tipo === 'ingrediente' ? 'insumo' : 'venta',
                        });
                        toast.success(`Producto guardado en el catálogo de ${getProveedorById(proveedorId)?.nombre || 'este proveedor'}`);
                    } catch {
                        toast.error('El producto se creó, pero no se pudo guardar el precio del proveedor. Puedes reintentarlo desde el ticket.');
                    }
                } else if (!proveedorId) {
                    toast.message('Producto creado y añadido a la recepción. Selecciona un proveedor para enlazar su catálogo.');
                }
            }
            setIsProductModalOpen(false);
            setProductToEdit(null);
            setFormDataModal(FORM_DATA_VACIO);
            if (!productToEdit) {
                toast.success(productoExistiaAntes
                    ? `"${productoData.nombre}" se agregó a la recepción`
                    : `"${productoData.nombre}" quedó disponible para la recepción`);
            }
        } catch {
            toast.error('Error al guardar el producto');
        }
    };

    const leerBorradoresGuardados = (): { lista: BorradorPestaña[]; activaId: string } => {
        const vacio = { lista: [] as BorradorPestaña[], activaId: '' };
        try {
            const rawTabs = localStorage.getItem('rec_draft_tabs_v1');
            const rawUno = localStorage.getItem('rec_draft_v2');
            const rawBackup = localStorage.getItem('rec_draft_last_good_v1');
            let lista: BorradorPestaña[] = [];
            let activaId = '';
            if (rawTabs) {
                const parsed = JSON.parse(rawTabs);
                lista = Array.isArray(parsed?.pestañas) ? parsed.pestañas : [];
                activaId = parsed?.activaId || '';
            }
            if (lista.length === 0 && rawUno) {
                const parsed = JSON.parse(rawUno);
                const items: RecepcionItem[] = parsed?.form?.items || [];
                if (items.length > 0 || parsed?.form?.proveedorId) {
                    lista = [{ id: generateUUID(), editandoId: null, step: parsed.step || 1, form: parsed.form }];
                }
            }
            // Si el guardado vacío borró las claves vivas, el respaldo bueno aún puede tener la 36.
            if (lista.length === 0 && rawBackup) {
                const parsed = JSON.parse(rawBackup);
                lista = Array.isArray(parsed?.pestañas) ? parsed.pestañas : [];
                activaId = parsed?.activaId || '';
            }
            lista = lista.filter(p => p?.form && (p.form.proveedorId || (p.form.items || []).length > 0));
            return { lista, activaId };
        } catch {
            return vacio;
        }
    };

    const aplicarBorradores = (lista: BorradorPestaña[], activaId: string) => {
        if (lista.length === 0) return false;
        const activa = lista.find(p => p.id === activaId) || lista[0];
        setPestañaId(activa.id);
        setNewRecepcion(activa.form);
        setEditandoId(activa.editandoId);
        setStep(activa.step || 1);
        setPestañasEnEspera(lista.filter(p => p.id !== activa.id));
        setView('new');
        return true;
    };

    // Primero recuperar. El guardado NO corre hasta que esto termine — si no, borra la 36 al abrir.
    useEffect(() => {
        if (draftRestorado) return;
        try {
            const { lista, activaId } = leerBorradoresGuardados();
            if (lista.length === 0) {
                setDraftRestorado(true);
                return;
            }
            const nombres = lista.map(p => getProveedorById(p.form.proveedorId)?.nombre || 'sin proveedor').join(', ');
            const productos = lista.reduce((s, p) => s + (p.form.items?.length || 0), 0);
            const quiere = confirm(
                lista.length === 1
                    ? `Hay una recepción sin guardar de "${nombres}" con ${lista[0].form.items.length} productos.\n\n¿La continúas donde la dejaste?`
                    : `Hay ${lista.length} recepciones sin guardar (${productos} productos): ${nombres}.\n\n¿Las continúas? Cada una queda en su pestaña.`
            );
            if (quiere) {
                aplicarBorradores(lista, activaId);
                toast.success(lista.length === 1 ? 'Recepción recuperada' : `${lista.length} recepciones recuperadas`);
            }
            // Si dice que no, NO borramos el respaldo bueno — solo las claves vivas.
            if (!quiere) {
                try {
                    localStorage.removeItem('rec_draft_tabs_v1');
                    localStorage.removeItem('rec_draft_v2');
                } catch {}
            }
        } catch {
            /* no tocar el respaldo bueno */
        }
        setDraftRestorado(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Cada pestaña es una recepción abierta. Solo escribe DESPUÉS de intentar recuperar.
    useEffect(() => {
        if (!draftRestorado) return;
        const actual: BorradorPestaña = { id: pestañaId, editandoId, step, form: newRecepcion };
        const utiles = [actual, ...pestañasEnEspera].filter(p => p.form.proveedorId || p.form.items.length > 0);
        try {
            if (utiles.length === 0) {
                // No borrar el respaldo bueno: solo las claves de trabajo.
                localStorage.removeItem('rec_draft_tabs_v1');
                localStorage.removeItem('rec_draft_v2');
                return;
            }
            const payload = JSON.stringify({ activaId: pestañaId, pestañas: utiles, guardadoEn: new Date().toISOString() });
            localStorage.setItem('rec_draft_tabs_v1', payload);
            localStorage.setItem('rec_draft_v2', JSON.stringify({ form: newRecepcion, step }));
            // Respaldo que NUNCA se borra al abrir vacío — solo se actualiza con datos reales.
            localStorage.setItem('rec_draft_last_good_v1', payload);
        } catch {}
    }, [newRecepcion, step, pestañaId, pestañasEnEspera, editandoId, draftRestorado]);

    // === FUNCIÓN DE ESCANEO OCR REAL (Tesseract.js) ===
    const handleScanFactura = async () => {
        if (!imagenFileRef.current) {
            toast.error('Primero sube una foto de la factura');
            return;
        }

        setIsScanning(true);
        setScanProgress(0);
        setScanStep('Leyendo información...');

        try {
            const resultado = await procesarImagenFactura(
                imagenFileRef.current,
                (progreso) => {
                    setScanProgress(progreso);
                    if (progreso < 30) setScanStep('Preparando imagen...');
                    else if (progreso < 60) setScanStep('Buscando productos...');
                    else if (progreso < 85) setScanStep('Verificando precios...');
                    else setScanStep('Casi listo...');
                }
            );

            // ── MATCHING FORENSE v2 ───────────────────────────────
            // Buscar proveedor con motor Jaro-Winkler
            let proveedorMatchId = '';
            if (resultado.proveedor?.nombre) {
                const mProv = matchProveedorEnCatalogo(
                    resultado.proveedor.nombre,
                    proveedores,
                    p => p.nombre,
                    0.52
                );
                if (mProv.indice >= 0) {
                    proveedorMatchId = proveedores[mProv.indice].id;
                }
            }

            // Matching de productos con algoritmo Jaro-Winkler + tokens
            const noEncontrados: string[] = [];
            const difPrecios: Array<{ nombre: string; precioAnterior: number; precioNuevo: number; productoId: string }> = [];

            const itemsEscaneados: RecepcionItem[] = resultado.productos
                .map(prod => {
                    const match = matchProductoEnCatalogo(
                        prod.nombre,
                        productos,
                        p => p.nombre,
                        0.55
                    );

                    if (match.indice < 0) {
                        noEncontrados.push(prod.nombre);
                        console.warn(`[OCR Forense] Sin match: "${prod.nombre}" (mejor score: ${(match.score * 100).toFixed(0)}%)`);
                        return null;
                    }

                    const productoReal = productos[match.indice];

                    // Detectar diferencia de precio
                    const precioCatalogo = productoReal.costoBase || 0;
                    const precioFacturado = prod.precioUnitario || 0;
                    if (precioFacturado > 0 && precioCatalogo > 0) {
                        const diff = Math.abs(precioFacturado - precioCatalogo) / precioCatalogo;
                        if (diff > 0.02) { // diferencia > 2%
                            difPrecios.push({
                                nombre: productoReal.nombre,
                                precioAnterior: precioCatalogo,
                                precioNuevo: precioFacturado,
                                productoId: productoReal.id,
                            });
                        }
                    }

                    return {
                        id: generateUUID(),
                        productoId: productoReal.id,
                        cantidadEsperada: prod.cantidad || 1,
                        cantidadRecibida: prod.cantidad || 1,
                        precioEsperado: precioCatalogo || precioFacturado,
                        precioFacturado: precioFacturado || precioCatalogo,
                        embalajeOk: true,
                        productoOk: true,
                        cantidadOk: true,
                        modeloOk: true,
                        defectuosos: 0,
                        observaciones: `OCR match: ${match.metodo} ${(match.score * 100).toFixed(0)}%`
                    };
                })
                .filter((item): item is RecepcionItem => item !== null);

            const numFactura = resultado.numeroFactura || `F-${Date.now().toString().slice(-6)}`;

            setNewRecepcion(prev => ({
                ...prev,
                proveedorId: proveedorMatchId || prev.proveedorId,
                numeroFactura: numFactura,
                fechaFactura: resultado.fechaFactura || prev.fechaFactura,
                items: itemsEscaneados.length > 0 ? [...prev.items, ...itemsEscaneados] : prev.items
            }));

            // Notificar productos no encontrados
            if (noEncontrados.length > 0) {
                toast.warning(
                    `${noEncontrados.length} producto${noEncontrados.length > 1 ? 's' : ''} sin coincidir: ${noEncontrados.slice(0, 3).join(', ')}${noEncontrados.length > 3 ? '...' : ''}`,
                    { duration: 7000, description: 'Agrégalos manualmente o verificá la ortografía en el catálogo.' }
                );
            }

            // Notificar diferencias de precio y ofrecer actualizar
            if (difPrecios.length > 0) {
                difPrecios.forEach(d => {
                    const subida = d.precioNuevo > d.precioAnterior;
                    toast(
                        <div className="flex flex-col gap-1">
                            <span className="font-bold text-sm">{subida ? '📈' : '📉'} Precio cambiado: {d.nombre}</span>
                            <span className="text-xs text-muted-foreground">
                                Catálogo: {formatCurrency(d.precioAnterior)} → Factura: {formatCurrency(d.precioNuevo)}
                            </span>
                        </div>,
                        {
                            duration: 12000,
                            action: {
                                label: 'Editar Maestro',
                                onClick: () => {
                                    const p = productos.find(prod => prod.id === d.productoId);
                                    if (p) {
                                        setProductToEdit(p);
                                        setIsProductModalOpen(true);
                                    }
                                },
                            },
                        }
                    );
                });
            }

            setScanProgress(100);
            setScanStep('¡Lectura terminada!');

            if (itemsEscaneados.length === 0) {
                toast.warning('No pudimos leer los productos. Por favor agrégalos a mano.', {
                    duration: 6000,
                });
            } else {
                const provNombre = proveedorMatchId
                    ? proveedores.find(p => p.id === proveedorMatchId)?.nombre
                    : undefined;
                toast.success(
                    <div className="flex flex-col gap-1">
                        <span className="font-semibold text-emerald-700 text-sm">✨ Factura Leída</span>
                        <span className="text-[10px] text-muted-foreground uppercase font-black">
                            {itemsEscaneados.length} productos • {provNombre || 'Proveedor por definir'}
                        </span>
                    </div>
                );
            }
        } catch (err) {
            console.error("ANTIGRAVITY: Error crítico en Scanner:", err);
            toast.error('Error al procesar la imagen forense. Intenta con una foto más clara.');
        } finally {
            setTimeout(() => {
                setIsScanning(false);
                setScanProgress(0);
                setScanStep('');
            }, 1500);
        }
    };

    // Vincular pre-pedido: auto-rellena items esperados
    const handleVincularPrePedido = (pedidoId: string) => {
        setPrePedidoSeleccionado(pedidoId);
        if (!pedidoId) {
            setNewRecepcion(prev => ({ ...prev, prePedidoId: undefined, proveedorId: '', items: [] }));
            return;
        }
        const pedido = prepedidos.find(p => p.id === pedidoId);
        if (!pedido) return;

        const itemsDesdePrePedido: RecepcionItem[] = pedido.items
            .filter(item => getProductoById(item.productoId))
            .map(item => ({
                id: generateUUID(),
                productoId: item.productoId,
                cantidadEsperada: item.cantidad,
                cantidadRecibida: item.cantidad, // Pre-rellenado con lo esperado
                precioEsperado: item.precioUnitario,
                precioFacturado: item.precioUnitario, // Pre-rellenado
                embalajeOk: true,
                productoOk: true,
                cantidadOk: true,
                modeloOk: true,
                defectuosos: 0,
                observaciones: ''
            }));

        if (newRecepcion.items.length > 0 && newRecepcion.proveedorId && newRecepcion.proveedorId !== pedido.proveedorId) {
            const id = generateUUID();
            setPestañasEnEspera(prev => [...prev, { id: pestañaId, editandoId, step, form: newRecepcion }]);
            setPestañaId(id);
            setEditandoId(null);
            setStep(1);
            setNewRecepcion({
                ...formularioVacio(),
                prePedidoId: pedidoId,
                proveedorId: pedido.proveedorId,
                items: itemsDesdePrePedido,
            });
            setPantallaFactura(false);
            setPrecioDraft({});
            setView('new');
            toast.success(`La otra recepción se quedó en su pestaña. Esta es ${getProveedorById(pedido.proveedorId)?.nombre || 'el proveedor nuevo'}.`);
            return;
        }
        setNewRecepcion(prev => ({
            ...prev,
            prePedidoId: pedidoId,
            proveedorId: pedido.proveedorId,
            items: itemsDesdePrePedido
        }));
        toast.success(`Pre-pedido vinculado: ${pedido.items.length} productos cargados`);
    };

    // Filtrar recepciones
    // --- KPIs DE AUDITORÍA LOGÍSTICA ---
    const stats = useMemo(() => {
        const estaSemana = new Date();
        estaSemana.setDate(estaSemana.getDate() - 7);
        const recSemana = recepciones.filter(r => new Date(r.fechaRecepcion) >= estaSemana);
        const inversion = recSemana.reduce((s, r) => s + r.totalFactura, 0);
        const conIncidencias = recepciones.filter(r => r.items.some(i => !i.productoOk || !i.embalajeOk)).length;
        const tasaIncidencia = recepciones.length > 0 ? (conIncidencias / recepciones.length) * 100 : 0;
        
        return { inversion, tasaIncidencia, totalMes: recepciones.length };
    }, [recepciones]);

    // Filtrar recepciones para la lista principal (Shield-Safe-Filter)
    const filteredRecepciones = useMemo(() => {
        try {
            if (!recepciones || !Array.isArray(recepciones)) return [];
            
            const hoy = new Date();
            const yyyy = hoy.getFullYear();
            const mm = String(hoy.getMonth() + 1).padStart(2, '0');
            const dd = String(hoy.getDate()).padStart(2, '0');
            const hoyStr = `${yyyy}-${mm}-${dd}`;

            const ayer = new Date();
            ayer.setDate(hoy.getDate() - 1);
            const ayerStr = `${ayer.getFullYear()}-${String(ayer.getMonth() + 1).padStart(2, '0')}-${String(ayer.getDate()).padStart(2, '0')}`;

            const semanaAtras = new Date();
            semanaAtras.setDate(hoy.getDate() - 7);
            const mesActualStr = `${yyyy}-${mm}`;

            return recepciones.filter(recepcion => {
                if (!recepcion || deletedIds.has(recepcion.id)) return false;
                const proveedor = getProveedorById(recepcion.proveedorId);
                const matchBusqueda =
                    (recepcion.numeroFactura?.toLowerCase() || "").includes(busqueda.toLowerCase()) ||
                    (proveedor?.nombre?.toLowerCase() || "").includes(busqueda.toLowerCase());
                const matchProveedor = proveedorFiltro === 'todos' || recepcion.proveedorId === proveedorFiltro;

                // Filtro fecha
                const fRec = (recepcion.fechaRecepcion || recepcion.fechaFactura || '').slice(0, 10);
                let matchFecha = true;
                if (filtroFecha === 'hoy') matchFecha = fRec === hoyStr;
                else if (filtroFecha === 'ayer') matchFecha = fRec === ayerStr;
                else if (filtroFecha === 'semana') matchFecha = fRec >= ymdLocal(semanaAtras);
                else if (filtroFecha === 'mes') matchFecha = fRec.slice(0, 7) === mesActualStr;
                // Rango libre (para buscar fechas viejas por día exacto).
                if (filtroFechaDesde && fRec && fRec < filtroFechaDesde) matchFecha = false;
                if (filtroFechaHasta && fRec && fRec > filtroFechaHasta) matchFecha = false;

                // Filtro estado incidencias
                const hasIssues = recepcion.items.some(i => !i.productoOk || !i.embalajeOk || i.defectuosos > 0);
                let matchEstado = true;
                if (filtroEstado === 'ok') matchEstado = !hasIssues;
                else if (filtroEstado === 'incidencias') matchEstado = hasIssues;

                return matchBusqueda && matchProveedor && matchFecha && matchEstado;
            }).sort((a, b) => {
                const dateA = a.fechaRecepcion ? new Date(a.fechaRecepcion).getTime() : 0;
                const dateB = b.fechaRecepcion ? new Date(b.fechaRecepcion).getTime() : 0;
                return dateB - dateA;
            });
        } catch (error) {
            console.error("Shield-Guardian: Error filtrando recepciones", error);
            return [];
        }
    }, [recepciones, busqueda, proveedorFiltro, filtroFecha, filtroEstado, filtroFechaDesde, filtroFechaHasta, getProveedorById, deletedIds]);

    // Eliminar recepción del historial
    const handleDeleteRecepcion = async (id: string) => {
        if (!confirm('¿Eliminar esta recepción del historial?')) return;
        setDeletedIds(prev => new Set([...prev, id]));
        try {
            await db.deleteRecepcion(id);
        } catch {
            setDeletedIds(prev => { const s = new Set(prev); s.delete(id); return s; });
            toast.error('Error al eliminar');
        }
    };

    // Reutilizar recepción: pre-llena el formulario con los datos de una existente
    const handleReutilizarRecepcion = (recepcion: Recepcion) => {
        const items: RecepcionItem[] = recepcion.items.map(i => ({
            ...i,
            id: generateUUID(),
            cantidadRecibida: i.cantidadRecibida,
            precioFacturado: i.precioFacturado,
            embalajeOk: true,
            productoOk: true,
        }));
        setNewRecepcion({
            proveedorId: recepcion.proveedorId,
            prePedidoId: undefined,
            numeroFactura: '',
            fechaFactura: hoyLocal(),
            imagenFactura: null,
            items,
            observaciones: '',
            metodoPago: recepcion.metodoPago || 'efectivo',
            cajaId: recepcion.cajaId,
            incluyeIva: !!recepcion.incluyeIva,
            porcentajeIva: recepcion.porcentajeIva ?? 19,
            descuentoFactura: 0,
            totalImpreso: '',
        });
        setEditandoId(null);
        setView('new');
        toast.success(`${items.length} productos cargados de la recepción anterior`);
    };

    // Manejar subida de imagen
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            imagenFileRef.current = file;
            const reader = new FileReader();
            reader.onloadend = () => {
                setNewRecepcion(prev => ({ ...prev, imagenFactura: reader.result as string }));
                toast.success("Foto cargada. ¿Quieres escanearla para ahorrar tiempo?", {
                    icon: <Zap className="w-4 h-4 text-amber-500" />
                });
            };
            reader.readAsDataURL(file);
        }
    };

    // Agregar Item a la recepción
    const handleAddItem = (productoId: string, productoDirecto?: Producto) => {
        const producto = productoDirecto || getProductoById(productoId);
        if (!producto) return;
        // Precio preferido: precioCosto del proveedor > costoBase del producto
        const precioProveedor = preciosDelProveedor.find(pp => pp.productoId === productoId);
        const precioBase = precioProveedor?.precioCosto || producto.costoBase || 0;

        const newItem: RecepcionItem = {
            id: generateUUID(),
            productoId,
            cantidadEsperada: 0,
            cantidadRecibida: 1,
            precioEsperado: precioBase,
            precioFacturado: precioBase,
            embalajeOk: true,
            productoOk: true,
            cantidadOk: true,
            modeloOk: true,
            defectuosos: 0,
            observaciones: ''
        };

        setNewRecepcion(prev => ({ ...prev, items: [...prev.items, newItem] }));
    };

    // Actualizar Item
    const handleUpdateItem = (id: string, updates: Partial<RecepcionItem>) => {
        setNewRecepcion(prev => ({
            ...prev,
            items: prev.items.map(i => i.id === id ? { ...i, ...updates } : i)
        }));
    };

    const alSoltarOrden = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        setNewRecepcion(prev => {
            const desde = prev.items.findIndex(i => i.id === active.id);
            const hasta = prev.items.findIndex(i => i.id === over.id);
            if (desde < 0 || hasta < 0) return prev;
            return { ...prev, items: arrayMove(prev.items, desde, hasta) };
        });
    };

    const formularioVacio = () => ({
        proveedorId: '',
        prePedidoId: undefined as string | undefined,
        numeroFactura: '',
        fechaFactura: hoyLocal(),
        imagenFactura: null as string | null,
        items: [] as RecepcionItem[],
        observaciones: '',
        metodoPago: 'efectivo' as MetodoPago,
        cajaId: undefined as string | undefined,
        incluyeIva: false,
        porcentajeIva: 19,
        descuentoFactura: 0,
        totalImpreso: '',
    });

    const nombrePestaña = (proveedorId: string, productos: number) => {
        const nombre = getProveedorById(proveedorId)?.nombre;
        if (nombre) return nombre;
        if (productos > 0) return 'Sin proveedor';
        return 'Nueva';
    };

    const pestañasVisibles = [
        { id: pestañaId, nombre: nombrePestaña(newRecepcion.proveedorId, newRecepcion.items.length), productos: newRecepcion.items.length, activa: true, form: newRecepcion, editandoId },
        ...pestañasEnEspera.map(p => ({
            id: p.id,
            nombre: nombrePestaña(p.form.proveedorId, p.form.items.length),
            productos: p.form.items.length,
            activa: false,
            form: p.form,
            editandoId: p.editandoId,
        })),
    ];

    const limpiarPantallaAlCambiar = () => {
        setPantallaFactura(false);
        setPrecioDraft({});
        setBusquedaProducto('');
        imagenFileRef.current = null;
    };

    const abrirOtraRecepcion = () => {
        const tieneTrabajo = !!(newRecepcion.proveedorId || newRecepcion.items.length > 0 || editandoId);
        if (!tieneTrabajo) {
            setView('new');
            return;
        }
        const id = generateUUID();
        setPestañasEnEspera(prev => [...prev, { id: pestañaId, editandoId, step, form: newRecepcion }]);
        setPestañaId(id);
        setNewRecepcion(formularioVacio());
        setEditandoId(null);
        setStep(1);
        limpiarPantallaAlCambiar();
        setView('new');
    };

    const irAPestaña = (id: string) => {
        if (id === pestañaId) {
            setView('new');
            return;
        }
        const destino = pestañasEnEspera.find(p => p.id === id);
        if (!destino) return;
        setPestañasEnEspera(prev => [
            ...prev.filter(p => p.id !== id),
            { id: pestañaId, editandoId, step, form: newRecepcion },
        ]);
        setPestañaId(destino.id);
        setNewRecepcion(destino.form);
        setEditandoId(destino.editandoId);
        setStep(destino.step || 1);
        limpiarPantallaAlCambiar();
        setView('new');
    };

    const cerrarPestaña = (id: string) => {
        const datos = id === pestañaId
            ? { form: newRecepcion, editandoId }
            : pestañasEnEspera.find(p => p.id === id);
        if (!datos) return;
        const tiene = datos.form.items.length > 0 || !!datos.form.proveedorId;
        if (tiene && !confirm(`¿Cerrar la recepción de ${nombrePestaña(datos.form.proveedorId, datos.form.items.length)}? Lo que no se haya guardado se pierde.`)) return;
        if (id !== pestañaId) {
            setPestañasEnEspera(prev => prev.filter(p => p.id !== id));
            return;
        }
        const siguiente = pestañasEnEspera[0];
        if (!siguiente) {
            setNewRecepcion(formularioVacio());
            setEditandoId(null);
            setStep(1);
            setPestañaId(generateUUID());
            limpiarPantallaAlCambiar();
            setView('list');
            return;
        }
        setPestañasEnEspera(prev => prev.slice(1));
        setPestañaId(siguiente.id);
        setNewRecepcion(siguiente.form);
        setEditandoId(siguiente.editandoId);
        setStep(siguiente.step || 1);
        limpiarPantallaAlCambiar();
    };

    const seguirConLaSiguiente = () => {
        limpiarPantallaAlCambiar();
        const resto = pestañasEnEspera.filter(p => p.id !== pestañaId);
        if (resto.length === 0) {
            setPestañasEnEspera([]);
            setView('list');
            setStep(1);
            setEditandoId(null);
            setNewRecepcion(formularioVacio());
            setPestañaId(generateUUID());
            return;
        }
        const siguiente = resto[0];
        setPestañasEnEspera(resto.slice(1));
        setPestañaId(siguiente.id);
        setNewRecepcion(siguiente.form);
        setEditandoId(siguiente.editandoId);
        setStep(siguiente.step || 1);
        setView('new');
        toast.info(`Esta ya quedó guardada. Sigues con ${nombrePestaña(siguiente.form.proveedorId, siguiente.form.items.length)}.`);
    };

    const armarCuadre = () => cuadreFactura(newRecepcion.items, {
        incluyeIva: newRecepcion.incluyeIva,
        porcentajeIva: newRecepcion.porcentajeIva,
        descuento: newRecepcion.descuentoFactura,
        totalImpreso: parseFloat(newRecepcion.totalImpreso) || null,
    });

    const handleEditarRecepcion = (recepcion: Recepcion) => {
        const form = {
            proveedorId: recepcion.proveedorId,
            prePedidoId: recepcion.prePedidoId,
            numeroFactura: recepcion.numeroFactura || '',
            fechaFactura: (recepcion.fechaFactura || '').slice(0, 10) || hoyLocal(),
            fechaRecepcion: ymdLocal(recepcion.fechaRecepcion || recepcion.fechaFactura || ''),
            imagenFactura: recepcion.imagenFactura || null,
            items: recepcion.items.map(i => ({ ...i })),
            observaciones: recepcion.observaciones || '',
            metodoPago: recepcion.metodoPago || 'efectivo' as MetodoPago,
            cajaId: recepcion.cajaId,
            incluyeIva: !!recepcion.incluyeIva,
            porcentajeIva: recepcion.porcentajeIva ?? 19,
            descuentoFactura: recepcion.descuentoFactura ?? 0,
            totalImpreso: recepcion.totalImpreso ? String(recepcion.totalImpreso) : '',
        };
        if ((newRecepcion.items.length > 0 || newRecepcion.proveedorId) && editandoId !== recepcion.id) {
            setPestañasEnEspera(prev => [...prev, { id: pestañaId, editandoId, step, form: newRecepcion }]);
            setPestañaId(generateUUID());
        }
        setEditandoId(recepcion.id);
        setNewRecepcion(form);
        setView('new');
        toast.info('Estás corrigiendo una recepción ya guardada. El inventario solo se mueve por la diferencia.');
    };

    // Guardar Recepción
    const handleSave = async (preciosSet?: Set<string>) => {
        if (!newRecepcion.proveedorId || newRecepcion.items.length === 0) {
            toast.error('Selecciona un proveedor y agrega al menos un producto.');
            return;
        }
        const numFactura = newRecepcion.numeroFactura || `F-${Date.now().toString().slice(-6)}`;

        try {
            const fechaRecDia = (newRecepcion.fechaRecepcion || '').slice(0, 10);
            // Se guarda a las 12:00 hora local para que la zona horaria de Colombia (-05:00) no corra el día.
            const fechaRecISO = fechaRecDia ? new Date(`${fechaRecDia}T12:00:00`).toISOString() : null;
            const cuadre = armarCuadre();
            const total = cuadre.total;
            const camposDinero = {
                totalFactura: total,
                incluyeIva: newRecepcion.incluyeIva,
                porcentajeIva: newRecepcion.incluyeIva ? newRecepcion.porcentajeIva : 0,
                descuentoFactura: newRecepcion.descuentoFactura || 0,
                totalImpreso: parseFloat(newRecepcion.totalImpreso) || undefined,
                subtotalLineas: cuadre.subtotal,
                ivaFactura: cuadre.iva,
            };

            if (editandoId) {
                if (!onUpdateRecepcion) {
                    toast.error('No se puede corregir el historial desde esta pantalla');
                    return;
                }
                const anterior = recepciones.find(r => r.id === editandoId);
                if (anterior && onAjustarStock) {
                    const antes = new Map<string, number>();
                    const ahora = new Map<string, number>();
                    anterior.items.forEach(i => antes.set(i.productoId, (antes.get(i.productoId) || 0) + (Number(i.cantidadRecibida) || 0)));
                    newRecepcion.items.forEach(i => ahora.set(i.productoId, (ahora.get(i.productoId) || 0) + (Number(i.cantidadRecibida) || 0)));
                    const ids = new Set([...antes.keys(), ...ahora.keys()]);
                    for (const productoId of ids) {
                        const delta = (ahora.get(productoId) || 0) - (antes.get(productoId) || 0);
                        if (delta === 0) continue;
                        await onAjustarStock(
                            productoId,
                            Math.abs(delta),
                            delta > 0 ? 'entrada' : 'salida',
                            `Corrección recepción ${numFactura}`
                        );
                    }
                }
                await onUpdateRecepcion(editandoId, {
                    numeroFactura: numFactura,
                    fechaFactura: new Date(newRecepcion.fechaFactura).toISOString(),
                    items: newRecepcion.items,
                    observaciones: newRecepcion.observaciones,
                    metodoPago: newRecepcion.metodoPago,
                    cajaId: newRecepcion.cajaId,
                    imagenFactura: newRecepcion.imagenFactura || undefined,
                    ...(fechaRecISO ? { fechaRecepcion: fechaRecISO } : {}),
                    ...camposDinero,
                });
                if (onUpdateGasto && gastos) {
                    const facturaAnterior = anterior?.numeroFactura;
                    const gasto = gastos.find(g =>
                        g.categoria === 'Materia Prima' &&
                        g.proveedorId === newRecepcion.proveedorId &&
                        (g.descripcion === `Compra Mercancía: Factura #${facturaAnterior || numFactura}` ||
                         g.descripcion === `Compra Mercancía: Factura #${numFactura}`)
                    );
                    if (gasto) {
                        const metodoPago = newRecepcion.metodoPago || 'efectivo';
                        await onUpdateGasto(gasto.id, {
                            monto: total,
                            descripcion: `Compra Mercancía: Factura #${numFactura}`,
                            metodoPago,
                            estado: metodoPago === 'credito' ? 'pendiente' : (gasto.estado === 'anulado' ? 'anulado' : 'pagado'),
                            cajaId: newRecepcion.cajaId,
                            // Si se corrigió la fecha de la recepción, el gasto de la compra se mueve con ella.
                            ...(fechaRecISO ? { fecha: fechaRecISO } : {}),
                        });
                    }
                }
                toast.success('Recepción del historial actualizada');
                try {
                    localStorage.removeItem('rec_draft_v2');
                    // last_good se actualiza solo con lo que queda abierto
                } catch {}
                seguirConLaSiguiente();
                return;
            }

            // Generar ID aquí para no depender del retorno de onAddRecepcion (que devuelve void)
            const recepcionId = generateUUID();
            const recepcionCompleta: Recepcion = {
                id: recepcionId,
                prePedidoId: newRecepcion.prePedidoId,
                proveedorId: newRecepcion.proveedorId,
                numeroFactura: numFactura,
                fechaFactura: new Date(newRecepcion.fechaFactura).toISOString(),
                items: newRecepcion.items,
                ...camposDinero,
                estado: 'en_proceso',
                recibidoPor: usuario?.nombre || usuario?.email || 'Sistema',
                fechaRecepcion: fechaRecISO ?? new Date().toISOString(),
                imagenFactura: newRecepcion.imagenFactura || undefined,
                observaciones: newRecepcion.observaciones,
                metodoPago: newRecepcion.metodoPago,
                cajaId: newRecepcion.cajaId,
            };

            await onAddRecepcion(recepcionCompleta as any);
            await onConfirmarRecepcion(recepcionCompleta);

            // 🛡️ REGLA: NEXUS-SYNC - Actualizar el PrePedido a recibido si existe
            if (newRecepcion.prePedidoId && onUpdatePrePedido) {
                await onUpdatePrePedido(newRecepcion.prePedidoId, { estado: 'recibido' });
            }

            // Actualizar costos que cambiaron: se guardan en el catálogo de precios del PROVEEDOR
            // (no solo en el producto), para que la próxima recepción de este proveedor ya traiga el precio correcto.
            const preciosParaActualizar = preciosSet ?? preciosAActualizar;
            if (preciosParaActualizar.size > 0) {
                await Promise.all(
                    newRecepcion.items
                        .filter(item => preciosParaActualizar.has(item.productoId))
                        .map(item => {
                            const precioNuevo = Math.round(item.precioFacturado * 100) / 100;
                            if (onAddOrUpdatePrecio) {
                                const precioExistente = preciosDelProveedor.find(pp => pp.productoId === item.productoId);
                                return onAddOrUpdatePrecio({
                                    id: precioExistente?.id,
                                    productoId: item.productoId,
                                    proveedorId: newRecepcion.proveedorId,
                                    precioCosto: precioNuevo,
                                    tipoEmbalaje: precioExistente?.tipoEmbalaje,
                                    cantidadEmbalaje: precioExistente?.cantidadEmbalaje,
                                    destino: precioExistente?.destino,
                                    notas: precioExistente?.notas,
                                });
                            }
                            return onUpdateProducto(item.productoId, { costoBase: precioNuevo });
                        })
                );
            }

            // Guardar factura en archivo si hay imagen
            if (newRecepcion.imagenFactura) {
                await guardarFacturaEnArchivo(recepcionCompleta, newRecepcion.imagenFactura);
            }

            const totalUnidadesSaved = newRecepcion.items.reduce((sum, i) => sum + i.cantidadRecibida, 0);
            toast.success(
                <div className="flex flex-col gap-1">
                    <span className="font-semibold flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-500" /> ¡Recepción completada!
                    </span>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                        <p>✓ {newRecepcion.items.length} productos · {totalUnidadesSaved} unidades al inventario</p>
                        {preciosParaActualizar.size > 0 && <p>✓ {preciosParaActualizar.size} precios de costo actualizados</p>}
                        <p className="text-emerald-600 font-medium">→ Listos para vender</p>
                    </div>
                </div>,
                { duration: 5000 }
            );
            try { localStorage.removeItem('rec_draft_v2'); } catch {}
            seguirConLaSiguiente();
        } catch (error) {
            console.error(error);
            toast.error('Error al guardar la recepción');
        }
    };

    // === VISTA GALERÍA DE FACTURAS ===
    if (view === 'galeria') {
        return (
            <div className="space-y-6 animate-ag-fade-in pb-12">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" onClick={() => setView('list')} className="gap-2">
                            <ArrowLeft className="w-4 h-4" /> Volver
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <FolderOpen className="w-6 h-6 text-amber-500" />
                                Archivo de Facturas
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                {facturasGuardadas.length} facturas guardadas
                            </p>
                        </div>
                    </div>
                </div>

                {/* Filtros */}
                <Card className="bg-gradient-to-r from-slate-50 to-amber-50/50 border-amber-200/50">
                    <CardContent className="p-4">
                        <div className="flex flex-wrap items-end gap-4">
                            <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm font-medium">Filtrar:</span>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Proveedor</Label>
                                <select
                                    className="p-2 rounded-md border bg-background text-sm min-w-[180px]"
                                    value={filtroGaleriaProveedor}
                                    onChange={e => setFiltroGaleriaProveedor(e.target.value)}
                                >
                                    <option value="todos">Todos los proveedores</option>
                                    {proveedores.map(p => (
                                        <option key={p.id} value={p.id}>{p.nombre}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Desde</Label>
                                <Input
                                    type="date"
                                    value={filtroGaleriaFechaDesde}
                                    onChange={e => setFiltroGaleriaFechaDesde(e.target.value)}
                                    className="w-[150px]"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Hasta</Label>
                                <Input
                                    type="date"
                                    value={filtroGaleriaFechaHasta}
                                    onChange={e => setFiltroGaleriaFechaHasta(e.target.value)}
                                    className="w-[150px]"
                                />
                            </div>
                            {(filtroGaleriaProveedor !== 'todos' || filtroGaleriaFechaDesde || filtroGaleriaFechaHasta) && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setFiltroGaleriaProveedor('todos');
                                        setFiltroGaleriaFechaDesde('');
                                        setFiltroGaleriaFechaHasta('');
                                    }}
                                >
                                    <X className="w-4 h-4 mr-1" /> Limpiar
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Galería por Proveedor */}
                {Object.keys(facturasPorProveedor).length === 0 ? (
                    <Card className="p-12 text-center">
                        <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                            <FolderOpen className="w-8 h-8 text-amber-500" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">No hay facturas guardadas</h3>
                        <p className="text-muted-foreground text-sm">
                            Las facturas se guardan automáticamente al procesar recepciones con imagen
                        </p>
                    </Card>
                ) : (
                    <div className="space-y-6">
                        {Object.entries(facturasPorProveedor).map(([proveedorNombre, facturas]) => (
                            <Card key={proveedorNombre} className="overflow-hidden">
                                <CardHeader className="bg-gradient-to-r from-slate-100 to-amber-50 border-b py-3">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <Package className="w-4 h-4 text-amber-600" />
                                            {proveedorNombre}
                                        </CardTitle>
                                        <Badge variant="secondary">{facturas.length} facturas</Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-4">
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                        {facturas.map(factura => (
                                            <div
                                                key={factura.id}
                                                className="group relative aspect-[3/4] rounded-lg overflow-hidden border-2 border-transparent hover:border-amber-400 cursor-pointer transition-all shadow-sm hover:shadow-lg"
                                                onClick={() => setFacturaSeleccionada(factura)}
                                            >
                                                <img
                                                    src={factura.imagenBase64}
                                                    alt={`Factura ${factura.numeroFactura}`}
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <div className="absolute bottom-0 left-0 right-0 p-2 text-white">
                                                        <p className="text-xs font-semibold truncate">{factura.numeroFactura}</p>
                                                        <p className="text-[10px] opacity-80">
                                                            {new Date(factura.fechaEscaneo).toLocaleDateString('es-CO')}
                                                        </p>
                                                    </div>
                                                    <div className="absolute top-2 right-2">
                                                        <ZoomIn className="w-5 h-5 text-white" />
                                                    </div>
                                                </div>
                                                {/* Badge de total */}
                                                <div className="absolute top-2 left-2">
                                                    <Badge className="text-[9px] bg-black/60 hover:bg-black/60">
                                                        {formatCurrency(factura.totalFactura)}
                                                    </Badge>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Modal de Factura Seleccionada */}
                {facturaSeleccionada && (
                    <div 
                        className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
                        onClick={() => setFacturaSeleccionada(null)}
                    >
                        <div 
                            className="relative max-w-4xl w-full max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Header del modal */}
                            <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-bold text-lg">Factura {facturaSeleccionada.numeroFactura}</h3>
                                        <p className="text-sm opacity-90">{facturaSeleccionada.proveedorNombre}</p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-white hover:bg-white/20"
                                        onClick={() => setFacturaSeleccionada(null)}
                                    >
                                        <X className="w-5 h-5" />
                                    </Button>
                                </div>
                            </div>
                            
                            {/* Imagen */}
                            <div className="p-4 max-h-[60vh] overflow-auto bg-slate-100">
                                <img
                                    src={facturaSeleccionada.imagenBase64}
                                    alt={`Factura ${facturaSeleccionada.numeroFactura}`}
                                    className="max-w-full h-auto mx-auto rounded-lg shadow-lg"
                                />
                            </div>
                            
                            {/* Detalles */}
                            <div className="p-4 bg-slate-50 border-t">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                        <p className="text-muted-foreground text-xs">Fecha Factura</p>
                                        <p className="font-medium">{new Date(facturaSeleccionada.fechaFactura).toLocaleDateString('es-CO')}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">Fecha Escaneo</p>
                                        <p className="font-medium">{new Date(facturaSeleccionada.fechaEscaneo).toLocaleDateString('es-CO')}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">Total Factura</p>
                                        <p className="font-bold text-emerald-600">{formatCurrency(facturaSeleccionada.totalFactura)}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">Productos</p>
                                        <p className="font-medium">{facturaSeleccionada.cantidadProductos} items</p>
                                    </div>
                                </div>
                                <div className="flex gap-2 mt-4 pt-4 border-t">
                                    <Button
                                        variant="outline"
                                        className="flex-1"
                                        onClick={() => {
                                            const link = document.createElement('a');
                                            link.href = facturaSeleccionada.imagenBase64;
                                            link.download = `Factura_${facturaSeleccionada.numeroFactura}_${facturaSeleccionada.proveedorNombre}.png`;
                                            link.click();
                                        }}
                                    >
                                        <Download className="w-4 h-4 mr-2" /> Descargar
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        onClick={() => {
                                            if (confirm('¿Eliminar esta factura del archivo?')) {
                                                eliminarFactura(facturaSeleccionada.id);
                                            }
                                        }}
                                    >
                                        <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (view === 'new') {
        const totalItems = newRecepcion.items.length;
        const totalUnidades = newRecepcion.items.reduce((s, i) => s + i.cantidadRecibida, 0);
        const cuadre = armarCuadre();
        const totalDinero = cuadre.total;
        const plata = (n: number) => new Intl.NumberFormat('es-CO', {
            style: 'currency', currency: 'COP', minimumFractionDigits: 2, maximumFractionDigits: 2,
        }).format(Number(n) || 0);
        const proveedorActual = proveedores.find(p => p.id === newRecepcion.proveedorId);
        const prepedidosPendientes = prepedidosConfirmados.filter(p => p.proveedorId === newRecepcion.proveedorId);
        const paleta = ['bg-indigo-600','bg-violet-500','bg-emerald-600','bg-rose-500','bg-amber-500','bg-sky-600','bg-teal-600','bg-pink-500'];

        /* ── PANTALLA A: selección de proveedor ── */
        if (!newRecepcion.proveedorId) {
            return (
                <div className="space-y-4 animate-ag-fade-in pb-24">
                    <BarraRecepcionesAbiertas
                        pestañas={pestañasVisibles}
                        onIr={irAPestaña}
                        onCerrar={cerrarPestaña}
                        onNueva={abrirOtraRecepcion}
                    />
                    <div className="flex items-center gap-3 px-1">
                        <button onClick={() => setView('list')}
                            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors shrink-0">
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                        <div>
                            <h1 className="text-base font-black uppercase tracking-tight">Entrada de Mercancía</h1>
                            <p className="text-[10px] text-slate-400 font-bold">¿Quién llega hoy?</p>
                        </div>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="text" placeholder="Buscar proveedor..." value={busquedaProveedor}
                            onChange={e => setBusquedaProveedor(e.target.value)} autoFocus
                            className="w-full h-12 pl-9 pr-4 rounded-xl border-2 border-indigo-100 focus:border-indigo-400 bg-white dark:bg-slate-800 font-bold text-sm outline-none transition-colors"
                        />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {proveedoresFiltrados.length === 0 && (
                            <div className="col-span-full text-center py-12 text-slate-400 text-sm font-bold">Sin resultados</div>
                        )}
                        {proveedoresFiltrados.map((p, idx) => {
                            const lastRec = recepciones
                                .filter(r => r.proveedorId === p.id)
                                .sort((a, b) => new Date(b.fechaRecepcion).getTime() - new Date(a.fechaRecepcion).getTime())[0];
                            const pedidosPend = prepedidosConfirmados.filter(pp => pp.proveedorId === p.id).length;
                            return (
                                <button key={p.id}
                                    onClick={() => {
                                        setBusquedaProveedor('');
                                        // Si hay una orden de compra pendiente para este proveedor, cargarla automáticamente
                                        const pedidoPendiente = prepedidosConfirmados.find(pp => pp.proveedorId === p.id);
                                        if (pedidoPendiente) {
                                            handleVincularPrePedido(pedidoPendiente.id);
                                        } else {
                                            setNewRecepcion(prev => ({ ...prev, proveedorId: p.id }));
                                        }
                                    }}
                                    className="flex flex-col items-center gap-2.5 p-4 rounded-2xl border-2 border-slate-100 bg-white dark:bg-slate-800 hover:border-indigo-300 hover:shadow-md active:scale-95 text-center transition-all"
                                >
                                    <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl text-white shadow-sm shrink-0", paleta[idx % paleta.length])}>
                                        {p.nombre.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="w-full space-y-0.5">
                                        <p className="font-black text-sm text-slate-900 dark:text-white leading-snug break-words">{p.nombre}</p>
                                        <p className="text-[9px] text-slate-400 font-bold">
                                            {lastRec ? `Últ: ${new Date(lastRec.fechaRecepcion).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}` : 'Nueva recepción'}
                                        </p>
                                    </div>
                                    {pedidosPend > 0 && (
                                        <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                                            {pedidosPend} pedido{pedidosPend > 1 ? 's' : ''}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} />
                </div>
            );
        }

        /* ── PANTALLA B: POS directo (catálogo + ticket) ── */
        return (
            <div className="flex flex-col animate-ag-fade-in" style={{ height: 'calc(100dvh - 56px)' }}>
                <BarraRecepcionesAbiertas
                    pestañas={pestañasVisibles}
                    onIr={irAPestaña}
                    onCerrar={cerrarPestaña}
                    onNueva={abrirOtraRecepcion}
                />
                {/* Cabecera compacta */}
                <div className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-3 py-2 flex items-center gap-2 z-20">
                    <button
                        onClick={() => setView('list')}
                        title="Volver a la lista. Esta recepción se queda abierta en su pestaña"
                        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors shrink-0"
                    ><ArrowLeft className="w-4 h-4" /></button>
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center font-black text-white text-sm shrink-0", paleta[proveedores.findIndex(p => p.id === newRecepcion.proveedorId) % paleta.length] || 'bg-indigo-600')}>
                        {proveedorActual?.nombre.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-black text-sm truncate flex-1">{proveedorActual?.nombre}</span>
                    <input
                        value={newRecepcion.numeroFactura}
                        onChange={e => setNewRecepcion(p => ({ ...p, numeroFactura: e.target.value }))}
                        placeholder="# Factura"
                        className="w-24 h-8 px-2 text-xs font-bold rounded-lg border border-slate-200 bg-slate-50 outline-none focus:border-indigo-400 shrink-0"
                    />
                    <input
                        type="date"
                        value={newRecepcion.fechaFactura}
                        onChange={e => setNewRecepcion(p => ({ ...p, fechaFactura: e.target.value }))}
                        className="w-32 h-8 px-2 text-xs font-bold rounded-lg border border-slate-200 bg-slate-50 outline-none focus:border-indigo-400 shrink-0 hidden sm:block"
                    />
                    <button onClick={() => fileInputRef.current?.click()}
                        className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0",
                            newRecepcion.imagenFactura ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                        )}
                        title="Foto de factura / escanear con IA"
                    ><Camera className="w-4 h-4" /></button>
                    {newRecepcion.imagenFactura && !isScanning && (
                        <button onClick={handleScanFactura}
                            className="h-8 px-2 rounded-lg bg-indigo-600 text-white text-[10px] font-black flex items-center gap-1 shrink-0">
                            <Sparkles className="w-3 h-3" /> IA
                        </button>
                    )}
                    {isScanning && (
                        <span className="text-[10px] font-black text-indigo-500 shrink-0 flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" />{scanProgress}%
                        </span>
                    )}
                </div>

                {/* Pre-pedido banner */}
                {prepedidosPendientes.length > 0 && (
                    <div className="shrink-0 bg-blue-600 text-white px-3 py-2 flex items-center gap-2 overflow-x-auto scrollbar-none">
                        <GitCompareArrows className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[10px] font-black uppercase shrink-0">Pre-pedidos:</span>
                        {prepedidosPendientes.map(p => (
                            <button key={p.id}
                                onClick={() => handleVincularPrePedido(p.id)}
                                className="shrink-0 text-[10px] font-black bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap"
                            >{p.nombre} ({p.items.length} prod)</button>
                        ))}
                    </div>
                )}

                {/* Cuerpo bicolumna */}
                <div className="flex flex-col lg:flex-row flex-1 min-h-0">

                    {/* ── Panel izquierdo: catálogo ── */}
                    <div className={cn("flex flex-col flex-1 min-h-0 overflow-hidden", mobilePanelRec === 'ticket' ? "hidden lg:flex" : "flex")}>
                        {/* Buscador + nuevo */}
                        <div className="px-3 pt-2.5 pb-2 flex gap-2 shrink-0">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input type="text" placeholder="Buscar producto..."
                                    value={busquedaProducto}
                                    onChange={e => setBusquedaProducto(e.target.value)}
                                    className="w-full h-9 pl-9 pr-8 rounded-xl border border-slate-200 focus:border-indigo-400 bg-white dark:bg-slate-800 font-bold text-sm outline-none transition-colors"
                                />
                                {busquedaProducto && (
                                    <button onClick={() => setBusquedaProducto('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                            <button onClick={() => setIsProductModalOpen(true)}
                                className="h-9 px-3 rounded-xl border-2 border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50 flex items-center gap-1 text-xs font-black transition-all shrink-0">
                                <Plus className="w-3.5 h-3.5" /> Nuevo
                            </button>
                        </div>

                        {/* Catálogo scrollable */}
                        <div className="flex-1 overflow-y-auto px-3 pb-20 lg:pb-3 space-y-2">
                            {busquedaProducto.trim() ? (
                                /* Modo búsqueda: muestra TODOS los productos (para agregar algo nuevo) */
                                productosAgrupados.otros.length === 0 ? (
                                    <div className="py-10 text-center text-slate-400 text-sm font-bold">Sin resultados</div>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
                                        {productosAgrupados.otros.map(p => {
                                            const ppEntry = preciosDelProveedor.find(pp => pp.productoId === p.id);
                                            const precioMostrar = ppEntry?.precioCosto || p.costoBase || 0;
                                            return (
                                                <button key={p.id} onClick={() => { handleAddItem(p.id); setBusquedaProducto(''); }}
                                                    className={cn("flex flex-col items-start p-2.5 rounded-xl border active:scale-95 transition-all text-left gap-0.5 group",
                                                        ppEntry
                                                            ? "bg-indigo-50 border-indigo-200 hover:border-indigo-400"
                                                            : "bg-white dark:bg-slate-800 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50"
                                                    )}>
                                                    <span className="font-black text-[11px] text-slate-800 dark:text-white leading-snug break-words group-hover:text-indigo-700">{p.nombre}</span>
                                                    <span className={cn("text-[10px] font-black tabular-nums", precioMostrar ? "text-indigo-600" : "text-slate-400")}>
                                                        {precioMostrar ? formatCurrency(precioMostrar) : 'Sin precio'}
                                                    </span>
                                                    <MarcaPrecioModificado cambio={ultimoCambioPrecio(historialPrecios, p.id, newRecepcion.proveedorId)} />
                                                </button>
                                            );
                                        })}
                                    </div>
                                )
                            ) : productosAgrupados.delProveedor.length === 0 ? (
                                /* Sin productos configurados para este proveedor */
                                <div className="py-12 flex flex-col items-center gap-3 text-slate-400 text-center">
                                    <Package className="w-10 h-10 opacity-30" />
                                    <p className="text-sm font-bold">Este proveedor no tiene productos configurados</p>
                                    <p className="text-xs">Ve a <strong>Gestión de Proveedores</strong> y asigna productos,<br/>o usa el buscador para agregar cualquier producto.</p>
                                </div>
                            ) : (
                                /* Modo normal: solo productos DE ESTE PROVEEDOR agrupados por categoría */
                                (() => {
                                    const cats = [...new Set(productosAgrupados.delProveedor.map(p => p.categoria).filter(Boolean))] as string[];
                                    // Si solo hay 1 categoría o pocos productos, mostrar directo sin acordeones
                                    if (cats.length <= 1 || productosAgrupados.delProveedor.length <= 12) {
                                        return (
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
                                                {productosAgrupados.delProveedor.map(p => {
                                                    const ppEntry = preciosDelProveedor.find(pp => pp.productoId === p.id);
                                                    const precioMostrar = ppEntry?.precioCosto || p.costoBase || 0;
                                                    return (
                                                        <button key={p.id} onClick={() => handleAddItem(p.id)}
                                                            className="flex flex-col items-start p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 active:scale-95 transition-all text-left gap-0.5 group">
                                                            <span className="font-black text-[11px] text-slate-800 dark:text-white leading-snug break-words group-hover:text-indigo-700">{p.nombre}</span>
                                                            <span className={cn("text-[10px] font-black tabular-nums", precioMostrar ? "text-indigo-600" : "text-slate-400")}>
                                                                {precioMostrar ? formatCurrency(precioMostrar) : 'Sin precio'}
                                                            </span>
                                                            <MarcaPrecioModificado cambio={ultimoCambioPrecio(historialPrecios, p.id, newRecepcion.proveedorId)} />
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        );
                                    }
                                    // Muchas categorías: acordeones
                                    return cats.map(cat => {
                                        const prods = productosAgrupados.delProveedor.filter(p => p.categoria === cat);
                                        const isOpen = categoriasExpandidas.has(cat);
                                        return (
                                            <div key={cat} className="rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800">
                                                <button
                                                    onClick={() => setCategoriasExpandidas(prev => { const n = new Set(prev); n.has(cat) ? n.delete(cat) : n.add(cat); return n; })}
                                                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                                                >
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">{cat}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[9px] font-black bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full">{prods.length}</span>
                                                        <ChevronDown className={cn("w-3.5 h-3.5 text-slate-400 transition-transform", isOpen ? "rotate-180" : "")} />
                                                    </div>
                                                </button>
                                                {isOpen && (
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-2 border-t border-slate-50">
                                                        {prods.map(p => {
                                                            const ppEntry = preciosDelProveedor.find(pp => pp.productoId === p.id);
                                                            const precioMostrar = ppEntry?.precioCosto || p.costoBase || 0;
                                                            return (
                                                                <button key={p.id} onClick={() => handleAddItem(p.id)}
                                                                    className="flex flex-col items-start p-2.5 rounded-lg bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 border border-transparent active:scale-95 transition-all text-left gap-0.5 group">
                                                                    <span className="font-black text-[11px] text-slate-800 dark:text-white leading-snug break-words group-hover:text-indigo-700">{p.nombre}</span>
                                                                    <span className={cn("text-[10px] font-black tabular-nums", precioMostrar ? "text-indigo-600" : "text-slate-400")}>
                                                                        {precioMostrar ? formatCurrency(precioMostrar) : 'Sin precio'}
                                                                    </span>
                                                                    <MarcaPrecioModificado cambio={ultimoCambioPrecio(historialPrecios, p.id, newRecepcion.proveedorId)} />
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    });
                                })()
                            )}
                        </div>
                    </div>

                    {/* ── Panel derecho: ticket ── */}
                    <div className={cn("lg:w-[370px] lg:border-l border-slate-100 dark:border-slate-700 flex flex-col min-h-0", mobilePanelRec === 'productos' ? "hidden lg:flex" : "flex flex-1")}>
                        {/* Header ticket */}
                        <div className="bg-[#1a1c2e] text-white px-4 py-2.5 shrink-0 flex items-center justify-between">
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-indigo-300">Ticket</p>
                                <p className="font-black text-xs truncate">{proveedorActual?.nombre ?? '—'}</p>
                                <p className="text-[9px] text-slate-400">Agarra el número y muévelo como en la factura</p>
                            </div>
                            {totalItems > 0 && (
                                <div className="text-right shrink-0">
                                    <p className="text-[9px] text-indigo-400 font-bold">{totalItems} prod · {totalUnidades} uds</p>
                                    <p className="text-base font-black tabular-nums whitespace-nowrap">{plata(totalDinero)}</p>
                                </div>
                            )}
                        </div>

                        {/* Lista de ítems */}
                        <div className="flex-1 overflow-y-auto bg-[#1e2033]">
                            {newRecepcion.items.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500 py-12">
                                    <Package className="w-10 h-10 opacity-30" />
                                    <p className="text-xs font-bold text-center px-4">Toca un producto del catálogo para agregarlo</p>
                                </div>
                            ) : (
                                <DndContext sensors={sensoresOrden} collisionDetection={closestCenter} onDragEnd={alSoltarOrden}>
                                <SortableContext items={newRecepcion.items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                                <div className="divide-y divide-white/5">
                                    {newRecepcion.items.map((item, idx) => {
                                        const prod = getProductoById(item.productoId);
                                        const ppItem = preciosDelProveedor.find(pp => pp.productoId === item.productoId);
                                        const precioAnt = ppItem?.precioCosto || prod?.costoBase || 0;
                                        const diff = precioAnt > 0 ? ((item.precioFacturado - precioAnt) / precioAnt) * 100 : 0;
                                        const subio = diff > 5;
                                        const bajo = diff < -2;
                                        const linea = cuadre.lineas.find(l => l.id === item.id);
                                        return (
                                            <FilaOrdenable key={item.id} id={item.id}>
                                            {(asa) => (
                                            <div className="px-3 py-2.5 space-y-2">
                                                <div className="flex items-start gap-2">
                                                    <button
                                                        type="button"
                                                        {...asa}
                                                        title="Arrastra para dejarlo en el puesto de la factura"
                                                        className="mt-0.5 shrink-0 w-8 h-8 rounded-lg bg-white/10 text-white flex flex-col items-center justify-center cursor-grab active:cursor-grabbing touch-none"
                                                    >
                                                        <GripVertical className="w-3 h-3 text-slate-300" />
                                                        <span className="text-[9px] font-black leading-none">{idx + 1}</span>
                                                    </button>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-black text-xs text-white leading-tight">{prod?.nombre || '??'}</p>
                                                        {precioAnt > 0 && (
                                                            <p className={cn("text-[9px] font-bold tabular-nums", subio ? "text-rose-400" : bajo ? "text-emerald-400" : "text-slate-500")}>
                                                                Ant: {formatCurrency(precioAnt)}{Math.abs(diff) > 2 && <span className="ml-1">{diff > 0 ? '▲' : '▼'}{Math.abs(diff).toFixed(0)}%</span>}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <button onClick={() => setNewRecepcion(p => ({ ...p, items: p.items.filter(i => i.id !== item.id) }))}
                                                        className="w-5 h-5 rounded flex items-center justify-center text-slate-600 hover:text-rose-400 transition-colors shrink-0">
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                                <div className="pl-6 space-y-2">
                                                    <div>
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Precio</p>
                                                        <input type="text" inputMode="decimal" placeholder="$"
                                                            value={precioDraft[item.id] ?? textoPrecio(item.precioFacturado)}
                                                            onFocus={() => setPrecioDraft(d => ({ ...d, [item.id]: textoPrecio(item.precioFacturado) }))}
                                                            onChange={e => setPrecioDraft(d => ({ ...d, [item.id]: e.target.value }))}
                                                            onBlur={e => {
                                                                handleUpdateItem(item.id, { precioFacturado: parsearPesosCol(e.target.value) });
                                                                setPrecioDraft(d => {
                                                                    const next = { ...d };
                                                                    delete next[item.id];
                                                                    return next;
                                                                });
                                                            }}
                                                            className={cn("w-full h-10 rounded-lg px-3 text-right font-black text-base outline-none border transition-colors",
                                                                subio ? "bg-rose-900/40 border-rose-700 text-rose-300" : bajo ? "bg-emerald-900/40 border-emerald-700 text-emerald-300" : "bg-white/10 border-white/10 text-white"
                                                            )}
                                                        />
                                                        {precioAnt >= 10000 && item.precioFacturado > 0 && item.precioFacturado < precioAnt / 50 && (
                                                            <p className="mt-1 text-[11px] font-bold text-amber-300 leading-snug">
                                                                Este precio quedó corto. Escríbelo completo, por ejemplo {textoPrecio(precioAnt)}.
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                    <div className="flex items-center bg-white/10 rounded-lg overflow-hidden shrink-0">
                                                        <button onClick={() => handleUpdateItem(item.id, { cantidadRecibida: Math.max(0, item.cantidadRecibida - 1) })}
                                                            className="w-7 h-8 flex items-center justify-center text-slate-300 hover:bg-white/10 font-black text-base transition-colors">−</button>
                                                        <input type="number" value={item.cantidadRecibida || ''}
                                                            onChange={e => handleUpdateItem(item.id, { cantidadRecibida: parseFloat(e.target.value) || 0 })}
                                                            className="w-9 h-8 bg-transparent text-center font-black text-xs text-white outline-none" />
                                                        <button onClick={() => handleUpdateItem(item.id, { cantidadRecibida: item.cantidadRecibida + 1 })}
                                                            className="w-7 h-8 flex items-center justify-center text-slate-300 hover:bg-white/10 font-black text-base transition-colors">+</button>
                                                    </div>
                                                    <button onClick={() => handleUpdateItem(item.id, { productoOk: !item.productoOk })} title="Estado producto"
                                                        className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0",
                                                            item.productoOk ? "bg-emerald-600/30 text-emerald-400" : "bg-rose-600/30 text-rose-400"
                                                        )}>
                                                        {item.productoOk ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                                                    </button>
                                                    <button onClick={() => handleUpdateItem(item.id, { embalajeOk: !item.embalajeOk })} title="Estado embalaje"
                                                        className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0",
                                                            item.embalajeOk ? "bg-sky-600/30 text-sky-400" : "bg-amber-600/30 text-amber-400"
                                                        )}>
                                                        <Package className="w-3.5 h-3.5" />
                                                    </button>
                                                    </div>
                                                    <div className="flex items-baseline justify-between gap-3 rounded-lg bg-white/5 px-3 py-2">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total</span>
                                                        <p className="font-black text-lg text-white tabular-nums whitespace-nowrap">
                                                            {linea && linea.total > 0 ? plata(linea.total) : '—'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 pl-6">
                                                    <label className="text-sm font-black text-white">
                                                        Dto %
                                                        <input type="number" min={0} max={100} inputMode="decimal" placeholder="0"
                                                            value={item.descuentoPorcentaje ?? ''}
                                                            onChange={e => handleUpdateItem(item.id, { descuentoPorcentaje: e.target.value === '' ? undefined : parseFloat(e.target.value) || 0 })}
                                                            className="ml-1 w-16 h-9 rounded-lg bg-white/10 border border-white/30 text-white text-center font-black outline-none" />
                                                    </label>
                                                    <label className="text-sm font-black text-white">
                                                        IVA %
                                                        <input type="number" min={0} max={100} inputMode="decimal" placeholder="0"
                                                            value={item.ivaPorcentaje ?? ''}
                                                            onChange={e => handleUpdateItem(item.id, { ivaPorcentaje: e.target.value === '' ? undefined : parseFloat(e.target.value) || 0 })}
                                                            className="ml-1 w-16 h-9 rounded-lg bg-white/10 border border-white/30 text-white text-center font-black outline-none" />
                                                    </label>
                                                </div>
                                                {linea && (linea.dtoPct > 0 || linea.ivaPct > 0) && (
                                                    <p className="pl-6 text-sm font-bold text-emerald-300 leading-snug">
                                                        {plata(linea.redondeada)}
                                                        {linea.dtoPct > 0 ? ` − ${linea.dtoPct}% (${plata(linea.descuento)}) = ${plata(linea.neto)}` : ''}
                                                        {linea.ivaPct > 0 ? ` + IVA ${linea.ivaPct}% (${plata(linea.iva)})` : ''}
                                                        {' = '}{plata(linea.total)}
                                                    </p>
                                                )}
                                                {(!item.productoOk || !item.embalajeOk) && (
                                                    <input placeholder="Describe la novedad..."
                                                        value={item.observaciones || ''}
                                                        onChange={e => handleUpdateItem(item.id, { observaciones: e.target.value })}
                                                        className="h-7 rounded-lg bg-amber-900/30 border border-amber-700/50 text-amber-300 px-3 text-[10px] font-bold outline-none"
                                                        style={{ width: 'calc(100% - 1.5rem)', marginLeft: '1.5rem' }}
                                                    />
                                                )}
                                            </div>
                                            )}
                                            </FilaOrdenable>
                                        );
                                    })}
                                </div>
                                </SortableContext>
                                </DndContext>
                            )}
                        </div>

                        {/* Pie: solo el total. La factura va en otra pantalla. */}
                        <div className="bg-[#1a1c2e] border-t border-white/10 p-3 space-y-2 shrink-0">
                            <div className="flex items-end justify-between gap-2">
                                <div>
                                    <p className="text-[9px] font-black uppercase text-indigo-400 tracking-widest">{totalItems} productos · {totalUnidades} unidades{editandoId ? ' · editando historial' : ''}</p>
                                    <p className="text-2xl font-black text-white tabular-nums whitespace-nowrap">{plata(totalDinero)}</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                disabled={newRecepcion.items.length === 0}
                                onClick={() => setPantallaFactura(true)}
                                className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-colors"
                            >
                                <Receipt className="w-4 h-4" /> Factura, IVA y pago
                            </button>
                        </div>
                    </div>
                </div>

                {/* Toggle móvil */}
                <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex">
                    <button onClick={() => setMobilePanelRec('productos')}
                        className={cn("flex-1 py-3 flex flex-col items-center gap-0.5 text-[10px] font-black uppercase transition-colors",
                            mobilePanelRec === 'productos' ? "text-indigo-600 border-t-2 border-indigo-600" : "text-slate-400"
                        )}>
                        <Package className="w-4 h-4" /> Catálogo
                    </button>
                    <button onClick={() => setMobilePanelRec('ticket')}
                        className={cn("flex-1 py-3 flex flex-col items-center gap-0.5 text-[10px] font-black uppercase transition-colors relative",
                            mobilePanelRec === 'ticket' ? "text-indigo-600 border-t-2 border-indigo-600" : "text-slate-400"
                        )}>
                        <Receipt className="w-4 h-4" /> Ticket
                        {totalItems > 0 && (
                            <span className="absolute top-1.5 right-[calc(50%-18px)] w-4 h-4 bg-indigo-600 text-white rounded-full text-[8px] font-black flex items-center justify-center">{totalItems}</span>
                        )}
                    </button>
                </div>

                {pantallaFactura && (
                    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-6" onClick={() => setPantallaFactura(false)}>
                        <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#1a1c2e] text-white shadow-2xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Factura y pago</p>
                                    <h2 className="text-lg font-black">{proveedorActual?.nombre ?? 'Recepción'}</h2>
                                    <p className="text-base font-bold text-white">{totalItems} productos · {totalUnidades} unidades · {plata(totalDinero)}</p>
                                </div>
                                <button type="button" onClick={() => setPantallaFactura(false)} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <p className="text-base font-bold text-white">Si un producto trae descuento o IVA, escríbelo en ese producto. Ejemplo: Dto 25 e IVA 19. Primero se quita el 25% y el 19% se calcula sobre lo que queda.</p>
                            <label className="flex items-center gap-2 text-base font-bold text-white">
                                <input type="checkbox" checked={newRecepcion.incluyeIva}
                                    onChange={e => setNewRecepcion(p => ({ ...p, incluyeIva: e.target.checked }))}
                                    className="rounded" />
                                IVA para los productos donde dejaste el IVA vacío
                            </label>
                            {newRecepcion.incluyeIva && (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-indigo-200">Porcentaje</span>
                                    <input type="number" min={0} max={100} value={newRecepcion.porcentajeIva}
                                        onChange={e => setNewRecepcion(p => ({ ...p, porcentajeIva: parseFloat(e.target.value) || 0 }))}
                                        className="w-24 h-11 rounded-xl bg-white/10 border border-white/15 text-white text-sm font-bold px-3 outline-none" />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-black text-white mb-1">Descuento en pesos al final del papel. El porcentaje de un producto se escribe en el producto.</label>
                                <input type="number" min={0} placeholder="0 si no hay descuento"
                                    value={newRecepcion.descuentoFactura || ''}
                                    onChange={e => setNewRecepcion(p => ({ ...p, descuentoFactura: parseFloat(e.target.value) || 0 }))}
                                    className="w-full h-11 rounded-xl bg-white/10 border border-white/15 text-white text-sm font-bold px-3 outline-none" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-widest text-indigo-300 mb-1">Total escrito en la factura de papel</label>
                                <input type="number" min={0} placeholder="Lo que dice el papel"
                                    value={newRecepcion.totalImpreso}
                                    onChange={e => setNewRecepcion(p => ({ ...p, totalImpreso: e.target.value }))}
                                    className="w-full h-11 rounded-xl bg-white/10 border border-white/15 text-white text-sm font-bold px-3 outline-none" />
                            </div>

                            <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-sm space-y-1">
                                <div className="flex justify-between"><span>Productos sin descuento</span><span className="font-black">{plata(cuadre.lineas.reduce((s, l) => s + l.redondeada, 0))}</span></div>
                                {cuadre.descuentoLineas > 0 && <div className="flex justify-between text-emerald-300"><span>Descuento de productos</span><span>-{plata(cuadre.descuentoLineas)}</span></div>}
                                <div className="flex justify-between"><span>Base para el IVA</span><span className="font-black">{plata(cuadre.subtotal)}</span></div>
                                {cuadre.iva > 0 && <div className="flex justify-between text-amber-200"><span>IVA</span><span>{plata(cuadre.iva)}</span></div>}
                                {cuadre.descuento > 0 && <div className="flex justify-between"><span>Descuento al final</span><span>-{plata(cuadre.descuento)}</span></div>}
                                <div className="flex justify-between border-t border-white/10 pt-2 text-base"><span>Total de la plataforma</span><span className="font-black">{plata(totalDinero)}</span></div>
                            </div>
                            {cuadre.motivos.length > 0 && (
                                <p className={cn("text-xs leading-snug font-semibold",
                                    cuadre.diferencia != null && Math.abs(cuadre.diferencia) >= 1 ? "text-amber-200" : "text-emerald-300")}>
                                    {cuadre.motivos.join(' ')}
                                    {cuadre.diferencia != null && Math.abs(cuadre.diferencia) >= 1 && (
                                        <> Diferencia: {formatCurrency(Math.abs(cuadre.diferencia))} {cuadre.diferencia > 0 ? '(el papel es mayor)' : '(la plataforma es mayor)'}.</>
                                    )}
                                </p>
                            )}

                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-widest text-indigo-300 mb-1">Fecha de la recepción (el día que entró la mercancía)</label>
                                <input
                                    type="date"
                                    value={newRecepcion.fechaRecepcion || ''}
                                    onChange={e => setNewRecepcion(p => ({ ...p, fechaRecepcion: e.target.value }))}
                                    className="w-full h-11 rounded-xl bg-white/10 border border-white/15 text-white text-sm font-bold px-3 outline-none"
                                />
                                <p className="text-xs text-indigo-200 mt-1">
                                    {newRecepcion.fechaRecepcion
                                        ? `Se guarda con ese día. Úsalo para registrar o corregir una recepción con fecha vieja.`
                                        : 'Vacía = se guarda con la fecha y hora de hoy.'}
                                </p>
                            </div>

                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-widest text-indigo-300 mb-1">Forma de pago</label>
                                <select
                                    value={newRecepcion.metodoPago}
                                    onChange={e => setNewRecepcion(p => ({ ...p, metodoPago: e.target.value as MetodoPago }))}
                                    className="w-full h-11 rounded-xl bg-white/10 border border-white/15 text-white text-sm font-bold px-3 outline-none"
                                >
                                    <option value="efectivo" className="text-slate-900">Efectivo (pagado)</option>
                                    <option value="transferencia" className="text-slate-900">Transferencia (pagado)</option>
                                    <option value="nequi" className="text-slate-900">Nequi (pagado)</option>
                                    <option value="tarjeta" className="text-slate-900">Tarjeta (pagado)</option>
                                    <option value="credito" className="text-slate-900">Crédito / fiado (pendiente)</option>
                                    <option value="otro" className="text-slate-900">Otro</option>
                                </select>
                                {newRecepcion.metodoPago === 'credito' && (
                                    <p className="text-xs text-amber-300 mt-1">El egreso quedará pendiente. Todavía no está pagado.</p>
                                )}
                            </div>
                            {newRecepcion.metodoPago === 'efectivo' && (
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-widest text-indigo-300 mb-1">¿De qué caja salió el dinero?</label>
                                    <select
                                        value={newRecepcion.cajaId || ''}
                                        onChange={e => setNewRecepcion(p => ({ ...p, cajaId: e.target.value || undefined }))}
                                        className="w-full h-11 rounded-xl bg-white/10 border border-white/15 text-white text-sm font-bold px-3 outline-none"
                                    >
                                        <option value="" className="text-slate-900">Bóveda / Caja Fuerte Principal</option>
                                        {cajasAbiertas.map(c => (
                                            <option key={c.id} value={c.id} className="text-slate-900">
                                                Caja activa: {c.cajaNombre} ({c.usuarioNombre})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <textarea value={newRecepcion.observaciones}
                                onChange={e => setNewRecepcion(p => ({ ...p, observaciones: e.target.value }))}
                                placeholder="Notas de esta factura"
                                rows={2}
                                className="w-full rounded-xl bg-white/10 border border-white/15 text-sm text-white placeholder:text-white/30 px-3 py-2 outline-none resize-none"
                            />
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setPantallaFactura(false)}
                                    className="flex-1 h-12 rounded-xl border border-white/20 font-bold">Volver a los productos</button>
                                <button
                                    disabled={newRecepcion.items.length === 0}
                                    onClick={() => handleSave(new Set(cambiosPrecio.map(i => i.productoId)))}
                                    className="flex-[1.4] h-12 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2"
                                >
                                    <CheckCircle className="w-4 h-4" /> {editandoId ? 'Guardar corrección' : 'Confirmar y guardar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modales */}
                {isProductModalOpen && (
                    <ProductFormModal
                        isOpen={isProductModalOpen}
                        onOpenChange={(open) => { if (!open) { setIsProductModalOpen(false); setProductToEdit(null); setFormDataModal(FORM_DATA_VACIO); } }}
                        editingProducto={productToEdit}
                        categorias={categorias}
                        productos={productos}
                        proveedores={proveedores}
                        formData={formDataModal}
                        setFormData={setFormDataModal}
                        onSubmit={handleSubmitModal}
                        formatCurrency={formatCurrency}
                        onAddCategoria={onAddCategoria}
                    />
                )}
                <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} />
            </div>
        );
    }


    if (view === 'details' && selectedRecepcion) {
        // Buscar pre-pedido vinculado
        const pedidoVinculado = selectedRecepcion.prePedidoId
            ? prepedidos.find(p => p.id === selectedRecepcion.prePedidoId)
            : null;

        // Calcular resumen de comparación
        const resumenComparacion = pedidoVinculado ? (() => {
            const totalEsperado = pedidoVinculado.total;
            const totalRecibido = selectedRecepcion.totalFactura;
            const diffTotal = totalRecibido - totalEsperado;
            const itemsFaltantes = pedidoVinculado.items.filter(
                pi => !selectedRecepcion.items.some(ri => ri.productoId === pi.productoId)
            );
            const itemsConDiferencia = selectedRecepcion.items.filter(
                ri => ri.cantidadEsperada > 0 && ri.cantidadRecibida !== ri.cantidadEsperada
            );
            const itemsConPrecioDiferente = selectedRecepcion.items.filter(
                ri => ri.precioEsperado > 0 && ri.precioFacturado !== ri.precioEsperado
            );
            return { totalEsperado, totalRecibido, diffTotal, itemsFaltantes, itemsConDiferencia, itemsConPrecioDiferente };
        })() : null;

        return (
            <div className="space-y-6 animate-ag-fade-in">
                <div className="flex items-center gap-4 mb-6">
                    <Button variant="ghost" onClick={() => { setView('list'); setSelectedRecepcion(null); }} className="gap-2">
                        <ArrowLeft className="w-4 h-4" /> Volver
                    </Button>
                    <h1 className="text-2xl font-bold">Detalle de Recepción</h1>
                    <Button variant="outline" className="gap-2" onClick={() => handleEditarRecepcion(selectedRecepcion)}>
                        <Pencil className="w-4 h-4" /> Corregir
                    </Button>
                    <Badge variant={selectedRecepcion.estado === 'completada' ? 'default' : 'secondary'}>
                        {selectedRecepcion.estado.toUpperCase().replace('_', ' ')}
                    </Badge>
                    {pedidoVinculado && (
                        <Badge variant="outline" className="gap-1 bg-blue-50 text-blue-700 border-blue-200">
                            <GitCompareArrows className="w-3 h-3" /> Vinculado a: {pedidoVinculado.nombre}
                        </Badge>
                    )}
                </div>

                {/* Panel de Comparación Pedido vs Recibido */}
                {pedidoVinculado && resumenComparacion && (
                    <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <GitCompareArrows className="w-5 h-5 text-blue-600" />
                                Comparación: Pre-Pedido vs Recepción
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {/* Resumen KPIs */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                <div className="p-3 rounded-lg bg-white/80 border text-center">
                                    <p className="text-xs text-muted-foreground">Total Esperado</p>
                                    <p className="text-lg font-bold">{formatCurrency(resumenComparacion.totalEsperado)}</p>
                                </div>
                                <div className="p-3 rounded-lg bg-white/80 border text-center">
                                    <p className="text-xs text-muted-foreground">Total Facturado</p>
                                    <p className="text-lg font-bold">{formatCurrency(resumenComparacion.totalRecibido)}</p>
                                </div>
                                <div className={`p-3 rounded-lg border text-center ${resumenComparacion.diffTotal === 0 ? 'bg-emerald-50 border-emerald-200' :
                                    resumenComparacion.diffTotal > 0 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
                                    }`}>
                                    <p className="text-xs text-muted-foreground">Diferencia</p>
                                    <p className={`text-lg font-bold flex items-center justify-center gap-1 ${resumenComparacion.diffTotal === 0 ? 'text-emerald-700' :
                                        resumenComparacion.diffTotal > 0 ? 'text-red-700' : 'text-amber-700'
                                        }`}>
                                        {resumenComparacion.diffTotal === 0 ? <CheckCircle className="w-4 h-4" /> :
                                            resumenComparacion.diffTotal > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                        {resumenComparacion.diffTotal === 0 ? 'Exacto' : formatCurrency(Math.abs(resumenComparacion.diffTotal))}
                                    </p>
                                </div>
                                <div className={`p-3 rounded-lg border text-center ${(resumenComparacion.itemsConDiferencia.length + resumenComparacion.itemsFaltantes.length) === 0
                                    ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
                                    }`}>
                                    <p className="text-xs text-muted-foreground">Incidencias</p>
                                    <p className="text-lg font-bold">
                                        {resumenComparacion.itemsConDiferencia.length + resumenComparacion.itemsFaltantes.length + resumenComparacion.itemsConPrecioDiferente.length}
                                    </p>
                                </div>
                            </div>

                            {/* Tabla de comparación item por item */}
                            <div className="rounded-lg border overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50">
                                        <tr>
                                            <th className="text-left p-3 font-semibold">Producto</th>
                                            <th className="text-center p-3 font-semibold">Cant. Pedida</th>
                                            <th className="text-center p-3 font-semibold">Cant. Recibida</th>
                                            <th className="text-center p-3 font-semibold">Precio Esperado</th>
                                            <th className="text-center p-3 font-semibold">Precio Real</th>
                                            <th className="text-center p-3 font-semibold">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedRecepcion.items.map(item => {
                                            const diffCant = item.cantidadRecibida - item.cantidadEsperada;
                                            const diffPrecio = item.precioFacturado - item.precioEsperado;
                                            const cantOk = item.cantidadEsperada === 0 || diffCant === 0;
                                            const precioOk = item.precioEsperado === 0 || diffPrecio === 0;
                                            const todoOk = cantOk && precioOk;

                                            return (
                                                <tr key={item.id} className={`border-t ${!todoOk ? 'bg-amber-50/50' : 'hover:bg-muted/30'
                                                    }`}>
                                                    <td className="p-3 font-medium">
                                                        {getProductoById(item.productoId)?.nombre || 'Desconocido'}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        {item.cantidadEsperada > 0 ? item.cantidadEsperada : '—'}
                                                    </td>
                                                    <td className={`p-3 text-center font-bold ${!cantOk ? (diffCant < 0 ? 'text-red-600' : 'text-amber-600') : 'text-emerald-600'
                                                        }`}>
                                                        {item.cantidadRecibida}
                                                        {!cantOk && (
                                                            <span className="text-xs ml-1">({diffCant > 0 ? '+' : ''}{diffCant})</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-center text-muted-foreground">
                                                        {item.precioEsperado > 0 ? formatCurrency(item.precioEsperado) : '—'}
                                                    </td>
                                                    <td className={`p-3 text-center font-bold ${!precioOk ? (diffPrecio > 0 ? 'text-red-600' : 'text-emerald-600') : ''
                                                        }`}>
                                                        {formatCurrency(item.precioFacturado)}
                                                        {!precioOk && (
                                                            <span className="text-xs ml-1">
                                                                ({diffPrecio > 0 ? '+' : ''}{formatCurrency(diffPrecio)})
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        {todoOk ? (
                                                            <Badge className="bg-emerald-100 text-emerald-700 text-xs">✓ OK</Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 text-xs gap-1">
                                                                <AlertTriangle className="w-3 h-3" /> Diferencia
                                                            </Badge>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {/* Items faltantes (pedidos pero no recibidos) */}
                                        {resumenComparacion.itemsFaltantes.map(pi => (
                                            <tr key={pi.id} className="border-t bg-red-50/50">
                                                <td className="p-3 font-medium text-red-700">
                                                    {getProductoById(pi.productoId)?.nombre || 'Desconocido'}
                                                </td>
                                                <td className="p-3 text-center">{pi.cantidad}</td>
                                                <td className="p-3 text-center font-bold text-red-600">0 <span className="text-xs">(-{pi.cantidad})</span></td>
                                                <td className="p-3 text-center text-muted-foreground">{formatCurrency(pi.precioUnitario)}</td>
                                                <td className="p-3 text-center">—</td>
                                                <td className="p-3 text-center">
                                                    <Badge variant="destructive" className="text-xs">Faltante</Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Factura {selectedRecepcion.numeroFactura}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <Label className="text-xs text-muted-foreground">Proveedor</Label>
                                    <p className="font-medium">{getProveedorById(selectedRecepcion.proveedorId)?.nombre}</p>
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground">Fecha Recepción</Label>
                                    <p className="font-medium">{new Date(selectedRecepcion.fechaRecepcion).toLocaleDateString()}</p>
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground">Fecha Factura</Label>
                                    <p className="font-medium">{new Date(selectedRecepcion.fechaFactura).toLocaleDateString()}</p>
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground">Total</Label>
                                    <p className="font-medium text-primary">{formatCurrency(selectedRecepcion.totalFactura)}</p>
                                    {selectedRecepcion.incluyeIva && (
                                        <p className="text-[11px] text-amber-600">Incluye IVA {selectedRecepcion.porcentajeIva ?? 19}% ({formatCurrency(selectedRecepcion.ivaFactura || 0)})</p>
                                    )}
                                    {selectedRecepcion.totalImpreso && Math.abs(selectedRecepcion.totalImpreso - selectedRecepcion.totalFactura) >= 1 && (
                                        <p className="text-[11px] text-rose-600">El papel decía {formatCurrency(selectedRecepcion.totalImpreso)}</p>
                                    )}
                                </div>
                            </div>

                            {selectedRecepcion.imagenFactura ? (
                                <div className="mt-4 border rounded-lg overflow-hidden">
                                    <img src={selectedRecepcion.imagenFactura} alt="Factura escaneada" className="w-full object-contain bg-slate-100" />
                                    <div className="p-2 bg-muted/50 flex justify-end">
                                        <Button variant="ghost" size="sm" className="gap-2 h-8" onClick={() => {
                                            const link = document.createElement('a');
                                            link.href = selectedRecepcion.imagenFactura!;
                                            link.download = `${selectedRecepcion.fechaFactura}_${getProveedorById(selectedRecepcion.proveedorId)?.nombre}_Factura.jpg`;
                                            link.click();
                                        }}>
                                            <Download className="w-4 h-4" /> Descargar
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-48 bg-muted/30 rounded-lg flex items-center justify-center text-muted-foreground text-sm flex-col gap-2">
                                    <ImageIcon className="w-8 h-8 opacity-50" />
                                    Sin imagen adjunta
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Items Recibidos</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {selectedRecepcion.items.map(item => (
                                    <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                        <div>
                                            <p className="font-medium text-sm">{getProductoById(item.productoId)?.nombre}</p>
                                            <div className="flex gap-2 mt-1">
                                                {!item.embalajeOk && <Badge variant="destructive" className="text-[10px] h-5">Mal Embalaje</Badge>}
                                                {!item.productoOk && <Badge variant="destructive" className="text-[10px] h-5">Producto Dañado</Badge>}
                                                {item.defectuosos > 0 && <Badge variant="destructive" className="text-[10px] h-5">{item.defectuosos} Defectuoso(s)</Badge>}
                                            </div>
                                            {item.observaciones && <p className="text-xs text-red-500 mt-1">{item.observaciones}</p>}
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold">{item.cantidadRecibida} uds</p>
                                            <p className="text-xs text-muted-foreground">{formatCurrency(item.precioFacturado)}/ud</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-ag-fade-in">
            {/* --- DASHBOARD DE MÉTRICAS LOGÍSTICAS (Nexus-Core) --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-gradient-to-br from-indigo-600 to-blue-700 text-white border-none shadow-xl shadow-indigo-500/20 rounded-[2rem] overflow-hidden group">
                    <CardContent className="p-6 relative">
                        <TrendingUp className="absolute right-4 top-4 w-12 h-12 text-white/10 group-hover:scale-125 transition-transform" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Inversión Mercancía (7d)</p>
                        <h2 className="text-3xl font-black mt-1 tabular-nums">{formatCurrency(stats.inversion)}</h2>
                        <div className="flex items-center gap-2 mt-4">
                            <Badge className="bg-white/20 text-white border-none text-[10px]">TOTAL MES: {stats.totalMes}</Badge>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-[2rem] shadow-sm">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center">
                            <AlertTriangle className="w-7 h-7 text-rose-500" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">Tasa de Incidencia</p>
                            <h2 className="text-2xl font-black text-rose-600 tabular-nums">{stats.tasaIncidencia.toFixed(1)}%</h2>
                            <p className="text-[9px] font-bold text-slate-500 mt-0.5">Entregas con novedad física o precio</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-[2rem] shadow-sm">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-500">
                             <History className="w-7 h-7 text-amber-500" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">Auditoría Pendiente</p>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">{prepedidosConfirmados.length}</h2>
                            <p className="text-[9px] font-bold text-slate-500 mt-0.5">Pedidos por confirmar recepción</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold uppercase tracking-tighter">📥 Gestión de Recepciones</h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-black tracking-wider leading-none mt-1">Scanner Forense & Control de Stock v5.1</p>
                    </div>
                    <div className="flex gap-2">
                        <Button 
                            variant="ghost" 
                            onClick={() => setView('galeria')} 
                            className="gap-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-50"
                        >
                            <FolderOpen className="w-4 h-4 text-amber-500" /> 
                            Archivo de Facturas
                        </Button>
                        {check('CREAR_RECEPCIONES') && (
                            <Button onClick={() => {
                                const hayAbierta = !!(newRecepcion.proveedorId || newRecepcion.items.length > 0 || pestañasEnEspera.length > 0);
                                if (hayAbierta) abrirOtraRecepcion();
                                else { setEditandoId(null); setView('new'); }
                            }} className="gap-2 h-12 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 font-black uppercase text-[11px] tracking-widest">
                                <Plus className="w-4 h-4" /> Registrar Factura
                            </Button>
                        )}
                    </div>
                </div>

                {pestañasVisibles.some(p => p.productos > 0 || p.form.proveedorId) && (
                    <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50 dark:bg-indigo-950/30 dark:border-indigo-800 overflow-hidden">
                        <p className="px-3 pt-3 text-[10px] font-black uppercase tracking-widest text-indigo-700">Recepciones abiertas</p>
                        <p className="px-3 text-xs font-bold text-indigo-900/70 dark:text-indigo-200">Toca una para seguirla. La otra se queda con sus precios, esperando.</p>
                        <BarraRecepcionesAbiertas
                            pestañas={pestañasVisibles}
                            onIr={irAPestaña}
                            onCerrar={cerrarPestaña}
                            onNueva={abrirOtraRecepcion}
                        />
                    </div>
                )}

                {(() => {
                    const { lista } = leerBorradoresGuardados();
                    const hayEnMemoria = pestañasVisibles.some(p => p.productos > 0 || p.form.proveedorId);
                    if (lista.length === 0 || hayEnMemoria) return null;
                    const nombres = lista.map(p => getProveedorById(p.form.proveedorId)?.nombre || 'proveedor').join(', ');
                    const totalProd = lista.reduce((s, p) => s + (p.form.items?.length || 0), 0);
                    return (
                        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-800">Recepción sin guardar</p>
                            <p className="text-sm font-bold text-amber-950 dark:text-amber-100">
                                Quedó abierta: {nombres} · {totalProd} productos. No la pierdas — tócala para recuperarla.
                            </p>
                            <button
                                type="button"
                                onClick={() => {
                                    const { lista: L, activaId } = leerBorradoresGuardados();
                                    if (aplicarBorradores(L, activaId)) toast.success('Recepción recuperada');
                                    else toast.error('No hay borrador para recuperar');
                                }}
                                className="h-11 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black uppercase tracking-widest"
                            >
                                Recuperar recepción abierta
                            </button>
                        </div>
                    );
                })()}

                {prepedidosConfirmados.length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-200 dark:border-amber-800 rounded-2xl p-4 space-y-3">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Preventas por recibir</p>
                            <p className="text-xs font-bold text-amber-900/70 dark:text-amber-200/80">Estas órdenes ya se hicieron en preventa. Toca una para recibirla.</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {prepedidosConfirmados.map(p => {
                                const proveedorNombre = getProveedorById(p.proveedorId)?.nombre || p.nombre;
                                const fecha = (() => {
                                    const d = new Date(p.fechaCreacion);
                                    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
                                })();
                                return (
                                    <button
                                        key={p.id}
                                        type="button"
                                        disabled={!check('CREAR_RECEPCIONES')}
                                        onClick={() => {
                                            setEditandoId(null);
                                            setView('new');
                                            handleVincularPrePedido(p.id);
                                        }}
                                        className="flex items-center justify-between gap-3 text-left bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-3 hover:border-amber-400 disabled:opacity-60"
                                    >
                                        <div className="min-w-0">
                                            <p className="font-black text-sm text-slate-900 dark:text-white break-words">{proveedorNombre}</p>
                                            <p className="text-[10px] font-bold text-slate-500">{p.items.length} productos · {fecha}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-sm font-black text-indigo-600 tabular-nums">{formatCurrency(p.total)}</p>
                                            <p className="text-[10px] font-black uppercase text-amber-700">Recibir</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                placeholder="Buscar por factura o proveedor..."
                                value={busqueda}
                                onChange={e => setBusqueda(e.target.value)}
                                className="pl-10 pr-10 h-11 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold"
                            />
                            {busqueda && (
                                <button
                                    type="button"
                                    onClick={() => setBusqueda('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        <div className="w-full sm:w-64">
                            <select
                                className="w-full px-3 h-11 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 text-sm font-bold text-slate-700 dark:text-slate-300 outline-none"
                                value={proveedorFiltro}
                                onChange={e => setProveedorFiltro(e.target.value)}
                            >
                                <option value="todos">Todos los Proveedores</option>
                                {proveedores.map(p => (
                                    <option key={p.id} value={p.id}>{p.nombre}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Filtros táctiles rápidos: Período + Estado */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                        {/* Período */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1 shrink-0 flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-indigo-500" /> Fecha:
                            </span>
                            {(
                                [
                                    { id: 'todos', label: 'Todo' },
                                    { id: 'hoy', label: 'Hoy' },
                                    { id: 'ayer', label: 'Ayer' },
                                    { id: 'semana', label: 'Esta Semana' },
                                    { id: 'mes', label: 'Este Mes' },
                                ] as const
                            ).map(p => (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => setFiltroFecha(p.id)}
                                    className={cn(
                                        'h-8 px-3 rounded-xl font-black uppercase tracking-wider text-[10px] transition-all shrink-0 border',
                                        filtroFecha === p.id
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                            : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                                    )}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>

                        {/* Estado OK / Incidencia */}
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1 shrink-0 flex items-center gap-1">
                                <ClipboardCheck className="w-3 h-3 text-emerald-500" /> Auditoría:
                            </span>
                            {(
                                [
                                    { id: 'todos', label: 'Todos' },
                                    { id: 'ok', label: '✓ Sin Novedad' },
                                    { id: 'incidencias', label: '⚠ Con Incidencia' },
                                ] as const
                            ).map(st => (
                                <button
                                    key={st.id}
                                    type="button"
                                    onClick={() => setFiltroEstado(st.id)}
                                    className={cn(
                                        'h-8 px-2.5 rounded-xl font-black uppercase tracking-wider text-[10px] transition-all shrink-0 border',
                                        filtroEstado === st.id
                                            ? (st.id === 'incidencias' 
                                                ? 'bg-rose-600 text-white border-rose-600 shadow-sm' 
                                                : st.id === 'ok' 
                                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                                                    : 'bg-slate-900 text-white border-slate-900 shadow-sm')
                                            : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                                    )}
                                >
                                    {st.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Rango libre de fechas: para buscar una recepción vieja por su día exacto */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 shrink-0 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-indigo-500" /> Entre fechas:
                        </span>
                        <input
                            type="date"
                            aria-label="Desde"
                            value={filtroFechaDesde}
                            onChange={e => setFiltroFechaDesde(e.target.value)}
                            className="h-8 px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none"
                        />
                        <span className="text-[10px] font-black text-slate-400">hasta</span>
                        <input
                            type="date"
                            aria-label="Hasta"
                            value={filtroFechaHasta}
                            onChange={e => setFiltroFechaHasta(e.target.value)}
                            className="h-8 px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none"
                        />
                        {(filtroFechaDesde || filtroFechaHasta) && (
                            <button
                                type="button"
                                onClick={() => { setFiltroFechaDesde(''); setFiltroFechaHasta(''); }}
                                className="h-8 px-2.5 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider"
                            >
                                Limpiar fechas
                            </button>
                        )}
                    </div>

                    {/* Resumen de resultados filtrados */}
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 pt-1">
                        <span>{filteredRecepciones.length} facturas encontradas</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-black">
                            Total filtrado: {formatCurrency(filteredRecepciones.reduce((s, r) => s + r.totalFactura, 0))}
                        </span>
                    </div>
                </div>

                <div className="space-y-2">
                    {filteredRecepciones.map(recepcion => {
                        const proveedor = getProveedorById(recepcion.proveedorId);
                        const itemsCount = recepcion.items.reduce((s, i) => s + i.cantidadRecibida, 0);
                        const hasIssues = recepcion.items.some(i => !i.productoOk || !i.embalajeOk || i.defectuosos > 0);
                        const iniciales = (proveedor?.nombre || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

                        return (
                            <div
                                key={recepcion.id}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-200 dark:hover:border-indigo-700 hover:shadow-md transition-all"
                            >
                                {/* Avatar — click va al detalle */}
                                <button onClick={() => { setSelectedRecepcion(recepcion); setView('details'); }}
                                    className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center hover:opacity-80 transition-opacity">
                                    {recepcion.imagenFactura
                                        ? <img src={recepcion.imagenFactura} className="w-full h-full object-cover" alt="" />
                                        : <span className="text-base font-black text-indigo-600 dark:text-indigo-300">{iniciales}</span>
                                    }
                                </button>

                                {/* Info central — click va al detalle */}
                                <button onClick={() => { setSelectedRecepcion(recepcion); setView('details'); }}
                                    className="flex-1 min-w-0 text-left">
                                    <p className="font-black text-sm text-slate-900 dark:text-white truncate leading-tight">{proveedor?.nombre || 'Sin proveedor'}</p>
                                    <p className="text-[10px] font-bold text-slate-400 truncate mt-0.5">
                                        {recepcion.numeroFactura || 'S/N'}
                                        <span className="mx-1.5">·</span>
                                        <Calendar className="inline w-3 h-3 mb-0.5" />{' '}
                                        {new Date(recepcion.fechaRecepcion).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        <span className="mx-1.5">·</span>
                                        {itemsCount} uds
                                    </p>
                                </button>

                                {/* Total + estado */}
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                    <span className="font-black text-sm tabular-nums text-indigo-600 dark:text-indigo-400">{formatCurrency(recepcion.totalFactura)}</span>
                                    {recepcion.incluyeIva && <span className="text-[9px] font-bold text-amber-600">con IVA</span>}
                                    {recepcion.totalImpreso != null && Math.abs(recepcion.totalImpreso - recepcion.totalFactura) >= 1 && (
                                        <span className="text-[9px] font-bold text-rose-600">papel {formatCurrency(recepcion.totalImpreso)}</span>
                                    )}
                                    <span className={cn(
                                        'text-[9px] font-black uppercase px-2 py-0.5 rounded-full',
                                        hasIssues
                                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                    )}>
                                        {hasIssues ? '⚠ Incidencia' : '✓ OK'}
                                    </span>
                                </div>

                                {/* Acciones */}
                                <div className="flex flex-col gap-1 shrink-0">
                                    <button
                                        onClick={() => handleEditarRecepcion(recepcion)}
                                        title="Corregir esta recepción"
                                        className="w-8 h-8 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 flex items-center justify-center transition-colors">
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => handleReutilizarRecepcion(recepcion)}
                                        title="Usar como base para nueva recepción"
                                        className="w-8 h-8 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 flex items-center justify-center transition-colors">
                                        <History className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteRecepcion(recepcion.id)}
                                        title="Eliminar"
                                        className="w-8 h-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-500 flex items-center justify-center transition-colors">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    {filteredRecepciones.length === 0 && (
                        <div className="py-16 text-center text-slate-400">
                            <Package className="w-12 h-12 mx-auto mb-3 opacity-25" />
                            <p className="font-bold text-sm">No se encontraron recepciones</p>
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL MAESTRO DE PRODUCTOS */}
            {isProductModalOpen && (
                <ProductFormModal
                    isOpen={isProductModalOpen}
                    onOpenChange={(open) => { if (!open) { setIsProductModalOpen(false); setProductToEdit(null); setFormDataModal(FORM_DATA_VACIO); } }}
                    editingProducto={productToEdit}
                    categorias={categorias}
                    productos={productos}
                    proveedores={proveedores}
                    formData={formDataModal}
                    setFormData={setFormDataModal}
                    onSubmit={handleSubmitModal}
                    formatCurrency={formatCurrency}
                    onAddCategoria={onAddCategoria}
                />
            )}
        </div>
    );
}

function InfoBadge({ label, value }: { label: string, value: string }) {
    return (
        <div className="flex flex-col bg-muted/50 px-3 py-1 rounded-md border text-center">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
            <span className="font-bold text-sm">{value}</span>
        </div>
    )
}
