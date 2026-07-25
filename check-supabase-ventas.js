const key = 'sb_publishable_mGKq_fDLcp_u1GoXKVGlBQ_8Gz4t9cj';
const url = 'https://hurlzmarkmkjhwmkwqld.supabase.co/rest/v1/ventas?select=*';

fetch(url, {
  headers: {
    'apikey': key,
    'Authorization': 'Bearer ' + key,
  }
}).then(r => r.json()).then(data => {
  if (data.error) {
    console.error("Error:", data);
  } else {
    console.log('Ventas in Supabase:', data.length);
  }
}).catch(console.error);
