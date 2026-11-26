export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      mode,
      password,
      platform,
      action,
      userConfig,
      fileData,
      customRequest
    } = req.body;

    let config = {};

    // 1. Admin Password Verification vs User Mode
    if (mode === 'admin') {
      if (!password || password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Invalid Admin Password! Access Denied.' });
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

    // 2. GITHUB AUTONOMOUS ENGINE (Read, Smart-Edit, Inject, or Overwrite Any File)
    if (platform === 'github') {
      const { ghToken, ghOwner, ghRepo } = config;
      if (!ghToken || !ghOwner || !ghRepo) {
        return res.status(400).json({ error: 'GitHub Token, Username, or Repository name is missing!' });
      }
      const targetPath = (fileData.path || 'index.html').trim();
      const apiUrl = `https://api.github.com/repos/${ghOwner}/${ghRepo}/contents/${targetPath}`;
      
      
      let sha = null;
      let existingContent = '';
      const checkRes = await fetch(apiUrl, {
        headers: { Authorization: `Bearer ${ghToken}`, Accept: 'application/vnd.github.v3+json' }
      });
      if (checkRes.ok) {
        const existing = await checkRes.json();
        sha = existing.sha;
        existingContent = Buffer.from(existing.content, 'base64').toString('utf-8');
      }

      let finalContent = fileData.content;

      if (action === 'smart_inject') {
        if (!existingContent) {
          finalContent = fileData.content;
        } else {
          const markerStart = '<!-- SATYEXA-STUDIO-START -->';
          const markerEnd = '<!-- SATYEXA-STUDIO-END -->';
          const wrappedSnippet = `${markerStart}\n${fileData.content}\n${markerEnd}`;

          if (targetPath.endsWith('.html') && (fileData.content.includes('satyexa-deploy-fab') || fileData.content.includes('SATYEXA'))) {
            if (existingContent.includes(markerStart) && existingContent.includes(markerEnd)) {
              const regex = new RegExp(`${markerStart}[\\s\\S]*?${markerEnd}`, 'g');
              finalContent = existingContent.replace(regex, wrappedSnippet);
            } else if (existingContent.includes('<!-- SATYEXA AI')) {
              const idx = existingContent.indexOf('<!-- SATYEXA AI');
              const bodyEndIdx = existingContent.lastIndexOf('</body>');
              if (idx !== -1 && bodyEndIdx > idx) {
                finalContent = existingContent.slice(0, idx) + wrappedSnippet + '\n' + existingContent.slice(bodyEndIdx);
              }
            } else if (existingContent.includes('</body>')) {
              finalContent = existingContent.replace('</body>', `${wrappedSnippet}\n</body>`);
            } else {
              finalContent = existingContent + '\n' + wrappedSnippet;
            }
          } else if (targetPath.endsWith('.html') && existingContent.includes('</body>')) {
            finalContent = existingContent.replace('</body>', `${fileData.content}\n</body>`);
          } else {
            finalContent = existingContent + '\n\n' + fileData.content;
          }
        }
      }

      const updateRes = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${ghToken}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: fileData.message || `Updated ${targetPath} via Satyexa AI Autonomous Coder`,
          content: Buffer.from(finalContent, 'utf-8').toString('base64'),
          ...(sha ? { sha } : {})
        })
      });
      const result = await updateRes.json();
      if (!updateRes.ok) return res.status(updateRes.status).json({ error: result.message });
      return res.status(200).json({
        success: true,
        message: `Successfully updated & committed ${targetPath}! Auto-deploy triggered.`,
        url: result.content?.html_url
      });
    }

    // 3. VERCEL LIVE DEPLOYMENT
    if (platform === 'vercel') {
      if (!config.vercelToken) return res.status(400).json({ error: 'Vercel Access Token is missing!' });
      const vRes = await fetch('https://api.vercel.com/v13/deployments', {
        
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
      return res.status(200).json({ success: true, message: 'Deployed live on Vercel!', liveUrl: `https://${vData.url}` });
    }

    // 4. CLOUDFLARE WORKER DEPLOYMENT
    if (platform === 'cloudflare') {
      if (!config.cfToken || !config.cfAccountId) return res.status(400).json({ error: 'Cloudflare Token or Account ID is missing!' });
      const workerName = fileData.workerName || 'satyexa-worker';
      const cfRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${config.cfAccountId}/workers/scripts/${workerName}`, {
        
        method: 'PUT',
        headers: { Authorization: `Bearer ${config.cfToken}`, 'Content-Type': 'application/javascript' },
        body: fileData.content
      });
      const cfData = await cfRes.json();
      if (!cfData.success) {
        const errMsg = (cfData.errors && cfData.errors && cfData.errors.message) ? cfData.errors.message : 'Cloudflare deployment failed';
        return res.status(400).json({ error: errMsg });
      }
      return res.status(200).json({ success: true, message: `Cloudflare Worker (${workerName}) deployed!` });
    }

    // 5. UNIVERSAL CONNECTOR (Any Coding, Database, or Hosting App API)
    if (platform === 'universal' && customRequest) {
      const { endpointUrl, method, headers, payload } = customRequest;
      if (!endpointUrl) return res.status(400).json({ error: 'Target App API Endpoint URL is missing!' });
      const uniRes = await fetch(endpointUrl, {
        method: method || 'POST',
        headers: { 'Content-Type': 'application/json', ...(headers || {}) },
        body: payload ? (typeof payload === 'string' ? payload : JSON.stringify(payload)) : undefined
      });
      const responseText = await uniRes.text();
      let parsedData;
      try { parsedData = JSON.parse(responseText); } catch { parsedData = responseText; }
      if (!uniRes.ok) return res.status(uniRes.status).json({ error: 'External App API request failed', details: parsedData });
      return res.status(200).json({ success: true, message: 'Code & command executed on external app!', data: parsedData });
    }

    return res.status(400).json({ error: 'Invalid platform selected.' });
  } catch (err) {
    return res.status(500).json({ error: 'Server Error: ' + err.message });
  }
}
