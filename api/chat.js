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

    async function fetchWithTimeout(url, options, timeoutMs = 6000) {
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
        }, 6000);
        const d = await r.json();
        const firstChoice = Array.isArray(d.choices) ? d.choices.at(0) : null;
        return (r.ok && firstChoice && firstChoice.message) ? firstChoice.message.content : null;
      } catch {
        return null;
      }
    }

    // ৭-লেয়ার গ্যারান্টিড রেসপন্স ইঞ্জিন (কোনো লুপ ছাড়া, উত্তর আসবেই)
    async function getGuaranteedAnswer(promptText, useWeb = false) {
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
              }, 6000);
              const d = await r.json();
              const txt = d?.candidates?.[0]?.content?.parts?.[0]?.text || '';
              if (r.ok && txt) {
                return { text: txt, used: m };
              }
            } catch {
              // ব্যস্ত থাকলে পরের মডেলে চলে যাবে
            }
          }
        }
      }

      // লেয়ার ৪ ও ৫: Groq সুপার-ফাস্ট ব্যাকআপ (যদি গুগল ব্যস্ত থাকে)
      if (groqKey) {
        const groqModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
        for (const gm of groqModels) {
          const resText = await callPartner(GROQ_URL, groqKey, gm, promptText);
          if (resText) return { text: resText, used: gm };
        }
      }

      // লেয়ার ৬ ও ৭: OpenRouter ফ্রি ব্যাকআপ
      if (orKey) {
        const orModels = ['meta-llama/llama-3.3-70b-instruct:free', 'google/gemma-3-27b-it:free'];
        for (const om of orModels) {
          const resText = await callPartner(OR_URL, orKey, om, promptText);
          if (resText) return { text: resText, used: om };
        }
      }

      throw new Error('All 7 backup layers are unreachable. Please check your API keys in Vercel.');
    }

    if (model === 'apex-god-mode') {
      const fullPrompt = `Conversation Context:\n${historyContext}\n\nCurrent Task: ${lastMsg}`;
      
      // সবগুলো ইঞ্জিন একসাথে চালাবে, যেগুলো দ্রুত উত্তর দেবে সেগুলো নেবে
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
        const fallback = await getGuaranteedAnswer(lastMsg, false);
        return res.status(200).json({
          reply: fallback.text,
          usedModel: `APEX ENGINE (${fallback.used.toUpperCase()})`
        });
      }

      if (validAnswers.length === 1) {
        return res.status(200).json({
          reply: validAnswers.at(0),
          usedModel: 'APEX ENGINE (ACTIVE)'
        });
      }

      // একাধিক উত্তর পেলে মার্জ করার চেষ্টা করবে, ব্যস্ত থাকলে সেরা উত্তরটি সরাসরি দিয়ে দেবে
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

    // সাধারণ মডেল সিলেক্ট করলে ৭-লেয়ার ব্যাকআপসহ উত্তর দেবে
    const singleOut = await getGuaranteedAnswer(`Context:\n${historyContext}\n\nUser: ${lastMsg}`, webSearch);
    return res.status(200).json({
      reply: singleOut.text,
      usedModel: `SATYEXA • ${singleOut.used.toUpperCase()}`
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
                          }
