/**
 * AvatarConfigurator — Catálogo interactivo de diseños de avatar
 *
 * Permite personalizar por producto:
 *   - 3 estilos de diseño: Bokeh, Cristal, Noche
 *   - Imagen personalizada por URL externa
 *
 * Guarda en localStorage bajo la clave 'ag_avatar_prefs'.
 */

import { useState, useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Check, Link2, X, Sparkles, Layers, Moon, ImageOff, Star } from 'lucide-react';
import type { Producto } from '@/types';
import {
  ProductAvatar,
  type AvatarStyle,
  getAvatarPrefs,
  setAvatarPref,
} from '@/components/ui/ProductAvatar';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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
    desc: 'Fondo borroso cálido. Gradiente de la categoría. Estilo Rappi.',
    icon: <Sparkles className="w-3.5 h-3.5" />,
    badge: 'Cálido',
    badgeCls: 'bg-amber-100 text-amber-700',
  },
  {
    id: 'cristal',
    label: 'Cristal',
    desc: 'Fondo claro con sombra de color bajo el emoji. Limpio y moderno.',
    icon: <Layers className="w-3.5 h-3.5" />,
    badge: 'Elegante',
    badgeCls: 'bg-sky-100 text-sky-700',
  },
  {
    id: 'noche',
    label: 'Noche',
    desc: 'Fondo oscuro con brillo neón del color de la categoría. Dramático.',
    icon: <Moon className="w-3.5 h-3.5" />,
    badge: 'Impacto',
    badgeCls: 'bg-indigo-100 text-indigo-700',
  },
];

// ─── Props ─────────────────────────────────────────────────────────
interface AvatarConfiguratorProps {
  open: boolean;
  onClose: () => void;
  productos: Producto[];
}

