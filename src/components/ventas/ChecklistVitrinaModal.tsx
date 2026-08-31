import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertTriangle, ArrowRight, ArrowDownToLine, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function ChecklistVitrinaModal({ isOpen, onClose }: Props) {
  const [checks, setChecks] = useState<Record<string, boolean>>({});

  const tasks = [
    {
      id: 'fifo',
      title: 'Sistema PEPS (FIFO) Aplicado',
      desc: 'El pan que sobró de ayer está ADELANTE. El pan fresco recién horneado se pone ATRÁS.',
      icon: <ArrowRight className="w-5 h-5 text-indigo-500" />,
      color: 'bg-indigo-50 border-indigo-200',
      activeColor: 'bg-indigo-100 border-indigo-500',
    },
    {
      id: 'bandejas',
      title: 'Limpieza de Bandejas',
      desc: 'Las bandejas de exhibición están sacudidas, sin migas viejas ni grasa del día anterior.',
      icon: <Trash2 className="w-5 h-5 text-emerald-500" />,
      color: 'bg-emerald-50 border-emerald-200',
      activeColor: 'bg-emerald-100 border-emerald-500',
    },
    {
      id: 'juntar',
      title: 'Agrupar y Llenar',
      desc: 'No hay bandejas medio vacías. Juntar panes del mismo tipo para que se vea abundante (Vitrina llena vende más).',
      icon: <ArrowDownToLine className="w-5 h-5 text-amber-500" />,
      color: 'bg-amber-50 border-amber-200',
      activeColor: 'bg-amber-100 border-amber-500',
    },
    {
      id: 'revision',
      title: 'Revisión de Calidad (Moho)',
      desc: 'Revisé que ningún pan de días anteriores tenga moho ni esté deforme. Lo dañado se separó para Mermas.',
      icon: <AlertTriangle className="w-5 h-5 text-rose-500" />,
      color: 'bg-rose-50 border-rose-200',
      activeColor: 'bg-rose-100 border-rose-500',
    }
  ];

  const toggleCheck = (id: string) => {
    setChecks(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const allChecked = tasks.every(t => checks[t.id]);

  const handleFinish = () => {
    if (!allChecked) {
      toast.error('Faltan tareas por revisar');
      return;
    }
    toast.success('¡Excelente! Vitrina lista para ventas.');
    onClose();
    // Reiniciamos para el próximo turno
    setTimeout(() => setChecks({}), 500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border-none rounded-3xl overflow-hidden p-0 shadow-2xl">
        <DialogHeader className="p-6 pb-4 bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-slate-900 border-b border-amber-200/50 dark:border-amber-800/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30 shrink-0">
              <span className="text-2xl">📝</span>
            </div>
            <div>
              <DialogTitle className="text-xl font-black text-amber-900 dark:text-amber-100 tracking-tight leading-tight">
                Checklist de Vitrina
              </DialogTitle>
              <DialogDescription className="text-amber-700/80 dark:text-amber-400/80 text-xs font-bold mt-1">
                Asegura la calidad y rotación antes de vender
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
          {tasks.map(task => {
            const isChecked = checks[task.id];
            return (
              <div 
                key={task.id}
                onClick={() => toggleCheck(task.id)}
                className={cn(
                  "p-4 rounded-2xl border-2 transition-all cursor-pointer flex gap-4 items-start active:scale-[0.98]",
                  isChecked ? task.activeColor : task.color
                )}
              >
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors border-2 mt-0.5",
                  isChecked ? "bg-emerald-500 border-emerald-600 text-white" : "bg-white border-slate-300"
                )}>
                  {isChecked && <CheckCircle2 className="w-4 h-4" />}
                </div>
                <div>
                  <h4 className="font-black text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
                    {task.icon} {task.title}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                    {task.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} className="rounded-xl font-bold text-slate-500">
            Cerrar
          </Button>
          <Button 
            disabled={!allChecked}
            onClick={handleFinish}
            className="rounded-xl font-black tracking-widest uppercase shadow-lg bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Confirmar Revisión
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
