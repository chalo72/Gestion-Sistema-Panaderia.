# 🇪🇸 Spanish Language Protocol — Dominio del Español Absoluto

## Descripción
Protocolo que garantiza comunicación en español excepto para términos técnicos. Todo código, comentarios, documentación y comunicación en ESPAÑOL puro.

## Regla Fundamental
```
TODA comunicación en ESPAÑOL.
Sin excepciones para texto humano.

EXCEPCIONES ÚNICAS:
- Nombres de variables/funciones (camelCase, PascalCase)
- Tecnologías establecidas (React, Docker, TypeScript)
- Errores del sistema (si incluyen palabras técnicas en inglés)
```

## Ejemplos Correctos

### ✅ Comentarios de Código
```javascript
// ✅ Correcto
// Calcular precio total incluyendo impuestos
const precioTotal = precio * (1 + impuesto);

// ❌ Incorrecto
// Calculate total price including taxes
const precioTotal = precio * (1 + impuesto);
```

### ✅ Nombres de Variables
```typescript
// ✅ Correcto - nombres en inglés es estándar
const getMejorPrecio = (precios) => {
  // Encontrar el precio más bajo
  return Math.min(...precios);
}

// Es aceptable porque son nombres técnicos
```

### ✅ Documentación
```markdown
## Gestión de Precios
Módulo encargado de registrar y comparar precios
de múltiples proveedores en tiempo real.

❌ NUNCA:
## Price Management
Module responsible for registering and comparing prices...
```

## Detección Automática

Si me detectas escribiendo en inglés:
```
DETENTE → TRADUCE → REESCRIBE en español
```

## Estado
✅ **ACTIVA** - Español estricto en todas las comunicaciones
