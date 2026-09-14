import * as rrweb from 'rrweb';
import localforage from 'localforage';
import { firestore } from '@/lib/firebase';
import { collection, getDocs, doc as fbDoc, getDoc, setDoc, query, orderBy, limit } from 'firebase/firestore';

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
            // Cada 300 eventos, guardamos en la base de datos local y nube
            if (events.length >= 300) {
                saveCurrentSession();
            }
        },
        // Configuraciones de privacidad (ignora contraseñas)
        maskAllInputs: false,
        maskInputOptions: { password: true },
    }) || null;

    // Sincronizar periódicamente cada 30 segundos
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
        
        // Mantener historial de las últimas 10 sesiones locales
        const keys = await localforage.keys();
        const sessionKeys = keys.filter(k => k.startsWith('sesion_')).sort();
        if (sessionKeys.length > 10) {
            const keysToDelete = sessionKeys.slice(0, sessionKeys.length - 10);
            for (const key of keysToDelete) {
                await localforage.removeItem(key);
            }
        }

        // Sincronizar en Firestore para acceso remoto en Vercel
        if (firestore && newSession.length > 0) {
            try {
                // Guardar los últimos 350 eventos más relevantes de la sesión
                const serialized = JSON.stringify(newSession.slice(-350));
                const ts = parseInt(currentSessionId.split('_')[1] || `${Date.now()}`);
                await setDoc(fbDoc(firestore, 'auditoria_sesiones', currentSessionId), {
                    id: currentSessionId,
                    timestamp: ts,
                    fecha: new Date(ts).toISOString(),
                    eventsJson: serialized,
                    eventCount: newSession.length,
                    updatedAt: new Date().toISOString(),
                }, { merge: true });
            } catch (cloudErr) {
                // Modo offline tolerante
                console.warn('⚠️ [Auditoría] Sincronización nube en espera:', cloudErr);
            }
        }
    } catch (e) {
        console.error("Error guardando auditoría:", e);
    }
}

export async function getAuditoriaSessions(): Promise<{ id: string; date: Date; isCloud?: boolean }[]> {
    const sessionMap = new Map<string, { id: string; date: Date; isCloud?: boolean }>();

    // 1. Cargar sesiones locales
    try {
        const keys = await localforage.keys();
        const sessionKeys = keys.filter(k => k.startsWith('sesion_')).sort((a, b) => b.localeCompare(a));
        for (const key of sessionKeys) {
            const ts = parseInt(key.split('_')[1]);
            sessionMap.set(key, {
                id: key,
                date: new Date(isNaN(ts) ? Date.now() : ts),
                isCloud: false,
            });
        }
    } catch {}

    // 2. Cargar sesiones remotas desde Firestore (para Vercel en móvil o PC externa)
    if (firestore) {
        try {
            const q = query(collection(firestore, 'auditoria_sesiones'), orderBy('timestamp', 'desc'), limit(15));
            const snap = await getDocs(q);
            snap.forEach(d => {
                const data = d.data();
                if (data?.id) {
                    const ts = data.timestamp || parseInt(data.id.split('_')[1]) || Date.now();
                    sessionMap.set(data.id, {
                        id: data.id,
                        date: new Date(ts),
                        isCloud: true,
                    });
                }
            });
        } catch (e) {
            console.warn('⚠️ [Auditoría] No se pudieron cargar sesiones de nube:', e);
        }
    }

    return Array.from(sessionMap.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
}

export async function getSessionEvents(sessionId: string): Promise<any[] | null> {
    // 1. Buscar en almacenamiento local
    try {
        const local = await localforage.getItem(sessionId);
        if (local && Array.isArray(local) && local.length > 0) {
            return local;
        }
    } catch {}

    // 2. Si no está local, buscar en la nube (ej. estamos en Vercel en un celular)
    if (firestore) {
        try {
            const snap = await getDoc(fbDoc(firestore, 'auditoria_sesiones', sessionId));
            if (snap.exists()) {
                const data = snap.data();
                if (data?.eventsJson) {
                    const parsed = JSON.parse(data.eventsJson);
                    if (Array.isArray(parsed)) return parsed;
                }
            }
        } catch (e) {
            console.error('⚠️ [Auditoría] Error descargando eventos de nube:', e);
        }
    }

    return null;
}
