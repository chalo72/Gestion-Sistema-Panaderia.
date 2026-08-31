import * as rrweb from 'rrweb';
import localforage from 'localforage';

localforage.config({
  name: 'PanaderiaDulcePlacer',
  storeName: 'auditoria_caja'
});

let stopRecordingFn: (() => void) | null = null;
let events: any[] = [];
let currentSessionId = '';

export function startAuditoriaSession() {
    if (stopRecordingFn) return; // Already recording
    
    currentSessionId = `sesion_${Date.now()}`;
    events = [];

    stopRecordingFn = rrweb.record({
        emit(event) {
            events.push(event);
            // Cada 500 eventos, guardamos en la base de datos local para no perder nada si se cierra la pestaña
            if (events.length > 500) {
                saveCurrentSession();
            }
        },
        // Configuraciones de privacidad (ignora contraseñas, etc.)
        maskAllInputs: false,
        maskInputOptions: { password: true },
    }) || null;

    // Guardar también cada 30 segundos
    setInterval(saveCurrentSession, 30000);
}

export async function saveCurrentSession() {
    if (events.length === 0) return;
    
    const eventsToSave = [...events];
    events = []; // Limpiamos el buffer
    
    try {
        const existingSession: any = await localforage.getItem(currentSessionId) || [];
        const newSession = existingSession.concat(eventsToSave);
        await localforage.setItem(currentSessionId, newSession);
        
        // Mantener solo un historial de las últimas 10 sesiones (para no llenar el disco del navegador)
        const keys = await localforage.keys();
        const sessionKeys = keys.filter(k => k.startsWith('sesion_')).sort();
        if (sessionKeys.length > 10) {
            const keysToDelete = sessionKeys.slice(0, sessionKeys.length - 10);
            for (const key of keysToDelete) {
                await localforage.removeItem(key);
            }
        }
    } catch (e) {
        console.error("Error guardando auditoría:", e);
    }
}

export async function getAuditoriaSessions() {
    try {
        const keys = await localforage.keys();
        const sessionKeys = keys.filter(k => k.startsWith('sesion_')).sort((a, b) => b.localeCompare(a));
        
        const sessions = [];
        for (const key of sessionKeys) {
            sessions.push({
                id: key,
                date: new Date(parseInt(key.split('_')[1])),
                // No traemos todos los eventos aquí para no bloquear la UI
            });
        }
        return sessions;
    } catch (e) {
        return [];
    }
}

export async function getSessionEvents(sessionId: string) {
    try {
        return await localforage.getItem(sessionId);
    } catch (e) {
        return [];
    }
}
