import { supabase } from './supabase';
import { registerSelfWrite } from './deviceId';

const TABLE = 'usuarios_sistema';
const LOCAL_KEY = 'pricecontrol_local_user_list';

export const USUARIOS_SYNC_EVENT = 'dp-usuarios-sync';

interface UserRow {
    id: string;
    email: string;
    nombre: string;
    apellido: string | null;
    rol: string;
    activo: boolean;
    pwd: string | null;
    trabajador_id?: string | null;
    updated_at?: string | null;
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
        trabajador_id: (user.trabajadorId as string) || null,
        updated_at: (user.updatedAt as string) || new Date().toISOString(),
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
        trabajadorId: row.trabajador_id || undefined,
        updatedAt: row.updated_at || undefined,
    };
}

export function notifyUsuariosSync(reason: string, userId?: string): void {
    window.dispatchEvent(new CustomEvent(USUARIOS_SYNC_EVENT, {
        detail: { reason, userId },
    }));
}

export async function pushUserToCloud(user: Record<string, unknown>): Promise<boolean> {
    try {
        const row = toRow(user);
        registerSelfWrite(TABLE, row.id);
        const { error } = await supabase.from(TABLE).upsert(row, { onConflict: 'id' });
        return !error;
    } catch {
        return false;
    }
}

export async function deleteUserFromCloud(id: string): Promise<boolean> {
    try {
        registerSelfWrite(TABLE, id);
        const { error } = await supabase.from(TABLE).delete().eq('id', id);
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

function resolverPasswordMerge(
    local: Record<string, unknown>,
    remote: Record<string, unknown>,
): string {
    const localPwd = String(local.password || '').trim();
    const remotePwd = String(remote.password || '').trim();
    const localUpdated = String(local.updatedAt || local.updated_at || '');
    const remoteUpdated = String(remote.updatedAt || remote.updated_at || '');

    if (!localPwd) return remotePwd;
    if (!remotePwd) return localPwd;

    // Clave más reciente gana — si el admin cambió el PIN en otro aparato, llega a todos
    if (remoteUpdated && localUpdated) {
        return remoteUpdated > localUpdated ? remotePwd : localPwd;
    }
    if (remoteUpdated && !localUpdated) return remotePwd;
    return localPwd;
}

// Agrega usuarios remotos al localStorage. LOCAL SIEMPRE GANA en conflictos,
// EXCEPTO: usuario nuevo en nube, o nube más reciente (updated_at).
export function mergeUsersToLocalStorage(remoteUsers: Record<string, unknown>[]): number {
    if (!remoteUsers.length) return 0;
    const localRaw = localStorage.getItem(LOCAL_KEY);
    let localUsers: Record<string, unknown>[] = [];
    if (localRaw) {
        try {
            const parsed: unknown = JSON.parse(localRaw);
            localUsers = Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [];
        } catch {
            localUsers = [];
        }
    }

    const deletedUsers: string[] = JSON.parse(localStorage.getItem('pricecontrol_deleted_users') || '[]');

    let changed = 0;
    for (const remote of remoteUsers) {
        if (deletedUsers.includes(String(remote.id))) {
            continue; // Evitar zombies (usuarios eliminados localmente)
        }

        const idx = localUsers.findIndex(u => u.id === remote.id || u.email === remote.email);
        if (idx < 0) {
            localUsers.push(remote);
            changed++;
            continue;
        }

        const local = localUsers[idx];
        const remoteUpdated = String(remote.updatedAt || remote.updated_at || '');
        const localUpdated = String(local.updatedAt || local.updated_at || '');

        if (remote.activo === true && local.activo === false) {
            localUsers[idx] = {
                ...local,
                ...remote,
                activo: true,
                password: resolverPasswordMerge(local, remote),
            };
            changed++;
            continue;
        }

        if (remoteUpdated && (!localUpdated || remoteUpdated > localUpdated)) {
            const merged: Record<string, unknown> = {
                ...local,
                ...remote,
                password: resolverPasswordMerge(local, remote),
            };
            localUsers[idx] = merged;
            changed++;
        }
    }

    if (changed > 0) {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(localUsers));
    }
    return changed;
}

export function applyRemoteUserRecord(record: Record<string, unknown>, eventType: string): number {
    if (eventType === 'DELETE') {
        const id = record.id as string;
        if (!id) return 0;
        const localRaw = localStorage.getItem(LOCAL_KEY);
        let localUsers: Record<string, unknown>[] = [];
        if (localRaw) {
            try {
                const parsed: unknown = JSON.parse(localRaw);
                localUsers = Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [];
            } catch {
                localUsers = [];
            }
        }
        const antes = localUsers.length;
        localUsers = localUsers.filter((u) => u.id !== id);
        if (localUsers.length !== antes) {
            localStorage.setItem(LOCAL_KEY, JSON.stringify(localUsers));
            const deletedUsers: string[] = JSON.parse(localStorage.getItem('pricecontrol_deleted_users') || '[]');
            if (!deletedUsers.includes(id)) {
                deletedUsers.push(id);
                localStorage.setItem('pricecontrol_deleted_users', JSON.stringify(deletedUsers));
            }
            return 1;
        }
        return 0;
    }

    return mergeUsersToLocalStorage([fromRow(record as UserRow)]);
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
    let localUsers: Record<string, unknown>[] = [];
    if (localRaw) {
        try {
            const parsed: unknown = JSON.parse(localRaw);
            localUsers = Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [];
        } catch {
            localUsers = [];
        }
    }

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
