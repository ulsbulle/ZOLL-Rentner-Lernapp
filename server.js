import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// --- LISTE DER VERFÜGBAREN MODELLE (DER DEBUGGER) ---
async function debugModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();
        console.log("📋 VERFÜGBARE MODELLE FÜR DIESEN KEY:");
        if (data.models) {
            data.models.forEach(m => console.log(`- ${m.name}`));
        } else {
            console.log("Keine Modelle gefunden:", JSON.stringify(data));
        }
    } catch (err) {
        console.error("Debug-Check fehlgeschlagen:", err.message);
    }
}

app.post('/api/quiz', async (req, res) => {
    try {
        let { pdfBase64, questionCount } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (pdfBase64 && pdfBase64.includes(',')) {
            pdfBase64 = pdfBase64.split(',')[1];
        }

        // Wir nutzen hier den VOLLSTÄNDIGEN Pfad, den Google für Server-IPs bevorzugt
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
                        { text: `Erstelle ${questionCount} MC-Fragen auf Deutsch. Format: [{"question":"Frage","options":["A","B","C","D"],"answer":0}]` }
                    ]
                }],
                generationConfig: { response_mime_type: "application/json" }
            })
        });

        const data = await response.json();
        if (!data.candidates) {
            return res.status(500).json({ error: "Google Block", details: data });
        }

        const resultText = data.candidates[0].content.parts[0].text;
        res.status(200).json(JSON.parse(resultText.replace(/```json|```/g, "").trim()));

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 Server gestartet auf Port ${PORT}`);
    await debugModels(); // Zeigt uns in den Logs, was der Key wirklich darf!
});
