import { useState, useMemo } from 'react';
import {
    CreditCard, Plus, Search, Trash2, DollarSign,
    CheckCircle, Clock, AlertTriangle, X, ChevronDown, ChevronUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import type { CreditoCliente, MetodoPago, Usuario } from '@/types';

interface CreditosClientesProps {
    creditosClientes: CreditoCliente[];
    onAddCreditoCliente: (c: Omit<CreditoCliente, 'id' | 'createdAt'>) => Promise<void>;
    onUpdateCreditoCliente: (id: string, updates: Partial<CreditoCliente>) => Promise<void>;
    onDeleteCreditoCliente: (id: string) => Promise<void>;
    onRegistrarPagoCredito: (creditoId: string, pago: { monto: number; fecha: string; metodoPago: MetodoPago; nota?: string }) => Promise<void>;
    formatCurrency: (value: number) => string;
    usuario: Usuario;
}

const ESTADO_COLOR: Record<string, string> = {
    activo: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    pagado: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    vencido: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

const ESTADO_ICON: Record<string, React.ReactNode> = {
    activo: <Clock className="w-3 h-3" />,
    pagado: <CheckCircle className="w-3 h-3" />,
    vencido: <AlertTriangle className="w-3 h-3" />,
};

export default function CreditosClientes({
    creditosClientes,
    onAddCreditoCliente,
    onUpdateCreditoCliente,
    onDeleteCreditoCliente,
    onRegistrarPagoCredito,
    formatCurrency,
    usuario
}: CreditosClientesProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [filtroEstado, setFiltroEstado] = useState<string>('todos');
    const [showFormModal, setShowFormModal] = useState(false);
    const [showPagoModal, setShowPagoModal] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [selectedCredito, setSelectedCredito] = useState<CreditoCliente | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [formData, setFormData] = useState({
        clienteNombre: '',
        clienteTelefono: '',
        monto: '',
        descripcion: '',
        fecha: new Date().toISOString().split('T')[0],
        fechaVencimiento: '',
    });

    const [formPago, setFormPago] = useState({
        monto: '',
        fecha: new Date().toISOString().split('T')[0],
        metodoPago: 'efectivo' as MetodoPago,
        nota: '',
    });

    const creditosFiltrados = useMemo(() => {
        return creditosClientes.filter(c => {
            const matchSearch = c.clienteNombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.descripcion.toLowerCase().includes(searchTerm.toLowerCase());
            const matchEstado = filtroEstado === 'todos' || c.estado === filtroEstado;
            return matchSearch && matchEstado;
        }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [creditosClientes, searchTerm, filtroEstado]);

    const stats = useMemo(() => {
        const activos = creditosClientes.filter(c => c.estado === 'activo');
        const vencidos = creditosClientes.filter(c => c.estado === 'vencido');
        const totalPendiente = activos.reduce((s, c) => s + c.saldo, 0) +
            vencidos.reduce((s, c) => s + c.saldo, 0);
        return { activos: activos.length, vencidos: vencidos.length, totalPendiente };
    }, [creditosClientes]);

    const handleGuardarCredito = async () => {
        if (!formData.clienteNombre.trim() || !formData.monto || !formData.descripcion.trim()) {
            toast.error('Completa nombre del cliente, monto y descripción');
            return;
        }
        const monto = parseFloat(formData.monto);
        if (isNaN(monto) || monto <= 0) {
            toast.error('El monto debe ser un número positivo');
            return;
        }
        setIsSaving(true);
        try {
            await onAddCreditoCliente({
                clienteNombre: formData.clienteNombre.trim(),
                clienteTelefono: formData.clienteTelefono.trim() || undefined,
                monto,
                saldo: monto,
                descripcion: formData.descripcion.trim(),
                fecha: formData.fecha,
                fechaVencimiento: formData.fechaVencimiento || undefined,
                estado: 'activo',
                pagos: [],
                usuarioId: usuario.id,
            });
            setShowFormModal(false);
            setFormData({ clienteNombre: '', clienteTelefono: '', monto: '', descripcion: '', fecha: new Date().toISOString().split('T')[0], fechaVencimiento: '' });
            toast.success(`Crédito de ${formatCurrency(monto)} registrado para ${formData.clienteNombre}`);
        } catch {
            toast.error('Error al registrar el crédito');
        } finally {
            setIsSaving(false);
        }
    };

    const handleRegistrarPago = async () => {
        if (!selectedCredito) return;
        const monto = parseFloat(formPago.monto);
        if (isNaN(monto) || monto <= 0) {
            toast.error('Ingresa un monto válido');
            return;
        }
        if (monto > selectedCredito.saldo) {
            toast.error(`El pago no puede superar el saldo de ${formatCurrency(selectedCredito.saldo)}`);
            return;
        }
        setIsSaving(true);
        try {
            await onRegistrarPagoCredito(selectedCredito.id, {
                monto,
                fecha: formPago.fecha,
                metodoPago: formPago.metodoPago,
                nota: formPago.nota || undefined,
            });
            setShowPagoModal(false);
            setSelectedCredito(null);
            setFormPago({ monto: '', fecha: new Date().toISOString().split('T')[0], metodoPago: 'efectivo', nota: '' });
            toast.success(`Pago de ${formatCurrency(monto)} registrado`);
        } catch {
            toast.error('Error al registrar el pago');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-full flex flex-col gap-5 p-4 bg-slate-50 dark:bg-slate-950 animate-ag-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 px-5 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900 dark:text-white">
                            Créditos a Clientes
                        </h1>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            Registro de fiados y deudas
                        </p>
                    </div>
                </div>
                <Button
                    onClick={() => setShowFormModal(true)}
                    className="h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg gap-2 font-black uppercase tracking-widest text-xs border-none"
                >
                    <Plus className="w-4 h-4" /> Registrar Crédito
                </Button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                    { label: 'Créditos activos', value: stats.activos, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/20' },
                    { label: 'Vencidos', value: stats.vencidos, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/20' },
                    { label: 'Total pendiente', value: formatCurrency(stats.totalPendiente), color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/20' },
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
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-9 rounded-xl"
                    />
                </div>
                <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                    <SelectTrigger className="w-36 rounded-xl">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="activo">Activos</SelectItem>
                        <SelectItem value="vencido">Vencidos</SelectItem>
                        <SelectItem value="pagado">Pagados</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Lista de créditos */}
            <div className="flex-1 space-y-3 overflow-y-auto">
                {creditosFiltrados.length === 0 ? (
                    <Card className="rounded-2xl border-dashed">
                        <CardContent className="p-12 text-center text-muted-foreground">
                            <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-30" />
                            <p className="font-bold uppercase tracking-widest text-xs">
                                {searchTerm || filtroEstado !== 'todos' ? 'Sin resultados' : 'No hay créditos registrados'}
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    creditosFiltrados.map(credito => (
                        <Card key={credito.id} className="rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-black text-base text-gray-900 dark:text-white truncate">
                                                {credito.clienteNombre}
                                            </span>
                                            <Badge className={`${ESTADO_COLOR[credito.estado]} text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 border-none`}>
                                                {ESTADO_ICON[credito.estado]} {credito.estado}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{credito.descripcion}</p>
                                        <div className="flex items-center gap-4 mt-2">
                                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                                                Deuda original: {formatCurrency(credito.monto)}
                                            </span>
                                            <span className="text-sm font-black text-blue-600 dark:text-blue-400">
                                                Saldo: {formatCurrency(credito.saldo)}
                                            </span>
                                        </div>
                                        {credito.clienteTelefono && (
                                            <p className="text-xs text-muted-foreground mt-0.5">📞 {credito.clienteTelefono}</p>
                                        )}
                                        {credito.fechaVencimiento && (
                                            <p className="text-xs text-muted-foreground mt-0.5">⏰ Vence: {credito.fechaVencimiento}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {credito.estado !== 'pagado' && (
                                            <Button
                                                size="sm"
                                                onClick={() => { setSelectedCredito(credito); setShowPagoModal(true); }}
                                                className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black border-none"
                                            >
                                                <DollarSign className="w-3 h-3 mr-1" /> Pago
                                            </Button>
                                        )}
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => setExpandedId(expandedId === credito.id ? null : credito.id)}
                                            className="h-8 w-8 p-0 rounded-xl"
                                        >
                                            {expandedId === credito.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={async () => {
                                                await onDeleteCreditoCliente(credito.id);
                                                toast.success('Crédito eliminado');
                                            }}
                                            className="h-8 w-8 p-0 rounded-xl text-red-500 hover:text-red-700 hover:bg-red-50"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                                {/* Historial de pagos expandible */}
                                {expandedId === credito.id && credito.pagos.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-1">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Pagos realizados</p>
                                        {credito.pagos.map(pago => (
                                            <div key={pago.id} className="flex justify-between items-center text-xs py-1 px-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                                                <span className="text-muted-foreground">{pago.fecha}</span>
                                                <span className="font-bold text-emerald-600">{formatCurrency(pago.monto)}</span>
                                                <span className="text-muted-foreground capitalize">{pago.metodoPago}</span>
                                                {pago.nota && <span className="text-muted-foreground italic">{pago.nota}</span>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {expandedId === credito.id && credito.pagos.length === 0 && (
                                    <p className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs text-muted-foreground text-center">Sin pagos registrados aún</p>
                                )}
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Modal: Nuevo Crédito */}
            <Dialog open={showFormModal} onOpenChange={setShowFormModal}>
                <DialogContent className="rounded-3xl max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase tracking-tight">Nuevo Crédito a Cliente</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div>
                            <Label className="text-xs font-bold uppercase tracking-widest">Nombre del cliente *</Label>
                            <Input
                                placeholder="ej: María García"
                                value={formData.clienteNombre}
                                onChange={e => setFormData(p => ({ ...p, clienteNombre: e.target.value }))}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label className="text-xs font-bold uppercase tracking-widest">Teléfono</Label>
                            <Input
                                placeholder="ej: 300 123 4567"
                                value={formData.clienteTelefono}
                                onChange={e => setFormData(p => ({ ...p, clienteTelefono: e.target.value }))}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label className="text-xs font-bold uppercase tracking-widest">Monto del crédito *</Label>
                            <Input
                                type="number"
                                placeholder="ej: 25000"
                                value={formData.monto}
                                onChange={e => setFormData(p => ({ ...p, monto: e.target.value }))}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label className="text-xs font-bold uppercase tracking-widest">Descripción *</Label>
                            <Input
                                placeholder="ej: Pan y torta del sábado"
                                value={formData.descripcion}
                                onChange={e => setFormData(p => ({ ...p, descripcion: e.target.value }))}
                                className="mt-1"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs font-bold uppercase tracking-widest">Fecha</Label>
                                <Input
                                    type="date"
                                    value={formData.fecha}
                                    onChange={e => setFormData(p => ({ ...p, fecha: e.target.value }))}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label className="text-xs font-bold uppercase tracking-widest">Vence (opcional)</Label>
                                <Input
                                    type="date"
                                    value={formData.fechaVencimiento}
                                    onChange={e => setFormData(p => ({ ...p, fechaVencimiento: e.target.value }))}
                                    className="mt-1"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowFormModal(false)}>Cancelar</Button>
                        <Button
                            onClick={handleGuardarCredito}
                            disabled={isSaving}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            {isSaving ? 'Guardando...' : 'Registrar Crédito'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal: Registrar Pago */}
            <Dialog open={showPagoModal} onOpenChange={setShowPagoModal}>
                <DialogContent className="rounded-3xl max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase tracking-tight">Registrar Pago</DialogTitle>
                    </DialogHeader>
                    {selectedCredito && (
                        <div className="space-y-4 py-2">
                            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30">
                                <p className="font-black text-sm">{selectedCredito.clienteNombre}</p>
                                <p className="text-xs text-muted-foreground">{selectedCredito.descripcion}</p>
                                <p className="text-sm font-black text-blue-600 mt-1">Saldo: {formatCurrency(selectedCredito.saldo)}</p>
                            </div>
                            <div>
                                <Label className="text-xs font-bold uppercase tracking-widest">Monto del pago *</Label>
                                <Input
                                    type="number"
                                    placeholder={`máx ${selectedCredito.saldo}`}
                                    value={formPago.monto}
                                    onChange={e => setFormPago(p => ({ ...p, monto: e.target.value }))}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label className="text-xs font-bold uppercase tracking-widest">Método de pago</Label>
                                <Select value={formPago.metodoPago} onValueChange={v => setFormPago(p => ({ ...p, metodoPago: v as MetodoPago }))}>
                                    <SelectTrigger className="mt-1">
                                        <SelectValue />
                                    </SelectTrigger>
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
                                <Input
                                    placeholder="ej: Pago parcial"
                                    value={formPago.nota}
                                    onChange={e => setFormPago(p => ({ ...p, nota: e.target.value }))}
                                    className="mt-1"
                                />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowPagoModal(false)}>Cancelar</Button>
                        <Button
                            onClick={handleRegistrarPago}
                            disabled={isSaving}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            {isSaving ? 'Guardando...' : 'Confirmar Pago'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
