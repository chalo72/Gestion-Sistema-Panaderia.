import { Printer, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { historialCliente, textoCuentaCliente } from '@/lib/consumo-clientes';
import type { CreditoCliente } from '@/types';

const escapar = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Detalle de la cuenta de un cliente de confianza: todo lo que debe, para imprimir o mandar por WhatsApp (2026-11-19). */
export function DetalleCuentaCliente({ cliente, creditos, formatCurrency, onCerrar }: {
  cliente: { id: string; nombre: string; telefono?: string };
  creditos: CreditoCliente[];
  formatCurrency: (n: number) => string;
  onCerrar: () => void;
}) {
  const h = historialCliente(creditos, cliente.id);
  const consumo = h.lineas.filter(l => l.origen === 'consumo');
  const otros = h.lineas.filter(l => l.origen === 'credito');

  const enviarWhatsapp = () => {
    const texto = textoCuentaCliente(cliente.nombre, h, formatCurrency);
    const dig = String(cliente.telefono || '').replace(/\D/g, '');
    const numero = dig.length === 10 ? `57${dig}` : dig.length >= 7 ? dig : '';
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`, '_blank');
  };

  const imprimir = () => {
    const filas = (lista: typeof h.lineas) => lista.map(l =>
      `<tr><td>${escapar(l.etiquetaFecha)}</td><td>${escapar(l.texto)}</td><td class="n">${escapar(formatCurrency(l.monto))}</td></tr>`).join('');
    const bloque = (titulo: string, lista: typeof h.lineas, sub: number) => lista.length === 0 ? '' :
      `<h3>${titulo}</h3><table>${filas(lista)}<tr class="s"><td></td><td>Subtotal</td><td class="n">${escapar(formatCurrency(sub))}</td></tr></table>`;
    const hoy = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Cuenta ${escapar(cliente.nombre)}</title>
<style>body{font-family:Arial,sans-serif;max-width:380px;margin:16px auto;color:#111}h2{margin:0}h3{margin:16px 0 4px;font-size:14px}
table{width:100%;border-collapse:collapse;font-size:13px}td{padding:3px 2px;border-bottom:1px dashed #ccc}.n{text-align:right;white-space:nowrap}
.s td{font-weight:bold;border-bottom:none}.t{margin-top:16px;font-size:18px;font-weight:bold;text-align:right}</style></head>
<body><h2>Dulce Placer</h2><p>Cuenta de <b>${escapar(cliente.nombre)}</b><br>${escapar(hoy)}</p>
${bloque('Consumo', consumo, h.deudaConsumo)}${bloque('Registrado en Clientes', otros, h.deudaOtros)}
<p class="t">Total a pagar: ${escapar(formatCurrency(h.deudaTotal))}</p>
<script>window.onload=function(){window.print();}</script></body></html>`;
    const w = window.open('', '_blank');
    if (!w) { toast.error('El navegador bloqueó la ventana de impresión.'); return; }
    w.document.write(html);
    w.document.close();
  };

  const lista = (titulo: string, items: typeof h.lineas, sub: number, etiqueta: string, cls: string) => items.length === 0 ? null : (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-black text-slate-900 dark:text-white">{titulo}</p>
        <p className="text-sm font-black text-slate-900 dark:text-white">{formatCurrency(sub)}</p>
      </div>
      {items.map(l => (
        <div key={l.key} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white">{l.texto}</p>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {l.etiquetaFecha} · <span className={`font-black ${cls}`}>{etiqueta}</span>
            </p>
          </div>
          <p className="text-sm font-black tabular-nums text-slate-900 dark:text-white">{formatCurrency(l.monto)}</p>
        </div>
      ))}
    </div>
  );

  return (
    <Dialog open onOpenChange={v => { if (!v) onCerrar(); }}>
      <DialogContent className="max-w-lg rounded-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-black">Cuenta de {cliente.nombre}</DialogTitle>
        </DialogHeader>
        <div className="rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 p-4">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Debe en total</p>
          <p className="text-3xl font-black text-indigo-700 dark:text-indigo-300">{formatCurrency(h.deudaTotal)}</p>
          {h.deudaOtros > 0 && h.deudaConsumo > 0 && (
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-1">
              Consumo {formatCurrency(h.deudaConsumo)} + registrado en Clientes {formatCurrency(h.deudaOtros)}
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={imprimir} className="h-11 rounded-xl border-2 border-slate-300 dark:border-slate-600 text-sm font-black flex items-center justify-center gap-2 text-slate-800 dark:text-slate-100">
            <Printer className="w-4 h-4" /> Imprimir
          </button>
          <button type="button" onClick={enviarWhatsapp} className="h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black flex items-center justify-center gap-2">
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </button>
        </div>
        {h.lineas.length === 0 && <p className="text-center py-6 text-slate-500 font-medium">No tiene nada pendiente.</p>}
        {lista('Consumo', consumo, h.deudaConsumo, 'Consumo', 'text-violet-700 dark:text-violet-300')}
        {lista('Registrado en Clientes', otros, h.deudaOtros, 'Registrado en Clientes', 'text-slate-700 dark:text-slate-200')}
        <p className="text-xs font-bold text-slate-500">Los abonos y pagos se registran en Créditos de Clientes.</p>
      </DialogContent>
    </Dialog>
  );
}
