import { useState, useMemo } from 'react';
import {
    DollarSign,
    Upload,
    FileText,
    Search,
    Filter,
    Plus,
    Calendar,
    Tag,
    Folder,
    Trash2,
    ChevronRight,
    Camera,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Save,
    Clock,
    Briefcase,
    ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Gasto, GastoCategoria, Proveedor, MetodoPago, Usuario, CajaSesion } from '@/types';

interface GastosProps {
    gastos: Gasto[];
    proveedores: Proveedor[];
    cajaActiva: CajaSesion | undefined;
    onAddGasto: (gasto: Omit<Gasto, 'id'>) => Promise<void>;
    onUpdateGasto: (id: string, updates: Partial<Gasto>) => Promise<void>;
    onDeleteGasto: (id: string) => Promise<void>;
    formatCurrency: (value: number) => string;
    usuario: Usuario;
}

const CATEGORIAS_GASTOS: { value: GastoCategoria; label: string; color: string; icon: any }[] = [
    { value: 'Servicios', label: 'Servicios Públicos', color: '#3b82f6', icon: Clock },
    { value: 'Materia Prima', label: 'Materia Prima', color: '#8b5cf6', icon: Briefcase },
    { value: 'Arriendo', label: 'Arriendo y Local', color: '#f59e0b', icon: Folder },
    { value: 'Nómina', label: 'Nómina de Empleados', color: '#10b981', icon: Users },
    { value: 'Mantenimiento', label: 'Mantenimiento', color: '#ef4444', icon: Settings },
    { value: 'Otros', label: 'Gastos Médicos / Otros', color: '#6b7280', icon: Plus },
];

import { Users, Settings } from 'lucide-react';

