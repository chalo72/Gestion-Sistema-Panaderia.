const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabaseUrl = 'https://hurlzmarkmkjhwmkwqld.supabase.co';
const supabaseKey = 'sb_publishable_mGKq_fDLcp_u1GoXKVGlBQ_8Gz4t9cj';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Iniciando script de corrección de proveedor Yupi...');

  // 1. Encontrar el proveedor Yupi
  const { data: proveedores, error: errProv } = await supabase
    .from('proveedores')
    .select('id, nombre')
    .ilike('nombre', '%yupi%');

  if (errProv || !proveedores || proveedores.length === 0) {
    console.error('No se encontró proveedor Yupi', errProv);
    return;
  }

  const proveedorYupi = proveedores[0];
  console.log(`Proveedor encontrado: ${proveedorYupi.nombre} (ID: ${proveedorYupi.id})`);

  // 2. Encontrar todos los productos de categoría MEKATOS
  const { data: productos, error: errProd } = await supabase
    .from('productos')
    .select('id, nombre, categoria, precio_venta, costo_base');

  if (errProd || !productos) {
    console.error('Error al buscar productos', errProd);
    return;
  }

  const productosMekatos = productos.filter(p => 
    p.categoria && p.categoria.trim().toUpperCase() === 'MEKATOS'
  );

  console.log(`Encontrados ${productosMekatos.length} productos en la categoría MEKATOS.`);

  // 3. Encontrar precios existentes para este proveedor
  const { data: precios, error: errPrecios } = await supabase
    .from('precios')
    .select('*')
    .eq('proveedor_id', proveedorYupi.id);

  if (errPrecios) {
    console.error('Error al buscar precios', errPrecios);
    return;
  }

  const productosYaVinculados = new Set(precios.map(p => p.producto_id));
  console.log(`${productosYaVinculados.size} productos ya están vinculados a este proveedor.`);

  // 4. Vincular los que faltan
  const preciosAInsertar = [];
  const ahora = new Date().toISOString();

  for (const prod of productosMekatos) {
    if (!productosYaVinculados.has(prod.id)) {
      preciosAInsertar.push({
        id: crypto.randomUUID(), 
        producto_id: prod.id,
        proveedor_id: proveedorYupi.id,
        precio_costo: prod.costo_base || Math.round(prod.precio_venta * 0.7) || 0, // Estimado si no hay
        fecha_actualizacion: ahora,
        notas: 'Agregado automáticamente (Categoría MEKATOS)',
        destino: 'venta',
        tipo_embalaje: 'unidad',
        cantidad_embalaje: 1
      });
      console.log(`- Falta vincular: ${prod.nombre}`);
    }
  }

  if (preciosAInsertar.length > 0) {
    console.log(`Insertando ${preciosAInsertar.length} nuevos registros en precios...`);
    const { error: errInsert } = await supabase
      .from('precios')
      .insert(preciosAInsertar);

    if (errInsert) {
      console.error('Error al insertar precios:', errInsert);
    } else {
      console.log('✅ Inserción exitosa. Productos vinculados.');
    }
  } else {
    console.log('✅ Todos los productos MEKATOS ya estaban vinculados al proveedor Yupi.');
  }
}

main();
