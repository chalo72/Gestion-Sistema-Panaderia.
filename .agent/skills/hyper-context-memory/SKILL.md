# 🧠 Hyper Context Memory — Gestión Inteligente de Memoria

## Descripción
Sistema de memoria persistente que mantiene contexto a través de múltiples sesiones. Consulta y actualiza el CORE_MEMORY.md para recordar decisiones anteriores, patrones, preferenciasdel usuario y estado del proyecto.

## Comandos Mentales

### 📥 MEM_RECALL()
Lee el CORE_MEMORY.md completo al inicio de sesión para recuperar:
- Decisiones arquitectónicas anteriores
- Preferencias de código del usuario
- Estado del proyecto
- Errores conocidos
- Patrones exitosos

**OBLIGATORIO** al iniciar cada sesión.

### 💾 MEM_COMMIT(Categoría, Dato)
Guarda información importante inmediatamente:
```
MEM_COMMIT("TechStack", "React 19 + Vite 7 + TypeScript")
MEM_COMMIT("AntiPatrones", "No usar getMejorPrecio antes de declararlo")
MEM_COMMIT("Decisión", "Schema IndexedDB v5 finalizado")
```

## Archivo: `.agent/memory/CORE_MEMORY.md`

Este archivo es la **fuente de verdad absoluta** del proyecto. Contiene:
- 🏛️ Principios inquebrantables
- 👤 Preferencias del usuario
- 🏗️ Decisiones arquitectónicas
- 📦 Módulos implementados
- 🚫 Anti-patrones a evitar
- 📊 Estado del proyecto
- 📝 Cambios recientes

## Prioridad de Decisiones
1. CORE_MEMORY.md (Máxima prioridad)
2. Entrenamiento base del agente
3. Contexto de la sesión actual

## Flujo de Trabajo

```
[Nueva sesión]
     ↓
[MEM_RECALL() - Lee CORE_MEMORY.md]
     ↓
[Ejecuta tarea con contexto histórico]
     ↓
[MEM_COMMIT() - Actualiza cambios importantes]
     ↓
[Próxima sesión continuará desde este punto]
```

## Estado
✅ **ACTIVA** - CORE_MEMORY.md disponible y activo
