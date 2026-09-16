# AGENTS.md

Instrucciones para cualquier agente de IA (Antigravity, Cursor, Claude Code u otro) que trabaje en este repositorio.

## Coordinación multi-agente — OBLIGATORIO

Este proyecto se trabaja alternando entre varios agentes de IA en sesiones distintas, no simultáneas: cuando a uno se le acaban los créditos/tokens, el usuario continúa la misma tarea con otro agente.

- **Antes de empezar cualquier tarea no trivial**, lee `CORE_MEMORY.md` en la raíz de este repo. Contiene el estado real del proyecto, decisiones recientes, errores conocidos y pendientes que puede haber dejado otro agente en otra herramienta.
- **Después de completar algo significativo**, agrega una entrada en `CORE_MEMORY.md` (sección "Decisiones Clave" o "Estado Actual y Pendientes") con fecha, qué se hizo y por qué. Si no queda escrito ahí, el siguiente agente no lo sabrá.
- No asumas que el estado del proyecto es el que recuerdas de tu propia conversación o memoria interna — esa memoria es privada de cada herramienta y no la ven las demás. Solo lo que está en archivos del repo es visible para todos los agentes.

## Guía técnica del proyecto

Ver `CLAUDE.md` (raíz) y `app/CLAUDE.md` para comandos, arquitectura, convenciones de código y archivos protegidos (requieren "AUTORIZO" explícito del usuario antes de editar).

## Estructura del repo

`app/` es un repositorio git anidado (tiene su propio `.git`, sin `.gitmodules` registrado) que apunta al mismo remoto que la raíz pero puede tener historial divergente. Verifica en qué repo y en qué rama estás antes de asumir que un cambio se sincronizó — ver la advertencia correspondiente en `CORE_MEMORY.md`.
