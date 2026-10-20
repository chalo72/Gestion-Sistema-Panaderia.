/**
 * Formulario mínimo y aislado de "Venta del Día", pensado para el Modo Ayudante
 * (registro/actualización de fechas atrasadas por alguien que NO debe ver
 * totales ni cifras grandes del negocio).
 *
 * Usa el MISMO hook (useReportesData) y las MISMAS funciones de guardado
 * (addVentaDiaria + sincronización a Bóveda) que la tarjeta "Ventas del Día"
 * de Reportes → Gestión de Control de Datos — no se reimplementa lógica de
 * negocio nueva, solo se muestra un formulario más chico, sin las tarjetas
 * de ingresos/compromisos/saldo de esa pantalla.
 *
 * Creado 2026-09-17 para el "Modo Ayudante" (backfill de ventas atrasadas).
 */
import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { getVentasDiarias, fechaLocalHoy } from '@/lib/finanzas-personales';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useReportesData, type ReportesProps } from '@/hooks/useReportesData';
import { CAJAS_POS_DEFAULT } from '@/lib/boveda-pos-sync';

type Props = Pick<
    ReportesProps,
    'ventas' | 'gastos' | 'formatCurrency' | 'generarReporte' | 'productos' | 'categorias' | 'proveedores'
>;

const CAJAS_BASE: readonly string[] = CAJAS_POS_DEFAULT;

// 🩹 2026-10-09: control de días repetidos al poner al día los cierres atrasados
const DIAS_A_REVISAR = 30;
const sumarDias = (fecha: string, n: number): string => {
    const [y, m, d] = fecha.split('-').map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    dt.setDate(dt.getDate() + n);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};
/** Mismo cálculo de total que addVentaDiaria (las salidas restan) */
const totalDelFormulario = (f: any): number => {
    const nq = Number(f.totalNequi) || 0;
    const tr = Number(f.totalTransferencia) || 0;
    const cr = Number(f.totalCredito) || 0;
    const cajas = f.cajas && typeof f.cajas === 'object' ? f.cajas : null;
    if (cajas && Object.keys(cajas).length > 0) {
        const sumCajas = Object.entries(cajas).reduce(
            (s: number, [k, v]) => (k === 'Gastos/Salidas' ? s - (Number(v) || 0) : s + (Number(v) || 0)),
            0
        );
        return sumCajas + nq + tr + cr;
    }
    return (Number(f.totalEfectivo) || 0) + nq + tr + cr;
};
const fmtPesos = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

const formatearMiles = (valor: unknown): string => {
    const soloDigitos = String(valor ?? '').replace(/[^0-9]/g, '');
    return soloDigitos ? soloDigitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
};

/**
 * Formulario de Venta del Día — versión reducida para el Modo Ayudante.
 * Todo lo que "cajas" añade dinámicamente al estado no está en el tipo
 * original de `formVenta` (viene de useReportesData), así que se usa un
 * setter "casteado" — mismo truco que ya usa DiagnosticoFinanciero.tsx.
 */
