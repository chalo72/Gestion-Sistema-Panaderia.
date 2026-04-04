// Tipos para el sistema de control de precios

// Importar nuevos tipos del ecosistema Antigravity
export * from './product-variants';
export * from './payment-system';
export * from './categories';

export type ProductoTipo = 'ingrediente' | 'elaborado';

export interface Producto {
  id: string;
  nombre: string;
  categoria: string;
  descripcion?: string;
  precioVenta: number;
  precioCompra?: number;  // Para productos customizados en POS
  margenUtilidad: number;
  tipo: ProductoTipo; // 'ingrediente' para materias primas, 'elaborado' para panes/tortas
  costoBase?: number;  // Costo calculado si es elaborado, o manual si es ingrediente sin proveedor
  imagen?: string;
  createdAt: string;
  updatedAt?: string; // PROTEGIDO: Corregido para compatibilidad con DBProducto (opcional en DB)
}

export interface IngredienteReceta {
  id: string;
  recetaId: string;
  productoId: string; // El ID del producto tipo 'ingrediente'
  cantidad: number;
  unidad: string; // gr, kg, ml, l, unidad
  costoCalculado: number; // Precio al momento de la receta o dinámico
}

export interface Receta {
  id: string;
  productoId: string; // El ID del producto tipo 'elaborado'
  ingredientes: IngredienteReceta[];
  porcionesResultantes: number;
  costoTotal: number;
  costoPorPorcion: number;
  instrucciones?: string;
  temperaturaHorno?: number; // Grados C
  tiempoHorneado?: number;   // Minutos
  tiempoFermentacion?: number; // Minutos
  dificultad?: 'facil' | 'medio' | 'maestro';
  fechaActualizacion: string;
}

// ============================================
// PRODUCCION (FABRICACION)
// ============================================

export type ProduccionEstado = 'planeado' | 'en_proceso' | 'completado' | 'cancelado';

export interface OrdenProduccion {
  id: string;
  productoId: string; // ID del producto tipo 'elaborado'
  cantidadPlaneada: number;
  cantidadCompletada: number;
  estado: ProduccionEstado;
  fechaInicio: string;
  fechaFin?: string;
  usuarioId: string;
  notas?: string;
  lote?: string;
  costoEstimadoTotal: number;
  // Nuevos campos para sistema avanzado
  formulacionId?: string;       // Referencia a la formulación base usada
  modeloPanId?: string;         // Modelo de pan específico
  arrobasUsadas?: number;       // Cantidad de arrobas de masa
  mermaKg?: number;             // Kg de merma registrada
  costoRealTotal?: number;      // Costo real al finalizar
}

// ============================================
// SISTEMA DE FORMULACIÓN POR ARROBA
// ============================================

// Constante: 1 arroba = 11.5 kg de masa (estándar panadería colombiana)
export const ARROBA_KG = 11.5;

// Ingrediente dentro de una formulación (por arroba)
export interface IngredienteFormulacion {
  id: string;
  formulacionId: string;
  productoId: string;        // ID del insumo/ingrediente
  cantidadPorArroba: number; // Cantidad necesaria por arroba de masa
  unidad: 'gr' | 'kg' | 'ml' | 'l' | 'und';
  porcentajePanadero?: number; // % sobre la harina (opcional)
  costoUnitario: number;     // Costo por unidad al momento de registrar
  costoTotalArroba: number;  // cantidadPorArroba * costoUnitario
}

// Formulación base (receta maestra por arroba)
export interface FormulacionBase {
  id: string;
  nombre: string;              // Ej: "Masa Pan Francés", "Masa Integral"
  descripcion?: string;
  categoria: 'panes' | 'pasteleria' | 'hojaldres' | 'dulces' | 'especiales';
  ingredientes: IngredienteFormulacion[];
  rendimientoBaseKg: number;   // Kg de masa resultante por arroba (~11.5 pero puede variar)
  costoTotalArroba: number;    // Suma de costos de ingredientes
  tiempoFermentacion?: number; // Minutos
  tiempoHorneado?: number;     // Minutos
  temperaturaHorno?: number;   // Grados C
  instrucciones?: string;
  activo: boolean;
  fechaActualizacion: string;
}

// ============================================
// MODELOS DE PAN POR FORMULACIÓN
// ============================================

