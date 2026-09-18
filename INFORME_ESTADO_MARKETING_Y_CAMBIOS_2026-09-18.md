# Informe de estado — Dulce Placer (2026-09-18)

Hecho a partir de: `git log` real del repo (40 commits del 14 al 17 de sept.), lectura completa de los archivos nuevos de Marketing/Monetización, y una revisión de `git status` que encontró un problema aparte que hay que resolver antes de confiar en cualquier diff.

## Resumen en corto

Trabajaste (vos y varios agentes en paralelo) tres frentes en los últimos 4 días: **1)** un módulo nuevo de Marketing con IA, **2)** un tablero de monetización de influencer, y **3)** un montón de mejoras al POS/Caja/Producción/Prepedidos que ya estaban en curso. La parte de Marketing tiene un mix real: la generación de campañas con IA **sí funciona de verdad**, pero el "Radar Viral" y la "Fábrica de Video con N8N" son pantallas que **simulan** resultados sin conectar a nada real — no muestran datos inventados como si fueran reales todavía porque no llegaste a probarlas, pero cuando las uses te van a mentir. Aparte, encontré un problema de fondo en el repo (line endings) que puede arruinar el historial de git si no se toca con cuidado.

---

## 1. Cronología real de lo que se hizo (según los commits)

**14 sept:** arranca el módulo de Marketing Studio (`5dbfde72 feat(marketing): add Marketing Studio AI module`), junto con mejoras de búsqueda/filtros en Ventas, Inventario, Producción, Créditos y Control de Merma, y un cotizador de Pedidos de Tortas/Piñatería.

**15 sept:** un fix importante — `ea0f298b fix: corrige sintaxis rota que bloqueaba todos los despliegues a producción` (o sea, hubo un período donde NADA se podía publicar). También se agregó el Radar Nequi (pagos en tiempo real vía webhook SSE) y se reemplazó WhatsAppHub por el módulo de Consumo Interno/Fiados.

**16 sept:** foco en Caja/POS — arreglo de cajas duplicadas, sesiones múltiples, layout móvil, y protección especial ("shield") para el catálogo de proveedores en Prepedidos.

**17 sept (el más movido):** acá es donde se agregaron Monetización Influencer y el Webhook N8N, y también aparece un commit clave: `1ae2d8e7 fix(sync): merge agent's app/ changes to root (MarketingStudio, MonetizacionInfluencer, n8n) and preserve Gastos/Cajas features` — esto confirma que **dos agentes trabajaron en paralelo sobre copias distintas del proyecto** (la carpeta raíz real vs. una subcarpeta `app/`) y hubo que fusionar a mano para no perder trabajo. Hay un documento de ese incidente: `913e5f87 docs: add critical incident report about UI overwriting and cross-agent app/ vs src/ sync issues` — vale la pena que lo leas si seguís usando varios agentes al tiempo en este proyecto, porque es la causa raíz de por qué aparecían módulos "fantasma" o código que se pisaba solo.

---

## 2. Marketing Studio — qué es real y qué es humo

| Parte | Estado real | Detalle |
|---|---|---|
| Generar Campaña 360° (WhatsApp/Instagram/TikTok/Avatar) | ✅ **Real** | Llama de verdad a `/api/agente` con el agente "influencer". No inventa nada. |
| Botón "Auto-Publicar" a redes | ⚠️ **Real pero no conectado** | Sí hace un `fetch` real a un Webhook de N8N (`localhost:5678` por defecto). El código está bien, pero si no tenés N8N corriendo y configurado, te va a tirar error — no es un bug, es que falta la otra punta. |
| Radar Viral (Tendencias TikTok/YouTube) | ❌ **100% simulado** | El código dice literalmente `// SIMULACIÓN DE CONEXIÓN AL MCP PUPPETEER` y siempre devuelve los mismos 3 videos inventados, no importa qué busques. Nunca se conectó al navegador fantasma real. |
| "Fábrica de Video Automática (N8N)" (subir video, extraer subtítulos, thumbnail) | ❌ **100% decorativo** | El botón "Iniciar Edición IA" solo muestra un mensaje de éxito falso (`toast.success`) — no sube nada, no llama a nada. Es una maqueta visual. |
| Íconos rotos (`Upload`, `RefreshCw`, etc.) | ✅ **Arreglado hoy** | Verificado en el archivo guardado. |

**Importante:** el Radar Viral y la Fábrica de Video no rompen nada (no crashean), pero le van a hacer creer a quien los use que están funcionando cuando no hacen nada real. Como vos mismo pediste que nunca se dejen paneles simulados presentados como reales, marco esto como pendiente de decisión: o se conectan de verdad, o se les pone una etiqueta visible de "próximamente" para que nadie las use pensando que sirven.

## 3. Monetización Influencer — casi todo decorativo

El botón "Sincronizar Redes" es un `setTimeout` de 2.5 segundos que dice "Tablero actualizado con éxito" sin llamar a ninguna API real de TikTok/YouTube. Los 3 KPIs ($0.00, 0 vistas, $0 patrocinio) están honestamente en cero — no fingen tener datos — pero el botón de sincronizar sí miente sobre haber hecho algo. Es, básicamente, una pantalla de espera bien vestida a la que le falta la conexión real a las APIs de TikTok/YouTube (mencionada en el propio texto de la pantalla: "N8N primero debe publicar el primer lote de videos").

## 4. Hallazgo aparte, importante: el repo tiene TODOS los archivos marcados como modificados

Al revisar `git status`, absolutamente cada archivo del proyecto aparece como cambiado — incluyendo archivos que es imposible que hayan tocado hoy, como `button.tsx` de la librería de UI. Verifiqué el diff de ese archivo puntual: son las 62 líneas "cambiadas" pero el contenido es idéntico — es un problema de **fin de línea** (CRLF vs LF), probablemente por haber pasado por Windows y por la carpeta compartida con la terminal remota.

Esto no rompe la app, pero es peligroso: si en algún momento corrés `git add -A` y `git commit` sin darte cuenta, vas a crear un commit gigante que "toca" todo el repositorio sin que haya cambios reales, lo cual complica muchísimo poder revisar el historial después. No lo toqué — es una decisión de configuración de todo el repo, no algo que corresponda arreglar sin que lo autorices, y quería que lo supieras antes de que otro agente decida "limpiarlo" por su cuenta.

## 5. Qué falta para dejar esto realmente terminado

En orden de impacto:

1. **Decidir qué hacer con el Radar Viral y la Fábrica de Video**: conectarlos de verdad (necesitan el servidor MCP de Puppeteer y el flujo de N8N corriendo) o marcarlos claramente como "en desarrollo" en la interfaz para que no engañen a quien los use.
2. **Configurar N8N** (o el sistema que hayas elegido) y la URL real del Webhook — sin eso, "Auto-Publicar" y la sincronización de redes no van a funcionar aunque el código esté bien.
3. **Conectar Monetización Influencer a las APIs reales de TikTok/YouTube** — hoy es solo una maqueta con ceros.
4. **Arreglar los fines de línea del repo** (con cuidado, un cambio controlado, no accidental) para que `git status`/`git diff` vuelvan a ser confiables.
5. **Publicar el fix de hoy** (`PUBLICAR_A_PRODUCCION.bat`) para que el error de "Upload is not defined" deje de verse en producción — esto seguía pendiente la última vez que hablamos.
6. Leer el informe del incidente de sincronización `app/` vs `src/` (commit del 17 sept) para tenerlo claro antes de volver a usar dos agentes en paralelo sobre este proyecto.

---

*Informe generado leyendo el código real y el historial de git — no hay cifras ni resultados inventados en este documento.*
