import { useState, useMemo } from 'react';
import {
    UserCircle2, Plus, Search, Trash2, Edit2, Check, X
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
import type { Trabajador, TrabajadorRol, TrabajadorEstado } from '@/types';

interface TrabajadoresProps {
    trabajadores: Trabajador[];
    onAddTrabajador: (t: Omit<Trabajador, 'id' | 'createdAt'>) => Promise<void>;
    onUpdateTrabajador: (id: string, updates: Partial<Trabajador>) => Promise<void>;
    onDeleteTrabajador: (id: string) => Promise<void>;
    formatCurrency: (value: number) => string;
}

const ROL_LABEL: Record<TrabajadorRol, string> = {
    panadero: 'Panadero',
    vendedor: 'Vendedor',
    cajero: 'Cajero/a',
    repartidor: 'Repartidor',
    administrador: 'Administrador',
    otro: 'Otro',
};

const ROL_COLOR: Record<TrabajadorRol, string> = {
    panadero: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    vendedor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    cajero: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    repartidor: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    administrador: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
    otro: 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300',
};

const ESTADO_COLOR: Record<TrabajadorEstado, string> = {
    activo: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    inactivo: 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400',
    vacaciones: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
};

const FORM_VACIO: Omit<Trabajador, 'id' | 'createdAt'> = {
    nombre: '',
    cedula: '',
    telefono: '',
    email: '',
    rol: 'panadero',
    salarioBase: 0,
    fechaIngreso: new Date().toISOString().split('T')[0],
    estado: 'activo',
    horario: '',
    observaciones: '',
};

export default function Trabajadores({
    trabajadores,
    onAddTrabajador,
    onUpdateTrabajador,
    onDeleteTrabajador,
    formatCurrency,
}: TrabajadoresProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [filtroEstado, setFiltroEstado] = useState<string>('todos');
    const [showModal, setShowModal] = useState(false);
    const [editando, setEditando] = useState<Trabajador | null>(null);
    const [formData, setFormData] = useState<Omit<Trabajador, 'id' | 'createdAt'>>(FORM_VACIO);
    const [isSaving, setIsSaving] = useState(false);

    const trabajadoresFiltrados = useMemo(() => {
        return trabajadores.filter(t => {
            const matchSearch = t.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.rol.toLowerCase().includes(searchTerm.toLowerCase());
            const matchEstado = filtroEstado === 'todos' || t.estado === filtroEstado;
            return matchSearch && matchEstado;
        }).sort((a, b) => a.nombre.localeCompare(b.nombre));
    }, [trabajadores, searchTerm, filtroEstado]);

    const stats = useMemo(() => {
        const activos = trabajadores.filter(t => t.estado === 'activo');
        const nominaTotal = activos.reduce((s, t) => s + t.salarioBase, 0);
        return { total: trabajadores.length, activos: activos.length, nominaTotal };
    }, [trabajadores]);

    const abrirModalNuevo = () => {
        setEditando(null);
        setFormData(FORM_VACIO);
        setShowModal(true);
    };

    const abrirModalEditar = (t: Trabajador) => {
        setEditando(t);
        setFormData({
            nombre: t.nombre,
            cedula: t.cedula || '',
            telefono: t.telefono || '',
            email: t.email || '',
            rol: t.rol,
            salarioBase: t.salarioBase,
            fechaIngreso: t.fechaIngreso,
            estado: t.estado,
            horario: t.horario || '',
            observaciones: t.observaciones || '',
        });
        setShowModal(true);
    };

    const handleGuardar = async () => {
        if (!formData.nombre.trim()) {
            toast.error('El nombre es obligatorio');
            return;
        }
        setIsSaving(true);
        try {
            if (editando) {
                await onUpdateTrabajador(editando.id, formData);
                toast.success(`${formData.nombre} actualizado`);
            } else {
                await onAddTrabajador(formData);
                toast.success(`${formData.nombre} registrado como ${ROL_LABEL[formData.rol]}`);
            }
            setShowModal(false);
        } catch {
            toast.error('Error al guardar');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-full flex flex-col gap-5 p-4 bg-slate-50 dark:bg-slate-950 animate-ag-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 px-5 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                        <UserCircle2 className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900 dark:text-white">
                            Trabajadores
                        </h1>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            Gestión de empleados
                        </p>
                    </div>
                </div>
                <Button
                    onClick={abrirModalNuevo}
                    className="h-10 px-6 bg-violet-600 hover:bg-violet-700 text-white rounded-xl shadow-lg gap-2 font-black uppercase tracking-widest text-xs border-none"
                >
                    <Plus className="w-4 h-4" /> Nuevo Trabajador
                </Button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: 'Total empleados', value: stats.total, color: 'text-violet-600' },
                    { label: 'Activos', value: stats.activos, color: 'text-emerald-600' },
                    { label: 'Nómina estimada', value: formatCurrency(stats.nominaTotal), color: 'text-amber-600' },
                ].map(kpi => (
                    <Card key={kpi.label} className="border-none shadow-sm rounded-2xl">
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
                        placeholder="Buscar por nombre o rol..."
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
                        <SelectItem value="inactivo">Inactivos</SelectItem>
                        <SelectItem value="vacaciones">Vacaciones</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Lista */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto content-start">
                {trabajadoresFiltrados.length === 0 ? (
                    <div className="col-span-full">
                        <Card className="rounded-2xl border-dashed">
                            <CardContent className="p-12 text-center text-muted-foreground">
                                <UserCircle2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
                                <p className="font-bold uppercase tracking-widest text-xs">
                                    {searchTerm || filtroEstado !== 'todos' ? 'Sin resultados' : 'No hay trabajadores registrados'}
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                ) : (
                    trabajadoresFiltrados.map(t => (
                        <Card key={t.id} className="rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-black text-base truncate text-gray-900 dark:text-white">{t.nombre}</span>
                                            <Badge className={`${ESTADO_COLOR[t.estado]} text-[9px] font-bold uppercase tracking-widest border-none`}>
                                                {t.estado}
                                            </Badge>
                                        </div>
                                        <Badge className={`${ROL_COLOR[t.rol]} text-[9px] font-bold uppercase tracking-widest border-none mt-1`}>
                                            {ROL_LABEL[t.rol]}
                                        </Badge>
                                        <div className="mt-2 space-y-0.5">
                                            {t.telefono && <p className="text-xs text-muted-foreground">📞 {t.telefono}</p>}
                                            {t.cedula && <p className="text-xs text-muted-foreground">🪪 {t.cedula}</p>}
                                            <p className="text-xs text-muted-foreground">📅 Ingresó: {t.fechaIngreso}</p>
                                            <p className="text-xs font-bold text-violet-600 dark:text-violet-400">
                                                💰 {formatCurrency(t.salarioBase)}/mes
                                            </p>
                                            {t.horario && <p className="text-xs text-muted-foreground">🕐 {t.horario}</p>}
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1 shrink-0">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => abrirModalEditar(t)}
                                            className="h-8 w-8 p-0 rounded-xl"
                                        >
                                            <Edit2 className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={async () => {
                                                await onDeleteTrabajador(t.id);
                                                toast.success(`${t.nombre} eliminado`);
                                            }}
                                            className="h-8 w-8 p-0 rounded-xl text-red-500 hover:text-red-700 hover:bg-red-50"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Modal: Crear / Editar Trabajador */}
            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="rounded-3xl max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase tracking-tight">
                            {editando ? `Editar: ${editando.nombre}` : 'Nuevo Trabajador'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2 max-h-[65vh] overflow-y-auto pr-2 sm:pr-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <Label className="text-xs font-bold uppercase tracking-widest">Nombre completo *</Label>
                                <Input
                                    placeholder="ej: Carlos Rodríguez"
                                    value={formData.nombre}
                                    onChange={e => setFormData(p => ({ ...p, nombre: e.target.value }))}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label className="text-xs font-bold uppercase tracking-widest">Cédula</Label>
                                <Input
                                    placeholder="ej: 12345678"
                                    value={formData.cedula}
                                    onChange={e => setFormData(p => ({ ...p, cedula: e.target.value }))}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label className="text-xs font-bold uppercase tracking-widest">Teléfono</Label>
                                <Input
                                    placeholder="ej: 310 123 4567"
                                    value={formData.telefono}
                                    onChange={e => setFormData(p => ({ ...p, telefono: e.target.value }))}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label className="text-xs font-bold uppercase tracking-widest">Rol *</Label>
                                <Select value={formData.rol} onValueChange={v => setFormData(p => ({ ...p, rol: v as TrabajadorRol }))}>
                                    <SelectTrigger className="mt-1">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(Object.keys(ROL_LABEL) as TrabajadorRol[]).map(r => (
                                            <SelectItem key={r} value={r}>{ROL_LABEL[r]}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-xs font-bold uppercase tracking-widest">Estado</Label>
                                <Select value={formData.estado} onValueChange={v => setFormData(p => ({ ...p, estado: v as TrabajadorEstado }))}>
                                    <SelectTrigger className="mt-1">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="activo">Activo</SelectItem>
                                        <SelectItem value="inactivo">Inactivo</SelectItem>
                                        <SelectItem value="vacaciones">Vacaciones</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-xs font-bold uppercase tracking-widest">Salario base</Label>
                                <Input
                                    type="number"
                                    placeholder="ej: 1300000"
                                    value={formData.salarioBase || ''}
                                    onChange={e => setFormData(p => ({ ...p, salarioBase: parseFloat(e.target.value) || 0 }))}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label className="text-xs font-bold uppercase tracking-widest">Fecha de ingreso</Label>
                                <Input
                                    type="date"
                                    value={formData.fechaIngreso}
                                    onChange={e => setFormData(p => ({ ...p, fechaIngreso: e.target.value }))}
                                    className="mt-1"
                                />
                            </div>
                            <div className="col-span-2">
                                <Label className="text-xs font-bold uppercase tracking-widest">Horario</Label>
                                <Input
                                    placeholder="ej: Lun-Vie 6am-2pm"
                                    value={formData.horario}
                                    onChange={e => setFormData(p => ({ ...p, horario: e.target.value }))}
                                    className="mt-1"
                                />
                            </div>
                            <div className="col-span-2">
                                <Label className="text-xs font-bold uppercase tracking-widest">Observaciones</Label>
                                <Input
                                    placeholder="Notas adicionales..."
                                    value={formData.observaciones}
                                    onChange={e => setFormData(p => ({ ...p, observaciones: e.target.value }))}
                                    className="mt-1"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowModal(false)}>Cancelar</Button>
                        <Button
                            onClick={handleGuardar}
                            disabled={isSaving}
                            className="bg-violet-600 hover:bg-violet-700 text-white"
                        >
                            {isSaving ? 'Guardando...' : editando ? 'Guardar cambios' : 'Registrar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
