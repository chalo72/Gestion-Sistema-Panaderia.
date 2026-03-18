// Utilidades de blindaje Antigravity contra errores de tipo
export const safeNumber = (val: any): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (typeof val === 'object') return 0;
    try {
        const num = Number(val);
        return isNaN(num) ? 0 : num;
    } catch {
        return 0;
    }
};

export const safeString = (val: any): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object') {
        try {
            return JSON.stringify(val);
        } catch {
            return '[Objeto]';
        }
    }
    return String(val);
};
