import express from 'express';
import cors from 'cors';

const app = express();

// Erlaubt Cross-Origin-Requests vom Frontend
app.use(cors());

// WICHTIG: Erhöht das Limit für den JSON-Body, da PDFs als Base64 sehr groß sind.
app.use(express.json({ limit: '20mb' }));

app.post('/api/quiz', async (req, res) => {
    console.log("Anfrage erhalten...");
    
    try {
        const { pdfBase64, questionCount, custom_prompt } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: "API-Key fehlt in den Umgebungsvariablen!" });
        }

        if (!pdfBase64) {
            return res.status(400).json({ error: "Keine PDF-Daten empfangen." });
        }

        // Säubert den Base64-String (entfernt den Header "data:application/pdf;base64,")
        const cleanBase64 = pdfBase64.includes(",") ? pdfBase64.split(",")[1] : pdfBase64;

        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

        console.log("Sende Anfrage an Gemini API...");

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            { 
                                inlineData: { 
                                    mimeType: "application/pdf", 
                                    data: cleanBase64 
                                } 
                            },
                            {
                                text: `Erstelle exakt ${questionCount || 3} Multiple-Choice-Fragen auf Deutsch basierend auf diesem PDF. ${custom_prompt || ""} Antwort MUSS ein valides JSON-Array sein: [{"question":"Frage","options":["A","B","C","D"],"answer":0}]`
                            },
                        ],
                    },
                ],
                generationConfig: {
                    // Erzwingt, dass das Modell nur reines JSON ohne Markdown-Code-Blocks ausgibt
                    response_mime_type: "application/json"
                },
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Google API Fehler:", data);
            return res.status(response.status).json({
                error: data.error?.message || "Google API Fehler",
            });
        }

        const resultText = data.candidates[0].content.parts[0].text;
        
        // Da wir response_mime_type nutzen, ist resultText bereits ein JSON-String
        res.status(200).json(JSON.parse(resultText));
        console.log("Quiz erfolgreich generiert!");

    } catch (error) {
        console.error("Fehler im Backend:", error.message);
        res.status(500).json({ error: "Serverfehler: " + error.message });
    }
});

// Port für Render (nutzt Umgebungsvariable oder 3000 als Fallback)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
});
