/**
 * Clasificación de panes por categoría de venta (Pan de sal, Pan de dulce, Croissant…).
 *
 * Lógica (de más a menos confiable):
 *  1. Modelo de pan enlazado al producto (Recetas / Libreta de horno): su `categoriaProduccion`
 *     (pan_sal, pan_dulce, empacado_*, hojaldrado, galleta, torta) manda.
 *  2. Palabras del nombre del producto o del modelo (croissant, galleta, coco, queso, francés…).
 *  3. Si no hay forma de saberlo, NO adivina: se deja en la categoría actual para que la elijas tú.
 *
 * Nada se cambia solo: esto solo SUGIERE; el usuario confirma en Catálogo.
 */
import type { Producto, ModeloPan, FormulacionBase } from '@/types';

export interface CategoriaPanNueva {
  nombre: string;
  color: string;
  icono: string;
}

export const CAT_PAN_SAL: CategoriaPanNueva = { nombre: 'Pan de sal', color: '#d97706', icono: '🥖' };
export const CAT_PAN_DULCE: CategoriaPanNueva = { nombre: 'Pan de dulce', color: '#ec4899', icono: '🍞' };
export const CAT_CROISSANT: CategoriaPanNueva = { nombre: 'Croissant', color: '#eab308', icono: '🥐' };
export const CAT_HOJALDRES: CategoriaPanNueva = { nombre: 'Hojaldres', color: '#ca8a04', icono: '🥐' };
export const CAT_GALLETAS: CategoriaPanNueva = { nombre: 'Galletería', color: '#a16207', icono: '🍪' };
export const CAT_PASTELERIA: CategoriaPanNueva = { nombre: 'Pastelería', color: '#ec4899', icono: '🎂' };

/** Categorías que se ofrecen para ordenar los panes */
export const CATEGORIAS_PAN_OPCIONES: CategoriaPanNueva[] = [
  CAT_PAN_SAL, CAT_PAN_DULCE, CAT_CROISSANT, CAT_HOJALDRES, CAT_GALLETAS, CAT_PASTELERIA,
];

export interface SugerenciaPan {
  productoId: string;
  categoria: string;
  motivo: string;
  confianza: 'alta' | 'media';
}

const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const RE_CROISSANT = /croissant|croisant|cruasan|cuernito|cuernitos/;
const RE_GALLETA = /galleta/;
const RE_HOJALDRE = /hojaldr|palmer|milhoja|mil hoja|napolitana/;
const RE_DULCE = /dulce|coco|guayaba|arequipe|bocadillo|mantecada|roscon|rosca|rosquilla|chocolate|pasas|melado|azucar|canela|manjar|mermelada|donut|dona\b|brownie|ponque|bizcocho|trenza dulce/;
const RE_SAL = /\bsal\b|salad|frances|aliñad|alinad|mogolla|integral|queso|bono|baguette|tajado|hamburguesa|perro|calentano|campesino|ajo|jamon|pollo|centeno|mixto|almojabana|pandebono|pan de yuca/;

function porCategoriaProduccion(cp?: string): { cat: CategoriaPanNueva; motivo: string } | null {
  switch (cp) {
    case 'pan_sal': case 'empacado_sal': return { cat: CAT_PAN_SAL, motivo: 'Su modelo de pan es de masa de sal' };
    case 'pan_dulce': case 'empacado_dulce': return { cat: CAT_PAN_DULCE, motivo: 'Su modelo de pan es de masa de dulce' };
    case 'hojaldrado': return { cat: CAT_HOJALDRES, motivo: 'Su modelo de pan es hojaldrado' };
    case 'galleta': return { cat: CAT_GALLETAS, motivo: 'Su modelo de pan es galleta' };
    case 'torta': return { cat: CAT_PASTELERIA, motivo: 'Su modelo de pan es torta' };
    default: return null;
  }
}

