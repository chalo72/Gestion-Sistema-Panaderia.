import { useState, useCallback } from 'react';
import { db } from '@/lib/database';
import type {
  Producto,
  Proveedor,
  PrecioProveedor,
  HistorialPrecio,
  AlertaPrecio,
  Configuracion,
  Categoria,
  InventarioItem,
} from '@/types';
import { MONEDAS } from '@/types';

/**
 * Hook especializado para el Catálogo de Productos, Proveedores, Precios y Alertas.
 * Extraído de usePriceControl.ts para mejorar mantenibilidad.
 * 
 * @module useCatalogo
 * @since v5.2.0
 */
export function useCatalogo(deps: {
  inventarioHook: { setInventario: React.Dispatch<React.SetStateAction<InventarioItem[]>> };
}) {
  const { inventarioHook } = deps;

  // Estados principales
  const [productos, setProductos] = useState<Producto[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [precios, setPrecios] = useState<PrecioProveedor[]>([]);
  const [historial, setHistorial] = useState<HistorialPrecio[]>([]);
  const [alertas, setAlertas] = useState<AlertaPrecio[]>([]);
  const [configuracion, setConfiguracion] = useState<Configuracion>({
    margenUtilidadDefault: 30,
    ajusteAutomatico: true,
    notificarSubidas: true,
    umbralAlerta: 5,
    categorias: [],
    moneda: 'COP',
    nombreNegocio: 'Dulce Placer',
    impuestoPorcentaje: 0,
    mostrarUtilidadEnLista: true,
    presupuestoMensual: 0,
  });

  // ─── PRODUCTOS ────────────────────────────────────────────────────
  const addProducto = useCallback(async (producto: Omit<Producto, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const nuevoProducto: Producto = {
      ...producto,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    await db.addProducto(nuevoProducto);
    setProductos(prev => [...prev, nuevoProducto]);

    // Auto-crear InventarioItem con stock 0
    try {
      const existeEnInventario = await db.getInventarioItemByProducto(nuevoProducto.id).catch(() => null);
      if (!existeEnInventario) {
        const itemInventario: InventarioItem = {
          id: crypto.randomUUID(),
          productoId: nuevoProducto.id,
          stockActual: 0,
          stockMinimo: 5,
          ubicacion: 'Almacén General',
          ultimoMovimiento: now,
        };
        await db.updateInventarioItem(itemInventario);
        inventarioHook.setInventario(prev => [...prev, itemInventario]);
      }
    } catch (e) {
      console.warn('[Inventario] No se pudo crear item automático, pero el producto fue guardado:', e);
    }

    return nuevoProducto;
  }, [inventarioHook]);

  const updateProducto = useCallback(async (id: string, updates: Partial<Producto>) => {
    let producto = productos.find(p => p.id === id);
    if (!producto) {
      const fromDB = await db.getAllProductos().then(all => all.find(p => p.id === id)).catch(() => null);
      if (!fromDB) return;
      producto = fromDB as unknown as Producto;
    }
    const updatedProducto = { ...producto, ...updates, updatedAt: new Date().toISOString() };
    await db.updateProducto(updatedProducto);
    setProductos(prev => {
      const idx = prev.findIndex(p => p.id === id);
      if (idx === -1) return [...prev, updatedProducto];
      return prev.map(p => p.id === id ? updatedProducto : p);
    });
  }, [productos]);

  const deleteProducto = useCallback(async (id: string) => {
    await db.deleteProducto(id);
    setProductos(prev => prev.filter(p => p.id !== id));
    const preciosProducto = precios.filter(p => p.productoId === id);
    for (const precio of preciosProducto) {
      await db.deletePrecio(precio.id);
    }
    setPrecios(prev => prev.filter(p => p.productoId !== id));
  }, [precios]);

  // ─── PROVEEDORES ──────────────────────────────────────────────────
  const addProveedor = useCallback(async (proveedor: Omit<Proveedor, 'id' | 'createdAt'>) => {
    const nuevoProveedor: Proveedor = {
      ...proveedor,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    await db.addProveedor(nuevoProveedor);
    setProveedores(prev => [...prev, nuevoProveedor]);
    return nuevoProveedor;
  }, []);

  const updateProveedor = useCallback(async (id: string, updates: Partial<Proveedor>) => {
    const proveedor = proveedores.find(p => p.id === id);
    if (!proveedor) return;
    const updatedProveedor = { ...proveedor, ...updates };
    await db.updateProveedor(updatedProveedor);
    setProveedores(prev => prev.map(p => p.id === id ? updatedProveedor : p));
  }, [proveedores]);

  const deleteProveedor = useCallback(async (id: string) => {
    await db.deleteProveedor(id);
    setProveedores(prev => prev.filter(p => p.id !== id));
    const preciosProveedor = precios.filter(p => p.proveedorId === id);
    for (const precio of preciosProveedor) {
      await db.deletePrecio(precio.id);
    }
    setPrecios(prev => prev.filter(p => p.proveedorId !== id));
  }, [precios]);

  // ─── PRECIOS ──────────────────────────────────────────────────────
  const addOrUpdatePrecio = useCallback(async (data: {
    productoId: string;
    proveedorId: string;
    precioCosto: number;
    notas?: string;
    destino?: 'venta' | 'insumo';
    tipoEmbalaje?: string;
    cantidadEmbalaje?: number;
  }) => {
    const { productoId, proveedorId, precioCosto, notas, destino, tipoEmbalaje, cantidadEmbalaje } = data;
    let existingPrecio = precios.find(p => p.productoId === productoId && p.proveedorId === proveedorId);
    if (!existingPrecio) {
      const fromDB = await db.getPrecioByProductoProveedor(productoId, proveedorId).catch(() => null);
      if (fromDB) existingPrecio = fromDB as PrecioProveedor;
    }

    const now = new Date().toISOString();

    if (existingPrecio) {
      if (existingPrecio.precioCosto !== precioCosto) {
        const diferencia = precioCosto - existingPrecio.precioCosto;
        const porcentajeCambio = existingPrecio.precioCosto > 0 ? (diferencia / existingPrecio.precioCosto) * 100 : 0;

        const historialEntry: HistorialPrecio = {
          id: crypto.randomUUID(),
          productoId,
          proveedorId,
          precioAnterior: existingPrecio.precioCosto,
          precioNuevo: precioCosto,
          fechaCambio: now,
        };
        await db.addHistorial(historialEntry as any);
        setHistorial(prev => [historialEntry, ...prev].slice(0, 1000));

        if (Math.abs(porcentajeCambio) >= configuracion.umbralAlerta) {
          const alerta: AlertaPrecio = {
            id: crypto.randomUUID(),
            productoId,
            proveedorId,
            tipo: diferencia > 0 ? 'subida' : 'bajada',
            precioAnterior: existingPrecio.precioCosto,
            precioNuevo: precioCosto,
            diferencia,
            porcentajeCambio: Math.abs(porcentajeCambio),
            fecha: now,
            leida: false,
          };
          await db.addAlerta(alerta);
          setAlertas(prev => [alerta, ...prev]);
        }

        if (configuracion.ajusteAutomatico && diferencia > 0) {
          const producto = productos.find(p => p.id === productoId);
          if (producto) {
            const costoUnitario = precioCosto / (cantidadEmbalaje || 1);
            const nuevoPrecioVenta = Math.round(costoUnitario * (1 + producto.margenUtilidad / 100) / 100) * 100;
            await updateProducto(productoId, { precioVenta: nuevoPrecioVenta });
          }
        }
      }

      const updatedPrecio = { ...existingPrecio, precioCosto, fechaActualizacion: now, notas, ...(destino && { destino }), ...(tipoEmbalaje && { tipoEmbalaje }), ...(cantidadEmbalaje && { cantidadEmbalaje }) };
      await db.updatePrecio(updatedPrecio);
      setPrecios(prev => prev.map(p => p.id === existingPrecio!.id ? updatedPrecio : p));
    } else {
      const nuevoPrecio: PrecioProveedor = {
        id: crypto.randomUUID(),
        productoId,
        proveedorId,
        precioCosto,
        fechaActualizacion: now,
        notas,
        destino,
        tipoEmbalaje,
        cantidadEmbalaje,
      };
      await db.addPrecio(nuevoPrecio);
      setPrecios(prev => [...prev, nuevoPrecio]);

      if (configuracion.ajusteAutomatico) {
        const producto = productos.find(p => p.id === productoId);
        if (producto && producto.precioVenta === 0) {
          const costoUnitario = precioCosto / (cantidadEmbalaje || 1);
          const nuevoPrecioVenta = Math.round(costoUnitario * (1 + producto.margenUtilidad / 100) / 100) * 100;
          await updateProducto(productoId, { precioVenta: nuevoPrecioVenta });
        }
      }
    }
  }, [precios, productos, configuracion, updateProducto]);

  const deletePrecio = useCallback(async (id: string) => {
    await db.deletePrecio(id);
    setPrecios(prev => prev.filter(p => p.id !== id));
  }, []);

  // ─── ALERTAS ──────────────────────────────────────────────────────
  const marcarAlertaLeida = useCallback(async (id: string) => {
    const alerta = alertas.find(a => a.id === id);
    if (!alerta) return;
    const updatedAlerta = { ...alerta, leida: true };
    await db.updateAlerta(updatedAlerta);
    setAlertas(prev => prev.map(a => a.id === id ? updatedAlerta : a));
  }, [alertas]);

  const marcarTodasAlertasLeidas = useCallback(async () => {
    const updatedAlertas = alertas.map(a => ({ ...a, leida: true }));
    for (const alerta of updatedAlertas) {
      await db.updateAlerta(alerta);
    }
    setAlertas(updatedAlertas);
  }, [alertas]);

  const deleteAlerta = useCallback(async (id: string) => {
    await db.deleteAlerta(id);
    setAlertas(prev => prev.filter(a => a.id !== id));
  }, []);

  const clearAllAlertas = useCallback(async () => {
    await db.clearAllAlertas();
    setAlertas([]);
  }, []);

  const getAlertasNoLeidas = useCallback(() => {
    return alertas.filter(a => !a.leida);
  }, [alertas]);

  // ─── CATEGORÍAS ───────────────────────────────────────────────────
  const addCategoria = useCallback(async (nombre: string, color: string) => {
    const nuevaCategoria: Categoria = {
      id: crypto.randomUUID(),
      nombre,
      color,
    };
    const newCategorias = [...configuracion.categorias, nuevaCategoria];
    const newConfig = { ...configuracion, categorias: newCategorias };
    await db.saveConfiguracion({ ...newConfig, id: 'main' });
    setConfiguracion(newConfig);
    return nuevaCategoria;
  }, [configuracion]);

  const deleteCategoria = useCallback(async (id: string) => {
    const categoriaEliminada = configuracion.categorias.find(c => c.id === id);
    const newCategorias = configuracion.categorias.filter(c => c.id !== id);
    const nombreBorrado = categoriaEliminada?.nombre ?? id;
    const categoriasBorradas = [...new Set([...(configuracion.categoriasBorradas || []), nombreBorrado])];
    const newConfig = { ...configuracion, categorias: newCategorias, categoriasBorradas };
    await db.saveConfiguracion({ ...newConfig, id: 'main' });
    setConfiguracion(newConfig);
    if (categoriaEliminada) {
      const afectados = productos.filter(
        p => (p.categoria || '').toLowerCase().trim() === categoriaEliminada.nombre.toLowerCase().trim()
      );
      await Promise.all(
        afectados.map(p => db.updateProducto({ ...p, categoria: 'Otro', updatedAt: new Date().toISOString() }))
      );
      if (afectados.length > 0) {
        setProductos(prev => prev.map(p =>
          afectados.some(a => a.id === p.id) ? { ...p, categoria: 'Otro' } : p
        ));
      }
    }
  }, [configuracion, productos]);

  const updateCategoria = useCallback(async (id: string, nombre: string, color: string) => {
    const newCategorias = configuracion.categorias.map(c =>
      c.id === id ? { ...c, nombre, color } : c
    );
    const newConfig = { ...configuracion, categorias: newCategorias };
    await db.saveConfiguracion({ ...newConfig, id: 'main' });
    setConfiguracion(newConfig);
  }, [configuracion]);

  const updateConfiguracion = useCallback(async (updates: Partial<Configuracion>) => {
    const newConfig = { ...configuracion, ...updates };
    await db.saveConfiguracion({ ...newConfig, id: 'main' });
    setConfiguracion(newConfig);
  }, [configuracion]);

  // ─── UTILIDADES ───────────────────────────────────────────────────
  const formatCurrency = useCallback((value: any) => {
    try {
      if (value === null || value === undefined) return '$0.00';
      const numValue = typeof value === 'number' ? value : Number(value) || 0;
      const monedaConfig = MONEDAS.find(m => m.code === (configuracion.moneda || 'COP')) || MONEDAS[0];
      return new Intl.NumberFormat(monedaConfig.locale, {
        style: 'currency',
        currency: monedaConfig.code,
        maximumFractionDigits: 0,
      }).format(numValue);
    } catch (error) {
      console.error('Error en formatCurrency:', error);
      return '$0.00';
    }
  }, [configuracion.moneda]);

  const getMonedaActual = useCallback(() => {
    return MONEDAS.find(m => m.code === configuracion.moneda) || MONEDAS[0];
  }, [configuracion.moneda]);

  const getPreciosByProducto = useCallback((productoId: string) => {
    return precios.filter(p => p.productoId === productoId);
  }, [precios]);

  const getPreciosByProveedor = useCallback((proveedorId: string) => {
    return precios.filter(p => p.proveedorId === proveedorId);
  }, [precios]);

  const getMejorPrecio = useCallback((productoId: string) => {
    const preciosProducto = precios.filter(p => p.productoId === productoId);
    if (preciosProducto.length === 0) return null;
    return preciosProducto.reduce((min, p) => p.precioCosto < min.precioCosto ? p : min);
  }, [precios]);

  const getMejorPrecioByProveedor = useCallback((productoId: string, proveedorId: string) => {
    return precios.find(p => p.productoId === productoId && p.proveedorId === proveedorId);
  }, [precios]);

  const getProductoById = useCallback((id: string) => {
    return productos.find(p => p.id === id);
  }, [productos]);

  const getProveedorById = useCallback((id: string) => {
    return proveedores.find(p => p.id === id);
  }, [proveedores]);

  const getPrecioByIds = useCallback((productoId: string, proveedorId: string) => {
    return precios.find(p => p.productoId === productoId && p.proveedorId === proveedorId);
  }, [precios]);

  return {
    // Estado
    productos, setProductos,
    proveedores, setProveedores,
    precios, setPrecios,
    historial, setHistorial,
    alertas, setAlertas,
    configuracion, setConfiguracion,

    // Productos
    addProducto, updateProducto, deleteProducto,

    // Proveedores
    addProveedor, updateProveedor, deleteProveedor,

    // Precios
    addOrUpdatePrecio, deletePrecio,

    // Alertas
    marcarAlertaLeida, marcarTodasAlertasLeidas, deleteAlerta, clearAllAlertas, getAlertasNoLeidas,

    // Categorías
    addCategoria, deleteCategoria, updateCategoria, updateConfiguracion,

    // Utilidades
    formatCurrency, getMonedaActual,
    getPreciosByProducto, getPreciosByProveedor,
    getMejorPrecio, getMejorPrecioByProveedor,
    getProductoById, getProveedorById, getPrecioByIds,
  };
}
