import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/database';
import type { Producto, InventarioItem, PrecioProveedor, Receta, Venta } from '@/types';

export interface SugerenciaPedido {
  productoId: string;
  productoNombre: string;
  proveedorId: string;
  stockActual: number;
  velocidadDiaria: number;
  diasAgotado: number;
  cantidadSugeridaTotal: number;
  cantidadEmbalaje?: number;
  tipoEmbalaje?: string;
  pacasSugeridas?: number;
  unidadesSueltasSugeridas?: number;
}

export function usePredictiveStock() {
  const [sugerencias, setSugerencias] = useState<SugerenciaPedido[]>([]);
  const [loading, setLoading] = useState(false);

  const generarSugerencias = useCallback(async (proveedorId?: string) => {
    setLoading(true);
    try {
      // 1. Obtener datos
      const [productos, preciosProveedor, movimientosRaw, inventarioRaw, ventasRaw, recetasRaw] = await Promise.all([
        db.getAllProductos(),
        db.adapter.getCollection('precios_proveedor') as Promise<PrecioProveedor[]>,
        db.getAllMovimientos(),
        db.adapter.getCollection('inventario') as Promise<InventarioItem[]>,
        db.getAllVentas() as Promise<Venta[]>,
        db.adapter.getCollection('recetas') as Promise<Receta[]>
      ]);

      // Filtrar últimos 15 días
      const hace15Dias = new Date();
      hace15Dias.setDate(hace15Dias.getDate() - 15);
      
      const movimientosRecientes = movimientosRaw.filter(m => 
        m.tipo === 'salida' && new Date(m.fecha) >= hace15Dias
      );

      const ventasRecientes = ventasRaw.filter(v => 
        new Date(v.fecha) >= hace15Dias
      );

      // Calcular velocidad de venta diaria (Directa + Indirecta por Receta)
      const velocidadPorProducto: Record<string, number> = {};
      
      // 1. Consumo directo (desde movimientos de inventario)
      movimientosRecientes.forEach(m => {
        velocidadPorProducto[m.productoId] = (velocidadPorProducto[m.productoId] || 0) + m.cantidad;
      });

      // 2. Consumo indirecto (Ventas de elaborados -> Recetas -> Insumos)
      ventasRecientes.forEach(v => {
        v.items.forEach(item => {
          // Buscar receta para este producto elaborado
          const receta = recetasRaw.find(r => r.productoId === item.productoId);
          if (receta) {
            receta.ingredientes.forEach(ing => {
              // Calcular consumo proporcional del insumo basado en las porciones
              const consumoUnidad = ing.cantidad / (receta.porcionesResultantes || 1);
              const consumoTotalVenta = consumoUnidad * item.cantidad;
              velocidadPorProducto[ing.productoId] = (velocidadPorProducto[ing.productoId] || 0) + consumoTotalVenta;
            });
          }
        });
      });

      // 2. Filtrar por proveedor si se especifica
      const productosAAnalizar = productos.filter(p => {
        if (!proveedorId) return true;
        return preciosProveedor.some(pp => pp.productoId === p.id && pp.proveedorId === proveedorId);
      });

      const nuevasSugerencias: SugerenciaPedido[] = [];

      for (const prod of productosAAnalizar) {
        const inv = inventarioRaw.find(i => i.productoId === prod.id) || {
          productoId: prod.id,
          stockActual: 0,
          stockMinimo: 5
        } as InventarioItem;

        const pp = preciosProveedor.find(pp => pp.productoId === prod.id);
        const provId = pp ? pp.proveedorId : 'sin-proveedor';

        if (proveedorId && provId !== proveedorId) continue;

        // Velocidad = cantidad total en 15 dias / 15 dias
        // Si no hay historial, asume 1 diario si el stock es 0, para dar una sugerencia
        let velDiaria = (velocidadPorProducto[prod.id] || 0) / 15;
        if (velDiaria === 0 && inv.stockActual === 0) velDiaria = 1.2; // Mock inteligente

        // Calcular días agotado
        let diasAgotado = 0;
        if (inv.fechaAgotado && inv.stockActual === 0) {
          const ms = new Date().getTime() - new Date(inv.fechaAgotado).getTime();
          diasAgotado = Math.floor(ms / (1000 * 60 * 60 * 24));
        }

        // --- CORE ALGORITHM ---
        // 1. Días a cubrir = 7 (asumiendo visita semanal por defecto)
        const frecuenciaDias = 7;
        
        // 2. Stock de seguridad = 5 unidades
        const stockSeguridad = 5;

        // 3. Ventas perdidas durante el tiempo agotado (estimadas)
        const ventasPerdidas = Math.floor(diasAgotado * velDiaria);

        // 4. Consumo proyectado hasta la próxima visita
        const consumoProyectado = Math.floor(frecuenciaDias * velDiaria);

        // 5. Total requerido
        let totalRequerido = consumoProyectado + stockSeguridad + ventasPerdidas;
        
        // Restar lo que ya hay en stock
        totalRequerido = totalRequerido - inv.stockActual;
        
        if (totalRequerido < 0) totalRequerido = 0;

        // 6. Conversión a Pacas/Embalaje
        let pacasSugeridas = 0;
        let sueltas = totalRequerido;
        if (pp && pp.cantidadEmbalaje && pp.cantidadEmbalaje > 1) {
          pacasSugeridas = Math.floor(totalRequerido / pp.cantidadEmbalaje);
          sueltas = totalRequerido % pp.cantidadEmbalaje;
        }

        if (totalRequerido > 0) {
          nuevasSugerencias.push({
            productoId: prod.id,
            productoNombre: prod.nombre,
            proveedorId: provId,
            stockActual: inv.stockActual,
            velocidadDiaria: Number(velDiaria.toFixed(1)),
            diasAgotado,
            cantidadSugeridaTotal: totalRequerido,
            cantidadEmbalaje: pp?.cantidadEmbalaje,
            tipoEmbalaje: pp?.tipoEmbalaje,
            pacasSugeridas,
            unidadesSueltasSugeridas: sueltas
          });
        }
      }

      setSugerencias(nuevasSugerencias.sort((a, b) => b.cantidadSugeridaTotal - a.cantidadSugeridaTotal));

    } catch (err) {
      console.error("Error calculando stock predictivo", err);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    sugerencias,
    loading,
    generarSugerencias
  };
}
