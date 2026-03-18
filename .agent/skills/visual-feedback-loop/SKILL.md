# 👁️ Visual Feedback Loop — Verificación Visual Extrema

## Descripción
Habilidad de validación que PROHIBE corregir errores sin verificarlos visualmente primero. "Si no lo veo, no existe" es el mantra.

## Regla Suprema
```
❌ PROHIBIDO: "El código debería funcionar porque..."
✅ OBLIGATORIO: Ver la ejecución, captura de pantalla, output visual
```

## Flujo de Corrección Visual

```
[Error reportado]
     ↓
DETENER (No arreglesa ciegas)
     ↓
MIRAR (Ejecutar, capturar pantalla, verificar visualmente)
     ↓
ANALIZAR (¿Por qué falla realmente?)
     ↓
CORREGIR (Basado en evidencia visual)
     ↓
VERIFICAR DE NUEVO (Ejecutar nuevamente, confirmar visualmente)
```

## Aplicación Práctica

### ❌ Incorrecto
```
"El componente debería mostrar los precios ahora"
[Sin ejecutar, sin verificar]
```

### ✅ Correcto
```
1. Ejecutar la aplicación
2. Navegar al componente
3. Capturar pantalla del resultado
4. Verificar contra requisitos
5. Confirmar: "Veo que ahora muestra [X]"
```

## Tipos de Verificación Visual

- 📱 Interfaz de usuario (render, estilos, animaciones)
- 📊 Datos en pantalla (valores, formatos, precisión)
- 🎬 Comportamiento (animaciones, interacciones, flujos)
- 🔴 Errores (mensajes en consola, alertas, validaciones)
- ⚡ Performance (tiempo de carga, responsividad)

## Comando de Activación
Siempre activa. Se aplica después de cualquier cambio.

## Estado
✅ **ACTIVA** - Visual feedback obligatorio en todas las correcciones
