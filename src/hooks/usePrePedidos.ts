import { useState, useCallback } from 'react';
import { db } from '@/lib/database';
import type { PrePedido, PrePedidoItem } from '@/types';

/**
 * Hook especializado para gestión de Pre-Pedidos (Órdenes de Compra).
 * Extraído de usePriceControl.ts para mejorar mantenibilidad.
 * 
 * @module usePrePedidos
 * @since v5.2.0
 */
export function usePrePedidos() {
  const [prepedidos, setPrepedidos] = useState<PrePedido[]>([]);

  const addPrePedido = useCallback(async (data: Omit<PrePedido, 'id' | 'fechaCreacion' | 'fechaActualizacion'>) => {
    const now = new Date().toISOString();

    // Auto-generar número de orden correlativo (OC-001, OC-002...)
    const generarNumeroOrden = (lista: PrePedido[]) => {
      const maxNum = lista.reduce((max, p) => {
        const num = parseInt(p.numeroOrden?.replace('OC-', '') || '0');
        return Math.max(max, isNaN(num) ? 0 : num);
      }, 0);
      return `OC-${String(maxNum + 1).padStart(3, '0')}`;
    };

    const nuevoPrePedido: PrePedido = {
      ...data,
      id: crypto.randomUUID(),
      numeroOrden: data.numeroOrden || generarNumeroOrden(prepedidos),
      fechaCreacion: now,
      fechaActualizacion: now,
    };
    await db.addPrePedido(nuevoPrePedido);
    setPrepedidos(prev => [...prev, nuevoPrePedido]);
    return nuevoPrePedido;
  }, [prepedidos]);

  const updatePrePedido = useCallback(async (id: string, updates: Partial<PrePedido>) => {
    const prepedido = prepedidos.find(p => p.id === id);
    if (!prepedido) return;
    const updatedPrePedido = { ...prepedido, ...updates, fechaActualizacion: new Date().toISOString() };
    await db.updatePrePedido(updatedPrePedido);
    setPrepedidos(prev => prev.map(p => p.id === id ? updatedPrePedido : p));
  }, [prepedidos]);

  const deletePrePedido = useCallback(async (id: string) => {
    await db.deletePrePedido(id);
    setPrepedidos(prev => prev.filter(p => p.id !== id));
  }, []);

  const addItemToPrePedido = useCallback(async (prePedidoId: string, item: { productoId: string; proveedorId: string; cantidad: number; precioUnitario: number }) => {
    const prepedido = prepedidos.find(p => p.id === prePedidoId);
    if (!prepedido) return;

    const newItem: PrePedidoItem = {
      ...item,
      id: crypto.randomUUID(),
      subtotal: Math.round(item.cantidad * item.precioUnitario * 100) / 100,
    };

    const newItems = [...prepedido.items, newItem];
    const newTotal = Math.round(newItems.reduce((sum, i) => sum + i.subtotal, 0) * 100) / 100;
    const updatedPrePedido = {
      ...prepedido,
      items: newItems,
      total: newTotal,
      fechaActualizacion: new Date().toISOString(),
    };

    await db.updatePrePedido(updatedPrePedido);
    setPrepedidos(prev => prev.map(p => p.id === prePedidoId ? updatedPrePedido : p));
    return newItem;
  }, [prepedidos]);

  const removeItemFromPrePedido = useCallback(async (prePedidoId: string, itemId: string) => {
    const prepedido = prepedidos.find(p => p.id === prePedidoId);
    if (!prepedido) return;

    const newItems = prepedido.items.filter(i => i.id !== itemId);
    const newTotal = Math.round(newItems.reduce((sum, i) => sum + i.subtotal, 0) * 100) / 100;
    const updatedPrePedido = {
      ...prepedido,
      items: newItems,
      total: newTotal,
      fechaActualizacion: new Date().toISOString(),
    };

    await db.updatePrePedido(updatedPrePedido);
    setPrepedidos(prev => prev.map(p => p.id === prePedidoId ? updatedPrePedido : p));
  }, [prepedidos]);

  const updateItemCantidad = useCallback(async (prePedidoId: string, itemId: string, cantidad: number) => {
    if (cantidad < 1) return;

    const prepedido = prepedidos.find(p => p.id === prePedidoId);
    if (!prepedido) return;

    const newItems = prepedido.items.map(i => {
      if (i.id !== itemId) return i;
      return { ...i, cantidad, subtotal: Math.round(cantidad * i.precioUnitario * 100) / 100 };
    });
    const newTotal = Math.round(newItems.reduce((sum, i) => sum + i.subtotal, 0) * 100) / 100;
    const updatedPrePedido = {
      ...prepedido,
      items: newItems,
      total: newTotal,
      fechaActualizacion: new Date().toISOString(),
    };

    await db.updatePrePedido(updatedPrePedido);
    setPrepedidos(prev => prev.map(p => p.id === prePedidoId ? updatedPrePedido : p));
  }, [prepedidos]);

  const getPrePedidoById = useCallback((id: string) => {
    return prepedidos.find(p => p.id === id);
  }, [prepedidos]);

  const getPrePedidosByProveedor = useCallback((proveedorId: string) => {
    return prepedidos.filter(p => p.proveedorId === proveedorId);
  }, [prepedidos]);

  return {
    prepedidos,
    setPrepedidos,
    addPrePedido,
    updatePrePedido,
    deletePrePedido,
    addItemToPrePedido,
    removeItemFromPrePedido,
    updateItemCantidad,
    getPrePedidoById,
    getPrePedidosByProveedor,
  };
}
