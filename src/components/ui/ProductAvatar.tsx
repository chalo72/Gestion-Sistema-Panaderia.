/**
 * ProductAvatar — Imagen profesional de producto / categoría
 *
 * Técnica: fondo borroso del emoji + emoji nítido encima + gradiente suave.
 * Sin caricaturas. Resultado: aspecto "casi real", estilo Rappi/Uber Eats.
 *
 * Los emojis de alimentos en iOS/Android/macOS son fotorrealistas.
 * En Windows se ven un poco más planos pero aun así profesionales.
 */

/** Mapa categoría → { emoji, gradiente (dos colores Tailwind) } */
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
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quitar tildes para comparación
    .trim();

  // Búsqueda directa
  for (const [k, v] of Object.entries(CATEGORIA_AVATAR)) {
    const kNorm = k.normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (kNorm === key) return v;
  }

  // Búsqueda parcial (si la clave está contenida en la categoría o viceversa)
  for (const [k, v] of Object.entries(CATEGORIA_AVATAR)) {
    const kNorm = k.normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (key.includes(kNorm) || kNorm.includes(key)) return v;
  }

  // Fallback inteligente por palabras clave
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
}

export function ProductAvatar({ imagen, nombre, categoria = '', emoji, color, className = '', hover }: ProductAvatarProps) {
  if (imagen) {
    return (
      <div className={`w-full h-full overflow-hidden ${className}`}>
        <img
          src={imagen}
          alt={nombre || categoria}
          className={`w-full h-full object-cover transition-transform duration-500 ${hover ? 'scale-110' : 'scale-100'}`}
        />
      </div>
    );
  }

  const cfg = getAvatarConfig(categoria);
  const finalEmoji = emoji || cfg.emoji;

  return (
    <div
      className={`relative w-full h-full overflow-hidden flex items-center justify-center ${className}`}
      style={{ background: `linear-gradient(135deg, ${cfg.from} 0%, ${cfg.to} 100%)` }}
    >
      {/* Fondo borroso del emoji — efecto "bokeh" profesional */}
      <span
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center select-none pointer-events-none"
        style={{
          fontSize: '6rem',
          filter: 'blur(20px)',
          opacity: 0.35,
          transform: 'scale(1.5)',
        }}
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

      {/* Gradiente overlay inferior para profundidad */}
      <div
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
        style={{
          fontSize: '5rem',
          filter: 'blur(18px)',
          opacity: 0.25,
          transform: 'scale(1.8) translateY(10px)',
        }}
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
