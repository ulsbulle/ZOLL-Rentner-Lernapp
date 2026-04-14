export default async function handler(req, res) {
    // In Vercel Node-Functions ist req.method immer verfügbar
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { pdfBase64, questionCount, customPrompt } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        // Validierung: Nur Text hinzufügen, wenn customPrompt existiert und nicht leer ist
        const extraInstructions = (customPrompt && customPrompt.trim().length > 0) 
            ? ` Beachte unbedingt diese zusätzliche Benutzeranweisung: "${customPrompt.trim()}".` 
            : "";

        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
                        { 
                            text: `Erstelle exakt ${questionCount} Multiple-Choice-Fragen auf Deutsch basierend auf diesem PDF.${extraInstructions} Antwort NUR als JSON-Array: [{"question":"Frage","options":["A","B","C","D"],"answer":0}]` 
                        }
                    ]
                }],
                generationConfig: { 
                    responseMimeType: "application/json"
                }
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            return res.status(response.status).json({ 
                error: data.error?.message || "Google API Fehler",
                status: response.status 
            });
        }

        const resultText = data.candidates[0].content.parts[0].text;
        
        // JSON säubern und senden
        const cleanJson = resultText.replace(/```json|```/g, "").trim();
        res.status(200).json(JSON.parse(cleanJson));

    } catch (error) {
        console.error("Fehler im Backend:", error.message);
        res.status(500).json({ error: error.message });
    }
}
