# Checklist: proveedor La 36 + Preventa/Recibir al panadero

Fecha: 2026-10-18  
Quién lo hace: ADMIN / GERENTE (Director o quien tenga acceso a **Seguridad y Roles**)  
Objetivo: dejar a **La 36** listo en datos y abrir al rol **Panadero** los módulos **Órdenes de Compra** (Preventa) y **Entrada de Mercancía** (Recibir).

---

## A) Dejar proveedor La 36 listo en datos

Hazlo con usuario **ADMIN** o **GERENTE**. Marca cada casilla al terminar.

### A1. Crear (o actualizar) el proveedor

1. Menú lateral → sección **Compras** → **Gestión de Proveedores**.
2. Botón **Nuevo** / **+** (alta de aliado).
3. En el formulario, sección **Identidad Corporativa**:
   - **Razón Social**: `La 36` (exacto, para que todos lo encuentren igual).
   - **Rubro**: el que corresponda (ej. insumos / harinas — elige el más cercano).
   - Dejar **Activo** encendido.
4. Sección **Detalles de Enlace y Logística**:
   - **Asesor Designado**: nombre del preventista / contacto (si lo tienes).
   - **Línea de Pedidos (WhatsApp)**: teléfono con indicativo Colombia, ej. `+57 300 000 0000`  
     (sin este número, el botón WhatsApp de la orden no abre el chat correcto).
   - Correo, ubicación y dirección: opcionales, pero útiles.
5. Guardar el proveedor (**Actualizar Aliado** / guardar).

### A2. Cargar el catálogo de insumos de La 36

1. Abre de nuevo **La 36** (editar).
2. Sección **Catálogo de productos / insumos**:
   - Por cada ítem que compran a La 36:
     - Nombre del insumo
     - Categoría
     - Precio de costo
     - Embalaje (saco, caja, unidad…) y cantidad del empaque
     - Destino: **insumo** (si es para producción)
   - Pulsa **añadir / guardar** cada producto en el catálogo del proveedor.
3. Guarda el proveedor otra vez para que queden todos los precios ligados a La 36.

> Tip: si ya existe el producto en el catálogo general, búscalo y vincúlalo; no dupliques el mismo nombre sin necesidad.

### A3. Probar el flujo completo (Órdenes → WhatsApp → Entrada)

1. Menú → **Compras** → **Órdenes de Compra**.
2. Elige proveedor **La 36**.
3. Arma un pedido de prueba (1–2 ítems del catálogo) y guarda la orden (borrador / confirmado según la pantalla).
4. Abre el detalle de la orden → botón verde **WhatsApp**.
   - Debe abrir WhatsApp con el mensaje del pedido hacia el teléfono de La 36.
5. Marca la orden como enviada / recibida según el flujo de la app (si aplica).
6. Menú → **Compras** → **Entrada de Mercancía**.
7. Crea una recepción ligada a esa orden (o a La 36), confirma cantidades y cierra.
8. Revisa **Inventario**: el stock de esos insumos debe subir.

Si A3 falla, no pases a producción real: revisa teléfono WhatsApp, catálogo y permisos del usuario con el que estás probando.

---

## B) Abrir Preventa / Recibir al panadero (sin tocar código)

Hay **dos capas**. Hay que activar las dos.

| Capa | Qué controla | Dónde se guarda |
|------|----------------|-----------------|
| **Permisos de Acciones** | Candados `VER_PREPEDIDOS`, `CREAR_…`, `VER_RECEPCIONES`, etc. | `localStorage` → `pricecontrol_permissions` (se aplica al marcar el checkbox) |
| **Visibilidad de Módulos** | Si el ítem aparece en el menú | `localStorage` → `dp_permisos_modulos_v1` (**hay que pulsar Guardar**) |

Hoy el rol **Panadero** por defecto **no** tiene Preventa ni Recibir (solo dashboard, producción, recetas, inventario, reportes, asistencia, WhatsApp hub, captura rápida).

### B1. Click-path exacto — Permisos de Acciones

1. Entra con **ADMIN** (o rol con `VER_USUARIOS`).
2. Menú → **Administración** → **Seguridad y Roles**.
3. Pestaña superior: **Permisos de Acciones**.
4. En la tabla, busca el grupo **Operaciones de Compra** y, en la columna **Panadero**, marca:
   - Ver prepedidos (`VER_PREPEDIDOS`)
   - Crear prepedidos (`CREAR_PREPEDIDOS`)
   - Editar prepedidos (`EDITAR_PREPEDIDOS`) — recomendado para armar / corregir pedidos
5. En el grupo **Suministros y Bodega**, columna **Panadero**, marca:
   - Ver recepciones (`VER_RECEPCIONES`)
   - Crear recepciones (`CREAR_RECEPCIONES`)
6. No hace falta botón Guardar aquí: al marcar el checkbox ya queda guardado.

### B2. Click-path exacto — Visibilidad de Módulos

1. Misma pantalla **Seguridad y Roles**.
2. Pestaña: **Visibilidad de Módulos**.
3. Selector de rol: pulsa **Panadero** (botón ámbar).
4. Sección **Compras**:
   - **Órdenes de Compra** → botón **Ver** (debe quedar verde / desbloqueado).
   - **Entrada de Mercancía** → botón **Ver** (igual).
5. **Importante:** baja y pulsa **Guardar permisos** (botón indigo). Sin esto, el menú no cambia.
6. Cierra sesión del panadero (si estaba abierta) y vuelve a entrar, o recarga la app.

### B3. Cómo verificar que el panadero ya ve Preventa/Recibir

1. Login con usuario rol **PANADERO**.
2. En el menú debe aparecer sección **Compras** con:
   - **Órdenes de Compra**
   - **Entrada de Mercancía**
3. Debe poder abrir ambos y crear una orden / recepción de prueba (sin necesidad de ver costos profundos si esos interruptores siguen apagados en Datos Sensibles).

### B4. Si en otro dispositivo / navegador no aparece

Los permisos de módulos viven en **localStorage de ese navegador**.  
Repite B1 + B2 en ese equipo, o sincroniza el dispositivo donde ya quedó bien.

---

## C) ¿Hace falta AUTORIZO / editar código?

**No**, para el día a día del negocio: con la pantalla **Seguridad y Roles** basta.

Solo pide **AUTORIZO** si quieres que los **defaults de fábrica** del código ya traigan Preventa/Recibir para Panadero en instalaciones nuevas (parche permanente). Cambio exacto propuesto (no aplicado):

1. `src/types/index.ts` → en `ROLE_PERMISSIONS.PANADERO`, añadir:  
   `'VER_PREPEDIDOS', 'CREAR_PREPEDIDOS', 'EDITAR_PREPEDIDOS', 'VER_RECEPCIONES', 'CREAR_RECEPCIONES'`
2. `src/hooks/usePermisosModulos.ts` → en `VER_PANADERO`, añadir `'prepedidos'` y `'recepciones'`, más un `PATCH_…` como los demás parches de panadero.

Archivos **protegidos** (`AuthContext`, `App.tsx`, database): **no se tocan** para este paso.

---

## Resumen rápido

| Paso | Hecho |
|------|--------|
| A1 Crear La 36 + WhatsApp | ☐ |
| A2 Catálogo insumos | ☐ |
| A3 Probar Órdenes → WhatsApp → Entrada | ☐ |
| B1 Acciones Panadero (prepedidos + recepciones) | ☐ |
| B2 Módulos Panadero + **Guardar permisos** | ☐ |
| B3 Login panadero y ver menú Compras | ☐ |

Sin commit. Código funcional protegido intacto.
