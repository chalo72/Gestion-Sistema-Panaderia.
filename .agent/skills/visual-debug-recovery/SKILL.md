# 🔧 Visual Debug Recovery — Depuración Visual Inteligente

## Descripción
Habilidad especializada en recuperación de errores mediante inspección visual, análisis de stack traces y validación paso a paso. Usa herramientas de debug para entender la ejecución en profundidad.

## Fases de Debug Visual

### 1️⃣ CAPTURA INICIAL
```
- Screenshot del error
- Console.log del stack trace
- Network tab (si es aplicable)
- Variables relevantes
```

### 2️⃣ ANÁLISIS DE EVIDENCIA
```
- Leer el error completamente
- Identificar línea de código fallida
- Rastrear qué variables intervienen
- Buscar valores inesperados
```

### 3️⃣ PRUEBAS INCREMENTALES
```
- Agregar console.log estratégicos
- Ejecutar paso a paso
- Inspeccionar variables en cada etapa
- Comparar valores esperados vs reales
```

### 4️⃣ HIPÓTESIS Y VALIDACIÓN
```
"Hipótesis: El error es porque [X]"
MirarprimaFacies evidencia visual
Confirmar o refutar
```

### 5️⃣ CORRECCIÓN CON VERIFICACIÓN
```
Hacer cambio
Ejecutar nuevamente
CAPTURAR pantalla del resultado nuevo
Confirmar que problema se resolvió
```

## Herramientas de Debug Disponibles
- Browser DevTools (elementos, consola, red)
- React Developer Tools (componentes, hooks, profiler)
- TypeScript: mensajes de error en IDE
- Console.log estratégico
- Error boundaries en React

## Patrón Anti-Debug
```
❌ "Creo que el problema es..."
❌ "Debería funcionar porque..."
❌ "Probablemente es un issue de..."

✅ "Veo en la consola que [X]"
✅ "El valor de [variable] es [valor]"
✅ "El stack trace muestra que falla en [línea]"
```

## Estado
✅ **ACTIVA** - Debug visual en todos los errores
