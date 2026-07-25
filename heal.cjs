const fs = require('fs');
const content = fs.readFileSync('src/pages/Recetas.tsx', 'utf8');
const search1 = 'useEffect(() => {\n        setMInsumosDisponibles(productosGlobales);\n    }, [productosGlobales]);';
const search2 = 'useEffect(() => {\r\n        setMInsumosDisponibles(productosGlobales);\r\n    }, [productosGlobales]);';

const healScript = `
    useEffect(() => {
        setMInsumosDisponibles(productosGlobales);
    }, [productosGlobales]);

    useEffect(() => {
        if (modelosPan.length === 0 || formulaciones.length === 0) return;
        modelosPan.forEach(m => {
            if (m.costoUnitario > 10000 && m.pesoUnitarioGr < 1000) {
                const form = formulaciones.find(f => f.id === m.formulacionId);
                if (form && form.rendimientoBaseKg > 0) {
                    const costoPorGramo = form.costoTotalArroba / (form.rendimientoBaseKg * 1000);
                    const costoMasaUnidad = (m.pesoUnitarioGr / (1 - ((m.mermaEstimada || 0) / 100))) * costoPorGramo;
                    const costoInsumosAdicionales = (m.ingredientesAdicionales || []).reduce((sum, ing) => sum + (ing.costo || 0), 0);
                    let costoVitinaUnidad = 0;
                    if (m.piqueEmpaste && m.piqueEmpaste.insumoId !== 'none') {
                        const pe = m.piqueEmpaste;
                        const prod = productosGlobales.find(p => p.id === pe.insumoId);
                        let cu = 0;
                        if (prod && prod.costoBase && prod.cantidadEmbalaje) {
                            cu = (prod.costoBase / prod.cantidadEmbalaje) / factorUnidad(prod.unidadCosto || 'kg');
                        }
                        const costoTotalEmpaste = cu * pe.cantidadInsumo * factorUnidad(pe.unidadInsumo || 'lb');
                        const panesPorPique = ((pe.pesoMasaGr || 0) * (1 - ((m.mermaEstimada || 0) / 100))) / m.pesoUnitarioGr;
                        costoVitinaUnidad = panesPorPique > 0 ? costoTotalEmpaste / panesPorPique : 0;
                    }
                    const costoUnitReal = costoMasaUnidad + costoInsumosAdicionales + costoVitinaUnidad;
                    if (Math.abs(m.costoUnitario - costoUnitReal) > 10) {
                        updateModeloPan(m.id, { costoUnitario: costoUnitReal }).catch(() => {});
                    }
                }
            }
        });
    }, [modelosPan, formulaciones, productosGlobales]);
`;

if (content.includes(search1)) {
    fs.writeFileSync('src/pages/Recetas.tsx', content.replace(search1, healScript));
    console.log('Fixed LF');
} else if (content.includes(search2)) {
    fs.writeFileSync('src/pages/Recetas.tsx', content.replace(search2, healScript));
    console.log('Fixed CRLF');
} else {
    console.log('Not found');
}
