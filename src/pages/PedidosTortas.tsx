import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Cake, Plus, Printer, Trash2, Camera, Image as ImageIcon, Bell, BellRing, MessageCircle, Phone, Pencil,
    ChevronRight, X, Search, Minus,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { db } from '@/lib/database';
import { dbNube } from '@/lib/nube-kv';
import { generateUUID } from '@/lib/safe-utils';
import {
    ESTADO_INFO, ESTADOS_ACTIVOS, agregarAdicional, cambiarEstado, cargarPedidosDesdeNube, comprimirImagen,
    compartirPedido, etiquetaUrgencia, fechaBonita, fechaLocal, guardarPedidos, horaBonita, imprimirComanda,
    marcarAvisado, nivelUrgencia, nuevoPedido, opcionesCatalogo, ordenarPedidos, recordatorios, saldoPedido,
    totalAdicionales, totalPedido, validarPedido, yaAvisado, diasHasta,
    aCobrarEnEntrega, pendienteCaja, ventaCobroPedido, ajustesStockPedido,
    type EstadoPedido, type MetodoCobroTorta, type NivelUrgencia, type PedidoTorta, type ProductoRef,
} from '@/lib/pedidos-tortas';

interface Props {
    productos?: ProductoRef[];
    clientes?: { id: string; nombre: string; telefono?: string }[];
    formatCurrency?: (n: number) => string;
    usuarioNombre?: string;
    usuarioId?: string;
    /** Registra el cobro en la caja abierta (useVentas.registrarVenta) */
    registrarVenta?: (v: any) => Promise<any>;
    cajaActiva?: unknown;
}

const METODOS: { id: MetodoCobroTorta; label: string }[] = [
    { id: 'efectivo', label: 'Efectivo' }, { id: 'nequi', label: 'Nequi' },
    { id: 'transferencia', label: 'Transferencia' }, { id: 'tarjeta', label: 'Tarjeta' },
];

