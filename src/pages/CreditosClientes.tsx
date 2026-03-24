import { useState, useMemo, useRef } from 'react';
import {
    CreditCard, Plus, Search, Trash2, DollarSign,
    CheckCircle, Clock, AlertTriangle, ChevronDown, ChevronUp,
    Camera, ShoppingCart, X, Package, Image, UserCircle2, Scissors
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { toast } from 'sonner';
import type {
    CreditoCliente, CreditoTrabajador, MetodoPago,
    Usuario, Producto, ItemCredito, Trabajador, TrabajadorRol
} from '@/types';

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface CreditosClientesProps {
    // Créditos clientes
    creditosClientes: CreditoCliente[];
    onAddCreditoCliente: (c: Omit<CreditoCliente, 'id' | 'createdAt'>) => Promise<void>;
    onUpdateCreditoCliente: (id: string, updates: Partial<CreditoCliente>) => Promise<void>;
    onDeleteCreditoCliente: (id: string) => Promise<void>;
    onRegistrarPagoCredito: (creditoId: string, pago: { monto: number; fecha: string; metodoPago: MetodoPago; nota?: string }) => Promise<void>;
    // Créditos trabajadores
    creditosTrabajadores: CreditoTrabajador[];
    onAddCreditoTrabajador: (c: Omit<CreditoTrabajador, 'id' | 'createdAt'>) => Promise<void>;
    onUpdateCreditoTrabajador: (id: string, updates: Partial<CreditoTrabajador>) => Promise<void>;
    onDeleteCreditoTrabajador: (id: string) => Promise<void>;
    onRegistrarPagoCreditoTrabajador: (creditoId: string, pago: { monto: number; fecha: string; metodoPago: MetodoPago; nota?: string }) => Promise<void>;
    // Comunes
    formatCurrency: (value: number) => string;
    usuario: Usuario;
    productos: Producto[];
    trabajadores: Trabajador[];
    onGoToTrabajadores?: () => void;
}

type Tab = 'clientes' | 'trabajadores';

// ─── Mapas visuales ─────────────────────────────────────────────────────────

const ESTADO_COLOR_CLIENTE: Record<string, string> = {
    activo: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    pagado: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    vencido: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

const ESTADO_COLOR_TRABAJADOR: Record<string, string> = {
    activo: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    pagado: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    descontado: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
};

const ROL_COLOR: Record<TrabajadorRol, string> = {
    panadero: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    vendedor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    cajero: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    repartidor: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    administrador: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
    otro: 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300',
};

const ROL_LABEL: Record<TrabajadorRol, string> = {
    panadero: 'Panadero',
    vendedor: 'Vendedor',
    cajero: 'Cajero/a',
    repartidor: 'Repartidor',
    administrador: 'Administrador',
    otro: 'Otro',
};

// ─── Utilidades ─────────────────────────────────────────────────────────────

async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════

export default function CreditosClientes({
    creditosClientes,
    onAddCreditoCliente,
    onDeleteCreditoCliente,
    onRegistrarPagoCredito,
    creditosTrabajadores,
    onAddCreditoTrabajador,
    onDeleteCreditoTrabajador,
    onRegistrarPagoCreditoTrabajador,
    formatCurrency,
    usuario,
    productos,
    trabajadores,
    onGoToTrabajadores,
}: CreditosClientesProps) {

    const [tab, setTab] = useState<Tab>('clientes');

    // ── Estado tab clientes ────────────────────────────────────────────────
    const [searchCliente, setSearchCliente] = useState('');
    const [filtroEstadoCliente, setFiltroEstadoCliente] = useState<string>('todos');
    const [showFormModal, setShowFormModal] = useState(false);
    const [showPagoClienteModal, setShowPagoClienteModal] = useState(false);
    const [showFotoModal, setShowFotoModal] = useState<string | null>(null);
    const [expandedClienteId, setExpandedClienteId] = useState<string | null>(null);
    const [selectedCredito, setSelectedCredito] = useState<CreditoCliente | null>(null);
    const [isSavingCliente, setIsSavingCliente] = useState(false);
    const fileInputClienteRef = useRef<HTMLInputElement>(null);

    const [formCliente, setFormCliente] = useState({
        clienteNombre: '',
        clienteTelefono: '',
        descripcion: '',
        fecha: new Date().toISOString().split('T')[0],
        fechaVencimiento: '',
    });
    const [itemsCliente, setItemsCliente] = useState<ItemCredito[]>([]);
    const [fotoEvidenciaCliente, setFotoEvidenciaCliente] = useState<string | undefined>(undefined);
    const [buscarProducto, setBuscarProducto] = useState('');
    const [formPagoCliente, setFormPagoCliente] = useState({
        monto: '',
        fecha: new Date().toISOString().split('T')[0],
        metodoPago: 'efectivo' as MetodoPago,
        nota: '',
    });

    // ── Estado tab trabajadores ───────────────────────────────────────────
    const [searchTrabajador, setSearchTrabajador] = useState('');
    const [filtroEstadoTrabajador, setFiltroEstadoTrabajador] = useState<string>('todos');
    const [showCreditoTrabModal, setShowCreditoTrabModal] = useState(false);
    const [showPagoTrabModal, setShowPagoTrabModal] = useState(false);
    const [expandedTrabId, setExpandedTrabId] = useState<string | null>(null);
    const [selectedCreditoTrab, setSelectedCreditoTrab] = useState<CreditoTrabajador | null>(null);
    const [isSavingTrab, setIsSavingTrab] = useState(false);
    const fileInputTrabRef = useRef<HTMLInputElement>(null);

    const [formTrab, setFormTrab] = useState({
        trabajadorId: '',
        descripcion: '',
        fecha: new Date().toISOString().split('T')[0],
        descontarDeSalario: true,
    });
    const [itemsTrab, setItemsTrab] = useState<ItemCredito[]>([]);
    const [buscarProductoTrab, setBuscarProductoTrab] = useState('');
    const [fotoEvidenciaTrab, setFotoEvidenciaTrab] = useState<string | undefined>(undefined);
    const [formPagoTrab, setFormPagoTrab] = useState({
        monto: '',
        fecha: new Date().toISOString().split('T')[0],
        metodoPago: 'efectivo' as MetodoPago,
        nota: '',
    });

    // ── Cómputos ──────────────────────────────────────────────────────────

    const montoTotalCliente = useMemo(() => itemsCliente.reduce((s, i) => s + i.subtotal, 0), [itemsCliente]);

    const creditosClienteFiltrados = useMemo(() => {
        return creditosClientes.filter(c => {
            const q = searchCliente.toLowerCase();
            const matchSearch = c.clienteNombre.toLowerCase().includes(q) || c.descripcion.toLowerCase().includes(q);
            const matchEstado = filtroEstadoCliente === 'todos' || c.estado === filtroEstadoCliente;
            return matchSearch && matchEstado;
        }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [creditosClientes, searchCliente, filtroEstadoCliente]);

    const statsCliente = useMemo(() => {
        const activos = creditosClientes.filter(c => c.estado === 'activo');
        const vencidos = creditosClientes.filter(c => c.estado === 'vencido');
        const totalPendiente = [...activos, ...vencidos].reduce((s, c) => s + c.saldo, 0);
        return { activos: activos.length, vencidos: vencidos.length, totalPendiente };
    }, [creditosClientes]);

    const productosFiltrados = useMemo(() => {
        const q = buscarProducto.toLowerCase();
        return q ? productos.filter(p => p.nombre.toLowerCase().includes(q)).slice(0, 8) : [];
    }, [productos, buscarProducto]);

    const creditosTrabFiltrados = useMemo(() => {
        return creditosTrabajadores.filter(c => {
            const q = searchTrabajador.toLowerCase();
            const matchSearch = c.trabajadorNombre.toLowerCase().includes(q) || c.descripcion.toLowerCase().includes(q);
            const matchEstado = filtroEstadoTrabajador === 'todos' || c.estado === filtroEstadoTrabajador;
            return matchSearch && matchEstado;
        }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [creditosTrabajadores, searchTrabajador, filtroEstadoTrabajador]);

    const statsTrab = useMemo(() => {
        const activos = creditosTrabajadores.filter(c => c.estado === 'activo');
        const totalPendiente = activos.reduce((s, c) => s + c.saldo, 0);
        return { activos: activos.length, total: creditosTrabajadores.length, totalPendiente };
    }, [creditosTrabajadores]);

    const trabajadorSeleccionado = useMemo(() =>
        trabajadores.find(t => t.id === formTrab.trabajadorId),
        [trabajadores, formTrab.trabajadorId]
    );

    // ── Lógica clientes ───────────────────────────────────────────────────

    const agregarProducto = (p: Producto) => {
        setItemsCliente(prev => {
            const existe = prev.find(i => i.productoId === p.id);
            if (existe) {
                return prev.map(i => i.productoId === p.id
                    ? { ...i, cantidad: i.cantidad + 1, subtotal: (i.cantidad + 1) * i.precioUnitario }
                    : i);
            }
            return [...prev, { productoId: p.id, nombre: p.nombre, cantidad: 1, precioUnitario: p.precioVenta, subtotal: p.precioVenta }];
        });
        setBuscarProducto('');
    };

    const cambiarCantidad = (productoId: string, cantidad: number) => {
        if (cantidad <= 0) {
            setItemsCliente(prev => prev.filter(i => i.productoId !== productoId));
        } else {
            setItemsCliente(prev => prev.map(i => i.productoId === productoId
                ? { ...i, cantidad, subtotal: cantidad * i.precioUnitario } : i));
        }
    };

    const handleFotoCliente = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            setFotoEvidenciaCliente(await fileToBase64(file));
            toast.success('Foto capturada');
        } catch { toast.error('Error al capturar foto'); }
    };

    const resetFormCliente = () => {
        setFormCliente({ clienteNombre: '', clienteTelefono: '', descripcion: '', fecha: new Date().toISOString().split('T')[0], fechaVencimiento: '' });
        setItemsCliente([]);
        setFotoEvidenciaCliente(undefined);
        setBuscarProducto('');
    };

    const handleGuardarCredito = async () => {
        if (!formCliente.clienteNombre.trim()) { toast.error('El nombre del cliente es obligatorio'); return; }
        if (itemsCliente.length === 0) { toast.error('Agrega al menos un producto al crédito'); return; }
        setIsSavingCliente(true);
        try {
            await onAddCreditoCliente({
                clienteNombre: formCliente.clienteNombre.trim(),
                clienteTelefono: formCliente.clienteTelefono.trim() || undefined,
                monto: montoTotalCliente,
                saldo: montoTotalCliente,
                descripcion: formCliente.descripcion.trim() || itemsCliente.map(i => `${i.cantidad}x ${i.nombre}`).join(', '),
                fecha: formCliente.fecha,
                fechaVencimiento: formCliente.fechaVencimiento || undefined,
                estado: 'activo',
                items: itemsCliente,
                fotoEvidencia: fotoEvidenciaCliente,
                pagos: [],
                usuarioId: usuario.id,
            });
            setShowFormModal(false);
            resetFormCliente();
            toast.success(`Crédito de ${formatCurrency(montoTotalCliente)} registrado`);
        } catch { toast.error('Error al registrar crédito'); }
        finally { setIsSavingCliente(false); }
    };

    const handlePagoCliente = async () => {
        if (!selectedCredito) return;
        const monto = parseFloat(formPagoCliente.monto);
        if (isNaN(monto) || monto <= 0) { toast.error('Monto inválido'); return; }
        if (monto > selectedCredito.saldo) { toast.error(`Máximo: ${formatCurrency(selectedCredito.saldo)}`); return; }
        setIsSavingCliente(true);
        try {
            await onRegistrarPagoCredito(selectedCredito.id, {
                monto, fecha: formPagoCliente.fecha,
                metodoPago: formPagoCliente.metodoPago, nota: formPagoCliente.nota || undefined,
            });
            setShowPagoClienteModal(false);
            setSelectedCredito(null);
            setFormPagoCliente({ monto: '', fecha: new Date().toISOString().split('T')[0], metodoPago: 'efectivo', nota: '' });
            toast.success(`Pago de ${formatCurrency(monto)} registrado`);
        } catch { toast.error('Error al registrar pago'); }
        finally { setIsSavingCliente(false); }
    };

    // ── Lógica trabajadores ───────────────────────────────────────────────

    const handleFotoTrab = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            setFotoEvidenciaTrab(await fileToBase64(file));
            toast.success('Foto de evidencia capturada');
        } catch { toast.error('Error al capturar foto'); }
    };

    const montoTotalTrab = useMemo(() => itemsTrab.reduce((s, i) => s + i.subtotal, 0), [itemsTrab]);

    const productosFiltradosTrab = useMemo(() => {
        const q = buscarProductoTrab.toLowerCase();
        return q ? productos.filter(p => p.nombre.toLowerCase().includes(q)).slice(0, 8) : [];
    }, [productos, buscarProductoTrab]);

    const agregarProductoTrab = (p: Producto) => {
        setItemsTrab(prev => {
            const existe = prev.find(i => i.productoId === p.id);
            if (existe) {
                return prev.map(i => i.productoId === p.id
                    ? { ...i, cantidad: i.cantidad + 1, subtotal: (i.cantidad + 1) * i.precioUnitario }
                    : i);
            }
            return [...prev, { productoId: p.id, nombre: p.nombre, cantidad: 1, precioUnitario: p.precioVenta, subtotal: p.precioVenta }];
        });
        setBuscarProductoTrab('');
    };

    const cambiarCantidadTrab = (productoId: string, cantidad: number) => {
        if (cantidad <= 0) {
            setItemsTrab(prev => prev.filter(i => i.productoId !== productoId));
        } else {
            setItemsTrab(prev => prev.map(i => i.productoId === productoId
                ? { ...i, cantidad, subtotal: cantidad * i.precioUnitario } : i));
        }
    };

    const resetFormTrab = () => {
        setFormTrab({ trabajadorId: '', descripcion: '', fecha: new Date().toISOString().split('T')[0], descontarDeSalario: true });
        setItemsTrab([]);
        setBuscarProductoTrab('');
        setFotoEvidenciaTrab(undefined);
    };

    const handleGuardarCreditoTrab = async () => {
        if (!formTrab.trabajadorId) { toast.error('Selecciona un trabajador'); return; }
        if (itemsTrab.length === 0) { toast.error('Agrega al menos un producto al crédito'); return; }
        if (!fotoEvidenciaTrab) { toast.error('La foto de evidencia es obligatoria'); return; }
        const monto = montoTotalTrab;
        setIsSavingTrab(true);
        try {
            const descripcionAuto = formTrab.descripcion.trim() || itemsTrab.map(i => `${i.cantidad}x ${i.nombre}`).join(', ');
            await onAddCreditoTrabajador({
                trabajadorId: formTrab.trabajadorId,
                trabajadorNombre: trabajadorSeleccionado?.nombre || '',
                trabajadorRol: trabajadorSeleccionado?.rol,
                monto,
                saldo: monto,
                descripcion: descripcionAuto,
                fecha: formTrab.fecha,
                estado: 'activo',
                items: itemsTrab,
                fotoEvidencia: fotoEvidenciaTrab,
                descontarDeSalario: formTrab.descontarDeSalario,
                pagos: [],
                usuarioId: usuario.id,
            });
            setShowCreditoTrabModal(false);
            resetFormTrab();
            toast.success(`Crédito de ${formatCurrency(monto)} registrado — inventario actualizado`);
        } catch { toast.error('Error al registrar crédito'); }
        finally { setIsSavingTrab(false); }
    };

    const handlePagoTrab = async () => {
        if (!selectedCreditoTrab) return;
        const monto = parseFloat(formPagoTrab.monto);
        if (isNaN(monto) || monto <= 0) { toast.error('Monto inválido'); return; }
        if (monto > selectedCreditoTrab.saldo) { toast.error(`Máximo: ${formatCurrency(selectedCreditoTrab.saldo)}`); return; }
        setIsSavingTrab(true);
        try {
            await onRegistrarPagoCreditoTrabajador(selectedCreditoTrab.id, {
                monto, fecha: formPagoTrab.fecha,
                metodoPago: formPagoTrab.metodoPago, nota: formPagoTrab.nota || undefined,
            });
            setShowPagoTrabModal(false);
            setSelectedCreditoTrab(null);
            setFormPagoTrab({ monto: '', fecha: new Date().toISOString().split('T')[0], metodoPago: 'efectivo', nota: '' });
            toast.success(`Pago de ${formatCurrency(monto)} registrado`);
        } catch { toast.error('Error al registrar pago'); }
        finally { setIsSavingTrab(false); }
    };

    // ════════════════════════════════════════════════════════════════════════
    // RENDER
    // ════════════════════════════════════════════════════════════════════════

    return (
        <div className="min-h-full flex flex-col gap-5 p-4 bg-slate-50 dark:bg-slate-950 animate-ag-fade-in">

            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 px-5 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900 dark:text-white">Créditos</h1>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            Clientes y trabajadores
                        </p>
                    </div>
                </div>
                {tab === 'clientes' ? (
                    <Button
                        onClick={() => { resetFormCliente(); setShowFormModal(true); }}
                        className="h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg gap-2 font-black uppercase tracking-widest text-xs border-none"
                    >
                        <Plus className="w-4 h-4" /> Registrar Crédito Cliente
                    </Button>
                ) : (
                    <Button
                        onClick={() => { resetFormTrab(); setShowCreditoTrabModal(true); }}
                        className="h-10 px-6 bg-violet-600 hover:bg-violet-700 text-white rounded-xl shadow-lg gap-2 font-black uppercase tracking-widest text-xs border-none"
                    >
                        <Plus className="w-4 h-4" /> Registrar Crédito Trabajador
                    </Button>
                )}
            </div>

            {/* ── Tabs ── */}
            <div className="flex gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <button
                    onClick={() => setTab('clientes')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                        tab === 'clientes'
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                >
                    <CreditCard className="w-3.5 h-3.5" /> Clientes
                    {statsCliente.activos > 0 && (
                        <Badge className="text-[9px] border-none px-1.5 py-0 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            {statsCliente.activos}
                        </Badge>
                    )}
                </button>
                <button
                    onClick={() => setTab('trabajadores')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                        tab === 'trabajadores'
                            ? 'bg-violet-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                >
                    <UserCircle2 className="w-3.5 h-3.5" /> Trabajadores
                    {statsTrab.activos > 0 && (
                        <Badge className="text-[9px] border-none px-1.5 py-0 bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                            {statsTrab.activos}
                        </Badge>
                    )}
                </button>
            </div>

            {/* ════════════════════════════════════════════════════════════
                TAB — CLIENTES
            ════════════════════════════════════════════════════════════ */}
            {tab === 'clientes' && (
                <>
                    {/* KPIs */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {[
                            { label: 'Créditos activos', value: statsCliente.activos, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/20' },
                            { label: 'Vencidos', value: statsCliente.vencidos, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/20' },
                            { label: 'Total pendiente', value: formatCurrency(statsCliente.totalPendiente), color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/20' },
                        ].map(kpi => (
                            <Card key={kpi.label} className={`${kpi.bg} border-none shadow-sm rounded-2xl`}>
                                <CardContent className="p-4 text-center">
                                    <p className={`text-2xl font-black ${kpi.color}`}>{kpi.value}</p>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">{kpi.label}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Filtros */}
                    <div className="flex gap-3 flex-wrap">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar cliente o descripción..."
                                value={searchCliente}
                                onChange={e => setSearchCliente(e.target.value)}
                                className="pl-9 rounded-xl"
                            />
                        </div>
                        <Select value={filtroEstadoCliente} onValueChange={setFiltroEstadoCliente}>
                            <SelectTrigger className="w-36 rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Todos</SelectItem>
                                <SelectItem value="activo">Activos</SelectItem>
                                <SelectItem value="vencido">Vencidos</SelectItem>
                                <SelectItem value="pagado">Pagados</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Lista créditos clientes */}
                    <div className="flex-1 space-y-3 overflow-y-auto">
                        {creditosClienteFiltrados.length === 0 ? (
                            <Card className="rounded-2xl border-dashed">
                                <CardContent className="p-12 text-center text-muted-foreground">
                                    <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-30" />
                                    <p className="font-bold uppercase tracking-widest text-xs">
                                        {searchCliente || filtroEstadoCliente !== 'todos' ? 'Sin resultados' : 'No hay créditos de clientes'}
                                    </p>
                                </CardContent>
                            </Card>
                        ) : creditosClienteFiltrados.map(credito => (
                            <Card key={credito.id} className="rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-black text-base text-gray-900 dark:text-white truncate">{credito.clienteNombre}</span>
                                                <Badge className={`${ESTADO_COLOR_CLIENTE[credito.estado]} text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 border-none`}>
                                                    {credito.estado === 'activo' && <Clock className="w-3 h-3" />}
                                                    {credito.estado === 'pagado' && <CheckCircle className="w-3 h-3" />}
                                                    {credito.estado === 'vencido' && <AlertTriangle className="w-3 h-3" />}
                                                    {credito.estado}
                                                </Badge>
                                                {credito.fotoEvidencia && (
                                                    <button
                                                        onClick={() => setShowFotoModal(credito.fotoEvidencia!)}
                                                        className="flex items-center gap-1 text-[10px] font-bold text-blue-500 hover:text-blue-700 uppercase tracking-widest"
                                                    >
                                                        <Image className="w-3 h-3" /> Ver foto
                                                    </button>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{credito.descripcion}</p>
                                            <div className="flex items-center gap-4 mt-2">
                                                <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Original: {formatCurrency(credito.monto)}</span>
                                                <span className="text-sm font-black text-blue-600 dark:text-blue-400">Saldo: {formatCurrency(credito.saldo)}</span>
                                            </div>
                                            {credito.clienteTelefono && <p className="text-xs text-muted-foreground mt-0.5">📞 {credito.clienteTelefono}</p>}
                                            {credito.fechaVencimiento && <p className="text-xs text-muted-foreground mt-0.5">⏰ Vence: {credito.fechaVencimiento}</p>}

                                            {/* Items expandidos */}
                                            {expandedClienteId === credito.id && credito.items && credito.items.length > 0 && (
                                                <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">
                                                        <Package className="inline w-3 h-3 mr-1" />Productos fiados
                                                    </p>
                                                    {credito.items.map(item => (
                                                        <div key={item.productoId} className="flex justify-between items-center text-xs py-0.5">
                                                            <span className="text-muted-foreground">{item.cantidad}x {item.nombre}</span>
                                                            <span className="font-bold text-slate-700 dark:text-slate-300">{formatCurrency(item.subtotal)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {credito.estado !== 'pagado' && (
                                                <Button
                                                    size="sm"
                                                    onClick={() => { setSelectedCredito(credito); setShowPagoClienteModal(true); }}
                                                    className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black border-none"
                                                >
                                                    <DollarSign className="w-3 h-3 mr-1" /> Pago
                                                </Button>
                                            )}
                                            <Button size="sm" variant="ghost"
                                                onClick={() => setExpandedClienteId(expandedClienteId === credito.id ? null : credito.id)}
                                                className="h-8 w-8 p-0 rounded-xl">
                                                {expandedClienteId === credito.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                            </Button>
                                            <Button size="sm" variant="ghost"
                                                onClick={async () => { await onDeleteCreditoCliente(credito.id); toast.success('Crédito eliminado'); }}
                                                className="h-8 w-8 p-0 rounded-xl text-red-500 hover:text-red-700 hover:bg-red-50">
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Pagos expandidos */}
                                    {expandedClienteId === credito.id && credito.pagos.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-1">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Pagos realizados</p>
                                            {credito.pagos.map(pago => (
                                                <div key={pago.id} className="flex justify-between items-center text-xs py-1 px-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                                                    <span className="text-muted-foreground">{pago.fecha}</span>
                                                    <span className="font-bold text-emerald-600">{formatCurrency(pago.monto)}</span>
                                                    <span className="text-muted-foreground capitalize">{pago.metodoPago}</span>
                                                    {pago.nota && <span className="text-muted-foreground italic text-[10px]">{pago.nota}</span>}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {expandedClienteId === credito.id && credito.pagos.length === 0 && (
                                        <p className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs text-muted-foreground text-center">Sin pagos registrados aún</p>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </>
            )}

            {/* ════════════════════════════════════════════════════════════
                TAB — TRABAJADORES
            ════════════════════════════════════════════════════════════ */}
            {tab === 'trabajadores' && (
                <>
                    {/* KPIs */}
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { label: 'Créditos activos', value: statsTrab.activos, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/20' },
                            { label: 'Total créditos', value: statsTrab.total, color: 'text-slate-700 dark:text-slate-300', bg: 'bg-slate-50 dark:bg-slate-900/50' },
                            { label: 'Total pendiente', value: formatCurrency(statsTrab.totalPendiente), color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/20' },
                        ].map(kpi => (
                            <Card key={kpi.label} className={`${kpi.bg} border-none shadow-sm rounded-2xl`}>
                                <CardContent className="p-4 text-center">
                                    <p className={`text-xl font-black ${kpi.color}`}>{kpi.value}</p>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">{kpi.label}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Filtros */}
                    <div className="flex gap-3 flex-wrap">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar trabajador o descripción..."
                                value={searchTrabajador}
                                onChange={e => setSearchTrabajador(e.target.value)}
                                className="pl-9 rounded-xl"
                            />
                        </div>
                        <Select value={filtroEstadoTrabajador} onValueChange={setFiltroEstadoTrabajador}>
                            <SelectTrigger className="w-36 rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Todos</SelectItem>
                                <SelectItem value="activo">Activos</SelectItem>
                                <SelectItem value="descontado">Descontados</SelectItem>
                                <SelectItem value="pagado">Pagados</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Banner: sin trabajadores */}
                    {trabajadores.filter(t => t.estado === 'activo').length === 0 && (
                        <div className="flex items-center gap-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border-2 border-dashed border-amber-300 dark:border-amber-700">
                            <UserCircle2 className="w-8 h-8 text-amber-400 shrink-0" />
                            <div className="flex-1">
                                <p className="text-sm font-black text-amber-700 dark:text-amber-300">Sin trabajadores activos</p>
                                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                                    Ve a <strong>Administración → Trabajadores</strong> para crear empleados primero.
                                </p>
                            </div>
                            {onGoToTrabajadores && (
                                <Button
                                    onClick={onGoToTrabajadores}
                                    className="h-9 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black border-none shrink-0 gap-1.5"
                                >
                                    <UserCircle2 className="w-3.5 h-3.5" /> Ir ahora
                                </Button>
                            )}
                        </div>
                    )}

                    {/* Lista créditos trabajadores */}
                    <div className="flex-1 space-y-3 overflow-y-auto">
                        {creditosTrabFiltrados.length === 0 ? (
                            <Card className="rounded-2xl border-dashed">
                                <CardContent className="p-12 text-center text-muted-foreground">
                                    <UserCircle2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
                                    <p className="font-bold uppercase tracking-widest text-xs">
                                        {searchTrabajador || filtroEstadoTrabajador !== 'todos' ? 'Sin resultados' : 'No hay créditos de trabajadores'}
                                    </p>
                                </CardContent>
                            </Card>
                        ) : creditosTrabFiltrados.map(credito => (
                            <Card key={credito.id} className="rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-black text-base text-gray-900 dark:text-white truncate">{credito.trabajadorNombre}</span>
                                                {credito.trabajadorRol && (
                                                    <Badge className={`${ROL_COLOR[credito.trabajadorRol as TrabajadorRol] || ''} text-[9px] font-bold uppercase tracking-widest border-none`}>
                                                        {ROL_LABEL[credito.trabajadorRol as TrabajadorRol] || credito.trabajadorRol}
                                                    </Badge>
                                                )}
                                                <Badge className={`${ESTADO_COLOR_TRABAJADOR[credito.estado]} text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 border-none`}>
                                                    {credito.estado === 'activo' && <Clock className="w-3 h-3" />}
                                                    {credito.estado === 'pagado' && <CheckCircle className="w-3 h-3" />}
                                                    {credito.estado === 'descontado' && <Scissors className="w-3 h-3" />}
                                                    {credito.estado}
                                                </Badge>
                                                {credito.descontarDeSalario && credito.estado === 'activo' && (
                                                    <span className="text-[9px] font-bold text-violet-500 uppercase tracking-widest flex items-center gap-0.5">
                                                        <Scissors className="w-2.5 h-2.5" /> Descuenta de nómina
                                                    </span>
                                                )}
                                                {credito.fotoEvidencia && (
                                                    <button
                                                        onClick={() => setShowFotoModal(credito.fotoEvidencia!)}
                                                        className="flex items-center gap-1 text-[10px] font-bold text-blue-500 hover:text-blue-700 uppercase tracking-widest"
                                                    >
                                                        <Image className="w-3 h-3" /> Ver foto
                                                    </button>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{credito.descripcion}</p>
                                            <div className="flex items-center gap-4 mt-2">
                                                <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Deuda: {formatCurrency(credito.monto)}</span>
                                                <span className="text-sm font-black text-violet-600 dark:text-violet-400">Saldo: {formatCurrency(credito.saldo)}</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-0.5">📅 {credito.fecha}</p>

                                            {/* Items expandidos */}
                                            {expandedTrabId === credito.id && credito.items && credito.items.length > 0 && (
                                                <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">
                                                        <Package className="inline w-3 h-3 mr-1" />Productos tomados
                                                    </p>
                                                    {credito.items.map(item => (
                                                        <div key={item.productoId} className="flex justify-between items-center text-xs py-0.5">
                                                            <span className="text-muted-foreground">{item.cantidad}x {item.nombre}</span>
                                                            <span className="font-bold text-slate-700 dark:text-slate-300">{formatCurrency(item.subtotal)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Foto expandida */}
                                            {credito.fotoEvidencia && expandedTrabId === credito.id && (
                                                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                                                    <button onClick={() => setShowFotoModal(credito.fotoEvidencia!)}>
                                                        <img src={credito.fotoEvidencia} alt="Evidencia" className="h-28 rounded-xl object-cover border border-slate-200 dark:border-slate-700" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {credito.estado === 'activo' && (
                                                <Button
                                                    size="sm"
                                                    onClick={() => { setSelectedCreditoTrab(credito); setShowPagoTrabModal(true); }}
                                                    className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black border-none"
                                                >
                                                    <DollarSign className="w-3 h-3 mr-1" /> Pago
                                                </Button>
                                            )}
                                            <Button size="sm" variant="ghost"
                                                onClick={() => setExpandedTrabId(expandedTrabId === credito.id ? null : credito.id)}
                                                className="h-8 w-8 p-0 rounded-xl">
                                                {expandedTrabId === credito.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                            </Button>
                                            <Button size="sm" variant="ghost"
                                                onClick={async () => { await onDeleteCreditoTrabajador(credito.id); toast.success('Crédito eliminado'); }}
                                                className="h-8 w-8 p-0 rounded-xl text-red-500 hover:text-red-700 hover:bg-red-50">
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Pagos expandidos */}
                                    {expandedTrabId === credito.id && credito.pagos.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-1">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Pagos realizados</p>
                                            {credito.pagos.map(pago => (
                                                <div key={pago.id} className="flex justify-between items-center text-xs py-1 px-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                                                    <span className="text-muted-foreground">{pago.fecha}</span>
                                                    <span className="font-bold text-emerald-600">{formatCurrency(pago.monto)}</span>
                                                    <span className="text-muted-foreground capitalize">{pago.metodoPago}</span>
                                                    {pago.nota && <span className="text-muted-foreground italic text-[10px]">{pago.nota}</span>}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {expandedTrabId === credito.id && credito.pagos.length === 0 && (
                                        <p className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs text-muted-foreground text-center">Sin pagos registrados</p>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </>
            )}

            {/* ════════════════════════════════════════════════════════════
                MODALES GLOBALES
            ════════════════════════════════════════════════════════════ */}

            {/* Ver Foto */}
            <Dialog open={!!showFotoModal} onOpenChange={() => setShowFotoModal(null)}>
                <DialogContent className="rounded-3xl max-w-sm p-3">
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase tracking-tight text-sm">Evidencia del crédito</DialogTitle>
                    </DialogHeader>
                    {showFotoModal && <img src={showFotoModal} alt="Evidencia" className="w-full rounded-2xl object-cover max-h-96" />}
                </DialogContent>
            </Dialog>

            {/* Nuevo Crédito Cliente */}
            <Dialog open={showFormModal} onOpenChange={v => { if (!v) resetFormCliente(); setShowFormModal(v); }}>
                <DialogContent className="rounded-3xl max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase tracking-tight">Nuevo Crédito a Cliente</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <Label className="text-xs font-bold uppercase tracking-widest">Nombre del cliente *</Label>
                                <Input placeholder="ej: María García" value={formCliente.clienteNombre}
                                    onChange={e => setFormCliente(p => ({ ...p, clienteNombre: e.target.value }))} className="mt-1" />
                            </div>
                            <div>
                                <Label className="text-xs font-bold uppercase tracking-widest">Teléfono</Label>
                                <Input placeholder="ej: 300 123 4567" value={formCliente.clienteTelefono}
                                    onChange={e => setFormCliente(p => ({ ...p, clienteTelefono: e.target.value }))} className="mt-1" />
                            </div>
                            <div>
                                <Label className="text-xs font-bold uppercase tracking-widest">Fecha</Label>
                                <Input type="date" value={formCliente.fecha}
                                    onChange={e => setFormCliente(p => ({ ...p, fecha: e.target.value }))} className="mt-1" />
                            </div>
                        </div>

                        {/* Selector productos */}
                        <div>
                            <Label className="text-xs font-bold uppercase tracking-widest flex items-center gap-1">
                                <ShoppingCart className="w-3 h-3" /> Productos fiados *
                            </Label>
                            <div className="relative mt-1">
                                <Input placeholder="Buscar producto del catálogo..." value={buscarProducto}
                                    onChange={e => setBuscarProducto(e.target.value)} />
                                {productosFiltrados.length > 0 && (
                                    <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden">
                                        {productosFiltrados.map(p => (
                                            <button key={p.id} onClick={() => agregarProducto(p)}
                                                className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors">
                                                <span className="font-bold text-slate-800 dark:text-slate-200">{p.nombre}</span>
                                                <span className="text-blue-600 font-black">{formatCurrency(p.precioVenta)}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {itemsCliente.length > 0 && (
                                <div className="mt-2 space-y-1.5 border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50 dark:bg-slate-900/50">
                                    {itemsCliente.map(item => (
                                        <div key={item.productoId} className="flex items-center gap-2 text-xs">
                                            <span className="flex-1 font-bold text-slate-700 dark:text-slate-300 truncate">{item.nombre}</span>
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => cambiarCantidad(item.productoId, item.cantidad - 1)}
                                                    className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 font-black text-sm flex items-center justify-center">-</button>
                                                <span className="w-5 text-center font-black">{item.cantidad}</span>
                                                <button onClick={() => cambiarCantidad(item.productoId, item.cantidad + 1)}
                                                    className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 font-black text-sm flex items-center justify-center">+</button>
                                            </div>
                                            <span className="font-black text-blue-600 w-16 text-right">{formatCurrency(item.subtotal)}</span>
                                            <button onClick={() => cambiarCantidad(item.productoId, 0)} className="text-red-400 hover:text-red-600">
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                    <div className="border-t border-slate-200 dark:border-slate-700 pt-1.5 mt-1.5 flex justify-between font-black text-sm">
                                        <span>Total</span>
                                        <span className="text-blue-600">{formatCurrency(montoTotalCliente)}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div>
                            <Label className="text-xs font-bold uppercase tracking-widest">Descripción adicional</Label>
                            <Input placeholder="Opcional" value={formCliente.descripcion}
                                onChange={e => setFormCliente(p => ({ ...p, descripcion: e.target.value }))} className="mt-1" />
                        </div>
                        <div>
                            <Label className="text-xs font-bold uppercase tracking-widest">Vence (opcional)</Label>
                            <Input type="date" value={formCliente.fechaVencimiento}
                                onChange={e => setFormCliente(p => ({ ...p, fechaVencimiento: e.target.value }))} className="mt-1" />
                        </div>

                        {/* Foto evidencia */}
                        <div>
                            <Label className="text-xs font-bold uppercase tracking-widest flex items-center gap-1">
                                <Camera className="w-3 h-3" /> Foto de evidencia (opcional)
                            </Label>
                            <input ref={fileInputClienteRef} type="file" accept="image/*" capture="environment"
                                className="hidden" onChange={handleFotoCliente} />
                            {fotoEvidenciaCliente ? (
                                <div className="relative mt-1">
                                    <img src={fotoEvidenciaCliente} alt="Evidencia" className="w-full h-32 object-cover rounded-xl" />
                                    <button onClick={() => setFotoEvidenciaCliente(undefined)}
                                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ) : (
                                <Button variant="outline" onClick={() => fileInputClienteRef.current?.click()}
                                    className="mt-1 w-full h-20 rounded-xl border-dashed gap-2 flex-col text-xs font-bold uppercase tracking-widest">
                                    <Camera className="w-5 h-5 opacity-50" />
                                    Tomar foto o seleccionar imagen
                                </Button>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => { resetFormCliente(); setShowFormModal(false); }}>Cancelar</Button>
                        <Button onClick={handleGuardarCredito} disabled={isSavingCliente || itemsCliente.length === 0}
                            className="bg-blue-600 hover:bg-blue-700 text-white">
                            {isSavingCliente ? 'Guardando...' : `Registrar ${itemsCliente.length > 0 ? formatCurrency(montoTotalCliente) : ''}`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Pago Cliente */}
            <Dialog open={showPagoClienteModal} onOpenChange={setShowPagoClienteModal}>
                <DialogContent className="rounded-3xl max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase tracking-tight">Registrar Pago — Cliente</DialogTitle>
                    </DialogHeader>
                    {selectedCredito && (
                        <div className="space-y-4 py-2">
                            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30">
                                <p className="font-black text-sm">{selectedCredito.clienteNombre}</p>
                                <p className="text-xs text-muted-foreground">{selectedCredito.descripcion}</p>
                                <p className="text-sm font-black text-blue-600 mt-1">Saldo: {formatCurrency(selectedCredito.saldo)}</p>
                            </div>
                            <div>
                                <Label className="text-xs font-bold uppercase tracking-widest">Monto *</Label>
                                <Input type="number" placeholder={`máx ${selectedCredito.saldo}`}
                                    value={formPagoCliente.monto}
                                    onChange={e => setFormPagoCliente(p => ({ ...p, monto: e.target.value }))} className="mt-1" />
                            </div>
                            <div>
                                <Label className="text-xs font-bold uppercase tracking-widest">Método de pago</Label>
                                <Select value={formPagoCliente.metodoPago} onValueChange={v => setFormPagoCliente(p => ({ ...p, metodoPago: v as MetodoPago }))}>
                                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="efectivo">Efectivo</SelectItem>
                                        <SelectItem value="transferencia">Transferencia</SelectItem>
                                        <SelectItem value="nequi">Nequi</SelectItem>
                                        <SelectItem value="daviplata">Daviplata</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-xs font-bold uppercase tracking-widest">Nota (opcional)</Label>
                                <Input placeholder="ej: Pago parcial" value={formPagoCliente.nota}
                                    onChange={e => setFormPagoCliente(p => ({ ...p, nota: e.target.value }))} className="mt-1" />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowPagoClienteModal(false)}>Cancelar</Button>
                        <Button onClick={handlePagoCliente} disabled={isSavingCliente}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            {isSavingCliente ? 'Guardando...' : 'Confirmar Pago'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Nuevo Crédito Trabajador */}
            <Dialog open={showCreditoTrabModal} onOpenChange={v => { if (!v) resetFormTrab(); setShowCreditoTrabModal(v); }}>
                <DialogContent className="rounded-3xl max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase tracking-tight">Nuevo Crédito a Trabajador</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
                        {/* Selector trabajador */}
                        <div>
                            <Label className="text-xs font-bold uppercase tracking-widest">Trabajador *</Label>
                            {trabajadores.filter(t => t.estado === 'activo').length === 0 ? (
                                /* Sin trabajadores registrados */
                                <div className="mt-2 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border-2 border-dashed border-amber-300 dark:border-amber-700 text-center space-y-2">
                                    <UserCircle2 className="w-8 h-8 mx-auto text-amber-400 opacity-60" />
                                    <p className="text-xs font-black text-amber-700 dark:text-amber-300">
                                        No hay trabajadores registrados
                                    </p>
                                    <p className="text-[10px] text-amber-600 dark:text-amber-400">
                                        Primero debes crear los trabajadores en el módulo de Administración
                                    </p>
                                    {onGoToTrabajadores && (
                                        <Button
                                            type="button"
                                            onClick={() => { setShowCreditoTrabModal(false); onGoToTrabajadores(); }}
                                            className="h-8 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black border-none gap-1.5"
                                        >
                                            <UserCircle2 className="w-3.5 h-3.5" /> Ir a crear trabajadores
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <Select value={formTrab.trabajadorId} onValueChange={v => setFormTrab(p => ({ ...p, trabajadorId: v }))}>
                                        <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar trabajador..." /></SelectTrigger>
                                        <SelectContent>
                                            {trabajadores.filter(t => t.estado === 'activo').map(t => (
                                                <SelectItem key={t.id} value={t.id}>
                                                    {t.nombre} — {ROL_LABEL[t.rol]}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {trabajadorSeleccionado && (
                                        <p className="text-xs text-violet-600 font-bold mt-1">
                                            💰 Salario base: {formatCurrency(trabajadorSeleccionado.salarioBase)}/mes
                                        </p>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Selector de productos */}
                        <div>
                            <Label className="text-xs font-bold uppercase tracking-widest flex items-center gap-1">
                                <Package className="w-3 h-3" /> Productos tomados *
                            </Label>
                            <div className="relative mt-1">
                                <Input
                                    placeholder="Buscar producto del catálogo..."
                                    value={buscarProductoTrab}
                                    onChange={e => setBuscarProductoTrab(e.target.value)}
                                />
                                {productosFiltradosTrab.length > 0 && (
                                    <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden">
                                        {productosFiltradosTrab.map(p => (
                                            <button key={p.id} onClick={() => agregarProductoTrab(p)}
                                                className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-colors">
                                                <span className="font-bold text-slate-800 dark:text-slate-200">{p.nombre}</span>
                                                <span className="text-violet-600 font-black">{formatCurrency(p.precioVenta)}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {itemsTrab.length > 0 && (
                                <div className="mt-2 space-y-1.5 border border-violet-200 dark:border-violet-800 rounded-xl p-3 bg-violet-50 dark:bg-violet-950/20">
                                    {itemsTrab.map(item => (
                                        <div key={item.productoId} className="flex items-center gap-2 text-xs">
                                            <span className="flex-1 font-bold text-slate-700 dark:text-slate-300 truncate">{item.nombre}</span>
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => cambiarCantidadTrab(item.productoId, item.cantidad - 1)}
                                                    className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 font-black text-sm flex items-center justify-center">-</button>
                                                <span className="w-5 text-center font-black">{item.cantidad}</span>
                                                <button onClick={() => cambiarCantidadTrab(item.productoId, item.cantidad + 1)}
                                                    className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 font-black text-sm flex items-center justify-center">+</button>
                                            </div>
                                            <span className="font-black text-violet-600 w-16 text-right">{formatCurrency(item.subtotal)}</span>
                                            <button onClick={() => cambiarCantidadTrab(item.productoId, 0)} className="text-red-400 hover:text-red-600">
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                    <div className="border-t border-violet-200 dark:border-violet-700 pt-1.5 mt-1.5 flex justify-between font-black text-sm">
                                        <span>Total a descontar</span>
                                        <span className="text-violet-600">{formatCurrency(montoTotalTrab)}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div>
                            <Label className="text-xs font-bold uppercase tracking-widest">Nota adicional (opcional)</Label>
                            <Input placeholder="ej: Para llevar a casa, merienda del día..."
                                value={formTrab.descripcion}
                                onChange={e => setFormTrab(p => ({ ...p, descripcion: e.target.value }))} className="mt-1" />
                        </div>

                        <div>
                            <Label className="text-xs font-bold uppercase tracking-widest">Fecha</Label>
                            <Input type="date" value={formTrab.fecha}
                                onChange={e => setFormTrab(p => ({ ...p, fecha: e.target.value }))} className="mt-1" />
                        </div>

                        {/* Descuento nómina */}
                        <label className="flex items-center gap-3 p-3 rounded-xl bg-violet-50 dark:bg-violet-950/20 cursor-pointer">
                            <input type="checkbox" checked={formTrab.descontarDeSalario}
                                onChange={e => setFormTrab(p => ({ ...p, descontarDeSalario: e.target.checked }))}
                                className="w-4 h-4 accent-violet-600" />
                            <div>
                                <p className="text-xs font-black text-violet-800 dark:text-violet-300">Descontar de nómina</p>
                                <p className="text-[10px] text-violet-600 dark:text-violet-400">Se descontará del próximo pago de salario</p>
                            </div>
                            <Scissors className="w-4 h-4 text-violet-500 ml-auto" />
                        </label>

                        {/* Foto evidencia (obligatoria) */}
                        <div>
                            <Label className="text-xs font-bold uppercase tracking-widest flex items-center gap-1">
                                <Camera className="w-3 h-3" /> Foto de evidencia <span className="text-red-500">*</span>
                            </Label>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Obligatoria para créditos de trabajadores</p>
                            <input ref={fileInputTrabRef} type="file" accept="image/*" capture="environment"
                                className="hidden" onChange={handleFotoTrab} />
                            {fotoEvidenciaTrab ? (
                                <div className="relative mt-2">
                                    <img src={fotoEvidenciaTrab} alt="Evidencia" className="w-full h-36 object-cover rounded-xl" />
                                    <button onClick={() => setFotoEvidenciaTrab(undefined)}
                                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ) : (
                                <Button variant="outline" onClick={() => fileInputTrabRef.current?.click()}
                                    className="mt-2 w-full h-24 rounded-xl border-dashed border-2 border-violet-200 dark:border-violet-800 gap-2 flex-col text-xs font-bold uppercase tracking-widest text-violet-600">
                                    <Camera className="w-6 h-6 opacity-60" />
                                    Tomar foto del producto tomado
                                </Button>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => { resetFormTrab(); setShowCreditoTrabModal(false); }}>Cancelar</Button>
                        <Button onClick={handleGuardarCreditoTrab} disabled={isSavingTrab || itemsTrab.length === 0}
                            className="bg-violet-600 hover:bg-violet-700 text-white">
                            {isSavingTrab ? 'Guardando...' : `Registrar ${itemsTrab.length > 0 ? formatCurrency(montoTotalTrab) : ''}`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Pago Trabajador */}
            <Dialog open={showPagoTrabModal} onOpenChange={setShowPagoTrabModal}>
                <DialogContent className="rounded-3xl max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase tracking-tight">Registrar Pago — Trabajador</DialogTitle>
                    </DialogHeader>
                    {selectedCreditoTrab && (
                        <div className="space-y-4 py-2">
                            <div className="p-3 rounded-xl bg-violet-50 dark:bg-violet-950/30">
                                <p className="font-black text-sm">{selectedCreditoTrab.trabajadorNombre}</p>
                                <p className="text-xs text-muted-foreground">{selectedCreditoTrab.descripcion}</p>
                                <p className="text-sm font-black text-violet-600 mt-1">Saldo: {formatCurrency(selectedCreditoTrab.saldo)}</p>
                            </div>
                            <div>
                                <Label className="text-xs font-bold uppercase tracking-widest">Monto *</Label>
                                <Input type="number" placeholder={`máx ${selectedCreditoTrab.saldo}`}
                                    value={formPagoTrab.monto}
                                    onChange={e => setFormPagoTrab(p => ({ ...p, monto: e.target.value }))} className="mt-1" />
                            </div>
                            <div>
                                <Label className="text-xs font-bold uppercase tracking-widest">Método de pago</Label>
                                <Select value={formPagoTrab.metodoPago} onValueChange={v => setFormPagoTrab(p => ({ ...p, metodoPago: v as MetodoPago }))}>
                                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="efectivo">Efectivo</SelectItem>
                                        <SelectItem value="transferencia">Transferencia</SelectItem>
                                        <SelectItem value="nequi">Nequi</SelectItem>
                                        <SelectItem value="daviplata">Daviplata</SelectItem>
                                        <SelectItem value="descuento_nomina">Descuento de nómina</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-xs font-bold uppercase tracking-widest">Nota (opcional)</Label>
                                <Input placeholder="ej: Descuento semana 1" value={formPagoTrab.nota}
                                    onChange={e => setFormPagoTrab(p => ({ ...p, nota: e.target.value }))} className="mt-1" />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowPagoTrabModal(false)}>Cancelar</Button>
                        <Button onClick={handlePagoTrab} disabled={isSavingTrab}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            {isSavingTrab ? 'Guardando...' : 'Confirmar Pago'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
