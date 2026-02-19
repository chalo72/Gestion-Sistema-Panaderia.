// Tipos para el sistema de control de precios

export interface Producto {
  id: string;
  nombre: string;
  categoria: string;
  descripcion?: string;
  precioVenta: number;
  margenUtilidad: number; // Porcentaje (ej: 30 = 30%)
  imagen?: string;
  createdAt: string;
  updatedAt: string;
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
}

export type ViewType = 'dashboard' | 'productos' | 'proveedores' | 'precios' | 'alertas' | 'prepedidos' | 'configuracion' | 'login' | 'usuarios' | 'inventario' | 'recepciones' | 'exportar' | 'roles';

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
  ],
};

// Descripción de roles
export const ROLE_DESCRIPTIONS: Record<UserRole, { nombre: string; descripcion: string; color: string }> = {
  ADMIN: { nombre: 'Administrador', descripcion: 'Acceso total al sistema', color: '#8b5cf6' },
  GERENTE: { nombre: 'Gerente', descripcion: 'Gestión completa excepto configuración crítica', color: '#3b82f6' },
  COMPRADOR: { nombre: 'Comprador', descripcion: 'Gestión de proveedores y costos', color: '#22c55e' },
  VENDEDOR: { nombre: 'Vendedor', descripcion: 'Solo visualización de productos y precios', color: '#f59e0b' },
};

// Usuarios de prueba
export const USUARIOS_PRUEBA: Usuario[] = [
  { id: '1', email: 'admin@example.com', nombre: 'Admin', apellido: 'Sistema', rol: 'ADMIN', activo: true, createdAt: new Date().toISOString() },
  { id: '2', email: 'gerente@example.com', nombre: 'Carlos', apellido: 'García', rol: 'GERENTE', activo: true, createdAt: new Date().toISOString() },
  { id: '3', email: 'comprador@example.com', nombre: 'María', apellido: 'López', rol: 'COMPRADOR', activo: true, createdAt: new Date().toISOString() },
  { id: '4', email: 'vendedor@example.com', nombre: 'Juan', apellido: 'Martínez', rol: 'VENDEDOR', activo: true, createdAt: new Date().toISOString() },
];

// Contraseñas de prueba (en producción estarían hasheadas)
export const CREDENCIALES_PRUEBA: Record<string, string> = {
  'admin@example.com': 'password123',
  'gerente@example.com': 'password123',
  'comprador@example.com': 'password123',
  'vendedor@example.com': 'password123',
};

// Categorías por defecto
export const CATEGORIAS_DEFAULT: Categoria[] = [
  { id: '1', nombre: 'Electrónica', color: '#3b82f6' },
  { id: '2', nombre: 'Ropa y Accesorios', color: '#ec4899' },
  { id: '3', nombre: 'Alimentos y Bebidas', color: '#22c55e' },
  { id: '4', nombre: 'Hogar y Decoración', color: '#f59e0b' },
  { id: '5', nombre: 'Ferretería', color: '#6b7280' },
  { id: '6', nombre: 'Papelería', color: '#8b5cf6' },
  { id: '7', nombre: 'Salud y Belleza', color: '#14b8a6' },
  { id: '8', nombre: 'Deportes', color: '#ef4444' },
  { id: '9', nombre: 'Juguetes', color: '#f97316' },
  { id: '10', nombre: 'Automotriz', color: '#1e293b' },
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
    { id: 'prod-1', nombre: 'Laptop HP 15.6" Pavilion', categoria: 'Electrónica', descripcion: 'Laptop Intel Core i5, 8GB RAM, 512GB SSD', precioVenta: 649.99, margenUtilidad: 30, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'prod-2', nombre: 'Monitor Samsung 27" Full HD', categoria: 'Electrónica', descripcion: 'Monitor LED 27 pulgadas, resolución 1920x1080', precioVenta: 229.99, margenUtilidad: 25, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'prod-3', nombre: 'Teclado Mecánico RGB', categoria: 'Electrónica', descripcion: 'Teclado gaming con switches rojos', precioVenta: 89.99, margenUtilidad: 40, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'prod-4', nombre: 'Camiseta Algodón Premium', categoria: 'Ropa y Accesorios', descripcion: 'Camiseta 100% algodón, varias tallas', precioVenta: 24.99, margenUtilidad: 50, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'prod-5', nombre: 'Zapatillas Deportivas Nike', categoria: 'Ropa y Accesorios', descripcion: 'Zapatillas running, modelo Air Max', precioVenta: 119.99, margenUtilidad: 35, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'prod-6', nombre: 'Café Molido Premium 1kg', categoria: 'Alimentos y Bebidas', descripcion: 'Café 100% arábica, tueste medio', precioVenta: 18.99, margenUtilidad: 45, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'prod-7', nombre: 'Aceite de Oliva Virgen Extra 5L', categoria: 'Alimentos y Bebidas', descripcion: 'Aceite de oliva español, primera presión', precioVenta: 45.99, margenUtilidad: 30, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'prod-8', nombre: 'Lámpara LED de Escritorio', categoria: 'Hogar y Decoración', descripcion: 'Lámpara regulable con puerto USB', precioVenta: 34.99, margenUtilidad: 50, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'prod-9', nombre: 'Set de Herramientas 150 piezas', categoria: 'Ferretería', descripcion: 'Caja de herramientas completa con maletín', precioVenta: 79.99, margenUtilidad: 35, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'prod-10', nombre: 'Resma Papel A4 500 hojas', categoria: 'Papelería', descripcion: 'Papel multifunción 80gr', precioVenta: 5.99, margenUtilidad: 25, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
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
