import { useState, useMemo, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, CheckCircle2, Clock, FileDown,
  Wallet, History, AlertCircle, X, Pencil, Trash2, Plus,
  ShoppingBag, Eye
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  Trabajador, RegistroAsistencia, CreditoTrabajador,
  NominaQuincenal, NominaItem, NominaEstado
} from '@/types';

interface NominaProps {
  trabajadores: Trabajador[];
  asistencia: RegistroAsistencia[];
  creditosTrabajadores: CreditoTrabajador[];
  nominas: NominaQuincenal[];
  onAddNomina: (n: Omit<NominaQuincenal, 'id' | 'createdAt'>) => Promise<NominaQuincenal>;
  onUpdateNomina: (n: NominaQuincenal) => Promise<void>;
  onAddGasto: (g: any) => Promise<any>;
  onAddCreditoTrabajador: (c: Omit<CreditoTrabajador, 'id' | 'createdAt'>) => Promise<CreditoTrabajador>;
  onUpdateCreditoTrabajador: (c: CreditoTrabajador) => Promise<void>;
  onDeleteCreditoTrabajador: (id: string) => Promise<void>;
  formatCurrency: (n: number) => string;
  onBack: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function quincenaActual() {
  const hoy = new Date();
  return { periodo: hoy.getDate() <= 15 ? 'primera' : 'segunda' as 'primera' | 'segunda',
           mes: hoy.getMonth() + 1, año: hoy.getFullYear() };
}

function rangoQuincena(periodo: 'primera' | 'segunda', mes: number, año: number) {
  const mm = String(mes).padStart(2, '0');
  if (periodo === 'primera') {
    return { inicio: `${año}-${mm}-01`, fin: `${año}-${mm}-15`, dias: 15 };
  }
  const ultimo = new Date(año, mes, 0).getDate();
  return { inicio: `${año}-${mm}-16`, fin: `${año}-${mm}-${ultimo}`, dias: ultimo - 15 };
}

function diasEnRango(inicio: string, fin: string): string[] {
  const dias: string[] = [];
  const cur = new Date(inicio + 'T00:00:00');
  const end = new Date(fin   + 'T00:00:00');
  while (cur <= end) { dias.push(cur.toISOString().split('T')[0]); cur.setDate(cur.getDate() + 1); }
  return dias;
}

function calcularMinutos(regs: RegistroAsistencia[]): number {
  const sorted = [...regs].sort((a, b) => a.hora.localeCompare(b.hora));
  let total = 0; let entrada: string | null = null;
  for (const r of sorted) {
    if (r.tipo === 'entrada') { entrada = r.hora; }
    else if (r.tipo === 'salida' && entrada) {
      const [eh, em] = entrada.split(':').map(Number);
      const [sh, sm] = r.hora.split(':').map(Number);
      total += (sh * 60 + sm) - (eh * 60 + em);
      entrada = null;
    }
  }
  return Math.max(0, total);
}

function formatHoras(min: number): string {
  if (min === 0) return '—';
  const h = Math.floor(min / 60), m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const MES_LABEL = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio',
                      'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function periodoLabel(n: NominaQuincenal) {
  return `${n.periodo === 'primera' ? '1ra' : '2da'} quincena ${MES_LABEL[n.mes]} ${n.año}`;
}

// Crédito es "consumo de productos" si tiene items con productos
const esConsumoProductos = (c: CreditoTrabajador) =>
  Array.isArray(c.items) && c.items.length > 0;

// ── Modal de préstamo ──────────────────────────────────────────────────────

const ESTADO_CREDITO_VACÍO = {
  descripcion: '', monto: 0, saldo: 0,
  descontarDeSalario: true, estado: 'activo' as const,
};

interface LoanModal {
  trabajadorId: string;
  trabajadorNombre: string;
  credito?: CreditoTrabajador;
}

// ── Sección de crédito reutilizable ───────────────────────────────────────

interface CreditCardProps {
  c: CreditoTrabajador;
  parciales: Record<string, number>;
  setParciales: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  estaPageada: boolean;
  descuentoGuardado?: { monto: number } | undefined;
  onEditar?: () => void;
  onEliminar?: () => void;
  formatCurrency: (n: number) => string;
}

function CreditCard({ c, parciales, setParciales, estaPageada, descuentoGuardado, onEditar, onEliminar, formatCurrency }: CreditCardProps) {
  const saldo = c.saldo;
  const montoDefault = Math.min(saldo, c.monto > 0 ? c.monto : saldo);
  const montoActual  = parciales[c.id] !== undefined ? parciales[c.id] : (c.descontarDeSalario ? montoDefault : 0);
  const isProducto   = esConsumoProductos(c);

  return (
    <div className={`rounded-xl px-3 py-2 ${isProducto ? 'bg-orange-50 dark:bg-orange-900/10' : 'bg-rose-50 dark:bg-rose-900/10'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {isProducto && <ShoppingBag className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
              {c.descripcion || (isProducto ? 'Consumo de productos' : 'Préstamo')}
            </p>
          </div>
          <p className="text-xs text-gray-400">Saldo pendiente: {formatCurrency(saldo)}</p>

          {/* Items del crédito de productos */}
          {isProducto && (
            <div className="mt-1.5 space-y-0.5">
              {c.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                  <span>{item.nombre} × {item.cantidad}</span>
                  <span>{formatCurrency(item.subtotal)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {!estaPageada && (onEditar || onEliminar) && (
          <div className="flex items-center gap-1 shrink-0">
            {onEditar && (
              <button onClick={onEditar}
                className="p-1.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-400 hover:text-rose-600 transition-colors">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            {onEliminar && (
              <button onClick={onEliminar}
                className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-400 hover:text-red-600 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Descuento parcial */}
      <div className="flex items-center justify-between mt-2 gap-2">
        <div className="flex items-center gap-1.5">
          <input type="checkbox"
            checked={c.descontarDeSalario && (parciales[c.id] === undefined ? true : montoActual > 0)}
            disabled={estaPageada}
            onChange={e => {
              if (!e.target.checked) setParciales(prev => ({ ...prev, [c.id]: 0 }));
              else setParciales(prev => { const p = { ...prev }; delete p[c.id]; return p; });
            }}
            className={`w-4 h-4 ${isProducto ? 'accent-orange-500' : 'accent-rose-500'}`} />
          <span className="text-xs text-gray-500 dark:text-gray-400">Descontar esta quincena</span>
        </div>

        {(c.descontarDeSalario || parciales[c.id] !== undefined) && !estaPageada && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400">$</span>
            <input type="number"
              value={montoActual === 0 && parciales[c.id] === 0 ? '' : montoActual}
              min={0} max={saldo}
              onChange={e => {
                const val = Math.min(Number(e.target.value) || 0, saldo);
                setParciales(prev => ({ ...prev, [c.id]: val }));
              }}
              placeholder={String(montoDefault)}
              className={`w-28 text-right text-sm font-bold border rounded-lg px-2 py-1 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2
                ${isProducto
                  ? 'border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400 focus:ring-orange-400'
                  : 'border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 focus:ring-rose-400'}`} />
          </div>
        )}

        {estaPageada && descuentoGuardado && (
          <span className="text-sm font-bold text-rose-600 dark:text-rose-400">
            -{formatCurrency(descuentoGuardado.monto)}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────

type Tab = 'liquidar' | 'historial';

export default function Nomina({
  trabajadores, asistencia, creditosTrabajadores, nominas,
  onAddNomina, onUpdateNomina, onAddGasto,
  onAddCreditoTrabajador, onUpdateCreditoTrabajador, onDeleteCreditoTrabajador,
  formatCurrency, onBack,
}: NominaProps) {

  const [tab, setTab] = useState<Tab>('liquidar');
  const hoy = quincenaActual();
  const [periodo, setPeriodo] = useState<'primera' | 'segunda'>(hoy.periodo);
  const [mes, setMes] = useState(hoy.mes);
  const [año, setAño] = useState(hoy.año);

  const [pagando, setPagando] = useState(false);
  const [ajustes, setAjustes] = useState<Record<string, number>>({});
  const [parciales, setParciales] = useState<Record<string, number>>({});

  const [obsModal, setObsModal] = useState(false);
  const [obsText, setObsText]   = useState('');

  // Modal gestión préstamos
  const [loanModal, setLoanModal] = useState<LoanModal | null>(null);
  const [loanForm, setLoanForm]   = useState(ESTADO_CREDITO_VACÍO);
  const [loanSaving, setLoanSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CreditoTrabajador | null>(null);

  // Modal detalle de nómina del historial
  const [selectedNomina, setSelectedNomina] = useState<NominaQuincenal | null>(null);

  // ── Navegación de período ──────────────────────────────────────────────
  function anteriorQuincena() {
    if (periodo === 'segunda') { setPeriodo('primera'); }
    else {
      setPeriodo('segunda');
      const prev = new Date(año, mes - 2, 1);
      setMes(prev.getMonth() + 1); setAño(prev.getFullYear());
    }
  }
  function siguienteQuincena() {
    const q = quincenaActual();
    if (periodo === q.periodo && mes === q.mes && año === q.año) return;
    if (periodo === 'primera') { setPeriodo('segunda'); }
    else {
      setPeriodo('primera');
      const next = new Date(año, mes, 1);
      setMes(next.getMonth() + 1); setAño(next.getFullYear());
    }
  }

  const rango        = useMemo(() => rangoQuincena(periodo, mes, año), [periodo, mes, año]);
  const diasPeriodo  = useMemo(() => diasEnRango(rango.inicio, rango.fin), [rango]);
  const esActual     = periodo === hoy.periodo && mes === hoy.mes && año === hoy.año;

  const nominaExistente = useMemo(() =>
    nominas.find(n => n.periodo === periodo && n.mes === mes && n.año === año),
    [nominas, periodo, mes, año]
  );

  const trabajadoresActivos = trabajadores.filter(t => t.estado === 'activo');

  // ── Cálculo de items ───────────────────────────────────────────────────
  const items = useMemo((): (NominaItem & { _totalMins: number })[] => {
    if (nominaExistente) return nominaExistente.items as any;

    return trabajadoresActivos.map(t => {
      const diasTrabajados = diasPeriodo.filter(fecha =>
        asistencia.some(r => r.trabajadorId === t.id && r.fecha === fecha)
      ).length;

      const totalMins = diasPeriodo.reduce((sum, fecha) => {
        const regs = asistencia.filter(r => r.trabajadorId === t.id && r.fecha === fecha);
        return sum + calcularMinutos(regs);
      }, 0);

      const valorBase  = t.salarioBase / 2;
      const proporcion = diasPeriodo.length > 0 ? diasTrabajados / diasPeriodo.length : 0;
      const valorBruto = Math.max(0, Math.round(valorBase * proporcion) + (ajustes[t.id] ?? 0));

      const credActivos = creditosTrabajadores.filter(
        c => c.trabajadorId === t.id && c.descontarDeSalario && c.estado === 'activo' && c.saldo > 0
      );

      const descuentos = credActivos.map(c => {
        const montoDefault = Math.min(c.saldo, c.monto > 0 ? c.monto : c.saldo);
        const monto = parciales[c.id] !== undefined
          ? Math.min(parciales[c.id], c.saldo)
          : montoDefault;
        const tipoLabel = esConsumoProductos(c) ? 'Consumo' : 'Préstamo';
        return {
          concepto: c.descripcion || tipoLabel,
          monto,
          creditoId: c.id,
        };
      });

      const totalDescuentos = descuentos.reduce((s, d) => s + d.monto, 0);

      return {
        trabajadorId: t.id, trabajadorNombre: t.nombre, salarioBase: t.salarioBase,
        diasTrabajados, totalDiasPeriodo: diasPeriodo.length, valorBruto,
        descuentos, totalDescuentos, valorNeto: Math.max(0, valorBruto - totalDescuentos),
        _totalMins: totalMins,
      };
    });
  }, [trabajadoresActivos, asistencia, creditosTrabajadores, diasPeriodo,
      nominaExistente, ajustes, parciales]);

  const totalBruto      = items.reduce((s, i) => s + i.valorBruto, 0);
  const totalDescuentos = items.reduce((s, i) => s + i.totalDescuentos, 0);
  const totalNeto       = items.reduce((s, i) => s + i.valorNeto, 0);

  // ── Pagar nómina ───────────────────────────────────────────────────────
  const pagarNomina = useCallback(async () => {
    setPagando(true);
    try {
      const fechaHoy = new Date().toISOString().split('T')[0];

      const gasto = await onAddGasto({
        id: crypto.randomUUID(),
        fecha: fechaHoy,
        categoria: 'nomina',
        descripcion: `Nómina ${periodo === 'primera' ? '1ra' : '2da'} quincena ${MES_LABEL[mes]} ${año}`,
        monto: totalNeto,
        metodoPago: 'efectivo',
        proveedor: '',
        notas: obsText || '',
        createdAt: new Date().toISOString(),
      });

      for (const item of items) {
        for (const desc of item.descuentos) {
          if (!desc.creditoId) continue;
          const cred = creditosTrabajadores.find(c => c.id === desc.creditoId);
          if (!cred) continue;
          const nuevoSaldo = Math.max(0, cred.saldo - desc.monto);
          await onUpdateCreditoTrabajador({
            ...cred, saldo: nuevoSaldo,
            estado: nuevoSaldo <= 0 ? 'descontado' : 'activo',
          });
        }
      }

      const nominaData = {
        periodo, mes, año,
        fechaInicio: rango.inicio, fechaFin: rango.fin, fechaPago: fechaHoy,
        estado: 'pagada' as NominaEstado,
        items: items.map(({ _totalMins, ...i }) => i),
        totalBruto, totalDescuentos, totalNeto,
        gastoId: gasto?.id, observaciones: obsText || undefined,
      };

      if (nominaExistente) await onUpdateNomina({ ...nominaExistente, ...nominaData });
      else await onAddNomina(nominaData);

      toast.success(`¡Nómina pagada! ${formatCurrency(totalNeto)}`);
      setObsModal(false); setObsText('');
    } catch (e) {
      console.error(e); toast.error('Error al procesar la nómina');
    } finally { setPagando(false); }
  }, [items, periodo, mes, año, rango, totalBruto, totalDescuentos, totalNeto,
      obsText, nominaExistente, creditosTrabajadores,
      onAddNomina, onUpdateNomina, onAddGasto, onUpdateCreditoTrabajador, formatCurrency]);

  // ── Gestión de préstamos ───────────────────────────────────────────────
  function abrirNuevoPrestamo(t: Trabajador) {
    setLoanModal({ trabajadorId: t.id, trabajadorNombre: t.nombre });
    setLoanForm({ ...ESTADO_CREDITO_VACÍO });
  }
  function abrirEditarPrestamo(t: Trabajador, c: CreditoTrabajador) {
    setLoanModal({ trabajadorId: t.id, trabajadorNombre: t.nombre, credito: c });
    setLoanForm({ descripcion: c.descripcion || '', monto: c.monto, saldo: c.saldo,
                  descontarDeSalario: c.descontarDeSalario, estado: c.estado });
  }

  const guardarPrestamo = useCallback(async () => {
    if (!loanModal) return;
    if (!loanForm.descripcion.trim()) { toast.error('Escribe una descripción'); return; }
    if (loanForm.monto <= 0) { toast.error('El monto debe ser mayor a 0'); return; }
    setLoanSaving(true);
    try {
      if (loanModal.credito) {
        await onUpdateCreditoTrabajador({
          ...loanModal.credito,
          descripcion: loanForm.descripcion.trim(),
          monto: loanForm.monto,
          saldo: loanForm.saldo,
          descontarDeSalario: loanForm.descontarDeSalario,
          estado: loanForm.estado,
        });
        toast.success('Préstamo actualizado');
      } else {
        await onAddCreditoTrabajador({
          trabajadorId: loanModal.trabajadorId,
          trabajadorNombre: loanModal.trabajadorNombre,
          descripcion: loanForm.descripcion.trim(),
          monto: loanForm.monto,
          saldo: loanForm.monto,
          descontarDeSalario: loanForm.descontarDeSalario,
          estado: 'activo',
          fecha: new Date().toISOString().split('T')[0],
          items: [],
          pagos: [],
          usuarioId: 'nomina',
        });
        toast.success('Préstamo registrado');
      }
      setLoanModal(null);
    } catch { toast.error('Error al guardar'); }
    finally { setLoanSaving(false); }
  }, [loanModal, loanForm, onAddCreditoTrabajador, onUpdateCreditoTrabajador]);

  const eliminarPrestamo = useCallback(async (c: CreditoTrabajador) => {
    try {
      await onDeleteCreditoTrabajador(c.id);
      toast.success('Préstamo eliminado');
    } catch { toast.error('Error al eliminar'); }
    finally { setConfirmDelete(null); }
  }, [onDeleteCreditoTrabajador]);

  // ── PDF ────────────────────────────────────────────────────────────────
  function exportarPDF(n?: NominaQuincenal) {
    const src = n ?? { items, totalBruto, totalDescuentos, totalNeto,
      periodo, mes, año, fechaInicio: rango.inicio, fechaFin: rango.fin,
      fechaPago: nominaExistente?.fechaPago, observaciones: obsText || undefined } as any;
    const titulo = `Nómina ${src.periodo === 'primera' ? '1ra' : '2da'} quincena ${MES_LABEL[src.mes]} ${src.año}`;
    const filas = src.items.map((item: NominaItem) => {
      const descs = item.descuentos.map(d =>
        `<div>${d.concepto}: -${formatCurrency(d.monto)}</div>`).join('');
      return `<tr>
        <td style="padding:7px 6px;font-weight:700;border-bottom:1px solid #f1f5f9">${item.trabajadorNombre}</td>
        <td style="padding:7px 6px;text-align:center;border-bottom:1px solid #f1f5f9">${item.diasTrabajados}/${item.totalDiasPeriodo}</td>
        <td style="padding:7px 6px;text-align:right;border-bottom:1px solid #f1f5f9">${formatCurrency(item.valorBruto)}</td>
        <td style="padding:7px 6px;font-size:11px;text-align:right;border-bottom:1px solid #f1f5f9;color:#dc2626">${descs || '—'}</td>
        <td style="padding:7px 6px;font-weight:700;text-align:right;border-bottom:1px solid #f1f5f9;color:#059669">${formatCurrency(item.valorNeto)}</td>
      </tr>`;
    }).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${titulo}</title>
    <style>body{font-family:Arial;padding:24px;color:#1e293b}h1{font-size:18px;margin:0 0 4px}
    .sub{color:#64748b;font-size:12px;margin:0 0 16px}table{width:100%;border-collapse:collapse}
    th{background:#f8fafc;padding:7px 6px;font-size:11px;border-bottom:2px solid #e2e8f0;text-align:left}
    th:not(:first-child){text-align:right}.tfoot td{background:#f0fdf4;font-weight:700;padding:7px 6px}
    .obs{margin-top:12px;font-size:11px;color:#64748b}
    @media print{body{padding:12px}}</style></head><body>
    <h1>${titulo}</h1>
    <p class="sub">Panadería Dulce Placer · ${src.fechaInicio} al ${src.fechaFin}${src.fechaPago ? ' · Pagada ' + src.fechaPago : ''}</p>
    <table><thead><tr>
      <th>Trabajadora</th><th style="text-align:center">Días</th>
      <th style="text-align:right">Bruto</th><th style="text-align:right">Descuentos</th>
      <th style="text-align:right">A pagar</th>
    </tr></thead><tbody>${filas}</tbody>
    <tfoot><tr class="tfoot">
      <td colspan="2">TOTAL</td>
      <td style="text-align:right">${formatCurrency(src.totalBruto)}</td>
      <td style="text-align:right;color:#dc2626">-${formatCurrency(src.totalDescuentos)}</td>
      <td style="text-align:right;color:#059669">${formatCurrency(src.totalNeto)}</td>
    </tr></tfoot></table>
    ${src.observaciones ? `<p class="obs">Observaciones: ${src.observaciones}</p>` : ''}
    <p style="margin-top:14px;font-size:10px;color:#94a3b8">* Bruto = salario mensual ÷ 2 × (días asistidos / días del período)</p>
    </body></html>`;
    const win = window.open('', '_blank');
    if (!win) { toast.error('Habilita ventanas emergentes'); return; }
    win.document.write(html); win.document.close();
    setTimeout(() => win.print(), 400);
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">

      {/* Header */}
      <div className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <button onClick={onBack} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <Wallet className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          <h1 className="font-black text-gray-900 dark:text-white text-lg">Nómina</h1>
          <div className="ml-auto flex gap-2">
            <button onClick={() => setTab('liquidar')}
              className={`px-4 py-1.5 rounded-xl font-bold text-sm transition-all ${tab === 'liquidar' ? 'bg-violet-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
              Liquidar
            </button>
            <button onClick={() => setTab('historial')}
              className={`flex items-center gap-1 px-4 py-1.5 rounded-xl font-bold text-sm transition-all ${tab === 'historial' ? 'bg-violet-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
              <History className="w-4 h-4" />Historial
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">

        {/* ── TAB LIQUIDAR ─────────────────────────────────────────────── */}
        {tab === 'liquidar' && (<>

          {/* Selector período */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-4 flex items-center justify-between">
            <button onClick={anteriorQuincena} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95">
              <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
            <div className="text-center">
              <p className="font-black text-gray-900 dark:text-white">
                {periodo === 'primera' ? '1ra' : '2da'} quincena {MES_LABEL[mes]} {año}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{rango.inicio} → {rango.fin} ({diasPeriodo.length} días)</p>
              {nominaExistente?.estado === 'pagada' && (
                <span className="inline-flex items-center gap-1 mt-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Pagada el {nominaExistente.fechaPago}
                </span>
              )}
            </div>
            <button onClick={siguienteQuincena} disabled={esActual}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 disabled:opacity-20 disabled:pointer-events-none">
              <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
          </div>

          {/* Aviso sin asistencia */}
          {items.every(i => i.diasTrabajados === 0) && (
            <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-2xl px-4 py-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-300">Sin registros de asistencia para este período — el valor bruto será $0.</p>
            </div>
          )}

          {/* Cards por trabajadora */}
          <div className="space-y-4">
            {items.map(item => {
              const trabajadora = trabajadores.find(t => t.id === item.trabajadorId);
              const credActivos = creditosTrabajadores.filter(
                c => c.trabajadorId === item.trabajadorId && c.estado === 'activo'
              );
              const prestamosActivos = credActivos.filter(c => !esConsumoProductos(c));
              const consumoActivos   = credActivos.filter(c => esConsumoProductos(c));
              const estaPageada = nominaExistente?.estado === 'pagada';

              return (
                <div key={item.trabajadorId} className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm overflow-hidden">

                  {/* Header trabajadora */}
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                    <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center font-black text-violet-700 dark:text-violet-300 text-lg shrink-0">
                      {item.trabajadorNombre.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 dark:text-white text-sm truncate">{item.trabajadorNombre}</p>
                      <p className="text-xs text-gray-400">
                        {item.diasTrabajados}/{item.totalDiasPeriodo} días
                        {(item as any)._totalMins > 0 && ` · ${formatHoras((item as any)._totalMins)}`}
                        {' · '}Sal. {formatCurrency(item.salarioBase)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">A pagar</p>
                      <p className="font-black text-emerald-600 dark:text-emerald-400 text-base">{formatCurrency(item.valorNeto)}</p>
                    </div>
                  </div>

                  {/* Desglose */}
                  <div className="px-4 py-3 space-y-2">

                    {/* Bruto */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Valor bruto (quincena)</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-200">{formatCurrency(item.valorBruto)}</span>
                    </div>

                    {/* Ajuste manual bruto */}
                    {!estaPageada && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-xs text-gray-400">+ Ajuste manual</span>
                        <input type="number"
                          value={ajustes[item.trabajadorId] ?? ''}
                          onChange={e => setAjustes(prev => ({ ...prev, [item.trabajadorId]: Number(e.target.value) || 0 }))}
                          placeholder="0"
                          className="w-28 text-right text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-transparent text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                      </div>
                    )}

                    {/* Préstamos / adelantos */}
                    {prestamosActivos.length > 0 && (
                      <div className="space-y-2 border-t border-gray-100 dark:border-gray-800 pt-2">
                        <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Préstamos y adelantos</p>
                        {prestamosActivos.map(c => (
                          <CreditCard key={c.id} c={c} parciales={parciales} setParciales={setParciales}
                            estaPageada={estaPageada}
                            descuentoGuardado={estaPageada ? item.descuentos.find(d => d.creditoId === c.id) : undefined}
                            onEditar={!estaPageada && trabajadora ? () => abrirEditarPrestamo(trabajadora, c) : undefined}
                            onEliminar={!estaPageada ? () => setConfirmDelete(c) : undefined}
                            formatCurrency={formatCurrency} />
                        ))}
                      </div>
                    )}

                    {/* Consumo de productos (fiado) */}
                    {consumoActivos.length > 0 && (
                      <div className="space-y-2 border-t border-gray-100 dark:border-gray-800 pt-2">
                        <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest flex items-center gap-1">
                          <ShoppingBag className="w-3 h-3 text-orange-500" />Consumo de productos
                        </p>
                        {consumoActivos.map(c => (
                          <CreditCard key={c.id} c={c} parciales={parciales} setParciales={setParciales}
                            estaPageada={estaPageada}
                            descuentoGuardado={estaPageada ? item.descuentos.find(d => d.creditoId === c.id) : undefined}
                            onEditar={!estaPageada && trabajadora ? () => abrirEditarPrestamo(trabajadora, c) : undefined}
                            onEliminar={!estaPageada ? () => setConfirmDelete(c) : undefined}
                            formatCurrency={formatCurrency} />
                        ))}
                      </div>
                    )}

                    {/* Botón agregar préstamo */}
                    {!estaPageada && trabajadora && (
                      <button onClick={() => abrirNuevoPrestamo(trabajadora)}
                        className="flex items-center gap-1.5 text-xs text-violet-600 dark:text-violet-400 font-bold hover:underline mt-1">
                        <Plus className="w-3.5 h-3.5" /> Agregar préstamo / adelanto
                      </button>
                    )}

                    {/* Resumen descuentos si hay */}
                    {item.totalDescuentos > 0 && (
                      <div className="flex items-center justify-between text-sm text-rose-600 dark:text-rose-400">
                        <span>Total descuentos</span>
                        <span className="font-bold">-{formatCurrency(item.totalDescuentos)}</span>
                      </div>
                    )}

                    {/* Neto */}
                    <div className="border-t border-gray-100 dark:border-gray-800 pt-2 flex items-center justify-between font-bold">
                      <span className="text-sm text-gray-700 dark:text-gray-200">Neto a pagar</span>
                      <span className="text-emerald-600 dark:text-emerald-400 text-base">{formatCurrency(item.valorNeto)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totales */}
          <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/40 rounded-2xl px-5 py-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-violet-600 dark:text-violet-400 font-semibold uppercase tracking-wide mb-1">Bruto</p>
                <p className="font-black text-gray-900 dark:text-white">{formatCurrency(totalBruto)}</p>
              </div>
              <div>
                <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold uppercase tracking-wide mb-1">Descuentos</p>
                <p className="font-black text-rose-600 dark:text-rose-400">-{formatCurrency(totalDescuentos)}</p>
              </div>
              <div>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wide mb-1">A pagar</p>
                <p className="font-black text-emerald-600 dark:text-emerald-400 text-xl">{formatCurrency(totalNeto)}</p>
              </div>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex gap-3">
            <button onClick={() => exportarPDF()}
              className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-bold text-sm shadow-sm hover:shadow-md transition-all active:scale-95">
              <FileDown className="w-4 h-4" /> PDF
            </button>
            {nominaExistente?.estado === 'pagada' ? (
              <div className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4" /> Nómina ya pagada
              </div>
            ) : (
              <button onClick={() => setObsModal(true)} disabled={pagando || totalNeto <= 0}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-black text-sm shadow-lg shadow-violet-600/30 transition-all active:scale-95 disabled:opacity-40">
                <Wallet className="w-4 h-4" />
                {pagando ? 'Procesando…' : `Pagar ${formatCurrency(totalNeto)}`}
              </button>
            )}
          </div>
        </>)}

        {/* ── TAB HISTORIAL ─────────────────────────────────────────────── */}
        {tab === 'historial' && (<>
          {nominas.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <Clock className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-semibold">Sin nóminas registradas</p>
              <p className="text-sm mt-1">Las nóminas pagadas aparecerán aquí</p>
            </div>
          ) : (
            <div className="space-y-3">
              {[...nominas].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(n => (
                <div key={n.id} className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white text-sm">{periodoLabel(n)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{n.fechaInicio} → {n.fechaFin}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${n.estado === 'pagada' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                          {n.estado === 'pagada' ? '✓ Pagada' : 'Borrador'}
                        </span>
                        {n.fechaPago && <p className="text-xs text-gray-400 mt-1">{n.fechaPago}</p>}
                      </div>
                    </div>
                  </div>
                  <div className="px-4 py-3">
                    <div className="grid grid-cols-3 gap-3 text-center text-xs mb-3">
                      <div><p className="text-gray-400 mb-0.5">Bruto</p><p className="font-bold text-gray-700 dark:text-gray-200">{formatCurrency(n.totalBruto)}</p></div>
                      <div><p className="text-gray-400 mb-0.5">Descuentos</p><p className="font-bold text-rose-600 dark:text-rose-400">-{formatCurrency(n.totalDescuentos)}</p></div>
                      <div><p className="text-gray-400 mb-0.5">Pagado</p><p className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(n.totalNeto)}</p></div>
                    </div>
                    {/* Resumen rápido por trabajadora */}
                    <div className="space-y-1 mb-3">
                      {n.items.map(item => (
                        <div key={item.trabajadorId} className="flex items-center justify-between text-xs py-1 border-t border-gray-50 dark:border-gray-800">
                          <span className="text-gray-600 dark:text-gray-300 font-medium">{item.trabajadorNombre}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-gray-400">{item.diasTrabajados}d</span>
                            {item.totalDescuentos > 0 && <span className="text-rose-500">-{formatCurrency(item.totalDescuentos)}</span>}
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(item.valorNeto)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Botones */}
                    <div className="flex gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
                      <button onClick={() => setSelectedNomina(n)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 font-bold text-xs hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors">
                        <Eye className="w-3.5 h-3.5" /> Ver detalle
                      </button>
                      <button onClick={() => exportarPDF(n)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold text-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <FileDown className="w-3.5 h-3.5" /> PDF
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>)}
      </div>

      {/* ── Modal detalle de nómina ──────────────────────────────────────── */}
      {selectedNomina && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-2xl my-4">
            {/* Header modal */}
            <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h2 className="font-black text-gray-900 dark:text-white text-lg">{periodoLabel(selectedNomina)}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{selectedNomina.fechaInicio} → {selectedNomina.fechaFin}</p>
                {selectedNomina.fechaPago && (
                  <span className="inline-flex items-center gap-1 mt-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Pagada el {selectedNomina.fechaPago}
                  </span>
                )}
              </div>
              <button onClick={() => setSelectedNomina(null)} className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 mt-1">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Items detallados */}
            <div className="px-6 py-4 space-y-4">
              {selectedNomina.items.map(item => (
                <div key={item.trabajadorId} className="border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
                  {/* Header trabajadora */}
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center font-black text-violet-700 dark:text-violet-300 text-sm">
                        {item.trabajadorNombre.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white text-sm">{item.trabajadorNombre}</p>
                        <p className="text-xs text-gray-400">{item.diasTrabajados}/{item.totalDiasPeriodo} días · Sal. {formatCurrency(item.salarioBase)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400">Neto</p>
                      <p className="font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(item.valorNeto)}</p>
                    </div>
                  </div>

                  {/* Desglose */}
                  <div className="px-4 py-3 space-y-1.5 text-sm">
                    <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                      <span>Valor bruto</span>
                      <span className="font-semibold">{formatCurrency(item.valorBruto)}</span>
                    </div>

                    {item.descuentos.length > 0 && (
                      <div className="mt-1 pt-1 border-t border-dashed border-gray-200 dark:border-gray-700 space-y-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Descuentos</p>
                        {item.descuentos.map((d, idx) => (
                          <div key={idx} className="flex items-center justify-between text-rose-600 dark:text-rose-400">
                            <span className="text-xs">{d.concepto}</span>
                            <span className="text-xs font-bold">-{formatCurrency(d.monto)}</span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between text-xs font-bold text-rose-700 dark:text-rose-300 pt-0.5">
                          <span>Total descuentos</span>
                          <span>-{formatCurrency(item.totalDescuentos)}</span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800 font-bold text-gray-900 dark:text-white">
                      <span>Neto a pagar</span>
                      <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(item.valorNeto)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Totales globales */}
            <div className="mx-6 mb-4 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/40 rounded-2xl px-5 py-3">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-violet-600 dark:text-violet-400 font-semibold uppercase tracking-wide mb-1">Bruto total</p>
                  <p className="font-black text-gray-900 dark:text-white text-sm">{formatCurrency(selectedNomina.totalBruto)}</p>
                </div>
                <div>
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold uppercase tracking-wide mb-1">Descuentos</p>
                  <p className="font-black text-rose-600 dark:text-rose-400 text-sm">-{formatCurrency(selectedNomina.totalDescuentos)}</p>
                </div>
                <div>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wide mb-1">Total pagado</p>
                  <p className="font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(selectedNomina.totalNeto)}</p>
                </div>
              </div>
            </div>

            {/* Observaciones */}
            {selectedNomina.observaciones && (
              <div className="mx-6 mb-4 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Observaciones</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{selectedNomina.observaciones}</p>
              </div>
            )}

            {/* Acción PDF */}
            <div className="flex justify-end gap-3 px-6 pb-6">
              <button onClick={() => setSelectedNomina(null)}
                className="px-5 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-bold text-sm">
                Cerrar
              </button>
              <button onClick={() => exportarPDF(selectedNomina)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm shadow-lg transition-all active:scale-95">
                <FileDown className="w-4 h-4" /> Exportar PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal confirmar pago ─────────────────────────────────────────── */}
      {obsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-black text-gray-900 dark:text-white">Confirmar pago</h2>
              <button onClick={() => setObsModal(false)} className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"><X className="w-4 h-4 text-gray-500" /></button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Se pagará <span className="font-bold text-gray-800 dark:text-white">{formatCurrency(totalNeto)}</span> y se descontarán los montos configurados de cada préstamo y consumo.
            </p>
            <textarea value={obsText} onChange={e => setObsText(e.target.value)}
              placeholder="Observaciones opcionales…" rows={3}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-transparent text-gray-800 dark:text-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-violet-400 mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setObsModal(false)} className="flex-1 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-bold text-sm">Cancelar</button>
              <button onClick={pagarNomina} disabled={pagando}
                className="flex-1 py-3 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-black text-sm shadow-lg transition-all active:scale-95 disabled:opacity-40">
                {pagando ? 'Procesando…' : '✓ Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal gestionar préstamo ─────────────────────────────────────── */}
      {loanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-black text-gray-900 dark:text-white text-base">
                  {loanModal.credito ? 'Editar préstamo' : 'Nuevo préstamo'}
                </h2>
                <p className="text-xs text-gray-400">{loanModal.trabajadorNombre}</p>
              </div>
              <button onClick={() => setLoanModal(null)} className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"><X className="w-4 h-4 text-gray-500" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Descripción</label>
                <input type="text" value={loanForm.descripcion}
                  onChange={e => setLoanForm(f => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Ej: Préstamo uniforme, adelanto quincenal…"
                  className="mt-1 w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-transparent text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Monto total del préstamo</label>
                <input type="number" min={0} value={loanForm.monto || ''}
                  onChange={e => {
                    const m = Number(e.target.value) || 0;
                    setLoanForm(f => ({ ...f, monto: m, saldo: loanModal.credito ? f.saldo : m }));
                  }}
                  placeholder="0"
                  className="mt-1 w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-transparent text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400" />
              </div>
              {loanModal.credito && (
                <div>
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Saldo pendiente</label>
                  <input type="number" min={0} max={loanForm.monto} value={loanForm.saldo || ''}
                    onChange={e => setLoanForm(f => ({ ...f, saldo: Math.min(Number(e.target.value) || 0, f.monto) }))}
                    className="mt-1 w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-transparent text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={loanForm.descontarDeSalario}
                  onChange={e => setLoanForm(f => ({ ...f, descontarDeSalario: e.target.checked }))}
                  className="accent-violet-600 w-4 h-4" />
                <span className="text-sm text-gray-700 dark:text-gray-200 font-medium">Descontar de nómina</span>
              </label>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setLoanModal(null)} className="flex-1 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-bold text-sm">Cancelar</button>
              <button onClick={guardarPrestamo} disabled={loanSaving}
                className="flex-1 py-3 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-black text-sm shadow-lg transition-all active:scale-95 disabled:opacity-40">
                {loanSaving ? 'Guardando…' : loanModal.credito ? 'Guardar cambios' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal confirmar eliminar ─────────────────────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-6 max-w-xs w-full text-center">
            <Trash2 className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <h2 className="font-black text-gray-900 dark:text-white mb-1">¿Eliminar préstamo?</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              "<span className="font-semibold">{confirmDelete.descripcion}</span>" — saldo {formatCurrency(confirmDelete.saldo)}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-600 font-bold text-sm">Cancelar</button>
              <button onClick={() => eliminarPrestamo(confirmDelete)}
                className="flex-1 py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black text-sm shadow-lg transition-all active:scale-95">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
