# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Comandos Esenciales

Todos los comandos se ejecutan desde el directorio `app/`.

```bash
# Desarrollo
npm run dev          # Servidor local en http://localhost:5173
npm run host         # Servidor accesible desde red local (Samsung A23, etc.)

# Build
npm run build        # Genera dist/ con PWA (incrementa versión automáticamente)
npm run preview      # Sirve el build de producción en localhost:5173
npm run preview:host # Sirve el build accesible desde red local

# Tests unitarios (Vitest)
npm run test                        # Ejecuta todos los tests una vez
npm run test:watch                  # Modo watch interactivo
npm run test:coverage               # Cobertura (solo src/lib/** y src/hooks/**)
npx vitest run src/lib/database.ts  # Ejecutar test de un archivo específico

# Tests E2E (Playwright — requiere app corriendo)
npm run test:e2e      # Ejecuta suite E2E en Chromium
npm run test:e2e:ui   # Modo UI visual de Playwright
# Los tests E2E leen credenciales de .env.e2e (no se sube al repo)

# Calidad
npm run lint          # ESLint sobre todo el proyecto
```

---

## Arquitectura del Sistema

### Flujo de Datos (Dual-Layer: Local + Cloud)

```
Usuario → Página → usePriceControl (hook central)
                        ↓
              IDatabase (interfaz)
             /                    \
  IndexedDBDatabase          SupabaseDatabase
  (offline-first)            (sincronización cloud)
        ↓                          ↓
  PriceControlDB v14         Supabase PostgreSQL
  (10+ stores IndexedDB)     (12 tablas RLS)
```

**Regla crítica:** `LOCAL SIEMPRE GANA`. En `syncCloudToLocal`, la nube solo agrega lo que NO existe localmente. Nunca sobreescribe datos locales de proveedores, productos, precios, prepedidos, recepciones, gastos, ahorros ni configuración.

### Hook Central: `usePriceControl`

`src/hooks/usePriceControl.ts` (~1500 líneas) es el estado global de la app. Orquesta:
- Estado: `productos`, `proveedores`, `precios`, `prepedidos`, `configuracion`, `recetas`
- Sub-hooks delegados: `useFinanzas`, `useProduccionHook`, `useVentas`, `useInventario`
- Toda página recibe sus datos y funciones como props desde `App.tsx`

### Enrutamiento

No hay React Router. `App.tsx` usa un `switch` sobre `currentView: ViewType` (string enum). Las páginas se montan/desmontan según esta variable. Las páginas "pesadas" usan `React.lazy()`.

### Autenticación

`AuthContext.tsx` maneja login, roles y permisos. Los usuarios se persisten en `localStorage` bajo la clave `pricecontrol_local_user_list`. La sesión dura 30 días (`SESSION_MAX_MS`). Hay 4 roles: `ADMIN`, `GERENTE`, `COMPRADOR`, `VENDEDOR`.

### Base de Datos Local (IndexedDB)

- Nombre: `PriceControlDB` — versión actual: **v14**
- Al agregar un nuevo store, incrementar `DB_VERSION` en `src/lib/database.ts`
- La interfaz `IDatabase` define el contrato; tanto `IndexedDBDatabase` como `SupabaseDatabase` la implementan
- El singleton exportado es `db` (instancia de `IndexedDBDatabase` con fallback a Supabase)

### PWA y Service Worker

- `registerType: 'autoUpdate'` + `skipWaiting: true` + `clientsClaim: true` — **intencional**, no modificar
- Para forzar que los usuarios vean cambios: usar `ACTUALIZAR_APP.bat` (no `INICIAR_SERVIDOR.bat`)
- `version.json` siempre se sirve desde red (`NetworkOnly`) para detectar nuevas versiones

---

## Convenciones Críticas

### Cálculos de Precio
- **Markup** (para precio auto): `margen = (precioVenta - costo) / costo × 100`
- **Gross Margin** (para reportes de utilidad): `margen = (precioVenta - costo) / precioVenta × 100`
- No mezclarlos. Ver `usePriceControl.ts:920` y `SK-20260327-002`.
- Todo subtotal/total debe usar `Math.round(valor * 100) / 100` antes de guardar.
- Siempre validar `parseFloat` con `isNaN` y `<= 0` antes de guardar un precio.

### Categorías
- **NUNCA** hardcodear categorías. Siempre leer de `configuracion.categorias` (viene de IndexedDB/Supabase).
- La fuente de verdad de categorías es `CATEGORIAS_DEFAULT` en `src/lib/seed-data.ts`, pero el usuario puede personalizarlas.

### Tailwind CSS Dinámico
- Las clases dinámicas como `col-span-${n}` o `grid-cols-${n}` son purgadas por Tailwind.
- Solución: usar `safelist` en `tailwind.config.js`, mapeo estático, o `style={{ gridTemplateColumns: ... }}`.

### Radix UI Select
- Cuando el mismo componente `<Select>` cambia de propósito (distinto `destino`), usar `key={`select-${destino}`}` para forzar re-montaje. Sin esto, Radix cachea la selección anterior.

---

## Archivos Protegidos

Antes de editar cualquier archivo verificar `LOCKED_RESOURCES.md` en la raíz del repo.
Los archivos críticos requieren escribir **"AUTORIZO"** explícitamente antes de modificarlos:

- `src/App.tsx`, `src/main.tsx`, `src/index.css`
- `src/contexts/AuthContext.tsx`
- `src/hooks/usePriceControl.ts`
- `src/lib/database.ts`, `src/lib/supabase-db.ts`
- `vite.config.ts`, `tailwind.config.js`, `package.json`

---

## Variables de Entorno

| Variable | Uso |
|----------|-----|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clave pública Supabase |
| Credenciales E2E | En `.env.e2e` (no se versiona) |

El archivo `src/lib/supabase.ts` inicializa el cliente con estas variables.
