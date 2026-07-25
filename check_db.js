const fetch = require('node-fetch');
const url = 'https://hurlzmarkmkjhwmkwqld.supabase.co/rest/v1/creditos';
const urlClientes = 'https://hurlzmarkmkjhwmkwqld.supabase.co/rest/v1/clientes';
const options = {
  headers: {
    'apikey': 'sb_publishable_mGKq_fDLcp_u1GoXKVGlBQ_8Gz4t9cj',
    'Authorization': 'Bearer sb_publishable_mGKq_fDLcp_u1GoXKVGlBQ_8Gz4t9cj'
  }
};

async function check() {
  try {
    let res = await fetch(url, options);
    let data = await res.json();
    console.log('Creditos:', data.length);
    if(data.length > 0) {
      console.log('Sample credito:', data[data.length - 1]);
    }
    
    let resC = await fetch(urlClientes, options);
    let dataC = await resC.json();
    console.log('Clientes:', dataC.length);
    if(dataC.length > 0) {
      console.log('Sample cliente:', dataC[dataC.length - 1]);
    }
  } catch(e) {
    console.error(e);
  }
}
check();
