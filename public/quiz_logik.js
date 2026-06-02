// --- LOGIK-TEIL ---
/** --- GLOBALER ZUSTAND --- **/
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js"; //laden der Bibliothek

// --- GLOBALER ZUSTAND ---
window.gamePoints = 0;
window.maxScore = 10;
window.difficulty = 1.0;

/** --- PDF VORSCHAU --- **/
/**
 * PDF-Analyse via API.
 * Wandelt PDF in Base64 um und sendet sie an den Server zur Fragen-Generierung.
 */
async function previewPDF(input) {
	const file = input.files[0];
	if (!file || file.type !== "application/pdf") return;
	document.getElementById("file-name").innerText = file.name;
	document.getElementById("pdf-preview-box").classList.remove("hidden");
	const reader = new FileReader();
	reader.onload = async function () {
		const typedarray = new Uint8Array(this.result);
		const pdf = await pdfjsLib.getDocument(typedarray).promise;
		const page = await pdf.getPage(1);
		const canvas = document.getElementById("pdf-canvas");
		const ctx = canvas.getContext("2d");
		const viewport = page.getViewport({ scale: 0.5 });
		canvas.height = viewport.height;
		canvas.width = viewport.width;
		await page.render({ canvasContext: ctx, viewport: viewport }).promise;
	};
	reader.readAsArrayBuffer(file);
}

/** --- QUIZ LOGIK --- **/
// --- Core Quiz Flow ---
function resetStats() {
	currentIndex = 0;
	score = 0;
	userMistakes = [];
	gameDone = false;
}

// KI-Quiz generieren (Server-Anfrage)
async function startQuizGeneration() {
	resetStats();
	const file = document.getElementById("pdf-file").files[0];
	if (!file) return alert("PDF fehlt!");

	// NEU: Custom Prompt auslesen
	const customPrompt = document.getElementById('custom-prompt').value

	toggleCard("status");
	const statusText = document.getElementById("status-text");
	statusText.innerText = "PDF wird analysiert...";

	try {
		const base64 = (await toBase64(file)).split(",")[1];

		//Timeout-Schutz vorbereiten 30 Sektionen
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 30000);

		const res = await fetch("/api/quiz", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				pdfBase64: base64,
				questionCount: document.getElementById("question-count").value,
				customPrompt: customPrompt // NEU: Wird an das Backend gesendet
			}),
		});

		clearTimeout(timeoutId); // Timeout löschen, da Antwort kam

		// PRÜFUNG: War der Server-Antwort-Status erfolgreich?
		if (!res.ok) {
			let errorMsg = "Server-Fehler";
			if (res.status === 413) errorMsg = "Die PDF-Datei ist zu groß für die KI-Analyse.";
			if (res.status === 504 || res.status === 500) errorMsg = "Der Server antwortet nicht (Timeout).";
			throw new Error(errorMsg);
		}

		// NEU / GEFIXT:
		let data = await res.json();

		// PDF-ERGEBNISSE MISCHEN ---
		shuffleArray(data); // Fragen-Reihenfolge würfeln
		data.forEach((q) => {
   		// Sicherheitsprüfung: Falls die KI nur eine Zahl/String statt eines Arrays geliefert hat
    	if (!Array.isArray(q.answer)) {
        q.answer = [q.answer];
    	}

    	const correctTexts = q.answer.map(index => q.options[index]); // Richtige Antwort sichern
    	shuffleArray(q.options); // Antwortmöglichkeiten würfeln
    	q.answer = correctTexts.map(text => q.options.indexOf(text)); // Index neu setzen
		});

		quizData = data; // Gemischte Daten speichern
		toggleCard("quiz-container");
		showQuestion();
	} catch (err) {
		// Differenzierte Fehlermeldung
		let userMessage = "Fehler: ";
		if (err.name === "AbortError") {
			userMessage += "Die Analyse dauert zu lange. Versuche es mit einer kleineren PDF.";
		} else {
			userMessage += err.message;
		}

		console.error("Quiz-Error:", err); // Für Entwickler in der Konsole
		alert(userMessage); // Für den Endnutzer
		goToHome();
	}
}

