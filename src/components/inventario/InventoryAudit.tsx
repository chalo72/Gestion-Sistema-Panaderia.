import React from 'react';
import { ClipboardList, Filter, Minus, Plus, CheckCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Categoria } from '@/types';

interface InventoryAuditProps {
    items: any[];
    categorias: Categoria[];
    categoriaAuditoria: string;
    setCategoriaAuditoria: (cat: string) => void;
    auditValues: Record<string, number>;
    setAuditValues: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    handleQuickAudit: (item: any, nuevoStock: number) => void;
}

export function InventoryAudit({
    items,
    categorias,
    categoriaAuditoria,
    setCategoriaAuditoria,
    auditValues,
    setAuditValues,
    handleQuickAudit
}: InventoryAuditProps) {
    return (
        <div className="space-y-8 animate-ag-fade-in">
            <Card className="rounded-[2.5rem] bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-800/30 p-8 overflow-hidden relative shadow-sm">
                <div className="flex items-start gap-6 relative z-10">
                    <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-600/40 transform rotate-6">
                        <ClipboardList className="w-8 h-8 text-white" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-2xl font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-tight">Modo Auditoría Cíclica</h3>
                        <p className="text-sm font-bold text-indigo-700/70 dark:text-indigo-400/70 mt-1 max-w-2xl leading-relaxed">
                            Optimice su operación realizando conteos rápidos sin interrumpir el flujo.
                            Los ajustes predictivos se aplican instantáneamente al confirmar la diferencia entre sistema y realidad.
                        </p>
                    </div>
                </div>
                <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl" />
            </Card>

            <div className="flex flex-col md:flex-row md:items-end gap-6 p-4">
                <div className="w-full max-w-sm space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 ml-1">Focalizar Categoría</Label>
                    <Select value={categoriaAuditoria} onValueChange={setCategoriaAuditoria}>
                        <SelectTrigger className="h-12 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 font-black uppercase text-[10px] tracking-widest px-5">
                            <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-2xl">
                            <SelectItem value="todas">Todas las Categorías</SelectItem>
                            {categorias.map(cat => (
                                <SelectItem key={cat.id} value={cat.nombre} className="text-xs font-bold uppercase py-3">{cat.nombre}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex-1 text-right text-[11px] font-black uppercase tracking-widest opacity-40 text-muted-foreground pb-4">
                    Carga de Auditoría: <span className="text-indigo-600 dark:text-indigo-400">{items.length} skus identificados</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {items.map((item) => (
                    <Card key={item.id} className="group overflow-hidden bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1">
                        <CardContent className="p-8">
                            <div className="mb-6">
                                <Badge variant="outline" className="mb-3 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border-indigo-200 text-indigo-500">
                                    {item.producto!.categoria}
                                </Badge>
                                <h3 className="font-black text-xl leading-tight text-gray-900 dark:text-white uppercase tracking-tight line-clamp-2 min-h-[3rem]" title={item.producto!.nombre}>
                                    {item.producto!.nombre}
                                </h3>
                                <div className="mt-4 flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                                    <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Stock Sistema</span>
                                    <span className="font-black text-lg tabular-nums text-gray-900 dark:text-indigo-400">{item.stockActual} <span className="text-[10px] opacity-40">uds</span></span>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 mb-6">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-12 w-12 rounded-2xl border-gray-200 dark:border-gray-800 hover:bg-slate-50 transition-all shrink-0"
                                    onClick={() => setAuditValues(prev => ({ ...prev, [item.id]: (prev[item.id] ?? item.stockActual) - 1 }))}
                                >
                                    <Minus className="w-5 h-5 text-indigo-600" />
                                </Button>

                                <div className="flex-1 relative">
                                    <Input
                                        type="number"
                                        className="text-center font-black text-2xl h-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                                        value={auditValues[item.id] ?? ''}
                                        placeholder={item.stockActual.toString()}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            setAuditValues(prev => ({ ...prev, [item.id]: isNaN(val) ? 0 : val }));
                                        }}
                                    />
                                </div>

                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-12 w-12 rounded-2xl border-gray-200 dark:border-gray-800 hover:bg-slate-50 transition-all shrink-0"
                                    onClick={() => setAuditValues(prev => ({ ...prev, [item.id]: (prev[item.id] ?? item.stockActual) + 1 }))}
                                >
                                    <Plus className="w-5 h-5 text-indigo-600" />
                                </Button>
                            </div>

                            <Button
                                className={cn(
                                    "w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl transition-all border-none",
                                    auditValues[item.id] === undefined || auditValues[item.id] === item.stockActual
                                        ? "bg-gray-100 dark:bg-gray-800 text-gray-400 grayscale"
                                        : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/30 hover:scale-105 active:scale-95"
                                )}
                                disabled={auditValues[item.id] === undefined || auditValues[item.id] === item.stockActual}
                                onClick={() => handleQuickAudit(item, auditValues[item.id]!)}
                            >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Confirmar Diferencia
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {items.length === 0 && (
                <div className="text-center py-20 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <Filter className="w-16 h-16 mx-auto mb-6 opacity-10 text-indigo-500" />
                    <p className="text-[11px] font-black uppercase tracking-[0.3em] opacity-30">No se encontraron ítems para auditar</p>
                </div>
            )}
        </div>
    );
}
