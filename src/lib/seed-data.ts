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
  { id: '3606f157-8df1-419b-a010-0968997e0001', nombre: 'Harinas y Materia Prima', color: '#8b5e3c', icono: '🌾' },
  { id: '3606f157-8df1-419b-a010-0968997e0002', nombre: 'Lácteos y Huevos', color: '#facc15', icono: '🥛' },
  { id: '3606f157-8df1-419b-a010-0968997e0003', nombre: 'Azúcares y Endulzantes', color: '#3b82f6', icono: '🍬' },
  { id: '3606f157-8df1-419b-a010-0968997e0004', nombre: 'Levaduras y Aditivos', color: '#10b981', icono: '🧪' },
  { id: '3606f157-8df1-419b-a010-0968997e0005', nombre: 'Empaques y Desechables', color: '#6366f1', icono: '📦' },
];

/**
 * UTILS PARA GENERAR IDs COMPATIBLES CON UUID (Si el sistema lo requiere estrictamente)
 * Aquí usamos IDs fijos para consistencia en el desarrollo local.
 */

// Datos de ejemplo — Dulce Placer
export const DATOS_EJEMPLO = {
  proveedores: [
    { id: '550e8400-e29b-41d4-a716-446655440101', nombre: 'Harinas El Sol', contacto: 'Juan Pérez', telefono: '+52 555 123 4567', email: 'ventas@harinaselsol.com', direccion: 'Av. Industrial 450, CDMX', createdAt: new Date().toISOString() },
    { id: '550e8400-e29b-41d4-a716-446655440102', nombre: 'Lácteos Pro', contacto: 'María López', telefono: '+52 555 234 5678', email: 'pedidos@lacteospro.com', direccion: 'Col. Centro 89, Guadalajara', createdAt: new Date().toISOString() },
    { id: '550e8400-e29b-41d4-a716-446655440103', nombre: 'Empaques Eco', contacto: 'Carlos Martínez', telefono: '+52 555 345 6789', email: 'ventas@empaqueseco.com', direccion: 'Zona Industrial Norte, Monterrey', createdAt: new Date().toISOString() },
    { id: '550e8400-e29b-41d4-a716-446655440104', nombre: 'Distribuidora Dulce Vida', contacto: 'Ana Rodríguez', telefono: '+52 555 456 7890', email: 'contacto@dulcevida.com', direccion: 'Calle Comercio 78, Puebla', createdAt: new Date().toISOString() },
  ],
  productos: [
    // === MATERIA PRIMA (ingredientes) ===
    { id: 'f5a6b7c8-d9e0-4123-a456-b7c8d9e00001', nombre: 'Harina de Trigo Extra', categoria: 'Harinas y Materia Prima', descripcion: 'Saco de 25kg para pan artesanal', precioVenta: 0, margenUtilidad: 0, tipo: 'ingrediente' as ProductoTipo, costoBase: 1.20, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f5a6b7c8-d9e0-4123-a456-b7c8d9e00002', nombre: 'Azúcar Blanca Refinada', categoria: 'Azúcares y Endulzantes', descripcion: 'Bulto de 50kg', precioVenta: 0, margenUtilidad: 0, tipo: 'ingrediente' as ProductoTipo, costoBase: 0.85, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f5a6b7c8-d9e0-4123-a456-b7c8d9e00003', nombre: 'Mantequilla Sin Sal', categoria: 'Lácteos y Huevos', descripcion: 'Bloque de 5kg', precioVenta: 0, margenUtilidad: 0, tipo: 'ingrediente' as ProductoTipo, costoBase: 6.50, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f5a6b7c8-d9e0-4123-a456-b7c8d9e00004', nombre: 'Huevos de Granja', categoria: 'Lácteos y Huevos', descripcion: 'Caja x 30 unidades', precioVenta: 0, margenUtilidad: 0, tipo: 'ingrediente' as ProductoTipo, costoBase: 4.50, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f5a6b7c8-d9e0-4123-a456-b7c8d9e00005', nombre: 'Levadura Fresca', categoria: 'Levaduras y Aditivos', descripcion: 'Paquete de 500g', precioVenta: 0, margenUtilidad: 0, tipo: 'ingrediente' as ProductoTipo, costoBase: 3.20, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },

    // === 🍞 PANES (elaborados) ===
    { id: 'e1000000-0000-4000-b000-000000000001', nombre: 'Pan Francés Tradicional', categoria: 'Panes', descripcion: 'Baguette crujiente del día', precioVenta: 800, margenUtilidad: 65, tipo: 'elaborado' as ProductoTipo, costoBase: 280, modeloPanId: '9a8b7c6d-5e4f-4d3c-b2a1-0f9e8d7c6b51', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'e1000000-0000-4000-b000-000000000002', nombre: 'Pan de Bono', categoria: 'Panes', descripcion: 'Producto estrella con queso', precioVenta: 1500, margenUtilidad: 55, tipo: 'elaborado' as ProductoTipo, costoBase: 675, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'e1000000-0000-4000-b000-000000000003', nombre: 'Croissant de Mantequilla', categoria: 'Panes', descripcion: 'Hojaldre francés dorado', precioVenta: 2500, margenUtilidad: 60, tipo: 'elaborado' as ProductoTipo, costoBase: 1000, modeloPanId: '9a8b7c6d-5e4f-4d3c-b2a1-0f9e8d7c6b53', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'e1000000-0000-4000-b000-000000000004', nombre: 'Pan Integral con Semillas', categoria: 'Panes', descripcion: 'Pan artesanal saludable', precioVenta: 3500, margenUtilidad: 50, tipo: 'elaborado' as ProductoTipo, costoBase: 1750, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'e1000000-0000-4000-b000-000000000005', nombre: 'Mogolla con Queso', categoria: 'Panes', descripcion: 'Suave y rellena de queso', precioVenta: 1200, margenUtilidad: 55, tipo: 'elaborado' as ProductoTipo, costoBase: 540, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },

    // === 🎂 PASTELERÍA ===
    { id: 'e2000000-0000-4000-c000-000000000001', nombre: 'Torta de Chocolate Premium', categoria: 'Pastelería', descripcion: 'Bizcocho húmedo de cacao 12 porciones', precioVenta: 45000, margenUtilidad: 60, tipo: 'elaborado' as ProductoTipo, costoBase: 18000, modeloPanId: '9a8b7c6d-5e4f-4d3c-b2a1-0f9e8d7c6b54', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'e2000000-0000-4000-c000-000000000002', nombre: 'Galletas de Avena & Miel', categoria: 'Repostería', descripcion: 'Paquete x12 unidades', precioVenta: 8000, margenUtilidad: 60, tipo: 'elaborado' as ProductoTipo, costoBase: 3200, modeloPanId: '9a8b7c6d-5e4f-4d3c-b2a1-0f9e8d7c6b55', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ],
  precios: [
    { id: 'p1000000-0001', productoId: 'f5a6b7c8-d9e0-4123-a456-b7c8d9e00001', proveedorId: '550e8400-e29b-41d4-a716-446655440101', precioCosto: 1.20, fechaActualizacion: new Date().toISOString(), notas: 'Precio kg', tipoEmbalaje: 'PACA', cantidadEmbalaje: 12 },
    { id: 'p1000000-0002', productoId: 'f5a6b7c8-d9e0-4123-a456-b7c8d9e00002', proveedorId: '550e8400-e29b-41d4-a716-446655440101', precioCosto: 0.85, fechaActualizacion: new Date().toISOString(), notas: '', tipoEmbalaje: 'BOLSA', cantidadEmbalaje: 5 },
    { id: 'p1000000-0003', productoId: 'f5a6b7c8-d9e0-4123-a456-b7c8d9e00003', proveedorId: '550e8400-e29b-41d4-a716-446655440102', precioCosto: 6.50, fechaActualizacion: new Date().toISOString(), notas: '', tipoEmbalaje: 'UNIDAD', cantidadEmbalaje: 1 },
  ],

  // === SISTEMA MAESTRO PANADERO: FORMULACIONES POR ARROBA ===
  formulaciones: [
    {
      id: '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f51',
      nombre: 'Masa de Sal Mixta',
      descripcion: 'Fórmula básica equilibrada para panes de sal tradicionales.',
      categoria: 'panes',
      rendimientoBaseKg: 18.5,
      costoTotalArroba: 68500,
      tiempoHorneado: 25,
      activo: true,
      fechaActualizacion: new Date().toISOString(),
      ingredientes: [
        { id: 'a1111111-1111-4111-a111-111111111111', formulacionId: '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f51', productoId: 'f5a6b7c8-d9e0-4123-a456-b7c8d9e00001', cantidadPorArroba: 11.5, unidad: 'kg', costoUnitario: 1.20, costoTotalArroba: 13.8, porcentajePanadero: 100 },
        { id: 'a1111111-1111-4111-a111-111111111112', formulacionId: '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f51', productoId: 'f5a6b7c8-d9e0-4123-a456-b7c8d9e00004', cantidadPorArroba: 5, unidad: 'und', costoUnitario: 4.5, costoTotalArroba: 22.5 },
      ]
    },
    {
      id: '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f52',
      nombre: 'Masa de Dulce Especial',
      descripcion: 'Alta hidratación y azúcar para panes dulces y trenzas.',
      categoria: 'panes',
      rendimientoBaseKg: 22.0,
      costoTotalArroba: 92400,
      tiempoHorneado: 20,
      activo: true,
      fechaActualizacion: new Date().toISOString(),
      ingredientes: [
        { id: 'a1111111-1111-4111-a111-111111111113', formulacionId: '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f52', productoId: 'f5a6b7c8-d9e0-4123-a456-b7c8d9e00001', cantidadPorArroba: 11.5, unidad: 'kg', costoUnitario: 1.2, costoTotalArroba: 13.8 },
      ]
    },
    {
      id: '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f53',
      nombre: 'Masa de Hojaldre Mixta',
      descripcion: 'Masa para empaste con alto contenido graso.',
      categoria: 'hojaldres',
      rendimientoBaseKg: 24.0,
      costoTotalArroba: 115000,
      tiempoHorneado: 35,
      activo: true,
      fechaActualizacion: new Date().toISOString(),
      ingredientes: [
        { id: 'a1111111-1111-4111-a111-111111111114', formulacionId: '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f53', productoId: 'f5a6b7c8-d9e0-4123-a456-b7c8d9e00001', cantidadPorArroba: 11.5, unidad: 'kg', costoUnitario: 1.2, costoTotalArroba: 13.8 },
        { id: 'a1111111-1111-4111-a111-111111111115', formulacionId: '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f53', productoId: 'f5a6b7c8-d9e0-4123-a456-b7c8d9e00003', cantidadPorArroba: 4.5, unidad: 'kg', costoUnitario: 6.5, costoTotalArroba: 29.25 },
      ]
    },
    {
      id: '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f54',
      nombre: 'Batido de Tortas Maestro',
      descripcion: 'Fórmula 1:1 balanceada para bizcochuelos.',
      categoria: 'pasteleria',
      rendimientoBaseKg: 46.0,
      costoTotalArroba: 245000,
      tiempoHorneado: 45,
      activo: true,
      fechaActualizacion: new Date().toISOString(),
      ingredientes: [
        { id: 'a1111111-1111-4111-a111-111111111116', formulacionId: '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f54', productoId: 'f5a6b7c8-d9e0-4123-a456-b7c8d9e00001', cantidadPorArroba: 11.5, unidad: 'kg', costoUnitario: 1.2, costoTotalArroba: 13.8 },
      ]
    },
    {
      id: '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f55',
      nombre: 'Batido de Galletas Mantequilla',
      descripcion: 'Masa quebrada para producción masiva.',
      categoria: 'especiales',
      rendimientoBaseKg: 23.0,
      costoTotalArroba: 158000,
      tiempoHorneado: 15,
      activo: true,
      fechaActualizacion: new Date().toISOString(),
      ingredientes: [
        { id: 'a1111111-1111-4111-a111-111111111117', formulacionId: '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f55', productoId: 'f5a6b7c8-d9e0-4123-a456-b7c8d9e00001', cantidadPorArroba: 11.5, unidad: 'kg', costoUnitario: 1.2, costoTotalArroba: 13.8 },
      ]
    }
  ],

  // === MODELOS DE PAN POR FORMULACIÓN ===
  modelosPan: [
    { id: '9a8b7c6d-5e4f-4d3c-b2a1-0f9e8d7c6b51', nombre: 'Pan Francés 80g', formulacionId: '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f51', pesoUnitarioGr: 80, panesPorArroba: 231, precioVentaUnitario: 800, costoUnitario: 295, margenPorcentaje: 63, mermaEstimada: 5, activo: true, createdAt: new Date().toISOString() },
    { id: '9a8b7c6d-5e4f-4d3c-b2a1-0f9e8d7c6b52', nombre: 'Pan de Coco 100g', formulacionId: '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f52', pesoUnitarioGr: 100, panesPorArroba: 220, precioVentaUnitario: 1200, costoUnitario: 420, margenPorcentaje: 65, mermaEstimada: 3, activo: true, createdAt: new Date().toISOString() },
    { id: '9a8b7c6d-5e4f-4d3c-b2a1-0f9e8d7c6b53', nombre: 'Croissant Mantequilla 120g', formulacionId: '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f53', pesoUnitarioGr: 120, panesPorArroba: 200, precioVentaUnitario: 2500, costoUnitario: 575, margenPorcentaje: 77, mermaEstimada: 4, activo: true, createdAt: new Date().toISOString() },
    { id: '9a8b7c6d-5e4f-4d3c-b2a1-0f9e8d7c6b54', nombre: 'Ponqué Vainilla 500g', formulacionId: '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f54', pesoUnitarioGr: 500, panesPorArroba: 92, precioVentaUnitario: 15000, costoUnitario: 4500, margenPorcentaje: 70, mermaEstimada: 2, activo: true, createdAt: new Date().toISOString() },
    { id: '9a8b7c6d-5e4f-4d3c-b2a1-0f9e8d7c6b55', nombre: 'Galleta Mantequilla 40g', formulacionId: '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f55', pesoUnitarioGr: 40, panesPorArroba: 575, precioVentaUnitario: 1500, costoUnitario: 350, margenPorcentaje: 76, mermaEstimada: 1, activo: true, createdAt: new Date().toISOString() },
  ],
  recetas: [],
  ventas: [],
  recepciones: [],
  movimientosInventario: [],
  configuracion: {
    nombreNegocio: 'Panadería Dulce Placer',
    direccion: 'Calle Principal #123',
    moneda: 'COP',
    impuestosPorcentaje: 19
  }
};
