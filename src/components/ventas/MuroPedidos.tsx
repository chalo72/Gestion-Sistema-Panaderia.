import React, { useState } from 'react';
import { Users, Clock, ChefHat, Plus, Edit2, Trash2, Save, X, Unlock } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { Mesa, PedidoActivo } from '@/types';
import { safeNumber } from '@/lib/safe-utils';
import { toast } from 'sonner';

interface MuroPedidosProps {
    mesas: Mesa[];
    pedidosActivos: PedidoActivo[];
    onSelectMesa: (mesa: Mesa) => void;
    formatCurrency: (value: number) => string;
    onUpdateMesa?: (mesa: Mesa) => Promise<void>;
    onAddMesa?: (mesa: Mesa) => Promise<void>;
    onDeleteMesa?: (id: string) => Promise<void>;
}

export function MuroPedidos({ mesas, pedidosActivos, onSelectMesa, formatCurrency, onUpdateMesa, onAddMesa, onDeleteMesa }: MuroPedidosProps) {
    const mesasDisponibles = mesas.filter(m => m.estado === 'disponible').length;
    const mesasOcupadas = mesas.filter(m => m.estado !== 'disponible').length;

    const [showModal, setShowModal] = useState(false);
    const [editingMesa, setEditingMesa] = useState<Mesa | null>(null);
    const [form, setForm] = useState({ numero: '', capacidad: 4, ubicacion: '' });

    const openCreateModal = () => {
        const maxNumero = mesas.length > 0
            ? Math.max(...mesas.map(m => parseInt(m.numero) || 0))
            : 0;
        setEditingMesa(null);
        setForm({ numero: String(maxNumero + 1), capacidad: 4, ubicacion: '' });
        setShowModal(true);
    };

    const openEditModal = (mesa: Mesa, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingMesa(mesa);
        setForm({ numero: mesa.numero, capacidad: mesa.capacidad, ubicacion: mesa.ubicacion || '' });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (editingMesa && onUpdateMesa) {
            await onUpdateMesa({ ...editingMesa, numero: form.numero, capacidad: form.capacidad, ubicacion: form.ubicacion });
            toast.success(`Mesa ${form.numero} actualizada`);
        } else if (onAddMesa) {
            const newMesa: Mesa = {
                id: crypto.randomUUID(),
                numero: form.numero,
                capacidad: form.capacidad,
                estado: 'disponible',
                ubicacion: form.ubicacion,
            };
            await onAddMesa(newMesa);
            toast.success(`Mesa ${form.numero} creada`);
        }
        setShowModal(false);
    };

    const handleDelete = async (mesa: Mesa, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!onDeleteMesa) return;
        if (mesa.estado !== 'disponible') {
            toast.error('No puedes eliminar una mesa ocupada');
            return;
        }
        await onDeleteMesa(mesa.id);
        toast.success(`Mesa ${mesa.numero} eliminada`);
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <ChefHat className="w-5 h-5 text-primary" /> Mesas del Local
                        </h2>
                        <p className="text-sm text-slate-400 mt-0.5">Toca una mesa para abrir pedido</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg font-bold text-sm">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" /> {mesasDisponibles} Libres
                        </span>
                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg font-bold text-sm">
                            <div className="w-2 h-2 rounded-full bg-blue-500" /> {mesasOcupadas} Ocupadas
                        </span>
                        {onAddMesa && (
                            <Button onClick={openCreateModal}
                                className="h-10 px-4 rounded-xl bg-primary hover:bg-orange-600 text-white font-bold text-sm">
                                <Plus className="w-4 h-4 mr-1" /> Nueva Mesa
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Grid de Mesas */}
            <ScrollArea className="flex-1 p-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {mesas.map(mesa => {
                        const pedido = pedidosActivos.find(p => p.id === mesa.pedidoActivoId);
                        const isOcupada = mesa.estado !== 'disponible';

                        let tiempoStr = '';
                        if (pedido?.fechaInicio) {
                            const mins = Math.floor((Date.now() - new Date(pedido.fechaInicio).getTime()) / 60000);
                            tiempoStr = mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
                        }

                        return (
                            <div key={mesa.id}
                                onClick={() => onSelectMesa(mesa)}
                                className={cn(
                                    "group rounded-2xl border-2 p-5 cursor-pointer transition-all hover:shadow-lg active:scale-[0.97] relative",
                                    isOcupada
                                        ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 hover:border-blue-400"
                                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-emerald-400"
                                )}>
                                {/* Botones editar/eliminar (hover) */}
                                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                    {onUpdateMesa && (
                                        <button onClick={(e) => openEditModal(mesa, e)}
                                            className="w-7 h-7 rounded-lg bg-white/90 shadow flex items-center justify-center hover:bg-blue-500 hover:text-white transition-colors">
                                            <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                    {onDeleteMesa && !isOcupada && (
                                        <button onClick={(e) => handleDelete(mesa, e)}
                                            className="w-7 h-7 rounded-lg bg-white/90 shadow flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>

                                {/* Número de mesa */}
                                <div className="flex items-center justify-between mb-3">
                                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center",
                                        isOcupada ? "bg-blue-500 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-400"
                                    )}>
                                        <Users className="w-6 h-6" />
                                    </div>
                                    <span className={cn("text-xs font-bold px-2 py-1 rounded-lg",
                                        isOcupada ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                                    )}>
                                        {isOcupada ? 'Ocupada' : 'Libre'}
                                    </span>
                                </div>

                                {/* Info de mesa */}
                                <h3 className="text-xl font-extrabold text-slate-800 dark:text-white">Mesa {mesa.numero}</h3>
                                <p className="text-sm text-slate-400 mb-3">
                                    {mesa.capacidad} personas{mesa.ubicacion ? ` · ${mesa.ubicacion}` : ''}
                                </p>

                                {/* Info del pedido si está ocupada */}
                                {isOcupada && pedido ? (
                                    <div className="space-y-2 pt-3 border-t border-blue-200 dark:border-blue-800">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-semibold text-slate-500">Total:</span>
                                            <span className="text-lg font-extrabold text-blue-600">{formatCurrency(safeNumber(pedido.total))}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-semibold text-slate-500">Ítems:</span>
                                            <span className="text-sm font-bold">{pedido.items.length} productos</span>
                                        </div>
                                        {tiempoStr && (
                                            <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                                <Clock className="w-3.5 h-3.5" /> Abierta hace {tiempoStr}
                                            </div>
                                        )}
                                        {pedido.cliente && (
                                            <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-md inline-block">
                                                {pedido.cliente}
                                            </span>
                                        )}
                                        {/* Botón de Liberación de Emergencia */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSelectMesa(mesa);
                                                // El usuario será llevado al carrito donde ahora el botón ámbar SI funcionará
                                                toast.info("Usa el botón ámbar 'Liberar Mesa' en el carrito de la derecha");
                                            }}
                                            className="w-full mt-2 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                                        >
                                            <Unlock className="w-3 h-3" /> Liberar Mesa Ahora
                                        </button>
                                    </div>
                                ) : (
                                    <div className="pt-3 border-t border-slate-100 dark:border-slate-700">
                                        <p className="text-sm text-emerald-600 font-semibold">✓ Disponible — toca para abrir</p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {mesas.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <Users className="w-14 h-14 text-slate-200 mb-3" />
                        <p className="text-lg font-bold text-slate-300">Sin mesas configuradas</p>
                        <p className="text-sm text-slate-300 mt-1 mb-4">Crea tu primera mesa</p>
                        {onAddMesa && (
                            <Button onClick={openCreateModal} className="rounded-xl bg-primary hover:bg-orange-600 text-white font-bold">
                                <Plus className="w-4 h-4 mr-1" /> Crear Mesa
                            </Button>
                        )}
                    </div>
                )}
            </ScrollArea>

            {/* Modal Crear/Editar Mesa */}
            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="max-w-sm rounded-2xl p-0 border border-slate-200 dark:border-slate-700 shadow-xl">
                    <div className="bg-slate-900 text-white p-5 rounded-t-2xl">
                        <h3 className="text-lg font-bold">{editingMesa ? 'Editar Mesa' : 'Nueva Mesa'}</h3>
                        <DialogDescription className="text-xs text-slate-400 mt-0.5">
                            {editingMesa ? 'Modifica los datos de la mesa' : 'Agrega una nueva mesa al local'}
                        </DialogDescription>
                    </div>
                    <div className="p-5 space-y-4">
                        <div>
                            <Label className="text-sm font-bold text-slate-500 mb-1 block">Número de Mesa</Label>
                            <Input type="number" value={form.numero}
                                onChange={e => setForm(f => ({ ...f, numero: e.target.value }))}
                                className="h-12 text-2xl font-extrabold text-center rounded-xl border-slate-200" />
                        </div>
                        <div>
                            <Label className="text-sm font-bold text-slate-500 mb-1 block">Capacidad (personas)</Label>
                            <Input type="number" value={form.capacidad}
                                onChange={e => setForm(f => ({ ...f, capacidad: parseInt(e.target.value) || 1 }))}
                                className="h-11 text-lg font-bold text-center rounded-xl border-slate-200" />
                        </div>
                        <div>
                            <Label className="text-sm font-bold text-slate-500 mb-1 block">Ubicación (opcional)</Label>
                            <Input value={form.ubicacion}
                                onChange={e => setForm(f => ({ ...f, ubicacion: e.target.value }))}
                                placeholder="Ej: Interior, Terraza, Barra..."
                                className="h-11 text-sm rounded-xl border-slate-200" />
                        </div>
                        <div className="flex gap-2 pt-2">
                            <Button variant="ghost" onClick={() => setShowModal(false)}
                                className="flex-1 h-12 rounded-xl text-sm font-bold">
                                <X className="w-4 h-4 mr-1" /> Cancelar
                            </Button>
                            <Button onClick={handleSave}
                                className="flex-[2] h-12 rounded-xl bg-primary hover:bg-orange-600 text-white text-sm font-bold">
                                <Save className="w-4 h-4 mr-1" /> {editingMesa ? 'Guardar' : 'Crear Mesa'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
