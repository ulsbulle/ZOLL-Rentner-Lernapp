export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { pdfBase64, questionCount } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        // Wir nutzen die absolute Basis-URL für die Beta
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
                        { text: `Erstelle ${questionCount} Multiple-Choice-Fragen auf Deutsch basierend auf diesem PDF. Antwort NUR als JSON-Array: [{"question":"Frage","options":["A","B","C","D"],"answer":0}]` }
                    ]
                }],
                generationConfig: { 
                    response_mime_type: "application/json" 
                }
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            return res.status(response.status).json({ 
                error: data.error?.message || "Google API Fehler",
                region: "Check Logs" 
            });
        }

        const resultText = data.candidates[0].content.parts[0].text.replace(/```json|```/g, "").trim();
        res.status(200).json(JSON.parse(resultText));

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