const MONEDA = (n: number) => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`;

const URGENCIA_CLS: Record<NivelUrgencia, string> = {
    atrasada: 'bg-red-600 text-white',
    hoy: 'bg-orange-500 text-white',
    manana: 'bg-amber-400 text-amber-950',
    semana: 'bg-sky-100 text-sky-800',
    normal: 'bg-slate-100 text-slate-600',
    cerrada: 'bg-slate-100 text-slate-500',
};

const COLUMNAS: EstadoPedido[] = ['pendiente', 'en_preparacion', 'lista'];
const SABORES = ['Tres leches', 'Chocolate', 'Vainilla', 'Red velvet', 'Zanahoria', 'Arequipe', 'Fresas con crema', 'Mixta'];

const inputCls = 'h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm font-semibold outline-none focus:border-orange-400';

export default function PedidosTortas({ productos = [], clientes = [], formatCurrency, usuarioNombre, usuarioId, registrarVenta, cajaActiva }: Props) {
    const fmt = formatCurrency || MONEDA;
    const por = usuarioNombre || 'Usuario';
    const [entregando, setEntregando] = useState<PedidoTorta | null>(null);
    const [metodoEntrega, setMetodoEntrega] = useState<MetodoCobroTorta>('efectivo');
    const [ocupado, setOcupado] = useState(false);

    const [pedidos, setPedidos] = useState<PedidoTorta[]>([]);
    const [trabajadores, setTrabajadores] = useState<string[]>([]);
    const [editando, setEditando] = useState<PedidoTorta | null>(null);
    const [esNuevo, setEsNuevo] = useState(false);
    const [filtro, setFiltro] = useState<'todas' | 'hoy' | 'semana'>('todas');
    const [busqueda, setBusqueda] = useState('');
    const [verCerradas, setVerCerradas] = useState(false);
    const [foto, setFoto] = useState<string | null>(null);
    const [permiso, setPermiso] = useState<string>(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
    const pedidosRef = useRef<PedidoTorta[]>([]);
    pedidosRef.current = pedidos;

    // ── carga y refresco (la vendedora crea en un equipo y la repostera lo ve en otro) ──
    useEffect(() => {
        let vivo = true;
        const cargar = () => cargarPedidosDesdeNube(dbNube).then(l => { if (vivo) setPedidos(l); }).catch(() => {});
        cargar();
        const t = setInterval(cargar, 60_000);
        db.getAllTrabajadores().then((l: any[]) => {
            if (vivo) setTrabajadores(l.filter(x => x.estado === 'activo').map(x => x.nombre).filter(Boolean));
        }).catch(() => {});
        return () => { vivo = false; clearInterval(t); };
    }, []);

    const guardarLista = (lista: PedidoTorta[]) => { pedidosRef.current = lista; setPedidos(lista); guardarPedidos(dbNube, lista); };
    const guardarUno = (p: PedidoTorta) => {
        const nuevo = { ...p, actualizadoEn: Date.now() };
        const actuales = pedidosRef.current;
        guardarLista(actuales.some(x => x.id === p.id) ? actuales.map(x => (x.id === p.id ? nuevo : x)) : [nuevo, ...actuales]);
        return nuevo;
    };

    // ── recordatorios ──
    const hoy = fechaLocal();
    const rec = useMemo(() => recordatorios(pedidos, hoy), [pedidos, hoy]);

    useEffect(() => {
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
        const avisar = () => {
            const r = recordatorios(pedidosRef.current);
            for (const [lista, txt] of [[r.atrasadas, 'ATRASADA'], [r.hoy, 'es HOY'], [r.manana, 'es MAÑANA']] as const) {
                for (const p of lista) {
                    if (yaAvisado(p.id)) continue;
                    marcarAvisado(p.id);
                    try {
                        new Notification(`🎂 Torta ${txt}`, { body: `${p.cliente} · ${p.sabor || p.diseno}${p.horaEntrega ? ' · ' + horaBonita(p.horaEntrega) : ''}` });
                    } catch { /* sin permiso real */ }
                }
            }
        };
        avisar();
        const t = setInterval(avisar, 30 * 60_000);
        return () => clearInterval(t);
    }, [pedidos, permiso]);

    const activarAvisos = async () => {
        if (typeof Notification === 'undefined') { toast.error('Este navegador no permite avisos'); return; }
        const p = await Notification.requestPermission();
        setPermiso(p);
        if (p === 'granted') toast.success('Avisos activados: te recuerda las tortas de hoy y mañana');
        else toast.error('Avisos bloqueados en el navegador');
    };

    // ── vistas ──
    const visibles = useMemo(() => {
        const q = busqueda.trim().toLowerCase();
        return ordenarPedidos(pedidos).filter(p => {
            if (q && !`${p.cliente} ${p.sabor} ${p.diseno} ${p.dedicatoria} ${p.telefono}`.toLowerCase().includes(q)) return false;
            if (filtro === 'hoy') return diasHasta(p.fechaEntrega, hoy) <= 0;
            if (filtro === 'semana') return diasHasta(p.fechaEntrega, hoy) <= 7;
            return true;
        });
    }, [pedidos, busqueda, filtro, hoy]);

    const porColumna = (e: EstadoPedido) => visibles.filter(p => p.estado === e);
    const cerradas = useMemo(
        () => visibles.filter(p => !ESTADOS_ACTIVOS.includes(p.estado)).sort((a, b) => b.actualizadoEn - a.actualizadoEn).slice(0, 40),
        [visibles],
    );

    const avanzar = (p: PedidoTorta) => {
        const sig = ESTADO_INFO[p.estado].siguiente;
        if (!sig) return;
        if (sig === 'entregada') { setMetodoEntrega('efectivo'); setEntregando(p); return; }
        guardarUno(cambiarEstado(p, sig, por));
    };

    /** Registra en caja lo recibido que aún no está registrado. Devuelve el pedido actualizado. */
    const registrarEnCaja = async (p: PedidoTorta, metodo: MetodoCobroTorta): Promise<PedidoTorta> => {
        const pend = pendienteCaja(p);
        if (pend <= 0) return p;
        if (!registrarVenta || !cajaActiva) {
            toast.warning(`No hay caja abierta: ${fmt(pend)} quedan pendientes de registrar en caja.`);
            return p;
        }
        try {
            await registrarVenta(ventaCobroPedido(p, pend, metodo, usuarioId || 'anon', por, fechaBonita(p.fechaEntrega)));
            return { ...p, registradoCaja: (Number(p.registradoCaja) || 0) + pend };
        } catch {
            toast.error('No se pudo registrar en caja; queda pendiente.');
            return p;
        }
    };

    const confirmarEntrega = async (cobrar: boolean) => {
        if (!entregando || ocupado) return;
        setOcupado(true);
        try {
            let np: PedidoTorta = cobrar ? { ...entregando, abono: totalPedido(entregando) } : entregando;
            np = await registrarEnCaja(np, metodoEntrega);
            if (!np.stockDescontado) {
                const ajustes = ajustesStockPedido(np);
                if (ajustes.length > 0) {
                    try { await db.batchAjustarStock(ajustes); np = { ...np, stockDescontado: true }; }
                    catch { toast.error('No se pudo descontar el inventario de los adicionales.'); }
                } else np = { ...np, stockDescontado: true };
            }
            guardarUno(cambiarEstado(np, 'entregada', por));
            toast.success('Pedido entregado');
            setEntregando(null);
        } finally { setOcupado(false); }
    };

    const abrirNuevo = () => { setEsNuevo(true); setEditando(nuevoPedido(por, generateUUID())); };
    const abrirEditar = (p: PedidoTorta) => { setEsNuevo(false); setEditando(p); };

    const totalActivas = pedidos.filter(p => ESTADOS_ACTIVOS.includes(p.estado)).length;

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-5 pb-32">
            {/* Encabezado */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                        <span className="w-10 h-10 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500 border border-orange-500/20">
                            <Cake className="w-6 h-6" />
                        </span>
                        Pedidos de Tortas
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">
                        {totalActivas} pedido{totalActivas === 1 ? '' : 's'} activo{totalActivas === 1 ? '' : 's'} · ordenados por fecha de entrega
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {permiso !== 'granted' && permiso !== 'unsupported' && (
                        <Button variant="outline" onClick={activarAvisos} className="rounded-xl font-black text-xs" data-activar-avisos>
                            <Bell className="w-4 h-4 mr-1.5" /> Activar avisos
                        </Button>
                    )}
                    {permiso === 'granted' && (
                        <span className="text-[11px] font-black text-emerald-600 flex items-center gap-1"><BellRing className="w-4 h-4" /> Avisos activos</span>
                    )}
                    <Button onClick={abrirNuevo} data-nuevo-pedido className="rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black">
                        <Plus className="w-4 h-4 mr-1.5" /> Nuevo pedido
                    </Button>
                </div>
            </div>

            {/* Recordatorios */}
            {(rec.atrasadas.length + rec.hoy.length + rec.manana.length) > 0 && (
                <div className="rounded-2xl border-2 border-orange-200 bg-orange-50 dark:bg-orange-900/10 dark:border-orange-800 p-3 space-y-1" data-recordatorios>
                    {rec.atrasadas.length > 0 && <p className="text-sm font-black text-red-600">⚠ {rec.atrasadas.length} atrasada{rec.atrasadas.length > 1 ? 's' : ''}: {rec.atrasadas.map(p => p.cliente).join(', ')}</p>}
                    {rec.hoy.length > 0 && <p className="text-sm font-black text-orange-700">🎂 Para HOY ({rec.hoy.length}): {rec.hoy.map(p => `${p.cliente}${p.horaEntrega ? ' ' + horaBonita(p.horaEntrega) : ''}`).join(' · ')}</p>}
                    {rec.manana.length > 0 && <p className="text-sm font-black text-amber-700">🔔 Para MAÑANA ({rec.manana.length}): {rec.manana.map(p => p.cliente).join(' · ')}</p>}
                </div>
            )}

            {/* Filtros */}
            <div className="flex flex-wrap items-center gap-2">
                {([['todas', 'Todas'], ['semana', 'Esta semana'], ['hoy', 'Hoy y atrasadas']] as const).map(([id, label]) => (
                    <button key={id} onClick={() => setFiltro(id)}
                        className={cn('h-9 px-4 rounded-full text-xs font-black border-2 transition-all',
                            filtro === id ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-500')}>
                        {label}
                    </button>
                ))}
                <div className="relative ml-auto w-full sm:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar cliente, sabor, diseño…" className="pl-9 h-9 rounded-xl" />
                </div>
            </div>

            {/* Tablero de comanda */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" data-tablero>
                {COLUMNAS.map(col => {
                    const lista = porColumna(col);
                    return (
                        <div key={col} className="rounded-3xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-3 space-y-3 min-h-[160px]">
                            <div className="flex items-center justify-between px-1">
                                <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">{ESTADO_INFO[col].label}</h2>
                                <span className="text-xs font-black bg-white dark:bg-slate-800 rounded-full px-2.5 py-0.5 border">{lista.length}</span>
                            </div>
                            {lista.length === 0 && <p className="text-xs text-slate-400 text-center py-6">Sin pedidos</p>}
                            {lista.map(p => (
                                <Tarjeta key={p.id} p={p} hoy={hoy} fmt={fmt}
                                    onAvanzar={() => avanzar(p)} onEditar={() => abrirEditar(p)} onFoto={setFoto} />
                            ))}
                        </div>
                    );
                })}
            </div>

            {/* Entregadas / canceladas */}
            <div>
                <button onClick={() => setVerCerradas(v => !v)} className="text-xs font-black text-slate-500 underline">
                    {verCerradas ? 'Ocultar' : 'Ver'} entregadas y canceladas ({cerradas.length})
                </button>
                {verCerradas && (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {cerradas.map(p => (
                            <div key={p.id} className="rounded-2xl border bg-white dark:bg-slate-900 p-3 text-sm flex items-center justify-between gap-2 opacity-80">
                                <div className="min-w-0">
                                    <p className="font-black truncate">{p.cliente} · {p.sabor || p.diseno}</p>
                                    <p className="text-[11px] text-slate-500">{fechaBonita(p.fechaEntrega)} · {ESTADO_INFO[p.estado].label} · {fmt(totalPedido(p))}</p>
                                </div>
                                <Button size="sm" variant="outline" className="rounded-lg text-xs" onClick={() => abrirEditar(p)}>Ver</Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Formulario */}
            {editando && (
                <FormularioPedido
                    key={editando.id}
                    inicial={editando}
                    esNuevo={esNuevo}
                    productos={productos}
                    clientes={clientes}
                    trabajadores={trabajadores}
                    fmt={fmt}
                    por={por}
                    onCerrar={() => setEditando(null)}
                    onGuardar={async (p, imprimir, metodo) => {
                        // El abono recibido entra a caja (solo lo nuevo; cerrados/cancelados no)
                        const conCaja = ESTADOS_ACTIVOS.includes(p.estado) ? await registrarEnCaja(p, metodo) : p;
                        const g = guardarUno(conCaja);
                        setEditando(null);
                        toast.success(esNuevo ? 'Pedido guardado' : 'Pedido actualizado');
                        if (imprimir) imprimirComanda(g, fmt);
                    }}
                />
            )}

            {/* Entregar y cobrar */}
            {entregando && (
                <Dialog open onOpenChange={v => { if (!v) setEntregando(null); }}>
                    <DialogContent className="max-w-sm rounded-3xl" data-entrega>
                        <DialogHeader><DialogTitle className="font-black">Entregar torta de {entregando.cliente}</DialogTitle></DialogHeader>
                        <div className="space-y-3 text-sm">
                            <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3 space-y-1">
                                <div className="flex justify-between"><span>Total</span><b>{fmt(totalPedido(entregando))}</b></div>
                                <div className="flex justify-between"><span>Abono recibido</span><b>{fmt(entregando.abono)}</b></div>
                                <div className="flex justify-between text-red-600"><span>Saldo por cobrar</span><b data-saldo-entrega>{fmt(saldoPedido(entregando))}</b></div>
                                {pendienteCaja(entregando) > 0 && (
                                    <p className="text-[11px] text-amber-600 font-bold">Del abono, {fmt(pendienteCaja(entregando))} aún no está en caja y se registra ahora.</p>
                                )}
                            </div>
                            {aCobrarEnEntrega(entregando) > 0 && (
                                <label className="block space-y-1">
                                    <span className="text-[11px] font-black uppercase text-slate-500">Medio de pago</span>
                                    <select className={inputCls} value={metodoEntrega} onChange={e => setMetodoEntrega(e.target.value as MetodoCobroTorta)}>
                                        {METODOS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                                    </select>
                                </label>
                            )}
                            {ajustesStockPedido(entregando).length > 0 && (
                                <p className="text-[11px] text-slate-500">Se descuenta del inventario: {entregando.adicionales.filter(a => a.productoId).map(a => `${a.cantidad}× ${a.nombre}`).join(', ')}.</p>
                            )}
                            {!cajaActiva && aCobrarEnEntrega(entregando) > 0 && (
                                <p className="text-[11px] font-bold text-amber-600">No hay caja abierta: el cobro no se registrará en caja.</p>
                            )}
                            <div className="flex flex-col gap-2">
                                <Button disabled={ocupado} onClick={() => confirmarEntrega(true)} data-confirmar-entrega className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black">
                                    {saldoPedido(entregando) > 0 ? `Cobrar ${fmt(saldoPedido(entregando))} y entregar` : 'Entregar'}
                                </Button>
                                {saldoPedido(entregando) > 0 && (
                                    <Button disabled={ocupado} variant="outline" onClick={() => confirmarEntrega(false)} className="rounded-xl font-black text-xs">
                                        Entregar sin cobrar el saldo
                                    </Button>
                                )}
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* Foto grande */}
            {foto && (
                <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4" onClick={() => setFoto(null)}>
                    <img src={foto} alt="Modelo" className="max-h-full max-w-full rounded-2xl" />
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tarjeta de comanda
// ─────────────────────────────────────────────────────────────────────────────
function Tarjeta({ p, hoy, fmt, onAvanzar, onEditar, onFoto }: {
    p: PedidoTorta; hoy: string; fmt: (n: number) => string;
    onAvanzar: () => void; onEditar: () => void; onFoto: (f: string) => void;
}) {
    const nivel = nivelUrgencia(p, hoy);
    const info = ESTADO_INFO[p.estado];
    const saldo = saldoPedido(p);
    return (
        <div data-pedido={p.id} className={cn('rounded-2xl bg-white dark:bg-slate-900 border-2 p-3 space-y-2 shadow-sm',
            nivel === 'atrasada' ? 'border-red-400' : nivel === 'hoy' ? 'border-orange-400' : 'border-slate-200 dark:border-slate-800')}>
            <div className="flex items-center justify-between gap-2">
                <div>
                    <p className="text-base font-black leading-tight">{fechaBonita(p.fechaEntrega)}</p>
                    <p className="text-xs font-bold text-slate-500">{horaBonita(p.horaEntrega) || 'sin hora'}</p>
                </div>
                <span className={cn('px-2.5 py-1 rounded-full text-[11px] font-black', URGENCIA_CLS[nivel])}>{etiquetaUrgencia(p, hoy)}</span>
            </div>

            <div>
                <p className="font-black text-sm">{p.sabor || 'Torta'}{p.porciones ? ` · ${p.porciones} porc.` : ''}</p>
                {p.diseno && <p className="text-xs text-slate-600 dark:text-slate-300">🎨 {p.diseno}</p>}
                {p.dedicatoria && <p className="text-sm font-black text-pink-600 mt-1">"{p.dedicatoria}"</p>}
                {p.notas && <p className="text-[11px] text-slate-500 mt-1">📝 {p.notas}</p>}
            </div>

            {p.fotos.length > 0 && (
                <div className="flex gap-1.5">
                    {p.fotos.slice(0, 4).map((f, i) => (
                        <img key={i} src={f} alt="Modelo" onClick={() => onFoto(f)} className="w-16 h-16 object-cover rounded-xl border cursor-pointer" />
                    ))}
                </div>
            )}

            {p.adicionales.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {p.adicionales.map(a => (
                        <span key={a.id} className="text-[11px] font-bold bg-indigo-50 text-indigo-700 rounded-full px-2 py-0.5">{a.cantidad}× {a.nombre}</span>
                    ))}
                </div>
            )}

            <div className="flex items-center justify-between text-xs border-t pt-2">
                <div className="min-w-0">
                    <p className="font-black truncate">{p.cliente}</p>
                    {p.responsable && <p className="text-[10px] text-slate-500">Repostera: {p.responsable}</p>}
                </div>
                <div className="text-right shrink-0">
                    <p className="font-black">{fmt(totalPedido(p))}</p>
                    <p className={cn('text-[10px] font-black', saldo > 0 ? 'text-red-600' : 'text-emerald-600')}>
                        {saldo > 0 ? `Saldo ${fmt(saldo)}` : 'Pagada'}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-1.5">
                {info.siguiente && (
                    <Button size="sm" onClick={onAvanzar} data-avanzar className="flex-1 rounded-xl font-black text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                        {info.accion} <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                    </Button>
                )}
                <Button size="icon" variant="outline" className="rounded-xl h-8 w-8" title="Imprimir comanda" onClick={() => imprimirComanda(p, fmt)}><Printer className="w-4 h-4" /></Button>
                <Button size="icon" variant="outline" className="rounded-xl h-8 w-8" title="Enviar por WhatsApp (con foto)" onClick={() => { compartirPedido(p, fmt).catch(() => {}); }}><MessageCircle className="w-4 h-4" /></Button>
                {p.telefono && <a href={`tel:${p.telefono}`} className="inline-flex items-center justify-center h-8 w-8 rounded-xl border" title="Llamar"><Phone className="w-4 h-4" /></a>}
                <Button size="icon" variant="outline" className="rounded-xl h-8 w-8" title="Editar" onClick={onEditar}><Pencil className="w-4 h-4" /></Button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Formulario (nuevo / editar)
// ─────────────────────────────────────────────────────────────────────────────
function FormularioPedido({ inicial, esNuevo, productos, clientes, trabajadores, fmt, por, onCerrar, onGuardar }: {
    inicial: PedidoTorta; esNuevo: boolean; productos: ProductoRef[];
    clientes: { id: string; nombre: string; telefono?: string }[]; trabajadores: string[];
    fmt: (n: number) => string; por: string;
    onCerrar: () => void; onGuardar: (p: PedidoTorta, imprimir: boolean, metodo: MetodoCobroTorta) => void;
}) {
    const [p, setP] = useState<PedidoTorta>(inicial);
    const [metodo, setMetodo] = useState<MetodoCobroTorta>('efectivo');
    const [busq, setBusq] = useState('');
    const [todo, setTodo] = useState(false);
    const [libre, setLibre] = useState({ nombre: '', precio: '' });
    const [subiendo, setSubiendo] = useState(false);
    const galeriaRef = useRef<HTMLInputElement>(null);
    const camaraRef = useRef<HTMLInputElement>(null);

    const set = <K extends keyof PedidoTorta>(k: K, v: PedidoTorta[K]) => setP(prev => ({ ...prev, [k]: v }));
    const opciones = useMemo(() => opcionesCatalogo(productos, busq, todo), [productos, busq, todo]);
    const hayPinateria = useMemo(() => opcionesCatalogo(productos, '', false).length > 0, [productos]);

    const elegirCliente = (nombre: string) => {
        const c = clientes.find(x => x.nombre.toLowerCase() === nombre.trim().toLowerCase());
        setP(prev => ({ ...prev, cliente: nombre, telefono: prev.telefono || c?.telefono || '' }));
    };

    const subirFotos = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setSubiendo(true);
        try {
            const nuevas: string[] = [];
            for (const f of Array.from(files)) {
                if (p.fotos.length + nuevas.length >= 4) { toast.info('Máximo 4 fotos por pedido'); break; }
                nuevas.push(await comprimirImagen(f));
            }
            setP(prev => ({ ...prev, fotos: [...prev.fotos, ...nuevas] }));
        } catch (e: any) {
            toast.error(e?.message || 'No se pudo cargar la foto');
        } finally { setSubiendo(false); }
    };

    const cambiarCantidad = (id: string, d: number) =>
        setP(prev => ({ ...prev, adicionales: prev.adicionales.map(a => (a.id === id ? { ...a, cantidad: Math.max(0, a.cantidad + d) } : a)).filter(a => a.cantidad > 0) }));

    const guardar = (imprimir: boolean) => {
        const err = validarPedido(p);
        if (err) { toast.error(err); return; }
        onGuardar(p, imprimir, metodo);
    };

    const cancelar = () => {
        if (!window.confirm('¿Cancelar este pedido? Quedará en el historial como cancelado.')) return;
        onGuardar(cambiarEstado(p, 'cancelada', por), false, metodo);
    };

    return (
        <Dialog open onOpenChange={v => { if (!v) onCerrar(); }}>
            <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl">
                <DialogHeader>
                    <DialogTitle className="font-black flex items-center gap-2">
                        <Cake className="w-5 h-5 text-orange-500" /> {esNuevo ? 'Nuevo pedido de torta' : 'Editar pedido'}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-5" data-form-pedido>
                    {/* 1. Cliente y fecha */}
                    <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="space-y-1">
                            <span className="text-[11px] font-black uppercase text-slate-500">Cliente</span>
                            <input list="clientes-tortas" className={inputCls} value={p.cliente} onChange={e => elegirCliente(e.target.value)} placeholder="Nombre del cliente" data-campo="cliente" />
                            <datalist id="clientes-tortas">{clientes.map(c => <option key={c.id} value={c.nombre} />)}</datalist>
                        </label>
                        <label className="space-y-1">
                            <span className="text-[11px] font-black uppercase text-slate-500">WhatsApp / teléfono</span>
                            <input className={inputCls} value={p.telefono} onChange={e => set('telefono', e.target.value)} placeholder="310..." inputMode="tel" />
                        </label>
                        <label className="space-y-1">
                            <span className="text-[11px] font-black uppercase text-slate-500">Fecha de entrega</span>
                            <input type="date" className={inputCls} value={p.fechaEntrega} onChange={e => set('fechaEntrega', e.target.value)} data-campo="fecha" />
                        </label>
                        <label className="space-y-1">
                            <span className="text-[11px] font-black uppercase text-slate-500">Hora</span>
                            <input type="time" className={inputCls} value={p.horaEntrega} onChange={e => set('horaEntrega', e.target.value)} />
                        </label>
                    </section>

                    {/* 2. La torta */}
                    <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <label className="space-y-1 sm:col-span-2">
                            <span className="text-[11px] font-black uppercase text-slate-500">Sabor</span>
                            <input list="sabores-tortas" className={inputCls} value={p.sabor} onChange={e => set('sabor', e.target.value)} placeholder="Tres leches, chocolate…" data-campo="sabor" />
                            <datalist id="sabores-tortas">{SABORES.map(s => <option key={s} value={s} />)}</datalist>
                        </label>
                        <label className="space-y-1">
                            <span className="text-[11px] font-black uppercase text-slate-500">Porciones</span>
                            <input className={inputCls} value={p.porciones} onChange={e => set('porciones', e.target.value)} inputMode="numeric" placeholder="20" />
                        </label>
                        <label className="space-y-1 sm:col-span-3">
                            <span className="text-[11px] font-black uppercase text-slate-500">Diseño / modelo</span>
                            <textarea className={cn(inputCls, 'h-20 py-2')} value={p.diseno} onChange={e => set('diseno', e.target.value)} placeholder="Paw Patrol, colores azul y rojo, con figuras de fondant…" />
                        </label>
                        <label className="space-y-1 sm:col-span-2">
                            <span className="text-[11px] font-black uppercase text-slate-500">Lo que dice la torta</span>
                            <input className={inputCls} value={p.dedicatoria} onChange={e => set('dedicatoria', e.target.value)} placeholder="Feliz cumpleaños Santiago" />
                        </label>
                        <label className="space-y-1">
                            <span className="text-[11px] font-black uppercase text-slate-500">Precio de la torta</span>
                            <input type="number" className={inputCls} value={p.precioBase || ''} onChange={e => set('precioBase', Number(e.target.value) || 0)} placeholder="0" data-campo="precio" />
                        </label>
                    </section>

                    {/* 3. Fotos */}
                    <section className="space-y-2">
                        <p className="text-[11px] font-black uppercase text-slate-500">Fotos del modelo ({p.fotos.length}/4)</p>
                        <div className="flex flex-wrap gap-2">
                            {p.fotos.map((f, i) => (
                                <div key={i} className="relative">
                                    <img src={f} alt="Modelo" className="w-20 h-20 object-cover rounded-xl border" />
                                    <button type="button" onClick={() => set('fotos', p.fotos.filter((_, j) => j !== i))}
                                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center"><X className="w-3.5 h-3.5" /></button>
                                </div>
                            ))}
                            {p.fotos.length < 4 && (
                                <>
                                    <button type="button" onClick={() => camaraRef.current?.click()} disabled={subiendo}
                                        className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-[10px] font-black text-slate-500">
                                        <Camera className="w-5 h-5 mb-0.5" /> Tomar
                                    </button>
                                    <button type="button" onClick={() => galeriaRef.current?.click()} disabled={subiendo}
                                        className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-[10px] font-black text-slate-500">
                                        <ImageIcon className="w-5 h-5 mb-0.5" /> Galería
                                    </button>
                                </>
                            )}
                        </div>
                        <input ref={camaraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { subirFotos(e.target.files); e.target.value = ''; }} />
                        <input ref={galeriaRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { subirFotos(e.target.files); e.target.value = ''; }} />
                    </section>

                    {/* 4. Adicionales (Piñatería del catálogo) */}
                    <section className="space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <p className="text-[11px] font-black uppercase text-slate-500">Adicionales {todo ? '(todo el catálogo)' : '(Piñatería)'}</p>
                            <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                                <input type="checkbox" checked={todo} onChange={e => setTodo(e.target.checked)} /> Ver todo el catálogo
                            </label>
                        </div>
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input className={cn(inputCls, 'pl-9')} value={busq} onChange={e => setBusq(e.target.value)} placeholder="Buscar adicional…" data-buscar-adicional />
                        </div>
                        {!hayPinateria && !todo && (
                            <p className="text-[11px] font-bold text-amber-600">
                                Aún no hay productos de Piñatería en el catálogo. Créalos en Productos (categoría "Piñatería", con precio de venta) y aparecerán aquí solos; mientras tanto marca "Ver todo el catálogo" o agrega uno libre.
                            </p>
                        )}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-44 overflow-y-auto">
                            {opciones.slice(0, 40).map(o => (
                                <button key={o.id} type="button" data-add-producto={o.id}
                                    onClick={() => setP(prev => ({ ...prev, adicionales: agregarAdicional(prev.adicionales, { productoId: o.id, nombre: o.nombre, precio: Number(o.precioVenta) || 0 }) }))}
                                    className="text-left rounded-xl border border-indigo-100 hover:border-indigo-500 hover:bg-indigo-50 dark:border-slate-700 p-2 active:scale-95">
                                    <span className="block text-xs font-black truncate">{o.nombre}</span>
                                    <span className="block text-[11px] font-bold text-slate-500">{fmt(Number(o.precioVenta) || 0)}</span>
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input className={inputCls} placeholder="Adicional libre (ej. letrero)" value={libre.nombre} onChange={e => setLibre({ ...libre, nombre: e.target.value })} />
                            <input className={cn(inputCls, 'w-28')} type="number" placeholder="Precio" value={libre.precio} onChange={e => setLibre({ ...libre, precio: e.target.value })} />
                            <Button type="button" variant="outline" className="rounded-xl" onClick={() => {
                                if (!libre.nombre.trim()) return;
                                setP(prev => ({ ...prev, adicionales: agregarAdicional(prev.adicionales, { nombre: libre.nombre.trim(), precio: Number(libre.precio) || 0 }) }));
                                setLibre({ nombre: '', precio: '' });
                            }}><Plus className="w-4 h-4" /></Button>
                        </div>

                        {p.adicionales.length > 0 && (
                            <div className="rounded-xl border divide-y">
                                {p.adicionales.map(a => (
                                    <div key={a.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                                        <span className="font-bold truncate">{a.nombre}</span>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button type="button" onClick={() => cambiarCantidad(a.id, -1)} className="w-7 h-7 rounded-lg border flex items-center justify-center"><Minus className="w-3.5 h-3.5" /></button>
                                            <span className="w-6 text-center font-black">{a.cantidad}</span>
                                            <button type="button" onClick={() => cambiarCantidad(a.id, 1)} className="w-7 h-7 rounded-lg border flex items-center justify-center"><Plus className="w-3.5 h-3.5" /></button>
                                            <span className="w-20 text-right font-black">{fmt(a.precio * a.cantidad)}</span>
                                            <button type="button" onClick={() => setP(prev => ({ ...prev, adicionales: prev.adicionales.filter(x => x.id !== a.id) }))} className="text-red-500"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* 5. Responsable, notas, pago */}
                    <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <label className="space-y-1">
                            <span className="text-[11px] font-black uppercase text-slate-500">Repostera</span>
                            <select className={inputCls} value={p.responsable} onChange={e => set('responsable', e.target.value)}>
                                <option value="">Sin asignar</option>
                                {trabajadores.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </label>
                        <label className="space-y-1 sm:col-span-2">
                            <span className="text-[11px] font-black uppercase text-slate-500">Notas</span>
                            <input className={inputCls} value={p.notas} onChange={e => set('notas', e.target.value)} placeholder="Alergias, sin nueces, entrega a domicilio…" />
                        </label>
                        <label className="space-y-1">
                            <span className="text-[11px] font-black uppercase text-slate-500">Abono recibido</span>
                            <input type="number" className={inputCls} value={p.abono || ''} onChange={e => set('abono', Number(e.target.value) || 0)} placeholder="0" data-campo="abono" />
                        </label>
                        {pendienteCaja(p) > 0 && (
                            <label className="space-y-1">
                                <span className="text-[11px] font-black uppercase text-slate-500">Abono recibido en</span>
                                <select className={inputCls} value={metodo} onChange={e => setMetodo(e.target.value as MetodoCobroTorta)} data-metodo-abono>
                                    {METODOS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                                </select>
                                <span className="block text-[10px] text-slate-400">Se registra en la caja abierta: {fmt(pendienteCaja(p))}</span>
                            </label>
                        )}
                        <div className="sm:col-span-2 rounded-2xl bg-orange-50 dark:bg-orange-900/10 border border-orange-200 px-4 py-2 flex items-center justify-between text-sm" data-resumen>
                            <div>
                                <p className="text-[11px] text-slate-500 font-bold">Torta {fmt(p.precioBase)} + adicionales {fmt(totalAdicionales(p))}</p>
                                <p className="font-black text-lg">Total {fmt(totalPedido(p))}</p>
                            </div>
                            <p className="font-black text-red-600" data-saldo>Saldo {fmt(saldoPedido(p))}</p>
                        </div>
                    </section>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Button onClick={() => guardar(false)} data-guardar className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black">Guardar pedido</Button>
                        <Button onClick={() => guardar(true)} variant="outline" className="rounded-xl font-black"><Printer className="w-4 h-4 mr-1.5" /> Guardar e imprimir comanda</Button>
                        {!esNuevo && p.estado !== 'cancelada' && p.estado !== 'entregada' && (
                            <Button onClick={cancelar} variant="ghost" className="rounded-xl text-red-600 font-black ml-auto">Cancelar pedido</Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