// Anzeige der aktuellen Frage
function showQuestion() {
	if (currentIndex >= quizData.length) {
		showRes();
		return;
	}

	document.getElementById("quiz-content").classList.remove("hidden");
	document.getElementById("game-screen").classList.add("hidden");
	document.getElementById("feedback-area").classList.add("hidden");
	document.getElementById("result-screen").classList.add("hidden");

	const q = quizData[currentIndex];

	// Falls answer keine Liste ist, wird es zu einer Liste gemacht
	if (!Array.isArray(q.answer)) {
		q.answer = [q.answer];
	}

	document.getElementById("progress-bar").style.width =
		`${(currentIndex / quizData.length) * 100}%`;

	document.getElementById("q-count").innerText =
		`Frage ${currentIndex + 1} von ${quizData.length}`;

	document.getElementById("question-text").innerText = q.question;

	const optDiv = document.getElementById("options");
	optDiv.innerHTML = "";

	let selectedAnswers = [];
	let alreadyChecked = false;

	q.options.slice(0, 4).forEach((opt, i) => {
		const b = document.createElement("button");

		b.className =
			"option-btn w-full text-left p-4 rounded-xl border-2 border-slate-100 transition-all font-medium bg-white hover:border-blue-200 shadow-sm";

		b.innerHTML = `
			<span class="text-xs bg-slate-100 text-slate-400 px-2 py-1 rounded border border-slate-200 font-mono mr-2">
				Taste ${i + 1}
			</span>
			<span>${opt}</span>
		`;

		b.onclick = () => {
			if (alreadyChecked) return;

			if (selectedAnswers.includes(i)) {
				selectedAnswers = selectedAnswers.filter(x => x !== i);
				b.classList.remove("border-blue-500", "bg-blue-50");
			} else {
				if (selectedAnswers.length < q.answer.length) {
    			selectedAnswers.push(i);
  				b.classList.add("border-blue-500", "bg-blue-50");
				}
			}
		};

		optDiv.appendChild(b);
	});

	const checkBtn = document.createElement("button");
	checkBtn.innerText = "Antwort prüfen";
	checkBtn.className =
		"w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl";

	function checkAnswer() {
    	if (selectedAnswers.length !== q.answer.length) {
        	alert(`Bitte genau ${q.answer.length} Antwort(en) auswählen!`);
        	return;
    	}

		alreadyChecked = true;

		document.querySelectorAll(".option-btn").forEach(btn => btn.disabled = true);
		checkBtn.disabled = true;

		const correctAnswers = [...q.answer].sort((a, b) => a - b);
		const userAnswers = [...selectedAnswers].sort((a, b) => a - b);

		const isCorrect =
			JSON.stringify(correctAnswers) === JSON.stringify(userAnswers);

		const buttons = document.querySelectorAll(".option-btn");

		buttons.forEach((btn, index) => {
			if (q.answer.includes(index)) {
				btn.classList.add("border-green-500", "bg-green-50");
			}

			if (selectedAnswers.includes(index) && !q.answer.includes(index)) {
				btn.classList.add("border-red-500", "bg-red-50");
			}
		});

		const feedbackArea = document.getElementById("feedback-area");
		const feedbackText = document.getElementById("feedback-text");
		const nextBtn = document.getElementById("next-q-btn");

		if (isCorrect) {
			score++;
			feedbackText.innerHTML = "✅ Richtig!";
			feedbackText.className = "text-green-600 font-bold text-center";
		} else {
			const rightTexts = q.answer.map(index => q.options[index]).join(", ");

			userMistakes.push({
				q: q.question,
				g: selectedAnswers.map(index => q.options[index]).join(", "),
				c: rightTexts
			});

			feedbackText.innerHTML = `❌ Falsch. Richtig ist: ${rightTexts}`;
			feedbackText.className = "text-red-600 font-bold text-center";
		}

		feedbackArea.classList.remove("hidden");

		nextBtn.onclick = () => {
			currentIndex++;
			showQuestion();
		};
		// Berechnen, ob wir genau die Hälfte der Fragen erreicht haben
		const halfQuiz = Math.floor(quizData.length / 2);

		// Wenn wir die Hälfte erreicht haben UND das Spiel in dieser Runde noch nicht lief
		if (currentIndex === halfQuiz && halfQuiz > 0 && !gameDone) {
			nextBtn.innerText = "Spielen & Weiter ⚡";
			nextBtn.onclick = () => {
				// Wechsel zum Spiel-Bildschirm
				document.getElementById("quiz-content").classList.add("hidden");
				document.getElementById("game-screen").classList.remove("hidden");
				
				// Flag setzen, damit das Spiel pro Quiz-Durchlauf nur EINMAL triggert
				gameDone = true; 
				
				// Index im Hintergrund erhöhen, damit es nach dem Spiel mit der nächsten Frage weitergeht
				currentIndex++;
			};
		} else {
			// Normaler Ablauf für alle anderen Fragen
			nextBtn.innerText = "Nächste Frage →";
			nextBtn.onclick = () => {
				currentIndex++;
				showQuestion();
			};
		}
	}
	}

	checkBtn.onclick = checkAnswer;
	optDiv.appendChild(checkBtn);

	document.onkeydown = (e) => {
		if (["1", "2", "3", "4"].includes(e.key)) {
			const index = parseInt(e.key) - 1;
			const buttons = document.querySelectorAll(".option-btn");

			if (buttons[index] && !buttons[index].disabled) {
				buttons[index].click();
			}
		}

		if (e.key === "Enter") {
			if (document.getElementById("feedback-area").classList.contains("hidden")) {
				checkAnswer();
			} else {
				document.getElementById("next-q-btn").click();
			}
		}
	};
}


