import { useState, useMemo, useRef } from 'react';
import {
    UserCircle2, Users, Plus, Search, Trash2, Edit2,
    CreditCard, DollarSign, Camera, X, Package,
    CheckCircle, Clock, Scissors, ChevronDown, ChevronUp, Image, Printer,
    KeyRound, Eye, EyeOff
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
import { useAuth } from '@/contexts/AuthContext';
import type {
    Trabajador, TrabajadorRol, TrabajadorEstado,
    CreditoTrabajador, MetodoPago, Usuario, UserRole
} from '@/types';

interface TrabajadoresProps {
    trabajadores: Trabajador[];
    onAddTrabajador: (t: Omit<Trabajador, 'id' | 'createdAt'>) => Promise<void>;
    onUpdateTrabajador: (id: string, updates: Partial<Trabajador>) => Promise<void>;
    onDeleteTrabajador: (id: string) => Promise<void>;
    formatCurrency: (value: number) => string;
    // Créditos trabajadores
    creditosTrabajadores: CreditoTrabajador[];
    onAddCreditoTrabajador: (c: Omit<CreditoTrabajador, 'id' | 'createdAt'>) => Promise<void>;
    onUpdateCreditoTrabajador: (id: string, updates: Partial<CreditoTrabajador>) => Promise<void>;
    onDeleteCreditoTrabajador: (id: string) => Promise<void>;
    onRegistrarPagoCreditoTrabajador: (creditoId: string, pago: { monto: number; fecha: string; metodoPago: MetodoPago; nota?: string }) => Promise<void>;
    usuario: Usuario;
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

const CREDITO_ESTADO_COLOR: Record<string, string> = {
    activo: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    pagado: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    descontado: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
};

const ROL_TO_SYSTEM_ROLE: Record<TrabajadorRol, UserRole> = {
    panadero: 'PANADERO',
    vendedor: 'VENDEDOR',
    cajero: 'VENDEDOR',
    repartidor: 'AUXILIAR',
    administrador: 'ADMIN',
    otro: 'AUXILIAR',
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
    fotoPerfil: undefined,
};

// Convierte archivo a base64
async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

type Tab = 'empleados' | 'creditos';

export default function Trabajadores({
    trabajadores,
    onAddTrabajador,
    onUpdateTrabajador,
    onDeleteTrabajador,
    formatCurrency,
    creditosTrabajadores,
    onAddCreditoTrabajador,
    onUpdateCreditoTrabajador,
    onDeleteCreditoTrabajador,
    onRegistrarPagoCreditoTrabajador,
    usuario,
}: TrabajadoresProps) {
    const { usuarios, addUsuario } = useAuth();
    const [tab, setTab] = useState<Tab>('empleados');
    const [searchTerm, setSearchTerm] = useState('');
    const [filtroEstado, setFiltroEstado] = useState<string>('todos');

    // Estado modal "Crear Acceso al Sistema"
    const [showAccesoModal, setShowAccesoModal] = useState(false);
    const [trabajadorParaAcceso, setTrabajadorParaAcceso] = useState<Trabajador | null>(null);
    const [accesoPassword, setAccesoPassword] = useState('');
    const [showAccesoPassword, setShowAccesoPassword] = useState(false);
    const [isSavingAcceso, setIsSavingAcceso] = useState(false);

    // Estado modal trabajador
    const [showModal, setShowModal] = useState(false);
    const [editando, setEditando] = useState<Trabajador | null>(null);
    const [formData, setFormData] = useState<Omit<Trabajador, 'id' | 'createdAt'>>(FORM_VACIO);
    const [isSaving, setIsSaving] = useState(false);

    // Estado créditos
    const [filtroCreditoTrabajador, setFiltroCreditoTrabajador] = useState<string>('todos');
    const [searchCredito, setSearchCredito] = useState('');
    const [showCreditoModal, setShowCreditoModal] = useState(false);
    const [showPagoModal, setShowPagoModal] = useState(false);
    const [showFotoModal, setShowFotoModal] = useState<string | null>(null);
    const [expandedCreditoId, setExpandedCreditoId] = useState<string | null>(null);
    const [selectedCreditoTrabajador, setSelectedCreditoTrabajador] = useState<CreditoTrabajador | null>(null);

    // Formulario crédito trabajador
    const [creditoForm, setCreditoForm] = useState({
        trabajadorId: '',
        descripcion: '',
        fecha: new Date().toISOString().split('T')[0],
        descontarDeSalario: true,
        monto: '',
    });
    const [creditoFoto, setCreditoFoto] = useState<string | undefined>(undefined);
    const fotoInputRef = useRef<HTMLInputElement>(null);
    const fotoPerfilInputRef = useRef<HTMLInputElement>(null);

    // Formulario pago
    const [formPago, setFormPago] = useState({
        monto: '',
        fecha: new Date().toISOString().split('T')[0],
        metodoPago: 'efectivo' as MetodoPago,
        nota: '',
    });

    const handleCrearAcceso = async () => {
        if (!trabajadorParaAcceso || !accesoPassword.trim()) {
            toast.error('La contraseña es obligatoria');
            return;
        }
        setIsSavingAcceso(true);
        try {
            const username = (trabajadorParaAcceso.email?.trim() || trabajadorParaAcceso.nombre.toLowerCase().replace(/\s+/g, '.')).toLowerCase();
            const ok = await addUsuario({
                email: username,
                nombre: trabajadorParaAcceso.nombre.split(' ')[0],
                apellido: trabajadorParaAcceso.nombre.split(' ').slice(1).join(' ') || '',
                rol: ROL_TO_SYSTEM_ROLE[trabajadorParaAcceso.rol],
                activo: true,
                password: accesoPassword,
            });
            if (ok) {
                toast.success(`Acceso creado para ${trabajadorParaAcceso.nombre}`);
                setShowAccesoModal(false);
                setAccesoPassword('');
                setTrabajadorParaAcceso(null);
            } else {
                toast.error('No se pudo crear. ¿Ya existe ese usuario?');
            }
        } catch {
            toast.error('Error al crear acceso');
        } finally {
            setIsSavingAcceso(false);
        }
    };

    // Filtros trabajadores
    const trabajadoresFiltrados = useMemo(() => {
        return trabajadores.filter(t => {
            const matchSearch = t.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.rol.toLowerCase().includes(searchTerm.toLowerCase());
            const matchEstado = filtroEstado === 'todos' || t.estado === filtroEstado;
            return matchSearch && matchEstado;
        }).sort((a, b) => a.nombre.localeCompare(b.nombre));
    }, [trabajadores, searchTerm, filtroEstado]);

    // Stats trabajadores
    const stats = useMemo(() => {
        const activos = trabajadores.filter(t => t.estado === 'activo');
        const nominaTotal = activos.reduce((s, t) => s + t.salarioBase, 0);
        return { total: trabajadores.length, activos: activos.length, nominaTotal };
    }, [trabajadores]);

    // Stats créditos trabajadores
    const creditosStats = useMemo(() => {
        const activos = creditosTrabajadores.filter(c => c.estado === 'activo');
        const totalPendiente = activos.reduce((s, c) => s + c.saldo, 0);
        return { total: creditosTrabajadores.length, activos: activos.length, totalPendiente };
    }, [creditosTrabajadores]);

    // Filtrar créditos
    const creditosFiltrados = useMemo(() => {
        return creditosTrabajadores.filter(c => {
            const matchSearch = c.trabajadorNombre.toLowerCase().includes(searchCredito.toLowerCase()) ||
                c.descripcion.toLowerCase().includes(searchCredito.toLowerCase());
            const matchEstado = filtroCreditoTrabajador === 'todos' || c.estado === filtroCreditoTrabajador;
            return matchSearch && matchEstado;
        }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [creditosTrabajadores, searchCredito, filtroCreditoTrabajador]);

    // Trabajador seleccionado para crédito
    const trabajadorSeleccionado = useMemo(() =>
        trabajadores.find(t => t.id === creditoForm.trabajadorId),
        [trabajadores, creditoForm.trabajadorId]
    );

    // Modal trabajador
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
            fotoPerfil: t.fotoPerfil || undefined,
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

    // Foto de perfil del trabajador
    const handleFotoPerfil = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const base64 = await fileToBase64(file);
            setFormData(p => ({ ...p, fotoPerfil: base64 }));
            toast.success('Foto de perfil actualizada');
        } catch {
            toast.error('Error al cargar la foto');
        }
    };

    // Foto evidencia crédito
    const handleCapturarFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const base64 = await fileToBase64(file);
            setCreditoFoto(base64);
            toast.success('Foto de evidencia capturada');
        } catch {
            toast.error('Error al capturar la foto');
        }
    };

    const resetCreditoForm = () => {
        setCreditoForm({ trabajadorId: '', descripcion: '', fecha: new Date().toISOString().split('T')[0], descontarDeSalario: true, monto: '' });
        setCreditoFoto(undefined);
    };

    // Guardar crédito trabajador
    const handleGuardarCredito = async () => {
        if (!creditoForm.trabajadorId) {
            toast.error('Selecciona un trabajador');
            return;
        }
        if (!creditoForm.descripcion.trim()) {
            toast.error('Ingresa una descripción de lo que tomó');
            return;
        }
        const monto = parseFloat(creditoForm.monto);
        if (isNaN(monto) || monto <= 0) {
            toast.error('El monto debe ser un número positivo');
            return;
        }
        if (!creditoFoto) {
            toast.error('La foto de evidencia es obligatoria para créditos de trabajadores');
            return;
        }
        setIsSaving(true);
        try {
            await onAddCreditoTrabajador({
                trabajadorId: creditoForm.trabajadorId,
                trabajadorNombre: trabajadorSeleccionado?.nombre || '',
                trabajadorRol: trabajadorSeleccionado?.rol,
                monto,
                saldo: monto,
                descripcion: creditoForm.descripcion.trim(),
                fecha: creditoForm.fecha,
                estado: 'activo',
                items: [],
                fotoEvidencia: creditoFoto,
                descontarDeSalario: creditoForm.descontarDeSalario,
                pagos: [],
                usuarioId: usuario.id,
            });
            setShowCreditoModal(false);
            resetCreditoForm();
            toast.success(`Crédito de ${formatCurrency(monto)} registrado para ${trabajadorSeleccionado?.nombre}`);
        } catch {
            toast.error('Error al registrar el crédito');
        } finally {
            setIsSaving(false);
        }
    };

    // Registrar pago crédito trabajador
    const handleRegistrarPago = async () => {
        if (!selectedCreditoTrabajador) return;
        const monto = parseFloat(formPago.monto);
        if (isNaN(monto) || monto <= 0) {
            toast.error('Ingresa un monto válido');
            return;
        }
        if (monto > selectedCreditoTrabajador.saldo) {
            toast.error(`El pago no puede superar el saldo de ${formatCurrency(selectedCreditoTrabajador.saldo)}`);
            return;
        }
        setIsSaving(true);
        try {
            await onRegistrarPagoCreditoTrabajador(selectedCreditoTrabajador.id, {
                monto,
                fecha: formPago.fecha,
                metodoPago: formPago.metodoPago,
                nota: formPago.nota || undefined,
            });
            setShowPagoModal(false);
            setSelectedCreditoTrabajador(null);
            setFormPago({ monto: '', fecha: new Date().toISOString().split('T')[0], metodoPago: 'efectivo', nota: '' });
            toast.success(`Pago de ${formatCurrency(monto)} registrado`);
        } catch {
            toast.error('Error al registrar el pago');
        } finally {
            setIsSaving(false);
        }
    };

    // ── Exportar resumen mensual de nómina a PDF ────────────────────────────
    const exportarResumenMensual = () => {
        const fmt = (n: number) => formatCurrency(n);
        const ahora = new Date();
        const mesLabel = ahora.toLocaleDateString('es', { month: 'long', year: 'numeric' });
        const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).getTime();
        const activos = trabajadores.filter(t => t.estado === 'activo');

        const filas = activos.map(t => {
            const creditosMes = creditosTrabajadores.filter(c =>
                c.trabajadorId === t.id &&
                new Date(c.fecha).getTime() >= inicioMes
            );
            const adelantosMes = creditosMes.filter(c => !c.descontarDeSalario);
            const descuentosMes = creditosMes.filter(c => c.descontarDeSalario);
            const totalAdelantos = adelantosMes.reduce((s, c) => s + c.monto, 0);
            const totalDescuentos = descuentosMes.reduce((s, c) => s + c.monto, 0);
            const saldoPendiente = creditosTrabajadores
                .filter(c => c.trabajadorId === t.id && c.estado === 'activo')
                .reduce((s, c) => s + c.saldo, 0);
            const aPagar = Math.max(0, t.salarioBase - totalDescuentos);
            const rolLabel = ROL_LABEL[t.rol] ?? t.rol;
            return { t, rolLabel, totalAdelantos, totalDescuentos, saldoPendiente, aPagar };
        });

        const totalNomina = filas.reduce((s, r) => s + r.t.salarioBase, 0);
        const totalDescuentosGlobal = filas.reduce((s, r) => s + r.totalDescuentos, 0);
        const totalAPagar = filas.reduce((s, r) => s + r.aPagar, 0);
        const totalPendiente = filas.reduce((s, r) => s + r.saldoPendiente, 0);

        const tablasHTML = filas.map(r => `<tr>
          <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;font-size:12px;font-weight:700">${r.t.nombre}</td>
          <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#64748b">${r.rolLabel}</td>
          <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:right;font-weight:700">${fmt(r.t.salarioBase)}</td>
          <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:right;color:#d97706">${r.totalAdelantos > 0 ? fmt(r.totalAdelantos) : '—'}</td>
          <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:right;color:#dc2626">${r.totalDescuentos > 0 ? fmt(r.totalDescuentos) : '—'}</td>
          <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:right;color:#7c3aed">${r.saldoPendiente > 0 ? fmt(r.saldoPendiente) : '<span style="color:#16a34a">✓</span>'}</td>
          <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;font-size:13px;text-align:right;font-weight:900;color:#16a34a">${fmt(r.aPagar)}</td>
        </tr>`).join('');

        const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Resumen Nómina — ${mesLabel}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:system-ui,sans-serif;margin:24px;color:#0f172a;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  h1{font-size:20px;font-weight:900;text-transform:uppercase;letter-spacing:.05em;margin:0}
  .sub{font-size:11px;color:#64748b;margin-top:2px}
  .kpi-row{display:flex;gap:12px;margin:14px 0;flex-wrap:wrap}
  .kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;flex:1;min-width:110px}
  .kpi-label{font-size:9px;font-weight:700;text-transform:uppercase;color:#94a3b8;letter-spacing:.08em}
  .kpi-value{font-size:18px;font-weight:900;margin-top:2px}
  table{width:100%;border-collapse:collapse;margin-top:14px}
  th{background:#1e293b;color:white;padding:8px 6px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;text-align:left}
  tr:nth-child(even) td{background:#f8fafc}
  tfoot td{background:#1e293b;color:white;padding:8px 6px;font-size:12px;font-weight:900}
  .firma{margin-top:40px;display:flex;gap:40px}
  .firma-box{flex:1;border-top:1px solid #cbd5e1;padding-top:8px;font-size:11px;color:#475569}
  @media print{body{margin:10px}button{display:none}}
</style>
</head>
<body>
<div style="display:flex;justify-content:space-between;align-items:flex-start">
  <div>
    <h1>Resumen Nómina Mensual</h1>
    <p class="sub">Panadería Dulce Placer &middot; ${mesLabel}</p>
  </div>
  <button onclick="window.print()" style="background:#4f46e5;color:white;border:none;border-radius:8px;padding:8px 18px;font-weight:700;font-size:12px;cursor:pointer">Imprimir / PDF</button>
</div>
<p class="sub" style="margin-top:8px">Generado el ${ahora.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
<div class="kpi-row">
  <div class="kpi"><div class="kpi-label">Empleados activos</div><div class="kpi-value">${activos.length}</div></div>
  <div class="kpi"><div class="kpi-label">Nómina bruta</div><div class="kpi-value">${fmt(totalNomina)}</div></div>
  <div class="kpi"><div class="kpi-label">Desc. nómina</div><div class="kpi-value" style="color:#dc2626">${fmt(totalDescuentosGlobal)}</div></div>
  <div class="kpi"><div class="kpi-label">Total a pagar</div><div class="kpi-value" style="color:#16a34a">${fmt(totalAPagar)}</div></div>
  <div class="kpi"><div class="kpi-label">Saldo pendiente</div><div class="kpi-value" style="color:#7c3aed">${fmt(totalPendiente)}</div></div>
</div>
<table>
  <thead><tr>
    <th>Empleado</th><th>Rol</th>
    <th style="text-align:right">Salario</th>
    <th style="text-align:right">Adelantos</th>
    <th style="text-align:right">Desc. Nómina</th>
    <th style="text-align:right">Saldo Pend.</th>
    <th style="text-align:right">A Pagar</th>
  </tr></thead>
  <tbody>${tablasHTML}</tbody>
  <tfoot><tr>
    <td colspan="2">TOTAL</td>
    <td style="text-align:right">${fmt(totalNomina)}</td>
    <td style="text-align:right;color:#fcd34d">${fmt(filas.reduce((s,r)=>s+r.totalAdelantos,0))}</td>
    <td style="text-align:right;color:#fca5a5">${fmt(totalDescuentosGlobal)}</td>
    <td style="text-align:right;color:#c4b5fd">${fmt(totalPendiente)}</td>
    <td style="text-align:right;color:#86efac">${fmt(totalAPagar)}</td>
  </tr></tfoot>
</table>
<div class="firma">
  <div class="firma-box">Elaborado por: _______________________</div>
  <div class="firma-box">Aprobado por: _______________________</div>
  <div class="firma-box">Fecha de pago: _______________________</div>
</div>
</body>
</html>`;
        const win = window.open('', '_blank', 'width=900,height=680');
        if (!win) { toast.error('Habilita ventanas emergentes para exportar PDF'); return; }
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 400);
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
                        <h1 className="text-xl font-black text-slate-900 dark:text-white">Trabajadores</h1>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            Gestión de empleados y créditos
                        </p>
                    </div>
                </div>
                {tab === 'empleados' ? (
                    <Button
                        onClick={abrirModalNuevo}
                        className="h-10 px-6 bg-violet-600 hover:bg-violet-700 text-white rounded-xl shadow-lg gap-2 font-black uppercase tracking-widest text-xs border-none"
                    >
                        <Plus className="w-4 h-4" /> Nuevo Trabajador
                    </Button>
                ) : (
                    <Button
                        onClick={() => { resetCreditoForm(); setShowCreditoModal(true); }}
                        className="h-10 px-6 bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-lg gap-2 font-black uppercase tracking-widest text-xs border-none"
                    >
                        <Plus className="w-4 h-4" /> Registrar Crédito
                    </Button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <button
                    onClick={() => setTab('empleados')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                        tab === 'empleados'
                            ? 'bg-violet-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                >
                    <UserCircle2 className="w-3.5 h-3.5" /> Empleados
                    <Badge className="text-[9px] border-none px-1.5 py-0 bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                        {stats.activos}
                    </Badge>
                </button>
                <button
                    onClick={() => setTab('creditos')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                        tab === 'creditos'
                            ? 'bg-amber-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                >
                    <CreditCard className="w-3.5 h-3.5" /> Créditos
                    {creditosStats.activos > 0 && (
                        <Badge className="text-[9px] border-none px-1.5 py-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                            {creditosStats.activos}
                        </Badge>
                    )}
                </button>
            </div>

            {/* ===== TAB EMPLEADOS ===== */}
            {tab === 'empleados' && (
                <>
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

                    {/* Botón resumen mensual */}
                    {stats.activos > 0 && (
                        <div className="flex justify-end">
                            <button
                                onClick={exportarResumenMensual}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-50 hover:bg-violet-100 dark:bg-violet-950/20 dark:hover:bg-violet-900/30 text-violet-600 dark:text-violet-400 text-xs font-black uppercase tracking-widest transition-colors"
                            >
                                <Printer className="w-3.5 h-3.5" /> Resumen mensual PDF
                            </button>
                        </div>
                    )}

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

                    {/* Lista trabajadores */}
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
                            trabajadoresFiltrados.map(t => {
                                const creditosTrabajador = creditosTrabajadores.filter(c => c.trabajadorId === t.id && c.estado === 'activo');
                                const usernameEsperado = (t.email?.trim() || t.nombre.toLowerCase().replace(/\s+/g, '.')).toLowerCase();
                                const tieneAcceso = usuarios.some(u =>
                                    u.email.toLowerCase() === (t.email || '').toLowerCase() ||
                                    u.email.toLowerCase() === usernameEsperado
                                );
                                return (
                                    <Card key={t.id} className="rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        {t.fotoPerfil ? (
                                                            <img src={t.fotoPerfil} alt={t.nombre} className="w-8 h-8 rounded-full object-cover border-2 border-violet-200 dark:border-violet-800 shrink-0" />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                                                                <UserCircle2 className="w-5 h-5 text-violet-400" />
                                                            </div>
                                                        )}
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
                                                        <p className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 mt-1 ${tieneAcceso ? 'text-emerald-600' : 'text-red-400'}`}>
                                                            <KeyRound className="w-3 h-3" />
                                                            {tieneAcceso ? 'Con acceso al sistema' : 'Sin acceso al sistema'}
                                                        </p>
                                                    </div>
                                                    {/* Créditos activos del trabajador */}
                                                    {creditosTrabajador.length > 0 && (
                                                        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 flex items-center gap-1">
                                                                <CreditCard className="w-3 h-3" />
                                                                {creditosTrabajador.length} crédito{creditosTrabajador.length > 1 ? 's' : ''} activo{creditosTrabajador.length > 1 ? 's' : ''}
                                                                {' — '}
                                                                {formatCurrency(creditosTrabajador.reduce((s, c) => s + c.saldo, 0))}
                                                            </p>
                                                        </div>
                                                    )}
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
                                                    {!tieneAcceso && (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => { setTrabajadorParaAcceso(t); setShowAccesoModal(true); }}
                                                            className="h-8 w-8 p-0 rounded-xl text-violet-500 hover:text-violet-700 hover:bg-violet-50"
                                                            title="Crear acceso al sistema"
                                                        >
                                                            <KeyRound className="w-3.5 h-3.5" />
                                                        </Button>
                                                    )}
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => {
                                                            setCreditoForm(p => ({ ...p, trabajadorId: t.id }));
                                                            setTab('creditos');
                                                            setShowCreditoModal(true);
                                                        }}
                                                        className="h-8 w-8 p-0 rounded-xl text-amber-500 hover:text-amber-700 hover:bg-amber-50"
                                                        title="Registrar crédito"
                                                    >
                                                        <CreditCard className="w-3.5 h-3.5" />
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
                                );
                            })
                        )}
                    </div>
                </>
            )}

            {/* ===== TAB CRÉDITOS TRABAJADORES ===== */}
            {tab === 'creditos' && (
                <>
                    {/* KPIs créditos */}
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { label: 'Créditos activos', value: creditosStats.activos, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/20' },
                            { label: 'Total créditos', value: creditosStats.total, color: 'text-slate-700 dark:text-slate-300', bg: 'bg-slate-50 dark:bg-slate-900/50' },
                            { label: 'Pendiente', value: formatCurrency(creditosStats.totalPendiente), color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/20' },
                        ].map(kpi => (
                            <Card key={kpi.label} className={`${kpi.bg} border-none shadow-sm rounded-2xl`}>
                                <CardContent className="p-4 text-center">
                                    <p className={`text-xl font-black ${kpi.color}`}>{kpi.value}</p>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">{kpi.label}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Filtros créditos */}
                    <div className="flex gap-3 flex-wrap">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar trabajador o descripción..."
                                value={searchCredito}
                                onChange={e => setSearchCredito(e.target.value)}
                                className="pl-9 rounded-xl"
                            />
                        </div>
                        <Select value={filtroCreditoTrabajador} onValueChange={setFiltroCreditoTrabajador}>
                            <SelectTrigger className="w-36 rounded-xl">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Todos</SelectItem>
                                <SelectItem value="activo">Activos</SelectItem>
                                <SelectItem value="descontado">Descontados</SelectItem>
                                <SelectItem value="pagado">Pagados</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Lista créditos */}
                    <div className="flex-1 space-y-3 overflow-y-auto">
                        {creditosFiltrados.length === 0 ? (
                            <Card className="rounded-2xl border-dashed">
                                <CardContent className="p-12 text-center text-muted-foreground">
                                    <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-30" />
                                    <p className="font-bold uppercase tracking-widest text-xs">
                                        {searchCredito || filtroCreditoTrabajador !== 'todos' ? 'Sin resultados' : 'No hay créditos de trabajadores'}
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
                                                        {credito.trabajadorNombre}
                                                    </span>
                                                    {credito.trabajadorRol && (
                                                        <Badge className={`${ROL_COLOR[credito.trabajadorRol as TrabajadorRol] || ''} text-[9px] font-bold uppercase tracking-widest border-none`}>
                                                            {ROL_LABEL[credito.trabajadorRol as TrabajadorRol] || credito.trabajadorRol}
                                                        </Badge>
                                                    )}
                                                    <Badge className={`${CREDITO_ESTADO_COLOR[credito.estado]} text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 border-none`}>
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
                                                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                                                        Deuda: {formatCurrency(credito.monto)}
                                                    </span>
                                                    <span className="text-sm font-black text-amber-600 dark:text-amber-400">
                                                        Saldo: {formatCurrency(credito.saldo)}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-0.5">📅 {credito.fecha}</p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {credito.estado === 'activo' && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => { setSelectedCreditoTrabajador(credito); setShowPagoModal(true); }}
                                                        className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black border-none"
                                                    >
                                                        <DollarSign className="w-3 h-3 mr-1" /> Pago
                                                    </Button>
                                                )}
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => setExpandedCreditoId(expandedCreditoId === credito.id ? null : credito.id)}
                                                    className="h-8 w-8 p-0 rounded-xl"
                                                >
                                                    {expandedCreditoId === credito.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={async () => {
                                                        await onDeleteCreditoTrabajador(credito.id);
                                                        toast.success('Crédito eliminado');
                                                    }}
                                                    className="h-8 w-8 p-0 rounded-xl text-red-500 hover:text-red-700 hover:bg-red-50"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                        {/* Foto de evidencia miniatura */}
                                        {credito.fotoEvidencia && expandedCreditoId === credito.id && (
                                            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                                                <button onClick={() => setShowFotoModal(credito.fotoEvidencia!)}>
                                                    <img src={credito.fotoEvidencia} alt="Evidencia" className="h-28 rounded-xl object-cover border border-slate-200 dark:border-slate-700" />
                                                </button>
                                            </div>
                                        )}
                                        {/* Pagos expandidos */}
                                        {expandedCreditoId === credito.id && credito.pagos.length > 0 && (
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
                                        {expandedCreditoId === credito.id && credito.pagos.length === 0 && (
                                            <p className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs text-muted-foreground text-center">Sin pagos registrados</p>
                                        )}
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                </>
            )}

            {/* Modal: Ver Foto */}
            <Dialog open={!!showFotoModal} onOpenChange={() => setShowFotoModal(null)}>
                <DialogContent className="rounded-3xl max-w-sm p-3">
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase tracking-tight text-sm">Evidencia del crédito</DialogTitle>
                    </DialogHeader>
                    {showFotoModal && (
                        <img src={showFotoModal} alt="Evidencia" className="w-full rounded-2xl object-cover max-h-96" />
                    )}
                </DialogContent>
            </Dialog>

            {/* Modal: Crear / Editar Trabajador */}
            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="max-w-md rounded-[32px] p-0 overflow-hidden border-none shadow-2xl">
                    {/* Header colorido */}
                    <div className="bg-violet-600 p-4 sm:p-6 text-white">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-white/20 rounded-2xl">
                                <Users className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="font-black text-lg leading-tight">
                                    {editando ? 'Editar Trabajador' : 'Nuevo Trabajador'}
                                </h2>
                                <p className="text-violet-200 text-xs font-medium mt-0.5">
                                    {editando ? editando.nombre : 'Completa los datos del empleado'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 sm:p-6 bg-white dark:bg-slate-900 space-y-4 max-h-[65vh] overflow-y-auto">
                        {/* Foto de perfil */}
                        <input
                            ref={fotoPerfilInputRef}
                            type="file"
                            accept="image/*"
                            capture="user"
                            className="hidden"
                            onChange={handleFotoPerfil}
                        />
                        <div className="flex items-center gap-4">
                            {formData.fotoPerfil ? (
                                <div className="relative shrink-0">
                                    <img src={formData.fotoPerfil} alt="Perfil" className="w-20 h-20 rounded-2xl object-cover border-4 border-violet-100 dark:border-violet-900 shadow-lg" />
                                    <button
                                        type="button"
                                        onClick={() => setFormData(p => ({ ...p, fotoPerfil: undefined }))}
                                        className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-600 transition-colors"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => fotoPerfilInputRef.current?.click()}
                                    className="w-20 h-20 shrink-0 rounded-2xl border-2 border-dashed border-violet-200 dark:border-violet-800 flex flex-col items-center justify-center gap-1 text-violet-400 hover:text-violet-600 hover:border-violet-400 transition-colors bg-violet-50/50 dark:bg-violet-950/20"
                                >
                                    <Camera className="w-6 h-6" />
                                    <span className="text-[9px] font-black uppercase tracking-widest">Foto</span>
                                </button>
                            )}
                            <div className="flex-1">
                                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Nombre completo *</Label>
                                <Input
                                    placeholder="ej: Carlos Rodríguez"
                                    value={formData.nombre}
                                    onChange={e => setFormData(p => ({ ...p, nombre: e.target.value }))}
                                    className="mt-1.5 rounded-xl border-slate-200 dark:border-slate-700 focus-visible:ring-violet-500"
                                />
                                {formData.fotoPerfil && (
                                    <button
                                        type="button"
                                        onClick={() => fotoPerfilInputRef.current?.click()}
                                        className="mt-1.5 text-[10px] font-bold text-violet-500 hover:text-violet-700 flex items-center gap-1"
                                    >
                                        <Camera className="w-3 h-3" /> Cambiar foto
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Rol + Estado */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Rol *</Label>
                                <Select value={formData.rol} onValueChange={v => setFormData(p => ({ ...p, rol: v as TrabajadorRol }))}>
                                    <SelectTrigger className="mt-1.5 rounded-xl">
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
                                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Estado</Label>
                                <Select value={formData.estado} onValueChange={v => setFormData(p => ({ ...p, estado: v as TrabajadorEstado }))}>
                                    <SelectTrigger className="mt-1.5 rounded-xl">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="activo">Activo</SelectItem>
                                        <SelectItem value="inactivo">Inactivo</SelectItem>
                                        <SelectItem value="vacaciones">Vacaciones</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Cédula + Teléfono */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Cédula</Label>
                                <Input
                                    placeholder="ej: 12345678"
                                    value={formData.cedula}
                                    onChange={e => setFormData(p => ({ ...p, cedula: e.target.value }))}
                                    className="mt-1.5 rounded-xl border-slate-200 dark:border-slate-700 focus-visible:ring-violet-500"
                                />
                            </div>
                            <div>
                                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Teléfono</Label>
                                <Input
                                    placeholder="ej: 310 123 4567"
                                    value={formData.telefono}
                                    onChange={e => setFormData(p => ({ ...p, telefono: e.target.value }))}
                                    className="mt-1.5 rounded-xl border-slate-200 dark:border-slate-700 focus-visible:ring-violet-500"
                                />
                            </div>
                        </div>

                        {/* Salario + Fecha ingreso */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Salario base</Label>
                                <Input
                                    type="number"
                                    placeholder="ej: 1300000"
                                    value={formData.salarioBase || ''}
                                    onChange={e => setFormData(p => ({ ...p, salarioBase: parseFloat(e.target.value) || 0 }))}
                                    className="mt-1.5 rounded-xl border-slate-200 dark:border-slate-700 focus-visible:ring-violet-500"
                                />
                            </div>
                            <div>
                                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Fecha de ingreso</Label>
                                <Input
                                    type="date"
                                    value={formData.fechaIngreso}
                                    onChange={e => setFormData(p => ({ ...p, fechaIngreso: e.target.value }))}
                                    className="mt-1.5 rounded-xl border-slate-200 dark:border-slate-700 focus-visible:ring-violet-500"
                                />
                            </div>
                        </div>

                        {/* Horario */}
                        <div>
                            <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Horario</Label>
                            <Input
                                placeholder="ej: Lun-Vie 6am-2pm"
                                value={formData.horario}
                                onChange={e => setFormData(p => ({ ...p, horario: e.target.value }))}
                                className="mt-1.5 rounded-xl border-slate-200 dark:border-slate-700 focus-visible:ring-violet-500"
                            />
                        </div>

                        {/* Observaciones */}
                        <div>
                            <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Observaciones</Label>
                            <Input
                                placeholder="Notas adicionales..."
                                value={formData.observaciones}
                                onChange={e => setFormData(p => ({ ...p, observaciones: e.target.value }))}
                                className="mt-1.5 rounded-xl border-slate-200 dark:border-slate-700 focus-visible:ring-violet-500"
                            />
                        </div>
                    </div>

                    <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-end gap-3">
                        <Button variant="ghost" onClick={() => setShowModal(false)} className="rounded-xl font-bold">
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleGuardar}
                            disabled={isSaving}
                            className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-black shadow-lg shadow-violet-500/30 px-6"
                        >
                            {isSaving ? 'Guardando...' : editando ? 'Guardar cambios' : 'Registrar Trabajador'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal: Nuevo Crédito Trabajador */}
            <Dialog open={showCreditoModal} onOpenChange={v => { if (!v) resetCreditoForm(); setShowCreditoModal(v); }}>
                <DialogContent className="rounded-3xl max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase tracking-tight">Crédito de Trabajador</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
                        {/* Seleccionar trabajador */}
                        <div>
                            <Label className="text-xs font-bold uppercase tracking-widest">Trabajador *</Label>
                            <Select value={creditoForm.trabajadorId} onValueChange={v => setCreditoForm(p => ({ ...p, trabajadorId: v }))}>
                                <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="Selecciona un trabajador..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {trabajadores.filter(t => t.estado === 'activo').map(t => (
                                        <SelectItem key={t.id} value={t.id}>
                                            {t.nombre} — {ROL_LABEL[t.rol]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Descripción de lo que tomó */}
                        <div>
                            <Label className="text-xs font-bold uppercase tracking-widest">¿Qué tomó? *</Label>
                            <Input
                                placeholder="ej: 2 panes, 1 torta, productos de panadería"
                                value={creditoForm.descripcion}
                                onChange={e => setCreditoForm(p => ({ ...p, descripcion: e.target.value }))}
                                className="mt-1"
                            />
                        </div>

                        {/* Monto */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs font-bold uppercase tracking-widest">Monto *</Label>
                                <Input
                                    type="number"
                                    placeholder="ej: 15000"
                                    value={creditoForm.monto}
                                    onChange={e => setCreditoForm(p => ({ ...p, monto: e.target.value }))}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label className="text-xs font-bold uppercase tracking-widest">Fecha</Label>
                                <Input
                                    type="date"
                                    value={creditoForm.fecha}
                                    onChange={e => setCreditoForm(p => ({ ...p, fecha: e.target.value }))}
                                    className="mt-1"
                                />
                            </div>
                        </div>

                        {/* Descuento de salario */}
                        <div
                            onClick={() => setCreditoForm(p => ({ ...p, descontarDeSalario: !p.descontarDeSalario }))}
                            className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                                creditoForm.descontarDeSalario
                                    ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/20'
                                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                            }`}
                        >
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                creditoForm.descontarDeSalario ? 'border-violet-500 bg-violet-500' : 'border-slate-300'
                            }`}>
                                {creditoForm.descontarDeSalario && <CheckCircle className="w-3 h-3 text-white" />}
                            </div>
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 flex items-center gap-1">
                                    <Scissors className="w-3 h-3" /> Descontar de nómina
                                </p>
                                <p className="text-[10px] text-muted-foreground">Se rebajará del salario del trabajador</p>
                            </div>
                        </div>

                        {/* Foto obligatoria */}
                        <div>
                            <Label className="text-xs font-bold uppercase tracking-widest flex items-center gap-1">
                                <Camera className="w-3 h-3" /> Foto de evidencia <span className="text-red-500">*</span>
                            </Label>
                            <p className="text-[10px] text-muted-foreground mb-1">Toma foto de los productos que tomó el trabajador</p>
                            <input
                                ref={fotoInputRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                onChange={handleCapturarFoto}
                            />
                            {creditoFoto ? (
                                <div className="relative mt-1">
                                    <img src={creditoFoto} alt="Evidencia" className="w-full h-40 object-cover rounded-xl border-2 border-emerald-400" />
                                    <button
                                        onClick={() => setCreditoFoto(undefined)}
                                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                    <div className="absolute bottom-2 left-2 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3" /> Foto lista
                                    </div>
                                </div>
                            ) : (
                                <Button
                                    variant="outline"
                                    onClick={() => fotoInputRef.current?.click()}
                                    className="mt-1 w-full h-28 rounded-xl border-dashed border-2 border-amber-300 gap-2 flex-col text-xs font-bold uppercase tracking-widest text-amber-600 hover:bg-amber-50"
                                >
                                    <Camera className="w-6 h-6" />
                                    Tomar foto de evidencia
                                </Button>
                            )}
                        </div>

                        {/* Salario referencia */}
                        {trabajadorSeleccionado && (
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">
                                    {trabajadorSeleccionado.nombre} — Salario: {formatCurrency(trabajadorSeleccionado.salarioBase)}/mes
                                </p>
                                {creditoForm.monto && !isNaN(parseFloat(creditoForm.monto)) && (
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Este crédito equivale al {((parseFloat(creditoForm.monto) / trabajadorSeleccionado.salarioBase) * 100).toFixed(1)}% del salario
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => { resetCreditoForm(); setShowCreditoModal(false); }}>Cancelar</Button>
                        <Button
                            onClick={handleGuardarCredito}
                            disabled={isSaving || !creditoFoto}
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                        >
                            {isSaving ? 'Guardando...' : 'Registrar Crédito'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal: Registrar Pago Crédito Trabajador */}
            <Dialog open={showPagoModal} onOpenChange={setShowPagoModal}>
                <DialogContent className="rounded-3xl max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase tracking-tight">Registrar Pago</DialogTitle>
                    </DialogHeader>
                    {selectedCreditoTrabajador && (
                        <div className="space-y-4 py-2">
                            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30">
                                <p className="font-black text-sm">{selectedCreditoTrabajador.trabajadorNombre}</p>
                                <p className="text-xs text-muted-foreground">{selectedCreditoTrabajador.descripcion}</p>
                                <p className="text-sm font-black text-amber-600 mt-1">Saldo: {formatCurrency(selectedCreditoTrabajador.saldo)}</p>
                                {selectedCreditoTrabajador.descontarDeSalario && (
                                    <p className="text-[10px] font-bold text-violet-500 uppercase tracking-widest mt-1 flex items-center gap-1">
                                        <Scissors className="w-3 h-3" /> Se descuenta de nómina
                                    </p>
                                )}
                            </div>
                            <div>
                                <Label className="text-xs font-bold uppercase tracking-widest">Monto del pago *</Label>
                                <Input
                                    type="number"
                                    placeholder={`máx ${selectedCreditoTrabajador.saldo}`}
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
                                        <SelectItem value="descuento_nomina">Descuento nómina</SelectItem>
                                        <SelectItem value="transferencia">Transferencia</SelectItem>
                                        <SelectItem value="nequi">Nequi</SelectItem>
                                        <SelectItem value="daviplata">Daviplata</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-xs font-bold uppercase tracking-widest">Nota (opcional)</Label>
                                <Input
                                    placeholder="ej: Descuento quincena"
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
            {/* Modal: Crear Acceso al Sistema */}
            <Dialog open={showAccesoModal} onOpenChange={open => { setShowAccesoModal(open); if (!open) { setAccesoPassword(''); setShowAccesoPassword(false); } }}>
                <DialogContent className="max-w-sm rounded-[32px] p-0 overflow-hidden border-none shadow-2xl">
                    <div className="bg-violet-600 p-5 text-white">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-white/20 rounded-2xl">
                                <KeyRound className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="font-black text-lg leading-tight">Crear Acceso</h2>
                                <p className="text-violet-200 text-xs font-medium mt-0.5">
                                    {trabajadorParaAcceso?.nombre}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="p-5 bg-white dark:bg-slate-900 space-y-4">
                        <div>
                            <Label className="text-xs font-bold uppercase tracking-widest">Usuario</Label>
                            <Input
                                readOnly
                                value={trabajadorParaAcceso ? (trabajadorParaAcceso.email?.trim() || trabajadorParaAcceso.nombre.toLowerCase().replace(/\s+/g, '.')).toLowerCase() : ''}
                                className="mt-1 bg-slate-50 dark:bg-slate-800 text-muted-foreground"
                            />
                        </div>
                        <div>
                            <Label className="text-xs font-bold uppercase tracking-widest">Contraseña *</Label>
                            <div className="relative mt-1">
                                <Input
                                    type={showAccesoPassword ? 'text' : 'password'}
                                    placeholder="Asigna una contraseña..."
                                    value={accesoPassword}
                                    onChange={e => setAccesoPassword(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleCrearAcceso()}
                                    className="pr-10"
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowAccesoPassword(v => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showAccesoPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                        <div className="p-3 rounded-xl bg-violet-50 dark:bg-violet-950/30">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-violet-600">Rol asignado</p>
                            <p className="text-sm font-black text-violet-800 dark:text-violet-300 mt-0.5">
                                {trabajadorParaAcceso ? ROL_TO_SYSTEM_ROLE[trabajadorParaAcceso.rol] : ''}
                            </p>
                        </div>
                    </div>
                    <DialogFooter className="px-5 pb-5 gap-2">
                        <Button variant="ghost" onClick={() => setShowAccesoModal(false)}>Cancelar</Button>
                        <Button
                            onClick={handleCrearAcceso}
                            disabled={isSavingAcceso || !accesoPassword.trim()}
                            className="bg-violet-600 hover:bg-violet-700 text-white"
                        >
                            {isSavingAcceso ? 'Creando...' : 'Crear acceso'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
