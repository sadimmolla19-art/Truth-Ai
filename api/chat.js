const GEMINI_ROOT = 'https://generativelanguage.' + '://googleapis.com';
const GROQ_URL = 'https://api.groq.' + 'com/openai/v1/chat/completions';
const OPENROUTER_URL = 'https://openrouter.' + 'ai/api/v1/chat/completions';

async function fetchWithTimeout(url, options = {}, timeoutMs = 22000) {
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

async function parseSafeJson(response, providerName) {
  const raw = await response.text();
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${providerName} returned invalid format (${response.status})`);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});

    let prompt = body.prompt || body.message || body.query || body.text || body.input || body.content || body.userPrompt || '';
    if (!prompt && Array.isArray(body.messages) && body.messages.length > 0) {
      const lastMsg = body.messages.at(-1);
      prompt = typeof lastMsg === 'string' ? lastMsg : (lastMsg?.content || lastMsg?.text || '');
    }
    if (!prompt && Array.isArray(body.contents) && body.contents.length > 0) {
      prompt = body.contents.at(-1)?.parts?.at(0)?.text || '';
    }
    if (!prompt) {
      const stringVals = Object.values(body).filter(v => typeof v === 'string' && v.trim().length > 0);
      if (stringVals.length > 0) prompt = stringVals.sort((a, b) => b.length - a.length).at(0);
    }

    const modelSelection = String(body.model || body.engine || body.selectedModel || 'apex').toLowerCase();
    const thinkMode = Boolean(body.think || body.thinkMode);
    const webMode = Boolean(body.web || body.webMode || body.search);

    if (!String(prompt).trim()) {
      return res.status(400).json({ error: 'Prompt is empty.' });
    }

    const GEMINI_KEY = process.env.GEMINI_KEY || process.env.GEMINI_API_KEY || '';
    const GROQ_KEY = process.env.GROQ_KEY || process.env.GROQ_API_KEY || '';
    const OPENROUTER_KEY = process.env.OPENROUTER_KEY || process.env.OPENROUTER_API_KEY || '';

    let systemPrompt = "You are Satyexa AI (Genesis Prime), created by Sadim Molla, Founder of Sadimx Technology. Provide clear, accurate, and complete responses.";
    if (thinkMode) systemPrompt += " [THINK MODE]: Show step-by-step reasoning before your final answer.";
    if (webMode) systemPrompt += " [WEB CONTEXT]: Ensure factual precision and up-to-date details.";

    async function callGemini(userText, modelName) {
      if (!GEMINI_KEY) throw new Error('No Gemini Key');
      const url = `${GEMINI_ROOT}/${modelName}:generateContent?key=${GEMINI_KEY}`;
      const r = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\nUser: ${userText}` }] }]
        })
      }, 25000);
      const d = await parseSafeJson(r, 'Gemini');
      if (!r.ok) throw new Error(d.error?.message || 'Gemini quota/error');
      const replyText = d.candidates?.at(0)?.content?.parts?.at(0)?.text;
      if (!replyText) throw new Error('Empty Gemini response');
      return { text: replyText, engine: modelName.toUpperCase() };
    }

    async function callGroq(userText, modelName) {
      if (!GROQ_KEY) throw new Error('No Groq Key');
      const r = await fetchWithTimeout(GROQ_URL, {
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
      }, 15000);
      const d = await parseSafeJson(r, 'Groq');
      if (!r.ok) throw new Error(d.error?.message || 'Groq quota/error');
      const replyText = d.choices?.at(0)?.message?.content;
      if (!replyText) throw new Error('Empty Groq response');
      return { text: replyText, engine: `GROQ-${modelName.toUpperCase()}` };
    }

    async function callOpenRouter(userText, modelName) {
      if (!OPENROUTER_KEY) throw new Error('No OpenRouter Key');
      const r = await fetchWithTimeout(OPENROUTER_URL, {
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
      }, 25000);
      const d = await parseSafeJson(r, 'OpenRouter');
      if (!r.ok) throw new Error(d.error?.message || 'OpenRouter quota/error');
      const replyText = d.choices?.at(0)?.message?.content;
      if (!replyText) throw new Error('Empty OpenRouter response');
      return { text: replyText, engine: modelName.split('/').pop().toUpperCase() };
    }

    // Priority Chain: Flagship Models FIRST -> Mid-tier -> Ultra-Free Lite Models LAST
    const fallbackChain = [
      () => callGemini(prompt, 'gemini-2.5-pro'),
      () => callGemini(prompt, 'gemini-2.5-flash'),
      () => callGemini(prompt, 'gemini-flash-latest'),
      () => callOpenRouter(prompt, 'deepseek/deepseek-r1:free'),
      () => callOpenRouter(prompt, 'qwen/qwen-2.5-coder-32b-instruct:free'),
      () => callOpenRouter(prompt, 'openrouter/auto'),
      () => callGroq(prompt, 'llama-3.1-8b-instant'),
      () => callGemini(prompt, 'gemini-flash-lite-latest') // Last resort when all limits are exhausted
    ];

    let result = null;
    let lastError = 'All AI engines are busy.';

    for (const runModel of fallbackChain) {
      try {
        const resObj = await runModel();
        if (resObj && resObj.text && resObj.text.trim().length > 0) {
          result = resObj;
          break;
        }
      } catch (err) {
        lastError = err.message;
      }
    }

    if (!result) {
      throw new Error(`All fallback models exhausted. Last status: ${lastError}`);
    }

    return res.status(200).json({
      reply: result.text,
      response: result.text,
      text: result.text,
      modelUsed: result.engine
    });

  } catch (err) {
    console.error("Satyexa AI Waterfall Error:", err.message);
    return res.status(500).json({
      error: err.message,
      reply: `⚠️ System Notice: ${err.message}`
    });
  }
          }
