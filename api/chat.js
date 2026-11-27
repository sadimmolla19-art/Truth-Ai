    // Prioritize Latest Flagship Pro/Exp models first, then gracefully fallback to Flash & Flash-Lite
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
            return 50; // Fallback to existing flash-lite or other stable models
          };

          valid.sort((a, b) => priorityScore(b) - priorityScore(a));
          if (valid.length > 0) return valid.slice(0, 5);
        }
      } catch {}
      return ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-flash-lite-latest'];
    }
