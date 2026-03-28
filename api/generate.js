export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method not allowed');

    try {
        const { pdfBase64, questionCount } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        // VERSUCH 1: Der absolut stabilste Endpunkt (v1)
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
                        { text: `Erstelle exakt ${questionCount} MC-Fragen zum PDF auf Deutsch. Antwort NUR als JSON-Array: [{"question":"T","options":["A","B","C","D"],"answer":0}]` }
                    ]
                }]
            })
        });

        const data = await response.json();

        // Falls v1 nicht geht, werfen wir den Fehler aus und sehen im Log nach
        if (!response.ok) {
            console.error("GOOGLE_RESPONSE_ERROR:", JSON.stringify(data));
            throw new Error(data.error?.message || "Modell-Zugriff verweigert.");
        }

        let resultText = data.candidates[0].content.parts[0].text;
        // Säuberung falls doch Markdown kommt
        resultText = resultText.replace(/```json/g, "").replace(/```/g, "").trim();
        
        res.status(200).json(JSON.parse(resultText));

    } catch (error) {
        console.error("BACKEND_CRASH:", error.message);
        res.status(500).json({ error: "Kritischer Fehler: " + error.message });
    }
}
