---
name: puente-auditoria-telemetria
description: Habilidad superior para crear un puente (webhook) en tiempo real entre la aplicación del cliente (frontend) y el Agente IA, permitiendo reacciones autónomas e inmediatas a errores y fraudes.
---

# 🌉 Puente de Auditoría y Telemetría (Ojo de la IA)

## 📌 Propósito Central
Esta Habilidad Superior permite que la Inteligencia Artificial (NEXUS/JARVIS/Antigravity) deje de estar "ciega" a los eventos que ocurren en el navegador del usuario final. En lugar de depender de capturas de pantalla, establece un **Webhook Daemon** local que escucha incidentes, errores y auditorías (`rrweb`) enviados desde el frontend, y los reporta instantáneamente a la terminal de la IA.

**Cuándo activar esta habilidad:**
- Cuando el Director pide: "Configura la telemetría", "Quiero que veas los errores en vivo", "Activa el puente de Auditoría" o "Aplica el webhook para errores".
- En proyectos nuevos donde se necesite que la IA intercepte excepciones de React, alertas de fraude o desconexiones de Firebase en tiempo real.

---

## ⚙️ Protocolo de Implementación en 3 Pasos

### PASO 1: Creación del Servidor Webhook (Backend Local)
Crea un archivo llamado `webhook-auditoria.cjs` (o `.js` según el entorno) en la raíz del proyecto con un servidor HTTP ligero:

```javascript
const http = require('http');
const PORT = 3005;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  if (req.method === 'POST' && req.url === '/api/alert') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        console.log(`\n🚨 [ALERTA TELEMETRÍA] 🚨\nASUNTO: ${data.asunto || data.tipoIncidente}\nDETALLE: ${data.descripcion}\n`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'recibido' }));
      } catch (err) {
        console.error('Error parseando webhook:', err);
        res.writeHead(400); res.end('Bad Request');
      }
    });
  } else {
    res.writeHead(404); res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`[TELEMETRÍA IA] Escuchando incidentes en puerto ${PORT}...`);
});
```

### PASO 2: Inyección en el Frontend (El Sensor)
Modifica el sistema de registro de errores o incidentes (ej. `security-agent.ts`, `App.tsx` o `ErrorBoundary`) para disparar el Webhook sin bloquear el flujo principal:

```typescript
// Enviar alerta en segundo plano a la terminal de la IA
fetch('http://localhost:3005/api/alert', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(tuObjetoDeIncidenteOError)
}).catch(() => { /* Silencioso en caso de estar offline */ });
```

### PASO 3: Ejecución como Daemon
Usa tu herramienta `run_command` con el parámetro `IsDaemon: true` para levantar el webhook en segundo plano. Esto garantiza que la salida estándar (`stdout`) genere alertas directas en tu chat sin bloquear el hilo principal.

```bash
node webhook-auditoria.cjs
```

---

## 🛡️ Reglas de Operación
1. **Reacción Inmediata:** Cuando el daemon imprima `🚨 [ALERTA TELEMETRÍA]`, asume la persona del sistema de protección y alerta inmediatamente al usuario sobre lo que acaba de ocurrir en su aplicación, explicando el error o el intento de fraude reportado.
2. **Cero Dependencias Adicionales:** Usa el módulo nativo `http` de Node.js. No instales `express` ni otras librerías innecesarias a menos que el proyecto ya las tenga.
3. **Resistencia a Errores:** El `fetch` del cliente SIEMPRE debe llevar un `.catch(() => {})` vacío. Si el webhook de la IA está apagado, la aplicación de producción del usuario NO debe colapsar ni mostrar errores por consola.
