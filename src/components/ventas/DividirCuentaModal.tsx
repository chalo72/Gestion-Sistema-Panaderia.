import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { ArrowRight, ArrowLeft, Receipt, X } from 'lucide-react';
import type { Producto } from '@/types';

// Como el CartItem local de Ventas.tsx puede variar, definimos uno compatible
interface LocalCartItem {
  producto: Producto;
  cantidad: number;
}

interface DividirCuentaModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartOriginal: LocalCartItem[];
  onCobrarParcial: (itemsParaCobrar: LocalCartItem[], itemsRestantes: LocalCartItem[]) => void;
}

export function DividirCuentaModal({ isOpen, onClose, cartOriginal, onCobrarParcial }: DividirCuentaModalProps) {
  // Estado local para los dos lados
  const [leftCart, setLeftCart] = useState<LocalCartItem[]>([]);
  const [rightCart, setRightCart] = useState<LocalCartItem[]>([]);

  // Reiniciar cuando se abre
  useEffect(() => {
    if (isOpen) {
      setLeftCart(JSON.parse(JSON.stringify(cartOriginal))); // Copia profunda simple
      setRightCart([]);
    }
  }, [isOpen, cartOriginal]);

  const leftTotal = useMemo(() => leftCart.reduce((sum, item) => sum + (Number(item.producto.precioVenta) || 0) * item.cantidad, 0), [leftCart]);
  const rightTotal = useMemo(() => rightCart.reduce((sum, item) => sum + (Number(item.producto.precioVenta) || 0) * item.cantidad, 0), [rightCart]);

  const moverDerecha = (prodId: string) => {
    setLeftCart(prev => {
      const idx = prev.findIndex(i => i.producto.id === prodId);
      if (idx === -1) return prev;
      const arr = [...prev];
      const item = arr[idx];
      
      // Mover a derecha
      setRightCart(rp => {
        const rArr = [...rp];
        const rIdx = rArr.findIndex(i => i.producto.id === prodId);
        if (rIdx >= 0) rArr[rIdx].cantidad += 1;
        else rArr.push({ producto: item.producto, cantidad: 1 });
        return rArr;
      });

      if (item.cantidad > 1) {
        arr[idx] = { ...item, cantidad: item.cantidad - 1 };
      } else {
        arr.splice(idx, 1);
      }
      return arr;
    });
  };

  const moverIzquierda = (prodId: string) => {
    setRightCart(prev => {
      const idx = prev.findIndex(i => i.producto.id === prodId);
      if (idx === -1) return prev;
      const arr = [...prev];
      const item = arr[idx];
      
      // Mover a izquierda
      setLeftCart(lp => {
        const lArr = [...lp];
        const lIdx = lArr.findIndex(i => i.producto.id === prodId);
        if (lIdx >= 0) lArr[lIdx].cantidad += 1;
        else lArr.push({ producto: item.producto, cantidad: 1 });
        return lArr;
      });

      if (item.cantidad > 1) {
        arr[idx] = { ...item, cantidad: item.cantidad - 1 };
      } else {
        arr.splice(idx, 1);
      }
      return arr;
    });
  };

  const moverTodoDerecha = (prodId: string) => {
    setLeftCart(prev => {
      const idx = prev.findIndex(i => i.producto.id === prodId);
      if (idx === -1) return prev;
      const arr = [...prev];
      const item = arr.splice(idx, 1)[0];
      
      setRightCart(rp => {
        const rArr = [...rp];
        const rIdx = rArr.findIndex(i => i.producto.id === prodId);
        if (rIdx >= 0) rArr[rIdx].cantidad += item.cantidad;
        else rArr.push(item);
        return rArr;
      });
      return arr;
    });
  };

  const handleConfirmar = () => {
    if (rightCart.length === 0) return;
    onCobrarParcial(rightCart, leftCart);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 border-none rounded-3xl overflow-hidden shadow-2xl bg-slate-50 dark:bg-slate-900">
        <DialogTitle className="sr-only">Dividir Cuenta</DialogTitle>
        <DialogDescription className="sr-only">Divide los productos de la mesa para cobrar cuentas separadas</DialogDescription>
        
        {/* Header */}
        <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-widest">Dividir Cuenta</h2>
              <p className="text-xs text-indigo-200">Toca los productos que la primera persona va a pagar</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content (2 columnas) */}
        <div className="grid grid-cols-2 h-[60vh] divide-x divide-slate-200 dark:divide-slate-800">
          
          {/* Lado Izquierdo: Mesa Original */}
          <div className="flex flex-col bg-white dark:bg-slate-950">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest">Se quedan en la Mesa</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {leftCart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <p className="text-xs font-bold uppercase">Mesa vacía</p>
                </div>
              ) : (
                leftCart.map(item => (
                  <div key={item.producto.id} className="flex items-center p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-indigo-200 bg-white dark:bg-slate-900 shadow-sm transition-colors group">
                    <div className="flex-1">
                      <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{item.producto.nombre}</p>
                      <p className="text-xs font-semibold text-slate-500">{formatCurrency(Number(item.producto.precioVenta) || 0)} c/u</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-black bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">x{item.cantidad}</span>
                      <div className="flex flex-col gap-1">
                        <button onClick={() => moverTodoDerecha(item.producto.id)} className="text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded transition-colors hidden group-hover:block uppercase">Todos</button>
                        <button onClick={() => moverDerecha(item.producto.id)} className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center hover:bg-indigo-200 hover:scale-110 transition-all shadow-sm">
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Restante Mesa</span>
              <span className="text-xl font-black text-slate-700 dark:text-slate-300">{formatCurrency(leftTotal)}</span>
            </div>
          </div>

          {/* Lado Derecho: Cuenta a Cobrar */}
          <div className="flex flex-col bg-indigo-50/30 dark:bg-indigo-950/20">
            <div className="p-4 border-b border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/80 dark:bg-indigo-900/30">
              <h3 className="text-sm font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Van a pagar ahora</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {rightCart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-indigo-300 dark:text-indigo-800">
                  <ArrowRight className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-xs font-bold uppercase text-center max-w-[200px]">Toca los productos en el lado izquierdo para agregarlos a esta cuenta</p>
                </div>
              ) : (
                rightCart.map(item => (
                  <div key={item.producto.id} className="flex items-center p-3 rounded-xl border border-indigo-100 dark:border-indigo-800/50 bg-white dark:bg-slate-900 shadow-sm">
                    <div className="mr-3">
                      <button onClick={() => moverIzquierda(item.producto.id)} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center hover:bg-slate-200 hover:scale-110 transition-all">
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{item.producto.nombre}</p>
                      <p className="text-xs font-semibold text-slate-500">{formatCurrency((Number(item.producto.precioVenta) || 0) * item.cantidad)}</p>
                    </div>
                    <span className="text-sm font-black bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-lg">x{item.cantidad}</span>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 bg-white dark:bg-slate-950 border-t border-indigo-100 dark:border-indigo-900/50 flex flex-col gap-3 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] relative z-10">
              <div className="flex justify-between items-end">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Total Parcial</span>
                <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400">{formatCurrency(rightTotal)}</span>
              </div>
              <Button 
                onClick={handleConfirmar} 
                disabled={rightCart.length === 0}
                className="w-full h-14 rounded-xl font-black text-base uppercase tracking-widest shadow-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
              >
                Cobrar esta parte
              </Button>
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
