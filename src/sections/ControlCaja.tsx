import React, { useState } from 'react';
import {
    Wallet,
    History,
    TrendingUp,
    TrendingDown,
    Clock,
    User,
    CheckCircle,
    XCircle,
    ChevronRight,
    Search,
    Calendar,
    DollarSign,
    ArrowRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { CajaSesion, Venta } from '@/types';

interface ControlCajaProps {
    sesiones: CajaSesion[];
    ventas: Venta[];
    cajaActiva?: CajaSesion;
    formatCurrency: (value: number) => string;
    getProductoById: (id: string) => any;
}

export default function ControlCaja({
    sesiones,
    ventas,
    cajaActiva,
    formatCurrency,
    getProductoById
}: ControlCajaProps) {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredSesiones = sesiones
        .filter(s => s.usuarioId.toLowerCase().includes(searchTerm.toLowerCase()) || s.id.includes(searchTerm))
        .sort((a, b) => new Date(b.fechaApertura).getTime() - new Date(a.fechaApertura).getTime());

    const getVentasForSesion = (sesionId: string) => {
        return ventas.filter(v => v.cajaId === sesionId);
    };

    return (
        <div className="space-y-6 animate-ag-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        Control de Caja
                    </h1>
                    <p className="text-muted-foreground">Historial de sesiones y arqueos de caja.</p>
                </div>

                {cajaActiva && (
                    <div className="flex items-center gap-3 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl animate-pulse">
                        <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        <span className="text-sm font-bold text-emerald-700">CAJA ACTUAL ABIERTA</span>
                    </div>
                )}
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-indigo-500 to-blue-600 text-white border-0 shadow-lg overflow-hidden group">
                    <CardContent className="p-6 relative">
                        <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-white/80">Total Sesiones</span>
                            <History className="w-5 h-5 text-white/80" />
                        </div>
                        <div className="text-3xl font-bold">{sesiones.length}</div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-0 shadow-lg overflow-hidden group">
                    <CardContent className="p-6 relative">
                        <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-white/80">Ventas Registradas</span>
                            <TrendingUp className="w-5 h-5 text-white/80" />
                        </div>
                        <div className="text-3xl font-bold">{ventas.length}</div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white border-0 shadow-lg overflow-hidden group">
                    <CardContent className="p-6 relative">
                        <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-white/80">Total Recaudado</span>
                            <DollarSign className="w-5 h-5 text-white/80" />
                        </div>
                        <div className="text-3xl font-bold">{formatCurrency(ventas.reduce((acc, v) => acc + v.total, 0))}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Historial de Sesiones */}
                <Card className="lg:col-span-2 border-border/50 shadow-xl overflow-hidden backdrop-blur-sm bg-card/50">
                    <CardHeader className="border-b border-border/50 pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Historial de Sesiones</CardTitle>
                                <CardDescription>Registro cronológico de aperturas y cierres.</CardDescription>
                            </div>
                            <div className="relative w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar por usuario..."
                                    className="pl-9 h-9"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-muted/50 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                        <th className="px-6 py-4">Fecha Apertura</th>
                                        <th className="px-6 py-4">Usuario</th>
                                        <th className="px-6 py-4">Fondo Inicial</th>
                                        <th className="px-6 py-4">Total Ventas</th>
                                        <th className="px-6 py-4">Estado</th>
                                        <th className="px-6 py-4">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {filteredSesiones.map((sesion) => (
                                        <tr key={sesion.id} className="hover:bg-muted/30 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="w-4 h-4 text-blue-500" />
                                                    <span className="font-medium">{new Date(sesion.fechaApertura).toLocaleDateString()}</span>
                                                    <span className="text-xs text-muted-foreground">{new Date(sesion.fechaApertura).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600 font-bold text-xs uppercase">
                                                        {sesion.usuarioId.substring(0, 2)}
                                                    </div>
                                                    <span className="text-sm">{sesion.usuarioId === 'owner-local-id' ? 'Chalo' : 'Usuario'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium">
                                                {formatCurrency(sesion.montoApertura)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <Badge variant="secondary" className="bg-blue-500/10 text-blue-700 border-blue-500/20">
                                                    {formatCurrency(sesion.totalVentas)}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4">
                                                {sesion.estado === 'abierta' ? (
                                                    <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-xs">
                                                        <CheckCircle className="w-3.5 h-3.5" /> ABIERTA
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1.5 text-slate-500 font-bold text-xs">
                                                        <Clock className="w-3.5 h-3.5" /> CERRADA
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Button variant="ghost" size="icon" className="group-hover:translate-x-1 transition-transform">
                                                    <ChevronRight className="w-4 h-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredSesiones.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground italic">
                                                No se encontraron sesiones registradas.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* Cierre Rápido / Resumen */}
                <div className="space-y-6">
                    <Card className="border-border/50 shadow-xl overflow-hidden bg-card/50">
                        <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
                            <CardTitle className="text-lg">Sesión Activa</CardTitle>
                            <CardDescription className="text-white/80">Información en tiempo real.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            {cajaActiva ? (
                                <>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Iniciada por:</span>
                                        <span className="font-bold">Chalo</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Fondo Inicial:</span>
                                        <span className="font-bold">{formatCurrency(cajaActiva.montoApertura)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Ventas Hoy:</span>
                                        <span className="font-bold text-emerald-600">{formatCurrency(cajaActiva.totalVentas)}</span>
                                    </div>
                                    <div className="pt-4 border-t border-border/50">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-base font-bold">Saldo Teórico:</span>
                                            <span className="text-xl font-bold bg-indigo-600 text-white px-3 py-1 rounded-lg">
                                                {formatCurrency(cajaActiva.montoApertura + cajaActiva.totalVentas)}
                                            </span>
                                        </div>
                                        <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white h-11 rounded-xl shadow-lg">
                                            Ir a POS para Cerrar Caja
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-6">
                                    <Wallet className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                                    <p className="text-sm text-muted-foreground">No hay ninguna caja abierta actualmente.</p>
                                    <Button className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
                                        Abrir Nueva Caja
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-border/50 shadow-xl overflow-hidden bg-card/50">
                        <CardHeader>
                            <CardTitle className="text-lg">Próximo Arqueo</CardTitle>
                            <CardDescription>Programación de revisiones.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="flex items-center gap-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                                <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-600">
                                    <Clock className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Sugerencia</p>
                                    <p className="text-sm font-medium text-amber-800">Realizar arqueo físico cada 4 horas para prevenir descuadres.</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
