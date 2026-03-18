import { useState, useMemo } from 'react';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from '@/components/ui/card';
import {
    Search,
    Filter,
    Calendar,
    ArrowUpDown,
    Eye,
    Download,
    History,
    ShoppingCart,
    User,
    CreditCard,
    DollarSign,
    MoreVertical,
    CheckCircle2,
    Clock,
    FileSpreadsheet,
    FileText,
    TrendingUp,
    Printer,
    ChevronLeft,
    ChevronRight,
    Package,
    Banknote,
    BarChart3,
    CheckSquare,
    Square
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { exportToCSV } from '@/lib/export-utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuLabel,
    DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import type { Venta, Producto, MetodoPago } from '@/types';
import { format, parseISO, isValid, isWithinInterval, startOfDay, endOfDay, subDays, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface HistorialVentasProps {
    ventas: Venta[];
    productos: Producto[];
    sesionesCaja: CajaSesion[];
    formatCurrency: (value: number) => string;
    getProductoById: (id: string) => Producto | undefined;
}

export default function HistorialVentas({
    ventas,
    productos,
    sesionesCaja,
    formatCurrency,
    getProductoById
}: HistorialVentasProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedVenta, setSelectedVenta] = useState<Venta | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [fechaDesde, setFechaDesde] = useState('');
    const [fechaHasta, setFechaHasta] = useState('');
    const [methodFilter, setMethodFilter] = useState<MetodoPago | 'all'>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [showChart, setShowChart] = useState(true);
    const [viewMode, setViewMode] = useState<'transacciones' | 'productos'>('transacciones');
    const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState<Set<string>>(new Set());
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'fecha', direction: 'desc' });
    const ITEMS_PER_PAGE = 10;

    // Función para toggle de categoría
    const toggleCategoria = (categoria: string) => {
        setCategoriasSeleccionadas(prev => {
            const next = new Set(prev);
            if (next.has(categoria)) {
                next.delete(categoria);
            } else {
                next.add(categoria);
            }
            return next;
        });
        setCurrentPage(1);
    };

    // Seleccionar todas las categorías
    const selectAllCategorias = () => {
        setCategoriasSeleccionadas(new Set(categoriasUnicas));
        setCurrentPage(1);
    };

    // Deseleccionar todas
    const clearCategorias = () => {
        setCategoriasSeleccionadas(new Set());
        setCurrentPage(1);
    };

    // Obtener categorías únicas de los productos
    const categoriasUnicas = useMemo(() => {
        const cats = new Set<string>();
        productos.forEach(p => {
            if (p.categoria) cats.add(p.categoria);
        });
        return Array.from(cats).sort();
    }, [productos]);

    const filteredVentas = useMemo(() => {
        return ventas
            .filter(v => {
                const matchesSearch =
                    v.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (v.cliente || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                    v.usuarioId.toLowerCase().includes(searchTerm.toLowerCase());

                // Filtro por rango de fechas
                let matchesDate = true;
                if (fechaDesde || fechaHasta) {
                    const ventaDate = parseISO(v.fecha);
                    if (fechaDesde && fechaHasta) {
                        matchesDate = isWithinInterval(ventaDate, {
                            start: startOfDay(parseISO(fechaDesde)),
                            end: endOfDay(parseISO(fechaHasta))
                        });
                    } else if (fechaDesde) {
                        matchesDate = ventaDate >= startOfDay(parseISO(fechaDesde));
                    } else if (fechaHasta) {
                        matchesDate = ventaDate <= endOfDay(parseISO(fechaHasta));
                    }
                }

                const matchesMethod = methodFilter === 'all' || v.metodoPago === methodFilter;

                return matchesSearch && matchesDate && matchesMethod;
            })
            .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    }, [ventas, searchTerm, fechaDesde, fechaHasta, methodFilter]);

    // Paginación
    const totalPages = Math.ceil(filteredVentas.length / ITEMS_PER_PAGE);
    const paginatedVentas = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredVentas.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredVentas, currentPage]);

    // Reset página cuando cambian filtros
    useMemo(() => {
        setCurrentPage(1);
    }, [searchTerm, fechaDesde, fechaHasta, methodFilter]);

    // KPIs calculados
    const kpis = useMemo(() => {
        const totalVentas = filteredVentas.reduce((sum, v) => sum + v.total, 0);
        const totalItems = filteredVentas.reduce((sum, v) => sum + v.items.reduce((s, i) => s + i.cantidad, 0), 0);
        const promedioVenta = filteredVentas.length > 0 ? totalVentas / filteredVentas.length : 0;
        
        // Método más usado
        const metodoCount: Record<string, number> = {};
        filteredVentas.forEach(v => {
            metodoCount[v.metodoPago] = (metodoCount[v.metodoPago] || 0) + 1;
        });
        const metodoMasUsado = Object.entries(metodoCount).sort((a, b) => b[1] - a[1])[0];

        // Ventas de hoy
        const today = new Date();
        const ventasHoy = ventas.filter(v => {
            const ventaDate = parseISO(v.fecha);
            return isValid(ventaDate) && format(ventaDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
        });
        const totalHoy = ventasHoy.reduce((sum, v) => sum + v.total, 0);

        return {
            totalVentas,
            totalItems,
            promedioVenta,
            metodoMasUsado: metodoMasUsado ? { metodo: metodoMasUsado[0], count: metodoMasUsado[1] } : null,
            cantidadVentas: filteredVentas.length,
            ventasHoy: ventasHoy.length,
            totalHoy
        };
    }, [filteredVentas, ventas]);

    // Datos para el gráfico de tendencias (últimos 7 días)
    const chartData = useMemo(() => {
        const last7Days = eachDayOfInterval({
            start: subDays(new Date(), 6),
            end: new Date()
        });

        return last7Days.map(day => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const ventasDelDia = ventas.filter(v => {
                const ventaDate = parseISO(v.fecha);
                return isValid(ventaDate) && format(ventaDate, 'yyyy-MM-dd') === dayStr;
            });
            const total = ventasDelDia.reduce((sum, v) => sum + v.total, 0);
            const cantidad = ventasDelDia.length;

            return {
                dia: format(day, 'EEE', { locale: es }),
                fecha: format(day, 'dd/MM'),
                total,
                cantidad
            };
        });
    }, [ventas]);

    const totalVentas = kpis.totalVentas;

    // Vista detallada de productos vendidos
    interface ProductoVendidoDetalle {
        id: string;
        ventaId: string;
        productoId: string;
        nombre: string;
        categoria: string;
        fecha: string;
        cantidad: number;
        precioUnitario: number;
        costoUnitario: number;
        subtotal: number;
        margen: number;
        vendedor: string;
        turno: string;
        cliente: string;
    }

    const productosVendidos = useMemo((): ProductoVendidoDetalle[] => {
        const items: ProductoVendidoDetalle[] = [];
        
        filteredVentas.forEach(venta => {
            venta.items.forEach(item => {
                const producto = getProductoById(item.productoId);
                if (producto) {
                    const costoUnitario = producto.costoBase || producto.precioCompra || 0;
                    const margen = item.precioUnitario - costoUnitario;
                    
                    // Filtrar por categorías seleccionadas (si hay alguna seleccionada)
                    const categoriaProducto = producto.categoria || 'Sin categoría';
                    const turnoInfo = venta.cajaId ? (sesionesCaja.find(s => s.id === venta.cajaId)?.usuarioId || 'General') : 'Sin Turno';
                    if (categoriasSeleccionadas.size === 0 || categoriasSeleccionadas.has(categoriaProducto)) {
                        items.push({
                            id: `${venta.id}-${item.productoId}`,
                            ventaId: venta.id,
                            productoId: item.productoId,
                            nombre: producto.nombre,
                            categoria: producto.categoria || 'Sin categoría',
                            fecha: venta.fecha,
                            cantidad: item.cantidad,
                            precioUnitario: item.precioUnitario,
                            costoUnitario,
                            subtotal: item.subtotal,
                            margen: margen * item.cantidad,
                            vendedor: venta.usuarioId || 'Sistema',
                            turno: turnoInfo,
                            cliente: venta.cliente || '-'
                        });
                    }
                }
            });
        });

        // Ordenar según configuración
        items.sort((a, b) => {
            let comparison = 0;
            switch (sortConfig.key) {
                case 'nombre':
                    comparison = a.nombre.localeCompare(b.nombre);
                    break;
                case 'categoria':
                    comparison = a.categoria.localeCompare(b.categoria);
                    break;
                case 'fecha':
                    comparison = new Date(a.fecha).getTime() - new Date(b.fecha).getTime();
                    break;
                case 'cantidad':
                    comparison = a.cantidad - b.cantidad;
                    break;
                case 'subtotal':
                    comparison = a.subtotal - b.subtotal;
                    break;
                case 'margen':
                    comparison = a.margen - b.margen;
                    break;
                default:
                    comparison = 0;
            }
            return sortConfig.direction === 'asc' ? comparison : -comparison;
        });

        return items;
    }, [filteredVentas, getProductoById, categoriasSeleccionadas, sortConfig]);

    // Paginación para vista de productos
    const totalPagesProductos = Math.ceil(productosVendidos.length / ITEMS_PER_PAGE);
    const paginatedProductos = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return productosVendidos.slice(start, start + ITEMS_PER_PAGE);
    }, [productosVendidos, currentPage]);

    // Resumen COMPLETO por categoría (incluye todas las categorías con datos del periodo filtrado)
    const resumenCompletoPorCategoria = useMemo(() => {
        const resumen: Record<string, { cantidad: number; total: number; margen: number; items: ProductoVendidoDetalle[] }> = {};
        
        // Inicializar todas las categorías existentes
        categoriasUnicas.forEach(cat => {
            resumen[cat] = { cantidad: 0, total: 0, margen: 0, items: [] };
        });
        
        // Calcular datos de TODAS las ventas filtradas (sin filtro de categoría)
        filteredVentas.forEach(venta => {
            venta.items.forEach(item => {
                const producto = getProductoById(item.productoId);
                if (producto) {
                    const categoriaProducto = producto.categoria || 'Sin categoría';
                    const costoUnitario = producto.costoBase || producto.precioCompra || 0;
                    const margen = (item.precioUnitario - costoUnitario) * item.cantidad;
                    const turnoInfo = venta.cajaId ? (sesionesCaja.find(s => s.id === venta.cajaId)?.usuarioId || 'General') : 'Sin Turno';
                    
                    if (!resumen[categoriaProducto]) {
                        resumen[categoriaProducto] = { cantidad: 0, total: 0, margen: 0, items: [] };
                    }
                    
                    resumen[categoriaProducto].cantidad += item.cantidad;
                    resumen[categoriaProducto].total += item.subtotal;
                    resumen[categoriaProducto].margen += margen;
                    resumen[categoriaProducto].items.push({
                        id: `${venta.id}-${item.productoId}`,
                        ventaId: venta.id,
                        productoId: item.productoId,
                        nombre: producto.nombre,
                        categoria: categoriaProducto,
                        fecha: venta.fecha,
                        cantidad: item.cantidad,
                        precioUnitario: item.precioUnitario,
                        costoUnitario,
                        subtotal: item.subtotal,
                        margen,
                        vendedor: venta.usuarioId || 'Sistema',
                        turno: turnoInfo,
                        cliente: venta.cliente || '-'
                    });
                }
            });
        });

        return Object.entries(resumen)
            .filter(([_, data]) => data.cantidad > 0)
            .map(([categoria, data]) => ({
                categoria,
                ...data
            }))
            .sort((a, b) => b.total - a.total);
    }, [filteredVentas, getProductoById, categoriasUnicas]);

    // Total de las categorías seleccionadas
    const totalCategoriasSeleccionadas = useMemo(() => {
        if (categoriasSeleccionadas.size === 0) return { total: 0, cantidad: 0, margen: 0 };
        
        return resumenCompletoPorCategoria
            .filter(cat => categoriasSeleccionadas.has(cat.categoria))
            .reduce((acc, cat) => ({
                total: acc.total + cat.total,
                cantidad: acc.cantidad + cat.cantidad,
                margen: acc.margen + cat.margen
            }), { total: 0, cantidad: 0, margen: 0 });
    }, [resumenCompletoPorCategoria, categoriasSeleccionadas]);

    const handleSort = (key: string) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const getStatusColor = (metodo: MetodoPago) => {
        switch (metodo) {
            case 'efectivo': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
            case 'tarjeta': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
            case 'nequi': return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
            case 'credito': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
            default: return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
        }
    };

    const handleViewDetail = (venta: Venta) => {
        setSelectedVenta(venta);
        setShowDetailModal(true);
    };

    // Función para imprimir ticket individual
    const handlePrintTicket = (venta: Venta) => {
        const date = parseISO(venta.fecha);
        const ticketContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Ticket #${venta.id.substring(0, 8)}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Courier New', monospace; 
            width: 80mm; 
            padding: 10px;
            font-size: 12px;
        }
        .header { text-align: center; margin-bottom: 15px; border-bottom: 2px dashed #000; padding-bottom: 10px; }
        .header h1 { font-size: 18px; font-weight: bold; }
        .header p { font-size: 10px; color: #666; }
        .info { margin: 10px 0; font-size: 11px; }
        .info-row { display: flex; justify-content: space-between; margin: 3px 0; }
        .items { border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 10px 0; margin: 10px 0; }
        .item { display: flex; justify-content: space-between; margin: 5px 0; }
        .item-name { flex: 1; }
        .item-qty { width: 30px; text-align: center; }
        .item-price { width: 60px; text-align: right; }
        .total { font-size: 16px; font-weight: bold; text-align: right; margin-top: 10px; padding-top: 10px; border-top: 2px solid #000; }
        .footer { text-align: center; margin-top: 20px; font-size: 10px; color: #666; }
        @media print { body { width: 80mm; } }
    </style>
</head>
<body>
    <div class="header">
        <h1>DULCE PLACER</h1>
        <p>Panadería y Pastelería</p>
        <p>NIT: XXX.XXX.XXX-X</p>
    </div>
    <div class="info">
        <div class="info-row"><span>Ticket:</span><span>#${venta.id.substring(0, 8)}</span></div>
        <div class="info-row"><span>Fecha:</span><span>${isValid(date) ? format(date, "dd/MM/yyyy HH:mm") : 'N/A'}</span></div>
        <div class="info-row"><span>Método:</span><span>${venta.metodoPago.toUpperCase()}</span></div>
        ${venta.cliente ? `<div class="info-row"><span>Cliente:</span><span>${venta.cliente}</span></div>` : ''}
    </div>
    <div class="items">
        ${venta.items.map(item => {
            const prod = getProductoById(item.productoId);
            return `<div class="item">
                <span class="item-name">${prod?.nombre || 'Producto'}</span>
                <span class="item-qty">x${item.cantidad}</span>
                <span class="item-price">${formatCurrency(item.subtotal)}</span>
            </div>`;
        }).join('')}
    </div>
    <div class="total">TOTAL: ${formatCurrency(venta.total)}</div>
    <div class="footer">
        <p>¡Gracias por su compra!</p>
        <p>Vuelva pronto</p>
    </div>
</body>
</html>
        `;

        const printWindow = window.open('', '_blank', 'width=320,height=600');
        if (printWindow) {
            printWindow.document.write(ticketContent);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
            }, 250);
            toast.success('Ticket listo para imprimir');
        } else {
            toast.error('No se pudo abrir la ventana de impresión');
        }
    };

    const handleExportExcel = () => {
        if (filteredVentas.length === 0) {
            toast.error('No hay datos para exportar');
            return;
        }

        toast.loading('Generando archivo Excel...', { id: 'export-excel' });

        const dataToExport = filteredVentas.map(v => ({
            id: v.id,
            fecha: v.fecha,
            cliente: v.cliente || 'Consumidor Final',
            metodoPago: v.metodoPago.toUpperCase(),
            total: v.total,
            vendedor: v.usuarioId,
            items: v.items.map(item => `${getProductoById(item.productoId)?.nombre} (x${item.cantidad})`).join('; ')
        }));

        try {
            exportToCSV(dataToExport, 'Historial_Ventas_DulcePlacer', {
                id: 'ID Venta',
                fecha: 'Fecha y Hora',
                cliente: 'Cliente',
                metodoPago: 'Método de Pago',
                total: 'Total de Venta',
                vendedor: 'Vendido Por',
                items: 'Productos Vendidos'
            });
            toast.success('Excel generado correctamente', { id: 'export-excel' });
        } catch (error) {
            toast.error('Error al generar el archivo', { id: 'export-excel' });
        }
    };

    const handlePrint = () => {
        toast.info('Abriendo diálogo de impresión...');
        window.print();
    };

    return (
        <div className="space-y-6 h-full flex flex-col p-4 md:p-8 animate-ag-fade-in bg-[#f8fafc] dark:bg-[#0f172a] overflow-y-auto">
            {/* Header Antigravity Premium */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm shrink-0 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-32 -mt-32" />

                <div className="flex items-center gap-5 relative z-10">
                    <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/20 animate-ag-float">
                        <History className="w-7 h-7 text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white leading-none">
                            Historial de Ventas
                        </h2>
                        <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs font-black uppercase tracking-widest border-blue-200 text-blue-600 bg-blue-50">
                                Registro Maestro
                            </Badge>
                            <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                                {filteredVentas.length} Transacciones Filtradas
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 relative z-10 w-full md:w-auto">
                    <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 flex flex-col justify-center min-w-[140px]">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Filtrado</span>
                        <span className="text-lg font-black text-indigo-600 tabular-nums leading-none">
                            {formatCurrency(totalVentas)}
                        </span>
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="h-12 rounded-xl gap-2 font-black text-xs uppercase tracking-widest border-slate-200 hover:bg-slate-50 active:scale-95 transition-all">
                                <Download className="w-4 h-4" /> Exportar
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56 rounded-2xl p-2 border-slate-100 shadow-xl" align="end">
                            <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400 p-3">Formatos Disponibles</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleExportExcel} className="rounded-xl p-3 cursor-pointer group">
                                <FileSpreadsheet className="w-4 h-4 mr-3 text-emerald-500 group-hover:scale-110 transition-transform" />
                                <div className="flex flex-col">
                                    <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-200">Excel (.CSV)</span>
                                    <span className="text-[9px] font-bold text-slate-400">Compatible con Microsoft Excel</span>
                                </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handlePrint} className="rounded-xl p-3 cursor-pointer group">
                                <FileText className="w-4 h-4 mr-3 text-blue-500 group-hover:scale-110 transition-transform" />
                                <div className="flex flex-col">
                                    <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-200">Reporte PDF / Imprimir</span>
                                    <span className="text-[9px] font-bold text-slate-400">Vista optimizada para reporte</span>
                                </div>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            {/* KPIs Dashboard */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ventas Hoy</p>
                            <p className="text-lg font-black text-emerald-600 tabular-nums">{formatCurrency(kpis.totalHoy)}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                            <ShoppingCart className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Trans. Hoy</p>
                            <p className="text-lg font-black text-blue-600 tabular-nums">{kpis.ventasHoy}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Promedio</p>
                            <p className="text-lg font-black text-indigo-600 tabular-nums">{formatCurrency(kpis.promedioVenta)}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center">
                            <Package className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Items</p>
                            <p className="text-lg font-black text-purple-600 tabular-nums">{kpis.totalItems}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
                            <Banknote className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Método Top</p>
                            <p className="text-sm font-black text-amber-600 uppercase">{kpis.metodoMasUsado?.metodo || 'N/A'}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-rose-500/10 rounded-xl flex items-center justify-center">
                            <BarChart3 className="w-5 h-5 text-rose-600" />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Filtradas</p>
                            <p className="text-lg font-black text-rose-600 tabular-nums">{kpis.cantidadVentas}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Gráfico de Tendencias */}
            {showChart && (
                <Card className="rounded-3xl border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                                    <TrendingUp className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">Tendencia Últimos 7 Días</CardTitle>
                                    <CardDescription className="text-[10px] font-bold uppercase text-slate-400">Evolución de ventas diarias</CardDescription>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setShowChart(false)} className="text-slate-400 hover:text-slate-600 text-xs">
                                Ocultar
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[200px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                    <XAxis dataKey="fecha" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                                    <Tooltip 
                                        contentStyle={{ 
                                            backgroundColor: '#0f172a', 
                                            border: 'none', 
                                            borderRadius: '12px',
                                            boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
                                        }}
                                        labelStyle={{ color: '#94a3b8', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}
                                        itemStyle={{ color: '#fff', fontSize: 12, fontWeight: 900 }}
                                        formatter={(value: number) => [formatCurrency(value), 'Total']}
                                    />
                                    <Area type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            )}

            {!showChart && (
                <Button variant="outline" onClick={() => setShowChart(true)} className="w-full h-12 rounded-2xl font-black text-xs uppercase tracking-widest border-dashed border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-300">
                    <TrendingUp className="w-4 h-4 mr-2" /> Mostrar Gráfico de Tendencias
                </Button>
            )}

            {/* Toggle Vista: Transacciones vs Productos */}
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
                    <Button
                        variant={viewMode === 'transacciones' ? 'default' : 'ghost'}
                        onClick={() => { setViewMode('transacciones'); setCurrentPage(1); }}
                        className={cn(
                            "h-10 px-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all",
                            viewMode === 'transacciones' 
                                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30" 
                                : "text-slate-500 hover:text-indigo-600"
                        )}
                    >
                        <History className="w-4 h-4 mr-2" /> Transacciones
                    </Button>
                    <Button
                        variant={viewMode === 'productos' ? 'default' : 'ghost'}
                        onClick={() => { setViewMode('productos'); setCurrentPage(1); }}
                        className={cn(
                            "h-10 px-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all",
                            viewMode === 'productos' 
                                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30" 
                                : "text-slate-500 hover:text-emerald-600"
                        )}
                    >
                        <Package className="w-4 h-4 mr-2" /> Por Categoría
                    </Button>
                </div>

                {/* Acciones rápidas para categorías (solo en vista productos) */}
                {viewMode === 'productos' && (
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={selectAllCategorias}
                            className="h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest"
                        >
                            <CheckSquare className="w-3 h-3 mr-1" /> Todas
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearCategorias}
                            className="h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500"
                        >
                            Limpiar
                        </Button>
                        {categoriasSeleccionadas.size > 0 && (
                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                                {categoriasSeleccionadas.size} seleccionadas
                            </Badge>
                        )}
                    </div>
                )}
            </div>

            {/* Panel de Checkboxes de Categorías con Subtotales (solo en vista productos) */}
            {viewMode === 'productos' && resumenCompletoPorCategoria.length > 0 && (
                <Card className="bg-gradient-to-br from-emerald-50/50 to-teal-50/50 dark:from-emerald-900/10 dark:to-teal-900/10 border-emerald-200/50">
                    <CardContent className="p-2">
                        {/* Header con total inline */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span className="text-[10px] font-black text-slate-700 uppercase">Categorías:</span>
                            {categoriasSeleccionadas.size > 0 && (
                                <span className="ml-auto text-[10px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded">
                                    {categoriasSeleccionadas.size} sel. • {totalCategoriasSeleccionadas.cantidad}u • {formatCurrency(totalCategoriasSeleccionadas.total)}
                                </span>
                            )}
                        </div>
                        
                        {/* Lista de checkboxes compacta en grid responsive */}
                        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 max-h-[120px] overflow-y-auto">
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-px bg-slate-100 dark:bg-slate-800">
                                {resumenCompletoPorCategoria.map(cat => {
                                    const isSelected = categoriasSeleccionadas.has(cat.categoria);
                                    return (
                                        <div
                                            key={cat.categoria}
                                            onClick={() => toggleCategoria(cat.categoria)}
                                            className={cn(
                                                "flex items-center gap-1.5 px-2 py-1 cursor-pointer transition-all bg-white dark:bg-slate-900",
                                                "hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20",
                                                isSelected && "bg-emerald-100 dark:bg-emerald-900/30 ring-1 ring-emerald-400"
                                            )}
                                        >
                                            {/* Checkbox */}
                                            <div className={cn(
                                                "w-3 h-3 rounded border flex items-center justify-center shrink-0 transition-all",
                                                isSelected
                                                    ? "bg-emerald-500 border-emerald-500"
                                                    : "border-slate-300"
                                            )}>
                                                {isSelected && <CheckCircle2 className="w-2 h-2 text-white" />}
                                            </div>
                                            
                                            {/* Nombre y datos */}
                                            <div className="flex-1 min-w-0">
                                                <p className={cn(
                                                    "text-[9px] font-bold truncate leading-tight",
                                                    isSelected ? "text-emerald-700" : "text-slate-600"
                                                )}>
                                                    {cat.categoria}
                                                </p>
                                                <p className="text-[7px] text-slate-400 tabular-nums leading-tight">
                                                    {cat.cantidad}u • {formatCurrency(cat.total)}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Mensaje cuando no hay categorías seleccionadas en vista productos */}
            {viewMode === 'productos' && categoriasSeleccionadas.size === 0 && resumenCompletoPorCategoria.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                    <p className="text-amber-700 text-sm font-bold">
                        👆 Selecciona una o más categorías arriba para ver los productos vendidos
                    </p>
                </div>
            )}

            {/* Barra de Filtros Inteligente - Con Rango de Fechas */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                <div className="md:col-span-2 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="Buscar por ID, Cliente o Vendedor..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-11 h-12 bg-slate-50 dark:bg-slate-800 border-transparent rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                    />
                </div>

                <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-400 uppercase">Desde</span>
                    <Input
                        type="date"
                        value={fechaDesde}
                        onChange={e => setFechaDesde(e.target.value)}
                        className="pl-14 h-12 bg-slate-50 dark:bg-slate-800 border-transparent rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-medium uppercase text-xs"
                    />
                </div>

                <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-400 uppercase">Hasta</span>
                    <Input
                        type="date"
                        value={fechaHasta}
                        onChange={e => setFechaHasta(e.target.value)}
                        className="pl-14 h-12 bg-slate-50 dark:bg-slate-800 border-transparent rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-medium uppercase text-xs"
                    />
                </div>

                <div className="relative group">
                    <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select
                        value={methodFilter}
                        onChange={e => setMethodFilter(e.target.value as any)}
                        className="w-full pl-11 h-12 bg-slate-50 dark:bg-slate-800 border-transparent rounded-2xl focus:ring-2 focus:ring-indigo-500 appearance-none font-black text-[10px] uppercase tracking-widest text-slate-600 outline-none cursor-pointer"
                    >
                        <option value="all">TODOS LOS MÉTODOS</option>
                        <option value="efectivo">EFECTIVO</option>
                        <option value="tarjeta">TARJETA</option>
                        <option value="nequi">NEQUI</option>
                        <option value="credito">CRÉDITO / FIADO</option>
                    </select>
                </div>
            </div>

            {/* VISTA DE TRANSACCIONES - Tabla Detallada Estilo Stitch Premium */}
            {viewMode === 'transacciones' && (
            <Card className="rounded-[2.5rem] border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden bg-white dark:bg-slate-900 flex-1 flex flex-col">
                <div className="overflow-x-auto flex-1 custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                <th className="px-6 py-5 text-xs font-black uppercase tracking-[0.2em] text-slate-400">ID / Turno</th>
                                <th className="px-6 py-5 text-xs font-black uppercase tracking-[0.2em] text-slate-400">Fecha / Hora</th>
                                <th className="px-6 py-5 text-xs font-black uppercase tracking-[0.2em] text-slate-400">Productos Vendidos</th>
                                <th className="px-6 py-5 text-xs font-black uppercase tracking-[0.2em] text-slate-400">Método</th>
                                <th className="px-6 py-5 text-xs font-black uppercase tracking-[0.2em] text-slate-400 text-right">Total</th>
                                <th className="px-6 py-5 text-xs font-black uppercase tracking-[0.2em] text-slate-400 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                            {paginatedVentas.map((venta) => {
                                const date = parseISO(venta.fecha);
                                return (
                                    <tr key={venta.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 group-hover:text-indigo-600 transition-colors">
                                                    #{venta.id.substring(0, 8)}
                                                </span>
                                                <Badge variant="ghost" className="text-[9px] w-fit font-bold p-0 text-slate-500 uppercase">
                                                    Turno: {venta.cajaId ? (sesionesCaja.find(s => s.id === venta.cajaId)?.usuarioId || 'General') : 'Sin Turno'}
                                                </Badge>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-slate-800 dark:text-white uppercase leading-none">
                                                    {isValid(date) ? format(date, "dd MMM yyyy", { locale: es }) : 'N/A'}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-bold mt-1 inline-flex items-center gap-1.5 opacity-60">
                                                    <Clock className="w-3 h-3" />
                                                    {isValid(date) ? format(date, "HH:mm") : '--:--'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1 max-w-[200px]">
                                                {venta.items.map((item, idx) => {
                                                    const prod = getProductoById(item.productoId);
                                                    return (
                                                        <div key={idx} className="flex justify-between items-center gap-2">
                                                            <span className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase truncate">
                                                                {prod?.nombre || 'Producto'}
                                                            </span>
                                                            <Badge variant="secondary" className="text-[9px] h-4 px-1 font-bold">
                                                                x{item.cantidad}
                                                            </Badge>
                                                        </div>
                                                    );
                                                })}
                                                {venta.cliente && (
                                                    <span className="text-[9px] text-indigo-500 font-black uppercase mt-1">
                                                        Cliente: {venta.cliente}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border shadow-sm", getStatusColor(venta.metodoPago))}>
                                                {venta.metodoPago}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-sm font-black text-slate-900 dark:text-white tabular-nums">
                                                {formatCurrency(venta.total)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleViewDetail(venta)}
                                                    className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-600 transition-all border border-transparent hover:border-slate-200 active:scale-90"
                                                    title="Ver detalle"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handlePrintTicket(venta)}
                                                    className="w-9 h-9 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-slate-400 hover:text-emerald-600 transition-all border border-transparent hover:border-emerald-200 active:scale-90"
                                                    title="Imprimir ticket"
                                                >
                                                    <Printer className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {paginatedVentas.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center">
                                            <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 text-slate-200 animate-pulse">
                                                <ShoppingCart className="w-10 h-10" />
                                            </div>
                                            <h3 className="text-slate-400 font-black uppercase text-xs tracking-[0.2em]">No se encontraron transacciones</h3>
                                            <p className="text-slate-300 text-[10px] mt-2 font-bold uppercase">Ajusta los filtros para ver otros resultados</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Paginación */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredVentas.length)} de {filteredVentas.length}
                        </p>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="h-9 px-3 rounded-xl font-black text-xs uppercase tracking-widest border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 disabled:opacity-40"
                            >
                                <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
                            </Button>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let pageNum;
                                    if (totalPages <= 5) {
                                        pageNum = i + 1;
                                    } else if (currentPage <= 3) {
                                        pageNum = i + 1;
                                    } else if (currentPage >= totalPages - 2) {
                                        pageNum = totalPages - 4 + i;
                                    } else {
                                        pageNum = currentPage - 2 + i;
                                    }
                                    return (
                                        <Button
                                            key={pageNum}
                                            variant={currentPage === pageNum ? "default" : "ghost"}
                                            size="sm"
                                            onClick={() => setCurrentPage(pageNum)}
                                            className={cn(
                                                "w-9 h-9 rounded-xl font-black text-xs",
                                                currentPage === pageNum
                                                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                                                    : "text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                                            )}
                                        >
                                            {pageNum}
                                        </Button>
                                    );
                                })}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="h-9 px-3 rounded-xl font-black text-xs uppercase tracking-widest border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 disabled:opacity-40"
                            >
                                Siguiente <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                        </div>
                    </div>
                )}
            </Card>
            )}

            {/* VISTA DE PRODUCTOS - Tabla detallada por producto (solo cuando hay categorías seleccionadas) */}
            {viewMode === 'productos' && categoriasSeleccionadas.size > 0 && (
                <Card className="rounded-xl border-slate-100 dark:border-slate-800 shadow-lg overflow-hidden bg-white dark:bg-slate-900 shrink-0">
                    {/* Header de la tabla */}
                    <div className="bg-emerald-600 text-white px-4 py-2 flex items-center justify-between shrink-0">
                        <span className="text-xs font-black uppercase truncate">Productos ({productosVendidos.length})</span>
                        <span className="text-sm font-black shrink-0">{formatCurrency(totalCategoriasSeleccionadas.total)}</span>
                    </div>
                    <div className="overflow-auto max-h-[300px]">
                        <table className="w-full text-left border-collapse text-[10px]">
                            <thead className="sticky top-0 z-10">
                                <tr className="bg-emerald-50 dark:bg-emerald-900/20 border-b border-slate-100 dark:border-slate-800">
                                    <th className="px-2 py-2 font-black uppercase text-slate-500 whitespace-nowrap">Cat.</th>
                                    <th className="px-2 py-2 font-black uppercase text-slate-500">Producto</th>
                                    <th className="px-2 py-2 font-black uppercase text-slate-500 whitespace-nowrap">Fecha</th>
                                    <th className="px-2 py-2 font-black uppercase text-slate-500 text-center whitespace-nowrap">Cant</th>
                                    <th className="px-2 py-2 font-black uppercase text-slate-500 text-right whitespace-nowrap">Total</th>
                                    <th className="px-2 py-2 font-black uppercase text-slate-500 whitespace-nowrap">Vendedor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                {paginatedProductos.map((item) => {
                                    const date = parseISO(item.fecha);
                                    return (
                                        <tr key={item.id} className="hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10">
                                            <td className="px-2 py-1.5">
                                                <span className="text-[8px] font-bold text-slate-500 uppercase">{item.categoria}</span>
                                            </td>
                                            <td className="px-2 py-1.5">
                                                <span className="font-bold text-slate-800 dark:text-white">{item.nombre}</span>
                                            </td>
                                            <td className="px-2 py-1.5 whitespace-nowrap">
                                                <span className="text-slate-600">{isValid(date) ? format(date, "dd/MM HH:mm") : 'N/A'}</span>
                                            </td>
                                            <td className="px-2 py-1.5 text-center">
                                                <span className="font-black text-emerald-600">x{item.cantidad}</span>
                                            </td>
                                            <td className="px-2 py-1.5 text-right">
                                                <span className="font-black text-slate-900 dark:text-white tabular-nums">{formatCurrency(item.subtotal)}</span>
                                            </td>
                                            <td className="px-2 py-1.5">
                                                <span className="text-slate-500 truncate block max-w-[80px]">{item.vendedor}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {paginatedProductos.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-10 text-center">
                                            <div className="flex flex-col items-center">
                                                <Package className="w-8 h-8 text-slate-300 mb-2" />
                                                <p className="text-slate-400 text-xs font-bold">No hay productos</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            {paginatedProductos.length > 0 && (
                                <tfoot className="bg-emerald-100 dark:bg-emerald-900/30 border-t-2 border-emerald-300 sticky bottom-0">
                                    <tr>
                                        <td colSpan={3} className="px-2 py-2 text-[10px] font-black text-slate-600 uppercase">
                                            Total ({categoriasSeleccionadas.size} cat.)
                                        </td>
                                        <td className="px-2 py-2 text-center text-[10px] font-black text-emerald-600">
                                            {productosVendidos.reduce((s, p) => s + p.cantidad, 0)}u
                                        </td>
                                        <td className="px-2 py-2 text-right text-xs font-black text-emerald-700">
                                            {formatCurrency(productosVendidos.reduce((s, p) => s + p.subtotal, 0))}
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>

                    {/* Paginación para productos */}
                    {totalPagesProductos > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-emerald-50/30 dark:bg-emerald-900/10">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, productosVendidos.length)} de {productosVendidos.length} productos
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="h-9 px-3 rounded-xl font-black text-xs uppercase tracking-widest border-slate-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 disabled:opacity-40"
                                >
                                    <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
                                </Button>
                                <span className="text-xs font-black text-slate-500">
                                    {currentPage} / {totalPagesProductos}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.min(totalPagesProductos, p + 1))}
                                    disabled={currentPage === totalPagesProductos}
                                    className="h-9 px-3 rounded-xl font-black text-xs uppercase tracking-widest border-slate-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 disabled:opacity-40"
                                >
                                    Siguiente <ChevronRight className="w-4 h-4 ml-1" />
                                </Button>
                            </div>
                        </div>
                    )}
                </Card>
            )}

            {/* Modal de Detalle Maestro Antigravity */}
            <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
                <DialogContent className="max-w-2xl rounded-[3rem] p-0 overflow-hidden border-none shadow-3xl bg-white dark:bg-slate-950">
                    <DialogHeader className="bg-[#0f172a] p-8 text-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16" />

                        <div className="relative z-10 flex flex-col items-center">
                            <div className="w-14 h-14 bg-white/5 backdrop-blur-md rounded-2xl flex items-center justify-center mb-3 border border-white/10 shadow-inner">
                                <ShoppingCart className="w-7 h-7 text-white" />
                            </div>
                            <DialogTitle className="text-2xl font-black text-white uppercase tracking-tighter leading-none">Detalles de la Transacción</DialogTitle>
                            <DialogDescription className="text-white/40 text-[10px] font-black uppercase tracking-widest mt-2 bg-white/5 px-4 py-1.5 rounded-full inline-block border border-white/5">
                                ID: {selectedVenta?.id}
                            </DialogDescription>
                        </div>
                    </DialogHeader>

                    <div className="p-8 space-y-8">
                        {/* Info General */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex flex-col">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <User className="w-3 h-3" /> Responsable
                                </span>
                                <span className="text-sm font-black text-slate-800 dark:text-white uppercase truncate">{selectedVenta?.usuarioId || 'Sistema'}</span>
                                <span className="text-[10px] text-slate-400 font-bold mt-1">Operador Autorizado</span>
                            </div>
                            <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex flex-col">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <CreditCard className="w-3 h-3" /> Medio de Pago
                                </span>
                                <span className="text-sm font-black text-slate-800 dark:text-white uppercase truncate">{selectedVenta?.metodoPago}</span>
                                <span className="text-[10px] text-slate-400 font-bold mt-1">Procesamiento Instantáneo</span>
                            </div>
                        </div>

                        {/* Tabla de Items */}
                        <div className="space-y-3">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Desglose de Productos</h4>
                            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-slate-50 dark:bg-slate-800/50">
                                            <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400">Cant</th>
                                            <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400">Producto</th>
                                            <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-right">P. Unit</th>
                                            <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-right">Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                        {selectedVenta?.items.map((item, idx) => {
                                            const prod = getProductoById(item.productoId);
                                            return (
                                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <span className="text-xs font-black tabular-nums bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">{item.cantidad}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase">{prod?.nombre || 'Producto Desconocido'}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className="text-xs font-bold text-slate-400 tabular-nums">{formatCurrency(item.precioUnitario)}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className="text-xs font-black text-slate-900 dark:text-white tabular-nums">{formatCurrency(item.subtotal)}</span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Gran Total */}
                        <div className="flex justify-between items-center p-8 rounded-[2rem] bg-indigo-600 text-white shadow-xl shadow-indigo-600/20 relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                            <div>
                                <h5 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">Monto Total de la Operación</h5>
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                    <span className="text-3xl font-black tabular-nums leading-none">{formatCurrency(selectedVenta?.total || 0)}</span>
                                </div>
                            </div>
                            <Button
                                className="bg-white/10 hover:bg-white/20 text-white rounded-2xl h-14 px-8 font-black uppercase text-xs tracking-widest border border-white/10 backdrop-blur-md active:scale-95 transition-all"
                                onClick={() => setShowDetailModal(false)}
                            >
                                <Download className="w-4 h-4 mr-2" /> Comprobante
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
