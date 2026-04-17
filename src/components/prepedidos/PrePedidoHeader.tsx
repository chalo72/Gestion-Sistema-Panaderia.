import { Plus, Wand2, Fingerprint, Cpu, Activity, Zap, Layers, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface PrePedidoHeaderProps {
    onAddPrePedido: () => void;
    onGenerarSugerencias: () => void;
    onVerHistorial: () => void;
    pedidosCount: number;
}

export function PrePedidoHeader({
    onAddPrePedido,
    onGenerarSugerencias,
    onVerHistorial,
    pedidosCount
}: PrePedidoHeaderProps) {
    return (
        <div className="relative group mb-8">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-transparent to-cyan-500/5 dark:from-indigo-950/20 dark:to-cyan-900/20 pointer-events-none rounded-2xl" />
            
            <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white dark:bg-slate-900 px-8 py-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                
                {/* Telemetría (Header) */}
                <div className="flex items-center gap-6">
                    <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500/10 blur-xl rounded-full" />
                        <div className="relative w-14 h-14 rounded-xl bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center shadow-lg border border-white/10">
                            <Layers className="w-7 h-7 text-white" />
                        </div>
                    </div>
                    
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                                Órdenes de Compra
                            </h1>
                            <Badge variant="outline" className="border-cyan-500/20 text-cyan-600 dark:text-cyan-400 bg-cyan-50/50 dark:bg-cyan-950/20 px-2.5 py-0.5 rounded-lg font-bold text-[8px] uppercase tracking-widest">
                                Strategic Nexus
                            </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-slate-400">
                            <p className="text-[9px] font-bold uppercase tracking-[0.15em] flex items-center gap-2">
                                <Activity className="w-3 h-3 text-emerald-500" /> 
                                Aprovisionamiento Activo: <span className="text-slate-900 dark:text-slate-300 font-bold">{pedidosCount} Planes</span>
                                <Badge variant="secondary" className="ml-2 bg-emerald-500 text-white border-none text-[8px] animate-pulse">Tactical Engine Active</Badge>
                            </p>
                            <div className="w-px h-3 bg-slate-200 dark:bg-slate-800" />
                            <p className="text-[9px] font-bold uppercase tracking-[0.15em] flex items-center gap-2">
                                <Cpu className="w-3 h-3 text-indigo-400" /> 
                                <span className="opacity-50">Engine:</span> <span className="text-indigo-600 dark:text-indigo-400 font-bold tabular-nums">1.0.117-f</span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Acciones */}
                <div className="flex flex-wrap items-center gap-4">
                    <div className="hidden xl:flex flex-col items-end mr-2 opacity-40">
                        <span className="text-[8px] font-bold uppercase tracking-[0.15em]">Security Fingerprint</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <Fingerprint className="w-3 h-3" />
                            <span className="text-[9px] font-bold tracking-widest tabular-nums">77-FF-E3-01</span>
                        </div>
                    </div>

                    <Button
                        variant="ghost"
                        onClick={onGenerarSugerencias}
                        className="h-12 px-5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 gap-2.5 font-bold uppercase tracking-widest text-[9px] transition-all"
                    >
                        <Wand2 className="w-4 h-4 text-indigo-500" />
                        ¿Qué necesito?
                    </Button>

                    <Button
                        variant="ghost"
                        onClick={onVerHistorial}
                        className="h-12 px-5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-slate-600 dark:text-slate-400 hover:text-indigo-600 border border-slate-200 dark:border-slate-800 hover:border-indigo-200 gap-2.5 font-bold uppercase tracking-widest text-[9px] transition-all"
                    >
                        <ClipboardList className="w-4 h-4" />
                        Historial
                        {pedidosCount > 0 && (
                            <Badge className="bg-indigo-100 text-indigo-700 border-none font-black text-[8px] h-4 px-1.5">
                                {pedidosCount}
                            </Badge>
                        )}
                    </Button>

                    <Button
                        onClick={onAddPrePedido}
                        className="h-12 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-500/20 gap-2.5 font-bold uppercase tracking-[0.15em] text-[10px] transition-all active:scale-95 border-none group"
                    >
                        <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                        Nuevo Pedido
                        <Zap className="w-3 h-3 text-amber-300 ml-0.5" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
