export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_KEY) {
      return new Response(JSON.stringify({ error: 'No API key configured.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
    
    // In an offline-first PWA, true backend autonomy is difficult without direct Postgres access.
    // The "Autonomous Agent" logic will primarily run client-side (Option B) for this architecture.
    // This endpoint exists to satisfy Option A Vercel Cron pinging, but defers execution to the client.

    return new Response(JSON.stringify({ 
      status: 'ok', 
      message: 'Cron ping successful.' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
