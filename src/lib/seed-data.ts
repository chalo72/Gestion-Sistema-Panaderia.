/**
 * Datos de ejemplo y constantes de inicialización — Dulce Placer
 * Separado de types/index.ts para reducir el bundle de tipos
 */
import type { Usuario, Categoria, ProductoTipo, MetodoPago } from '@/types';

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
      fecha: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
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
      fecha: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
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
      fecha: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
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
      fecha: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
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
      fecha: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
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
      fecha: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
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
      fecha: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
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
      fecha: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
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
      fecha: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
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
      fecha: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
    },
  ],
  // === RECEPCIONES DE EJEMPLO (FACTURAS DE PROVEEDORES) ===
  recepciones: [
    {
      id: 'recep-demo-1',
      proveedorId: 'prov-1',
      numeroFactura: 'F-2026-0847',
      fechaFactura: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      fechaRecepcion: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      totalFactura: 185000,
      estado: 'completada' as const,
      recibidoPor: 'Admin',
      items: [
        { id: 'ri-1', productoId: 'prod-ing-1', cantidadEsperada: 10, cantidadRecibida: 10, precioEsperado: 12000, precioFacturado: 12000, embalajeOk: true, productoOk: true, cantidadOk: true, modeloOk: true, defectuosos: 0, observaciones: '' },
        { id: 'ri-2', productoId: 'prod-ing-2', cantidadEsperada: 5, cantidadRecibida: 5, precioEsperado: 8500, precioFacturado: 8500, embalajeOk: true, productoOk: true, cantidadOk: true, modeloOk: true, defectuosos: 0, observaciones: '' },
        { id: 'ri-3', productoId: 'prod-ing-5', cantidadEsperada: 8, cantidadRecibida: 8, precioEsperado: 4500, precioFacturado: 4500, embalajeOk: true, productoOk: true, cantidadOk: true, modeloOk: true, defectuosos: 0, observaciones: '' },
      ],
      observaciones: 'Pedido semanal de insumos básicos'
    },
    {
      id: 'recep-demo-2',
      proveedorId: 'prov-2',
      numeroFactura: 'LP-4521',
      fechaFactura: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
      fechaRecepcion: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
      totalFactura: 95000,
      estado: 'completada' as const,
      recibidoPor: 'Admin',
      items: [
        { id: 'ri-4', productoId: 'prod-ing-3', cantidadEsperada: 10, cantidadRecibida: 10, precioEsperado: 4500, precioFacturado: 4500, embalajeOk: true, productoOk: true, cantidadOk: true, modeloOk: true, defectuosos: 0, observaciones: '' },
        { id: 'ri-5', productoId: 'prod-ing-4', cantidadEsperada: 5, cantidadRecibida: 5, precioEsperado: 10000, precioFacturado: 10000, embalajeOk: true, productoOk: true, cantidadOk: true, modeloOk: true, defectuosos: 0, observaciones: 'Huevos AAA frescos' },
      ],
      observaciones: 'Lácteos y huevos - entrega refrigerada'
    },
    {
      id: 'recep-demo-3',
      proveedorId: 'prov-4',
      numeroFactura: 'DV-2026-128',
      fechaFactura: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
      fechaRecepcion: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
      totalFactura: 320000,
      estado: 'con_incidencias' as const,
      recibidoPor: 'Admin',
      items: [
        { id: 'ri-6', productoId: 'prod-ing-1', cantidadEsperada: 15, cantidadRecibida: 12, precioEsperado: 12000, precioFacturado: 11500, embalajeOk: true, productoOk: true, cantidadOk: false, modeloOk: true, defectuosos: 0, observaciones: 'Faltaron 3 bultos - pendiente siguiente entrega' },
        { id: 'ri-7', productoId: 'prod-ing-2', cantidadEsperada: 10, cantidadRecibida: 10, precioEsperado: 8500, precioFacturado: 8200, embalajeOk: false, productoOk: true, cantidadOk: true, modeloOk: true, defectuosos: 1, observaciones: '1 bolsa rota - se descontó del total' },
      ],
      observaciones: 'Entrega parcial - pendiente completar'
    }
  ],
};
