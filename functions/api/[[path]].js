export async function onRequest(context) {
  const { request, env, params } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (typeof process === 'undefined') {
    globalThis.process = { env: {} };
  }
  process.env = { ...process.env, ...env };

  const pathSegments = params.path || [];
  const endpoint = pathSegments;

  try {
    let handlerModule;
    if (endpoint === 'chat') {
      handlerModule = await import('../../api/chat.js');
    } else if (endpoint === 'deployer') {
      handlerModule = await import('../../api/deployer.js');
    } else if (endpoint === 'trade') {
      handlerModule = await import('../../api/trade.js');
    } else if (endpoint === 'headless') {
      handlerModule = await import('../../api/headless.js');
    } else {
      return new Response(JSON.stringify({ error: `Unknown API route: /api/${endpoint}` }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const handler = handlerModule.default;
    let bodyData = {};
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      try {
        bodyData = await request.json();
      } catch (e) {
        bodyData = {};
      }
    }

    const mockReq = {
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: bodyData,
      query: Object.fromEntries(new URL(request.url).searchParams.entries()),
    };

    return await new Promise((resolve) => {
      let statusCode = 200;
      const responseHeaders = { 'Content-Type': 'application/json' };

      const mockRes = {
        status(code) { statusCode = code; return this; },
        setHeader(key, val) { responseHeaders[key] = val; return this; },
        json(data) {
          resolve(new Response(JSON.stringify(data), { status: statusCode, headers: responseHeaders }));
        },
        send(data) {
          const payload = typeof data === 'object' ? JSON.stringify(data) : String(data);
          resolve(new Response(payload, { status: statusCode, headers: responseHeaders }));
        },
      };

      Promise.resolve(handler(mockReq, mockRes)).catch((err) => {
        resolve(
          new Response(JSON.stringify({ error: err.message || 'Cloudflare Function Error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Bridge Error (${endpoint}): ${err.message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
