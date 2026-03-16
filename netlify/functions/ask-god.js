exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Method Not Allowed" }),
      };
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "GEMINI_API_KEY not configured in Netlify" }),
      };
    }

    const body = JSON.parse(event.body || "{}");
    const userPrompt = body.prompt || "";

    if (!userPrompt.trim()) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing prompt" }),
      };
    }

    const trimmedPrompt = userPrompt.slice(0, 9000);

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: trimmedPrompt }]
            }
          ],
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 700,
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
        })
      }
    );

    const data = await geminiResponse.json();

    if (!geminiResponse.ok) {
      return {
        statusCode: geminiResponse.status,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: data?.error?.message || "Gemini request failed"
        })
      };
    }

    const rawText =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";

    if (!rawText) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Gemini returned empty text" })
      };
    }

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (e) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Something went wrong preparing your word. Please try again."
        })
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed)
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: err.message || "Server error"
      })
    };
  }
};
