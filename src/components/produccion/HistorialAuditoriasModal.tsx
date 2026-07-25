import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuditorias } from '@/hooks/useAuditorias';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Trash2, BrainCircuit, Scale, Package, Bot } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ModeloPan } from '@/types';

interface HistorialAuditoriasModalProps {
  isOpen: boolean;
  onClose: () => void;
  modelos: ModeloPan[];
}

export function HistorialAuditoriasModal({ isOpen, onClose, modelos }: HistorialAuditoriasModalProps) {
  const { auditorias, removeAuditoria } = useAuditorias();
  
  const getModeloName = (id: string) => modelos.find(m => m.id === id)?.nombre || 'Pan Desconocido';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden bg-slate-50 dark:bg-slate-900 flex flex-col">
        <DialogHeader className="p-6 pb-4 bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800">
          <div className="flex justify-between items-start">
            <div>
              <DialogTitle className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                <Scale className="w-7 h-7 text-emerald-500" />
                Historial de Auditorías de Producción
              </DialogTitle>
              <DialogDescription className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
                Registro detallado de piques diarios y análisis experto IA de mermas.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 p-6">
          {auditorias.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="w-16 h-16 text-slate-300 dark:text-slate-700 mb-4" />
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">No hay auditorías registradas</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 max-w-sm">
                Cuando guardes una distribución diaria, aparecerá aquí con su respectivo análisis de IA.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {auditorias.map(aud => (
                <div key={aud.id} className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
                  
                  {/* HEADER DEL ITEM */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-emerald-100 dark:bg-emerald-900/40 p-2.5 rounded-xl">
                        <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg text-slate-800 dark:text-white">
                          Auditoría del {format(parseISO(aud.fecha), "dd 'de' MMMM, yyyy", { locale: es })}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5 text-xs font-bold text-slate-500">
                          <Badge variant="outline" className="border-slate-200 text-slate-500 bg-slate-50">
                            Pique de {aud.cantidadArrobas} @
                          </Badge>
                          <span>•</span>
                          <span>{aud.masaTotalKg.toFixed(2)} kg Totales ({(aud.masaTotalKg * 2).toFixed(2).replace('.', ',')} lb)</span>
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeAuditoria(aud.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50 rounded-full">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* RESUMEN DE PANELES */}
                    <div>
                      <h5 className="text-xs font-black uppercase text-slate-400 mb-3 tracking-wider">Detalle del Pique</h5>
                      <div className="space-y-2">
                        {aud.detalles.map((d, i) => (
                          <div key={i} className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl">
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{getModeloName(d.modeloId)}</span>
                            <div className="text-right">
                              <span className="text-sm font-black text-slate-800 dark:text-white block">{d.panesReales} panes</span>
                              <span className="text-[10px] font-bold text-slate-400">{d.masaReqKg.toFixed(2)} kg ({d.porcentajeArroba.toFixed(1)}%)</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 flex gap-2">
                        <div className="flex-1 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 p-2 rounded-xl text-center">
                          <p className="text-[9px] font-black uppercase text-amber-600 mb-0.5">Masa Consumida</p>
                          <p className="font-bold text-amber-700">{aud.masaConsumidaKg.toFixed(2)} kg</p>
                        </div>
                        <div className="flex-1 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 p-2 rounded-xl text-center">
                          <p className="text-[9px] font-black uppercase text-rose-600 mb-0.5">Masa Libre</p>
                          <p className="font-bold text-rose-700">{aud.masaLibreKg.toFixed(2)} kg</p>
                        </div>
                      </div>
                    </div>

                    {/* ANALISIS IA */}
                    <div>
                      <h5 className="text-xs font-black uppercase text-slate-400 mb-3 tracking-wider flex items-center gap-2">
                        <Bot className="w-4 h-4 text-[#F5DEB3]" /> 
                        Dictamen del Jefe de Horno (IA)
                      </h5>
                      <div className="bg-[#F5DEB3]/10 border border-[#F5DEB3]/30 rounded-xl p-4 h-[calc(100%-28px)] flex flex-col">
                        {aud.analisisIA ? (
                          <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                            {aud.analisisIA}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
                            <BrainCircuit className="w-8 h-8 text-[#F5DEB3] mb-2" />
                            <p className="text-xs font-bold text-slate-500">Sin análisis IA registrado.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