export interface ModeloPan {
  id: string;
  nombre: string;              // Ej: "Pan Francés 80gr", "Mogolla 50gr"
  formulacionId: string;       // Qué formulación de masa usa
  pesoUnitarioGr: number;      // Peso de cada unidad en gramos
  panesPorArroba: number;      // Calculado: (ARROBA_KG * 1000) / pesoUnitarioGr
  precioVentaUnitario: number; // Precio de venta sugerido
  costoUnitario: number;       // Calculado desde formulación
  margenPorcentaje: number;    // Margen de ganancia
  mermaEstimada: number;       // % de pérdida estimado en formado/horneado
  imagen?: string;
  activo: boolean;
  createdAt: string;
}

// ============================================
// CONTROL DE INSUMOS Y PEDIDOS
// ============================================

// Proyección de necesidades de insumos
export interface ProyeccionInsumo {
  productoId: string;
  nombreProducto: string;
  cantidadNecesaria: number;
  unidad: string;
  stockActual: number;
  stockMinimo: number;
  deficit: number;              // cantidadNecesaria - stockActual (si es positivo)
  costoEstimado: number;
  proveedorRecomendado?: string;
}

// Pedido de insumos generado automáticamente
export interface PedidoInsumoProduccion {
  id: string;
  fechaGeneracion: string;
  arrobasPlanificadas: number;
  formulacionId: string;
  items: ProyeccionInsumo[];
  costoTotalEstimado: number;
  estado: 'borrador' | 'aprobado' | 'enviado' | 'recibido';
  notas?: string;
}

// ============================================
// REGISTRO DE MERMAS Y DESPERDICIOS
// ============================================

export type TipoMerma = 'formado' | 'horneado' | 'enfriamiento' | 'empaque' | 'otro';

export interface RegistroMerma {
  id: string;
  ordenProduccionId: string;
  tipoMerma: TipoMerma;
  cantidadKg: number;
  motivo: string;
  fechaRegistro: string;
  usuarioId: string;
}

// ============================================
// HISTORIAL Y TRAZABILIDAD
// ============================================

export interface LoteProduccion {
  id: string;
  codigo: string;              // Ej: "LOT-2026-02-28-001"
  ordenProduccionId: string;
  formulacionId: string;
  modeloPanId: string;
  fechaProduccion: string;
  arrobasUsadas: number;
  unidadesProducidas: number;
  mermaTotal: number;
  costoTotalReal: number;
  costoUnitarioReal: number;
  rendimientoReal: number;     // % vs rendimiento esperado
  insumosConsumidos: {
    productoId: string;
    cantidadUsada: number;
    loteInsumo?: string;       // Para trazabilidad hacia atrás
  }[];
}

export interface Categoria {
  id: string;
  nombre: string;
  color: string;
  icono?: string;
  tipo?: 'venta' | 'insumo';
}

export interface Proveedor {
  id: string;
  nombre: string;
  contacto?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  ubicacion?: string; // pueblo, ciudad, corregimiento o vereda
  imagen?: string;
  calificacion?: number; // 1-5 estrellas
  createdAt: string;
}

export interface PrecioProveedor {
  id: string;
  productoId: string;
  proveedorId: string;
  precioCosto: number;
  fechaActualizacion: string;
  notas?: string;
  destino?: 'venta' | 'insumo';
  tipoEmbalaje?: string;
  cantidadEmbalaje?: number;
}

export interface HistorialPrecio {
  id: string;
  productoId: string;
  proveedorId: string;
  precioAnterior: number;
  precioNuevo: number;
  fechaCambio: string;
}

export interface AlertaPrecio {
  id: string;
  productoId: string;
  proveedorId: string;
  tipo: 'subida' | 'bajada';
  precioAnterior: number;
  precioNuevo: number;
  diferencia: number;
  porcentajeCambio: number;
  fecha: string;
  leida: boolean;
}

