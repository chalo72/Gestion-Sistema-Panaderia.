/**
 * Exporta datos a un archivo CSV compatible con Excel de forma premium.
 * Incluye BOM para que Excel detecte correctamente los caracteres especiales (tildes, Ñ).
 */
export const exportToExcel = (data: any[], fileName: string) => {
  if (!data || data.length === 0) return;

  // Extraer encabezados de forma inteligente
  const headers = Object.keys(data[0]);
  
  // Construir filas
  const csvContent = [
    headers.join(';'), // Excel en español suele usar punto y coma
    ...data.map(row => 
      headers.map(header => {
        const val = row[header];
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') return JSON.stringify(val).replace(/;/g, ',');
        return String(val).replace(/;/g, ',').replace(/\n/g, ' '); 
      }).join(';')
    )
  ].join('\n');

  // Añadir BOM (Byte Order Mark) para compatibilidad total con Excel (UTF-8)
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  
  // Descarga nativa sin dependencias
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${fileName}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
