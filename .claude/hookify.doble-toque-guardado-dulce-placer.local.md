---
name: warn-doble-toque-guardado-dulce-placer
enabled: true
event: file
conditions:
  - field: file_path
    operator: regex_match
    pattern: \.tsx$
  - field: new_text
    operator: regex_match
    pattern: await\s+on(Add|Save|Create|Update|Guardar|Crear|Registrar)\w*\(
  - field: new_text
    operator: not_contains
    pattern: guardando
  - field: new_text
    operator: not_contains
    pattern: isSaving
  - field: new_text
    operator: not_contains
    pattern: crearGuardiaEnvio
---

⚠️ **Guardado sin protección contra doble toque (Dulce Placer)**

Estás escribiendo un guardado asíncrono (`await onAdd…/onSave…/onCreate…`) y no veo ninguna señal de bloqueo (`guardando`, `isSaving`, `crearGuardiaEnvio`). En el celular guardar tarda; si el botón sigue activo la persona toca otra vez y se crean registros duplicados (pasó el 2026-10-18: 11 consumos de $1.600 en 8 segundos).

Haz esto:
- Bloquea el botón mientras guarda: `disabled={guardando}` y texto "Guardando…".
- Usa `crearGuardiaEnvio` de `src/lib/guardia-envio.ts` (descarta el mismo contenido repetido y se libera si el guardado falla). Ese archivo está en la rama `claude/dazzling-pasteur-8d42ae`, pendiente de juntar a main: si aún no existe en tu rama, bloquea el botón con `guardando` y no lo importes todavía.
- Limpia el formulario solo cuando el guardado salió bien.

Este aviso puede salir de más si el bloqueo está en otra parte del archivo; en ese caso ignóralo.
