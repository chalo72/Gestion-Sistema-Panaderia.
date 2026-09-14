import { supabase } from '@/lib/supabase';
import { generateUUID } from '@/lib/safe-utils';

const BUCKET_NAME = 'boveda_digital';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export async function uploadFacturaGasto(file: File, proveedorNombre: string, customDate?: string): Promise<string | null> {
  try {
    const ext = file.name.split('.').pop() || 'jpg';
    
    // Default to today if no date provided
    const dateObj = customDate ? new Date(customDate + 'T12:00:00Z') : new Date();
    // Fallback if invalid date
    const validDate = isNaN(dateObj.getTime()) ? new Date() : dateObj;
    
    const year = validDate.getFullYear();
    const month = validDate.getMonth(); // 0-11
    const day = String(validDate.getDate()).padStart(2, '0');
    const monthNumber = String(month + 1).padStart(2, '0');
    const monthName = MESES[month];
    
    // Folder: e.g. "2023-12_Diciembre"
    const folderName = `${year}-${monthNumber}_${monthName}`;
    // File date: e.g. "2023-12-15"
    const fileDate = `${year}-${monthNumber}-${day}`;
    
    const provFolder = (proveedorNombre || 'Desconocido').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    
    const shortId = generateUUID().split('-')[0];
    const fileName = `proveedores/${provFolder}/${folderName}/factura_${fileDate}_${shortId}.${ext}`;
    
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Error uploading file:', error);
      return null;
    }

    const { data: publicData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
    return publicData.publicUrl;
  } catch (error) {
    console.error('Exception uploading file:', error);
    return null;
  }
}

export async function uploadReciboCliente(file: File, clienteNombre: string): Promise<string | null> {
  try {
    const ext = file.name.split('.').pop() || 'jpg';
    const timestamp = new Date().toISOString().slice(0, 7); // YYYY-MM
    const clienteFolder = (clienteNombre || 'Desconocido').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    
    const fileName = `clientes/${clienteFolder}/${timestamp}/recibo_${generateUUID()}.${ext}`;
    
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Error uploading file:', error);
      return null;
    }

    const { data: publicData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
    return publicData.publicUrl;
  } catch (error) {
    console.error('Exception uploading file:', error);
    return null;
  }
}
