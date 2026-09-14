import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, ShoppingBag, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { Producto } from '@/types';

interface BuscadorPreciosProps {
  productos: Producto[];
  formatCurrency: (value: number) => string;
}

export function BuscadorPrecios({ productos, formatCurrency }: BuscadorPreciosProps) {
  const [busqueda, setBusqueda] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus al montar
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const filtrados = useMemo(() => {
    const q = norm(busqueda.trim());
    if (!q) return []; // Solo mostrar resultados si hay búsqueda

    const tokens = q.split(/\s+/).filter(Boolean);
    
    // Filtramos productos válidos y que coincidan con la búsqueda
    const lista = productos.filter(p => {
      // Filtrar productos corruptos o no vendibles (mismos filtros que en ListaPreciosProvincial)
      if (!p.nombre || p.nombre.trim() === '') return false;
      if (p.precioVenta <= 0) return false;
      if (p.tipo === 'ingrediente') return false;
      const nombreLimpio = p.nombre.trim();
      if (/^\d/.test(nombreLimpio)) return false;
      if (/\bedi\b/i.test(nombreLimpio)) return false;

      const haystack = norm(`${p.nombre} ${p.categoria || ''}`);
      return tokens.every(t => haystack.includes(t));
    });

    // Ordenar por coincidencia exacta de inicio primero, luego alfabético
    return lista.sort((a, b) => {
      const aStarts = norm(a.nombre).startsWith(q) ? -1 : 1;
      const bStarts = norm(b.nombre).startsWith(q) ? -1 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.nombre.localeCompare(b.nombre);
    }).slice(0, 50); // Límite de resultados para velocidad extrema
  }, [productos, busqueda]);

  const limpiar = () => {
    setBusqueda('');
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-4 md:p-8 animate-ag-fade-in overflow-hidden">
      
      {/* ── BARRA DE BÚSQUEDA GIGANTE ── */}
      <div className="shrink-0 mb-6 relative z-10 w-full max-w-4xl mx-auto mt-4 md:mt-8">
        <div className="relative group">
          <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
            <Search className="w-10 h-10 text-indigo-400 group-focus-within:text-indigo-600 transition-colors" />
          </div>
          <Input
            ref={inputRef}
            type="text"
            placeholder="¿Qué precio buscas?"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full h-24 pl-20 pr-20 text-3xl md:text-4xl font-black rounded-[2rem] border-4 border-transparent focus-visible:border-indigo-500 bg-white dark:bg-slate-900 shadow-xl placeholder:text-slate-300 dark:placeholder:text-slate-700 transition-all"
          />
          {busqueda && (
            <button
              onClick={limpiar}
              className="absolute inset-y-0 right-6 flex items-center justify-center text-slate-300 hover:text-slate-600 dark:hover:text-slate-100 transition-colors"
            >
              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center">
                <X className="w-8 h-8" />
              </div>
            </button>
          )}
        </div>
      </div>

      {/* ── RESULTADOS ── */}
      <div className="flex-1 overflow-y-auto w-full max-w-4xl mx-auto pb-24 no-scrollbar">
        {!busqueda.trim() ? (
          <div className="flex flex-col items-center justify-center h-[50vh] text-center opacity-30 px-6">
            <Search className="w-32 h-32 mb-8 text-indigo-400" />
            <h2 className="text-3xl font-black tracking-tight mb-2">Consulta Rápida</h2>
            <p className="text-lg font-medium max-w-sm mx-auto">Escribe el nombre del producto para ver su precio al instante.</p>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[50vh] text-center opacity-40 px-6">
            <Package className="w-24 h-24 mb-6 text-slate-400" />
            <h2 className="text-2xl font-black tracking-tight mb-2">No encontrado</h2>
            <p className="text-base font-medium">Revisa si está bien escrito o si existe en el sistema.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtrados.map((p) => (
              <div
                key={p.id}
                className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-md border-2 border-slate-100 dark:border-slate-800 flex items-center justify-between gap-6 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-5 min-w-0 flex-1">
                  {/* Foto o Ícono Gigante */}
                  {p.imagen ? (
                    <img 
                      src={p.imagen} 
                      alt={p.nombre} 
                      className="w-20 h-20 rounded-2xl object-cover shrink-0 shadow-sm border border-slate-100 dark:border-slate-800"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center shrink-0">
                      <ShoppingBag className="w-10 h-10 text-indigo-400" />
                    </div>
                  )}
                  
                  <div className="min-w-0">
                    <p className="text-2xl md:text-3xl font-black tracking-tight text-slate-800 dark:text-white truncate">
                      {p.nombre}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-wider rounded-lg truncate max-w-[150px]">
                        {p.categoria || 'Sin Categoría'}
                      </span>
                      {(p.stock ?? 0) > 0 && (
                        <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-sm font-bold uppercase tracking-wider rounded-lg">
                          Hay {p.stock}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* PRECIO GIGANTE */}
                <div className="shrink-0 text-right">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">PVP</p>
                  <p className="text-4xl md:text-5xl font-black tabular-nums text-emerald-600 dark:text-emerald-400 tracking-tighter">
                    {formatCurrency(p.precioVenta)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default BuscadorPrecios;
