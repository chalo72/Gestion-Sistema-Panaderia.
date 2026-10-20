# 🧾 Nómina — Bugs Encontrados y Correcciones Aplicadas

> Autor: Agente IA · Dulce Placer ERP v5.1.5  
> Fecha: 2026-10-15  
> Archivo analizado: `src/pages/Nomina.tsx` (~2191 líneas)

---

## 📋 Resumen Ejecutivo

El usuario reportó dos problemas en el módulo de Nómina:

1. **Los días no trabajados NO se restaban del total a pagar** (ej. Daniela vino lun/mar/jue/vie/sáb/dom pero no se descontaba el miércoles).
2. **Los créditos/préstamos no se mostraban ni descontaban** visiblemente al calcular el sueldo.

---

## 🐛 Bug 1 — Días faltados no se aplicaban automáticamente

### Causa raíz

En `src/pages/Nomina.tsx`, línea ~395 (antes de la corrección):

```typescript
// ANTES — nunca restaba nada si el usuario no llenaba el campo manualmente:
const diasMenosAplicados = modoCalculo === 'estricto_asistencia'
  ? 0
  : Math.max(0, diasMenos[t.id] ?? 0);
//                                   ↑ si no se editó el campo, era SIEMPRE 0
```

El sistema **sí calculaba** `diasFaltados` (días esperados − días cumplidos), pero solo lo usaba para mostrar un badge rojo ("X faltas"). **No lo aplicaba** al cálculo del sueldo a menos que el usuario escribiera manualmente el número en el input de "Días que NO vino".

- **Modo `quincena_completa`** (predeterminado): paga la quincena completa sin deducir faltas.
- **Modo `estricto_asistencia`**: descuenta por proporción.

El usuario veía "X faltas" en el badge pero el total seguía siendo $325 o el valor completo de la quincena.

### Corrección aplicada

```typescript
// DESPUÉS — auto-aplica los días faltados detectados cuando el usuario no editó el campo:
const diasMenosAplicados = modoCalculo === 'estricto_asistencia'
  ? 0
  : Math.max(0, diasMenos[t.id] !== undefined
      ? diasMenos[t.id]     // ← el usuario escribió un número → se usa ese
      : diasFaltados);      // ← no editado → se usan los días detectados automáticamente
```

### Cambios de UI complementarios

- El **placeholder del input** "Días que NO vino" ahora muestra la cantidad detectada (en vez de "0").
- Se añadió un mensaje de advertencia amarillo cuando hay faltas auto-aplicadas:  
  `⚠️ Detectamos X faltas — aplicadas automáticamente. Escribe 0 para no descontar.`
- El usuario puede **sobreescribir** el valor en cualquier momento (poniendo 0 para no descontar, o cualquier número).

### Ejemplo práctico (Daniela)

| Concepto | Antes | Después |
|---|---|---|
| Quincena base (salario $650/mes) | $325 | $325 |
| − 1 día que no vino ($21.67) | $0 (no se restaba) | −$22 |
| **Total a pagar** | **$325** | **$303** |

---

## 🐛 Bug 2 — Créditos/préstamos no visibles en el cálculo

### Causa raíz

Los créditos **sí se descuentan automáticamente** si `descontarDeSalario = true` (valor por defecto tanto en Nómina como en FiadosEmpleados). Sin embargo, la **visualización** tenía dos problemas:

1. **El badge de deuda en la tarjeta colapsada era muy pequeño** (`text-[11px]`, texto gris/rojo tenue), fácil de pasar por alto.
2. **Los detalles completos** (qué crédito, cuánto se descuenta, botón "Cobrar todo"/"No cobrar hoy") **solo aparecen al tocar/expandir la tarjeta** de la trabajadora.

### Lógica de descuento (explicada)

```typescript
// montoACobrar: cuánto se descuenta de un crédito en esta quincena
const montoACobrar = (c: CreditoTrabajador, parciales: Record<string, number>): number => {
  // Si el usuario eligió un monto parcial → ese monto
  if (parciales[c.id] !== undefined) return Math.max(0, Math.min(parciales[c.id], c.saldo));
  // Por defecto: si descontarDeSalario = true → descuenta todo el saldo
  return c.descontarDeSalario ? Math.min(c.saldo, c.monto > 0 ? c.monto : c.saldo) : 0;
};
```

### Corrección aplicada — Badge de crédito más prominente

El badge de deuda en la tarjeta colapsada cambió de una línea de texto tenue a una pastilla (pill) con color de fondo:

