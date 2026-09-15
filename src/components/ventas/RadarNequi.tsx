import { useEffect, useState, useRef } from "react";
import { BellRing, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface PagoEvento {
  tipo: string;
  monto: number;
  remitente: string;
  descripcion: string;
  banco: string;
  timestamp: string;
}

interface RadarNequiProps {
  onPago?: (pago: PagoEvento) => void;
}

export function RadarNequi({ onPago }: RadarNequiProps) {
  const [conectado, setConectado] = useState(false);
  const [pagos, setPagos] = useState<PagoEvento[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const [nuevos, setNuevos] = useState(0);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const conectar = () => {
      const es = new EventSource("/api/nequi-radar");
      esRef.current = es;

      es.addEventListener("connected", () => setConectado(true));
      es.addEventListener("ping", () => {});
      
      es.addEventListener("pago", (e) => {
        const pago: PagoEvento = JSON.parse(e.data);
        
        // Agregar al historial
        setPagos((prev) => [pago, ...prev].slice(0, 30));
        setNuevos((n) => n + 1);

        // Toast de alerta visible y sonoro
        const montoFmt = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(pago.monto);
        toast.success("Pago recibido por " + montoFmt, {
          description: "De: " + pago.remitente + " via " + pago.banco,
          duration: 10000,
          icon: "💰",
        });

        // Vibrar si el dispositivo lo soporta
        if ("vibrate" in navigator) navigator.vibrate([300, 100, 300]);

        onPago?.(pago);
      });

      es.onerror = () => {
        setConectado(false);
        es.close();
        // Reconexión automática en 5 segundos
        setTimeout(conectar, 5000);
      };
    };

    conectar();
    return () => esRef.current?.close();
  }, []);

  const fmt = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);

  return (
    <>
      {/* Botón Radar */}
      <button
        onClick={() => { setShowPanel(true); setNuevos(0); }}
        className="relative h-8 px-3 rounded-lg border border-pink-200 bg-pink-50 text-pink-700 hover:bg-pink-100 transition-all flex items-center gap-1.5 shrink-0"
        title="Radar de Pagos en Vivo"
      >
        <BellRing className={"w-4 h-4 " + (conectado ? "animate-pulse" : "opacity-40")} />
        <span className="text-[10px] font-black uppercase">Radar Nequi</span>
        {nuevos > 0 && (
          <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center shadow">
            {nuevos}
          </span>
        )}
        <span className={"w-2 h-2 rounded-full ml-1 " + (conectado ? "bg-emerald-500" : "bg-slate-300")} />
      </button>

      {/* Panel Lateral de Pagos */}
      {showPanel && (
        <div className="fixed inset-0 z-[90] flex">
          {/* Overlay */}
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setShowPanel(false)} />
          
          {/* Panel */}
          <div className="w-80 bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <BellRing className="w-5 h-5 text-pink-500" />
                  Radar de Pagos
                </h2>
                <span className={"text-xs flex items-center gap-1 mt-0.5 " + (conectado ? "text-emerald-500" : "text-slate-400")}>
                  <span className={"w-2 h-2 rounded-full " + (conectado ? "bg-emerald-500 animate-pulse" : "bg-slate-300")} />
                  {conectado ? "En vivo — Escuchando pagos" : "Reconectando..."}
                </span>
              </div>
              <button onClick={() => setShowPanel(false)} className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {pagos.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  <BellRing className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  Esperando pagos... Cuando alguien consigne por Nequi, aparecerá aquí al instante.
                </div>
              ) : (
                pagos.map((p, i) => (
                  <div key={i} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-black text-emerald-600 dark:text-emerald-400 text-base">{fmt(p.monto)}</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">{p.remitente}</p>
                        <p className="text-xs text-slate-400">{p.banco} · {new Date(p.timestamp).toLocaleTimeString("es-CO")}</p>
                      </div>
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-1 shrink-0" />
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <p className="text-xs text-slate-400 text-center">
                Los pagos llegan automáticamente desde el celular de caja (MacroDroid) o desde Wompi/QR
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
