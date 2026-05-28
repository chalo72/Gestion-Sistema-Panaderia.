/**
 * ProductAvatar — Imagen profesional de producto / categoría
 *
 * 3 ESTILOS:
 *   bokeh   — Emoji borroso de fondo + emoji nítido + gradiente cálido (Rappi/Uber Eats)
 *   cristal — Fondo claro con sombra de color bajo el emoji. Limpio y moderno.
 *   noche   — Fondo oscuro #0f172a + glow neón del color de categoría.
 *
 * Los emojis de alimentos en iOS/Android/macOS son fotorrealistas.
 * En Windows se ven un poco más planos pero aún así profesionales.
 */

import { useEffect, useMemo, useReducer } from 'react';

// ─────────────────────────────────────────────────────────────────
// Estilos disponibles
// ─────────────────────────────────────────────────────────────────
export type AvatarStyle = 'bokeh' | 'cristal' | 'noche';

// ─────────────────────────────────────────────────────────────────
// Persistencia de preferencias en localStorage
// ─────────────────────────────────────────────────────────────────
const PREFS_KEY = 'ag_avatar_prefs';

export type AvatarPrefs = Record<string, { style?: AvatarStyle; imagen?: string }>;

export function getAvatarPrefs(): AvatarPrefs {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); } catch { return {}; }
}

export function setAvatarPref(
  productoId: string,
  pref: Partial<{ style: AvatarStyle; imagen: string | undefined }>
) {
  const prefs = getAvatarPrefs();
  const merged = { ...(prefs[productoId] || {}), ...pref };
  if (merged.imagen === undefined) delete merged.imagen;
  if (merged.style === undefined) delete merged.style;
  const updated = { ...prefs };
  if (Object.keys(merged).length === 0) delete updated[productoId];
  else updated[productoId] = merged;
  localStorage.setItem(PREFS_KEY, JSON.stringify(updated));
  window.dispatchEvent(new Event('avatar-prefs-changed'));
}

