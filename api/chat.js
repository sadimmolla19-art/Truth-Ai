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
            multiFiles,

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
    const GEMINI_ROOT = P + ["generativelanguage", "googleapis", "com"].join(".") + "/v1beta/models";
    const OR_URL = P + ["openrouter", "ai"].join(".") + "/api/v1/chat/completions";
    const GROQ_URL = P + ["api", "groq", "com"].join(".") + "/openai/v1/chat/completions";

    const lastMsg = (messages && messages.length > 0) ? messages[messages.length - 1].text : "Hello";
    const historyContext = (messages || []).slice(-6).map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');
    // ==============================================================
    // LIVE TRADING MARKET ANALYZER & WEB READER AGENT
    // ==============================================================
    let liveToolContext = "";

    // 1. Live Web Page / URL Reader Agent
    const urlMatch = lastMsg.match(/https?:\/\/[^\s]+/i);
    if (urlMatch) {
      try {
        const pageRes = await fetch(urlMatch[0], {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SatyexaBot/1.0)' }
        });
        if (pageRes.ok) {
          const rawHtml = await pageRes.text();
          const cleanText = rawHtml
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 4500);
          liveToolContext += `\n[LIVE WEB PAGE CONTENT FROM ${urlMatch[0]}]:\n${cleanText}\n`;
        }
      } catch (e) {}
    }

    // 2. Live Crypto & Market Trading Data (Binance Public API - 100% Free)
    const tradeKeywords = /\b(btc|bitcoin|eth|ethereum|sol|solana|bnb|xrp|doge|ton|ada|trx|trade|trading|crypto|signal|market|price|chart)\b/i;
    if (tradeKeywords.test(lastMsg)) {
      const coinMap = {
        btc: 'BTCUSDT', bitcoin: 'BTCUSDT',
        eth: 'ETHUSDT', ethereum: 'ETHUSDT',
        sol: 'SOLUSDT', solana: 'SOLUSDT',
        bnb: 'BNBUSDT', xrp: 'XRPUSDT',
        doge: 'DOGEUSDT', ton: 'TONUSDT',
        ada: 'ADAUSDT', trx: 'TRXUSDT'
      };
      let symbol = 'BTCUSDT';
      for (const [k, v] of Object.entries(coinMap)) {
        if (new RegExp(`\\b${k}\\b`, 'i').test(lastMsg)) { symbol = v; break; }
      }
      try {
        const mRes = await fetch(`https://binance.com{symbol}`);
        if (mRes.ok) {
          const m = await mRes.json();
          liveToolContext += `\n[LIVE MARKET DATA - ${symbol}]: Current Price: $${parseFloat(m.lastPrice).toFixed(4)}, 24h Change: ${m.priceChangePercent}%, 24h High: $${parseFloat(m.highPrice).toFixed(4)}, 24h Low: $${parseFloat(m.lowPrice).toFixed(4)}, 24h Volume: ${parseFloat(m.volume).toFixed(2)}. Analyze trend, support/resistance, and risk clearly (note: for educational analysis only).\n`;
        }
      } catch (e) {}
        }
    
    const sysPrompt =
      "You are Satyexa AI (Genesis Prime v20.0 APEX), created and owned by Sadim Molla, Founder of Sadimx Technology. " +
      "If anyone asks who created you or who your owner is, always proudly answer that you were created by Sadim Molla and Sadimx Technology. " +
      "Automatically detect the language of the user's message and always respond fluently in that exact same language (English, Bengali, Hindi, Arabic, Spanish, French, etc.), unless the user explicitly asks to translate or reply in another language.\n" +
        "Never write Bengali words in English/Roman letters (no broken Banglish like 'kibhabe' or 'tiri korechen'). When the user writes in Bengali or Banglish, always reply in natural, fluent Bengali script (বাংলা অক্ষর) mixed naturally with standard English technical terms (like code, server, API, profile, update) so there are zero spelling mistakes. For any other language (English, Hindi, Arabic, etc.), reply fluently in that exact language.\n" +
      
      (customPersona ? `User Custom Persona: ${customPersona}\n` : "") +
    
      (deepThink ? "CRITICAL: Perform deep, multi-step chain-of-thought reasoning before giving the final structured answer." : "Provide sharp, accurate, production-grade responses.");

    async function fetchWithTimeout(url, options, timeoutMs = 25000) {
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

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

    // আপনার API Key-তে আসলেই কোন কোন মডেল চালু আছে তা অটোমেটিক খুঁজে বের করবে
    async function getAvailableGeminiModels(apiKey) {
      try {
        const r = await fetchWithTimeout(`${GEMINI_ROOT}?key=${apiKey}`, { method: 'GET' }, 6000);
        const d = await r.json();
        if (r.ok && Array.isArray(d.models)) {
          const valid = d.models
            .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
            .map(m => m.name.replace('models/', ''))
            .filter(name => name.includes('gemini') && !name.includes('vision') && !name.includes('embedding') && !name.includes('2.0') && !name.includes('2.5'));
          
          // ফ্ল্যাশ মডেলগুলোকে আগে রাখবে যাতে দ্রুত উত্তর আসে
          valid.sort((a, b) => (b.includes('flash') ? 1 : 0) - (a.includes('flash') ? 1 : 0));
          if (valid.length > 0) return valid.slice(0, 4);
        }
      } catch {}
      return ['gemini-3.8-flash', 'gemini-3.8-pro'];
    }

    async function getGuaranteedAnswer(promptText, useWeb = false) {
      let debugErrors = [];

      if (geminiKeys.length > 0) {
        const parts = [{ text: promptText }];
                if (Array.isArray(multiFiles) && multiFiles.length > 0) {
          multiFiles.forEach(f => {
            if (f.data) {
              const b64 = f.data.includes(',') ? f.data.split(',').pop() : f.data;
              parts.push({ inlineData: { mimeType: f.mimeType || "image/jpeg", data: b64 } });
            }
          });
                }
        
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

        for (const activeKey of geminiKeys) {
          const liveModels = await getAvailableGeminiModels(activeKey);
          for (const m of liveModels) {
            // প্রতি মডেলের জন্য সর্বোচ্চ ২ বার চেষ্টা করবে (High demand এড়াতে)
            for (let attempt = 1; attempt <= 2; attempt++) {
              try {
                const r = await fetchWithTimeout(`${GEMINI_ROOT}/${m}:generateContent?key=${activeKey}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
                }, 25000);
                const d = await r.json();
                const firstCand = Array.isArray(d.candidates) ? d.candidates.at(0) : null;
                const firstPart = firstCand && firstCand.content && Array.isArray(firstCand.content.parts) ? firstCand.content.parts.at(0) : null;
                const txt = firstPart ? firstPart.text : '';
                if (r.ok && txt) {
                  return { text: txt, used: m };
                }
                const errMsg = (d.error && d.error.message) || `HTTP ${r.status}`;
                debugErrors.push(`${m}: ${errMsg}`);
                // যদি মডেল ব্যস্ত (503/high demand) থাকে, ১.৫ সেকেন্ড অপেক্ষা করে আবার চেষ্টা করবে
                if (r.status === 503 || errMsg.includes('demand') || errMsg.includes('overloaded')) {
                  await sleep(1500);
                  continue;
                }
                break; // অন্য এরর হলে পরের মডেলে যাবে
              } catch (e) {
                debugErrors.push(`${m}: ${e.message}`);
                break;
              }
            }
          }
        }
      }

      if (groqKey) {
              for (const gm of ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'moonshotai/kimi-k2-instruct', 'qwen/qwen3-32b']) {
                
          const resText = await callPartner(GROQ_URL, groqKey, gm, promptText);
          if (resText) return { text: resText, used: gm };
        }
      }

      if (orKey) {
              for (const om of ['meta-llama/llama-3.3-70b-instruct:free', 'google/gemma-3-27b-it:free', 'qwen/qwen3-coder:free', 'openrouter/free']) {
                
          const resText = await callPartner(OR_URL, orKey, om, promptText);
          if (resText) return { text: resText, used: om };
        }
      }

      throw new Error(debugErrors.slice(0, 2).join(' | ') || 'Servers temporarily busy, please try again.');
    }
    // Direct routing when user selects a specific model (1 to 20)
    const directMap = {
      'or-nemotron': ['openrouter', 'nvidia/nemotron-3-ultra:free'],
      'or-gemma4': ['openrouter', 'google/gemma-3-27b-it:free'],
      'or-particle': ['openrouter', 'deepseek/deepseek-r1:free'],
      'groq-gptoss': ['groq', 'openai/gpt-oss-120b'],
      'groq-llama': ['groq', 'llama-3.3-70b-versatile'],
      'or-qwen-coder': ['openrouter', 'qwen/qwen3-coder:free'],
      'groq-kimi-k2': ['groq', 'moonshotai/kimi-k2-instruct'],
      'groq-qwen3': ['groq', 'qwen/qwen3-32b'],
      'or-glm5': ['openrouter', 'zhipu/glm-5.3-flash:free'],
      'or-auto-free': ['openrouter', 'openrouter/free']
    };

    if (model && directMap[model]) {
      const [prov, mId] = directMap[model];
      const apiUrl = prov === 'groq' ? GROQ_URL : OR_URL;
      const apiKey = prov === 'groq' ? groqKey : orKey;
      if (apiKey) {
                const directAns = await callPartner(apiUrl, apiKey, mId, `Context:\n${historyContext}\n\nUser: ${lastMsg}${liveToolContext}`);
        if (directAns) {
          return res.status(200).json({ reply: directAns, usedModel: mId });
        }
      }
    }

    if (model === 'apex-god-mode') {
      const fullPrompt = `Conversation Context:\n${historyContext}\n\nCurrent Task: ${lastMsg}${liveToolContext}`;
      const mainOut = await getGuaranteedAnswer(fullPrompt, webSearch);

      let extraAns = null;
      if (groqKey) extraAns = await callPartner(GROQ_URL, groqKey, 'llama-3.3-70b-versatile', `${lastMsg}${liveToolContext}`);
      if (!extraAns && orKey) extraAns = await callPartner(OR_URL, orKey, 'meta-llama/llama-3.3-70b-instruct:free', `${lastMsg}${liveToolContext}`);

      if (!extraAns) {
        return res.status(200).json({
          reply: mainOut.text,
          usedModel: `APEX ENGINE • ${mainOut.used.toUpperCase()}`
        });
      }

      const judgePrompt =
        `You are the Supreme Judge & Critic of Satyexa AI (created by Sadim Molla, Sadimx Technology).\n` +
        `User Query: "${lastMsg}${liveToolContext}"\n\n` +
        `[Expert 1]:\n${mainOut.text}\n\n[Expert 2]:\n${extraAns}\n\n` +
        `TASK: Merge the highest-IQ reasoning and cleanest code into ONE definitive response in the user's language without extra fluff.`;

      try {
        const finalOut = await getGuaranteedAnswer(judgePrompt, false);
        return res.status(200).json({
          reply: finalOut.text,
          usedModel: `APEX GOD-MODE (2 Brains Merged)`
        });
      } catch {
        return res.status(200).json({
          reply: mainOut.text,
          usedModel: `APEX ENGINE • ${mainOut.used.toUpperCase()}`
        });
      }
    }

    const singleOut = await getGuaranteedAnswer(`Context:\n${historyContext}\n\nUser: ${lastMsg}${liveToolContext}`, webSearch);
    
      reply: singleOut.text,
      usedModel: `SATYEXA • ${singleOut.used.toUpperCase()}`
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
              }
