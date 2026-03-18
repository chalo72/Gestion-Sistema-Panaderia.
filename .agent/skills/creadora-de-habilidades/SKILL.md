# 🏗️ Creadora de Habilidades — Generador de Skills

## Descripción
Habilidad meta que enseña cómo crear nuevas habilidades. Usada por el Self-Evolution Protocol para generar nuevas skills cuando se detectan patrones repetidos.

## Estructura de una Habilidad (SKILL.md)

### Plantilla Básica
```markdown
# [Emoji] [Nombre de Habilidad] — [Subtítulo descriptivo]

## Descripción
Explicación clara de qué hace esta habilidad.

## Reglas/Principios
- Lista de principios clave
- Lo que activa esta habilidad
- Criterios de aplicación

## Flujo/Proceso
Diagrama o pasos de cómo funciona.

## Ejemplos
✅ Correcto (qué hacer)
❌ Incorrecto (qué evitar)

## Estado
✅ **ACTIVA** / ⏸️ **INACTIVA**
```

## Guía de Creación

### 1️⃣ IDENTIFICACIÓN
- **Nombre**: Máximo 64 caracteres, kebab-case
- **Patrón**: ¿Qué hace única a esta skill?
- **Dominio**: ¿Qué área cubre? (Frontend, Backend, DB, Deploy, etc)

### 2️⃣ DOCUMENTACIÓN
```
Estructura mínima:
- Descripción (1-2 párrafos)
- Reglas/Principios (bullet points)
- Proceso (pasos o flujo)
- Ejemplos (buenos y malos)
- Estado actual
```

### 3️⃣ UBICACIÓN
```
.agent/skills/[nombre-habilidad]/
└── SKILL.md
```

### 4️⃣ REGISTRO
Actualizar CORE_MEMORY.md:
```markdown
## 🆕 Nuevas Habilidades
- [nombre]: Descripción breve
```

## Checklist de Calidad

- [ ] Nombre en kebab-case, máx 64 caracteres
- [ ] Descripción clara y concisa
- [ ] Mínimo 3 principios o reglas
- [ ] Proceso/flujo documentado
- [ ] Ejemplos ✅ y ❌
- [ ] Emoji representativo elegido
- [ ] Archivo ubicado en la carpeta correcta
- [ ] Registrada en CORE_MEMORY.md

## Ejemplo: Nueva Skill Simple

```markdown
# ⏰ Validador de Fechas — Formato y Rango

## Descripción
Valida automáticamente que todas las fechas cumplan
formato ISO y estén dentro de rango permitido.

## Principios
- Las fechas van siempre en ISO 8601
- Validar rango antes de guardar
- Mostrar error amigable si falla

## Proceso
1. Recibir fecha (string o Date)
2. Convertir a ISO si es necesario
3. Validar formato
4. Validar rango permitido
5. Retornar {válida, valor, error}

## Ejemplos
✅ "2026-03-02" → Válida
❌ "03/02/2026" → Error formato
❌ "2020-01-01" → Error rango

## Estado
✅ **ACTIVA**
```

## Estado
✅ **ACTIVA** - Generando nuevas skills según demanda
