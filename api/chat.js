const GEMINI_ROOT = ['https:/', 'generativelanguage.googleapis.com', 'v1beta', 'models'].join('/');


async function fetchWithTimeout(url, options = {}, timeoutMs = 25000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// Your existing auto-model priority logic preserved intact
async function getAvailableGeminiModels(apiKey) {
  try {
    const r = await fetchWithTimeout(`${GEMINI_ROOT}?key=${apiKey}`, { method: 'GET' }, 6000);
    const d = await r.json();
    if (r.ok && Array.isArray(d.models)) {
      const valid = d.models
        .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
        .map(m => m.name.replace('models/', ''))
        .filter(name => name.includes('gemini') && !name.includes('vision') && !name.includes('embedding'));

      const priorityScore = (name) => {
        if (name.includes('pro') && (name.includes('3.') || name.includes('2.5') || name.includes('exp') || name.includes('latest'))) return 100;
        if (name.includes('pro')) return 90;
        if (name.includes('flash') && !name.includes('lite') && (name.includes('3.') || name.includes('2.5') || name.includes('latest'))) return 80;
        if (name.includes('flash') && !name.includes('lite')) return 70;
        return 50;
      };

      valid.sort((a, b) => priorityScore(b) - priorityScore(a));
      if (valid.length > 0) return valid.slice(0, 5);
    }
  } catch {}
  return ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-flash-lite-latest'];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    
    // Automatically detect prompt from any frontend key format
    let prompt = body.prompt || body.message || body.query || body.text || body.input || body.content || body.userPrompt || '';
    if (!prompt && Array.isArray(body.messages) && body.messages.length > 0) {
      const lastMsg = body.messages[body.messages.length - 1];
      prompt = typeof lastMsg === 'string' ? lastMsg : (lastMsg?.content || lastMsg?.text || '');
    }
    if (!prompt && Array.isArray(body.contents) && body.contents.length > 0) {
      prompt = body.contents[body.contents.length - 1]?.parts?.[0]?.text || '';
    }
    // Fallback: grab the longest string value in body if key name is custom
    if (!prompt) {
      const stringVals = Object.values(body).filter(v => typeof v === 'string' && v.trim().length > 0);
      if (stringVals.length > 0) prompt = stringVals.sort((a, b) => b.length - a.length)[0];
    }

    const modelSelection = String(body.model || body.engine || body.selectedModel || 'apex').toLowerCase();
    const thinkMode = Boolean(body.think || body.thinkMode);
    const webMode = Boolean(body.web || body.webMode || body.search);

    if (!String(prompt).trim()) {
      return res.status(400).json({ error: `Prompt is empty. Received keys: ${Object.keys(body).join(', ')}` });
    }
    const GEMINI_KEY = process.env.GEMINI_KEY || process.env.GEMINI_API_KEY || '';
    const GROQ_KEY = process.env.GROQ_KEY || process.env.GROQ_API_KEY || '';
    const OPENROUTER_KEY = process.env.OPENROUTER_KEY || process.env.OPENROUTER_API_KEY || '';

    let systemPrompt = "You are Satyexa AI, an elite international AI assistant. Provide clear, accurate, and comprehensive responses.";
    if (thinkMode) systemPrompt += " [THINK MODE]: Show detailed step-by-step reasoning before your final answer.";
    if (webMode) systemPrompt += " [WEB CONTEXT]: Ensure factual precision and up-to-date technical accuracy.";

    async function callGemini(userText, preferredTier = 'flash') {
      if (!GEMINI_KEY) throw new Error('GEMINI_KEY missing in Vercel.');
      const models = await getAvailableGeminiModels(GEMINI_KEY);
    let targetModel = models[0] || 'gemini-2.5-flash';
      if (preferredTier === 'flash') {
        targetModel = models.find(m => m.includes('flash')) || 'gemini-2.5-flash';
      }

      const url = `${GEMINI_ROOT}/${targetModel}:generateContent?key=${GEMINI_KEY}`;
      const r = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\nUser: ${userText}` }] }]
        })
      }, 35000);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error?.message || 'Gemini API failed');
      return d.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
    }

    async function callGroq(userText, modelName = 'llama-3.3-70b-versatile') {
      if (!GROQ_KEY) throw new Error('GROQ_KEY missing in Vercel.');
    const r = await fetchWithTimeout(['https:/', 'api.groq.com', 'openai', 'v1', 'chat', 'completions'].join('/'), {
      
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userText }
          ]
        })
      }, 25000);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error?.message || 'Groq API failed');
      return d.choices?.[0]?.message?.content || 'No response generated.';
    }

    async function callOpenRouter(userText, modelName = 'openrouter/auto') {
    const r = await fetchWithTimeout(['https:/', 'openrouter.ai', 'api', 'v1', 'chat', 'completions'].join('/'), {
      
      const r = await fetchWithTimeout('https://openrouter.ai', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://vercel.app',
          'X-Title': 'Satyexa AI'
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userText }
          ]
        })
      }, 40000);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error?.message || 'OpenRouter API failed');
      return d.choices?.[0]?.message?.content || 'No response generated.';
    }

    let finalResponse = '';

    // 1. APEX GOD-MODE (Parallel Multi-Brain + Critic)
    if (modelSelection.includes('apex') || modelSelection.includes('god')) {
      const tasks = [];
      if (GROQ_KEY) tasks.push(callGroq(prompt, 'llama-3.3-70b-versatile').catch(e => `[Groq Fallback]: ${e.message}`));
      if (GEMINI_KEY) tasks.push(callGemini(prompt, 'flash').catch(e => `[Gemini Fallback]: ${e.message}`));

      if (tasks.length === 0 && OPENROUTER_KEY) {
        finalResponse = await callOpenRouter(prompt, 'deepseek/deepseek-r1:free');
      } else if (tasks.length > 0) {
        const drafts = await Promise.all(tasks);
        const criticInput = `Review these AI drafts and synthesize the single best, most accurate final answer.\n\nQuery: ${prompt}\n\nDrafts:\n${drafts.join('\n---\n')}`;
        if (GEMINI_KEY) {
          finalResponse = await callGemini(criticInput, 'pro');
        } else if (GROQ_KEY) {
          finalResponse = await callGroq(criticInput, 'llama-3.3-70b-versatile');
        } else {
        finalResponse = drafts[0];
        }
      } else {
        throw new Error('No API keys configured in Vercel Environment Variables.');
      }
    }
    // 2. Individual Model Routing
    else if (modelSelection.includes('gemini') || modelSelection.includes('neon') || modelSelection.includes('hydrogen')) {
      finalResponse = await callGemini(prompt, modelSelection.includes('pro') || modelSelection.includes('hydrogen') ? 'pro' : 'flash');
    } else if (modelSelection.includes('qwen') && modelSelection.includes('coder')) {
      finalResponse = OPENROUTER_KEY
        ? await callOpenRouter(prompt, 'qwen/qwen-2.5-coder-32b-instruct:free')
        : await callGroq(prompt, 'qwen-2.5-32b');
    } else if (modelSelection.includes('groq') || modelSelection.includes('llama') || modelSelection.includes('kimi')) {
      finalResponse = await callGroq(prompt, 'llama-3.3-70b-versatile');
    } else if (modelSelection.includes('deepseek') || modelSelection.includes('particle')) {
      finalResponse = await callOpenRouter(prompt, 'deepseek/deepseek-r1:free');
    } else if (modelSelection.includes('gemma')) {
      finalResponse = await callOpenRouter(prompt, 'google/gemma-3-27b-it:free');
    } else if (modelSelection.includes('nemotron') || modelSelection.includes('nvidia')) {
      finalResponse = await callOpenRouter(prompt, 'nvidia/llama-3.1-nemotron-70b-instruct:free');
    } else {
      if (GEMINI_KEY) finalResponse = await callGemini(prompt, 'flash');
      else if (GROQ_KEY) finalResponse = await callGroq(prompt);
      else if (OPENROUTER_KEY) finalResponse = await callOpenRouter(prompt, 'openrouter/auto');
      else throw new Error('Please add GEMINI_KEY, GROQ_KEY, or OPENROUTER_KEY in Vercel.');
    }

    return res.status(200).json({
      reply: finalResponse,
      response: finalResponse,
      text: finalResponse
    });

  } catch (err) {
    // Always return JSON so "Unexpected token 'A'" never happens again
    return res.status(500).json({
      error: err.message || 'Server error',
      reply: `⚠️ Error: ${err.message}`
    });
  }
    }
        
