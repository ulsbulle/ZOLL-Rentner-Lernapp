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

// --- Data Handling ---
// CSV Laden und mischen (Unterstützt nun 'multiple', 'cloze' und 'free')
export function parseCSVData(text) {
	try {
		const lines = text
			.split(/\r?\n/)
			.filter((l) => l.trim())
			.slice(1);

		const parsedData = lines
			.map((l) => {
				const c = l.match(/(".*?"|[^;]+)(?=\s*;|\s*$)/g).map((s) => s.replace(/^"|"$/g, "").trim());
				
				if (c.length < 2) return null;

				const questionText = c[0];
				const rawAnswer = c[5] || "";
				
				// Überprüfen, welcher Typ definiert wurde (Spalte Index 6). Default: multiple
				const type = (c[6] && ["multiple", "cloze", "free"].includes(c[6].toLowerCase())) ? c[6].toLowerCase() : "multiple";

				if (type === "free") {
					return {
						question: questionText,
						type: "free",
						correct_text: rawAnswer,
						options: [],
						answer: []
					};
				} else if (type === "cloze") {
					// Lückentext-Verarbeitung
					let finalQuestion = questionText;
					// Fallback falls Lücken-Syntax fehlt: eckige Klammern um das Wort bauen
					if (!questionText.includes("[") && rawAnswer) {
						finalQuestion = questionText + ` [${rawAnswer}]`;
					}
					return {
						question: finalQuestion,
						type: "cloze",
						correct_text: rawAnswer,
						options: [],
						answer: []
					};
				} else {
					// Klassischer Multiple Choice Ablauf
					const opts = [c[1] || "", c[2] || "", c[3] || "", c[4] || ""];
					let targetIndices = [];

					// PRÜFUNG: Ist die Antwortspalte mit Indizes (z.B. "0,2") oder mit Text gefüllt?
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
			.filter((q) => q !== null && ((q.type === "multiple" && q.answer.length > 0) || q.type === "free" || q.type === "cloze"));

		// Die Fragenliste selbst mischen
		shuffleArray(parsedData);

		if (parsedData.length === 0) throw new Error("Keine Fragen gefunden");

		return parsedData;
	} catch (e) {
		console.error("CSV-Parsing Fehler:", e);
		alert("Daten fehlerhaft oder falsches Format!");
		return null;
	}
}
