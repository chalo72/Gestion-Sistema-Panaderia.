import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
    ROLE_DESCRIPTIONS,
    type Permission,
    type UserRole
} from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    ShieldCheck,
    RefreshCcw,
    Info,
    Lock,
    Fingerprint,
    ShieldAlert,
    ChevronRight,
    Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Agrupamos los permisos para mostrar en la tabla de forma organizada
const PERMISSION_GROUPS: { name: string; permissions: Permission[]; icon?: any }[] = [
    {
        name: 'Productos y Elaboración',
        permissions: ['VER_PRODUCTOS', 'CREAR_PRODUCTOS', 'EDITAR_PRODUCTOS', 'ELIMINAR_PRODUCTOS'],
        icon: Zap
    },
    {
        name: 'Finanzas y Costos',
        permissions: ['VER_PRECIOS', 'VER_PRECIO_VENTA', 'VER_PRECIO_COSTO', 'VER_MARGEN', 'EDITAR_PRECIOS'],
        icon: ShieldCheck
    },
    {
        name: 'Gestión de Aliados',
        permissions: ['VER_PROVEEDORES', 'CREAR_PROVEEDORES', 'EDITAR_PROVEEDORES', 'ELIMINAR_PROVEEDORES'],
        icon: Fingerprint
    },
    {
        name: 'Operaciones de Compra',
        permissions: ['VER_PREPEDIDOS', 'CREAR_PREPEDIDOS', 'EDITAR_PREPEDIDOS', 'ELIMINAR_PREPEDIDOS']
    },
    {
        name: 'Inteligencia y Alertas',
        permissions: ['VER_ALERTAS', 'GESTIONAR_ALERTAS'],
        icon: ShieldAlert
    },
    {
        name: 'Suministros y Bodega',
        permissions: ['VER_INVENTARIO', 'GESTIONAR_INVENTARIO', 'VER_RECEPCIONES', 'CREAR_RECEPCIONES']
    },
    {
        name: 'Administración Nexus',
        permissions: ['VER_CONFIGURACION', 'EDITAR_CONFIGURACION', 'VER_USUARIOS', 'CREAR_USUARIOS', 'EDITAR_USUARIOS', 'ELIMINAR_USUARIOS', 'EXPORTAR_DATOS'],
        icon: Lock
    },
    {
        name: 'Métricas y Performance',
        permissions: ['VER_DASHBOARD', 'VER_ESTADISTICAS']
    }
];

const ROLES: UserRole[] = ['ADMIN', 'GERENTE', 'COMPRADOR', 'VENDEDOR'];

