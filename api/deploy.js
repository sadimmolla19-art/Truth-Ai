export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { platform, target, code, adminPassword } = req.body;

    // Verify Admin Password (Ensure ADMIN_PASSWORD is set in Vercel Env)
    if (process.env.ADMIN_PASSWORD && adminPassword !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized: Invalid Admin Password' });
    }

    // ==========================================
    // CLOUDFLARE WORKER DEPLOYMENT (ES MODULE)
    // ==========================================
    if (platform === 'cloudflare' || platform.includes('Cloudflare')) {
      const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
      const apiToken = process.env.CLOUDFLARE_API_TOKEN;

      if (!accountId || !apiToken) {
        return res.status(500).json({ error: 'Missing Cloudflare Credentials in Vercel Environment Variables' });
      }

      const workerName = target.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');

      // Construct proper multipart/form-data for Cloudflare ES Modules
      const formData = new FormData();

      // 1. Metadata part (Tells Cloudflare this is an ES Module using worker.js)
      const metadata = {
        main_module: 'worker.js',
        compatibility_date: '2024-11-01',
      };
      formData.append(
        'metadata',
        new Blob([JSON.stringify(metadata)], { type: 'application/json' }),
        'metadata.json'
      );

      // 2. Worker script part
      formData.append(
        'worker.js',
        new Blob([code], { type: 'application/javascript+module' }),
        'worker.js'
      );

      const cfResponse = await fetch(
        `https://cloudflare.com{accountId}/workers/scripts/${workerName}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${apiToken}`,
          },
          body: formData,
        }
      );

      const cfData = await cfResponse.json();

      if (!cfResponse.ok || !cfData.success) {
        const errMsg = cfData.errors?.[0]?.message || 'Cloudflare API rejected the script';
        return res.status(400).json({ error: `Cloudflare Error: ${errMsg}` });
      }

      // Enable workers.dev subdomain automatically
      await fetch(
        `https://cloudflare.com{accountId}/workers/scripts/${workerName}/subdomain`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ enabled: true }),
        }
      );

      return res.status(200).json({
        success: true,
        message: `Worker '${workerName}' deployed successfully!`,
      });
    }

    return res.status(400).json({ error: 'Unsupported platform selected' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
