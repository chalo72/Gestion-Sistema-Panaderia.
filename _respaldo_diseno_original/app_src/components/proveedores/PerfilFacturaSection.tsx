import { useRef, useState } from 'react';
import {
  Fingerprint,
  Camera,
  ImageIcon,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Save,
  ScanLine,
  Layers,
  EyeOff,
  ListOrdered,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { analizarFacturaForense, type ResultadoForense } from '@/lib/ocr-service';
import {
  comprimirImagenFacturaReferencia,
  construirPerfilFacturaProveedor,
  proveedorTienePerfilFactura,
} from '@/lib/factura-perfil';
import { extraerLineasConPerfil } from '@/lib/factura-lector-perfil';
import type { PerfilFacturaProveedor, Proveedor } from '@/types';

interface PerfilFacturaSectionProps {
  proveedor: Proveedor;
  onUpdateProveedor: (id: string, updates: Partial<Proveedor>) => Promise<void>;
  formatCurrency: (value: number) => string;
}

type Paso = 'idle' | 'analizando' | 'preview' | 'guardando';

export function PerfilFacturaSection({
  proveedor,
  onUpdateProveedor,
  formatCurrency,
}: PerfilFacturaSectionProps) {
  const inputUploadRef = useRef<HTMLInputElement>(null);
  const inputCameraRef = useRef<HTMLInputElement>(null);

  const perfilGuardado = proveedor.perfilFactura;
  const tienePerfil = proveedorTienePerfilFactura(perfilGuardado);

  const [paso, setPaso] = useState<Paso>('idle');
  const [progreso, setProgreso] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewPerfil, setPreviewPerfil] = useState<PerfilFacturaProveedor | null>(null);
  const [resultadoCrudo, setResultadoCrudo] = useState<ResultadoForense | null>(null);

  const resetPreview = () => {
    setPaso('idle');
    setProgreso(0);
    setPreviewUrl(null);
    setPreviewPerfil(null);
    setResultadoCrudo(null);
  };

  const procesarArchivo = async (file: File) => {
    setPaso('analizando');
    setProgreso(0);
    setPreviewPerfil(null);
    setResultadoCrudo(null);

    try {
      const [resultado, imagenRef] = await Promise.all([
        analizarFacturaForense(file, (pct) => setProgreso(pct)),
        comprimirImagenFacturaReferencia(file),
      ]);

      if (resultado.errores.length > 0 && resultado.calidadOCR < 15) {
        toast.warning(resultado.errores[0]);
      }

      const perfil = construirPerfilFacturaProveedor(resultado, imagenRef);
      setPreviewUrl(imagenRef);
      setPreviewPerfil(perfil);
      setResultadoCrudo(resultado);
      setPaso('preview');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo analizar la factura';
      toast.error(msg);
      setPaso('idle');
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void procesarArchivo(file);
  };

  const guardarPerfil = async () => {
    if (!previewPerfil) return;
    setPaso('guardando');
    try {
      const confirmado: PerfilFacturaProveedor = {
        ...previewPerfil,
        confirmadoEn: new Date().toISOString(),
      };
      await onUpdateProveedor(proveedor.id, { perfilFactura: confirmado });
      toast.success(`Perfil de factura guardado para ${proveedor.nombre}`);
      resetPreview();
    } catch {
      toast.error('No se pudo guardar el perfil');
      setPaso('preview');
    }
  };

  const quitarPerfil = async () => {
    if (!window.confirm(`¿Quitar el perfil de factura de ${proveedor.nombre}?`)) return;
    try {
      await onUpdateProveedor(proveedor.id, { perfilFactura: undefined });
      toast.success('Perfil de factura eliminado');
      resetPreview();
    } catch {
      toast.error('No se pudo eliminar el perfil');
    }
  };

  const perfilMostrar = previewPerfil ?? (tienePerfil ? perfilGuardado : null);
  const imagenMostrar = previewUrl ?? perfilGuardado?.imagenReferencia ?? null;
  const lineasExtraidas =
    previewPerfil?.lineasEjemplo ??
    (resultadoCrudo && previewPerfil
      ? extraerLineasConPerfil(resultadoCrudo.textoOriginal, previewPerfil)
      : perfilGuardado?.lineasEjemplo ?? []);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Encabezado */}
      <div className="rounded-2xl border border-indigo-200/80 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-50/90 to-violet-50/40 dark:from-indigo-950/40 dark:to-slate-900/60 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-3 rounded-2xl bg-indigo-600 text-white shadow-lg shrink-0">
              <Fingerprint className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black uppercase tracking-widest text-indigo-800 dark:text-indigo-200">
                Reconocimiento de factura
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed max-w-xl">
                Sube una foto de referencia de la factura de este proveedor. El sistema aprende
                <strong> cómo está organizada </strong>
                (cabecera, ítems, totales) — como una foto de rostro. No registra productos automáticamente.
              </p>
            </div>
          </div>
          {tienePerfil && !previewPerfil && (
            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-black uppercase text-[9px] tracking-widest shrink-0">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Perfil activo
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <Button
            type="button"
            variant="outline"
            disabled={paso === 'analizando' || paso === 'guardando'}
            onClick={() => inputCameraRef.current?.click()}
            className="h-10 rounded-xl font-black text-[10px] uppercase tracking-widest gap-2 border-indigo-300 text-indigo-700 dark:border-indigo-800 dark:text-indigo-300"
          >
            <Camera className="w-4 h-4" /> Tomar foto
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={paso === 'analizando' || paso === 'guardando'}
            onClick={() => inputUploadRef.current?.click()}
            className="h-10 rounded-xl font-black text-[10px] uppercase tracking-widest gap-2 border-indigo-300 text-indigo-700 dark:border-indigo-800 dark:text-indigo-300"
          >
            <ImageIcon className="w-4 h-4" /> Subir imagen
          </Button>
          {tienePerfil && (
            <Button
              type="button"
              variant="outline"
              disabled={paso === 'analizando' || paso === 'guardando'}
              onClick={() => void quitarPerfil()}
              className="h-10 rounded-xl font-black text-[10px] uppercase tracking-widest gap-2 border-rose-300 text-rose-600 dark:border-rose-800"
            >
              <Trash2 className="w-4 h-4" /> Quitar perfil
            </Button>
          )}
        </div>

        <input ref={inputUploadRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        <input ref={inputCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
      </div>

      {paso === 'analizando' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mx-auto" />
          <p className="text-xs font-black uppercase tracking-widest text-slate-500">
            Analizando estructura de la factura… {progreso}%
          </p>
          <Progress value={progreso} className="h-2 max-w-xs mx-auto" />
        </div>
      )}

      {paso === 'preview' && previewPerfil && (
        <div className="rounded-2xl border-2 border-amber-300/80 dark:border-amber-700/60 bg-amber-50/50 dark:bg-amber-950/20 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p className="text-xs font-bold">
              Revisa el mapa abajo. Si cuadra con la factura de {proveedor.nombre}, guarda el perfil.
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={resetPreview} className="h-9 text-[10px] font-black uppercase">
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void guardarPerfil()}
              disabled={paso === 'guardando'}
              className="h-9 bg-indigo-600 hover:bg-indigo-700 font-black text-[10px] uppercase tracking-widest gap-2"
            >
              {paso === 'guardando' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar perfil
            </Button>
          </div>
        </div>
      )}

      {(imagenMostrar || perfilMostrar) && paso !== 'analizando' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {imagenMostrar && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-100 dark:bg-slate-900">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-4 py-2 border-b border-slate-200 dark:border-slate-800">
                Factura de referencia
              </p>
              <img
                src={imagenMostrar}
                alt={`Referencia ${proveedor.nombre}`}
                className="w-full max-h-[420px] object-contain bg-white dark:bg-slate-950"
              />
            </div>
          )}

          {perfilMostrar && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <ScanLine className="w-4 h-4 text-indigo-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tipo detectado</span>
                </div>
                <p className="text-sm font-black text-slate-900 dark:text-white">{perfilMostrar.etiquetaTipo}</p>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {perfilMostrar.nitDetectado && (
                    <div><span className="text-slate-400 font-bold">NIT</span><p className="font-black">{perfilMostrar.nitDetectado}</p></div>
                  )}
                  {perfilMostrar.fechaFacturaEjemplo && (
                    <div><span className="text-slate-400 font-bold">Fecha ej.</span><p className="font-black">{perfilMostrar.fechaFacturaEjemplo}</p></div>
                  )}
                  {perfilMostrar.numeroFacturaEjemplo && (
                    <div><span className="text-slate-400 font-bold">Nº factura</span><p className="font-black">{perfilMostrar.numeroFacturaEjemplo}</p></div>
                  )}
                  {perfilMostrar.totalFacturaEjemplo != null && perfilMostrar.totalFacturaEjemplo > 0 && (
                    <div><span className="text-slate-400 font-bold">Total ej.</span><p className="font-black">{formatCurrency(perfilMostrar.totalFacturaEjemplo)}</p></div>
                  )}
                  <div><span className="text-slate-400 font-bold">Calidad OCR</span><p className="font-black">{perfilMostrar.calidadReferencia}%</p></div>
                  <div><span className="text-slate-400 font-bold">Líneas leídas</span><p className="font-black">{perfilMostrar.lineasEjemploDetectadas}</p></div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Layers className="w-4 h-4 text-violet-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Zonas de la factura</span>
                </div>
                <ul className="space-y-2">
                  {perfilMostrar.zonas.map((z) => (
                    <li key={z.id} className="rounded-xl bg-slate-50 dark:bg-slate-900/80 px-3 py-2 border border-slate-100 dark:border-slate-800">
                      <p className="text-xs font-black text-slate-800 dark:text-slate-100">{z.titulo}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{z.descripcion}</p>
                      <p className="text-[9px] font-bold text-indigo-500 mt-1">Líneas {z.lineaInicio}–{z.lineaFin}</p>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <ListOrdered className="w-4 h-4 text-emerald-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Productos detectados (3 campos)
                  </span>
                </div>
                {lineasExtraidas.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900/80 text-[9px] font-black uppercase tracking-widest text-slate-500">
                          <th className="px-3 py-2">Descripción</th>
                          <th className="px-3 py-2 w-16">Cant.</th>
                          <th className="px-3 py-2 w-24 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineasExtraidas.map((l, i) => (
                          <tr key={`${l.descripcion}-${i}`} className="border-t border-slate-100 dark:border-slate-800">
                            <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-100">{l.descripcion}</td>
                            <td className="px-3 py-2 font-black text-indigo-600">{l.cantidad} {l.unidad ?? 'UND'}</td>
                            <td className="px-3 py-2 font-black text-right text-rose-600">{formatCurrency(l.valorTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    No se extrajeron líneas limpias. Revisa la foto o guarda el perfil y ajusta en la próxima factura.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <ListOrdered className="w-4 h-4 text-emerald-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Columnas del detalle</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {perfilMostrar.columnas.filter((c) => c.presente).map((c) => (
                    <Badge key={c.id} variant="outline" className="font-black text-[9px] uppercase">
                      {c.etiqueta}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <EyeOff className="w-4 h-4 text-rose-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Ignorar al leer</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  {perfilMostrar.textosIgnorar.slice(0, 8).join(' · ')}…
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="w-4 h-4 text-blue-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Reglas de lectura</span>
                </div>
                <ul className="space-y-1.5">
                  {perfilMostrar.reglasLectura.map((r) => (
                    <li key={r} className="text-[11px] text-slate-600 dark:text-slate-300 flex gap-2">
                      <span className="text-indigo-400 shrink-0">•</span>{r}
                    </li>
                  ))}
                </ul>
              </div>

              {resultadoCrudo && paso === 'preview' && (
                <p className={cn('text-[10px] font-bold px-1', 'text-slate-400')}>
                  Vista previa: {lineasExtraidas.length} línea{lineasExtraidas.length !== 1 ? 's' : ''} limpias
                  (descripción, cantidad, valor total). Al guardar, el sistema usará este molde para {proveedor.nombre}.
                </p>
              )}

              {tienePerfil && perfilGuardado?.confirmadoEn && !previewPerfil && (
                <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  Confirmado el {new Date(perfilGuardado.confirmadoEn).toLocaleString('es-CO')}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {!imagenMostrar && !perfilMostrar && paso === 'idle' && (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 py-16 text-center">
          <Fingerprint className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-black text-slate-500">Sin perfil de factura</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Toma o sube una foto de una factura real de {proveedor.nombre} para enseñarle al sistema su formato.
          </p>
        </div>
      )}
    </div>
  );
}
