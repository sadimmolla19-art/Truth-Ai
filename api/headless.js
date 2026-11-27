export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { url, email, password, fullName } = req.body || {};
  const apiKey = process.env.BROWSERLESS_API_KEY;

  if (!url || !email || !password) {
    return res.status(400).json({ error: 'URL, Email, and Password are required.' });
  }

  if (!apiKey) {
    return res.status(500).json({ error: 'BROWSERLESS_API_KEY is missing in Vercel Environment Variables.' });
  }

  const emailPrefix = email.split('@')[0] || 'user';
  const nameToUse = fullName || emailPrefix.replace(/[^a-zA-Z ]/g, ' ').trim() || 'Sadim User';
  const usernameToUse = emailPrefix.replace(/[^a-zA-Z0-9]/g, '') + Math.floor(10 + Math.random() * 89);

  try {
    const script = `
      module.exports = async ({ page }) => {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.goto(${JSON.stringify(url)}, { waitUntil: 'networkidle2', timeout: 30000 });

        await page.evaluate(({ email, password, nameToUse, usernameToUse }) => {
          const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([disabled])'));
          inputs.forEach(inp => {
            const attr = (inp.type + ' ' + inp.name + ' ' + inp.id + ' ' + inp.placeholder).toLowerCase();
            if (inp.type === 'checkbox') {
              inp.checked = true;
              inp.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (attr.includes('email')) {
              inp.value = email;
            } else if (attr.includes('pass')) {
              inp.value = password;
            } else if (attr.includes('user')) {
              inp.value = usernameToUse;
            } else if (attr.includes('first')) {
              inp.value = nameToUse.split(' ')[0] || 'Sadim';
            } else if (attr.includes('last')) {
              inp.value = nameToUse.split(' ')[1] || 'User';
            } else if (attr.includes('name')) {
              inp.value = nameToUse;
            } else if (attr.includes('phone') || attr.includes('mobile')) {
              inp.value = '01700000000';
            }
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            inp.dispatchEvent(new Event('change', { bubbles: true }));
          });
        }, { email: ${JSON.stringify(email)}, password: ${JSON.stringify(password)}, nameToUse: ${JSON.stringify(nameToUse)}, usernameToUse: ${JSON.stringify(usernameToUse)} });

        const clicked = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button, input[type="submit"]'));
          const target = btns.find(b => /sign up|register|create|submit|next|continue/i.test(b.innerText || b.value || ''));
          if (target) { target.click(); return true; }
          return false;
        });

        if (clicked) {
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
        }

        const finalTitle = await page.title();
        const finalUrl = page.url();
        return { data: { title: finalTitle, finalUrl, username: usernameToUse }, type: 'application/json' };
      };
    `;

    const response = await fetch('https://browserless.io' + apiKey, {
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
      message: `Completed! Username: ${result.data?.username} | Page: ${result.data?.title || 'Done'} | URL: ${result.data?.finalUrl || url}`
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Headless API Error' });
  }
}
