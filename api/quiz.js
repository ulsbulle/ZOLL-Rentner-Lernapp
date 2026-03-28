// Region Fix US-East-1
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method not allowed');

    try {
        const { pdfBase64, questionCount } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) throw new Error("API Key fehlt!");

        // FIX: In v1beta über REST muss das Modell oft so angesprochen werden:
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
                        { text: `Erstelle exakt ${questionCount} Multiple-Choice-Fragen auf Deutsch basierend auf diesem PDF. 
                                 Antwort NUR als JSON-Array: [{"question":"Frage","options":["A","B","C","D"],"answer":0}]` }
                    ]
                }],
                generationConfig: {
                    // WICHTIG: Unterstriche für die REST-API (v1beta)
                    response_mime_type: "application/json"
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ 
                error: data.error?.message || "Google API Fehler",
                details: data.error 
            });
        }

        const resultText = data.candidates[0].content.parts[0].text;
        
        // Sicherheitshalber parsen, falls Gemini Markdown-Backticks nutzt
        const cleanJson = resultText.replace(/```json|```/g, "").trim();
        res.status(200).json(JSON.parse(cleanJson));

    } catch (error) {
        console.error("Backend Error:", error);
        res.status(500).json({ error: error.message });
    }
}
