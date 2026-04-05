import { useEffect, useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

/**
 * VisualSentinel (v1.0.1 - EAGLE EYES 🦅👁️)
 * Componente que dota de visión a PICO-CLAW mediante capturas de pantalla periódicas.
 * Permite al agente observar el flujo de trabajo para aprender y apoyar.
 */
export function VisualSentinel() {
    const [isObserving, setIsObserving] = useState(false);
    const captureCount = useRef(0);

    useEffect(() => {
        // Ciclo de observación: cada 5 minutos (300000 ms)
        const interval = setInterval(capturarPantalla, 300000);
        
        // Primera captura tras 45 segundos
        const initialTimeout = setTimeout(capturarPantalla, 45000);

        return () => {
            clearInterval(interval);
            clearTimeout(initialTimeout);
        };
    }, []);

    const capturarPantalla = async () => {
        // No capturar en pantallas de Login o si ya se está capturando
        if (window.location.pathname.includes('/login')) return;
        
        setIsObserving(true);
        console.log("🦅 [Eagle Eyes] PICO-CLAW está observando...");

        try {
            const canvas = await html2canvas(document.body, {
                allowTaint: true,
                useCORS: true,
                scale: 0.5, // Reducir escala para ahorrar memoria/espacio
                ignoreElements: (element: Element) => {
                    // Ignorar modales de contraseñas o campos sensibles
                    return element.getAttribute('type') === 'password' || element.hasAttribute('data-private');
                }
            });

            const base64Image = canvas.toDataURL('image/jpeg', 0.6);
            
            // Guardar en window para que el AgentMissionDispatcher pueda acceder
            (window as any).__LAST_PICO_VISION__ = base64Image;
            
            captureCount.current += 1;
            
            // Solo notificar las primeras veces para no molestar
            if (captureCount.current <= 2) {
                toast.info("PICO-CLAW: He capturado una imagen para aprender de tu trabajo.", {
                    icon: <Eye className="w-4 h-4 text-blue-500" />
                });
            }

        } catch (error) {
            console.error("❌ [Eagle Eyes] Error en captura visual:", error);
        } finally {
            setTimeout(() => setIsObserving(false), 2000); // Mantener el "ojo" un momento
        }
    };

    return (
        <div className={cn(
            "fixed bottom-4 left-24 z-50 transition-all duration-1000 flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md border border-white/10 shadow-2xl",
            isObserving 
                ? "bg-blue-600/20 opacity-100 translate-y-0" 
                : "bg-black/10 opacity-40 translate-y-2 hover:opacity-100 hover:translate-y-0 cursor-help"
        )}>
            <div className={cn(
                "w-2 h-2 rounded-full",
                isObserving ? "bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]" : "bg-slate-500"
            )} />
            
            <Eye className={cn(
                "w-3.5 h-3.5 transition-colors",
                isObserving ? "text-blue-400" : "text-slate-400"
            )} />
            
            <span className="text-[10px] font-black uppercase tracking-widest text-white/70 select-none">
                {isObserving ? "PICO OBSERVANDO" : "PICO MODO SOMBRA"}
            </span>

            {isObserving && (
                <div className="absolute -top-12 left-0 animate-bounce">
                     <BadgeLocal className="bg-blue-600 text-white border-none text-[8px] font-black">
                        MODO APRENDIZAJE ACTIVO
                     </BadgeLocal>
                </div>
            )}
        </div>
    );
}

function BadgeLocal({ children, className }: { children: React.ReactNode, className?: string }) {
    return <span className={cn("px-2 py-0.5 rounded text-[10px]", className)}>{children}</span>;
}
