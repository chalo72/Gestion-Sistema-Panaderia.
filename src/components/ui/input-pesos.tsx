import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Casilla de plata en pesos enteros (2026-11-21, auditoría de Gonzalo).
 *
 * En el celular, <input type="number"> lee "80.000" como vacío o como 80 (el punto lo toma como
 * decimal). Esta casilla acepta "80.000" o "80000", muestra los puntos de miles y entrega el número.
 */
type Props = Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'type'> & {
  value: number | string | null | undefined;
  onValor: (n: number) => void;
};

export const soloDigitos = (v: unknown): string => String(v ?? '').split(/[.,]\d{1,2}$/)[0].replace(/\D/g, '');
export const conPuntos = (digitos: string): string => digitos.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export function InputPesos({ value, onValor, className, ...rest }: Props) {
  const n = typeof value === 'number' ? Math.round(value) : parseInt(soloDigitos(value), 10);
  const mostrado = Number.isFinite(n) && n > 0 ? conPuntos(String(n)) : '';
  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={mostrado}
      // Lo que se escribe: solo cuentan los dígitos (borrar en "8.000" deja "800", no "8")
      onChange={e => onValor(parseInt(e.target.value.replace(/\D/g, ''), 10) || 0)}
      className={cn('text-foreground', className)}
    />
  );
}
