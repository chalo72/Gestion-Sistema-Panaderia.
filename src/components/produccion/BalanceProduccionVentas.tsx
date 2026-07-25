import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { safeNumber } from '@/lib/safe-utils';
import { formatCurrency } from '@/lib/utils';
import { TrendingUp, TrendingDown, Package, ShoppingCart, DollarSign, Activity } from 'lucide-react';
import type { OrdenProduccion, Venta, Producto } from '@/types';
import { isToday } from 'date-fns';

interface BalanceProduccionVentasProps {
    produccion: OrdenProduccion[];
    ventas: Venta[];
    productos: Producto[];
}

export function BalanceProduccionVentas({
    produccion,
    ventas,
    productos,
}: BalanceProduccionVentasProps) {
    // Calcular estadísticas del día
    const stats = useMemo(() => {
        // Filtrar producción completada hoy
        const produccionHoy = produccion.filter(
            (p) => p.estado === 'completado' && p.fechaFin && isToday(new Date(p.fechaFin))
        );

        // Filtrar ventas de hoy
        const ventasHoy = ventas.filter((v) => isToday(new Date(v.fecha)));

        const balancePorProducto = new Map<string, {
            nombre: string;
            producido: number;
            costoProducido: number;
            vendido: number;
            ingresoVendido: number;
        }>();

        // Acumular producción
        produccionHoy.forEach(orden => {
            const prod = productos.find(p => p.id === orden.productoId);
            if (!prod) return;

            const existing = balancePorProducto.get(prod.id) || {
                nombre: prod.nombre,
                producido: 0,
                costoProducido: 0,
                vendido: 0,
                ingresoVendido: 0
            };

            const cantidad = safeNumber(orden.cantidadRealizada || orden.cantidadPlanificada);
            const costo = safeNumber(orden.costoTotal);

            existing.producido += cantidad;
            existing.costoProducido += costo;
            balancePorProducto.set(prod.id, existing);
        });

        // Acumular ventas
        ventasHoy.forEach(venta => {
            venta.items.forEach(item => {
                const prod = productos.find(p => p.id === item.productoId);
                if (!prod) return;

                const existing = balancePorProducto.get(prod.id) || {
                    nombre: prod.nombre,
                    producido: 0,
                    costoProducido: 0,
                    vendido: 0,
                    ingresoVendido: 0
                };

                existing.vendido += safeNumber(item.cantidad);
                existing.ingresoVendido += safeNumber(item.total);
                balancePorProducto.set(prod.id, existing);
            });
        });

        let totalCostoProduccion = 0;
        let totalIngresosVentas = 0;
        let itemsProducidos = 0;
        let itemsVendidos = 0;

        const itemsBalance = Array.from(balancePorProducto.values());

        itemsBalance.forEach(item => {
            totalCostoProduccion += item.costoProducido;
            totalIngresosVentas += item.ingresoVendido;
            itemsProducidos += item.producido;
            itemsVendidos += item.vendido;
        });

        const gananciaBruta = totalIngresosVentas - totalCostoProduccion;
        const roi = totalCostoProduccion > 0 ? (gananciaBruta / totalCostoProduccion) * 100 : 0;

        return {
            totalCostoProduccion,
            totalIngresosVentas,
            gananciaBruta,
            roi,
            itemsProducidos,
            itemsVendidos,
            itemsBalance: itemsBalance.sort((a, b) => b.vendido - a.vendido)
        };
    }, [produccion, ventas, productos]);

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border shadow-sm">
                <div className="p-3 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
                    <Activity className="h-6 w-6" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">Rendimiento Comercial del Día</h2>
                    <p className="text-sm text-slate-500">Cruce de datos entre lo producido y lo vendido hoy.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-white dark:bg-slate-900 border-l-4 border-l-blue-500">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-slate-500 mb-1">Costo Producción</p>
                            <p className="text-3xl font-black text-slate-900 dark:text-white">
                                {formatCurrency(stats.totalCostoProduccion)}
                            </p>
                            <p className="text-xs font-medium text-slate-400 mt-1">{stats.itemsProducidos} un. horneadas</p>
                        </div>
                        <Package className="h-10 w-10 text-blue-500/20" />
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-900 border-l-4 border-l-emerald-500">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-slate-500 mb-1">Ingresos Ventas</p>
                            <p className="text-3xl font-black text-slate-900 dark:text-white">
                                {formatCurrency(stats.totalIngresosVentas)}
                            </p>
                            <p className="text-xs font-medium text-slate-400 mt-1">{stats.itemsVendidos} un. vendidas</p>
                        </div>
                        <ShoppingCart className="h-10 w-10 text-emerald-500/20" />
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-900 border-l-4 border-l-violet-500">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-slate-500 mb-1">Ganancia Bruta</p>
                            <p className={`text-3xl font-black ${stats.gananciaBruta >= 0 ? 'text-violet-600 dark:text-violet-400' : 'text-red-600 dark:text-red-400'}`}>
                                {formatCurrency(stats.gananciaBruta)}
                            </p>
                        </div>
                        <DollarSign className="h-10 w-10 text-violet-500/20" />
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-900 border-l-4 border-l-orange-500">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-slate-500 mb-1">Rentabilidad (ROI)</p>
                            <p className={`text-3xl font-black ${stats.roi >= 0 ? 'text-orange-600 dark:text-orange-400' : 'text-red-600 dark:text-red-400'}`}>
                                {stats.roi.toFixed(1)}%
                            </p>
                        </div>
                        {stats.roi >= 0 ? (
                            <TrendingUp className="h-10 w-10 text-orange-500/20" />
                        ) : (
                            <TrendingDown className="h-10 w-10 text-red-500/20" />
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border overflow-hidden">
                <div className="p-4 border-b bg-slate-50/50 dark:bg-slate-800/50">
                    <h3 className="text-lg font-bold">Desglose por Producto (Stock en Vitrina)</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border">
                        <thead className="bg-slate-50 dark:bg-slate-800">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Producto</th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Producido</th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Vendido</th>
                                <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Stock Restante</th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Balance ($)</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
                            {stats.itemsBalance.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium">
                                        No hay producción ni ventas registradas el día de hoy.
                                    </td>
                                </tr>
                            ) : (
                                stats.itemsBalance.map((item, idx) => {
                                    const dif = item.producido - item.vendido;
                                    const balance = item.ingresoVendido - item.costoProducido;
                                    return (
                                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-700 dark:text-slate-200">{item.nombre}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-right text-blue-600">{item.producido} u.</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-right text-emerald-600">{item.vendido} u.</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-black uppercase tracking-wider ${
                                                    dif > 0 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                                                    dif < 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                                                }`}>
                                                    {dif} u. {dif > 0 ? 'sobran' : dif < 0 ? 'faltan' : 'exacto'}
                                                </span>
                                            </td>
                                            <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-black ${balance >= 0 ? 'text-violet-600 dark:text-violet-400' : 'text-red-600 dark:text-red-400'}`}>
                                                {formatCurrency(balance)}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
