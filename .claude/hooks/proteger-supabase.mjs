// PreToolUse (MCP Supabase execute_sql | apply_migration): pide confirmación antes de
// correr SQL destructivo o sin condición contra la base real. Lecturas y cambios con
// WHERE pasan sin preguntar.
import { readFileSync } from 'node:fs';

const REGLAS = [
  { nombre: 'DROP TABLE (borra una tabla entera)', test: (s) => /\bDROP\s+TABLE\b/.test(s) },
  { nombre: 'DROP SCHEMA (borra un esquema con todas sus tablas)', test: (s) => /\bDROP\s+SCHEMA\b/.test(s) },
  { nombre: 'DROP FUNCTION (borra una función de la base)', test: (s) => /\bDROP\s+FUNCTION\b/.test(s) },
  { nombre: 'TRUNCATE (vacía la tabla)', test: (s) => /\bTRUNCATE\b/.test(s) },
  {
    nombre: 'ALTER TABLE … DROP (borra una columna)',
    test: (s) => /\bALTER\s+TABLE\b/.test(s) &&
      /\bDROP\s+(COLUMN\b|(?!CONSTRAINT\b|DEFAULT\b|NOT\b|IDENTITY\b|EXPRESSION\b)[\w"]+)/.test(s),
  },
  {
    nombre: 'ALTER TABLE … TYPE (cambia el tipo de una columna)',
    test: (s) => /\bALTER\s+TABLE\b/.test(s) && /\bALTER\s+(COLUMN\s+)?[\w"]+\s+(SET\s+DATA\s+)?TYPE\b/.test(s),
  },
  { nombre: 'DELETE sin WHERE (borra TODAS las filas)', test: (s) => /\bDELETE\s+FROM\b/.test(s) && !/\bWHERE\b/.test(s) },
  {
    nombre: 'UPDATE sin WHERE (cambia TODAS las filas)',
    test: (s) => /\bUPDATE\s+(ONLY\s+)?[\w."]+(\s+(AS\s+)?\w+)?\s+SET\b/.test(s) && !/\bWHERE\b/.test(s),
  },
];

// Quita comentarios y textos entre comillas para no confundir 'DELETE FROM x' dentro de un
// string con una orden real. Luego normaliza a mayúsculas y un solo espacio.
const limpiar = (sql) => sql
  .replace(/--[^\n]*/g, ' ')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/'(?:[^']|'')*'/g, "''")
  .toUpperCase()
  .replace(/\s+/g, ' ');

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const sql = input.tool_input?.query;
  if (typeof sql !== 'string' || !sql.trim()) process.exit(0);

  const hallazgos = [];
  for (const sentencia of limpiar(sql).split(';').map((s) => s.trim()).filter(Boolean)) {
    for (const { nombre, test } of REGLAS) {
      if (test(sentencia)) hallazgos.push(`${nombre}: "${sentencia.slice(0, 80)}${sentencia.length > 80 ? '…' : ''}"`);
    }
  }
  if (!hallazgos.length) process.exit(0);

  const herramienta = (input.tool_name || '').split('__').pop();
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason:
        `🗄️ SQL destructivo contra Supabase REAL (${herramienta}, proyecto ${input.tool_input?.project_id || '?'}) → ` +
        `${hallazgos.join(' · ')}. Esto no se puede deshacer: solo aprobá si hay respaldo y es intencional.`,
    },
  }));
} catch {
  // Si el hook falla no bloquea el trabajo.
  process.exit(0);
}
