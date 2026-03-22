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
        enabled: true,
        percentage: 100,
        description: 'Dashboard de analíticas avanzado (rollout gradual)',
    },
    EXPORT_PDF: {
        enabled: true,
        allowedUsers: ['Chalo8321@gmail.com'],
        description: 'Exportar reportes a PDF',
    },
    VOICE_COMMANDS: {
        enabled: true,
        description: 'Control por comandos de voz',
    },
    AI_SUGGESTIONS: {
        enabled: true,
        description: 'Sugerencias inteligentes con IA',
    },
    BARCODE_SCANNER: {
        enabled: true,
        description: 'Escaneo de códigos de barras',
    },
    MULTI_LANGUAGE: {
        enabled: true,
        description: 'Soporte multi-idioma',
    },
    CLOUD_SYNC: {
        enabled: true,
        description: 'Sincronización con la nube automática',
    },
    OFFLINE_MODE: {
        enabled: true,
        description: 'Modo offline completo',
    },
    PREDICTIVE_STOCK: {
        enabled: true,
        description: 'Predicción de stock con IA',
    },
    WHATSAPP_INTEGRATION: {
        enabled: true,
        description: 'Integración con WhatsApp Business',
    },
    EMAIL_NOTIFICATIONS: {
        enabled: true,
        description: 'Notificaciones por correo electrónico',
    },
    CUSTOMER_LOYALTY: {
        enabled: true,
        description: 'Sistema de puntos de fidelidad',
    },
    RECIPE_OPTIMIZER: {
        enabled: true,
        description: 'Optimizador de recetas con IA',
    },
    FACIAL_RECOGNITION: {
        enabled: true,
        description: 'Reconocimiento facial para empleados',
    },
    AUTO_BACKUP: {
        enabled: true,
        description: 'Respaldo automático cada hora',
    },
    DELIVERY_TRACKING: {
        enabled: true,
        description: 'Seguimiento de entregas en tiempo real',
    },
    PRICE_COMPARISON: {
        enabled: true,
        description: 'Comparador de precios en tiempo real',
    },
    NUTRITIONAL_INFO: {
        enabled: true,
        description: 'Información nutricional de productos',
    },
    QR_MENU: {
        enabled: true,
        description: 'Menú digital con código QR',
    },
    AUGMENTED_REALITY: {
        enabled: true,
        description: 'Vista de productos en realidad aumentada',
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
