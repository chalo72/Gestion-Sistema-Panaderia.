import React, { useState, useMemo } from 'react';
import { ShoppingCart, Users, Minus, Plus, Trash2, CreditCard, DollarSign, Banknote, Zap, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
    // Identificador de la pestaña activa
    activeTabLabel?: string;
    activeTabTipo?: 'venta-rapida' | 'mesa';
}

export function CartDetail({
    cart, onUpdateQuantity, onRemoveFromCart, onClearCart,
    onProcessPayment, formatCurrency, cajaActiva, usuario, cliente, setCliente,
    activeTabLabel, activeTabTipo,
}: CartDetailProps) {

    const [billeteRecibido, setBilleteRecibido] = useState('');
    const [showDailyReport, setShowDailyReport] = useState(false);
    const [showAperturaModal, setShowAperturaModal] = useState(false);

    const totalCart = useMemo(() => cart.reduce((sum, item) => {
        return sum + (safeNumber(item.producto?.precioVenta) * (item.cantidad || 0));
    }, 0), [cart]);

    const totalItems = cart.reduce((s, i) => s + i.cantidad, 0);
    const billete = parseFloat(billeteRecibido || '0');
    const cambio = billete - totalCart;

    const isMesa = activeTabTipo === 'mesa';
    const tabLabel = activeTabLabel || (cliente || 'Venta Rápida');

    return (
        <div className="flex flex-col h-full min-h-0 overflow-hidden bg-white dark:bg-slate-900">
            {/* Header Fusionado - Estirado hacia arriba con Identificador */}
            <div className="shrink-0 h-10 px-3 bg-slate-900 border-b border-slate-800 flex items-center gap-3">
                <div className="flex items-center gap-2 shrink-0">
                    <div className="w-5 h-5 bg-indigo-500/20 rounded-md flex items-center justify-center border border-indigo-500/20">
                        <ShoppingCart className="w-3 h-3 text-indigo-400" />
                    </div>
                    <span className="text-[9px] font-black text-indigo-300 uppercase tracking-tighter">
                        {isMesa ? 'Servicio Mesa' : 'Venta Rápida'}
                    </span>
                </div>

                <div className="flex items-center gap-2 bg-white/5 rounded-md px-2 py-1 flex-1 h-7 border border-white/5">
                    {!isMesa ? (
                        <div className="flex items-center gap-2 w-full">
                            <Zap className="w-3 h-3 text-slate-600" />
                            <input
                                className="flex-1 bg-transparent border-none p-0 focus:ring-0 text-[10px] font-bold text-white placeholder:text-slate-600"
                                placeholder="Cliente..."
                                value={cliente}
                                onChange={e => setCliente(e.target.value)}
                            />
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 w-full">
                            <Users className="w-3 h-3 text-blue-400" />
                            <p className="text-[10px] font-bold text-white uppercase truncate">{tabLabel}</p>
                        </div>
                    )}
                </div>
                {cart.length > 0 && (
                    <button onClick={onClearCart} className="text-slate-500 hover:text-rose-500 transition-colors shrink-0">
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            <div className="p-1.5 flex-1 flex flex-col overflow-hidden">
                {/* Lista de productos con más espacio vertical */}
                <div className="flex-1 overflow-y-auto no-scrollbar space-y-1">
                    {cart.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center opacity-40">
                            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
                                <ShoppingCart className="w-8 h-8 text-slate-400" />
                            </div>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest leading-none">Esperando Pedido</p>
                            <p className="text-[10px] text-slate-400 mt-2">Agregue productos del catálogo para comenzar</p>
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
                                    <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate leading-tight uppercase tracking-tight">
                                        {item.producto.nombre}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatCurrency(safeNumber(item.producto.precioVenta))} / UNID</span>
                                    </div>

                                    <div className="flex items-center gap-2 mt-3">
                                        <div className="flex items-center bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                                            <button className="h-8 w-8 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-all active:scale-75" onClick={() => onUpdateQuantity(item.producto.id, -1)}>
                                                <Minus className="w-3.5 h-3.5" />
                                            </button>
                                            <span className="w-8 text-center text-xs font-black tabular-nums">{item.cantidad}</span>
                                            <button className="h-8 w-8 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-all active:scale-75" onClick={() => onUpdateQuantity(item.producto.id, 1)}>
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
                            <button onClick={() => setBilleteRecibido(totalCart.toString())}
                                className="px-3 py-2 rounded-xl text-[10px] font-bold uppercase bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400">
                                Exacto
                            </button>
                        </div>
                    )}

                    {/* Resumen de Pago - Franja Delgada */}
                    <div className="bg-slate-900 rounded-lg p-2.5 flex items-center justify-between border border-slate-800 shadow-sm">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-2">Total</span>
                        <div className="flex items-center gap-3">
                            <DollarSign className="w-4 h-4 text-indigo-400" />
                            <p className="text-xl font-black text-white tabular-nums px-2">
                                {formatCurrency(totalCart)}
                            </p>
                        </div>
                    </div>

                    {/* Botones de Acción */}
                    <div className="grid grid-cols-2 gap-2">
                        <Button
                            variant="outline"
                            disabled={cart.length === 0 && !isMesa}
                            onClick={() => onProcessPayment('efectivo', 'credito')}
                            className="h-12 rounded-xl border-2 border-slate-100 dark:border-slate-800 text-slate-500 font-bold uppercase text-[9px] tracking-widest"
                        >
                            {cart.length === 0 ? 'Vacío' : 'Fiado / Nota'}
                        </Button>
                        <Button
                            disabled={cart.length === 0 && !isMesa}
                            onClick={() => onProcessPayment('efectivo', 'efectivo')}
                            className={cn(
                                "h-12 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all active:scale-95",
                                cart.length === 0
                                    ? "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20"
                                    : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20"
                            )}
                        >
                            {cart.length === 0 && isMesa ? 'Liberar Mesa' : 'Finalizar Venta'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
