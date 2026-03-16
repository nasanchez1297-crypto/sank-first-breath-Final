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
    let prompt = body.prompt;

    if (!prompt) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing prompt" }),
      };
    }

    // prevent very long prompts from breaking structured output
    if (prompt.length > 5000) {
      prompt = prompt.slice(0, 5000);
    }

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 900,
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
          error: "Your message was too long for a clean response. Try a slightly shorter version."
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
