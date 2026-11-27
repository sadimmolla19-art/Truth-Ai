export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { url, email, password } = req.body || {};
  const apiKey = process.env.BROWSERLESS_API_KEY;

  if (!url || !email || !password) {
    return res.status(400).json({ error: 'URL, Email, and Password are required.' });
  }

  if (!apiKey) {
    return res.status(500).json({ error: 'BROWSERLESS_API_KEY is missing in Vercel Environment Variables.' });
  }

  try {
    // Puppeteer/Playwright script sent to Browserless Cloud API
    const script = `
      module.exports = async ({ page }) => {
        await page.goto(${JSON.stringify(url)}, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Auto-detect and fill standard email, username, and password fields
        const emailSelectors = ['input[type="email"]', 'input[name*="email"]', 'input[name*="user"]', 'input[id*="email"]'];
        for (const sel of emailSelectors) {
          if (await page.$(sel)) { await page.type(sel, ${JSON.stringify(email)}, { delay: 30 }); break; }
        }

        const passSelectors = ['input[type="password"]', 'input[name*="pass"]', 'input[id*="pass"]'];
        for (const sel of passSelectors) {
          if (await page.$(sel)) { await page.type(sel, ${JSON.stringify(password)}, { delay: 30 }); break; }
        }

        // Click submit button if present
        const submitBtn = await page.$('button[type="submit"], input[type="submit"]');
        if (submitBtn) {
          await Promise.all([
            submitBtn.click(),
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {})
          ]);
        }

        const finalTitle = await page.title();
        const finalUrl = page.url();
        return { data: { title: finalTitle, finalUrl }, type: 'application/json' };
      };
    `;

    const response = await fetch(`https://browserless.io{apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/javascript' },
      body: script
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || 'Headless browser execution failed.');
    }

    return res.status(200).json({
      success: true,
      message: `Page loaded (${result.data?.title || 'Done'}) -> Redirected to: ${result.data?.finalUrl || url}`
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Headless API Error' });
  }
}
