// Hilfsfunktionen
// -----------------------------

// Hilfsfunktion mischen bei Neustart
export function shuffleArray(array) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
	return array;
}

// Utility: Drag & Drop und Base64
export const toBase64 = (f) =>
	new Promise((res) => {
		const r = new FileReader();
		r.readAsDataURL(f);
		r.onload = () => res(r.result);
	});

export function handleDragOver(e) {
	e.preventDefault();
}

export function handleDragLeave(e) {
	e.preventDefault();
}

export function handleDrop(e, callback) {
	e.preventDefault();
	callback(e.dataTransfer.files);
}

//CSV-DROP verlassen
export function handleDragLeaveCSV(e) {
	e.preventDefault();
}

// Helper: Zerlegt eine CSV-Zeile unter Beachtung von Anführungszeichen und dynamischem Trennzeichen
function splitCSVLine(line, delimiter) {
	const result = [];
	let current = "";
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];

		if (char === '"') {
			// Doppelte Anführungszeichen innerhalb von Anführungszeichen -> maskiertes "
			if (inQuotes && line[i + 1] === '"') {
				current += '"';
				i++;
			} else {
				// Wechsel des Anführungszeichen-Status
				inQuotes = !inQuotes;
			}
		} else if (char === delimiter && !inQuotes) {
			result.push(current.trim());
			current = "";
		} else {
			current += char;
		}
	}
	result.push(current.trim());
	return result;
}

// --- Data Handling ---
// CSV Laden und mischen (Unterstützt nun 'multiple', 'cloze' und 'free' mit Autodetect für Trennzeichen)
export function parseCSVData(text) {
	try {
		const lines = text.split(/\r?\n/).filter((l) => l.trim());
		if (lines.length < 2) throw new Error("Datei ist leer oder enthält keine Datenzeilen.");

		// Automatisches Erkennen des Trennzeichens anhand der Header-Zeile
		const headerLine = lines[0];
		const delimiter = headerLine.includes(";") ? ";" : ",";

		// Datenzeilen ohne die Kopfzeile verarbeiten
		const dataLines = lines.slice(1);

		const parsedData = dataLines
			.map((l) => {
				const c = splitCSVLine(l, delimiter);
				
				if (c.length < 2) return null;

				// Zuordnung basierend auf der Spaltenanzahl
				// Wenn die Datei 4 Spalten hat (wie deine Neu.csv: type, question, options, answer)
				// Oder das Standardformat (Frage; OptA; OptB; OptC; OptD; Antwort; Typ)
				let questionText = "";
				let rawAnswer = "";
				let type = "multiple";
				let opts = [];

				if (headerLine.toLowerCase().startsWith("type") || c.length <= 4) {
					// --- Format aus Neu.csv (type, question, options, answer) ---
					type = c[0].toLowerCase();
					questionText = c[1];
					rawAnswer = c[3] || "";

					if (type === "choice" || type === "multiple") {
						type = "multiple";
						// Optionen splitten, falls sie durch Komma in einer Zelle stehen
						const rawOpts = c[2] ? c[2].split(",") : [];
						opts = [rawOpts[0] || "", rawOpts[1] || "", rawOpts[2] || "", rawOpts[3] || ""];
					}
				} else {
					// --- Standard Pro-Format (7 Spalten) ---
					questionText = c[0];
					opts = [c[1] || "", c[2] || "", c[3] || "", c[4] || ""];
					rawAnswer = c[5] || "";
					type = (c[6] && ["multiple", "cloze", "free"].includes(c[6].toLowerCase())) ? c[6].toLowerCase() : "multiple";
				}

				// Normierung falscher Typen-Bezeichnungen aus externen Dateien
				if (type === "text") type = "free";
				if (type === "choice") type = "multiple";

				if (type === "free") {
					return {
						question: questionText,
						type: "free",
						correct_text: rawAnswer,
						options: [],
						answer: []
					};
				} else if (type === "cloze") {
					let finalQuestion = questionText;
					// Falls das Wort in der Frage noch nicht eingeklammert ist, holen wir es nach
					if (!finalQuestion.includes("[") && rawAnswer) {
						// Ersetzt das Wort oder ein Platzhalter-Wort "[Lücke]" mit der echten Antwort
						if (finalQuestion.includes("[Lücke]")) {
							finalQuestion = finalQuestion.replace("[Lücke]", `[${rawAnswer}]`);
						} else if (finalQuestion.includes("________")) {
							finalQuestion = finalQuestion.replace("________", `[${rawAnswer}]`);
						} else {
							finalQuestion = finalQuestion + ` [${rawAnswer}]`;
						}
					}
					return {
						question: finalQuestion,
						type: "cloze",
						correct_text: rawAnswer,
						options: [],
						answer: []
					};
				} else {
					// Multiple Choice Ablauf
					let targetIndices = [];

					// Überprüfung ob Index-Zahl oder Text-Antwort eingetragen ist
					if (rawAnswer.includes(",") || (!isNaN(rawAnswer) && rawAnswer !== "")) {
						const originalIndices = rawAnswer.split(",").map((num) => parseInt(num.trim()));
						const correctTexts = originalIndices.map((idx) => opts[idx]).filter((t) => t !== undefined);

						shuffleArray(opts);
						targetIndices = correctTexts.map((text) => opts.indexOf(text)).filter((idx) => idx !== -1);
					} else {
						const correctTexts = rawAnswer.split(",").map((t) => t.trim());
						shuffleArray(opts);
						targetIndices = correctTexts.map((text) => opts.indexOf(text)).filter((idx) => idx !== -1);
					}

					return {
						question: questionText,
						type: "multiple",
						options: opts,
						answer: targetIndices,
					};
				}
			})
			.filter((q) => q !== null && ((q.type === "multiple" && q.options.length > 0) || q.type === "free" || q.type === "cloze"));

		// Gesamte Fragenliste mischen
		shuffleArray(parsedData);

		if (parsedData.length === 0) throw new Error("Keine validen Fragen gefunden.");

		return parsedData;
	} catch (e) {
		console.error("CSV-Parsing Fehler:", e);
		alert("Daten fehlerhaft oder falsches Format: " + e.message);
		return null;
	}
}
