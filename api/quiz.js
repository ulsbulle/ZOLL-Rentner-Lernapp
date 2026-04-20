import express from 'express';
import cors from 'cors';

const app = express();

// CORS aktivieren, damit dein Frontend (z.B. auf Vercel oder Netlify) zugreifen darf
app.use(cors());

// WICHTIG: Erhöht das Limit für den Body, da PDF-Base64-Daten sehr groß sind
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.post('/api/quiz', async (req, res) => {
    // Erhöht den internen Node-Timeout für diese spezifische Route auf 2 Minuten
    req.setTimeout(120000);

    try {
        const { pdfBase64, questionCount, custom_prompt } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: "API-Key fehlt in den Render-Umgebungsvariablen!" });
        }

        if (!pdfBase64) {
            return res.status(400).json({ error: "Keine PDF-Daten empfangen." });
        }

        // Base64-String säubern (Präfix entfernen, falls vorhanden)
        const sanitizedPdf = pdfBase64.includes(",") ? pdfBase64.split(",")[1] : pdfBase64;

        // Gemini API URL (Flash-Modell ist am schnellsten für Quiz-Aufgaben)
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

        console.log(`Starte Quiz-Generierung für ${questionCount} Fragen...`);

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            { inlineData: { mimeType: "application/pdf", data: sanitizedPdf } },
                            {
                                text: `Erstelle exakt ${questionCount || 3} Multiple-Choice-Fragen auf Deutsch basierend auf diesem PDF. ${custom_prompt || ""} Antwort NUR als valides JSON-Array im Format: [{"question":"Frage","options":["A","B","C","D"],"answer":0}]`
                            },
                        ],
                    },
                ],
                generationConfig: {
                    // Erzwingt die Ausgabe von reinem JSON
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

        // Das Ergebnis von Gemini parsen
        const resultText = data.candidates[0].content.parts[0].text;
        const quizData = JSON.parse(resultText);

        console.log("Erfolgreich generiert.");
        res.status(200).json(quizData);

    } catch (error) {
        console.error("Backend Error:", error.message);
        res.status(500).json({ error: "Server-Fehler: " + error.message });
    }
});

// Port-Zuweisung für Render
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
});

// Verhindert, dass Node die Verbindung bei langen KI-Antworten vorzeitig schließt
server.timeout = 120000;
