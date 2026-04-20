import express from 'express';
import cors from 'cors';

const app = express();

// Erlaubt Anfragen von deinem Frontend
app.use(cors());

// Erhöht das Limit für große PDF-Dateien
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Hilfs-Route, um den Server bei Render "wachzuküssen"
app.get('/api/ping', (req, res) => res.status(200).send('Server ist bereit!'));

app.post('/api/quiz', async (req, res) => {
    console.log("--- NEUE ANFRAGE ---");
    req.setTimeout(150000); // Erlaubt 2.5 Minuten Bearbeitungszeit

    try {
        // custom_prompt muss hier aus req.body geholt werden!
        const { pdfBase64, questionCount, custom_prompt } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) return res.status(500).json({ error: "API-Key fehlt!" });
        if (!pdfBase64) return res.status(400).json({ error: "Keine PDF-Daten!" });

        // Base64-Header entfernen, falls vorhanden
        const sanitizedPdf = pdfBase64.includes(",") ? pdfBase64.split(",")[1] : pdfBase64;

        // Wir nutzen die stabile Version ohne "-latest", um 503-Fehler zu minimieren
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const payload = {
            contents: [{
                parts: [
                    { inlineData: { mimeType: "application/pdf", data: sanitizedPdf } },
                    { 
                        text: `Erstelle exakt ${questionCount || 3} Multiple-Choice-Fragen auf Deutsch basierend auf diesem PDF. ${custom_prompt || ""} Antwort NUR als JSON-Array: [{"question":"Frage","options":["A","B","C","D"],"answer":0}]` 
                    }
                ]
            }],
            generationConfig: {
                response_mime_type: "application/json"
            }
        };

        // API-Anfrage mit automatischem Retry bei Fehler 503 (Überlastung)
        let response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (response.status === 503) {
            console.log("Google ist überlastet, starte zweiten Versuch in 3 Sekunden...");
            await new Promise(resolve => setTimeout(resolve, 3000));
            response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
        }

        const data = await response.json();

        if (!response.ok) {
            console.error("Google API Fehler:", data);
            return res.status(response.status).json({ error: data.error?.message || "API Fehler" });
        }

        const resultText = data.candidates[0].content.parts[0].text;
        
        // Sicherer JSON-Parse
        try {
            const quizData = JSON.parse(resultText);
            res.status(200).json(quizData);
            console.log("Erfolgreich gesendet.");
        } catch (parseError) {
            console.error("Format-Fehler der KI:", resultText);
            res.status(500).json({ error: "Ungültiges JSON-Format von KI erhalten." });
        }

    } catch (error) {
        console.error("Backend Fehler:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// Port für Render Web Services
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`>>> Server läuft auf Port ${PORT} <<<`);
});

// Verhindert vorzeitigen Verbindungsabbruch durch Node
server.timeout = 150000;
