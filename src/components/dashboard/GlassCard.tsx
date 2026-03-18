import React from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  gradient?: 'amber' | 'blue' | 'emerald' | 'rose' | 'violet' | 'cyan';
  delay?: number;
}

// Estilo Stitch: tarjetas blancas con border sutil, sin gradientes llamativos
export function GlassCard({ children, className, onClick, gradient, delay = 0 }: GlassCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-300 animate-ag-slide-up",
        onClick && "cursor-pointer hover:shadow-md hover:border-primary/30",
        className
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
