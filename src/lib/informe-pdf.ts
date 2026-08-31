import { toast } from 'sonner';

/** Evita que un nombre de producto rompa el HTML del informe. */
export const escaparHtmlInforme = (valor: unknown): string =>
  String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const slugArchivo = (titulo: string): string =>
  titulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80) || 'informe';

export type InformePdfKpi = { label: string; value: string };
export type InformePdfSeccion = {
  titulo?: string;
  encabezados: string[];
  filas: string[][];
};

export type InformePdfDatos = {
  titulo: string;
  kpis?: InformePdfKpi[];
  secciones: InformePdfSeccion[];
};

/** Dispara la descarga de un Blob al disco (carpeta Descargas). */
const dispararDescargaBlob = (blob: Blob, nombreArchivo: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

/**
 * Genera un PDF real con texto (sin captura de pantalla) y lo descarga al disco.
 * Más fiable en móvil y en PWA que html2canvas.
 */
export const descargarInformePdf = async (datos: InformePdfDatos): Promise<void> => {
  const fecha = new Date().toISOString().slice(0, 10);
  const nombre = `DulcePlacer_${slugArchivo(datos.titulo)}_${fecha}.pdf`;
  const toastId = toast.loading('Generando PDF…');

  try {
    const { default: jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 12;
    const usable = pageW - margin * 2;
    let y = margin;

    const ensureSpace = (needed: number) => {
      if (y + needed > pageH - margin) {
        pdf.addPage();
        y = margin;
      }
    };

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    const tituloLines = pdf.splitTextToSize(datos.titulo, usable);
    ensureSpace(tituloLines.length * 6 + 8);
    pdf.text(tituloLines, margin, y);
    y += tituloLines.length * 6;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(100);
    pdf.text(
      `Panaderia Dulce Placer · ${new Date().toLocaleDateString('es-CO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}`,
      margin,
      y
    );
    y += 8;
    pdf.setTextColor(0);

    if (datos.kpis && datos.kpis.length > 0) {
      ensureSpace(16);
      const colW = usable / Math.min(datos.kpis.length, 4);
      datos.kpis.slice(0, 4).forEach((kpi, i) => {
        const x = margin + i * colW;
        pdf.setFontSize(8);
        pdf.setTextColor(100);
        pdf.text(kpi.label, x, y);
        pdf.setTextColor(0);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.text(String(kpi.value), x, y + 5);
        pdf.setFont('helvetica', 'normal');
      });
      y += 14;
    }

    for (const seccion of datos.secciones) {
      if (seccion.titulo) {
        ensureSpace(10);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.text(pdf.splitTextToSize(seccion.titulo, usable), margin, y);
        y += 7;
        pdf.setFont('helvetica', 'normal');
      }

      const cols = Math.max(seccion.encabezados.length, 1);
      const colW = usable / cols;
      const rowPad = 1.5;

      const dibujarFila = (celdas: string[], negrita: boolean, fondo: boolean) => {
        const lineasPorCol = celdas.map((c) =>
          pdf.splitTextToSize(String(c ?? '—'), colW - 2)
        );
        const lineCount = Math.max(1, ...lineasPorCol.map((l) => l.length));
        const rowH = lineCount * 4 + rowPad * 2;
        ensureSpace(rowH + 1);

        if (fondo) {
          pdf.setFillColor(248, 250, 252);
          pdf.rect(margin, y - 3.5, usable, rowH, 'F');
        }
        if (negrita) {
          pdf.setFillColor(30, 41, 59);
          pdf.rect(margin, y - 3.5, usable, rowH, 'F');
          pdf.setTextColor(255);
          pdf.setFont('helvetica', 'bold');
        } else {
          pdf.setTextColor(15, 23, 42);
          pdf.setFont('helvetica', 'normal');
        }
        pdf.setFontSize(8);

        lineasPorCol.forEach((lines, i) => {
          pdf.text(lines, margin + i * colW + 1, y);
        });
        y += rowH;
        pdf.setTextColor(0);
      };

      dibujarFila(seccion.encabezados, true, false);
      seccion.filas.forEach((fila, idx) => {
        const padded = seccion.encabezados.map((_, i) => String(fila[i] ?? '—'));
        dibujarFila(padded, false, idx % 2 === 1);
      });

      if (seccion.filas.length === 0) {
        ensureSpace(8);
        pdf.setFontSize(9);
        pdf.setTextColor(100);
        pdf.text('Sin registros', margin, y);
        pdf.setTextColor(0);
        y += 8;
      }

      y += 4;
    }

    const blob = pdf.output('blob');
    dispararDescargaBlob(blob, nombre);
    toast.success(`PDF guardado: ${nombre}`, { id: toastId });
  } catch (error) {
    console.error('[informe-pdf]', error);
    toast.error('No se pudo generar el PDF. Intenta de nuevo.', { id: toastId });
  }
};

/**
 * Compatibilidad: convierte HTML simple (tablas) a PDF estructurado y descarga.
 * Preferir `descargarInformePdf` con datos tipados.
 */
export const abrirInformePdf = async (titulo: string, cuerpoHtml: string): Promise<void> => {
  try {
    const doc = new DOMParser().parseFromString(
      `<div id="root">${cuerpoHtml}</div>`,
      'text/html'
    );
    const root = doc.getElementById('root');
    const kpis: InformePdfKpi[] = Array.from(root?.querySelectorAll('.kpi') ?? []).map((el) => ({
      label: el.querySelector('.kpi-label')?.textContent?.trim() || 'Dato',
      value: el.querySelector('.kpi-value')?.textContent?.trim() || '—',
    }));

    const secciones: InformePdfSeccion[] = [];
    const hijos = Array.from(root?.children ?? []);
    let i = 0;
    while (i < hijos.length) {
      const el = hijos[i];
      if (el.classList?.contains('kpi-row')) {
        i += 1;
        continue;
      }
      let tituloSec = '';
      if (el.tagName === 'H2') {
        tituloSec = el.textContent?.trim() || '';
        i += 1;
      }
      const table = hijos[i]?.tagName === 'TABLE' ? hijos[i] : el.tagName === 'TABLE' ? el : null;
      if (table) {
        const encabezados = Array.from(table.querySelectorAll('thead th')).map(
          (th) => th.textContent?.trim() || ''
        );
        const filas = Array.from(table.querySelectorAll('tbody tr')).map((tr) =>
          Array.from(tr.querySelectorAll('td')).map((td) =>
            (td.textContent || '').replace(/\s+/g, ' ').trim()
          )
        );
        secciones.push({ titulo: tituloSec || undefined, encabezados, filas });
        i += 1;
        continue;
      }
      i += 1;
    }

    if (secciones.length === 0) {
      secciones.push({
        encabezados: ['Detalle'],
        filas: [[(root?.textContent || '').replace(/\s+/g, ' ').trim() || 'Sin datos']],
      });
    }

    await descargarInformePdf({ titulo, kpis, secciones });
  } catch (error) {
    console.error('[abrirInformePdf]', error);
    toast.error('No se pudo preparar el PDF');
  }
};
