import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true })); // Für Support von URL-encoded Payloads
app.use(express.static("public"));

app.use(express.static(path.join(__dirname, "public")));

// 1. Ordner als statisch markieren
// Dies ermöglicht den Zugriff auf Dateien via http://.../templates/name.csv
// Es wird sowohl im 'downloads' als auch im 'templates' Ordner gesucht
app.use("/downloads", express.static(path.join(__dirname, "downloads")));
app.use("/templates", express.static(path.join(__dirname, "templates")));
app.use("/tools", express.static(path.join(__dirname, "tools")));

/** --- QUIZ ENDPUNKT MIT GEMINI 2.5 FLASH (FOKUS: EINWORT-ANTWORTEN) --- **/
app.post("/api/quiz", async (req, res) => {
	// Dem Server erlauben, sich bis zu 2.5 Min Zeit zu nehmen
	req.setTimeout(150000);
	console.log("--- Quiz-Anfrage gestartet (Lücke/Freitext auf ein Wort begrenzt) ---");

	try {
		let { pdfBase64, questionCount, customprompt } = req.body;
		const apiKey = process.env.GEMINI_API_KEY;

		if (!apiKey) return res.status(500).json({ error: "Server-Konfigurationsfehler: API-Key fehlt." });
		if (!pdfBase64) return res.status(400).json({ error: "Bitte lade zuerst ein PDF hoch." });

		if (pdfBase64 && pdfBase64.includes(",")) {
			pdfBase64 = pdfBase64.split(",")[1];
		}

		const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

		console.log("Anfrage an Gemini 2.5 Flash wird gesendet...");

		const response = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				contents: [
					{
						parts: [
							{ inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
							{
								text: `Du bist ein präziser Quiz-Generator. Deine Aufgabe ist es, aus dem bereitgestellten PDF-Dokument eine ausgewogene Mischung aus drei Fragentypen auf Deutsch zu generieren:
1. "multiple" (Multiple Choice - EINE oder MEHRERE richtige Antworten möglich)
2. "cloze" (Lückentext - Die Lösung MUSS aus exakt EINEM WORT bestehen)
3. "free" (Freitext / Offene Frage - Die Lösung MUSS aus exakt EINEM WORT bestehen)

Erstelle insgesamt exakt ${questionCount || 3} Fragen. ${customprompt || ""}

Du MUSST als Antwort AUSSCHLIESSLICH ein valides JSON-Array zurückgeben. Keine zusätzlichen Erklärungen, Einleitungen oder Formatierungen (wie \`\`\`json ... \`\`\`), kein Text davor oder danach!

Die Struktur JEDES Objekts im Array MUSS exakt folgenden Regeln je nach Typ entsprechen:

Für "multiple" (Multiple Choice):
- "type": "multiple"
- "question": "Die Frage..."
- "options": ["Option A", "Option B", "Option C", "Option D"] (Immer exakt 4 Optionen!)
- "answer": Ein Array von Integers [0, 2], das die Indizes ALLER richtigen Antworten in der "options"-Liste enthält (0-basiert). Wenn z. B. 2 Antworten richtig sind, enthält das Array 2 Zahlen.

Für "cloze" (Lückentext):
- "type": "cloze"
- "question": "Der Text der Frage, bei dem das gesuchte Wort zwingend in eckigen Klammern steht, z.B.: Die Hauptstadt von Deutschland heißt [Berlin]."
- "correct_text": "Das exakte Lösungswort aus der Klammer. Dieses MUSS zwingend ein einzelnes Wort sein (z.B. Berlin)."
- "options": []
- "answer": []

Für "free" (Freitext):
- "type": "free"
- "question": "Eine offene Frage, die so formuliert ist, dass sie mit exakt EINEM EINZIGEN WORT beantwortet werden kann (z.B. 'Wie heißt das chemische Zeichen für Sauerstoff?')."
- "correct_text": "Das gesuchte, einzelne Kernwort als Lösung (z.B. O)."
- "options": []
- "answer": []

WICHTIG: Achte bei 'cloze' und 'free' strengstens darauf, dass niemals Sätze oder Satzteile als Lösung gefordert werden, sondern immer nur ein prägnantes Einzelwort!`,
							},
						],
					},
				],
				generationConfig: {
					response_mime_type: "application/json",
					temperature: 0.6,
				},
			}),
		});

		// --- HIER DIE ERWEITERTE FEHLERBEHANDLUNG ---
		if (response.status === 429) {
			console.error("Quota-Limit überschritten.");
			return res.status(429).json({
				error: "Das tägliche Limit für kostenlose Quiz-Erstellungen ist erreicht. Bitte versuche es morgen wieder oder kontaktiere den Admin.",
			});
		}

		if (!response.ok) {
			const errData = await response.json().catch(() => ({}));
			console.error("Google API Fehler:", response.status, errData);
			return res.status(response.status).json({
				error: "Gemini (KI) ist gerade überlastet oder antwortet nicht. Bitte warte kurz und klicke dann erneut auf Generieren.",
			});
		}

		const data = await response.json();

		if (!data.candidates || data.candidates.length === 0) {
			console.error("Fehler von Google:", JSON.stringify(data));
			return res.status(500).json({ error: "Keine Daten von Gemini erhalten.", details: data });
		}

		let resultText = data.candidates[0].content.parts[0].text;
		resultText = resultText.replace(/```json|```/g, "").trim();

		res.status(200).json(JSON.parse(resultText));
	} catch (error) {
		console.error("Server-Fehler:", error.message);
		res.status(500).json({ error: "Ein unerwarteter Fehler ist aufgetreten: " + error.message });
	}
});

// Hilfsfunktion (Vereinheitlicht)
const getFilesFromDir = (folder) => {
	const dirPath = path.join(__dirname, folder);
	if (!fs.existsSync(dirPath)) {
		fs.mkdirSync(dirPath); // Erstellt den Ordner, falls er fehlt
		return [];
	}
	return fs.readdirSync(dirPath).filter((file) => {
		const filePath = path.join(dirPath, file);
		return fs.statSync(filePath).isFile() && !file.startsWith(".");
	});
};

/** --- DATEI-SYSTEM ENDPUNKTE --- **/

// Endpunkt für den 'templates' Ordner (Lernmaterialien)
app.get("/api/files/templates", (req, res) => {
	try {
		const files = getFilesFromDir("templates");
		res.json(files);
	} catch (err) {
		res.status(500).json({ error: "Fehler beim Lesen der Lernmaterialien" });
	}
});

// Endpunkt für den 'downloads' Ordner (Sonstige Downloads)
app.get("/api/files/downloads", (req, res) => {
	try {
		const files = getFilesFromDir("downloads");
		res.json(files);
	} catch (err) {
		res.status(500).json({ error: "Fehler beim Lesen der Downloads" });
	}
});

// Endpunkt für den 'tools' Ordner (Entwicklertools)
app.get("/api/files/tools", (req, res) => {
	// <-- NEU: API-Route bereitstellen
	try {
		const files = getFilesFromDir("tools");
		res.json(files);
	} catch (err) {
		res.status(500).json({ error: "Fehler beim Lesen der Entwicklertools" });
	}
});

// Server Start
const server = app.listen(PORT, "0.0.0.0", () => {
	console.log(`🚀 Server läuft auf Port ${PORT}`);
	console.log(`📁 Templates werden aus /templates serviert`);
	console.log(`📁 Sonstiges wird aus /downloads serviert`);
	console.log(`📁 Entwicklertools werden aus /tools serviert`);
});
server.timeout = 150000; // Erhöhtes globaler Server-Timeout
