export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      mode,
      password,
      platform,
      userConfig,
      fileData,
      customRequest
    } = req.body;

    let config = {};

    if (mode === 'admin') {
      if (!password || password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'ভুল অ্যাডমিন পাসওয়ার্ড! অ্যাক্সেস বাতিল করা হয়েছে।' });
      }
      config = {
        ghToken: process.env.ADMIN_GITHUB_TOKEN,
        ghOwner: process.env.ADMIN_GITHUB_OWNER,
        ghRepo: process.env.ADMIN_GITHUB_REPO,
        vercelToken: process.env.ADMIN_VERCEL_TOKEN,
        cfToken: process.env.ADMIN_CF_TOKEN,
        cfAccountId: process.env.ADMIN_CF_ACCOUNT_ID
      };
    } else {
      config = userConfig || {};
    }

    if (platform === 'github') {
      const { ghToken, ghOwner, ghRepo } = config;
      if (!ghToken || !ghOwner || !ghRepo) {
        return res.status(400).json({ error: 'GitHub Token, Owner বা Repo তথ্য দেওয়া হয়নি!' });
      }
      const apiUrl = `https://github.com{ghOwner}/${ghRepo}/contents/${fileData.path}`;
      let sha = null;
      const checkRes = await fetch(apiUrl, {
        headers: { Authorization: `Bearer ${ghToken}`, Accept: 'application/vnd.github.v3+json' }
      });
      if (checkRes.ok) {
        const existing = await checkRes.json();
        sha = existing.sha;
      }
      const updateRes = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${ghToken}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: fileData.message || 'Deployed via Satyexa AI Universal Coder',
          content: Buffer.from(fileData.content, 'utf-8').toString('base64'),
          ...(sha ? { sha } : {})
        })
      });
      const result = await updateRes.json();
      if (!updateRes.ok) return res.status(updateRes.status).json({ error: result.message });
      return res.status(200).json({ success: true, message: `GitHub-এ ${fileData.path} আপডেট হয়েছে!`, url: result.content?.html_url });
    }

    if (platform === 'vercel') {
      if (!config.vercelToken) return res.status(400).json({ error: 'Vercel Token দেওয়া হয়নি!' });
      const vRes = await fetch('https://api.vercel.com/v13/deployments, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.vercelToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fileData.projectName || 'satyexa-app',
          files: [{ file: fileData.path || 'index.html', data: fileData.content }],
          projectSettings: { framework: null }
        })
      });
      const vData = await vRes.json();
      if (!vRes.ok) return res.status(vRes.status).json({ error: vData.error?.message });
      return res.status(200).json({ success: true, message: 'Vercel-এ লাইভ হয়েছে!', liveUrl: `https://${vData.url}` });
    }

    if (platform === 'cloudflare') {
      if (!config.cfToken || !config.cfAccountId) return res.status(400).json({ error: 'Cloudflare Token বা Account ID দেওয়া হয়নি!' });
      const workerName = fileData.workerName || 'satyexa-worker';
      const cfRes = await fetch(`https://cloudflare.com{config.cfAccountId}/workers/scripts/${workerName}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${config.cfToken}`, 'Content-Type': 'application/javascript' },
        body: fileData.content
      });
      const cfData = await cfRes.json();
      if (!cfData.success) {
        const errMsg = (cfData.errors && cfData.errors[0] && cfData.errors[0].message) ? cfData.errors[0].message : 'Cloudflare ডিপ্লয় ব্যর্থ হয়েছে';
        return res.status(400).json({ error: errMsg });
      }
      return res.status(200).json({ success: true, message: `Cloudflare Worker (${workerName}) ডিপ্লয় হয়েছে!` });
    }

    if (platform === 'universal' && customRequest) {
      const { endpointUrl, method, headers, payload } = customRequest;
      if (!endpointUrl) return res.status(400).json({ error: 'অ্যাপের API Endpoint URL দেওয়া হয়নি!' });

      const uniRes = await fetch(endpointUrl, {
        method: method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(headers || {})
        },
        body: payload ? (typeof payload === 'string' ? payload : JSON.stringify(payload)) : undefined
      });

      const responseText = await uniRes.text();
      let parsedData;
      try { parsedData = JSON.parse(responseText); } catch { parsedData = responseText; }

      if (!uniRes.ok) {
        return res.status(uniRes.status).json({ error: 'Universal API ব্যর্থ হয়েছে', details: parsedData });
      }
      return res.status(200).json({
        success: true,
        message: 'কাস্টম অ্যাপে সফলভাবে কোড/কমান্ড পাঠানো হয়েছে!',
        data: parsedData
      });
    }

    return res.status(400).json({ error: 'অজানা প্ল্যাটফর্ম সিলেক্ট করা হয়েছে।' });
  } catch (err) {
    return res.status(500).json({ error: 'সার্ভার এরর: ' + err.message });
  }
}
