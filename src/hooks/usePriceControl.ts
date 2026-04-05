import { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '@/lib/database';
import type {
  Producto,
  Proveedor,
  PrecioProveedor,
  HistorialPrecio,
  AlertaPrecio,
  Configuracion,
  PrePedido,
  PrePedidoItem,
  Categoria,
  InventarioItem,
  Receta,
  Recepcion,
} from '@/types';
import { toast } from 'sonner';

import { safeNumber } from '@/lib/safe-utils';
import { useFinanzas } from './useFinanzas';
import { useProduccionHook } from './useProduccionHook';
import { useVentas } from './useVentas';
import { useInventario } from './useInventario';

import {
  CATEGORIAS_DEFAULT,
  DATOS_EJEMPLO,
} from '@/lib/seed-data';

import { MONEDAS } from '@/types';

const defaultConfig: Configuracion = {
  margenUtilidadDefault: 30,
  ajusteAutomatico: true,
  notificarSubidas: true,
  umbralAlerta: 5,
  categorias: CATEGORIAS_DEFAULT,
  moneda: 'COP',
  nombreNegocio: 'Dulce Placer',
  impuestoPorcentaje: 0,
  mostrarUtilidadEnLista: true,
  presupuestoMensual: 0,
};

// PROTEGIDO: No modificar sin revisión. Hook principal de gestión de precios, inventario y ventas validado en producción.
export function usePriceControl() {
  // Estados
  const [productos, setProductos] = useState<Producto[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [precios, setPrecios] = useState<PrecioProveedor[]>([]);
  const [historial, setHistorial] = useState<HistorialPrecio[]>([]);
  const [alertas, setAlertas] = useState<AlertaPrecio[]>([]);
  const [configuracion, setConfiguracion] = useState<Configuracion>(defaultConfig);
  const [prepedidos, setPrepedidos] = useState<PrePedido[]>([]);

  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Sub-hooks delegados (Fase 4 de refactoring)
  // onAjustarStock se define más abajo, así que usamos un ref para romper la dependencia circular
  const onAjustarStockRef = { current: async (_pid: string, _q: number, _t: 'entrada' | 'salida', _m: string) => { return; } };
  const inventarioHook = useInventario({ productos });
  const finanzas = useFinanzas({ onAjustarStock: (...args) => onAjustarStockRef.current(...args) });
  const produccionHook = useProduccionHook({ onAjustarStock: (...args) => onAjustarStockRef.current(...args), recetas });
  const ventasHook = useVentas({ onAjustarStock: (...args) => onAjustarStockRef.current(...args) });

  // Inicializar base de datos y cargar datos
  useEffect(() => {
    const initDB = async () => {
      try {
        await db.init();
        // Cargar datos CRÍTICOS primero
        await loadCriticalData();
        setLoaded(true);
        
        // Cargar datos secundarios en background SIN BLOQUEAR
        loadSecondaryDataInBackground();
      } catch (error) {
        console.error('Error inicializando base de datos:', error);
        setLoaded(true);
      }
    };
    initDB();
  }, []);

  // ⚡ DATOS CRÍTICOS = Mostrar UI rápido (Productos, Precios, Config)
  const loadCriticalData = async () => {
    try {
      // Config + Productos + Precios en paralelo
      const [configData, productos, proveedores, precios] = await Promise.all([
        db.getConfiguracion(),
        db.getAllProductos(),
        db.getAllProveedores(),
        db.getAllPrecios(),
      ]);

      let finalConfig = configData ? {
        ...defaultConfig,
        ...configData,
        categorias: configData.categorias || defaultConfig.categorias,
      } as Configuracion : defaultConfig;

      // Validar categorías
      const categoriasNuevas = CATEGORIAS_DEFAULT.filter(
        cDef => !finalConfig.categorias.map(c => c.nombre).includes(cDef.nombre)
      );

      if (categoriasNuevas.length > 0 || finalConfig.categorias.length === 0) {
        const categoriasActualizadas = finalConfig.categorias.map(catExistente => {
          const catDefault = CATEGORIAS_DEFAULT.find(cd => cd.nombre === catExistente.nombre);
          return catDefault && !catExistente.icono ? { ...catExistente, icono: catDefault.icono } : catExistente;
        });
        finalConfig.categorias = [...categoriasActualizadas, ...categoriasNuevas];
        await db.saveConfiguracion({ ...finalConfig, id: 'main' });
      }

      setConfiguracion(finalConfig);
      setProductos(productos);
      setProveedores(proveedores);
      setPrecios(precios);

      // PROTEGIDO: Auto-seed SOLO en primera ejecución REAL (doble verificación localStorage + IndexedDB)
      const setupLS = localStorage.getItem('dulceplacer_setup_done');
      const setupIDB = await db.getBackup('dulceplacer_setup_done');
      const setupCompletado = setupLS === 'true' || setupIDB === true;
      if (!setupCompletado) {
        const categoriasValidas = CATEGORIAS_DEFAULT.map(c => c.nombre);
        const tieneProductosReales = productos.some(p => categoriasValidas.includes(p.categoria));
        
        if (productos.length === 0 || !tieneProductosReales) {
          await autoSeedData();
        }
        // Marcar setup como completado en AMBAS capas (localStorage + IndexedDB)
        localStorage.setItem('dulceplacer_setup_done', 'true');
        await db.saveBackup('dulceplacer_setup_done', true);
      }
    } catch (error) {
      console.error('Error cargando datos críticos:', error);
    }
  };

  // 🌱 Auto-seed PARALELIZADO (PROTEGIDO: Respeta tombstones de eliminación)
  // ═══════════════════════════════════════════════════════════════════
  // CAPA DE PROTECCIÓN 2: Guard runtime contra re-seed de datos eliminados
  // Si alguien llama autoSeedData() fuera de contexto, los tombstones
  // siguen bloqueando la reaparición de productos/proveedores eliminados.
  // ═══════════════════════════════════════════════════════════════════
  const autoSeedData = async () => {
    try {
      // Guard TRIPLE: verificar en localStorage + IndexedDB + tombstones
      const yaSetupLS = localStorage.getItem('dulceplacer_setup_done');
      const yaSetupIDB = await db.getBackup('dulceplacer_setup_done');
      if (yaSetupLS === 'true' || yaSetupIDB === true) {
        console.log('🛡️ [Guard] autoSeedData bloqueado: setup ya completado (doble verificación).');
        return;
      }
      const [productosEnDB, provsEnDB, ventasEnDB, recepcionesEnDB, tombsProductos, tombsProveedores, tombsPrecios] = await Promise.all([
        db.getAllProductos(),
        db.getAllProveedores(),
        db.getAllVentas(),
        db.getAllRecepciones(),
        db.getTombstones('productos'),
        db.getTombstones('proveedores'),
        db.getTombstones('precios'),
      ]);

      const productosInvalidos = productosEnDB.filter(p => 
        !CATEGORIAS_DEFAULT.map(c => c.nombre).includes(p.categoria)
      );

      // Limpiar productos obsoletos en paralelo
      if (productosInvalidos.length > 0) {
        await Promise.allSettled(
          productosInvalidos.map(p => db.deleteProducto(p.id).catch(() => {}))
        );
      }

      // PROTEGIDO: Filtrar seed data excluyendo items eliminados por el usuario (tombstones)
      const productosParaAgregar = DATOS_EJEMPLO.productos.filter(
        p => !productosEnDB.some(db_p => db_p.id === p.id) && !tombsProductos.includes(p.id)
      );
      const proveedoresParaAgregar = DATOS_EJEMPLO.proveedores.filter(
        prov => !provsEnDB.some(p => p.id === prov.id) && !tombsProveedores.includes(prov.id)
      );
      const preciosParaAgregar = DATOS_EJEMPLO.precios.filter(
        p => !tombsPrecios.includes(p.id)
      );
      
      await Promise.all([
        Promise.allSettled(proveedoresParaAgregar.map(p => db.addProveedor(p as Proveedor).catch(() => {}))),
        Promise.allSettled(productosParaAgregar.map(p => db.addProducto(p as Producto).catch(() => {}))),
        Promise.allSettled(preciosParaAgregar.map(p => db.addPrecio(p as PrecioProveedor).catch(() => {}))),
        ventasEnDB.length === 0 ? Promise.allSettled(DATOS_EJEMPLO.ventas?.map(v => db.addVenta(v as any).catch(() => {})) ?? []) : Promise.resolve(),
        recepcionesEnDB.length === 0 ? Promise.allSettled(DATOS_EJEMPLO.recepciones?.map(r => db.addRecepcion(r as any).catch(() => {})) ?? []) : Promise.resolve(),
      ]);

      // Actualizar estado LOCAL con los datos reales (re-query para consistencia)
      const [prodFinal, provFinal, precFinal] = await Promise.all([
        db.getAllProductos(),
        db.getAllProveedores(),
        db.getAllPrecios(),
      ]);
      setProductos(prodFinal as Producto[]);
      setProveedores(provFinal as Proveedor[]);
      setPrecios(precFinal as PrecioProveedor[]);
    } catch (error) {
      console.error('Error en auto-seed:', error);
    }
  };

  // 📦 DATOS SECUNDARIOS = Cargar en background
  const loadSecondaryDataInBackground = async () => {
    try {
      const [alertas, inventario, movimientos, gastos, recepciones, historial, recetas, ventas, sesionesCaja, cajaActiva, ahorros, mesas, pedidosActivos, produccion, creditosClientes, creditosTrabajadoresData, trabajadores] = await Promise.all([
        db.getAllAlertas(),
        db.getAllInventario(),
        db.getAllMovimientos(),
        db.getAllGastos(),
        db.getAllRecepciones(),
        db.getAllHistorial(),
        db.getAllRecetas(),
        db.getAllVentas(),
        db.getAllSesionesCaja(),
        db.getSesionCajaActiva(),
        db.getAllAhorros(),
        db.getAllMesas(),
        db.getAllPedidosActivos(),
        db.getAllOrdenesProduccion(),
        db.getAllCreditosClientes(),
        db.getAllCreditosTrabajadores(),
        db.getAllTrabajadores(),
      ]);

      setAlertas(alertas);
      inventarioHook.setInventario(inventario);
      inventarioHook.setMovimientos(movimientos);
      finanzas.setGastos(gastos);
      inventarioHook.setRecepciones(recepciones as Recepcion[]);
      setHistorial(historial);
      setRecetas(recetas as Receta[]);
      ventasHook.setVentas(ventas);
      ventasHook.setSesionesCaja(sesionesCaja as any);
      ventasHook.setCajaActiva(cajaActiva as any);
      finanzas.setAhorros(ahorros);
      ventasHook.setMesas(mesas);
      ventasHook.setPedidosActivos(pedidosActivos);
      produccionHook.setProduccion(produccion);
      finanzas.setCreditosClientes(creditosClientes as import('@/types').CreditoCliente[]);
      finanzas.setCreditosTrabajadores(creditosTrabajadoresData as import('@/types').CreditoTrabajador[]);
      finanzas.setTrabajadores(trabajadores as import('@/types').Trabajador[]);
    } catch (error) {
      console.error('Error cargando datos secundarios:', error);
    }
  };

  const loadAllData = async () => {
    try {
      // Cargamos la configuración primero para tener el tema y moneda listos
      const configData = await db.getConfiguracion();
      let finalConfig = defaultConfig;

      if (configData) {
        finalConfig = {
          ...defaultConfig,
          ...configData,
          categorias: configData.categorias || defaultConfig.categorias,
        } as Configuracion;
      }

      // [Nexus-Volt] Category Sanitizer v2: Asegurar TODAS las categorías de negocio
      const categoriasExistentes = finalConfig.categorias.map(c => c.nombre);
      const categoriasNuevas = CATEGORIAS_DEFAULT.filter(
        cDef => !categoriasExistentes.includes(cDef.nombre)
      );

      if (categoriasNuevas.length > 0 || finalConfig.categorias.length === 0) {
        console.log(`🧹 [Nexus-Volt] Detectadas ${categoriasNuevas.length} categorías nuevas. Sincronizando catálogo Dulce Placer...`);
        // Actualizar categorías existentes con icono si lo perdieron, y agregar nuevas
        const categoriasActualizadas = finalConfig.categorias.map(catExistente => {
          const catDefault = CATEGORIAS_DEFAULT.find(cd => cd.nombre === catExistente.nombre);
          if (catDefault && !catExistente.icono) {
            return { ...catExistente, icono: catDefault.icono };
          }
          return catExistente;
        });
        finalConfig.categorias = [...categoriasActualizadas, ...categoriasNuevas];
        await db.saveConfiguracion({ ...finalConfig, id: 'main' });
      }

      setConfiguracion(finalConfig);

      // Cargamos el resto en paralelo pero actualizamos según van llegando
      const dataPromises = [
        db.getAllProductos().then(setProductos),
        db.getAllProveedores().then(setProveedores),
        db.getAllPrecios().then(setPrecios),
        db.getAllPrePedidos().then(setPrepedidos),
        db.getAllAlertas().then(setAlertas),
        db.getAllInventario().then(inventarioHook.setInventario),
        db.getAllMovimientos().then(inventarioHook.setMovimientos),
        db.getAllGastos().then(finanzas.setGastos),
        db.getAllRecepciones().then((data) => inventarioHook.setRecepciones(data as Recepcion[])),
        db.getAllHistorial().then(setHistorial),
        db.getAllRecetas().then((data) => setRecetas(data as Receta[])),
        db.getAllVentas().then(ventasHook.setVentas),
        db.getAllSesionesCaja().then((data) => ventasHook.setSesionesCaja(data as any)),
        db.getSesionCajaActiva().then((data) => ventasHook.setCajaActiva(data as any)),
        db.getAllAhorros().then(finanzas.setAhorros),
        db.getAllMesas().then(ventasHook.setMesas),
        db.getAllPedidosActivos().then(ventasHook.setPedidosActivos),
        db.getAllOrdenesProduccion().then(produccionHook.setProduccion),
      ];

      await Promise.allSettled(dataPromises);
      console.log('⚡ Todas las constantes de datos han sido cargadas y sincronizadas.');

      // ── Auto-inicializar InventarioItem para productos sin registro ──
      // Garantiza que TODOS los productos existentes aparezcan en el módulo de Inventario
      try {
        const [todosProductos, todosInventarios] = await Promise.all([
          db.getAllProductos(),
          db.getAllInventario(),
        ]);
        const idsConInventario = new Set(todosInventarios.map((i: InventarioItem) => i.productoId));
        const productosSinInventario = todosProductos.filter((p: Producto) => !idsConInventario.has(p.id));
        if (productosSinInventario.length > 0) {
          const now = new Date().toISOString();
          const nuevosItems: InventarioItem[] = productosSinInventario.map((p: Producto) => ({
            id: crypto.randomUUID(),
            productoId: p.id,
            stockActual: 0,
            stockMinimo: 5,
            ubicacion: 'Almacén General',
            ultimoMovimiento: now,
          }));
          await Promise.all(nuevosItems.map(item => db.updateInventarioItem(item)));
          inventarioHook.setInventario([...todosInventarios, ...nuevosItems]);
          console.log(`✅ Auto-inicializados ${nuevosItems.length} ítems de inventario para productos existentes`);
        }
      } catch (err) {
        console.warn('⚠️ Error en auto-inicialización de inventario:', err);
      }

    } catch (error) {
      console.error('❌ Error crítico en la carga asíncrona de datos:', error);
    } finally {
      setLoaded(true);
    }
  };

  // Cargar datos de ejemplo (PROTEGIDO: Limpia tombstones porque el usuario pide explícitamente recargar)
  const cargarDatosEjemplo = useCallback(async () => {
    try {
      // Limpiar tombstones porque el usuario QUIERE datos de ejemplo de vuelta
      const [tombsP, tombsProv, tombsPre] = await Promise.all([
        db.getTombstones('productos'),
        db.getTombstones('proveedores'),
        db.getTombstones('precios'),
      ]);
      await Promise.allSettled([
        ...tombsP.map(id => db.removeTombstone('productos', id)),
        ...tombsProv.map(id => db.removeTombstone('proveedores', id)),
        ...tombsPre.map(id => db.removeTombstone('precios', id)),
      ]);

      // Agregar TODO en PARALELO
      await Promise.all([
        Promise.allSettled(DATOS_EJEMPLO.proveedores.map(p => db.addProveedor(p as Proveedor).catch(() => {}))),
        Promise.allSettled(DATOS_EJEMPLO.productos.map(p => db.addProducto(p as Producto).catch(() => {}))),
        Promise.allSettled(DATOS_EJEMPLO.precios.map(p => db.addPrecio(p as PrecioProveedor).catch(() => {}))),
        DATOS_EJEMPLO.ventas ? Promise.allSettled(DATOS_EJEMPLO.ventas.map(v => db.addVenta(v as any).catch(() => {}))) : Promise.resolve(),
        DATOS_EJEMPLO.recepciones ? Promise.allSettled(DATOS_EJEMPLO.recepciones.map(r => db.addRecepcion(r as any).catch(() => {}))) : Promise.resolve(),
      ]);
      
      // Guardar categorías
      await db.saveConfiguracion({ ...configuracion, categorias: CATEGORIAS_DEFAULT, id: 'main' });

      // Recargar datos críticos localmente
      const [productos, proveedores, precios] = await Promise.all([
        db.getAllProductos(),
        db.getAllProveedores(),
        db.getAllPrecios(),
      ]);
      setProductos(productos);
      setProveedores(proveedores);
      setPrecios(precios);

      // Cargar resto en background
      loadSecondaryDataInBackground();
      
      toast.success('Datos de ejemplo cargados correctamente');
    } catch (error) {
      console.error('Error cargando datos de ejemplo:', error);
      toast.error('Error al cargar datos de ejemplo');
    }
  }, [configuracion]);

  // Funciones de Categorías
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
    const newCategorias = configuracion.categorias.filter(c => c.id !== id);
    const newConfig = { ...configuracion, categorias: newCategorias };
    await db.saveConfiguracion({ ...newConfig, id: 'main' });
    setConfiguracion(newConfig);
  }, [configuracion]);

  const updateConfiguracion = useCallback(async (updates: Partial<Configuracion>) => {
    const newConfig = { ...configuracion, ...updates };
    await db.saveConfiguracion({ ...newConfig, id: 'main' });
    setConfiguracion(newConfig);
  }, [configuracion]);

  // Funciones de Productos
  const addProducto = useCallback(async (producto: Omit<Producto, 'id' | 'createdAt' | 'updatedAt'> & { stockActual?: number, stockMinimo?: number }) => {
    const { stockActual, stockMinimo, ...productoData } = producto;
    const now = new Date().toISOString();
    const nuevoProducto: Producto = {
      ...productoData,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    await db.addProducto(nuevoProducto);
    setProductos(prev => [...prev, nuevoProducto]);

    // ── Sincronización automática: crear InventarioItem con stock inicial ──
    const existeEnInventario = await db.getInventarioItemByProducto(nuevoProducto.id).catch(() => null);
    if (!existeEnInventario) {
      const itemInventario: InventarioItem = {
        id: crypto.randomUUID(),
        productoId: nuevoProducto.id,
        stockActual: stockActual ?? 0,
        stockMinimo: stockMinimo ?? 5,
        ubicacion: 'Almacén General',
        ultimoMovimiento: now,
      };
      await db.updateInventarioItem(itemInventario);
      inventarioHook.setInventario(prev => [...prev, itemInventario]);
    }

    return nuevoProducto;
  }, []);

  const updateProducto = useCallback(async (id: string, updates: Partial<Producto> & { stockActual?: number, stockMinimo?: number }) => {
    const { stockActual, stockMinimo, ...productUpdates } = updates;
    const producto = productos.find(p => p.id === id);
    if (!producto) return;

    // 1. Actualizar producto base
    const updatedProducto = { ...producto, ...productUpdates, updatedAt: new Date().toISOString() };
    await db.updateProducto(updatedProducto);
    setProductos(prev => prev.map(p => p.id === id ? updatedProducto : p));

    // 2. Actualizar stock/mínimos si se proporcionan
    if (stockActual !== undefined || stockMinimo !== undefined) {
      try {
        const itemInv = await db.getInventarioItemByProducto(id);
        const now = new Date().toISOString();
        const updatedItem: InventarioItem = {
          id: itemInv?.id || crypto.randomUUID(),
          productoId: id,
          stockActual: stockActual !== undefined ? stockActual : (itemInv?.stockActual || 0),
          stockMinimo: stockMinimo !== undefined ? stockMinimo : (itemInv?.stockMinimo || 5),
          ubicacion: itemInv?.ubicacion || 'Almacén General',
          ultimoMovimiento: now
        };
        await db.updateInventarioItem(updatedItem);
        inventarioHook.setInventario(prev => {
          const existe = prev.find(i => i.productoId === id);
          if (existe) return prev.map(i => i.productoId === id ? updatedItem : i);
          return [...prev, updatedItem];
        });

        // Registrar movimiento si el stock cambió
        if (stockActual !== undefined && stockActual !== itemInv?.stockActual) {
          const delta = stockActual - (itemInv?.stockActual || 0);
          const usuarioActual = (() => {
            try {
              const u = localStorage.getItem('pricecontrol_local_user');
              return u ? (JSON.parse(u)?.nombre || 'sistema') : 'sistema';
            } catch { return 'sistema'; }
          })();

          const movimiento: MovimientoInventario = {
            id: crypto.randomUUID(),
            productoId: id,
            tipo: delta > 0 ? 'entrada' : 'salida',
            cantidad: Math.abs(delta),
            motivo: 'Ajuste desde Catálogo/POS',
            fecha: now,
            usuario: usuarioActual
          };
          await db.addMovimiento(movimiento);
          inventarioHook.setMovimientos(prev => [movimiento, ...prev]);
        }
      } catch (err) {
        console.error('Error sincronizando inventario en updateProducto:', err);
      }
    }
  }, [productos]);

  // PROTEGIDO: Capa 2 — Guard defensivo: tombstone se crea SIEMPRE, sin importar errores parciales
  const deleteProducto = useCallback(async (id: string) => {
    try {
      await db.deleteProducto(id);
    } catch (err) {
      // Aunque falle la eliminación en DB, asegurar el tombstone
      console.warn('⚠️ deleteProducto parcial, forzando tombstone:', err);
      await db.addTombstone('productos', id).catch(() => {});
    }
    setProductos(prev => prev.filter(p => p.id !== id));
    // También eliminar precios asociados
    const preciosProducto = precios.filter(p => p.productoId === id);
    for (const precio of preciosProducto) {
      try {
        await db.deletePrecio(precio.id);
      } catch {
        await db.addTombstone('precios', precio.id).catch(() => {});
      }
    }
    setPrecios(prev => prev.filter(p => p.productoId !== id));
  }, [precios]);

  // Funciones de Proveedores
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

  // PROTEGIDO: Capa 2 — Guard defensivo: tombstone se crea SIEMPRE, sin importar errores parciales
  const deleteProveedor = useCallback(async (id: string) => {
    try {
      await db.deleteProveedor(id);
    } catch (err) {
      console.warn('⚠️ deleteProveedor parcial, forzando tombstone:', err);
      await db.addTombstone('proveedores', id).catch(() => {});
    }
    setProveedores(prev => prev.filter(p => p.id !== id));
    // También eliminar precios asociados
    const preciosProveedor = precios.filter(p => p.proveedorId === id);
    for (const precio of preciosProveedor) {
      try {
        await db.deletePrecio(precio.id);
      } catch {
        await db.addTombstone('precios', precio.id).catch(() => {});
      }
    }
    setPrecios(prev => prev.filter(p => p.proveedorId !== id));
  }, [precios]);

  // Funciones de Precios
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
    const existingPrecio = await db.getPrecioByProductoProveedor(productoId, proveedorId);

    const now = new Date().toISOString();

    if (existingPrecio) {
      // Si el precio cambió, registrar en historial y crear alerta
      if (existingPrecio.precioCosto !== precioCosto) {
        const diferencia = precioCosto - existingPrecio.precioCosto;
        const porcentajeCambio = (diferencia / existingPrecio.precioCosto) * 100;

        // Registrar en historial y PERSISTIR en IndexedDB
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

        // Crear alerta si supera el umbral
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

        // SINCRONIZACIÓN: Ajustar precio de venta automáticamente (subidas Y bajadas)
        if (configuracion.ajusteAutomatico) {
          const producto = productos.find(p => p.id === productoId);
          if (producto) {
            const costoUnitario = precioCosto / (cantidadEmbalaje || 1);
            const nuevoPrecioVenta = Math.round(costoUnitario * (1 + producto.margenUtilidad / 100) / 100) * 100;
            await updateProducto(productoId, { precioVenta: nuevoPrecioVenta, costoBase: costoUnitario });
          }
        }
      }

      // Actualizar precio existente
      const updatedPrecio = { ...existingPrecio, precioCosto, fechaActualizacion: now, notas, ...(destino && { destino }), ...(tipoEmbalaje && { tipoEmbalaje }), ...(cantidadEmbalaje && { cantidadEmbalaje }) };
      await db.updatePrecio(updatedPrecio);
      setPrecios(prev => prev.map(p => p.id === existingPrecio.id ? updatedPrecio : p));
    } else {
      // Crear nuevo precio
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

      // SINCRONIZACIÓN: Calcular precio de venta para nuevos precios (siempre si ajuste automático)
      if (configuracion.ajusteAutomatico) {
        const producto = productos.find(p => p.id === productoId);
        if (producto) {
          const costoUnitario = precioCosto / (cantidadEmbalaje || 1);
          const nuevoPrecioVenta = Math.round(costoUnitario * (1 + producto.margenUtilidad / 100) / 100) * 100;
          await updateProducto(productoId, { precioVenta: nuevoPrecioVenta, costoBase: costoUnitario });
        }
      }
    }
  }, [precios, productos, configuracion, updateProducto]);

  const deletePrecio = useCallback(async (id: string) => {
    await db.deletePrecio(id);
    setPrecios(prev => prev.filter(p => p.id !== id));
  }, []);

  // Funciones de Pre-Pedidos
  const addPrePedido = useCallback(async (data: Omit<PrePedido, 'id' | 'fechaCreacion' | 'fechaActualizacion'>) => {
    const now = new Date().toISOString();
    const nuevoPrePedido: PrePedido = {
      ...data,
      id: crypto.randomUUID(),
      fechaCreacion: now,
      fechaActualizacion: now,
    };
    await db.addPrePedido(nuevoPrePedido);
    setPrepedidos(prev => [...prev, nuevoPrePedido]);
    return nuevoPrePedido;
  }, []);

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
      subtotal: item.cantidad * item.precioUnitario,
    };

    const newItems = [...prepedido.items, newItem];
    const newTotal = newItems.reduce((sum, i) => sum + i.subtotal, 0);
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
    const newTotal = newItems.reduce((sum, i) => sum + i.subtotal, 0);
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
      return { ...i, cantidad, subtotal: cantidad * i.precioUnitario };
    });
    const newTotal = newItems.reduce((sum, i) => sum + i.subtotal, 0);
    const updatedPrePedido = {
      ...prepedido,
      items: newItems,
      total: newTotal,
      fechaActualizacion: new Date().toISOString(),
    };

    await db.updatePrePedido(updatedPrePedido);
    setPrepedidos(prev => prev.map(p => p.id === prePedidoId ? updatedPrePedido : p));
  }, [prepedidos]);

  // Funciones de Alertas
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

  // Utilidades de moneda
  const formatCurrency = useCallback((value: any) => {
    try {
      if (value === null || value === undefined) return '$ 0';
      const numValue = typeof value === 'number' ? value : Number(value) || 0;
      const monedaConfig = MONEDAS.find(m => m.code === (configuracion.moneda || 'COP')) || MONEDAS[0];
      return new Intl.NumberFormat(monedaConfig.locale, {
        style: 'currency',
        currency: monedaConfig.code,
        maximumFractionDigits: 0,
      }).format(numValue);
    } catch (error) {
      console.error('Error en formatCurrency:', error);
      return '$ 0';
    }
  }, [configuracion.moneda]);

  const getMonedaActual = useCallback(() => {
    return MONEDAS.find(m => m.code === configuracion.moneda) || MONEDAS[0];
  }, [configuracion.moneda]);

  // Funciones de utilidad
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

  // Lógica de cálculo de Costo por Receta (Inspiración ERP - Escandallos)
  const getCostoReceta = useCallback((productoId: string) => {
    const receta = recetas.find(r => r.productoId === productoId);
    if (!receta) {
      // Si no tiene receta, devolver el costo base manual o el mejor precio si es ingrediente
      const producto = productos.find(p => p.id === productoId);
      if (producto?.tipo === 'ingrediente') {
        const mejorPrecio = getMejorPrecio(productoId);
        return mejorPrecio ? mejorPrecio.precioCosto : (producto.costoBase || 0);
      }
      return producto?.costoBase || 0;
    }

    const costoTotal = receta.ingredientes.reduce((sum: number, ing: any) => {
      const mejorPrecio = getMejorPrecio(ing.productoId);
      // Si no hay precio de proveedor, usar el costo base manual del ingrediente
      let costoUnitario = 0;
      if (mejorPrecio) {
        costoUnitario = mejorPrecio.precioCosto;
      } else {
        const prodIng = productos.find(p => p.id === ing.productoId);
        costoUnitario = prodIng?.costoBase || 0;
      }
      return sum + (costoUnitario * ing.cantidad);
    }, 0);

    return receta.porcionesResultantes > 0 ? costoTotal / receta.porcionesResultantes : costoTotal;
  }, [recetas, getMejorPrecio, productos]);

  // Sincronización proactiva de costos de productos elaborados
  // SE OPTIMIZA: Se añade una guarda para evitar loops infinitos y se usa una comparación profunda
  useEffect(() => {
    if (!loaded) return;

    const actualizarCostosElaborados = async () => {
      let huboCambio = false;
      const nuevosProductos = productos.map(p => {
        if (p.tipo === 'elaborado') {
          const nuevoCosto = getCostoReceta(p.id);
          // Usar una pequeña tolerancia para floating point
          if (Math.abs((p.costoBase || 0) - nuevoCosto) > 0.01) {
            huboCambio = true;
            return { ...p, costoBase: nuevoCosto, updatedAt: new Date().toISOString() };
          }
        } else if (p.tipo === 'ingrediente') {
          const mejorPrecio = getMejorPrecio(p.id);
          if (mejorPrecio) {
            const nuevoCosto = mejorPrecio.precioCosto;
            const margen = p.margenUtilidad || 0;
            const nuevoPrecioVenta = margen > 0 ? Math.round(nuevoCosto * (1 + margen / 100) / 100) * 100 : p.precioVenta;
            const costoDistinto  = Math.abs((p.costoBase || 0) - nuevoCosto) > 0.01;
            const ventaDistinto  = margen > 0 && Math.abs((p.precioVenta || 0) - nuevoPrecioVenta) > 0.01;
            if (costoDistinto || ventaDistinto) {
              huboCambio = true;
              return {
                ...p,
                costoBase: nuevoCosto,
                ...(margen > 0 ? { precioVenta: nuevoPrecioVenta } : {}),
                updatedAt: new Date().toISOString(),
              };
            }
          }
        }
        return p;
      });

      if (huboCambio) {
        console.log("♻️ [Nexus-Volt] Sincronizando costos base detectados...");
        setProductos(nuevosProductos);
        // Persistir individualmente para evitar re-escritura masiva lenta
        for (const p of nuevosProductos.filter((_, i) => nuevosProductos[i] !== productos[i])) {
          await db.updateProducto(p);
        }
      }
    };

    // Usar un timeout pequeño para evitar disparos en ráfaga durante la carga inicial
    const timer = setTimeout(actualizarCostosElaborados, 1000);
    return () => clearTimeout(timer);
  }, [precios, recetas, loaded]); // productos NO debe estar aquí para evitar el loop directo

  // Funciones de Reabastecimiento Inteligente
  const generarSugerenciasPedido = useCallback(async () => {
    const productosBajoStock = inventarioHook.inventario.filter(item => item.stockActual <= item.stockMinimo);
    if (productosBajoStock.length === 0) return 0;

    const pedidosPorProveedor: Record<string, PrePedidoItem[]> = {};

    for (const item of productosBajoStock) {
      const producto = productos.find(p => p.id === item.productoId);
      if (!producto) continue;

      const stockObjetivo = Math.max(item.stockMinimo * 3, 10);
      const cantidadNecesaria = stockObjetivo - item.stockActual;
      if (cantidadNecesaria <= 0) continue;

      const mejorPrecio = getMejorPrecio(item.productoId);
      if (mejorPrecio) {
        const proveedorId = mejorPrecio.proveedorId;
        if (!pedidosPorProveedor[proveedorId]) {
          pedidosPorProveedor[proveedorId] = [];
        }
        pedidosPorProveedor[proveedorId].push({
          id: crypto.randomUUID(),
          productoId: item.productoId,
          proveedorId: proveedorId,
          cantidad: cantidadNecesaria,
          precioUnitario: mejorPrecio.precioCosto,
          subtotal: cantidadNecesaria * mejorPrecio.precioCosto
        });
      } else {
        console.warn(`Producto ${producto.nombre} no tiene proveedores registrados.`);
      }
    }

    let pedidosCreados = 0;
    const now = new Date().toISOString();
    for (const [proveedorId, items] of Object.entries(pedidosPorProveedor)) {
      if (items.length === 0) continue;
      const total = items.reduce((sum, i) => sum + i.subtotal, 0);
      const nuevoPrePedido: PrePedido = {
        id: crypto.randomUUID(),
        nombre: `Pedido Auto ${new Date().toLocaleDateString()}`,
        proveedorId, items, total,
        presupuestoMaximo: 0,
        estado: 'borrador',
        notas: 'Generado automáticamente por Stock Bajo',
        fechaCreacion: now,
        fechaActualizacion: now
      };
      await db.addPrePedido(nuevoPrePedido);
      setPrepedidos(prev => [...prev, nuevoPrePedido]);
      pedidosCreados++;
    }
    return pedidosCreados;
  }, [inventarioHook.inventario, productos, getMejorPrecio]);

  const getProductoById = useCallback((id: string) => {
    return productos.find(p => p.id === id);
  }, [productos]);

  const getProveedorById = useCallback((id: string) => {
    return proveedores.find(p => p.id === id);
  }, [proveedores]);

  const getPrecioByIds = useCallback((productoId: string, proveedorId: string) => {
    return precios.find(p => p.productoId === productoId && p.proveedorId === proveedorId);
  }, [precios]);

  const getPrePedidoById = useCallback((id: string) => {
    return prepedidos.find(p => p.id === id);
  }, [prepedidos]);

  const getPrePedidosByProveedor = useCallback((proveedorId: string) => {
    return prepedidos.filter(p => p.proveedorId === proveedorId);
  }, [prepedidos]);

  const getAlertasNoLeidas = useCallback(() => {
    return alertas.filter(a => !a.leida);
  }, [alertas]);

  // CÁLCULO MEMOIZADO DE ESTADÍSTICAS (MAX PERFORMANCE)
  const estadisticas = useMemo(() => {
    console.log('📊 Optimizando Estadísticas...');
    const totalProductos = productos.length;
    const totalProveedores = proveedores.length;
    const alertasNoLeidasCount = alertas.filter(a => !a.leida).length;
    const totalPrePedidos = prepedidos.length;
    const prePedidosConfirmados = prepedidos.filter(p => p.estado === 'confirmado').length;

    // Calcular utilidad promedio con optimización de búsqueda
    const mejorPrecioCache = new Map<string, number>();
    productos.forEach(p => {
      const best = getMejorPrecio(p.id);
      if (best) mejorPrecioCache.set(p.id, best.precioCosto);
    });

    const productosConPrecio = productos.filter(p => p.precioVenta > 0 && mejorPrecioCache.has(p.id));
    let utilidadPromedio = 0;

    if (productosConPrecio.length > 0) {
      const utilidades = productosConPrecio.map(p => {
        try {
          const mejorPrecioCosto = safeNumber(mejorPrecioCache.get(p.id));
          const precioVenta = safeNumber(p.precioVenta);
          if (precioVenta === 0) return 0;
          return ((precioVenta - mejorPrecioCosto) / precioVenta) * 100;
        } catch {
          return 0;
        }
      });
      utilidadPromedio = utilidades.reduce((a, b) => a + safeNumber(b), 0) / utilidades.length;
    }

    const productosSinPrecio = productos.filter(p => !mejorPrecioCache.has(p.id)).length;

    const totalEnPrePedidos = prepedidos
      .filter(p => p.estado === 'borrador')
      .reduce((sum, p) => sum + safeNumber(p.total), 0);

    const totalItemsInventario = inventarioHook.inventario.length;
    const itemsBajoStock = inventarioHook.inventario.filter(inv => inv.stockActual <= inv.stockMinimo).length;
    const totalRecepciones = inventarioHook.recepciones.length;
    const recepcionesPendientes = inventarioHook.recepciones.filter(r => r.estado === 'en_proceso').length;
    const totalCambiosPrecios = historial.length;

    // Detección Predictiva de Agotamiento
    const prediccionAgotamiento = inventarioHook.inventario.filter(inv => {
      try {
        const movs = inventarioHook.movimientos.filter(m => m.productoId === inv.productoId && m.tipo === 'salida');
        if (movs.length < 3) return false;
        const consumoPromedio = movs.reduce((a, b) => a + safeNumber(b.cantidad), 0) / 30;
        const diasRestantes = safeNumber(inv.stockActual) / (consumoPromedio || 1);
        return diasRestantes < 7;
      } catch {
        return false;
      }
    }).length;

    return {
      totalProductos,
      totalProveedores,
      alertasNoLeidas: alertasNoLeidasCount,
      utilidadPromedio: Math.round(utilidadPromedio * 100) / 100,
      productosConPrecio: productosConPrecio.length,
      productosSinPrecio,
      totalPrePedidos,
      prePedidosConfirmados,
      totalEnPrePedidos: Math.round(totalEnPrePedidos * 100) / 100,
      totalItemsInventario,
      itemsBajoStock,
      totalRecepciones,
      recepcionesPendientes,
      totalCambiosPrecios,
      itemsEnRiesgo: prediccionAgotamiento,
      totalRecetas: recetas.length,
      // Estadísticas de Ventas
      ventasHoy: ventasHook.ventas.filter(v => v.fecha && v.fecha.startsWith(new Date().toISOString().split('T')[0])).length,
      ingresosHoy: ventasHook.ventas
        .filter(v => v.fecha && v.fecha.startsWith(new Date().toISOString().split('T')[0]))
        .reduce((sum, v) => sum + safeNumber(v.total), 0),
      ticketPromedio: ventasHook.ventas.length > 0
        ? ventasHook.ventas.reduce((sum, v) => sum + safeNumber(v.total), 0) / ventasHook.ventas.length
        : 0,
    };
  }, [productos, proveedores, alertas, precios, prepedidos, inventarioHook.inventario, inventarioHook.recepciones, historial, inventarioHook.movimientos, recetas, ventasHook.ventas, getMejorPrecio]);

  // Alias para mantener compatibilidad
  const getEstadisticas = useCallback(() => estadisticas, [estadisticas]);

  // Limpiar todos los datos
  const clearAllData = useCallback(async () => {
    await db.clearAll();
    setProductos([]);
    setProveedores([]);
    setPrecios([]);
    setPrepedidos([]);
    setAlertas([]);
    setConfiguracion(defaultConfig);
    setHistorial([]);
    setRecetas([]);
    // Limpiar sub-hooks
    finanzas.setGastos([]);
    finanzas.setAhorros([]);
    finanzas.setCreditosClientes([]);
    finanzas.setCreditosTrabajadores([]);
    finanzas.setTrabajadores([]);
    produccionHook.setProduccion([]);
    ventasHook.setVentas([]);
    ventasHook.setSesionesCaja([]);
    ventasHook.setCajaActiva(undefined);
    ventasHook.setMesas([]);
    ventasHook.setPedidosActivos([]);
    inventarioHook.setInventario([]);
    inventarioHook.setMovimientos([]);
    inventarioHook.setRecepciones([]);
  }, [finanzas, produccionHook, ventasHook, inventarioHook]);

  // Sincronización Manual
  const syncWithCloud = useCallback(async () => {
    if (db.syncLocalToCloud) {
      toast.promise(db.syncLocalToCloud(), {
        loading: 'Subiendo datos a la nube...',
        success: () => { loadAllData(); return 'Sincronizado correctamente'; },
        error: 'Error al sincronizar. Revisa tu conexión.'
      });
    }
  }, [loadAllData]);

  const downloadFromCloud = useCallback(async () => {
    if (db.syncCloudToLocal) {
      toast.promise(db.syncCloudToLocal(), {
        loading: 'Descargando datos desde la nube...',
        success: () => { loadAllData(); return 'Datos actualizados'; },
        error: 'Error al descargar. ¿Está el proyecto activo?'
      });
    }
  }, [loadAllData]);


  // Wire onAjustarStock ref for sub-hooks
  onAjustarStockRef.current = inventarioHook.onAjustarStock;


  return {
    // Datos Base
    productos, proveedores, precios, historial, alertas, configuracion, prepedidos, estadisticas, loaded,
    downloadFromCloud, syncWithCloud, cargarDatosEjemplo, clearAllData, loadAllData, MONEDAS,

    // Recetas, Categorías, Productos, Proveedores, Precios, Pre-Pedidos
    addReceta: async (r: Receta) => {
      await db.addReceta(r as any);
      setRecetas(prev => [...prev, r]);
    },
    updateReceta: async (r: Receta) => {
      await db.updateReceta(r as any);
      setRecetas(prev => prev.map(item => item.id === r.id ? r : item));
    },
    deleteReceta: async (id: string) => {
      await db.deleteReceta(id);
      setRecetas(prev => prev.filter(r => r.id !== id));
    },
    getRecetaByProducto: (pid: string) => recetas.find(r => r.productoId === pid),
    recetas,
    addCategoria, deleteCategoria,
    addProducto, updateProducto, deleteProducto,
    addProveedor, updateProveedor, deleteProveedor,
    addOrUpdatePrecio, deletePrecio,
    addPrePedido, updatePrePedido, deletePrePedido, addItemToPrePedido, removeItemFromPrePedido, updateItemCantidad,
    marcarAlertaLeida, marcarTodasAlertasLeidas, deleteAlerta, clearAllAlertas,
    updateConfiguracion,
    formatCurrency, getMonedaActual, getPreciosByProducto, getPreciosByProveedor, getMejorPrecio, getMejorPrecioByProveedor,
    generarSugerenciasPedido, getProductoById, getProveedorById, getPrecioByIds, getPrePedidoById, getPrePedidosByProveedor,
    getAlertasNoLeidas, getEstadisticas,

    // --- DELEGACIÓN A SUB-HOOK: PRODUCCIÓN ---
    ...produccionHook,

    // --- DELEGACIÓN A SUB-HOOK: FINANZAS ---
    ...finanzas,
    // Sobrescribimos generarReporte para pasarle el estado ventas desde ventasHook
    generarReporte: (periodo: string) => finanzas.generarReporte(periodo, ventasHook.ventas),

    // --- DELEGACIÓN A SUB-HOOK: VENTAS, CAJA Y MESAS ---
    ...ventasHook,

    // --- DELEGACIÓN A SUB-HOOK: INVENTARIO Y RECEPCIONES ---
    ...inventarioHook,
  };
}

