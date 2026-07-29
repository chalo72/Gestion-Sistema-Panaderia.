import { generateUUID } from '@/lib/safe-utils';
/**
 * useInventario — Sub-hook para gestión de inventario, movimientos y recepciones
 * Extraído de usePriceControl.ts para reducir su tamaño
 */
import { useState, useCallback, useEffect } from 'react';
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
  const onAjustarStock = useCallback(async (productoId: string, cantidad: number, tipo: 'entrada' | 'salida' | 'ajuste', motivo: string) => {
    try {
      const dbItem = await db.getInventarioItemByProducto(productoId);
      const stockActual = dbItem ? dbItem.stockActual : 0;
      // entrada: suma · salida: resta · ajuste: cantidad = stock absoluto deseado
      const nuevoStock =
        tipo === 'entrada'
          ? stockActual + cantidad
          : tipo === 'salida'
            ? Math.max(0, stockActual - cantidad)
            : Math.max(0, cantidad);
      const deltaMov = nuevoStock - stockActual;
      const tipoMov: 'entrada' | 'salida' =
        tipo === 'entrada' ? 'entrada' : tipo === 'salida' ? 'salida' : (deltaMov >= 0 ? 'entrada' : 'salida');
      const cantidadMov = tipo === 'ajuste' ? Math.abs(deltaMov) : cantidad;

      // Lógica predictiva: Registrar si se agotó
      let nuevaFechaAgotado = dbItem?.fechaAgotado;
      if (nuevoStock === 0 && stockActual > 0) {
        nuevaFechaAgotado = new Date().toISOString();
      } else if (nuevoStock > 0) {
        nuevaFechaAgotado = undefined; // Ya no está agotado
      }

      // 1. Actualizar/Crear ítem de inventario
      const item: InventarioItem = {
        id: dbItem?.id || generateUUID(),
        productoId,
        stockActual: nuevoStock,
        stockMinimo: dbItem?.stockMinimo || 10,
        ultimoMovimiento: new Date().toISOString(),
        fechaAgotado: nuevaFechaAgotado,
        velocidadVentaDiaria: dbItem?.velocidadVentaDiaria,
        diasParaAgotarse: dbItem?.diasParaAgotarse
      };
      await db.updateInventarioItem(item as any);
      
      setInventario(prev => {
        const existe = prev.find(i => i.productoId === productoId);
        if (existe) return prev.map(i => i.productoId === productoId ? item : i);
        return [...prev, item];
      });

      // 2. Registrar movimiento (si ajuste no cambió nada, no registrar)
      if (tipo === 'ajuste' && cantidadMov === 0) return;

      const usuarioActual = (() => {
        try {
          const u = localStorage.getItem('pricecontrol_local_user');
          return u ? (JSON.parse(u)?.nombre || 'sistema') : 'sistema';
        } catch { return 'sistema'; }
      })();
      const movimiento: MovimientoInventario = {
        id: generateUUID(),
        productoId,
        tipo: tipoMov,
        cantidad: cantidadMov,
        motivo: tipo === 'ajuste' ? `Ajuste a ${nuevoStock}: ${motivo}` : motivo,
        fecha: new Date().toISOString(),
        usuario: usuarioActual
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

    // 3. Si venía de un pre-pedido, marcarlo como recibido para que salga de pendientes
    if (prePedido && db.updatePrePedido) {
      await db.updatePrePedido({ ...prePedido, estado: 'recibido' } as any);
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

  // Sync bidireccional: actualiza React state cuando otro dispositivo hace cambios
  useEffect(() => {
    const handle = async (e: Event) => {
      const { table, eventType, id } = (e as CustomEvent<{ table: string; eventType: string; id: string }>).detail;

      if (table === 'inventario') {
        // El inventario no se elimina, siempre se actualiza
        db.getAllInventario().then(setInventario as any).catch(() => {});
      } else if (table === 'recepciones') {
        if (eventType === 'DELETE') {
          setRecepciones(prev => prev.filter(r => r.id !== id));
        } else {
          db.getAllRecepciones().then(setRecepciones as any).catch(() => {});
        }
      }
    };
    window.addEventListener('nexus-realtime-change', handle);
    return () => window.removeEventListener('nexus-realtime-change', handle);
  }, []);

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
