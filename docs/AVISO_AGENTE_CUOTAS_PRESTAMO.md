# AVISO — Cuotas de préstamos en Nómina, 2026-10-15

El préstamo grande del panadero se lleva en Nómina, no en el registro de consumo de productos.

## Archivos

- `src/types/index.ts`: `CreditoTrabajador.cuota` y `PagoCredito.cobrada`
- `src/pages/Nomina.tsx`: cuota por quincena, botones Descontar cuota / No descontar, historial
- `src/App.tsx`: la nómina guarda el crédito completo (`updateCreditoTrabajador(id, crédito)`)

## Lógica

1. Al crear el préstamo se escribe el total y la cuota de cada quincena.
2. Al liquidar, la propuesta es esa cuota, no el saldo entero.
3. Se puede cobrar la cuota, otra cifra, o no descontar esa quincena.
4. Al guardar el pago queda una línea: cobrada o “no se cobró”. El saldo solo baja si hubo descuento.
5. La cuota también se guarda dentro de `pagos` con la nota `cuota:MONTO`, para que no se pierda al sincronizar.
