import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { pdfBase64, questionCount } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: "API Key fehlt in den Umgebungsvariablen." });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `Analysiere das PDF und erstelle exakt ${questionCount} MC-Fragen auf Deutsch. 
        Antworte NUR als JSON-Array im Format: [{"question":"Text","options":["A","B","C","D"],"answer":0}]. 
        Kein Markdown, kein Text davor oder danach!`;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType: "application/pdf",
                    data: pdfBase64 // Erwartet reinen Base64-String ohne Header
                }
            }
        ]);

        const response = await result.response;
        let text = response.text().replace(/```json/g, "").replace(/```/g, "").trim();
        
        res.status(200).json(JSON.parse(text));
    } catch (error) {
        console.error("Gemini Error:", error);
        res.status(500).json({ error: "Fehler bei der Quiz-Generierung: " + error.message });
    }
}