// ─────────────────────────────────────────────────────────────────
// Mapa categoría → { emoji, gradiente, color texto }
// ─────────────────────────────────────────────────────────────────
export const CATEGORIA_AVATAR: Record<string, { emoji: string; from: string; to: string; text: string }> = {
  // ── Panadería ──────────────────────────────────────────────────
  'panes':                   { emoji: '🥖', from: '#f59e0b', to: '#d97706', text: '#7c2d12' },
  'pan caliente':            { emoji: '🥐', from: '#fbbf24', to: '#f59e0b', text: '#7c2d12' },
  'insumos panadería':       { emoji: '🌾', from: '#fde68a', to: '#fbbf24', text: '#78350f' },
  'ins: panadería':          { emoji: '🌾', from: '#fde68a', to: '#fbbf24', text: '#78350f' },
  'ins panadería':           { emoji: '🌾', from: '#fde68a', to: '#fbbf24', text: '#78350f' },
  'harinas y materia prima': { emoji: '🌾', from: '#fef3c7', to: '#fde68a', text: '#78350f' },
  'harinas':                 { emoji: '🌾', from: '#fef3c7', to: '#fde68a', text: '#78350f' },
  'levaduras y aditivos':    { emoji: '🧪', from: '#e0e7ff', to: '#c7d2fe', text: '#3730a3' },

  // ── Tortas y Repostería ────────────────────────────────────────
  'tortas decoradas':        { emoji: '🎂', from: '#fce7f3', to: '#fbcfe8', text: '#9d174d' },
  'tortas sin decorar':      { emoji: '🍰', from: '#fce7f3', to: '#fbcfe8', text: '#9d174d' },
  'tortas':                  { emoji: '🎂', from: '#fce7f3', to: '#fbcfe8', text: '#9d174d' },
  'ins: tortas':             { emoji: '🍰', from: '#fce7f3', to: '#fbcfe8', text: '#9d174d' },
  'pastelería':              { emoji: '🧁', from: '#f5d0fe', to: '#e879f9', text: '#701a75' },
  'repostería':              { emoji: '🧁', from: '#f5d0fe', to: '#e879f9', text: '#701a75' },

  // ── Bebidas ────────────────────────────────────────────────────
  'bebidas calientes':       { emoji: '☕', from: '#fef3c7', to: '#b45309', text: '#451a03' },
  'bebidas':                 { emoji: '🥤', from: '#dbeafe', to: '#93c5fd', text: '#1e40af' },
  'micheladas':              { emoji: '🍺', from: '#fef08a', to: '#facc15', text: '#713f12' },
  'ins: micheladas':         { emoji: '🍋', from: '#fef9c3', to: '#fde047', text: '#713f12' },
  'ins: bebidas preparadas': { emoji: '🧃', from: '#dcfce7', to: '#86efac', text: '#14532d' },
  'big cola':                { emoji: '🫙', from: '#fee2e2', to: '#fca5a5', text: '#7f1d1d' },
  'postobón':                { emoji: '🥤', from: '#fee2e2', to: '#fb923c', text: '#7c2d12' },
  'postobon':                { emoji: '🥤', from: '#fee2e2', to: '#fb923c', text: '#7c2d12' },
  'pool':                    { emoji: '🧋', from: '#e0f2fe', to: '#7dd3fc', text: '#0c4a6e' },
  'ponys malta':             { emoji: '🍫', from: '#fef3c7', to: '#d97706', text: '#451a03' },
  'cocacola':                { emoji: '🥤', from: '#fee2e2', to: '#b91c1c', text: '#fff' },
  'qualla':                  { emoji: '🫙', from: '#f0fdf4', to: '#86efac', text: '#14532d' },

  // ── Alimentos ─────────────────────────────────────────────────
  'lácteos y huevos':        { emoji: '🥛', from: '#f0f9ff', to: '#bae6fd', text: '#075985' },
  'lácteos':                 { emoji: '🥛', from: '#f0f9ff', to: '#bae6fd', text: '#075985' },
  'ins huevos':              { emoji: '🥚', from: '#fef9c3', to: '#fde68a', text: '#78350f' },
  'frutas':                  { emoji: '🍎', from: '#dcfce7', to: '#4ade80', text: '#14532d' },
  'dulces(golosina)':        { emoji: '🍬', from: '#fce7f3', to: '#f9a8d4', text: '#831843' },
  'dulces':                  { emoji: '🍬', from: '#fce7f3', to: '#f9a8d4', text: '#831843' },
  'snacks':                  { emoji: '🥨', from: '#fff7ed', to: '#fed7aa', text: '#7c2d12' },
  'fritos':                  { emoji: '🍟', from: '#fef9c3', to: '#fde047', text: '#78350f' },
  'electrónica':             { emoji: '🔋', from: '#f1f5f9', to: '#cbd5e1', text: '#334155' },
  'papelería':               { emoji: '📋', from: '#f0f9ff', to: '#bae6fd', text: '#0c4a6e' },

  // ── Proveedores (marcas) ───────────────────────────────────────
  'alpina':                  { emoji: '🥛', from: '#eff6ff', to: '#93c5fd', text: '#1e3a8a' },
  'alquería / gloria':       { emoji: '🧈', from: '#fef9c3', to: '#fde047', text: '#78350f' },
  'avena costa azul':        { emoji: '🥣', from: '#dbeafe', to: '#60a5fa', text: '#1e40af' },
  'avena sinuano':           { emoji: '🥣', from: '#dcfce7', to: '#4ade80', text: '#166534' },
  'bimbo':                   { emoji: '🍞', from: '#fff7ed', to: '#fb923c', text: '#7c2d12' },
  'mekatos':                 { emoji: '🍿', from: '#fef3c7', to: '#fbbf24', text: '#78350f' },
  'azúcares y endulzantes':  { emoji: '🍯', from: '#fef3c7', to: '#fbbf24', text: '#78350f' },
  'helado empaque':          { emoji: '🍦', from: '#f0f9ff', to: '#e0f2fe', text: '#0369a1' },
  'insumos':                 { emoji: '📦', from: '#f1f5f9', to: '#cbd5e1', text: '#334155' },

  // ── Genérico ──────────────────────────────────────────────────
  'general':                 { emoji: '🛒', from: '#f1f5f9', to: '#94a3b8', text: '#334155' },
  'otro':                    { emoji: '🛍️', from: '#f1f5f9', to: '#94a3b8', text: '#334155' },
};

