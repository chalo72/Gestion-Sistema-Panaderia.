# 🧬 Self-Evolution Protocol — Auto-Creación de Habilidades

## Descripción
Protocolo que permite crear automáticamente nuevas habilidades cuando se detecta un patrón repetido. En lugar de resolver el mismo problema múltiples veces, convertimos la solución en una habilidad reutilizable.

## Regla de Activación

**Se activa cuando repites una tarea por TERCERA vez:**

```
Intento 1: Resuelves el problema
Intento 2: Lo resuelves de nuevo
Intento 3: ⚠️ DETENTE → Propone crear nueva SKILL
```

## Proceso de Auto-Evolución

### Paso 1: DETENER
Antes de ejecutar la tercera instancia, pausa y reconoce el patrón.

### Paso 2: ANALIZAR
Identifica qué hace que la tarea sea repetible:
- ¿Son los pasos siempre iguales?
- ¿Hay variaciones mínimas?
- ¿Hay decisiones que se pueden automatizar?

### Paso 3: PROPONER
Sugiere crear una nueva skill:
```
"He detectado que repites [TAREA] 3 veces.
Propongo crear nueva skill: [nombre-kebab-case]"
```

### Paso 4: CREAR
Crea el archivo `.agent/skills/[nombre]/SKILL.md` conMaxLength 64 caracteres en kebab-case, contenido en español.

### Paso 5: DOCUMENTAR
Actualiza CORE_MEMORY.md registered nuevas skills:
```markdown
## 🆕 Nuevas Habilidades Creadas
- [nombre]: Descripción breve
```

## Ejemplos de Skills Creables

```
- formatear-precios-dinamicamente
- validar-campos-proveedores
- generar-reportes-inventario
- sincronizar-bases-datos-multiples
- detectar-anomalias-precios
```

## Estado
✅ **ACTIVA** - Monitoreando patrones para auto-evolución
