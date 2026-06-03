import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
    ROLE_DESCRIPTIONS,
    type Permission,
    type UserRole
} from '@/types';
import {
    guardarPermisos, MODULOS_CONFIGURABLES, ROLES_CONFIGURABLES,
    cargarPermisos, type PermisosModulos
} from '@/hooks/usePermisosModulos';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    ShieldCheck, RefreshCcw, Info, Lock, Fingerprint, ShieldAlert,
    ChevronRight, Zap, Share2, KeyRound, Save, Trash2, Eye, EyeOff, Unlock, Shield
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ── Grupos de permisos granulares ────────────────────────────────────────────
const PERMISSION_GROUPS: { name: string; permissions: Permission[]; icon?: any }[] = [
    { name: 'Productos y Elaboración',   permissions: ['VER_PRODUCTOS','CREAR_PRODUCTOS','EDITAR_PRODUCTOS','ELIMINAR_PRODUCTOS'],                           icon: Zap },
    { name: 'Finanzas y Costos',         permissions: ['VER_PRECIOS','VER_PRECIO_VENTA','VER_PRECIO_COSTO','VER_MARGEN','EDITAR_PRECIOS'],                   icon: ShieldCheck },
    { name: 'Gestión de Aliados',        permissions: ['VER_PROVEEDORES','CREAR_PROVEEDORES','EDITAR_PROVEEDORES','ELIMINAR_PROVEEDORES'],                   icon: Fingerprint },
    { name: 'Operaciones de Compra',     permissions: ['VER_PREPEDIDOS','CREAR_PREPEDIDOS','EDITAR_PREPEDIDOS','ELIMINAR_PREPEDIDOS'] },
    { name: 'Inteligencia y Alertas',    permissions: ['VER_ALERTAS','GESTIONAR_ALERTAS'],                                                                   icon: ShieldAlert },
    { name: 'Suministros y Bodega',      permissions: ['VER_INVENTARIO','GESTIONAR_INVENTARIO','VER_RECEPCIONES','CREAR_RECEPCIONES'] },
    { name: 'Administración Nexus',      permissions: ['VER_CONFIGURACION','EDITAR_CONFIGURACION','VER_USUARIOS','CREAR_USUARIOS','EDITAR_USUARIOS','ELIMINAR_USUARIOS','EXPORTAR_DATOS'], icon: Lock },
    { name: 'Métricas y Performance',   permissions: ['VER_DASHBOARD','VER_ESTADISTICAS'] },
];

const ROLES_GRANULARES: UserRole[] = ['ADMIN', 'GERENTE', 'COMPRADOR', 'VENDEDOR'];

const PASS_ROLES = [
    { key: 'GERENTE',   label: '👔 Gerente' },
    { key: 'PANADERO',  label: '🍞 Panadero' },
    { key: 'COMPRADOR', label: '🛒 Comprador' },
    { key: 'VENDEDOR',  label: '💰 Vendedor/a' },
    { key: 'AUXILIAR',  label: '🔧 Auxiliar' },
];

type TabId = 'acciones' | 'modulos' | 'claves';

interface RoleManagerProps {
    publicAppUrl?: string;
}

