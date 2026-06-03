import { useState, useMemo, useRef, useEffect } from 'react';
import {
    CreditCard, Plus, Search, Trash2, DollarSign,
    CheckCircle, Clock, AlertTriangle, ChevronDown, ChevronUp,
    Camera, X, Package, Image, UserCircle2, Scissors, Edit2, FolderOpen, Users, ArrowLeft, Eye
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
    Usuario, Producto, ItemCredito, Trabajador, TrabajadorRol,
    Cliente, Venta
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
    // Integración CRM
    clientes?: Cliente[];
    ventas?: Venta[];
    onAddCliente?: (c: Omit<Cliente, 'id' | 'createdAt'>) => Promise<Cliente>;
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
    onUpdateCreditoCliente,
    onDeleteCreditoCliente,
    onRegistrarPagoCredito,
    creditosTrabajadores,
    onAddCreditoTrabajador,
    onUpdateCreditoTrabajador,
    onDeleteCreditoTrabajador,
    onRegistrarPagoCreditoTrabajador,
    formatCurrency,
    usuario,
    productos,
    trabajadores,
    onGoToTrabajadores,
    clientes = [],
    ventas = [],
    onAddCliente,
}: CreditosClientesProps) {

    const [tab, setTab] = useState<Tab>('clientes');

    // ── Detección de carga inicial desde IndexedDB ────────────────────────
    // creditosClientes llega como [] mientras IndexedDB responde; evitamos
    // mostrar "sin datos" hasta confirmar que realmente está vacío.
    const [dataReady, setDataReady] = useState(
        () => creditosClientes.length > 0 || clientes.length > 0
    );
    const [busquedaCredito, setBusquedaCredito] = useState('');
    useEffect(() => {
        if (creditosClientes.length > 0 || clientes.length > 0) {
            setDataReady(true);
            return;
        }
        const t = setTimeout(() => setDataReady(true), 900);
        return () => clearTimeout(t);
    }, [creditosClientes.length, clientes.length]);

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
        categoriaCliente: '',
        descripcion: '',
        monto: '',
        fecha: new Date().toISOString().split('T')[0],
        fechaVencimiento: '',
    });
    const [fotoEvidenciaCliente, setFotoEvidenciaCliente] = useState<string | undefined>(undefined);
    const [formPagoCliente, setFormPagoCliente] = useState({
        monto: '',
        fecha: new Date().toISOString().split('T')[0],
        metodoPago: 'efectivo' as MetodoPago,
        nota: '',
    });
    const [editandoCredito, setEditandoCredito] = useState<CreditoCliente | null>(null);
    const [editandoDetalleId, setEditandoDetalleId] = useState<string | null>(null);
    const [formEditCliente, setFormEditCliente] = useState<{ estado: string; descripcion: string; fecha: string; fechaVencimiento: string; items: ItemCredito[]; montoManual: string }>({ estado: 'activo', descripcion: '', fecha: '', fechaVencimiento: '', items: [], montoManual: '' });
    const [isSavingEditCliente, setIsSavingEditCliente] = useState(false);
    const [selectedCreditosIds, setSelectedCreditosIds] = useState<Set<string>>(new Set());
    const [detalleCredito, setDetalleCredito] = useState<CreditoCliente | null>(null);

    // ── Carpetas (Categorías) ────────────────────────────────────────────────
    const [carpetas, setCarpetas] = useState<string[]>(() => {
        const stored = localStorage.getItem('carpetasClientes');
        return stored ? JSON.parse(stored) : ['Alcaldía', 'Tienda', 'Gimnasio'];
    });
    const [showCarpetasModal, setShowCarpetasModal] = useState(false);
    const [nuevaCarpeta, setNuevaCarpeta] = useState('');
    const [editandoCarpetaIndex, setEditandoCarpetaIndex] = useState<number | null>(null);
    const [carpetaEditNombre, setCarpetaEditNombre] = useState('');

    useEffect(() => {
        localStorage.setItem('carpetasClientes', JSON.stringify(carpetas));
    }, [carpetas]);

    const handleAgregarCarpeta = () => {
        const trimName = nuevaCarpeta.trim();
        if (!trimName) return;
        if (carpetas.includes(trimName)) { toast.error('La carpeta ya existe'); return; }
        setCarpetas([...carpetas, trimName]);
        setNuevaCarpeta('');
    };

    const handleEliminarCarpeta = (index: number) => {
        if (!confirm('¿Eliminar esta carpeta? Los créditos no se borrarán, solo perderán la etiqueta en nuevas búsquedas.')) return;
        setCarpetas(carpetas.filter((_, i) => i !== index));
    };

    const handleGuardarEdicionCarpeta = async (index: number) => {
        const oldName = carpetas[index];
        const newName = carpetaEditNombre.trim();
        if (!newName || newName === oldName) { setEditandoCarpetaIndex(null); return; }
        if (carpetas.includes(newName)) { toast.error('El nombre ya existe'); return; }
        
        // Actualizar la lista
        const nuevas = [...carpetas];
        nuevas[index] = newName;
        setCarpetas(nuevas);
        setEditandoCarpetaIndex(null);

        // Actualizar todos los créditos que tenían este nombre (esto es opcional pero muy útil)
        const creditosAActualizar = creditosClientes.filter(c => c.categoriaCliente === oldName);
        for (const c of creditosAActualizar) {
            await onUpdateCreditoCliente(c.id, { categoriaCliente: newName });
        }
        if (creditosAActualizar.length > 0) {
            toast.success(`Se actualizaron ${creditosAActualizar.length} créditos a la nueva carpeta`);
        }
    };

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
        monto: '',
        fecha: new Date().toISOString().split('T')[0],
        descontarDeSalario: true,
    });
    const [fotoEvidenciaTrab, setFotoEvidenciaTrab] = useState<string | undefined>(undefined);
    const [formPagoTrab, setFormPagoTrab] = useState({
        monto: '',
        fecha: new Date().toISOString().split('T')[0],
        metodoPago: 'efectivo' as MetodoPago,
        nota: '',
    });
    const [editandoCreditoTrab, setEditandoCreditoTrab] = useState<CreditoTrabajador | null>(null);
    const [formEditTrab, setFormEditTrab] = useState({ estado: 'activo', descripcion: '', descontarDeSalario: true });
    const [isSavingEditTrab, setIsSavingEditTrab] = useState(false);

    // ── Cómputos ──────────────────────────────────────────────────────────


    interface ClienteAgrupado {
        id: string;
        nombre: string;
        telefono?: string;
        categoria?: string;
        creditosActivos: CreditoCliente[];
        creditosPagados: CreditoCliente[];
        creditosVencidos: CreditoCliente[];
        ventasContado: Venta[];
        saldoTotal: number;
        totalCompradoContado: number;
    }

    const clientesAgrupados = useMemo(() => {
        const map = new Map<string, ClienteAgrupado>();

        // Inicializar con todos los clientes del CRM
        (clientes || []).forEach(c => {
            map.set(c.id, {
                id: c.id,
                nombre: c.nombre,
                telefono: c.telefono,
                categoria: 'General',
                creditosActivos: [],
                creditosPagados: [],
                creditosVencidos: [],
                ventasContado: [],
                saldoTotal: 0,
                totalCompradoContado: 0
            });
        });

        // Índice nombre_normalizado → key para evitar duplicados por nombre vs UUID
        const nombreAKey = new Map<string, string>();
        map.forEach((v, k) => nombreAKey.set(v.nombre.toLowerCase().trim(), k));

        // Sumar los créditos
        creditosClientes.forEach(c => {
            const nombreNorm = c.clienteNombre.toLowerCase().trim();
            // Resolver key: 1) clienteId válido en mapa, 2) mismo nombre ya existe (evita duplicado), 3) fallback
            let key: string;
            if (c.clienteId && map.has(c.clienteId)) {
                key = c.clienteId;
            } else if (nombreAKey.has(nombreNorm)) {
                key = nombreAKey.get(nombreNorm)!;
            } else {
                key = c.clienteId || nombreNorm;
            }
            if (!map.has(key)) {
                map.set(key, {
                    id: key,
                    nombre: c.clienteNombre.trim(),
                    telefono: c.clienteTelefono,
                    categoria: c.categoriaCliente,
                    creditosActivos: [],
                    creditosPagados: [],
                    creditosVencidos: [],
                    ventasContado: [],
                    saldoTotal: 0,
                    totalCompradoContado: 0
                });
                nombreAKey.set(nombreNorm, key);
            }
            const g = map.get(key)!;
            
            if (!g.telefono && c.clienteTelefono) g.telefono = c.clienteTelefono;
            if (c.categoriaCliente) g.categoria = c.categoriaCliente;

            // 'pendiente' es un estado legacy de Mayoristas — tratarlo como 'activo'
            const estadoNorm = (c.estado as any) === 'pendiente' ? 'activo' : c.estado;
            if (estadoNorm === 'activo') g.creditosActivos.push(c);
            else if (estadoNorm === 'vencido') g.creditosVencidos.push(c);
            else if (estadoNorm === 'pagado') g.creditosPagados.push(c);

            if (estadoNorm !== 'pagado') {
                g.saldoTotal += c.saldo;
            }
        });

        // Sumar las ventas de contado
        (ventas || []).forEach(v => {
            if (v.clienteId && map.has(v.clienteId)) {
                const g = map.get(v.clienteId)!;
                g.ventasContado.push(v);
                g.totalCompradoContado += v.total;
            }
        });

        let result = Array.from(map.values());

        // Filtrado por búsqueda
        const q = searchCliente.toLowerCase();
        if (q) {
            result = result.filter(c => 
                c.nombre.toLowerCase().includes(q) || 
                (c.categoria && c.categoria.toLowerCase().includes(q))
            );
        }

        // Filtrado por estado
        if (filtroEstadoCliente !== 'todos') {
            result = result.filter(c => {
                if (filtroEstadoCliente === 'activo') return c.creditosActivos.length > 0;
                if (filtroEstadoCliente === 'vencido') return c.creditosVencidos.length > 0;
                if (filtroEstadoCliente === 'pagado') return c.creditosPagados.length > 0 && c.saldoTotal === 0;
                return true;
            });
        }

        // Ordenar por mayor deuda primero, luego alfabéticamente
        return result.sort((a, b) => {
            if (b.saldoTotal !== a.saldoTotal) return b.saldoTotal - a.saldoTotal;
            return a.nombre.localeCompare(b.nombre);
        });
    }, [creditosClientes, clientes, ventas, searchCliente, filtroEstadoCliente]);

    const statsCliente = useMemo(() => {
        const activos = creditosClientes.filter(c => c.estado === 'activo' || (c.estado as any) === 'pendiente');
        const vencidos = creditosClientes.filter(c => c.estado === 'vencido');
        const totalPendiente = [...activos, ...vencidos].reduce((s, c) => s + c.saldo, 0);
        return { activos: activos.length, vencidos: vencidos.length, totalPendiente };
    }, [creditosClientes]);


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

    const handleFotoCliente = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            setFotoEvidenciaCliente(await fileToBase64(file));
            toast.success('Foto capturada');
        } catch { toast.error('Error al capturar foto'); }
    };

    const resetFormCliente = () => {
        setFormCliente({ clienteNombre: '', clienteTelefono: '', categoriaCliente: '', descripcion: '', monto: '', fecha: new Date().toISOString().split('T')[0], fechaVencimiento: '' });
        setFotoEvidenciaCliente(undefined);
    };

    const handleGuardarCredito = async () => {
        if (!formCliente.clienteNombre.trim()) { toast.error('El nombre del cliente es obligatorio'); return; }
        const monto = parseFloat(formCliente.monto);
        if (isNaN(monto) || monto <= 0) { toast.error('Ingresa un monto válido'); return; }
        if (!formCliente.descripcion.trim()) { toast.error('La descripción es obligatoria'); return; }
        setIsSavingCliente(true);
        try {
            await onAddCreditoCliente({
                clienteNombre: formCliente.clienteNombre.trim(),
                clienteTelefono: formCliente.clienteTelefono.trim() || undefined,
                categoriaCliente: formCliente.categoriaCliente.trim() || undefined,
                monto,
                saldo: monto,
                descripcion: formCliente.descripcion.trim(),
                fecha: new Date(formCliente.fecha + 'T12:00:00').toISOString(),
                fechaVencimiento: formCliente.fechaVencimiento ? new Date(formCliente.fechaVencimiento + 'T12:00:00').toISOString() : undefined,
                estado: 'activo',
                items: [],
                fotoEvidencia: fotoEvidenciaCliente,
                pagos: [],
                usuarioId: usuario.id,
            });
            setShowFormModal(false);
            resetFormCliente();
            toast.success(`Crédito de ${formatCurrency(monto)} registrado para ${formCliente.clienteNombre.trim()}`);
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

    const abrirEditarCredito = (c: CreditoCliente) => {
        setEditandoCredito(c);
        setFormEditCliente({
            estado: c.estado,
            descripcion: c.descripcion,
            fecha: c.fecha ? c.fecha.split('T')[0] : new Date().toISOString().split('T')[0],
            fechaVencimiento: c.fechaVencimiento || '',
            items: (c.items || []).map(i => ({ ...i })),
            montoManual: c.monto ? c.monto.toString() : '',
        });
    };

    const handleGuardarEditCliente = async () => {
        const creditoOriginal = editandoCredito || creditosClientes.find(c => c.id === editandoDetalleId);
        if (!creditoOriginal) return;
        setIsSavingEditCliente(true);
        try {
            const itemsActualizados = formEditCliente.items.map(i => ({
                ...i,
                subtotal: Math.round(i.cantidad * i.precioUnitario * 100) / 100,
            }));
            const montoDesdeItems = itemsActualizados.reduce((s, i) => s + i.subtotal, 0);
            const montoManualNum = parseFloat(formEditCliente.montoManual) || 0;
            const nuevoMonto = montoManualNum > 0
                ? montoManualNum
                : montoDesdeItems > 0
                    ? montoDesdeItems
                    : creditoOriginal.monto;
            const totalAbonado = (creditoOriginal.pagos || []).reduce((s, p) => s + p.monto, 0);
            const nuevoSaldo = Math.max(0, nuevoMonto - totalAbonado);
            await onUpdateCreditoCliente(creditoOriginal.id, {
                estado: formEditCliente.estado as CreditoCliente['estado'],
                descripcion: formEditCliente.descripcion.trim() || creditoOriginal.descripcion,
                fecha: formEditCliente.fecha ? new Date(formEditCliente.fecha + 'T12:00:00').toISOString() : creditoOriginal.fecha,
                fechaVencimiento: formEditCliente.fechaVencimiento || undefined,
                items: itemsActualizados,
                monto: nuevoMonto,
                saldo: nuevoSaldo,
            });
            setEditandoCredito(null);
            setEditandoDetalleId(null);
            toast.success('Crédito actualizado');
        } catch { toast.error('Error al actualizar crédito'); }
        finally { setIsSavingEditCliente(false); }
    };

    const abrirEditarCreditoTrab = (c: CreditoTrabajador) => {
        setEditandoCreditoTrab(c);
        setFormEditTrab({ estado: c.estado, descripcion: c.descripcion, descontarDeSalario: c.descontarDeSalario });
    };

    const handleGuardarEditTrab = async () => {
        if (!editandoCreditoTrab) return;
        setIsSavingEditTrab(true);
        try {
            await onUpdateCreditoTrabajador(editandoCreditoTrab.id, {
                estado: formEditTrab.estado as CreditoTrabajador['estado'],
                descripcion: formEditTrab.descripcion.trim() || editandoCreditoTrab.descripcion,
                descontarDeSalario: formEditTrab.descontarDeSalario,
            });
            setEditandoCreditoTrab(null);
            toast.success('Crédito actualizado');
        } catch { toast.error('Error al actualizar crédito'); }
        finally { setIsSavingEditTrab(false); }
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

    const resetFormTrab = () => {
        setFormTrab({ trabajadorId: '', descripcion: '', monto: '', fecha: new Date().toISOString().split('T')[0], descontarDeSalario: true });
        setFotoEvidenciaTrab(undefined);
    };

    const handleGuardarCreditoTrab = async () => {
        if (!formTrab.trabajadorId) { toast.error('Selecciona un trabajador'); return; }
        const monto = parseFloat(formTrab.monto);
        if (isNaN(monto) || monto <= 0) { toast.error('Ingresa un monto válido'); return; }
        if (!formTrab.descripcion.trim()) { toast.error('La descripción es obligatoria'); return; }
        setIsSavingTrab(true);
        try {
            await onAddCreditoTrabajador({
                trabajadorId: formTrab.trabajadorId,
                trabajadorNombre: trabajadorSeleccionado?.nombre || '',
                trabajadorRol: trabajadorSeleccionado?.rol,
                monto,
                saldo: monto,
                descripcion: formTrab.descripcion.trim(),
                fecha: formTrab.fecha,
                estado: 'activo',
                items: [],
                fotoEvidencia: fotoEvidenciaTrab,
                descontarDeSalario: formTrab.descontarDeSalario,
                pagos: [],
                usuarioId: usuario.id,
            });
            setShowCreditoTrabModal(false);
            resetFormTrab();
            toast.success(`Crédito de ${formatCurrency(monto)} registrado para ${trabajadorSeleccionado?.nombre}`);
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

            <datalist id="listaCarpetas">
                {carpetas.map((c, i) => <option key={i} value={c} />)}
            </datalist>

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
                                placeholder="Buscar cliente, descripción o carpeta..."
                                value={searchCliente}
                                onChange={e => setSearchCliente(e.target.value)}
                                className="pl-9 rounded-xl"
                            />
                        </div>
                        <Button variant="outline" onClick={() => setShowCarpetasModal(true)} className="rounded-xl border-slate-200 dark:border-slate-800 flex items-center gap-2">
                            <FolderOpen className="w-4 h-4 text-blue-500" />
                            <span className="hidden sm:inline text-xs font-bold uppercase tracking-widest">Carpetas</span>
                        </Button>
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
                        {!dataReady ? (
                            /* Skeleton — mientras IndexedDB carga los datos */
                            <div className="space-y-3 animate-pulse">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-2 flex-1">
                                                <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-lg w-1/3" />
                                                <div className="h-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg w-1/4" />
                                            </div>
                                            <div className="h-8 w-8 bg-slate-100 dark:bg-slate-800 rounded-full" />
                                        </div>
                                    </div>
                                ))}
                                <p className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-300 dark:text-slate-600 pt-1">
                                    Cargando clientes…
                                </p>
                            </div>
                        ) : clientesAgrupados.length === 0 ? (
                            <Card className="rounded-2xl border-dashed">
                                <CardContent className="p-12 text-center text-muted-foreground">
                                    <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
                                    <p className="font-bold uppercase tracking-widest text-xs">
                                        {searchCliente || filtroEstadoCliente !== 'todos' ? 'Sin resultados' : 'No hay clientes registrados'}
                                    </p>
                                </CardContent>
                            </Card>
                        ) : clientesAgrupados.map(cliente => (
                            <Card key={cliente.id} className="rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden border border-slate-200 dark:border-slate-800">
                                <CardContent className="p-0">
                                    {/* Cabecera del Cliente */}
                                    <div
                                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                                        onClick={() => {
                                            if (expandedClienteId === cliente.id) {
                                                setExpandedClienteId(null);
                                            } else {
                                                setExpandedClienteId(cliente.id);
                                                setFormCliente({
                                                    clienteNombre: cliente.nombre,
                                                    clienteTelefono: cliente.telefono || '',
                                                    categoriaCliente: cliente.categoria || '',
                                                    descripcion: '',
                                                    monto: '',
                                                    fecha: new Date().toISOString().split('T')[0],
                                                    fechaVencimiento: ''
                                                });
                                                setFotoEvidenciaCliente(undefined);
                                            }
                                        }}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <span className="font-black text-lg text-slate-800 dark:text-slate-200 truncate">{cliente.nombre}</span>
                                                {cliente.categoria && (
                                                    <Badge className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-[10px] font-black uppercase tracking-widest border-none px-2 py-0">
                                                        {cliente.categoria}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className={`text-sm font-black ${cliente.saldoTotal > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                    Saldo: {formatCurrency(cliente.saldoTotal)}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                                                    {cliente.creditosActivos.length + cliente.creditosVencidos.length} Pendientes
                                                </span>
                                            </div>
                                            {cliente.telefono && <p className="text-[11px] text-slate-500 mt-1">📞 {cliente.telefono}</p>}
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {cliente.telefono && (cliente.saldoTotal > 0 || cliente.creditosPagados.length > 0) && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const fmt = (n: number) => formatCurrency(n);
                                                        const fmtFecha = (f: string) => { try { return new Date(f).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return f; } };
                                                        const renderCredito = (cr: CreditoCliente, icono: string) => {
                                                            let s = `${icono} *${cr.descripcion || 'Crédito'}* (${fmtFecha(cr.fecha)})\n`;
                                                            if (cr.items && cr.items.length > 0) {
                                                                cr.items.forEach(it => { s += `   • ${it.cantidad}x ${it.nombre} — ${fmt(it.subtotal)}\n`; });
                                                            }
                                                            if (cr.fechaVencimiento) s += `   📅 Vence: ${fmtFecha(cr.fechaVencimiento)}\n`;
                                                            if (cr.pagos && cr.pagos.length > 0) {
                                                                s += `   💳 Pagos:\n`;
                                                                cr.pagos.forEach(p => { s += `      ✓ ${fmtFecha(p.fecha)} — ${fmt(p.monto)} (${p.metodoPago || 'efectivo'})\n`; });
                                                            }
                                                            const estadoLabel = cr.estado === 'pagado' ? '✅ Pagado' : cr.estado === 'vencido' ? '⚠️ Vencido' : '🔄 Activo';
                                                            s += `   ${estadoLabel} · Saldo: *${fmt(cr.saldo)}*\n`;
                                                            return s;
                                                        };
                                                        let msg = `🧾 *ESTADO DE CUENTA — Dulce Placer*\n`;
                                                        msg += `👤 *${cliente.nombre}*\n`;
                                                        msg += `📅 ${fmtFecha(new Date().toISOString())}\n`;
                                                        msg += `${'─'.repeat(28)}\n\n`;
                                                        const activos = cliente.creditosActivos;
                                                        const vencidos = cliente.creditosVencidos;
                                                        const pagados = cliente.creditosPagados;
                                                        if (activos.length > 0) {
                                                            msg += `*🔄 CRÉDITOS ACTIVOS (${activos.length})*\n`;
                                                            activos.forEach(cr => { msg += renderCredito(cr, '🔄') + '\n'; });
                                                        }
                                                        if (vencidos.length > 0) {
                                                            msg += `*⚠️ CRÉDITOS VENCIDOS (${vencidos.length})*\n`;
                                                            vencidos.forEach(cr => { msg += renderCredito(cr, '⚠️') + '\n'; });
                                                        }
                                                        if (pagados.length > 0) {
                                                            msg += `*✅ CRÉDITOS PAGADOS (${pagados.length})*\n`;
                                                            pagados.forEach(cr => { msg += renderCredito(cr, '✅') + '\n'; });
                                                        }
                                                        msg += `${'─'.repeat(28)}\n`;
                                                        if (cliente.saldoTotal > 0) {
                                                            msg += `💰 *SALDO PENDIENTE: ${fmt(cliente.saldoTotal)}*\n`;
                                                        } else {
                                                            msg += `✅ *Sin saldo pendiente*\n`;
                                                        }
                                                        msg += `\nGracias por tu preferencia 🙏\n_Dulce Placer_`;
                                                        const tel = cliente.telefono!.replace(/\D/g, '');
                                                        const url = `https://wa.me/57${tel}?text=${encodeURIComponent(msg)}`;
                                                        window.open(url, '_blank');
                                                    }}
                                                    className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-all"
                                                    title="Enviar recordatorio por WhatsApp"
                                                >
                                                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                                </button>
                                            )}
                                            <div className={`p-2 rounded-full ${expandedClienteId === cliente.id ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300' : 'bg-slate-100 dark:bg-slate-900 text-slate-400'}`}>
                                                {expandedClienteId === cliente.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Detalle Expandido - Mini POS + Historial */}
                                    {expandedClienteId === cliente.id && (
                                        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
                                            {/* Botón Volver */}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setExpandedClienteId(null); }}
                                                className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors bg-blue-50 dark:bg-blue-900/20 px-4 py-2.5 rounded-xl border border-blue-200 dark:border-blue-800/40 shadow-sm hover:shadow-md"
                                            >
                                                <ArrowLeft className="w-4 h-4" /> Volver a la lista
                                            </button>

                                            {/* Botón Registrar Nuevo Crédito */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    resetFormCliente();
                                                    setFormCliente(prev => ({
                                                        ...prev,
                                                        clienteNombre: cliente.nombre,
                                                        clienteTelefono: cliente.telefono || '',
                                                        categoriaCliente: cliente.categoria || '',
                                                    }));
                                                    setShowFormModal(true);
                                                }}
                                                className="mb-5 w-full flex items-center justify-center gap-2 text-sm font-black uppercase tracking-widest text-white bg-blue-600 hover:bg-blue-700 px-4 py-3 rounded-2xl shadow-lg shadow-blue-500/30 hover:shadow-xl hover:-translate-y-0.5 transition-all"
                                            >
                                                <Plus className="w-4 h-4" /> Registrar Nuevo Crédito
                                            </button>

                                            <div>
                                                {/* HISTORIAL */}
                                                <div>
                                                    <div className="mb-4 flex justify-between items-center gap-2 flex-wrap">
                                                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                                            <Clock className="w-4 h-4" /> Historial y Abonos
                                                        </h4>
                                                        <div className="flex items-center gap-2">
                                                        {/* Botón Seleccionar todos */}
                                                        {(() => {
                                                            const todos = [...cliente.creditosVencidos, ...cliente.creditosActivos, ...cliente.creditosPagados];
                                                            if (todos.length === 0) return null;
                                                            const todosSelec = todos.every(c => selectedCreditosIds.has(c.id));
                                                            return (
                                                                <button
                                                                    onClick={() => {
                                                                        if (todosSelec) {
                                                                            setSelectedCreditosIds(new Set());
                                                                        } else {
                                                                            setSelectedCreditosIds(new Set(todos.map(c => c.id)));
                                                                        }
                                                                    }}
                                                                    className="text-[9px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-700 underline underline-offset-2 transition-colors"
                                                                >
                                                                    {todosSelec ? 'Deseleccionar todos' : 'Seleccionar todos'}
                                                                </button>
                                                            );
                                                        })()}
                                                        {/* Botón WA masivo — aparece solo cuando hay selección */}
                                                        {selectedCreditosIds.size > 0 && (() => {
                                                            const creditosTodos = [...cliente.creditosVencidos, ...cliente.creditosActivos, ...cliente.creditosPagados];
                                                            const seleccionados = creditosTodos.filter(c => selectedCreditosIds.has(c.id));
                                                            const tel = (cliente.telefono || '').replace(/\D/g, '');
                                                            const saldoTotal = seleccionados.reduce((s, c) => s + c.saldo, 0);
                                                            const fmt = (n: number) => formatCurrency(n);
                                                            const handleWAMasivo = () => {
                                                                if (!tel) { toast.error('El cliente no tiene teléfono registrado'); return; }
                                                                const fmtF = (f: string) => { try { return new Date(f).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return f; } };
                                                                let msg = `🥐 *DULCE PLACER*\n━━━━━━━━━━━━━━━━━━\n📋 *ESTADO DE CUENTA*\n👤 ${cliente.nombre}\n📅 ${new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}\n\n`;
                                                                seleccionados.forEach((c, i) => {
                                                                    msg += `━━━━━━━━━━━━━━━━━━\n📌 *Ticket ${i + 1}* — ${fmtF(c.fecha)}\n`;
                                                                    if (c.descripcion) msg += `_${c.descripcion}_\n`;
                                                                    if (c.items && c.items.length > 0) { c.items.forEach(it => { msg += `  • ${it.cantidad}x ${it.nombre}  ${fmt(it.subtotal)}\n`; }); }
                                                                    msg += `  💵 *Total:* ${fmt(c.monto)}\n`;
                                                                    if (c.pagos && c.pagos.length > 0) { msg += `  💳 *Abonos:*\n`; c.pagos.forEach(p => { msg += `    ✓ ${fmtF(p.fecha)} · ${fmt(p.monto)}\n`; }); }
                                                                    msg += c.saldo <= 0 ? `  ✅ *SALDADO*\n\n` : `  ⚠️ *Pendiente: ${fmt(c.saldo)}*\n\n`;
                                                                });
                                                                msg += `━━━━━━━━━━━━━━━━━━\n`;
                                                                if (seleccionados.length > 1) msg += `📊 *Total seleccionados:* ${fmt(seleccionados.reduce((s,c)=>s+c.monto,0))}\n`;
                                                                msg += saldoTotal <= 0 ? `✅ *¡Todo al día!* 🎉` : `🔴 *TOTAL A PAGAR: ${fmt(saldoTotal)}*\n\n_Puedes abonar por:_\n💵 Efectivo  |  📲 Nequi  |  🏦 Transferencia`;
                                                                msg += `\n\n_¡Gracias por tu preferencia! 🥐_`;
                                                                window.open(`https://wa.me/57${tel}?text=${encodeURIComponent(msg)}`, '_blank');
                                                                setSelectedCreditosIds(new Set());
                                                            };
                                                            return (
                                                                <div className="flex items-center gap-2 animate-ag-fade-in">
                                                                    <span className="text-[9px] font-black uppercase tracking-widest text-blue-500">{selectedCreditosIds.size} selec.</span>
                                                                    <button
                                                                        onClick={handleWAMasivo}
                                                                        className="h-8 px-3 rounded-xl bg-[#25D366] hover:bg-[#1da851] text-white text-[10px] font-black uppercase flex items-center gap-1.5 shadow-sm transition-colors"
                                                                    >
                                                                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                                                        Enviar {selectedCreditosIds.size} por WA · {fmt(saldoTotal)}
                                                                    </button>
                                                                    <button onClick={() => setSelectedCreditosIds(new Set())} className="h-8 w-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 flex items-center justify-center text-xs font-black">✕</button>
                                                                </div>
                                                            );
                                                        })()}
                                                        </div>
                                                    </div>

                                                    {cliente.creditosActivos.length === 0 && cliente.creditosVencidos.length === 0 && cliente.creditosPagados.length === 0 ? (
                                                        <div className="text-center p-8 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-950">
                                                            <p className="text-xs font-bold text-slate-400">Cliente sin historial de créditos.</p>
                                                        </div>
                                                    ) : (() => {
                                                        const todosTickets = [...cliente.creditosVencidos, ...cliente.creditosActivos, ...cliente.creditosPagados]
                                                            .sort((a, b) => new Date(b.fecha || b.createdAt || 0).getTime() - new Date(a.fecha || a.createdAt || 0).getTime());
                                                        const qC = busquedaCredito.trim().toLowerCase();
                                                        const ticketsFiltrados = qC ? todosTickets.filter(cr => {
                                                            const d = new Date(cr.fecha || cr.createdAt || '');
                                                            const fechaTxt = isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
                                                            const productosTxt = (cr.items || []).map(i => i.nombre).join(' ').toLowerCase();
                                                            return (
                                                                fechaTxt.toLowerCase().includes(qC) ||
                                                                productosTxt.includes(qC) ||
                                                                cr.monto.toString().includes(qC) ||
                                                                cr.saldo.toString().includes(qC) ||
                                                                (cr.descripcion || '').toLowerCase().includes(qC) ||
                                                                (cr.estado || '').toLowerCase().includes(qC)
                                                            );
                                                        }) : todosTickets;
                                                        return (
                                                        <>
                                                        {/* Buscador de tickets */}
                                                        {todosTickets.length > 2 && (
                                                            <div className="mb-3">
                                                                <div className="relative">
                                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                                                                    <input
                                                                        type="text"
                                                                        value={busquedaCredito}
                                                                        onChange={e => setBusquedaCredito(e.target.value)}
                                                                        placeholder="Buscar por fecha, monto, producto…"
                                                                        className="w-full h-9 pl-9 pr-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 transition-all"
                                                                    />
                                                                    {busquedaCredito && (
                                                                        <button onClick={() => setBusquedaCredito('')}
                                                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                                                            <X className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                {busquedaCredito && (
                                                                    <p className="text-[9px] text-slate-400 font-bold mt-1.5 pl-1">
                                                                        {ticketsFiltrados.length} de {todosTickets.length} tickets
                                                                    </p>
                                                                )}
                                                            </div>
                                                        )}
                                                        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                                            {ticketsFiltrados.length === 0 && busquedaCredito ? (
                                                                <div className="text-center py-8 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                                                                    <Search className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                                                                    <p className="text-xs font-bold text-slate-400">Sin resultados para "{busquedaCredito}"</p>
                                                                </div>
                                                            ) : ticketsFiltrados.map(credito => {
                                                                const isSelected = selectedCreditosIds.has(credito.id);
                                                                return (
                                                                <div key={credito.id} 
                                                                    onClick={() => {
                                                                        const next = new Set(selectedCreditosIds);
                                                                        if (isSelected) next.delete(credito.id);
                                                                        else next.add(credito.id);
                                                                        setSelectedCreditosIds(next);
                                                                    }}
                                                                    className={`p-3.5 shadow-sm border rounded-2xl relative overflow-hidden group cursor-pointer transition-colors ${
                                                                        isSelected ? 'bg-blue-50/50 border-blue-400 dark:bg-blue-900/20 dark:border-blue-700' : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                                                                    }`}>
                                                                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${credito.estado === 'activo' ? 'bg-amber-500' : credito.estado === 'vencido' ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
                                                                    
                                                                    <div className="flex items-start justify-between gap-3 pl-3">
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                                                                {/* Checkbox de selección */}
                                                                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-300 dark:border-slate-600 group-hover:border-blue-400'}`}>
                                                                                    {isSelected && <CheckCircle className="w-2.5 h-2.5 text-white" />}
                                                                                </div>
                                                                                <Badge className={`${ESTADO_COLOR_CLIENTE[credito.estado]} text-[9px] font-bold uppercase tracking-widest flex items-center gap-1 border-none px-1.5 py-0`}>
                                                                                    {credito.estado === 'activo' && <Clock className="w-3 h-3" />}
                                                                                    {credito.estado === 'pagado' && <CheckCircle className="w-3 h-3" />}
                                                                                    {credito.estado === 'vencido' && <AlertTriangle className="w-3 h-3" />}
                                                                                    {credito.estado}
                                                                                </Badge>
                                                                                <span className="text-[10px] text-slate-500 font-bold">{(() => { const f = credito.fecha || credito.createdAt || ''; return (f.includes('T') ? new Date(f) : new Date(f + 'T12:00:00')).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }); })()}</span>
                                                                            </div>
                                                                            {credito.descripcion && <p className="text-xs text-slate-600 dark:text-slate-400 truncate mb-1 ml-6">{credito.descripcion}</p>}
                                                                            <div className="flex items-center gap-4 mt-2 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-xl ml-6">
                                                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Deuda:<br/><span className="text-xs text-slate-700 dark:text-slate-300">{formatCurrency(credito.monto)}</span></span>
                                                                                <span className={`text-[10px] font-black uppercase tracking-widest ${credito.saldo > 0 ? 'text-red-600/70 dark:text-red-400/70' : 'text-emerald-600/70 dark:text-emerald-400/70'}`}>
                                                                                    Saldo:<br/><span className={`text-xs ${credito.saldo > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{formatCurrency(credito.saldo)}</span>
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                        
                                                                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                                                                            {/* Botón WhatsApp individual */}
                                                                            {cliente.telefono && credito.saldo > 0 && (
                                                                                <Button
                                                                                    size="sm"
                                                                                    onClick={(e) => { 
                                                                                        e.stopPropagation(); 
                                                                                        const fmt = (n: number) => formatCurrency(n);
                                                                                        const fmtFecha = (f: string) => { try { return new Date(f).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return f; } };
                                                                                        let msg = `🧾 *DETALLE DE CRÉDITO — Dulce Placer*\n`;
                                                                                        msg += `👤 *${cliente.nombre}*\n`;
                                                                                        msg += `📅 Fecha crédito: ${fmtFecha(credito.fecha)}\n`;
                                                                                        msg += `${'─'.repeat(28)}\n`;
                                                                                        msg += `*${credito.descripcion || 'Compra en panadería'}*\n\n`;
                                                                                        if (credito.items && credito.items.length > 0) {
                                                                                            credito.items.forEach(it => { msg += `   • ${it.cantidad}x ${it.nombre} — ${fmt(it.subtotal)}\n`; });
                                                                                            msg += `\n`;
                                                                                        }
                                                                                        msg += `💰 *Deuda Original: ${fmt(credito.monto)}*\n`;
                                                                                        if (credito.pagos && credito.pagos.length > 0) {
                                                                                            msg += `💳 *Abonos:*\n`;
                                                                                            credito.pagos.forEach(p => { msg += `   ✓ ${fmtFecha(p.fecha)} — ${fmt(p.monto)}\n`; });
                                                                                        }
                                                                                        msg += `${'─'.repeat(28)}\n`;
                                                                                        msg += `🔴 *SALDO PENDIENTE: ${fmt(credito.saldo)}*\n\n`;
                                                                                        msg += `Agradecemos mucho tu pronto pago. 🙏`;
                                                                                        const tel = cliente.telefono!.replace(/\D/g, '');
                                                                                        const url = `https://wa.me/57${tel}?text=${encodeURIComponent(msg)}`;
                                                                                        window.open(url, '_blank');
                                                                                    }}
                                                                                    className="h-8 w-8 p-0 bg-emerald-100 hover:bg-emerald-200 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg shadow-sm"
                                                                                    title="Cobrar este crédito por WhatsApp"
                                                                                >
                                                                                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                                                                </Button>
                                                                            )}
                                                                            {credito.estado !== 'pagado' && (
                                                                                <Button
                                                                                    size="sm"
                                                                                    onClick={(e) => { e.stopPropagation(); setSelectedCredito(credito); setShowPagoClienteModal(true); }}
                                                                                    className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest border-none shadow-sm"
                                                                                >
                                                                                    <DollarSign className="w-3.5 h-3.5 mr-1" /> Abonar
                                                                                </Button>
                                                                            )}
                                                                            <div className="flex gap-1">
                                                                                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setDetalleCredito(credito); }} className="h-7 w-7 p-0 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/30 rounded-lg" title="Ver detalle"><Eye className="w-3.5 h-3.5" /></Button>
                                                                                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); abrirEditarCredito(credito); }} className="h-7 w-7 p-0 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg" title="Editar"><Edit2 className="w-3.5 h-3.5" /></Button>
                                                                                <Button size="sm" variant="ghost" onClick={async (e) => { e.stopPropagation(); await onDeleteCreditoCliente(credito.id); toast.success('Crédito eliminado'); }} className="h-7 w-7 p-0 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></Button>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Detalles adicionales si existen */}
                                                                    {(credito.items?.length > 0 || credito.pagos?.length > 0) && (
                                                                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4 pl-3">
                                                                            {/* Items */}
                                                                            {credito.items && credito.items.length > 0 && (
                                                                                <div>
                                                                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Productos</p>
                                                                                    <div className="space-y-1">
                                                                                        {credito.items.map(item => (
                                                                                            <div key={item.productoId} className="flex justify-between items-center text-[10px]">
                                                                                                <span className="text-slate-600 dark:text-slate-400 truncate pr-2">{item.cantidad}x {item.nombre}</span>
                                                                                                <span className="font-bold text-slate-700 dark:text-slate-300">{formatCurrency(item.subtotal)}</span>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            )}

                                                                            {/* Pagos */}
                                                                            {credito.pagos && credito.pagos.length > 0 && (
                                                                                <div>
                                                                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Abonos Realizados</p>
                                                                                    <div className="space-y-1">
                                                                                        {credito.pagos.map(pago => (
                                                                                            <div key={pago.id} className="flex justify-between items-center text-[10px]">
                                                                                                <span className="text-slate-500">{pago.fecha}</span>
                                                                                                <span className="font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-1 rounded">{formatCurrency(pago.monto)}</span>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                        </div>
                                                        </>
                                                        );
                                                    })()}

                                                    {/* Compras al Contado */}
                                                    {cliente.ventasContado && cliente.ventasContado.length > 0 && (
                                                        <div className="mt-6 border-t border-slate-200 dark:border-slate-800 pt-4">
                                                            <div className="flex justify-between items-center mb-3">
                                                                <h4 className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                                                                    <DollarSign className="w-4 h-4" /> Historial Compras Contado
                                                                </h4>
                                                                <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                                                                    Total: {formatCurrency(cliente.totalCompradoContado)}
                                                                </span>
                                                            </div>
                                                            <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                                                                {cliente.ventasContado.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()).map(venta => (
                                                                    <div key={venta.id} className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                                                                        <div>
                                                                            <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{new Date(venta.fecha).toLocaleString()}</p>
                                                                            <p className="text-[10px] text-slate-500">{venta.items.length} productos</p>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <p className="font-black text-sm text-slate-800 dark:text-slate-200">{formatCurrency(venta.total)}</p>
                                                                            <p className="text-[9px] uppercase font-bold text-emerald-500">{venta.metodoPago}</p>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    
                                                    {/* Galería de Evidencias */}
                                                    {(() => {
                                                        const creditosConFoto = [...cliente.creditosVencidos, ...cliente.creditosActivos, ...cliente.creditosPagados].filter(c => !!c.fotoEvidencia);
                                                        if (creditosConFoto.length === 0) return null;
                                                        
                                                        return (
                                                            <div className="mt-6 border-t border-slate-200 dark:border-slate-800 pt-4">
                                                                <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2 mb-3">
                                                                    <Image className="w-4 h-4" /> Galería de Evidencias (Facturas)
                                                                </h4>
                                                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                                                    {creditosConFoto.sort((a, b) => new Date(b.createdAt || b.fecha).getTime() - new Date(a.createdAt || a.fecha).getTime()).map(c => (
                                                                        <button 
                                                                            key={c.id} 
                                                                            onClick={() => setShowFotoModal(c.fotoEvidencia!)}
                                                                            className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 hover:ring-2 hover:ring-blue-500 transition-all group shadow-sm"
                                                                        >
                                                                            <img src={c.fotoEvidencia} alt="Evidencia" className="w-full h-full object-cover" />
                                                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity">
                                                                                <Search className="w-6 h-6 text-white mb-1" />
                                                                                <span className="text-[10px] font-bold text-white text-center px-1 bg-black/50 rounded-full py-0.5">{(() => { const f = c.fecha || c.createdAt || ''; return (f.includes('T') ? new Date(f) : new Date(f + 'T12:00:00')).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }); })()}</span>
                                                                            </div>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
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
                                                onClick={() => abrirEditarCreditoTrab(credito)}
                                                className="h-8 w-8 p-0 rounded-xl text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                                                title="Editar crédito">
                                                <Edit2 className="w-4 h-4" />
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

            {/* Gestor de Carpetas */}
            <Dialog open={showCarpetasModal} onOpenChange={setShowCarpetasModal}>
                <DialogContent className="rounded-3xl max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase tracking-tight flex items-center gap-2">
                            <FolderOpen className="w-5 h-5 text-blue-500" />
                            Gestor de Carpetas
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="flex gap-2">
                            <Input placeholder="Nueva carpeta..." value={nuevaCarpeta} onChange={e => setNuevaCarpeta(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAgregarCarpeta()} className="rounded-xl" />
                            <Button onClick={handleAgregarCarpeta} className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black"><Plus className="w-4 h-4" /></Button>
                        </div>
                        <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2">
                            {carpetas.length === 0 ? (
                                <p className="text-center text-xs text-muted-foreground italic py-4">No hay carpetas creadas</p>
                            ) : carpetas.map((c, i) => (
                                <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                    {editandoCarpetaIndex === i ? (
                                        <Input 
                                            value={carpetaEditNombre} 
                                            onChange={e => setCarpetaEditNombre(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleGuardarEdicionCarpeta(i)}
                                            autoFocus
                                            className="h-8 text-xs font-bold"
                                        />
                                    ) : (
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{c}</span>
                                    )}
                                    <div className="flex items-center gap-1">
                                        {editandoCarpetaIndex === i ? (
                                            <Button size="sm" variant="ghost" onClick={() => handleGuardarEdicionCarpeta(i)} className="h-8 w-8 p-0 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50"><CheckCircle className="w-4 h-4" /></Button>
                                        ) : (
                                            <Button size="sm" variant="ghost" onClick={() => { setEditandoCarpetaIndex(i); setCarpetaEditNombre(c); }} className="h-8 w-8 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-50"><Edit2 className="w-4 h-4" /></Button>
                                        )}
                                        <Button size="sm" variant="ghost" onClick={() => handleEliminarCarpeta(i)} className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Nuevo Crédito Cliente */}
            <Dialog open={showFormModal} onOpenChange={v => { if (!v) resetFormCliente(); setShowFormModal(v); }}>
                <DialogContent className="max-w-md rounded-[32px] p-0 overflow-hidden border-none shadow-2xl">
                    <div className="bg-blue-600 p-6 text-white">
                        <DialogHeader>
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center">
                                    <CreditCard className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <DialogTitle className="text-lg font-black uppercase tracking-tight text-white">
                                        Crédito a Cliente
                                    </DialogTitle>
                                    <p className="text-white/70 font-bold uppercase text-[10px] tracking-widest mt-0.5">
                                        Registrar deuda del cliente
                                    </p>
                                </div>
                            </div>
                        </DialogHeader>
                    </div>

                    <div className="p-6 bg-white dark:bg-slate-900 space-y-4 max-h-[65vh] overflow-y-auto">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2 space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nombre del cliente *</Label>
                                <Input placeholder="ej: María García" value={formCliente.clienteNombre}
                                    onChange={e => setFormCliente(p => ({ ...p, clienteNombre: e.target.value }))}
                                    className="h-12 bg-slate-50 dark:bg-slate-800 border-slate-100 rounded-2xl font-bold" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Teléfono</Label>
                                <Input placeholder="300 123 4567" value={formCliente.clienteTelefono}
                                    onChange={e => setFormCliente(p => ({ ...p, clienteTelefono: e.target.value }))}
                                    className="h-12 bg-slate-50 dark:bg-slate-800 border-slate-100 rounded-2xl font-bold" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Carpeta</Label>
                                <Input placeholder="Alcaldía, Tienda..." value={formCliente.categoriaCliente}
                                    list="listaCarpetas"
                                    onChange={e => setFormCliente(p => ({ ...p, categoriaCliente: e.target.value }))}
                                    className="h-12 bg-slate-50 dark:bg-slate-800 border-slate-100 rounded-2xl font-bold" />
                            </div>
                            <div className="col-span-2 space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Descripción *</Label>
                                <Input placeholder="ej: Pan, torta, productos fiados..." value={formCliente.descripcion}
                                    onChange={e => setFormCliente(p => ({ ...p, descripcion: e.target.value }))}
                                    className="h-12 bg-slate-50 dark:bg-slate-800 border-slate-100 rounded-2xl font-bold" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Monto *</Label>
                                <Input type="number" placeholder="ej: 25000" value={formCliente.monto}
                                    onChange={e => setFormCliente(p => ({ ...p, monto: e.target.value }))}
                                    className="h-12 bg-slate-50 dark:bg-slate-800 border-slate-100 rounded-2xl font-bold" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Fecha</Label>
                                <Input type="date" value={formCliente.fecha}
                                    onChange={e => setFormCliente(p => ({ ...p, fecha: e.target.value }))}
                                    className="h-12 bg-slate-50 dark:bg-slate-800 border-slate-100 rounded-2xl font-bold" />
                            </div>
                            <div className="col-span-2 space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Vence (opcional)</Label>
                                <Input type="date" value={formCliente.fechaVencimiento}
                                    onChange={e => setFormCliente(p => ({ ...p, fechaVencimiento: e.target.value }))}
                                    className="h-12 bg-slate-50 dark:bg-slate-800 border-slate-100 rounded-2xl font-bold" />
                            </div>
                        </div>

                        {/* Foto evidencia */}
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1">
                                <Camera className="w-3 h-3" /> Foto de evidencia (opcional)
                            </Label>
                            <input ref={fileInputClienteRef} type="file" accept="image/*" capture="environment"
                                className="hidden" onChange={handleFotoCliente} />
                            {fotoEvidenciaCliente ? (
                                <div className="relative">
                                    <img src={fotoEvidenciaCliente} alt="Evidencia" className="w-full h-32 object-cover rounded-2xl border-2 border-emerald-400" />
                                    <button onClick={() => setFotoEvidenciaCliente(undefined)}
                                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <Button variant="outline" onClick={() => fileInputClienteRef.current?.click()}
                                    className="w-full h-20 rounded-2xl border-dashed border-slate-200 gap-2 flex-col text-xs font-bold uppercase tracking-widest text-slate-400 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50">
                                    <Camera className="w-5 h-5 opacity-50" />
                                    Tomar foto (opcional)
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="p-5 border-t border-slate-100 bg-slate-50 dark:bg-slate-900 flex justify-end gap-3">
                        <Button variant="ghost" onClick={() => { resetFormCliente(); setShowFormModal(false); }}
                            className="h-11 px-5 rounded-2xl font-black uppercase text-xs tracking-widest text-slate-400">
                            Cancelar
                        </Button>
                        <Button onClick={handleGuardarCredito} disabled={isSavingCliente}
                            className="h-11 px-8 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-blue-500/20">
                            {isSavingCliente ? 'Guardando...' : 'Registrar Crédito'}
                        </Button>
                    </div>
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
                <DialogContent className="max-w-md rounded-[32px] p-0 overflow-hidden border-none shadow-2xl">
                    <div className="bg-violet-600 p-6 text-white">
                        <DialogHeader>
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center">
                                    <UserCircle2 className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <DialogTitle className="text-lg font-black uppercase tracking-tight text-white">
                                        Crédito a Trabajador
                                    </DialogTitle>
                                    <p className="text-white/70 font-bold uppercase text-[10px] tracking-widest mt-0.5">
                                        Registrar deuda del empleado
                                    </p>
                                </div>
                            </div>
                        </DialogHeader>
                    </div>

                    <div className="p-6 bg-white dark:bg-slate-900 space-y-4 max-h-[65vh] overflow-y-auto">

                        {/* Selector trabajador */}
                        {trabajadores.filter(t => t.estado === 'activo').length === 0 ? (
                            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border-2 border-dashed border-amber-300 dark:border-amber-700 text-center space-y-3">
                                <UserCircle2 className="w-10 h-10 mx-auto text-amber-400 opacity-60" />
                                <p className="text-sm font-black text-amber-700 dark:text-amber-300">No hay trabajadores registrados</p>
                                <p className="text-xs text-amber-600 dark:text-amber-400">
                                    Ve a <strong>Trabajadores</strong> en el menú para crear empleados primero.
                                </p>
                                {onGoToTrabajadores && (
                                    <Button type="button" onClick={() => { setShowCreditoTrabModal(false); onGoToTrabajadores(); }}
                                        className="h-9 px-5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black border-none gap-1.5">
                                        <UserCircle2 className="w-3.5 h-3.5" /> Crear trabajador ahora
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Trabajador *</Label>
                                <Select value={formTrab.trabajadorId} onValueChange={v => setFormTrab(p => ({ ...p, trabajadorId: v }))}>
                                    <SelectTrigger className="h-12 bg-slate-50 dark:bg-slate-800 border-slate-100 rounded-2xl font-bold">
                                        <SelectValue placeholder="Seleccionar empleado..." />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl">
                                        {trabajadores.filter(t => t.estado === 'activo').map(t => (
                                            <SelectItem key={t.id} value={t.id} className="font-bold">
                                                {t.nombre} — {ROL_LABEL[t.rol]}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {trabajadorSeleccionado && (
                                    <p className="text-xs text-violet-600 dark:text-violet-400 font-bold pl-1">
                                        💰 Salario base: {formatCurrency(trabajadorSeleccionado.salarioBase)}/mes
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Descripción y monto */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2 space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Descripción *</Label>
                                <Input
                                    placeholder="ej: Pan, torta, productos del día..."
                                    value={formTrab.descripcion}
                                    onChange={e => setFormTrab(p => ({ ...p, descripcion: e.target.value }))}
                                    className="h-12 bg-slate-50 dark:bg-slate-800 border-slate-100 rounded-2xl font-bold"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Monto *</Label>
                                <Input
                                    type="number"
                                    placeholder="ej: 15000"
                                    value={formTrab.monto}
                                    onChange={e => setFormTrab(p => ({ ...p, monto: e.target.value }))}
                                    className="h-12 bg-slate-50 dark:bg-slate-800 border-slate-100 rounded-2xl font-bold"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Fecha</Label>
                                <Input
                                    type="date"
                                    value={formTrab.fecha}
                                    onChange={e => setFormTrab(p => ({ ...p, fecha: e.target.value }))}
                                    className="h-12 bg-slate-50 dark:bg-slate-800 border-slate-100 rounded-2xl font-bold"
                                />
                            </div>
                        </div>

                        {/* Descuento nómina */}
                        <label
                            onClick={() => setFormTrab(p => ({ ...p, descontarDeSalario: !p.descontarDeSalario }))}
                            className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                                formTrab.descontarDeSalario
                                    ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/20'
                                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                            }`}
                        >
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                formTrab.descontarDeSalario ? 'border-violet-500 bg-violet-500' : 'border-slate-300'
                            }`}>
                                {formTrab.descontarDeSalario && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                            </div>
                            <div className="flex-1">
                                <p className="text-xs font-black text-slate-800 dark:text-slate-200">Descontar de nómina</p>
                                <p className="text-[10px] text-muted-foreground">Se rebajará del próximo salario</p>
                            </div>
                            <Scissors className="w-4 h-4 text-violet-500 shrink-0" />
                        </label>

                        {/* Foto evidencia (opcional) */}
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1">
                                <Camera className="w-3 h-3" /> Foto de evidencia (opcional)
                            </Label>
                            <input ref={fileInputTrabRef} type="file" accept="image/*" capture="environment"
                                className="hidden" onChange={handleFotoTrab} />
                            {fotoEvidenciaTrab ? (
                                <div className="relative">
                                    <img src={fotoEvidenciaTrab} alt="Evidencia" className="w-full h-32 object-cover rounded-2xl border-2 border-emerald-400" />
                                    <button onClick={() => setFotoEvidenciaTrab(undefined)}
                                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <Button variant="outline" onClick={() => fileInputTrabRef.current?.click()}
                                    className="w-full h-20 rounded-2xl border-dashed border-slate-200 gap-2 flex-col text-xs font-bold uppercase tracking-widest text-slate-400 hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50">
                                    <Camera className="w-5 h-5 opacity-50" />
                                    Tomar foto (opcional)
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="p-5 border-t border-slate-100 bg-slate-50 dark:bg-slate-900 flex justify-end gap-3">
                        <Button variant="ghost" onClick={() => { resetFormTrab(); setShowCreditoTrabModal(false); }}
                            className="h-11 px-5 rounded-2xl font-black uppercase text-xs tracking-widest text-slate-400">
                            Cancelar
                        </Button>
                        <Button onClick={handleGuardarCreditoTrab} disabled={isSavingTrab}
                            className="h-11 px-8 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-violet-500/20">
                            {isSavingTrab ? 'Guardando...' : 'Registrar Crédito'}
                        </Button>
                    </div>
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

            {/* Modal: Detalle completo de Ticket */}
            <Dialog open={!!detalleCredito} onOpenChange={v => { if (!v) { setDetalleCredito(null); setEditandoCredito(null); setEditandoDetalleId(null); } }}>
                <DialogContent className="max-w-lg rounded-[28px] p-0 overflow-hidden border-none shadow-2xl">
                    {detalleCredito && (() => {
                        const c = detalleCredito;
                        const totalAbonado = (c.pagos || []).reduce((s, p) => s + p.monto, 0);
                        const editando = editandoDetalleId === c.id;
                        const headerColor = c.estado === 'pagado' ? 'from-emerald-600 to-emerald-700'
                            : c.estado === 'vencido' ? 'from-red-600 to-red-700'
                            : 'from-blue-600 to-blue-700';
                        return (
                            <>
                                {/* Header */}
                                <div className={`bg-gradient-to-r ${headerColor} p-5 text-white`}>
                                    <DialogHeader>
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <DialogTitle className="text-white font-black text-base leading-tight truncate">
                                                    {c.descripcion || 'Ticket sin descripción'}
                                                </DialogTitle>
                                                <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest mt-1">
                                                    {new Date(c.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}
                                                    {c.fechaVencimiento && ` · Vence ${new Date(c.fechaVencimiento).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}`}
                                                </p>
                                            </div>
                                            <span className={`shrink-0 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${
                                                c.estado === 'pagado' ? 'bg-white/20 text-white' :
                                                c.estado === 'vencido' ? 'bg-white/20 text-white' :
                                                'bg-white/20 text-white'
                                            }`}>{c.estado}</span>
                                        </div>
                                    </DialogHeader>
                                    {/* Resumen financiero en header */}
                                    <div className="mt-3 grid grid-cols-3 gap-2">
                                        {[
                                            { label: 'Deuda total', value: formatCurrency(c.monto), dim: false },
                                            { label: 'Abonado', value: formatCurrency(totalAbonado), dim: false },
                                            { label: 'Saldo', value: formatCurrency(c.saldo), dim: c.saldo === 0 },
                                        ].map(item => (
                                            <div key={item.label} className="bg-white/15 rounded-xl px-3 py-2 text-center">
                                                <p className="text-[8px] font-black uppercase tracking-widest text-white/60">{item.label}</p>
                                                <p className={`text-sm font-black mt-0.5 ${item.dim ? 'text-white/50' : 'text-white'}`}>{item.value}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Cuerpo */}
                                <div className="p-5 space-y-4 max-h-[55vh] overflow-y-auto bg-white dark:bg-slate-900">

                                    {/* Modo edición */}
                                    {editando ? (
                                        <div className="space-y-3 bg-blue-50 dark:bg-blue-950/20 rounded-2xl p-4 border border-blue-200 dark:border-blue-800">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-blue-600">✏️ Editando ticket</p>

                                            {/* Monto total editable — campo directo */}
                                            <div className="bg-white dark:bg-slate-900 rounded-xl border border-blue-300 dark:border-blue-700 px-4 py-3">
                                                <Label className="text-[9px] font-black uppercase tracking-widest text-blue-600">Monto total del crédito</Label>
                                                <Input
                                                    type="number" min="0" step="100"
                                                    value={formEditCliente.montoManual}
                                                    onChange={e => setFormEditCliente(p => ({ ...p, montoManual: e.target.value }))}
                                                    placeholder={`Actual: ${formatCurrency(c.monto)}`}
                                                    className="mt-1 h-11 rounded-xl text-lg font-black text-center border-blue-200 focus:border-blue-500" />
                                                <p className="text-[8px] text-slate-400 font-bold mt-1 text-center">Escribe el monto total de la deuda</p>
                                            </div>

                                            <div>
                                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Estado</Label>
                                                <Select value={formEditCliente.estado} onValueChange={v => setFormEditCliente(p => ({ ...p, estado: v }))}>
                                                    <SelectTrigger className="mt-1 h-10 rounded-xl"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="activo">Activo</SelectItem>
                                                        <SelectItem value="pagado">Pagado</SelectItem>
                                                        <SelectItem value="vencido">Vencido</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Descripción</Label>
                                                <Input value={formEditCliente.descripcion}
                                                    onChange={e => setFormEditCliente(p => ({ ...p, descripcion: e.target.value }))}
                                                    className="mt-1 h-10 rounded-xl" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Fecha del crédito</Label>
                                                    <Input type="date" value={formEditCliente.fecha}
                                                        onChange={e => setFormEditCliente(p => ({ ...p, fecha: e.target.value }))}
                                                        className="mt-1 h-10 rounded-xl" />
                                                </div>
                                                <div>
                                                    <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Fecha vencimiento</Label>
                                                    <Input type="date" value={formEditCliente.fechaVencimiento}
                                                        onChange={e => setFormEditCliente(p => ({ ...p, fechaVencimiento: e.target.value }))}
                                                        className="mt-1 h-10 rounded-xl" />
                                                </div>
                                            </div>

                                            {/* Items editables */}
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Productos</Label>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormEditCliente(p => ({
                                                            ...p,
                                                            items: [...p.items, { productoId: '', nombre: '', cantidad: 1, precioUnitario: 0, subtotal: 0 }]
                                                        }))}
                                                        className="text-[9px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800 flex items-center gap-1">
                                                        <Plus className="w-3 h-3" /> Agregar fila
                                                    </button>
                                                </div>
                                                <div className="space-y-1.5">
                                                    {formEditCliente.items.map((item, idx) => (
                                                        <div key={idx} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 space-y-1.5">
                                                            <Input
                                                                value={item.nombre}
                                                                onChange={e => setFormEditCliente(p => {
                                                                    const items = p.items.map((it, i) => i === idx ? { ...it, nombre: e.target.value } : it);
                                                                    return { ...p, items };
                                                                })}
                                                                placeholder="Nombre del producto"
                                                                className="h-7 text-xs rounded-lg" />
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex items-center gap-1 flex-1">
                                                                    <span className="text-[8px] font-black text-slate-400 uppercase shrink-0">Cant</span>
                                                                    <Input
                                                                        type="number" min="0.01" step="1"
                                                                        value={item.cantidad}
                                                                        onChange={e => setFormEditCliente(p => {
                                                                            const cant = parseFloat(e.target.value) || 0;
                                                                            const items = p.items.map((it, i) => i === idx ? { ...it, cantidad: cant, subtotal: Math.round(cant * it.precioUnitario * 100) / 100 } : it);
                                                                            return { ...p, items };
                                                                        })}
                                                                        className="h-7 text-xs rounded-lg text-center" />
                                                                </div>
                                                                <div className="flex items-center gap-1 flex-1">
                                                                    <span className="text-[8px] font-black text-slate-400 uppercase shrink-0">$ c/u</span>
                                                                    <Input
                                                                        type="number" min="0" step="100"
                                                                        value={item.precioUnitario}
                                                                        onChange={e => setFormEditCliente(p => {
                                                                            const precio = parseFloat(e.target.value) || 0;
                                                                            const items = p.items.map((it, i) => i === idx ? { ...it, precioUnitario: precio, subtotal: Math.round(it.cantidad * precio * 100) / 100 } : it);
                                                                            return { ...p, items };
                                                                        })}
                                                                        className="h-7 text-xs rounded-lg text-center" />
                                                                </div>
                                                                <span className="text-xs font-black text-slate-700 dark:text-slate-300 shrink-0 min-w-[60px] text-right">
                                                                    {formatCurrency(item.subtotal)}
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setFormEditCliente(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }))}
                                                                    className="shrink-0 text-red-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20">
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {formEditCliente.items.length > 0 && (
                                                        <div className="flex justify-between px-3 py-2 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-800">
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-blue-600">Nuevo total</span>
                                                            <span className="text-sm font-black text-blue-700 dark:text-blue-400">{formatCurrency(formEditCliente.items.reduce((s, i) => s + i.subtotal, 0))}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        /* Modo vista — info del ticket */
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
                                                <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Fecha crédito</p>
                                                <p className="text-sm font-black text-slate-800 dark:text-slate-200 mt-0.5">
                                                    {new Date(c.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </p>
                                            </div>
                                            {c.fechaVencimiento && (
                                                <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-3 border border-amber-100 dark:border-amber-800">
                                                    <p className="text-[8px] font-black uppercase tracking-widest text-amber-500">Vencimiento</p>
                                                    <p className="text-sm font-black text-amber-700 dark:text-amber-300 mt-0.5">
                                                        {new Date(c.fechaVencimiento).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Productos / Items — solo en modo vista */}
                                    {!editando && c.items && c.items.length > 0 && (
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                                                <Package className="w-3 h-3" /> Productos ({c.items.length})
                                            </p>
                                            <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                                                {c.items.map((item, idx) => (
                                                    <div key={item.productoId || idx}
                                                        className={`flex items-center justify-between px-4 py-2.5 text-sm ${idx !== 0 ? 'border-t border-slate-50 dark:border-slate-800' : ''} ${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-800/30'}`}>
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <span className="text-[10px] font-black text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-md w-6 text-center shrink-0">{item.cantidad}</span>
                                                            <span className="font-bold text-slate-700 dark:text-slate-300 truncate">{item.nombre}</span>
                                                        </div>
                                                        <span className="font-black text-slate-800 dark:text-slate-200 shrink-0 ml-2">{formatCurrency(item.subtotal)}</span>
                                                    </div>
                                                ))}
                                                <div className="flex justify-between px-4 py-2.5 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total productos</span>
                                                    <span className="font-black text-slate-700 dark:text-slate-300">{formatCurrency(c.items.reduce((s, i) => s + i.subtotal, 0))}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Abonos / Pagos */}
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                                            <DollarSign className="w-3 h-3" /> Abonos realizados {c.pagos?.length > 0 && `(${c.pagos.length})`}
                                        </p>
                                        {!c.pagos || c.pagos.length === 0 ? (
                                            <div className="text-center py-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                                                <p className="text-xs text-slate-400 font-bold">Sin abonos registrados</p>
                                            </div>
                                        ) : (
                                            <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                                                {[...c.pagos].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()).map((pago, idx) => (
                                                    <div key={pago.id || idx}
                                                        className={`flex items-center justify-between px-4 py-2.5 ${idx !== 0 ? 'border-t border-slate-50 dark:border-slate-800' : ''} bg-white dark:bg-slate-900`}>
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                                            <div className="min-w-0">
                                                                <p className="text-[10px] font-black text-slate-500">
                                                                    {new Date(pago.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                                </p>
                                                                <p className="text-[9px] text-slate-400 capitalize">{pago.metodoPago}{pago.nota && ` · ${pago.nota}`}</p>
                                                            </div>
                                                        </div>
                                                        <span className="font-black text-emerald-600 dark:text-emerald-400 shrink-0">{formatCurrency(pago.monto)}</span>
                                                    </div>
                                                ))}
                                                <div className="flex justify-between px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/20 border-t border-emerald-100 dark:border-emerald-800">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Total abonado</span>
                                                    <span className="font-black text-emerald-600">{formatCurrency(totalAbonado)}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Foto de evidencia */}
                                    {c.fotoEvidencia && (
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                                                <Image className="w-3 h-3" /> Evidencia
                                            </p>
                                            <button onClick={() => setShowFotoModal(c.fotoEvidencia!)}
                                                className="w-full rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-700 hover:ring-2 hover:ring-blue-400 transition-all">
                                                <img src={c.fotoEvidencia} alt="Evidencia" className="w-full max-h-40 object-cover" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex gap-2 flex-wrap">
                                    {editando ? (
                                        <>
                                            <Button variant="ghost" onClick={() => setEditandoDetalleId(null)}
                                                className="h-10 px-4 rounded-xl text-xs font-black uppercase text-slate-400">
                                                Cancelar
                                            </Button>
                                            <Button onClick={async () => { await handleGuardarEditCliente(); setDetalleCredito(null); }}
                                                disabled={isSavingEditCliente}
                                                className="h-10 flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase shadow-sm">
                                                {isSavingEditCliente ? 'Guardando…' : '✓ Guardar cambios'}
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <Button variant="ghost" onClick={() => setDetalleCredito(null)}
                                                className="h-10 px-4 rounded-xl text-xs font-black uppercase text-slate-400">
                                                Cerrar
                                            </Button>
                                            <Button variant="outline" onClick={() => {
                                                setFormEditCliente({
                                                    estado: c.estado,
                                                    descripcion: c.descripcion,
                                                    fecha: c.fecha ? c.fecha.split('T')[0] : new Date().toISOString().split('T')[0],
                                                    fechaVencimiento: c.fechaVencimiento || '',
                                                    items: (c.items || []).map(i => ({ ...i })),
                                                    montoManual: c.monto ? c.monto.toString() : '',
                                                });
                                                setEditandoDetalleId(c.id);
                                            }}
                                                className="h-10 px-4 rounded-xl text-xs font-black uppercase border-blue-200 text-blue-600 hover:bg-blue-50 gap-1.5">
                                                <Edit2 className="w-3.5 h-3.5" /> Editar
                                            </Button>
                                            {c.estado !== 'pagado' && (
                                                <Button onClick={() => { setSelectedCredito(c); setShowPagoClienteModal(true); }}
                                                    className="h-10 flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase shadow-sm gap-1.5">
                                                    <DollarSign className="w-3.5 h-3.5" /> Registrar abono
                                                </Button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </>
                        );
                    })()}
                </DialogContent>
            </Dialog>

            {/* Modal: Editar Crédito Cliente */}
            <Dialog open={!!editandoCredito} onOpenChange={v => { if (!v) setEditandoCredito(null); }}>
                <DialogContent className="rounded-3xl max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase tracking-tight text-sm">Editar Crédito</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div>
                            <Label className="text-xs font-bold uppercase tracking-widest">Estado</Label>
                            <Select value={formEditCliente.estado} onValueChange={v => setFormEditCliente(p => ({ ...p, estado: v }))}>
                                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="activo">Activo</SelectItem>
                                    <SelectItem value="pagado">Pagado</SelectItem>
                                    <SelectItem value="vencido">Vencido</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs font-bold uppercase tracking-widest">Descripción</Label>
                            <Input
                                value={formEditCliente.descripcion}
                                onChange={e => setFormEditCliente(p => ({ ...p, descripcion: e.target.value }))}
                                placeholder="Descripción del crédito..."
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label className="text-xs font-bold uppercase tracking-widest">Fecha del crédito</Label>
                            <Input
                                type="date"
                                value={formEditCliente.fecha}
                                onChange={e => setFormEditCliente(p => ({ ...p, fecha: e.target.value }))}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label className="text-xs font-bold uppercase tracking-widest">Fecha de vencimiento</Label>
                            <Input
                                type="date"
                                value={formEditCliente.fechaVencimiento}
                                onChange={e => setFormEditCliente(p => ({ ...p, fechaVencimiento: e.target.value }))}
                                className="mt-1"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setEditandoCredito(null)}>Cancelar</Button>
                        <Button onClick={handleGuardarEditCliente} disabled={isSavingEditCliente}
                            className="bg-blue-600 hover:bg-blue-700 text-white">
                            {isSavingEditCliente ? 'Guardando...' : 'Guardar cambios'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal: Editar Crédito Trabajador */}
            <Dialog open={!!editandoCreditoTrab} onOpenChange={v => { if (!v) setEditandoCreditoTrab(null); }}>
                <DialogContent className="rounded-3xl max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase tracking-tight text-sm">Editar Crédito Trabajador</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div>
                            <Label className="text-xs font-bold uppercase tracking-widest">Estado</Label>
                            <Select value={formEditTrab.estado} onValueChange={v => setFormEditTrab(p => ({ ...p, estado: v }))}>
                                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="activo">Activo</SelectItem>
                                    <SelectItem value="pagado">Pagado</SelectItem>
                                    <SelectItem value="descontado">Descontado de nómina</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs font-bold uppercase tracking-widest">Descripción</Label>
                            <Input
                                value={formEditTrab.descripcion}
                                onChange={e => setFormEditTrab(p => ({ ...p, descripcion: e.target.value }))}
                                placeholder="¿Qué tomó el trabajador?"
                                className="mt-1"
                            />
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                            <input
                                type="checkbox"
                                id="descuento-edit"
                                checked={formEditTrab.descontarDeSalario}
                                onChange={e => setFormEditTrab(p => ({ ...p, descontarDeSalario: e.target.checked }))}
                                className="rounded"
                            />
                            <Label htmlFor="descuento-edit" className="text-xs font-bold cursor-pointer">Descontar de nómina</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setEditandoCreditoTrab(null)}>Cancelar</Button>
                        <Button onClick={handleGuardarEditTrab} disabled={isSavingEditTrab}
                            className="bg-blue-600 hover:bg-blue-700 text-white">
                            {isSavingEditTrab ? 'Guardando...' : 'Guardar cambios'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
