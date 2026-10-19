/**
 * useConfirmar — reemplazo de window.confirm() por un diálogo dentro de la app.
 *
 * El confirm() nativo puede bloquearse o no mostrarse en una PWA instalada en iPhone (ya se tuvo
 * que reemplazar en otras pantallas, commit 153d3b71), y entonces la acción se cancela sin avisar.
 *
 * Uso:
 *   const { confirmar, dialogo } = useConfirmar();
 *   if (!(await confirmar({ titulo: '¿Eliminar cliente?', destructivo: true }))) return;
 *   ...
 *   return (<div>{dialogo} ...</div>);   // el diálogo debe estar renderizado en el árbol
 */
import { useCallback, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export interface OpcionesConfirmar {
  titulo: string;
  descripcion?: string;
  confirmarTexto?: string;
  cancelarTexto?: string;
  /** Pinta el botón de confirmar en rojo (eliminaciones). */
  destructivo?: boolean;
}

export function useConfirmar() {
  const [opciones, setOpciones] = useState<OpcionesConfirmar | null>(null);
  const resolver = useRef<((valor: boolean) => void) | null>(null);

  const cerrar = useCallback((valor: boolean) => {
    resolver.current?.(valor);
    resolver.current = null;
    setOpciones(null);
  }, []);

  const confirmar = useCallback(
    (o: OpcionesConfirmar) =>
      new Promise<boolean>((resolve) => {
        resolver.current?.(false); // si había otra pregunta abierta, se cancela
        resolver.current = resolve;
        setOpciones(o);
      }),
    [],
  );

  const dialogo = (
    <AlertDialog open={opciones !== null} onOpenChange={(abierto) => { if (!abierto) cerrar(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{opciones?.titulo}</AlertDialogTitle>
          {opciones?.descripcion && (
            <AlertDialogDescription className="whitespace-pre-line">{opciones.descripcion}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="max-md:h-11">{opciones?.cancelarTexto ?? 'Cancelar'}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => cerrar(true)}
            className={`max-md:h-11 ${opciones?.destructivo ? 'bg-rose-600 hover:bg-rose-700 text-white' : ''}`}
          >
            {opciones?.confirmarTexto ?? 'Aceptar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirmar, dialogo };
}