export default function RoleManager({ publicAppUrl }: RoleManagerProps) {
    const { rolePermissions, updateRolePermissions, resetPermissions } = useAuth();
    const [activeTab, setActiveTab]     = useState<TabId>('acciones');

    // ── Tab Módulos ──────────────────────────────────────────────────────────
    const [permisosModulos, setPermisosModulos] = useState<PermisosModulos>(cargarPermisos);
    const [rolActivo, setRolActivo]     = useState('VENDEDOR');

    // ── Tab Claves ───────────────────────────────────────────────────────────
    const [passwords, setPasswords]     = useState<Record<string, string>>({});
    const [showPass, setShowPass]       = useState(false);

    useEffect(() => {
        const saved = JSON.parse(localStorage.getItem('pricecontrol_role_passwords') || '{}');
        setPasswords(saved);
    }, []);

    // ── Permisos granulares ──────────────────────────────────────────────────
    const handleTogglePermission = (role: UserRole, permission: Permission) => {
        const current = rolePermissions[role];
        const next = current.includes(permission)
            ? current.filter(p => p !== permission)
            : [...current, permission];
        updateRolePermissions(role, next);
        toast.success(current.includes(permission)
            ? `Privilegio revocado — ${ROLE_DESCRIPTIONS[role].nombre}`
            : `Privilegio concedido — ${ROLE_DESCRIPTIONS[role].nombre}`);
    };

    const handleReset = () => {
        if (confirm('¿Restaurar los protocolos de seguridad originales?')) {
            resetPermissions();
            toast.success('Protocolos Nexus restaurados');
        }
    };

    // ── WhatsApp ─────────────────────────────────────────────────────────────
    const handleShareWhatsApp = (role: UserRole) => {
        const password = passwords[role];
        if (!password) {
            toast.error(`Asigna primero la contraseña de ${ROLE_DESCRIPTIONS[role].nombre} en la tab "Claves".`);
            return;
        }
        const appUrl = publicAppUrl || window.location.origin;
        const message = `🌟 *DULCE PLACER - ACCESO SISTEMA* 🌟\n\n👤 *Rol:* ${ROLE_DESCRIPTIONS[role].nombre}\n🔗 *App:* ${appUrl}\n🔑 *Clave:* ${password}\n\n⚠️ No compartir esta clave.`;
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
        toast.success(`Preparando envío para ${ROLE_DESCRIPTIONS[role].nombre}`);
    };

    // ── Guardar contraseñas ──────────────────────────────────────────────────
    const handleGuardarPasswords = () => {
        const missing = PASS_ROLES.filter(r => !passwords[r.key]?.trim());
        if (missing.length) {
            toast.error(`Faltan contraseñas: ${missing.map(r => r.label).join(', ')}`);
            return;
        }
        localStorage.setItem('pricecontrol_role_passwords', JSON.stringify(passwords));
        toast.success('Contraseñas guardadas ✅');
    };

    // ── Módulos masivos ──────────────────────────────────────────────────────
    const habilitarTodo = () => {
        const todos = Object.fromEntries(
            MODULOS_CONFIGURABLES.map(m => [m.id, { ver: true, eliminar: permisosModulos[rolActivo]?.[m.id]?.eliminar ?? false }])
        );
        setPermisosModulos(p => ({ ...p, [rolActivo]: todos }));
    };
    const deshabilitarTodo = () => {
        const ninguno = Object.fromEntries(MODULOS_CONFIGURABLES.map(m => [m.id, { ver: false, eliminar: false }]));
        setPermisosModulos(p => ({ ...p, [rolActivo]: ninguno }));
    };

    const TABS: { id: TabId; label: string; icon: any }[] = [
        { id: 'acciones', label: 'Permisos de Acciones', icon: ShieldCheck },
        { id: 'modulos',  label: 'Visibilidad de Módulos', icon: Shield },
        { id: 'claves',   label: 'Claves y Accesos',     icon: KeyRound },
    ];

    return (
        <div className="min-h-full flex flex-col gap-6 p-4 bg-slate-50 dark:bg-slate-950 animate-ag-fade-in pb-20">

            {/* ── Header ─────────────────────────────────────────────────── */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 px-6 py-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-200 dark:shadow-none">
                        <Lock className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Seguridad y Roles</h1>
                        <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.3em] mt-0.5 opacity-80">Control de Acceso · Dulce Placer</p>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    onClick={handleReset}
                    className="h-11 px-5 rounded-2xl font-black uppercase tracking-widest text-[10px] bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all gap-2"
                >
                    <RefreshCcw className="w-3.5 h-3.5" /> Resetear protocolos
                </Button>
            </header>

            {/* ── Tabs ───────────────────────────────────────────────────── */}
            <div className="flex gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                {TABS.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id)}
                        className={cn(
                            'flex-1 flex items-center justify-center gap-2 h-10 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all',
                            activeTab === t.id
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                        )}
                    >
                        <t.icon className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{t.label}</span>
                    </button>
                ))}
            </div>

            {/* ══════════════════════════════════════════════════════════════
                TAB 1 — PERMISOS DE ACCIONES (Matriz Granulada)
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'acciones' && (
                <Card className="rounded-[2.5rem] border-none bg-card/40 backdrop-blur-xl shadow-3xl overflow-hidden">
                    <CardHeader className="bg-slate-900/5 dark:bg-slate-950/20 p-8 border-b border-white/5">
                        <div className="flex items-center gap-4">
                            <div className="w-2 h-10 bg-indigo-600 rounded-full shadow-[0_0_15px_rgba(79,70,229,0.5)]" />
                            <div>
                                <CardTitle className="text-xl font-black uppercase tracking-tighter text-foreground italic flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5 text-indigo-600" /> Matriz de Accesos Granulada
                                </CardTitle>
                                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60">
                                    Permisos por acción del sistema (crear, editar, eliminar)
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-900/10 dark:bg-slate-950/40">
                                        <th className="px-10 py-6 font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground border-b border-white/5">Módulo / Acción</th>
                                        {ROLES_GRANULARES.map(role => (
                                            <th key={role} className="px-8 py-6 text-center border-b border-white/5">
                                                <div className="flex flex-col items-center gap-2">
                                                    <Badge
                                                        className="px-4 py-1.5 rounded-full text-[9px] font-black tracking-[0.1em] uppercase shadow-lg border-none"
                                                        style={{ backgroundColor: ROLE_DESCRIPTIONS[role].color, color: 'white', boxShadow: `0 8px 15px -3px ${ROLE_DESCRIPTIONS[role].color}66` }}
                                                    >
                                                        {ROLE_DESCRIPTIONS[role].nombre}
                                                    </Badge>
                                                    {role !== 'ADMIN' && (
                                                        <Button
                                                            variant="ghost" size="icon"
                                                            onClick={() => handleShareWhatsApp(role)}
                                                            className="h-8 w-8 rounded-full text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                                            title="Enviar acceso por WhatsApp"
                                                        >
                                                            <Share2 className="w-3.5 h-3.5" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {PERMISSION_GROUPS.map((group) => (
                                        <React.Fragment key={group.name}>
                                            <tr className="bg-indigo-600/5">
                                                <td colSpan={ROLES_GRANULARES.length + 1} className="px-10 py-5 font-black text-indigo-600 dark:text-indigo-400 text-xs uppercase tracking-[0.15em] italic">
                                                    <span className="flex items-center gap-3">
                                                        {group.icon ? <group.icon className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                                                        {group.name}
                                                        <div className="flex-1 h-px bg-indigo-600/10 ml-4" />
                                                    </span>
                                                </td>
                                            </tr>
                                            {group.permissions.map((permission) => (
                                                <tr key={permission} className="group/row hover:bg-white/5 transition-colors">
                                                    <td className="px-12 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <ChevronRight className="w-3 h-3 text-indigo-500 opacity-0 group-hover/row:opacity-100 -translate-x-2 group-hover/row:translate-x-0 transition-all" />
                                                            <span className="font-bold text-[13px] text-foreground/80 uppercase tracking-tight">
                                                                {permission.replace(/_/g, ' ').toLowerCase()}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    {ROLES_GRANULARES.map((role) => {
                                                        const isChecked  = rolePermissions[role].includes(permission);
                                                        const isDisabled = role === 'ADMIN';
                                                        return (
                                                            <td key={`${role}-${permission}`} className="px-8 py-4 text-center">
                                                                <div className="flex justify-center">
                                                                    <Checkbox
                                                                        checked={isChecked}
                                                                        onCheckedChange={() => handleTogglePermission(role, permission)}
                                                                        disabled={isDisabled}
                                                                        className={cn(
                                                                            'w-6 h-6 rounded-lg transition-all duration-300 border-2',
                                                                            isChecked
                                                                                ? 'bg-indigo-600 border-indigo-600 scale-110 shadow-[0_0_15px_rgba(79,70,229,0.4)]'
                                                                                : 'border-slate-300 dark:border-slate-700',
                                                                            isDisabled && 'opacity-40 cursor-not-allowed grayscale'
                                                                        )}
                                                                    />
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ══════════════════════════════════════════════════════════════
                TAB 2 — VISIBILIDAD DE MÓDULOS
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'modulos' && (
                <Card className="border-none shadow-xl bg-gradient-to-br from-slate-900/5 to-card dark:from-slate-900/40 dark:to-card backdrop-blur-sm overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="w-5 h-5 text-indigo-500" />
                            Visibilidad de Módulos por Rol
                        </CardTitle>
                        <CardDescription>
                            Controla qué módulos puede ver y eliminar cada rol. ADMIN siempre tiene acceso completo.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        {/* Selector de rol */}
                        <div className="flex flex-wrap gap-2">
                            {ROLES_CONFIGURABLES.map(r => (
                                <button
                                    key={r.id}
                                    onClick={() => setRolActivo(r.id)}
                                    className={cn(
                                        'h-9 px-4 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all',
                                        rolActivo === r.id
                                            ? `${r.color} text-white shadow-lg scale-105`
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:opacity-80'
                                    )}
                                >
                                    {r.label}
                                </button>
                            ))}
                        </div>

                        {/* Acciones masivas */}
                        <div className="flex gap-2">
                            <button
                                onClick={habilitarTodo}
                                className="h-7 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-200 transition-colors"
                            >
                                Habilitar todo
                            </button>
                            <button
                                onClick={deshabilitarTodo}
                                className="h-7 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 hover:bg-rose-200 transition-colors"
                            >
                                Deshabilitar todo
                            </button>
                        </div>

                        {/* Módulos agrupados por sección */}
                        {[...new Set(MODULOS_CONFIGURABLES.map(m => m.seccion))].map(sec => {
                            const modulos = MODULOS_CONFIGURABLES.filter(m => m.seccion === sec);
                            return (
                                <div key={sec} className="space-y-1.5">
                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">{sec}</p>
                                    <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                                        {modulos.map(m => {
                                            const ver      = permisosModulos[rolActivo]?.[m.id]?.ver ?? true;
                                            const eliminar = permisosModulos[rolActivo]?.[m.id]?.eliminar ?? false;
                                            const toggle = (campo: 'ver' | 'eliminar') => {
                                                setPermisosModulos(prev => ({
                                                    ...prev,
                                                    [rolActivo]: {
                                                        ...prev[rolActivo],
                                                        [m.id]: {
                                                            ver:      campo === 'ver'      ? !ver      : ver,
                                                            eliminar: campo === 'eliminar' ? !eliminar : (campo === 'ver' && ver ? false : eliminar),
                                                        },
                                                    },
                                                }));
                                            };
                                            return (
                                                <div key={m.id} className={cn('flex items-center gap-3 px-4 py-2.5 transition-colors', ver ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-900/50 opacity-60')}>
                                                    <span className="flex-1 text-[12px] font-semibold text-slate-700 dark:text-slate-300 truncate">{m.label}</span>
                                                    <button
                                                        onClick={() => toggle('ver')}
                                                        className={cn('flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[10px] font-black transition-all', ver ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400')}
                                                    >
                                                        {ver ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                                                        Ver
                                                    </button>
                                                    <button
                                                        onClick={() => ver && toggle('eliminar')}
                                                        disabled={!ver}
                                                        title={!ver ? 'Habilita Ver primero' : ''}
                                                        className={cn('flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[10px] font-black transition-all', !ver ? 'opacity-30 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400' : eliminar ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-rose-50')}
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                        Eliminar
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}

                        <button
                            onClick={() => { guardarPermisos(permisosModulos); toast.success('Permisos de módulos guardados'); }}
                            className="w-full h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-500/20"
                        >
                            <Shield className="w-4 h-4" /> Guardar permisos
                        </button>
                    </CardContent>
                </Card>
            )}

            {/* ══════════════════════════════════════════════════════════════
                TAB 3 — CLAVES Y ACCESOS
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'claves' && (
                <div className="space-y-6">
                    {/* Editor de contraseñas */}
                    <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <KeyRound className="w-5 h-5 text-pink-500" />
                                Contraseñas por Rol
                            </CardTitle>
                            <CardDescription>Define la contraseña que usará cada tipo de usuario para entrar al sistema</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-muted-foreground">Mostrar contraseñas</span>
                                <button type="button" onClick={() => setShowPass(p => !p)} className="text-slate-400 hover:text-slate-600">
                                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            {PASS_ROLES.map(({ key, label }) => (
                                <div key={key} className="space-y-1">
                                    <Label className="text-xs font-bold uppercase tracking-widest opacity-70">{label}</Label>
                                    <Input
                                        type={showPass ? 'text' : 'password'}
                                        value={passwords[key] || ''}
                                        onChange={e => setPasswords(p => ({ ...p, [key]: e.target.value }))}
                                        placeholder="Contraseña para este rol"
                                        className="h-10 rounded-xl border border-slate-200 dark:border-slate-700"
                                    />
                                </div>
                            ))}
                            <Button onClick={handleGuardarPasswords} className="w-full h-10 bg-pink-600 hover:bg-pink-500 text-white rounded-xl font-bold mt-2">
                                <Save className="w-4 h-4 mr-2" />
                                Guardar Contraseñas
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Envío de accesos por WhatsApp */}
                    <section>
                        <div className="flex items-center gap-3 mb-4 ml-1">
                            <div className="w-8 h-1 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                                <Share2 className="w-4 h-4" /> Enviar Accesos por WhatsApp
                            </h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {(['GERENTE','COMPRADOR','VENDEDOR','PANADERO'] as UserRole[]).map(role => (
                                <Card
                                    key={`share-${role}`}
                                    className="rounded-3xl border-none bg-white dark:bg-slate-900 shadow-xl overflow-hidden group hover:scale-[1.03] transition-all cursor-pointer"
                                    onClick={() => handleShareWhatsApp(role)}
                                >
                                    <CardContent className="p-6">
                                        <div className="flex flex-col items-center text-center gap-4">
                                            <div
                                                className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl group-hover:rotate-12 transition-transform duration-500"
                                                style={{ backgroundColor: `${ROLE_DESCRIPTIONS[role]?.color ?? '#6366f1'}20` }}
                                            >
                                                <Fingerprint className="w-8 h-8" style={{ color: ROLE_DESCRIPTIONS[role]?.color ?? '#6366f1' }} />
                                            </div>
                                            <div>
                                                <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight italic">
                                                    {ROLE_DESCRIPTIONS[role]?.nombre ?? role}
                                                </h3>
                                                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest leading-tight">
                                                    {passwords[role] ? 'Clave configurada ✓' : 'Sin clave asignada'}
                                                </p>
                                            </div>
                                            <div className="w-full pt-4 mt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-2 text-emerald-500 font-bold text-xs uppercase tracking-tighter">
                                                <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center">
                                                    <Share2 className="w-3.5 h-3.5" />
                                                </div>
                                                Enviar por WhatsApp
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </section>
                </div>
            )}

            {/* ── Footer informativo ──────────────────────────────────────── */}
            <div className="bg-indigo-600/5 border border-indigo-600/10 rounded-[2.5rem] p-8 backdrop-blur-md shadow-xl flex flex-col md:flex-row items-center gap-6">
                <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-[1.5rem] flex items-center justify-center shadow-2xl">
                    <Info className="w-8 h-8 text-indigo-600" />
                </div>
                <div className="flex-1 text-center md:text-left space-y-1">
                    <p className="font-black uppercase text-xs tracking-widest text-indigo-600 flex items-center justify-center md:justify-start gap-2 italic">
                        <Fingerprint className="w-4 h-4" /> Persistencia de Identidad Nexus
                    </p>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest leading-loose opacity-70">
                        Los cambios se sincronizan en caliente. El perfil <span className="text-foreground">ADMIN</span> posee privilegios raíz inmutables.
                    </p>
                </div>
            </div>
        </div>
    );
}
