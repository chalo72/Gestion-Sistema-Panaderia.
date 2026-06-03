import { supabase } from './supabase';

const TABLE = 'usuarios_sistema';
const LOCAL_KEY = 'pricecontrol_local_user_list';

interface UserRow {
    id: string;
    email: string;
    nombre: string;
    apellido: string | null;
    rol: string;
    activo: boolean;
    pwd: string | null;
}

function toRow(user: Record<string, unknown>): UserRow {
    return {
        id: user.id as string,
        email: user.email as string,
        nombre: user.nombre as string,
        apellido: (user.apellido as string) || null,
        rol: user.rol as string,
        activo: user.activo !== false,
        pwd: (user as Record<string, unknown> & { password?: string }).password || null,
    };
}

function fromRow(row: UserRow): Record<string, unknown> {
    return {
        id: row.id,
        email: row.email,
        nombre: row.nombre,
        apellido: row.apellido || '',
        rol: row.rol,
        activo: row.activo,
        password: row.pwd || '',
    };
}

export async function pushUserToCloud(user: Record<string, unknown>): Promise<boolean> {
    try {
        const { error } = await supabase.from(TABLE).upsert(toRow(user), { onConflict: 'id' });
        return !error;
    } catch {
        return false;
    }
}

export async function pushAllUsersToCloud(users: Record<string, unknown>[]): Promise<boolean> {
    if (!users.length) return true;
    try {
        const { error } = await supabase.from(TABLE).upsert(users.map(toRow), { onConflict: 'id' });
        return !error;
    } catch {
        return false;
    }
}

export async function pullUsersFromCloud(): Promise<Record<string, unknown>[]> {
    try {
        const { data, error } = await supabase.from(TABLE).select('*');
        if (error || !data) return [];
        return data.map(row => fromRow(row as UserRow));
    } catch {
        return [];
    }
}

// Agrega usuarios remotos al localStorage. LOCAL SIEMPRE GANA en conflictos,
// EXCEPTO: si el remoto tiene activo=true y el local tiene activo=false,
// se reactiva (corrige desactivaciones accidentales por sync).
export function mergeUsersToLocalStorage(remoteUsers: Record<string, unknown>[]): number {
    if (!remoteUsers.length) return 0;
    const localRaw = localStorage.getItem(LOCAL_KEY);
    const localUsers: Record<string, unknown>[] = localRaw ? JSON.parse(localRaw) : [];

    let changed = 0;
    for (const remote of remoteUsers) {
        const idx = localUsers.findIndex(u => u.id === remote.id || u.email === remote.email);
        if (idx < 0) {
            localUsers.push(remote);
            changed++;
        } else {
            // LOCAL GANA en todo, EXCEPTO reactivar usuarios que estén inactivos localmente
            // pero activos en la nube (el admin los reactivó desde otro dispositivo)
            if (remote.activo === true && localUsers[idx].activo === false) {
                localUsers[idx] = { ...localUsers[idx], activo: true };
                changed++;
            }
        }
    }

    if (changed > 0) {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(localUsers));
    }
    return added;
}

// ── Códigos de acceso offline ──────────────────────────────────────────────────

const CODE_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 días

export function generateAccessCode(user: Record<string, unknown>): string {
    const payload = {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        apellido: user.apellido || '',
        rol: user.rol,
        activo: true,
        password: (user as Record<string, unknown> & { password?: string }).password || '',
        issued: Date.now(),
    };
    return btoa(JSON.stringify(payload));
}

export function decodeAccessCode(code: string): Record<string, unknown> | null {
    try {
        const payload = JSON.parse(atob(code.trim())) as Record<string, unknown>;
        if (!payload.email || !payload.nombre || !payload.rol) return null;
        if (typeof payload.issued === 'number' && Date.now() - payload.issued > CODE_TTL_MS) return null;
        return payload;
    } catch {
        return null;
    }
}

export function applyAccessCode(code: string): { ok: boolean; nombre?: string; error?: string } {
    const user = decodeAccessCode(code);
    if (!user) return { ok: false, error: 'Código inválido o expirado' };

    const localRaw = localStorage.getItem(LOCAL_KEY);
    const localUsers: Record<string, unknown>[] = localRaw ? JSON.parse(localRaw) : [];

    const existingIdx = localUsers.findIndex(u => u.id === user.id || u.email === user.email);
    if (existingIdx >= 0) {
        // El código del admin SIEMPRE corrige los datos existentes.
        // Esto resuelve contraseñas corruptas o cuentas desactivadas por error.
        localUsers[existingIdx] = { ...localUsers[existingIdx], ...user, activo: true };
    } else {
        localUsers.push(user);
    }

    localStorage.setItem(LOCAL_KEY, JSON.stringify(localUsers));
    return { ok: true, nombre: user.nombre as string };
}
