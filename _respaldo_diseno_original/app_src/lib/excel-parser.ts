// Servicio para parsear archivos Excel y CSV
import * as XLSX from 'xlsx';

export interface FilaImportada {
  id: string;
  nombre: string;
  descripcion: string;
  precioUnitario: number;
  costoCompra: number;
  categoria: string;
  proveedor: string;
  unidad: string;
  stockMinimo: number;
  errores: string[];
  fila: number; // Número de fila original
}

export interface ResultadoImportacion {
  filas: FilaImportada[];
  columnas: string[];
  erroresGenerales: string[];
  totalFilas: number;
  filasValidas: number;
}

// Genera un ID único
function generateId(): string {
  return `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Normaliza el nombre de columna
function normalizarColumna(columna: string): string {
  return columna.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
    .replace(/[^a-z0-9]/g, '_')
    .trim();
}

// Mapeo de posibles nombres de columnas
const MAPEO_COLUMNAS: Record<string, string[]> = {
  nombre: ['nombre', 'name', 'producto', 'product', 'descripcion', 'description', 'articulo', 'item'],
  descripcion: ['descripcion', 'description', 'detalle', 'detail', 'observaciones', 'notas'],
  precio: ['precio', 'price', 'precio_venta', 'venta', 'precio_unitario', 'unitario', 'valor'],
  costo: ['costo', 'cost', 'precio_compra', 'compra', 'costo_unitario', 'precio_proveedor'],
  categoria: ['categoria', 'category', 'tipo', 'type', 'grupo', 'group', 'familia'],
  proveedor: ['proveedor', 'supplier', 'vendor', 'distribuidor'],
  unidad: ['unidad', 'unit', 'und', 'medida', 'um'],
  stock: ['stock', 'existencia', 'cantidad', 'quantity', 'inventario', 'stock_minimo'],
};

// Encuentra la columna correspondiente
function encontrarColumna(cabeceras: string[], tipo: string): number {
  const posibles = MAPEO_COLUMNAS[tipo] || [];
  for (let i = 0; i < cabeceras.length; i++) {
    const columna = normalizarColumna(cabeceras[i]);
    if (posibles.some(p => columna.includes(p))) {
      return i;
    }
  }
  return -1;
}

// Parsea un valor numérico
function parsearNumero(valor: any): number {
  if (typeof valor === 'number') return valor;
  if (!valor) return 0;
  
  const texto = String(valor).trim();
  // Remover símbolos de moneda y espacios
  const limpio = texto.replace(/[$€£¥₡]/g, '').replace(/\s/g, '');
  
  // Manejar formatos numéricos
  let numero = limpio;
  const tienePunto = limpio.includes('.');
  const tieneComa = limpio.includes(',');
  
  if (tienePunto && tieneComa) {
    if (limpio.lastIndexOf(',') > limpio.lastIndexOf('.')) {
      numero = limpio.replace(/\./g, '').replace(',', '.');
    } else {
      numero = limpio.replace(/,/g, '');
    }
  } else if (tieneComa) {
    const partes = limpio.split(',');
    if (partes[1]?.length === 2) {
      numero = limpio.replace(',', '.');
    } else {
      numero = limpio.replace(/,/g, '');
    }
  }
  
  return parseFloat(numero) || 0;
}

// Parsea archivo Excel o CSV
export async function parsearArchivo(archivo: File): Promise<ResultadoImportacion> {
  const erroresGenerales: string[] = [];
  
  try {
    const data = await archivo.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    
    // Tomar la primera hoja
    const primeraHoja = workbook.SheetNames[0];
    if (!primeraHoja) {
      return {
        filas: [],
        columnas: [],
        erroresGenerales: ['El archivo no contiene hojas de datos'],
        totalFilas: 0,
        filasValidas: 0,
      };
    }
    
    const hoja = workbook.Sheets[primeraHoja];
    const datosJson = XLSX.utils.sheet_to_json<any[]>(hoja, { header: 1 });
    
    if (datosJson.length < 2) {
      return {
        filas: [],
        columnas: [],
        erroresGenerales: ['El archivo debe tener al menos una fila de cabeceras y una fila de datos'],
        totalFilas: 0,
        filasValidas: 0,
      };
    }
    
    // Primera fila son las cabeceras
    const cabeceras = (datosJson[0] as string[]).map(c => String(c || ''));
    const filasDatos = datosJson.slice(1);
    
    // Encontrar columnas
    const colNombre = encontrarColumna(cabeceras, 'nombre');
    const colDescripcion = encontrarColumna(cabeceras, 'descripcion');
    const colPrecio = encontrarColumna(cabeceras, 'precio');
    const colCosto = encontrarColumna(cabeceras, 'costo');
    const colCategoria = encontrarColumna(cabeceras, 'categoria');
    const colProveedor = encontrarColumna(cabeceras, 'proveedor');
    const colUnidad = encontrarColumna(cabeceras, 'unidad');
    const colStock = encontrarColumna(cabeceras, 'stock');
    
    if (colNombre === -1) {
      erroresGenerales.push('No se encontró columna de nombre/producto. Asegúrate de tener una columna llamada "nombre", "producto" o similar.');
    }
    
    const filas: FilaImportada[] = [];
    
    for (let i = 0; i < filasDatos.length; i++) {
      const fila = filasDatos[i] as any[];
      if (!fila || fila.every(c => !c)) continue; // Saltar filas vacías
      
      const erroresFila: string[] = [];
      const nombre = colNombre >= 0 ? String(fila[colNombre] || '').trim() : '';
      
      if (!nombre) {
        erroresFila.push('Nombre vacío');
      }
      
      const precio = colPrecio >= 0 ? parsearNumero(fila[colPrecio]) : 0;
      const costo = colCosto >= 0 ? parsearNumero(fila[colCosto]) : precio;
      
      filas.push({
        id: generateId(),
        nombre,
        descripcion: colDescripcion >= 0 ? String(fila[colDescripcion] || '').trim() : '',
        precioUnitario: precio,
        costoCompra: costo || precio,
        categoria: colCategoria >= 0 ? String(fila[colCategoria] || '').trim() : '',
        proveedor: colProveedor >= 0 ? String(fila[colProveedor] || '').trim() : '',
        unidad: colUnidad >= 0 ? String(fila[colUnidad] || 'UND').trim() : 'UND',
        stockMinimo: colStock >= 0 ? parsearNumero(fila[colStock]) : 0,
        errores: erroresFila,
        fila: i + 2, // +2 porque índice 0 + cabecera
      });
    }
    
    const filasValidas = filas.filter(f => f.errores.length === 0).length;
    
    return {
      filas,
      columnas: cabeceras,
      erroresGenerales,
      totalFilas: filas.length,
      filasValidas,
    };
  } catch (error) {
    console.error('Error al parsear archivo:', error);
    return {
      filas: [],
      columnas: [],
      erroresGenerales: ['Error al leer el archivo: ' + (error as Error).message],
      totalFilas: 0,
      filasValidas: 0,
    };
  }
}

// Genera una plantilla Excel vacía
export function generarPlantillaExcel(tipo: 'productos' | 'insumos' | 'proveedores' | 'categorias'): void {
  let datos: any[][] = [];
  let nombreArchivo = '';
  
  switch (tipo) {
    case 'productos':
      datos = [
        ['Nombre', 'Descripción', 'Categoría', 'Precio Venta', 'Costo Compra', 'Unidad', 'Stock Mínimo'],
        ['Pan Francés', 'Pan tradicional tipo baguette', 'Panes', 800, 400, 'UND', 20],
        ['Croissant', 'Croissant de mantequilla', 'Panes', 2500, 1200, 'UND', 10],
      ];
      nombreArchivo = 'plantilla_productos.xlsx';
      break;
    case 'insumos':
      datos = [
        ['Nombre', 'Descripción', 'Categoría', 'Precio Compra', 'Unidad', 'Stock Mínimo', 'Proveedor'],
        ['Harina de Trigo', 'Harina todo uso', 'Harinas', 2500, 'KG', 50, 'Harinera del Valle'],
        ['Azúcar', 'Azúcar blanca refinada', 'Azúcares', 3200, 'KG', 25, 'Ingenio Manuelita'],
      ];
      nombreArchivo = 'plantilla_insumos.xlsx';
      break;
    case 'proveedores':
      datos = [
        ['Nombre', 'Teléfono', 'Email', 'Dirección', 'NIT', 'Contacto'],
        ['Harinera del Valle', '3001234567', 'ventas@harinera.com', 'Calle 50 #30-20', '900123456-1', 'Juan Pérez'],
      ];
      nombreArchivo = 'plantilla_proveedores.xlsx';
      break;
    case 'categorias':
      datos = [
        ['Nombre', 'Descripción', 'Color'],
        ['Panes', 'Panes y bollos', '#f59e0b'],
        ['Postres', 'Postres y dulces', '#ec4899'],
      ];
      nombreArchivo = 'plantilla_categorias.xlsx';
      break;
  }
  
  const ws = XLSX.utils.aoa_to_sheet(datos);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Datos');
  
  // Ajustar anchos de columna
  ws['!cols'] = datos[0].map(() => ({ wch: 20 }));
  
  XLSX.writeFile(wb, nombreArchivo);
}

// Parsea un archivo CSV simple (texto)
export function parsearCSVTexto(texto: string): ResultadoImportacion {
  const lineas = texto.split('\n').filter(l => l.trim());
  
  if (lineas.length < 2) {
    return {
      filas: [],
      columnas: [],
      erroresGenerales: ['El CSV debe tener al menos una fila de cabeceras y una fila de datos'],
      totalFilas: 0,
      filasValidas: 0,
    };
  }
  
  // Detectar delimitador
  const primeraLinea = lineas[0];
  const delimitador = primeraLinea.includes(';') ? ';' : ',';
  
  const cabeceras = primeraLinea.split(delimitador).map(c => c.replace(/"/g, '').trim());
  const filasDatos = lineas.slice(1);
  
  const colNombre = encontrarColumna(cabeceras, 'nombre');
  const colDescripcion = encontrarColumna(cabeceras, 'descripcion');
  const colPrecio = encontrarColumna(cabeceras, 'precio');
  const colCosto = encontrarColumna(cabeceras, 'costo');
  const colCategoria = encontrarColumna(cabeceras, 'categoria');
  const colProveedor = encontrarColumna(cabeceras, 'proveedor');
  const colUnidad = encontrarColumna(cabeceras, 'unidad');
  const colStock = encontrarColumna(cabeceras, 'stock');
  
  const filas: FilaImportada[] = [];
  
  for (let i = 0; i < filasDatos.length; i++) {
    const valores = filasDatos[i].split(delimitador).map(v => v.replace(/"/g, '').trim());
    if (valores.every(v => !v)) continue;
    
    const erroresFila: string[] = [];
    const nombre = colNombre >= 0 ? valores[colNombre] || '' : '';
    
    if (!nombre) {
      erroresFila.push('Nombre vacío');
    }
    
    const precio = colPrecio >= 0 ? parsearNumero(valores[colPrecio]) : 0;
    const costo = colCosto >= 0 ? parsearNumero(valores[colCosto]) : precio;
    
    filas.push({
      id: generateId(),
      nombre,
      descripcion: colDescripcion >= 0 ? valores[colDescripcion] || '' : '',
      precioUnitario: precio,
      costoCompra: costo || precio,
      categoria: colCategoria >= 0 ? valores[colCategoria] || '' : '',
      proveedor: colProveedor >= 0 ? valores[colProveedor] || '' : '',
      unidad: colUnidad >= 0 ? valores[colUnidad] || 'UND' : 'UND',
      stockMinimo: colStock >= 0 ? parsearNumero(valores[colStock]) : 0,
      errores: erroresFila,
      fila: i + 2,
    });
  }
  
  return {
    filas,
    columnas: cabeceras,
    erroresGenerales: colNombre === -1 ? ['No se encontró columna de nombre'] : [],
    totalFilas: filas.length,
    filasValidas: filas.filter(f => f.errores.length === 0).length,
  };
}