// NUEVO: Sistema de Pre-Pedidos
export interface PrePedidoItem {
  id: string;
  productoId: string;
  proveedorId: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface PrePedido {
  id: string;
  nombre: string; // Nombre del pedido (ej: "Pedido Enero 2024")
  proveedorId: string;
  items: PrePedidoItem[];
  total: number;
  presupuestoMaximo: number;
  estado: 'borrador' | 'confirmado' | 'rechazado';
  notas?: string;
  fechaCreacion: string;
  fechaActualizacion: string;
}

// Tipos de moneda soportadas
export type MonedaCode = 'EUR' | 'COP' | 'USD' | 'MXN' | 'ARS' | 'CLP' | 'PEN' | 'VES';

export interface Moneda {
  code: MonedaCode;
  nombre: string;
  simbolo: string;
  locale: string;
}

// Monedas disponibles
export const MONEDAS: Moneda[] = [
  { code: 'EUR', nombre: 'Euro', simbolo: '€', locale: 'es-ES' },
  { code: 'COP', nombre: 'Peso Colombiano', simbolo: '$', locale: 'es-CO' },
  { code: 'USD', nombre: 'Dólar Estadounidense', simbolo: 'US$', locale: 'en-US' },
  { code: 'MXN', nombre: 'Peso Mexicano', simbolo: '$', locale: 'es-MX' },
  { code: 'ARS', nombre: 'Peso Argentino', simbolo: '$', locale: 'es-AR' },
  { code: 'CLP', nombre: 'Peso Chileno', simbolo: '$', locale: 'es-CL' },
  { code: 'PEN', nombre: 'Sol Peruano', simbolo: 'S/', locale: 'es-PE' },
  { code: 'VES', nombre: 'Bolívar Venezolano', simbolo: 'Bs.', locale: 'es-VE' },
];

export interface Configuracion {
  margenUtilidadDefault: number;
  ajusteAutomatico: boolean;
  notificarSubidas: boolean;
  umbralAlerta: number; // Porcentaje mínimo de cambio para alertar
  categorias: Categoria[];
  moneda: MonedaCode;
  nombreNegocio: string;
  direccionNegocio?: string;
  telefonoNegocio?: string;
  emailNegocio?: string;
  impuestoPorcentaje: number;
  mostrarUtilidadEnLista: boolean;
  presupuestoMensual?: number;
  categoriasBorradas?: string[];  // NOMBRES de categorías eliminadas — nunca se re-agregan al iniciar
  seedCompletado?: boolean;       // true = ya se sembró datos iniciales, no repetir
  publicUrl?: string;             // URL de producción (Vercel) para enlaces de acceso
}

export type ViewType = 'dashboard' | 'productos' | 'proveedores' | 'precios' | 'alertas' | 'prepedidos' | 'configuracion' | 'login' | 'usuarios' | 'inventario' | 'recepciones' | 'exportar' | 'roles' | 'recetas' | 'ventas' | 'caja' | 'ahorro' | 'gastos' | 'reportes' | 'produccion' | 'historial-ventas' | 'cargamasiva' | 'listapreciosproincial' | 'creditos' | 'trabajadores' | 'mayoristas';

// ============================================
// SISTEMA DE ROLES Y PERMISOS
// ============================================

export type UserRole = 'ADMIN' | 'GERENTE' | 'COMPRADOR' | 'VENDEDOR' | 'PANADERO' | 'AUXILIAR';

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  apellido?: string;
  rol: UserRole;
  activo: boolean;
  ultimoAcceso?: string;
  createdAt: string;
  password?: string;
}

// Permisos granulares del sistema
export type Permission =
  // Productos
  | 'VER_PRODUCTOS'
  | 'CREAR_PRODUCTOS'
  | 'EDITAR_PRODUCTOS'
  | 'ELIMINAR_PRODUCTOS'
  // Precios
  | 'VER_PRECIOS'
  | 'VER_PRECIO_VENTA'
  | 'VER_PRECIO_COSTO'
  | 'VER_MARGEN'
  | 'EDITAR_PRECIOS'
  // Proveedores
  | 'VER_PROVEEDORES'
  | 'CREAR_PROVEEDORES'
  | 'EDITAR_PROVEEDORES'
  | 'ELIMINAR_PROVEEDORES'
  // Pre-pedidos
  | 'VER_PREPEDIDOS'
  | 'CREAR_PREPEDIDOS'
  | 'EDITAR_PREPEDIDOS'
  | 'ELIMINAR_PREPEDIDOS'
  // Alertas
  | 'VER_ALERTAS'
  | 'GESTIONAR_ALERTAS'
  // Configuración
  | 'VER_CONFIGURACION'
  | 'EDITAR_CONFIGURACION'
  // Usuarios
  | 'VER_USUARIOS'
  | 'CREAR_USUARIOS'
  | 'EDITAR_USUARIOS'
  | 'ELIMINAR_USUARIOS'
  // Dashboard
  | 'VER_DASHBOARD'
  | 'VER_ESTADISTICAS'
  // Inventario
  | 'VER_INVENTARIO'
  | 'GESTIONAR_INVENTARIO'
  // Recepciones
  | 'VER_RECEPCIONES'
  | 'CREAR_RECEPCIONES'
  // Ventas
  | 'VER_VENTAS'
  | 'GESTIONAR_VENTAS'
  | 'ABRIR_CERRAR_CAJA'
  | 'VER_FINANZAS'
  // Producción
  | 'VER_PRODUCCION'
  | 'GESTIONAR_PRODUCCION'
  // Exportación
  | 'EXPORTAR_DATOS';

