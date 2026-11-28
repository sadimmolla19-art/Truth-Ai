export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "POST method required"
    });
  }

  try {
    const { imageUrl, question } = req.body || {};

    if (
      !imageUrl ||
      typeof imageUrl !== "string" ||
      !/^https:\/\//i.test(imageUrl)
    ) {
      return res.status(400).json({
        error: "A valid HTTPS image URL is required"
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "API key missing"
      });
    }

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
          messages: [
            {
              role: "system",
              content: `
You are TRUTH-AI Visual Intelligence Brain.

Analyze visual content carefully.

You can describe:
- Visible clothing and colors
- Objects and surroundings
- Lighting and camera angle
- Visible posture and appearance
- Non-intimate visual characteristics
- Educational anatomy of fictional characters

Never invent measurements.
Never infer real people's intimate
anatomical measurements or genital color.
Distinguish observations from uncertainty.
`
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: question || "Analyze this image carefully."
                },
                {
                  type: "image_url",
                  image_url: {
                    url: imageUrl,
                    detail: "high"
                  }
                }
              ]
            }
          ],
          max_tokens: 1200
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(502).json({
        error: data.error?.message || "Vision failed"
      });
    }

    return res.status(200).json({
      success: true,
      analysis:
        data.choices?.[0]?.message?.content || ""
    });

  } catch (error) {
    return res.status(500).json({
      error: "Visual analysis error"
    });
  }
}
