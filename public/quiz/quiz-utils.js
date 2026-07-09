// Hilfsfunktionen
// -----------------------------
//Enthält wiederverwendbare, mathematische Hilfsfunktionen und Logiken zur String-Verarbeitung, die unabhängig vom UI-Zustand operieren.
// -----------------------------

// Standardisierter Mischalgorithmus, um Arrays (Fragen oder Optionen) zufällig umzusortieren.
export function shuffleArray(array) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
	return array;
}

// Kapselt den asynchronen FileReader in ein modernes Promise, um Dateien komfortabel mittels await in einen Base64-String zu transformieren.
export const toBase64 = (f) =>
	new Promise((res) => {
		const r = new FileReader();
		r.readAsDataURL(f);
		r.onload = () => res(r.result);
	});

// Standardisierte Event-Handler, um systemübergreifendes Drag & Drop von Dateien über der Weboberfläche zu realisieren.
export function handleDragOver(e) {
	e.preventDefault();
}

// Standardisierte Event-Handler, um systemübergreifendes Drag & Drop von Dateien über der Weboberfläche zu realisieren.
export function handleDragLeave(e) {
	e.preventDefault();
}

// Standardisierte Event-Handler, um systemübergreifendes Drag & Drop von Dateien über der Weboberfläche zu realisieren.
export function handleDrop(e, callback) {
	e.preventDefault();
	callback(e.dataTransfer.files);
}

// Standardisierte Event-Handler, um systemübergreifendes Drag & Drop von Dateien über der Weboberfläche zu realisieren.
export function handleDragLeaveCSV(e) {
	e.preventDefault();
}

// Ein intelligenter CSV-Parser für Tabellenzeilen.
// Funktionsweise: Splittet eine Zeile anhand des Trennzeichens (Komma oder Semikolon),
// berücksichtigt dabei jedoch im Text befindliche Anführungszeichen ("..."). Das verhindert,
// dass ein Semikolon innerhalb einer Quizfrage fälschlicherweise als Spaltentrennung interpretiert wird. --> endlich
function splitCSVLine(line, delimiter) {
	const result = [];
	let current = "";
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];

		if (char === '"') {
			if (inQuotes && line[i + 1] === '"') {
				current += '"';
				i++;
			} else {
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

// CSV Laden und mischen (Optimiert für Multi-Index Extraktion bei mehreren Antworten)
// Die Verarbeitung für CSV-Importe.
// Funktionsweise: Erkennt automatisch den verwendeten Delimiter (; oder ,),
// liest Spaltenüberschriften aus und konvertiert jede Datenzeile basierend auf ihrer Struktur in das passende interne Fragenobjekt.
// Neu: Erkennt nun zuverlässig die neuen Typen cloze und free. Lückentexte werden automatisch repariert,
// falls das Dokument keine eckigen Klammern enthielt, indem bekannte Platzhalter wie ________ oder [Lücke] durch das korrekte
// Lösungswort in Klammern ersetzt werden.
// Bei Multiple-Choice-Fragen wurde der Code so erweitert,
// dass in der Antwortspalte sowohl exakte Textphrasen als auch reine Indexnummern (kommagetrennt, z. B. 0,2) für mehrere richtige Antworten erkannt,
// gemischt und korrekt zugeordnet werden.
export function parseCSVData(text) {
	try {
		const lines = text.split(/\r?\n/).filter((l) => l.trim());
		if (lines.length < 2) throw new Error("Datei ist leer oder enthält keine Datenzeilen.");

		const headerLine = lines[0];
		const delimiter = headerLine.includes(";") ? ";" : ",";
		const dataLines = lines.slice(1);

		const parsedData = dataLines
			.map((l) => {
				const c = splitCSVLine(l, delimiter);
				if (c.length < 2) return null;

				let questionText = "";
				let rawAnswer = "";
				let type = "multiple";
				let opts = [];

				if (headerLine.toLowerCase().startsWith("type") || c.length <= 4) {
					type = c[0].toLowerCase();
					questionText = c[1];
					rawAnswer = c[3] || "";

					if (type === "choice" || type === "multiple") {
						type = "multiple";
						const rawOpts = c[2] ? c[2].split(",") : [];
						opts = [rawOpts[0] || "", rawOpts[1] || "", rawOpts[2] || "", rawOpts[3] || ""];
					}
				} else {
					questionText = c[0];
					opts = [c[1] || "", c[2] || "", c[3] || "", c[4] || ""];
					rawAnswer = c[5] || "";
					type =
						c[6] && ["multiple", "cloze", "free"].includes(c[6].toLowerCase())
							? c[6].toLowerCase()
							: "multiple";
				}

				if (type === "text") type = "free";
				if (type === "choice") type = "multiple";

				if (type === "free") {
					return {
						question: questionText,
						type: "free",
						correct_text: rawAnswer,
						options: [],
						answer: [],
					};
				} else if (type === "cloze") {
					let finalQuestion = questionText;
					if (!finalQuestion.includes("[") && rawAnswer) {
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
						answer: [],
					};
				} else {
					// Multiple Choice: Unterstützt jetzt Indizes ("0,2") sowie Klartexte ("Sauerstoff, Stickstoff") bei Mehrfachnennung
					let targetIndices = [];

					// Falls die Antwortspalte rein numerisch/Index-basiert aufgebaut ist (auch kommagetrennt für Multi-Choice)
					const isNumericList = rawAnswer
						.split(",")
						.every((item) => !isNaN(item.trim()) && item.trim() !== "");

					if (isNumericList && rawAnswer.trim() !== "") {
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
			.filter(
				(q) =>
					q !== null &&
					((q.type === "multiple" && q.options.filter((o) => o !== "").length > 0) ||
						q.type === "free" ||
						q.type === "cloze"),
			);

		shuffleArray(parsedData);
		if (parsedData.length === 0) throw new Error("Keine validen Fragen gefunden.");

		return parsedData;
	} catch (e) {
		console.error("CSV-Parsing Fehler:", e);
		alert("Daten fehlerhaft oder falsches Format: " + e.message);
		return null;
	}
}
