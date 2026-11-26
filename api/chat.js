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
const browserlessKey = process.env.BROWSERLESS_KEY;
    
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
    const urlMatch = lastMsg.match(/https?:\/\/[^\s]+/i);
    
                if (urlMatch) {
      const targetUrl = urlMatch;
      const isActionReq = /(create account|signup|sign up|register|login|fill|submit|অ্যাকাউন্ট|লগইন|ফর্ম)/i.test(lastMsg);
      const emailFound = (lastMsg.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/) || [null]) || "sadim" + Math.floor(100 + Math.random()*8999) + "@gmail.com";
      const passFound = (lastMsg.match(/(?:pass|password|পাসওয়ার্ড)[:\s=]+([^\s,]+)/i) || [null, null]) || "Satyexa@" + Math.floor(1000 + Math.random()*9000);
      const nameFound = (lastMsg.match(/(?:name|নাম)[:\s=]+([a-zA-Z\s]{2,25})/i) || [null, null])?.trim() || "Sadim Molla";
      const phoneFound = (lastMsg.match(/(?:phone|mobile|নম্বর)[:\s=]+([0-9+]{8,15})/i) || [null, null]) || "017" + Math.floor(10000000 + Math.random()*89999999);

      let browserOutput = "";
      try {
        if (browserlessKey && isActionReq) {
          const fnHost = P + ["chrome", "browserless", "io"].join(".") + `/function?token=${browserlessKey}`;
          const agentScript = `
            module.exports = async ({ page }) => {
              await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
              await page.goto(${JSON.stringify(targetUrl)}, { waitUntil: 'networkidle2', timeout: 28000 });
              
              // If landing page has a Sign Up / Register link/button and no password field yet, click it first
              const hasPass = await page.$('input[type="password"]');
              if (!hasPass) {
                await page.evaluate(() => {
                  const triggers = Array.from(document.querySelectorAll('a, button'));
                  const regBtn = triggers.find(el => /(sign up|signup|register|create account|get started)/i.test(el.innerText || ''));
                  if (regBtn) regBtn.click();
                });
                await new Promise(r => setTimeout(r, 2500));
              }

              const result = await page.evaluate(({ email, pass, name, phone }) => {
                let filled = [];
                const parts = name.split(' ');
                const firstName = parts || 'Sadim';
                const lastName = parts.slice(1).join(' ') || 'Molla';

                const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([disabled])'));
                inputs.forEach(inp => {
                  if (inp.type === 'checkbox') {
                    if (!inp.checked) inp.click();
                    return;
                  }
                  const hint = (inp.name + ' ' + inp.id + ' ' + inp.placeholder + ' ' + inp.type + ' ' + (inp.getAttribute('aria-label') || '')).toLowerCase();
                  let val = '';
                  if (hint.includes('email') || inp.type === 'email') val = email;
                  else if (hint.includes('pass') || inp.type === 'password') val = pass;
                  else if (hint.includes('phone') || hint.includes('mobile') || inp.type === 'tel') val = phone;
                  else if (hint.includes('first')) val = firstName;
                  else if (hint.includes('last')) val = lastName;
                  else if (hint.includes('user')) val = firstName.toLowerCase() + Math.floor(100 + Math.random()*900);
                  else if (hint.includes('name')) val = name;

                  if (val) {
                    inp.focus();
                    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                    if (nativeSetter) nativeSetter.call(inp, val);
                    else inp.value = val;
                    inp.dispatchEvent(new Event('input', { bubbles: true }));
                    inp.dispatchEvent(new Event('change', { bubbles: true }));
                    inp.blur();
                    filled.push(inp.name || inp.id || inp.placeholder || inp.type);
                  }
                });

                const buttons = Array.from(document.querySelectorAll('button[type="submit"], input[type="submit"], button'));
                const submitBtn = buttons.find(b => /(create|sign up|signup|register|submit|continue|next|join)/i.test((b.innerText || b.value || ''))) || buttons;
                if (submitBtn) submitBtn.click();
                return { title: document.title, filled, clickedBtn: submitBtn ? (submitBtn.innerText || submitBtn.value || 'submit') : 'none' };
              }, { email: ${JSON.stringify(emailFound)}, pass: ${JSON.stringify(passFound)}, name: ${JSON.stringify(nameFound)}, phone: ${JSON.stringify(phoneFound)} });

              await new Promise(r => setTimeout(r, 3000));
              const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 2000));
              return { data: { ...result, finalUrl: page.url(), bodyText }, type: 'application/json' };
            };
          `;
          const actRes = await fetch(fnHost, {
            method: 'POST',
            headers: { 'Content-Type': 'application/javascript' },
            body: agentScript
          });
          if (actRes.ok) {
            const actJson = await actRes.json();
            browserOutput = `[HEADLESS BROWSER EXECUTION REPORT]: Navigated to ${targetUrl}. Filled fields: ${JSON.stringify(actJson.filled)}. Clicked button: "${actJson.clickedBtn}". Final URL: ${actJson.finalUrl}. Credentials used -> Name: ${nameFound}, Email: ${emailFound}, Password: ${passFound}. Page status text: ${actJson.bodyText}`;
          }
        }
        if (!browserOutput) {
          const pageRes = await fetch(urlMatch, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SatyexaBot/1.0)' } });
          if (pageRes.ok) {
            const rawHtml = await pageRes.text();
            const cleanText = rawHtml.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 4500);
            browserOutput = `[LIVE WEB PAGE CONTENT FROM ${urlMatch}]:\n${cleanText}`;
          }
        }
        if (browserOutput) liveToolContext += `\n${browserOutput}\n`;
      } catch (e) {}
                }
    
    // 1. All-Rounder Live Crypto Engine (Multilingual)
    if (/(btc|bitcoin|বিটকয়েন|बिटकॉइन|eth|ethereum|ইথেরিয়াম|sol|solana|সোলানা|bnb|xrp|doge|ton|ada|trx|crypto|ক্রিপ্টো|क्रिप्टो)/i.test(lastMsg)) {
      const coinMap = { 'বিটকয়েন': 'BTCUSDT', 'बिटकॉइन': 'BTCUSDT', btc: 'BTCUSDT', bitcoin: 'BTCUSDT', 'ইথেরিয়াম': 'ETHUSDT', eth: 'ETHUSDT', ethereum: 'ETHUSDT', 'সোলানা': 'SOLUSDT', sol: 'SOLUSDT', solana: 'SOLUSDT', bnb: 'BNBUSDT', xrp: 'XRPUSDT', doge: 'DOGEUSDT', ton: 'TONUSDT', ada: 'ADAUSDT', trx: 'TRXUSDT' };
      let symbol = 'BTCUSDT';
      for (const [k, v] of Object.entries(coinMap)) {
        if (lastMsg.toLowerCase().includes(k)) { symbol = v; break; }
      }
      try {
        const bUrl = P + ["api", "binance", "com"].join(".") + `/api/v3/ticker/24hr?symbol=${symbol}`;
        const mRes = await fetch(bUrl);
        if (mRes.ok) {
          const m = await mRes.json();
          liveToolContext += `\n[LIVE CRYPTO DATA - ${symbol}]: Price: $${parseFloat(m.lastPrice).toFixed(4)}, 24h Change: ${m.priceChangePercent}%, High: $${parseFloat(m.highPrice).toFixed(4)}, Low: $${parseFloat(m.lowPrice).toFixed(4)}. Reply in the user's exact language.\n`;
        }
      } catch (e) {}
    }

    // 2. All-Rounder Live Stock, Forex & Gold Engine (Multilingual)
    if (/(stock|share|শেয়ার|शेयर|মার্কেট|market|apple|অ্যাপল|aapl|tesla|টেসলা|tsla|google|গুগল|googl|microsoft|মাইক্রোসফট|msft|nvidia|এনভিডিয়া|nvda|amazon|অ্যামাজন|amzn|gold|সোনা|গোল্ড|सोना|xau|eurusd|usd)/i.test(lastMsg)) {
      const stockMap = { 'অ্যাপল': 'AAPL', apple: 'AAPL', aapl: 'AAPL', 'টেসলা': 'TSLA', tesla: 'TSLA', tsla: 'TSLA', 'গুগল': 'GOOGL', google: 'GOOGL', googl: 'GOOGL', 'মাইক্রোসফট': 'MSFT', microsoft: 'MSFT', msft: 'MSFT', 'এনভিডিয়া': 'NVDA', nvidia: 'NVDA', nvda: 'NVDA', 'অ্যামাজন': 'AMZN', amazon: 'AMZN', amzn: 'AMZN', 'সোনা': 'GC=F', 'গোল্ড': 'GC=F', 'सोना': 'GC=F', gold: 'GC=F', xau: 'GC=F', eurusd: 'EURUSD=X' };
      let ticker = 'AAPL';
      for (const [k, v] of Object.entries(stockMap)) {
        if (lastMsg.toLowerCase().includes(k)) { ticker = v; break; }
      }
      try {
        const yUrl = P + ["query1", "finance", "yahoo", "com"].join(".") + `/v8/finance/chart/${ticker}?interval=1d&range=5d`;
        const sRes = await fetch(yUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (sRes.ok) {
          const sData = await sRes.json();
          const meta = sData?.chart?.result?.[0]?.meta;
          if (meta?.regularMarketPrice) {
            liveToolContext += `\n[LIVE MARKET DATA - ${ticker}]: Current Price: $${meta.regularMarketPrice} ${meta.currency || 'USD'}, Previous Close: $${meta.previousClose}. Analyze trend & reply in the user's exact language.\n`;
          }
        }
      } catch (e) {}
                                        }
        // 3. Smart Browser Automation, Auto-Fill Bookmarklet & Playwright Agent
    if (/(form|fill|autofill|auto-fill|login|signup|sign up|create account|register|automation|bot|playwright|bookmarklet|ফর্ম|লগইন|অ্যাকাউন্ট)/i.test(lastMsg)) {
      liveToolContext += `\n[BROWSER AUTOMATION & AUTO-FILL AGENT MODE ACTIVE]: The user wants to automate form filling, login, or account creation on a website. If a live webpage HTML/URL is provided above, inspect its exact <input> fields (name, id, type, placeholder). Provide TWO ready-to-use solutions: 1) A compact, 1-click Browser Auto-Fill Bookmarklet / Console JS snippet that automatically locates inputs, fills realistic or requested credentials, triggers 'input'/'change' events (for React/modern sites), and clicks submit. 2) A clean, ready-to-run Python Playwright automation script with human-like delays and clear setup instructions.\n`;
    }
    
    const sysPrompt =
      "You are Satyexa AI (Genesis Prime v20.0 APEX), created and owned by Sadim Molla, Founder of Sadimx Technology. " +
          `You have a built-in LIVE CLOUD HEADLESS CHROME BROWSER AGENT enabled. Never say "I cannot create accounts or fill forms". If the user asks without a URL, confidently say "Yes! Please provide the website signup URL (along with optional name, email, and password) and I will open my headless browser to fill and submit the form automatically." If [HEADLESS BROWSER EXECUTION REPORT] is present in context, summarize the exact fields filled, credentials used, and final status clearly.\n` +
      
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
        return res.status(200).json({
          
      reply: singleOut.text,
      usedModel: `SATYEXA • ${singleOut.used.toUpperCase()}`
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
              }
