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
        "bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl p-6 sm:p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-black/40 transition-all duration-500 animate-ag-slide-up",
        onClick && "cursor-pointer hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-indigo-500/20 hover:border-indigo-200/50 dark:hover:border-indigo-500/30",
        className
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
