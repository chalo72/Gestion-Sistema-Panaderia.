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
import { procesarImagenFactura } from '@/lib/ocr-service';

interface RecepcionesProps {
    recepciones: Recepcion[];
    proveedores: Proveedor[];
    productos: Producto[];
    prepedidos: PrePedido[];
    onAddRecepcion: (data: Omit<Recepcion, 'id'>) => Promise<Recepcion>;
    onConfirmarRecepcion: (recepcion: Recepcion) => Promise<void>;
    getProveedorById: (id: string) => Proveedor | undefined;
    getProductoById: (id: string) => Producto | undefined;
    formatCurrency: (value: number) => string;
}

export default function Recepciones({
    recepciones,
    proveedores,
    productos,
    prepedidos,
    onAddRecepcion,
    onConfirmarRecepcion,
    getProveedorById,
    getProductoById,
    formatCurrency,
    onUpdateProductoBase
}: RecepcionesProps) {
    const { check } = useCan();
    const { usuario } = useAuth();
    const [view, setView] = useState<'list' | 'new' | 'details' | 'galeria'>('list');
    const [selectedRecepcion, setSelectedRecepcion] = useState<Recepcion | null>(null);
    const [busqueda, setBusqueda] = useState('');
    const [proveedorFiltro, setProveedorFiltro] = useState<string>('todos');
    const [prePedidoSeleccionado, setPrePedidoSeleccionado] = useState<string>('');

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

    // === ESTADO PARA ESCANEO OCR ===
    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);
    const [scanStep, setScanStep] = useState('');

    // === FUNCIÓN DE ESCANEO OCR REAL (Tesseract.js) ===
    const handleScanFactura = async () => {
        if (!imagenFileRef.current) {
            toast.error('Primero sube una imagen de la factura');
            return;
        }

        setIsScanning(true);
        setScanProgress(0);
        setScanStep('Mapeando estructura forense...');
        console.log("ANTIGRAVITY: Iniciando escaneo forense de imagen...", imagenFileRef.current.name);

        try {
            const resultado = await procesarImagenFactura(
                imagenFileRef.current,
                (progreso) => {
                    setScanProgress(progreso);
                    if (progreso < 30) setScanStep('Preparando buffer de imagen...');
                    else if (progreso < 60) setScanStep('Detectando patrones de factura...');
                    else if (progreso < 85) setScanStep('Analizando descriptores de productos...');
                    else setScanStep('Finalizando auditoría digital...');
                }
            );

            console.log("ANTIGRAVITY: Resultado OCR crudo:", resultado);

            // Buscar proveedor real por nombre si OCR detectó uno
            const proveedorMatch = resultado.proveedor
                ? proveedores.find(p =>
                    p.nombre.toLowerCase().includes(
                        resultado.proveedor!.nombre.toLowerCase().trim().substring(0, 5)
                    ) ||
                    resultado.proveedor!.nombre.toLowerCase().includes(p.nombre.toLowerCase().trim().substring(0, 5))
                )
                : undefined;

            console.log("ANTIGRAVITY: Proveedor detectado:", proveedorMatch?.nombre || "Ninguno coincidente");

            // Convertir productos detectados por OCR a items de recepción con lógica de fuzzy matching mejorada
            const itemsEscaneados: RecepcionItem[] = resultado.productos
                .map(prod => {
                    // Buscar producto real en la lista por nombre similar (más flexible)
                    const prodNombreLimpio = prod.nombre.toLowerCase().trim();
                    const productoReal = productos.find(p => {
                        const pNombreLimpio = p.nombre.toLowerCase().trim();
                        return pNombreLimpio.includes(prodNombreLimpio.substring(0, 5)) ||
                               prodNombreLimpio.includes(pNombreLimpio.substring(0, 5));
                    });

                    if (!productoReal) {
                        console.warn(`ANTIGRAVITY: No se encontró coincidencia para "${prod.nombre}"`);
                        return null;
                    }

                    console.log(`ANTIGRAVITY: Coincidencia encontrada: ${prod.nombre} -> ${productoReal.nombre}`);
                    
                    return {
                        id: crypto.randomUUID(),
                        productoId: productoReal.id,
                        cantidadEsperada: prod.cantidad || 1,
                        cantidadRecibida: prod.cantidad || 1,
                        precioEsperado: prod.precioUnitario || productoReal.costoBase || 0,
                        precioFacturado: prod.precioUnitario || productoReal.costoBase || 0,
                        embalajeOk: true,
                        productoOk: true,
                        cantidadOk: true,
                        modeloOk: true,
                        defectuosos: 0,
                        observaciones: ''
                    };
                })
                .filter((item): item is RecepcionItem => item !== null);

            const numFactura = resultado.numeroFactura || `F-${Date.now().toString().slice(-6)}`;

            setNewRecepcion(prev => ({
                ...prev,
                proveedorId: proveedorMatch?.id || prev.proveedorId,
                numeroFactura: numFactura,
                fechaFactura: resultado.fechaFactura || prev.fechaFactura,
                items: itemsEscaneados.length > 0 ? [...prev.items, ...itemsEscaneados] : prev.items
            }));

            setScanProgress(100);
            setScanStep('Análisis completado con éxito');

            if (itemsEscaneados.length === 0) {
                toast.warning('OCR finalizado — se leyó el texto pero no se detectaron productos que ya existan en tu catálogo.', {
                    duration: 6000,
                    description: 'Puedes agregar los productos manualmente o revisar la ortografía en el catálogo.'
                });
            } else {
                toast.success(
                    <div className="flex flex-col gap-1">
                        <span className="font-semibold text-emerald-700">✨ Scanner Forense Exitoso</span>
                        <span className="text-[10px] text-muted-foreground uppercase font-black">
                            {itemsEscaneados.length} productos detectados • {proveedorMatch?.nombre || 'Proveedor por definir'}
                        </span>
                    </div>,
                    { icon: <Bot className="w-5 h-5 text-indigo-500" /> }
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
                toast.success("Imagen cargada. Iniciando análisis forense...", {
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
            const total = newRecepcion.items.reduce((sum, item) => sum + (item.cantidadRecibida * item.precioFacturado), 0);

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
        return (
            <div className="space-y-6 animate-ag-fade-in pb-12">
                <div className="flex items-center gap-4 mb-6">
                    <Button variant="ghost" onClick={() => setView('list')} className="gap-2">
                        <ArrowLeft className="w-4 h-4" /> Volver
                    </Button>
                    <h1 className="text-2xl font-bold">Nueva Recepción</h1>
                </div>

                {/* Selector de Pre-Pedido */}
                {prepedidosConfirmados.length > 0 && (
                    <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <GitCompareArrows className="w-5 h-5 text-primary" />
                                <div className="flex-1">
                                    <Label className="text-sm font-semibold">Vincular a Pre-Pedido</Label>
                                    <p className="text-xs text-muted-foreground">Selecciona un pedido para comparar lo pedido vs lo recibido</p>
                                </div>
                                <select
                                    className="w-64 p-2 rounded-md border bg-background text-sm"
                                    value={prePedidoSeleccionado}
                                    onChange={(e) => handleVincularPrePedido(e.target.value)}
                                >
                                    <option value="">Sin vincular (recepción libre)</option>
                                    {prepedidosConfirmados.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.nombre} — {getProveedorById(p.proveedorId)?.nombre} ({formatCurrency(p.total)})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Datos Generales */}
                    <Card className="lg:col-span-1 h-fit">
                        <CardHeader>
                            <CardTitle>Datos de Factura</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Proveedor</Label>
                                <select
                                    className="w-full p-2 rounded-md border bg-background"
                                    value={newRecepcion.proveedorId}
                                    onChange={e => setNewRecepcion(prev => ({ ...prev, proveedorId: e.target.value }))}
                                >
                                    <option value="">Seleccionar Proveedor</option>
                                    {proveedores.map(p => (
                                        <option key={p.id} value={p.id}>{p.nombre}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label>Nº Factura</Label>
                                <Input
                                    value={newRecepcion.numeroFactura}
                                    onChange={e => setNewRecepcion(prev => ({ ...prev, numeroFactura: e.target.value }))}
                                    placeholder="F-12345"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Fecha Factura</Label>
                                <Input
                                    type="date"
                                    value={newRecepcion.fechaFactura}
                                    onChange={e => setNewRecepcion(prev => ({ ...prev, fechaFactura: e.target.value }))}
                                />
                            </div>

                            {/* Carga de Imagen con OCR */}
                            <div className="space-y-3 pt-4 border-t">
                                <div className="flex items-center justify-between">
                                    <Label className="flex items-center gap-2">
                                        <Camera className="w-4 h-4" />
                                        Escaneo de Factura
                                    </Label>
                                    {newRecepcion.imagenFactura && !isScanning && (
                                        <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">
                                            <Check className="w-3 h-3 mr-1" /> Imagen lista
                                        </Badge>
                                    )}
                                </div>
                                
                                <div
                                    className={`border-2 border-dashed rounded-xl p-4 text-center transition-all cursor-pointer
                                        ${newRecepcion.imagenFactura 
                                            ? 'border-emerald-300 bg-emerald-50/50' 
                                            : 'border-primary/30 hover:border-primary hover:bg-primary/5'}`}
                                    onClick={() => !isScanning && fileInputRef.current?.click()}
                                >
                                    {/* Preview Imagen Forense (Volt-Pixel) */}
                                    {newRecepcion.imagenFactura && (
                                        <div className="space-y-3">
                                            <div className="relative group rounded-2xl overflow-hidden border-2 border-indigo-500/20 shadow-xl bg-slate-900 aspect-[3/4]">
                                                <img 
                                                    src={newRecepcion.imagenFactura} 
                                                    className="w-full h-full object-contain" 
                                                    alt="Factura"
                                                />
                                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 p-4 text-center">
                                                    <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Vista de Auditoría Forense</p>
                                                </div>
                                                {/* Scanning Anim */}
                                                {isScanning && (
                                                    <div className="absolute inset-0 bg-indigo-500/10 backdrop-blur-[1px]">
                                                        <div className="absolute top-0 left-0 w-full h-[2px] bg-cyan-400 animate-[scan-beam_2s_ease-in-out_infinite]" />
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {/* Botón de acción inmediata bajo la foto */}
                                            {!isScanning && (
                                                <Button 
                                                    onClick={(e) => { e.stopPropagation(); handleScanFactura(); }}
                                                    className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[11px] tracking-tighter rounded-xl shadow-lg shadow-indigo-600/30 animate-ag-pulse"
                                                >
                                                    <Sparkles className="w-4 h-4 mr-2" /> Iniciar Análisis Forense
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Checklist de Productos (Volt-Audit-System) */}
                    <Card className="lg:col-span-2 shadow-2xl border-white/10 glass-card bg-white/40 dark:bg-slate-900/40 backdrop-blur-md overflow-hidden flex flex-col max-h-[750px]">
                        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100/50 bg-white/60 py-4 flex-shrink-0">
                            <div>
                                <CardTitle className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-indigo-500" />
                                    Auditoría de Mercancía
                                </CardTitle>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Validación de Integridad Física y Costos</p>
                            </div>
                            <div className="flex gap-2">
                                <select
                                    className="text-[11px] font-black uppercase p-2 rounded-xl border-2 border-indigo-50 bg-white min-w-[200px] h-10 outline-none focus:border-indigo-500 transition-all"
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            handleAddItem(e.target.value);
                                            e.target.value = '';
                                        }
                                    }}
                                >
                                    <option value="">+ Insumo / Producto</option>
                                    {productos.map(p => (
                                        <option key={p.id} value={p.id}>{p.nombre}</option>
                                    ))}
                                </select>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 overflow-y-auto flex-1 scrollbar-hide">
                            <div className="space-y-6">
                                {newRecepcion.items.length === 0 ? (
                                    <div className="text-center py-24 text-muted-foreground border-4 border-dashed rounded-[2.5rem] bg-indigo-50/30 flex flex-col items-center gap-4">
                                        <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center animate-ag-float">
                                            <Package className="w-10 h-10 text-indigo-500 opacity-50" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-black text-lg uppercase tracking-tighter text-indigo-900">Buzón de Recepción Vacío</p>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">
                                                {newRecepcion.imagenFactura ? 'Imagen detectada. ¿Iniciar escaneo?' : 'Inicia el escaneo forense o agrega manualmente'}
                                            </p>
                                        </div>
                                        {newRecepcion.imagenFactura && !isScanning && (
                                            <Button 
                                                onClick={handleScanFactura} 
                                                className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] tracking-widest h-10 px-6 rounded-xl animate-ag-pulse"
                                            >
                                                <Sparkles className="w-4 h-4 mr-2" /> Iniciar Análisis Forense
                                            </Button>
                                        )}
                                        {isScanning && (
                                            <div className="mt-2 w-48 space-y-2">
                                                <Progress value={scanProgress} className="h-1 bg-indigo-100" />
                                                <p className="text-[9px] font-black uppercase text-indigo-600 animate-pulse">{scanStep}</p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-4">
                                        {newRecepcion.items.map((item) => {
                                            const prod = getProductoById(item.productoId);
                                            const inflacion = prod?.costoBase ? ((item.precioFacturado / prod.costoBase) - 1) * 100 : 0;
                                            
                                            return (
                                                <div key={item.id} className="relative group p-5 border-2 rounded-2xl bg-white hover:bg-slate-50 transition-all shadow-sm hover:shadow-xl border-slate-100 flex flex-col gap-5">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20">
                                                                <Package className="w-6 h-6" />
                                                            </div>
                                                            <div>
                                                                <h4 className="font-black text-slate-900 uppercase leading-none">{prod?.nombre}</h4>
                                                                <div className="flex items-center gap-2 mt-1.5">
                                                                    <Badge variant="outline" className="text-[9px] font-black uppercase text-slate-500 border-slate-200">SKU: {item.id.slice(0, 5)}</Badge>
                                                                    {inflacion > 2 && (
                                                                        <Badge className="bg-rose-100 text-rose-600 border-rose-200 text-[8px] font-black px-1.5">
                                                                            <TrendingUp className="w-2.5 h-2.5 mr-1" /> INC: {inflacion.toFixed(1)}%
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <Button variant="ghost" size="icon" className="rounded-xl hover:bg-rose-50 hover:text-rose-500" onClick={() => setNewRecepcion(prev => ({ ...prev, items: prev.items.filter(i => i.id !== item.id) }))}>
                                                            <X className="w-4 h-4" />
                                                        </Button>
                                                    </div>

                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
                                                        <div className="space-y-2">
                                                            <Label className="text-[10px] font-black uppercase text-indigo-500 ml-1">Cant. Recibida</Label>
                                                            <Input
                                                                type="number"
                                                                min="1"
                                                                value={item.cantidadRecibida}
                                                                onChange={e => handleUpdateItem(item.id, { cantidadRecibida: parseInt(e.target.value) || 0 })}
                                                                className="h-12 rounded-xl font-black text-center bg-slate-50 border-none text-indigo-600 text-lg"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <div className="flex items-center justify-between ml-1">
                                                                <Label className="text-[10px] font-black uppercase text-blue-500">Valor Paca / Pack</Label>
                                                                <Badge variant="outline" className="text-[8px] font-black border-blue-200 text-blue-500 px-1 py-0 h-4">TOTAL</Badge>
                                                            </div>
                                                            <Input
                                                                type="number"
                                                                value={item.precioFacturado * item.cantidadRecibida}
                                                                onChange={e => {
                                                                    const total = parseFloat(e.target.value) || 0;
                                                                    const unit = item.cantidadRecibida > 0 ? total / item.cantidadRecibida : 0;
                                                                    handleUpdateItem(item.id, { precioFacturado: unit });
                                                                }}
                                                                className="h-12 rounded-xl font-black text-center bg-blue-50/30 border-none text-blue-700 text-lg"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <div className="flex items-center justify-between ml-1">
                                                                <Label className="text-[10px] font-black uppercase text-emerald-600">Costo Unitario</Label>
                                                                {inflacion > 2 && <Badge className="bg-rose-500 text-white text-[8px] font-black px-1.5 h-4">↑</Badge>}
                                                            </div>
                                                            <Input
                                                                type="number"
                                                                value={item.precioFacturado}
                                                                onChange={e => handleUpdateItem(item.id, { precioFacturado: parseFloat(e.target.value) || 0 })}
                                                                className={cn(
                                                                    "h-12 rounded-xl font-black text-center bg-slate-50 border-none text-lg",
                                                                    inflacion > 5 ? "text-rose-600 ring-4 ring-rose-500/10" : "text-emerald-600"
                                                                )}
                                                            />
                                                        </div>
                                                        <div className="col-span-2 grid grid-cols-2 gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleUpdateItem(item.id, { embalajeOk: !item.embalajeOk })}
                                                                className={cn(
                                                                    "h-12 rounded-xl text-[9px] font-black uppercase flex flex-col items-center justify-center transition-all border-2",
                                                                    item.embalajeOk ? "bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm shadow-emerald-200/50" : "bg-rose-50 border-rose-200 text-rose-700"
                                                                )}
                                                            >
                                                                <Layers className="w-3.5 h-3.5 mb-0.5" />
                                                                {item.embalajeOk ? 'Embalaje OK' : 'Dañado'}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleUpdateItem(item.id, { productoOk: !item.productoOk })}
                                                                className={cn(
                                                                    "h-12 rounded-xl text-[9px] font-black uppercase flex flex-col items-center justify-center transition-all border-2",
                                                                    item.productoOk ? "bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm shadow-emerald-200/50" : "bg-rose-50 border-rose-200 text-rose-700"
                                                                )}
                                                            >
                                                                <Check className="w-3.5 h-3.5 mb-0.5" />
                                                                {item.productoOk ? 'Estado OK' : 'Incompleto'}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {(!item.embalajeOk || !item.productoOk) && (
                                                        <div className="p-4 bg-rose-50 border-2 border-rose-100 rounded-2xl animate-ag-fade-in">
                                                            <Label className="text-[9px] font-black uppercase text-rose-400 mb-2 block">Descripción de la novedad</Label>
                                                            <Input
                                                                placeholder="¿Qué pasó con el producto?..."
                                                                value={item.observaciones || ''}
                                                                onChange={e => handleUpdateItem(item.id, { observaciones: e.target.value })}
                                                                className="h-10 text-xs border-none bg-white text-rose-700 font-bold placeholder:text-rose-200 rounded-xl"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="fixed bottom-0 left-64 right-0 p-4 bg-white/80 backdrop-blur-xl border-t flex justify-end gap-4 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                    <div className="mr-auto text-sm text-muted-foreground flex items-center gap-4">
                        <InfoBadge label="Items" value={newRecepcion.items.reduce((s, i) => s + i.cantidadRecibida, 0).toString()} />
                        <InfoBadge label="Total" value={formatCurrency(newRecepcion.items.reduce((s, i) => s + (i.cantidadRecibida * i.precioFacturado), 0))} />
                    </div>
                    <Button variant="ghost" onClick={() => setView('list')} className="rounded-xl font-bold">Cancelar</Button>
                    <Button onClick={handleSave} className="gap-2 btn-gradient-primary shadow-lg shadow-blue-600/20 px-8 rounded-xl font-bold">
                        <CheckCircle className="w-5 h-5" /> Finalizar Recepción
                    </Button>
                </div>
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
