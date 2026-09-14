import React, { useState, useRef } from 'react';
import { Camera, UploadCloud, CheckCircle2, ScanLine, X, Search, FileText } from 'lucide-react';
import { createWorker } from 'tesseract.js';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

export interface ScanResult {
  fecha?: string;
  monto?: number;
  proveedorNombre?: string;
  facturaNum?: string;
  textoBruto: string;
  archivo: File;
  previewUrl: string;
}

interface EscanerFacturaIAProps {
  isOpen: boolean;
  onClose: () => void;
  onScanComplete: (result: ScanResult) => void;
  modo: 'PROVEEDOR' | 'CLIENTE';
  proveedoresLista?: { nombre: string }[];
  titulo?: string;
  descripcion?: string;
}

export function EscanerFacturaIA({ isOpen, onClose, onScanComplete, modo, proveedoresLista = [], titulo = 'El Archivista IA', descripcion = 'Escanea tu factura y extraere los datos automaticamente.' }: EscanerFacturaIAProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<Partial<ScanResult> | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error('El archivo es muy pesado (Máximo 10MB)');
        return;
      }
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setResult(null);
    }
  };

  const procesarConTesseract = async (imageFile: File) => {
    setIsScanning(true);
    setProgress(10);
    try {
      const worker = await createWorker('spa', 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
          }
        }
      });
      
      const imageUrl = URL.createObjectURL(imageFile);
      const ret = await worker.recognize(imageUrl);
      const text = ret.data.text;
      await worker.terminate();
      
      analizarTextoIA(text, imageFile, imageUrl);
    } catch (error) {
      console.error('Error OCR:', error);
      toast.error('Error al leer la imagen. Intenta con otra foto.');
      setIsScanning(false);
    }
  };

  const analizarTextoIA = (texto: string, originalFile: File, urlPreview: string) => {
    // EL ARCHIVISTA (Reglas de Inferencia)
    const lineas = texto.split('\n').map(l => l.trim()).filter(Boolean);
    const textoUpper = texto.toUpperCase();

    let posibleMonto = 0;
    let posibleFecha = '';
    let posibleProveedor = '';
    let posibleFactura = '';

    // 1. Buscar Montos (Patrones comunes: TOTAL, VALOR, $, etc)
    const regexMoneda = /\$?\s?(?:[1-9]\d{0,2}(?:[.,]\d{3})*|0)(?:[.,]\d{2})?/g;
    const montosEncontrados = texto.match(regexMoneda);
    if (montosEncontrados) {
      // Tomamos el monto más alto como posible total
      const numeros = montosEncontrados.map(m => parseFloat(m.replace(/[^\d]/g, ''))).filter(n => n > 100);
      if (numeros.length > 0) {
        posibleMonto = Math.max(...numeros);
      }
    }

    // 2. Buscar Fechas (DD/MM/YYYY, DD-MM-YYYY)
    const regexFecha = /\b(0[1-9]|[12]\d|3[01])[/-](0[1-9]|1[0-2])[/-](19|20)\d{2}\b/;
    const fechaMatch = texto.match(regexFecha);
    if (fechaMatch) {
      const partes = fechaMatch[0].split(/[/-]/);
      posibleFecha = `${partes[2]}-${partes[1]}-${partes[0]}`;
    } else {
      posibleFecha = new Date().toISOString().split('T')[0];
    }

    // 3. Buscar Proveedor
    if (modo === 'PROVEEDOR' && proveedoresLista.length > 0) {
      for (const prov of proveedoresLista) {
        const provNameUpper = prov.nombre.toUpperCase();
        if (provNameUpper.length > 3 && textoUpper.includes(provNameUpper)) {
          posibleProveedor = prov.nombre;
          break;
        }
      }
      if (!posibleProveedor && lineas.length > 0) {
        posibleProveedor = lineas[0].substring(0, 30);
      }
    }

    // 4. Buscar Número de Factura
    const factMatch = textoUpper.match(/(?:FACTURA|FAC|NO\.|Nº|FV)[\s:-]*([A-Z0-9-]{3,15})/);
    if (factMatch && factMatch[1]) {
      posibleFactura = factMatch[1];
    }

    setResult({
      textoBruto: texto,
      fecha: posibleFecha,
      monto: posibleMonto,
      proveedorNombre: posibleProveedor,
      facturaNum: posibleFactura,
      archivo: originalFile,
      previewUrl: urlPreview
    });

    setIsScanning(false);
    toast.success('¡El Archivista terminó de leer el documento!');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 rounded-3xl overflow-hidden p-0">
        <div className="bg-indigo-600 p-6 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-20">
            <ScanLine className="w-24 h-24" />
          </div>
          <h2 className="text-xl font-black relative z-10 flex items-center justify-center gap-2">
            <Search className="w-5 h-5" />
            {titulo}
            </h2>
          <p className="text-indigo-200 text-sm mt-1 relative z-10">
            {descripcion}
          </p>
        </div>

        <div className="p-6 space-y-6">
          {!file && !isScanning && (
            <div className="grid grid-cols-2 gap-4">
              <Button 
                onClick={() => cameraInputRef.current?.click()}
                className="h-32 flex flex-col gap-3 rounded-2xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 border-none shadow-none"
              >
                <Camera className="w-8 h-8" />
                <span className="font-bold text-sm">Usar Cámara</span>
              </Button>
              <Button 
                onClick={() => fileInputRef.current?.click()}
                className="h-32 flex flex-col gap-3 rounded-2xl bg-slate-50 text-slate-700 hover:bg-slate-100 border-none shadow-none"
              >
                <UploadCloud className="w-8 h-8" />
                <span className="font-bold text-sm">Subir Archivo</span>
              </Button>
              
              <input 
                type="file" 
                accept="image/*" 
                capture="environment" 
                ref={cameraInputRef} 
                className="hidden" 
                onChange={handleFileChange} 
              />
              <input 
                type="file" 
                accept="image/*,.pdf" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleFileChange} 
              />
            </div>
          )}

          {file && !isScanning && !result && (
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 aspect-[3/4] bg-slate-100">
                {preview && <img src={preview} alt="Factura" className="w-full h-full object-contain" />}
                <Button 
                  size="icon" 
                  variant="destructive" 
                  className="absolute top-2 right-2 rounded-full w-8 h-8"
                  onClick={() => { setFile(null); setPreview(null); }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <Button 
                className="w-full h-12 rounded-xl text-md font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/30"
                onClick={() => procesarConTesseract(file)}
              >
                <ScanLine className="w-5 h-5 mr-2" />
                Iniciar Lectura IA
              </Button>
            </div>
          )}

          {isScanning && (
            <div className="py-12 flex flex-col items-center justify-center space-y-6">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 border-4 border-indigo-100 rounded-full animate-ping"></div>
                <div className="absolute inset-2 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                <Search className="absolute inset-0 m-auto w-8 h-8 text-indigo-600" />
              </div>
              <div className="text-center space-y-2 w-full">
                <h3 className="font-bold text-slate-700">El Archivista está leyendo...</h3>
                <Progress value={progress} className="h-2 w-full bg-slate-100" />
                <p className="text-xs text-slate-500 font-medium">{progress}% completado</p>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 flex gap-4">
                <div className="w-16 h-20 rounded-lg overflow-hidden shrink-0 bg-white border border-emerald-200">
                  <img src={result.previewUrl} className="w-full h-full object-cover opacity-80" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-emerald-700 font-bold mb-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Análisis Exitoso</span>
                  </div>
                  {modo === 'PROVEEDOR' && (
                    <p className="text-sm text-slate-700 font-medium truncate">
                      Prov: <span className="text-slate-900 font-bold">{result.proveedorNombre || 'No detectado'}</span>
                    </p>
                  )}
                  <p className="text-sm text-slate-700 font-medium">
                    Total: <span className="text-slate-900 font-bold">${(result.monto || 0).toLocaleString()}</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {result.fecha} {result.facturaNum ? `• Factura: ${result.facturaNum}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1 h-12 rounded-xl"
                  onClick={() => { setFile(null); setResult(null); }}
                >
                  Reescanear
                </Button>
                <Button 
                  className="flex-1 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/30"
                  onClick={() => {
                    onScanComplete(result as ScanResult);
                    onClose();
                  }}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Usar Datos
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}


