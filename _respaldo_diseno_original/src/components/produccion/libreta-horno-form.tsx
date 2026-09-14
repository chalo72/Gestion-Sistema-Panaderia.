/**
 * Misma forma de anotar masas/panes que Reportes → Historial de Panes (Libreta del Horno).
 * Guarda en dp_producciones_diarias — una sola libreta.
 */
import { useCallback } from 'react';
import { DiagnosticoFinanciero } from '@/components/reportes/DiagnosticoFinanciero';
import { useReportesData } from '@/hooks/useReportesData';
import type {
  FormulacionBase,
  GastoCategoria,
  MetodoPago,
  ModeloPan,
  Producto,
  Proveedor,
  ReporteFinanciero,
  Venta,
} from '@/types';

type Props = {
  ventas: Venta[];
  productos: Producto[];
  proveedores: Proveedor[];
  formulaciones: FormulacionBase[];
  modelosPan: ModeloPan[];
  formatCurrency: (value: number) => string;
  categorias?: { id: string; nombre: string }[];
  onNavigateTo?: (view: string) => void;
};

const reporteVacio = (periodo: string): ReporteFinanciero => ({
  periodo,
  totalVentas: 0,
  totalGastos: 0,
  utilidadBruta: 0,
  gastosPorCategoria: {} as Record<GastoCategoria, number>,
  ventasPorMetodoPago: {} as Record<MetodoPago, number>,
});

/**
 * Formulario de Libreta del Horno idéntico al de Reportes (modo libreta).
 */
export function LibretaHornoForm({
  ventas,
  productos,
  proveedores,
  formulaciones,
  modelosPan,
  formatCurrency,
  categorias = [],
  onNavigateTo,
}: Props) {
  const generarReporte = useCallback((periodo: string) => reporteVacio(periodo), []);

  const reportesData = useReportesData({
    ventas,
    gastos: [],
    formatCurrency,
    generarReporte,
    productos,
    categorias: categorias as never,
    proveedores,
  });

  return (
    <DiagnosticoFinanciero
      modoLibretaHorno
      data={{
        ...reportesData,
        formatCurrency,
        ventas,
        gastos: [],
        formulaciones,
        modelosPan,
        onNavigateTo,
        proveedores: proveedores ?? [],
        productos: productos ?? [],
        precios: [],
      }}
    />
  );
}
