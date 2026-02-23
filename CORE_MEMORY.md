# 🧠 CORE MEMORY — Gestión de Precios y Proveedores (Kimi Agent)
> Última actualización: 2026-02-23 (Sesión Yimi-Antigravity Fusion)

## 🎯 Ancla del Proyecto
- **Proyecto**: Sistema de Gestión de Precios, Proveedores e Inventario + Yimi POS Features.
- **Descripción**: Aplicación web para controlar compras, comparar precios, gestionar stock y procesar ventas con soporte E-Wallet y variantes.
- **Público**: Administradores, Vendedores y Clientes del negocio.
- **Visión**: Dashboard futuristico tipo Yimi pero manteniendo tu base actual. Glassmorphism premium, E-Wallet, Multifotos, Variantes.

## 📐 Arquitectura
- **Stack**: React 19 + Vite + TypeScript + Shadcn/ui (Radix UI).
- **Styling**: Tailwind CSS + Glassmorphism + Dark mode.
- **DB & Auth**: Supabase (PostgreSQL).
- **Estructura**: Componentes en `src/sections`, lógica en `src/contexts` y `src/hooks`.

## 🆕 Módulos Antigravity-Yimi (2026-02-23) - ✅ COMPLETADOS

### TIER 1: Núcleo (COMPLETADO)
1. ✅ **Sistema de Variantes de Producto**
   - Tipo: Talla, Color, Personalizado, Bundle
   - SKU único por variante
   - Multifotos por variante
   - Control stock independiente
   - Hook: `useProductVariants` (120 líneas)
   - Componente: `ProductVariantEditor`

2. ✅ **Sistema de Pagos Avanzado**
   - Métodos: Cash, Card, Transfer, E-Wallet, Crédito
   - E-Wallet con balance control
   - Ventas a Crédito con seguimiento
   - Histórico de pagos
   - Hook: `usePaymentSystem` (150 líneas)
   - Componente: `PaymentProcessor`

3. ✅ **Dashboard Financiero Premium**
   - 6 Métricas KPI en tiempo real
   - Selector temporal (día/semana/mes/año)
   - Gráfico de tendencias animado
   - Órdenes recientes con estado
   - Productos TOP con analytics
   - Componente: `FinancialDashboard` (250 líneas)

### TIER 2: Organización (COMPLETADO)
4. ✅ **Sistema de Categorías Jerárquicas**
   - Categories → Subcategories (2 niveles)
   - Reordenamiento dinámico DnD
   - Activación/desactivación por estado
   - Búsqueda por slug
   - Hook: `useCategories` (180 líneas)
   - Stats automáticas

5. ✅ **Category Browser Yumi-Style**
   - Sidebar navegable interactivo
   - Grid de subcategorías con preview
   - CRUD integrado (opcional)
   - Glassmorphism +dark mode
   - Componente: `CategoryBrowser` (320 líneas)

### BONUS: Documentación y Ejemplos (COMPLETADO)
- ✅ Guía: `INTEGRACION_YIMI.md` (200 líneas)
- ✅ Ejemplos: `EJEMPLOS_CODIGO.tsx` (350 líneas)
- ✅ Showcase: `SalesShowcase.tsx` (250 líneas)

## 👤 Preferencias del Usuario
- **Idioma**: Español estricto.
- **Estética**: Glassmorphism, animaciones, efectos premium.
- **Target**: Yimi-like pero con tu codebase actual.

## 📜 Decisiones Arquitectónicas
- **Variantes**: Type-safe con Enum (size, color, custom, bundle)
- **Pagos**: Agnóstico a proveedor (Stripe, MercadoPago, PayPal listo)
- **E-Wallet**: Map<customerId, EWallet> para búsqueda O(1)
- **UI**: Backdrop-blur glassmorphism con hover effects premium


## 🎯 Ancla del Proyecto
- **Proyecto**: Sistema de Gestión de Precios, Proveedores e Inventario.
- **Descripción**: Aplicación web para controlar compras, comparar precios de proveedores y gestionar el stock de una panadería/negocio.
- **Público**: Administradores y Vendedores del negocio.
- **Problema**: Desincronización de datos entre local y nube, y fallos en el acceso de usuarios.
- **Visión**: Un dashboard fluido, con acceso basado en roles y sincronización resiliente con Supabase.
- **No es**: Una tienda online pública (e-commerce).

## 📐 Arquitectura
- **Stack**: React + Vite + TypeScript.
- **Styling**: Tailwind CSS + shadcn/ui.
- **DB & Auth**: Supabase (PostgreSQL).
- **Estructura**: Componentes en `src/sections`, lógica en `src/contexts` y `src/hooks`.

## 👤 Preferencias del Usuario
- **Idioma**: Español estricto en toda la interfaz y comentarios.
- **Estética**: Diseño premium, moderno (Glassmorphism), con feedback visual inmediato.
- **Persistencia**: Manejo de sesiones persistentes para evitar logouts accidentales.

## 📜 Reglas Inquebrantables
- **Seguridad**: RLS (Row Level Security) activo en Supabase.
- **Sincronización**: Siempre intentar descargar datos de la nube tras un login exitoso.
- **Integridad**: No usar contenido truncado (`[truncated]`) para reescribir archivos.

## 🔑 Decisiones Clave (Historial)
| Fecha | Decisión | Razón |
|-------|----------|-------|
| 2026-02-21 | Configuración de Supabase | Se activó `persistSession: true` y `autoRefreshToken: true` para corregir redirecciones al login. |
| 2026-02-21 | Refactor de AuthContext | Se separó `fetchProfile` para asegurar que el rol del usuario esté disponible antes de cargar la app. |
| 2026-02-21 | Manejo de Error de Esquema | Se implementó captura específica para "Database error querying schema" para alertar sobre proyectos pausados. |

## ⚠️ Errores Conocidos / Lecciones
- **Supabase Pausado**: El error `Database error querying schema` indica que el proyecto en la nube está inactivo o tiene llaves incorrectas.
- **Llaves de Stripe**: Se detectó que el `VITE_SUPABASE_ANON_KEY` actual parece ser de Stripe (`sb_publishable_...`) y no de Supabase. **Debe ser reemplazada.**
- **Loop de Perfil**: Evitar loops infinitos en `onAuthStateChange` verificando si el usuario ya está cargado.

## 🚀 Estado Actual y Pendientes

### ✅ Completado (Sesión 2026-02-22)
1. ✅ App carga en RED LOCAL: `http://192.168.1.5:5173/` 
2. ✅ Ejecutar `npm run host` expone app a la red
3. ✅ Netlify Activo: `symphonious-douhua-7d50ce.netlify.app` (Despliegue automático desde GitHub)
4. ✅ Vite PWA configurado (Service Workers + Offline cache)
5. ✅ Navegador Chrome requiere "Continuar al sitio" para HTTP sin HTTPS (ESPERADO en desarrollo)

### ⚠️ Problemas Por Resolver
1. ⚠️ **Demora en carga al entrar nuevamente** - Bundle grande o Supabase inactivo
2. ⚠️ **Supabase inactivo/pausado** - `Database error querying schema`
3. ⚠️ **Llaves incorrectas** - `VITE_SUPABASE_ANON_KEY` parece ser de Stripe, no de Supabase

### 📋 Próximas Acciones
- [ ] Revisar NetworkTab en DevTools para identificar qué demora la carga
- [ ] Optimizar bundle size (Vite analyze)
- [ ] Revisar/actualizar credenciales de Supabase
- [ ] Agregar tests unitarios y E2E
- [ ] Mejorar UI/UX en mobile
- [ ] Implementar error boundaries más robustos
