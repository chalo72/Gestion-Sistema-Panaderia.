import { Shield, Zap, Database, Globe, Cloud, Bug } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Protocolo {
  id: string;
  nombre: string;
  descripcion: string;
  icon: typeof Shield;
  color: string;
  /** Sin interruptor real — etiqueta honesta */
  etiqueta: 'Informativo' | 'Sin interruptor';
}

const PROTOCOLOS: Protocolo[] = [
  {
    id: 'escudo-ki',
    nombre: 'Escudo de Ki',
    descripcion: 'Protección estricta. Ninguna modificación al código se realiza sin recibir autorización explícita.',
    icon: Shield,
    color: 'text-emerald-400',
    etiqueta: 'Informativo'
  },
  {
    id: 'hakai-bugs',
    nombre: 'Hakai de Bugs',
    descripcion: 'Elimina race conditions e inicializaciones erróneas en bases de datos locales (IndexedDB).',
    icon: Bug,
    color: 'text-red-400',
    etiqueta: 'Sin interruptor'
  },
  {
    id: 'genkidama-datos',
    nombre: 'Genkidama de Datos',
    descripcion: 'Asegura sincronización perfecta entre dispositivos. Previene ecos y resurrección de registros.',
    icon: Database,
    color: 'text-blue-400',
    etiqueta: 'Informativo'
  },
  {
    id: 'fusion-potara',
    nombre: 'Fusión Potara a Vercel',
    descripcion: 'Pipeline de despliegue automatizado. Compila y envía a producción en la nube al instante.',
    icon: Cloud,
    color: 'text-purple-400',
    etiqueta: 'Sin interruptor'
  },
  {
    id: 'ultra-instinto',
    nombre: 'Ultra Instinto',
    descripcion: 'Modo de respuesta instintiva para solucionar fallos críticos simultáneos a la velocidad de la luz.',
    icon: Zap,
    color: 'text-yellow-400',
    etiqueta: 'Sin interruptor'
  },
  {
    id: 'teletransporte-sw',
    nombre: 'Teletransporte SW',
    descripcion: 'Fuerza la activación de Service Workers para asegurar carga offline ininterrumpida.',
    icon: Globe,
    color: 'text-cyan-400',
    etiqueta: 'Informativo'
  }
];

export function ProtocolosArsenal() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-[#DAA520]/10 rounded-xl border border-[#DAA520]/20 shadow-[0_0_15px_rgba(218,165,32,0.15)]">
          <Zap className="w-6 h-6 text-[#DAA520]" />
        </div>
        <div>
          <h3 className="text-lg font-black text-white uppercase tracking-tight">Arsenal de Protocolos</h3>
          <p className="text-xs text-slate-400">Referencia de skills · sin interruptor en esta pantalla</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {PROTOCOLOS.map((p) => {
          const Icon = p.icon;
          const bgHover = p.color.replace('text-', 'hover:border-');
          const bgBadge = p.etiqueta === 'Informativo'
            ? 'bg-slate-500/10 text-slate-300 border-slate-500/20'
            : 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                          
          return (
            <div key={p.id} className={cn("p-4 rounded-xl border border-white/5 bg-slate-900/60 transition-all", bgHover)}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg bg-black/40 border border-white/5", p.color)}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className={cn("text-sm font-black uppercase tracking-tight", p.color)}>{p.nombre}</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed mt-1 max-w-[200px]">{p.descripcion}</p>
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-2">
                  <Badge className={cn("text-[8px] uppercase tracking-widest px-2", bgBadge)}>
                    {p.etiqueta}
                  </Badge>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="pt-4 border-t border-white/10 text-center">
        <p className="text-[10px] text-slate-500 italic">
          Estos nombres describen reglas del equipo. No encienden ni apagan nada desde aquí.
        </p>
      </div>
    </div>
  );
}
