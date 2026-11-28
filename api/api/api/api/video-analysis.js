
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "POST method required"
    });
  }

  try {
    const { frames, question } = req.body || {};

    if (!Array.isArray(frames) || frames.length === 0) {
      return res.status(400).json({
        error: "Video frames are required"
      });
    }

    if (frames.length > 8) {
      return res.status(400).json({
        error: "Maximum 8 frames allowed"
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "API key missing"
      });
    }

    const content = [
      {
        type: "text",
        text: `
You are TRUTH-AI Video Intelligence Brain.

Analyze the supplied video frames in timestamp order.

For each frame:
1. Describe visible objects and people.
2. Describe clothing and visible colors.
3. Explain posture and scene composition.
4. Analyze lighting and camera angle.
5. Identify changes between frames.

Then provide:
- Overall video summary
- Scene-by-scene analysis
- Important visual details
- Uncertainties and limitations

Only report observable information.
Never invent facts or intimate measurements
of real people.
Treat fictional adult anatomy educationally.

User question: ${question || "Analyze this video."}
`
      }
    ];

    for (const frame of frames) {
      if (
        !frame ||
        typeof frame.image !== "string" ||
        !/^data:image\/(jpeg|png|webp);base64,/i.test(frame.image)
      ) {
        return res.status(400).json({
          error: "Invalid image frame"
        });
      }

      if (frame.image.length > 2000000) {
        return res.status(413).json({
          error: "Frame is too large"
        });
      }

      content.push({
        type: "text",
        text: `Video timestamp: ${String(frame.timestamp || "Unknown")}`
      });

      content.push({
        type: "image_url",
        image_url: {
          url: frame.image,
          detail: "high"
        }
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
              content: "You are a careful video analysis assistant."
            },
            {
              role: "user",
              content
            }
          ],
          max_tokens: 2500,
          temperature: 0.2
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(502).json({
        error: data.error?.message || "Video analysis failed"
      });
    }

    return res.status(200).json({
      success: true,
      analysis:
        data.choices?.[0]?.message?.content || "",
      framesAnalyzed: frames.length
    });

  } catch (error) {
    return res.status(500).json({
      error: "Video processing failed"
    });
  }
              }
