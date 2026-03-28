export const config = {
  runtime: 'edge',
};

export default async function (req) {
  // 1. Nur POST erlauben
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { pdfBase64, questionCount } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API Key fehlt!" }), { status: 500 });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
            { text: `Erstelle ${questionCount} MC-Fragen auf Deutsch. Antwort NUR als JSON-Array: [{"question":"Frage","options":["A","B","C","D"],"answer":0}]` }
          ]
        }],
        generationConfig: { response_mime_type: "application/json" }
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      return new Response(JSON.stringify({ error: data.error?.message || "Google Fehler" }), { status: response.status });
    }

    const resultText = data.candidates[0].content.parts[0].text;
    return new Response(resultText, {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
