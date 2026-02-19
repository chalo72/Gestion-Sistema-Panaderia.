import { useEffect, useState, type ReactNode } from 'react';

interface PageTransitionProps {
    children: ReactNode;
    /** Clave que, al cambiar, dispara la animación */
    viewKey: string;
}

/**
 * Componente de transición de página (The Experience).
 * Al cambiar de vista, aplica fade-in + slide-up + blur con CSS puro.
 * Sin dependencia de Framer Motion ni GSAP.
 */
export function PageTransition({ children, viewKey }: PageTransitionProps) {
    const [isAnimating, setIsAnimating] = useState(true);

    useEffect(() => {
        // Reset de animación al cambiar de clave
        setIsAnimating(false);
        // Forzar reflow para reiniciar la animación CSS
        const frame = requestAnimationFrame(() => {
            setIsAnimating(true);
        });
        return () => cancelAnimationFrame(frame);
    }, [viewKey]);

    return (
        <div
            key={viewKey}
            className={isAnimating ? 'page-transition-enter' : ''}
            style={{ willChange: 'transform, opacity, filter' }}
        >
            {children}
        </div>
    );
}
