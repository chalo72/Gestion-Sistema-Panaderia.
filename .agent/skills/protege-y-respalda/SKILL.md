---
name: protege-y-respalda
description: >
  Habilidad de protección total y respaldo automático del proyecto.
  Se activa cuando el usuario dice "PROTEGE". Bloquea todo el código funcional para que no se modifique
  sin permiso, y ejecuta respaldo automático en Git, Docker/Dokploy y Supabase.
  Cada vez que se hacen cambios, mejoras o reparaciones en la app, se actualizan las copias de seguridad
  en las 3 plataformas automáticamente.
  Palabras clave: protege, proteger, backup, respaldo, seguridad, bloquear, git, docker, dokploy, supabase.
---

# 🛡️ PROTEGE Y RESPALDA — Habilidad de Protección Total

Cuando el usuario dice **"PROTEGE"**, esta habilidad se activa y ejecuta 2 acciones:

1. **BLOQUEA** todo el código funcional (no se toca sin permiso)
2. **RESPALDA** en Git + Docker/Dokploy + Supabase

---

## 🔒 PARTE 1: PROTECCIÓN DE CÓDIGO

### Trigger
El usuario dice: `protege`, `proteger`, `bloquea`, `no toques`

### Protocolo de Bloqueo

#### Paso 1: Leer LOCKED_RESOURCES.md
Antes de CUALQUIER edición de archivo, el agente DEBE leer:
```
ROOT/LOCKED_RESOURCES.md
```

#### Paso 2: Verificar si el archivo está protegido
- Si el archivo aparece en LOCKED_RESOURCES.md → **BLOQUEADO**
- Si el directorio padre aparece → **BLOQUEADO**
- Si es un archivo `ui/` de shadcn → **SIEMPRE BLOQUEADO**

#### Paso 3: Si está bloqueado
```
⛔ PROTECCIÓN ACTIVA: El archivo [nombre] está PROTEGIDO.
   No puedo modificarlo sin tu permiso explícito.
   
   ¿Por qué necesitaría cambiarlo? [explicación]
   ¿Riesgo de regresión? [análisis]
   
   Escribe "AUTORIZO" para desbloquear temporalmente.
```

#### Paso 4: Si el usuario autoriza
- Hacer el cambio mínimo necesario
- Verificar que compile (`npx tsc --noEmit`)
- Verificar que el build funcione (`npx vite build`)
- Re-bloquear el archivo inmediatamente

### Reglas Inquebrantables de Protección
1. **NUNCA** modificar un archivo bloqueado sin pedir permiso
2. **NUNCA** eliminar archivos bloqueados
3. **NUNCA** renombrar archivos bloqueados
4. **NUNCA** cambiar imports/exports de archivos bloqueados
5. **Preferir COMPOSICIÓN**: Crear archivos nuevos que envuelvan los bloqueados
6. **Preferir EXTENSIÓN**: Crear hooks/componentes nuevos en vez de editar los existentes

---

## 💾 PARTE 2: RESPALDO AUTOMÁTICO (3 PLATAFORMAS)

### Trigger
Se ejecuta AUTOMÁTICAMENTE cada vez que:
- Se completa un cambio exitoso en la app
- El usuario dice `protege`, `guarda`, `respalda`, `backup`
- Se hace build exitoso
- Se corrige un bug
- Se agrega una funcionalidad nueva

### Plataforma 1: GIT (GitHub)
```bash
# Secuencia de respaldo Git
cd app/
git add -A
git commit -m "backup: [descripción del cambio] — $(date)"
git push origin main
```

**Reglas Git:**
- Mensaje de commit descriptivo SIEMPRE
- Push inmediato después de cada commit
- Verificar que el push fue exitoso
- Si falla el push → reintentar 1 vez → si falla, notificar al usuario

### Plataforma 2: DOCKER / DOKPLOY
```bash
# Construir imagen Docker actualizada
docker build -t dulce-placer-app:latest .
docker tag dulce-placer-app:latest dulce-placer-app:backup-$(date +%Y%m%d)

# Si hay registry configurado:
docker push [REGISTRY]/dulce-placer-app:latest
```