// Ergebnis-Zusammenfassung anzeigen
function showRes() {
	document.getElementById("quiz-content").classList.add("hidden");
	document.getElementById("result-screen").classList.remove("hidden");
	document.getElementById("progress-bar").style.width = "100%";
	const total = quizData.length;
	const percent = Math.round((score / total) * 100);
	document.getElementById("score-display").innerText = `${score} von ${total} richtig (${percent}%)`;
	const analysis = document.getElementById("mistake-analysis");
	if (userMistakes.length > 0) {
		analysis.innerHTML = userMistakes
			.map(
				(m, idx) => `
            <div class="mistake-card p-3 bg-white border border-slate-200 rounded-xl text-xs shadow-sm border-l-red-500">
                <p class="font-bold mb-1 text-slate-800">Frage: ${m.q}</p>
                <p class="text-red-500">❌ Deine Wahl: ${m.g}</p>
                <p class="text-green-600 font-bold">✅ Lösung: ${m.c}</p>
            </div>`,
			)
			.join("");
	} else {
		analysis.innerHTML =
			'<div class="text-center p-6 bg-green-50 rounded-2xl border-2 border-green-100"><p class="text-green-600 font-black text-lg">PERFEKT! 100% 🌟</p></div>';
	}
	const h = JSON.parse(localStorage.getItem("quiz_history") || "[]");
	h.unshift({ d: new Date().toLocaleDateString(), p: percent });
	localStorage.setItem("quiz_history", JSON.stringify(h.slice(0, 10)));
	renderHistory();
}

/** --- DATEN IMPORT / EXPORT --- **/
function importCSV(source) {
	resetStats();
	const file = source.files ? source.files[0] : source[0];
	if (!file) return;
	toggleCard("status");
	const r = new FileReader();
	r.onload = (e) => parseCSVData(e.target.result);
	r.readAsText(file, "UTF-8");
}

