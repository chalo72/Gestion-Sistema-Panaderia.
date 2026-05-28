/**
 * AvatarConfigurator — Catálogo interactivo de diseños de avatar
 *
 * Funciones:
 *   1. 3 estilos de diseño: Bokeh · Cristal · Noche
 *   2. Búsqueda automática de imágenes reales (Unsplash Source, sin API key)
 *   3. URL personalizada manual
 *
 * Persistencia: localStorage bajo 'ag_avatar_prefs'.
 */

import { useState, useMemo, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Search, Check, Link2, X, Sparkles, Layers, Moon,
  ImageOff, Star, Camera, RefreshCw, ChevronRight
} from 'lucide-react';
import type { Producto } from '@/types';
import {
  ProductAvatar,
  type AvatarStyle,
  getAvatarPrefs,
  setAvatarPref,
} from '@/components/ui/ProductAvatar';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────
// Traducción de términos de panadería/alimentos ES → EN para Unsplash
// ─────────────────────────────────────────────────────────────────
const FOOD_KEYWORDS: Record<string, string> = {
  // Panes
  'pan':         'fresh bread loaf bakery',
  'panes':       'artisan bread bakery',
  'baguette':    'baguette french bread',
  'croissant':   'croissant pastry butter',
  'arepa':       'arepa corn bread',
  'pandebono':   'cheese bread colombia',
  'almojabana':  'cheese bread colombia',
  'buñuelo':     'fried dough ball',
  'mogolla':     'wheat bread roll',
  'roscón':      'sweet bread ring',
  'pan de bono': 'cheese bread colombia',
  // Tortas y repostería
  'torta':       'cake slice decorated',
  'pastel':      'cake pastry beautiful',
  'cupcake':     'cupcake frosting colorful',
  'ponqué':      'pound cake slice',
  'galleta':     'cookie chocolate chip',
  'brownie':     'brownie chocolate dessert',
  'muffin':      'muffin blueberry fresh',
  'churro':      'churro fried dough sugar',
  'milhojas':    'mille feuille pastry layers',
  // Bebidas
  'café':        'coffee espresso cup',
  'cafe':        'coffee espresso cup',
  'chocolate':   'hot chocolate drink mug',
  'jugo':        'fresh juice fruit glass',
  'limonada':    'lemonade citrus refreshing',
  'malteada':    'milkshake creamy glass',
  'cerveza':     'beer cold glass frothy',
  'agua':        'water glass mineral',
  'gaseosa':     'soda drink cold glass',
  // Lácteos
  'leche':       'milk glass white fresh',
  'yogurt':      'yogurt bowl fresh fruit',
  'queso':       'cheese slice fresh',
  'mantequilla': 'butter bread spread',
  'crema':       'cream dairy fresh',
  // Frutas
  'mango':       'mango tropical fruit fresh',
  'fresas':      'strawberries fresh red',
  'banano':      'banana yellow tropical',
  'naranja':     'orange citrus fresh',
  'manzana':     'apple red fresh',
  'piña':        'pineapple tropical sweet',
  'uva':         'grapes purple fresh',
  // Snacks y dulces
  'papas fritas':'french fries crispy',
  'chips':       'potato chips snack',
  'gomitas':     'gummy candy colorful',
  'caramelo':    'caramel candy sweet',
  'chicle':      'chewing gum candy',
  'helado':      'ice cream scoop cone',
  'paleta':      'ice pop popsicle colorful',
  // Insumos comunes
  'harina':      'flour white powder baking',
  'azucar':      'sugar white granulated',
  'huevo':       'eggs fresh organic',
  'manteca':     'lard fat baking',
  'levadura':    'yeast baking ingredient',
  'sal':         'salt cooking ingredient',
};

/**
 * Construye una query de búsqueda en inglés para Unsplash
 * a partir del nombre y categoría del producto.
 */
function buildSearchQuery(nombre: string, categoria: string): string {
  const txt = (nombre + ' ' + categoria).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');

  // Buscar coincidencia exacta primero
  for (const [key, value] of Object.entries(FOOD_KEYWORDS)) {
    const k = key.normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (txt.includes(k)) return value;
  }

  // Si el nombre tiene palabras en inglés (croissant, brownie, muffin…)
  const englishFoods = ['croissant', 'brownie', 'muffin', 'cookie', 'cupcake', 'pizza',
    'burger', 'sandwich', 'waffle', 'donut', 'bagel', 'pretzel'];
  for (const word of englishFoods) {
    if (txt.includes(word)) return `${word} food bakery`;
  }

  // Fallback: usar el nombre del producto + comida
  const cleanName = nombre.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '').trim();
  return `${cleanName} food bakery`;
}

