import fs from 'fs';

async function fetchFirestore() {
  const url = "https://firestore.googleapis.com/v1/projects/app-fuxionfitgym/databases/(default)/documents/clientes";
  console.log('Fetching:', url);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.log('HTTP Error:', res.status, res.statusText);
      const text = await res.text();
      console.log('Body:', text);
      return;
    }
    const data = await res.json();
    fs.writeFileSync('clientes.json', JSON.stringify(data, null, 2));
    console.log('Success! Saved to clientes.json');
  } catch(e) {
    console.error('Fetch error:', e);
  }
}

fetchFirestore();
