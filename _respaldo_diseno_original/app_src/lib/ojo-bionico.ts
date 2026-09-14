import html2canvas from 'html2canvas';
import { db } from './database';

export const OjoBionico = {
  capturarAnomalia: async (agente: string, queVio: string, queOyo: string, porQueFoto: string, porQueGrabacion: string, nivel: 'warning' | 'critical' = 'warning') => {
    try {
      // 1. Efecto Visual Inmediato (No bloqueante)
      const flash = document.createElement('div');
      flash.style.position = 'fixed';
      flash.style.inset = '0';
      flash.style.backgroundColor = 'rgba(0, 153, 255, 0.2)';
      flash.style.boxShadow = 'inset 0 0 100px rgba(0, 153, 255, 0.8)';
      flash.style.zIndex = '999999';
      flash.style.pointerEvents = 'none';
      flash.style.display = 'flex';
      flash.style.alignItems = 'center';
      flash.style.justifyContent = 'center';
      flash.style.transition = 'all 0.5s ease-out';
      
      const icon = document.createElement('div');
      icon.innerHTML = '👁️';
      icon.style.fontSize = '120px';
      icon.style.opacity = '0.7';
      icon.style.filter = 'drop-shadow(0 0 20px rgba(0,153,255,1))';
      
      flash.appendChild(icon);
      document.body.appendChild(flash);
      
      setTimeout(() => {
        flash.style.opacity = '0';
        flash.style.backgroundColor = 'transparent';
        setTimeout(() => document.body.removeChild(flash), 500);
      }, 400);

      // 2. Operación Pesada Diferida (Para no congelar la UI)
      setTimeout(async () => {
        try {
          // Reducimos la escala (de 0.7 a 0.35) para hacer el escaneo 4x más rápido
          const canvas = await html2canvas(document.body, {
            scale: 0.35,
            logging: false,
            useCORS: true
          });
          
          const imagenBase64 = canvas.toDataURL('image/jpeg', 0.5);

          const payload = JSON.stringify({
            donde: 'Pantalla de Usuario (Captura Diferida)',
            queVio,
            queOyo,
            porQueFoto,
            porQueGrabacion
          });

          await db.addBitacoraIA({
            agenteId: agente,
            accion: 'Evidencia Fotográfica',
            detalle: payload,
            nivel,
            imagenBase64
          });
          
          window.dispatchEvent(new CustomEvent('nueva-evidencia-visual'));
        } catch (e) {
          console.error('El Ojo Biónico falló en segundo plano:', e);
        }
      }, 100); // 100ms de gracia para que el navegador pinte el flash azul

    } catch (error) {
      console.error('El Ojo Biónico falló al capturar:', error);
    }
  },

  capturarMicrograbacion: async (agente: string, queVio: string, queOyo: string, porQueFoto: string, porQueGrabacion: string, nivel: 'warning' | 'critical' = 'warning') => {
    try {
      // 1. Efecto Visual de Grabación Inmediato
      const rec = document.createElement('div');
      rec.style.position = 'fixed';
      rec.style.top = '20px';
      rec.style.right = '20px';
      rec.style.backgroundColor = 'rgba(220, 38, 38, 0.9)'; // Rojo vivo
      rec.style.color = 'white';
      rec.style.padding = '8px 16px';
      rec.style.borderRadius = '9999px';
      rec.style.fontWeight = 'bold';
      rec.style.zIndex = '999999';
      rec.style.display = 'flex';
      rec.style.alignItems = 'center';
      rec.style.gap = '8px';
      rec.style.boxShadow = '0 0 20px rgba(220,38,38,0.5)';
      
      const dot = document.createElement('div');
      dot.style.width = '10px';
      dot.style.height = '10px';
      dot.style.backgroundColor = 'white';
      dot.style.borderRadius = '50%';
      rec.appendChild(dot);
      
      const txt = document.createElement('span');
      txt.innerText = 'REC (IA)';
      rec.appendChild(txt);
      
      document.body.appendChild(rec);

      // Animación pulsante
      const pulseInterval = setInterval(() => {
        dot.style.opacity = dot.style.opacity === '0' ? '1' : '0';
      }, 500);

      // 2. Iniciar Grabación (Video + Audio) - 3 Segundos
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        clearInterval(pulseInterval);
        document.body.removeChild(rec);

        const blob = new Blob(chunks, { type: 'video/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const videoBase64 = reader.result as string;
          
          // Apagar cámara/micrófono
          stream.getTracks().forEach(track => track.stop());

          const payload = JSON.stringify({
            donde: 'Micrograbación Segura (Webcam/Mic)',
            queVio,
            queOyo,
            porQueFoto,
            porQueGrabacion
          });

          await db.addBitacoraIA({
            agenteId: agente,
            accion: 'Evidencia Multimedia',
            detalle: payload,
            nivel,
            videoBase64
          });
          
          window.dispatchEvent(new CustomEvent('nueva-evidencia-visual'));
        };
      };

      mediaRecorder.start();
      
      // Detener a los 3 segundos exactos
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, 3000);

    } catch (error) {
      console.error('El Ojo Biónico falló al capturar micrograbación:', error);
      // Fallback: si el usuario no dio permisos, intentar solo foto
      console.warn('Fallback a captura fotográfica por falta de permisos.');
      OjoBionico.capturarAnomalia(agente, queVio, queOyo, porQueFoto, porQueGrabacion, nivel);
    }
  }
};