/** Busca config de categoría ignorando mayúsculas, tildes y espacios extra */
function getAvatarConfig(categoria: string) {
  const key = categoria.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .trim();

  for (const [k, v] of Object.entries(CATEGORIA_AVATAR)) {
    const kNorm = k.normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (kNorm === key) return v;
  }
  for (const [k, v] of Object.entries(CATEGORIA_AVATAR)) {
    const kNorm = k.normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (key.includes(kNorm) || kNorm.includes(key)) return v;
  }

  if (key.includes('pan') || key.includes('bread')) return CATEGORIA_AVATAR['panes'];
  if (key.includes('torta') || key.includes('cake')) return CATEGORIA_AVATAR['tortas'];
  if (key.includes('bebida') || key.includes('drink')) return CATEGORIA_AVATAR['bebidas'];
  if (key.includes('leche') || key.includes('lacteo')) return CATEGORIA_AVATAR['lácteos'];
  if (key.includes('dulce') || key.includes('candy')) return CATEGORIA_AVATAR['dulces'];
  if (key.includes('insumo') || key.includes('materia')) return CATEGORIA_AVATAR['insumos'];

  return { emoji: '🛒', from: '#f1f5f9', to: '#94a3b8', text: '#334155' };
}

// ─────────────────────────────────────────────────────────────────
// ProductAvatar — para tarjetas de producto individuales
// ─────────────────────────────────────────────────────────────────
interface ProductAvatarProps {
  /** URL de imagen real si el producto tiene foto */
  imagen?: string;
  /** Nombre del producto (fallback si no hay imagen) */
  nombre?: string;
  /** Categoría del producto */
  categoria?: string;
  /** Emoji explícito del sistema de categorías */
  emoji?: string;
  /** Color explícito del sistema de categorías */
  color?: string;
  /** Clases extra para el contenedor */
  className?: string;
  /** Si se está viendo en modo hover/seleccionado */
  hover?: boolean;
  /** ID del producto → carga prefs guardadas automáticamente */
  productoId?: string;
  /** Forzar un estilo (para preview en el configurador — no se guarda) */
  forceStyle?: AvatarStyle;
  /** Forzar una imagen (para preview en el configurador — no se guarda) */
  forceImagen?: string;
}

