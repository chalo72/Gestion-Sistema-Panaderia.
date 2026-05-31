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
    Truck, Receipt, ClipboardCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { db } from '@/lib/database';
import type { Producto, Proveedor, Recepcion, RecepcionItem, PrePedido, FacturaEscaneada } from '@/types';
import { procesarImagenFactura, matchProductoEnCatalogo, matchProveedorEnCatalogo } from '@/lib/ocr-service';
import { ProductFormModal } from '@/components/productos/ProductFormModal';
import type { Categoria as CategoriaTipo } from '@/types';

interface RecepcionesProps {
    recepciones: Recepcion[];
    proveedores: Proveedor[];
    productos: Producto[];
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
    recepciones, proveedores, productos, prepedidos, categorias,
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
    const [preciosAActualizar, setPreciosAActualizar] = useState<Set<string>>(new Set());
    const [draftRestorado, setDraftRestorado] = useState(false);
    const [scanStep, setScanStep] = useState('');

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

    // Cambios de precio detectados (para paso 4)
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
                // Si encontramos productos, saltamos al paso de la lista
                setStep(3);
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
    const handleSave = async () => {
        if (!newRecepcion.proveedorId || !newRecepcion.numeroFactura || newRecepcion.items.length === 0) {
            toast.error('Por favor completa los campos obligatorios y agrega al menos un producto.');
            return;
        }

        try {
            const total = Math.round(newRecepcion.items.reduce((sum, item) => sum + (item.cantidadRecibida * item.precioFacturado), 0) * 100) / 100;

            const recepcionData: Omit<Recepcion, 'id'> = {
                prePedidoId: newRecepcion.prePedidoId,
                proveedorId: newRecepcion.proveedorId,
                numeroFactura: newRecepcion.numeroFactura,
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

            // === ACTUALIZAR COSTOS SELECCIONADOS EN EL CATÁLOGO ===
            if (preciosAActualizar.size > 0) {
                await Promise.all(
                    newRecepcion.items
                        .filter(item => preciosAActualizar.has(item.productoId))
                        .map(item => onUpdateProducto(item.productoId, { costoBase: Math.round(item.precioFacturado * 100) / 100 }))
                );
            }

            // === GUARDAR FACTURA EN ARCHIVO SI HAY IMAGEN ===
            if (newRecepcion.imagenFactura) {
                await guardarFacturaEnArchivo(saved, newRecepcion.imagenFactura);
            }

            // Calcular totales para el mensaje
            const totalItems = newRecepcion.items.reduce((sum, i) => sum + i.cantidadRecibida, 0);
            
            toast.success(
                <div className="flex flex-col gap-1">
                    <span className="font-semibold flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                        ¡Recepción completada!
                    </span>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                        <p>✓ {newRecepcion.items.length} productos procesados</p>
                        <p>✓ {totalItems} unidades agregadas a inventario</p>
                        {preciosAActualizar.size > 0 && <p>✓ {preciosAActualizar.size} precios de costo actualizados</p>}
                        {newRecepcion.imagenFactura && <p>✓ Factura guardada en archivo</p>}
                        <p className="text-emerald-600 font-medium">→ Productos listos para vender</p>
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

    const STEP_INFO = [
        { num: 1, label: 'Proveedor', Icon: Truck },
        { num: 2, label: 'Factura',   Icon: Receipt },
        { num: 3, label: 'Productos', Icon: Package },
        { num: 4, label: 'Confirmar', Icon: ClipboardCheck },
    ];

    if (view === 'new') {
        const totalItems = newRecepcion.items.length;
        const totalUnidades = newRecepcion.items.reduce((s, i) => s + i.cantidadRecibida, 0);
        const totalDinero = newRecepcion.items.reduce((s, i) => s + (i.cantidadRecibida * i.precioFacturado), 0);
        const proveedorActual = proveedores.find(p => p.id === newRecepcion.proveedorId);
        const prepedidosPendientes = prepedidosConfirmados.filter(p => p.proveedorId === newRecepcion.proveedorId);
        const ultimaRecepcionProv = recepciones
            .filter(r => r.proveedorId === newRecepcion.proveedorId)
            .sort((a, b) => new Date(b.fechaRecepcion).getTime() - new Date(a.fechaRecepcion).getTime())[0];

        return (
            <div className="space-y-4 animate-ag-fade-in pb-24">
                {/* ─── CABECERA CON PASOS (4-col grid innovador) ────────── */}
                <div className="sticky top-0 z-20 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shadow-sm px-4 pt-3 pb-3 space-y-3">
                    {/* Fila superior: back + título + total */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => { if (step > 1) setStep(step - 1); else setView('list'); }}
                            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors shrink-0"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                        <div className="flex-1 min-w-0">
                            <h1 className="text-sm font-black uppercase tracking-tight leading-none truncate">Entrada de Mercancía</h1>
                            {proveedorActual && step > 1 && (
                                <p className="text-[10px] font-bold text-indigo-500 mt-0.5 truncate">{proveedorActual.nombre}</p>
                            )}
                        </div>
                        {step >= 3 && totalItems > 0 && (
                            <div className="flex flex-col items-end shrink-0">
                                <span className="text-xs font-black text-indigo-600 tabular-nums">{formatCurrency(totalDinero)}</span>
                                <span className="text-[9px] text-slate-400 font-bold uppercase">{totalItems} prod · {totalUnidades} uds</span>
                            </div>
                        )}
                    </div>
                    {/* Indicadores de paso: 4-col grid */}
                    <div className="grid grid-cols-4 gap-1.5">
                        {STEP_INFO.map(({ num, label, Icon }) => {
                            const isActive = step === num;
                            const isDone = step > num;
                            return (
                                <button
                                    key={num}
                                    onClick={() => { if (isDone) setStep(num); }}
                                    className={cn(
                                        'flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all',
                                        isActive
                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                                            : isDone
                                            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 cursor-pointer'
                                            : 'bg-slate-50 dark:bg-slate-800 text-slate-400 cursor-default'
                                    )}
                                >
                                    {isDone
                                        ? <Check className="w-3.5 h-3.5" />
                                        : <Icon className="w-3.5 h-3.5" />
                                    }
                                    <span>{label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
                {/* ─── PASO 1: PROVEEDOR ─────────────────────────────────── */}
                {step === 1 && (
                    <div className="space-y-4 animate-ag-fade-in max-w-2xl mx-auto w-full">
                        <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">¿Quién llega hoy?</h2>

                        {/* Buscador */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar proveedor..."
                                value={busquedaProveedor}
                                onChange={e => setBusquedaProveedor(e.target.value)}
                                autoFocus
                                className="w-full h-12 pl-9 pr-4 rounded-xl border-2 border-indigo-100 focus:border-indigo-400 bg-white dark:bg-slate-800 font-bold text-sm outline-none transition-colors"
                            />
                        </div>

                        {/* Lista de proveedores */}
                        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                            {proveedoresFiltrados.length === 0 && (
                                <div className="text-center py-8 text-slate-400 text-sm font-bold">Sin resultados</div>
                            )}
                            {proveedoresFiltrados.map((p, idx) => {
                                const lastRec = recepciones
                                    .filter(r => r.proveedorId === p.id)
                                    .sort((a, b) => new Date(b.fechaRecepcion).getTime() - new Date(a.fechaRecepcion).getTime())[0];
                                const pedidosPend = prepedidosConfirmados.filter(pp => pp.proveedorId === p.id).length;
                                return (
                                    <button
                                        key={p.id}
                                        onClick={() => {
                                            setNewRecepcion(prev => ({ ...prev, proveedorId: p.id }));
                                            setBusquedaProveedor('');
                                            setStep(2);
                                        }}
                                        className={cn(
                                            "w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all hover:border-indigo-300 hover:shadow-sm bg-white dark:bg-slate-800",
                                            newRecepcion.proveedorId === p.id ? "border-indigo-500 bg-indigo-50" : "border-slate-100"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0",
                                            idx === 0 ? "bg-indigo-600 text-white" :
                                            idx === 1 ? "bg-violet-100 text-violet-700" :
                                            "bg-slate-100 text-slate-600"
                                        )}>
                                            {p.nombre.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-black text-sm text-slate-900 dark:text-white truncate">{p.nombre}</p>
                                            <p className="text-[10px] text-slate-400 font-bold">
                                                {lastRec
                                                    ? `Últ. recepción: ${new Date(lastRec.fechaRecepcion).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`
                                                    : 'Sin recepciones'}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {pedidosPend > 0 && (
                                                <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                                                    {pedidosPend} pedido{pedidosPend > 1 ? 's' : ''}
                                                </span>
                                            )}
                                            <ArrowRight className="w-4 h-4 text-slate-300" />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ─── PASO 2: FACTURA ───────────────────────────────────── */}
                {step === 2 && (
                    <div className="space-y-4 animate-ag-fade-in max-w-2xl mx-auto w-full">
                        <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">Datos de la factura</h2>

                        {/* Pre-pedido pendiente — destacado */}
                        {prepedidosPendientes.length > 0 && (
                            <div className="p-4 rounded-2xl bg-blue-600 text-white space-y-3">
                                <div className="flex items-center gap-2">
                                    <GitCompareArrows className="w-4 h-4" />
                                    <span className="text-xs font-black uppercase tracking-widest">
                                        {prepedidosPendientes.length} pedido{prepedidosPendientes.length > 1 ? 's' : ''} pendiente{prepedidosPendientes.length > 1 ? 's' : ''}
                                    </span>
                                </div>
                                {prepedidosPendientes.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => { handleVincularPrePedido(p.id); setStep(3); }}
                                        className="w-full flex items-center justify-between bg-white/15 hover:bg-white/25 rounded-xl px-4 py-3 transition-colors"
                                    >
                                        <div className="text-left">
                                            <p className="font-black text-sm">{p.nombre}</p>
                                            <p className="text-xs text-blue-200">{p.items.length} productos · {formatCurrency(p.total)}</p>
                                        </div>
                                        <span className="text-xs font-black bg-white text-blue-600 px-3 py-1 rounded-lg">Cargar</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Cargar desde última recepción */}
                        {ultimaRecepcionProv && (
                            <button
                                onClick={() => cargarUltimaRecepcion(newRecepcion.proveedorId)}
                                className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all text-left"
                            >
                                <History className="w-5 h-5 text-slate-400 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-black text-slate-700">Usar la última recepción como base</p>
                                    <p className="text-[10px] text-slate-400">
                                        {new Date(ultimaRecepcionProv.fechaRecepcion).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}
                                        · {ultimaRecepcionProv.items.length} productos · {formatCurrency(ultimaRecepcionProv.totalFactura)}
                                    </p>
                                </div>
                                <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
                            </button>
                        )}

                        {/* Número + Fecha */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-400">Nº Factura</Label>
                                <Input
                                    value={newRecepcion.numeroFactura}
                                    onChange={e => setNewRecepcion(p => ({ ...p, numeroFactura: e.target.value }))}
                                    placeholder="Ej: F-2024-001"
                                    className="h-12 rounded-xl bg-slate-50 border-slate-200 font-bold"
                                    autoFocus
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-400">Fecha Factura</Label>
                                <Input
                                    type="date"
                                    value={newRecepcion.fechaFactura}
                                    onChange={e => setNewRecepcion(p => ({ ...p, fechaFactura: e.target.value }))}
                                    className="h-12 rounded-xl bg-slate-50 border-slate-200 font-bold"
                                />
                            </div>
                        </div>

                        {/* Foto de factura */}
                        <div className={cn(
                            "rounded-2xl border-2 overflow-hidden transition-all",
                            newRecepcion.imagenFactura ? "border-amber-400" : "border-slate-100"
                        )}>
                            {newRecepcion.imagenFactura ? (
                                <div className="p-4 bg-amber-50 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase text-amber-600 flex items-center gap-1.5">
                                            <Camera className="w-3.5 h-3.5" /> Foto cargada
                                        </span>
                                        <button onClick={() => setNewRecepcion(p => ({ ...p, imagenFactura: null }))}
                                            className="text-[10px] font-black text-rose-500 hover:text-rose-700">Quitar</button>
                                    </div>
                                    <img src={newRecepcion.imagenFactura} className="w-full max-h-40 object-contain rounded-xl" alt="Factura" />
                                    <button
                                        onClick={handleScanFactura}
                                        disabled={isScanning}
                                        className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
                                    >
                                        {isScanning ? <><Loader2 className="w-4 h-4 animate-spin" /> Escaneando {scanProgress}%...</> : <><Sparkles className="w-4 h-4" /> Escanear con IA</>}
                                    </button>
                                </div>
                            ) : (
                                <button onClick={() => fileInputRef.current?.click()}
                                    className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                                        <Camera className="w-5 h-5 text-amber-600" />
                                    </div>
                                    <div className="text-left flex-1">
                                        <p className="font-black text-sm text-slate-800">Tomar foto de la factura</p>
                                        <p className="text-xs text-slate-400">Opcional · La IA puede leer los productos automáticamente</p>
                                    </div>
                                    <Plus className="w-4 h-4 text-slate-300 shrink-0" />
                                </button>
                            )}
                        </div>

                        {/* CTA */}
                        <button
                            onClick={() => setStep(3)}
                            className="w-full h-13 py-3.5 bg-slate-900 hover:bg-black text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-colors shadow-lg"
                        >
                            {newRecepcion.items.length > 0
                                ? <><Package className="w-4 h-4" /> Ver lista de productos ({newRecepcion.items.length})</>
                                : <><Plus className="w-4 h-4" /> Agregar productos</>
                            } <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* ─── PASO 3: LISTA DE PRODUCTOS (MODO RÁPIDO) ─────────── */}
                {step === 3 && (
                    <div className="space-y-3 animate-ag-slide-up">
                        {/* Buscador de producto + botón nuevo */}
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar producto para agregar..."
                                    value={busquedaProducto}
                                    onChange={e => { setBusquedaProducto(e.target.value); setMostrarDropProducto(true); }}
                                    onFocus={() => setMostrarDropProducto(true)}
                                    className="w-full h-11 pl-9 pr-4 rounded-xl border-2 border-indigo-100 focus:border-indigo-400 bg-white dark:bg-slate-800 font-bold text-sm outline-none transition-colors"
                                />
                                {/* Dropdown de sugerencias */}
                                {mostrarDropProducto && productosFiltradosAutocomplete.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden max-h-64 overflow-y-auto">
                                        {productosFiltradosAutocomplete.map(p => (
                                            <button
                                                key={p.id}
                                                onMouseDown={e => e.preventDefault()}
                                                onClick={() => {
                                                    handleAddItem(p.id);
                                                    setBusquedaProducto('');
                                                    setMostrarDropProducto(false);
                                                }}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 text-left transition-colors"
                                            >
                                                <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                                                    <Package className="w-3.5 h-3.5 text-indigo-600" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-black text-xs text-slate-800 truncate">{p.nombre}</p>
                                                    <p className="text-[9px] text-slate-400 font-bold">{p.categoria || 'Sin categoría'}{p.costoBase ? ` · ${formatCurrency(p.costoBase)}` : ''}</p>
                                                </div>
                                                <Plus className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => setIsProductModalOpen(true)}
                                className="h-11 px-3 rounded-xl border-2 border-dashed border-indigo-200 text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50 flex items-center gap-1.5 text-xs font-black transition-all shrink-0"
                            >
                                <Plus className="w-3.5 h-3.5" /> Nuevo
                            </button>
                        </div>

                        {/* Leyenda de columnas (solo desktop) */}
                        {newRecepcion.items.length > 0 && (
                            <div className="hidden md:grid grid-cols-[24px_1fr_auto_100px_32px_32px_80px_28px] gap-2 px-3 text-[9px] font-black uppercase text-slate-400 tracking-widest">
                                <span>#</span>
                                <span>Producto</span>
                                <span>Ant.</span>
                                <span className="text-center">Cantidad</span>
                                <span className="text-center">Prod</span>
                                <span className="text-center">Emb</span>
                                <span className="text-right">Subtotal</span>
                                <span />
                            </div>
                        )}

                        {/* Filas compactas */}
                        <div className="space-y-1.5" onClick={() => setMostrarDropProducto(false)}>
                            {newRecepcion.items.length === 0 ? (
                                <div className="py-12 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center gap-3 text-slate-400">
                                    <Package className="w-10 h-10 opacity-30" />
                                    <p className="text-sm font-bold">Busca arriba o toca para agregar productos</p>
                                </div>
                            ) : (
                                newRecepcion.items.map((item, idx) => {
                                    const prod = getProductoById(item.productoId);
                                    const precioAnt = prod?.costoBase || 0;
                                    const diff = precioAnt > 0 ? ((item.precioFacturado - precioAnt) / precioAnt) * 100 : 0;
                                    const subio = diff > 5;
                                    const bajo = diff < -2;
                                    return (
                                        <div key={item.id} className={cn(
                                            "flex flex-wrap md:flex-nowrap items-center gap-2 p-2.5 rounded-2xl border transition-all",
                                            subio ? "bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-800" :
                                            bajo ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800" :
                                            !item.productoOk || !item.embalajeOk ? "bg-amber-50 border-amber-200 dark:bg-amber-950/20" :
                                            "bg-white dark:bg-slate-800 border-slate-100 hover:border-indigo-200"
                                        )}>
                                            {/* Número */}
                                            <span className="w-6 text-xs font-black text-slate-400 text-center shrink-0">{idx + 1}</span>

                                            {/* Nombre + precio anterior */}
                                            <div className="flex-1 min-w-[110px]">
                                                <p className="font-black text-sm text-slate-800 dark:text-white truncate leading-tight">{prod?.nombre || '??'}</p>
                                                {precioAnt > 0 && (
                                                    <p className={cn("text-[9px] font-bold tabular-nums",
                                                        subio ? "text-rose-500" : bajo ? "text-emerald-600" : "text-slate-400"
                                                    )}>
                                                        Ant: {formatCurrency(precioAnt)}
                                                        {Math.abs(diff) > 2 && <span className="ml-1 font-black">{diff > 0 ? '▲' : '▼'}{Math.abs(diff).toFixed(0)}%</span>}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Precio */}
                                            <input
                                                type="number"
                                                value={item.precioFacturado || ''}
                                                onChange={e => handleUpdateItem(item.id, { precioFacturado: parseFloat(e.target.value) || 0 })}
                                                placeholder="Precio"
                                                className={cn(
                                                    "w-24 h-9 rounded-xl px-2 text-center font-black text-sm outline-none border transition-colors",
                                                    subio ? "bg-rose-100 border-rose-200 text-rose-700" :
                                                    bajo ? "bg-emerald-100 border-emerald-200 text-emerald-700" :
                                                    "bg-slate-50 border-slate-200"
                                                )}
                                            />

                                            {/* Stepper cantidad */}
                                            <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-xl overflow-hidden shrink-0">
                                                <button
                                                    onClick={() => handleUpdateItem(item.id, { cantidadRecibida: Math.max(0, item.cantidadRecibida - 1) })}
                                                    className="w-8 h-9 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 font-black transition-colors text-lg leading-none"
                                                >−</button>
                                                <input
                                                    type="number"
                                                    value={item.cantidadRecibida || ''}
                                                    onChange={e => handleUpdateItem(item.id, { cantidadRecibida: parseFloat(e.target.value) || 0 })}
                                                    className="w-10 h-9 bg-transparent text-center font-black text-sm outline-none"
                                                />
                                                <button
                                                    onClick={() => handleUpdateItem(item.id, { cantidadRecibida: item.cantidadRecibida + 1 })}
                                                    className="w-8 h-9 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 font-black transition-colors text-lg leading-none"
                                                >+</button>
                                            </div>

                                            {/* Producto OK */}
                                            <button
                                                onClick={() => handleUpdateItem(item.id, { productoOk: !item.productoOk })}
                                                className={cn(
                                                    "w-8 h-9 rounded-xl flex items-center justify-center font-black text-xs transition-all shrink-0",
                                                    item.productoOk ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-rose-100 text-rose-600 hover:bg-rose-200"
                                                )}
                                                title="Estado del producto"
                                            >
                                                {item.productoOk ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                                            </button>

                                            {/* Embalaje OK */}
                                            <button
                                                onClick={() => handleUpdateItem(item.id, { embalajeOk: !item.embalajeOk })}
                                                className={cn(
                                                    "w-8 h-9 rounded-xl flex items-center justify-center font-black text-xs transition-all shrink-0",
                                                    item.embalajeOk ? "bg-sky-100 text-sky-700 hover:bg-sky-200" : "bg-amber-100 text-amber-600 hover:bg-amber-200"
                                                )}
                                                title="Estado del embalaje"
                                            >
                                                <Package className="w-3.5 h-3.5" />
                                            </button>

                                            {/* Subtotal */}
                                            <span className="w-20 text-right font-black text-sm tabular-nums shrink-0 hidden sm:block">
                                                {item.precioFacturado > 0 && item.cantidadRecibida > 0
                                                    ? formatCurrency(item.cantidadRecibida * item.precioFacturado)
                                                    : '—'}
                                            </span>

                                            {/* Eliminar */}
                                            <button
                                                onClick={() => setNewRecepcion(p => ({ ...p, items: p.items.filter(i => i.id !== item.id) }))}
                                                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all shrink-0"
                                            ><X className="w-3.5 h-3.5" /></button>

                                            {/* Novedad expandida */}
                                            {(!item.productoOk || !item.embalajeOk) && (
                                                <input
                                                    placeholder={`Novedad: ${!item.productoOk ? 'producto' : ''}${!item.productoOk && !item.embalajeOk ? ' · ' : ''}${!item.embalajeOk ? 'embalaje' : ''}...`}
                                                    value={item.observaciones || ''}
                                                    onChange={e => handleUpdateItem(item.id, { observaciones: e.target.value })}
                                                    className="w-full h-8 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 px-3 text-xs font-bold outline-none col-span-full"
                                                />
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Barra inferior sticky con totales + CTA */}
                        {newRecepcion.items.length > 0 && (
                            <div className="sticky bottom-4 bg-indigo-600 text-white rounded-2xl p-4 flex items-center justify-between gap-4 shadow-xl shadow-indigo-600/30">
                                <div>
                                    <p className="text-[10px] font-black uppercase text-indigo-200">Total · {totalItems} prod · {totalUnidades} uds</p>
                                    <p className="text-xl font-black tabular-nums">{formatCurrency(totalDinero)}</p>
                                </div>
                                <div className="flex gap-2">
                                    <textarea
                                        value={newRecepcion.observaciones}
                                        onChange={e => setNewRecepcion(p => ({ ...p, observaciones: e.target.value }))}
                                        placeholder="Notas..."
                                        rows={1}
                                        className="hidden sm:block h-10 px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-xs placeholder:text-white/40 outline-none resize-none w-40"
                                    />
                                    <button
                                        onClick={() => { setPreciosAActualizar(new Set(cambiosPrecio.map(i => i.productoId))); setStep(4); }}
                                        className="h-10 px-5 bg-white text-indigo-600 hover:bg-indigo-50 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-colors"
                                    >
                                        Confirmar <ArrowRight className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* --- PASO 4: CONFIRMAR Y SINCRONIZAR --- */}
                {step === 4 && (
                    <div className="max-w-2xl mx-auto animate-ag-slide-up space-y-4 pb-8">

                        {/* Resumen de la recepción */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="h-1.5 bg-indigo-600" />
                            <div className="p-5 space-y-3">
                                <p className="text-[10px] font-black uppercase text-indigo-500 tracking-[0.2em]">Resumen de Recepción</p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Proveedor</span>
                                        <span className="font-black text-slate-800 truncate">{proveedorActual?.nombre ?? '—'}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Nº Factura</span>
                                        <span className="font-black text-slate-800">{newRecepcion.numeroFactura || <span className="text-slate-400 font-medium italic">Sin número</span>}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Fecha</span>
                                        <span className="font-black text-slate-800">{newRecepcion.fechaFactura ? new Date(newRecepcion.fechaFactura + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : new Date().toLocaleDateString('es-CO')}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Productos</span>
                                        <span className="font-black text-slate-800">{newRecepcion.items.length} ítems · {newRecepcion.items.reduce((s, i) => s + i.cantidadRecibida, 0)} uds</span>
                                    </div>
                                </div>
                                {/* Mini-lista de ítems */}
                                <div className="border-t border-slate-100 pt-3 space-y-1.5 max-h-40 overflow-y-auto">
                                    {newRecepcion.items.map((item, idx) => {
                                        const prod = getProductoById(item.productoId);
                                        return (
                                            <div key={idx} className="flex justify-between items-center text-xs">
                                                <div className="flex gap-2 items-center min-w-0">
                                                    <span className="font-black text-indigo-500 shrink-0">{item.cantidadRecibida}×</span>
                                                    <span className="font-semibold text-slate-700 truncate">{prod?.nombre ?? item.productoId}</span>
                                                </div>
                                                <span className="font-black tabular-nums text-slate-800 shrink-0 ml-2">{formatCurrency(item.cantidadRecibida * item.precioFacturado)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                                {/* Total */}
                                <div className="border-t border-indigo-100 pt-3 flex justify-between items-center">
                                    <span className="text-[10px] font-black uppercase text-indigo-500 tracking-widest">Total Facturado</span>
                                    <span className="text-2xl font-black tabular-nums text-indigo-600">{formatCurrency(totalDinero)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Cambios de precio detectados */}
                        {cambiosPrecio.length > 0 && (
                            <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
                                <div className="h-1.5 bg-amber-400" />
                                <div className="p-5 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-amber-500">⚠️</span>
                                            <p className="text-[10px] font-black uppercase text-amber-600 tracking-[0.2em]">Cambios de Precio Detectados</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setPreciosAActualizar(new Set(cambiosPrecio.map(i => i.productoId)))}
                                                className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                                            >Actualizar todos</button>
                                            <button
                                                onClick={() => setPreciosAActualizar(new Set())}
                                                className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                                            >No actualizar</button>
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-slate-500">Selecciona qué productos actualizan su costo base en el catálogo al confirmar.</p>
                                    <div className="space-y-2">
                                        {cambiosPrecio.map(item => {
                                            const prod = getProductoById(item.productoId);
                                            const costoBase = prod?.costoBase ?? 0;
                                            const diff = costoBase > 0 ? ((item.precioFacturado - costoBase) / costoBase) * 100 : 0;
                                            const subiendo = diff > 0;
                                            const checked = preciosAActualizar.has(item.productoId);
                                            return (
                                                <label
                                                    key={item.productoId}
                                                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${checked ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50 border border-slate-100'}`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={e => {
                                                            setPreciosAActualizar(prev => {
                                                                const next = new Set(prev);
                                                                if (e.target.checked) next.add(item.productoId);
                                                                else next.delete(item.productoId);
                                                                return next;
                                                            });
                                                        }}
                                                        className="w-4 h-4 rounded accent-amber-500 shrink-0"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-black text-slate-800 truncate">{prod?.nombre ?? item.productoId}</p>
                                                        <p className="text-[10px] text-slate-500 tabular-nums">
                                                            {formatCurrency(costoBase)} → <span className={`font-black ${subiendo ? 'text-rose-600' : 'text-emerald-600'}`}>{formatCurrency(item.precioFacturado)}</span>
                                                        </p>
                                                    </div>
                                                    <span className={`text-[11px] font-black shrink-0 px-2 py-0.5 rounded-lg ${subiendo ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                        {subiendo ? '▲' : '▼'} {Math.abs(diff).toFixed(1)}%
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Notas finales */}
                        {newRecepcion.observaciones && (
                            <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4">
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Notas</p>
                                <p className="text-xs text-slate-600">{newRecepcion.observaciones}</p>
                            </div>
                        )}

                        {/* Acciones */}
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setStep(3)}
                                className="h-14 rounded-2xl font-black uppercase tracking-widest text-sm border-2 border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors"
                            >← Corregir</button>
                            <button
                                onClick={handleSave}
                                className="h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-sm shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 transition-colors"
                            >
                                <CheckCircle className="w-4 h-4" /> Confirmar y Sincronizar
                            </button>
                        </div>
                    </div>
                )}
                
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

                {/* File Input Oculto */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleImageUpload}
                />
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
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tasa de Incidencia</p>
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
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Auditoría Pendiente</p>
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
                        <p className="text-xs text-muted-foreground uppercase font-black tracking-widest leading-none mt-1">Scanner Forense & Control de Stock v5.1</p>
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
