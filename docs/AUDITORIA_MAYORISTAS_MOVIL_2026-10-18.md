# Auditoría móvil — módulo "Ventas al Mayor" (`src/pages/Mayoristas.tsx`)

**Fecha:** 2026-10-18 · **Alcance:** solo móvil (375×812). Escritorio no debe cambiar.
**Cómo se midió:** app local (`vite`, Supabase apuntando a un puerto muerto para no tocar datos reales),
navegador integrado en 375×812, sesión de prueba local, medición por DOM (alturas, áreas de toque,
overflow) antes y después. Los "antes" de alto de tarjeta son aproximados (leídos de captura a 1.25×).

## Hallazgos y qué se hizo

| # | Hallazgo | Gravedad | Estado |
|---|----------|----------|--------|
| 1 | **La barra "Ver ticket / Productos" del Mini-POS no era fija**: era `position: static` al final de la página. Con 42 productos la vendedora tenía que bajar ~1750 px para ver el total o abrir el ticket (el comentario del código decía "siempre visibles"). | Alta | ✅ Arreglado: `sticky`, queda a 680–744 px, justo sobre la barra inferior de la app (verificado con `scrollTop=205/1934`). |
| 2 | **Encabezado + márgenes ocupaban ~720 px** antes de llegar a las pestañas (subtítulo de 3 líneas, tarjeta de márgenes de ~430 px con la cadena de precios en 4 filas). Causa: `Card` de shadcn trae `py-6 gap-6` y se sumaba al padding propio. | Alta | ✅ Pestañas ahora arrancan en y=404. Subtítulo oculto en móvil, botones en 2 columnas, cadena de precios en una fila deslizable. |
| 3 | **Tarjetas de resumen (KPIs) de ~210 px** y **tarjetas de producto de ~195 px** (42 productos ≈ 10 000 px de scroll). | Media | ✅ KPIs 122 px, productos 130 px; la lista completa mide ~7 600 px (antes se estima ~10 000 px). |
| 4 | **Pestañas cortadas** ("TA DE PRECIOS") y de 36 px de alto. | Media | ✅ Reparten el ancho, 44 px, texto corto "Precios" en móvil. |
| 5 | **Áreas de toque < 40 px**: lápiz de precio mayorista (12 px, uno por producto), editar/eliminar cliente (32 px), ✓/✕ del editor de precio. | Alta | ✅ Lápiz y ✓/✕ con área ≥ 40 px sin mover el diseño; editar/eliminar cliente a 44 px. |
| 6 | **Selector "Ver precios para cliente…"** con texto casi invisible. | Media | ✅ Color de texto explícito en móvil. |
| 7 | **Campo del precio manual** abría el teclado de texto completo (y a < 16 px iOS hace zoom). | Media | ✅ `inputMode="decimal"`, 16 px y 40 px de alto en móvil. |
| 8 | Estado vacío de créditos del perfil de cliente con mucho aire. | Baja | ✅ Compactado en móvil. |

## Pendiente (NO incluido en este PR, a propósito)

Estos cambios afectarían también a escritorio o a datos, así que quedan para PR aparte con autorización:

1. **Dinero mal parseado (P0) — corregido en PR #8.** `parseFloat` en el **precio manual** (único campo de dinero
   de tipo texto): escribir `1.500` o `1,500` guardaba **1.5** / **1**. *(Corrección: la primera versión de este informe
   decía que también fallaban abonos y monto libre; no es así, esos campos son `type="number"` y el navegador ya entrega
   `"1500"`/`"1500.5"`.)*
2. **`confirm()` nativo** al eliminar cliente / abono / registro y al vender con stock insuficiente — corregido en PR #9.
   En PWA de iPhone el diálogo nativo se bloquea (ya se corrigió así en otras pantallas: commit `153d3b71`).
   Siguen con `window.confirm` los 3 "¿Reemplazar ticket…?" (funciones síncronas; requieren volverlas `async`).
3. **Archivo de 4 100 líneas y 34 `useState`**: partir en componentes (Lista de precios, Clientes, Mini-POS, Perfil)
   y `React.memo` en las filas de producto; es probable (no medido) que cada tecla del buscador re-renderice las 42 tarjetas.
4. **281 textos < 11 px** (etiquetas `text-[8px]`/`text-[9px]`): subir a 10–11 px en móvil en todo el módulo
   (aquí solo se corrigieron las etiquetas de precio de la lista).
5. Placeholder "Buscar cliente por nombre o teléfono…" se corta en 375 px.
6. Pastilla global "Nexus Sync" tapa la esquina inferior derecha de las listas (afecta a toda la app, no solo a este módulo).
7. Sin conexión: el módulo no muestra si hay ventas/tickets en cola de subida.

## Pruebas
- `src/lib/mayoristas-movil.test.ts` (12 tests): contrato del código — cada ajuste móvil usa `max-md:` y las
  clases de escritorio originales siguen presentes. Falla si alguien revierte la barra fija.
- Verificación en navegador a 375 px y a 1280 px (escritorio: barra móvil `display:none`, columnas en fila,
  subtítulo visible, pestañas "LISTA DE PRECIOS").
- No se probó en un celular físico.
