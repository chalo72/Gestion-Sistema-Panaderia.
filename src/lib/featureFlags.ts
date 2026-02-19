/**
 * Sistema de Feature Flags — Hot-Swap Live Updates
 * 
 * Permite activar/desactivar features sin hacer deploy.
 * Las flags se pueden controlar via variables de entorno o configuración en runtime.
 */

export interface FeatureFlag {
    /** Si el flag está globalmente habilitado */
    enabled: boolean;
    /** Porcentaje de usuarios que ven la feature (0-100) */
    percentage?: number;
    /** Lista de emails específicos que siempre ven la feature */
    allowedUsers?: string[];
    /** Descripción del flag */
    description: string;
}

/** Definición de todos los feature flags del sistema */
const FLAGS: Record<string, FeatureFlag> = {
    DARK_MODE: {
        enabled: true,
        description: 'Tema oscuro del sistema',
    },
    ORGANIC_UI: {
        enabled: true,
        description: 'Componentes orgánicos con formas blob y respiración',
    },
    PAGE_TRANSITIONS: {
        enabled: true,
        description: 'Transiciones animadas entre secciones',
    },
    ADVANCED_ANALYTICS: {
        enabled: false,
        percentage: 25,
        description: 'Dashboard de analíticas avanzado (rollout gradual)',
    },
    EXPORT_PDF: {
        enabled: false,
        allowedUsers: ['admin@example.com'],
        description: 'Exportar reportes a PDF',
    },
    SMART_REPLENISHMENT: {
        enabled: true,
        description: 'Reabastecimiento inteligente — auto-pedidos por stock bajo',
    },
};

/**
 * Hash simple para rollout gradual basado en usuario.
 * Dado un string, devuelve un número 0-99.
 */
function simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash % 100);
}

/**
 * Verifica si un feature flag está activo para un usuario dado.
 * 
 * @param flagName - Nombre del flag (e.g. 'DARK_MODE')
 * @param userId - Email o ID del usuario (opcional, necesario para rollout gradual)
 * @returns true si la feature está disponible para el usuario
 * 
 * @example
 * ```tsx
 * if (isFeatureEnabled('DARK_MODE')) {
 *   return <DarkModeToggle />;
 * }
 * ```
 */
export function isFeatureEnabled(flagName: string, userId?: string): boolean {
    const flag = FLAGS[flagName];
    if (!flag?.enabled) return false;

    // Si tiene lista de usuarios permitidos
    if (flag.allowedUsers && userId) {
        return flag.allowedUsers.includes(userId);
    }

    // Si tiene rollout gradual por porcentaje
    if (flag.percentage !== undefined && userId) {
        const hash = simpleHash(userId + flagName);
        return hash < flag.percentage;
    }

    return true;
}

/**
 * Hook de React para verificar feature flags.
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const canExport = useFeatureFlag('EXPORT_PDF', user.email);
 *   return canExport ? <ExportButton /> : null;
 * }
 * ```
 */
export function useFeatureFlag(flagName: string, userId?: string): boolean {
    return isFeatureEnabled(flagName, userId);
}

/** Obtiene todos los flags y su estado (útil para panel de admin) */
export function getAllFlags(): Record<string, FeatureFlag> {
    return { ...FLAGS };
}
