const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://hurlzmarkmkjhwmkwqld.supabase.co';
const supabaseKey = 'sb_publishable_mGKq_fDLcp_u1GoXKVGlBQ_8Gz4t9cj';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data } = await supabase.from('productos').select('id, nombre, categoria, tipo');
  
  // All ingredients
  const ingredientes = data.filter(p => p.tipo === 'ingrediente' || (p.categoria && p.categoria.toUpperCase().startsWith('INS:')));
  
  // Print all ingredients to check their names
  console.log("=== TODOS LOS INGREDIENTES ===");
  ingredientes.forEach(s => console.log(s.nombre + ' (' + s.categoria + ')'));
}
run();
