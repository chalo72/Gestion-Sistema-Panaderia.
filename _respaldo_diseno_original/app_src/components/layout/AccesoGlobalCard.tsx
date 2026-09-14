import { useState } from 'react';
import { 
  Globe, Wifi, QrCode, Copy, Check, Send, 
  Smartphone, ExternalLink, ShieldCheck 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AccesoGlobalCardProps {
  publicUrl?: string; // URL de Vercel
  localIp?: string;   // IP de la red WiFi
  nombreNegocio: string;
}

export function AccesoGlobalCard({ publicUrl, localIp, nombreNegocio }: AccesoGlobalCardProps) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const finalPublicUrl = publicUrl || '';
  const finalLocalUrl = localIp ? `http://${localIp}:5173` : '';
  
  // URL activa prioritizada: Global > Local
  const activeUrl = finalPublicUrl || finalLocalUrl || window.location.origin;
  const isGlobal = !!finalPublicUrl;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(activeUrl);
    setCopied(true);
    toast.success('¡Enlace copiado al portapapeles!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const mensaje = `🌟 *ACCESO A ${nombreNegocio.toUpperCase()}* 🌟\n\nEntra al sistema desde aquí:\n🔗 ${activeUrl}\n\n_Acceso seguro via Nexus-Portal_`;
    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank');
  };

  // Generar URL de código QR usando un servicio gratuito y rápido
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(activeUrl)}&bgcolor=FFFFFF&color=020617&format=png`;

  return (
    <Card className="relative overflow-hidden border-none bg-slate-900/60 backdrop-blur-3xl shadow-2xl group animate-ag-fade-in">
      {/* Luces de ambiente Antigravity */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-indigo-500/20 transition-all duration-700" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -ml-16 -mb-16 pointer-events-none" />

      <CardContent className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-1">
            <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#DAA520]" />
              Central de Acceso
            </h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest italic">
              Conectividad Nexus v5.2
            </p>
          </div>
          <div className={cn(
            "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter border animate-ag-pulse",
            isGlobal 
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
              : "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
          )}>
            {isGlobal ? 'ESTADO: GLOBAL' : 'ESTADO: WIFI LOCAL'}
          </div>
        </div>

        {/* Visualización del Enlace */}
        <div className="bg-black/40 border border-white/5 rounded-[1.5rem] p-5 mb-8 group/link transition-all hover:border-white/10">
          <div className="flex items-center gap-4">
            <div className={cn(
              "p-3 rounded-2xl",
              isGlobal ? "bg-emerald-500/20 text-emerald-400" : "bg-indigo-500/20 text-indigo-400"
            )}>
              {isGlobal ? <Globe className="w-6 h-6" /> : <Wifi className="w-6 h-6" />}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Link de Conexión</span>
              <p className="text-sm font-bold text-slate-200 truncate font-mono tracking-tight">
                {activeUrl}
              </p>
            </div>
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={copyToClipboard}
              className="rounded-xl hover:bg-white/5 text-slate-400 hover:text-white"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* QR Code Section */}
        <div className="space-y-6">
          <Button 
            onClick={() => setShowQR(!showQR)}
            className="w-full bg-white/[0.03] border border-white/10 hover:bg-white/[0.07] text-white font-black py-7 rounded-[1.5rem] gap-3 transition-all active:scale-[0.98]"
          >
            <QrCode className={cn("w-5 h-5 transition-transform duration-500", showQR && "rotate-180")} />
            {showQR ? 'OCULTAR CÓDIGO QR' : 'GENERAR CÓDIGO QR RÁPIDO'}
          </Button>

          {showQR && (
            <div className="flex flex-col items-center animate-ag-slide-up">
              <div className="p-4 bg-white rounded-[2rem] shadow-[0_0_40px_rgba(255,255,255,0.1)] mb-4">
                 <img 
                   src={qrUrl} 
                   alt="QR Code de Acceso" 
                   className="w-48 h-48 mix-blend-multiply"
                 />
              </div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest text-center px-8">
                Escanea con la cámara de cualquier celular para entrar al sistema al instante
              </p>
            </div>
          )}
        </div>

        {/* Acciones Rápidas */}
        <div className="grid grid-cols-2 gap-4 mt-8 pt-8 border-t border-white/5">
          <Button 
            onClick={handleShareWhatsApp}
            variant="outline" 
            className="rounded-2xl border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 font-black text-[9px] uppercase tracking-widest h-12"
          >
            <Send className="w-3.5 h-3.5 mr-2" /> 
            WhatsApp
          </Button>
          <Button 
            asChild
            variant="outline" 
            className="rounded-2xl border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 font-black text-[9px] uppercase tracking-widest h-12"
          >
            <a href={activeUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3.5 h-3.5 mr-2" /> 
              Abrir
            </a>
          </Button>
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 opacity-30">
          <Smartphone className="w-3 h-3 text-slate-400" />
          <span className="text-[8px] font-bold uppercase tracking-[0.3em]">Responsive • PWA Ready</span>
        </div>
      </CardContent>
    </Card>
  );
}
