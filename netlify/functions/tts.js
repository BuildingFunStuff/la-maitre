exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  if (body.password !== process.env.APP_PASSWORD) {
    return { statusCode: 401, body: "Unauthorized" };
  }

  const GEMINI_KEY = process.env.GEMINI_API_KEY;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: body.text }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: "Aoede"
                }
              }
            }
          }
        }),
      }
    );

    const data = await response.json();
    const audioB64 = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!audioB64) {
      return { statusCode: 500, body: "No audio returned" };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio: audioB64 }),
    };
  } catch (err) {
    return { statusCode: 500, body: "Error: " + err.message };
  }
};
