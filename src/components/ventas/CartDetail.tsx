import React, { useState, useMemo } from 'react';
import { ShoppingCart, Users, Minus, Plus, Trash2, CreditCard, DollarSign, Banknote, Zap, X, Tag, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { Producto, MetodoPago } from '@/types';
import { safeNumber } from '@/lib/safe-utils';

interface CartDetailProps {
    cart: { producto: Producto; cantidad: number }[];
    onUpdateQuantity: (id: string, delta: number) => void;
    onRemoveFromCart: (id: string) => void;
    onClearCart: () => void;
    onProcessPayment: (tipo: MetodoPago, trans: 'efectivo' | 'credito') => void;
    formatCurrency: (value: number) => string;
    cajaActiva: any;
    usuario: any;
    cliente: string;
    setCliente: (c: string) => void;
    clientesNombres?: string[];
    activeTabLabel?: string;
    activeTabTipo?: 'venta-rapida' | 'mesa';
    onLiberarMesa?: () => void;
    onTraspasarMesa?: () => void;
    descuento?: number;
    setDescuento?: (v: number) => void;
    rolUsuario?: string;
    onGoToCatalog?: () => void;
}

export function CartDetail({
    cart, onUpdateQuantity, onRemoveFromCart, onClearCart,
    onProcessPayment, formatCurrency, cajaActiva, usuario, cliente, setCliente,
    clientesNombres = [],
    activeTabLabel, activeTabTipo, onLiberarMesa, onTraspasarMesa,
    descuento = 0, setDescuento, rolUsuario,
    onGoToCatalog,
}: CartDetailProps) {

    const [billeteRecibido, setBilleteRecibido] = useState('');
    const [quantityNumpadTarget, setQuantityNumpadTarget] = useState<{ id: string, val: number } | null>(null);

    const totalCart = useMemo(() => cart.reduce((sum, item) => {
        return sum + (safeNumber(item.producto?.precioVenta) * (item.cantidad || 0));
    }, 0), [cart]);

    const totalConDescuento = Math.max(0, totalCart - descuento);
    const totalItems = cart.reduce((s, i) => s + i.cantidad, 0);
    const billete = parseFloat(billeteRecibido || '0');
    const cambio = billete - totalConDescuento;
    const puedeDescuento = rolUsuario === 'ADMIN' || rolUsuario === 'GERENTE';

    const isMesa = activeTabTipo === 'mesa';
    const tabLabel = activeTabLabel || (cliente || 'Venta Rápida');

    return (
        <div className="flex flex-col h-full min-h-0 overflow-hidden bg-white dark:bg-slate-900">
            {/* Header: Pestaña activa + Controles */}
            <div className="shrink-0 h-11 px-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-white shadow-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-6 h-6 bg-indigo-500/25 rounded-lg flex items-center justify-center border border-indigo-500/30 shrink-0">
                        {isMesa ? <Users className="w-3.5 h-3.5 text-blue-400" /> : <ShoppingCart className="w-3.5 h-3.5 text-indigo-400" />}
                    </div>
                    <div className="truncate">
                        <span className="text-xs font-black uppercase tracking-tight block truncate">
                            {tabLabel}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {onGoToCatalog && (
                        <button
                            onClick={onGoToCatalog}
                            className="text-[10px] font-black uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1 active:scale-95 transition-all"
                        >
                            <span>+ Catálogo</span>
                        </button>
                    )}
                    {cart.length > 0 && (
                        <button
                            onClick={onClearCart}
                            className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-rose-500 hover:text-white text-slate-400 flex items-center justify-center transition-all active:scale-90"
                            title="Vaciar ticket"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Barra de Registro de Cliente / Fiado — Ultra clara y táctil */}
            <div className="shrink-0 p-2.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <Users className="w-4 h-4 text-indigo-500 dark:text-indigo-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            className="w-full h-10 pl-9 pr-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/30 outline-none transition-all shadow-sm"
                            placeholder="Cliente / A quién se le fía (nombre)..."
                            value={cliente}
                            onChange={e => setCliente(e.target.value)}
                            list="cart-clientes-list"
                            autoComplete="off"
                        />
                        {cliente && (
                            <button
                                onClick={() => setCliente('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-rose-500 transition-colors"
                                title="Limpiar cliente"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                        {clientesNombres.length > 0 && (
                            <datalist id="cart-clientes-list">
                                {clientesNombres.map(nombre => (
                                    <option key={nombre} value={nombre} />
                                ))}
                            </datalist>
                        )}
                    </div>
                    {isMesa && onTraspasarMesa && (
                        <button
                            onClick={onTraspasarMesa}
                            className="shrink-0 h-10 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase flex items-center gap-1 hover:bg-slate-200 transition-all active:scale-95"
                            title="Traspasar Mesa"
                        >
                            <UserCircle className="w-3.5 h-3.5 text-indigo-500" /> Traspasar
                        </button>
                    )}
                </div>
                {cliente && (
                    <div className="mt-1 px-1 flex items-center justify-between text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                        <span>👤 Ticket asociado a: <strong className="text-slate-900 dark:text-white">{cliente}</strong></span>
                        <span className="text-[9px] uppercase tracking-wider text-slate-400">Listo para fiar o cobrar</span>
                    </div>
                )}
            </div>

            <div className="p-1.5 flex-1 flex flex-col overflow-hidden">
                {/* Lista de productos con más espacio vertical */}
                <div className="flex-1 overflow-y-auto no-scrollbar space-y-1">
                    {cart.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center p-6">
                            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800/80 rounded-2xl flex items-center justify-center mb-3 border border-slate-200/60 dark:border-slate-700/60 text-slate-400">
                                <ShoppingCart className="w-8 h-8" />
                            </div>
                            <p className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">Ticket Vacío</p>
                            <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                                {cliente ? `Cliente asignado: "${cliente}". Agrega productos del catálogo para procesar venta o fiado.` : 'Toca productos del catálogo para agregarlos a este ticket.'}
                            </p>
                            {onGoToCatalog && (
                                <Button
                                    onClick={onGoToCatalog}
                                    className="mt-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider h-10 px-4 shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
                                >
                                    🛍️ Ver Catálogo de Productos
                                </Button>
                            )}
                        </div>
                    ) : (
                        cart.map((item, idx) => (
                            <div key={`${item.producto.id}-${idx}`} className="group flex items-center gap-4 p-4 bg-white dark:bg-slate-800/40 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 hover:border-indigo-500/50 transition-all shadow-sm">
                                <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 shadow-inner">
                                    {item.producto.imagen ? (
                                        <img className="w-full h-full object-cover" src={item.producto.imagen} alt={item.producto.nombre} />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-2xl">🍞</div>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-black text-slate-800 dark:text-slate-100 line-clamp-2 leading-snug uppercase tracking-tight">
                                        {item.producto.nombre}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            {formatCurrency(safeNumber(item.producto.precioVenta))} /
                                            {(() => {
                                                // Soporte para tipo de empaque
                                                const tipo = item.producto.tipoEmbalaje?.toLowerCase?.() || 'unidad';
                                                const cantidad = item.producto.cantidadEmbalaje || 1;
                                                if (tipo === 'paca') return ` PACA x${cantidad}`;
                                                if (tipo === 'bolsa') return ` BOLSA x${cantidad}`;
                                                if (tipo === 'caja') return ` CAJA x${cantidad}`;
                                                if (tipo === 'saco') return ` SACO x${cantidad}`;
                                                return ' UNIDAD';
                                            })()}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2 mt-3">
                                        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                            <button className="h-8 w-8 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 transition-all active:scale-75 rounded-l-xl" onClick={() => onUpdateQuantity(item.producto.id, -1)}>
                                                <Minus className="w-3.5 h-3.5" />
                                            </button>
                                            <button 
                                                onClick={() => setQuantityNumpadTarget({ id: item.producto.id, val: item.cantidad })}
                                                className="w-10 text-center text-sm font-black tabular-nums bg-transparent border-none outline-none text-slate-900 dark:text-white active:scale-95 transition-all"
                                            >
                                                {item.cantidad}
                                            </button>
                                            <button className="h-8 w-8 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 transition-all active:scale-75 rounded-r-xl" onClick={() => onUpdateQuantity(item.producto.id, 1)}>
                                                <Plus className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col items-end justify-between self-stretch py-1">
                                    <button onClick={() => onRemoveFromCart(item.producto.id)} className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg">
                                        <X className="w-4 h-4" />
                                    </button>
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Subtotal</p>
                                        <p className="text-base font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                                            {formatCurrency(safeNumber(item.producto.precioVenta) * item.cantidad)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer de Pago Compacto */}
                <div className="shrink-0 p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 space-y-3">
                    {/* Billetes rápidos */}
                    {cart.length > 0 && (
                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                            {[1000, 2000, 5000, 10000, 20000, 50000].map(b => (
                                <button key={b} onClick={() => setBilleteRecibido(b.toString())}
                                    className="px-3 py-2 rounded-xl text-[10px] font-bold uppercase bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-indigo-500 transition-all">
                                    {(b / 1000)}K
                                </button>
                            ))}
                            <button onClick={() => setBilleteRecibido(totalConDescuento.toString())}
                                className="px-3 py-2 rounded-xl text-[10px] font-bold uppercase bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400">
                                Exacto
                            </button>
                        </div>
                    )}

                    {/* Descuento — solo ADMIN/GERENTE */}
                    {puedeDescuento && cart.length > 0 && (
                        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-3 py-2 border border-amber-200 dark:border-amber-800">
                            <Tag className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest shrink-0">Descuento $</span>
                            <input
                                type="number"
                                min={0}
                                max={totalCart}
                                value={descuento || ''}
                                placeholder="0"
                                onChange={e => setDescuento?.(Math.max(0, parseFloat(e.target.value) || 0))}
                                className="flex-1 text-right text-sm font-black bg-transparent border-none outline-none text-amber-700 dark:text-amber-300 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            {descuento > 0 && (
                                <button onClick={() => setDescuento?.(0)} className="text-amber-500 hover:text-amber-700 shrink-0">
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    )}

                    {/* Resumen de Pago - Franja Delgada */}
                    <div className="bg-slate-900 rounded-lg p-2.5 flex items-center justify-between border border-slate-800 shadow-sm">
                        <div className="flex flex-col px-2">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Total</span>
                            {descuento > 0 && (
                                <span className="text-[9px] text-slate-600 line-through tabular-nums">{formatCurrency(totalCart)}</span>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <DollarSign className="w-4 h-4 text-indigo-400" />
                            <p className="text-xl font-black text-white tabular-nums px-2">
                                {formatCurrency(totalConDescuento)}
                            </p>
                        </div>
                    </div>

                    {/* Botones de Acción */}
                    <div className="grid grid-cols-[1.1fr_2fr] gap-2.5">
                        <Button
                            variant="outline"
                            disabled={cart.length === 0}
                            onClick={() => onProcessPayment('efectivo', 'credito')}
                            className={cn(
                                "h-14 sm:h-16 rounded-2xl border-2 font-black uppercase text-xs tracking-wider flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-all shadow-sm",
                                cart.length === 0
                                    ? "border-slate-200 dark:border-slate-800 text-slate-400 bg-slate-50 dark:bg-slate-800/40"
                                    : "border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-700 dark:text-amber-300"
                            )}
                        >
                            <span className="flex items-center gap-1">📋 Fiado / Nota</span>
                            <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 lowercase font-sans">a crédito</span>
                        </Button>
                        {isMesa && cart.length === 0 ? (
                            // Botón dedicado para liberar mesa sin consumo
                            <Button
                                onClick={onLiberarMesa}
                                className="h-14 sm:h-16 rounded-2xl font-black uppercase text-xs tracking-widest transition-all active:scale-95 bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20"
                            >
                                Liberar Mesa
                            </Button>
                        ) : (
                            <Button
                                disabled={cart.length === 0}
                                onClick={() => onProcessPayment('efectivo', 'efectivo')}
                                className="h-14 sm:h-16 rounded-2xl font-black uppercase text-xs sm:text-sm tracking-widest transition-all active:scale-95 bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-600/30 border-2 border-emerald-400"
                            >
                                💰 COBRAR {cart.length > 0 ? formatCurrency(totalConDescuento) : ''}
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal de Teclado Numérico Táctil para Cantidades (Paso 3) */}
            <Dialog open={!!quantityNumpadTarget} onOpenChange={(open) => !open && setQuantityNumpadTarget(null)}>
                <DialogContent className="max-w-[300px] rounded-3xl p-0 border border-slate-200 dark:border-slate-800 shadow-2xl bg-slate-50 dark:bg-slate-950 hide-close-button">
                    <div className="p-5 flex flex-col items-center border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-t-3xl">
                        <span className="text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Cantidad</span>
                        <span className="text-5xl font-black tabular-nums text-indigo-600 dark:text-indigo-400">
                            {quantityNumpadTarget?.val || 0}
                        </span>
                    </div>
                    <div className="p-4 grid grid-cols-3 gap-3">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                            <button
                                key={n}
                                onClick={() => setQuantityNumpadTarget(prev => prev ? { ...prev, val: parseInt(`${prev.val === 0 ? '' : prev.val}${n}`) } : null)}
                                className="h-14 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-2xl font-black shadow-sm active:scale-95 transition-all text-slate-700 dark:text-slate-200 hover:bg-slate-100"
                            >
                                {n}
                            </button>
                        ))}
                        <button
                            onClick={() => setQuantityNumpadTarget(prev => prev ? { ...prev, val: 0 } : null)}
                            className="h-14 rounded-2xl bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-900/50 text-rose-500 font-black uppercase active:scale-95 transition-all text-sm"
                        >
                            Borrar
                        </button>
                        <button
                            onClick={() => setQuantityNumpadTarget(prev => prev ? { ...prev, val: parseInt(`${prev.val === 0 ? '' : prev.val}0`) } : null)}
                            className="h-14 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-2xl font-black shadow-sm active:scale-95 transition-all text-slate-700 dark:text-slate-200 hover:bg-slate-100"
                        >
                            0
                        </button>
                        <button
                            onClick={() => {
                                if (quantityNumpadTarget && quantityNumpadTarget.val > 0) {
                                    const currentCartItem = cart.find(i => i.producto.id === quantityNumpadTarget.id);
                                    if (currentCartItem) {
                                        onUpdateQuantity(quantityNumpadTarget.id, quantityNumpadTarget.val - currentCartItem.cantidad);
                                    }
                                }
                                setQuantityNumpadTarget(null);
                            }}
                            className="h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white border border-emerald-600 font-black uppercase shadow-lg shadow-emerald-500/30 active:scale-95 transition-all text-sm"
                        >
                            OK
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
