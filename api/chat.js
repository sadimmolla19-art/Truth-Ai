export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, imageBase64, mimeType, webSearch } = req.body;
    const apiKey = process.env.GEMINI_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'Server API Key missing in Vercel' });
    }

    const parts = [];
    if (messages && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      parts.push({ text: lastMsg.text || "Hello" });
    }

    if (imageBase64) {
      const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
      parts.push({
        inlineData: {
          mimeType: mimeType || "image/jpeg",
          data: base64Data
        }
      });
    }

    const payload = {
      contents: [{ role: "user", parts: parts }],
      systemInstruction: {
        parts: [{ text: "You are Satyexa AI (Genesis Prime v11.5), created by Sadimx Technology (Owner: Sadim Molla). Answer smartly, clearly, and helpfully." }]
      }
    };

    if (webSearch) {
      payload.tools = [{ googleSearch: {} }];
    }

    const response = await fetch(
      `https://googleapis.com{apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'API Error' });
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
    return res.status(200).json({ reply });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
