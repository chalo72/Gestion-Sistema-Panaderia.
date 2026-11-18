/**
 * Historial de cajas de UN día, ordenado por turno.
 * Mañana (ámbar), tarde (naranja) y noche (índigo) van en cuadros separados.
 */
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, Eye, Pencil, AlertTriangle, CheckCircle2, MessageCircle, Landmark, Store, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getMovimientosBoveda } from '@/lib/boveda-store';
import { resumenCajasDelDia, resumenDiaTexto, fechaLocal, type CajaDia } from '@/lib/historial-cajas';

interface Props {
    sesiones: any[];
    nombre?: (s: any) => string;
    responsable?: (s: any) => string;
    onVer?: (sesion: any) => void;
    onEditar?: (sesion: any) => void;
}

const $ = (n: number | null | undefined) => (n == null ? '—' : `$${Math.round(n).toLocaleString('es-CO')}`);
const hora = (t?: number) => (t ? new Date(t).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '');
const dur = (m?: number) => (m == null ? 'en curso' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`);
const EMOJI: Record<string, string> = { 'Mañana': '☀️', 'Tarde': '🌆', 'Noche': '🌙' };
const ESTILO: Record<string, { borde: string; fondo: string; titulo: string; fila: string }> = {
    Mañana: { borde: 'border-amber-400', fondo: 'bg-amber-100', titulo: 'text-amber-950', fila: 'bg-amber-50/60' },
    Tarde: { borde: 'border-orange-500', fondo: 'bg-orange-100', titulo: 'text-orange-950', fila: 'bg-orange-50/70' },
    Noche: { borde: 'border-indigo-500', fondo: 'bg-indigo-100', titulo: 'text-indigo-950', fila: 'bg-indigo-50/70' },
};
const estiloDe = (turno: string) => ESTILO[turno] || { borde: 'border-slate-300', fondo: 'bg-slate-100', titulo: 'text-slate-900', fila: 'bg-white' };
const moverDia = (f: string, d: number) => { const x = new Date(`${f}T12:00:00`); x.setDate(x.getDate() + d); return fechaLocal(x); };

function diasDelMesHasta(fecha: string, hoy: string): string[] {
    const [y, m] = fecha.split('-').map(Number);
    const ultimo = new Date(y, m, 0).getDate();
    const tope = fecha.slice(0, 7) === hoy.slice(0, 7) ? Number(hoy.slice(8, 10)) : ultimo;
    const out: string[] = [];
    for (let d = 1; d <= tope; d++) out.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    return out;
}

export function HistorialCajasDia({ sesiones, nombre, responsable, onVer, onEditar }: Props) {
    const [fecha, setFecha] = useState<string>(() => fechaLocal(new Date()));
    const hoy = fechaLocal(new Date());
    const bov = useMemo(() => { try { return getMovimientosBoveda(); } catch { return []; } }, [sesiones, fecha]); // eslint-disable-line react-hooks/exhaustive-deps
    const r = useMemo(() => resumenCajasDelDia(sesiones, bov, fecha, { nombre, responsable }), [sesiones, bov, fecha, nombre, responsable]);
    const titulo = new Date(`${fecha}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const conteoPorDia = useMemo(() => {
        const map = new Map<string, number>();
        for (const s of sesiones || []) {
            const t = new Date(s?.fechaApertura).getTime();
            if (!Number.isFinite(t)) continue;
            const f = fechaLocal(t);
            map.set(f, (map.get(f) || 0) + 1);
        }
        return map;
    }, [sesiones]);
    const diasMes = useMemo(() => diasDelMesHasta(fecha, hoy), [fecha, hoy]);
    const movimientosCaja = useMemo(() => {
        const items: { t: number; tipo: string; monto: number; motivo: string; caja: string }[] = [];
        for (const turno of r.turnos) {
            for (const c of turno.cajas) {
                const movs = Array.isArray(c.sesion?.movimientos) ? c.sesion.movimientos : [];
                for (const m of movs) {
                    const t = new Date(m.fecha).getTime();
                    items.push({ t: Number.isFinite(t) ? t : c.abre, tipo: m.tipo || 'entrada', monto: Number(m.monto) || 0, motivo: m.motivo || 'Movimiento', caja: c.nombre });
                }
            }
        }
        return items.sort((a, b) => a.t - b.t);
    }, [r]);

    return (
        <div className="space-y-4 text-slate-950" data-historial-dia>
            <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl text-slate-900" onClick={() => setFecha(f => moverDia(f, -1))} aria-label="Día anterior"><ChevronLeft className="w-4 h-4" /></Button>
                <label className="flex items-center gap-2 h-9 px-3 rounded-xl border-2 border-slate-300 bg-white text-slate-950">
                    <CalendarDays className="w-4 h-4 text-slate-700" />
                    <input type="date" value={fecha} max={hoy} onChange={e => e.target.value && setFecha(e.target.value)} data-fecha className="bg-white text-sm font-black text-slate-950 outline-none" />
                </label>
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl text-slate-900" disabled={fecha >= hoy} onClick={() => setFecha(f => moverDia(f, 1))} aria-label="Día siguiente"><ChevronRight className="w-4 h-4" /></Button>
                {fecha !== hoy && <Button variant="ghost" size="sm" className="rounded-xl font-black text-xs text-slate-900" onClick={() => setFecha(hoy)}>Hoy</Button>}
                <p className="text-sm font-black capitalize text-slate-950 ml-1">{titulo}</p>
                {r.nCajas > 0 && (
                    <Button variant="outline" size="sm" className="ml-auto rounded-xl font-black text-xs text-slate-900" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(resumenDiaTexto(r))}`, '_blank')}>
                        <MessageCircle className="w-4 h-4 mr-1.5" /> Enviar resumen
                    </Button>
                )}
            </div>

            <div className="rounded-2xl border-2 border-slate-200 bg-white p-3" data-buscar-fecha>
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-700 mb-2">Buscar cuadre por fecha · este mes</p>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {diasMes.map(f => {
                        const n = conteoPorDia.get(f) || 0;
                        const activo = f === fecha;
                        const dia = Number(f.slice(8, 10));
                        return (
                            <button
                                key={f}
                                type="button"
                                onClick={() => setFecha(f)}
                                className={cn(
                                    'shrink-0 min-w-[52px] rounded-xl border-2 px-2 py-1.5 text-center',
                                    activo ? 'border-slate-950 bg-slate-950 text-white' :
                                    n > 0 ? 'border-emerald-400 bg-emerald-50 text-emerald-950' :
                                    'border-dashed border-slate-300 bg-slate-50 text-slate-500'
                                )}
                            >
                                <span className="block text-sm font-black leading-none">{dia}</span>
                                <span className={cn('block text-[9px] font-bold mt-0.5', activo ? 'text-white' : n > 0 ? 'text-emerald-800' : 'text-slate-400')}>
                                    {n > 0 ? `${n}` : '—'}
                                </span>
                            </button>
                        );
                    })}
                </div>
                <p className="text-[10px] font-bold text-slate-600 mt-1">Verde = ese día tiene cuadres guardados. Guion = no hay registro de cajas ese día.</p>
            </div>

            {r.nCajas === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-800 font-bold">
                    El {titulo} no tiene cuadres de caja guardados.
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2" data-resumen-dia>
                        <Tile titulo="Cajas" valor={`${r.nCajas}`} sub={r.nAbiertas ? `${r.nAbiertas} siguen abiertas` : 'todas cerradas'} />
                        <Tile titulo="Base de apertura" valor={$(r.totalBase)} sub="suma de todas" />
                        <Tile titulo="Cierres declarados" valor={$(r.totalCierre)} sub="lo que dice cada caja" />
                        <Tile titulo="Entregado en Bóveda" valor={$(r.totalEntregado)} sub="Entregas de Turno" />
                        <Tile titulo="Alertas" valor={`${r.nAlertas}`} sub={r.nAlertas ? 'revisar abajo' : 'todo cuadra'} alerta={r.nAlertas > 0} />
                    </div>

                    {r.turnos.map(t => {
                        const est = estiloDe(t.turno);
                        return (
                            <div key={t.turno} className={cn('rounded-2xl border-2 bg-white overflow-hidden', est.borde)} data-turno={t.turno}>
                                <div className={cn('px-4 py-3 border-b-2 flex flex-wrap items-center gap-x-4 gap-y-1', est.fondo, est.borde)}>
                                    <p className={cn('font-black text-base', est.titulo)}>{EMOJI[t.turno] || '🕒'} Turno {t.turno}</p>
                                    <p className={cn('text-sm font-bold', est.titulo)}>{t.responsables}</p>
                                    <p className={cn('text-sm font-bold', est.titulo)}>{hora(t.desde)} – {t.hasta ? hora(t.hasta) : 'abierto'}</p>
                                    <div className={cn('ml-auto flex flex-wrap gap-3 text-sm font-bold', est.titulo)}>
                                        <span>Base <b className="font-black">{$(t.base)}</b></span>
                                        <span>Cierre <b className="font-black">{$(t.cierre)}</b></span>
                                        <span>Entregado <b className="font-black">{$(t.entregado)}</b></span>
                                        {t.alertas > 0 && <span className="text-rose-700 font-black">⚠ {t.alertas}</span>}
                                    </div>
                                </div>
                                <div className="hidden md:grid grid-cols-[1.4fr_1fr_0.8fr_0.9fr_0.9fr_1fr_1.6fr_auto] gap-2 px-4 py-2 text-[11px] font-black uppercase text-slate-700 border-b border-slate-200 bg-white">
                                    <span>Caja</span><span>Horario</span><span>Duración</span><span className="text-right">Base</span><span className="text-right">Cierre</span><span className="text-right">Entregado</span><span>Estado</span><span />
                                </div>
                                <div className="divide-y divide-slate-200">
                                    {t.cajas.map(c => <FilaCaja key={c.id} c={c} fondo={est.fila} onVer={onVer} onEditar={onEditar} />)}
                                </div>
                            </div>
                        );
                    })}

                    <div className="rounded-2xl border-2 border-slate-300 bg-white" data-movimientos-dia>
                        <p className="px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2 border-b border-slate-200">
                            <Landmark className="w-4 h-4" /> Movimientos del día
                        </p>
                        {movimientosCaja.length === 0 && r.movimientosBoveda.length === 0 ? (
                            <p className="px-4 py-4 text-sm font-bold text-slate-800">
                                Este día no tiene entradas ni salidas anotadas dentro de las cajas, ni entregas registradas en la bóveda. El cierre declarado sí está en los cuadros de arriba.
                            </p>
                        ) : (
                            <div className="divide-y divide-slate-200">
                                {movimientosCaja.map((m, i) => (
                                    <div key={`c-${i}`} className="px-4 py-2 text-sm flex items-center gap-3 text-slate-950">
                                        {m.tipo === 'salida'
                                            ? <ArrowDownCircle className="w-4 h-4 text-rose-600 shrink-0" />
                                            : <ArrowUpCircle className="w-4 h-4 text-emerald-600 shrink-0" />}
                                        <span className="font-mono text-slate-700 w-16 shrink-0">{hora(m.t)}</span>
                                        <span className="flex-1 min-w-0 font-bold">{m.caja}: {m.motivo}</span>
                                        <span className={cn('font-black tabular-nums', m.tipo === 'salida' ? 'text-rose-700' : 'text-emerald-700')}>
                                            {m.tipo === 'salida' ? '−' : '+'}{$(m.monto)}
                                        </span>
                                    </div>
                                ))}
                                {r.movimientosBoveda.map((m, i) => (
                                    <div key={`b-${i}`} className={cn('px-4 py-2 text-sm flex items-center gap-3 text-slate-950', /^Cierre autom/i.test(m.motivo) && 'bg-amber-50')}>
                                        <Landmark className="w-4 h-4 text-slate-700 shrink-0" />
                                        <span className="font-mono text-slate-700 w-16 shrink-0">{hora(m.t)}</span>
                                        <span className="flex-1 min-w-0 font-bold">{m.motivo}</span>
                                        <span className="font-black tabular-nums">{$(m.monto)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

function FilaCaja({ c, fondo, onVer, onEditar }: { c: CajaDia; fondo: string; onVer?: (s: any) => void; onEditar?: (s: any) => void }) {
    const ok = c.alertas.length === 0;
    return (
        <div className={cn('px-4 py-3 grid grid-cols-2 md:grid-cols-[1.4fr_1fr_0.8fr_0.9fr_0.9fr_1fr_1.6fr_auto] gap-x-2 gap-y-1 items-center text-sm text-slate-950', fondo)} data-caja={c.nombre}>
            <div className="col-span-2 md:col-span-1 flex items-center gap-2 min-w-0">
                <Store className="w-4 h-4 text-slate-700 shrink-0" />
                <div className="min-w-0">
                    <p className="font-black uppercase truncate text-slate-950">{c.nombre}</p>
                    <p className="text-xs font-bold text-slate-700 truncate">{c.responsable}</p>
                </div>
            </div>
            <span className="font-bold text-slate-900"><span className="md:hidden text-slate-600 font-bold">Horario: </span>{hora(c.abre)} – {c.cierra ? hora(c.cierra) : 'abierta'}</span>
            <span className="font-bold text-slate-800"><span className="md:hidden text-slate-600">Duró: </span>{dur(c.minutos)}</span>
            <span className="md:text-right tabular-nums font-black text-slate-950"><span className="md:hidden text-slate-600 font-bold">Base: </span>{$(c.base)}</span>
            <span className="md:text-right tabular-nums font-black text-slate-950"><span className="md:hidden text-slate-600 font-bold">Cierre: </span>{c.estado === 'abierta' ? 'abierta' : $(c.cierre)}</span>
            <span className="md:text-right tabular-nums font-black text-slate-950"><span className="md:hidden text-slate-600 font-bold">Entregado: </span>{c.entregas.length > 1 ? c.entregas.map(e => $(e.monto)).join(' + ') : $(c.entregado)}</span>
            <div className="col-span-2 md:col-span-1 flex flex-wrap gap-1">
                {c.estado === 'abierta' && <span className="px-2 py-0.5 rounded-lg bg-emerald-200 text-emerald-950 font-black text-[11px]">Abierta</span>}
                {ok && c.estado === 'cerrada' && <span className="px-2 py-0.5 rounded-lg bg-slate-200 text-slate-900 font-black text-[11px] flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Cerrada</span>}
                {c.alertas.map(a => <span key={a} className="px-2 py-0.5 rounded-lg bg-rose-200 text-rose-950 font-black text-[11px] flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {a}</span>)}
            </div>
            <div className="col-span-2 md:col-span-1 flex gap-1 md:justify-end">
                {onVer && <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] font-black text-indigo-800 rounded-lg" onClick={() => onVer(c.sesion)}><Eye className="w-3.5 h-3.5 mr-1" /> Ver</Button>}
                {onEditar && <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] font-black text-amber-800 rounded-lg" onClick={() => onEditar(c.sesion)}><Pencil className="w-3.5 h-3.5 mr-1" /> Editar</Button>}
            </div>
        </div>
    );
}

function Tile({ titulo, valor, sub, alerta }: { titulo: string; valor: string; sub: string; alerta?: boolean }) {
    return (
        <div className={cn('rounded-2xl border-2 bg-white p-3', alerta ? 'border-rose-400' : 'border-slate-300')}>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">{titulo}</p>
            <p className={cn('text-xl font-black mt-0.5 tabular-nums text-slate-950', alerta && 'text-rose-700')}>{valor}</p>
            <p className="text-[11px] font-bold text-slate-700">{sub}</p>
        </div>
    );
}

export default HistorialCajasDia;
