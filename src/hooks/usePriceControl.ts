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
      // ETAPA 1 — Config + timer mínimo en paralelo → logo visible al menos 300ms
      const [configData] = await Promise.all([
        db.getConfiguracion(),
        new Promise<void>(res => setTimeout(res, 300)),
      ]);

      let finalConfig = configData ? {
        ...defaultConfig,
        ...configData,
        categorias: configData.categorias || defaultConfig.categorias,
      } as Configuracion : defaultConfig;

      // Categorías: solo agregar defaults en instalación nueva (length === 0)
      if (finalConfig.categorias.length === 0) {
        finalConfig.categorias = CATEGORIAS_DEFAULT.map(c => ({ ...c }));
        await db.saveConfiguracion({ ...finalConfig, id: 'main' });
      }

      setConfiguracion(finalConfig);
      setLoaded(true); // ← UI visible aquí, sin esperar productos/precios

      // ETAPA 2 — Resto de datos en paralelo (sin bloquear splash)
      const [productos, proveedores, precios] = await Promise.all([
        db.getAllProductos(),
        db.getAllProveedores(),
        db.getAllPrecios(),
      ]);

      // Si ya hay productos pero el flag no está → marcarlo (usuarios existentes)
      if (productos.length > 0 && !finalConfig.seedCompletado) {
        finalConfig.seedCompletado = true;
        await db.saveConfiguracion({ ...finalConfig, id: 'main' });
      }

      setProductos(productos);
      setProveedores(proveedores);
      setPrecios(precios);

      // LIMPIEZA INTELIGENTE: distingue borrado intencional vs pérdida accidental
      if (productos.length > 0) {
        const catNombres = new Set(
          finalConfig.categorias.map((c: any) => c.nombre.toLowerCase().trim())
        );
        catNombres.add('otro');
        const borradasNombres = new Set(
          (finalConfig.categoriasBorradas || []).map((n: string) => n.toLowerCase().trim())
        );
        const huerfanos = (productos as any[]).filter(
          p => !catNombres.has((p.categoria || '').toLowerCase().trim())
        );
        // ① Categoría borrada intencionalmente (está en categoriasBorradas) → mover a "Otro"
        const moverAOtro = huerfanos.filter(
          p => borradasNombres.has((p.categoria || '').toLowerCase().trim())
        );
        if (moverAOtro.length > 0) {
          await Promise.all(
            moverAOtro.map((p: any) =>
              db.updateProducto({ ...p, categoria: 'Otro', updatedAt: new Date().toISOString() })
            )
          );
          setProductos(prev => prev.map(p =>
            moverAOtro.some((h: any) => h.id === p.id) ? { ...p, categoria: 'Otro' } : p
          ));
        }
        // ② Categoría perdida por bug (NO está en categoriasBorradas) → recuperar la categoría
        const porRecuperar = [...new Set(
          huerfanos
            .filter(p => !borradasNombres.has((p.categoria || '').toLowerCase().trim()))
            .map(p => (p.categoria || '').trim())
            .filter(Boolean)
        )];
        if (porRecuperar.length > 0) {
          const nuevas = (porRecuperar as string[]).map(nombre => ({
            id: `cat-rec-${nombre.replace(/\W/g, '').toLowerCase().slice(0, 12)}-${Date.now()}`,
            nombre,
            color: '#6b7280',
            icono: '📦',
          }));
          finalConfig.categorias = [...finalConfig.categorias, ...nuevas];
          await db.saveConfiguracion({ ...finalConfig, id: 'main' });
          setConfiguracion(finalConfig);
        }
      }

      // Auto-seed solo en instalación limpia: sin productos Y nunca antes sembrado
      if (productos.length === 0 && !finalConfig.seedCompletado) {
        console.log("🌱 [Nexus-Volt] Primera instalación. Cargando catálogo inicial Dulce Placer...");
        await autoSeedData();
      }
    } catch (error) {
      console.error('Error cargando datos críticos:', error);
    }
  };

  // 🌱 Auto-seed PARALELIZADO
  const autoSeedData = async () => {
    try {
      const [, provsEnDB, ventasEnDB, recepcionesEnDB] = await Promise.all([
        db.getAllProductos(),
        db.getAllProveedores(),
        db.getAllVentas(),
        db.getAllRecepciones(),
      ]);

      // [Nexus-Volt] ELIMINADO: Ya no se borran productos con categorías "inválidas"
      // Se preserva la soberanía de datos del usuario.

      // Agregar proveedores, productos, precios EN PARALELO (no secuencial)
      const proveedoresParaAgregar = DATOS_EJEMPLO.proveedores.filter(
        prov => !provsEnDB.some(p => p.id === prov.id)
      );
      
      await Promise.all([
        Promise.allSettled(proveedoresParaAgregar.map(p => db.addProveedor(p as Proveedor).catch(() => {}))),
        Promise.allSettled(DATOS_EJEMPLO.productos.map(p => db.addProducto(p as Producto).catch(() => {}))),
        Promise.allSettled(DATOS_EJEMPLO.precios.map(p => db.addPrecio(p as PrecioProveedor).catch(() => {}))),
        ventasEnDB.length === 0 ? Promise.allSettled((DATOS_EJEMPLO as any).ventas?.map((v: any) => db.addVenta(v).catch(() => {})) ?? []) : Promise.resolve(),
        recepcionesEnDB.length === 0 ? Promise.allSettled((DATOS_EJEMPLO as any).recepciones?.map((r: any) => db.addRecepcion(r).catch(() => {})) ?? []) : Promise.resolve(),
      ]);

      // Recargar desde DB para reflejar datos reales (usuario + ejemplos fusionados)
      const [prodReales, provsReales, preciosReales, configActual] = await Promise.all([
        db.getAllProductos(),
        db.getAllProveedores(),
        db.getAllPrecios(),
        db.getConfiguracion(),
      ]);
      // Marcar seed como completado para nunca volver a ejecutarlo
      if (configActual) {
        const configConFlag = { ...configActual, seedCompletado: true, id: 'main' };
        await db.saveConfiguracion(configConFlag);
        setConfiguracion(configConFlag as any);
      }
      setProductos(prodReales as Producto[]);
      setProveedores(provsReales as Proveedor[]);
      setPrecios(preciosReales as PrecioProveedor[]);
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

  // Cargar datos de ejemplo (OPTIMIZADO - Sin bucles secuenciales)
  const cargarDatosEjemplo = useCallback(async () => {
    try {
      // Agregar TODO en PARALELO
      await Promise.all([
        Promise.allSettled(DATOS_EJEMPLO.proveedores.map(p => db.addProveedor(p as Proveedor).catch(() => {}))),
        Promise.allSettled(DATOS_EJEMPLO.productos.map(p => db.addProducto(p as Producto).catch(() => {}))),
        Promise.allSettled(DATOS_EJEMPLO.precios.map(p => db.addPrecio(p as PrecioProveedor).catch(() => {}))),
        (DATOS_EJEMPLO as any).ventas ? Promise.allSettled((DATOS_EJEMPLO as any).ventas.map((v: any) => db.addVenta(v).catch(() => {}))) : Promise.resolve(),
        (DATOS_EJEMPLO as any).recepciones ? Promise.allSettled((DATOS_EJEMPLO as any).recepciones.map((r: any) => db.addRecepcion(r).catch(() => {}))) : Promise.resolve(),
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
    const categoriaEliminada = configuracion.categorias.find(c => c.id === id);
    const newCategorias = configuracion.categorias.filter(c => c.id !== id);
    // Guardar NOMBRE (no ID) para que la comparación funcione aunque cambie el ID
    const nombreBorrado = categoriaEliminada?.nombre ?? id;
    const categoriasBorradas = [...new Set([...(configuracion.categoriasBorradas || []), nombreBorrado])];
    const newConfig = { ...configuracion, categorias: newCategorias, categoriasBorradas };
    await db.saveConfiguracion({ ...newConfig, id: 'main' });
    setConfiguracion(newConfig);
    // Mover a "Otro" los productos que tenían esta categoría eliminada
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

  // Funciones de Productos
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

    // ── Sincronización automática: crear InventarioItem con stock 0 ──
    // Envuelto en try-catch para que un error en inventario NO impida guardar el producto
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
  }, []);

  const updateProducto = useCallback(async (id: string, updates: Partial<Producto>) => {
    // Buscar en estado; si no está (closure stale tras addProducto), leer de DB directamente
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
      if (idx === -1) return [...prev, updatedProducto]; // Si no estaba en estado, añadir
      return prev.map(p => p.id === id ? updatedProducto : p);
    });
  }, [productos]);

  const deleteProducto = useCallback(async (id: string) => {
    await db.deleteProducto(id);
    setProductos(prev => prev.filter(p => p.id !== id));
    // También eliminar precios asociados
    const preciosProducto = precios.filter(p => p.productoId === id);
    for (const precio of preciosProducto) {
      await db.deletePrecio(precio.id);
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

  const deleteProveedor = useCallback(async (id: string) => {
    await db.deleteProveedor(id);
    setProveedores(prev => prev.filter(p => p.id !== id));
    // También eliminar precios asociados
    const preciosProveedor = precios.filter(p => p.proveedorId === id);
    for (const precio of preciosProveedor) {
      await db.deletePrecio(precio.id);
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
    // Buscar primero en estado React; si no se encuentra (posible closure stale tras addProducto),
    // consultar IndexedDB directamente para evitar error de restricción de unicidad
    let existingPrecio = precios.find(p => p.productoId === productoId && p.proveedorId === proveedorId);
    if (!existingPrecio) {
      const fromDB = await db.getPrecioByProductoProveedor(productoId, proveedorId).catch(() => null);
      if (fromDB) existingPrecio = fromDB as PrecioProveedor;
    }

    const now = new Date().toISOString();

    if (existingPrecio) {
      // Si el precio cambió, registrar en historial y crear alerta
      if (existingPrecio.precioCosto !== precioCosto) {
        const diferencia = precioCosto - existingPrecio.precioCosto;
        const porcentajeCambio = existingPrecio.precioCosto > 0 ? (diferencia / existingPrecio.precioCosto) * 100 : 0;

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

        // Ajustar precio de venta automáticamente si está habilitado
        if (configuracion.ajusteAutomatico && diferencia > 0) {
          const producto = productos.find(p => p.id === productoId);
          if (producto) {
            // Usar costo UNITARIO (precioCosto / cantidadEmbalaje) para calcular PVP
            const costoUnitario = precioCosto / (cantidadEmbalaje || 1);
            const nuevoPrecioVenta = Math.round(costoUnitario * (1 + producto.margenUtilidad / 100) / 100) * 100;
            await updateProducto(productoId, { precioVenta: nuevoPrecioVenta });
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

      // Si es el primer precio y hay ajuste automático, calcular precio de venta
      if (configuracion.ajusteAutomatico) {
        const producto = productos.find(p => p.id === productoId);
        if (producto && producto.precioVenta === 0) {
          // Usar costo UNITARIO (precioCosto / cantidadEmbalaje) para calcular PVP
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
            // costoBase = costo UNITARIO (precioCosto de paca / cantidadEmbalaje), redondeado a 2 decimales
            const nuevoCosto = Math.round((mejorPrecio.precioCosto / (mejorPrecio.cantidadEmbalaje || 1)) * 100) / 100;
            const margen = p.margenUtilidad || 0;
            // Nunca llevar precioVenta a 0: si nuevoCosto=0 (precio corrupto en DB) conservar el precio actual
            const nuevoPrecioVenta = (margen > 0 && nuevoCosto > 0)
              ? Math.round(nuevoCosto * (1 + margen / 100) / 100) * 100
              : p.precioVenta;
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
    // 1. Análisis de Necesidades de Producción (Forensic Prediction)
    const necesidadesProduccion: Record<string, number> = {};
    const ordenesActivas = produccionHook.produccion.filter(o => o.estado === 'planeado' || o.estado === 'en_proceso');
    
    ordenesActivas.forEach(orden => {
      const receta = recetas.find(r => r.productoId === orden.productoId);
      if (!receta) return;
      const faltantes = Math.max(0, orden.cantidadPlaneada - (orden.cantidadCompletada || 0));
      receta.ingredientes.forEach(ing => {
        const qty = (ing.cantidad / receta.porcionesResultantes) * faltantes;
        necesidadesProduccion[ing.productoId] = (necesidadesProduccion[ing.productoId] || 0) + qty;
      });
    });

    const productosBajoStock = inventarioHook.inventario.filter(item => {
      const necesidadProd = necesidadesProduccion[item.productoId] || 0;
      return (item.stockActual - necesidadProd) <= item.stockMinimo;
    });

    if (productosBajoStock.length === 0 && Object.keys(necesidadesProduccion).length === 0) return 0;

    const pedidosPorProveedor: Record<string, PrePedidoItem[]> = {};

    // Procesar tanto productos bajo stock como necesidades de producción
    const todosProductosInteres = new Set([...productosBajoStock.map(p => p.productoId), ...Object.keys(necesidadesProduccion)]);

    for (const productoId of todosProductosInteres) {
      const itemInv = inventarioHook.inventario.find(i => i.productoId === productoId);
      const stockActual = itemInv?.stockActual || 0;
      const stockMinimo = itemInv?.stockMinimo || 5;
      const necesidadProd = necesidadesProduccion[productoId] || 0;
      
      const cantidadNecesaria = Math.ceil(Math.max(0, (stockMinimo * 2) - stockActual + necesidadProd));
      if (cantidadNecesaria <= 0) continue;

      const mejorPrecio = getMejorPrecio(productoId);
      if (mejorPrecio) {
        const proveedorId = mejorPrecio.proveedorId;
        if (!pedidosPorProveedor[proveedorId]) {
          pedidosPorProveedor[proveedorId] = [];
        }
        pedidosPorProveedor[proveedorId].push({
          id: crypto.randomUUID(),
          productoId: productoId,
          proveedorId: proveedorId,
          cantidad: cantidadNecesaria,
          precioUnitario: mejorPrecio.precioCosto,
          subtotal: Math.round(cantidadNecesaria * mejorPrecio.precioCosto * 100) / 100
        });
      }
    }

    let pedidosCreados = 0;
    const now = new Date().toISOString();
    for (const [proveedorId, items] of Object.entries(pedidosPorProveedor)) {
      if (items.length === 0) continue;
      const total = Math.round(items.reduce((sum, i) => sum + i.subtotal, 0) * 100) / 100;
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
          // Markup = (PVP - costo) / costo × 100 — consistente con auto-precio y Precios.tsx
          return mejorPrecioCosto > 0 ? ((precioVenta - mejorPrecioCosto) / mejorPrecioCosto) * 100 : 0;
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
    addCategoria, deleteCategoria, updateCategoria,
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

