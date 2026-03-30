import React, { useState } from 'react';
import { Tag, Plus, Trash2, Palette, X, Edit2, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Categoria } from '@/types';

interface ProductCategoryManagerProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    categorias: Categoria[];
    onDeleteCategoria: (id: string) => void;
    onUpdateCategoria: (id: string, nombre: string, color: string) => void;
    onAddCategoria: (e: React.FormEvent) => void;
    nuevaCategoria: { nombre: string; color: string };
    setNuevaCategoria: (val: any) => void;
    coloresPreset: string[];
}

export function ProductCategoryManager({
    isOpen,
    onOpenChange,
    categorias,
    onDeleteCategoria,
    onUpdateCategoria,
    onAddCategoria,
    nuevaCategoria,
    setNuevaCategoria,
    coloresPreset
}: ProductCategoryManagerProps) {
    const [editingId, setEditingId]       = useState<string | null>(null);
    const [editNombre, setEditNombre]     = useState('');
    const [editColor, setEditColor]       = useState('');

    const startEdit = (cat: Categoria) => {
        setEditingId(cat.id);
        setEditNombre(cat.nombre);
        setEditColor(cat.color);
    };

    const cancelEdit = () => setEditingId(null);

    const saveEdit = () => {
        if (!editNombre.trim() || !editingId) return;
        onUpdateCategoria(editingId, editNombre.trim(), editColor);
        setEditingId(null);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl rounded-[3rem] p-0 overflow-hidden border-none shadow-3xl bg-white dark:bg-gray-950">
                <div className="bg-slate-900 p-8 text-white relative">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md border border-white/10">
                            <Tag className="w-6 h-6" />
                        </div>
                        <div>
                            <DialogTitle className="text-2xl font-black uppercase tracking-tight">
                                Estructura de Categorías
                            </DialogTitle>
                            <p className="text-white/40 font-bold text-[10px] uppercase tracking-widest mt-1">
                                Taxonomía del catálogo Dulce Placer
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-6 top-6 text-white/40 hover:text-white"
                        onClick={() => onOpenChange(false)}
                    >
                        <X className="w-6 h-6" />
                    </Button>
                </div>

                <Tabs defaultValue="lista" className="w-full">
                    <div className="px-10 pt-8">
                        <TabsList className="grid w-full grid-cols-2 bg-slate-50 dark:bg-gray-900 p-1.5 rounded-2xl h-14">
                            <TabsTrigger value="lista" className="rounded-xl font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-lg transition-all">Listado Activo</TabsTrigger>
                            <TabsTrigger value="nueva" className="rounded-xl font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-lg transition-all">Crear Nueva</TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="lista" className="p-10 pt-6">
                        <ScrollArea className="h-72 pr-4">
                            <div className="space-y-3">
                                {categorias.map((categoria) => (
                                    <div key={categoria.id}>
                                        {editingId === categoria.id ? (
                                            /* Formulario inline de edición */
                                            <div className="p-4 rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50/40 dark:bg-indigo-900/10 space-y-3">
                                                <Input
                                                    value={editNombre}
                                                    onChange={e => setEditNombre(e.target.value)}
                                                    className="h-10 font-bold rounded-xl bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700"
                                                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                                                    autoFocus
                                                />
                                                <div className="grid grid-cols-5 gap-2">
                                                    {coloresPreset.map(color => (
                                                        <button
                                                            key={color}
                                                            type="button"
                                                            onClick={() => setEditColor(color)}
                                                            className={cn(
                                                                "w-full aspect-square rounded-lg transition-all",
                                                                editColor === color ? "ring-2 ring-offset-1 ring-slate-700 scale-110" : "hover:scale-105"
                                                            )}
                                                            style={{ backgroundColor: color }}
                                                        />
                                                    ))}
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button type="button" size="sm" onClick={saveEdit}
                                                        disabled={!editNombre.trim()}
                                                        className="flex-1 h-9 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black">
                                                        <Check className="w-3.5 h-3.5 mr-1" /> Guardar
                                                    </Button>
                                                    <Button type="button" size="sm" variant="outline" onClick={cancelEdit}
                                                        className="h-9 rounded-xl text-xs">
                                                        Cancelar
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            /* Fila normal */
                                            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-gray-900/50 rounded-2xl border border-slate-100 dark:border-gray-800 hover:shadow-md transition-all group">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl shadow-lg border-2 border-white dark:border-gray-800"
                                                        style={{ backgroundColor: categoria.color }} />
                                                    <span className="font-black uppercase tracking-tight text-slate-800 dark:text-white">{categoria.nombre}</span>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                    <Button variant="ghost" size="icon"
                                                        className="h-9 w-9 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-xl"
                                                        onClick={() => startEdit(categoria)}>
                                                        <Edit2 className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon"
                                                        className="h-9 w-9 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl"
                                                        onClick={() => onDeleteCategoria(categoria.id)}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                        {categorias.length === 0 && (
                            <div className="text-center py-10 opacity-20">
                                <Tag className="w-12 h-12 mx-auto mb-2" />
                                <p className="font-black uppercase text-[10px] tracking-widest">Sin categorías</p>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="nueva" className="p-10 pt-6">
                        <form onSubmit={onAddCategoria} className="space-y-8">
                            <div className="space-y-4">
                                <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Nombre Visual</Label>
                                <Input
                                    value={nuevaCategoria.nombre}
                                    onChange={(e) => setNuevaCategoria({ ...nuevaCategoria, nombre: e.target.value })}
                                    placeholder="Ej: Repostería Fina"
                                    className="h-14 font-black uppercase bg-slate-50 dark:bg-gray-800 border-none rounded-2xl shadow-inner px-6"
                                />
                            </div>

                            <div className="space-y-4">
                                <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1 flex items-center gap-2">
                                    <Palette className="w-4 h-4" /> Signatura por Color
                                </Label>
                                <div className="grid grid-cols-5 gap-3">
                                    {coloresPreset.map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setNuevaCategoria({ ...nuevaCategoria, color })}
                                            className={cn(
                                                "w-full aspect-square rounded-xl shadow-sm transition-all relative overflow-hidden",
                                                nuevaCategoria.color === color ? "ring-4 ring-indigo-500 scale-105" : "hover:scale-105"
                                            )}
                                            style={{ backgroundColor: color }}
                                        >
                                            {nuevaCategoria.color === color && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                                                    <div className="w-2 h-2 rounded-full bg-white shadow-xl" />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <Button type="submit" className="w-full h-16 bg-slate-900 hover:bg-black text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl transition-all">
                                <Plus className="w-5 h-5 mr-3" /> Crear Categoría
                            </Button>
                        </form>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