export default function RoleManager() {
    const { rolePermissions, updateRolePermissions, resetPermissions } = useAuth();

    // Toggle de permiso
    const handleTogglePermission = (role: UserRole, permission: Permission) => {
        const currentPermissions = rolePermissions[role];
        const hasPermission = currentPermissions.includes(permission);

        let newPermissions;
        if (hasPermission) {
            newPermissions = currentPermissions.filter(p => p !== permission);
            toast.info(`Privilegio revocado para ${ROLE_DESCRIPTIONS[role].nombre}`);
        } else {
            newPermissions = [...currentPermissions, permission];
            toast.success(`Privilegio concedido para ${ROLE_DESCRIPTIONS[role].nombre}`);
        }

        updateRolePermissions(role, newPermissions);
    };

    const handleReset = () => {
        if (confirm('¿Restaurar los protocolos de seguridad originales?')) {
            resetPermissions();
            toast.success('Protocolos Nexus restaurados');
        }
    };

    return (
        <div className="min-h-full flex flex-col gap-5 p-4 bg-slate-50 dark:bg-slate-950 animate-ag-fade-in">
            {/* Header */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 px-5 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                        <Lock className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900 dark:text-white">Seguridad y Roles</h1>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Control de privilegios · Dulce Placer</p>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    onClick={handleReset}
                    className="h-10 px-4 rounded-xl font-black uppercase tracking-widest text-xs bg-rose-50 dark:bg-rose-950/30 text-rose-500 hover:bg-rose-500 hover:text-white border border-rose-200 dark:border-rose-800/40 gap-2"
                >
                    <RefreshCcw className="w-4 h-4" />
                    Restaurar
                </Button>
            </header>

            <Card className="rounded-[2.5rem] border-none bg-card/40 backdrop-blur-xl shadow-3xl overflow-hidden relative group">
                <CardHeader className="bg-slate-900/5 dark:bg-slate-950/20 p-8 border-b border-white/5">
                    <div className="flex items-center gap-4">
                        <div className="w-2 h-10 bg-indigo-600 rounded-full shadow-[0_0_15px_rgba(79,70,229,0.5)]" />
                        <div>
                            <CardTitle className="text-xl font-black uppercase tracking-tighter text-foreground italic flex items-center gap-2">
                                <ShieldCheck className="w-5 h-5 text-indigo-600" /> Matriz de Accesos Granulada
                            </CardTitle>
                            <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60">
                                Configuración de permisos de alta seguridad por nivel operativo
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto scrollbar-active">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-900/10 dark:bg-slate-950/40">
                                    <th className="px-10 py-6 font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground border-b border-white/5">Módulo / Acción del Sistema</th>
                                    {ROLES.map(role => (
                                        <th key={role} className="px-8 py-6 text-center border-b border-white/5">
                                            <div className="flex flex-col items-center gap-2">
                                                <Badge
                                                    className="px-4 py-1.5 rounded-full text-[9px] font-black tracking-[0.1em] uppercase shadow-lg border-none"
                                                    style={{
                                                        backgroundColor: ROLE_DESCRIPTIONS[role].color,
                                                        color: 'white',
                                                        boxShadow: `0 8px 15px -3px ${ROLE_DESCRIPTIONS[role].color}66`
                                                    }}
                                                >
                                                    {ROLE_DESCRIPTIONS[role].nombre}
                                                </Badge>
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {PERMISSION_GROUPS.map((group) => (
                                    <React.Fragment key={group.name}>
                                        {/* Group Header */}
                                        <tr className="bg-indigo-600/5">
                                            <td colSpan={ROLES.length + 1} className="px-10 py-5 font-black text-indigo-600 dark:text-indigo-400 text-xs uppercase tracking-[0.15em] flex items-center gap-3 italic">
                                                {group.icon ? <group.icon className="w-4 h-4 shadow-xl" /> : <Zap className="w-4 h-4" />}
                                                {group.name}
                                                <div className="flex-1 h-px bg-indigo-600/10 ml-4" />
                                            </td>
                                        </tr>

                                        {/* Permissions */}
                                        {group.permissions.map((permission) => (
                                            <tr key={permission} className="group/row hover:bg-white/5 transition-colors duration-200">
                                                <td className="px-12 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <ChevronRight className="w-3 h-3 text-indigo-500 opacity-0 group-hover/row:opacity-100 -translate-x-2 group-hover/row:translate-x-0 transition-all" />
                                                        <span className="font-bold text-[13px] text-foreground/80 group-hover/row:text-foreground transition-colors uppercase tracking-tight">
                                                            {permission.replace(/_/g, ' ').toLowerCase()}
                                                        </span>
                                                    </div>
                                                </td>
                                                {ROLES.map((role) => {
                                                    const isChecked = rolePermissions[role].includes(permission);
                                                    const isDisabled = role === 'ADMIN';

                                                    return (
                                                        <td key={`${role}-${permission}`} className="px-8 py-4 text-center">
                                                            <div className="flex justify-center group/check">
                                                                <Checkbox
                                                                    checked={isChecked}
                                                                    onCheckedChange={() => handleTogglePermission(role, permission)}
                                                                    disabled={isDisabled}
                                                                    className={cn(
                                                                        "w-6 h-6 rounded-lg transition-all duration-300 border-2",
                                                                        isChecked
                                                                            ? "bg-indigo-600 border-indigo-600 scale-110 shadow-[0_0_15px_rgba(79,70,229,0.4)]"
                                                                            : "border-slate-300 dark:border-slate-700 group-hover/check:border-indigo-500/50 scale-100",
                                                                        isDisabled && "opacity-40 cursor-not-allowed grayscale"
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

            {/* Info Footer */}
            <div className="bg-indigo-600/5 border border-indigo-600/10 rounded-[2.5rem] p-8 backdrop-blur-md shadow-xl flex flex-col md:flex-row items-center gap-6 group hover:bg-indigo-600/10 transition-all duration-500">
                <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-[1.5rem] flex items-center justify-center shadow-2xl group-hover:rotate-12 transition-transform duration-500">
                    <Info className="w-8 h-8 text-indigo-600" />
                </div>
                <div className="flex-1 text-center md:text-left space-y-1">
                    <p className="font-black uppercase text-xs tracking-widest text-indigo-600 flex items-center justify-center md:justify-start gap-2 italic">
                        <Fingerprint className="w-4 h-4" /> Persistencia de Identidad Nexus
                    </p>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest leading-loose opacity-70">
                        Los cambios se sincronizan en caliente con el registro local del terminal.
                        El perfil <span className="text-foreground">ADMIN</span> posee privilegios raíz inmutables.
                    </p>
                </div>
                <Button variant="ghost" className="h-10 text-[9px] font-black uppercase tracking-[0.3em] border-none opacity-40 hover:opacity-100">
                    Ver Logs de Seguridad
                </Button>
            </div>
        </div>
    );
}

