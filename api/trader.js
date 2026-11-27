import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { action, exchange, symbol, side, quantity, apiKey, apiSecret, customWebhookUrl, useTestnet } = req.body;
    const cleanSymbol = (symbol || 'BTCUSDT').toUpperCase().trim();

    if (action === 'analyze') {
      const [tickerRes, klineRes] = await Promise.all([
        fetch(`https://binance.com{cleanSymbol}`),
        fetch(`https://binance.com{cleanSymbol}&interval=15m&limit=20`)
      ]);
      const ticker = await tickerRes.json();
      const klines = await klineRes.json();

      if (!tickerRes.ok || !Array.isArray(klines)) {
        return res.status(400).json({ error: ticker.msg || 'Invalid symbol! Try BTCUSDT, ETHUSDT, SOLUSDT, or PAXGUSDT.' });
      }

      const closes = klines.map(k => parseFloat(k));
      const currentPrice = closes[closes.length - 1];
      const sma20 = closes.reduce((a, b) => a + b, 0) / closes.length;
      const prevPrice = closes[closes.length - 2];
      const momentum = ((currentPrice - prevPrice) / prevPrice) * 100;

      let signal = 'WAIT';
      let reason = 'Market is consolidating. Waiting for a clear breakout.';

      if (currentPrice > sma20 * 1.002 && momentum > 0.08) {
        signal = 'STRONG BUY';
        reason = `Price ($${currentPrice}) broke above 20-SMA ($${sma20.toFixed(2)}) with upward momentum (+${momentum.toFixed(2)}%).`;
      } else if (currentPrice < sma20 * 0.998 && momentum < -0.08) {
        signal = 'STRONG SELL';
        reason = `Price ($${currentPrice}) dropped below 20-SMA ($${sma20.toFixed(2)}) with downward pressure (${momentum.toFixed(2)}%).`;
      }

      return res.status(200).json({
        success: true,
        symbol: cleanSymbol,
        price: currentPrice.toFixed(4),
        change24h: parseFloat(ticker.priceChangePercent).toFixed(2) + '%',
        sma20: sma20.toFixed(4),
        signal,
        reason
      });
    }

    if (action === 'trade') {
      if (exchange === 'custom' && customWebhookUrl) {
        const whRes = await fetch(customWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
          body: JSON.stringify({ symbol: cleanSymbol, action: side.toUpperCase(), quantity: quantity || '0.001', source: 'Satyexa-AI' })
        });
        if (!whRes.ok) return res.status(400).json({ error: 'Custom Trading App Webhook failed!' });
        return res.status(200).json({ success: true, message: `Auto-Trade (${side}) sent to Custom App!` });
      }

      if (!apiKey || !apiSecret || !quantity) {
        return res.status(400).json({ error: 'API Key, Secret Key, and Quantity are required!' });
      }

      const baseUrl = useTestnet ? 'https://binance.vision' : 'https://binance.com';
      const timestamp = Date.now();
      const queryString = `symbol=${cleanSymbol}&side=${side.toUpperCase()}&type=MARKET&quantity=${quantity}&timestamp=${timestamp}`;
      const signature = crypto.createHmac('sha256', apiSecret).update(queryString).digest('hex');

      const orderRes = await fetch(`${baseUrl}/api/v3/order?${queryString}&signature=${signature}`, {
        method: 'POST',
        headers: { 'X-MBX-APIKEY': apiKey, 'Content-Type': 'application/json' }
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) return res.status(400).json({ error: orderData.msg || 'Trade execution failed' });

      return res.status(200).json({ success: true, message: `Auto-${side.toUpperCase()} Executed on ${cleanSymbol}! (ID: ${orderData.orderId})` });
    }

    return res.status(400).json({ error: 'Invalid action.' });
  } catch (err) {
    return res.status(500).json({ error: 'Server Error: ' + err.message });
  }
}
