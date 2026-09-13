import * as faceapi from '@vladmandic/face-api';

let isInitialized = false;

export async function initFaceRecognition() {
  if (isInitialized) return;

  try {
    const modelPath = '/models';
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(modelPath),
      faceapi.nets.faceLandmark68Net.loadFromUri(modelPath),
      faceapi.nets.faceRecognitionNet.loadFromUri(modelPath)
    ]);
    isInitialized = true;
    console.log('Modelos de reconocimiento facial cargados localmente.');
  } catch (error) {
    console.error('Error cargando modelos faciales:', error);
  }
}

/** Extrae el descriptor matemático (huella facial) de una imagen */
export async function getFaceDescriptor(imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement): Promise<number[] | null> {
  await initFaceRecognition();
  const detection = await faceapi.detectSingleFace(imageElement).withFaceLandmarks().withFaceDescriptor();
  
  if (!detection) return null;
  
  // Guardamos como Array de números estándar para la base de datos (IndexedDB)
  return Array.from(detection.descriptor);
}

/** Compara una imagen con una base de datos de perfiles y devuelve coincidencias */
export async function detectFacesInFrame(
  imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement, 
  profiles: { id: string, nombre: string, descriptor: number[] }[]
): Promise<{ id: string, nombre: string, x: number, y: number, distance: number }[]> {
  
  await initFaceRecognition();
  
  if (profiles.length === 0) return [];

  // Convertimos los perfiles al formato de face-api
  const labeledDescriptors = profiles.map(p => 
    new faceapi.LabeledFaceDescriptors(p.id, [new Float32Array(p.descriptor)])
  );

  const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.55); // Umbral de similitud
  
  const detections = await faceapi.detectAllFaces(imageElement).withFaceLandmarks().withFaceDescriptors();
  
  const results = detections.map(d => {
    const bestMatch = faceMatcher.findBestMatch(d.descriptor);
    return {
      match: bestMatch,
      box: d.detection.box
    };
  });

  const recognized: { id: string, nombre: string, x: number, y: number, distance: number }[] = [];

  for (const r of results) {
    if (r.match.label !== 'unknown') {
      const perfil = profiles.find(p => p.id === r.match.label);
      if (perfil) {
        recognized.push({
          id: perfil.id,
          nombre: perfil.nombre,
          x: r.box.x,
          y: r.box.y,
          distance: r.match.distance
        });
      }
    }
  }

  return recognized;
}
