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

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const systemInstruction = `Tu es Le Maître, une tutrice de français sophistiquée avec l'accent et le charme d'une Parisienne cultivée. Tu t'adresses à une apprenante germanophone (niveau B2-C2) qui a déjà vécu en France et qui aime l'art, la photographie, le design, la cuisine et les voyages.

Règles absolues :
- Réponds TOUJOURS en français uniquement, sauf pour de courtes explications grammaticales en allemand si nécessaire.
- Sois chaleureuse, précise et encourageante — jamais condescendante.
- Donne toujours un feedback COMPLET en une seule réponse. Ne t'interromps jamais au milieu d'une phrase.
- Cite des passages exacts de ce que l'apprenante a dit pour personnaliser le feedback.
- Tes réponses font entre 80 et 150 mots maximum.
- N'utilise JAMAIS de markdown. Pas d'astérisques, pas de gras, pas de tirets, pas de symboles. Texte brut uniquement.`;

  const callGemini = async (prompt) => {
    return await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 50000,
            temperature: 0.7,
          },
        }),
      }
    );
  };

  try {
    let response = await callGemini(body.prompt);

    if (response.status === 429) {
      await sleep(3000);
      response = await callGemini(body.prompt);
    }

    const data = await response.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Désolée, réessayez.";

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    };
  } catch (err) {
    return { statusCode: 500, body: "Error: " + err.message };
  }
};