/**
 * Genera una URL de Unsplash Source sin API key.
 * El parámetro sig hace que cada número devuelva la misma imagen (seed estable).
 */
function unsplashUrl(query: string, sig: number, size = 280): string {
  return `https://source.unsplash.com/${size}x${size}/?${encodeURIComponent(query)}&sig=${sig}`;
}

// ─── Definición de los 3 estilos ──────────────────────────────────
const ESTILOS: Array<{
  id: AvatarStyle;
  label: string;
  desc: string;
  icon: React.ReactNode;
  badge: string;
  badgeCls: string;
}> = [
  {
    id: 'bokeh',
    label: 'Bokeh',
    desc: 'Fondo borroso cálido. Gradiente de la categoría.',
    icon: <Sparkles className="w-3.5 h-3.5" />,
    badge: 'Cálido',
    badgeCls: 'bg-amber-100 text-amber-700',
  },
  {
    id: 'cristal',
    label: 'Cristal',
    desc: 'Fondo claro con sombra de color. Limpio y moderno.',
    icon: <Layers className="w-3.5 h-3.5" />,
    badge: 'Elegante',
    badgeCls: 'bg-sky-100 text-sky-700',
  },
  {
    id: 'noche',
    label: 'Noche',
    desc: 'Fondo oscuro con brillo neón del color de categoría.',
    icon: <Moon className="w-3.5 h-3.5" />,
    badge: 'Impacto',
    badgeCls: 'bg-indigo-100 text-indigo-700',
  },
];

// ─── Panel de búsqueda de imágenes ────────────────────────────────
interface ImageSearchPanelProps {
  producto: Producto;
  onSelectUrl: (url: string) => void;
  currentUrl?: string;
}

