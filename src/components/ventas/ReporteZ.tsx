
import type { CajaSesion, Venta } from '@/types';
import { cn } from '@/lib/utils';
import { Calendar, Clock, Banknote, AlertCircle } from 'lucide-react';

interface ReporteZProps {
    cajas: CajaSesion[];
    ventas: Venta[];
    formatCurrency: (v: number) => string;
    isPrinting?: boolean;
}

export function ReporteZ({ cajas, ventas, formatCurrency, isPrinting = false }: ReporteZProps) {
    const ahora = new Date();
    const totalVentas = cajas.reduce((a, c) => a + c.totalVentas, 0);
    const totalApertura = cajas.reduce((a, c) => a + c.montoApertura, 0);
    
    const entradas = cajas.reduce((a, c) => 
        a + (c.movimientos || []).filter((m: any) => m.tipo === 'entrada').reduce((sum: number, m: any) => sum + m.monto, 0), 0
    );
    const salidas = cajas.reduce((a, c) => 
        a + (c.movimientos || []).filter((m: any) => m.tipo === 'salida').reduce((sum: number, m: any) => sum + m.monto, 0), 0
    );
    
    const esperadoTotal = totalApertura + totalVentas + entradas - salidas;
    const entregadoTotal = cajas.reduce((a, c) => a + (c.montoCierre || 0), 0);
    const diferenciaNeta = entregadoTotal - esperadoTotal;

    const ventasPorMetodo = {
        efectivo: ventas.filter(v => v.metodoPago === 'efectivo').reduce((a, v) => a + v.total, 0),
        tarjeta: ventas.filter(v => v.metodoPago === 'tarjeta').reduce((a, v) => a + v.total, 0),
        nequi: ventas.filter(v => v.metodoPago === 'nequi' || v.metodoPago === 'transferencia').reduce((a, v) => a + v.total, 0),
        credito: ventas.filter(v => v.metodoPago === 'credito').reduce((a, v) => a + v.total, 0),
    };

    return (
        <div className={cn(
            "bg-white text-slate-900 p-8 max-w-[800px] mx-auto border border-slate-200 shadow-sm font-sans",
            isPrinting ? "fixed inset-0 z-[9999] overflow-auto block print:static print:shadow-none print:border-none" : "rounded-3xl"
        )} id="reporte-z-printable">
            
            {/* ── ENCABEZADO CIERRE ── */}
            <div className="text-center border-b-2 border-slate-900 pb-6 mb-8">
                <h1 className="text-3xl font-black uppercase tracking-tighter mb-1">DULCE PLACER</h1>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.3em]">Panadería & Pastelería Artesanal</p>
                <div className="mt-4 flex items-center justify-center gap-6">
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-400">
                        <Calendar className="w-3 h-3" /> {ahora.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-400">
                        <Clock className="w-3 h-3" /> {ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
                <div className="mt-4 inline-block bg-slate-900 text-white px-5 py-2 rounded-full text-base font-black uppercase tracking-widest">
                    REPORTE Z — CIERRE DE JORNADA
                </div>
            </div>

            {/* ── RESUMEN FINANCIERO CONSOLIDADO ── */}
            <div className="grid grid-cols-2 gap-8 mb-8">
                <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2">Balance General</h3>
                    <div className="space-y-2">
                        <div className="flex justify-between items-end">
                            <span className="text-xs font-bold text-slate-500 uppercase">Monto Apertura Total</span>
                            <span className="text-sm font-black tabular-nums">{formatCurrency(totalApertura)}</span>
                        </div>
                        <div className="flex justify-between items-end">
                            <span className="text-xs font-bold text-slate-500 uppercase">Ventas Brutas Today</span>
                            <span className="text-sm font-black tabular-nums text-emerald-600">{formatCurrency(totalVentas)}</span>
                        </div>
                        <div className="flex justify-between items-end">
                            <span className="text-xs font-bold text-slate-500 uppercase">Entradas de Caja</span>
                            <span className="text-sm font-black tabular-nums text-blue-600">+{formatCurrency(entradas)}</span>
                        </div>
                        <div className="flex justify-between items-end">
                            <span className="text-xs font-bold text-slate-500 uppercase">Salidas de Caja</span>
                            <span className="text-sm font-black tabular-nums text-rose-600">-{formatCurrency(salidas)}</span>
                        </div>
                        <div className="pt-3 mt-1 border-t-2 border-slate-900 flex justify-between items-center">
                            <span className="text-sm font-black uppercase">Sistema Espera Total</span>
                            <span className="text-xl font-black tabular-nums">{formatCurrency(esperadoTotal)}</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2">Métodos de Pago</h3>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase">
                                <Banknote className="w-3 h-3" /> Efectivo
                            </span>
                            <span className="text-sm font-black tabular-nums">{formatCurrency(ventasPorMetodo.efectivo)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-600 uppercase">💳 Tarjeta / Datáfono</span>
                            <span className="text-sm font-black tabular-nums">{formatCurrency(ventasPorMetodo.tarjeta)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-600 uppercase">📱 Nequi / Transf.</span>
                            <span className="text-sm font-black tabular-nums">{formatCurrency(ventasPorMetodo.nequi)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-600 uppercase">🎫 Crédito Clientes</span>
                            <span className="text-sm font-black tabular-nums">{formatCurrency(ventasPorMetodo.credito)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── ANÁLISIS DE AUDITORÍA (DIFERENCIAS) ── */}
            <div className={cn(
                "p-6 rounded-2xl border-4 mb-8",
                diferenciaNeta === 0 ? "bg-emerald-50 border-emerald-500" : 
                Math.abs(diferenciaNeta) < 5000 ? "bg-amber-50 border-amber-500" : "bg-red-50 border-red-500"
            )}>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Resultado de Auditoría</p>
                        <h2 className="text-2xl font-black uppercase">
                            {diferenciaNeta === 0 ? "✓ CUADRE PERFECTO" : 
                             diferenciaNeta < 0 ? "⚠ FALTANTE DE CAJA" : "⚠ SOBRANTE DE CAJA"}
                        </h2>
                    </div>
                    {Math.abs(diferenciaNeta) > 1000 && <AlertCircle className="w-10 h-10 text-red-500 opacity-50" />}
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-white/50 rounded-xl">
                        <p className="text-[9px] font-black uppercase text-slate-400">Esperado</p>
                        <p className="text-base font-black tabular-nums">{formatCurrency(esperadoTotal)}</p>
                    </div>
                    <div className="text-center p-3 bg-white/50 rounded-xl border-l border-r border-slate-200">
                        <p className="text-[9px] font-black uppercase text-slate-400">Entregado</p>
                        <p className="text-base font-black tabular-nums">{formatCurrency(entregadoTotal)}</p>
                    </div>
                    <div className="text-center p-3 bg-white/50 rounded-xl">
                        <p className="text-[9px] font-black uppercase text-slate-400">Diferencia</p>
                        <p className={cn("text-base font-black tabular-nums", 
                            diferenciaNeta === 0 ? "text-emerald-600" : "text-rose-600"
                        )}>
                            {diferenciaNeta > 0 ? '+' : ''}{formatCurrency(diferenciaNeta)}
                        </p>
                    </div>
                </div>
            </div>

            {/* ── DETALLE POR CAJA ── */}
            <div className="mb-8">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 border-b pb-2">Desglose Detallado de Cajas</h3>
                <div className="space-y-4">
                    {cajas.map((caja, idx) => {
                        const ent = (caja.movimientos || []).filter((m: any) => m.tipo === 'entrada').reduce((a: number, m: any) => a + m.monto, 0);
                        const sal = (caja.movimientos || []).filter((m: any) => m.tipo === 'salida').reduce((a: number, m: any) => a + m.monto, 0);
                        const esp = caja.montoApertura + caja.totalVentas + ent - sal;
                        const entregado = caja.montoCierre || 0;
                        const diff = entregado - esp;

                        return (
                            <div key={idx} className="grid grid-cols-4 gap-4 items-center bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <div className="col-span-1">
                                    <p className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">Caja / Vendedora</p>
                                    <p className="text-xs font-black uppercase">{caja.cajaNombre || `Caja ${idx+1}`}</p>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase">{caja.vendedoraNombre || '—'}</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">Ventas</p>
                                    <p className="text-xs font-black tabular-nums">{formatCurrency(caja.totalVentas)}</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">Esperado/Entregado</p>
                                    <p className="text-xs font-black tabular-nums">{formatCurrency(esp)} / {formatCurrency(entregado)}</p>
                                </div>
                                <div className="text-right">
                                    <p className={cn("text-xs font-black tabular-nums", diff === 0 ? "text-emerald-600" : "text-rose-600")}>
                                        {diff === 0 ? 'OK' : `${diff > 0 ? '+' : ''}${formatCurrency(diff)}`}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── FIRMAS ── */}
            <div className="grid grid-cols-2 gap-12 mt-16 pt-12 border-t border-dashed border-slate-300">
                <div className="text-center">
                    <div className="w-full border-t border-slate-900 mb-2" />
                    <p className="text-[10px] font-black uppercase">Responsable de Turno</p>
                    <p className="text-[9px] text-slate-400 font-bold">FECHA: ____/____/____</p>
                </div>
                <div className="text-center">
                    <div className="w-full border-t border-slate-900 mb-2" />
                    <p className="text-[10px] font-black uppercase">Administrador / Auditoría</p>
                    <p className="text-[9px] text-slate-400 font-bold">RECIBIDO CONFORME</p>
                </div>
            </div>

            {/* ── FOOTER ── */}
            <div className="mt-12 text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                Nexus Shield Audit Protocol • Dulce Placer ERP
            </div>
            
            <style>{`
                @media screen {
                    .hidden-screen { display: none !important; }
                }
                @media print {
                    @page { margin: 2cm; size: auto; }
                    body * { visibility: hidden; }
                    #reporte-z-printable, #reporte-z-printable * { visibility: visible; }
                    #reporte-z-printable { 
                        position: absolute; 
                        left: 0; 
                        top: 0; 
                        width: 100%; 
                        height: auto;
                        margin: 0;
                        padding: 0;
                        border: none;
                        box-shadow: none;
                        visibility: visible !important;
                        display: block !important;
                    }
                }
            `}</style>
        </div>
    );
}
