import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { transcript, audioBase64, mimeType, contexto } = await req.json();

    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) throw new Error("Falta GEMINI_API_KEY");

    const promptText = `
Eres el Gerente General IA (Mano Derecha) de la Panadería "Dulce Placer".
El dueño, Gonzalo, te está hablando. Debes responderle de forma natural, conversacional y profesional.
Tus respuestas serán leídas en voz alta por un sintetizador de audio, así que NO uses asteriscos (*), emojis, ni viñetas. Responde en texto plano y conversacional, al estilo Jarvis. 
Él se encuentra viendo el módulo: ${contexto || 'Inicio'}.
`;

    let parts: any[] = [];
    if (audioBase64) {
       parts.push({
         inlineData: {
           mimeType: mimeType || "audio/webm",
           data: audioBase64
         }
       });
       parts.push({ text: promptText + "\n\n(Escucha la nota de voz y responde acorde):" });
    } else {
       parts.push({ text: promptText + `\n\nGonzalo acaba de decir: "${transcript}"\n\nResponde:` });
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${geminiKey}`;
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }]
      })
    });

    const data = await response.json();
    if (data.error) {
        console.error('Gemini API Error:', data.error);
        throw new Error('Gemini API Error: ' + JSON.stringify(data.error));
    }
    const iaText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Lo siento jefe, tuve un cruce de cables con mi motor de inteligencia. ¿Puede repetirlo?";

    return new Response(JSON.stringify({ reply: iaText.replace(/[*#]/g, '') }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error en chat-fluido:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