export function ProductAvatar({
  imagen, nombre, categoria = '', emoji, color, className = '',
  hover, productoId, forceStyle, forceImagen
}: ProductAvatarProps) {
  // Escucha cambios de prefs para re-renderizar automáticamente
  const [tick, forceUpdate] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    if (!productoId) return;
    const handler = () => forceUpdate();
    window.addEventListener('avatar-prefs-changed', handler);
    return () => window.removeEventListener('avatar-prefs-changed', handler);
  }, [productoId]);

  // Cargar preferencias guardadas para este producto
  const pref = useMemo(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tick forces refresh
    void tick;
    if (forceStyle !== undefined || forceImagen !== undefined) {
      return { style: forceStyle, imagen: forceImagen };
    }
    if (!productoId) return null;
    return getAvatarPrefs()[productoId] || null;
  }, [productoId, forceStyle, forceImagen, tick]);

  const finalImagen = pref?.imagen || imagen;
  const style: AvatarStyle = pref?.style || 'bokeh';

  if (finalImagen) {
    return (
      <div className={`w-full h-full overflow-hidden ${className}`}>
        <img
          src={finalImagen}
          alt={nombre || categoria}
          className={`w-full h-full object-cover transition-transform duration-500 ${hover ? 'scale-110' : 'scale-100'}`}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      </div>
    );
  }

  const cfg = getAvatarConfig(categoria);
  const finalEmoji = emoji || cfg.emoji;

  // ── Estilo CRISTAL ──────────────────────────────────────────
  if (style === 'cristal') {
    return (
      <div
        className={`relative w-full h-full overflow-hidden flex items-center justify-center ${className}`}
        style={{ background: `linear-gradient(145deg, #f8fafc 0%, ${cfg.from}75 100%)` }}
      >
        {/* Radial glow suave al centro */}
        <div
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div style={{
            width: '65%', height: '65%', borderRadius: '50%',
            background: `radial-gradient(circle, ${cfg.to}30 0%, transparent 70%)`
          }} />
        </div>
        {/* Emoji con sombra de color debajo */}
        <span
          className={`relative z-10 select-none transition-transform duration-500 ${hover ? 'scale-110' : 'scale-100'}`}
          style={{
            fontSize: '2.8rem', lineHeight: 1,
            filter: `drop-shadow(0 6px 14px ${cfg.to}90) drop-shadow(0 2px 4px ${cfg.to}50)`
          }}
        >
          {finalEmoji}
        </span>
        {/* Punto de acento de color */}
        <div
          aria-hidden="true"
          className="absolute bottom-2.5 right-2.5 w-2 h-2 rounded-full pointer-events-none"
          style={{ background: cfg.to, opacity: 0.85 }}
        />
        {/* Borde sutil */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none rounded-[inherit]"
          style={{ boxShadow: `inset 0 0 0 1px ${cfg.to}25` }}
        />
      </div>
    );
  }

  // ── Estilo NOCHE ────────────────────────────────────────────
  if (style === 'noche') {
    return (
      <div
        className={`relative w-full h-full overflow-hidden flex items-center justify-center ${className}`}
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)' }}
      >
        {/* Glow borroso de fondo */}
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center select-none pointer-events-none"
          style={{ fontSize: '5rem', filter: 'blur(24px)', opacity: 0.55, transform: 'scale(1.3)' }}
        >
          {finalEmoji}
        </span>
        {/* Radial neon al centro */}
        <div
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div style={{
            width: '72%', height: '72%', borderRadius: '50%',
            background: `radial-gradient(circle, ${cfg.to}35 0%, transparent 70%)`
          }} />
        </div>
        {/* Emoji con neon glow */}
        <span
          className={`relative z-10 select-none transition-transform duration-500 ${hover ? 'scale-110' : 'scale-100'}`}
          style={{
            fontSize: '2.6rem', lineHeight: 1,
            filter: `drop-shadow(0 0 8px ${cfg.to}) drop-shadow(0 0 20px ${cfg.from}95)`
          }}
        >
          {finalEmoji}
        </span>
      </div>
    );
  }

  // ── Estilo BOKEH (default) ──────────────────────────────────
  return (
    <div
      className={`relative w-full h-full overflow-hidden flex items-center justify-center ${className}`}
      style={{ background: `linear-gradient(135deg, ${cfg.from} 0%, ${cfg.to} 100%)` }}
    >
      {/* Fondo borroso del emoji — bokeh */}
      <span
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center select-none pointer-events-none"
        style={{ fontSize: '6rem', filter: 'blur(20px)', opacity: 0.35, transform: 'scale(1.5)' }}
      >
        {finalEmoji}
      </span>
      {/* Emoji nítido principal */}
      <span
        className={`relative z-10 select-none transition-transform duration-500 drop-shadow-lg ${hover ? 'scale-110' : 'scale-100'}`}
        style={{ fontSize: '2.5rem', lineHeight: 1 }}
      >
        {finalEmoji}
      </span>
      {/* Gradiente overlay inferior */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-1/3 pointer-events-none"
        style={{ background: `linear-gradient(to top, ${cfg.to}60, transparent)` }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// CategoriaAvatar — para tarjetas de categoría (más grandes)
// ─────────────────────────────────────────────────────────────────
interface CategoriaAvatarProps {
  nombre: string;
  emoji?: string;
  color?: string;
  count?: number;
  className?: string;
  selected?: boolean;
  onClick?: () => void;
}

export function CategoriaAvatar({ nombre, emoji, color, count, className = '', selected, onClick }: CategoriaAvatarProps) {
  const cfg = getAvatarConfig(nombre);
  const finalEmoji = emoji && emoji !== '📦' ? emoji : cfg.emoji;
  const fromColor = color ? `${color}25` : cfg.from;
  const toColor = color ? `${color}50` : cfg.to;

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl flex flex-col items-center justify-center gap-2 p-3 transition-all duration-300 cursor-pointer
        ${selected ? 'ring-2 ring-offset-1 shadow-lg scale-[0.98]' : 'hover:scale-[1.03] hover:shadow-md active:scale-95'}
        ${className}`}
      style={{
        background: `linear-gradient(145deg, ${fromColor} 0%, ${toColor} 100%)`,
      }}
    >
      {/* Fondo borroso del emoji */}
      <span
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center select-none pointer-events-none"
        style={{ fontSize: '5rem', filter: 'blur(18px)', opacity: 0.25, transform: 'scale(1.8) translateY(10px)' }}
      >
        {finalEmoji}
      </span>

      {/* Emoji principal */}
      <span
        className="relative z-10 select-none drop-shadow-md transition-transform duration-300 group-hover:scale-110"
        style={{ fontSize: '2rem', lineHeight: 1 }}
      >
        {finalEmoji}
      </span>

      {/* Nombre */}
      <p
        className="relative z-10 text-[10px] font-black uppercase tracking-tight text-center leading-tight line-clamp-2 px-1"
        style={{ color: cfg.text }}
      >
        {nombre}
      </p>

      {/* Contador */}
      {count !== undefined && (
        <span
          className="relative z-10 text-[9px] font-black px-2 py-0.5 rounded-full"
          style={{ background: `${cfg.to}80`, color: cfg.text }}
        >
          {count} {count === 1 ? 'prod' : 'prods'}
        </span>
      )}
    </div>
  );
}