function exportCSV() {
	let csv = "\uFEFFFrage;Option A;Option B;Option C;Option D;Antwort\n";
	quizData.forEach((q) => {
		csv += `"${q.question}";${q.options.map((o) => `"${o}"`).join(";")};"${q.options[q.answer]}"\n`;
	});
	const b = new Blob([csv], { type: "text/csv;charset=utf-8;" });
	const a = document.createElement("a");
	a.href = URL.createObjectURL(b);
	a.download = "Quiz_Export.csv";
	a.click();
}

async function loadTemplate(url) {
	resetStats();
	toggleCard("status");
	try {
		const response = await fetch(url);

		if (!response.ok) {
			throw new Error(`Vorlage konnte nicht geladen werden (Status: ${response.status})`);
		}

		const text = await response.text();
		parseCSVData(text);
	} catch (err) {
		alert("Fehler beim Laden der Vorlage: " + err.message);
		goToHome();
	}
}

// --- Data Handling ---
//CSV Laden und mischen
// --- Data Handling ---
// CSV Laden und mischen (Unterstützt jetzt Single- und Multiple-Choice)
function parseCSVData(text) {
	try {
		const lines = text
			.split(/\r?\n/)
			.filter((l) => l.trim())
			.slice(1);
		
		quizData = lines
			.map((l) => {
				const c = l.match(/(".*?"|[^;]+)(?=\s*;|\s*$)/g).map((s) => s.replace(/^"|"$/g, "").trim());
				const opts = [c[1], c[2], c[3], c[4]];
				const rawAnswer = c[5]; // Kann eine Zahl wie "2" oder eine Kette wie "0,2" sein

				let targetIndices = [];

				// PRÜFUNG: Ist die Antwortspalte mit Indizes (z.B. "0,2") oder mit Text gefüllt?
				if (rawAnswer.includes(",") || (!isNaN(rawAnswer) && rawAnswer !== "")) {
					// Falls es sich um Indizes handelt, spalten wir sie beim Komma auf
					const originalIndices = rawAnswer.split(",").map(num => parseInt(num.trim()));
					
					// Da die Optionen gleich gemischt werden, sichern wir die korrekten Texte
					const correctTexts = originalIndices.map(idx => opts[idx]).filter(t => t !== undefined);
					
					// Optionen mischen
					shuffleArray(opts);
					
					// Neue Indizes nach dem Mischen ermitteln
					targetIndices = correctTexts.map(text => opts.indexOf(text)).filter(idx => idx !== -1);
				} else {
					// Fallback für alten CSV-Stil (Reiner Antwort-Text statt Index in der Spalte)
					const correctTexts = rawAnswer.split(",").map(t => t.trim());
					shuffleArray(opts);
					targetIndices = correctTexts.map(text => opts.indexOf(text)).filter(idx => idx !== -1);
				}

				return {
					question: c[0],
					options: opts,
					answer: targetIndices, // Speichert die korrekten Indizes als Array ab
				};
			})
			.filter((q) => q.answer && q.answer.length > 0);

		// Die Fragenliste selbst mischen
		shuffleArray(quizData);

		if (quizData.length === 0) throw new Error();
		toggleCard("quiz-container");
		showQuestion();
	} catch (e) {
		console.error("CSV-Parsing Fehler:", e);
		alert("Daten fehlerhaft!");
		goToHome();
	}
}

//zurück zu Hauptmenu
function goToHome() {
	resetStats();
	quizData = [];
	toggleCard("setup-card");
	const modus = document.getElementById("Modus");
	modus.value = "PDF";
	document.getElementById("section-pdf").classList.remove("hidden");
	document.getElementById("section-csv").classList.add("hidden");
	document.getElementById("section-template").classList.add("hidden");
	document.getElementById("pdf-preview-box").classList.add("hidden");
	document.getElementById("file-name").innerText = "PDF WÄHLEN / DROP";
	document.getElementById("pdf-file").value = "";
	document.getElementById("csv-import").value = "";
	document.getElementById("section-downloads").classList.add("hidden");
}