**Reglas Docker:**
- Usar el Dockerfile en la raíz del proyecto
- Siempre tagear con `latest` + fecha
- El Dockerfile debe generar una imagen de producción optimizada
- Si Dokploy está configurado, hacer deploy automático

### Plataforma 3: SUPABASE (Base de Datos)
```sql
-- Verificar que las tablas existen y están sincronizadas
-- El schema consolidado está en: consolidated_schema.sql
```

**Reglas Supabase:**
- Verificar conexión antes de cualquier operación
- Si hay cambios en el schema, ejecutar migraciones
- Las credenciales están en .env (NUNCA en código)
- Verificar que las políticas RLS estén activas

---

## 📋 SECUENCIA COMPLETA "PROTEGE"

Cuando el usuario dice **PROTEGE**, ejecutar en este orden:

```
PASO 1: 🔍 ESCANEO
  → Verificar que TypeScript compila sin errores
  → Verificar que el build de producción funciona
  → Listar todos los archivos funcionales

PASO 2: 🔒 BLOQUEO
  → Actualizar LOCKED_RESOURCES.md con TODOS los archivos funcionales
  → Marcar fecha y hora del bloqueo

PASO 3: 💾 GIT
  → git add -A
  → git commit -m "shield: protección activada — [fecha]"  
  → git push origin main
  → Verificar push exitoso

PASO 4: 🐳 DOCKER
  → Verificar/crear Dockerfile si no existe
  → docker build -t dulce-placer-app:latest .
  → docker tag con fecha de backup

PASO 5: 🗄️ SUPABASE
  → Verificar conexión a Supabase
  → Verificar que todas las tablas existen
  → Confirmar schema sincronizado

PASO 6: ✅ REPORTE
  → Mostrar tabla resumen:
    | Plataforma | Estado | Detalle |
    |------------|--------|---------|
    | Git        | ✅/❌  | commit hash |
    | Docker     | ✅/❌  | imagen tag  |
    | Supabase   | ✅/❌  | tablas OK   |
    | Bloqueo    | ✅     | X archivos  |
```

---

## 🔄 RESPALDO CONTINUO

Después de CADA cambio exitoso en la app (no solo cuando dice "protege"):

1. **Commit automático** a Git con mensaje descriptivo
2. **Push** a GitHub
3. **Notificar** al usuario: "✅ Cambios guardados en Git [hash]"

Para Docker y Supabase, solo se actualizan cuando:
- El usuario dice "protege" explícitamente
- Se hace un build de producción exitoso
- Se modifican tablas o schema de base de datos

---

## 🚨 RECUPERACIÓN DE EMERGENCIA

Si algo se rompe después de un cambio:

```bash
# Opción 1: Restaurar desde Git
git log --oneline -10        # Ver commits recientes
git checkout [hash] -- .     # Restaurar todo a ese punto

# Opción 2: Restaurar desde Docker
docker run -p 5173:80 dulce-placer-app:backup-[fecha]

# Opción 3: Restaurar schema Supabase
# Ejecutar consolidated_schema.sql en SQL Editor
```

---

## 📝 EJEMPLO DE USO

**Usuario dice:** "protege"

**Agente ejecuta:**
```
🛡️ PROTECCIÓN ACTIVADA — Ejecutando secuencia completa...

🔍 Escaneo: TypeScript ✅ | Build ✅ | 140+ archivos funcionales
🔒 Bloqueo: LOCKED_RESOURCES.md actualizado (140 archivos protegidos)  
💾 Git: Commit abc1234 → Push a origin/main ✅
🐳 Docker: dulce-placer-app:latest + backup-20260318 ✅
🗄️ Supabase: 12 tablas verificadas, conexión OK ✅

✅ PROTECCIÓN TOTAL ACTIVADA
   → Código bloqueado: 140 archivos
   → Git: github.com/chalo72/Gestion-Sistema-Panaderia..git
   → Docker: dulce-placer-app:backup-20260318
   → Supabase: 12 tablas sincronizadas
```

---

**Estado**: 🛡️ ACTIVA
**Versión**: 1.0.0
**Creada**: 2026-03-18
