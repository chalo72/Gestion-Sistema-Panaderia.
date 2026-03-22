import { Search, Tag, Trash2, Calendar, FileText, Clock, Folder, Briefcase, Users, Settings, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Gasto } from '@/types';

interface ExpenseListProps {
    gastos: Gasto[];
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    selectedCategory: string | null;
    setSelectedCategory: (cat: string | null) => void;
    onDeleteGasto: (id: string) => void;
    formatCurrency: (val: number) => string;
}

const CATEGORIAS_GASTOS = [
    { value: 'Servicios', label: 'Servicios', icon: Clock, color: 'blue' },
    { value: 'Materia Prima', label: 'Insumos', icon: Briefcase, color: 'indigo' },
    { value: 'Arriendo', label: 'Local', icon: Folder, color: 'amber' },
    { value: 'Nómina', label: 'Nómina', icon: Users, color: 'emerald' },
    { value: 'Mantenimiento', label: 'Mantenimiento', icon: Settings, color: 'rose' },
    { value: 'Otros', label: 'Otros', icon: Plus, color: 'slate' },
];

export function ExpenseList({
    gastos,
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
    onDeleteGasto,
    formatCurrency
}: ExpenseListProps) {
    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center mb-8">
                <div className="relative group flex-1 w-full">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500 opacity-50 group-focus-within:opacity-100 transition-opacity" />
                    <Input
                        placeholder="Buscar egresos por descripción..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-14 h-14 bg-white/60 dark:bg-gray-900/60 border-none rounded-2xl shadow-xl text-xs font-black uppercase tracking-widest focus:ring-2 focus:ring-rose-500 transition-all"
                    />
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 w-full md:w-auto scrollbar-hide">
                    <Button
                        variant={selectedCategory === null ? 'default' : 'outline'}
                        onClick={() => setSelectedCategory(null)}
                        className={cn(
                            "h-14 px-6 rounded-2xl font-black uppercase tracking-widest text-[9px] border-none shadow-lg transition-all shrink-0",
                            selectedCategory === null ? "bg-rose-600 text-white" : "bg-white/60 dark:bg-gray-900/60 text-slate-500 hover:bg-white dark:hover:bg-gray-800"
                        )}
                    >
                        Todos
                    </Button>
                    {CATEGORIAS_GASTOS.map(cat => (
                        <Button
                            key={cat.value}
                            variant={selectedCategory === cat.value ? 'default' : 'outline'}
                            onClick={() => setSelectedCategory(cat.value)}
                            className={cn(
                                "h-14 px-6 rounded-2xl font-black uppercase tracking-widest text-[9px] border-none shadow-lg transition-all shrink-0 flex items-center gap-2",
                                selectedCategory === cat.value
                                    ? "bg-rose-600 text-white"
                                    : "bg-white/60 dark:bg-gray-900/60 text-slate-500 hover:bg-white dark:hover:bg-gray-800"
                            )}
                        >
                            <cat.icon className="w-4 h-4" />
                            {cat.label}
                        </Button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {gastos.map((gasto) => {
                    const catInfo = CATEGORIAS_GASTOS.find(c => c.value === gasto.categoria) || CATEGORIAS_GASTOS[5];
                    const Icon = catInfo.icon;

                    return (
                        <Card key={gasto.id} className="group overflow-hidden border-none bg-white/40 dark:bg-black/20 backdrop-blur-xl rounded-[2.5rem] shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 border-l-8 border-l-rose-500/20 hover:border-l-rose-500">
                            <CardContent className="p-5 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
                                <div className="flex items-center gap-6 flex-1">
                                    <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:rotate-12", `bg-${catInfo.color}-50 dark:bg-${catInfo.color}-900/20`)}>
                                        <Icon className={cn("w-7 h-7", `text-${catInfo.color}-600`)} />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-lg leading-none">{gasto.descripcion}</p>
                                        <div className="flex items-center gap-4 text-[10px] font-bold text-muted-foreground opacity-60 uppercase tracking-widest mt-2">
                                            <div className="flex items-center gap-1.5 p-1 px-2 rounded-lg bg-slate-50 dark:bg-gray-800">
                                                <Calendar className="w-3.5 h-3.5" />
                                                {new Date(gasto.fecha).toLocaleDateString()}
                                            </div>
                                            <div className="flex items-center gap-1.5 p-1 px-2 rounded-lg bg-slate-50 dark:bg-gray-800">
                                                <Tag className="w-3.5 h-3.5" />
                                                {gasto.categoria}
                                            </div>
                                            {gasto.proveedorId && (
                                                <div className="flex items-center gap-1.5 p-1 px-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600">
                                                    <FileText className="w-3.5 h-3.5" /> Prov: {gasto.proveedorId.substring(0, 8)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 sm:gap-8 pl-0">
                                    <div className="text-right">
                                        <p className="text-xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 tabular-nums tracking-tighter">
                                            -{formatCurrency(gasto.monto)}
                                        </p>
                                        <Badge variant="outline" className="text-[8px] font-black uppercase tracking-tighter mt-1 opacity-50 px-2 border-slate-200 dark:border-slate-800">
                                            Vía: {gasto.metodoPago || 'Efectivo'} • {gasto.estado || 'pagado'}
                                        </Badge>
                                    </div>

                                    <div className="flex gap-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-12 w-12 rounded-2xl bg-slate-50 dark:bg-gray-800 hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-all border border-transparent hover:border-rose-100"
                                            onClick={() => onDeleteGasto(gasto.id)}
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}

                {gastos.length === 0 && (
                    <div className="text-center py-24 rounded-[3rem] bg-white/40 dark:bg-gray-900/40 opacity-30">
                        <Tag className="w-20 h-20 mx-auto mb-6 text-rose-500" />
                        <p className="font-black uppercase tracking-[0.3em] text-xs">Sin egresos en esta categoría</p>
                    </div>
                )}
            </div>
        </div>
    );
}