//Downlaod ausblenden
function toggleDownloads(show) {
	const downloadSection = document.getElementById("section-downloads");
	if (downloadSection) {
		if (show) {
			downloadSection.classList.remove("hidden");
		} else {
			downloadSection.classList.add("hidden");
		}
	}
}

//aktuelles Quiz Neustarten
function restartCurrentQuiz() {
	if (quizData.length === 0) return goToHome();

	// Alles neu mischen vor dem Neustart
	shuffleArray(quizData);
	quizData.forEach((q) => {
		const correctTexts = q.answer.map(index => q.options[index]);
		shuffleArray(q.options);
		q.answer = correctTexts.map(text => q.options.indexOf(text));
	});

	resetStats();
	document.getElementById("result-screen").classList.add("hidden");
	document.getElementById("quiz-content").classList.remove("hidden");
	showQuestion();
}

//Verlauf rendern
function renderHistory() {
	const h = JSON.parse(localStorage.getItem("quiz_history") || "[]");
	const list = document.getElementById("history-list");
	if (h.length === 0) {
		list.innerHTML = '<p class="text-slate-400 text-sm italic text-center py-4">Kein Verlauf.</p>';
		return;
	}
	list.innerHTML = h
		.map(
			(e) => `
        <div class="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100 hover:bg-blue-50 transition-colors">
            <span class="font-bold text-slate-600 text-sm">${e.d}</span>
            <span class="font-black text-blue-600 bg-white px-3 py-1 rounded-lg shadow-sm border border-blue-50">${e.p}%</span>
        </div>`,
		)
		.join("");
}

function toggleCard(id) {
	["setup-card", "status", "quiz-container"].forEach((c) => document.getElementById(c)?.classList.add("hidden"));
	document.getElementById(id)?.classList.remove("hidden");
}

//Hilsfunktion mischen bei neustart
function shuffleArray(array) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
	return array;
}

//Verlauf löschen
function clearHistory() {
	localStorage.removeItem("quiz_history");
	renderHistory();
}

document.getElementById("Modus").onchange = function () {
	//aktuelle Wahl
	const val = this.value;

	document.getElementById("section-pdf").classList.toggle("hidden", this.value !== "PDF");
	document.getElementById("section-csv").classList.toggle("hidden", this.value !== "CSV");
	document.getElementById("section-template").classList.toggle("hidden", this.value !== "TEMPLATE");
	document.getElementById("section-training").classList.toggle("hidden", this.value !== "TRAINING"); // NEU
	document.getElementById("section-downloads").classList.toggle("hidden", this.value !== "DOWNLOADS");

	// Liste laden, wenn Downloads ODER Vorlagen gewählt werden
	if (val === "DOWNLOADS" || val === "TEMPLATE") {
		loadDownloadFiles();
	}

	// Falls ein Spiel auf dem Home-Canvas läuft, stoppen wenn man den Modus wechselt
	if (this.value !== "TRAINING") {
		gameActive = false;
		clearInterval(gameInterval);
	}
};

// Utility: Drag & Drop und Base64
const toBase64 = (f) =>
	new Promise((res) => {
		const r = new FileReader();
		r.readAsDataURL(f);
		r.onload = () => res(r.result);
	});
function handleDragOver(e) {
	e.preventDefault();
}
function handleDrop(e) {
	e.preventDefault();
	document.getElementById("pdf-file").files = e.dataTransfer.files;
	previewPDF(document.getElementById("pdf-file"));
}
function handleDragOverCSV(e) {
	e.preventDefault();
}
function handleDropCSV(e) {
	e.preventDefault();
	importCSV(e.dataTransfer.files);
}

//CSV-DROP verlassen
function handleDragLeaveCSV(e) {
	e.preventDefault();
}

