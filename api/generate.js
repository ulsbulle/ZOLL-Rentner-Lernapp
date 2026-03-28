export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method not allowed');

    try {
        const { pdfBase64, questionCount } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        // Wir nutzen den absolut sichersten Endpunkt
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: `Erstelle ${questionCount} MC-Fragen zum PDF auf Deutsch. Antwort NUR als JSON-Array: [{"question":"Text","options":["A","B","C","D"],"answer":0}]` },
                        { inlineData: { mimeType: "application/pdf", data: pdfBase64 } }
                    ]
                }],
                generationConfig: { 
                    responseMimeType: "application/json",
                    temperature: 0.1 // Niedrige Temperatur = stabilere Antworten
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            // Das hier ist der wichtigste Teil für dein Vercel-Log!
            console.error("GOOGLE_FULL_ERROR:", JSON.stringify(data));
            throw new Error(data.error?.message || "Google API verweigert den Dienst.");
        }

        const resultText = data.candidates[0].content.parts[0].text;
        res.status(200).json(JSON.parse(resultText));

    } catch (error) {
        console.error("BACKEND_ERROR:", error.message);
        res.status(500).json({ error: error.message });
    }
}
