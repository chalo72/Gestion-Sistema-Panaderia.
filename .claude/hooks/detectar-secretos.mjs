// PreToolUse (Edit|Write|MultiEdit): pide confirmación si lo que se va a escribir
// contiene algo con forma de clave o token real en texto plano.
import { readFileSync } from 'node:fs';
import path from 'node:path';

const PATRONES = [
  { nombre: 'token de Facebook', re: /EAA[A-Za-z0-9]{20,}/g },
  { nombre: 'clave de OpenAI/Anthropic', re: /sk-[A-Za-z0-9_-]{20,}/g },
  { nombre: 'clave de Google', re: /AIza[0-9A-Za-z_-]{30,}/g },
  { nombre: 'token JWT', re: /eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}(?:\.[A-Za-z0-9_-]+)?/g },
];

// Nunca mostrar el secreto completo en el aviso: solo el inicio.
const enmascarar = (s) => `${s.slice(0, 8)}…(${s.length} caracteres)`;

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const t = input.tool_input || {};
  const texto = [
    t.content,
    t.new_string,
    ...(Array.isArray(t.edits) ? t.edits.map((e) => e?.new_string) : []),
  ].filter((x) => typeof x === 'string').join('\n');
  if (!texto) process.exit(0);

  const hallazgos = [];
  for (const { nombre, re } of PATRONES) {
    const encontrados = [...new Set(texto.match(re) || [])];
    if (encontrados.length) hallazgos.push(`${nombre}: ${encontrados.map(enmascarar).join(', ')}`);
  }
  if (!hallazgos.length) process.exit(0);

  const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const archivo = t.file_path
    ? path.relative(root, path.resolve(root, t.file_path)).replace(/\\/g, '/')
    : '(archivo desconocido)';

  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason:
        `🔑 Posible clave/token real en texto plano en ${archivo} → ${hallazgos.join(' · ')}. ` +
        `Solo aprobá si es falso o si ese archivo nunca se va a subir al repo.`,
    },
  }));
} catch {
  // Si el hook falla no bloquea el trabajo.
  process.exit(0);
}
