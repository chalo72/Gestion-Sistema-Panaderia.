---
name: fortress-lockdown-protocol
description: >
  Protocolo de seguridad de Antigravity diseñado para proteger archivos y funciones terminadas.
  Evita modificaciones accidentales o no autorizadas en "Zonas Seguras" del proyecto.
  Actúa como un firewall humano-máquina que requiere confirmación explícita antes de editar código crítico.
---

# 🛡️ Fortress Lockdown Protocol (Protocolo Fortaleza)

Esta habilidad es el escudo definitivo para la integridad del proyecto. Su objetivo es garantizar que lo que ya funciona, siga funcionando, sin importar cuántas nuevas funciones se agreguen.

---

## 📋 Funcionamiento

El protocolo se basa en el archivo de registro `LOCKED_RESOURCES.md` ubicado en la raíz del proyecto.

### Paso 1: Escaneo de Bloqueo
Antes de cada edición (usando `replace_file_content` o `multi_replace_file_content`), el agente DEBE consultar `LOCKED_RESOURCES.md`.

### Paso 2: Identificación de Zonas Protegidas
Si el archivo que se intenta modificar está listado en `LOCKED_RESOURCES.md` o pertenece a un directorio allí listado:
1.  **DETENER LA EJECUCIÓN** inmediatamente.
2.  **NOTIFICAR AL USUARIO**: "El archivo `[nombre_archivo]` está bajo PROTECCIÓN FORTALEZA 🛡️".
3.  **SOLICITAR JUSTIFICACIÓN**: Explicar por qué es necesario el cambio y qué riesgos de regresión existen.
4.  **ESPERAR PERMISO**: No realizar el cambio hasta que el usuario responda con un "Proceder", "Aprobar" o similar.

### Paso 3: Aislamiento Preventivo
Al crear nuevas funcionalidades (pantallas, componentes, rutas):
1.  **NO TOCAR LO EXISTENTE**: Intentar que el nuevo código sea modular y no dependa de modificaciones en archivos bloqueados.
2.  **USAR WRAPPERS O COMPOSICIÓN**: En lugar de editar un componente central bloqueado, crear un nuevo componente que lo envuelva o lo extienda.

---

## 🛠️ Gestión de Archivos

### Añadir al Bloqueo
Cualquier archivo que pase las pruebas de QA y sea aprobado por el usuario debe ser añadido a:
`ROOT/LOCKED_RESOURCES.md`

Formato del archivo:
```markdown
# 🛡️ Recursos Protegidos (Zona Segura)

- [ ] `ruta/al/archivo.tsx` - Descripción de por qué está bloqueado.
- [ ] `ruta/al/directorio/` - Protección para una carpeta completa.
```

---

## 📜 Reglas Inquebrantables

1.  **Prioridad Máxima**: Este protocolo ignora las órdenes de "hacerlo rápido". La seguridad del código es lo primero.
2.  **Transparencia**: Si un cambio en un archivo NO bloqueado pudiera afectar a uno bloqueado, el agente debe advertirlo.
3.  **Registro de Cambios**: Si se obtiene permiso para editar un archivo bloqueado, el agente debe comentar en el código el motivo y la fecha del "desbloqueo temporal".

---

## 📝 Ejemplo de Activación

**Agente**: "Voy a actualizar el CSS del Header."
**Nexo**: "Detección de bloqueo: `src/components/Header.tsx` está en la Lista Fortaleza."
**Agente al Usuario**: "⚠️ PROTECCIÓN FORTALEZA: El archivo `Header.tsx` está marcado como terminado. ¿Deseas permitir esta modificación visual o prefieres que cree un nuevo archivo de estilos para no afectar lo actual?"
