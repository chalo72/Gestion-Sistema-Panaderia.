# Mayoreo / Tiendas / Vendedor — Mapa y dónde entrar

Fecha evidencia: 2026-10-17 · Repo activo Dulce Placer · **Sin inventar funciones que no están en código.**

## Dónde entrar (flujo mínimo)

1. Menú **Costos y Finanzas → Ventas al Mayor** (`mayoristas`).
2. Pestaña / sección de **clientes y precios** (ticket POS mayorista).
3. Componente **Rutas de reparto** (dentro de Mayoristas): Despachos → Rutas → Tiendas · Análisis → Vendedores.
4. Cobros/saldos: **Créditos a Clientes** (comentario explícito en código: Mayoristas = vender; Créditos = cobrar).

Flujo operativo mínimo recomendado hoy:

1. Registrar cliente tipo **mayorista** (CRM Clientes o desde Mayoristas) con dirección y margen si aplica.
2. Ajustar lista de precios mayoreo (pestaña precios / overrides).
3. Armar **despacho**: carga → salir a ruta → en cada parada dejar / recoger / cobrar → conteo de regreso → liquidar.
4. Revisar semáforo de tiendas y alertas de vendedor.

## Mapa existe / medio / falta

| Capacidad | Estado | Evidencia (archivos) |
|-----------|--------|----------------------|
| Clientes + precio mayoreo | **MEDIO** | `ClienteTipo` = particular\|empresa\|frecuente\|mayorista (`src/types/index.ts`). `margenPersonalizado`, `descuentoMayorista`. UI Clientes + módulo `src/pages/Mayoristas.tsx`. Labels legacy `tienda`/`vendedor`/`distribuidor` en Mayoristas (compat), **no** son tipos oficiales del CRM. |
| Preventa / pedido del día (a tiendas) | **MEDIO** | Tickets pendientes localStorage en `Mayoristas.tsx` (`ag_tickets_pendientes`). **No** es preventa de ruta del día. `PrePedidos` = órdenes de **compra a proveedores**, no venta a tiendas. |
| Carga que lleva el vendedor | **EXISTE** | `src/lib/rutas-reparto.ts` (`LineaCarga`, `Despacho`), UI `src/components/mayoristas/RutasReparto.tsx` (sale a ruta descuenta stock). Tests: `src/lib/rutas-reparto.test.ts`. |
| Venta/cobro + devolución | **MEDIO** | Dejado/recogido + motivos `sobrante`/`cambio`/`danado`; crédito a Créditos Clientes al liquidar. Alertas por % devolución (12% / 25%) en análisis. **Tope duro 15%** al liquidar: por tienda del despacho, `recogido/dejado` no puede pasar de 15% (`TOPE_DEVOLUCION_PCT` en `rutas-reparto.ts`; bloquea botón Liquidar + toast). |
| Rutas / reparto / tiendas / vendedor (operativo) | **EXISTE** | `RutaReparto`, `analizarTiendas`, `analizarVendedores`, `sugerirCargaTienda`, Maps link. Persistencia LS + backup nube (`dp_rutas_reparto`, `dp_despachos_reparto`). |
| Rol app vendedor (permisos limitados a ruta) | **MEDIO** | Rol `VENDEDOR` aparece en Sidebar (precios). Menú mayoristas exige `VER_FINANZAS`. `TrabajadorRol` incluye `vendedor`/`repartidor`. **No** hay vista dedicada “solo despacho” para vendedor. |
| Comisión automática | **FALTA** | Sin evidencia de cálculo/pago de comisión por despacho o venta mayoreo en `rutas-reparto` / Mayoristas. Manual posible vía Nómina/gastos (fuera de este mapa). |
| Consignación explícita | **MEDIO** | Modelo deja/recoge se comporta como consignación operativa; no hay módulo aparte llamado “consignación”. |
| Esquema mixto de pago | **MEDIO** | Efectivo/Nequi/transferencia en ruta; crédito residual a Créditos. POS mayorista: efectivo/nequi/transferencia/crédito. |
| ≥12–15 tiendas (negocio) | **N/A código** | Meta operativa del Director; el código soporta N tiendas vía clientes en rutas. Contar tiendas reales = dato de negocio, no de repo. |

## Orden de construcción (recomendado al Director)

1. ~~Clientes tienda + precio mayoreo~~ → **refinar lo existente** (CRM + Mayoristas).
2. Preventa del día ligada a ruta (hoy solo tickets sueltos).
3. Carga vendedor → **ya existe**; endurecer UX si hace falta.
4. ~~Tope de devolución 15% al liquidar~~ → **hecho** (duro por tienda/parada del despacho).
5. Rol vendedor acotado (probablemente toca `App.tsx` / `AuthContext` → **AUTORIZO**).
6. Comisión (manual primero).

## Protegidos (no tocar sin AUTORIZO)

`App.tsx`, `main.tsx`, `database.ts`, `supabase-db.ts`, `AuthContext`, `usePriceControl`, vite/tailwind/`package.json`.
