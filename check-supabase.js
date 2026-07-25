const key = 'sb_publishable_mGKq_fDLcp_u1GoXKVGlBQ_8Gz4t9cj';
const url = 'https://hurlzmarkmkjhwmkwqld.supabase.co/rest/v1/clientes?select=*';

fetch(url, {
  headers: {
    'apikey': key,
    'Authorization': 'Bearer ' + key,
  }
}).then(r => r.json()).then(data => {
  if (data.error) {
    console.error("Error:", data);
  } else {
    console.log('Clientes in Supabase:', data.length);
    console.log(data.map(c => ({nombre: c.nombre, tipo: c.tipo})));
  }
}).catch(console.error);
