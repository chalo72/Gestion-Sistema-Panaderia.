/**
 * Datos de ejemplo y constantes de inicialización — Dulce Placer
 * Separado de types/index.ts para reducir el bundle de tipos
 */
import type { Usuario, Categoria, ProductoTipo } from '@/types';
import { USUARIOS_LOGIN_OFICIALES } from '@/lib/usuarios-login-oficiales';

// Usuarios base del sistema (login oficial). El resto se crea desde Usuarios o se inactiva.
export const USUARIOS_PRUEBA: Usuario[] = [...USUARIOS_LOGIN_OFICIALES];

// Emails de usuarios de prueba genéricos que deben eliminarse (SOLO los claramente falsos)
export const EMAILS_USUARIOS_LEGACY = [
  'lucia@dulceplacer.com',
  'marcos@dulceplacer.com',
  'invitado@dulceplacer.com',
  'admin@example.com',
  'gerente@example.com',
  'comprador@example.com',
  'vendedor@example.com',
];

// Credenciales de Acceso — Se cargan desde variables de entorno
// Las contraseñas NO se almacenan en código fuente
export const CREDENCIALES_PRUEBA: Record<string, string> = {};

// Categorías de Panadería y Negocio Dulce Placer — Completas
export const CATEGORIAS_DEFAULT: Categoria[] = [
  // === PRODUCTOS ELABORADOS (para venta POS) ===
  { id: 'cat-pan', nombre: 'Panes', color: '#d97706', icono: '🍞', tipo: 'venta' },
  { id: 'cat-past', nombre: 'Pastelería', color: '#ec4899', icono: '🎂', tipo: 'venta' },
  { id: 'cat-repo', nombre: 'Repostería', color: '#f43f5e', icono: '🧁', tipo: 'venta' },
  { id: 'cat-dulc', nombre: 'Dulces', color: '#f59e0b', icono: '🍬', tipo: 'venta' },
  { id: 'cat-gallt', nombre: 'Galletería', color: '#a16207', icono: '🍪', tipo: 'venta' },
  { id: 'cat-hojal', nombre: 'Hojaldres', color: '#ca8a04', icono: '🥐', tipo: 'venta' },
  { id: 'cat-beb', nombre: 'Bebidas', color: '#0ea5e9', icono: '☕', tipo: 'venta' },
  { id: 'cat-mich', nombre: 'Micheladas', color: '#ef4444', icono: '🍺', tipo: 'venta' },
  { id: 'cat-aven', nombre: 'Avena y Granola', color: '#84cc16', icono: '🥣', tipo: 'venta' },
  { id: 'cat-piat', nombre: 'Piñatería', color: '#a855f7', icono: '🎉', tipo: 'venta' },
  { id: 'cat-pasab', nombre: 'Pasabocas', color: '#f97316', icono: '🍿', tipo: 'venta' },
  { id: 'cat-otro', nombre: 'Otro', color: '#6b7280', icono: '📦' },

  // === CATEGORÍAS DE INSUMOS (Uso Interno - Ocultas en POS) ===
  { id: 'ins-pan', nombre: 'INS: Panadería', color: '#f59e0b', icono: '🥖', tipo: 'insumo' },
  { id: 'ins-tort', nombre: 'INS: Tortas', color: '#ec4899', icono: '🎂', tipo: 'insumo' },
  { id: 'ins-beb-prep', nombre: 'INS: Bebidas Preparadas', color: '#22c55e', icono: '🥤', tipo: 'insumo' },
  { id: 'ins-repo-fria', nombre: 'INS: Repostería Fría', color: '#3b82f6', icono: '🧁', tipo: 'insumo' },
  { id: 'ins-cafe', nombre: 'INS: Cafetería', color: '#8b5cf6', icono: '☕', tipo: 'insumo' },
  { id: 'ins-hela', nombre: 'INS: Helados', color: '#60a5fa', icono: '🍦', tipo: 'insumo' },

  // === MATERIA PRIMA (para inventario/compras) ===
  { id: '3606f157-8df1-419b-a010-0968997e0001', nombre: 'Harinas y Materia Prima', color: '#8b5e3c', icono: '🌾', tipo: 'insumo' },
  { id: '3606f157-8df1-419b-a010-0968997e0002', nombre: 'Lácteos y Huevos', color: '#facc15', icono: '🥛', tipo: 'insumo' },
  { id: '3606f157-8df1-419b-a010-0968997e0003', nombre: 'Azúcares y Endulzantes', color: '#3b82f6', icono: '🍬', tipo: 'insumo' },
  { id: '3606f157-8df1-419b-a010-0968997e0004', nombre: 'Levaduras y Aditivos', color: '#10b981', icono: '🧪', tipo: 'insumo' },
  { id: '3606f157-8df1-419b-a010-0968997e0005', nombre: 'Empaques y Desechables', color: '#6366f1', icono: '📦', tipo: 'insumo' },
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

    // === INSUMOS HELADERÍA ===
    { id: 'ins-hela-001', nombre: 'Caja Helado 10L', categoria: 'INS: Helados', descripcion: 'Varios sabores', precioVenta: 0, margenUtilidad: 0, tipo: 'ingrediente' as ProductoTipo, costoBase: 85000, unidadMedida: 'ml', stockActual: 10000, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'ins-hela-002', nombre: 'Vaso Helado 7oz', categoria: 'INS: Helados', descripcion: 'Paquete x 50', precioVenta: 0, margenUtilidad: 0, tipo: 'ingrediente' as ProductoTipo, costoBase: 120, unidadMedida: 'und', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'ins-hela-003', nombre: 'Cucharita Helado', categoria: 'INS: Helados', descripcion: 'Desechable premium', precioVenta: 0, margenUtilidad: 0, tipo: 'ingrediente' as ProductoTipo, costoBase: 15, unidadMedida: 'und', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'ins-hela-004', nombre: 'Salsa de Chocolate', categoria: 'INS: Helados', descripcion: 'Botella 1L', precioVenta: 0, margenUtilidad: 0, tipo: 'ingrediente' as ProductoTipo, costoBase: 18000, unidadMedida: 'ml', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'ins-hela-005', nombre: 'Pepitas de Colores', categoria: 'INS: Helados', descripcion: 'Topping arcoiris', precioVenta: 0, margenUtilidad: 0, tipo: 'ingrediente' as ProductoTipo, costoBase: 25, unidadMedida: 'gr', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },

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
        "id": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f51",
        "nombre": "Masa de Sal Mixta",
        "descripcion": "Fórmula básica equilibrada para panes de sal tradicionales.",
        "categoria": "panes",
        "rendimientoBaseKg": 23.45,
        "costoTotalArroba": 76065.93054545454,
        "tiempoHorneado": 25,
        "activo": true,
        "fechaActualizacion": "2026-07-11T13:16:12.331Z",
        "ingredientes": [
            {
                "id": "a1111111-1111-4111-a111-111111111111",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f51",
                "productoId": "a0192ead-f198-4b1b-84a4-46ba1c567dda",
                "cantidadPorArroba": 24.0,
                "unidad": "lb",
                "costoUnitario": 2400.0,
                "costoTotalArroba": 28800.0,
                "porcentajePanadero": 100
            },
            {
                "id": "a1111111-1111-4111-a111-111111111112",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f51",
                "productoId": "8e5e83ce-d68f-4fb5-9ec3-59fb6bc825dd",
                "cantidadPorArroba": 8.0,
                "unidad": "und",
                "costoUnitario": 476.19,
                "costoTotalArroba": 190.476
            },
            {
                "id": "ade1eee3-583b-427f-a5b5-22fa8d701dc9",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f51",
                "productoId": "1bca14f2-c7a6-47bb-9b51-ab0e46489ddb",
                "cantidadPorArroba": 4.0,
                "unidad": "lb",
                "costoUnitario": 3060.0,
                "costoTotalArroba": 6120.0
            },
            {
                "id": "44f5c49a-b1b0-4e17-946d-e00f5eeb7f6e",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f51",
                "productoId": "32b57263-6f31-48bb-a814-ffecd4bc7bfa",
                "cantidadPorArroba": 200.0,
                "unidad": "gr",
                "costoUnitario": 2500.0,
                "costoTotalArroba": 500.0
            },
            {
                "id": "f7bd4170-ca9d-4745-87ee-5d8869f3e5ed",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f51",
                "productoId": "7522e82d-12fd-46dc-a708-0b2a3fd104ad",
                "cantidadPorArroba": 4.0,
                "unidad": "l",
                "costoUnitario": 400.0,
                "costoTotalArroba": 1600.0
            },
            {
                "id": "a9b17a43-8c13-4927-8d13-e2fe23cbba3c",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f51",
                "productoId": "9e90507a-a5cb-4a62-8164-66fbc904c8d6",
                "cantidadPorArroba": 250.0,
                "unidad": "gr",
                "costoUnitario": 13400.0,
                "costoTotalArroba": 3350.0
            },
            {
                "id": "4e7b9714-f57d-4465-beec-595cdda7dcb1",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f51",
                "productoId": "6d9f294b-cd82-42b9-a56a-fc60b307e90a",
                "cantidadPorArroba": 200.0,
                "unidad": "gr",
                "costoUnitario": 6545.454545454545,
                "costoTotalArroba": 1309.090909090909
            },
            {
                "id": "0e772796-8f80-4767-81b9-ceecc46d726d",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f51",
                "productoId": "0b36e929-3d67-4ba5-b3fe-e741f3762ddb",
                "cantidadPorArroba": 200.0,
                "unidad": "gr",
                "costoUnitario": 6545.454545454545,
                "costoTotalArroba": 1309.090909090909
            },
            {
                "id": "13df6848-f1dc-45c5-b125-bd0f68890847",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f51",
                "productoId": "c63f2437-0d4a-4f10-aa7d-669069fe0c90",
                "cantidadPorArroba": 4.0,
                "unidad": "l",
                "costoUnitario": 7840.0,
                "costoTotalArroba": 31360.0
            },
            {
                "id": "037a17f5-9792-4c42-bf2a-07f21dda3305",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f51",
                "productoId": "970621f8-1269-4987-8683-9adb0a2e2dc0",
                "cantidadPorArroba": 200.0,
                "unidad": "gr",
                "costoUnitario": 7636.363636363636,
                "costoTotalArroba": 1527.2727272727273
            },
            {
                "id": "747109b6-9ad6-4fb1-b869-cf86b2523d99",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f51",
                "productoId": "",
                "cantidadPorArroba": 0.0,
                "unidad": "kg",
                "costoUnitario": 0.0,
                "costoTotalArroba": 0.0
            }
        ],
        "instrucciones": ""
    },
    {
        "activo": true,
        "categoria": "panes",
        "costoTotalArroba": 71985.37981577891,
        "descripcion": "Alta hidratación y azúcar para panes dulces y trenzas.",
        "fechaActualizacion": "2026-07-10T12:46:54.967Z",
        "id": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f52",
        "ingredientes": [
            {
                "id": "a1111111-1111-4111-a111-111111111113",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f52",
                "productoId": "a0192ead-f198-4b1b-84a4-46ba1c567dda",
                "cantidadPorArroba": 24.0,
                "unidad": "lb",
                "costoUnitario": 2400.0,
                "costoTotalArroba": 28800.0
            },
            {
                "id": "34168c1e-336f-4bbe-9901-89ff03763d7d",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f52",
                "productoId": "1bca14f2-c7a6-47bb-9b51-ab0e46489ddb",
                "cantidadPorArroba": 6.0,
                "unidad": "lb",
                "costoUnitario": 3060.0,
                "costoTotalArroba": 9180.0
            },
            {
                "id": "d6ffc8cf-0fda-49fb-a901-4c48e4770893",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f52",
                "productoId": "6d9f294b-cd82-42b9-a56a-fc60b307e90a",
                "cantidadPorArroba": 200.0,
                "unidad": "gr",
                "costoUnitario": 25200.0,
                "costoTotalArroba": 5040.0
            },
            {
                "id": "b28fb724-165b-4506-ba7d-b77aaf2957fa",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f52",
                "productoId": "4e5fb524-752d-4ee7-98ed-0367e30a317a",
                "cantidadPorArroba": 8.0,
                "unidad": "und",
                "costoUnitario": 15000.0,
                "costoTotalArroba": 6000.0
            },
            {
                "id": "23981377-57c8-4123-a403-ffa47517244f",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f52",
                "productoId": "32b57263-6f31-48bb-a814-ffecd4bc7bfa",
                "cantidadPorArroba": 200.0,
                "unidad": "gr",
                "costoUnitario": 2500.0,
                "costoTotalArroba": 500.0
            },
            {
                "id": "af34d60e-d1f9-42fb-aabc-b0d96fd02929",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f52",
                "productoId": "9e90507a-a5cb-4a62-8164-66fbc904c8d6",
                "cantidadPorArroba": 250.0,
                "unidad": "gr",
                "costoUnitario": 6700.0,
                "costoTotalArroba": 1675.0
            },
            {
                "id": "e1786f40-0445-45d8-a16d-8012bc16260c",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f52",
                "productoId": "d2410ef8-6ca6-412b-889b-4d49035544f7",
                "cantidadPorArroba": 200.0,
                "unidad": "gr",
                "costoUnitario": 7636.0,
                "costoTotalArroba": 1527.2
            },
            {
                "id": "4b49db29-cdfe-4435-b245-4aa8eb41a590",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f52",
                "productoId": "c63f2437-0d4a-4f10-aa7d-669069fe0c90",
                "cantidadPorArroba": 4.0,
                "unidad": "lb",
                "costoUnitario": 7840.0,
                "costoTotalArroba": 15680.0
            },
            {
                "id": "78a7c1f8-3943-41f3-adf6-923fa8d05ace",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f52",
                "productoId": "4cdae33c-ef43-4ca5-b882-10bab3bee80d",
                "cantidadPorArroba": 200.0,
                "unidad": "gr",
                "costoUnitario": 7636.363636363636,
                "costoTotalArroba": 1527.2727272727273
            },
            {
                "id": "e4b1b22f-05fc-4d6c-bbf4-ba869faea6dc",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f52",
                "productoId": "545c0f06-2011-4f3f-8d77-81a39a77bd1e",
                "cantidadPorArroba": 200.0,
                "unidad": "gr",
                "costoUnitario": 7636.363636363636,
                "costoTotalArroba": 1527.2727272727273
            },
            {
                "id": "d3cdc155-5600-4ba9-812d-7822dc53691d",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f52",
                "productoId": "c9b38fba-6baa-412e-b0d5-d41befd3aa37",
                "cantidadPorArroba": 30.0,
                "unidad": "gr",
                "costoUnitario": 17621.145374449337,
                "costoTotalArroba": 528.6343612334801
            }
        ],
        "nombre": "Masa de Dulce",
        "rendimientoBaseKg": 18.679999999999996,
        "tiempoHorneado": 20,
        "instrucciones": ""
    },
    {
        "id": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f53",
        "nombre": "Masa de Hojaldre Mixta",
        "descripcion": "Masa para empaste con alto contenido graso.",
        "categoria": "hojaldres",
        "rendimientoBaseKg": 19.749999999999996,
        "costoTotalArroba": 97589.64569696969,
        "tiempoHorneado": 35,
        "activo": true,
        "fechaActualizacion": "2026-07-11T13:27:56.963Z",
        "ingredientes": [
            {
                "id": "a1111111-1111-4111-a111-111111111114",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f53",
                "productoId": "327ff497-49c7-4ef4-b0df-0cee86d85226",
                "cantidadPorArroba": 24.0,
                "unidad": "lb",
                "costoUnitario": 4000.0,
                "costoTotalArroba": 48000.0
            },
            {
                "id": "a1111111-1111-4111-a111-111111111115",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f53",
                "productoId": "18011d90-e58d-4751-b7c8-0865b37dd4a2",
                "cantidadPorArroba": 700.0,
                "unidad": "gr",
                "costoUnitario": 9466.666666666666,
                "costoTotalArroba": 6626.666666666666
            },
            {
                "id": "8db00c31-97fd-40bb-90de-eb8163441a1a",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f53",
                "productoId": "53123213-8e2e-4fbf-866a-76da7f2b8419",
                "cantidadPorArroba": 8.0,
                "unidad": "lb",
                "costoUnitario": 9526.666666666666,
                "costoTotalArroba": 38106.666666666664
            },
            {
                "id": "da652689-8198-452f-8169-44dba7bb4014",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f53",
                "productoId": "32b57263-6f31-48bb-a814-ffecd4bc7bfa",
                "cantidadPorArroba": 3.0,
                "unidad": "und",
                "costoUnitario": 2500.0,
                "costoTotalArroba": 375.0
            },
            {
                "id": "ba784a65-0806-4e5b-89a7-f455804726fa",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f53",
                "productoId": "7522e82d-12fd-46dc-a708-0b2a3fd104ad",
                "cantidadPorArroba": 2.0,
                "unidad": "l",
                "costoUnitario": 400.0,
                "costoTotalArroba": 800.0
            },
            {
                "id": "59b3f937-9881-49e2-ad47-817fd82de984",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f53",
                "productoId": "0b36e929-3d67-4ba5-b3fe-e741f3762ddb",
                "cantidadPorArroba": 300.0,
                "unidad": "gr",
                "costoUnitario": 6545.454545454545,
                "costoTotalArroba": 1963.6363636363635
            },
            {
                "id": "213e821a-80d1-4dd3-97e5-8f3bf6094bd4",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f53",
                "productoId": "d2410ef8-6ca6-412b-889b-4d49035544f7",
                "cantidadPorArroba": 200.0,
                "unidad": "gr",
                "costoUnitario": 7636.0,
                "costoTotalArroba": 1527.2
            },
            {
                "id": "6b40b3e6-1540-4fb2-939f-b6e612b4166a",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f53",
                "productoId": "8e5e83ce-d68f-4fb5-9ec3-59fb6bc825dd",
                "cantidadPorArroba": 8.0,
                "unidad": "und",
                "costoUnitario": 476.19,
                "costoTotalArroba": 190.476
            }
        ],
        "instrucciones": ""
    },
    {
        "id": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f54",
        "nombre": "Batido de Tortas Maestro",
        "descripcion": "Fórmula 1:1 balanceada para bizcochuelos.",
        "categoria": "pasteleria",
        "rendimientoBaseKg": 20.949999999999992,
        "costoTotalArroba": 95384933.11942957,
        "tiempoHorneado": 45,
        "activo": true,
        "fechaActualizacion": "2026-07-30T16:10:17.574Z",
        "ingredientes": [
            {
                "id": "a1111111-1111-4111-a111-111111111116",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f54",
                "productoId": "327ff497-49c7-4ef4-b0df-0cee86d85226",
                "cantidadPorArroba": 10.0,
                "unidad": "lb",
                "costoUnitario": 19047600.0,
                "costoTotalArroba": 95238000.0
            },
            {
                "id": "c7b904b4-424e-43c8-aa13-627101d951ed",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f54",
                "productoId": "18011d90-e58d-4751-b7c8-0865b37dd4a2",
                "cantidadPorArroba": 10.0,
                "unidad": "lb",
                "costoUnitario": 9466.666666666666,
                "costoTotalArroba": 47333.33333333333
            },
            {
                "id": "643fbdc9-fb42-439b-a8db-31a5c365aace",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f54",
                "productoId": "b4e1d681-e9da-40b3-b210-56c9272545c6",
                "cantidadPorArroba": 10.0,
                "unidad": "lb",
                "costoUnitario": 2960.0,
                "costoTotalArroba": 14800.0
            },
            {
                "id": "21add1d4-1272-42ae-9d7c-0af0a66f7fa5",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f54",
                "productoId": "4e5fb524-752d-4ee7-98ed-0367e30a317a",
                "cantidadPorArroba": 10.0,
                "unidad": "lb",
                "costoUnitario": 15000.0,
                "costoTotalArroba": 75000.0
            },
            {
                "id": "4812d100-4b8a-417d-b924-e672fafbb96c",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f54",
                "productoId": "970621f8-1269-4987-8683-9adb0a2e2dc0",
                "cantidadPorArroba": 150.0,
                "unidad": "gr",
                "costoUnitario": 7636.363636363636,
                "costoTotalArroba": 1145.4545454545455
            },
            {
                "id": "d0c9a1ef-141b-4533-8704-216bdcba506c",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f54",
                "productoId": "4cdae33c-ef43-4ca5-b882-10bab3bee80d",
                "cantidadPorArroba": 150.0,
                "unidad": "gr",
                "costoUnitario": 7636.363636363636,
                "costoTotalArroba": 1145.4545454545455
            },
            {
                "id": "15e621e3-8421-4448-8987-a832e62cc3ff",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f54",
                "productoId": "56635656-add0-42ee-b30c-6f47251e7844",
                "cantidadPorArroba": 150.0,
                "unidad": "gr",
                "costoUnitario": 16470.58823529412,
                "costoTotalArroba": 2470.588235294118
            },
            {
                "id": "a80a3b92-693c-4a75-ab78-05e2b522b6ba",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f54",
                "productoId": "6ecf9aed-23ac-4578-9581-44e563dd6e9c",
                "cantidadPorArroba": 150.0,
                "unidad": "gr",
                "costoUnitario": 21176.470588235294,
                "costoTotalArroba": 3176.470588235294
            },
            {
                "id": "7971f547-65ca-431c-ba3d-6a9921844482",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f54",
                "productoId": "9a552eb3-5875-4f82-be75-0c8e8913986b",
                "cantidadPorArroba": 150.0,
                "unidad": "gr",
                "costoUnitario": 6545.454545454545,
                "costoTotalArroba": 981.8181818181818
            },
            {
                "id": "5511bdd2-852b-4dec-b4e8-205b0f3854b0",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f54",
                "productoId": "e57594c3-572d-414e-b810-37d77faaf2b8",
                "cantidadPorArroba": 200.0,
                "unidad": "gr",
                "costoUnitario": 4400.0,
                "costoTotalArroba": 880.0
            },
            {
                "id": "8cdecd86-a737-45b7-a35b-3367cde486b3",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f54",
                "productoId": "",
                "cantidadPorArroba": 0.0,
                "unidad": "kg",
                "costoUnitario": 0.0,
                "costoTotalArroba": 0.0
            }
        ],
        "instrucciones": ""
    },
    {
        "id": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f55",
        "nombre": "Vatido Galleta",
        "descripcion": "Masa quebrada para producción masiva.",
        "categoria": "galletas",
        "rendimientoBaseKg": 25.270000000000007,
        "costoTotalArroba": 98043.83957219252,
        "tiempoHorneado": 15,
        "activo": true,
        "fechaActualizacion": "2026-07-19T13:41:41.148Z",
        "ingredientes": [
            {
                "id": "a1111111-1111-4111-a111-111111111117",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f55",
                "productoId": "327ff497-49c7-4ef4-b0df-0cee86d85226",
                "cantidadPorArroba": 46.0,
                "unidad": "lb",
                "costoUnitario": 4000.0,
                "costoTotalArroba": 92000.0
            },
            {
                "id": "fd5f7c3b-9e6c-4fa5-a3e0-538ff89d5cb4",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f55",
                "productoId": "7522e82d-12fd-46dc-a708-0b2a3fd104ad",
                "cantidadPorArroba": 1750.0,
                "unidad": "gr",
                "costoUnitario": 400.0,
                "costoTotalArroba": 700.0
            },
            {
                "id": "7f7164f5-18a8-4702-a5f4-2807c726d3b6",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f55",
                "productoId": "8247a6b9-291b-4e08-bba4-3ee7430c55e5",
                "cantidadPorArroba": 1.0,
                "unidad": "und",
                "costoUnitario": 26200.0,
                "costoTotalArroba": 1310.0
            },
            {
                "id": "9bd51aba-a4d2-4c4b-895c-1134af7fe027",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f55",
                "productoId": "6d9f294b-cd82-42b9-a56a-fc60b307e90a",
                "cantidadPorArroba": 30.0,
                "unidad": "gr",
                "costoUnitario": 6545.454545454545,
                "costoTotalArroba": 196.36363636363635
            },
            {
                "id": "46607d67-2d18-4987-bfab-fcd03fcfa92f",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f55",
                "productoId": "b8ec89a4-7bee-411f-8fde-cf2ee390d6bf",
                "cantidadPorArroba": 30.0,
                "unidad": "gr",
                "costoUnitario": 21176.470588235294,
                "costoTotalArroba": 635.2941176470588
            },
            {
                "id": "4f909f08-0196-4359-9907-e62b0fbdd006",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f55",
                "productoId": "970621f8-1269-4987-8683-9adb0a2e2dc0",
                "cantidadPorArroba": 30.0,
                "unidad": "gr",
                "costoUnitario": 7636.363636363636,
                "costoTotalArroba": 229.0909090909091
            },
            {
                "id": "b59b4372-36f1-4426-9583-e3481d4b038c",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f55",
                "productoId": "4cdae33c-ef43-4ca5-b882-10bab3bee80d",
                "cantidadPorArroba": 30.0,
                "unidad": "gr",
                "costoUnitario": 7636.363636363636,
                "costoTotalArroba": 229.0909090909091
            },
            {
                "id": "f10f81e4-7e83-4b93-afdb-50d9c4c44159",
                "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f55",
                "productoId": "c63f2437-0d4a-4f10-aa7d-669069fe0c90",
                "cantidadPorArroba": 350.0,
                "unidad": "gr",
                "costoUnitario": 7840.0,
                "costoTotalArroba": 2744.0
            }
        ],
        "instrucciones": ""
    }
],

  // === MODELOS DE PAN POR FORMULACIÓN ===
  modelosPan: [
    {
        "id": "9a8b7c6d-5e4f-4d3c-b2a1-0f9e8d7c6b51",
        "activo": true,
        "costoUnitario": 153.65130174146356,
        "createdAt": "2026-07-14T14:14:24.586Z",
        "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f51",
        "ingredientesAdicionales": [],
        "margenPorcentaje": 69,
        "mermaEstimada": 5,
        "nombre": "Pan Mantequilla",
        "panesPorArroba": 495,
        "pesoUnitarioGr": 45,
        "piezasPorLata": 40,
        "precioVentaUnitario": 500,
        "piqueEmpaste": {
            "insumoId": "53123213-8e2e-4fbf-866a-76da7f2b8419",
            "cantidadInsumo": 2,
            "unidadInsumo": "lb",
            "cortes": 1,
            "pesoMasaGr": 18
        }
    },
    {
        "activo": true,
        "costoUnitario": 178.7755850962522,
        "createdAt": "2026-07-27T15:49:59.058Z",
        "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f52",
        "id": "9a8b7c6d-5e4f-4d3c-b2a1-0f9e8d7c6b52",
        "margenPorcentaje": 70,
        "mermaEstimada": 3,
        "nombre": "Pan queso dulce(pqñ) 45gr",
        "panesPorArroba": 402,
        "pesoUnitarioGr": 45,
        "precioVentaUnitario": 600,
        "piezasPorLata": 40,
        "ingredientesAdicionales": []
    },
    {
        "id": "9a8b7c6d-5e4f-4d3c-b2a1-0f9e8d7c6b54",
        "nombre": "Torta media",
        "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f54",
        "pesoUnitarioGr": 500,
        "panesPorArroba": 22,
        "precioVentaUnitario": 15000,
        "costoUnitario": 0.6122448979591838,
        "margenPorcentaje": 100,
        "mermaEstimada": 2,
        "activo": true,
        "createdAt": "2026-07-19T15:09:14.014Z",
        "ingredientesAdicionales": []
    },
    {
        "id": "9a8b7c6d-5e4f-4d3c-b2a1-0f9e8d7c6b55",
        "nombre": "Galleta  coco 40g",
        "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f55",
        "pesoUnitarioGr": 45,
        "panesPorArroba": 533,
        "precioVentaUnitario": 600,
        "costoUnitario": 183.78242479114667,
        "margenPorcentaje": 69,
        "mermaEstimada": 5,
        "activo": true,
        "createdAt": "2026-07-19T13:39:37.320Z",
        "ingredientesAdicionales": []
    },
    {
        "id": "7b8a6692-e4d6-4466-a74c-9c06fade809d",
        "nombre": "Pan mogoya(Arequipe pqñ)",
        "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f52",
        "pesoUnitarioGr": 45,
        "panesPorArroba": 394,
        "precioVentaUnitario": 600,
        "costoUnitario": 182.53928162459437,
        "margenPorcentaje": 70,
        "mermaEstimada": 5,
        "piezasPorLata": 32,
        "activo": true,
        "createdAt": "2026-07-27T15:46:35.305Z",
        "ingredientesAdicionales": []
    },
    {
        "id": "a3afb5be-3190-4aa6-8ce2-3e9624af3781",
        "activo": true,
        "costoUnitario": 182.53928162459437,
        "createdAt": "2026-07-10T22:42:54.492Z",
        "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f52",
        "ingredientesAdicionales": [],
        "margenPorcentaje": 70,
        "mermaEstimada": 5,
        "nombre": "Pan Pqñ Bocadillo",
        "panesPorArroba": 394,
        "pesoUnitarioGr": 45,
        "piezasPorLata": 35,
        "precioVentaUnitario": 600
    },
    {
        "id": "cfe9246f-2393-4225-9187-360002c574ce",
        "activo": true,
        "costoUnitario": 175.39118065433857,
        "createdAt": "2026-07-11T12:46:39.042Z",
        "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f51",
        "ingredientesAdicionales": [],
        "margenPorcentaje": 71,
        "mermaEstimada": 5,
        "nombre": "Pan 600(Piña)",
        "panesPorArroba": 390,
        "pesoUnitarioGr": 45,
        "piezasPorLata": 40,
        "precioVentaUnitario": 600
    },
    {
        "id": "d1d122c9-98d3-4636-ab55-07ae7c028753",
        "activo": true,
        "costoUnitario": 311.8065433854908,
        "createdAt": "2026-07-11T12:46:45.987Z",
        "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f51",
        "ingredientesAdicionales": [],
        "margenPorcentaje": 84,
        "mermaEstimada": 5,
        "nombre": "Pan Croazan (2000)",
        "panesPorArroba": 219,
        "pesoUnitarioGr": 80,
        "piezasPorLata": 15,
        "precioVentaUnitario": 2000
    },
    {
        "id": "0e3d486b-18aa-4353-9838-acddd755e095",
        "activo": true,
        "costoUnitario": 311.8065433854908,
        "createdAt": "2026-07-11T12:46:51.443Z",
        "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f51",
        "ingredientesAdicionales": [],
        "margenPorcentaje": 84,
        "mermaEstimada": 5,
        "nombre": "Pan corbatin(2000)",
        "panesPorArroba": 219,
        "pesoUnitarioGr": 80,
        "piezasPorLata": 15,
        "precioVentaUnitario": 2000
    },
    {
        "id": "45d194a4-f0c0-45aa-9c1a-98ef3c36cadf",
        "activo": true,
        "costoUnitario": 324.51427844372336,
        "createdAt": "2026-07-10T22:42:58.592Z",
        "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f52",
        "ingredientesAdicionales": [],
        "margenPorcentaje": 68,
        "mermaEstimada": 5,
        "nombre": "Pan Panocha",
        "panesPorArroba": 221,
        "pesoUnitarioGr": 80,
        "piezasPorLata": 18,
        "precioVentaUnitario": 1000
    },
    {
        "id": "cbd030ee-7b0b-4f2a-9f2e-b4ff87f6b56e",
        "activo": true,
        "costoUnitario": 324.51427844372336,
        "createdAt": "2026-07-10T22:43:03.484Z",
        "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f52",
        "ingredientesAdicionales": [],
        "margenPorcentaje": 84,
        "mermaEstimada": 5,
        "nombre": "Pan caña",
        "panesPorArroba": 221,
        "pesoUnitarioGr": 80,
        "piezasPorLata": 15,
        "precioVentaUnitario": 2000
    },
    {
        "id": "04713bab-0c26-4013-a2ab-a2dc0289b75f",
        "activo": true,
        "costoUnitario": 324.51427844372336,
        "createdAt": "2026-07-10T22:43:08.332Z",
        "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f52",
        "ingredientesAdicionales": [],
        "margenPorcentaje": 84,
        "mermaEstimada": 5,
        "nombre": "Pan Hawaino",
        "panesPorArroba": 221,
        "pesoUnitarioGr": 80,
        "piezasPorLata": 15,
        "precioVentaUnitario": 2000
    },
    {
        "id": "a6813e8c-c7e5-4c2d-be7e-947b99c3afd9",
        "nombre": "Galleta queso",
        "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f55",
        "pesoUnitarioGr": 80,
        "panesPorArroba": 300,
        "precioVentaUnitario": 0,
        "costoUnitario": 326.7243107398163,
        "margenPorcentaje": 0,
        "mermaEstimada": 5,
        "activo": true,
        "createdAt": "2026-07-19T13:40:00.751Z",
        "ingredientesAdicionales": []
    },
    {
        "id": "f1ce0f1c-830e-450d-a0b0-3d914bedcc00",
        "nombre": "Galleta Punto Rojo",
        "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f55",
        "pesoUnitarioGr": 80,
        "panesPorArroba": 300,
        "precioVentaUnitario": 0,
        "costoUnitario": 326.7243107398163,
        "margenPorcentaje": 0,
        "mermaEstimada": 5,
        "activo": true,
        "createdAt": "2026-07-19T13:40:46.408Z",
        "ingredientesAdicionales": []
    },
    {
        "id": "ed893a4b-f928-4617-80b9-1d95178812c5",
        "nombre": "Galleta DE colores",
        "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f55",
        "pesoUnitarioGr": 80,
        "panesPorArroba": 300,
        "precioVentaUnitario": 0,
        "costoUnitario": 326.7243107398163,
        "margenPorcentaje": 0,
        "mermaEstimada": 5,
        "activo": true,
        "createdAt": "2026-07-19T13:41:09.413Z",
        "ingredientesAdicionales": []
    },
    {
        "id": "b96c8795-57a0-410f-a207-ec3161250e8e",
        "nombre": "torta libra",
        "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f54",
        "pesoUnitarioGr": 80,
        "panesPorArroba": 136,
        "precioVentaUnitario": 0,
        "costoUnitario": 0.10105263157894738,
        "margenPorcentaje": 0,
        "mermaEstimada": 5,
        "activo": true,
        "createdAt": "2026-07-19T15:12:17.093Z",
        "ingredientesAdicionales": []
    },
    {
        "id": "73d81b9e-0155-4160-9e79-1af2e9bd8df3",
        "nombre": "Torta 3/4",
        "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f54",
        "pesoUnitarioGr": 80,
        "panesPorArroba": 136,
        "precioVentaUnitario": 0,
        "costoUnitario": 0.10105263157894738,
        "margenPorcentaje": 0,
        "mermaEstimada": 5,
        "activo": true,
        "createdAt": "2026-07-19T15:13:19.508Z",
        "ingredientesAdicionales": []
    },
    {
        "id": "c4d3daab-e9cf-4a0e-acbc-465795d95dbf",
        "nombre": "Pan Canela",
        "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f52",
        "pesoUnitarioGr": 45,
        "panesPorArroba": 394,
        "precioVentaUnitario": 600,
        "costoUnitario": 182.53928162459437,
        "margenPorcentaje": 70,
        "mermaEstimada": 5,
        "piezasPorLata": 40,
        "activo": true,
        "createdAt": "2026-07-25T15:48:03.439Z",
        "ingredientesAdicionales": []
    },
    {
        "id": "8effe30d-f7bf-4776-b698-8f9d1e83aa6f",
        "nombre": "Pan Queso Dulce Grd",
        "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f52",
        "pesoUnitarioGr": 80,
        "panesPorArroba": 221,
        "precioVentaUnitario": 1500,
        "costoUnitario": 324.51427844372336,
        "margenPorcentaje": 78,
        "mermaEstimada": 5,
        "piezasPorLata": 24,
        "activo": true,
        "createdAt": "2026-07-27T16:14:19.642Z",
        "ingredientesAdicionales": []
    },
    {
        "id": "0c6753c0-c492-4e32-bbe2-a9d1b4997469",
        "nombre": "Pan Arequipe Grd (Mogoya)",
        "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f52",
        "pesoUnitarioGr": 80,
        "panesPorArroba": 221,
        "precioVentaUnitario": 1000,
        "costoUnitario": 324.51427844372336,
        "margenPorcentaje": 68,
        "mermaEstimada": 5,
        "piezasPorLata": 21,
        "activo": true,
        "createdAt": "2026-07-27T15:48:58.496Z",
        "ingredientesAdicionales": []
    },
    {
        "id": "fb0b13c9-38b6-4f34-82cd-863ca279946c",
        "nombre": "Pan Aliñado",
        "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f51",
        "pesoUnitarioGr": 80,
        "panesPorArroba": 278,
        "precioVentaUnitario": 1000,
        "costoUnitario": 273.1578697626019,
        "margenPorcentaje": 73,
        "mermaEstimada": 5,
        "piezasPorLata": 15,
        "activo": true,
        "createdAt": "2026-07-26T02:40:25.581Z",
        "ingredientesAdicionales": []
    },
    {
        "id": "5d3b48eb-3545-4656-9490-44ab46729f3d",
        "nombre": "Pan de maiz queso",
        "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f51",
        "pesoUnitarioGr": 45,
        "panesPorArroba": 495,
        "precioVentaUnitario": 600,
        "costoUnitario": 153.65130174146356,
        "margenPorcentaje": 74,
        "mermaEstimada": 5,
        "piezasPorLata": 40,
        "activo": true,
        "createdAt": "2026-07-26T02:43:02.101Z",
        "ingredientesAdicionales": []
    },
    {
        "id": "e213abe3-093e-465d-a6ae-95da3a98ee37",
        "nombre": "Pan Aliñado Grd Empaque",
        "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f51",
        "pesoUnitarioGr": 100,
        "panesPorArroba": 222,
        "precioVentaUnitario": 2000,
        "costoUnitario": 341.44733720325235,
        "margenPorcentaje": 83,
        "mermaEstimada": 5,
        "piezasPorLata": 80,
        "activo": true,
        "createdAt": "2026-07-26T02:56:42.683Z",
        "ingredientesAdicionales": []
    },
    {
        "id": "7958b954-d81d-4f7d-ae68-39c9b5d4d2cc",
        "nombre": "Pan Trensado Grd empaque",
        "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f51",
        "pesoUnitarioGr": 100,
        "panesPorArroba": 222,
        "precioVentaUnitario": 3500,
        "costoUnitario": 341.44733720325235,
        "margenPorcentaje": 90,
        "mermaEstimada": 5,
        "piezasPorLata": 8,
        "activo": true,
        "createdAt": "2026-07-26T02:59:46.448Z",
        "ingredientesAdicionales": []
    },
    {
        "id": "f14275f1-9cdd-47c3-ae35-6822d2f721d3",
        "nombre": "Pan Bocadillo Grad",
        "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f52",
        "pesoUnitarioGr": 80,
        "panesPorArroba": 221,
        "precioVentaUnitario": 1000,
        "costoUnitario": 324.51427844372336,
        "margenPorcentaje": 68,
        "mermaEstimada": 5,
        "piezasPorLata": 15,
        "activo": true,
        "createdAt": "2026-07-26T03:03:50.811Z",
        "ingredientesAdicionales": []
    },
    {
        "id": "daa35b53-c728-4c9a-a69c-8198df285e8c",
        "nombre": "Pastelito Arequipe",
        "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f53",
        "pesoUnitarioGr": 80,
        "panesPorArroba": 234,
        "precioVentaUnitario": 1500,
        "costoUnitario": 416.105084917126,
        "margenPorcentaje": 72,
        "mermaEstimada": 5,
        "piezasPorLata": 15,
        "activo": true,
        "createdAt": "2026-07-26T03:36:43.864Z",
        "ingredientesAdicionales": []
    },
    {
        "id": "24ea552f-4a0d-4281-aa8e-3f3a868b26f6",
        "nombre": "Palito queso",
        "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f53",
        "pesoUnitarioGr": 80,
        "panesPorArroba": 234,
        "precioVentaUnitario": 2000,
        "costoUnitario": 416.105084917126,
        "margenPorcentaje": 79,
        "mermaEstimada": 5,
        "piezasPorLata": 20,
        "activo": true,
        "createdAt": "2026-07-26T03:36:24.018Z",
        "ingredientesAdicionales": []
    },
    {
        "id": "d75ca806-dc19-4b54-8947-6750be41b316",
        "nombre": "Jamon y queso",
        "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f53",
        "pesoUnitarioGr": 80,
        "panesPorArroba": 234,
        "precioVentaUnitario": 2500,
        "costoUnitario": 416.105084917126,
        "margenPorcentaje": 83,
        "mermaEstimada": 5,
        "piezasPorLata": 20,
        "activo": true,
        "createdAt": "2026-07-26T03:37:17.333Z",
        "ingredientesAdicionales": []
    },
    {
        "id": "1ec1885f-5b1e-44cb-94dc-b71177a42ca6",
        "nombre": "chicharron bocadillo",
        "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f53",
        "pesoUnitarioGr": 80,
        "panesPorArroba": 234,
        "precioVentaUnitario": 1000,
        "costoUnitario": 416.105084917126,
        "margenPorcentaje": 58,
        "mermaEstimada": 5,
        "piezasPorLata": 40,
        "activo": true,
        "createdAt": "2026-07-26T03:37:48.266Z",
        "ingredientesAdicionales": []
    },
    {
        "id": "82f79a71-6916-4c18-8a20-f6994160ef90",
        "nombre": "Mil Hoijas",
        "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f53",
        "pesoUnitarioGr": 80,
        "panesPorArroba": 234,
        "precioVentaUnitario": 3000,
        "costoUnitario": 416.105084917126,
        "margenPorcentaje": 86,
        "mermaEstimada": 5,
        "piezasPorLata": 15,
        "activo": true,
        "createdAt": "2026-07-26T03:38:26.301Z",
        "ingredientesAdicionales": []
    },
    {
        "id": "4e1a6982-ff1a-4880-9601-34a8ca4c5cb3",
        "nombre": "Corazon",
        "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f52",
        "pesoUnitarioGr": 80,
        "panesPorArroba": 221,
        "precioVentaUnitario": 1500,
        "costoUnitario": 324.51427844372336,
        "margenPorcentaje": 78,
        "mermaEstimada": 5,
        "piezasPorLata": 15,
        "activo": true,
        "createdAt": "2026-07-27T16:13:45.407Z",
        "ingredientesAdicionales": []
    },
    {
        "id": "27a64c47-ddcb-432a-b6af-2e3e64e76775",
        "nombre": "Piñitaa",
        "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f52",
        "pesoUnitarioGr": 80,
        "panesPorArroba": 221,
        "precioVentaUnitario": 0,
        "costoUnitario": 324.51427844372336,
        "margenPorcentaje": 0,
        "mermaEstimada": 5,
        "piezasPorLata": 50,
        "activo": true,
        "createdAt": "2026-07-27T16:15:20.275Z",
        "ingredientesAdicionales": []
    },
    {
        "id": "10f3deda-2fb8-4e64-93f2-4dbf28f08756",
        "nombre": "trenzado",
        "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f52",
        "pesoUnitarioGr": 75,
        "panesPorArroba": 236,
        "precioVentaUnitario": 2000,
        "costoUnitario": 304.2321360409906,
        "margenPorcentaje": 85,
        "mermaEstimada": 5,
        "piezasPorLata": 15,
        "activo": true,
        "createdAt": "2026-07-27T16:28:03.416Z",
        "ingredientesAdicionales": []
    },
    {
        "id": "1710eabe-5285-413f-8091-1a22abb87901",
        "nombre": "Pan de la Abuela",
        "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f52",
        "pesoUnitarioGr": 105,
        "panesPorArroba": 169,
        "precioVentaUnitario": 2500,
        "costoUnitario": 425.92499045738685,
        "margenPorcentaje": 83,
        "mermaEstimada": 5,
        "piezasPorLata": 30,
        "activo": true,
        "createdAt": "2026-07-27T16:28:30.754Z",
        "ingredientesAdicionales": []
    },
    {
        "id": "98255e23-9c68-486a-b9cb-6bdcd57cb999",
        "nombre": "Torta de Un 1/4",
        "formulacionId": "7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f54",
        "pesoUnitarioGr": 1400,
        "panesPorArroba": 14,
        "precioVentaUnitario": 20000,
        "costoUnitario": 6709654.885928976,
        "margenPorcentaje": -33448,
        "mermaEstimada": 5,
        "piezasPorLata": 1,
        "activo": true,
        "createdAt": "2026-07-31T05:21:37.270Z",
        "ingredientesAdicionales": []
    }
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