// Matriz de permisos por rol
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ADMIN: [
    'VER_PRODUCTOS', 'CREAR_PRODUCTOS', 'EDITAR_PRODUCTOS', 'ELIMINAR_PRODUCTOS',
    'VER_PRECIOS', 'VER_PRECIO_VENTA', 'VER_PRECIO_COSTO', 'VER_MARGEN', 'EDITAR_PRECIOS',
    'VER_PROVEEDORES', 'CREAR_PROVEEDORES', 'EDITAR_PROVEEDORES', 'ELIMINAR_PROVEEDORES',
    'VER_PREPEDIDOS', 'CREAR_PREPEDIDOS', 'EDITAR_PREPEDIDOS', 'ELIMINAR_PREPEDIDOS',
    'VER_ALERTAS', 'GESTIONAR_ALERTAS',
    'VER_CONFIGURACION', 'EDITAR_CONFIGURACION',
    'VER_USUARIOS', 'CREAR_USUARIOS', 'EDITAR_USUARIOS', 'ELIMINAR_USUARIOS',
    'VER_DASHBOARD', 'VER_ESTADISTICAS',
    'VER_INVENTARIO', 'GESTIONAR_INVENTARIO',
    'VER_RECEPCIONES', 'CREAR_RECEPCIONES',
    'VER_VENTAS', 'GESTIONAR_VENTAS', 'ABRIR_CERRAR_CAJA', 'VER_FINANZAS',
    'VER_PRODUCCION', 'GESTIONAR_PRODUCCION',
    'EXPORTAR_DATOS',
  ],
  GERENTE: [
    'VER_PRODUCTOS', 'CREAR_PRODUCTOS', 'EDITAR_PRODUCTOS',
    'VER_PRECIOS', 'VER_PRECIO_VENTA', 'VER_PRECIO_COSTO', 'VER_MARGEN', 'EDITAR_PRECIOS',
    'VER_PROVEEDORES', 'CREAR_PROVEEDORES', 'EDITAR_PROVEEDORES',
    'VER_PREPEDIDOS', 'CREAR_PREPEDIDOS', 'EDITAR_PREPEDIDOS',
    'VER_ALERTAS', 'GESTIONAR_ALERTAS',
    'VER_CONFIGURACION',
    'VER_USUARIOS',
    'VER_DASHBOARD', 'VER_ESTADISTICAS',
    'VER_INVENTARIO', 'GESTIONAR_INVENTARIO',
    'VER_RECEPCIONES', 'CREAR_RECEPCIONES',
    'VER_VENTAS', 'GESTIONAR_VENTAS', 'ABRIR_CERRAR_CAJA', 'VER_FINANZAS',
    'VER_PRODUCCION', 'GESTIONAR_PRODUCCION',
    'EXPORTAR_DATOS',
  ],
  COMPRADOR: [
    'VER_PRODUCTOS',
    'VER_PRECIOS', 'VER_PRECIO_VENTA', 'VER_PRECIO_COSTO', 'EDITAR_PRECIOS',
    'VER_PROVEEDORES', 'CREAR_PROVEEDORES', 'EDITAR_PROVEEDORES',
    'VER_PREPEDIDOS', 'CREAR_PREPEDIDOS', 'EDITAR_PREPEDIDOS', 'ELIMINAR_PREPEDIDOS',
    'VER_ALERTAS',
    'VER_DASHBOARD',
    'VER_INVENTARIO',
    'VER_RECEPCIONES', 'CREAR_RECEPCIONES',
  ],
  VENDEDOR: [
    'VER_PRODUCTOS',
    'VER_PRECIO_VENTA',
    'VER_DASHBOARD',
    'VER_VENTAS', 'GESTIONAR_VENTAS', 'ABRIR_CERRAR_CAJA',
  ],
  PANADERO: [
    'VER_PRODUCTOS',
    'VER_DASHBOARD',
    'VER_INVENTARIO', 'GESTIONAR_INVENTARIO',
    'VER_PRODUCCION', 'GESTIONAR_PRODUCCION',
    'VER_RECEPCIONES', 'CREAR_RECEPCIONES',
  ],
  AUXILIAR: [
    'VER_PRODUCTOS',
    'VER_DASHBOARD',
    'VER_VENTAS', 'GESTIONAR_VENTAS',
    'VER_INVENTARIO',
    'VER_PRODUCCION',
  ],
};

