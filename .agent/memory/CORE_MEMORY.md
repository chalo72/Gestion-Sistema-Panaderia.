# 🧠 CORE MEMORY BANK
> Fuente de verdad persistente para **PriceControl Pro** — Gestión de Precios y Proveedores.

## 🏛️ Principios Inquebrantables (The Law)
1. Antes de escribir/modificar cualquier archivo, realizar revisión final exhaustiva.
2. Sobrescribir archivos directamente, no crear duplicados.
3. NUNCA usar contenido truncado para reescribir archivos.
4. Todo el código debe compilar limpio (`tsc -b && vite build` exit 0).
5. Idioma principal: Español (excepto términos técnicos estándar).

## 👤 Preferencias del Usuario (User Profile)
* **Estilo de Código**: Functional React (Hooks), TypeScript estricto
* **UI/UX**: Design system propio con glassmorphism, dark mode, gradientes premium
* **Restricciones**: No usar TailwindCSS v3 (usa CSS propio + shadcn/ui)
* **Idioma**: Español en toda la interfaz y documentación

## 🏗️ Decisiones Arquitectónicas (Tech Stack)
* **Frontend**: React 19 + Vite 7 + TypeScript
* **Estado**: Custom hook `usePriceControl` (centralizado)
* **Estilos**: CSS propio + shadcn/ui (Radix primitives)
* **Base de datos**: IndexedDB (idb) — Schema v5
* **Auth**: Context-based con roles y permisos granulares (`useCan`)
* **Stores DB**: productos, proveedores, precios, historial, alertas, prepedidos, configuracion, inventario, movimientos, recepciones

## 📦 Módulos Implementados
1. **Productos** — CRUD completo con categorías
2. **Proveedores** — CRUD + historial de precios
3. **Precios** — Comparación multi-proveedor, mejor precio
4. **Alertas** — Notificaciones de cambios de precio
5. **Pre-Pedidos** — Borradores, confirmación, presupuesto
6. **Inventario** — Stock, ajustes, movimientos
7. **Recepciones** — Escaneo facturas, checklist, validación
8. **Reabastecimiento Inteligente** — Auto-generación de pedidos por stock bajo
9. **Dashboard** — Estadísticas, KPIs, alertas recientes
10. **Configuración** — Moneda, márgenes, categorías

## 🚫 Anti-Patrones (Errores a evitar)
* No usar `getMejorPrecio` antes de declararlo (hoisting de `const` no existe)
* No duplicar imports (e.g., `TrendingUp` importado dos veces)
* No olvidar pasar props requeridas por interfaces (e.g., `formatCurrency` en Inventario)
* No usar `_variable` en destructuring sin alias syntax (`prepedidos: _prepedidos`)
* Los archivos truncados NUNCA deben usarse para reescribir
