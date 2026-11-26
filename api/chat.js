export const maxDuration = 60;

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

    async function fetchWithTimeout(url, options, timeoutMs = 8000) {
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
        }, 7000);
        const d = await r.json();
        const firstChoice = Array.isArray(d.choices) ? d.choices.at(0) : null;
        return (r.ok && firstChoice && firstChoice.message) ? firstChoice.message.content : null;
      } catch {
        return null;
      }
    }

    async function getGuaranteedAnswer(promptText, useWeb = false) {
      let debugErrors = [];

      // লেয়ার ১, ২, ৩: Google Gemini চেইন
      if (geminiKeys.length > 0) {
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

        const geminiModels = ['gemini-3.8-flash', 'gemini-3.8-flash-lite', 'gemini-3.0-flash'];
        for (const activeKey of geminiKeys) {
          for (const m of geminiModels) {
            try {
              const r = await fetchWithTimeout(`${GEMINI_BASE}${m}:generateContent?key=${activeKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              }, 8000);
              const d = await r.json();
              const firstCand = Array.isArray(d.candidates) ? d.candidates.at(0) : null;
              const firstPart = firstCand && firstCand.content && Array.isArray(firstCand.content.parts) ? firstCand.content.parts.at(0) : null;
              const txt = firstPart ? firstPart.text : '';
              if (r.ok && txt) {
                return { text: txt, used: m };
              }
              debugErrors.push(`${m}: ${(d.error && d.error.message) || r.status}`);
            } catch (e) {
              debugErrors.push(`${m}: ${e.message}`);
            }
          }
        }
      }

      // লেয়ার ৪ ও ৫: Groq ব্যাকআপ
      if (groqKey) {
        const groqModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
        for (const gm of groqModels) {
          const resText = await callPartner(GROQ_URL, groqKey, gm, promptText);
          if (resText) return { text: resText, used: gm };
        }
        debugErrors.push('Groq failed');
      }

      // লেয়ার ৬ ও ৭: OpenRouter ব্যাকআপ
      if (orKey) {
        const orModels = ['meta-llama/llama-3.3-70b-instruct:free', 'google/gemma-3-27b-it:free'];
        for (const om of orModels) {
          const resText = await callPartner(OR_URL, orKey, om, promptText);
          if (resText) return { text: resText, used: om };
        }
        debugErrors.push('OpenRouter failed');
      }

      throw new Error(debugErrors.join(' | ') || 'No valid API keys');
    }

    if (model === 'apex-god-mode') {
      const fullPrompt = `Conversation Context:\n${historyContext}\n\nCurrent Task: ${lastMsg}`;
      
      const tasks = [getGuaranteedAnswer(fullPrompt, webSearch)];
      if (groqKey) tasks.push(callPartner(GROQ_URL, groqKey, 'llama-3.3-70b-versatile', lastMsg));
      if (orKey) tasks.push(callPartner(OR_URL, orKey, 'meta-llama/llama-3.3-70b-instruct:free', lastMsg));

      const results = await Promise.allSettled(tasks);
      const validAnswers = [];
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          const val = typeof r.value === 'string' ? r.value : r.value.text;
          if (val) validAnswers.push(val);
        }
      }

      if (validAnswers.length === 0) {
        const firstReason = results.find(r => r.status === 'rejected')?.reason?.message || 'All engines busy';
        return res.status(500).json({ error: firstReason });
      }

      if (validAnswers.length === 1) {
        return res.status(200).json({
          reply: validAnswers.at(0),
          usedModel: 'APEX ENGINE (ACTIVE)'
        });
      }

      const formatted = validAnswers.map((ans, idx) => `[Expert Engine ${idx + 1}]:\n${ans}`).join('\n\n====================\n\n');
      const judgePrompt =
        `You are the Supreme Judge & Critic of Satyexa AI (created by Sadim Molla, Sadimx Technology).\n` +
        `User Query: "${lastMsg}"\n\n` +
        `Independent Expert Outputs:\n${formatted}\n\n` +
        `TASK: Merge the highest-IQ reasoning and cleanest code into ONE definitive response in the user's language without mentioning Engine numbers.`;

      try {
        const finalOut = await getGuaranteedAnswer(judgePrompt, false);
        return res.status(200).json({
          reply: finalOut.text,
          usedModel: `APEX GOD-MODE (${validAnswers.length} Brains Merged)`
        });
      } catch {
        return res.status(200).json({
          reply: validAnswers.at(0),
          usedModel: `APEX ENGINE (INSTANT)`
        });
      }
    }

    const singleOut = await getGuaranteedAnswer(`Context:\n${historyContext}\n\nUser: ${lastMsg}`, webSearch);
    return res.status(200).json({
      reply: singleOut.text,
      usedModel: `SATYEXA • ${singleOut.used.toUpperCase()}`
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