/** --- DATEN IMPORT / EXPORT / DOWNLOADS --- **/
async function loadDownloadFiles() {
	const downloadList = document.getElementById("file-list"); // Bereich Lernmaterialien
	const downloadList2 = document.getElementById("file2-list"); // Bereich Sonstiges
	const templateList = document.getElementById("template-list"); // Vorlagen-Bereich (Vorlagen vom Server)

	try {
		// Daten von beiden Endpunkten parallel abrufen
		const [resT, resD] = await Promise.all([fetch("/api/files/templates"), fetch("/api/files/downloads")]);

		const templates = await resT.json();
		const downloads = await resD.json();

		// --- 1. VERFÜGBARE LERNMATERIALIEN (aus /templates) ---
		if (downloadList) {
			downloadList.innerHTML =
				templates.length > 0
					? templates
						.map(
							(file) => `
                <li class="flex justify-between items-center p-3 bg-slate-50 rounded-lg hover:bg-blue-50 transition-colors">
                    <span class="text-slate-700 font-medium truncate">📄 ${file}</span>
                    <a href="/templates/${file}" download class="bg-blue-100 text-blue-600 px-3 py-1 rounded-md text-xs font-bold hover:bg-blue-600 hover:text-white transition-all">Laden ↓</a>
                </li>
            `,
						)
						.join("")
					: '<li class="text-slate-400 text-sm italic">Keine Lernmaterialien gefunden.</li>';
		}

		// --- 2. VORLAGEN-BUTTONS (nur .csv aus /templates) ---
		if (templateList) {
			const csvFiles = templates.filter((f) => f.toLowerCase().endsWith(".csv"));
			templateList.innerHTML =
				csvFiles.length > 0
					? csvFiles
						.map(
							(file) => `
                <button onclick="loadTemplate('/templates/${file}')" class="w-full p-4 border-2 rounded-xl bg-white hover:border-blue-500 hover:bg-blue-50 text-left font-bold transition-all flex justify-between items-center group">
                    <span>📊 ${file.replace(".csv", "")}</span>
                    <span class="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">Starten →</span>
                </button>
            `,
						)
						.join("")
					: '<p class="text-slate-400 text-center">Keine CSV-Vorlagen gefunden.</p>';
		}

		// --- 3. SONSTIGE DOWNLOADS (aus /downloads) ---
		if (downloadList2) {
			downloadList2.innerHTML =
				downloads.length > 0
					? downloads
						.map(
							(file) => `
                <li class="flex justify-between items-center p-3 bg-slate-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <span class="text-slate-700 font-medium truncate">📦 ${file}</span>
                    <a href="/downloads/${file}" download class="bg-slate-800 text-white px-3 py-1 rounded-md text-xs font-bold hover:bg-black transition-all">Download ↓</a>
                </li>
            `,
						)
						.join("")
					: '<li class="text-slate-400 text-sm italic">Keine sonstigen Dateien gefunden.</li>';
		}
	} catch (error) {
		console.error("Fehler beim Laden der Listen:", error);
	}
}

// Initialisierung beim Laden
window.onload = () => {
	// Setzt das Dropdown beim Laden explizit auf PDF
	const modusSelect = document.getElementById("Modus");

	if (modusSelect) {
		// Setzt das Dropdown beim Laden explizit auf PDF
		modusSelect.value = "PDF";

		// Hier wird die Auswahl-Logik sicher registriert:
		modusSelect.onchange = function () {
			const val = this.value;

	//Downloadbereich
	loadDownloadFiles(); // Einfach direkt hier aufrufen

	// Stellt sicher, dass die richtigen Sektionen (PDF ein, Rest aus) angezeigt werden
	document.getElementById("section-pdf").classList.remove("hidden");
	document.getElementById("section-csv").classList.add("hidden");
	document.getElementById("section-template").classList.add("hidden");
	document.getElementById("section-training").classList.add("hidden");
	document.getElementById("section-downloads").classList.add("hidden");

	renderHistory();
	updateMuteUI();
};
