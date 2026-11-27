export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
    }

    try {
      const body = await request.json();
      const { prompt, message, history = [], useWeb = false, useThink = false, userKeys = {} } = body;
      const userText = prompt || message || '';

      const geminiKey = userKeys.gemini || env.GEMINI_KEY || env.GEMINI_API_KEY;
      if (!geminiKey) {
        return new Response(JSON.stringify({ error: 'GEMINI_KEY is missing in Cloudflare Worker variables!' }), { status: 400, headers: corsHeaders });
      }

      const models = useThink 
        ? ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-flash-lite-latest']
        : ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-flash-lite-latest'];

      const contents = [
        ...history.map(h => ({
          role: h.role === 'assistant' || h.role === 'model' ? 'model' : 'user',
          parts: [{ text: h.content || h.text || '' }]
        })),
        { role: 'user', parts: [{ text: userText }] }
      ];

      let lastError = '';
      for (const model of models) {
        try {
          const payload = {
            contents,
            systemInstruction: {
              parts: [{ text: 'You are Satyexa AI, an advanced, honest, and helpful AI assistant developed by Sadimx Technology (Founder: Sadim Molla). Answer clearly in the user’s language.' }]
            }
          };

          if (useWeb) {
            payload.tools = [{ googleSearch: {} }];
          }

          const res = await fetch(`https://googleapis.com{model}:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          const data = await res.json();
          const cand = data && data.candidates && data.candidates;
          const part = cand && cand.content && cand.content.parts && cand.content.parts;
          const replyText = part && part.text ? part.text : '';

          if (res.ok && replyText) {
            return new Response(JSON.stringify({
              reply: replyText,
              text: replyText,
              modelUsed: model.toUpperCase()
            }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          } else {
            lastError = (data && data.error && data.error.message) ? data.error.message : `Failed on ${model}`;
          }
        } catch (e) {
          lastError = e.message;
        }
      }

      return new Response(JSON.stringify({ error: 'All Flagship & Fallback models failed: ' + lastError }), { status: 500, headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Cloudflare Worker Error: ' + err.message }), { status: 500, headers: corsHeaders });
    }
  }
};
