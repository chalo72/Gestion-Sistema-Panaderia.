# 🏦 Bóveda y Tesorería — Mejoras Implementadas

> Autor: Agente IA · Dulce Placer ERP v5.1.5  
> Fecha: 2026-10-15

---

## Resumen de cambios

| Área | Qué se mejoró |
|---|---|
| **Cuentas Internas** | Tarjetas ahora son editables inline: botón "Actualizar" por caja |
| **Saldo Real** | Función `setBovedaSaldoReal` guarda el monto físico y crea movimiento de trazabilidad |
| **Renombrar bóveda** | Edición de nombre inline desde la misma tarjeta |
| **Eliminar bóveda** | Botón de eliminar (solo funciona si saldo = 0) |
| **Flujo de Provisiones** | Panel explicativo de para qué sirve y cómo aprovecharlo |
| **Dashboard** | Acceso directo a Bóveda en "Accesos Tácticos" (desktop y móvil ya lo tenían) |
| **Tienda (store)** | Nuevas funciones: `setBovedaSaldoReal`, `deleteBoveda`, `renameBoveda` |

---

## 1. Cuentas Internas — Edición inline del saldo real

### Problema anterior
Las tarjetas de bóveda eran **solo de lectura**. Para corregir el saldo había que ir a "Conciliar" (botón en el header), seleccionar la bóveda, ingresar el saldo real. Era un proceso largo y poco intuitivo.

### Solución implementada
Cada tarjeta de bóveda ahora tiene un botón **"Actualizar"** directamente en la tarjeta:

```
┌─────────────────────────────┐
│ 🔒 Caja Fuerte Principal    │  ✏️ 🗑️
│ Caja Fuerte                 │
│                             │
│ $450.000          [Actualizar] │
│ Saldo en sistema            │
└─────────────────────────────┘
```

Al tocar "Actualizar":
```
┌─────────────────────────────┐
│ 💵 Ingresa el dinero REAL:  │
│ $ [___480000_____________]  │
│ Sistema dice: $450.000      │
│ [✓ Guardar]    [✗ Cancelar] │
└─────────────────────────────┘
```

- Se escribe el monto físico real (lo que hay en la caja)
- Al guardar, crea automáticamente un movimiento de "Ajuste de saldo real" para trazabilidad
- El sistema calcula la diferencia y la registra como Ingreso o Egreso de ajuste

### Flujo técnico
```
setBovedaSaldoReal(id, saldoReal, responsable)
  → actualiza boveda.saldo en localStorage
  → crea MovimientoBoveda { tipo: 'Ingreso'|'Egreso', motivo: 'Ajuste de saldo real' }
  → guarda en nube (db.saveBackup)
```

---

## 2. Renombrar y eliminar bóvedas

### Renombrar
Clic en el lápiz ✏️ → input inline → Enter o botón ✓.

### Eliminar 🗑️
Solo funciona si el saldo de esa bóveda es **exactamente $0**. Si tiene saldo, muestra error:  
*"No se puede eliminar: tiene saldo de $X. Pásalo a otra bóveda primero."*

---

## 3. Flujo de Provisiones — ¿Para qué sirve?

Esta pestaña ahora incluye un panel explicativo visible:

### ¿Para qué sirve?
| Uso | Descripción |
|---|---|
| **Proyectar compromisos** | Nóminas, proveedores, servicios — saber si habrá plata cuando toque pagar |
| **Reservar dinero** | Crear una "provisión" es apartar fondos antes de que llegue el gasto |
| **Calendario de caja** | Semana a semana: ¿qué sale y qué entra? ¿Queda saldo positivo? |
| **Detectar semanas críticas** | Si el saldo proyectado cae a negativo, hay que actuar antes |

### Ejemplo práctico
> Si el viernes hay que pagar nómina ($650.000) y en las bóvedas solo hay $420.000, esta pestaña lo muestra con días de anticipación para que puedas actuar.

### ¿Cómo aprovecharla?
1. Ir a **Bóveda → Flujo y Provisiones**
2. Agregar los gastos programados (nómina, proveedor de harina, etc.) con fecha
3. El sistema calcula el saldo proyectado día a día
4. Las semanas en rojo = no habrá suficiente plata → transferir o conseguir antes

---

## 4. Acceso directo desde el Centro de Mando (Dashboard)

### Problema anterior
Para ir a Bóveda desde el Dashboard, había que buscar en el menú lateral (Sidebar) o recordar dónde estaba.

### Solución
En la sección **"Accesos Tácticos"** del panel derecho del Dashboard (escritorio), se agregó un botón destacado:

```
┌─ Accesos Tácticos ──────────────┐
│ [Preventa]  [Recibir]           │
│                                  │
│ 🔒 BÓVEDA Y TESORERÍA           │
│    Centro de dinero →            │
│                                  │
│   Inventario                     │
│   Proveedores                    │
│   Carga Masiva                   │
└──────────────────────────────────┘
```

El botón usa gradiente indigo-violet para diferenciarse visualmente del resto de accesos.

> **Nota**: El Dashboard móvil ya tenía el botón de Bóveda en la sección de accesos táctiles (línea 372 de MobileDashboardView.tsx).

---

## 5. Nuevas funciones en boveda-store.ts

```typescript
// Establece saldo real físico (sobrescribe, deja trazabilidad)
setBovedaSaldoReal(id: string, saldoReal: number, responsable: string): MovimientoBoveda | null

// Elimina una bóveda del sistema
deleteBoveda(id: string): boolean

// Renombra una bóveda
renameBoveda(id: string, nombre: string): void
```

---

## 6. Guía de uso rápida para el administrador

### Para actualizar el saldo real de cada caja:
1. Ir a **Bóveda y Tesorería**
2. En **Cuentas Internas**, tocar **"Actualizar"** en la caja que quieres corregir
3. Escribir el monto exacto en billetes y monedas que tienes en esa caja
4. Tocar **Guardar**
5. El sistema ajusta automáticamente y deja el movimiento registrado

### Para agregar una nueva caja (ej. "Caja Tortas"):
1. Tocar **"Nueva Bóveda"** en el header
2. Nombre: "Caja Tortas"
3. Tipo: "Base Física" o "Caja Fuerte"
4. Crear
5. Luego tocar "Actualizar" y poner el saldo real inicial

### Para hacer una transferencia entre cajas:
1. Tocar **"Transferir"** en el header
2. ¿De dónde sale? → seleccionar caja origen
3. ¿A dónde entra? → seleccionar caja destino
4. Monto y motivo → Confirmar

---

## Archivos modificados

| Archivo | Cambios |
|---|---|
| `src/lib/boveda-store.ts` | +`setBovedaSaldoReal`, +`deleteBoveda`, +`renameBoveda` |
| `src/pages/Boveda.tsx` | Tarjetas interactivas, handlers inline, pestaña Provisiones con guía |
| `src/pages/Dashboard.tsx` | Acceso directo a Bóveda en Accesos Tácticos |
