/**
 * useInventario — Sub-hook para gestión de inventario, movimientos y recepciones
 * Extraído de usePriceControl.ts para reducir su tamaño
 */
import { useState, useCallback } from 'react';
import { db } from '@/lib/database';
import type { 
  InventarioItem, 
  MovimientoInventario, 
  Recepcion, 
  Producto,
  PrePedido
} from '@/types';
import { toast } from 'sonner';

interface UseInventarioParams {
  productos: Producto[];
}

export function useInventario({ productos }: UseInventarioParams) {
  const [inventario, setInventario] = useState<InventarioItem[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([]);
  const [recepciones, setRecepciones] = useState<Recepcion[]>([]);

  // --- Lógica de Inventario (onAjustarStock) ---
  const onAjustarStock = useCallback(async (productoId: string, cantidad: number, tipo: 'entrada' | 'salida', motivo: string) => {
    try {
      const dbItem = await db.getInventarioItemByProducto(productoId);
      const stockActual = dbItem ? dbItem.stockActual : 0;
      const nuevoStock = tipo === 'entrada' ? stockActual + cantidad : Math.max(0, stockActual - cantidad);

      // 1. Actualizar/Crear ítem de inventario
      const item: InventarioItem = {
        id: dbItem?.id || crypto.randomUUID(),
        productoId,
        stockActual: nuevoStock,
        stockMinimo: dbItem?.stockMinimo || 10,
        ultimoMovimiento: new Date().toISOString()
      };
      await db.updateInventarioItem(item as any);
      
      setInventario(prev => {
        const existe = prev.find(i => i.productoId === productoId);
        if (existe) return prev.map(i => i.productoId === productoId ? item : i);
        return [...prev, item];
      });

      // 2. Registrar movimiento
      const movimiento: MovimientoInventario = {
        id: crypto.randomUUID(),
        productoId,
        tipo: tipo === 'entrada' ? 'entrada' : 'salida',
        cantidad,
        motivo,
        fecha: new Date().toISOString(),
        usuario: 'admin'
      };
      await db.addMovimiento(movimiento as any);
      setMovimientos(prev => [movimiento, ...prev]);

    } catch (error) {
      console.error('Error al ajustar stock:', error);
      toast.error('Error al actualizar inventario');
    }
  }, []);

  // --- Recepciones de Mercancía ---
  const addRecepcion = useCallback(async (recepcion: Recepcion) => {
    await db.addRecepcion(recepcion as any);
    setRecepciones(prev => [recepcion, ...prev]);
    toast.success('Recepción creada correctamente');
  }, []);

  const confirmarRecepcion = useCallback(async (recepcion: Recepcion, prePedido?: PrePedido) => {
    // 1. Actualizar estado de recepción
    const updatedRecepcion: Recepcion = { ...recepcion, estado: 'completada' };
    await db.updateRecepcion(updatedRecepcion as any);
    setRecepciones(prev => prev.map(r => r.id === recepcion.id ? updatedRecepcion : r));

    // 2. Ajustar Stock para cada item
    for (const item of recepcion.items) {
      if (item.cantidadRecibida > 0) {
        await onAjustarStock(
          item.productoId,
          item.cantidadRecibida,
          'entrada',
          `Recepción: ${recepcion.numeroFactura}`
        );
      }
    }

    // 3. Si venía de un pre-pedido, marcarlo como completado/recibido (opcional)
    if (prePedido && db.updatePrePedido) {
      await db.updatePrePedido({ ...prePedido, estado: 'confirmado' } as any);
    }

    toast.success('Insumos cargados al inventario con éxito');
  }, [onAjustarStock]);

  const updateRecepcion = useCallback(async (id: string, updates: Partial<Recepcion>) => {
    const recepcion = recepciones.find(r => r.id === id);
    if (!recepcion) return;
    const updatedRecepcion = { ...recepcion, ...updates };
    await db.updateRecepcion(updatedRecepcion as any);
    setRecepciones(prev => prev.map(r => r.id === id ? updatedRecepcion : r));
  }, [recepciones]);

  const getRecepcionesByProveedor = useCallback((proveedorId: string) => {
    return recepciones.filter(r => r.proveedorId === proveedorId);
  }, [recepciones]);

  return {
    // State
    inventario, setInventario,
    movimientos, setMovimientos,
    recepciones, setRecepciones,

    // Actions
    onAjustarStock,
    addRecepcion,
    confirmarRecepcion,
    updateRecepcion,
    getRecepcionesByProveedor
  };
}