function porNombre(texto: string): { cat: CategoriaPanNueva; motivo: string } | null {
  const t = norm(texto);
  if (RE_CROISSANT.test(t)) return { cat: CAT_CROISSANT, motivo: 'El nombre dice croissant' };
  if (RE_GALLETA.test(t)) return { cat: CAT_GALLETAS, motivo: 'El nombre dice galleta' };
  if (RE_HOJALDRE.test(t)) return { cat: CAT_HOJALDRES, motivo: 'El nombre indica hojaldre' };
  const dulce = RE_DULCE.test(t);
  const sal = RE_SAL.test(t);
  if (dulce && !sal) return { cat: CAT_PAN_DULCE, motivo: 'El nombre parece de pan dulce' };
  if (sal && !dulce) return { cat: CAT_PAN_SAL, motivo: 'El nombre parece de pan de sal' };
  return null;
}

/** Busca el modelo de pan enlazado a un producto */
export function modeloDeProducto(p: Producto, modelos: ModeloPan[]): ModeloPan | undefined {
  const modeloId = (p as any).modeloPanId as string | undefined;
  return (
    modelos.find((m) => m.productoId === p.id || m.productoCatalogoId === p.id) ||
    (modeloId ? modelos.find((m) => m.id === modeloId) : undefined) ||
    modelos.find((m) => norm(m.nombre) === norm(p.nombre))
  );
}

