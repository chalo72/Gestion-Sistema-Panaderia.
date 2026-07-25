export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as Blob;
    
    if (!file) {
      return new Response(JSON.stringify({ error: 'No audio file provided' }), { status: 400 });
    }

    const GROQ_API_KEY = process.env.OPENAI_API_KEY; // Reusing the key since we use Groq
    if (!GROQ_API_KEY || !GROQ_API_KEY.startsWith('gsk_')) {
      return new Response(JSON.stringify({ error: 'No Groq API key configured' }), { status: 500 });
    }

    const groqFormData = new FormData();
    groqFormData.append('file', file, 'audio.webm');
    groqFormData.append('model', 'whisper-large-v3');
    groqFormData.append('response_format', 'json');
    groqFormData.append('language', 'es');

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: groqFormData
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Groq API Error: ${res.status} ${errorText}`);
    }

    const json = await res.json();
    return new Response(JSON.stringify({ text: json.text }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
