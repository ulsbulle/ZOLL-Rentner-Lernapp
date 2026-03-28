import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Pfade für ES-Module konfigurieren
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// WICHTIG: Railway gibt den Port vor, 0.0.0.0 ist für externe Erreichbarkeit nötig
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Erlaubt große PDF-Uploads
app.use(express.static('public')); // Serviert index.html aus dem public-Ordner

// Der API-Endpunkt für das Quiz
app.post('/api/quiz', async (req, res) => {
    try {
        const { pdfBase64, questionCount } = req.json || req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            throw new Error("GEMINI_API_KEY ist in den Railway-Variablen nicht gesetzt!");
        }

        // Die Google Gemini API URL (v1beta für PDF-Support)
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { 
                            inlineData: { 
                                mimeType: "application/pdf", 
                                data: pdfBase64 
                            } 
                        },
                        { 
                            text: `Erstelle exakt ${questionCount} Multiple-Choice-Fragen auf Deutsch basierend auf diesem PDF. 
                            Antworte NUR mit einem validen JSON-Array in diesem Format: 
                            [{"question":"Frage","options":["A","B","C","D"],"answer":0}]` 
                        }
                    ]
                }],
                // Sicherheitsfilter auf "BLOCK_NONE", um regionale Sperren (europe-west4) zu minimieren
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                ],
                generationConfig: { 
                    response_mime_type: "application/json" 
                }
            })
        });

        const data = await response.json();

        // Fehlerbehandlung für die Google API Antwort
        if (!data.candidates || data.candidates.length === 0) {
            console.error("Google API Fehler Details:", JSON.stringify(data));
            return res.status(500).json({ 
                error: "Keine Antwort von Gemini erhalten. Möglicherweise wurde das PDF blockiert.",
                debug: data.promptFeedback || "Kein Feedback verfügbar"
            });
        }

        const resultText = data.candidates[0].content.parts[0].text;
        
        // JSON säubern (entfernt eventuelle Markdown-Code-Blöcke)
        const cleanJson = resultText.replace(/```json|```/g, "").trim();
        
        res.status(200).json(JSON.parse(cleanJson));

    } catch (error
