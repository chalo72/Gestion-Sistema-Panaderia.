import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Gasto } from '@/types';
import {
  fusionarGastosEnEstado,
  fusionarGastosUnicos,
  hidratarGastosCompletos,
  leerCacheGastos,
} from '@/lib/gastos-hidratacion';

/**
 * Lista de gastos lista para UI — combina props globales + caché + recuperación multifuente.
 */
export function useGastosHidratados(gastosGlobales: Gasto[] = []) {
  const [locales, setLocales] = useState<Gasto[]>(() => leerCacheGastos());
  const [cargando, setCargando] = useState(() => gastosGlobales.length === 0 && locales.length === 0);

  const recargar = useCallback(async () => {
    setCargando(true);
    try {
      const lista = await hidratarGastosCompletos();
      setLocales((prev) => fusionarGastosEnEstado(prev, lista));
      if (lista.length > 0) {
        window.dispatchEvent(
          new CustomEvent('nexus-realtime-change', { detail: { table: 'gastos' } }),
        );
      }
      return lista;
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (gastosGlobales.length > 0) {
      setLocales((prev) => fusionarGastosEnEstado(prev, gastosGlobales));
      setCargando(false);
    }
  }, [gastosGlobales]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  useEffect(() => {
    const onFocus = () => { void recargar(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [recargar]);

  const gastos = useMemo(
    () => fusionarGastosUnicos(locales, gastosGlobales),
    [locales, gastosGlobales],
  );

  return { gastos, cargando, recargar };
}
