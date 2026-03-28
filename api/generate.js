export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method not allowed');

    try {
        const { pdfBase64, questionCount } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        // URL für Gemini 1.5 Pro
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`;

        const payload = {
            contents: [{
                parts: [
                    { text: `Analysiere das PDF und erstelle exakt ${questionCount} Multiple-Choice-Fragen auf Deutsch. 
                             Antworte ausschließlich in validem JSON als Array.
                             Format: [{"question":"Text","options":["A","B","C","D"],"answer":0}]
                             Wichtig: Gib nur das JSON-Array zurück, keinen Text davor oder danach.` 
                    },
                    { inlineData: { mimeType: "application/pdf", data: pdfBase64 } }
                ]
            }],
            generationConfig: {
                // Diese Einstellung zwingt das Modell, direkt JSON zu liefern (verfügbar in Pro)
                responseMimeType: "application/json",
                temperature: 0.7,
                topP: 0.95,
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Google API Error:", data);
            throw new Error(data.error?.message || "Fehler beim Aufruf von Gemini Pro");
        }

        // Gemini Pro liefert bei responseMimeType direkt sauberes JSON im Text-Feld
        const rawText = data.candidates[0].content.parts[0].text;
        
        res.status(200).json(JSON.parse(rawText));

    } catch (error) {
        console.error("Backend Error:", error);
        res.status(500).json({ error: "Fehler (Gemini Pro): " + error.message });
    }
}
