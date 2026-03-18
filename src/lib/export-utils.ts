/**
 * Utilidades para exportación de datos en el sistema Antigravity
 */

/**
 * Exporta un array de objetos a formato CSV y dispara la descarga
 * @param data Array de objetos con los datos
 * @param filename Nombre del archivo (sin extensión)
 * @param headers Mapeo opcional de cabeceras { key: 'Nombre Amigable' }
 */
export const exportToCSV = (data: any[], filename: string, headers?: Record<string, string>) => {
    if (!data || data.length === 0) return;

    // Obtener las llaves (keys) de los objetos
    const keys = Object.keys(data[0]);

    // Crear la cabecera
    const headerRow = headers
        ? keys.map(key => headers[key] || key).join(',')
        : keys.join(',');

    // Crear las filas de datos
    const csvRows = data.map(row => {
        return keys.map(key => {
            const value = row[key];
            // Escapar comas y comillas para evitar errores en CSV
            const escaped = ('' + value).replace(/"/g, '""');
            return `"${escaped}"`;
        }).join(',');
    });

    // Combinar todo
    const csvContent = [headerRow, ...csvRows].join('\n');

    // Añadir el BOM para que Excel reconozca los acentos (UTF-8)
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    // Crear link temporal y disparar descarga
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
