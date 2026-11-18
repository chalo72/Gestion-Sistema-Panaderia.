# Análisis Director — Nómina cobertura / extras / Pedido 36 / Mayoreo
Fecha: 2026-10-18 · Fuente: código real en `src/` · Sin inventar módulos

## A) Cobertura cuando NO viene el panadero

### Números base (datos del Director)
| Rol | Mes | Quincena | Día (÷30) |
|-----|-----|----------|-----------|
| Ayudante | $800.000 | $400.000 | **$26.667** |
| Panadero | $1.600.000 | $800.000 | **$53.333** |
| Diferencial (panadero − ayudante) | — | — | **$26.666** |

Producción típica (Director): con panadero ~3–3,5 arrobas; con ayudante ~1,5–2,5 (siempre menos).
Factor medio de producción ≈ 2,0 / 3,25 ≈ **0,62**.

### Fórmula recomendada: diferencial × factor producción (con tope)
```
pago_día_cobertura = día_ayudante + (día_panadero − día_ayudante) × factor
tope = día_panadero   (nunca pagar más que el panadero ese día)
```

**Ejemplo 1 día de cobertura (factor 0,62):**
- $26.667 + $26.666 × 0,62 = **≈ $43.200** ese día
- Tope: $53.333 → el ejemplo queda debajo del tope

**Si en una quincena cubre 3 días:**
- Extra por cobertura: 3 × ($43.200 − $26.667) ≈ **$49.600**
- Su quincena base $400.000 + $49.600 ≈ **$449.600** (más el otro ayudante que entra esos días a tarifa normal)

**Por qué es justo:**
- No le pagan el día completo de panadero ($53.333) porque produce menos.
- Tampoco se queda solo en $26.667: ese día hace el rol de horno + responsabilidad.
- El diferencial ($26.666) se paga en proporción a lo que rinde (~62%), no al 100%.
- El **otro ayudante** se paga aparte a tarifa de ayudante (no mezcla).

**Alternativa simple (si quieren redondo):**
- Extra fijo por día de cobertura: **$15.000 a $18.000** (≈ 56–67% del diferencial).
- O: pagar **80% del día panadero** = $42.666 (casi igual al ejemplo).

### Cómo meterlo HOY en la app (sin código nuevo)
En **Nómina → Liquidar → card del ayudante**:
1. Campo **Ajuste manual ($)**: sumar el extra de cobertura (ej. 3 × $16.533 ≈ $49.600).
2. O **Días de MÁS** con valor-día editado (menos claro para este caso).
3. Anotar en observaciones: “Cobertura horno días X,Y,Z · factor 0,62”.

Falta en app: botón/tipo “Cobertura panadero” con fórmula fija (ver mapa).

---

## B) Días de más / horas extras (diciembre)

### Lo que YA existe en Nómina
- `diasExtra` / `diasMenos` / `valorDia` (= salario mensual ÷ 30, editable)
- Botón “Sumar como días de más” si vino fuera de horario
- Ajuste manual en $

### Valor hora (lógica razonable Colombia — **consultar contador**)
Supuesto de jornada: ~8 h/día, ~30 días de base salarial (como usa la app: ÷30).

| Concepto | Fórmula | Ejemplo vendedora $800.000/mes |
|----------|---------|--------------------------------|
| Valor día | sueldo ÷ 30 | $26.667 |
| Valor hora ordinaria | sueldo ÷ 30 ÷ 8 | **$3.333** |
| Extra diurna (+25%) | hora × 1,25 | **$4.167** |
| Extra nocturna (+75%) | hora × 1,75 | **$5.833** |
| Recargo nocturno ordinario (+35%) | hora × 1,35 | $4.500 |

**SUPUESTO / verificar con contador (Ley 2466 / CST art. 168 y cambios 2025–2027):**
- Dominical/festivo: recargo en transición (80% en 2025 → 90% 2026 → 100% 2027) **además** del pago del trabajo y del descanso — no simplificar a “doble” sin asesoría.
- Límite legal de extras: máx. 2 h/día y 12 h/semana (Circular MinTrabajo 101/2025) — **SUPUESTO de lectura; confirmar**.

### Cómo meterlo sin enredo
1. **Día completo extra** (fuera de quincena / domingo trabajado acordado): usar `Días de MÁS` × valor día.
2. **Horas sueltas**: convertir a dinero = horas × valor_hora × (1 + recargo) y poner en **Ajuste manual**, con nota “HE diurnas 4h × $4.167”.
3. No mezclar el mismo día como “día de más” Y “horas extras” a la vez.

Falta: calculadora de horas extras con % legales dentro de Nómina.

---

## C) Pedido de la 36

**Búsqueda en código (App, Sidebar, PrePedidos, GeneradorPedidoInsumos, Producción): NO hay módulo ni texto “pedido 36” / “la 36”.**

Existe lo cercano:
- `PrePedidos` = órdenes de compra a proveedores
- `GeneradorPedidoInsumos` = proyecta insumos desde arrobas/formulaciones
- Accesos panadero: Producción / Libreta / Modo Ayudante (no “la 36”)

Para implementarlo haría falta: definir qué es “la 36” (proveedor, plantilla de insumos, WhatsApp…) + menú en panadero/gerencia → casi seguro toca **App.tsx / Sidebar** → **AUTORIZO**.

---

## D) Ventas al Mayor

**Existe:** página `Mayoristas.tsx`, menú “Ventas al Mayor”, clientes, precios, mini-POS, rutas (`RutasReparto`).

**Antes del cambio de filtros:** mostraba casi todos los productos y casi todos los clientes (excepto `trabajador`).

**Avance seguro propuesto (solo `Mayoristas.tsx`, no protegidos):**
- Toggle “Solo producción propia” (`tipo === 'elaborado'`)
- Toggle “Solo mayoreo/tienda” (tipos mayorista/tienda/distribuidor/vendedor/empresa)
- Persistidos en localStorage; se pueden apagar.

---

## Mapa app: existe / falta

| Tema | Existe | Falta |
|------|--------|-------|
| A Cobertura | Nómina + ajuste + días extra | Tipo “cobertura” con fórmula/factor |
| B Extras día | `diasExtra`, valor día | — (usable ya) |
| B Horas extras % | — | UI + % legales + registro |
| C Pedido 36 | — | Definición negocio + módulo + menú (AUTORIZO) |
| D Mayoreo | Módulo completo | Filtros producción/clientes (avance en Mayoristas) |

## AUTORIZO exacto si se quiere más
- `App.tsx` — ruta/menú Pedido 36, acceso panadero
- `AuthContext` / permisos — si se crea permiso nuevo
- `database.ts` / `supabase-db.ts` — si se persiste cobertura o pedido 36 en DB
- `package.json` / vite / tailwind — no hace falta para esto

Archivos tocables sin AUTORIZO para A/B UI: `Nomina.tsx`, `Mayoristas.tsx`, docs.
