// Hilfsfunktionen
// -----------------------------

// Hilsfunktion mischen bei neustart
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
// CSV Laden und mischen
export function parseCSVData(text) {
	try {
		const lines = text
			.split(/\r?\n/)
			.filter((l) => l.trim())
			.slice(1);

		const parsedData = lines
			.map((l) => {
				const c = l.match(/(".*?"|[^;]+)(?=\s*;|\s*$)/g).map((s) => s.replace(/^"|"$/g, "").trim());
				const opts = [c[1], c[2], c[3], c[4]];
				const rawAnswer = c[5]; // Kann eine Zahl wie "2" oder eine Kette wie "0,2" sein

				let targetIndices = [];

				// PRÜFUNG: Ist die Antwortspalte mit Indizes (z.B. "0,2") oder mit Text gefüllt?
				if (rawAnswer.includes(",") || (!isNaN(rawAnswer) && rawAnswer !== "")) {
					// Falls es sich um Indizes handelt, spalten wir sie beim Komma auf
					const originalIndices = rawAnswer.split(",").map((num) => parseInt(num.trim()));

					// Da die Optionen gleich gemischt werden, sichern wir die korrekten Texte
					const correctTexts = originalIndices.map((idx) => opts[idx]).filter((t) => t !== undefined);

					// Optionen mischen
					shuffleArray(opts);

					// Neue Indizes nach dem Mischen ermitteln
					targetIndices = correctTexts.map((text) => opts.indexOf(text)).filter((idx) => idx !== -1);
				} else {
					// Fallback für alten CSV-Stil (Reiner Antwort-Text statt Index in der Spalte)
					const correctTexts = rawAnswer.split(",").map((t) => t.trim());
					shuffleArray(opts);
					targetIndices = correctTexts.map((text) => opts.indexOf(text)).filter((idx) => idx !== -1);
				}

				return {
					question: c[0],
					options: opts,
					answer: targetIndices, // Speichert die korrekten Indizes als Array ab
				};
			})
			.filter((q) => q.answer && q.answer.length > 0);

		// Die Fragenliste selbst mischen
		shuffleArray(parsedData);

		if (parsedData.length === 0) throw new Error("Keine Fragen gefunden");

		return parsedData;
	} catch (e) {
		console.error("CSV-Parsing Fehler:", e);
		alert("Daten fehlerhaft!");
		return null;
	}
}
