// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const goto = vi.fn();
const destroy = vi.fn();
const crearReproductor = vi.fn();
vi.mock('rrweb-player', () => ({ default: class { constructor(o: any) { crearReproductor(o); } goto = goto; $destroy = destroy; } }));
vi.mock('rrweb-player/dist/style.css', () => ({}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() } }));

const sesion = { id: 'sesion_1', inicio: new Date('2026-10-08T09:00:00').getTime(), fin: new Date('2026-10-08T12:00:00').getTime(), date: new Date('2026-10-08T09:00:00'), eventos: 10, clics: 4, entradas: 0, vistas: [], sensibles: [], acciones: [], chunks: [], usuario: 'Ana' };
vi.mock('@/lib/auditoria-rrweb', () => ({
    getAuditoriaSessions: async () => [sesion],
    getSessionEvents: async () => [{ type: 4 }, { type: 2 }, { type: 3 }, { type: 3 }],
    verificarIntegridadSesion: async () => 'ok',
    guardarSesion: async () => {},
}));
vi.mock('@/lib/bitacora-visual', () => ({
    clipsEnRango: async () => [{ id: 'k1', camara_id: 'c1', camara_nombre: 'Caja', capturado_en: new Date().toISOString(), url_clip: 'x.webm', analizado: true, descripcion_ia: 'Alguien come pan', categorias_detectadas: ['consumo_no_registrado'], alerta: true }],
    urlFirmadaClip: async () => 'https://video/x.webm',
}));
const consultar = vi.fn(async (_t: string, _m: string, onChunk: (s: string) => void) => { onChunk('VEREDICTO: ojo'); return 'x'; });
vi.mock('@/constants/agentes', () => ({ consultarAgente: (...a: any[]) => (consultar as any)(...a) }));

import { CCTVDigital } from './CCTVDigital';

const hoy = new Date();
const iso = (h: number) => { const d = new Date(hoy); d.setHours(h, 0, 0, 0); return d.toISOString(); };

async function montar(props: any = {}) {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const root = createRoot(el);
    await act(async () => { root.render(<CCTVDigital {...props} />); });
    await act(async () => { await new Promise(r => setTimeout(r, 20)); });
    return { el, root };
}

describe('CCTVDigital', () => {
    beforeEach(() => { document.body.innerHTML = ''; goto.mockClear(); crearReproductor.mockClear(); consultar.mockClear(); });

    it('muestra hallazgos de la auditoría', async () => {
        const { el } = await montar({
            ventas: [{ id: 'v1', fecha: iso(10), total: 30000, metodoPago: 'credito', cliente: '', vendedoraNombre: 'Ana', items: [] }],
        });
        expect(el.querySelector('[data-hallazgo="credito_sin_cliente"]')).toBeTruthy();
        expect(el.querySelector('[data-score]')?.textContent).not.toBe('0');
    });

    it('cruza alertas de video de Videovigilancia', async () => {
        const { el } = await montar();
        expect(el.querySelector('[data-hallazgo="video_alerta"]')).toBeTruthy();
    });

    it('abre una cinta y crea el reproductor con el contenedor ya montado', async () => {
        const { el } = await montar();
        await act(async () => { (el.querySelector('[data-tab="cintas"]') as HTMLElement).click(); });
        await act(async () => { (el.querySelector('[data-sesion="sesion_1"]') as HTMLElement).click(); await new Promise(r => setTimeout(r, 20)); });
        expect(crearReproductor).toHaveBeenCalledTimes(1);
        expect(crearReproductor.mock.calls[0][0].target).toBe(el.querySelector('[data-player]'));
    });

    it('la IA responde con el contexto de la auditoría', async () => {
        const { el } = await montar();
        await act(async () => { (el.querySelector('[data-analisis-ia]') as HTMLElement).click(); await new Promise(r => setTimeout(r, 20)); });
        expect(consultar).toHaveBeenCalledTimes(1);
        expect(consultar.mock.calls[0][0]).toBe('auditor-digital');
        expect(el.querySelector('[data-chat]')?.textContent).toContain('VEREDICTO: ojo');
    });
});
