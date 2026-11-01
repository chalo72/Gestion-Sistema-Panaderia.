import { useEffect, useState, type ReactNode } from 'react';
import { Package, Percent, Truck, Store, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Producto } from '@/types';

/**
 * Pan de empaque para venta al por mayor.
 * Todo se calcula con lo que el dueño escribe: precio de venta en panadería, % de rebaja
 * a la tienda y % del repartidor. El costo SOLO viene de Producción (nunca se inventa):
 * si todavía no hay costo, la ganancia de la panadería queda "pendiente".
 */

export type FuenteCosto = 'produccion' | 'proveedor' | 'catalogo' | 'estimado';

export interface CalculoMayoreo {
    precioTienda: number;      // lo que paga la tienda por paquete
    comision: number;          // lo que se gana el repartidor por paquete
    recibePanaderia: number;   // precio tienda - comisión
    ganancia: number | null;   // recibe - costo (null = sin costo real todavía)
    gananciaTienda: number;    // si la tienda lo revende al mismo precio que la panadería
}

export function calcularMayoreo(args: {
    precioDetal: number; descuentoPct: number; comisionPct: number; costo: number; costoReal: boolean;
}): CalculoMayoreo {
    const detal = Math.max(0, args.precioDetal || 0);
    const desc = Math.min(100, Math.max(0, args.descuentoPct || 0));
    const com = Math.min(100, Math.max(0, args.comisionPct || 0));
    const precioTienda = Math.round(detal * (1 - desc / 100));
    const comision = Math.round(precioTienda * com / 100);
    const recibePanaderia = precioTienda - comision;
    const ganancia = args.costoReal && args.costo > 0 ? Math.round(recibePanaderia - args.costo) : null;
    return { precioTienda, comision, recibePanaderia, ganancia, gananciaTienda: detal - precioTienda };
}

export const ETIQUETA_FUENTE: Record<FuenteCosto, string> = {
    produccion: 'Costo de Producción',
    proveedor: 'Costo del proveedor',
    catalogo: 'Costo del catálogo',
    estimado: 'Sin costo real todavía',
};

interface Props {
    abierto: boolean;
    producto?: Producto | null;                 // si viene, se edita; si no, se crea
    costo?: { valor: number; fuente: FuenteCosto } | null;
    categorias: string[];
    formatCurrency: (n: number) => string;
    onCerrar: () => void;
    onGuardar: (datos: {
        nombre: string; categoria: string; unidadesPaquete: number;
        precioVenta: number; descuentoMayorista: number; comisionRepartidor: number;
    }) => Promise<boolean>;
}

