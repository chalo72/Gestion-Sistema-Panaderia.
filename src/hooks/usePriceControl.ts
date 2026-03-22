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
  MovimientoInventario,
  Receta,
  IngredienteReceta,
  Venta,
  VentaItem,
  CajaSesion,
  MetodoPago,
  Recepcion,
  Mesa,
  PedidoActivo,
  Gasto,
  OrdenProduccion,
  MovimientoCaja,
  CreditoCliente,
  PagoCredito,
  Trabajador
} from '@/types';
import { toast } from 'sonner';

import { safeNumber, safeString } from '@/lib/safe-utils';

import {
  CATEGORIAS_DEFAULT,
  DATOS_EJEMPLO,
  MONEDAS
} from '@/types';

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

  const [inventario, setInventario] = useState<InventarioItem[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([]);
  const [recepciones, setRecepciones] = useState<Recepcion[]>([]);
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [sesionesCaja, setSesionesCaja] = useState<CajaSesion[]>([]);
  const [cajaActiva, setCajaActiva] = useState<CajaSesion | undefined>(undefined);
  const [ahorros, setAhorros] = useState<any[]>([]); // Estado para ahorros
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [pedidosActivos, setPedidosActivos] = useState<PedidoActivo[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [produccion, setProduccion] = useState<OrdenProduccion[]>([]);
  const [creditosClientes, setCreditosClientes] = useState<CreditoCliente[]>([]);
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [loaded, setLoaded] = useState(false);

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

      // Auto-seed si no hay datos
      const categoriasValidas = CATEGORIAS_DEFAULT.map(c => c.nombre);
      const tieneProductosReales = productos.some(p => categoriasValidas.includes(p.categoria));
      
      if (productos.length === 0 || !tieneProductosReales) {
        await autoSeedData();
      }
    } catch (error) {
      console.error('Error cargando datos críticos:', error);
    }
  };

  // 🌱 Auto-seed PARALELIZADO
  const autoSeedData = async () => {
    try {
      const [productosEnDB, provsEnDB, ventasEnDB, recepcionesEnDB] = await Promise.all([
        db.getAllProductos(),
        db.getAllProveedores(),
        db.getAllVentas(),
        db.getAllRecepciones(),
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

      // Agregar proveedores, productos, precios EN PARALELO (no secuencial)
      const proveedoresParaAgregar = DATOS_EJEMPLO.proveedores.filter(
        prov => !provsEnDB.some(p => p.id === prov.id)
      );
      
      await Promise.all([
        Promise.allSettled(proveedoresParaAgregar.map(p => db.addProveedor(p as Proveedor).catch(() => {}))),
        Promise.allSettled(DATOS_EJEMPLO.productos.map(p => db.addProducto(p as Producto).catch(() => {}))),
        Promise.allSettled(DATOS_EJEMPLO.precios.map(p => db.addPrecio(p as PrecioProveedor).catch(() => {}))),
        ventasEnDB.length === 0 ? Promise.allSettled(DATOS_EJEMPLO.ventas?.map(v => db.addVenta(v as any).catch(() => {})) ?? []) : Promise.resolve(),
        recepcionesEnDB.length === 0 ? Promise.allSettled(DATOS_EJEMPLO.recepciones?.map(r => db.addRecepcion(r as any).catch(() => {})) ?? []) : Promise.resolve(),
      ]);

      // Actualizar estado LOCAL después del seed (SIN re-queries)
      setProductos(DATOS_EJEMPLO.productos as Producto[]);
      setProveedores(DATOS_EJEMPLO.proveedores as Proveedor[]);
      setPrecios(DATOS_EJEMPLO.precios as PrecioProveedor[]);
    } catch (error) {
      console.error('Error en auto-seed:', error);
    }
  };

  // 📦 DATOS SECUNDARIOS = Cargar en background
  const loadSecondaryDataInBackground = async () => {
    try {
      const [alertas, inventario, movimientos, gastos, recepciones, historial, recetas, ventas, sesionesCaja, cajaActiva, ahorros, mesas, pedidosActivos, produccion, creditosClientes, trabajadores] = await Promise.all([
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
        db.getAllTrabajadores(),
      ]);

      setAlertas(alertas);
      setInventario(inventario);
      setMovimientos(movimientos);
      setGastos(gastos);
      setRecepciones(recepciones as Recepcion[]);
      setHistorial(historial);
      setRecetas(recetas as Receta[]);
      setVentas(ventas);
      setSesionesCaja(sesionesCaja);
      setCajaActiva(cajaActiva);
      setAhorros(ahorros);
      setMesas(mesas);
      setPedidosActivos(pedidosActivos);
      setProduccion(produccion);
      setCreditosClientes(creditosClientes as CreditoCliente[]);
      setTrabajadores(trabajadores as Trabajador[]);
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
      const categoriasRequeridas = CATEGORIAS_DEFAULT.map(c => c.nombre);
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
        db.getAllInventario().then(setInventario),
        db.getAllMovimientos().then(setMovimientos),
        db.getAllGastos().then(setGastos),
        db.getAllRecepciones().then((data) => setRecepciones(data as Recepcion[])),
        db.getAllHistorial().then(setHistorial),
        db.getAllRecetas().then((data) => setRecetas(data as Receta[])),
        db.getAllVentas().then(setVentas),
        db.getAllSesionesCaja().then(setSesionesCaja),
        db.getSesionCajaActiva().then(setCajaActiva),
        db.getAllAhorros().then(setAhorros),
        db.getAllMesas().then(setMesas),
        db.getAllPedidosActivos().then(setPedidosActivos),
        db.getAllOrdenesProduccion().then(setProduccion),
      ];

      await Promise.allSettled(dataPromises);
      console.log('⚡ Todas las constantes de datos han sido cargadas y sincronizadas.');

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
    // Así el producto aparece de inmediato en el módulo de Inventario
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
      setInventario(prev => [...prev, itemInventario]);
    }

    return nuevoProducto;
  }, []);

  const updateProducto = useCallback(async (id: string, updates: Partial<Producto>) => {
    const producto = productos.find(p => p.id === id);
    if (!producto) return;
    const updatedProducto = { ...producto, ...updates, updatedAt: new Date().toISOString() };
    await db.updateProducto(updatedProducto);
    setProductos(prev => prev.map(p => p.id === id ? updatedProducto : p));
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
  }) => {
    const { productoId, proveedorId, precioCosto, notas } = data;
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

        // Ajustar precio de venta automáticamente si está habilitado
        if (configuracion.ajusteAutomatico && diferencia > 0) {
          const producto = productos.find(p => p.id === productoId);
          if (producto) {
            const nuevoPrecioVenta = precioCosto * (1 + producto.margenUtilidad / 100);
            await updateProducto(productoId, { precioVenta: Math.round(nuevoPrecioVenta * 100) / 100 });
          }
        }
      }

      // Actualizar precio existente
      const updatedPrecio = { ...existingPrecio, precioCosto, fechaActualizacion: now, notas };
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
      };
      await db.addPrecio(nuevoPrecio);
      setPrecios(prev => [...prev, nuevoPrecio]);

      // Si es el primer precio y hay ajuste automático, calcular precio de venta
      if (configuracion.ajusteAutomatico) {
        const producto = productos.find(p => p.id === productoId);
        if (producto && producto.precioVenta === 0) {
          const nuevoPrecioVenta = precioCosto * (1 + producto.margenUtilidad / 100);
          await updateProducto(productoId, { precioVenta: Math.round(nuevoPrecioVenta * 100) / 100 });
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

  // Funciones de Inventario
  const onAjustarStock = useCallback(async (productoId: string, cantidad: number, tipo: 'entrada' | 'salida' | 'ajuste', motivo: string) => {
    const now = new Date().toISOString();

    // Obtener item actual o crear uno nuevo
    let item = inventario.find(i => i.productoId === productoId);
    let nuevoStock = 0;

    if (item) {
      if (tipo === 'entrada') nuevoStock = item.stockActual + cantidad;
      else if (tipo === 'salida') nuevoStock = Math.max(0, item.stockActual - cantidad);
      else if (tipo === 'ajuste') nuevoStock = cantidad;
    } else {
      // Si no existe, crearlo (asumiendo stock 0 inicial si es entrada/salida)
      if (tipo === 'entrada' || tipo === 'ajuste') nuevoStock = cantidad;
      else nuevoStock = 0;
    }

    // Actualizar/Crear Item Inventario
    const newItem: InventarioItem = item ? {
      ...item,
      stockActual: nuevoStock,
      ultimoMovimiento: now,
    } : {
      id: crypto.randomUUID(),
      productoId,
      stockActual: nuevoStock,
      stockMinimo: 5, // Default
      ubicacion: 'Almacén General',
      ultimoMovimiento: now,
    };

    await db.updateInventarioItem(newItem);

    if (item) {
      setInventario(prev => prev.map(i => i.id === item!.id ? newItem : i));
    } else {
      setInventario(prev => [...prev, newItem]);
    }

    // Registrar Movimiento
    const movimiento: MovimientoInventario = {
      id: crypto.randomUUID(),
      productoId,
      tipo,
      cantidad,
      motivo,
      fecha: now,
      usuario: motivo ? `${motivo.split(':')[0]}` : 'Sistema', // Nombre del usuario se pasa desde el componente que llama
    };

    await db.addMovimiento(movimiento);
    setMovimientos(prev => [movimiento, ...prev]);

  }, [inventario]);

  // Funciones de Recepciones
  const addRecepcion = useCallback(async (data: Omit<Recepcion, 'id'>) => {
    const recepcion: Recepcion = {
      ...data,
      id: crypto.randomUUID(),
    };
    await db.addRecepcion(recepcion);
    setRecepciones(prev => [...prev, recepcion]);
    return recepcion;
  }, []);

  const confirmarRecepcion = useCallback(async (recepcion: Recepcion) => {
    // 1. Actualizar Inventario
    for (const item of recepcion.items) {
      if (item.cantidadRecibida > 0) {
        await onAjustarStock(
          item.productoId,
          item.cantidadRecibida,
          'entrada',
          `Recepción Factura ${recepcion.numeroFactura}`
        );
      }

      // 2. Actualizar Precio de Costo si es diferente (Opcional, pero recomendado)
      // Solo si el precio facturado es válido y diferente
      if (item.precioFacturado > 0) {
        // Encontrar precio actual
        const currentPrice = await db.getPrecioByProductoProveedor(item.productoId, recepcion.proveedorId);

        // Si no existe o es diferente, actualizar/crear
        if (!currentPrice || currentPrice.precioCosto !== item.precioFacturado) {
          // Usamos la función existente que maneja historial y alertas
          await addOrUpdatePrecio({
            productoId: item.productoId,
            proveedorId: recepcion.proveedorId,
            precioCosto: item.precioFacturado,
            notas: `Actualizado desde Recepción ${recepcion.numeroFactura}`
          });
        }
      }
    }

    // 3. Actualizar estado de la recepción
    const updatedRecepcion: Recepcion = {
      ...recepcion,
      estado: 'completada' // O 'con_incidencias' si hay lógica para ello
    };

    // Si hay items defectuosos o cantidades incorrectas, marcar como con incidencias
    const tieneIncidencias = recepcion.items.some(i => !i.cantidadOk || !i.productoOk || i.defectuosos > 0);
    if (tieneIncidencias) updatedRecepcion.estado = 'con_incidencias';

    await db.updateRecepcion(updatedRecepcion);
    setRecepciones(prev => prev.map(r => r.id === recepcion.id ? updatedRecepcion : r));

    // 4. Si viene de un PrePedido, actualizar estado del PrePedido (Opcional)
    if (recepcion.prePedidoId) {
      const prepedido = prepedidos.find(p => p.id === recepcion.prePedidoId);
      if (prepedido) {
        // Lógica para cerrar prepedido si se recibió todo, por ahora lo dejamos simple
      }
    }

  }, [onAjustarStock, addOrUpdatePrecio, prepedidos]);

  const updateRecepcion = useCallback(async (id: string, updates: Partial<Recepcion>) => {
    const recepcion = recepciones.find(r => r.id === id);
    if (!recepcion) return;
    const updatedRecepcion = { ...recepcion, ...updates };
    await db.updateRecepcion(updatedRecepcion);
    setRecepciones(prev => prev.map(r => r.id === id ? updatedRecepcion : r));
  }, [recepciones]);

  const getRecepcionesByProveedor = useCallback((proveedorId: string) => {
    return recepciones.filter(r => r.proveedorId === proveedorId);
  }, [recepciones]);

  // Funciones de Ventas (POS)
  const registrarVenta = useCallback(async (data: {
    items: Omit<VentaItem, 'id'>[];
    metodoPago: MetodoPago;
    cliente?: string;
    notas?: string;
    usuarioId: string;
  }) => {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const itemsConId: VentaItem[] = data.items.map(item => ({
      ...item,
      id: crypto.randomUUID(),
    }));

    const total = itemsConId.reduce((sum, item) => sum + item.subtotal, 0);

    const nuevaVenta: Venta = {
      id,
      cajaId: cajaActiva?.id,
      items: itemsConId,
      total,
      metodoPago: data.metodoPago,
      usuarioId: data.usuarioId,
      cliente: data.cliente,
      notas: data.notas,
      fecha: now,
    };

    // 1. Guardar en DB
    await db.addVenta(nuevaVenta);
    setVentas(prev => [nuevaVenta, ...prev]);

    // 2. Descontar Stock y Registrar Movimientos
    for (const item of itemsConId) {
      const producto = productos.find(p => p.id === item.productoId);
      if (producto) {
        await onAjustarStock(
          item.productoId,
          item.cantidad,
          'salida',
          `Venta #${id.slice(0, 8)}`
        );
      }
    }

    // 3. Actualizar Caja si hay una activa
    if (cajaActiva) {
      const updatedCaja: CajaSesion = {
        ...cajaActiva,
        totalVentas: cajaActiva.totalVentas + total,
        ventasIds: [...cajaActiva.ventasIds, id],
      };
      await db.updateSesionCaja(updatedCaja);
      setCajaActiva(updatedCaja);
      setSesionesCaja(prev => prev.map(s => s.id === updatedCaja.id ? updatedCaja : s));
    }

    return nuevaVenta;
  }, [cajaActiva, productos, onAjustarStock]);

  // Función para formatear moneda
  const formatCurrency = useCallback((value: any) => {
    try {
      if (value === null || value === undefined) return '€0.00';

      let numValue: number;
      if (typeof value === 'number') {
        numValue = value;
      } else if (typeof value === 'object') {
        numValue = 0;
      } else {
        try {
          const n = Number(value);
          numValue = isNaN(n) ? 0 : n;
        } catch {
          numValue = 0;
        }
      }

      if (isNaN(numValue)) return '€0.00';

      const monedaConfig = MONEDAS.find(m => m.code === (configuracion.moneda || 'COP')) || MONEDAS[0];
      return new Intl.NumberFormat(monedaConfig.locale, {
        style: 'currency',
        currency: monedaConfig.code,
      }).format(numValue);
    } catch (error) {
      console.error('Error en formatCurrency:', error, value);
      return '€0.00';
    }
  }, [configuracion.moneda]);

  // Función para obtener la moneda actual
  const getMonedaActual = useCallback(() => {
    return MONEDAS.find(m => m.code === configuracion.moneda) || MONEDAS[0];
  }, [configuracion.moneda]);

  // Funciones de Caja
  const abrirCaja = useCallback(async (usuarioId: string, montoApertura: number) => {
    // Leer extras guardados por AperturaCajaModal (cajaNombre, turno, vendedoraNombre)
    let extras: { cajaNombre?: string; turno?: 'Mañana' | 'Tarde' | 'Noche'; vendedoraNombre?: string } = {};
    try {
      const raw = localStorage.getItem('dp_caja_extras');
      if (raw) { extras = JSON.parse(raw); localStorage.removeItem('dp_caja_extras'); }
    } catch { /* ignorar errores de localStorage */ }

    const now = new Date().toISOString();
    const nuevaSesion: CajaSesion = {
      id: crypto.randomUUID(),
      usuarioId,
      fechaApertura: now,
      montoApertura,
      totalVentas: 0,
      ventasIds: [],
      movimientos: [],
      estado: 'abierta',
      cajaNombre: extras.cajaNombre,
      turno: extras.turno,
      vendedoraNombre: extras.vendedoraNombre,
    };

    await db.addSesionCaja(nuevaSesion);
    setCajaActiva(nuevaSesion);
    setSesionesCaja(prev => [nuevaSesion, ...prev]);
    return nuevaSesion;
  }, []);

  const cerrarCaja = useCallback(async (montoCierre: number) => {
    if (!cajaActiva) return;

    const updatedCaja: CajaSesion = {
      ...cajaActiva,
      fechaCierre: new Date().toISOString(),
      montoCierre,
      estado: 'cerrada',
    };

    await db.updateSesionCaja(updatedCaja);
    setCajaActiva(undefined);
    setSesionesCaja(prev => prev.map(s => s.id === updatedCaja.id ? updatedCaja : s));
    return updatedCaja;
  }, [cajaActiva]);

  const registrarMovimientoCaja = useCallback(async (monto: number, tipo: 'entrada' | 'salida', motivo: string, usuarioId: string) => {
    if (!cajaActiva) {
      toast.error('Debe haber una caja abierta para registrar movimientos');
      return;
    }

    const movimiento: MovimientoCaja = {
      id: crypto.randomUUID(),
      cajaId: cajaActiva.id,
      tipo,
      monto,
      motivo,
      fecha: new Date().toISOString(),
      usuarioId
    };

    const updatedCaja: CajaSesion = {
      ...cajaActiva,
      movimientos: [...(cajaActiva.movimientos || []), movimiento]
    };

    await db.updateSesionCaja(updatedCaja);
    setCajaActiva(updatedCaja);
    setSesionesCaja(prev => prev.map(s => s.id === updatedCaja.id ? updatedCaja : s));

    toast.success(`${tipo === 'entrada' ? 'Entrada' : 'Salida'} de caja registrada: ${formatCurrency(monto)}`);
    return movimiento;
  }, [cajaActiva, formatCurrency]);

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

    const costoTotal = receta.ingredientes.reduce((sum, ing) => {
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
            const nuevoPrecioVenta = margen > 0 ? nuevoCosto * (1 + margen / 100) : p.precioVenta;
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
    const productosBajoStock = inventario.filter(item => item.stockActual <= item.stockMinimo);
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
  }, [inventario, productos, getMejorPrecio]);

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

    const totalItemsInventario = inventario.length;
    const itemsBajoStock = inventario.filter(inv => inv.stockActual <= inv.stockMinimo).length;
    const totalRecepciones = recepciones.length;
    const recepcionesPendientes = recepciones.filter(r => r.estado === 'en_proceso').length;
    const totalCambiosPrecios = historial.length;

    // Detección Predictiva de Agotamiento
    const prediccionAgotamiento = inventario.filter(inv => {
      try {
        const movs = movimientos.filter(m => m.productoId === inv.productoId && m.tipo === 'salida');
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
      ventasHoy: ventas.filter(v => v.fecha && v.fecha.startsWith(new Date().toISOString().split('T')[0])).length,
      ingresosHoy: ventas
        .filter(v => v.fecha && v.fecha.startsWith(new Date().toISOString().split('T')[0]))
        .reduce((sum, v) => sum + safeNumber(v.total), 0),
      ticketPromedio: ventas.length > 0
        ? ventas.reduce((sum, v) => sum + safeNumber(v.total), 0) / ventas.length
        : 0,
    };
  }, [productos, proveedores, alertas, precios, prepedidos, inventario, recepciones, historial, movimientos, recetas, ventas, getMejorPrecio]);

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
    setInventario([]);
    setMovimientos([]);
    setRecepciones([]);
    setHistorial([]);
    setRecetas([]);
  }, []);

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

  // Funciones de Producción
  const addOrdenProduccion = useCallback(async (data: Omit<OrdenProduccion, 'id' | 'fechaInicio' | 'estado'>) => {
    const orden: OrdenProduccion = {
      ...data,
      id: crypto.randomUUID(),
      fechaInicio: new Date().toISOString(),
      estado: 'planeado',
    };
    await db.addOrdenProduccion(orden as any);
    setProduccion(prev => [...prev, orden]);
    return orden;
  }, []);

  const updateOrdenProduccion = useCallback(async (id: string, updates: Partial<OrdenProduccion>) => {
    const orden = produccion.find(o => o.id === id);
    if (!orden) return;
    const updatedOrden = { ...orden, ...updates };
    await db.updateOrdenProduccion(updatedOrden as any);
    setProduccion(prev => prev.map(o => o.id === id ? updatedOrden : o));
  }, [produccion]);

  const finalizarProduccion = useCallback(async (id: string, cantidadCompletada: number) => {
    const orden = produccion.find(o => o.id === id);
    if (!orden || orden.estado === 'completado') return;

    // 1. Obtener receta
    const receta = recetas.find(r => r.productoId === orden.productoId);
    if (!receta) {
      toast.error('No hay receta definida para este producto. No se pueden descontar insumos.');
    } else {
      // 2. Descontar ingredientes
      for (const ingrediente of receta.ingredientes) {
        const cantidadTotal = (ingrediente.cantidad / receta.porcionesResultantes) * cantidadCompletada;
        await onAjustarStock(
          ingrediente.productoId,
          cantidadTotal,
          'salida',
          `Producción Lote: ${orden.lote || 'N/A'} - Orden: ${orden.id.slice(0, 8)}`
        );
      }
    }

    // 3. Cargar producto terminado
    await onAjustarStock(
      orden.productoId,
      cantidadCompletada,
      'entrada',
      `Producción Finalizada Lote: ${orden.lote || 'N/A'}`
    );

    // 4. Actualizar orden
    const updatedOrden: OrdenProduccion = {
      ...orden,
      cantidadCompletada,
      estado: 'completado',
      fechaFin: new Date().toISOString()
    };
    await db.updateOrdenProduccion(updatedOrden as any);
    setProduccion(prev => prev.map(o => o.id === id ? updatedOrden : o));

    toast.success(`Producción de ${cantidadCompletada} unidades completada y stock actualizado.`);
  }, [produccion, recetas, onAjustarStock]);

  // Estados para Formulaciones y Modelos de Pan
  const [formulaciones, setFormulaciones] = useState<import('@/types').FormulacionBase[]>([]);
  const [modelosPan, setModelosPan] = useState<import('@/types').ModeloPan[]>([]);

  // Cargar formulaciones y modelos desde localStorage
  useEffect(() => {
    const savedFormulaciones = localStorage.getItem('formulaciones');
    const savedModelos = localStorage.getItem('modelosPan');
    if (savedFormulaciones) setFormulaciones(JSON.parse(savedFormulaciones));
    if (savedModelos) setModelosPan(JSON.parse(savedModelos));
  }, []);

  // Persistir formulaciones
  useEffect(() => {
    if (formulaciones.length > 0 || localStorage.getItem('formulaciones')) {
      localStorage.setItem('formulaciones', JSON.stringify(formulaciones));
    }
  }, [formulaciones]);

  // Persistir modelos
  useEffect(() => {
    if (modelosPan.length > 0 || localStorage.getItem('modelosPan')) {
      localStorage.setItem('modelosPan', JSON.stringify(modelosPan));
    }
  }, [modelosPan]);

  // Funciones CRUD para Formulaciones
  const addFormulacion = useCallback(async (data: Omit<import('@/types').FormulacionBase, 'id'>) => {
    const formulacion: import('@/types').FormulacionBase = {
      ...data,
      id: crypto.randomUUID(),
    };
    setFormulaciones(prev => [...prev, formulacion]);
    toast.success('Formulación creada');
    return formulacion;
  }, []);

  const updateFormulacion = useCallback(async (id: string, updates: Partial<import('@/types').FormulacionBase>) => {
    setFormulaciones(prev => prev.map(f => f.id === id ? { ...f, ...updates, fechaActualizacion: new Date().toISOString() } : f));
    toast.success('Formulación actualizada');
  }, []);

  const deleteFormulacion = useCallback(async (id: string) => {
    setFormulaciones(prev => prev.filter(f => f.id !== id));
    toast.success('Formulación eliminada');
  }, []);

  // Funciones CRUD para Modelos de Pan
  const addModeloPan = useCallback(async (data: Omit<import('@/types').ModeloPan, 'id'>) => {
    const modelo: import('@/types').ModeloPan = {
      ...data,
      id: crypto.randomUUID(),
    };
    setModelosPan(prev => [...prev, modelo]);
    toast.success('Modelo de pan creado');
    return modelo;
  }, []);

  const updateModeloPan = useCallback(async (id: string, updates: Partial<import('@/types').ModeloPan>) => {
    setModelosPan(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
    toast.success('Modelo actualizado');
  }, []);

  const deleteModeloPan = useCallback(async (id: string) => {
    setModelosPan(prev => prev.filter(m => m.id !== id));
    toast.success('Modelo eliminado');
  }, []);

  return {
    // Datos
    productos,
    proveedores,
    precios,
    historial,
    alertas,
    configuracion,
    prepedidos,
    recepciones,
    estadisticas, // Nuevo export para uso directo sin llamar a función

    inventario,
    movimientos,
    produccion,
    formulaciones,
    modelosPan,
    loaded,
    downloadFromCloud,
    syncWithCloud,

    // Datos de ejemplo
    cargarDatosEjemplo,

    // Acciones de Recetas
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

    // Acciones de Categorías
    addCategoria,
    deleteCategoria,

    // Acciones de Productos
    addProducto,
    updateProducto,
    deleteProducto,

    // Acciones de Proveedores
    addProveedor,
    updateProveedor,
    deleteProveedor,

    // Acciones de Precios
    addOrUpdatePrecio,
    deletePrecio,

    // Acciones de Pre-Pedidos
    addPrePedido,
    updatePrePedido,
    deletePrePedido,
    addItemToPrePedido,
    removeItemFromPrePedido,
    updateItemCantidad,

    // Acciones de Alertas
    marcarAlertaLeida,
    marcarTodasAlertasLeidas,
    deleteAlerta,
    clearAllAlertas,

    // Acciones de Inventario
    onAjustarStock,

    // Acciones de Producción
    addOrdenProduccion,
    updateOrdenProduccion,
    finalizarProduccion,

    // Acciones de Formulaciones y Modelos
    addFormulacion,
    updateFormulacion,
    deleteFormulacion,
    addModeloPan,
    updateModeloPan,
    deleteModeloPan,

    // Acciones de Recepciones
    addRecepcion,
    confirmarRecepcion,
    updateRecepcion,
    getRecepcionesByProveedor,

    // Configuración
    updateConfiguracion,

    // Ventas y Caja
    ventas,
    sesionesCaja,
    cajaActiva,
    registrarVenta,
    abrirCaja,
    cerrarCaja,
    registrarMovimientoCaja,

    // Utilidades
    formatCurrency,
    getMonedaActual,
    getPreciosByProducto,
    getPreciosByProveedor,
    getMejorPrecio,
    getMejorPrecioByProveedor,
    generarSugerenciasPedido,
    getProductoById,
    getProveedorById,
    getPrecioByIds,
    getPrePedidoById,
    getPrePedidosByProveedor,
    getAlertasNoLeidas,
    getEstadisticas,
    ahorros,
    mesas,
    pedidosActivos,
    updateMesa: useCallback(async (mesa: Mesa) => {
      await db.updateMesa(mesa);
      setMesas(prev => prev.map(m => m.id === mesa.id ? mesa : m));
    }, []),
    addMesa: useCallback(async (mesa: Mesa) => {
      await db.updateMesa(mesa); // put = upsert
      setMesas(prev => [...prev, mesa]);
    }, []),
    deleteMesa: useCallback(async (id: string) => {
      await db.deleteMesa(id);
      setMesas(prev => prev.filter(m => m.id !== id));
    }, []),
    addPedidoActivo: useCallback(async (pedido: PedidoActivo) => {
      await db.addPedidoActivo(pedido);
      setPedidosActivos(prev => [...prev, pedido]);
    }, []),
    updatePedidoActivo: useCallback(async (pedido: PedidoActivo) => {
      await db.updatePedidoActivo(pedido);
      setPedidosActivos(prev => prev.map(p => p.id === pedido.id ? pedido : p));
    }, []),
    deletePedidoActivo: useCallback(async (id: string) => {
      await db.deletePedidoActivo(id);
      setPedidosActivos(prev => prev.filter(p => p.id !== id));
    }, []),

    // Gastos
    gastos,
    addGasto: useCallback(async (g: Omit<Gasto, 'id'>) => {
      const newG = { ...g, id: crypto.randomUUID() };
      await db.addGasto(newG as any);
      setGastos(prev => [newG as Gasto, ...prev]);
    }, []),
    updateGasto: useCallback(async (id: string, updates: Partial<Gasto>) => {
      const gasto = gastos.find(g => g.id === id);
      if (!gasto) return;
      const updated = { ...gasto, ...updates };
      await db.updateGasto(updated as any);
      setGastos(prev => prev.map(g => g.id === id ? updated : g));
    }, [gastos]),
    deleteGasto: useCallback(async (id: string) => {
      await db.deleteGasto(id);
      setGastos(prev => prev.filter(g => g.id !== id));
    }, []),
    generarReporte: useCallback((periodo: string) => {
      const gastosPeriodo = gastos.filter(g => g.fecha.startsWith(periodo));
      const ventasPeriodo = ventas.filter(v => v.fecha.startsWith(periodo));

      const totalVentas = ventasPeriodo.reduce((s, v) => s + v.total, 0);
      const totalGastos = gastosPeriodo.reduce((s, g) => s + g.monto, 0);

      const gastosPorCategoria = gastosPeriodo.reduce((acc, g) => {
        acc[g.categoria] = (acc[g.categoria] || 0) + g.monto;
        return acc;
      }, {} as any);

      return {
        periodo,
        totalVentas,
        totalGastos,
        utilidadBruta: totalVentas - totalGastos,
        gastosPorCategoria,
        ventasPorMetodoPago: ventasPeriodo.reduce((acc, v) => {
          acc[v.metodoPago] = (acc[v.metodoPago] || 0) + v.total;
          return acc;
        }, {} as any)
      };
    }, [gastos, ventas]),

    // Créditos a Clientes
    creditosClientes,
    addCreditoCliente: useCallback(async (c: Omit<CreditoCliente, 'id' | 'createdAt'>) => {
      const nuevo: CreditoCliente = { ...c, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
      await db.addCreditoCliente(nuevo);
      setCreditosClientes(prev => [nuevo, ...prev]);
    }, []),
    updateCreditoCliente: useCallback(async (id: string, updates: Partial<CreditoCliente>) => {
      const credito = creditosClientes.find(c => c.id === id);
      if (!credito) return;
      const updated = { ...credito, ...updates };
      await db.updateCreditoCliente(updated);
      setCreditosClientes(prev => prev.map(c => c.id === id ? updated : c));
    }, [creditosClientes]),
    deleteCreditoCliente: useCallback(async (id: string) => {
      await db.deleteCreditoCliente(id);
      setCreditosClientes(prev => prev.filter(c => c.id !== id));
    }, []),
    registrarPagoCredito: useCallback(async (creditoId: string, pago: Omit<PagoCredito, 'id' | 'creditoId'>) => {
      const credito = creditosClientes.find(c => c.id === creditoId);
      if (!credito) return;
      const nuevoPago: PagoCredito = { ...pago, id: crypto.randomUUID(), creditoId };
      const nuevoSaldo = Math.max(0, credito.saldo - pago.monto);
      const updated: CreditoCliente = {
        ...credito,
        saldo: nuevoSaldo,
        estado: nuevoSaldo <= 0 ? 'pagado' : credito.estado,
        pagos: [...credito.pagos, nuevoPago]
      };
      await db.updateCreditoCliente(updated);
      setCreditosClientes(prev => prev.map(c => c.id === creditoId ? updated : c));
    }, [creditosClientes]),

    // Trabajadores
    trabajadores,
    addTrabajador: useCallback(async (t: Omit<Trabajador, 'id' | 'createdAt'>) => {
      const nuevo: Trabajador = { ...t, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
      await db.addTrabajador(nuevo);
      setTrabajadores(prev => [nuevo, ...prev]);
    }, []),
    updateTrabajador: useCallback(async (id: string, updates: Partial<Trabajador>) => {
      const trab = trabajadores.find(t => t.id === id);
      if (!trab) return;
      const updated = { ...trab, ...updates };
      await db.updateTrabajador(updated);
      setTrabajadores(prev => prev.map(t => t.id === id ? updated : t));
    }, [trabajadores]),
    deleteTrabajador: useCallback(async (id: string) => {
      await db.deleteTrabajador(id);
      setTrabajadores(prev => prev.filter(t => t.id !== id));
    }, []),

    clearAllData,
    loadAllData,
    MONEDAS,
  };
}
