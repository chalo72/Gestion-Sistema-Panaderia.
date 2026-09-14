import type { CajaSesion, Venta } from '@/types';

/**
 * UTILERÍA: Envio de Reporte Z por WhatsApp (Auditoría Premium)
 * Formatea un mensaje de alta visibilidad para el administrador.
 */
export async function enviarReporteZWhatsApp(cajas: CajaSesion[], ventasTotal: Venta[]) {
  const ahora = new Date();
  const fechaStr = ahora.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
  const horaStr = ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  
  const totalVentas = cajas.reduce((a, c) => a + c.totalVentas, 0);
  const totalApertura = cajas.reduce((a, c) => a + c.montoApertura, 0);
  
  const ent = cajas.reduce((a, c) => 
    a + (c.movimientos || []).filter(m => m.tipo === 'entrada').reduce((sum, m) => sum + m.monto, 0), 0
  );
  const sal = cajas.reduce((a, c) => 
    a + (c.movimientos || []).filter(m => m.tipo === 'salida').reduce((sum, m) => sum + m.monto, 0), 0
  );
  
  const esperadoTotal = totalApertura + totalVentas + ent - sal;
  const entregadoTotal = cajas.reduce((a, c) => a + (c.montoCierre || 0), 0);
  const diferenciaNeta = entregadoTotal - esperadoTotal;
  const turnoActual = cajas[0]?.turno || 'Jornada';

  // Métodos de Pago
  const efectivo = ventasTotal.filter(v => v.metodoPago === 'efectivo').reduce((a, v) => a + v.total, 0);
  const tarjeta  = ventasTotal.filter(v => v.metodoPago === 'tarjeta').reduce((a, v) => a + v.total, 0);
  const nequi    = ventasTotal.filter(v => v.metodoPago === 'nequi' || v.metodoPago === 'transferencia').reduce((a, v) => a + v.total, 0);

  const format = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

  // 📝 CONSTRUCCIÓN DEL MENSAJE (Markdown WhatsApp)
  let msg = `*📊 DULCE PLACER — REPORTE Z* \n`;
  msg += `*${fechaStr} · ${horaStr}* \n`;
  msg += `------------------------------------------ \n`;
  msg += `🌅 *Turno:* ${turnoActual} \n`;
  msg += `🏪 *Cajas:* ${cajas.length} activas \n\n`;
  
  msg += `*💰 BALANCE GENERAL:* \n`;
  msg += `• Apertura: ${format(totalApertura)} \n`;
  msg += `• Ventas Brutas: ${format(totalVentas)} \n`;
  msg += `• Entr/Sal: ${format(ent - sal)} \n`;
  msg += `> *SISTEMA ESPERA:* ${format(esperadoTotal)} \n\n`;

  msg += `*💳 MÉTODOS DE PAGO:* \n`;
  msg += `• Efectivo: ${format(efectivo)} \n`;
  msg += `• Tarjeta: ${format(tarjeta)} \n`;
  msg += `• Nequi/Transf: ${format(nequi)} \n\n`;

  msg += `*🧾 AUDITORÍA (DIFERENCIAS):* \n`;
  msg += `• Entregado real: ${format(entregadoTotal)} \n`;
  
  if (diferenciaNeta === 0) {
    msg += `✅ *CUADRE PERFECTO* \n`;
  } else if (diferenciaNeta < 0) {
    msg += `🚨 *FALTANTE:* ${format(Math.abs(diferenciaNeta))} \n`;
  } else {
    msg += `⚠️ *SOBRANTE:* ${format(diferenciaNeta)} \n`;
  }
  
  msg += `\n------------------------------------------ \n`;
  msg += `_Auditado por Antigravity Nexus Shield v1.0_`;

  // Codificar y enviar
  const phone = '3213000673'; // Teléfono para pruebas o configurable
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}