// Descripción de roles
export const ROLE_DESCRIPTIONS: Record<UserRole, { nombre: string; descripcion: string; color: string }> = {
  ADMIN: { nombre: 'Administrador', descripcion: 'Acceso total al sistema', color: '#8b5cf6' },
  GERENTE: { nombre: 'Gerente', descripcion: 'Gestión completa excepto configuración crítica', color: '#3b82f6' },
  COMPRADOR: { nombre: 'Comprador', descripcion: 'Gestión de proveedores y costos', color: '#22c55e' },
  VENDEDOR: { nombre: 'Vendedor', descripcion: 'Solo visualización de productos y precios', color: '#f59e0b' },
  PANADERO: { nombre: 'Panadero', descripcion: 'Producción, inventario y recetas', color: '#d97706' },
  AUXILIAR: { nombre: 'Auxiliar', descripcion: 'Apoyo en ventas, producción e inventario', color: '#64748b' },
};


// ============================================
// INVENTARIO
// ============================================

export interface InventarioItem {
  id: string;
  productoId: string;
  stockActual: number;
  stockMinimo: number;
  ubicacion?: string;
  ultimoMovimiento?: string;
}

export interface MovimientoInventario {
  id: string;
  productoId: string;
  tipo: 'entrada' | 'salida' | 'ajuste';
  cantidad: number;
  motivo: string;
  fecha: string;
  usuario: string;
}

// ============================================
// RECEPCIONES
// ============================================

export interface RecepcionItem {
  id: string;
  productoId: string;
  cantidadEsperada: number;
  cantidadRecibida: number;
  precioEsperado: number;
  precioFacturado: number;
  embalajeOk: boolean;
  productoOk: boolean;
  cantidadOk: boolean;
  modeloOk: boolean;
  defectuosos: number;
  lote?: string;
  observaciones?: string;
}

export interface Recepcion {
  id: string;
  prePedidoId?: string;
  proveedorId: string;
  numeroFactura: string;
  fechaFactura: string;
  totalFactura: number;
  items: RecepcionItem[];
  estado: 'en_proceso' | 'completada' | 'con_incidencias';
  recibidoPor: string;
  firma?: string;
  observaciones?: string;
  fechaRecepcion: string;
  imagenFactura?: string;
}

// ============================================
// ARCHIVO DE FACTURAS ESCANEADAS
// ============================================

export interface FacturaEscaneada {
  id: string;
  recepcionId: string;
  proveedorId: string;
  proveedorNombre: string;
  numeroFactura: string;
  imagenBase64: string;
  fechaFactura: string;
  fechaEscaneo: string;
  totalFactura: number;
  cantidadProductos: number;
  etiquetas?: string[];
  notas?: string;
}

// ============================================
// VENTAS (POS)
// ============================================

export type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia' | 'nequi' | 'daviplata' | 'descuento_nomina' | 'credito' | 'otro';

