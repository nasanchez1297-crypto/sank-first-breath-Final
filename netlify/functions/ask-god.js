exports.handler = async (event) => {
  const jsonResponse = (statusCode, bodyObj) => ({
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bodyObj),
  });

  const fallbackResponse = {
    verseRef: "Matthew 11:28",
    verseSearch: "Matthew/11/28",
    verseText: "Come to me, all who labor and are heavy laden, and I will give you rest.",
    reflection:
      "You do not have to carry everything by yourself right now. Bring what is heavy, confusing, or disappointing to God, and let this be a moment of rest instead of pressure.",
    prayer:
      "Lord, you see everything I am carrying today. Help me place it in your hands and trust that you are near even when things feel uncertain. Amen.",
    closingLine:
      "Bring it to Him, and let your heart be still for a moment.",
  };

  async function callGemini(apiKey, heartText) {
    const safeHeart = String(heartText || "").trim().slice(0, 2500);

    const modelPrompt = `
You are a gentle, biblically grounded Christian spiritual companion.

A person is sharing what is on their heart this morning.
Respond with compassion, warmth, and biblical truth.
Do not sound robotic, preachy, dramatic, or overly long.

User message:
${JSON.stringify(safeHeart)}

Return ONLY one valid JSON object with exactly these keys:
{
  "verseRef": "string",
  "verseSearch": "string",
  "verseText": "string",
  "reflection": "string",
  "prayer": "string",
  "closingLine": "string"
}

Requirements:
- Choose one real Bible verse that clearly fits what they shared.
- verseRef example: "Psalm 34:18"
- verseSearch example: "Psalm/34/18" or "1+Peter/5/7"
- verseText must be plain text only
- reflection must be warm, personal, biblical, and maximum 2 sentences
- prayer must be short, personal, and end with "Amen."
- closingLine must be one short comforting sentence
- no markdown
- no code fences
- no explanation
- output JSON only
`.trim();

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: modelPrompt }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 500,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                verseRef: { type: "STRING" },
                verseSearch: { type: "STRING" },
                verseText: { type: "STRING" },
                reflection: { type: "STRING" },
                prayer: { type: "STRING" },
                closingLine: { type: "STRING" }
              },
              required: [
                "verseRef",
                "verseSearch",
                "verseText",
                "reflection",
                "prayer",
                "closingLine"
              ]
            }
          }
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error?.message || "Gemini request failed");
    }

    const rawText =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";

    if (!rawText) {
      throw new Error("Gemini returned empty text");
    }

    const parsed = JSON.parse(rawText);

    if (
      !parsed.verseRef ||
      !parsed.verseSearch ||
      !parsed.reflection ||
      !parsed.prayer ||
      !parsed.closingLine
    ) {
      throw new Error("Gemini returned incomplete JSON");
    }

    return parsed;
  }

  try {
    if (event.httpMethod !== "POST") {
      return jsonResponse(405, { error: "Method Not Allowed" });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      return jsonResponse(500, { error: "GEMINI_API_KEY not configured in Netlify" });
    }

    const body = JSON.parse(event.body || "{}");

    // Accept either { heart: "..." } or the old { prompt: "..." }
    let heart = "";
    if (typeof body.heart === "string" && body.heart.trim()) {
      heart = body.heart.trim();
    } else if (typeof body.prompt === "string" && body.prompt.trim()) {
      heart = body.prompt.trim();
    }

    if (!heart) {
      return jsonResponse(400, { error: "Missing heart message" });
    }

    try {
      const parsed = await callGemini(apiKey, heart);
      return jsonResponse(200, parsed);
    } catch (firstErr) {
      try {
        const parsedRetry = await callGemini(apiKey, heart);
        return jsonResponse(200, parsedRetry);
      } catch (secondErr) {
        return jsonResponse(200, fallbackResponse);
      }
    }
  } catch (err) {
    return jsonResponse(500, {
      error: err.message || "Server error",
    });
  }
};
