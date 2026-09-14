export function formatMasaAmo(arrobas: number): string {
  if (!arrobas || arrobas <= 0) return '0 libras';

  const librasTotales = arrobas * 25; // 1 arroba = 25 libras (medida panadera común)

  // Casos exactos de arroba y media
  if (Math.abs(arrobas - 0.5) < 0.05) return 'Media Arroba';
  if (Math.abs(arrobas - 1) < 0.05) return '1 Arroba';
  if (Math.abs(arrobas - 1.5) < 0.05) return '1 Arroba y Media';
  if (Math.abs(arrobas - 2) < 0.05) return '2 Arrobas';
  if (Math.abs(arrobas - 2.5) < 0.05) return '2 Arrobas y Media';
  if (Math.abs(arrobas - 3) < 0.05) return '3 Arrobas';

  // Si es menos de 1 arroba, damos solo las libras
  if (arrobas < 1) {
    const lbs = Math.round(librasTotales);
    if (lbs === 12 || lbs === 13) return 'Media Arroba (aprox)';
    return `${lbs} ${lbs === 1 ? 'libra' : 'libras'}`;
  }

  // Mezcla de arrobas y libras
  const arrEnteras = Math.floor(arrobas);
  const librasRestantes = Math.round((arrobas - arrEnteras) * 25);

  if (librasRestantes === 0) {
    return `${arrEnteras} Arrobas`;
  }
  
  if (Math.abs(librasRestantes - 12.5) < 2) {
    return `${arrEnteras} Arroba${arrEnteras > 1 ? 's' : ''} y Media`;
  }

  return `${arrEnteras} Arroba${arrEnteras > 1 ? 's' : ''} y ${librasRestantes} libra${librasRestantes > 1 ? 's' : ''}`;
}

export function formatGramosAMedidas(gramos: number): string {
  if (gramos < 1000) {
    return `${Math.round(gramos)} gramos`;
  }
  
  const libras = gramos / 500; // Asumiendo libra de 500g (métrica común) o 453g (imperial). Usaremos 500g como estándar métrico común o 453.592. 
  // En Colombia 1 libra (de mercado) = 500g usualmente.
  
  // Vamos a devolver en kg y libras para más claridad.
  const kg = gramos / 1000;
  return `${kg.toFixed(2)} kg (${Math.round(libras)} libras aprox)`;
}
