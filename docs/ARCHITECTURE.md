# 🏗️ Arquitectura — PriceControl Pro

Documento de decisiones técnicas y flujo de datos.

---

## Stack

| Capa | Tecnología |
|------|------------|
| Framework | React 19 + TypeScript |
| Build | Vite 7 |
| Estilos | CSS custom (Antigravity Design System) + shadcn/ui |
| Componentes UI | shadcn/ui (Radix primitives) + Lucide Icons |
| Estado | Custom hook `usePriceControl` + `useContext` (AuthContext) |
| Base de Datos | IndexedDB via `idb` (Schema v5) |
| Notificaciones | `sonner` |
| Deploy | Vercel / Netlify (Zero-Config) |
| CI/CD | GitHub Actions |

---

## Estructura de Carpetas

```
app/src/
├── components/          ← UI reutilizables (Sidebar, PageTransition)
│   └── ui/              ← shadcn/ui primitivos
├── contexts/            ← AuthContext (login/roles/permisos)
├── hooks/               ← usePriceControl (estado central + lógica CRUD)
├── lib/                 ← database.ts, featureFlags, utils
├── sections/            ← Vistas principales (lazy-loaded)
│   ├── Dashboard.tsx
│   ├── Login.tsx
│   ├── Productos.tsx
│   ├── Proveedores.tsx
│   ├── Precios.tsx
│   ├── Inventario.tsx
│   ├── Recepciones.tsx
│   ├── PrePedidos.tsx
│   ├── Alertas.tsx
│   ├── Configuracion.tsx
│   └── Usuarios.tsx
├── types/               ← TypeScript interfaces (Producto, Proveedor, etc.)
├── App.tsx              ← Orquestador principal
└── index.css            ← Design system completo
```

---

## Flujo de Datos

```
usePriceControl (hook centralizado)
  ├── IndexedDB ←→ Estado React (productos, proveedores, precios, etc.)
  ├── Funciones CRUD + Lógica (addProducto, generarSugerenciasPedido...)
  └── Getters (getMejorPrecio, getEstadisticas...)

App.tsx (orquestador)
  ├── AuthContext (login/logout/permisos vía useCan)
  ├── usePriceControl() → datos + funciones
  ├── Sidebar (navegación)
  ├── PageTransition (animación entre vistas)
  └── Sections (lazy-loaded, reciben props del hook)
```

---

## Stores IndexedDB (Schema v5)

| Store | Clave | Descripción |
|-------|-------|-------------|
| `productos` | `id` | Catálogo de productos |
| `proveedores` | `id` | Proveedores registrados |
| `precios` | `id` | Precios por proveedor/producto |
| `historial` | `id` | Historial de cambios de precio |
| `alertas` | `id` | Alertas de precio |
| `prepedidos` | `id` | Pre-pedidos (borradores/confirmados) |
| `configuracion` | `id` | Configuración del sistema |
| `inventario` | `productoId` | Stock actual y mínimo |
| `movimientos` | `id` | Log de movimientos de stock |
| `recepciones` | `id` | Recepciones de mercancía |

---

## Módulos Funcionales

| Módulo | Funcionalidad |
|--------|--------------|
| 📊 Dashboard | KPIs, alertas recientes, top productos |
| 📦 Productos | CRUD + categorías + precios por proveedor |
| 🏪 Proveedores | CRUD + historial + valoración |
| 💰 Precios | Comparativa multi-proveedor, mejor precio |
| 🔔 Alertas | Cambios de precio, stock bajo |
| 📋 Pre-Pedidos | Borradores, presupuesto, confirmación |
| 📊 Inventario | Stock real-time, ajustes, movimientos |
| 📥 Recepciones | Escaneo facturas, checklist, auto-stock |
| 🪄 Reabast. Inteligente | Auto-pedidos por stock bajo |
| ⚙️ Configuración | Moneda, márgenes, categorías |
| 👥 Usuarios | Roles y permisos granulares |

---

## Patrones de Optimización

| Patrón | Aplicación |
|--------|-----------|
| Lazy loading | 11 secciones con `React.lazy()` + `Suspense` |
| `useMemo` | Estadísticas, filtros, conteos |
| `useCallback` | Todas las funciones en `usePriceControl` |
| CSS animations | Sin dependencias JS de animación |
| `will-change` | Solo en elementos activamente animados |
| Code-splitting | Cada sección en su propio chunk |

---

## Feature Flags

| Flag | Estado | Descripción |
|------|--------|-------------|
| `DARK_MODE` | ✅ On | Modo oscuro completo |
| `ORGANIC_UI` | ✅ On | Componentes orgánicos |
| `PAGE_TRANSITIONS` | ✅ On | Transiciones animadas |
| `ADVANCED_ANALYTICS` | ❌ 25% rollout | Dashboard avanzado |
| `EXPORT_PDF` | ❌ Admin only | Exportar a PDF |
| `SMART_REPLENISHMENT` | ✅ On | Reabastecimiento inteligente |
