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
  updatedAt: string;
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
  fechaActualizacion: string;
}

export interface Categoria {
  id: string;
  nombre: string;
  color: string;
  icono?: string;
}

export interface Proveedor {
  id: string;
  nombre: string;
  contacto?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
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
}

export type ViewType = 'dashboard' | 'productos' | 'proveedores' | 'precios' | 'alertas' | 'prepedidos' | 'configuracion' | 'login' | 'usuarios' | 'inventario' | 'recepciones' | 'exportar' | 'roles' | 'recetas' | 'ventas' | 'caja' | 'ahorro' | 'gastos' | 'reportes';

// ============================================
// SISTEMA DE ROLES Y PERMISOS
// ============================================

export type UserRole = 'ADMIN' | 'GERENTE' | 'COMPRADOR' | 'VENDEDOR';

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  apellido?: string;
  rol: UserRole;
  activo: boolean;
  ultimoAcceso?: string;
  createdAt: string;
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
    'VER_VENTAS', 'GESTIONAR_VENTAS',
  ],
};

// Descripción de roles
export const ROLE_DESCRIPTIONS: Record<UserRole, { nombre: string; descripcion: string; color: string }> = {
  ADMIN: { nombre: 'Administrador', descripcion: 'Acceso total al sistema', color: '#8b5cf6' },
  GERENTE: { nombre: 'Gerente', descripcion: 'Gestión completa excepto configuración crítica', color: '#3b82f6' },
  COMPRADOR: { nombre: 'Comprador', descripcion: 'Gestión de proveedores y costos', color: '#22c55e' },
  VENDEDOR: { nombre: 'Vendedor', descripcion: 'Solo visualización de productos y precios', color: '#f59e0b' },
};

// Usuarios Oficiales - Sistema Blindado 🛡️
export const USUARIOS_PRUEBA: Usuario[] = [
  { id: 'owner-local-id', email: 'Chalo8321@gmail.com', nombre: 'Chalo', apellido: 'Dueño Dulce Placer', rol: 'ADMIN', activo: true, createdAt: new Date().toISOString() },
  { id: 'guest-local-id', email: 'invitado@dulceplacer.com', nombre: 'Invitado', apellido: 'Dulce Placer', rol: 'VENDEDOR', activo: true, createdAt: new Date().toISOString() },
];

// Credenciales de Acceso Oficiales 🔐
export const CREDENCIALES_PRUEBA: Record<string, string> = {
  'Chalo8321@gmail.com': 'admin2026',
  'invitado@dulceplacer.com': 'invitado123',
};

// Categorías de Panadería por defecto
export const CATEGORIAS_DEFAULT: Categoria[] = [
  { id: 'cat-1', nombre: 'Harinas y Materia Prima', color: '#8b5e3c' },
  { id: 'cat-2', nombre: 'Lácteos y Huevos', color: '#facc15' },
  { id: 'cat-3', nombre: 'Azúcares y Endulzantes', color: '#3b82f6' },
  { id: 'cat-4', nombre: 'Levaduras y Aditivos', color: '#10b981' },
  { id: 'cat-5', nombre: 'Empaques y Desechables', color: '#6366f1' },
];