const num = (v: string) => {
    const n = parseFloat(String(v).replace(/\./g, '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
};

export default function PanEmpaqueModal({ abierto, producto, costo, categorias, formatCurrency, onCerrar, onGuardar }: Props) {
    const [nombre, setNombre] = useState('');
    const [categoria, setCategoria] = useState('Pan de empaque');
    const [unidades, setUnidades] = useState('1');
    const [precioDetal, setPrecioDetal] = useState('');
    const [descuento, setDescuento] = useState('20');
    const [comision, setComision] = useState('0');
    const [precioTiendaManual, setPrecioTiendaManual] = useState('');
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        if (!abierto) return;
        setNombre(producto?.nombre ?? '');
        setCategoria(producto?.categoria || 'Pan de empaque');
        setUnidades(String(producto?.unidadesPaquete ?? 1));
        setPrecioDetal(producto?.precioVenta ? String(producto.precioVenta) : '');
        setDescuento(String(producto?.descuentoMayorista ?? 20));
        setComision(String(producto?.comisionRepartidor ?? 0));
        setPrecioTiendaManual('');
    }, [abierto, producto]);

    const costoReal = !!costo && costo.fuente !== 'estimado' && costo.valor > 0;
    const calc = calcularMayoreo({
        precioDetal: num(precioDetal), descuentoPct: num(descuento), comisionPct: num(comision),
        costo: costo?.valor ?? 0, costoReal,
    });

    // Si escribe el precio a la tienda, se saca el % solo
    const cambiarPrecioTienda = (v: string) => {
        setPrecioTiendaManual(v);
        const detal = num(precioDetal);
        const p = num(v);
        if (detal > 0 && p > 0 && p <= detal) setDescuento(String(Math.round((1 - p / detal) * 10000) / 100));
    };

    const puedeGuardar = nombre.trim().length > 1 && num(precioDetal) > 0 && !guardando;

    const guardar = async () => {
        if (!puedeGuardar) return;
        setGuardando(true);
        const ok = await onGuardar({
            nombre: nombre.trim(),
            categoria: categoria.trim() || 'Pan de empaque',
            unidadesPaquete: Math.max(1, Math.round(num(unidades))),
            precioVenta: num(precioDetal),
            descuentoMayorista: Math.min(100, Math.max(0, num(descuento))),
            comisionRepartidor: Math.min(100, Math.max(0, num(comision))),
        });
        setGuardando(false);
        if (ok) onCerrar();
    };

    const campo = 'h-11 rounded-xl border-slate-300 bg-white dark:bg-slate-900 text-sm font-bold !text-slate-900 dark:!text-slate-100';
    const etiqueta = 'text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 mb-1 block';

    return (
        <Dialog open={abierto} onOpenChange={v => { if (!v) onCerrar(); }}>
            <DialogContent className="max-w-lg rounded-3xl max-h-[92vh] overflow-y-auto bg-white dark:bg-slate-950 !text-slate-900 dark:!text-slate-100">
                <DialogHeader>
                    <DialogTitle className="font-black uppercase tracking-tight flex items-center gap-2 !text-slate-950 dark:!text-white">
                        <Package className="w-5 h-5 text-indigo-600" />
                        {producto ? 'Editar pan de empaque / mayoreo' : 'Nuevo pan de empaque'}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-3">
                    <div>
                        <label className={etiqueta}>Nombre del pan</label>
                        <Input className={campo} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Pan tajado x10" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className={etiqueta}>Categoría</label>
                            <Input className={campo} list="cats-empaque" value={categoria} onChange={e => setCategoria(e.target.value)} />
                            <datalist id="cats-empaque">{categorias.map(c => <option key={c} value={c} />)}</datalist>
                        </div>
                        <div>
                            <label className={etiqueta}>Unidades por paquete</label>
                            <Input className={campo} inputMode="numeric" value={unidades} onChange={e => setUnidades(e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <label className={etiqueta}>Precio de venta aquí en la panadería (por paquete)</label>
                        <Input className={campo} inputMode="numeric" value={precioDetal} onChange={e => { setPrecioDetal(e.target.value); setPrecioTiendaManual(''); }} placeholder="Ej: 5000" />
                    </div>

                    <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900 p-3 space-y-2">
                        <label className={etiqueta}><Percent className="w-3 h-3 inline mr-1" />Rebaja para la tienda: {num(descuento)}%</label>
                        <input type="range" min={0} max={60} step={1} value={num(descuento)} onChange={e => { setDescuento(e.target.value); setPrecioTiendaManual(''); }} className="w-full accent-indigo-600" />
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className={etiqueta}>% exacto</label>
                                <Input className={campo} inputMode="decimal" value={descuento} onChange={e => { setDescuento(e.target.value); setPrecioTiendaManual(''); }} />
                            </div>
                            <div>
                                <label className={etiqueta}>o precio a la tienda</label>
                                <Input className={campo} inputMode="numeric" value={precioTiendaManual} onChange={e => cambiarPrecioTienda(e.target.value)} placeholder={String(calc.precioTienda || '')} />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-amber-200 dark:border-amber-900 p-3 space-y-2">
                        <label className={etiqueta}><Truck className="w-3 h-3 inline mr-1" />Comisión del repartidor: {num(comision)}% del precio a la tienda</label>
                        <input type="range" min={0} max={30} step={1} value={num(comision)} onChange={e => setComision(e.target.value)} className="w-full accent-amber-600" />
                        <Input className={campo} inputMode="decimal" value={comision} onChange={e => setComision(e.target.value)} />
                    </div>

                    {/* Resultado */}
                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-900 p-3 space-y-1.5 text-sm">
                        <Fila t="La tienda le paga (por paquete)" v={formatCurrency(calc.precioTienda)} fuerte />
                        <Fila t="Para el repartidor" v={`− ${formatCurrency(calc.comision)}`} />
                        <Fila t="Le llega a la panadería" v={formatCurrency(calc.recibePanaderia)} />
                        <Fila
                            t={costo ? ETIQUETA_FUENTE[costo.fuente] : 'Costo'}
                            v={costoReal ? `− ${formatCurrency(costo!.valor)}` : 'Pendiente'}
                        />
                        <div className={`flex justify-between items-center rounded-xl px-2 py-2 font-black ${calc.ganancia === null ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' : calc.ganancia > 0 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'}`}>
                            <span className="flex items-center gap-1">
                                {calc.ganancia === null ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                                Le queda a la panadería
                            </span>
                            <span className="tabular-nums">{calc.ganancia === null ? 'Pendiente' : formatCurrency(calc.ganancia)}</span>
                        </div>
                        {calc.ganancia === null && (
                            <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                                Todavía no hay costo real. Registre este pan en Producción → Modelos de pan (enlazado a este producto) y la ganancia se calcula sola.
                            </p>
                        )}
                        <Fila t={<span className="flex items-center gap-1"><Store className="w-3 h-3" />La tienda gana si lo vende a su mismo precio</span>} v={formatCurrency(calc.gananciaTienda)} />
                    </div>

                    <div className="flex gap-2 pt-1">
                        <Button variant="outline" className="flex-1 h-11 rounded-xl font-black uppercase text-xs" onClick={onCerrar}>Cancelar</Button>
                        <Button disabled={!puedeGuardar} className="flex-1 h-11 rounded-xl font-black uppercase text-xs bg-indigo-600 hover:bg-indigo-700 text-white" onClick={guardar}>
                            {guardando ? 'Guardando…' : 'Guardar'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function Fila({ t, v, fuerte }: { t: ReactNode; v: string; fuerte?: boolean }) {
    return (
        <div className={`flex justify-between items-center gap-2 ${fuerte ? 'font-black' : 'font-bold text-slate-700 dark:text-slate-300'}`}>
            <span>{t}</span>
            <span className="tabular-nums shrink-0">{v}</span>
        </div>
    );
}
