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

  const XI_KEY = process.env.ELEVENLABS_API_KEY;
  if (!XI_KEY) {
    return { statusCode: 500, body: "ElevenLabs API key not configured" };
  }

  // Strip markdown so she never says "asterisk" or "hashtag"
  const cleanText = body.text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/#+\s/g, "")
    .replace(/`/g, "")
    .trim();

  // Rachel — premade female voice, available on all tiers including free
  const VOICE_ID = "XB0fDUnXU5powFXDhCwa"; // Charlotte — better for French

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": XI_KEY,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg",
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: "eleven_multilingual_v2",
          language_code: "fr",
          voice_settings: {
            stability: 0.35,
            similarity_boost: 0.80,
            style: 0.40,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      return { statusCode: 500, body: JSON.stringify({ error: err }) };
    }

    // ElevenLabs returns MP3 directly — no conversion needed
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio: base64, mimeType: "audio/mpeg" }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
