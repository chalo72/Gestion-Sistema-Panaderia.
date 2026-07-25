import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Sparkles, Brain, Scale, ChefHat, Info } from 'lucide-react';
import { formatMasaAmo, formatGramosAMedidas } from '@/helpers/pesoFormatter';
import type { FormulacionBase, ModeloPan, PlanItem } from '@/types';

interface IaAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  formulaciones: FormulacionBase[];
  modelos: ModeloPan[];
  resumenMasas: any[]; // de resultados.resumenMasas
  sobranteFisico: Record<string, string>;
  groupedItems: Record<string, PlanItem[]>;
}

export function IaAnalysisModal({
  isOpen,
  onClose,
  formulaciones,
  modelos,
  resumenMasas,
  sobranteFisico,
  groupedItems
}: IaAnalysisModalProps) {

  // Lógica del bot (Jefe de Horno)
  const generarReporte = () => {
    if (!resumenMasas || resumenMasas.length === 0) {
      return (
        <div className="text-center p-8">
          <ChefHat className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Aún no hay masas registradas para analizar hoy, jefe.</p>
        </div>
      );
    }

    return resumenMasas.map((masa) => {
      const form = formulaciones.find(f => f.id === masa.formulacionId);
      const nombre = form?.nombre || 'Masa Desconocida';
      
      const targetKg = masa.targetKg || 0;
      const usedKg = masa.usedKg || 0;
      const disponibleArrobas = form?.rendimientoBaseKg ? targetKg / form.rendimientoBaseKg : 0;
      
      const sobranteKg = targetKg - usedKg;
      const sobFisicoValue = sobranteFisico[masa.formulacionId];
      const sobFisicoNum = parseFloat(sobFisicoValue || '0');
      const hasFisico = sobFisicoValue !== undefined && sobFisicoValue !== '';
      
      const desviacionKg = hasFisico ? (sobranteKg - sobFisicoNum) : 0;
      const hasDesperdicioAnormal = hasFisico && desviacionKg > 0.2;
      const hasExcesoAnormal = hasFisico && desviacionKg < -0.2;

      // Calcular info de Vitina/Empaste para esta masa
      const groupItems = groupedItems[masa.formulacionId] || [];
      const vitinasDeModelos = groupItems.map(item => {
        const mod = modelos.find(m => m.id === item.modeloId);
        if (mod?.piqueEmpaste && mod.piqueEmpaste.cantidadInsumo) {
          const piezas = item.piezas || 0;
          const merma = mod.mermaEstimada || 0;
          const pesoTotalMasaParaPanes = (piezas * mod.pesoUnitarioGr) / (1 - merma / 100);
          const numPiques = pesoTotalMasaParaPanes / mod.piqueEmpaste.pesoMasaGr;
          const unit = mod.piqueEmpaste.unidadInsumo;
          const cant = mod.piqueEmpaste.cantidadInsumo * numPiques;
          return unit === 'kg' ? cant * 1000 : unit === 'lb' ? cant * 453.592 : cant;
        }
        return 0;
      });
      const totalVitinaGr = vitinasDeModelos.reduce((a, b) => a + b, 0);

      // Generación del texto amigable
      return (
        <div key={masa.formulacionId} className="mb-6 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
          <h3 className="font-black text-lg text-indigo-700 dark:text-indigo-400 mb-3 flex items-center gap-2">
            <span className="text-2xl">🥖</span> {nombre}
          </h3>
          
          <ul className="space-y-4 text-sm text-slate-700 dark:text-slate-300">
            <li className="flex gap-3">
              <span className="shrink-0 mt-0.5">📦</span>
              <div>
                <strong>Masa disponible:</strong> Tienes <strong>{formatMasaAmo(disponibleArrobas)}</strong> de esta masa listas para trabajar.
              </div>
            </li>
            
            <li className="flex gap-3">
              <span className="shrink-0 mt-0.5">✂️</span>
              <div>
                <strong>Producción planeada:</strong> Según los panes que has agregado, vas a gastar unos <strong>{formatMasaAmo((usedKg / (form?.rendimientoBaseKg || 11.5)))}</strong>.
              </div>
            </li>

            <li className="flex gap-3">
              <span className="shrink-0 mt-0.5">⚖️</span>
              <div>
                <strong>Sobrante esperado:</strong> Te deberían sobrar unos <strong>{sobranteKg > 0 ? formatGramosAMedidas(sobranteKg * 1000) : '0 gramos'}</strong>.
              </div>
            </li>

            {totalVitinaGr > 0 && (
              <li className="flex gap-3 bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
                <span className="shrink-0 mt-0.5">🧈</span>
                <div>
                  <strong>Vitina recomendada:</strong> Para el empaste de los panes que configuraste, necesitarás unos <strong>{formatGramosAMedidas(totalVitinaGr)}</strong> de vitina en total. 
                </div>
              </li>
            )}

            {hasFisico && (
              <div className="mt-4 p-4 rounded-xl border bg-white dark:bg-slate-900 shadow-sm">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-indigo-500" /> Veredicto de la Auditoría
                </h4>
                {hasDesperdicioAnormal ? (
                  <p className="text-rose-600 dark:text-rose-400 font-medium">
                    ⚠️ <strong>¡Pilas!</strong> Te está faltando masa. Reportaste {sobFisicoNum} kg pero deberían sobrar {sobranteKg.toFixed(2)} kg. Hay una pérdida de {desviacionKg.toFixed(2)} kg. Revisa los cortes o si alguien sacó masa sin anotar.
                  </p>
                ) : hasExcesoAnormal ? (
                  <p className="text-amber-600 dark:text-amber-400 font-medium">
                    🧐 <strong>Ojo:</strong> Te está sobrando más masa de la cuenta. Reportaste {sobFisicoNum} kg, que es {Math.abs(desviacionKg).toFixed(2)} kg más de lo esperado. Puede que los cortes los estén haciendo muy pequeños.
                  </p>
                ) : (
                  <p className="text-emerald-600 dark:text-emerald-400 font-medium">
                    ✅ <strong>¡Excelente trabajo!</strong> La masa que te sobra cuadra perfectamente con lo que debías gastar. Los cortes están precisos.
                  </p>
                )}
              </div>
            )}
            
            {!hasFisico && (
              <div className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                Audita el sobrante físico en el Plan Diario para ver el diagnóstico de mermas.
              </div>
            )}
          </ul>
        </div>
      );
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-white dark:bg-slate-900 border-indigo-100 dark:border-indigo-900">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                Análisis del Jefe de Horno <Brain className="w-5 h-5 text-indigo-500" />
              </DialogTitle>
              <DialogDescription className="text-sm font-medium text-slate-500">
                Resumen inteligente de tu producción de hoy, fácil de entender.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto pr-2 mt-4 custom-scrollbar">
          {generarReporte()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
