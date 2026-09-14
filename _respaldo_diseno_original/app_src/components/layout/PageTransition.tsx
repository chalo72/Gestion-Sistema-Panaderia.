import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageTransitionProps {
    children: ReactNode;
    /** Clave que, al cambiar, dispara la animación */
    viewKey: string;
    className?: string;
}

/**
 * Componente de transición de página (The Experience).
 * Al cambiar de vista, aplica fade-in + slide-up + blur con CSS puro.
 * Sin dependencia de Framer Motion ni GSAP.
 *
 * IMPORTANTE: willChange se aplica SOLO durante la animación (450ms) y luego se elimina.
 * Si se deja permanente, crea un stacking context que rompe position:fixed en páginas hijas
 * (la barra inferior del POS queda relativa al contenedor, no al viewport real del móvil).
 */
export function PageTransition({ children, viewKey, className }: PageTransitionProps) {
    const [isAnimating, setIsAnimating] = useState(true);

    useEffect(() => {
        // Reset de animación al cambiar de clave
        setIsAnimating(false);
        let timeoutId: ReturnType<typeof setTimeout>;
        // Forzar reflow para reiniciar la animación CSS
        const frame = requestAnimationFrame(() => {
            setIsAnimating(true);
            // Limpiar willChange al terminar la animación (duración 0.4s + margen)
            timeoutId = setTimeout(() => setIsAnimating(false), 450);
        });
        return () => {
            cancelAnimationFrame(frame);
            clearTimeout(timeoutId);
        };
    }, [viewKey]);

    return (
        <div
            key={viewKey}
            className={cn(className, isAnimating ? 'page-transition-enter' : '')}
            style={isAnimating ? { willChange: 'transform, opacity, filter' } : undefined}
        >
            {children}
        </div>
    );
}
