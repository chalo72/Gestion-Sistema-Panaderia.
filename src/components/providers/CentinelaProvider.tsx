import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { db } from '@/lib/database';
import type { DBMisionAgent, DBHallazgoAgente } from '@/lib/database';
import { consultarAgente } from '@/constants/agentes';

interface CentinelaContextType {
  misionesActivas: DBMisionAgent[];
  hallazgos: DBHallazgoAgente[];
  ejecutarMisionManual: (mision: DBMisionAgent) => Promise<void>;
  isVigilando: boolean;
}

const CentinelaContext = createContext<CentinelaContextType | undefined>(undefined);

export const CentinelaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [misionesActivas, setMisionesActivas] = useState<DBMisionAgent[]>([]);
  const [hallazgos, setHallazgos] = useState<DBHallazgoAgente[]>([]);
  const [isVigilando, setIsVigilando] = useState(false);
  const timerRef = useRef<any>(null);

  // Cargar misiones y hallazgos iniciales
  useEffect(() => {
    const cargarDatos = async () => {
      const m = await db.getAgenteMisiones();
      const h = await db.getAgenteHallazgos(20);
      setMisionesActivas(m);
      setHallazgos(h);
    };
    cargarDatos();
  }, []);

  // Bucle de Vigilancia (Sentinel Loop)
  useEffect(() => {
    const loop = async () => {
      setIsVigilando(true);
      const misiones = await db.getAgenteMisiones();
      const ahora = new Date().toISOString();

      for (const mision of misiones) {
        if (mision.estado === 'espera' && ahora >= mision.proximaEjecucion) {
          await ejecutarMision(mision);
        }
      }
      setIsVigilando(false);
    };

    // Revisar cada 1 minuto
    timerRef.current = setInterval(loop, 60000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const ejecutarMision = async (mision: DBMisionAgent) => {
    console.log(`🛡️ Centinela: Ejecutando misión [${mision.misionExplicita}] para ${mision.agenteId}`);
    
    try {
      // 1. Marcar como ejecutando
      await db.saveAgenteMision({ ...mision, estado: 'ejecutando' });
      const ahora = new Date().toISOString();

      // 2. Ejecutar lógica según tipo de misión
      // En una implementación real, esto consultaría a Claude Vision o analizaría la DB
      const contexto = await prepararContextoMision(mision);
      const respuesta = await consultarAgente(mision.agenteId, `EJECUTA MISIÓN CRÍTICA: ${mision.misionExplicita}. CONTEXTO ACTUAL: ${contexto}`, () => {});

      // 3. Registrar Hallazgo si la IA detecta algo importante
      if (respuesta.toLowerCase().includes('hallazgo') || respuesta.toLowerCase().includes('alerta')) {
        const nuevoHallazgo: DBHallazgoAgente = {
          id: crypto.randomUUID(),
          agenteId: mision.agenteId,
          misionId: mision.id,
          tipo: 'operativo',
          gravedad: 'media',
          titulo: `Resultado de Misión: ${mision.misionExplicita.substring(0, 30)}...`,
          descripcion: respuesta,
          fecha: new Date().toISOString(),
          revisado: false
        };
        await db.saveAgenteHallazgo(nuevoHallazgo);
        setHallazgos(prev => [nuevoHallazgo, ...prev]);
      }

      // 4. Calcular próxima ejecución
      const proxima = calcularProximaEjecucion(mision.frecuencia);
      await db.saveAgenteMision({ 
        ...mision, 
        estado: 'espera', 
        ultimaEjecucion: ahora, 
        proximaEjecucion: proxima 
      });

    } catch (error) {
      console.error("❌ Falla en misión Centinela:", error);
      await db.saveAgenteMision({ ...mision, estado: 'espera' });
    }
  };

  const prepararContextoMision = async (_mision: DBMisionAgent) => {
    // Aquí el Centinela recolecta datos reales para que el Agente decida
    const ventasRecientes = await db.getAllVentas();
    const inventarioBajo = (await db.getAllInventario()).filter((i: any) => i.stockActual < i.stockMinimo);
    
    return JSON.stringify({
      ventas_hoy: ventasRecientes.length,
      alertas_inventario: inventarioBajo.length,
      hora_actual: new Date().toLocaleTimeString()
    });
  };

  const calcularProximaEjecucion = (frecuencia: string): string => {
    const d = new Date();
    if (frecuencia === '5min') d.setMinutes(d.getMinutes() + 5);
    else if (frecuencia === '1h') d.setHours(d.getHours() + 1);
    else if (frecuencia === 'diaria') d.setDate(d.getDate() + 1);
    else d.setMinutes(d.getMinutes() + 15); // Default
    return d.toISOString();
  };

  return (
    <CentinelaContext.Provider value={{ 
      misionesActivas, 
      hallazgos, 
      ejecutarMisionManual: ejecutarMision,
      isVigilando 
    }}>
      {children}
    </CentinelaContext.Provider>
  );
};

export const useCentinela = () => {
  const context = useContext(CentinelaContext);
  if (!context) throw new Error('useCentinela debe usarse dentro de CentinelaProvider');
  return context;
};
