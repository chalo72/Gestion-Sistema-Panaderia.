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
import { useState } from 'react';
import { Plus } from 'lucide-react';
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
                onClick={handleAddVentaDiaria}
                size="sm"
                className="w-full rounded-xl text-white font-black text-xs h-10 shadow-lg bg-indigo-600 hover:bg-indigo-700"
            >
                <Plus className="w-4 h-4 mr-1" /> Registrar cierre del día
            </Button>
        </div>
    );
}
