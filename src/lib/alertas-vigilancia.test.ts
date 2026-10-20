import { describe, it, expect } from 'vitest';
import { urlCallMeBot, pasaAntiSpam, esCategoriaCritica, normalizarTelefono, notificarAlertaVigilancia, CONFIG_ALERTAS_DEFAULT } from './alertas-vigilancia';

describe('alertas de vigilancia', () => {
    it('arma la URL de CallMeBot solo con datos completos', () => {
        expect(urlCallMeBot({ whatsapp: '', apikey: 'x' }, 'hola')).toBeNull();
        expect(urlCallMeBot({ whatsapp: '300 123 4567', apikey: '' }, 'hola')).toBeNull();
        const u = urlCallMeBot({ whatsapp: '+57 300 123 4567', apikey: 'abc' }, 'robo en caja')!;
        expect(u).toContain('phone=%2B573001234567');
        expect(u).toContain('text=robo%20en%20caja');
        expect(u).toContain('apikey=abc');
    });

    it('normaliza el teléfono', () => {
        expect(normalizarTelefono('+57 (300) 123-4567')).toBe('573001234567');
    });

    it('anti-spam: la misma clave espera 5 minutos', () => {
        const m = new Map<string, number>();
        expect(pasaAntiSpam(m, 'k', 1000)).toBe(true);
        expect(pasaAntiSpam(m, 'k', 60000)).toBe(false);
        expect(pasaAntiSpam(m, 'otra', 60000)).toBe(true);
        expect(pasaAntiSpam(m, 'k', 1000 + 300001)).toBe(true);
    });

    it('categorías críticas', () => {
        expect(esCategoriaCritica(['robo'])).toBe(true);
        expect(esCategoriaCritica(['incumplimiento'])).toBe(false);
        expect(esCategoriaCritica([])).toBe(false);
    });

    it('con "solo críticas" omite las alertas menores', async () => {
        const r = await notificarAlertaVigilancia({ clave: 'x1', titulo: 't', detalle: 'd', critica: false }, { ...CONFIG_ALERTAS_DEFAULT, navegador: false });
        expect(r.omitida).toBe(true);
    });
});
