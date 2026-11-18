# AVISO PARA EL OTRO AGENTE — 2026-10-15

Lee este archivo antes de tocar Nómina, Bóveda o Compromisos fijos.
No reviertas estos cambios. No borres `esDeNomina` ni la ficha de compromisos.

## Archivos tocados en esta sesión (compromisos)

| Archivo | Qué cambió |
|---|---|
| `src/types/index.ts` | `CompromisoFijo` suma `ventanaDias`, `ciclosPagados`, `historialPagos` |
| `src/lib/finanzas-personales.ts` | Andrea Cadena y Gonzalo Panadero se marcan `esDeNomina` y salen de las sumas. Avisos por fecha aproximada. `marcarCompromisoPagado`. `compromisoAMensual` |
| `src/hooks/useReportesData.ts` | Alta/edición guarda día aproximado, ± días y notas. Excluye nómina del total de fijos |
| `src/components/reportes/DiagnosticoFinanciero.tsx` | Ficha al tocar cada compromiso. Panorama: fijos + nómina + proveedores vs ventas + botón de IA |
| `src/pages/Reportes.tsx` | Recibe `trabajadores` para la nómina del panorama |
| `src/App.tsx` | Pasa `trabajadores` a Reportes |
| `src/components/dashboard/AvisosCompromisos.tsx` | Nuevo. Aviso en el centro de mando |
| `src/components/dashboard/mano-derecha-director.tsx` | Muestra el aviso. La proyección ya no cuenta otra vez a quien está en nómina |
| `src/components/dashboard/MobileDashboardView.tsx` | El mismo aviso en el inicio del celular |

## Lógica (no la dupliques)

1. **Compromisos fijos** = arriendo, energía casa, energía local, bancos, agua. Día aproximado + ventana de días. No es un día inamovible.
2. **Nómina** = módulo Nómina / `trabajadores` activos (`salarioBase` del mes). Andrea Cadena y Gonzalo Panadero no deben verse otra vez en la lista de fijos.
3. **Proveedores** = presupuestos de compras (`dp_compras_minimas`). Semanal: el mes es ×4, pero cada quincena es ×2. Quincenal: cada quincena es el monto anotado. Mensual: cada quincena es la mitad. La ficha muestra la quincena en curso, no el mes ×4.
4. **Ventas del panorama** = cuadres de caja del mes, partidos en 1ª quincena (días 1–15) y 2ª (16 al fin). Si el turno trae `totalVentas`, se usa. Si está en cero y la caja cerró, se estima cierre − base. El mismo día no se suma otra vez. La caja que sigue abierta no entra. Ya no se usa `reporteActual.totalVentas`.
5. Al tocar cada ficha se ve el detalle. Las dos quincenas listan los egresos ya registrados.
6. Fijos, nómina y el tope de proveedores siguen siendo lo anotado, el salario base y el presupuesto. No son el banco ni la nómina neta.
7. El balance compara ventas de la quincena en curso contra los compromisos de ESA quincena (`compromisoQ1` / `compromisoQ2`). No se dice que faltan los compromisos del mes entero cuando solo va la primera quincena.
8. Cada caja paga sus facturas. Principal y preventa: gaseosas, lácteos y dulces, más arriendo y nómina. Helados y tintos pagan la factura de su mismo nombre. La caja de mercado se llama Mercato. La de dulces y mecato se llama Mekato (`mekato` y `mecato` caen en el mismo bolsillo). `filasCaja` en el panorama. Un proveedor sin caja no se resta a la principal.
9. Vigía de ventas: `src/lib/vigia-ventas.ts` y el agente `vigia-ventas`. Compara el último cuadre con el mismo día de la semana. Si falta un cierre, no lo trata como bajón.
10. La realidad de la quincena es ventas de cuadres − egresos ya guardados (`gastadoQ1` / `gastadoQ2`). El tope de proveedores no se resta. Fijos y nómina anotados tampoco, hasta que queden como egreso. El encabezado cerrado muestra Entró, Salió y Queda.
11. Nómina: al cobrar la 1ª quincena solo entran préstamos y consumos con fecha hasta el día 15 (`entraEnQuincena`). Lo anotado el 16 o después espera la 2ª. No se borra el historial.
12. Nómina: no existe el botón «Hoy no le descuento». La cuota del préstamo no sirve para un cobro de más. El cuadro «Cobro adicional» (descripción + monto, estado `cobroExtra`) se suma a los descuentos de esa quincena y resta el total a pagar. No baja el saldo del préstamo.

## Documentos anteriores de esta misma línea de trabajo

- `docs/NOMINA_BUGS_Y_CORRECCIONES.md` — días no trabajados y créditos en `src/pages/Nomina.tsx`
- `docs/BOVEDA_MEJORAS.md` — saldo real por caja, `src/lib/boveda-store.ts`, `src/pages/Boveda.tsx`, acceso en `src/pages/Dashboard.tsx`
