import { useState, useRef, useCallback } from 'react';
import { 
  Upload, FileSpreadsheet, Camera, Loader2, Check, AlertCircle, 
  Download, Trash2, Edit2, Save, X, Plus, Search, ChevronDown 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { procesarImagenFactura, sugerirCategoria, type ProductoDetectado, type ProveedorDetectado } from '@/lib/ocr-service';
import { parsearArchivo, generarPlantillaExcel, type FilaImportada, type ResultadoImportacion } from '@/lib/excel-parser';
import type { Producto, Proveedor, Categoria } from '@/types';

interface CargaMasivaProps {
  productos: Producto[];
  proveedores: Proveedor[];
  categorias: Categoria[];
  onAddProducto: (producto: Omit<Producto, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Producto>;
  onAddProveedor: (proveedor: Omit<Proveedor, 'id' | 'createdAt'>) => Promise<Proveedor>;
  onAddCategoria: (nombre: string, color: string) => Promise<Categoria>;
  formatCurrency: (value: number) => string;
}

type TabType = 'factura' | 'excel';
type ImportState = 'idle' | 'processing' | 'preview' | 'saving' | 'done';

// Colores para categorías nuevas
const COLORES_CATEGORIA = ['#3b82f6', '#ec4899', '#22c55e', '#f59e0b', '#8b5cf6', '#14b8a6', '#ef4444', '#f97316'];

export default function CargaMasiva({
  productos,
  proveedores,
  categorias,
  onAddProducto,
  onAddProveedor,
  onAddCategoria,
  formatCurrency,
}: CargaMasivaProps) {
  const [activeTab, setActiveTab] = useState<TabType>('factura');
  const [importState, setImportState] = useState<ImportState>('idle');
  const [progress, setProgress] = useState(0);
  
  // Estado para OCR/Factura
  const [imagenPreview, setImagenPreview] = useState<string | null>(null);
  const [productosDetectados, setProductosDetectados] = useState<ProductoDetectado[]>([]);
  const [proveedorDetectado, setProveedorDetectado] = useState<ProveedorDetectado | null>(null);
  const [textoOCR, setTextoOCR] = useState<string>('');
  
  // Estado para Excel/CSV
  const [filasImportadas, setFilasImportadas] = useState<FilaImportada[]>([]);
  const [columnasDetectadas, setColumnasDetectadas] = useState<string[]>([]);
  
  // Estado de edición
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('todos');
  
  // Refs
  const inputFileRef = useRef<HTMLInputElement>(null);
  const inputExcelRef = useRef<HTMLInputElement>(null);
  
  // Categorías únicas de los productos detectados/importados
  const categoriasUnicas = [...new Set([
    ...productosDetectados.map(p => p.categoria).filter(Boolean),
    ...filasImportadas.map(f => f.categoria).filter(Boolean),
    ...categorias.map(c => c.nombre),
  ])];
  
  // ================================
  // HANDLERS PARA OCR/FACTURA
  // ================================
  
  const handleImagenFactura = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona una imagen');
      return;
    }
    
    // Mostrar preview
    const reader = new FileReader();
    reader.onload = (ev) => setImagenPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    
    // Procesar con OCR
    setImportState('processing');
    setProgress(0);
    
    try {
      const resultado = await procesarImagenFactura(file, setProgress);
      
      if (resultado.errores.length > 0) {
        resultado.errores.forEach(err => toast.warning(err));
      }
      
      // Sugerir categorías automáticamente
      const productosConCategorias = resultado.productos.map(p => ({
        ...p,
        categoria: p.categoria || sugerirCategoria(p.nombre),
      }));
      
      setProductosDetectados(productosConCategorias);
      setProveedorDetectado(resultado.proveedor);
      setTextoOCR(resultado.texto);
      setImportState('preview');
      
      if (productosConCategorias.length > 0) {
        toast.success(`Se detectaron ${productosConCategorias.length} productos`);
      } else {
        toast.info('No se detectaron productos automáticamente. Puedes agregarlos manualmente.');
      }
    } catch (error) {
      console.error('Error en OCR:', error);
      toast.error('Error al procesar la imagen');
      setImportState('idle');
    }
  }, []);
  
  // ================================
  // HANDLERS PARA EXCEL/CSV
  // ================================
  
  const handleArchivoExcel = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validar extensión
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      toast.error('Por favor selecciona un archivo Excel (.xlsx, .xls) o CSV');
      return;
    }
    
    setImportState('processing');
    setProgress(30);
    
    try {
      const resultado = await parsearArchivo(file);
      setProgress(100);
      
      if (resultado.erroresGenerales.length > 0) {
        resultado.erroresGenerales.forEach(err => toast.error(err));
      }
      
      setFilasImportadas(resultado.filas);
      setColumnasDetectadas(resultado.columnas);
      setImportState('preview');
      
      toast.success(`Se cargaron ${resultado.filasValidas} de ${resultado.totalFilas} filas`);
    } catch (error) {
      console.error('Error al parsear archivo:', error);
      toast.error('Error al leer el archivo');
      setImportState('idle');
    }
  }, []);
  
  // ================================
  // HANDLERS DE EDICIÓN
  // ================================
  
  const handleUpdateProductoDetectado = (id: string, field: keyof ProductoDetectado, value: any) => {
    setProductosDetectados(prev => 
      prev.map(p => p.id === id ? { ...p, [field]: value } : p)
    );
  };
  
  const handleUpdateFilaImportada = (id: string, field: keyof FilaImportada, value: any) => {
    setFilasImportadas(prev => 
      prev.map(f => f.id === id ? { ...f, [field]: value } : f)
    );
  };
  
  const handleDeleteItem = (id: string) => {
    if (activeTab === 'factura') {
      setProductosDetectados(prev => prev.filter(p => p.id !== id));
    } else {
      setFilasImportadas(prev => prev.filter(f => f.id !== id));
    }
  };
  
  const handleAddManual = () => {
    if (activeTab === 'factura') {
      const nuevo: ProductoDetectado = {
        id: `manual_${Date.now()}`,
        nombre: '',
        descripcion: '',
        cantidad: 1,
        unidad: 'UND',
        precioUnitario: 0,
        costoTotal: 0,
        categoria: '',
        confianza: 100,
      };
      setProductosDetectados(prev => [...prev, nuevo]);
      setEditingId(nuevo.id);
    } else {
      const nueva: FilaImportada = {
        id: `manual_${Date.now()}`,
        nombre: '',
        descripcion: '',
        precioUnitario: 0,
        costoCompra: 0,
        categoria: '',
        proveedor: '',
        unidad: 'UND',
        stockMinimo: 0,
        errores: [],
        fila: 0,
      };
      setFilasImportadas(prev => [...prev, nueva]);
      setEditingId(nueva.id);
    }
  };
  
  // ================================
  // GUARDAR EN BASE DE DATOS
  // ================================
  
  const handleGuardarTodo = async () => {
    setImportState('saving');
    let guardados = 0;
    let errores = 0;
    
    try {
      // Primero crear proveedor si fue detectado y no existe
      let newProveedorId = '';
      if (activeTab === 'factura' && proveedorDetectado?.nombre) {
        const proveedorExistente = proveedores.find(
          p => p.nombre.toLowerCase() === proveedorDetectado.nombre.toLowerCase()
        );
        if (!proveedorExistente) {
          try {
            const nuevoProveedor = await onAddProveedor({
              nombre: proveedorDetectado.nombre,
              contacto: proveedorDetectado.nit ? `NIT: ${proveedorDetectado.nit}` : '',
              telefono: proveedorDetectado.telefono || '',
              email: '',
              direccion: proveedorDetectado.direccion || '',
              calificacion: 3,
            });
            newProveedorId = nuevoProveedor.id;
            toast.success(`Proveedor "${proveedorDetectado.nombre}" creado`);
          } catch (err) {
            console.error('Error creando proveedor:', err);
          }
        } else {
          newProveedorId = proveedorExistente.id;
        }
      }
      // Usar la variable para evitar warning de variable no utilizada
      void (newProveedorId);
      
      // Crear categorías nuevas
      const categoriasNuevas = new Set<string>();
      const items = activeTab === 'factura' ? productosDetectados : filasImportadas;
      
      for (const item of items) {
        const categoria = 'categoria' in item ? item.categoria : '';
        if (categoria && !categorias.find(c => c.nombre.toLowerCase() === categoria.toLowerCase())) {
          categoriasNuevas.add(categoria);
        }
      }
      
      for (const nombreCat of Array.from(categoriasNuevas)) {
        try {
          const colorIndex = Array.from(categoriasNuevas).indexOf(nombreCat) % COLORES_CATEGORIA.length;
          const color = COLORES_CATEGORIA[colorIndex];
          await onAddCategoria(nombreCat, color);
        } catch (err) {
          console.error('Error creando categoría:', err);
        }
      }
      
      // Guardar productos
      if (activeTab === 'factura') {
        for (const prod of productosDetectados) {
          if (!prod.nombre.trim()) continue;
          
          try {
            await onAddProducto({
              nombre: prod.nombre,
              categoria: prod.categoria || 'General',
              descripcion: prod.descripcion,
              precioVenta: prod.precioUnitario * 1.3, // Margen 30%
              margenUtilidad: 30,
              tipo: 'ingrediente',
              costoBase: prod.precioUnitario,
              imagen: '',
            });
            guardados++;
          } catch (err) {
            console.error('Error guardando producto:', err);
            errores++;
          }
        }
      } else {
        for (const fila of filasImportadas) {
          if (!fila.nombre.trim() || fila.errores.length > 0) continue;
          
          try {
            await onAddProducto({
              nombre: fila.nombre,
              categoria: fila.categoria || 'General',
              descripcion: fila.descripcion,
              precioVenta: fila.precioUnitario || fila.costoCompra * 1.3,
              margenUtilidad: 30,
              tipo: 'ingrediente',
              costoBase: fila.costoCompra,
              imagen: '',
            });
            guardados++;
          } catch (err) {
            console.error('Error guardando producto:', err);
            errores++;
          }
        }
      }
      
      setImportState('done');
      toast.success(`Se guardaron ${guardados} productos${errores > 0 ? ` (${errores} errores)` : ''}`);
      
      // Limpiar después de 2 segundos
      setTimeout(() => {
        handleReset();
      }, 2000);
      
    } catch (error) {
      console.error('Error en guardado masivo:', error);
      toast.error('Error al guardar los datos');
      setImportState('preview');
    }
  };
  
  const handleReset = () => {
    setImportState('idle');
    setProgress(0);
    setImagenPreview(null);
    setProductosDetectados([]);
    setProveedorDetectado(null);
    setTextoOCR('');
    setFilasImportadas([]);
    setColumnasDetectadas([]);
    setEditingId(null);
    if (inputFileRef.current) inputFileRef.current.value = '';
    if (inputExcelRef.current) inputExcelRef.current.value = '';
  };
  
  // ================================
  // FILTROS
  // ================================
  
  const itemsFiltrados = activeTab === 'factura' 
    ? productosDetectados.filter(p => {
        const matchSearch = p.nombre.toLowerCase().includes(searchTerm.toLowerCase());
        const matchCat = categoriaFiltro === 'todos' || p.categoria === categoriaFiltro;
        return matchSearch && matchCat;
      })
    : filasImportadas.filter(f => {
        const matchSearch = f.nombre.toLowerCase().includes(searchTerm.toLowerCase());
        const matchCat = categoriaFiltro === 'todos' || f.categoria === categoriaFiltro;
        return matchSearch && matchCat;
      });
  
  // ================================
  // RENDER
  // ================================
  
  return (
    <div className="p-4 md:p-8 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Upload className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Carga Masiva</h1>
            <p className="text-sm text-gray-500">Importa productos desde facturas o archivos Excel</p>
          </div>
        </div>
        
        {importState !== 'idle' && (
          <Button variant="outline" onClick={handleReset} className="gap-2">
            <X className="w-4 h-4" />
            Nueva Importación
          </Button>
        )}
      </div>
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
          <TabsTrigger value="factura" className="gap-2" disabled={importState !== 'idle'}>
            <Camera className="w-4 h-4" />
            Foto de Factura
          </TabsTrigger>
          <TabsTrigger value="excel" className="gap-2" disabled={importState !== 'idle'}>
            <FileSpreadsheet className="w-4 h-4" />
            Excel / CSV
          </TabsTrigger>
        </TabsList>
        
        {/* ======================= */}
        {/* TAB: FOTO DE FACTURA */}
        {/* ======================= */}
        <TabsContent value="factura">
          {importState === 'idle' && (
            <Card className="border-dashed border-2 hover:border-violet-500 transition-colors cursor-pointer"
              onClick={() => inputFileRef.current?.click()}>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <input
                  ref={inputFileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImagenFactura}
                  className="hidden"
                />
                <div className="w-20 h-20 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mb-4">
                  <Camera className="w-10 h-10 text-violet-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Subir Foto de Factura
                </h3>
                <p className="text-sm text-gray-500 text-center max-w-md">
                  Toma una foto clara de la factura o selecciona una imagen.
                  El sistema detectará automáticamente los productos, precios y proveedor.
                </p>
                <div className="flex gap-2 mt-6">
                  <Badge variant="outline">JPG</Badge>
                  <Badge variant="outline">PNG</Badge>
                  <Badge variant="outline">HEIC</Badge>
                </div>
              </CardContent>
            </Card>
          )}
          
          {importState === 'processing' && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-12 h-12 text-violet-600 animate-spin mb-4" />
                <h3 className="text-lg font-semibold mb-2">Procesando imagen...</h3>
                <p className="text-sm text-gray-500 mb-4">Leyendo texto de la factura</p>
                <Progress value={progress} className="w-64" />
                <p className="text-xs text-gray-400 mt-2">{progress}%</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        {/* ======================= */}
        {/* TAB: EXCEL/CSV */}
        {/* ======================= */}
        <TabsContent value="excel">
          {importState === 'idle' && (
            <div className="space-y-4">
              <Card className="border-dashed border-2 hover:border-emerald-500 transition-colors cursor-pointer"
                onClick={() => inputExcelRef.current?.click()}>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <input
                    ref={inputExcelRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleArchivoExcel}
                    className="hidden"
                  />
                  <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
                    <FileSpreadsheet className="w-10 h-10 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Subir Archivo Excel o CSV
                  </h3>
                  <p className="text-sm text-gray-500 text-center max-w-md">
                    El archivo debe tener las columnas: nombre, precio, categoría, etc.
                    La primera fila debe ser los encabezados.
                  </p>
                  <div className="flex gap-2 mt-6">
                    <Badge variant="outline">.xlsx</Badge>
                    <Badge variant="outline">.xls</Badge>
                    <Badge variant="outline">.csv</Badge>
                  </div>
                </CardContent>
              </Card>
              
              {/* Descargar Plantillas */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Descargar Plantillas
                  </CardTitle>
                  <CardDescription>
                    Usa estas plantillas para llenar tus datos correctamente
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => generarPlantillaExcel('productos')}>
                    Productos
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => generarPlantillaExcel('insumos')}>
                    Insumos
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => generarPlantillaExcel('proveedores')}>
                    Proveedores
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => generarPlantillaExcel('categorias')}>
                    Categorías
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
          
          {importState === 'processing' && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mb-4" />
                <h3 className="text-lg font-semibold mb-2">Procesando archivo...</h3>
                <Progress value={progress} className="w-64" />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
      
      {/* ======================= */}
      {/* VISTA PREVIA */}
      {/* ======================= */}
      {(importState === 'preview' || importState === 'saving' || importState === 'done') && (
        <div className="mt-6 space-y-4">
          {/* Info de proveedor detectado */}
          {activeTab === 'factura' && proveedorDetectado && (
            <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                    <Check className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Proveedor detectado: <strong>{proveedorDetectado.nombre}</strong>
                    </p>
                    {proveedorDetectado.nit && (
                      <p className="text-xs text-blue-700 dark:text-blue-300">NIT: {proveedorDetectado.nit}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Preview de imagen */}
          {activeTab === 'factura' && imagenPreview && (
            <details className="group">
              <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 flex items-center gap-2">
                <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" />
                Ver imagen original
              </summary>
              <div className="mt-2 max-w-md mx-auto">
                <img src={imagenPreview} alt="Factura" className="rounded-lg shadow-lg" />
              </div>
            </details>
          )}
          
          {/* Toolbar */}
          <Card>
            <CardContent className="py-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Buscar producto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-9"
                  />
                </div>
                <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
                  <SelectTrigger className="w-40 h-9">
                    <SelectValue placeholder="Categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas</SelectItem>
                    {categoriasUnicas.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={handleAddManual} className="gap-1">
                  <Plus className="w-4 h-4" />
                  Agregar Manual
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* Resumen */}
          <div className="flex items-center gap-4 text-sm">
            <Badge variant="secondary" className="gap-1">
              {itemsFiltrados.length} productos
            </Badge>
            {activeTab === 'factura' && productosDetectados.filter(p => p.confianza < 70).length > 0 && (
              <Badge variant="outline" className="gap-1 text-yellow-600 border-yellow-300">
                <AlertCircle className="w-3 h-3" />
                {productosDetectados.filter(p => p.confianza < 70).length} requieren revisión
              </Badge>
            )}
          </div>
          
          {/* Tabla de productos */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-slate-800">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">#</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Nombre</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Categoría</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500">Costo</th>
                    {activeTab === 'factura' && (
                      <th className="text-center py-3 px-4 font-medium text-gray-500">Conf.</th>
                    )}
                    <th className="text-right py-3 px-4 font-medium text-gray-500">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-gray-500">
                        No hay productos. Haz clic en "Agregar Manual" para añadir uno.
                      </td>
                    </tr>
                  ) : (
                    itemsFiltrados.map((item, index) => {
                      const isEditing = editingId === item.id;
                      const isProducto = 'confianza' in item;
                      const nombre = item.nombre;
                      const categoria = item.categoria;
                      const precio = isProducto ? (item as ProductoDetectado).precioUnitario : (item as FilaImportada).costoCompra;
                      const confianza = isProducto ? (item as ProductoDetectado).confianza : 100;
                      
                      return (
                        <tr key={item.id} className={cn(
                          "border-t border-gray-100 dark:border-slate-700",
                          isEditing && "bg-violet-50 dark:bg-violet-950/20",
                          confianza < 70 && "bg-yellow-50 dark:bg-yellow-950/10"
                        )}>
                          <td className="py-3 px-4 text-gray-400">{index + 1}</td>
                          <td className="py-3 px-4">
                            {isEditing ? (
                              <Input
                                value={nombre}
                                onChange={(e) => isProducto 
                                  ? handleUpdateProductoDetectado(item.id, 'nombre', e.target.value)
                                  : handleUpdateFilaImportada(item.id, 'nombre', e.target.value)
                                }
                                className="h-8"
                                autoFocus
                              />
                            ) : (
                              <span className="font-medium">{nombre || <em className="text-gray-400">Sin nombre</em>}</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {isEditing ? (
                              <Select
                                value={categoria}
                                onValueChange={(v) => isProducto
                                  ? handleUpdateProductoDetectado(item.id, 'categoria', v)
                                  : handleUpdateFilaImportada(item.id, 'categoria', v)
                                }
                              >
                                <SelectTrigger className="h-8 w-32">
                                  <SelectValue placeholder="Categoría" />
                                </SelectTrigger>
                                <SelectContent>
                                  {categoriasUnicas.map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                  ))}
                                  <SelectItem value="General">General</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant="outline">{categoria || 'General'}</Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {isEditing ? (
                              <Input
                                type="number"
                                value={precio}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  if (isProducto) {
                                    handleUpdateProductoDetectado(item.id, 'precioUnitario', val);
                                  } else {
                                    handleUpdateFilaImportada(item.id, 'costoCompra', val);
                                  }
                                }}
                                className="h-8 w-24 text-right"
                              />
                            ) : (
                              <span className="font-mono">{formatCurrency(precio)}</span>
                            )}
                          </td>
                          {activeTab === 'factura' && (
                            <td className="py-3 px-4 text-center">
                              <Badge variant={confianza >= 80 ? 'default' : confianza >= 60 ? 'secondary' : 'destructive'}
                                className="text-xs">
                                {confianza}%
                              </Badge>
                            </td>
                          )}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {isEditing ? (
                                <Button size="icon" variant="ghost" className="h-8 w-8"
                                  onClick={() => setEditingId(null)}>
                                  <Save className="w-4 h-4 text-green-600" />
                                </Button>
                              ) : (
                                <Button size="icon" variant="ghost" className="h-8 w-8"
                                  onClick={() => setEditingId(item.id)}>
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                              )}
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500"
                                onClick={() => handleDeleteItem(item.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Botones de acción */}
          <div className="flex items-center justify-between pt-4">
            <Button variant="outline" onClick={handleReset}>
              Cancelar
            </Button>
            <Button 
              onClick={handleGuardarTodo} 
              disabled={importState === 'saving' || importState === 'done' || itemsFiltrados.length === 0}
              className="gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
            >
              {importState === 'saving' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando...
                </>
              ) : importState === 'done' ? (
                <>
                  <Check className="w-4 h-4" />
                  ¡Guardado!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Guardar {itemsFiltrados.length} Productos
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
