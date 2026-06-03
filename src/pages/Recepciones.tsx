import { generateUUID } from '@/lib/safe-utils';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useCan, useAuth } from '@/contexts/AuthContext';
import {
    CheckCircle, X, Plus, Calendar,
    Search, Eye, Download, Image as ImageIcon,
    ArrowLeft, ArrowRight, Package, GitCompareArrows, AlertTriangle,
    TrendingUp, TrendingDown, Sparkles, Loader2,
    Camera, Zap, Check, FolderOpen,
    Trash2, ZoomIn, Filter, History,
    Truck, Receipt, ClipboardCheck, ChevronDown
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { db } from '@/lib/database';
import type { Producto, Proveedor, Recepcion, RecepcionItem, PrePedido, FacturaEscaneada, PrecioProveedor } from '@/types';
import { procesarImagenFactura, matchProductoEnCatalogo, matchProveedorEnCatalogo } from '@/lib/ocr-service';
import { ProductFormModal } from '@/components/productos/ProductFormModal';
import type { Categoria as CategoriaTipo } from '@/types';

interface RecepcionesProps {
    recepciones: Recepcion[];
    proveedores: Proveedor[];
    productos: Producto[];
    precios: PrecioProveedor[];
    prepedidos: PrePedido[];
    categorias: CategoriaTipo[];
    onAddRecepcion: (data: Omit<Recepcion, 'id'>) => Promise<Recepcion>;
    onConfirmarRecepcion: (recepcion: Recepcion) => Promise<void>;
    onAddProducto: (producto: Omit<Producto, 'id'>) => Promise<void>;
    onUpdateProducto: (id: string, updates: Partial<Producto>) => Promise<void>;
    getProveedorById: (id: string) => Proveedor | undefined;
    getProductoById: (id: string) => Producto | undefined;
    formatCurrency: (value: number) => string;
}

export default function Recepciones({
    recepciones, proveedores, productos, precios, prepedidos, categorias,
    onAddRecepcion, onConfirmarRecepcion, onAddProducto, onUpdateProducto,
    getProveedorById, getProductoById, formatCurrency
}: RecepcionesProps) {
    const { check } = useCan();
    const { usuario } = useAuth();
    const [view, setView] = useState<'list' | 'new' | 'details' | 'galeria'>('list');
    const [selectedRecepcion, setSelectedRecepcion] = useState<Recepcion | null>(null);
    const [busqueda, setBusqueda] = useState('');
    const [proveedorFiltro, setProveedorFiltro] = useState<string>('todos');
    const [prePedidoSeleccionado, setPrePedidoSeleccionado] = useState<string>('');
    
    // === ESTADO PRODUCT FORM MODAL ===
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [productToEdit, setProductToEdit] = useState<Producto | null>(null);
    const [isCreatingNewFromAction, setIsCreatingNewFromAction] = useState(false);

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

    // Pre-pedidos confirmados disponibles para vincular
    const prepedidosConfirmados = useMemo(() =>
        prepedidos.filter(p => p.estado === 'confirmado'),
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
    }>({
        proveedorId: '',
        prePedidoId: undefined,
        numeroFactura: '',
        fechaFactura: new Date().toISOString().split('T')[0],
        imagenFactura: null,
        items: [],
        observaciones: ''
    });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const imagenFileRef = useRef<File | null>(null);

    // === ESTADO PARA WIZARD (FLUJO GUIADO) ===
    const [step, setStep] = useState(1);
    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);
    const [busquedaProveedor, setBusquedaProveedor] = useState('');
    const [busquedaProducto, setBusquedaProducto] = useState('');
    const [mostrarDropProducto, setMostrarDropProducto] = useState(false);
    const [categoriaFiltroRecepcion, setCategoriaFiltroRecepcion] = useState('');
    const [mobilePanelRec, setMobilePanelRec] = useState<'productos' | 'ticket'>('productos');
    const [categoriasExpandidas, setCategoriasExpandidas] = useState<Set<string>>(new Set());
    const [preciosAActualizar, setPreciosAActualizar] = useState<Set<string>>(new Set());
    const [draftRestorado, setDraftRestorado] = useState(false);
    const [scanStep, setScanStep] = useState('');
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
            const prod = getProductoById(item.productoId);
            if (!prod || !item.precioFacturado) return false;
            const base = prod.costoBase || 0;
            if (!base) return false;
            return Math.abs((item.precioFacturado - base) / base) > 0.02;
        });
    }, [newRecepcion.items, getProductoById]);

    const handleProductSaved = async (productoData: any) => {
        try {
            if (productToEdit) {
                await onUpdateProducto(productToEdit.id, productoData);
                toast.success('Producto maestro actualizado');
            } else {
                // Si es nuevo, necesitamos obtener el ID generado por la DB o similar
                // Como onAddProducto es async y los efectos de React refrescarán el array de productos,
                // vamos a buscar el producto por nombre o esperar que el padre lo actualice.
                await onAddProducto(productoData);
                
                // Si estamos en medio de una recepción, intentamos agregarlo automáticamente
                // Nota: Esto requiere que el array 'productos' ya tenga el nuevo ítem.
                // En un sistema real, onAddProducto devolvería el producto creado.
                setIsCreatingNewFromAction(true); // Flag para el useEffect de abajo
            }
            setIsProductModalOpen(false);
            setProductToEdit(null);
        } catch (error) {
            toast.error('Error al guardar el producto maestro');
        }
    };

    // Auto-agregar productos recién creados al listado de recepción
    useEffect(() => {
        if (isCreatingNewFromAction && productos.length > 0) {
            // Buscamos el producto más reciente o el que coincida (simplificado por ahora)
            // En una app real usaríamos el ID devuelto.
            const ultimo = productos[productos.length - 1];
            if (ultimo) {
                handleAddItem(ultimo.id);
                setIsCreatingNewFromAction(false);
                toast.success(`"${ultimo.nombre}" registrado y añadido a la recepción`);
            }
        }
    }, [productos.length, isCreatingNewFromAction]);

    // Auto-borrador: guarda en localStorage al editar
    useEffect(() => {
        if (view !== 'new') return;
        if (!newRecepcion.proveedorId && newRecepcion.items.length === 0) return;
        try {
            localStorage.setItem('rec_draft_v2', JSON.stringify({ form: newRecepcion, step }));
        } catch {}
    }, [newRecepcion, step, view]);

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
            
            return recepciones.filter(recepcion => {
                if (!recepcion) return false;
                const proveedor = getProveedorById(recepcion.proveedorId);
                const matchBusqueda = 
                    (recepcion.numeroFactura?.toLowerCase() || "").includes(busqueda.toLowerCase()) ||
                    (proveedor?.nombre?.toLowerCase() || "").includes(busqueda.toLowerCase());
                const matchProveedor = proveedorFiltro === 'todos' || recepcion.proveedorId === proveedorFiltro;
                return matchBusqueda && matchProveedor;
            }).sort((a, b) => {
                const dateA = a.fechaRecepcion ? new Date(a.fechaRecepcion).getTime() : 0;
                const dateB = b.fechaRecepcion ? new Date(b.fechaRecepcion).getTime() : 0;
                return dateB - dateA;
            });
        } catch (error) {
            console.error("Shield-Guardian: Error filtrando recepciones", error);
            return [];
        }
    }, [recepciones, busqueda, proveedorFiltro, getProveedorById]);

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
    const handleAddItem = (productoId: string) => {
        const producto = getProductoById(productoId);
        if (!producto) return;

        const newItem: RecepcionItem = {
            id: generateUUID(),
            productoId,
            cantidadEsperada: 0,
            cantidadRecibida: 1,
            precioEsperado: producto.costoBase || 0,
            precioFacturado: producto.costoBase || 0,
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

    // Guardar Recepción
    const handleSave = async (preciosSet?: Set<string>) => {
        if (!newRecepcion.proveedorId || newRecepcion.items.length === 0) {
            toast.error('Selecciona un proveedor y agrega al menos un producto.');
            return;
        }
        const numFactura = newRecepcion.numeroFactura || `F-${Date.now().toString().slice(-6)}`;

        try {
            const total = Math.round(newRecepcion.items.reduce((sum, item) => sum + (item.cantidadRecibida * item.precioFacturado), 0) * 100) / 100;

            const recepcionData: Omit<Recepcion, 'id'> = {
                prePedidoId: newRecepcion.prePedidoId,
                proveedorId: newRecepcion.proveedorId,
                numeroFactura: numFactura,
                fechaFactura: new Date(newRecepcion.fechaFactura).toISOString(),
                totalFactura: total,
                items: newRecepcion.items,
                estado: 'en_proceso',
                recibidoPor: usuario?.nombre || usuario?.email || 'Sistema',
                fechaRecepcion: new Date().toISOString(),
                imagenFactura: newRecepcion.imagenFactura || undefined,
                observaciones: newRecepcion.observaciones
            };

            const saved = await onAddRecepcion(recepcionData);
            await onConfirmarRecepcion(saved);

            // Actualizar costos que cambiaron
            const preciosParaActualizar = preciosSet ?? preciosAActualizar;
            if (preciosParaActualizar.size > 0) {
                await Promise.all(
                    newRecepcion.items
                        .filter(item => preciosParaActualizar.has(item.productoId))
                        .map(item => onUpdateProducto(item.productoId, { costoBase: Math.round(item.precioFacturado * 100) / 100 }))
                );
            }

            // Guardar factura en archivo si hay imagen
            if (newRecepcion.imagenFactura) {
                await guardarFacturaEnArchivo(saved, newRecepcion.imagenFactura);
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
            setView('list');
            setStep(1);
            setPrePedidoSeleccionado('');
            setNewRecepcion({
                proveedorId: '',
                prePedidoId: undefined,
                numeroFactura: '',
                fechaFactura: new Date().toISOString().split('T')[0],
                imagenFactura: null,
                items: [],
                observaciones: ''
            });
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
        const totalDinero = newRecepcion.items.reduce((s, i) => s + (i.cantidadRecibida * i.precioFacturado), 0);
        const proveedorActual = proveedores.find(p => p.id === newRecepcion.proveedorId);
        const prepedidosPendientes = prepedidosConfirmados.filter(p => p.proveedorId === newRecepcion.proveedorId);
        const paleta = ['bg-indigo-600','bg-violet-500','bg-emerald-600','bg-rose-500','bg-amber-500','bg-sky-600','bg-teal-600','bg-pink-500'];

        /* ── PANTALLA A: selección de proveedor ── */
        if (!newRecepcion.proveedorId) {
            return (
                <div className="space-y-4 animate-ag-fade-in pb-24">
                    <div className="flex items-center gap-3">
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
                                    onClick={() => { setNewRecepcion(prev => ({ ...prev, proveedorId: p.id })); setBusquedaProveedor(''); }}
                                    className="flex flex-col items-center gap-2.5 p-4 rounded-2xl border-2 border-slate-100 bg-white dark:bg-slate-800 hover:border-indigo-300 hover:shadow-md active:scale-95 text-center transition-all"
                                >
                                    <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl text-white shadow-sm shrink-0", paleta[idx % paleta.length])}>
                                        {p.nombre.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="w-full space-y-0.5">
                                        <p className="font-black text-sm text-slate-900 dark:text-white line-clamp-2 leading-tight">{p.nombre}</p>
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
                {/* Cabecera compacta */}
                <div className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-3 py-2 flex items-center gap-2 z-20">
                    <button
                        onClick={() => setNewRecepcion(p => ({ ...p, proveedorId: '', items: [] }))}
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
                                            const esDeEsteProv = preciosDelProveedor.some(pp => pp.productoId === p.id);
                                            return (
                                                <button key={p.id} onClick={() => { handleAddItem(p.id); setBusquedaProducto(''); }}
                                                    className={cn("flex flex-col items-start p-2.5 rounded-xl border active:scale-95 transition-all text-left gap-0.5 group",
                                                        esDeEsteProv
                                                            ? "bg-indigo-50 border-indigo-200 hover:border-indigo-400"
                                                            : "bg-white dark:bg-slate-800 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50"
                                                    )}>
                                                    <span className="font-black text-[10px] text-slate-800 dark:text-white leading-tight line-clamp-2 group-hover:text-indigo-700">{p.nombre}</span>
                                                    <span className={cn("text-[10px] font-black tabular-nums", p.costoBase ? "text-indigo-600" : "text-slate-400")}>
                                                        {p.costoBase ? formatCurrency(p.costoBase) : 'Sin precio'}
                                                    </span>
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
                                                {productosAgrupados.delProveedor.map(p => (
                                                    <button key={p.id} onClick={() => handleAddItem(p.id)}
                                                        className="flex flex-col items-start p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 active:scale-95 transition-all text-left gap-0.5 group">
                                                        <span className="font-black text-[10px] text-slate-800 dark:text-white leading-tight line-clamp-2 group-hover:text-indigo-700">{p.nombre}</span>
                                                        <span className={cn("text-[10px] font-black tabular-nums", p.costoBase ? "text-indigo-600" : "text-slate-400")}>
                                                            {p.costoBase ? formatCurrency(p.costoBase) : 'Sin precio'}
                                                        </span>
                                                    </button>
                                                ))}
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
                                                        {prods.map(p => (
                                                            <button key={p.id} onClick={() => handleAddItem(p.id)}
                                                                className="flex flex-col items-start p-2.5 rounded-lg bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 border border-transparent active:scale-95 transition-all text-left gap-0.5 group">
                                                                <span className="font-black text-[10px] text-slate-800 dark:text-white leading-tight line-clamp-2 group-hover:text-indigo-700">{p.nombre}</span>
                                                                <span className={cn("text-[10px] font-black tabular-nums", p.costoBase ? "text-indigo-600" : "text-slate-400")}>
                                                                    {p.costoBase ? formatCurrency(p.costoBase) : 'Sin precio'}
                                                                </span>
                                                            </button>
                                                        ))}
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
                            </div>
                            {totalItems > 0 && (
                                <div className="text-right">
                                    <p className="text-[9px] text-indigo-400 font-bold">{totalItems} prod · {totalUnidades} uds</p>
                                    <p className="text-sm font-black tabular-nums">{formatCurrency(totalDinero)}</p>
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
                                <div className="divide-y divide-white/5">
                                    {newRecepcion.items.map((item, idx) => {
                                        const prod = getProductoById(item.productoId);
                                        const precioAnt = prod?.costoBase || 0;
                                        const diff = precioAnt > 0 ? ((item.precioFacturado - precioAnt) / precioAnt) * 100 : 0;
                                        const subio = diff > 5;
                                        const bajo = diff < -2;
                                        return (
                                            <div key={item.id} className="px-3 py-2.5 space-y-2">
                                                <div className="flex items-start gap-2">
                                                    <span className="text-[9px] font-black text-slate-500 mt-0.5 shrink-0 w-4 text-right">{idx + 1}</span>
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
                                                <div className="flex items-center gap-1.5 pl-6">
                                                    <input type="number" value={item.precioFacturado || ''} placeholder="$"
                                                        onChange={e => handleUpdateItem(item.id, { precioFacturado: parseFloat(e.target.value) || 0 })}
                                                        className={cn("w-20 h-8 rounded-lg px-2 text-center font-black text-xs outline-none border transition-colors",
                                                            subio ? "bg-rose-900/40 border-rose-700 text-rose-300" : bajo ? "bg-emerald-900/40 border-emerald-700 text-emerald-300" : "bg-white/10 border-white/10 text-white"
                                                        )}
                                                    />
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
                                                    <div className="flex-1 text-right">
                                                        <p className="font-black text-xs text-white tabular-nums">
                                                            {item.cantidadRecibida * item.precioFacturado > 0 ? formatCurrency(item.cantidadRecibida * item.precioFacturado) : '—'}
                                                        </p>
                                                    </div>
                                                </div>
                                                {(!item.productoOk || !item.embalajeOk) && (
                                                    <input placeholder="Describe la novedad..."
                                                        value={item.observaciones || ''}
                                                        onChange={e => handleUpdateItem(item.id, { observaciones: e.target.value })}
                                                        className="h-7 rounded-lg bg-amber-900/30 border border-amber-700/50 text-amber-300 px-3 text-[10px] font-bold outline-none"
                                                        style={{ width: 'calc(100% - 1.5rem)', marginLeft: '1.5rem' }}
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer ticket */}
                        <div className="bg-[#1a1c2e] border-t border-white/10 p-3 space-y-2 shrink-0">
                            <div className="flex items-end justify-between gap-2">
                                <div>
                                    <p className="text-[9px] font-black uppercase text-indigo-400 tracking-widest">{totalItems} productos · {totalUnidades} unidades</p>
                                    <p className="text-2xl font-black text-white tabular-nums">{formatCurrency(totalDinero)}</p>
                                </div>
                                <textarea value={newRecepcion.observaciones}
                                    onChange={e => setNewRecepcion(p => ({ ...p, observaciones: e.target.value }))}
                                    placeholder="Notas..." rows={2}
                                    className="hidden sm:block h-12 px-2 py-1.5 rounded-xl bg-white/10 border border-white/10 text-[10px] text-white placeholder:text-white/30 outline-none resize-none w-28"
                                />
                            </div>
                            <button
                                disabled={newRecepcion.items.length === 0}
                                onClick={() => handleSave(new Set(cambiosPrecio.map(i => i.productoId)))}
                                className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-900/50"
                            >
                                <CheckCircle className="w-4 h-4" /> Confirmar y guardar
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

                {/* Modales */}
                {isProductModalOpen && (
                    <ProductFormModal isOpen={isProductModalOpen}
                        onClose={() => { setIsProductModalOpen(false); setProductToEdit(null); }}
                        onSave={handleProductSaved} categorias={categorias} initialData={productToEdit || undefined}
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
                            <Button onClick={() => setView('new')} className="gap-2 h-12 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 font-black uppercase text-[11px] tracking-widest">
                                <Plus className="w-4 h-4" /> Registrar Factura
                            </Button>
                        )}
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por factura o proveedor..."
                            value={busqueda}
                            onChange={e => setBusqueda(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <div className="w-full sm:w-64">
                        <select
                            className="w-full p-2 h-10 rounded-md border bg-background text-sm"
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

                <div className="space-y-2">
                    {filteredRecepciones.map(recepcion => {
                        const proveedor = getProveedorById(recepcion.proveedorId);
                        const itemsCount = recepcion.items.reduce((s, i) => s + i.cantidadRecibida, 0);
                        const hasIssues = recepcion.items.some(i => !i.productoOk || !i.embalajeOk || i.defectuosos > 0);
                        const iniciales = (proveedor?.nombre || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

                        return (
                            <button
                                key={recepcion.id}
                                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-200 dark:hover:border-indigo-700 hover:shadow-md transition-all text-left group"
                                onClick={() => { setSelectedRecepcion(recepcion); setView('details'); }}
                            >
                                {/* Avatar */}
                                <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                                    {recepcion.imagenFactura
                                        ? <img src={recepcion.imagenFactura} className="w-full h-full object-cover" alt="" />
                                        : <span className="text-base font-black text-indigo-600 dark:text-indigo-300">{iniciales}</span>
                                    }
                                </div>

                                {/* Info central */}
                                <div className="flex-1 min-w-0">
                                    <p className="font-black text-sm text-slate-900 dark:text-white truncate leading-tight">{proveedor?.nombre || 'Sin proveedor'}</p>
                                    <p className="text-[10px] font-bold text-slate-400 truncate mt-0.5">
                                        {recepcion.numeroFactura || 'S/N'}
                                        <span className="mx-1.5">·</span>
                                        <Calendar className="inline w-3 h-3 mb-0.5" />{' '}
                                        {new Date(recepcion.fechaRecepcion).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        <span className="mx-1.5">·</span>
                                        {itemsCount} uds
                                    </p>
                                </div>

                                {/* Total + estado */}
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                    <span className="font-black text-sm tabular-nums text-indigo-600 dark:text-indigo-400">{formatCurrency(recepcion.totalFactura)}</span>
                                    <span className={cn(
                                        'text-[9px] font-black uppercase px-2 py-0.5 rounded-full',
                                        hasIssues
                                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                    )}>
                                        {hasIssues ? '⚠ Incidencia' : '✓ Sin novedad'}
                                    </span>
                                </div>

                                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors shrink-0" />
                            </button>
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
                    onClose={() => {
                        setIsProductModalOpen(false);
                        setProductToEdit(null);
                    }}
                    onSave={handleProductSaved}
                    categorias={categorias}
                    initialData={productToEdit || undefined}
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
