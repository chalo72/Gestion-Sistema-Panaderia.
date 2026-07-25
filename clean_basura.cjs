const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://hurlzmarkmkjhwmkwqld.supabase.co';
const supabaseKey = 'sb_publishable_mGKq_fDLcp_u1GoXKVGlBQ_8Gz4t9cj';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data } = await supabase.from('productos').select('id, nombre, categoria');
  
  const garbageNames = [
    'E ll endo re NT',
    'un Di',
    'Pe Dismalt del SIMI SAS. MONTERIA Ya ETE',
    '_- ANT',
    'NN uu. o ANDA AUN EGB Dia',
    'Lo enT00 GALLCTARITZ TACO',
    'E A OA',
    'brave 2 brave dos',
    '0 A edi CERIDE NI GUY SANDIA',
    'E ano TIMIDENT',
    'a am DENT AS SANDIA',
    'panananana',
    'e ATEN AA A DD LAIR AR aa AA',
    'gogleeee',
    'pananaderia ',
    'gogleeeeegolgeee 222',
    'PPPPPapapappapa',
    'L -_ BUBBALOO FRESA',
    'brev brave',
    'dulce placer ',
    'Piezza jirafa',
    'PIzzsa Jiraffa'
  ];

  const toDelete = data.filter(p => garbageNames.includes(p.nombre) || p.nombre.includes('E ESTO GALLETA'));
  
  console.log(`Encontrados ${toDelete.length} productos basura para eliminar.`);
  
  for (const p of toDelete) {
    const { error } = await supabase.from('productos').delete().eq('id', p.id);
    if (error) {
      console.error(`Error eliminando ${p.nombre}:`, error);
    } else {
      console.log(`Eliminado: ${p.nombre}`);
    }
  }
  
  console.log('Limpieza completada.');
}
run();