export function sugerirCategoriaPan(p: Producto, modelos: ModeloPan[]): SugerenciaPan | null {
  const modelo = modeloDeProducto(p, modelos);

  const a = porCategoriaProduccion(modelo?.categoriaProduccion);
  if (a) return { productoId: p.id, categoria: a.cat.nombre, motivo: a.motivo, confianza: 'alta' };

  const b = porNombre(p.nombre);
  if (b) return { productoId: p.id, categoria: b.cat.nombre, motivo: b.motivo, confianza: 'media' };

  if (modelo) {
    const c = porNombre(modelo.nombre);
    if (c) return { productoId: p.id, categoria: c.cat.nombre, motivo: `${c.motivo} (modelo "${modelo.nombre}")`, confianza: 'media' };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Desde los MODELOS DE PAN (Recetas Técnicas → Modelos de pan): la lista real
// ─────────────────────────────────────────────────────────────────────────────

/** Masas maestras (ids fijos de la bóveda) → categoría de venta */
const CAT_POR_MASA_ID: Record<string, CategoriaPanNueva> = {
  '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f51': CAT_PAN_SAL,
  '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f52': CAT_PAN_DULCE,
  '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f53': CAT_HOJALDRES,
  '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f54': CAT_PASTELERIA,
  '7d8e9f0a-b1c2-4d3e-8f9a-0b1c2d3e4f55': CAT_GALLETAS,
};

function categoriaDeMasa(f?: Pick<FormulacionBase, 'id' | 'nombre'>): CategoriaPanNueva | null {
  if (!f) return null;
  if (CAT_POR_MASA_ID[f.id]) return CAT_POR_MASA_ID[f.id];
  const n = norm(f.nombre);
  if (/hojaldr/.test(n)) return CAT_HOJALDRES;
  if (/galleta/.test(n)) return CAT_GALLETAS;
  if (/torta|ponque|batido de torta/.test(n)) return CAT_PASTELERIA;
  if (/dulce/.test(n)) return CAT_PAN_DULCE;
  if (/\bsal\b/.test(n)) return CAT_PAN_SAL;
  return null;
}

export interface SugerenciaModelo {
  categoria: string;
  motivo: string;
  confianza: 'alta' | 'media';
}

/** Categoría de venta de un modelo de pan: 1) su categoría de producción, 2) la masa que usa, 3) su nombre */
export function categoriaDeModelo(m: ModeloPan, formulaciones: FormulacionBase[]): SugerenciaModelo | null {
  const f = formulaciones.find((x) => x.id === m.formulacionId);
  const masa = categoriaDeMasa(f);

  const a = porCategoriaProduccion(m.categoriaProduccion);
  if (a) return { categoria: a.cat.nombre, motivo: a.motivo, confianza: 'alta' };

  if (masa) {
    // Hojaldre: si es croissant/cuernito, va a Croissant
    if (masa.nombre === CAT_HOJALDRES.nombre && RE_CROISSANT.test(norm(m.nombre))) {
      return { categoria: CAT_CROISSANT.nombre, motivo: `Masa «${f?.nombre}» y el nombre dice croissant`, confianza: 'alta' };
    }
    return { categoria: masa.nombre, motivo: `Usa la masa «${f?.nombre}»`, confianza: 'alta' };
  }
  const b = porNombre(m.nombre);
  if (b) return { categoria: b.cat.nombre, motivo: b.motivo, confianza: 'media' };
  return null;
}

/** Clave para comparar nombres: sin tildes, sin pesos (45gr) ni signos */
export function claveNombre(s: string): string {
  return norm(s)
    .replace(/\b\d+([.,]\d+)?\s*(gr|g|gramos|und|unidades|u)?\b/g, ' ')
    .replace(/[^a-z0-9ñ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type EstadoFila = 'ok' | 'mover' | 'vincular' | 'crear';

export interface FilaModelo {
  modelo: ModeloPan;
  masa: string;
  sugerencia: SugerenciaModelo | null;
  producto?: Producto;
  /** true si el producto se encontró por nombre parecido (el modelo aún no lo tiene vinculado) */
  vinculadoPorNombre: boolean;
  estado: EstadoFila;
}

export interface PlanOrdenPanes {
  filas: FilaModelo[];
  /** Productos de venta que siguen en «Panes» y no pertenecen a ningún modelo */
  huerfanos: Producto[];
  pendientes: number;
}

export function planOrdenPanes(
  productos: Producto[], modelos: ModeloPan[], formulaciones: FormulacionBase[], categoriaGeneral = 'Panes'
): PlanOrdenPanes {
  const ventas = productos.filter((p) => p.tipo !== 'ingrediente');
  const porId = new Map(ventas.map((p) => [p.id, p]));
  const usados = new Set<string>();

  const filas: FilaModelo[] = modelos
    .filter((m) => m.activo !== false)
    .map((modelo) => {
      const f = formulaciones.find((x) => x.id === modelo.formulacionId);
      const sugerencia = categoriaDeModelo(modelo, formulaciones);
      let producto = (modelo.productoId && porId.get(modelo.productoId)) || (modelo.productoCatalogoId && porId.get(modelo.productoCatalogoId)) || undefined;
      let aprox = false;
      if (!producto) {
        const clave = claveNombre(modelo.nombre);
        const iguales = ventas.filter((p) => !usados.has(p.id) && claveNombre(p.nombre) === clave);
        if (iguales.length >= 1) { producto = iguales[0]; aprox = true; }
      }
      if (producto) usados.add(producto.id);
      const destino = sugerencia?.categoria;
      let estado: EstadoFila;
      if (!producto) estado = 'crear';
      else if (aprox) estado = 'vincular';
      else estado = destino && norm(producto.categoria || '') !== norm(destino) ? 'mover' : 'ok';
      if (producto && aprox && destino && norm(producto.categoria || '') === norm(destino)) estado = 'vincular';
      return { modelo, masa: f?.nombre || 'Sin masa', sugerencia, producto, vinculadoPorNombre: aprox, estado };
    });

  const huerfanos = productosPorOrdenar(productos, categoriaGeneral).filter((p) => !usados.has(p.id));
  const pendientes = filas.filter((x) => x.estado !== 'ok' && x.sugerencia).length + huerfanos.length;
  return { filas, huerfanos, pendientes };
}

/** Productos de venta que siguen en la categoría general (por defecto "Panes") */
export function productosPorOrdenar(productos: Producto[], categoriaGeneral = 'Panes'): Producto[] {
  const g = norm(categoriaGeneral);
  return productos.filter((p) => p.tipo !== 'ingrediente' && norm(p.categoria || '') === g);
}
