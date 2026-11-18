# AVISO PARA EL OTRO AGENTE — Recepciones, 2026-10-15

No reviertas el cuadre de factura ni el botón de corregir historial.

## Archivos

| Archivo | Qué cambió |
|---|---|
| `src/lib/cuadre-factura.ts` | Nuevo. Subtotal por renglón redondeado al peso + IVA + diferencia contra el total del papel |
| `src/types/index.ts` | `Recepcion` suma `incluyeIva`, `porcentajeIva`, `descuentoFactura`, `totalImpreso`, `subtotalLineas`, `ivaFactura` |
| `src/pages/Recepciones.tsx` | Lápiz para corregir una recepción ya guardada. Casilla de IVA y total escrito en la factura |
| `src/App.tsx` | Pasa `onUpdateRecepcion` y `onAjustarStock` a Recepciones |

## Lógica

1. El total de la plataforma ya no es solo cantidad × precio en crudo.
2. Cada renglón se redondea al peso y después se suma. Así se parece a la factura.
3. IVA y descuento pueden ir en el producto (`descuentoPorcentaje`, `ivaPorcentaje`). Primero se quita el descuento y el IVA se calcula sobre lo que queda, en centavos, sin subir cada paso al peso. La casilla de IVA de la factura solo llena los productos donde el IVA quedó vacío. El descuento en pesos es el del final del papel.
4. El usuario escribe el total del papel. Si no coincide, la pantalla dice por qué: IVA, redondeo, o cantidad/precio.
5. Corregir una recepción ya guardada actualiza el historial y mueve el inventario solo por la diferencia de cantidades. No crea otra recepción.
6. Si existe el egreso `Compra Mercancía: Factura #...` de ese proveedor, la corrección también le cambia el monto. No crea un segundo gasto.
7. En el ticket negro, cada producto tiene Dto % e IVA %. El total del papel, el descuento en pesos y el pago siguen en la pantalla flotante «Factura, IVA y pago».