export interface VentaItem {
  id: string;
  productoId: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface Venta {
  id: string;
  cajaId?: string;
  items: VentaItem[];
  total: number;
  metodoPago: MetodoPago;
  usuarioId: string;
  cliente?: string;
  notas?: string;
  fecha: string;
}

export interface MovimientoCaja {
  id: string;
  cajaId: string;
  tipo: 'entrada' | 'salida';
  monto: number;
  motivo: string;
  fecha: string;
  usuarioId: string;
}

export interface CajaSesion {
  id: string;
  usuarioId: string;
  fechaApertura: string;
  fechaCierre?: string;
  montoApertura: number;
  montoCierre?: number;
  totalVentas: number;
  // Desglose por tipo de pago (para cuadre de caja correcto)
  totalVentasEfectivo?: number;  // Solo ventas con pago inmediato (efectivo, tarjeta, nequi, etc.)
  totalCreditos?: number;        // Ventas a crédito — NO entran al cajón físico
  ventasIds: string[];
  movimientos: MovimientoCaja[];
  estado: 'abierta' | 'cerrada';
  // Sistema multi-caja Dulce Placer
  cajaNombre?: string;
  turno?: 'Mañana' | 'Tarde' | 'Noche';
  vendedoraNombre?: string;
}
// ============================================
// PRÉSTAMOS ENTRE CAJAS
// ============================================
export interface PrestamoEntreCajas {
  id: string;
  cajaOrigenId: string;
  cajaOrigenNombre: string;
  cajaDestinoId: string;
  cajaDestinoNombre: string;
  monto: number;
  motivo: string;
  estado: 'pendiente' | 'devuelto';
  fechaPrestamo: string;
  fechaDevolucion?: string;
  usuarioId: string;
  usuarioNombre: string;
}

// ============================================
// MESAS Y PEDIDOS ACTIVOS (Muro de Pedidos)
// ============================================

export interface Mesa {
  id: string;
  numero: string;
  capacidad: number;
  estado: 'disponible' | 'ocupada' | 'reservada' | 'mantenimiento';
  pedidoActivoId?: string;
  ubicacion?: string;
}

export interface PedidoActivo {
  id: string;
  mesaId?: string;
  items: VentaItem[];
  cliente?: string;
  total: number;
  estado: 'abierto' | 'preparando' | 'listo' | 'entregado';
  notas?: string;
  fechaInicio: string;
  ultimoCambio: string;
}
// ============================================
// GASTOS Y FACTURACIÓN
// ============================================

export type GastoCategoria = 'Servicios' | 'Arriendo' | 'Materia Prima' | 'Nómina' | 'Mantenimiento' | 'Otros';

export interface Gasto {
  id: string;
  descripcion: string;
  monto: number;
  categoria: GastoCategoria;
  fecha: string;
  estado: 'pendiente' | 'pagado' | 'anulado';
  proveedorId?: string;
  comprobanteUrl?: string; // URL de la imagen de la factura escaneada
  metodoPago: MetodoPago;
  usuarioId: string;
  cajaId?: string; // Si el gasto salió de una caja abierta
  metadata?: {
    carpeta: string;
    nombreArchivo: string;
    etiquetas: string[];
  };
}

export interface ReporteFinanciero {
  periodo: string; // "2024-02"
  totalVentas: number;
  totalGastos: number;
  utilidadBruta: number;
  gastosPorCategoria: Record<GastoCategoria, number>;
  ventasPorMetodoPago: Record<MetodoPago, number>;
}

// ============================================================
// CRÉDITOS — TIPOS COMPARTIDOS
// ============================================================
export interface ItemCredito {
  productoId: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface PagoCredito {
  id: string;
  creditoId: string;
  monto: number;
  fecha: string;
  metodoPago: MetodoPago;
  nota?: string;
}

// ============================================================
// CRÉDITOS A CLIENTES
// ============================================================
export interface CreditoCliente {
  id: string;
  clienteNombre: string;
  clienteTelefono?: string;
  monto: number;              // Monto total del crédito
  saldo: number;              // Saldo pendiente
  descripcion: string;        // Qué se fió / por qué
  fecha: string;              // Fecha del crédito
  fechaVencimiento?: string;  // Fecha límite de pago
  estado: 'activo' | 'pagado' | 'vencido';
  items: ItemCredito[];       // Productos fiados
  fotoEvidencia?: string;     // base64 foto del producto/cliente
  pagos: PagoCredito[];
  usuarioId: string;
  createdAt: string;
}

// ============================================================
// CRÉDITOS A TRABAJADORES
// ============================================================
export interface CreditoTrabajador {
  id: string;
  trabajadorId: string;
  trabajadorNombre: string;
  trabajadorRol?: string;
  monto: number;              // Total del crédito
  saldo: number;              // Saldo pendiente
  descripcion: string;        // Descripción libre
  fecha: string;
  fechaVencimiento?: string;
  estado: 'activo' | 'pagado' | 'descontado';
  items: ItemCredito[];       // Productos tomados
  fotoEvidencia?: string;     // base64 — foto de evidencia obligatoria
  descontarDeSalario: boolean;// Si se descuenta del próximo pago
  pagos: PagoCredito[];
  usuarioId: string;
  createdAt: string;
}

// ============================================================
// TRABAJADORES / EMPLEADOS
// ============================================================
export type TrabajadorEstado = 'activo' | 'inactivo' | 'vacaciones';
export type TrabajadorRol = 'panadero' | 'vendedor' | 'cajero' | 'repartidor' | 'administrador' | 'otro';

export interface Trabajador {
  id: string;
  nombre: string;
  cedula?: string;
  telefono?: string;
  email?: string;
  rol: TrabajadorRol;
  salarioBase: number;
  fechaIngreso: string;
  estado: TrabajadorEstado;
  horario?: string;           // ej: "Lun-Vie 7am-3pm"
  observaciones?: string;
  fotoPerfil?: string;        // base64 foto del trabajador
  createdAt: string;
}
