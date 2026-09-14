import { useState, useEffect } from 'react';
import { Monitor, Wifi, Globe, X, Zap, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Environment = 'local' | 'wifi' | 'global';

export function EnvironmentBanner() {
  const [env, setEnv] = useState<Environment>('local');
  const [host, setHost] = useState('');
  const [isVisible, setIsVisible] = useState(true);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const hostname = window.location.hostname;
    const port = window.location.port;
    setHost(`${hostname}${port ? `:${port}` : ''}`);

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      setEnv('local');
    } else if (/^(192\.168|172\.(1[6-9]|2[0-9]|3[0-1])|10\.)/.test(hostname)) {
      setEnv('wifi');
    } else {
      setEnv('global');
    }
  }, []);

  if (!isVisible) return null;

  const config = {
    local: {
      color: 'bg-blue-600',
      shadow: 'shadow-blue-500/20',
      label: 'MODO TALLER (DESARROLLO)',
      icon: <Monitor className="w-3.5 h-3.5" />,
      desc: 'Edición en vivo activa. Los cambios se ven al instante.',
      step: 'Paso 1: Programar y ajustar funciones.',
      cmd: 'npm run dev'
    },
    wifi: {
      color: 'bg-emerald-600',
      shadow: 'shadow-emerald-500/20',
      label: 'MODO RED LOCAL (WIFI)',
      icon: <Wifi className="w-3.5 h-3.5" />,
      desc: 'Compartiendo App en tu oficina. Ideal para tablets/celulares.',
      step: 'Paso 2: Probar uso en dispositivos reales.',
      cmd: 'npm run wifi'
    },
    global: {
      color: 'bg-violet-600',
      shadow: 'shadow-violet-500/20',
      label: 'MODO SISTEMA GLOBAL (INTERNET)',
      icon: <Globe className="w-3.5 h-3.5" />,
      desc: 'Versión oficial en la nube. Acceso desde cualquier lugar.',
      step: 'Paso 3: Operación final del negocio.',
      cmd: 'npm run deploy'
    }
  };

  const current = config[env];

  return (
    <div className={cn(
      "relative z-[100] w-full transition-all duration-500 animate-ag-slide-in-top",
      current.color,
      current.shadow,
      "border-b border-white/10"
    )}>
      <div className="max-w-[1400px] mx-auto px-4 h-9 flex items-center justify-between text-white overflow-hidden">
        
        {/* Identificador Izquierda */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-[10px] font-black tracking-tighter uppercase border border-white/20">
            {current.icon}
            {current.label}
          </div>
          <span className="hidden md:inline-block text-[10px] font-medium opacity-80 border-l border-white/20 pl-3">
            {current.desc}
          </span>
        </div>

        {/* Guía de Flujo Derecha */}
        <div className="flex items-center gap-6">
          <div className="hidden lg:flex items-center gap-2 group cursor-help" onClick={() => setShowGuide(!showGuide)}>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-black/20 text-[9px] font-bold">
              <Zap className="w-3 h-3 text-yellow-400" />
              ORDEN: {current.step}
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-[10px] bg-black/30 px-3 py-1 rounded-md border border-white/5">
            {host}
          </div>

          <button 
            onClick={() => setIsVisible(false)}
            className="p-1 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Guía Desplegable (Mini) */}
      {showGuide && (
        <div className="absolute top-full left-0 w-full bg-black/90 backdrop-blur-xl border-b border-white/10 p-4 animate-ag-fade-in shadow-2xl">
          <div className="max-w-[1400px] mx-auto">
            <h4 className="text-xs font-black text-white/50 uppercase tracking-[2px] mb-4 flex items-center gap-2">
              <HelpCircle className="w-4 h-4" /> Flujo de Trabajo Antigravity
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { step: '1', name: 'DESARROLLO', cmd: 'npm run dev', color: 'text-blue-400', desc: 'Para programar y ver cambios.' },
                { step: '2', name: 'PRUEBA WIFI', cmd: 'npm run wifi', color: 'text-emerald-400', desc: 'Para tablets y celulares en la oficina.' },
                { step: '3', name: 'DESPLIEGUE', cmd: 'npm run deploy', color: 'text-violet-400', desc: 'Para el acceso global definitivo.' },
              ].map((s) => (
                <div key={s.step} className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-start gap-3">
                  <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2", s.color.replace('text', 'border'))}>
                    {s.step}
                  </div>
                  <div>
                    <h5 className={cn("text-[10px] font-black", s.color)}>{s.name}</h5>
                    <code className="text-[10px] text-white/40 block mt-1">{s.cmd}</code>
                    <p className="text-[10px] text-white/60 mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
