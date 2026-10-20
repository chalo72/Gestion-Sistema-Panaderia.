import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Truck, MapPin, Store, Users, Plus, Trash2, ArrowUp, ArrowDown, Clock, ChevronDown, ChevronUp,
    AlertTriangle, CheckCircle2, Package, TrendingUp, TrendingDown, Minus, Navigation, Lightbulb,
    PlayCircle, ClipboardCheck, Banknote, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { db } from '@/lib/database';
import { dbNube } from '@/lib/nube-kv';
import { generateUUID } from '@/lib/safe-utils';
import type { Cliente } from '@/types';
import {
    analizarTiendas, analizarVendedores, resumenDespacho, sugerirCargaTienda, enlaceRutaMaps,
    sincronizarLineasConCarga, nuevoParada, netoParada, creditoParada, fechaLocal, horaLocal,
    cargarDesdeNube, guardarDespachos, guardarRutas, NOMBRES_DIA,
    TOPE_DEVOLUCION_PCT, infraccionesTopeDevolucion, mensajeTopeDevolucion, unidadesParada,
    type CatalogoLinea, type ConfigMargenes, type Despacho, type LineaCarga, type MetodoCobro,
    type MotivoRecogida, type RutaReparto, type ZonaRuta, type AnalisisTienda,
} from '@/lib/rutas-reparto';

interface Props {
    catalogo: CatalogoLinea[];
    clientes: Cliente[];
    config: ConfigMargenes;
    creditosClientes?: any[];
    addCreditoCliente?: (c: any) => Promise<void>;
    updateCliente: (id: string, updates: any) => Promise<void>;
    formatCurrency: (v: number) => string;
    usuarioId: string;
}

type Seccion = 'despachos' | 'rutas' | 'tiendas' | 'vendedores';

const ZONAS: { id: ZonaRuta; label: string }[] = [
    { id: 'ciudad', label: 'Ciudad' },
    { id: 'municipio', label: 'Municipio' },
    { id: 'corregimiento', label: 'Corregimiento' },
];

const MOTIVOS: { id: MotivoRecogida; label: string }[] = [
    { id: 'sobrante', label: 'Sobrante (vuelve al stock)' },
    { id: 'cambio', label: 'Cambio (se repone)' },
    { id: 'danado', label: 'Dañado / vencido' },
];

const num = (v: string): number => {
    const x = parseFloat(v);
    return Number.isFinite(x) && x > 0 ? x : 0;
};

const SEMAFORO: Record<AnalisisTienda['semaforo'], { label: string; cls: string }> = {
    verde: { label: 'Sana', cls: 'bg-emerald-100 text-emerald-700' },
    amarillo: { label: 'Vigilar', cls: 'bg-amber-100 text-amber-700' },
    rojo: { label: 'Atender', cls: 'bg-rose-100 text-rose-700' },
};

const ESTADO_LABEL: Record<Despacho['estado'], { label: string; cls: string }> = {
    cargado: { label: 'Cargado', cls: 'bg-slate-100 text-slate-700' },
    en_ruta: { label: 'En ruta', cls: 'bg-indigo-100 text-indigo-700' },
    liquidado: { label: 'Liquidado', cls: 'bg-emerald-100 text-emerald-700' },
};

const inputCls = 'h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-400';

/** Controles del modal Nuevo despacho: el body global usa color #f1f5f9 y deja selects/placeholders ilegibles. */
const ndFieldCls =
    'h-9 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 text-sm font-bold !text-slate-900 dark:!text-slate-100 outline-none focus:border-indigo-500 placeholder:!text-slate-500 dark:placeholder:!text-slate-400 [color-scheme:light] dark:[color-scheme:dark]';
const ndOptionCls = 'bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100';
const ndLabelCls = 'block text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 mb-1';

