/**
 * Utilidades de exportación de datos — CSV y JSON
 * PriceControl Pro Enterprise
 */

/**
 * Convierte un array de objetos a formato CSV.
 * Escapa comillas dobles y maneja campos con comas.
 */
export function arrayToCSV<T extends Record<string, unknown>>(data: T[], columns?: { key: string; label: string }[]): string {
    if (data.length === 0) return '';

    const keys = columns ? columns.map(c => c.key) : Object.keys(data[0]);
    const headers = columns ? columns.map(c => c.label) : keys;

    const escapeCSV = (value: unknown): string => {
        const str = value === null || value === undefined ? '' : String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const rows = data.map(row =>
        keys.map(key => escapeCSV(row[key])).join(',')
    );

    return [headers.join(','), ...rows].join('\n');
}

/**
 * Descarga un string como archivo en el navegador.
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob(['\ufeff' + content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Exporta datos como CSV.
 */
export function exportCSV<T extends Record<string, unknown>>(
    data: T[],
    filename: string,
    columns?: { key: string; label: string }[]
): void {
    const csv = arrayToCSV(data, columns);
    downloadFile(csv, `${filename}.csv`, 'text/csv');
}

/**
 * Exporta datos como JSON.
 */
export function exportJSON<T>(data: T[], filename: string): void {
    const json = JSON.stringify(data, null, 2);
    downloadFile(json, `${filename}.json`, 'application/json');
}

/**
 * Genera fecha formateada para nombres de archivo.
 */
export function getExportFilename(prefix: string): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    return `${prefix}_${date}`;
}
