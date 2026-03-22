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

export type ViewType = 'dashboard' | 'productos' | 'proveedores' | 'precios' | 'alertas' | 'prepedidos' | 'configuracion' | 'login' | 'usuarios' | 'inventario' | 'recepciones' | 'exportar' | 'roles' | 'recetas' | 'ventas' | 'caja' | 'ahorro' | 'gastos' | 'reportes' | 'produccion' | 'historial-ventas' | 'cargamasiva' | 'listapreciosproincial' | 'creditos' | 'trabajadores';

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

// Credenciales de Acceso — Se cargan desde variables de entorno
// Las contraseñas NO se almacenan en código fuente
export const CREDENCIALES_PRUEBA: Record<string, string> = {};

// Categorías de Panadería y Negocio Dulce Placer — Completas
export const CATEGORIAS_DEFAULT: Categoria[] = [
  // === PRODUCTOS ELABORADOS (para venta POS) ===
  { id: 'cat-pan', nombre: 'Panes', color: '#d97706', icono: '🍞' },
  { id: 'cat-past', nombre: 'Pastelería', color: '#ec4899', icono: '🎂' },
  { id: 'cat-repo', nombre: 'Repostería', color: '#f43f5e', icono: '🧁' },
  { id: 'cat-beb', nombre: 'Bebidas', color: '#0ea5e9', icono: '☕' },
  { id: 'cat-mich', nombre: 'Micheladas', color: '#ef4444', icono: '🍺' },
  { id: 'cat-aven', nombre: 'Avena y Granola', color: '#84cc16', icono: '🥣' },
  { id: 'cat-piat', nombre: 'Piñatería', color: '#a855f7', icono: '🎉' },
  // === MATERIA PRIMA (para inventario/compras) ===
  { id: 'cat-1', nombre: 'Harinas y Materia Prima', color: '#8b5e3c', icono: '🌾' },
  { id: 'cat-2', nombre: 'Lácteos y Huevos', color: '#facc15', icono: '🥛' },
  { id: 'cat-3', nombre: 'Azúcares y Endulzantes', color: '#3b82f6', icono: '🍬' },
  { id: 'cat-4', nombre: 'Levaduras y Aditivos', color: '#10b981', icono: '🧪' },
  { id: 'cat-5', nombre: 'Empaques y Desechables', color: '#6366f1', icono: '📦' },
];

