import { useEffect, useState } from 'react';
import { Users, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { db } from '@/lib/database';
import { dbNube } from '@/lib/nube-kv';
import {
    equipoVigente, fechaHoy, guardarEquipo, leerEquipoLocal, nombreEquipo, turnoPorHora,
    type EquipoTurno, type TurnoNombre,
} from '@/lib/equipo-turno';

export interface CandidataTurno { id: string; nombre: string; rol?: string }

const ROLES_PRIORIDAD = ['vendedor', 'cajero'];

/** Trae las trabajadoras activas; las vendedoras/cajeras primero. */
export async function cargarCandidatas(): Promise<CandidataTurno[]> {
    try {
        const lista = await db.getAllTrabajadores();
        return (lista || [])
            .filter((t: any) => t && t.estado === 'activo' && t.nombre)
            .map((t: any) => ({ id: String(t.id), nombre: String(t.nombre), rol: t.rol }))
            .sort((a: CandidataTurno, b: CandidataTurno) => {
                const pa = ROLES_PRIORIDAD.includes(String(a.rol)) ? 0 : 1;
                const pb = ROLES_PRIORIDAD.includes(String(b.rol)) ? 0 : 1;
                return pa - pb || a.nombre.localeCompare(b.nombre);
            });
    } catch {
        return [];
    }
}

export const TURNOS_EQUIPO: { id: TurnoNombre; emoji: string }[] = [
    { id: 'Mañana', emoji: '🌅' },
    { id: 'Tarde', emoji: '☀️' },
    { id: 'Noche', emoji: '🌙' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Selector reutilizable (lo usa la apertura de jornada y el modal de cambio)
// ─────────────────────────────────────────────────────────────────────────────
export function EquipoTurnoSelector({ candidatas, seleccion, onChange, conjunta, onConjunta }: {
    candidatas: CandidataTurno[];
    seleccion: string[];
    onChange: (ids: string[]) => void;
    conjunta: boolean;
    onConjunta: (v: boolean) => void;
}) {
    const nombres = candidatas.filter(c => seleccion.includes(c.id)).map(c => c.nombre);
    return (
        <div className="space-y-2">
            {candidatas.length === 0 ? (
                <p className="text-xs font-bold text-amber-600">
                    No hay trabajadoras activas. Agrégalas en el módulo <b>Trabajadores</b> para poder elegirlas aquí.
                </p>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {candidatas.map(c => {
                        const on = seleccion.includes(c.id);
                        return (
                            <button
                                key={c.id}
                                type="button"
                                data-candidata={c.id}
                                onClick={() => onChange(on ? seleccion.filter(x => x !== c.id) : [...seleccion, c.id])}
                                className={cn(
                                    'h-10 px-4 rounded-full border-2 text-sm font-black flex items-center gap-1.5 transition-all active:scale-95',
                                    on ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20' : 'border-slate-200 text-slate-500 dark:border-slate-700',
                                )}
                            >
                                {on && <Check className="w-4 h-4" />} {c.nombre}
                            </button>
                        );
                    })}
                </div>
            )}
            {seleccion.length >= 2 && (
                <button
                    type="button"
                    data-conjunta
                    onClick={() => onConjunta(!conjunta)}
                    className={cn(
                        'w-full text-left rounded-xl border-2 px-3 py-2.5 transition-all',
                        conjunta ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-slate-700',
                    )}
                >
                    <p className="text-xs font-black text-slate-800 dark:text-slate-100">
                        {conjunta ? '✓ ' : ''}Responsables juntas (una sola caja)
                    </p>
                    <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                        {conjunta
                            ? `Todo sale a nombre de "${nombreEquipo(nombres)}" y las dos responden por la caja.`
                            : 'Cada venta se asigna a la vendedora que la hace (eliges con un toque).'}
                    </p>
                </button>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal para ver / cambiar el equipo del turno en cualquier momento
// ─────────────────────────────────────────────────────────────────────────────
export function EquipoTurnoModal({ open, onClose, onGuardado }: {
    open: boolean;
    onClose: () => void;
    onGuardado?: (e: EquipoTurno) => void;
}) {
    const [candidatas, setCandidatas] = useState<CandidataTurno[]>([]);
    const [turno, setTurno] = useState<TurnoNombre>(turnoPorHora());
    const [seleccion, setSeleccion] = useState<string[]>([]);
    const [conjunta, setConjunta] = useState(false);

    useEffect(() => {
        if (!open) return;
        const actual = equipoVigente(leerEquipoLocal());
        setTurno(actual?.turno || turnoPorHora());
        setSeleccion(actual?.integrantes.map(i => i.id) || []);
        setConjunta(actual ? actual.modo === 'conjunta' : false);
        cargarCandidatas().then(setCandidatas);
    }, [open]);

    const cambiarTurno = (t: TurnoNombre) => {
        setTurno(t);
        setConjunta(prev => t === 'Mañana' ? false : t === 'Tarde' ? true : prev); // Noche no apaga "juntas"
    };

    const guardar = () => {
        const integrantes = candidatas.filter(c => seleccion.includes(c.id)).map(c => ({ id: c.id, nombre: c.nombre }));
        if (integrantes.length === 0) return;
        const e = guardarEquipo({
            fecha: fechaHoy(), turno, modo: conjunta && integrantes.length >= 2 ? 'conjunta' : 'individual',
            integrantes, actualizadoEn: Date.now(),
        }, dbNube);
        onGuardado?.(e);
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
            <DialogContent className="max-w-md rounded-3xl">
                <DialogHeader>
                    <DialogTitle className="font-black uppercase tracking-tight flex items-center gap-2">
                        <Users className="w-5 h-5 text-indigo-600" /> ¿Quién está en el turno?
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                        {TURNOS_EQUIPO.map(t => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => cambiarTurno(t.id)}
                                className={cn(
                                    'h-12 rounded-xl border-2 text-xs font-black uppercase flex flex-col items-center justify-center',
                                    turno === t.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-400',
                                )}
                            >
                                <span>{t.emoji}</span>{t.id}
                            </button>
                        ))}
                    </div>
                    <EquipoTurnoSelector candidatas={candidatas} seleccion={seleccion} onChange={setSeleccion} conjunta={conjunta} onConjunta={setConjunta} />
                    <Button
                        disabled={seleccion.length === 0}
                        onClick={guardar}
                        className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-xs tracking-widest"
                    >
                        Guardar turno
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