// ─── Componente principal ──────────────────────────────────────────
export function AvatarConfigurator({ open, onClose, productos }: AvatarConfiguratorProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Producto | null>(null);
  // Estado local de prefs (se sincroniza con localStorage en cada cambio)
  const [prefs, setPrefsState] = useState(() => getAvatarPrefs());
  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState(false);
  // Para mostrar al usuario el "preview" del URL ingresado antes de guardarlo
  const [urlPreview, setUrlPreview] = useState('');

  const filtrados = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return productos;
    return productos.filter(
      p =>
        p.nombre.toLowerCase().includes(q) ||
        (p.categoria || '').toLowerCase().includes(q)
    );
  }, [productos, search]);

  // Contar cuántos productos tienen configuración personalizada
  const totalPersonalizados = Object.keys(prefs).length;

  const seleccionar = (p: Producto) => {
    setSelected(p);
    const pref = prefs[p.id];
    setUrlInput(pref?.imagen || '');
    setUrlPreview(pref?.imagen || '');
    setUrlError(false);
  };

  const aplicarEstilo = (style: AvatarStyle) => {
    if (!selected) return;
    setAvatarPref(selected.id, { style });
    setPrefsState(getAvatarPrefs());
    toast.success(`Estilo "${ESTILOS.find(s => s.id === style)?.label}" aplicado`);
  };

  const aplicarUrl = () => {
    if (!selected) return;
    const url = urlInput.trim();
    setAvatarPref(selected.id, { imagen: url || undefined });
    setPrefsState(getAvatarPrefs());
    setUrlPreview(url);
    setUrlError(false);
    toast.success(url ? '✅ Imagen personalizada guardada' : '🗑️ Imagen eliminada');
  };

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
    }
    toast.success('Personalización eliminada');
  };

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
              Elige el diseño de cada producto · {totalPersonalizados} personalizado{totalPersonalizados !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── BODY: dos columnas ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* ══ COLUMNA IZQUIERDA: lista de productos ══ */}
          <div className="w-60 border-r border-slate-200 dark:border-slate-700 flex flex-col shrink-0 bg-slate-50 dark:bg-slate-900">
            {/* Buscador */}
            <div className="p-3 border-b border-slate-200 dark:border-slate-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Buscar..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-9 text-xs rounded-xl border-slate-200 bg-white dark:bg-slate-800"
                />
              </div>
            </div>

            {/* Lista scrollable */}
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
                    {/* Mini avatar */}
                    <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 shadow-sm">
                      <ProductAvatar
                        imagen={pref?.imagen || p.imagen}
                        nombre={p.nombre}
                        categoria={p.categoria || ''}
                        forceStyle={pref?.style}
                        className="w-full h-full"
                      />
                    </div>
                    {/* Nombre + categoría */}
                    <div className="min-w-0 flex-1">
                      <p className={cn(
                        'text-[11px] font-bold truncate',
                        isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-200'
                      )}>
                        {p.nombre}
                      </p>
                      <p className="text-[9px] text-slate-400 truncate">{p.categoria}</p>
                    </div>
                    {/* Indicador de personalizado */}
                    {pref && (
                      <div
                        className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"
                        title="Personalizado"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ══ COLUMNA DERECHA: configurador ══ */}
          <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-950">
            {!selected ? (
              /* Estado vacío */
              <div className="h-full flex flex-col items-center justify-center text-center p-10 opacity-60">
                <Star className="w-12 h-12 text-slate-300 mb-3" />
                <p className="text-sm font-black text-slate-400">Selecciona un producto</p>
                <p className="text-xs text-slate-300 mt-1">para elegir su diseño de avatar</p>
              </div>
            ) : (
              <div className="p-6 space-y-7">

                {/* ── Cabecera del producto seleccionado ── */}
                <div className="flex items-center gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-md shrink-0">
                    <ProductAvatar
                      imagen={currentPref?.imagen || selected.imagen}
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
                        Diseño activo: {ESTILOS.find(s => s.id === currentStyle)?.label}
                      </span>
                      {currentPref?.imagen && (
                        <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
                          Imagen personalizada
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Botón quitar personalización */}
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
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">
                    Elige un diseño
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    {ESTILOS.map(s => {
                      const isActive = currentStyle === s.id;
                      return (
                        <button
                          key={s.id}
                          onClick={() => aplicarEstilo(s.id)}
                          className={cn(
                            'rounded-2xl border-2 p-4 text-center transition-all flex flex-col items-center gap-3 group relative',
                            isActive
                              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-lg shadow-indigo-100 dark:shadow-indigo-900/30'
                              : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 bg-white dark:bg-slate-800/50 hover:shadow-md'
                          )}
                        >
                          {/* Badge del estilo */}
                          <span className={cn(
                            'absolute top-2.5 right-2.5 text-[8px] font-black uppercase px-2 py-0.5 rounded-full',
                            s.badgeCls
                          )}>
                            {s.badge}
                          </span>

                          {/* Preview del avatar */}
                          <div className="relative w-[72px] h-[72px] rounded-xl overflow-hidden shadow-md">
                            <ProductAvatar
                              imagen={currentPref?.imagen}
                              nombre={selected.nombre}
                              categoria={selected.categoria || ''}
                              forceStyle={s.id}
                              forceImagen={currentPref?.imagen}
                              className="w-full h-full"
                            />
                            {/* Overlay check si está activo */}
                            {isActive && (
                              <div className="absolute inset-0 flex items-center justify-center bg-indigo-600/15">
                                <div className="w-7 h-7 rounded-full bg-indigo-600 shadow-lg flex items-center justify-center">
                                  <Check className="w-4 h-4 text-white" />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Label + descripción */}
                          <div>
                            <div className="flex items-center gap-1.5 justify-center mb-1">
                              <span className={isActive ? 'text-indigo-600' : 'text-slate-500'}>{s.icon}</span>
                              <span className={cn(
                                'text-xs font-black',
                                isActive ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-200'
                              )}>
                                {s.label}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-snug">{s.desc}</p>
                          </div>

                          {isActive && (
                            <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-100 dark:bg-indigo-900 px-2.5 py-1 rounded-full">
                              ✓ Activo
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── Imagen personalizada por URL ── */}
                <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-5 space-y-4 border border-slate-200 dark:border-slate-700">
                  <div>
                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-1">
                      <Link2 className="w-3.5 h-3.5" /> Imagen personalizada (URL)
                    </p>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Pega un enlace de imagen (Google, WhatsApp, Drive público...). Si tiene imagen, reemplaza los 3 diseños.
                    </p>
                  </div>

                  {/* Input + botones */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://... pega el enlace de tu imagen"
                      value={urlInput}
                      onChange={e => {
                        setUrlInput(e.target.value);
                        setUrlError(false);
                      }}
                      className="flex-1 h-10 text-xs rounded-xl border-slate-200 dark:bg-slate-800"
                    />
                    <Button
                      onClick={aplicarUrl}
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

                  {/* Preview live del URL */}
                  {urlPreview && !urlError && (
                    <div className="flex items-center gap-3 mt-1">
                      <div className="w-14 h-14 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm shrink-0">
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
                          {currentPref?.imagen === urlPreview
                            ? 'Guardada — se aplica en todos los módulos'
                            : 'Toca "Usar" para guardar esta imagen'}
                        </p>
                      </div>
                    </div>
                  )}
                  {urlError && (
                    <p className="text-[11px] text-rose-500 flex items-center gap-1.5 mt-1">
                      <X className="w-3.5 h-3.5" />
                      No se puede cargar esa URL. Verifica que sea una imagen pública y directa.
                    </p>
                  )}

                  {/* Sugerencias de fuentes */}
                  <div className="rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 px-4 py-3">
                    <p className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-1.5">
                      💡 ¿De dónde obtener la URL?
                    </p>
                    <ul className="space-y-1 text-[10px] text-amber-700 dark:text-amber-300">
                      <li>• <b>Google Imágenes:</b> clic derecho → "Copiar dirección de imagen"</li>
                      <li>• <b>WhatsApp:</b> enviar la foto → abre en navegador → copiar URL</li>
                      <li>• <b>Google Drive:</b> compartir → obtener enlace → reemplazar /view por /uc</li>
                      <li>• <b>Unsplash.com:</b> buscar el alimento → click derecho → copiar URL</li>
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
