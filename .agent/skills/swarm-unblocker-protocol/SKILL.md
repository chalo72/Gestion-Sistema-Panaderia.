# 🐝 Swarm Unblocker Protocol — Desbloqueo Enjambre

## Descripción
Protocolo de emergencia que activa 3 sub-agentes simulados cuando un problema persiste o una tarea simple toma demasiado tiempo. Ayuda a romper bloqueos creativos y técnicos.

## Activación
Se activa cuando:
- ❌ Un error persiste tras 2 intentos de corrección
- ❌ Una tarea simple toma más de 4 turnos consecutivos
- 🔴 Estás en un loop infinito de intentos fallidos

## Los 3 Sub-Agentes

### 🐇 RUSH (La Liebre)
**Filosofía**: "Avanzar YA, resolver después"

Estrategia:
- Hardcodear valores si es necesario
- Usar mocks temporales
- Comentar código problemático
- Implementar TODO markers
- **Objetivo**: Pasar del bloqueo, avanzar en otra área

Cuándo usar:
```
"El framework no coopera, voy a skipear esto"
"Voy a hardcodear el valor por ahora"
"Dejamos esto para después, continuamos"
```

### 👻 BYPASS (El Fantasma)
**Filosofía**: "Evadir inteligentemente el problema"

Estrategia:
- Rodear el problema, no confrontarlo
- Implementar solución alternativa
- Documentar limitación
- Marcar como conocido
- **Objetivo**: Continuar sin estar bloqueado

Cuándo usar:
```
"Este componente es demasiado complejo, usamos este otro"
"La API falla, utilizamos caché local"
"Saltamos esta validación por ahora"
```

### 🐢 DEEP (La Tortuga)
**Filosofía**: "Solución completa y correcta, aunque tarde"

Estrategia:
- Investigación profunda
- Solución definitiva y robusta
- Documentación completa
- Testing exhaustivo
- **Objetivo**: Agendar para sesión posterior

Cuándo usar:
```
"Esto merece investigación profunda"
"Necesitamos arquitectura sólida aquí"
"Sesión próxima nos enfocamos en esto"
```

## Algoritmo de Decisión

```
¿Es crítico para Happy Path?
  ├→ SÍ → Activar RUSH (avanzar, refactorizar después)
  └→ NO → Activar BYPASS (evadir, continuar)

SIEMPRE registrar DEEP en task tracking para sesión posterior.
```

## Ejemplo de Activación

```
Intento 1: Intentar solución A → Falla
Intento 2: Intentar solución B → Falla
[Persistencia detectada]

🚨 DESBLOQUEO ENJAMBRE ACTIVADO 🚨

RUSH: "Hardcodeamos los datos por ahora"
BYPASS: "Usamos la API alternativa"
DEEP: "Sesión próxima investigamos la arquitectura"

Continuamos con RUSH/BYPASS, documentamos DEEP.
```

## Estado
✅ **ACTIVA** - Disponible para desbloqueos de emergencia
