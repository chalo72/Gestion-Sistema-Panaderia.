import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
    ROLE_DESCRIPTIONS,
    type Permission,
    type UserRole
} from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
// import { toast } from 'sonner'; // Asumimos que existe, si no, usar console o alert por ahora
// Si no existe toast, podemos usar un estado simple de feedback o alert

// Agrupamos los permisos para mostrar en la tabla de forma organizada
const PERMISSION_GROUPS: { name: string; permissions: Permission[] }[] = [
    {
        name: 'Productos',
        permissions: ['VER_PRODUCTOS', 'CREAR_PRODUCTOS', 'EDITAR_PRODUCTOS', 'ELIMINAR_PRODUCTOS']
    },
    {
        name: 'Precios y Costos',
        permissions: ['VER_PRECIOS', 'VER_PRECIO_VENTA', 'VER_PRECIO_COSTO', 'VER_MARGEN', 'EDITAR_PRECIOS']
    },
    {
        name: 'Proveedores',
        permissions: ['VER_PROVEEDORES', 'CREAR_PROVEEDORES', 'EDITAR_PROVEEDORES', 'ELIMINAR_PROVEEDORES']
    },
    {
        name: 'Pre-pedidos',
        permissions: ['VER_PREPEDIDOS', 'CREAR_PREPEDIDOS', 'EDITAR_PREPEDIDOS', 'ELIMINAR_PREPEDIDOS']
    },
    {
        name: 'Alertas',
        permissions: ['VER_ALERTAS', 'GESTIONAR_ALERTAS']
    },
    {
        name: 'Inventario y Recepciones',
        permissions: ['VER_INVENTARIO', 'GESTIONAR_INVENTARIO', 'VER_RECEPCIONES', 'CREAR_RECEPCIONES']
    },
    {
        name: 'Administración',
        permissions: ['VER_CONFIGURACION', 'EDITAR_CONFIGURACION', 'VER_USUARIOS', 'CREAR_USUARIOS', 'EDITAR_USUARIOS', 'ELIMINAR_USUARIOS', 'EXPORTAR_DATOS']
    },
    {
        name: 'Dashboard',
        permissions: ['VER_DASHBOARD', 'VER_ESTADISTICAS']
    }
];

const ROLES: UserRole[] = ['ADMIN', 'GERENTE', 'COMPRADOR', 'VENDEDOR'];

export default function RoleManager() {
    const { rolePermissions, updateRolePermissions, resetPermissions } = useAuth();
    const [hasChanges, setHasChanges] = useState(false);

    // Toggle de permiso
    const handleTogglePermission = (role: UserRole, permission: Permission) => {
        const currentPermissions = rolePermissions[role];
        const hasPermission = currentPermissions.includes(permission);

        let newPermissions;
        if (hasPermission) {
            newPermissions = currentPermissions.filter(p => p !== permission);
        } else {
            newPermissions = [...currentPermissions, permission];
        }

        updateRolePermissions(role, newPermissions);
        setHasChanges(true); // Marca que hubo cambios (aunque ya se guardan en context/storage al instante, esto es visual)
    };

    const handleReset = () => {
        if (confirm('¿Estás seguro de restaurar los permisos por defecto? Se perderán todas las configuraciones personalizadas.')) {
            resetPermissions();
            setHasChanges(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-violet-600 bg-clip-text text-transparent">
                        Gestión de Roles y Permisos
                    </h2>
                    <p className="text-muted-foreground mt-1 text-lg">
                        Control total sobre quién puede ver y hacer qué en el sistema.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="ghost"
                        onClick={handleReset}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 border border-red-200 hover:border-red-300 transition-all duration-300"
                    >
                        Restaurar por Defecto
                    </Button>
                </div>
            </div>

            <Card className="border-primary/10 shadow-xl shadow-primary/5 backdrop-blur-sm bg-card/50">
                <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2">
                        <span className="w-1 h-6 bg-primary rounded-full inline-block"></span>
                        Matriz de Permisos
                    </CardTitle>
                    <CardDescription>
                        Define el acceso granular para cada perfil de usuario.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-xl border border-border/50 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs uppercase bg-muted/50 border-b border-border/50">
                                    <tr>
                                        <th className="px-6 py-4 font-bold text-foreground min-w-[200px]">Permiso / Acción</th>
                                        {ROLES.map(role => (
                                            <th key={role} className="px-6 py-3 text-center min-w-[100px]">
                                                <div className="flex flex-col items-center gap-2">
                                                    <span
                                                        className="px-3 py-1 rounded-full text-[10px] font-bold tracking-wide shadow-sm"
                                                        style={{
                                                            backgroundColor: `${ROLE_DESCRIPTIONS[role].color}20`, // 20% opacity
                                                            color: ROLE_DESCRIPTIONS[role].color,
                                                            border: `1px solid ${ROLE_DESCRIPTIONS[role].color}40`
                                                        }}
                                                    >
                                                        {ROLE_DESCRIPTIONS[role].nombre}
                                                    </span>
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/30 bg-card/30">
                                    {PERMISSION_GROUPS.map((group) => (
                                        <React.Fragment key={group.name}>
                                            {/* Encabezado de Grupo */}
                                            <tr className="bg-muted/20">
                                                <td colSpan={ROLES.length + 1} className="px-6 py-3 font-semibold text-primary text-xs uppercase tracking-wider flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-primary/40"></div>
                                                    {group.name}
                                                </td>
                                            </tr>

                                            {/* Filas de Permisos */}
                                            {group.permissions.map((permission) => (
                                                <tr key={permission} className="hover:bg-muted/30 transition-colors duration-200">
                                                    <td className="px-6 py-3 font-medium text-foreground/80">
                                                        {permission.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())}
                                                    </td>
                                                    {ROLES.map((role) => {
                                                        const isChecked = rolePermissions[role].includes(permission);
                                                        const isDisabled = role === 'ADMIN';

                                                        return (
                                                            <td key={`${role}-${permission}`} className="px-6 py-3 text-center">
                                                                <div className="flex justify-center group">
                                                                    <Checkbox
                                                                        checked={isChecked}
                                                                        onCheckedChange={() => handleTogglePermission(role, permission)}
                                                                        disabled={isDisabled}
                                                                        className={`
                                                                            data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-all duration-300
                                                                            ${isChecked ? 'scale-110 shadow-md shadow-primary/20' : 'group-hover:scale-110 group-hover:border-primary/50'}
                                                                        `}
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
                    </div>
                </CardContent>
            </Card>

            <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200/50 dark:border-blue-800/30 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-300 flex items-start gap-3 shadow-sm">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
                </div>
                <div>
                    <p className="font-semibold mb-1 text-base">Persistencia Local</p>
                    <p className="opacity-90">Los cambios se guardan automáticamente en este navegador. El rol <span className="font-bold">ADMIN</span> tiene permisos inmutables para garantizar el acceso al sistema.</p>
                </div>
            </div>
        </div>
    );
}