export function VentaDiariaRapidaForm(props: Props) {
    const { formVenta, setFormVenta, handleAddVentaDiaria } = useReportesData(props);
    const setFormVentaLibre = setFormVenta as unknown as (updater: (prev: any) => any) => void;

    const [cajaExtraNombre, setCajaExtraNombre] = useState('');

    // 🩹 2026-10-09: ¿qué días ya tienen cierre? (para no repetir días)
    const cierres = getVentasDiarias();
    const fechasConCierre = new Set(cierres.map((v) => (v.fecha || '').slice(0, 10)));
    const hoy = fechaLocalHoy();
    const ultimosDias = Array.from({ length: DIAS_A_REVISAR }, (_, i) => sumarDias(hoy, -(DIAS_A_REVISAR - 1) + i));
    const diasFaltantes = ultimosDias.filter((d) => !fechasConCierre.has(d));
    const cierresDelDia = cierres.filter((v) => (v.fecha || '').slice(0, 10) === formVenta.fecha);
    const irAlSiguienteDiaFaltante = (desde?: string) => {
        const base = desde || formVenta.fecha;
        const siguiente = diasFaltantes.find((d) => d > base) || diasFaltantes[0];
        if (!siguiente) {
            toast.success(`¡Listo! Los últimos ${DIAS_A_REVISAR} días ya tienen cierre.`);
            return;
        }
        setFormVenta((p) => ({ ...p, fecha: siguiente }));
        toast.info(`Pasando al ${siguiente}`);
    };

    // Reemplazar un cierre existente: se pone su id y se guarda en el siguiente render
    // (así cuenta como EDICIÓN y no se suma dos veces a la Bóveda).
    const [reemplazarId, setReemplazarId] = useState<string | null>(null);
    useEffect(() => {
        if (reemplazarId && formVenta.id === reemplazarId) {
            setReemplazarId(null);
            handleAddVentaDiaria();
        }
    }, [reemplazarId, formVenta.id, handleAddVentaDiaria]);

    const registrarSinRepetir = () => {
        const turno = formVenta.turno || 'Día Completo';
        const total = totalDelFormulario(formVenta);
        if (total <= 0) {
            handleAddVentaDiaria(); // muestra su propio aviso de "ingresa un monto"
            return;
        }
        const mismoTurno = cierresDelDia.find((v) => (v.turno || 'Día Completo') === turno);
        if (mismoTurno) {
            if (Math.round(mismoTurno.total) === Math.round(total)) {
                toast.info(`El ${formVenta.fecha} (${turno}) ya está registrado igual: ${fmtPesos(total)}. No se guardó otra vez.`, { duration: 5000 });
                irAlSiguienteDiaFaltante();
                return;
            }
            const ok = window.confirm(
                `El ${formVenta.fecha} (${turno}) YA tiene un cierre por ${fmtPesos(mismoTurno.total)}.\n` +
                `Lo que escribiste suma ${fmtPesos(total)}.\n\n` +
                `¿Quieres REEMPLAZAR el anterior por este?\n(Cancelar = no se guarda nada)`
            );
            if (!ok) return;
            setReemplazarId(mismoTurno.id);
            setFormVentaLibre((prev) => ({ ...prev, id: mismoTurno.id }));
            return;
        }
        if (cierresDelDia.length > 0) {
            const lista = cierresDelDia.map((v) => `• ${v.turno || 'Día Completo'}: ${fmtPesos(v.total)}`).join('\n');
            const ok = window.confirm(
                `El ${formVenta.fecha} ya tiene cierre:\n${lista}\n\n` +
                `¿Agregar además este de "${turno}" por ${fmtPesos(total)}?`
            );
            if (!ok) return;
        }
        handleAddVentaDiaria();
    };
    const cajasGuardadas: Record<string, number> = (formVenta as any).cajas || {};
    const cajasExtra = Object.keys(cajasGuardadas).filter(
        (k) => !CAJAS_BASE.includes(k) && k !== 'Gastos/Salidas'
    );

    const setMontoCaja = (caja: string, raw: string) => {
        const val = parseInt(raw.replace(/[^0-9]/g, ''), 10) || 0;
        setFormVentaLibre((prev) => ({
            ...prev,
            ...(caja === 'Principal' ? { totalEfectivo: String(val) } : {}),
            cajas: { ...(prev.cajas || {}), [caja]: val },
        }));
    };

    const quitarCajaExtra = (caja: string) => {
        setFormVentaLibre((prev) => {
            const copia = { ...(prev.cajas || {}) };
            delete copia[caja];
            return { ...prev, cajas: copia };
        });
    };

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Fecha</Label>
                    <Input
                        type="date"
                        value={formVenta.fecha}
                        onChange={(e) => setFormVenta((p) => ({ ...p, fecha: e.target.value }))}
                        className="h-10 text-sm rounded-xl mt-1"
                    />
                </div>
                <div>
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Turno</Label>
                    <select
                        value={formVenta.turno}
                        onChange={(e) => setFormVenta((p) => ({ ...p, turno: e.target.value as typeof p.turno }))}
                        className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors mt-1"
                    >
                        <option value="Día Completo">Día Completo</option>
                        <option value="Mañana">Mañana</option>
                        <option value="Tarde-Noche">Tarde-Noche</option>
                    </select>
                </div>
            </div>

            {/* 🩹 2026-10-09: ¿este día ya está registrado? */}
            {cierresDelDia.length > 0 ? (
                <div className="rounded-xl border-2 border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 p-2.5 space-y-1">
                    <p className="text-xs font-black text-emerald-800 dark:text-emerald-200">
                        ✅ El {formVenta.fecha} ya está registrado
                    </p>
                    {cierresDelDia.map((v) => (
                        <p key={v.id} className="text-xs font-bold text-emerald-900 dark:text-emerald-100">
                            {v.turno || 'Día Completo'}: {fmtPesos(v.total)}
                        </p>
                    ))}
                    <button
                        type="button"
                        onClick={() => irAlSiguienteDiaFaltante()}
                        className="w-full mt-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black"
                    >
                        Pasar al siguiente día que falta →
                    </button>
                </div>
            ) : (
                <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2 text-xs font-bold text-amber-800 dark:text-amber-200">
                    ⬜ El {formVenta.fecha} todavía no tiene cierre. Puedes registrarlo.
                </div>
            )}

            {/* Últimos días: verde = ya registrado, rojo = falta. Toca uno para ir a ese día. */}
            <div>
                <Label className="text-[10px] font-black uppercase text-muted-foreground">
                    Últimos {DIAS_A_REVISAR} días — faltan {diasFaltantes.length}
                </Label>
                <div className="flex flex-wrap gap-1 mt-1">
                    {ultimosDias.map((d) => {
                        const tiene = fechasConCierre.has(d);
                        const elegido = d === formVenta.fecha;
                        return (
                            <button
                                key={d}
                                type="button"
                                onClick={() => setFormVenta((p) => ({ ...p, fecha: d }))}
                                title={tiene ? `${d}: ya registrado` : `${d}: falta`}
                                className={
                                    'w-9 h-9 rounded-lg text-[11px] font-black tabular-nums border-2 ' +
                                    (tiene
                                        ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 border-emerald-300'
                                        : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-300') +
                                    (elegido ? ' ring-2 ring-indigo-500' : '')
                                }
                            >
                                {Number(d.slice(8, 10))}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="space-y-2 border-t border-b border-white/5 py-2">
                <Label className="text-[10px] font-black uppercase text-amber-500">Efectivo por Cajas</Label>
                <div className="grid grid-cols-2 gap-2">
                    {CAJAS_BASE.map((caja) => (
                        <div key={caja}>
                            <Label className="text-[9px] font-bold text-muted-foreground">{caja}</Label>
                            <Input
                                placeholder="Ej: 50.000"
                                type="text"
                                inputMode="numeric"
                                value={formatearMiles(
                                    cajasGuardadas[caja] ?? (caja === 'Principal' ? formVenta.totalEfectivo : '')
                                )}
                                onChange={(e) => setMontoCaja(caja, e.target.value)}
                                className="h-9 text-sm rounded-xl mt-0.5"
                            />
                        </div>
                    ))}
                    <div>
                        <Label className="text-[9px] font-bold text-muted-foreground">Gastos/Salidas</Label>
                        <Input
                            placeholder="Ej: 10.000"
                            type="text"
                            inputMode="numeric"
                            value={formatearMiles(cajasGuardadas['Gastos/Salidas'])}
                            onChange={(e) => setMontoCaja('Gastos/Salidas', e.target.value)}
                            className="h-9 text-sm rounded-xl mt-0.5"
                        />
                    </div>
                </div>

                {cajasExtra.map((key) => (
                    <div key={key} className="grid grid-cols-2 gap-2 mt-1">
                        <div className="col-span-2">
                            <div className="flex items-center justify-between mb-0.5">
                                <Label className="text-[9px] font-bold text-muted-foreground">{key}</Label>
                                <button
                                    type="button"
                                    onClick={() => quitarCajaExtra(key)}
                                    className="text-[9px] text-rose-400 hover:text-rose-600 font-black transition-colors"
                                >
                                    ✕ quitar
                                </button>
                            </div>
                            <Input
                                type="text"
                                inputMode="numeric"
                                value={formatearMiles(cajasGuardadas[key])}
                                onChange={(e) => setMontoCaja(key, e.target.value)}
                                className="h-9 text-sm rounded-xl mt-0.5"
                            />
                        </div>
                    </div>
                ))}

                <div className="flex gap-1.5 mt-2">
                    <Input
                        value={cajaExtraNombre}
                        onChange={(e) => setCajaExtraNombre(e.target.value)}
                        placeholder="Nombre nueva caja (opcional)"
                        className="h-8 text-xs rounded-xl"
                    />
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-xl px-2 text-xs font-black uppercase"
                        onClick={() => {
                            const name = cajaExtraNombre.trim();
                            if (name && !CAJAS_BASE.includes(name) && name !== 'Gastos/Salidas') {
                                setFormVentaLibre((prev) => ({ ...prev, cajas: { ...(prev.cajas || {}), [name]: 0 } }));
                                setCajaExtraNombre('');
                            }
                        }}
                    >
                        + Caja
                    </Button>
                </div>
            </div>

            <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-indigo-500">Otros Medios de Pago</Label>
                <div className="grid grid-cols-3 gap-2">
                    <Input
                        placeholder="Nequi ($)"
                        type="number"
                        value={formVenta.totalNequi}
                        onChange={(e) => setFormVenta((p) => ({ ...p, totalNequi: e.target.value }))}
                        className="h-9 text-sm rounded-xl"
                    />
                    <Input
                        placeholder="Transf. ($)"
                        type="number"
                        value={formVenta.totalTransferencia}
                        onChange={(e) => setFormVenta((p) => ({ ...p, totalTransferencia: e.target.value }))}
                        className="h-9 text-sm rounded-xl"
                    />
                    <Input
                        placeholder="Crédito ($)"
                        type="number"
                        value={formVenta.totalCredito}
                        onChange={(e) => setFormVenta((p) => ({ ...p, totalCredito: e.target.value }))}
                        className="h-9 text-sm rounded-xl"
                    />
                </div>
            </div>

            <Input
                placeholder="Notas (opcional)"
                value={formVenta.notas}
                onChange={(e) => setFormVenta((p) => ({ ...p, notas: e.target.value }))}
                className="h-9 text-sm rounded-xl"
            />

            <Button
                onClick={registrarSinRepetir}
                size="sm"
                className="w-full rounded-xl text-white font-black text-xs h-10 shadow-lg bg-indigo-600 hover:bg-indigo-700"
            >
                <Plus className="w-4 h-4 mr-1" /> Registrar cierre del día
            </Button>

            {/* Historial al instante de ventas guardadas */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">
                        Historial de Cierres ({props.ventas?.length ? 'Guardados' : 'Registros'})
                    </Label>
                    <span className="text-[9px] font-bold text-slate-400">Actualizado al instante</span>
                </div>
                {(() => {
                    const localVentas = (() => {
                        try {
                            const raw = localStorage.getItem('dp_ventas_diarias');
                            return raw ? JSON.parse(raw) : [];
                        } catch {
                            return [];
                        }
                    })();

                    if (localVentas.length === 0) {
                        return (
                            <p className="text-[11px] text-slate-400 text-center py-2 italic bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                                No hay cierres registrados aún
                            </p>
                        );
                    }

                    const ultimas = [...localVentas].sort((a: any, b: any) => (b.fecha || '').localeCompare(a.fecha || '')).slice(0, 5);

                    return (
                        <div className="space-y-1.5">
                            {ultimas.map((vd: any, idx: number) => {
                                const totalEf = Object.values(vd.cajas || {}).reduce((s: number, v: any) => s + (Number(v) || 0), 0) + (Number(vd.totalEfectivo) || 0);
                                const totalOtros = (Number(vd.totalNequi) || 0) + (Number(vd.totalTransferencia) || 0) + (Number(vd.totalCredito) || 0);
                                const granTotal = totalEf + totalOtros;

                                return (
                                    <div
                                        key={vd.id || idx}
                                        className="flex items-center justify-between bg-slate-50 dark:bg-white/5 p-2.5 rounded-xl border border-slate-200/70 dark:border-white/5 text-xs"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-black text-slate-800 dark:text-slate-200 text-xs">
                                                    📅 {vd.fecha}
                                                </span>
                                                <span className="text-[9px] font-bold px-1.5 py-0.2 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-md">
                                                    {vd.turno || 'Día Completo'}
                                                </span>
                                            </div>
                                            {vd.notas && (
                                                <p className="text-[10px] text-slate-400 truncate max-w-[200px] mt-0.5">
                                                    {vd.notas}
                                                </p>
                                            )}
                                        </div>
                                        <div className="text-right shrink-0">
                                            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                                                {props.formatCurrency(granTotal)}
                                            </span>
                                            {totalOtros > 0 && (
                                                <p className="text-[9px] text-slate-400">
                                                    Ef: {props.formatCurrency(totalEf)} · Dig: {props.formatCurrency(totalOtros)}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })()}
            </div>
        </div>
    );
}