export default function RutasReparto({
    catalogo, clientes, config, creditosClientes, addCreditoCliente, updateCliente, formatCurrency, usuarioId,
}: Props) {
    const [seccion, setSeccion] = useState<Seccion>('despachos');
    const [rutas, setRutas] = useState<RutaReparto[]>([]);
    const [despachos, setDespachos] = useState<Despacho[]>([]);
    const [trabajadores, setTrabajadores] = useState<string[]>([]);
    const [cargado, setCargado] = useState(false);

    const [editandoRuta, setEditandoRuta] = useState<RutaReparto | null>(null);
    const [nuevoDespacho, setNuevoDespacho] = useState(false);
    const [detalleId, setDetalleId] = useState<string | null>(null);

    useEffect(() => {
        let vivo = true;
        cargarDesdeNube(dbNube).then(r => {
            if (!vivo) return;
            setRutas(r.rutas);
            setDespachos(r.despachos);
            setCargado(true);
        }).catch(() => setCargado(true));
        db.getAllTrabajadores().then((lista: any[]) => {
            if (!vivo) return;
            setTrabajadores(lista.filter(t => t.estado === 'activo').map(t => t.nombre).filter(Boolean));
        }).catch(() => {});
        return () => { vivo = false; };
    }, []);

    const clientesRef = useMemo(() => clientes.map(c => ({
        id: c.id, nombre: c.nombre, margenPersonalizado: c.margenPersonalizado,
        direccion: c.direccion, ciudad: c.ciudad, telefono: c.telefono,
    })), [clientes]);

    const deudas = useMemo(() => {
        const m: Record<string, number> = {};
        for (const c of creditosClientes || []) {
            if (c.estado === 'pagado' || !c.clienteId) continue;
            m[c.clienteId] = (m[c.clienteId] || 0) + (Number(c.saldo) || 0);
        }
        return m;
    }, [creditosClientes]);

    const analisis = useMemo(
        () => analizarTiendas(despachos, clientesRef, { config, deudas }),
        [despachos, clientesRef, config, deudas],
    );
    const vendedores = useMemo(() => analizarVendedores(despachos), [despachos]);

    // ── persistencia ─────────────────────────────────────────────────────────
    const guardarListaRutas = (lista: RutaReparto[]) => { setRutas(lista); guardarRutas(dbNube, lista); };
    const despachosRef = useRef<Despacho[]>([]);
    despachosRef.current = despachos;
    const guardarListaDespachos = (lista: Despacho[]) => { despachosRef.current = lista; setDespachos(lista); guardarDespachos(dbNube, lista); };

    const guardarDespacho = (d: Despacho): Despacho => {
        const nuevo = { ...d, actualizadoEn: Date.now() };
        const actuales = despachosRef.current;
        const existe = actuales.some(x => x.id === d.id);
        guardarListaDespachos(existe ? actuales.map(x => (x.id === d.id ? nuevo : x)) : [nuevo, ...actuales]);
        return nuevo;
    };

    // ── acciones del flujo ───────────────────────────────────────────────────
    const salirARuta = async (d: Despacho): Promise<Despacho> => {
        if (d.carga.length === 0) { toast.error('Primero carga el pan que se lleva.'); return d; }
        let actual = { ...d };
        if (!actual.stockSalidaAplicado) {
            try {
                await db.batchAjustarStock(actual.carga.filter(c => c.cantidad > 0).map(c => ({
                    productoId: c.productoId,
                    cantidad: c.cantidad,
                    tipo: 'salida',
                    motivo: `Despacho ruta: ${actual.rutaNombre} · ${actual.vendedor} · ${actual.fecha}`,
                })));
                actual.stockSalidaAplicado = true;
            } catch (e) {
                console.warn('[Rutas] no se pudo descontar inventario', e);
                toast.warning('Salió a ruta, pero no se pudo descontar el inventario. Revísalo en Inventario.');
            }
        }
        actual = { ...actual, estado: 'en_ruta', horaSalida: actual.horaSalida || horaLocal() };
        const guardado = guardarDespacho(sincronizarLineasConCarga(actual));
        toast.success('Despacho en ruta. Inventario descontado.');
        return guardado;
    };

    const liquidar = async (d: Despacho): Promise<Despacho> => {
        let actual = { ...d };
        const excesoDev = infraccionesTopeDevolucion(actual);
        const msgTope = mensajeTopeDevolucion(excesoDev);
        if (msgTope) {
            toast.error(msgTope);
            return d;
        }
        const r = resumenDespacho(actual);
        if (!actual.stockRegresoAplicado) {
            const entradas = actual.regreso.filter(x => x.buenos > 0);
            if (entradas.length > 0) {
                try {
                    await db.batchAjustarStock(entradas.map(x => ({
                        productoId: x.productoId,
                        cantidad: x.buenos,
                        tipo: 'entrada',
                        motivo: `Regreso de ruta: ${actual.rutaNombre} · ${actual.vendedor} · ${actual.fecha}`,
                    })));
                    actual.stockRegresoAplicado = true;
                } catch (e) {
                    console.warn('[Rutas] no se pudo reingresar inventario', e);
                    toast.warning('No se pudo devolver el sobrante al inventario. Hazlo a mano en Inventario.');
                }
            } else actual.stockRegresoAplicado = true;
        }
        if (!actual.creditosRegistrados) {
            let ok = true;
            if (addCreditoCliente) {
                for (const p of actual.paradas) {
                    const pend = creditoParada(p);
                    if (!p.visitada || pend <= 0) continue;
                    try {
                        await addCreditoCliente({
                            clienteId: p.clienteId,
                            clienteNombre: p.clienteNombre,
                            monto: pend,
                            saldo: pend,
                            descripcion: `Entrega ruta ${actual.rutaNombre} · ${actual.vendedor}`,
                            fecha: new Date(`${actual.fecha}T12:00:00`).toISOString(),
                            items: p.lineas.filter(l => l.dejado - l.recogido > 0).map(l => ({
                                productoId: l.productoId, nombre: l.nombre, cantidad: l.dejado - l.recogido,
                                precioUnitario: l.precioUnit, subtotal: (l.dejado - l.recogido) * l.precioUnit,
                            })),
                            usuarioId,
                            estado: 'activo',
                            pagos: [],
                        });
                    } catch (e) {
                        ok = false;
                        console.warn('[Rutas] no se pudo crear crédito', e);
                    }
                }
            } else if (r.porCobrarCredito > 0) ok = false;
            actual.creditosRegistrados = ok;
            if (!ok) toast.warning('Algunos saldos no pasaron a Créditos Clientes. Regístralos allí a mano.');
        }
        actual = { ...actual, estado: 'liquidado', horaRegreso: actual.horaRegreso || horaLocal() };
        const guardado = guardarDespacho(actual);
        toast.success(r.porCobrarCredito > 0
            ? `Despacho liquidado. ${formatCurrency(r.porCobrarCredito)} pasaron a Créditos Clientes.`
            : 'Despacho liquidado.');
        return guardado;
    };

    const detalle = despachos.find(d => d.id === detalleId) || null;
    const tabs: { id: Seccion; label: string; icon: any }[] = [
        { id: 'despachos', label: 'Despachos', icon: Truck },
        { id: 'rutas', label: 'Rutas', icon: MapPin },
        { id: 'tiendas', label: 'Tiendas · Análisis', icon: Store },
        { id: 'vendedores', label: 'Vendedores', icon: Users },
    ];

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
                {tabs.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setSeccion(t.id)}
                        className={cn(
                            'flex items-center gap-2 px-4 h-10 rounded-xl text-xs font-black uppercase tracking-widest border transition-all',
                            seccion === t.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700',
                        )}
                    >
                        <t.icon className="w-4 h-4" /> {t.label}
                    </button>
                ))}
            </div>

            {!cargado && <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cargando rutas…</p>}

            {seccion === 'despachos' && (
                <SeccionDespachos
                    despachos={despachos}
                    formatCurrency={formatCurrency}
                    onNuevo={() => setNuevoDespacho(true)}
                    onAbrir={id => setDetalleId(id)}
                    onEliminar={id => {
                        if (!window.confirm('¿Eliminar este despacho? Si ya salió, el inventario NO se devuelve solo.')) return;
                        guardarListaDespachos(despachos.filter(d => d.id !== id));
                    }}
                />
            )}
            {seccion === 'rutas' && (
                <SeccionRutas
                    rutas={rutas}
                    clientes={clientesRef}
                    onNueva={() => setEditandoRuta({ id: generateUUID(), nombre: '', zona: 'ciudad', dias: [], paradas: [], actualizadoEn: Date.now() })}
                    onEditar={setEditandoRuta}
                    onEliminar={id => {
                        if (!window.confirm('¿Eliminar esta ruta?')) return;
                        guardarListaRutas(rutas.filter(r => r.id !== id));
                    }}
                />
            )}
            {seccion === 'tiendas' && (
                <SeccionTiendas
                    analisis={analisis}
                    clientes={clientes}
                    despachos={despachos}
                    formatCurrency={formatCurrency}
                    config={config}
                    onGuardarMargen={async (id, m) => {
                        await updateCliente(id, { margenPersonalizado: m });
                        toast.success(m === undefined ? 'Margen especial quitado' : `Margen de la tienda: ${m}%`);
                    }}
                />
            )}
            {seccion === 'vendedores' && <SeccionVendedores vendedores={vendedores} formatCurrency={formatCurrency} />}

            {editandoRuta && (
                <EditorRuta
                    ruta={editandoRuta}
                    clientes={clientesRef}
                    trabajadores={trabajadores}
                    onCerrar={() => setEditandoRuta(null)}
                    onGuardar={r => {
                        const nueva = { ...r, actualizadoEn: Date.now() };
                        guardarListaRutas(rutas.some(x => x.id === r.id) ? rutas.map(x => (x.id === r.id ? nueva : x)) : [nueva, ...rutas]);
                        setEditandoRuta(null);
                        toast.success('Ruta guardada');
                    }}
                />
            )}

            {nuevoDespacho && (
                <NuevoDespacho
                    rutas={rutas}
                    catalogo={catalogo}
                    trabajadores={trabajadores}
                    despachos={despachos}
                    onCerrar={() => setNuevoDespacho(false)}
                    onCrear={d => {
                        const guardado = guardarDespacho(sincronizarLineasConCarga(d));
                        setNuevoDespacho(false);
                        setDetalleId(guardado.id);
                        toast.success('Despacho creado. Cuando salga el vendedor, pulsa "Salir a ruta".');
                    }}
                />
            )}

            {detalle && (
                <DetalleDespacho
                    key={detalle.id}
                    despacho={detalle}
                    clientes={clientesRef}
                    catalogo={catalogo}
                    formatCurrency={formatCurrency}
                    onGuardar={guardarDespacho}
                    onSalir={salirARuta}
                    onLiquidar={liquidar}
                    onCerrar={() => setDetalleId(null)}
                />
            )}
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// DESPACHOS
// ═════════════════════════════════════════════════════════════════════════════
function SeccionDespachos({ despachos, formatCurrency, onNuevo, onAbrir, onEliminar }: {
    despachos: Despacho[]; formatCurrency: (v: number) => string;
    onNuevo: () => void; onAbrir: (id: string) => void; onEliminar: (id: string) => void;
}) {
    const ordenados = [...despachos].sort((a, b) => (b.fecha + (b.horaSalida || '')).localeCompare(a.fecha + (a.horaSalida || '')));
    const activos = ordenados.filter(d => d.estado !== 'liquidado');
    const hechos = ordenados.filter(d => d.estado === 'liquidado').slice(0, 30);
    const fila = (d: Despacho) => {
        const r = resumenDespacho(d);
        return (
            <Card key={d.id} className="rounded-2xl border-slate-200 dark:border-slate-800">
                <CardContent className="p-4 flex flex-wrap items-center gap-3 justify-between">
                    <button className="text-left flex-1 min-w-[200px]" onClick={() => onAbrir(d.id)}>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-slate-800 dark:text-slate-100">{d.rutaNombre || 'Sin ruta'}</span>
                            <span className={cn('text-[10px] font-black uppercase px-2 py-0.5 rounded-full', ESTADO_LABEL[d.estado].cls)}>{ESTADO_LABEL[d.estado].label}</span>
                        </div>
                        <p className="text-xs text-slate-500 font-bold mt-0.5">
                            {d.fecha} · {d.vendedor || 'Sin vendedor'}{d.horaSalida ? ` · salió ${d.horaSalida}` : ''}
                        </p>
                        <p className="text-[11px] text-slate-400 font-bold mt-1">
                            Cargó {r.totalCargado} · dejó {r.totalDejado} · recogió {r.totalRecogido} · {r.tiendasVisitadas}/{r.tiendasTotal} tiendas
                            {d.estado === 'liquidado' && r.faltanteUnidades > 0 && <span className="text-rose-600"> · faltan {r.faltanteUnidades}</span>}
                        </p>
                    </button>
                    <div className="text-right">
                        <p className="text-sm font-black text-slate-800 dark:text-slate-100">{formatCurrency(r.ventaNeta)}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">venta neta</p>
                    </div>
                    <button onClick={() => onEliminar(d.id)} className="p-2 rounded-lg text-slate-300 hover:text-rose-500" title="Eliminar">
                        <Trash2 className="w-4 h-4" />
                    </button>
                </CardContent>
            </Card>
        );
    };
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm font-bold text-slate-950 dark:text-white max-w-xl">
                    Modo ruta (hoy): cargas el pan una vez en Nuevo despacho; en cada tienda anotas cuánto dejaste y cuánto devolvió.
                    Pedido previo por tienda (preventa) aún no está; la sugerencia por rotación solo ayuda a armar la carga del carro.
                </p>
                <Button onClick={onNuevo} className="h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-xs tracking-widest gap-2">
                    <Plus className="w-4 h-4" /> Nuevo despacho
                </Button>
            </div>
            {activos.length > 0 && <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">En curso</p>}
            {activos.map(fila)}
            {hechos.length > 0 && <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 pt-2">Liquidados</p>}
            {hechos.map(fila)}
            {ordenados.length === 0 && (
                <Card className="rounded-2xl border-dashed"><CardContent className="p-10 text-center text-slate-400">
                    <Truck className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p className="text-xs font-black uppercase tracking-widest">Aún no hay despachos. Crea una ruta y haz el primero.</p>
                </CardContent></Card>
            )}
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// RUTAS
// ═════════════════════════════════════════════════════════════════════════════
function SeccionRutas({ rutas, clientes, onNueva, onEditar, onEliminar }: {
    rutas: RutaReparto[]; clientes: { id: string; nombre: string; direccion?: string; ciudad?: string }[];
    onNueva: () => void; onEditar: (r: RutaReparto) => void; onEliminar: (id: string) => void;
}) {
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-xs text-slate-500 font-bold max-w-xl">
                    Una ruta es el recorrido fijo: qué tiendas, en qué orden, qué días y a qué hora se visita cada una (ciudad, municipio o corregimiento).
                </p>
                <Button onClick={onNueva} className="h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-xs tracking-widest gap-2">
                    <Plus className="w-4 h-4" /> Nueva ruta
                </Button>
            </div>
            {rutas.map(r => {
                const maps = enlaceRutaMaps(r.paradas.map(p => clientes.find(c => c.id === p.clienteId)).filter(Boolean) as any[]);
                return (
                    <Card key={r.id} className="rounded-2xl border-slate-200 dark:border-slate-800">
                        <CardContent className="p-4 space-y-2">
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                                <div>
                                    <p className="font-black text-slate-800 dark:text-slate-100">{r.nombre || 'Sin nombre'}</p>
                                    <p className="text-xs text-slate-500 font-bold">
                                        {ZONAS.find(z => z.id === r.zona)?.label} · {r.dias.length ? r.dias.map(d => NOMBRES_DIA[d]).join(', ') : 'Sin días'}
                                        {r.horaSalida ? ` · sale ${r.horaSalida}` : ''}{r.vendedor ? ` · ${r.vendedor}` : ''}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    {maps && (
                                        <a href={maps} target="_blank" rel="noreferrer" className="h-8 px-3 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase flex items-center gap-1">
                                            <Navigation className="w-3 h-3" /> Mapa
                                        </a>
                                    )}
                                    <Button size="sm" variant="outline" onClick={() => onEditar(r)} className="h-8 text-[10px] font-black uppercase">Editar</Button>
                                    <button onClick={() => onEliminar(r.id)} className="p-1.5 text-slate-300 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>
                            <ol className="text-xs text-slate-600 dark:text-slate-300 font-bold space-y-0.5">
                                {r.paradas.map((p, i) => (
                                    <li key={p.clienteId}>{i + 1}. {p.clienteNombre}{p.horario ? ` · ${p.horario}` : ''}</li>
                                ))}
                                {r.paradas.length === 0 && <li className="text-slate-400">Sin tiendas todavía</li>}
                            </ol>
                        </CardContent>
                    </Card>
                );
            })}
            {rutas.length === 0 && (
                <Card className="rounded-2xl border-dashed"><CardContent className="p-10 text-center text-slate-400">
                    <MapPin className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p className="text-xs font-black uppercase tracking-widest">Crea tu primera ruta (ej. “Centro”, “Corregimiento La Laguna”).</p>
                </CardContent></Card>
            )}
        </div>
    );
}

function EditorRuta({ ruta, clientes, trabajadores, onCerrar, onGuardar }: {
    ruta: RutaReparto; clientes: { id: string; nombre: string }[]; trabajadores: string[];
    onCerrar: () => void; onGuardar: (r: RutaReparto) => void;
}) {
    const [r, setR] = useState<RutaReparto>(ruta);
    const [agregar, setAgregar] = useState('');
    const mover = (i: number, dir: -1 | 1) => {
        const j = i + dir;
        if (j < 0 || j >= r.paradas.length) return;
        const p = [...r.paradas];
        [p[i], p[j]] = [p[j], p[i]];
        setR({ ...r, paradas: p });
    };
    const disponibles = clientes.filter(c => !r.paradas.some(p => p.clienteId === c.id));
    return (
        <Dialog open onOpenChange={v => { if (!v) onCerrar(); }}>
            <DialogContent className="max-w-lg rounded-3xl max-h-[92vh] overflow-y-auto">
                <DialogHeader><DialogTitle className="font-black uppercase tracking-tight">Ruta</DialogTitle></DialogHeader>
                <div className="space-y-3">
                    <Input placeholder="Nombre (ej. Centro, Vereda La Cabaña)" value={r.nombre} onChange={e => setR({ ...r, nombre: e.target.value })} className="font-bold" />
                    <div className="grid grid-cols-2 gap-2">
                        <select className={inputCls} value={r.zona} onChange={e => setR({ ...r, zona: e.target.value as ZonaRuta })}>
                            {ZONAS.map(z => <option key={z.id} value={z.id}>{z.label}</option>)}
                        </select>
                        <input type="time" className={inputCls} value={r.horaSalida || ''} onChange={e => setR({ ...r, horaSalida: e.target.value })} title="Hora de salida" />
                    </div>
                    <div>
                        <input list="vendedores-ruta" className={cn(inputCls, 'w-full')} placeholder="Vendedor habitual" value={r.vendedor || ''} onChange={e => setR({ ...r, vendedor: e.target.value })} />
                        <datalist id="vendedores-ruta">{trabajadores.map(t => <option key={t} value={t} />)}</datalist>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                        {NOMBRES_DIA.map((n, d) => (
                            <button
                                key={d}
                                onClick={() => setR({ ...r, dias: r.dias.includes(d) ? r.dias.filter(x => x !== d) : [...r.dias, d].sort() })}
                                className={cn('h-8 px-3 rounded-lg text-[11px] font-black border', r.dias.includes(d) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200')}
                            >{n}</button>
                        ))}
                    </div>
                    <div className="space-y-1.5">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tiendas en orden de visita</p>
                        {r.paradas.map((p, i) => (
                            <div key={p.clienteId} className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-2 py-1.5">
                                <span className="text-xs font-black text-indigo-600 w-5">{i + 1}</span>
                                <span className="flex-1 text-sm font-bold truncate">{p.clienteNombre}</span>
                                <input type="time" className={cn(inputCls, 'w-24')} value={p.horario || ''} title="Hora habitual"
                                    onChange={e => setR({ ...r, paradas: r.paradas.map(x => (x.clienteId === p.clienteId ? { ...x, horario: e.target.value } : x)) })} />
                                <button onClick={() => mover(i, -1)} className="p-1 text-slate-400"><ArrowUp className="w-4 h-4" /></button>
                                <button onClick={() => mover(i, 1)} className="p-1 text-slate-400"><ArrowDown className="w-4 h-4" /></button>
                                <button onClick={() => setR({ ...r, paradas: r.paradas.filter(x => x.clienteId !== p.clienteId) })} className="p-1 text-rose-400"><X className="w-4 h-4" /></button>
                            </div>
                        ))}
                        <select className={cn(inputCls, 'w-full')} value={agregar}
                            onChange={e => {
                                const c = clientes.find(x => x.id === e.target.value);
                                if (c) setR({ ...r, paradas: [...r.paradas, { clienteId: c.id, clienteNombre: c.nombre }] });
                                setAgregar('');
                            }}>
                            <option value="">+ Agregar tienda…</option>
                            {disponibles.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                    </div>
                    <Input placeholder="Notas (ej. portón azul, llamar antes)" value={r.notas || ''} onChange={e => setR({ ...r, notas: e.target.value })} />
                    <Button
                        disabled={!r.nombre.trim()}
                        onClick={() => onGuardar({ ...r, nombre: r.nombre.trim() })}
                        className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-xs tracking-widest"
                    >Guardar ruta</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// NUEVO DESPACHO (carga)
// ═════════════════════════════════════════════════════════════════════════════
function NuevoDespacho({ rutas, catalogo, trabajadores, despachos, onCerrar, onCrear }: {
    rutas: RutaReparto[]; catalogo: CatalogoLinea[]; trabajadores: string[]; despachos: Despacho[];
    onCerrar: () => void; onCrear: (d: Despacho) => void;
}) {
    const [rutaId, setRutaId] = useState('');
    const [vendedor, setVendedor] = useState('');
    const [fecha, setFecha] = useState(fechaLocal());
    const [carga, setCarga] = useState<LineaCarga[]>([]);
    const [busca, setBusca] = useState('');
    const ruta = rutas.find(r => r.id === rutaId);

    useEffect(() => { if (ruta?.vendedor && !vendedor) setVendedor(ruta.vendedor); }, [rutaId]); // eslint-disable-line react-hooks/exhaustive-deps

    const resultados = useMemo(() => {
        const q = busca.trim().toLowerCase();
        if (!q) return [];
        // Incluye ya cargados para poder deseleccionar/quitar desde la lista
        return catalogo.filter(c => c.nombre.toLowerCase().includes(q)).slice(0, 8);
    }, [busca, catalogo]);

    const sugerir = () => {
        if (!ruta || ruta.paradas.length === 0) { toast.info('Elige una ruta con tiendas para sugerir la carga.'); return; }
        const suma = new Map<string, number>();
        for (const p of ruta.paradas) {
            for (const s of sugerirCargaTienda(despachos, p.clienteId)) suma.set(s.productoId, (suma.get(s.productoId) || 0) + s.cantidad);
        }
        if (suma.size === 0) { toast.info('Aún no hay historial de estas tiendas para sugerir.'); return; }
        const nueva: LineaCarga[] = [];
        for (const [productoId, cantidad] of suma.entries()) {
            const cat = catalogo.find(c => c.productoId === productoId);
            if (!cat) continue;
            nueva.push({ productoId, nombre: cat.nombre, cantidad, precioUnit: Math.round(cat.precioMayorista), costoUnit: Math.round(cat.costo) });
        }
        setCarga(nueva);
        toast.success('Carga sugerida según lo que rotó en cada tienda. Ajústala si quieres.');
    };

    const quitarDeCarga = (productoId: string) => setCarga(carga.filter(x => x.productoId !== productoId));
    const agregarACarga = (c: CatalogoLinea) => {
        if (carga.some(l => l.productoId === c.productoId)) {
            quitarDeCarga(c.productoId);
            return;
        }
        setCarga([...carga, {
            productoId: c.productoId,
            nombre: c.nombre,
            cantidad: 10,
            precioUnit: Math.round(c.precioMayorista),
            costoUnit: Math.round(c.costo),
        }]);
        setBusca('');
    };

    return (
        <Dialog open onOpenChange={v => { if (!v) onCerrar(); }}>
            <DialogContent
                className={cn(
                    'nuevo-despacho-modal max-w-xl rounded-3xl max-h-[92vh] overflow-y-auto',
                    'bg-white dark:bg-slate-950 !text-slate-900 dark:!text-slate-100',
                    '[&_[data-slot=dialog-close]]:text-slate-700 dark:[&_[data-slot=dialog-close]]:text-slate-200',
                )}
            >
                <DialogHeader>
                    <DialogTitle className="font-black uppercase tracking-tight !text-slate-950 dark:!text-white">
                        Nuevo despacho · Carga del carro
                    </DialogTitle>
                    <p className="text-sm font-bold !text-slate-800 dark:!text-slate-100">
                        Antes de salir: elige ruta, vendedor y el pan que lleva el carro (cantidad y precio al mayor).
                        En cada tienda, al abrir el despacho, se anota cuánto se dejó y cuánto regresó.
                        Aquí no se reparte por tienda todavía (eso se hace en la visita).
                    </p>
                </DialogHeader>
                <div className="space-y-3 !text-slate-900 dark:!text-slate-100">
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className={ndLabelCls} htmlFor="nd-ruta">Ruta</label>
                            <select id="nd-ruta" className={ndFieldCls} value={rutaId} onChange={e => setRutaId(e.target.value)}>
                                <option value="" className={ndOptionCls}>Elegir ruta…</option>
                                {rutas.map(r => (
                                    <option key={r.id} value={r.id} className={ndOptionCls}>{r.nombre}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={ndLabelCls} htmlFor="nd-fecha">Fecha</label>
                            <input id="nd-fecha" type="date" className={ndFieldCls} value={fecha} onChange={e => setFecha(e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <label className={ndLabelCls} htmlFor="nd-vendedor">Vendedor que sale</label>
                        <input
                            id="nd-vendedor"
                            list="vendedores-desp"
                            className={ndFieldCls}
                            placeholder="Nombre del vendedor"
                            value={vendedor}
                            onChange={e => setVendedor(e.target.value)}
                        />
                        <datalist id="vendedores-desp">{trabajadores.map(t => <option key={t} value={t} />)}</datalist>
                    </div>

                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-sm font-black !text-slate-950 dark:!text-white">Pan que se lleva en el carro</p>
                        <button
                            type="button"
                            onClick={sugerir}
                            className="text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-300 flex items-center gap-1"
                        >
                            <Lightbulb className="w-3 h-3" /> Sugerir por rotación
                        </button>
                    </div>
                    <div className="relative">
                        <label className={ndLabelCls} htmlFor="nd-busca">Buscar pan para cargar</label>
                        <Input
                            id="nd-busca"
                            placeholder="Escribe el nombre del pan…"
                            value={busca}
                            onChange={e => setBusca(e.target.value)}
                            className={cn(
                                ndFieldCls,
                                'shadow-none',
                                'placeholder:!text-slate-500 dark:placeholder:!text-slate-400',
                            )}
                        />
                        {resultados.length > 0 && (
                            <div className="absolute z-20 left-0 right-0 mt-1 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-lg max-h-56 overflow-y-auto">
                                {resultados.map(c => {
                                    const ya = carga.some(l => l.productoId === c.productoId);
                                    return (
                                        <button
                                            key={c.productoId}
                                            type="button"
                                            className={cn(
                                                'w-full text-left px-3 py-2.5 text-sm font-bold flex justify-between items-start gap-2',
                                                '!text-slate-900 dark:!text-slate-100',
                                                ya ? 'bg-indigo-50 dark:bg-indigo-950/50' : 'hover:bg-indigo-50 dark:hover:bg-indigo-950/40',
                                            )}
                                            onClick={() => agregarACarga(c)}
                                        >
                                            <span className="min-w-0">
                                                <span className="block truncate">{c.nombre}</span>
                                                <span className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                                                    Costo {Math.round(c.costo).toLocaleString('es-CO')} · Mayoreo {Math.round(c.precioMayorista).toLocaleString('es-CO')}
                                                    {ya ? ' · toca otra vez para quitar' : ''}
                                                </span>
                                            </span>
                                            <span className="shrink-0 text-indigo-700 dark:text-indigo-300 text-xs font-black uppercase pt-0.5">
                                                {ya ? 'Quitar' : 'Agregar'}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {carga.length > 0 && (
                        <div className="grid grid-cols-[1fr_4.5rem_5.5rem_2rem] gap-2 px-1 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">
                            <span>Producto</span>
                            <span className="text-center">Cant.</span>
                            <span className="text-center">Mayoreo</span>
                            <span />
                        </div>
                    )}
                    <div className="space-y-1.5">
                        {carga.map(l => (
                            <div
                                key={l.productoId}
                                className="grid grid-cols-[1fr_4.5rem_5.5rem_2rem] items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/80 px-2 py-1.5"
                            >
                                <div className="min-w-0">
                                    <span className="block text-sm font-bold truncate !text-slate-900 dark:!text-slate-100">{l.nombre}</span>
                                    <span className="block text-[10px] font-bold text-slate-600 dark:text-slate-400">
                                        Costo {Math.round(l.costoUnit || 0).toLocaleString('es-CO')}
                                    </span>
                                </div>
                                <input
                                    type="number"
                                    min={0}
                                    className={cn(ndFieldCls, 'text-center')}
                                    value={l.cantidad || ''}
                                    title="Cantidad en el carro"
                                    aria-label={`Cantidad ${l.nombre}`}
                                    onChange={e => setCarga(carga.map(x => (x.productoId === l.productoId ? { ...x, cantidad: num(e.target.value) } : x)))}
                                />
                                <input
                                    type="number"
                                    min={0}
                                    className={cn(ndFieldCls, 'text-center')}
                                    value={l.precioUnit || ''}
                                    title="Precio mayoreo (venta a la tienda)"
                                    aria-label={`Precio mayoreo ${l.nombre}`}
                                    onChange={e => setCarga(carga.map(x => (x.productoId === l.productoId ? { ...x, precioUnit: num(e.target.value) } : x)))}
                                />
                                <button
                                    type="button"
                                    onClick={() => quitarDeCarga(l.productoId)}
                                    className="p-1 rounded-md text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                    title="Quitar de la carga"
                                    aria-label={`Quitar ${l.nombre}`}
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        {carga.length === 0 && (
                            <p className="text-sm font-bold !text-slate-800 dark:!text-slate-100">
                                Busca el pan, agrégalo, pon cuántos lleva y el precio mayoreo. Luego, en la tienda, decides cuánto dejar de esa carga.
                            </p>
                        )}
                    </div>
                    <Button
                        disabled={!vendedor.trim() || carga.length === 0}
                        onClick={() => onCrear({
                            id: generateUUID(),
                            fecha,
                            vendedor: vendedor.trim(),
                            rutaId: ruta?.id,
                            rutaNombre: ruta?.nombre || 'Sin ruta',
                            estado: 'cargado',
                            horaSalida: ruta?.horaSalida,
                            carga: carga.filter(c => c.cantidad > 0),
                            paradas: (ruta?.paradas || []).map(p => ({ ...nuevoParada({ id: p.clienteId, nombre: p.clienteNombre }), hora: undefined })),
                            regreso: [],
                            actualizadoEn: Date.now(),
                        })}
                        className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-xs tracking-widest"
                    >Crear despacho</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// DETALLE DEL DESPACHO (entregas, recogidas, cobros, regreso)
// ═════════════════════════════════════════════════════════════════════════════
function DetalleDespacho({ despacho, clientes, catalogo, formatCurrency, onGuardar, onSalir, onLiquidar, onCerrar }: {
    despacho: Despacho; clientes: { id: string; nombre: string; direccion?: string; ciudad?: string }[];
    catalogo: CatalogoLinea[]; formatCurrency: (v: number) => string;
    onGuardar: (d: Despacho) => Despacho; onSalir: (d: Despacho) => Promise<Despacho>; onLiquidar: (d: Despacho) => Promise<Despacho>;
    onCerrar: () => void;
}) {
    const [d, setD] = useState<Despacho>(despacho);
    const [sucio, setSucio] = useState(false);
    const [abierta, setAbierta] = useState<string | null>(null);
    const [ocupado, setOcupado] = useState(false);
    const [agregar, setAgregar] = useState('');
    const r = useMemo(() => resumenDespacho(d), [d]);
    const infraccionesDev = useMemo(() => infraccionesTopeDevolucion(d), [d]);
    const msgTopeDev = useMemo(() => mensajeTopeDevolucion(infraccionesDev), [infraccionesDev]);
    const bloqueado = d.estado === 'liquidado';

    const cambiar = (nuevo: Despacho) => { setD(nuevo); setSucio(true); };

    // autoguardado (el vendedor puede perder señal; guardamos mientras escribe)
    useEffect(() => {
        if (!sucio) return;
        const t = setTimeout(() => { onGuardar(d); setSucio(false); }, 700);
        return () => clearTimeout(t);
    }, [d, sucio]); // eslint-disable-line react-hooks/exhaustive-deps

    const cerrar = () => { if (sucio) onGuardar(d); onCerrar(); };

    const actualizarParada = (clienteId: string, fn: (p: Despacho['paradas'][number]) => Despacho['paradas'][number]) =>
        cambiar({ ...d, paradas: d.paradas.map(p => (p.clienteId === clienteId ? fn(p) : p)) });

    const maps = enlaceRutaMaps(d.paradas.map(p => clientes.find(c => c.id === p.clienteId)).filter(Boolean) as any[]);
    const disponibles = clientes.filter(c => !d.paradas.some(p => p.clienteId === c.id));
    const regresoDe = (id: string) => d.regreso.find(x => x.productoId === id) || { productoId: id, buenos: 0, danados: 0 };

    const ejecutar = async (fn: (x: Despacho) => Promise<Despacho>) => {
        setOcupado(true);
        try { const nuevo = await fn(d); setD(nuevo); setSucio(false); } finally { setOcupado(false); }
    };

    return (
        <Dialog open onOpenChange={v => { if (!v) cerrar(); }}>
            <DialogContent className="max-w-3xl rounded-3xl max-h-[94vh] overflow-y-auto p-4 sm:p-6">
                <DialogHeader>
                    <DialogTitle className="font-black uppercase tracking-tight flex items-center gap-2 flex-wrap">
                        <Truck className="w-5 h-5 text-indigo-600" /> {d.rutaNombre} · {d.vendedor}
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-full', ESTADO_LABEL[d.estado].cls)}>{ESTADO_LABEL[d.estado].label}</span>
                    </DialogTitle>
                    <p className="text-xs font-bold text-slate-500">
                        {d.fecha}{d.horaSalida ? ` · salió ${d.horaSalida}` : ''}{d.horaRegreso ? ` · regresó ${d.horaRegreso}` : ''}
                        {maps && <a href={maps} target="_blank" rel="noreferrer" className="ml-2 text-emerald-600 underline">Ver ruta en mapa</a>}
                    </p>
                </DialogHeader>

                <div className="rounded-2xl border-2 border-slate-900 dark:border-white p-3">
                    <p className="text-sm font-black text-slate-950 dark:text-white">Aquí no se cargan productos.</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">
                        El pan ya se cargó en Nuevo despacho, antes de salir. Cuando el vendedor llega a una tienda, toca el nombre y escribe cuántos le dejó y cuántos le devolvieron.
                    </p>
                </div>

                {/* Cuadre del pan */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <p className="px-3 py-2 text-sm font-bold text-slate-950 dark:text-white bg-white dark:bg-slate-900">Resumen del carro. No se escribe aquí. Los números salen solos al anotar en cada tienda.</p>
                    <div className="grid grid-cols-6 gap-1 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-[9px] font-black uppercase tracking-wider text-slate-500">
                        <span className="col-span-2">Producto</span><span className="text-center">Cargó</span><span className="text-center">Dejó</span><span className="text-center">Recogió</span><span className="text-center">Debe volver</span>
                    </div>
                    {r.filas.map(f => (
                        <div key={f.productoId} className="grid grid-cols-6 gap-1 px-3 py-1.5 text-sm font-bold border-t border-slate-100 dark:border-slate-800">
                            <span className="col-span-2 truncate">{f.nombre}</span>
                            <span className="text-center">{f.cargado}</span>
                            <span className="text-center text-indigo-600">{f.dejado}</span>
                            <span className="text-center text-amber-600">{f.recogido}</span>
                            <span className={cn('text-center', f.esperadoRegreso < 0 && 'text-rose-600')}>{f.esperadoRegreso}</span>
                        </div>
                    ))}
                    {r.sinEntregar < 0 && (
                        <p className="px-3 py-2 text-[11px] font-bold text-rose-600 flex items-center gap-1 border-t"><AlertTriangle className="w-3.5 h-3.5" /> Se dejó más pan del que se cargó. Revisa los conteos.</p>
                    )}
                </div>

                {/* Paradas */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-black text-slate-950 dark:text-white">Tiendas. Toca una cuando llegues ({r.tiendasVisitadas}/{r.tiendasTotal} visitadas)</p>
                        {!bloqueado && (
                            <select className={cn(inputCls, 'h-8 text-xs')} value={agregar}
                                onChange={e => {
                                    const c = clientes.find(x => x.id === e.target.value);
                                    if (c) cambiar(sincronizarLineasConCarga({ ...d, paradas: [...d.paradas, nuevoParada({ id: c.id, nombre: c.nombre })] }));
                                    setAgregar('');
                                }}>
                                <option value="">+ Tienda extra…</option>
                                {disponibles.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                        )}
                    </div>
                    {d.paradas.map(p => {
                        const neto = netoParada(p);
                        const pendiente = creditoParada(p);
                        const abre = abierta === p.clienteId;
                        const uParada = unidadesParada(p);
                        const pctDevParada = uParada.dejado > 0 ? (uParada.recogido / uParada.dejado) * 100 : (uParada.recogido > 0 ? 100 : 0);
                        const sobreTope = infraccionesDev.some(i => i.clienteId === p.clienteId);
                        return (
                            <div key={p.clienteId} className={cn('rounded-2xl border', sobreTope ? 'border-rose-300 bg-rose-50/50 dark:bg-rose-950/20' : p.visitada ? 'border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/10' : 'border-slate-200 dark:border-slate-700')}>
                                <button className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left" onClick={() => setAbierta(abre ? null : p.clienteId)}>
                                    <span className="flex items-center gap-2 min-w-0">
                                        {sobreTope ? <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" /> : p.visitada ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <Store className="w-4 h-4 text-slate-400 shrink-0" />}
                                        <span className="font-black text-sm truncate">{p.clienteNombre}</span>
                                        {p.hora && <span className="text-[10px] text-slate-500 font-bold">{p.hora}</span>}
                                        {uParada.dejado > 0 && (
                                            <span className={cn('text-[10px] font-black', sobreTope ? 'text-rose-600' : 'text-slate-400')}>
                                                dev. {pctDevParada.toFixed(0)}%
                                            </span>
                                        )}
                                    </span>
                                    <span className="flex items-center gap-2 shrink-0">
                                        <span className="text-xs font-black">{formatCurrency(neto)}</span>
                                        {abre ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </span>
                                </button>
                                {abre && (
                                    <div className="px-3 pb-3 space-y-2">
                                        <p className="text-sm font-bold text-slate-950 dark:text-white">
                                            Estos panes ya van en el carro. No los busques otra vez. Escribe cuántos le dejaste a {p.clienteNombre}. Si te devolvió pan de antes, escríbelo en Me devolvió.
                                        </p>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" /> Hora</label>
                                            <input type="time" disabled={bloqueado} className={cn(inputCls, 'w-28')} value={p.hora || ''}
                                                onChange={e => actualizarParada(p.clienteId, x => ({ ...x, hora: e.target.value }))} />
                                            {!bloqueado && <button className="text-[10px] font-black uppercase text-indigo-600" onClick={() => actualizarParada(p.clienteId, x => ({ ...x, hora: horaLocal(), visitada: true }))}>Ahora</button>}
                                            <label className="ml-auto flex items-center gap-1 text-xs font-black">
                                                <input type="checkbox" disabled={bloqueado} checked={p.visitada} onChange={e => actualizarParada(p.clienteId, x => ({ ...x, visitada: e.target.checked }))} /> Visitada
                                            </label>
                                        </div>
                                        <div className="grid grid-cols-12 gap-1 text-xs font-black text-slate-950 dark:text-white px-1">
                                            <span className="col-span-4">Pan del carro</span><span className="col-span-2 text-center">Le dejé</span><span className="col-span-2 text-center">Me devolvió</span><span className="col-span-4">Si devolvió, por qué</span>
                                        </div>
                                        {p.lineas.length === 0 && (
                                            <p className="text-sm font-bold text-slate-950 dark:text-white">Este despacho salió sin pan. El pan se carga en Nuevo despacho, en Buscar producto, antes de salir.</p>
                                        )}
                                        {p.lineas.map(l => (
                                            <div key={l.productoId} className="grid grid-cols-12 gap-1 items-center">
                                                <span className="col-span-4 text-xs font-bold truncate">{l.nombre}</span>
                                                <input type="number" min={0} disabled={bloqueado} className={cn(inputCls, 'col-span-2 px-1 text-center')} value={l.dejado || ''}
                                                    onChange={e => actualizarParada(p.clienteId, x => ({ ...x, visitada: true, lineas: x.lineas.map(y => (y.productoId === l.productoId ? { ...y, dejado: num(e.target.value) } : y)) }))} />
                                                <input type="number" min={0} disabled={bloqueado} className={cn(inputCls, 'col-span-2 px-1 text-center', sobreTope && 'border-rose-400')} value={l.recogido || ''}
                                                    onChange={e => actualizarParada(p.clienteId, x => ({ ...x, visitada: true, lineas: x.lineas.map(y => (y.productoId === l.productoId ? { ...y, recogido: num(e.target.value) } : y)) }))} />
                                                <select disabled={bloqueado || !l.recogido} className={cn(inputCls, 'col-span-4 px-1 text-[11px]')} value={l.motivo}
                                                    onChange={e => actualizarParada(p.clienteId, x => ({ ...x, lineas: x.lineas.map(y => (y.productoId === l.productoId ? { ...y, motivo: e.target.value as MotivoRecogida } : y)) }))}>
                                                    {MOTIVOS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                                                </select>
                                            </div>
                                        ))}
                                        {sobreTope && (
                                            <p className="text-[11px] font-black text-rose-600 flex items-center gap-1">
                                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                                Devolución {pctDevParada.toFixed(0)}%: el tope es {TOPE_DEVOLUCION_PCT}% de lo dejado (máx. {infraccionesDev.find(i => i.clienteId === p.clienteId)?.maxRecogido ?? 0} uds). Baja lo recogido para poder liquidar.
                                            </p>
                                        )}
                                        <div className="grid grid-cols-2 gap-2 pt-1">
                                            <div>
                                                <label className="text-[9px] font-black uppercase text-slate-400">Cobró hoy</label>
                                                <input type="number" min={0} disabled={bloqueado} className={cn(inputCls, 'w-full')} value={p.cobrado || ''}
                                                    onChange={e => actualizarParada(p.clienteId, x => ({ ...x, cobrado: num(e.target.value) }))} />
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-black uppercase text-slate-400">Cómo pagó</label>
                                                <select disabled={bloqueado} className={cn(inputCls, 'w-full')} value={p.metodoCobro}
                                                    onChange={e => actualizarParada(p.clienteId, x => ({ ...x, metodoCobro: e.target.value as MetodoCobro }))}>
                                                    <option value="efectivo">Efectivo</option><option value="nequi">Nequi</option><option value="transferencia">Cuenta</option>
                                                </select>
                                            </div>
                                            <Input placeholder="¿Quién recibió?" disabled={bloqueado} value={p.recibidoPor || ''} className="h-9 text-sm font-bold"
                                                onChange={e => actualizarParada(p.clienteId, x => ({ ...x, recibidoPor: e.target.value }))} />
                                            <Input placeholder="Nota (ej. pidió más tostadas)" disabled={bloqueado} value={p.nota || ''} className="h-9 text-sm"
                                                onChange={e => actualizarParada(p.clienteId, x => ({ ...x, nota: e.target.value }))} />
                                        </div>
                                        <p className="text-[11px] font-bold text-slate-500">
                                            Neto {formatCurrency(neto)} · cobrado {formatCurrency(p.cobrado)}
                                            {pendiente > 0 && <span className="text-rose-600"> · queda a crédito {formatCurrency(pendiente)}</span>}
                                        </p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {d.paradas.length === 0 && <p className="text-sm font-bold text-slate-950 dark:text-white">Este despacho no tiene tiendas. Agrégalas con “+ Tienda extra”. El pan no se carga aquí.</p>}
                </div>

                {/* Regreso */}
                {d.estado !== 'cargado' && (
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1"><ClipboardCheck className="w-3.5 h-3.5" /> Conteo al regresar</p>
                        <div className="grid grid-cols-12 gap-1 text-[9px] font-black uppercase tracking-wider text-slate-400 px-1">
                            <span className="col-span-4">Producto</span><span className="col-span-2 text-center">Debe</span><span className="col-span-2 text-center">Buenos</span><span className="col-span-2 text-center">Dañados</span><span className="col-span-2 text-center">Dif.</span>
                        </div>
                        {r.filas.map(f => {
                            const rg = regresoDe(f.productoId);
                            return (
                                <div key={f.productoId} className="grid grid-cols-12 gap-1 items-center">
                                    <span className="col-span-4 text-xs font-bold truncate">{f.nombre}</span>
                                    <span className="col-span-2 text-center text-sm font-black">{f.esperadoRegreso}</span>
                                    {(['buenos', 'danados'] as const).map(campo => (
                                        <input key={campo} type="number" min={0} disabled={bloqueado} className={cn(inputCls, 'col-span-2 px-1 text-center')} value={rg[campo] || ''}
                                            onChange={e => {
                                                const nuevo = { ...rg, [campo]: num(e.target.value) };
                                                const resto = d.regreso.filter(x => x.productoId !== f.productoId);
                                                cambiar({ ...d, regreso: [...resto, nuevo] });
                                            }} />
                                    ))}
                                    <span className={cn('col-span-2 text-center text-sm font-black', d.regreso.length === 0 ? 'text-slate-300' : f.diferencia > 0 ? 'text-rose-600' : f.diferencia < 0 ? 'text-amber-600' : 'text-emerald-600')}>
                                        {d.regreso.length === 0 ? '–' : f.diferencia}
                                    </span>
                                </div>
                            );
                        })}
                        <div className="flex items-center gap-2 pt-1">
                            <Banknote className="w-4 h-4 text-emerald-600" />
                            <span className="text-xs font-bold text-slate-500">Efectivo que debe entregar: <b className="text-slate-800 dark:text-slate-100">{formatCurrency(r.cobradoEfectivo)}</b></span>
                            <input type="number" min={0} disabled={bloqueado} placeholder="Entregó" className={cn(inputCls, 'w-28 ml-auto')} value={d.efectivoRecibido ?? ''}
                                onChange={e => cambiar({ ...d, efectivoRecibido: e.target.value === '' ? undefined : num(e.target.value) })} />
                        </div>
                        {d.regreso.length > 0 && (r.faltanteUnidades > 0 || r.sobranteUnidades > 0) && (
                            <p className={cn('text-xs font-black flex items-center gap-1', r.faltanteUnidades > 0 ? 'text-rose-600' : 'text-amber-600')}>
                                <AlertTriangle className="w-3.5 h-3.5" />
                                {r.faltanteUnidades > 0 ? `Faltan ${r.faltanteUnidades} unidades (${formatCurrency(r.faltanteValor)}). ` : ''}
                                {r.sobranteUnidades > 0 ? `Sobran ${r.sobranteUnidades} (revisa lo dejado/recogido).` : ''}
                            </p>
                        )}
                        {r.efectivoDiferencia !== null && r.efectivoDiferencia !== 0 && (
                            <p className={cn('text-xs font-black', r.efectivoDiferencia < 0 ? 'text-rose-600' : 'text-amber-600')}>
                                {r.efectivoDiferencia < 0 ? `Entregó ${formatCurrency(-r.efectivoDiferencia)} menos de lo cobrado.` : `Entregó ${formatCurrency(r.efectivoDiferencia)} de más.`}
                            </p>
                        )}
                    </div>
                )}

                {/* Totales */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    {[
                        { l: 'Venta bruta', v: formatCurrency(r.ventaBruta) },
                        { l: 'Devoluciones', v: formatCurrency(r.devolucionesValor) },
                        { l: 'Venta neta', v: formatCurrency(r.ventaNeta) },
                        { l: 'A crédito', v: formatCurrency(r.porCobrarCredito) },
                    ].map(k => (
                        <div key={k.l} className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-2">
                            <p className="text-sm font-black">{k.v}</p>
                            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{k.l}</p>
                        </div>
                    ))}
                </div>

                {msgTopeDev && d.estado === 'en_ruta' && (
                    <p className="text-xs font-black text-rose-700 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl px-3 py-2 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{msgTopeDev}</span>
                    </p>
                )}

                {/* Acciones */}
                <div className="flex flex-wrap gap-2">
                    {d.estado === 'cargado' && (
                        <Button disabled={ocupado} onClick={() => ejecutar(onSalir)} className="flex-1 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-xs tracking-widest gap-2">
                            <PlayCircle className="w-4 h-4" /> Salir a ruta (descuenta inventario)
                        </Button>
                    )}
                    {d.estado === 'en_ruta' && (
                        <Button
                            disabled={ocupado || !!msgTopeDev}
                            title={msgTopeDev || undefined}
                            onClick={() => {
                                if (msgTopeDev) { toast.error(msgTopeDev); return; }
                                if (d.regreso.length === 0 && !window.confirm('No has contado el pan que regresa. ¿Liquidar de todas formas?')) return;
                                ejecutar(onLiquidar);
                            }}
                            className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-xs tracking-widest gap-2 disabled:opacity-50"
                        >
                            <CheckCircle2 className="w-4 h-4" /> Liquidar (sobrante al inventario, saldos a Créditos)
                        </Button>
                    )}
                    <Button variant="outline" onClick={cerrar} className="h-11 rounded-xl font-black uppercase text-xs">Cerrar</Button>
                </div>
                {catalogo.length === 0 && <p className="text-[10px] text-slate-400">Sin catálogo de productos cargado.</p>}
            </DialogContent>
        </Dialog>
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// TIENDAS · análisis de ganancia, rotación y estrategia
// ═════════════════════════════════════════════════════════════════════════════
function SeccionTiendas({ analisis, clientes, despachos, formatCurrency, config, onGuardarMargen }: {
    analisis: AnalisisTienda[]; clientes: Cliente[]; despachos: Despacho[]; formatCurrency: (v: number) => string;
    config: ConfigMargenes; onGuardarMargen: (id: string, m: number | undefined) => Promise<void>;
}) {
    const [abierta, setAbierta] = useState<string | null>(null);
    const [margenTmp, setMargenTmp] = useState('');
    const total = useMemo(() => {
        const t = { neta: 0, util: 0, dej: 0, rec: 0, rojas: 0 };
        for (const a of analisis) { t.neta += a.ventaNeta; t.util += a.utilidadNegocio; t.dej += a.unidadesDejadas; t.rec += a.unidadesRecogidas; if (a.semaforo === 'rojo') t.rojas++; }
        return t;
    }, [analisis]);
    const sinVisitas = clientes.filter(c => !analisis.some(a => a.clienteId === c.id)).length;

    if (analisis.length === 0) {
        return (
            <Card className="rounded-2xl border-dashed"><CardContent className="p-10 text-center text-slate-400">
                <Store className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-xs font-black uppercase tracking-widest">El análisis aparece cuando registres visitas en los despachos.</p>
            </CardContent></Card>
        );
    }
    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                    { l: 'Venta neta total', v: formatCurrency(total.neta) },
                    { l: 'Utilidad del negocio', v: formatCurrency(total.util) },
                    { l: 'Devolución global', v: `${total.dej > 0 ? ((total.rec / total.dej) * 100).toFixed(1) : '0'}%` },
                    { l: 'Tiendas por atender', v: String(total.rojas) },
                ].map(k => (
                    <Card key={k.l} className="rounded-2xl"><CardContent className="p-3 text-center">
                        <p className="text-lg font-black">{k.v}</p>
                        <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{k.l}</p>
                    </CardContent></Card>
                ))}
            </div>
            {sinVisitas > 0 && <p className="text-[11px] font-bold text-slate-400">{sinVisitas} cliente(s) sin ninguna visita registrada todavía.</p>}

            {analisis.map(a => {
                const abre = abierta === a.clienteId;
                const sug = abre ? sugerirCargaTienda(despachos, a.clienteId) : [];
                const parteNegocio = a.ventaNeta > 0 ? Math.max(0, (a.utilidadNegocio / a.ventaNeta) * 100) : 0;
                return (
                    <Card key={a.clienteId} className="rounded-2xl border-slate-200 dark:border-slate-800">
                        <CardContent className="p-0">
                            <button className="w-full p-4 flex items-center justify-between gap-3 text-left" onClick={() => { setAbierta(abre ? null : a.clienteId); setMargenTmp(String(a.margenTiendaPct)); }}>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-black truncate">{a.nombre}</span>
                                        <span className={cn('text-[10px] font-black uppercase px-2 py-0.5 rounded-full', SEMAFORO[a.semaforo].cls)}>{SEMAFORO[a.semaforo].label}</span>
                                        {a.tendencia === 'sube' && <TrendingUp className="w-4 h-4 text-emerald-600" />}
                                        {a.tendencia === 'baja' && <TrendingDown className="w-4 h-4 text-rose-600" />}
                                        {a.tendencia === 'estable' && <Minus className="w-4 h-4 text-slate-400" />}
                                    </div>
                                    <p className="text-[11px] text-slate-500 font-bold mt-0.5">
                                        {a.visitas} visita(s) · devuelven {a.pctDevolucion.toFixed(0)}% · {a.diasSinVisita !== undefined ? `hace ${a.diasSinVisita} día(s)` : ''}
                                    </p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-sm font-black">{formatCurrency(a.utilidadNegocio)}</p>
                                    <p className="text-[9px] font-black uppercase text-slate-400">tu utilidad</p>
                                </div>
                            </button>
                            {abre && (
                                <div className="px-4 pb-4 space-y-3 border-t border-slate-100 dark:border-slate-800 pt-3">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                                        {[
                                            { l: 'Venta neta', v: formatCurrency(a.ventaNeta) },
                                            { l: 'Margen tuyo', v: `${a.margenNegocioPct.toFixed(1)}%` },
                                            { l: 'Gana la tienda', v: formatCurrency(a.gananciaTienda) },
                                            { l: 'Cambios/daños', v: formatCurrency(a.perdidaPorCambiosYDanos) },
                                        ].map(k => (
                                            <div key={k.l} className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-2">
                                                <p className="text-sm font-black">{k.v}</p>
                                                <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{k.l}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">¿Quién gana qué? (por cada 100 de venta)</p>
                                        <div className="flex h-5 rounded-full overflow-hidden text-[10px] font-black text-white">
                                            <div className="bg-indigo-600 flex items-center justify-center" style={{ width: `${Math.min(100, parteNegocio)}%` }}>{parteNegocio >= 8 ? `Tú ${parteNegocio.toFixed(0)}` : ''}</div>
                                            <div className="bg-emerald-500 flex items-center justify-center" style={{ width: `${Math.min(100 - Math.min(100, parteNegocio), a.margenTiendaPct)}%` }}>{a.margenTiendaPct >= 8 ? `Tienda ${a.margenTiendaPct.toFixed(0)}` : ''}</div>
                                            <div className="bg-slate-300 flex-1" />
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-bold mt-1">La tienda rinde {a.rendimientoTiendaPct.toFixed(1)}% sobre lo que invirtió en pan (ya descontando devoluciones).</p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[10px] font-black uppercase text-slate-400">Margen de la tienda %</span>
                                        <input type="number" min={0} className={cn(inputCls, 'w-20')} value={margenTmp} onChange={e => setMargenTmp(e.target.value)} />
                                        <Button size="sm" className="h-8 text-[10px] font-black uppercase" onClick={() => onGuardarMargen(a.clienteId, Number(margenTmp))}>Guardar</Button>
                                        <button className="text-[10px] font-black uppercase text-slate-400 underline" onClick={() => onGuardarMargen(a.clienteId, undefined)}>Usar general ({config.margenRevendedor}%)</button>
                                    </div>
                                    <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 p-3 space-y-1.5">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-1"><Lightbulb className="w-3.5 h-3.5" /> Qué hacer con esta tienda</p>
                                        {a.estrategias.map((e, i) => <p key={i} className="text-xs font-bold text-slate-700 dark:text-slate-200">• {e}</p>)}
                                    </div>
                                    {sug.length > 0 && (
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1"><Package className="w-3 h-3" /> Carga sugerida para la próxima visita</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {sug.map(s => <span key={s.productoId} className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold" title={s.motivo}>{s.cantidad} × {s.nombre}</span>)}
                                            </div>
                                        </div>
                                    )}
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Rotación por producto</p>
                                        {a.productos.slice(0, 10).map(p => (
                                            <div key={p.productoId} className="flex items-center gap-2 text-xs font-bold">
                                                <span className="flex-1 truncate">{p.nombre}</span>
                                                <span className="text-slate-400">dejó {p.dejado}</span>
                                                <span className={cn('w-16 text-right', p.pctDevolucion >= 25 ? 'text-rose-600' : p.pctDevolucion <= 5 ? 'text-emerald-600' : 'text-amber-600')}>{p.pctDevolucion.toFixed(0)}% dev.</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// VENDEDORES
// ═════════════════════════════════════════════════════════════════════════════
function SeccionVendedores({ vendedores, formatCurrency }: { vendedores: ReturnType<typeof analizarVendedores>; formatCurrency: (v: number) => string }) {
    if (vendedores.length === 0) {
        return (
            <Card className="rounded-2xl border-dashed"><CardContent className="p-10 text-center text-slate-400">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-xs font-black uppercase tracking-widest">El control del vendedor aparece al liquidar despachos.</p>
            </CardContent></Card>
        );
    }
    return (
        <div className="space-y-3">
            {vendedores.map(v => (
                <Card key={v.vendedor} className="rounded-2xl border-slate-200 dark:border-slate-800">
                    <CardContent className="p-4 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <p className="font-black">{v.vendedor}</p>
                            <span className="text-[10px] font-black uppercase text-slate-400">{v.despachos} salida(s) · {v.liquidados} liquidada(s)</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                            {[
                                { l: 'Cargó', v: String(v.unidadesCargadas) },
                                { l: 'Dejó', v: String(v.unidadesDejadas) },
                                { l: 'Faltaron', v: `${v.unidadesFaltantes} (${formatCurrency(v.valorFaltante)})` },
                                { l: 'Descuadre caja', v: formatCurrency(v.descuadreEfectivo) },
                            ].map(k => (
                                <div key={k.l} className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-2">
                                    <p className="text-sm font-black">{k.v}</p>
                                    <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{k.l}</p>
                                </div>
                            ))}
                        </div>
                        {v.alertas.map((a, i) => <p key={i} className="text-xs font-black text-rose-600 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> {a}</p>)}
                        {v.alertas.length === 0 && v.liquidados > 0 && <p className="text-xs font-black text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Cuentas al día: sin faltantes ni descuadres.</p>}
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