function ImageSearchPanel({ producto, onSelectUrl, currentUrl }: ImageSearchPanelProps) {
  const [page, setPage] = useState(0); // cada página muestra 9 imágenes con sig page*9 a page*9+8
  const [loadErrors, setLoadErrors] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadedCount, setLoadedCount] = useState(0);

  const query = useMemo(
    () => buildSearchQuery(producto.nombre, producto.categoria || ''),
    [producto.nombre, producto.categoria]
  );

  const sigs = useMemo(
    () => Array.from({ length: 9 }, (_, i) => page * 9 + i + 1),
    [page]
  );

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    setLoadErrors(new Set());
    setLoading(true);
    setLoadedCount(0);
  };

  const handleImageLoad = () => {
    setLoadedCount(c => {
      const next = c + 1;
      if (next >= sigs.length) setLoading(false);
      return next;
    });
  };

  const handleImageError = (sig: number) => {
    setLoadErrors(prev => new Set(prev).add(sig));
    handleImageLoad();
  };

  return (
    <div className="space-y-3">
      {/* Info de búsqueda */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-slate-400 font-bold">
          🔍 Buscando: <span className="text-indigo-600">"{query}"</span>
        </p>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handlePageChange(Math.max(0, page - 1))}
            disabled={page === 0}
            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-30 flex items-center justify-center transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5 rotate-180" />
          </button>
          <span className="text-[10px] font-black text-slate-500 px-1">
            Pág. {page + 1}
          </span>
          <button
            onClick={() => handlePageChange(page + 1)}
            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { handlePageChange(page); }}
            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors ml-1"
            title="Recargar imágenes"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Grid de imágenes */}
      <div className="grid grid-cols-3 gap-2">
        {sigs.map(sig => {
          const url = unsplashUrl(query, sig);
          const isSelected = currentUrl === url;
          const hasError = loadErrors.has(sig);

          return (
            <button
              key={sig}
              onClick={() => !hasError && onSelectUrl(url)}
              disabled={hasError}
              className={cn(
                'relative aspect-square rounded-xl overflow-hidden border-2 transition-all group',
                isSelected
                  ? 'border-indigo-500 ring-2 ring-indigo-300 ring-offset-1 shadow-md'
                  : hasError
                    ? 'border-slate-200 opacity-40 cursor-not-allowed'
                    : 'border-transparent hover:border-indigo-300 hover:shadow-md active:scale-95'
              )}
            >
              {hasError ? (
                <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                  <ImageOff className="w-5 h-5 text-slate-300" />
                </div>
              ) : (
                <>
                  {/* Skeleton mientras carga */}
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-100 animate-pulse" />
                  <img
                    src={url}
                    alt={`Opción ${sig}`}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                    onLoad={handleImageLoad}
                    onError={() => handleImageError(sig)}
                  />
                  {/* Hover overlay */}
                  {!isSelected && (
                    <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/15 transition-colors flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-white/0 group-hover:bg-white/90 transition-all scale-50 group-hover:scale-100 flex items-center justify-center shadow-md">
                        <Check className="w-4 h-4 text-indigo-600 opacity-0 group-hover:opacity-100" />
                      </div>
                    </div>
                  )}
                  {/* Checkmark si está seleccionada */}
                  {isSelected && (
                    <div className="absolute inset-0 bg-indigo-600/20 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shadow-lg">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Nota de Unsplash */}
      <p className="text-[9px] text-slate-300 text-right leading-tight">
        Imágenes por Unsplash · Uso libre para uso interno
      </p>
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────
interface AvatarConfiguratorProps {
  open: boolean;
  onClose: () => void;
  productos: Producto[];
}

export function AvatarConfigurator({ open, onClose, productos }: AvatarConfiguratorProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Producto | null>(null);
  const [prefs, setPrefsState] = useState(() => getAvatarPrefs());
  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState(false);
  const [urlPreview, setUrlPreview] = useState('');
  const [showImageSearch, setShowImageSearch] = useState(false);

  const filtrados = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return productos;
    return productos.filter(
      p =>
        p.nombre.toLowerCase().includes(q) ||
        (p.categoria || '').toLowerCase().includes(q)
    );
  }, [productos, search]);

  const totalPersonalizados = Object.keys(prefs).length;

  const seleccionar = (p: Producto) => {
    setSelected(p);
    const pref = prefs[p.id];
    setUrlInput(pref?.imagen || '');
    setUrlPreview(pref?.imagen || '');
    setUrlError(false);
    setShowImageSearch(false);
  };

  const aplicarEstilo = (style: AvatarStyle) => {
    if (!selected) return;
    setAvatarPref(selected.id, { style });
    setPrefsState(getAvatarPrefs());
    toast.success(`Diseño "${ESTILOS.find(s => s.id === style)?.label}" aplicado`);
  };

  const aplicarUrl = useCallback((url: string) => {
    if (!selected) return;
    const trimmed = url.trim();
    setAvatarPref(selected.id, { imagen: trimmed || undefined });
    setPrefsState(getAvatarPrefs());
    setUrlInput(trimmed);
    setUrlPreview(trimmed);
    setUrlError(false);
    if (trimmed) toast.success('✅ Imagen guardada');
    else toast.success('🗑️ Imagen eliminada');
  }, [selected]);

  const quitarUrl = () => {
    if (!selected) return;
    setUrlInput('');
    setUrlPreview('');
    setUrlError(false);
    setAvatarPref(selected.id, { imagen: undefined });
    setPrefsState(getAvatarPrefs());
    toast.success('Imagen eliminada');
  };

  const quitarTodo = (productoId: string) => {
    setAvatarPref(productoId, { style: undefined, imagen: undefined });
    setPrefsState(getAvatarPrefs());
    if (selected?.id === productoId) {
      setUrlInput('');
      setUrlPreview('');
      setShowImageSearch(false);
    }
    toast.success('Personalización eliminada');
  };

  // Cuando el usuario selecciona una imagen del buscador automático
  const handleSelectFromSearch = useCallback((url: string) => {
    aplicarUrl(url);
    toast.success('✅ Imagen seleccionada y guardada');
  }, [aplicarUrl]);

  const currentPref = selected ? prefs[selected.id] : null;
  const currentStyle: AvatarStyle = currentPref?.style || 'bokeh';

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent
        className="max-w-5xl w-full p-0 rounded-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-700 shadow-2xl"
        style={{ maxHeight: '90vh' }}
      >
        {/* ── HEADER ── */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-6 py-4 shrink-0 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-400" /> Catálogo de Avatares
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Diseños · Búsqueda automática de imágenes · URL personalizada
              {totalPersonalizados > 0 && ` · ${totalPersonalizados} personalizado${totalPersonalizados !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── BODY ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* ══ Lista de productos ══ */}
          <div className="w-60 border-r border-slate-200 dark:border-slate-700 flex flex-col shrink-0 bg-slate-50 dark:bg-slate-900">
            <div className="p-3 border-b border-slate-200 dark:border-slate-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Buscar producto..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-9 text-xs rounded-xl border-slate-200 bg-white dark:bg-slate-800"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {filtrados.length === 0 && (
                <p className="text-center text-xs text-slate-400 py-8">Sin resultados</p>
              )}
              {filtrados.map(p => {
                const pref = prefs[p.id];
                const isSelected = selected?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => seleccionar(p)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors border-b border-slate-100 dark:border-slate-800',
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 border-r-2 border-r-indigo-500'
                        : 'hover:bg-white dark:hover:bg-slate-800/60'
                    )}
                  >
                    <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 shadow-sm">
                      <ProductAvatar
                        imagen={pref?.imagen || (p as any).imagen}
                        nombre={p.nombre}
                        categoria={p.categoria || ''}
                        forceStyle={pref?.style}
                        className="w-full h-full"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn(
                        'text-[11px] font-bold truncate',
                        isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-200'
                      )}>
                        {p.nombre}
                      </p>
                      <p className="text-[9px] text-slate-400 truncate">{p.categoria}</p>
                    </div>
                    {pref && (
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" title="Personalizado" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ══ Panel configurador ══ */}
          <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-950">
            {!selected ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-10 opacity-60">
                <Star className="w-12 h-12 text-slate-300 mb-3" />
                <p className="text-sm font-black text-slate-400">Selecciona un producto</p>
                <p className="text-xs text-slate-300 mt-1">para elegir su diseño de avatar</p>
              </div>
            ) : (
              <div className="p-6 space-y-6">

                {/* ── Cabecera del producto ── */}
                <div className="flex items-center gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-md shrink-0">
                    <ProductAvatar
                      imagen={currentPref?.imagen || (selected as any).imagen}
                      nombre={selected.nombre}
                      categoria={selected.categoria || ''}
                      forceStyle={currentStyle}
                      className="w-full h-full"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-black text-slate-800 dark:text-white truncate">
                      {selected.nombre}
                    </h3>
                    <p className="text-xs text-slate-400 truncate">{selected.categoria}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={cn(
                        'text-[10px] font-black uppercase px-2.5 py-1 rounded-full',
                        ESTILOS.find(s => s.id === currentStyle)?.badgeCls || 'bg-slate-100 text-slate-600'
                      )}>
                        {ESTILOS.find(s => s.id === currentStyle)?.label}
                      </span>
                      {currentPref?.imagen && (
                        <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
                          📷 Con imagen
                        </span>
                      )}
                    </div>
                  </div>
                  {currentPref && (
                    <button
                      onClick={() => quitarTodo(selected.id)}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase text-rose-500 hover:bg-rose-50 transition-colors border border-rose-200"
                    >
                      <ImageOff className="w-3 h-3" /> Restablecer
                    </button>
                  )}
                </div>

                {/* ── 3 diseños de estilo ── */}
                <div>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">
                    Diseño de fondo
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {ESTILOS.map(s => {
                      const isActive = currentStyle === s.id;
                      return (
                        <button
                          key={s.id}
                          onClick={() => aplicarEstilo(s.id)}
                          className={cn(
                            'rounded-2xl border-2 p-3 text-center transition-all flex flex-col items-center gap-2.5 relative',
                            isActive
                              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-md shadow-indigo-100'
                              : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 bg-white dark:bg-slate-800/50 hover:shadow-md'
                          )}
                        >
                          <span className={cn(
                            'absolute top-2 right-2 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full',
                            s.badgeCls
                          )}>
                            {s.badge}
                          </span>
                          <div className="relative w-16 h-16 rounded-xl overflow-hidden shadow-sm">
                            <ProductAvatar
                              nombre={selected.nombre}
                              categoria={selected.categoria || ''}
                              forceStyle={s.id}
                              className="w-full h-full"
                            />
                            {isActive && (
                              <div className="absolute inset-0 flex items-center justify-center bg-indigo-600/15">
                                <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center">
                                  <Check className="w-3.5 h-3.5 text-white" />
                                </div>
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1 justify-center mb-0.5">
                              <span className={isActive ? 'text-indigo-600' : 'text-slate-400'}>{s.icon}</span>
                              <span className={cn(
                                'text-xs font-black',
                                isActive ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-200'
                              )}>
                                {s.label}
                              </span>
                            </div>
                            <p className="text-[9px] text-slate-400 leading-snug">{s.desc}</p>
                          </div>
                          {isActive && (
                            <span className="text-[9px] font-black text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
                              ✓ Activo
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── BÚSQUEDA AUTOMÁTICA DE IMÁGENES ── */}
                <div className="rounded-2xl overflow-hidden border border-indigo-200 dark:border-indigo-800">
                  {/* Cabecera del acordeón */}
                  <button
                    onClick={() => setShowImageSearch(v => !v)}
                    className={cn(
                      'w-full flex items-center gap-3 px-5 py-4 text-left transition-colors',
                      showImageSearch
                        ? 'bg-indigo-600 text-white'
                        : 'bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200'
                    )}
                  >
                    <Camera className={cn('w-5 h-5 shrink-0', showImageSearch ? 'text-white' : 'text-indigo-500')} />
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-black', showImageSearch ? 'text-white' : 'text-indigo-700 dark:text-indigo-300')}>
                        🔍 Buscar imagen automáticamente
                      </p>
                      <p className={cn('text-[10px] mt-0.5', showImageSearch ? 'text-indigo-200' : 'text-indigo-400')}>
                        Fotos reales del producto · Sin API key · Gratis
                      </p>
                    </div>
                    {currentPref?.imagen && (
                      <span className="text-[9px] font-black px-2 py-1 rounded-full bg-emerald-500 text-white shrink-0">
                        ✓ Imagen activa
                      </span>
                    )}
                    <ChevronRight className={cn(
                      'w-4 h-4 shrink-0 transition-transform',
                      showImageSearch
                        ? 'rotate-90 text-white'
                        : 'text-indigo-400'
                    )} />
                  </button>

                  {/* Panel de búsqueda */}
                  {showImageSearch && (
                    <div className="p-4 bg-white dark:bg-slate-900 border-t border-indigo-200 dark:border-indigo-800">
                      <ImageSearchPanel
                        producto={selected}
                        currentUrl={currentPref?.imagen}
                        onSelectUrl={handleSelectFromSearch}
                      />
                    </div>
                  )}
                </div>

                {/* ── URL personalizada manual ── */}
                <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-5 space-y-3 border border-slate-200 dark:border-slate-700">
                  <div>
                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-1">
                      <Link2 className="w-3.5 h-3.5" /> O pega tu propio enlace de imagen
                    </p>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      URL directa de foto (Google, WhatsApp, Drive público…)
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Input
                      placeholder="https://... pega el enlace"
                      value={urlInput}
                      onChange={e => { setUrlInput(e.target.value); setUrlError(false); }}
                      className="flex-1 h-10 text-xs rounded-xl border-slate-200 dark:bg-slate-800"
                    />
                    <Button
                      onClick={() => aplicarUrl(urlInput)}
                      className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shrink-0"
                    >
                      Usar
                    </Button>
                    {currentPref?.imagen && (
                      <Button
                        variant="ghost"
                        onClick={quitarUrl}
                        className="h-10 px-3 rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-600 shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  {/* Preview del URL */}
                  {urlPreview && !urlError && (
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-xl overflow-hidden border border-slate-200 shadow-sm shrink-0">
                        <img
                          src={urlPreview}
                          alt="Vista previa"
                          className="w-full h-full object-cover"
                          onError={() => setUrlError(true)}
                        />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-emerald-600">✓ Imagen cargando correctamente</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {currentPref?.imagen
                            ? 'Guardada · se aplica en toda la app'
                            : 'Toca "Usar" para guardar'}
                        </p>
                      </div>
                    </div>
                  )}
                  {urlError && (
                    <p className="text-[11px] text-rose-500 flex items-center gap-1.5">
                      <X className="w-3.5 h-3.5" />
                      No se puede cargar. Verifica que sea una URL pública y directa a la imagen.
                    </p>
                  )}

                  {/* Guía rápida */}
                  <div className="rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 px-4 py-3">
                    <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1.5">
                      💡 ¿Dónde consigo el enlace?
                    </p>
                    <ul className="space-y-1 text-[10px] text-amber-700 dark:text-amber-300">
                      <li>• <b>Google Imágenes:</b> clic derecho → "Copiar dirección de imagen"</li>
                      <li>• <b>WhatsApp Web:</b> abrir foto → clic derecho → copiar URL</li>
                      <li>• <b>Google Drive:</b> compartir → obtener enlace → cambiar /view por /uc</li>
                    </ul>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
