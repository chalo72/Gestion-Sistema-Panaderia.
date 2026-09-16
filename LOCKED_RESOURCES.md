# LOCKED_RESOURCES.md

Archivos críticos de este proyecto (raíz y `app/`). Cualquier agente (Claude, Cursor, Antigravity) debe leer este archivo antes de editar, y **requiere que el usuario escriba "AUTORIZO" explícitamente** antes de modificar cualquiera de estos:

- `src/App.tsx`, `app/src/App.tsx`
- `src/main.tsx`, `app/src/main.tsx`
- `src/index.css`, `app/src/index.css`
- `src/contexts/AuthContext.tsx`, `app/src/contexts/AuthContext.tsx`
- `src/hooks/usePriceControl.ts`, `app/src/hooks/usePriceControl.ts`
- `src/lib/database.ts`, `app/src/lib/database.ts`
- `src/lib/supabase-db.ts`, `app/src/lib/supabase-db.ts`
- `vite.config.ts`, `app/vite.config.ts`
- `tailwind.config.js`, `app/tailwind.config.js`
- `package.json`, `app/package.json`
- `vercel.json`, `app/vercel.json`

Fuente: lista original en `CLAUDE.md` (raíz y `app/`), sección "Archivos Protegidos". Este archivo existe para que el protocolo de inicio de sesión (leer `LOCKED_RESOURCES.md` antes de tocar código) tenga algo real que leer — antes no existía pese a estar referenciado.

Ver también `CORE_MEMORY.md` para el estado actual del proyecto y el protocolo de coordinación entre agentes.
src/components/prepedidos/ProveedorCatalogoTactico.tsx
