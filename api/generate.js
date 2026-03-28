import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method not allowed');

    try {
        const { pdfBase64, questionCount } = req.body;
        
        // Initialisierung des SDKs
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        
        // WICHTIG: Wir nutzen gemini-1.5-flash. 
        // Das SDK kümmert sich intern um die richtige URL (v1beta), 
        // solange die Version des SDKs aktuell ist.
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
        });

        const prompt = `Analysiere das PDF und erstelle exakt ${questionCount} MC-Fragen auf Deutsch. 
        Antworte NUR als JSON-Array: [{"question":"Text","options":["A","B","C","D"],"answer":0}]. Kein Markdown!`;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType: "application/pdf",
                    data: pdfBase64
                }
            }
        ]);

        const response = await result.response;
        const text = response.text();
        
        // Bereinigung falls die KI doch Markdown-Code-Blocks mitschickt
        const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
        
        res.status(200).json(JSON.parse(cleanJson));
    } catch (error) {
        console.error(error);
        // Detaillierte Fehlermeldung für die Vercel Logs
        res.status(500).json({ error: "Fehler bei der Quiz-Generierung: " + error.message });
    }
}
