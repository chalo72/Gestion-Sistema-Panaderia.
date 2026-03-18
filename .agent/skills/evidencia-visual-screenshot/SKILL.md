---
name: evidencia-visual-screenshot
description: >
  Habilidad para capturar evidencia visual (screenshots) de la aplicación web.
  Úsala cuando el usuario pida una captura de pantalla, cuando necesites documentar
  el "antes y después" de un cambio visual, o para capturar un error difícil de
  explicar con texto.
---

# 📸 Evidencia Visual y Captura de Pantalla

Esta habilidad permite al agente Antigravity capturar imágenes reales de la aplicación en funcionamiento. Proporciona una "prueba visual" de que los cambios se han aplicado correctamente o documenta errores visuales de forma precisa.

---

## 🚀 Cuándo Activar Esta Habilidad

1.  **A petición del usuario**: Cuando el usuario diga "toma una captura" o "crea una habilidad de captura".
2.  **Documentación de cambios**: Tras realizar ajustes en el diseño (CSS, Layout, Componentes).
3.  **Reporte de errores**: Cuando la interfaz se rompe o muestra algo inesperado.
4.  **Hitos del proyecto**: Para guardar un registro visual del progreso de la app.

---

## 🛠️ Procedimiento Paso a Paso

### Paso 1: Identificar el Objetivo
Determina qué vista o componente específico necesitas capturar (ej. Dashboard, Ventas, Inventario). Asegúrate de que el servidor de desarrollo esté corriendo (normalmente en `http://localhost:5173`).

### Paso 2: Ejecutar el Sub-Agente de Navegador
Utiliza la herramienta `browser_subagent` con una tarea clara.

**Ejemplo de comando para el sub-agente:**
> "Navega a http://localhost:5173, espera a que cargue la aplicación, entra en la sección de [Sección] y toma una captura de pantalla completa."

### Paso 3: Organizar la Evidencia
Por defecto, las capturas de pantalla se guardan como artefactos de imagen. Si el proyecto requiere un registro histórico, guarda una referencia o el archivo en una carpeta llamada `/evidencias`:

```bash
# Ejemplo de organización (si se guardan archivos físicos)
/evidencias/
  └── 2026-02-25_dashboard_ajustado.webp
  └── 2026-02-25_error_login_404.webp
```

### Paso 4: Notificar al Usuario
Presenta la imagen capturada al usuario junto con una breve descripción de lo que se observa.

---

## 📜 Reglas de Oro

1.  **Claridad**: La captura debe mostrar claramente el elemento o error que se desea documentar.
2.  **Privacidad**: Evita capturar información sensible si el entorno no es seguro.
3.  **Contexto**: Siempre acompaña la imagen con un texto que explique qué es y por qué se tomó.
4.  **Estado Limpio**: Si es posible, toma la captura sin menús desplegables abiertos que tapen el contenido, a menos que eso sea parte de lo que quieres mostrar.

---

## 📝 Ejemplo de Uso

**Usuario:** "Enséñame cómo quedó el nuevo layout de Ventas."

**Agente Antigravity:**
1.  Activa el `browser_subagent`.
2.  Navega a la vista de ventas.
3.  Toma la captura.
4.  Responde: "Aquí tienes la captura del nuevo layout de Ventas. Como puedes ver, ahora ocupa todo el ancho y el header se mantiene fijo." (Muestra la imagen).
