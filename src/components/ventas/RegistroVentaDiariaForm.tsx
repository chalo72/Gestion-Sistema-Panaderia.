import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VentaDiaria } from '@/types';

interface RegistroVentaDiariaFormProps {
    formVenta: Partial<VentaDiaria>;
    setFormVenta: React.Dispatch<React.SetStateAction<Partial<VentaDiaria>>>;
    handleAddVentaDiaria: () => Promise<void>;
    formatCurrency: (val: number) => string;
}

export function RegistroVentaDiariaForm({
    formVenta,
    setFormVenta,
    handleAddVentaDiaria,
    formatCurrency
}: RegistroVentaDiariaFormProps) {
    const defaultBoxes = ['Principal', 'Helados', 'Mecato', 'Michelada', 'Tinto', 'Fritos', 'Tortas', 'Juegos', 'PIÑATERIA', 'Gastos/Salidas'];
    const customBoxes = Object.keys(formVenta.cajas || {}).filter(k => !defaultBoxes.includes(k));

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 text-left">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Fecha</Label>
                    <Input type="date" value={formVenta.fecha}
                        onChange={e => setFormVenta(p => ({ ...p, fecha: e.target.value }))}
                        className="h-9 text-sm rounded-xl font-bold" />
                </div>
                <div className="space-y-1 text-left">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Turno</Label>
                    <select
                        value={formVenta.turno}
                        onChange={e => setFormVenta(p => ({ ...p, turno: e.target.value as any }))}
                        className="flex h-9 w-full rounded-xl border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors mt-1 font-bold"
                    >
                        <option value="Día Completo">Día Completo</option>
                        <option value="Mañana">Mañana</option>
                        <option value="Tarde-Noche">Tarde-Noche</option>
                    </select>
                </div>
            </div>
            
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
                <button
                    onClick={() => {
                        const hoy = new Date().toISOString().split('T')[0];
                        setFormVenta(p => ({ ...p, fecha: hoy }));
                    }}
                    className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 hover:bg-emerald-200 dark:hover:bg-emerald-900/70 px-2.5 py-1.5 rounded-lg shrink-0"
                >
                    Hoy
                </button>
                <button
                    onClick={() => {
                        const ayer = new Date(Date.now() - 86400000).toISOString().split('T')[0];
                        setFormVenta(p => ({ ...p, fecha: ayer }));
                    }}
                    className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/70 px-2.5 py-1.5 rounded-lg shrink-0"
                >
                    Ayer
                </button>
            </div>

            <div className="text-left">
                <Label className="text-[10px] font-black uppercase text-violet-500">Día Especial / Evento (Opcional)</Label>
                <select
                    value={formVenta.evento || ''}
                    onChange={e => setFormVenta(p => ({ ...p, evento: e.target.value }))}
                    className="flex h-9 w-full rounded-xl border border-input bg-violet-500/5 text-violet-600 dark:text-violet-300 px-3 py-1 text-sm shadow-sm transition-colors mt-1 font-bold focus:ring-violet-500"
                >
                    <option value="">Normal (Sin evento)</option>
                    <option value="Pago Viejitos">👴 Pago Viejitos</option>
                    <option value="Renta Ciudadana">👨‍👩‍👧 Renta Ciudadana</option>
                    <option value="Ola Invernal">🌧️ Ola Invernal</option>
                    <option value="Festivo / Puente">🏖️ Festivo / Puente</option>
                    <option value="Quincena">💰 Quincena</option>
                    <option value="Pago Masivo Otro">💸 Pago Masivo (Otro)</option>
                </select>
            </div>

            <div className="space-y-2 border-t border-b border-white/5 py-2">
                <Label className="text-[10px] font-black uppercase text-amber-500 block text-left">Efectivo por Cajas</Label>
                <div className="grid grid-cols-2 gap-2">
                    {/* Render default boxes */}
                    {[
                        { id: 'Principal', icon: '🍞', label: 'Principal', defaultVal: formVenta.totalEfectivo },
                        { id: 'Helados', icon: '🍦', label: 'Helados' },
                        { id: 'Mecato', icon: '🍬', label: 'Mecato / Snacks' },
                        { id: 'Michelada', icon: '🍺', label: 'Michelada / Bebidas' },
                        { id: 'Tinto', icon: '☕', label: 'Tinto' },
                        { id: 'Fritos', icon: '🥟', label: 'Fritos' },
                        { id: 'Tortas', icon: '🎂', label: 'Tortas' },
                        { id: 'Juegos', icon: '🎮', label: 'Juegos' },
                        { id: 'PIÑATERIA', icon: '🎈', label: 'PIÑATERIA' },
                        { id: 'Gastos/Salidas', icon: '💸', label: 'Gastos/Salidas' },
                    ].map(box => (
                        <div key={box.id} className="text-left">
                            <Label className="text-[9px] font-bold text-muted-foreground">{box.icon} {box.label}</Label>
                            <Input
                                placeholder="Ej: 150.000"
                                type="text"
                                inputMode="numeric"
                                value={formVenta.cajas?.[box.id] ? String(formVenta.cajas[box.id]).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : (box.defaultVal || '')}
                                onChange={e => {
                                    const raw = e.target.value.replace(/[^0-9]/g, '');
                                    const val = parseInt(raw) || 0;
                                    setFormVenta(p => ({
                                        ...p,
                                        ...(box.id === 'Principal' ? { totalEfectivo: String(val) } : {}),
                                        cajas: { ...(p.cajas || {}), [box.id]: val }
                                    }));
                                }}
                                className="h-9 text-sm rounded-xl mt-0.5"
                            />
                        </div>
                    ))}
                    {/* Render custom boxes */}
                    {customBoxes.map(key => (
                        <div key={key} className="text-left">
                            <div className="flex justify-between items-center pr-1">
                                <Label className="text-[9px] font-bold text-amber-500/80 uppercase">📦 {key}</Label>
                                <button
                                    onClick={() => setFormVenta(p => {
                                        const copy = { ...p.cajas };
                                        delete copy[key];
                                        return { ...p, cajas: copy };
                                    })}
                                    className="text-[9px] text-rose-400 hover:text-rose-600 font-black transition-colors"
                                >
                                    ✕ quitar
                                </button>
                            </div>
                            <Input
                                placeholder={`Ej: 25.000`}
                                type="text"
                                inputMode="numeric"
                                value={formVenta.cajas?.[key] ? String(formVenta.cajas[key]).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
                                onChange={e => {
                                    const raw = e.target.value.replace(/[^0-9]/g, '');
                                    const val = parseInt(raw) || 0;
                                    setFormVenta(p => ({
                                        ...p,
                                        cajas: { ...(p.cajas || {}), [key]: val }
                                    }));
                                }}
                                className="h-9 text-sm rounded-xl mt-0.5"
                            />
                        </div>
                    ))}
                </div>

                {/* Añadir Caja Extra */}
                <div className="flex gap-1.5 mt-2">
                    <Input
                        id="nueva_caja_nombre"
                        placeholder="Nombre nueva caja (Ej: Piñatería)"
                        className="h-8 text-xs rounded-xl"
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                const inputName = (e.target as HTMLInputElement).value.trim();
                                if (inputName && !defaultBoxes.includes(inputName)) {
                                    setFormVenta(p => ({
                                        ...p,
                                        cajas: { ...(p.cajas || {}), [inputName]: 0 }
                                    }));
                                    (e.target as HTMLInputElement).value = '';
                                }
                            }
                        }}
                    />
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-xl px-2 text-xs font-black uppercase"
                        onClick={() => {
                            const input = document.getElementById('nueva_caja_nombre') as HTMLInputElement;
                            const name = input?.value.trim();
                            if (name && !defaultBoxes.includes(name)) {
                                setFormVenta(p => ({
                                    ...p,
                                    cajas: { ...(p.cajas || {}), [name]: 0 }
                                }));
                                input.value = '';
                            }
                        }}
                    >
                        + Caja
                    </Button>
                </div>
            </div>

            <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-indigo-500 block text-left">Otros Medios de Pago</Label>
                <div className="grid grid-cols-3 gap-2">
                    <Input placeholder="Nequi ($)" type="number" value={formVenta.totalNequi}
                        onChange={e => setFormVenta(p => ({ ...p, totalNequi: e.target.value }))}
                        className="h-9 text-sm rounded-xl" />
                    <Input placeholder="Transf. ($)" type="number" value={formVenta.totalTransferencia}
                        onChange={e => setFormVenta(p => ({ ...p, totalTransferencia: e.target.value }))}
                        className="h-9 text-sm rounded-xl" />
                    <Input placeholder="Crédito ($)" type="number" value={formVenta.totalCredito}
                        onChange={e => setFormVenta(p => ({ ...p, totalCredito: e.target.value }))}
                        className="h-9 text-sm rounded-xl" />
                </div>
            </div>

            <Input placeholder="Notas (opcional)" value={formVenta.notas}
                onChange={e => setFormVenta(p => ({ ...p, notas: e.target.value }))}
                className="h-9 text-sm rounded-xl text-left" />
                
            <div className="bg-card/50 rounded-xl p-3 border border-white/10 space-y-2 mt-2">
                <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground font-semibold">Total Principal + Nequi (Bruto):</span>
                    <span className="font-bold text-slate-400">
                        {(() => {
                            const princ = parseInt(formVenta.totalEfectivo || '0') || 0;
                            const nequi = parseInt(formVenta.totalNequi || '0') || 0;
                            return formatCurrency(princ + nequi);
                        })()}
                    </span>
                </div>
                {(formVenta.cajas?.['Gastos/Salidas'] || 0) > 0 && (
                    <div className="flex justify-between items-center text-xs text-rose-400">
                        <span className="font-semibold">- Gastos / Salidas en Caja:</span>
                        <span className="font-bold">-{formatCurrency(formVenta.cajas['Gastos/Salidas'])}</span>
                    </div>
                )}
                {(() => {
                    let sumOtras = 0;
                    if (formVenta.cajas) {
                        Object.entries(formVenta.cajas).forEach(([k, v]) => {
                            if (k !== 'Principal' && k !== 'Gastos/Salidas') {
                                sumOtras += (parseInt(String(v)) || 0);
                            }
                        });
                    }
                    if (sumOtras > 0) {
                        return (
                            <div className="flex justify-between items-center text-xs text-amber-500/80">
                                <span className="font-semibold">+ Otras Cajas (Helados, etc.):</span>
                                <span className="font-bold">+{formatCurrency(sumOtras)}</span>
                            </div>
                        );
                    }
                    return null;
                })()}
                
                <div className="border-t border-white/10 pt-2 flex justify-between items-center">
                    <span className="font-black uppercase tracking-wider text-slate-300">Total General:</span>
                    <span className="font-black text-amber-400">
                        {(() => {
                            const princ = parseInt(formVenta.totalEfectivo || '0') || 0;
                            const nequi = parseInt(formVenta.totalNequi || '0') || 0;
                            let sumOtras = 0;
                            let gastos = 0;
                            if (formVenta.cajas) {
                                Object.entries(formVenta.cajas).forEach(([k, v]) => {
                                    if (k === 'Gastos/Salidas') gastos += (parseInt(String(v)) || 0);
                                    else if (k !== 'Principal') sumOtras += (parseInt(String(v)) || 0);
                                });
                            }
                            return formatCurrency((princ + nequi + sumOtras) - gastos);
                        })()}
                    </span>
                </div>
            </div>

            <Button
                onClick={handleAddVentaDiaria}
                size="sm"
                className={cn(
                    "w-full rounded-xl text-white font-black text-xs h-10 shadow-lg mt-4",
                    formVenta.id
                        ? "bg-amber-600 hover:bg-amber-700 shadow-amber-600/10"
                        : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/10"
                )}
            >
                {formVenta.id ? (
                    <><Save className="w-4 h-4 mr-1" /> Guardar cambios</>
                ) : (
                    <><Plus className="w-4 h-4 mr-1" /> Registrar cierre del día</>
                )}
            </Button>
        </div>
    );
}
