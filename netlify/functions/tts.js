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
  if (!GEMINI_KEY) {
    return { statusCode: 500, body: "API key not configured" };
  }

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
                prebuiltVoiceConfig: { voiceName: "Aoede" },
              },
            },
          },
        }),
      }
    );

    const data = await response.json();
    const audioB64 = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!audioB64) {
      return { statusCode: 500, body: JSON.stringify({ error: "No audio returned", raw: JSON.stringify(data).slice(0, 300) }) };
    }

    // Gemini returns raw PCM (L16, 24kHz, mono) — wrap it in a WAV header
    const pcm = Buffer.from(audioB64, "base64");
    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = pcm.length;

    const wav = Buffer.alloc(44 + dataSize);
    wav.write("RIFF", 0);                          wav.writeUInt32LE(36 + dataSize, 4);
    wav.write("WAVE", 8);                          wav.write("fmt ", 12);
    wav.writeUInt32LE(16, 16);                     wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(numChannels, 22);            wav.writeUInt32LE(sampleRate, 24);
    wav.writeUInt32LE(byteRate, 28);               wav.writeUInt16LE(blockAlign, 32);
    wav.writeUInt16LE(bitsPerSample, 34);          wav.write("data", 36);
    wav.writeUInt32LE(dataSize, 40);               pcm.copy(wav, 44);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio: wav.toString("base64") }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
