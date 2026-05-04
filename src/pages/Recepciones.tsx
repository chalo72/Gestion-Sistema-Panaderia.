import { useState, useMemo, useRef, useEffect } from 'react';
import { useCan, useAuth } from '@/contexts/AuthContext';
import {
    Upload, CheckCircle, X, Plus, Calendar,
    Search, Eye, Download, Image as ImageIcon,
    ArrowLeft, Package, GitCompareArrows, AlertTriangle,
    TrendingUp, TrendingDown, Scan, Sparkles, Loader2,
    Camera, Zap, FileText, Check, FolderOpen, Grid3X3,
    Trash2, ZoomIn, Filter, CalendarRange,
    Fingerprint, Activity, Cpu, Layers, Database, History, Bot
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
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
            id: crypto.randomUUID(),
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

    // Estado para nueva recepción
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
    // Ref para guardar el File original (necesario para OCR real)
    const imagenFileRef = useRef<File | null>(null);

    // === ESTADO PARA WIZARD (FLUJO GUIADO) ===
    const [step, setStep] = useState(1);
    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);
    const [scanStep, setScanStep] = useState('');

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

    // === FUNCIÓN DE ESCANEO OCR REAL (Tesseract.js) ===
    const handleScanFactura = async () => {
        if (!imagenFileRef.current) {
            toast.error('Primero sube una foto de la factura');
            return;
        }

        setIsScanning(true);
        setScanProgress(0);
        setScanStep('Leyendo información...');
        console.log("DULCE PLACER: Iniciando lectura de imagen...", imagenFileRef.current.name);

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
                    console.log(`[OCR Forense] Proveedor: "${resultado.proveedor.nombre}" → "${proveedores[mProv.indice].nombre}" (score: ${(mProv.score * 100).toFixed(0)}%)`);
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
                    console.log(`[OCR Forense] Match "${prod.nombre}" → "${productoReal.nombre}" (${match.metodo} ${(match.score * 100).toFixed(0)}%)`);

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
                        id: crypto.randomUUID(),
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

        const itemsDesdePrePedido: RecepcionItem[] = pedido.items.map(item => ({
            id: crypto.randomUUID(),
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
            id: crypto.randomUUID(),
            productoId,
            cantidadEsperada: 0,
            cantidadRecibida: 1,
            precioEsperado: 0,
            precioFacturado: 0,
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
                        <p>✓ Precios de costo actualizados</p>
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

    if (view === 'new') {
        const totalItems = newRecepcion.items.length;
        const totalUnidades = newRecepcion.items.reduce((s, i) => s + i.cantidadRecibida, 0);
        const totalDinero = newRecepcion.items.reduce((s, i) => s + (i.cantidadRecibida * i.precioFacturado), 0);

        return (
            <div className="space-y-6 animate-ag-fade-in pb-24">
                {/* Cabecera con Pasos */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-slate-900 p-6 rounded-[2rem] border shadow-sm">
                    <div className="flex items-center gap-4">
                        <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => {
                                if (step > 1) setStep(step - 1);
                                else setView('list');
                            }} 
                            className="rounded-full bg-slate-100 hover:bg-slate-200"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-black uppercase tracking-tighter">Entrada de Mercancía</h1>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                Paso {step} de 4: {
                                    step === 1 ? 'Quién trae la mercancía' :
                                    step === 2 ? 'Información de factura' :
                                    step === 3 ? 'Lista de productos' : 'Confirmar entrada'
                                }
                            </p>
                        </div>
                    </div>

                    {/* Indicador visual de pasos */}
                    <div className="flex items-center gap-2">
                        {[1, 2, 3, 4].map((s) => (
                            <div 
                                key={s} 
                                className={cn(
                                    "h-2 rounded-full transition-all duration-500",
                                    step === s ? "w-8 bg-indigo-600" : 
                                    step > s ? "w-4 bg-emerald-500" : "w-4 bg-slate-200"
                                )}
                            />
                        ))}
                    </div>
                </div>

                {/* --- PASO 1: SELECCIONAR PROVEEDOR --- */}
                {step === 1 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-ag-fade-in">
                        <div className="space-y-6">
                            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">¿Quién trae la mercancía hoy?</h2>
                            
                            {/* Favoritos / Frecuentes */}
                            <div className="grid grid-cols-2 gap-4">
                                {proveedores.slice(0, 4).map(p => (
                                    <button 
                                        key={p.id}
                                        onClick={() => {
                                            setNewRecepcion(prev => ({ ...prev, proveedorId: p.id }));
                                            setStep(2);
                                        }}
                                        className={cn(
                                            "p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-3 group",
                                            newRecepcion.proveedorId === p.id 
                                                ? "border-indigo-500 bg-indigo-50/50 shadow-lg" 
                                                : "border-slate-100 hover:border-indigo-200 bg-white hover:shadow-md"
                                        )}
                                    >
                                        <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <Package className="w-8 h-8 text-indigo-600" />
                                        </div>
                                        <span className="font-black text-sm text-center line-clamp-1">{p.nombre}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-2 p-6 rounded-[2rem] bg-slate-50 border border-slate-200">
                                <Label className="text-[11px] font-black uppercase text-slate-400">O busca otro de la lista:</Label>
                                <select
                                    className="w-full h-14 p-4 rounded-xl border-none shadow-sm font-bold text-lg outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={newRecepcion.proveedorId}
                                    onChange={e => {
                                        setNewRecepcion(prev => ({ ...prev, proveedorId: e.target.value }));
                                        if (e.target.value) setStep(2);
                                    }}
                                >
                                    <option value="">Seleccionar de toda la lista...</option>
                                    {proveedores.map(p => (
                                        <option key={p.id} value={p.id}>{p.nombre}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="bg-indigo-600 text-white p-8 rounded-[3rem] shadow-2xl shadow-indigo-500/30 flex flex-col justify-between overflow-hidden relative">
                            <Bot className="absolute -right-10 -top-10 w-48 h-48 opacity-10 rotate-12" />
                            <div className="space-y-4">
                                <Badge className="bg-indigo-400/30 text-white border-none text-[10px] font-black uppercase tracking-widest px-3">Asistente Inteligente</Badge>
                                <h3 className="text-3xl font-black leading-tight tracking-tight">Hola Jefe, seleccionemos el proveedor para registrar lo que llega.</h3>
                                <p className="text-indigo-100 text-sm">Esto ayuda a mantener los precios de costo actualizados automáticamente.</p>
                            </div>
                            <div className="pt-8">
                                <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-200 mb-2">Consejo Dulce Placer</p>
                                    <p className="text-xs">Si el proveedor es nuevo, puedes registrarlo después en el menú lateral.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- PASO 2: FACTURA O MODALIDAD --- */}
                {step === 2 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-ag-slide-up">
                        <div className="space-y-6">
                            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">¿Trajeron factura impresa?</h2>
                            
                            <div className="grid grid-cols-1 gap-4">
                                <Card 
                                    className={cn(
                                        "cursor-pointer hover:border-amber-400 border-2 transition-all overflow-hidden",
                                        newRecepcion.imagenFactura ? "border-amber-400 bg-amber-50" : "border-slate-100"
                                    )}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <CardContent className="p-8 flex items-center gap-6">
                                        <div className="w-20 h-20 rounded-[2rem] bg-amber-100 flex items-center justify-center shrink-0">
                                            <Camera className="w-10 h-10 text-amber-600" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-black text-lg text-slate-900">SÍ, Tomar Foto</h4>
                                            <p className="text-sm text-slate-500">Ahorra tiempo: yo leo los productos por ti usando la cámara.</p>
                                        </div>
                                        {newRecepcion.imagenFactura && <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white"><Check size={20} /></div>}
                                    </CardContent>
                                </Card>

                                <Card 
                                    className="cursor-pointer hover:border-indigo-400 border-2 transition-all"
                                    onClick={() => setStep(3)}
                                >
                                    <CardContent className="p-8 flex items-center gap-6">
                                        <div className="w-20 h-20 rounded-[2rem] bg-indigo-100 flex items-center justify-center shrink-0">
                                            <ClipboardList className="w-10 h-10 text-indigo-600" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-black text-lg text-slate-900">NO, Ingreso Manual</h4>
                                            <p className="text-sm text-slate-500">Perfecto para una entrada rápida de pocos productos.</p>
                                        </div>
                                        <ArrowRight className="w-6 h-6 text-slate-300" />
                                    </CardContent>
                                </Card>
                            </div>

                            {newRecepcion.imagenFactura && (
                                <div className="p-6 rounded-[2rem] bg-indigo-50 border-2 border-indigo-200 animate-ag-fade-in space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase text-indigo-500">Foto de Factura Detectada</span>
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            onClick={(e) => { e.stopPropagation(); setNewRecepcion(p => ({ ...p, imagenFactura: null })); }}
                                            className="h-6 text-rose-500 hover:bg-rose-50"
                                        >Eliminar</Button>
                                    </div>
                                    <div className="aspect-video rounded-xl overflow-hidden border">
                                        <img src={newRecepcion.imagenFactura} className="w-full h-full object-cover" alt="Factura" />
                                    </div>
                                    <Button 
                                        onClick={handleScanFactura} 
                                        disabled={isScanning}
                                        className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-indigo-600/30"
                                    >
                                        {isScanning ? (
                                            <div className="flex items-center gap-3">
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Leída al {scanProgress}%...
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-3">
                                                <Sparkles className="w-5 h-5" />
                                                ¡Escanear Ahora!
                                            </div>
                                        )}
                                    </Button>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Número Factura</Label>
                                    <Input 
                                        value={newRecepcion.numeroFactura}
                                        onChange={e => setNewRecepcion(p => ({ ...p, numeroFactura: e.target.value }))}
                                        placeholder="Escribe el número aquí"
                                        className="h-12 rounded-xl bg-slate-50 border-none font-bold"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Fecha Factura</Label>
                                    <Input 
                                        type="date"
                                        value={newRecepcion.fechaFactura}
                                        onChange={e => setNewRecepcion(p => ({ ...p, fechaFactura: e.target.value }))}
                                        className="h-12 rounded-xl bg-slate-50 border-none font-bold"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Comparación Pre-Pedido */}
                        <div className="space-y-6">
                            {prepedidosConfirmados.some(p => p.proveedorId === newRecepcion.proveedorId) && (
                                <div className="p-8 rounded-[3rem] bg-blue-600 text-white shadow-xl space-y-6">
                                    <div>
                                        <Badge className="bg-blue-400/50 border-none mb-3">Auditoría Activa</Badge>
                                        <h3 className="text-2xl font-black leading-tight">Tienes un pedido pendiente con este proveedor.</h3>
                                        <p className="text-blue-100 text-sm mt-2">¿Quieres cargarlo para comparar si trajeron lo que pediste?</p>
                                    </div>
                                    <div className="space-y-3">
                                        {prepedidosConfirmados.filter(p => p.proveedorId === newRecepcion.proveedorId).map(p => (
                                            <Button 
                                                key={p.id}
                                                variant="outline"
                                                onClick={() => handleVincularPrePedido(p.id)}
                                                className="w-full h-14 bg-white/10 hover:bg-white/20 border-white/30 text-white justify-between px-6 rounded-2xl"
                                            >
                                                <div className="text-left font-black">
                                                    <p className="text-xs uppercase opacity-80">{p.nombre}</p>
                                                    <p className="text-lg">{formatCurrency(p.total)}</p>
                                                </div>
                                                <GitCompareArrows className="w-6 h-6" />
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            <Button 
                                onClick={() => setStep(3)}
                                disabled={!newRecepcion.numeroFactura && !newRecepcion.imagenFactura}
                                className="w-full h-16 bg-slate-900 hover:bg-black text-white rounded-[2rem] font-black text-lg uppercase tracking-tighter shadow-2xl transition-all hover:scale-[1.02]"
                            >
                                Siguiente Paso <ArrowRight className="ml-2 w-6 h-6" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* --- PASO 3: LISTA DE PRODUCTOS --- */}
                {step === 3 && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-ag-slide-up">
                        <div className="lg:col-span-2 space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                    Lista de Mercancía 
                                    <Badge className="bg-indigo-100 text-indigo-600 border-none">{newRecepcion.items.length} productos</Badge>
                                </h2>
                                <div className="flex gap-2">
                                    <select
                                        className="h-12 p-3 rounded-xl border-2 border-indigo-100 bg-white font-bold text-sm min-w-[200px]"
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                handleAddItem(e.target.value);
                                                e.target.value = '';
                                            }
                                        }}
                                    >
                                        <option value="">+ Añadir Producto</option>
                                        {productos.sort((a,b)=>a.nombre.localeCompare(b.nombre)).map(p => (
                                            <option key={p.id} value={p.id}>{p.nombre}</option>
                                        ))}
                                    </select>
                                    <Button 
                                        variant="outline" 
                                        onClick={() => setIsProductModalOpen(true)}
                                        className="h-12 px-4 rounded-xl border-2 border-indigo-100 text-indigo-600 font-black uppercase text-[10px]"
                                    >Nuevo Producto</Button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {newRecepcion.items.length === 0 ? (
                                    <div className="p-16 border-4 border-dashed rounded-[3rem] bg-slate-50 text-center space-y-4">
                                        <div className="w-20 h-20 rounded-[2rem] bg-white shadow-sm flex items-center justify-center mx-auto">
                                            <Package className="w-10 h-10 text-slate-300" />
                                        </div>
                                        <p className="font-bold text-slate-500 uppercase tracking-widest text-sm">Empieza agregando lo que llegó</p>
                                    </div>
                                ) : (
                                    newRecepcion.items.map((item) => {
                                        const prod = getProductoById(item.productoId);
                                        const inflacion = prod?.costoBase ? ((item.precioFacturado / prod.costoBase) - 1) * 100 : 0;
                                        return (
                                            <Card key={item.id} className="p-6 border-2 rounded-[2rem] hover:shadow-xl transition-all group overflow-hidden relative">
                                                {inflacion > 5 && <div className="absolute top-0 right-0 p-2 bg-rose-500 text-white font-black text-[9px] px-3 rounded-bl-xl uppercase tracking-tighter animate-pulse">¡Subió de Precio!</div>}
                                                <div className="flex flex-col md:flex-row gap-6">
                                                    <div className="flex-1 space-y-4">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center font-black text-indigo-600">
                                                                    {newRecepcion.items.indexOf(item) + 1}
                                                                </div>
                                                                <h4 className="font-black text-lg text-slate-900 dark:text-slate-100 uppercase tracking-tighter">{prod?.nombre}</h4>
                                                            </div>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                onClick={() => setNewRecepcion(p => ({ ...p, items: p.items.filter(i => i.id !== item.id) }))}
                                                                className="rounded-full text-slate-300 hover:text-rose-500 hover:bg-rose-50"
                                                            >
                                                                <X className="w-5 h-5" />
                                                            </Button>
                                                        </div>

                                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                            <div className="space-y-1.5">
                                                                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">¿Cuánto llegó?</Label>
                                                                <Input 
                                                                    type="number"
                                                                    value={item.cantidadRecibida || ''}
                                                                    onChange={e => handleUpdateItem(item.id, { cantidadRecibida: parseFloat(e.target.value) || 0 })}
                                                                    className="h-12 rounded-xl bg-slate-50 border-none font-black text-lg text-center"
                                                                />
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Precio Unitario</Label>
                                                                <Input 
                                                                    type="number"
                                                                    value={item.precioFacturado || ''}
                                                                    onChange={e => handleUpdateItem(item.id, { precioFacturado: parseFloat(e.target.value) || 0 })}
                                                                    className={cn(
                                                                        "h-12 rounded-xl border-none font-black text-lg text-center",
                                                                        inflacion > 5 ? "bg-rose-100 text-rose-700" : "bg-emerald-50 text-emerald-700"
                                                                    )}
                                                                />
                                                            </div>
                                                            <div className="flex flex-col justify-end">
                                                                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 mb-1.5 text-center">Revisión Física</Label>
                                                                <div className="flex gap-2 h-12">
                                                                    <button 
                                                                        onClick={() => handleUpdateItem(item.id, { productoOk: !item.productoOk })}
                                                                        className={cn(
                                                                            "flex-1 rounded-xl flex items-center justify-center transition-all",
                                                                            item.productoOk ? "bg-emerald-500 text-white shadow-lg" : "bg-slate-100 text-slate-400"
                                                                        )}
                                                                    ><Check size={20} /></button>
                                                                    <button 
                                                                        onClick={() => handleUpdateItem(item.id, { productoOk: !item.productoOk })}
                                                                        className={cn(
                                                                            "flex-1 rounded-xl flex items-center justify-center transition-all",
                                                                            !item.productoOk ? "bg-rose-500 text-white shadow-lg" : "bg-slate-100 text-slate-400"
                                                                        )}
                                                                    ><AlertTriangle size={20}/></button>
                                                                </div>
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Subtotal</Label>
                                                                <div className="h-12 rounded-xl bg-slate-900 flex items-center justify-center font-black text-white text-md">
                                                                    {formatCurrency(item.cantidadRecibida * item.precioFacturado)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {!item.productoOk && (
                                                            <div className="animate-ag-fade-in">
                                                                <Input 
                                                                    placeholder="Escribe aquí la novedad (ej: faltante, dañado)..."
                                                                    value={item.observaciones || ''}
                                                                    onChange={e => handleUpdateItem(item.id, { observaciones: e.target.value })}
                                                                    className="h-10 rounded-xl bg-rose-50 border-rose-100 text-rose-600 text-xs font-bold"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </Card>
                                        )
                                    })
                                )}
                            </div>
                        </div>

                        <div className="space-y-6">
                            <Card className="p-8 rounded-[3rem] bg-indigo-600 text-white shadow-2xl border-none h-fit">
                                <CardHeader className="p-0 mb-6">
                                    <h3 className="text-2xl font-black uppercase tracking-tighter">Resumen Actual</h3>
                                </CardHeader>
                                <CardContent className="p-0 space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 rounded-3xl bg-white/10 flex flex-col items-center">
                                            <span className="text-[10px] font-black uppercase text-indigo-200">Productos</span>
                                            <span className="text-3xl font-black">{totalItems}</span>
                                        </div>
                                        <div className="p-4 rounded-3xl bg-white/10 flex flex-col items-center">
                                            <span className="text-[10px] font-black uppercase text-indigo-200">Unidades</span>
                                            <span className="text-3xl font-black">{totalUnidades}</span>
                                        </div>
                                    </div>
                                    <div className="p-6 rounded-3xl bg-white/10 border border-white/20 text-center">
                                        <span className="text-[10px] font-black uppercase text-indigo-200 block mb-1">Inversión Total</span>
                                        <span className="text-4xl font-black tabular-nums">{formatCurrency(totalDinero)}</span>
                                    </div>
                                    <div className="space-y-3 pt-4">
                                        <Label className="text-[10px] font-black uppercase text-indigo-200 ml-1">Notas de Recepción</Label>
                                        <textarea
                                            value={newRecepcion.observaciones}
                                            onChange={e => setNewRecepcion(p => ({ ...p, observaciones: e.target.value }))}
                                            placeholder="Cualquier aclaración sobre la entrega..."
                                            className="w-full min-h-[100px] p-4 rounded-2xl bg-white/10 border border-white/20 text-sm placeholder:text-white/40 outline-none"
                                        />
                                    </div>
                                    <Button 
                                        onClick={() => setStep(4)}
                                        disabled={newRecepcion.items.length === 0}
                                        className="w-full h-16 bg-white text-indigo-600 hover:bg-indigo-50 rounded-[2rem] font-black text-lg uppercase tracking-tighter shadow-xl transition-all"
                                    >
                                        Siguiente Paso <ArrowRight className="ml-2 w-6 h-6" />
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}

                {/* --- PASO 4: CONFIRMAR TICKET --- */}
                {step === 4 && (
                    <div className="max-w-2xl mx-auto animate-ag-slide-up">
                        <Card className="rounded-[3rem] border-4 border-indigo-50 bg-white overflow-hidden shadow-2xl relative">
                            <div className="absolute top-0 left-0 right-0 h-4 bg-indigo-600"></div>
                            <CardHeader className="text-center p-12 pb-6">
                                <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-6 text-indigo-600">
                                    <CheckCircle size={48} />
                                </div>
                                <h3 className="text-3xl font-black uppercase tracking-tighter text-slate-900">Confirmar Recibo</h3>
                                <p className="text-sm text-slate-500 font-medium">Revisa que todo esté correcto antes de guardar en el inventario.</p>
                            </CardHeader>

                            <CardContent className="p-12 pt-0 space-y-8">
                                <div className="space-y-4 p-8 rounded-[2rem] bg-slate-50 border border-slate-100">
                                    <div className="flex justify-between items-center text-sm border-b border-slate-200 pb-3">
                                        <span className="font-bold text-slate-400 uppercase tracking-widest">Proveedor</span>
                                        <span className="font-black text-slate-800">{proveedores.find(p => p.id === newRecepcion.proveedorId)?.nombre}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm border-b border-slate-200 pb-3">
                                        <span className="font-bold text-slate-400 uppercase tracking-widest">Nº Factura</span>
                                        <span className="font-black text-slate-800">{newRecepcion.numeroFactura || 'Ingreso Rápido'}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="font-bold text-slate-400 uppercase tracking-widest">Fecha Recibido</span>
                                        <span className="font-black text-slate-800">{new Date().toLocaleDateString('es-CO')}</span>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <span className="text-[10px] font-black uppercase text-indigo-500 tracking-[0.2em] ml-2">Resumen de Mercancía</span>
                                    <div className="space-y-2">
                                        {newRecepcion.items.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center p-3 px-4 bg-slate-50 rounded-xl">
                                                <div className="flex gap-2 items-center">
                                                    <span className="text-[10px] font-black text-indigo-600">{item.cantidadRecibida}x</span>
                                                    <span className="text-xs font-bold uppercase truncate max-w-[200px]">{getProductoById(item.productoId)?.nombre}</span>
                                                </div>
                                                <span className="text-xs font-black tabular-nums">{formatCurrency(item.cantidadRecibida * item.precioFacturado)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="p-8 rounded-[2.5rem] bg-indigo-600 text-white text-center shadow-xl">
                                    <span className="text-[11px] font-black uppercase text-indigo-200 tracking-[0.3em] block mb-2">Total Facturado</span>
                                    <span className="text-4xl font-black tabular-nums">{formatCurrency(totalDinero)}</span>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <Button 
                                        variant="outline" 
                                        onClick={() => setStep(3)}
                                        className="h-16 rounded-2xl font-black uppercase tracking-widest border-2 border-slate-200 hover:bg-slate-50 text-slate-500"
                                    >Corregir</Button>
                                    <Button 
                                        onClick={handleSave}
                                        className="h-16 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest shadow-xl shadow-indigo-600/30"
                                    >Confirmar Todo</Button>
                                </div>
                            </CardContent>
                        </Card>
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

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredRecepciones.map(recepcion => {
                        const proveedor = getProveedorById(recepcion.proveedorId);
                        const itemsCount = recepcion.items.reduce((s, i) => s + i.cantidadRecibida, 0);
                        const hasIssues = recepcion.items.some(i => !i.productoOk || !i.embalajeOk || i.defectuosos > 0);

                        return (
                            <Card
                                key={recepcion.id}
                                className="group hover:scale-[1.02] transition-all cursor-pointer overflow-hidden border-l-4 border-l-primary"
                                onClick={() => { setSelectedRecepcion(recepcion); setView('details'); }}
                            >
                                <CardContent className="p-0">
                                    <div className="p-4 space-y-3">
                                        <div className="flex justify-between items-start">
                                            <Badge variant="outline" className="bg-background/50">
                                                {recepcion.numeroFactura}
                                            </Badge>
                                            <Badge className={`${hasIssues ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'} hover:bg-white`}>
                                                {hasIssues ? 'Incidencias' : 'OK'}
                                            </Badge>
                                        </div>

                                        <div>
                                            <h3 className="font-semibold text-lg line-clamp-1">{proveedor?.nombre || 'Desconocido'}</h3>
                                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(recepcion.fechaRecepcion).toLocaleDateString()}
                                            </p>
                                        </div>

                                        {recepcion.imagenFactura && (
                                            <div className="relative h-24 bg-muted/30 rounded-lg overflow-hidden group-hover:bg-muted/50 transition-colors flex items-center justify-center">
                                                <img src={recepcion.imagenFactura} className="w-full h-full object-cover opacity-50 blur-[1px] group-hover:blur-0 transition-all" />
                                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Eye className="w-6 h-6 text-foreground drop-shadow-md" />
                                                </div>
                                            </div>
                                        )}

                                        <div className="pt-3 border-t flex justify-between items-center text-sm">
                                            <span className="text-muted-foreground">{itemsCount} items</span>
                                            <span className="font-bold text-primary">{formatCurrency(recepcion.totalFactura)}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}

                    {filteredRecepciones.length === 0 && (
                        <div className="col-span-full py-12 text-center text-muted-foreground">
                            No se encontraron recepciones
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