// Datos de ejemplo
export const DATOS_EJEMPLO = {
  proveedores: [
    { id: 'prov-1', nombre: 'Distribuidora García S.L.', contacto: 'Juan García', telefono: '+34 612 345 678', email: 'juan@distribuidoragarcia.com', direccion: 'Calle Mayor 123, Madrid', createdAt: new Date().toISOString() },
    { id: 'prov-2', nombre: 'Importadora López & Cía', contacto: 'María López', telefono: '+34 623 456 789', email: 'maria@importadalopez.com', direccion: 'Av. Industrial 45, Barcelona', createdAt: new Date().toISOString() },
    { id: 'prov-3', nombre: 'Suministros Martínez', contacto: 'Carlos Martínez', telefono: '+34 634 567 890', email: 'carlos@suministrosmartinez.com', direccion: 'Polígono Norte, Nave 12, Valencia', createdAt: new Date().toISOString() },
    { id: 'prov-4', nombre: 'Mayorista Rodríguez', contacto: 'Ana Rodríguez', telefono: '+34 645 678 901', email: 'ana@mayoristarodriguez.com', direccion: 'Calle Comercio 78, Sevilla', createdAt: new Date().toISOString() },
  ],
  productos: [
    { id: 'prod-1', nombre: 'Harina de Trigo Especial', categoria: 'Harinas y Materia Prima', descripcion: 'Harina de fuerza para pan artesanal', precioVenta: 0, margenUtilidad: 0, tipo: 'ingrediente', costoBase: 1.20, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'prod-2', nombre: 'Azúcar Blanca Refinada', categoria: 'Azúcares y Endulzantes', descripcion: 'Bulto de 50kg', precioVenta: 0, margenUtilidad: 0, tipo: 'ingrediente', costoBase: 0.85, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'prod-3', nombre: 'Mantequilla Sin Sal', categoria: 'Lácteos y Huevos', descripcion: 'Bloque de 5kg', precioVenta: 0, margenUtilidad: 0, tipo: 'ingrediente', costoBase: 6.50, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'prod-4', nombre: 'Huevos Grado A', categoria: 'Lácteos y Huevos', descripcion: 'Caja x 30 unidades', precioVenta: 0, margenUtilidad: 0, tipo: 'ingrediente', costoBase: 4.50, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'prod-5', nombre: 'Levadura Seca Activa', categoria: 'Levaduras y Aditivos', descripcion: 'Paquete de 500g', precioVenta: 0, margenUtilidad: 0, tipo: 'ingrediente', costoBase: 3.20, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'prod-6', nombre: 'Pan de Bono Tradicional', categoria: 'Panadería Artesanal', descripcion: 'Producto estrella de la casa', precioVenta: 1.50, margenUtilidad: 45, tipo: 'elaborado', costoBase: 0.82, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'prod-7', nombre: 'Croissant De Mantequilla', categoria: 'Panadería Artesanal', descripcion: 'Hojaldre francés auténtico', precioVenta: 2.50, margenUtilidad: 55, tipo: 'elaborado', costoBase: 1.12, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'prod-8', nombre: 'Torta de Chocolate 12p', categoria: 'Pastelería', descripcion: 'Bizcocho húmedo de cacao', precioVenta: 25.00, margenUtilidad: 60, tipo: 'elaborado', costoBase: 10.00, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ],
  precios: [
    // Laptop HP
    { id: 'precio-1', productoId: 'prod-1', proveedorId: 'prov-1', precioCosto: 499.99, fechaActualizacion: new Date().toISOString(), notas: 'Precio con descuento por volumen' },
    { id: 'precio-2', productoId: 'prod-1', proveedorId: 'prov-2', precioCosto: 520.00, fechaActualizacion: new Date().toISOString(), notas: 'Incluye envío gratis' },
    // Monitor Samsung
    { id: 'precio-3', productoId: 'prod-2', proveedorId: 'prov-1', precioCosto: 175.00, fechaActualizacion: new Date().toISOString(), notas: '' },
    { id: 'precio-4', productoId: 'prod-2', proveedorId: 'prov-3', precioCosto: 169.99, fechaActualizacion: new Date().toISOString(), notas: 'Promoción especial' },
    // Teclado Mecánico
    { id: 'precio-5', productoId: 'prod-3', proveedorId: 'prov-2', precioCosto: 62.50, fechaActualizacion: new Date().toISOString(), notas: '' },
    { id: 'precio-6', productoId: 'prod-3', proveedorId: 'prov-4', precioCosto: 58.00, fechaActualizacion: new Date().toISOString(), notas: 'Mejor precio garantizado' },
    // Camiseta
    { id: 'precio-7', productoId: 'prod-4', proveedorId: 'prov-3', precioCosto: 12.00, fechaActualizacion: new Date().toISOString(), notas: '' },
    { id: 'precio-8', productoId: 'prod-4', proveedorId: 'prov-4', precioCosto: 11.50, fechaActualizacion: new Date().toISOString(), notas: 'Precio mayorista' },
    // Zapatillas Nike
    { id: 'precio-9', productoId: 'prod-5', proveedorId: 'prov-1', precioCosto: 85.00, fechaActualizacion: new Date().toISOString(), notas: '' },
    { id: 'precio-10', productoId: 'prod-5', proveedorId: 'prov-2', precioCosto: 82.99, fechaActualizacion: new Date().toISOString(), notas: 'Liquidación de temporada' },
    // Café
    { id: 'precio-11', productoId: 'prod-6', proveedorId: 'prov-3', precioCosto: 12.50, fechaActualizacion: new Date().toISOString(), notas: '' },
    { id: 'precio-12', productoId: 'prod-6', proveedorId: 'prov-4', precioCosto: 13.00, fechaActualizacion: new Date().toISOString(), notas: '' },
    // Aceite Oliva
    { id: 'precio-13', productoId: 'prod-7', proveedorId: 'prov-3', precioCosto: 34.00, fechaActualizacion: new Date().toISOString(), notas: 'Producto nacional' },
    { id: 'precio-14', productoId: 'prod-7', proveedorId: 'prov-1', precioCosto: 35.50, fechaActualizacion: new Date().toISOString(), notas: '' },
    // Lámpara LED
    { id: 'precio-15', productoId: 'prod-8', proveedorId: 'prov-2', precioCosto: 22.00, fechaActualizacion: new Date().toISOString(), notas: '' },
    { id: 'precio-16', productoId: 'prod-8', proveedorId: 'prov-4', precioCosto: 20.50, fechaActualizacion: new Date().toISOString(), notas: '' },
    // Set Herramientas
    { id: 'precio-17', productoId: 'prod-9', proveedorId: 'prov-1', precioCosto: 58.00, fechaActualizacion: new Date().toISOString(), notas: '' },
    { id: 'precio-18', productoId: 'prod-9', proveedorId: 'prov-3', precioCosto: 55.00, fechaActualizacion: new Date().toISOString(), notas: 'Precio especial ferreterías' },
    // Resma Papel
    { id: 'precio-19', productoId: 'prod-10', proveedorId: 'prov-4', precioCosto: 4.50, fechaActualizacion: new Date().toISOString(), notas: '' },
    { id: 'precio-20', productoId: 'prod-10', proveedorId: 'prov-2', precioCosto: 4.75, fechaActualizacion: new Date().toISOString(), notas: '' },
  ],
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
// VENTAS (POS)
// ============================================

export type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia' | 'otro';

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

export interface CajaSesion {
  id: string;
  usuarioId: string;
  fechaApertura: string;
  fechaCierre?: string;
  montoApertura: number;
  montoCierre?: number;
  totalVentas: number;
  ventasIds: string[];
  estado: 'abierta' | 'cerrada';
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