// Datos de ejemplo — Dulce Placer
export const DATOS_EJEMPLO = {
  proveedores: [
    { id: 'prov-1', nombre: 'Harinas El Sol', contacto: 'Juan Pérez', telefono: '+52 555 123 4567', email: 'ventas@harinaselsol.com', direccion: 'Av. Industrial 450, CDMX', createdAt: new Date().toISOString() },
    { id: 'prov-2', nombre: 'Lácteos Pro', contacto: 'María López', telefono: '+52 555 234 5678', email: 'pedidos@lacteospro.com', direccion: 'Col. Centro 89, Guadalajara', createdAt: new Date().toISOString() },
    { id: 'prov-3', nombre: 'Empaques Eco', contacto: 'Carlos Martínez', telefono: '+52 555 345 6789', email: 'ventas@empaqueseco.com', direccion: 'Zona Industrial Norte, Monterrey', createdAt: new Date().toISOString() },
    { id: 'prov-4', nombre: 'Distribuidora Dulce Vida', contacto: 'Ana Rodríguez', telefono: '+52 555 456 7890', email: 'contacto@dulcevida.com', direccion: 'Calle Comercio 78, Puebla', createdAt: new Date().toISOString() },
  ],
  productos: [
    // === MATERIA PRIMA (sin precio de venta, solo costo) ===
    { id: 'prod-1', nombre: 'Harina de Trigo Extra', categoria: 'Harinas y Materia Prima', descripcion: 'Saco de 25kg para pan artesanal', precioVenta: 0, margenUtilidad: 0, tipo: 'ingrediente' as ProductoTipo, costoBase: 1.20, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'prod-2', nombre: 'Azúcar Blanca Refinada', categoria: 'Azúcares y Endulzantes', descripcion: 'Bulto de 50kg', precioVenta: 0, margenUtilidad: 0, tipo: 'ingrediente' as ProductoTipo, costoBase: 0.85, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'prod-3', nombre: 'Mantequilla Sin Sal', categoria: 'Lácteos y Huevos', descripcion: 'Bloque de 5kg', precioVenta: 0, margenUtilidad: 0, tipo: 'ingrediente' as ProductoTipo, costoBase: 6.50, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'prod-4', nombre: 'Huevos de Granja', categoria: 'Lácteos y Huevos', descripcion: 'Caja x 30 unidades', precioVenta: 0, margenUtilidad: 0, tipo: 'ingrediente' as ProductoTipo, costoBase: 4.50, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'prod-5', nombre: 'Levadura Fresca', categoria: 'Levaduras y Aditivos', descripcion: 'Paquete de 500g', precioVenta: 0, margenUtilidad: 0, tipo: 'ingrediente' as ProductoTipo, costoBase: 3.20, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },

    // === 🍞 PANES ===
    { id: 'prod-pan-1', nombre: 'Pan Francés Tradicional', categoria: 'Panes', descripcion: 'Baguette crujiente del día', precioVenta: 800, margenUtilidad: 65, tipo: 'elaborado' as ProductoTipo, costoBase: 280, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'prod-pan-2', nombre: 'Pan de Bono', categoria: 'Panes', descripcion: 'Producto estrella con queso', precioVenta: 1500, margenUtilidad: 55, tipo: 'elaborado' as ProductoTipo, costoBase: 675, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'prod-pan-3', nombre: 'Croissant de Mantequilla', categoria: 'Panes', descripcion: 'Hojaldre francés dorado', precioVenta: 2500, margenUtilidad: 60, tipo: 'elaborado' as ProductoTipo, costoBase: 1000, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'prod-pan-4', nombre: 'Pan Integral con Semillas', categoria: 'Panes', descripcion: 'Pan artesanal saludable', precioVenta: 3500, margenUtilidad: 50, tipo: 'elaborado' as ProductoTipo, costoBase: 1750, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'prod-pan-5', nombre: 'Mogolla con Queso', categoria: 'Panes', descripcion: 'Suave y rellena de queso', precioVenta: 1200, margenUtilidad: 55, tipo: 'elaborado' as ProductoTipo, costoBase: 540, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },

    // === 🎂 PASTELERÍA ===
    { id: 'prod-past-1', nombre: 'Torta de Chocolate Premium', categoria: 'Pastelería', descripcion: 'Bizcocho húmedo de cacao 12 porciones', precioVenta: 45000, margenUtilidad: 60, tipo: 'elaborado' as ProductoTipo, costoBase: 18000, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'prod-past-2', nombre: 'Pastel Tres Leches', categoria: 'Pastelería', descripcion: 'Clásico con crema batida', precioVenta: 38000, margenUtilidad: 55, tipo: 'elaborado' as ProductoTipo, costoBase: 17100, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'prod-past-3', nombre: 'Torta Red Velvet', categoria: 'Pastelería', descripcion: 'Con frosting de queso crema', precioVenta: 55000, margenUtilidad: 65, tipo: 'elaborado' as ProductoTipo, costoBase: 19250, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },

    // === 🧁 REPOSTERÍA ===
    { id: 'prod-repo-1', nombre: 'Donas Glaseadas x6', categoria: 'Repostería', descripcion: 'Media docena de donas frescas', precioVenta: 12000, margenUtilidad: 65, tipo: 'elaborado' as ProductoTipo, costoBase: 4200, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'prod-repo-2', nombre: 'Galletas de Avena & Miel', categoria: 'Repostería', descripcion: 'Paquete x12 unidades', precioVenta: 8000, margenUtilidad: 60, tipo: 'elaborado' as ProductoTipo, costoBase: 3200, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'prod-repo-3', nombre: 'Brownies Pack x4', categoria: 'Repostería', descripcion: 'Chocolate intenso con nueces', precioVenta: 10000, margenUtilidad: 58, tipo: 'elaborado' as ProductoTipo, costoBase: 4200, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },

    // === ☕ BEBIDAS ===
    { id: 'prod-beb-1', nombre: 'Café Americano', categoria: 'Bebidas', descripcion: 'Café recién molido 12oz', precioVenta: 3500, margenUtilidad: 75, tipo: 'elaborado' as ProductoTipo, costoBase: 875, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'prod-beb-2', nombre: 'Cappuccino', categoria: 'Bebidas', descripcion: 'Espresso con leche espumada', precioVenta: 5000, margenUtilidad: 70, tipo: 'elaborado' as ProductoTipo, costoBase: 1500, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'prod-beb-3', nombre: 'Jugo de Naranja Natural', categoria: 'Bebidas', descripcion: 'Recién exprimido 16oz', precioVenta: 4500, margenUtilidad: 65, tipo: 'elaborado' as ProductoTipo, costoBase: 1575, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'prod-beb-4', nombre: 'Chocolate Caliente', categoria: 'Bebidas', descripcion: 'Cacao premium con leche', precioVenta: 4000, margenUtilidad: 68, tipo: 'elaborado' as ProductoTipo, costoBase: 1280, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'prod-beb-5', nombre: 'Limonada de Coco', categoria: 'Bebidas', descripcion: 'Limonada refrescante 16oz', precioVenta: 5500, margenUtilidad: 72, tipo: 'elaborado' as ProductoTipo, costoBase: 1540, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },

    // === 🍺 MICHELADAS ===
    { id: 'prod-mich-1', nombre: 'Michelada Clásica', categoria: 'Micheladas', descripcion: 'Limón, sal, salsa, cerveza', precioVenta: 8000, margenUtilidad: 70, tipo: 'elaborado' as ProductoTipo, costoBase: 2400, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'prod-mich-2', nombre: 'Michelada de Mango', categoria: 'Micheladas', descripcion: 'Con chamoy y mango fresco', precioVenta: 10000, margenUtilidad: 68, tipo: 'elaborado' as ProductoTipo, costoBase: 3200, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'prod-mich-3', nombre: 'Michelada Gourmet Tamarindo', categoria: 'Micheladas', descripcion: 'Tamarindo, chile y cerveza premium', precioVenta: 12000, margenUtilidad: 65, tipo: 'elaborado' as ProductoTipo, costoBase: 4200, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'prod-mich-4', nombre: 'Clamato Preparado', categoria: 'Micheladas', descripcion: 'Clamato, limón, salsa inglesa', precioVenta: 7000, margenUtilidad: 72, tipo: 'elaborado' as ProductoTipo, costoBase: 1960, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },

    // === 🥣 AVENA Y GRANOLA ===
    { id: 'prod-aven-1', nombre: 'Avena con Frutas', categoria: 'Avena y Granola', descripcion: 'Avena caliente con fresa y banano', precioVenta: 6000, margenUtilidad: 70, tipo: 'elaborado' as ProductoTipo, costoBase: 1800, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'prod-aven-2', nombre: 'Granola Bowl Premium', categoria: 'Avena y Granola', descripcion: 'Con yogurt, miel y frutos secos', precioVenta: 8500, margenUtilidad: 65, tipo: 'elaborado' as ProductoTipo, costoBase: 2975, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'prod-aven-3', nombre: 'Avena Fría de Chocolate', categoria: 'Avena y Granola', descripcion: 'Overnight oats con cacao', precioVenta: 7000, margenUtilidad: 68, tipo: 'elaborado' as ProductoTipo, costoBase: 2240, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },

    // === 🎉 PIÑATERÍA ===
    { id: 'prod-piat-1', nombre: 'Piñata Temática Infantil', categoria: 'Piñatería', descripcion: 'Piñata personalizada personajes', precioVenta: 35000, margenUtilidad: 50, tipo: 'elaborado' as ProductoTipo, costoBase: 17500, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'prod-piat-2', nombre: 'Bolsa de Dulces Surtida', categoria: 'Piñatería', descripcion: 'Mix de dulces 500g para piñata', precioVenta: 15000, margenUtilidad: 45, tipo: 'elaborado' as ProductoTipo, costoBase: 8250, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'prod-piat-3', nombre: 'Decoración Fiesta Completa', categoria: 'Piñatería', descripcion: 'Globos, serpentinas, guirnaldas', precioVenta: 25000, margenUtilidad: 55, tipo: 'elaborado' as ProductoTipo, costoBase: 11250, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'prod-piat-4', nombre: 'Cotillón Básico x10', categoria: 'Piñatería', descripcion: 'Gorros, cornetas, confeti', precioVenta: 18000, margenUtilidad: 48, tipo: 'elaborado' as ProductoTipo, costoBase: 9360, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ],
  precios: [
    // Harina de Trigo
    { id: 'precio-1', productoId: 'prod-1', proveedorId: 'prov-1', precioCosto: 1.20, fechaActualizacion: new Date().toISOString(), notas: 'Precio por kg con descuento por volumen' },
    { id: 'precio-2', productoId: 'prod-1', proveedorId: 'prov-2', precioCosto: 1.35, fechaActualizacion: new Date().toISOString(), notas: 'Incluye envío gratis' },
    // Azúcar
    { id: 'precio-3', productoId: 'prod-2', proveedorId: 'prov-1', precioCosto: 0.85, fechaActualizacion: new Date().toISOString(), notas: '' },
    { id: 'precio-4', productoId: 'prod-2', proveedorId: 'prov-4', precioCosto: 0.78, fechaActualizacion: new Date().toISOString(), notas: 'Promoción mayorista' },
    // Mantequilla
    { id: 'precio-5', productoId: 'prod-3', proveedorId: 'prov-2', precioCosto: 6.50, fechaActualizacion: new Date().toISOString(), notas: '' },
    { id: 'precio-6', productoId: 'prod-3', proveedorId: 'prov-4', precioCosto: 6.20, fechaActualizacion: new Date().toISOString(), notas: 'Mejor precio garantizado' },
    // Huevos
    { id: 'precio-7', productoId: 'prod-4', proveedorId: 'prov-2', precioCosto: 4.50, fechaActualizacion: new Date().toISOString(), notas: '' },
    { id: 'precio-8', productoId: 'prod-4', proveedorId: 'prov-4', precioCosto: 4.20, fechaActualizacion: new Date().toISOString(), notas: 'Precio mayorista' },
    // Levadura
    { id: 'precio-9', productoId: 'prod-5', proveedorId: 'prov-1', precioCosto: 3.20, fechaActualizacion: new Date().toISOString(), notas: '' },
    { id: 'precio-10', productoId: 'prod-5', proveedorId: 'prov-3', precioCosto: 3.00, fechaActualizacion: new Date().toISOString(), notas: 'Proveedor local' },
  ],
  // === VENTAS DE EJEMPLO ===
  ventas: [
    {
      id: 'venta-demo-1',
      items: [
        { id: 'vi-1', productoId: 'prod-pan-1', cantidad: 3, precioUnitario: 800, subtotal: 2400 },
        { id: 'vi-2', productoId: 'prod-beb-1', cantidad: 2, precioUnitario: 3500, subtotal: 7000 },
      ],
      total: 9400,
      metodoPago: 'efectivo' as MetodoPago,
      usuarioId: 'admin',
      cliente: 'María González',
      fecha: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // Hace 30 min
    },
    {
      id: 'venta-demo-2',
      items: [
        { id: 'vi-3', productoId: 'prod-pan-2', cantidad: 5, precioUnitario: 1500, subtotal: 7500 },
        { id: 'vi-4', productoId: 'prod-repo-1', cantidad: 1, precioUnitario: 12000, subtotal: 12000 },
        { id: 'vi-5', productoId: 'prod-beb-2', cantidad: 2, precioUnitario: 5000, subtotal: 10000 },
      ],
      total: 29500,
      metodoPago: 'tarjeta' as MetodoPago,
      usuarioId: 'admin',
      fecha: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // Hace 2 horas
    },
    {
      id: 'venta-demo-3',
      items: [
        { id: 'vi-6', productoId: 'prod-past-1', cantidad: 1, precioUnitario: 45000, subtotal: 45000 },
      ],
      total: 45000,
      metodoPago: 'nequi' as MetodoPago,
      usuarioId: 'admin',
      cliente: 'Carlos Pérez',
      notas: 'Cumpleaños de Ana',
      fecha: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), // Hace 4 horas
    },
    {
      id: 'venta-demo-4',
      items: [
        { id: 'vi-7', productoId: 'prod-mich-1', cantidad: 4, precioUnitario: 8000, subtotal: 32000 },
        { id: 'vi-8', productoId: 'prod-mich-2', cantidad: 2, precioUnitario: 10000, subtotal: 20000 },
      ],
      total: 52000,
      metodoPago: 'efectivo' as MetodoPago,
      usuarioId: 'admin',
      cliente: 'Mesa 3',
      fecha: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // Hace 5 horas
    },
    {
      id: 'venta-demo-5',
      items: [
        { id: 'vi-9', productoId: 'prod-aven-1', cantidad: 2, precioUnitario: 6000, subtotal: 12000 },
        { id: 'vi-10', productoId: 'prod-aven-2', cantidad: 1, precioUnitario: 8500, subtotal: 8500 },
        { id: 'vi-11', productoId: 'prod-beb-3', cantidad: 3, precioUnitario: 4500, subtotal: 13500 },
      ],
      total: 34000,
      metodoPago: 'tarjeta' as MetodoPago,
      usuarioId: 'admin',
      fecha: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // Ayer
    },
    {
      id: 'venta-demo-6',
      items: [
        { id: 'vi-12', productoId: 'prod-pan-3', cantidad: 6, precioUnitario: 2500, subtotal: 15000 },
        { id: 'vi-13', productoId: 'prod-pan-5', cantidad: 4, precioUnitario: 1200, subtotal: 4800 },
        { id: 'vi-14', productoId: 'prod-beb-4', cantidad: 2, precioUnitario: 4000, subtotal: 8000 },
      ],
      total: 27800,
      metodoPago: 'efectivo' as MetodoPago,
      usuarioId: 'admin',
      fecha: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // Ayer
    },
    {
      id: 'venta-demo-7',
      items: [
        { id: 'vi-15', productoId: 'prod-piat-1', cantidad: 1, precioUnitario: 35000, subtotal: 35000 },
        { id: 'vi-16', productoId: 'prod-piat-2', cantidad: 2, precioUnitario: 15000, subtotal: 30000 },
        { id: 'vi-17', productoId: 'prod-piat-3', cantidad: 1, precioUnitario: 25000, subtotal: 25000 },
      ],
      total: 90000,
      metodoPago: 'tarjeta' as MetodoPago,
      usuarioId: 'admin',
      cliente: 'Fiesta Infantil Rodríguez',
      fecha: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // Hace 2 días
    },
    {
      id: 'venta-demo-8',
      items: [
        { id: 'vi-18', productoId: 'prod-past-2', cantidad: 1, precioUnitario: 38000, subtotal: 38000 },
        { id: 'vi-19', productoId: 'prod-repo-3', cantidad: 2, precioUnitario: 10000, subtotal: 20000 },
      ],
      total: 58000,
      metodoPago: 'nequi' as MetodoPago,
      usuarioId: 'admin',
      cliente: 'Pedido WhatsApp',
      fecha: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(), // Hace 3 días
    },
    {
      id: 'venta-demo-9',
      items: [
        { id: 'vi-20', productoId: 'prod-pan-4', cantidad: 2, precioUnitario: 3500, subtotal: 7000 },
        { id: 'vi-21', productoId: 'prod-beb-5', cantidad: 2, precioUnitario: 5500, subtotal: 11000 },
      ],
      total: 18000,
      metodoPago: 'efectivo' as MetodoPago,
      usuarioId: 'admin',
      fecha: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(), // Hace 4 días
    },
    {
      id: 'venta-demo-10',
      items: [
        { id: 'vi-22', productoId: 'prod-past-3', cantidad: 1, precioUnitario: 55000, subtotal: 55000 },
        { id: 'vi-23', productoId: 'prod-repo-2', cantidad: 3, precioUnitario: 8000, subtotal: 24000 },
        { id: 'vi-24', productoId: 'prod-beb-2', cantidad: 4, precioUnitario: 5000, subtotal: 20000 },
      ],
      total: 99000,
      metodoPago: 'tarjeta' as MetodoPago,
      usuarioId: 'admin',
      cliente: 'Empresa XYZ - Evento',
      fecha: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(), // Hace 5 días
    },
  ],
  // === RECEPCIONES DE EJEMPLO (FACTURAS DE PROVEEDORES) ===
  recepciones: [
    {
      id: 'recep-demo-1',
      proveedorId: 'prov-1', // Harinas El Sol
      numeroFactura: 'F-2026-0847',
      fechaFactura: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // Ayer
      fechaRecepcion: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      totalFactura: 185000,
      estado: 'completada' as const,
      recibidoPor: 'Admin',
      items: [
        {
          id: 'ri-1',
          productoId: 'prod-ing-1', // Harina
          cantidadEsperada: 10,
          cantidadRecibida: 10,
          precioEsperado: 12000,
          precioFacturado: 12000,
          embalajeOk: true,
          productoOk: true,
          cantidadOk: true,
          modeloOk: true,
          defectuosos: 0,
          observaciones: ''
        },
        {
          id: 'ri-2',
          productoId: 'prod-ing-2', // Azúcar
          cantidadEsperada: 5,
          cantidadRecibida: 5,
          precioEsperado: 8500,
          precioFacturado: 8500,
          embalajeOk: true,
          productoOk: true,
          cantidadOk: true,
          modeloOk: true,
          defectuosos: 0,
          observaciones: ''
        },
        {
          id: 'ri-3',
          productoId: 'prod-ing-5', // Levadura
          cantidadEsperada: 8,
          cantidadRecibida: 8,
          precioEsperado: 4500,
          precioFacturado: 4500,
          embalajeOk: true,
          productoOk: true,
          cantidadOk: true,
          modeloOk: true,
          defectuosos: 0,
          observaciones: ''
        }
      ],
      observaciones: 'Pedido semanal de insumos básicos'
    },
    {
      id: 'recep-demo-2',
      proveedorId: 'prov-2', // Lácteos Pro
      numeroFactura: 'LP-4521',
      fechaFactura: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // Hace 2 días
      fechaRecepcion: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
      totalFactura: 95000,
      estado: 'completada' as const,
      recibidoPor: 'Admin',
      items: [
        {
          id: 'ri-4',
          productoId: 'prod-ing-3', // Mantequilla
          cantidadEsperada: 10,
          cantidadRecibida: 10,
          precioEsperado: 4500,
          precioFacturado: 4500,
          embalajeOk: true,
          productoOk: true,
          cantidadOk: true,
          modeloOk: true,
          defectuosos: 0,
          observaciones: ''
        },
        {
          id: 'ri-5',
          productoId: 'prod-ing-4', // Huevos
          cantidadEsperada: 5,
          cantidadRecibida: 5,
          precioEsperado: 10000,
          precioFacturado: 10000,
          embalajeOk: true,
          productoOk: true,
          cantidadOk: true,
          modeloOk: true,
          defectuosos: 0,
          observaciones: 'Huevos AAA frescos'
        }
      ],
      observaciones: 'Lácteos y huevos - entrega refrigerada'
    },
    {
      id: 'recep-demo-3',
      proveedorId: 'prov-4', // Distribuidora Dulce Vida
      numeroFactura: 'DV-2026-128',
      fechaFactura: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(), // Hace 3 días
      fechaRecepcion: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
      totalFactura: 320000,
      estado: 'con_incidencias' as const,
      recibidoPor: 'Admin',
      items: [
        {
          id: 'ri-6',
          productoId: 'prod-ing-1',
          cantidadEsperada: 15,
          cantidadRecibida: 12,
          precioEsperado: 12000,
          precioFacturado: 11500,
          embalajeOk: true,
          productoOk: true,
          cantidadOk: false, // Faltaron 3 unidades
          modeloOk: true,
          defectuosos: 0,
          observaciones: 'Faltaron 3 bultos - pendiente siguiente entrega'
        },
        {
          id: 'ri-7',
          productoId: 'prod-ing-2',
          cantidadEsperada: 10,
          cantidadRecibida: 10,
          precioEsperado: 8500,
          precioFacturado: 8200,
          embalajeOk: false, // Problemas de embalaje
          productoOk: true,
          cantidadOk: true,
          modeloOk: true,
          defectuosos: 1,
          observaciones: '1 bolsa rota - se descontó del total'
        }
      ],
      observaciones: 'Entrega parcial - pendiente completar'
    }
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

export type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia' | 'nequi' | 'credito' | 'otro';

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
  ventasIds: string[];
  movimientos: MovimientoCaja[];
  estado: 'abierta' | 'cerrada';
  // Sistema multi-caja Dulce Placer
  cajaNombre?: string;
  turno?: 'Mañana' | 'Tarde' | 'Noche';
  vendedoraNombre?: string;
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
  pagos: PagoCredito[];
  usuarioId: string;
  createdAt: string;
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
  createdAt: string;
}
