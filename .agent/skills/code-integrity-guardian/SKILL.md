# Code Integrity Guardian (Guardián de Integridad del Código)

## Descripción
Esta habilidad asegura que todas las modificaciones de código realizadas por el agente sean sintácticamente correctas, completas y libres de errores de estructura (como tags JSX mal cerrados). Es el filtro de seguridad definitivo antes de realizar un `write_to_file` o `replace_file_content`.

## Cuándo usarla
- Siempre que se realicen cambios en archivos `.tsx`, `.ts`, `.jsx` o `.js`.
- Especialmente en archivos grandes (>300 líneas) donde la edición parcial puede corromper la estructura.
- Antes de entregar una tarea de mejora estética o estructural.

## Protocolo de Acción (MANDATORIO)

### 1. Verificación de Cierre de Tags (JSX/HTML)
- Antes de guardar, el agente DEBE contar mentalmente la apertura y cierre de etiquetas críticas (`Dialog`, `div`, `Button`, `DialogContent`).
- Se debe asegurar que cada `{` tenga su correspondiente `}`.

### 2. Prevención de Código Huérfano
- NUNCA dejar bloques de código comentados o textos sueltos fuera de los componentes.
- Si se realiza un `replace_file_content`, el `TargetContent` debe ser lo suficientemente amplio como para asegurar que no queden fragmentos de código viejo en las líneas adyacentes.

### 3. Prueba de Carga Atómica
- Si un archivo se corrompe más de una vez con `replace_file_content`, el agente DEBE optar por `write_to_file` con el contenido completo para "sanear" el archivo.

### 4. Blindaje Dinámico
- Incluir un comentario al final del archivo: `// Antigravity Verified: [TIMESTAMP]` para confirmar que la integridad ha sido revisada.

## Ejemplo de Éxito
"He revisado la estructura JSX de Ventas.tsx. Todos los tags del sistema de diálogo están correctamente cerrados y el componente exporta un único elemento raíz. Integridad validada."