```tsx
// ANTES: texto pequeño discreto
<p className="text-[11px] font-bold text-rose-600">
  Debe $X · se descuenta $Y
</p>

// DESPUÉS: pastilla de color, mucho más visible
<div className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold
  bg-rose-100 text-rose-700">
  💳 Descuento: <s>$X</s> → −$Y hoy
</div>
```

### Verificación del flujo de datos (créditos)

Se confirmó que `creditosTrabajadores` llega correctamente a `Nomina` desde `App.tsx`:

```tsx
// App.tsx línea 684
<Nomina
  creditosTrabajadores={creditosTrabajadores as any}  // ← viene del hook usePriceControl
  onAddCreditoTrabajador={addCreditoTrabajador}
  onUpdateCreditoTrabajador={updateCreditoTrabajador}
  ...
/>
```

También se confirmó que `FiadosEmpleados` guarda los créditos con `descontarDeSalario: true` por defecto (línea ~96 de `FiadosEmpleados.tsx`), por lo que los créditos registrados desde ese módulo **sí se descuentan** automáticamente en Nómina.

### ¿Por qué un crédito NO se descuenta?

Si los créditos NO aparecen descontados, verificar:

| Causa | Solución |
|---|---|
| `c.estado !== 'activo'` | El crédito ya fue marcado como pagado/descontado en el pasado |
| `c.saldo <= 0` | El saldo ya quedó en cero |
| `c.descontarDeSalario = false` | El crédito fue creado sin activar descuento de salario |
| El crédito no existe | Crearlo desde **FiadosEmpleados** o en **Nómina > "Agregar préstamo"** |

---

## 📁 Archivos modificados

| Archivo | Líneas modificadas | Descripción |
|---|---|---|
| `src/pages/Nomina.tsx` | ~395 | `diasMenosAplicados` ahora usa `diasFaltados` como default |
| `src/pages/Nomina.tsx` | ~1400-1410 | Placeholder del input y aviso de auto-aplicación |
| `src/pages/Nomina.tsx` | ~1186-1194 | Badge de créditos más prominente en tarjeta colapsada |

---

## 💡 Recomendaciones de Plugin, Hook y Skill

### 🔌 Plugin recomendado
**`react-hook-form` + `zod`** para el formulario de días/ajustes en Nómina. Actualmente los inputs de "días que no vino", "días de más" y "ajuste manual" manejan estado disperso con múltiples `useState`. Un form controlado con validación evitaría valores negativos, flotantes inválidos y facilitaría resetear todo al cambiar de quincena.

```bash
npm install react-hook-form zod @hookform/resolvers
```

### 🎣 Hook recomendado — `useNominaCalculadora`
Extraer toda la lógica de `itemsVivos` (useMemo de ~60 líneas) a un hook dedicado:

```typescript
// src/hooks/useNominaCalculadora.ts
export function useNominaCalculadora({
  trabajadores, asistencia, creditosTrabajadores,
  diasPeriodo, diasMenos, diasExtra, valorDiaEdit, diasVino,
  horasHabituales, parciales, modoCalculo
}: NominaCalculadoraParams): NominaItem[] { ... }
```

**Beneficios:**
- `Nomina.tsx` queda solo con UI (separación de responsabilidades)
- El hook se puede probar unitariamente con Vitest/Jest
- Se puede reutilizar en otros módulos (reportes, liquidación)

### 🛠️ Skill recomendada — `anti-sycophancy`
Para cuando el agente analice cálculos financieros: activar la skill `anti-sycophancy` para que siempre valide la lógica matemática contra casos extremos (saldo 0, salario 0, quincena con 0 días de asistencia) antes de dar una respuesta por "correcta".

Ruta: `C:\Users\ADMIN\.claude\skills\anti-sycophancy\SKILL.md`

---

## ✅ Comportamiento esperado después de las correcciones

1. Daniela trabajó lun/mar/jue/vie/sáb/dom (faltó miércoles):
   - Sistema detecta 1 falta → auto-aplica 1 día a restar
   - Total = quincena base − valor de 1 día
   - Badge rojo "1 falta" + línea "− 1 día que no vino" visible en "Cuenta de Daniela"

2. Daniela tiene un préstamo de $50:
   - Badge prominente "💳 Descuento: $50 → −$50 hoy" en la tarjeta
   - Al expandir: tarjeta de crédito con opciones "Cobrar todo" / "No cobrar hoy"
   - Total final = quincena − días faltados − préstamo

3. Si el usuario quiere perdonar un día faltado:
   - Escribir `0` en el input "Días que NO vino" → anula la auto-deducción
   - O activar el modo "Descontar Faltas" para descuento proporcional automático
