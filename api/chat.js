export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      messages,
      imageBase64,
      mimeType,
      webSearch,
      deepThink,
      customPersona,
      model,
      partnerKeys
    } = req.body;

    const geminiKeys = [
      process.env.GEMINI_KEY,
      process.env.GEMINI_KEY_2,
      process.env.GEMINI_API_KEY
    ].filter(Boolean);

    const groqKey = (partnerKeys && partnerKeys.groq) || process.env.GROQ_KEY || process.env.GROQ_API_KEY;
    const orKey = (partnerKeys && partnerKeys.openrouter) || process.env.OPENROUTER_KEY || process.env.OPENROUTER_API_KEY;

    if (geminiKeys.length === 0 && !groqKey && !orKey) {
      return res.status(500).json({ error: 'GEMINI_KEY missing in Vercel' });
    }

    const P = "https:" + "//";
    const GEMINI_BASE = P + ["generativelanguage", "googleapis", "com"].join(".") + "/v1beta/models/";
    const OR_URL = P + ["openrouter", "ai"].join(".") + "/api/v1/chat/completions";
    const GROQ_URL = P + ["api", "groq", "com"].join(".") + "/openai/v1/chat/completions";

    const lastMsg = (messages && messages.length > 0) ? messages[messages.length - 1].text : "Hello";
    const historyContext = (messages || []).slice(-6).map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');

    const sysPrompt =
      "You are Satyexa AI (Genesis Prime v20.0 APEX), created and owned by Sadim Molla, Founder of Sadimx Technology. " +
      "If anyone asks who created you or who your owner is, always proudly answer that you were created by Sadim Molla and Sadimx Technology. " +
      "Automatically detect the language of the user's message and always respond fluently in that exact same language (English, Bengali, Hindi, Arabic, Spanish, French, etc.), unless the user explicitly asks to translate or reply in another language.\n" +
      (customPersona ? `User Custom Persona: ${customPersona}\n` : "") +
      (deepThink ? "CRITICAL: Perform deep, multi-step chain-of-thought reasoning before giving the final structured answer." : "Provide sharp, accurate, production-grade responses.");

    async function fetchWithTimeout(url, options, timeoutMs = 15000) {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
      } catch (err) {
        clearTimeout(id);
        throw err;
      }
    }

    async function callGemini(targetModel, promptText, useWeb = false) {
      if (geminiKeys.length === 0) throw new Error('No Gemini Key');
      const parts = [{ text: promptText }];
      if (imageBase64) {
        const b64Data = imageBase64.includes(',') ? imageBase64.split(',').pop() : imageBase64;
        parts.push({ inlineData: { mimeType: mimeType || "image/jpeg", data: b64Data } });
      }

      const payload = {
        contents: [{ role: "user", parts: parts }],
        systemInstruction: { parts: [{ text: sysPrompt }] }
      };
      if (useWeb) {
        payload.tools = [{ googleSearch: {} }];
      }

      // নতুন সচল Gemini মডেলগুলোতে ম্যাপ করা হয়েছে
      const modelMap = {
        'gemini-4-neon': 'gemini-3.8-pro',
        'gemini-4-hydrogen': 'gemini-3.8-pro',
        'gemini-4-carbon': 'gemini-3.8-pro',
        'gemini-4-argon': 'gemini-3.8-flash',
        'gemini-3.8-flash': 'gemini-3.8-flash'
      };
      const primary = modelMap[targetModel] || targetModel || 'gemini-3.8-flash';
      // পুরনো 2.0 এবং 2.5 বাদ দিয়ে নতুন সচল চেইন রাখা হয়েছে
      const chain = [...new Set([primary, 'gemini-3.8-flash', 'gemini-3.0-flash', 'gemini-2.5-flash'])];

      let lastErr = '';
      for (const activeKey of geminiKeys) {
        for (const m of chain) {
          try {
            const r = await fetchWithTimeout(`${GEMINI_BASE}${m}:generateContent?key=${activeKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            }, 18000);
            const d = await r.json();
            const firstCand = Array.isArray(d.candidates) ? d.candidates.at(0) : null;
            const firstPart = firstCand && firstCand.content && Array.isArray(firstCand.content.parts) ? firstCand.content.parts.at(0) : null;
            const txt = firstPart ? firstPart.text : '';
            if (r.ok && txt) {
              return { text: txt, used: m };
            }
            lastErr = (d.error && d.error.message) || `HTTP ${r.status}`;
          } catch (e) {
            lastErr = e.message;
          }
        }
      }
      throw new Error(lastErr || 'Gemini API Error');
    }

    async function callPartner(url, key, modelId, promptText) {
      if (!key) return null;
      try {
        const r = await fetchWithTimeout(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
          body: JSON.stringify({
            model: modelId,
            messages: [
              { role: 'system', content: sysPrompt },
              { role: 'user', content: promptText }
            ]
          })
        }, 12000);
        const d = await r.json();
        const firstChoice = Array.isArray(d.choices) ? d.choices.at(0) : null;
        return (r.ok && firstChoice && firstChoice.message) ? firstChoice.message.content : null;
      } catch {
        return null;
      }
    }

    if (model === 'apex-god-mode') {
      const fullPrompt = `Conversation Context:\n${historyContext}\n\nCurrent Task: ${lastMsg}`;
      const tasks = [
        callGemini('gemini-3.8-pro', fullPrompt, webSearch),
        callGemini('gemini-3.8-flash', `Provide deep technical analysis and clear solution for:\n${lastMsg}`, false)
      ];

      if (orKey) {
        tasks.push(callPartner(OR_URL, orKey, 'meta-llama/llama-3.3-70b-instruct:free', lastMsg));
        tasks.push(callPartner(OR_URL, orKey, 'google/gemma-3-27b-it:free', lastMsg));
      }
      if (groqKey) {
        tasks.push(callPartner(GROQ_URL, groqKey, 'llama-3.3-70b-versatile', lastMsg));
      }

      const results = await Promise.allSettled(tasks);
      const validAnswers = [];
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          const val = typeof r.value === 'string' ? r.value : r.value.text;
          if (val) validAnswers.push(val);
        }
      }

      if (validAnswers.length === 0) {
        return res.status(500).json({ error: 'All APEX engines are currently busy. Check your API keys.' });
      }

      if (validAnswers.length === 1) {
        return res.status(200).json({
          reply: validAnswers.at(0),
          usedModel: 'APEX ENGINE (GEMINI 3.8)'
        });
      }

      const formatted = validAnswers.map((ans, idx) => `[Expert Engine ${idx + 1}]:\n${ans}`).join('\n\n====================\n\n');
      const judgePrompt =
        `You are the Supreme Judge & Critic of Satyexa AI (created by Sadim Molla, Sadimx Technology).\n` +
        `User Query: "${lastMsg}"\n\n` +
        `Independent Expert Outputs:\n${formatted}\n\n` +
        `TASK: Merge the highest-IQ reasoning and cleanest code into ONE definitive response in the user's language without mentioning Engine numbers.`;

      try {
        const finalOut = await callGemini('gemini-3.8-flash', judgePrompt, false);
        return res.status(200).json({
          reply: finalOut.text,
          usedModel: `APEX GOD-MODE (${validAnswers.length} Brains Merged)`
        });
      } catch {
        return res.status(200).json({
          reply: validAnswers.at(0),
          usedModel: `APEX ENGINE (FALLBACK)`
        });
      }
    }

    const singleOut = await callGemini(model, `Context:\n${historyContext}\n\nUser: ${lastMsg}`, webSearch);
    return res.status(200).json({
      reply: singleOut.text,
      usedModel: `SATYEXA • ${singleOut.used.toUpperCase()}`
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
                       }