export default function Gastos({
    gastos,
    proveedores,
    cajaActiva,
    onAddGasto,
    onUpdateGasto,
    onDeleteGasto,
    formatCurrency,
    usuario
}: GastosProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [scanResult, setScanResult] = useState<Partial<Gasto> | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Estados para nuevo gasto manual
    const [newGasto, setNewGasto] = useState<Partial<Gasto>>({
        descripcion: '',
        monto: 0,
        categoria: 'Otros',
        fecha: new Date().toISOString().split('T')[0],
        metodoPago: 'efectivo'
    });

    const gastosFiltrados = useMemo(() => {
        return gastos.filter(g => {
            const matchesSearch = g.descripcion.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategory || g.categoria === selectedCategory;
            return matchesSearch && matchesCategory;
        }).sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    }, [gastos, searchTerm, selectedCategory]);

    const totalGastosPeriodo = useMemo(() => {
        return gastosFiltrados.reduce((acc, g) => acc + g.monto, 0);
    }, [gastosFiltrados]);

    // Simulación de escaneo de factura
    const handleScanInvoice = async (file: File) => {
        setIsScanning(true);
        setScanResult(null);

        // Simulamos un procesamiento de 2 segundos (OCR Inteligente)
        await new Promise(resolve => setTimeout(resolve, 2500));

        // Datos simulados extraídos de la factura
        const mockExtractedData: Partial<Gasto> = {
            descripcion: `Factura ${file.name.replace(/\.[^/.]+$/, "")}`,
            monto: Math.floor(Math.random() * 500) + 50,
            fecha: new Date().toISOString().split('T')[0],
            categoria: 'Materia Prima',
            metadata: {
                carpeta: `Facturas/${new Date().getFullYear()}/${new Date().toLocaleString('es-ES', { month: 'long' })}`,
                nombreArchivo: `FACT_${Date.now()}_${file.name}`,
                etiquetas: ['Escaneado', 'Auto-Organizado']
            }
        };

        setScanResult(mockExtractedData);
        setNewGasto(prev => ({ ...prev, ...mockExtractedData }));
        setIsScanning(false);
        toast.success('Factura analizada con éxito', {
            description: 'Se han extraído el monto y la categoría automáticamente.'
        });
        setShowAddModal(true);
    };

    const handleSaveGasto = async () => {
        if (!newGasto.descripcion || !newGasto.monto || !newGasto.categoria) {
            toast.error('Por favor completa los campos obligatorios');
            return;
        }

        try {
            setIsSaving(true);
            await onAddGasto({
                ...newGasto as any,
                usuarioId: usuario.id,
                cajaId: cajaActiva?.id,
                fecha: newGasto.fecha || new Date().toISOString()
            });
            toast.success('Gasto registrado');
            setShowAddModal(false);
            setNewGasto({
                descripcion: '',
                monto: 0,
                categoria: 'Otros',
                fecha: new Date().toISOString().split('T')[0],
                metodoPago: 'efectivo'
            });
            setScanResult(null);
        } catch (error) {
            toast.error('Error al guardar el gasto');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6 h-full flex flex-col md:p-2 animate-ag-fade-in">
            {/* Header e Inteligencia de Escaneo */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/40 p-4 rounded-3xl border border-white/5 backdrop-blur-xl">
                <div className="flex-1">
                    <h2 className="text-2xl font-black text-foreground tracking-tighter uppercase italic leading-none mb-1">Egresos y Facturación</h2>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                        Control de Gastos Operativos
                        {cajaActiva && <Badge variant="outline" className="text-[8px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Caja Abierta: {formatCurrency(cajaActiva.totalVentas)}</Badge>}
                    </p>
                </div>

                <div className="flex gap-2">
                    <div className="relative group">
                        <input
                            type="file"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            accept="image/*,application/pdf"
                            onChange={(e) => e.target.files && handleScanInvoice(e.target.files[0])}
                            disabled={isScanning}
                        />
                        <Button
                            className={cn(
                                "h-12 gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-2xl shadow-xl shadow-indigo-600/20 transition-all border-none font-black uppercase text-[10px] tracking-widest",
                                isScanning && "animate-pulse"
                            )}
                        >
                            {isScanning ? (
                                <> <Loader2 className="w-4 h-4 animate-spin" /> Procesando... </>
                            ) : (
                                <> <Camera className="w-4 h-4" /> Escanear Factura </>
                            )}
                        </Button>
                    </div>

                    <Button
                        variant="outline"
                        onClick={() => setShowAddModal(true)}
                        className="h-12 gap-2 rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 font-black uppercase text-[10px] tracking-widest"
                    >
                        <Plus className="w-4 h-4" /> Registrar Manual
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
                {/* Sidebar de Filtros y Resumen */}
                <div className="lg:col-span-1 space-y-6">
                    <Card className="rounded-[2rem] border-white/5 bg-card/30 backdrop-blur-md overflow-hidden">
                        <CardHeader className="p-6">
                            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Resumen del Periodo</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 pt-0 space-y-6">
                            <div className="space-y-1">
                                <p className="text-4xl font-black text-indigo-600 tracking-tighter drop-shadow-sm">{formatCurrency(totalGastosPeriodo)}</p>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase">Total Egresos Filtrados</p>
                            </div>

                            <div className="space-y-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Categorías</p>
                                <div className="space-y-2">
                                    <button
                                        onClick={() => setSelectedCategory(null)}
                                        className={cn(
                                            "w-full flex items-center justify-between p-3 rounded-2xl transition-all text-left",
                                            !selectedCategory ? "bg-indigo-600 text-white shadow-lg" : "hover:bg-white/5 bg-white/2"
                                        )}
                                    >
                                        <span className="text-[10px] font-black uppercase">Todas</span>
                                        <span className="text-xs font-bold">{gastos.length}</span>
                                    </button>
                                    {CATEGORIAS_GASTOS.map(cat => {
                                        const count = gastos.filter(g => g.categoria === cat.value).length;
                                        const total = gastos.filter(g => g.categoria === cat.value).reduce((s, g) => s + g.monto, 0);
                                        return (
                                            <button
                                                key={cat.value}
                                                onClick={() => setSelectedCategory(cat.value)}
                                                className={cn(
                                                    "w-full flex flex-col p-3 rounded-2xl transition-all border border-transparent",
                                                    selectedCategory === cat.value
                                                        ? "bg-white text-slate-900 shadow-xl border-white"
                                                        : "hover:bg-white/5"
                                                )}
                                                style={{ borderLeft: selectedCategory === cat.value ? `4px solid ${cat.color}` : `2px solid ${cat.color}40` }}
                                            >
                                                <div className="flex items-center justify-between w-full mb-1">
                                                    <span className="text-[10px] font-black uppercase">{cat.label}</span>
                                                    <span className="text-[10px] font-black opacity-50">{count}</span>
                                                </div>
                                                <div className="text-xs font-black opacity-70">{formatCurrency(total)}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Listado de Gastos */}
                <div className="lg:col-span-3 flex flex-col min-h-0 bg-card/20 rounded-[2.5rem] border border-white/5 backdrop-blur-sm overflow-hidden">
                    <div className="p-6 border-b border-white/5 flex flex-col md:flex-row gap-4 items-center">
                        <div className="relative flex-1 group w-full">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 group-focus-within:text-indigo-500 transition-colors" />
                            <Input
                                placeholder="BUSCAR EGRESO POR DESCRIPCIÓN..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-12 h-12 bg-white/5 border-none rounded-2xl ring-0 focus-visible:ring-1 focus-visible:ring-indigo-500/50 transition-all font-bold uppercase text-[11px] placeholder:text-muted-foreground/30"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Badge variant="outline" className="h-12 px-6 rounded-2xl bg-indigo-500/5 border-indigo-500/20 text-indigo-500 flex items-center gap-2 font-black uppercase text-[10px]">
                                <Clock className="w-3.5 h-3.5" /> Recientes
                            </Badge>
                        </div>
                    </div>

                    <ScrollArea className="flex-1">
                        <div className="p-6 space-y-4">
                            {gastosFiltrados.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 opacity-20 grayscale">
                                    <FileText className="w-16 h-16 mb-4" />
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em]">No hay egresos registrados</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-3">
                                    {gastosFiltrados.map(g => {
                                        const catInfo = CATEGORIAS_GASTOS.find(c => c.value === g.categoria);
                                        const Icon = catInfo?.icon || Plus;

                                        return (
                                            <div
                                                key={g.id}
                                                className="group flex flex-col xl:flex-row xl:items-center gap-4 p-5 bg-card/40 rounded-[2rem] border border-white/5 hover:border-indigo-500/20 hover:bg-white/[0.04] transition-all duration-300"
                                            >
                                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                                    <div
                                                        className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shrink-0"
                                                        style={{ backgroundColor: `${catInfo?.color}15`, color: catInfo?.color }}
                                                    >
                                                        <Icon className="w-6 h-6" />
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-black text-[13px] leading-none mb-2 uppercase tracking-tight truncate group-hover:text-indigo-500 transition-colors">
                                                            {g.descripcion}
                                                        </h4>
                                                        <div className="flex flex-wrap gap-2 items-center">
                                                            <Badge variant="outline" className="text-[9px] h-5 rounded-lg border-white/5 bg-white/2 text-muted-foreground font-black uppercase">
                                                                <Calendar className="w-2.5 h-2.5 mr-1" /> {new Date(g.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                                                            </Badge>
                                                            <Badge style={{ backgroundColor: `${catInfo?.color}10`, color: catInfo?.color, borderColor: `${catInfo?.color}20` }} className="text-[9px] h-5 rounded-lg font-black uppercase">
                                                                {catInfo?.label}
                                                            </Badge>
                                                            {g.metadata?.carpeta && (
                                                                <Badge variant="outline" className="hidden md:flex text-[8px] h-5 rounded-lg border-indigo-500/10 bg-indigo-500/5 text-indigo-400 font-extrabold uppercase italic">
                                                                    <Folder className="w-2.5 h-2.5 mr-1" /> {g.metadata.carpeta}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between xl:justify-end gap-6 pl-16 xl:pl-0 border-t xl:border-0 border-white/5 pt-3 xl:pt-0">
                                                    <div className="text-right">
                                                        <p className="text-xl font-black text-foreground drop-shadow-sm leading-none mb-1">{formatCurrency(g.monto)}</p>
                                                        <p className="text-[9px] font-black text-muted-foreground uppercase opacity-50">{g.metodoPago}</p>
                                                    </div>

                                                    <div className="flex gap-1">
                                                        {g.comprobanteUrl && (
                                                            <Button variant="ghost" size="icon" className="w-10 h-10 rounded-xl hover:bg-white/5 text-muted-foreground hover:text-indigo-400">
                                                                <ExternalLink className="w-4 h-4" />
                                                            </Button>
                                                        )}
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="w-10 h-10 rounded-xl hover:bg-red-500/10 text-muted-foreground hover:text-red-500"
                                                            onClick={() => onDeleteGasto(g.id)}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </div>

            {/* Modal para Registrar/Editar Gasto */}
            <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
                <DialogContent className="max-w-md rounded-[2.5rem] bg-card/95 border-white/10 backdrop-blur-2xl p-0 overflow-hidden shadow-2xl">
                    <div className="p-8 space-y-8">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black uppercase tracking-tighter italic">
                                {scanResult ? 'Confirmar Factura Escaneada' : 'Registrar Egreso'}
                            </DialogTitle>
                            <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                                Completa los detalles para la contabilidad inteligente.
                            </DialogDescription>
                        </DialogHeader>

                        {scanResult && (
                            <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-3xl flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                                    <CheckCircle2 className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase text-emerald-500 tracking-wider">IA Organizadora Activa</p>
                                    <p className="text-[11px] font-bold text-muted-foreground">Factura procesada. La IA ha clasificado este gasto en la carpeta: <span className="text-foreground italic">"{scanResult.metadata?.carpeta}"</span></p>
                                </div>
                            </div>
                        )}

                        <div className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-muted-foreground ml-1 tracking-widest">Concepto / Descripción</label>
                                <div className="relative group">
                                    <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-indigo-500 transition-colors" />
                                    <Input
                                        value={newGasto.descripcion}
                                        onChange={(e) => setNewGasto({ ...newGasto, descripcion: e.target.value })}
                                        placeholder="EJ: PAGO SERVICIO AGUA ENERO"
                                        className="pl-12 h-12 bg-white/5 border-white/10 rounded-2xl font-black uppercase text-xs"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground ml-1 tracking-widest">Monto Total</label>
                                    <div className="relative group">
                                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-indigo-500 transition-colors" />
                                        <Input
                                            type="number"
                                            value={newGasto.monto || ''}
                                            onChange={(e) => setNewGasto({ ...newGasto, monto: parseFloat(e.target.value) })}
                                            placeholder="0.00"
                                            className="pl-12 h-12 bg-white/5 border-white/10 rounded-2xl font-black text-xs"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground ml-1 tracking-widest">Categoría</label>
                                    <Select value={newGasto.categoria} onValueChange={(v) => setNewGasto({ ...newGasto, categoria: v as GastoCategoria })}>
                                        <SelectTrigger className="h-12 bg-white/5 border-white/10 rounded-2xl font-black uppercase text-[10px]">
                                            <SelectValue placeholder="SELECCIONAR" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-2xl border-white/10 bg-slate-900 text-white">
                                            {CATEGORIAS_GASTOS.map(cat => (
                                                <SelectItem key={cat.value} value={cat.value} className="font-black uppercase text-[10px] focus:bg-indigo-600 focus:text-white rounded-xl m-1">
                                                    {cat.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground ml-1 tracking-widest">Método de Pago</label>
                                    <Select value={newGasto.metodoPago} onValueChange={(v) => setNewGasto({ ...newGasto, metodoPago: v as MetodoPago })}>
                                        <SelectTrigger className="h-12 bg-white/5 border-white/10 rounded-2xl font-black uppercase text-[10px]">
                                            <SelectValue placeholder="SELECCIONAR" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-2xl border-white/10 bg-slate-900 text-white">
                                            {['efectivo', 'tarjeta', 'transferencia', 'otro'].map(m => (
                                                <SelectItem key={m} value={m} className="font-black uppercase text-[10px] focus:bg-indigo-600 focus:text-white rounded-xl m-1">
                                                    {m}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground ml-1 tracking-widest">Fecha</label>
                                    <div className="relative group">
                                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-indigo-500 transition-colors" />
                                        <Input
                                            type="date"
                                            value={newGasto.fecha}
                                            onChange={(e) => setNewGasto({ ...newGasto, fecha: e.target.value })}
                                            className="pl-12 h-12 bg-white/5 border-white/10 rounded-2xl font-black text-xs"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Button
                                variant="outline"
                                className="flex-1 h-14 rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 font-black uppercase text-xs"
                                onClick={() => setShowAddModal(false)}
                            >
                                Cancelar
                            </Button>
                            <Button
                                className="flex-1 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-indigo-600/20"
                                onClick={handleSaveGasto}
                                disabled={isSaving}
                            >
                                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : scanResult ? 'Confirmar y Guardar' : 'Guardar Egreso'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
