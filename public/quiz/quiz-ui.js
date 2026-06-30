// Funktionen für DOM und BOM
// ------------------------------

import { handleDragOver, handleDragLeave, handleDrop, handleDragLeaveCSV, parseCSVData } from "./quiz-utils.js";
import { QuizEngine } from "./quiz-engine.js";

// Globale Instanziierung der Engine
window.quizApp = new QuizEngine();
window.gamePoints = 0;
window.maxScore = 10;
window.difficulty = 1.0;
window.isMuted = localStorage.getItem("quiz_muted") === "true";

pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js"; //laden der Bibliothek

/** --- UI-HILFSFUNKTIONEN --- **/
//Quiz starten
window.startQuizGeneration = () => {
	const file = document.getElementById("pdf-file").files[0];
	const customPrompt = document.getElementById("custom-prompt").value;
	window.quizApp.startQuizGeneration(file, customPrompt);
};
window.restartCurrentQuiz = () => window.quizApp.restartCurrentQuiz();

//zurück zu Hauptmenü
window.goToHome = function () {
	window.quizApp.resetStats();
	window.quizApp.quizData = [];
	window.toggleCard("setup-card");
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
};

//Quiz ausblenden-
window.toggleCard = function (id) {
	["setup-card", "status", "quiz-container"].forEach((c) => document.getElementById(c)?.classList.add("hidden"));
	document.getElementById(id)?.classList.remove("hidden");
};

//Downlaod ausblenden
window.toggleDownloads = function (show) {
	const downloadSection = document.getElementById("section-downloads");
	if (downloadSection) {
		if (show) {
			downloadSection.classList.remove("hidden");
		} else {
			downloadSection.classList.add("hidden");
		}
	}
};

//Verlauf rendern
window.renderHistory = function () {
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
};

//Verlauf löschen
window.clearHistory = () => {
	localStorage.removeItem("quiz_history");
	window.renderHistory();
};

/** --- AUDIO UI --- **/
/**
 * Aussehen der Schaltfläche
 * Mute/Unmute
 */
function updateMuteUI() {
	const btn = document.getElementById("mute-btn");
	if (btn) btn.innerText = isMuted ? "🔇" : "🔊";
	btn.title = window.isMuted ? "Ton einschalten" : "Ton stummschalten";
}
//Speichern der Einstellungen im localStorage
window.toggleMute = function () {
	window.isMuted = !window.isMuted;
	if (window.audioEngine) window.audioEngine.setVolume(window.isMuted ? 0 : 1);
	localStorage.setItem("quiz_muted", window.isMuted);
	updateMuteUI();
};

/** --- PDF VORSCHAU --- **/
/**
 * PDF-Analyse via API.
 * Wandelt PDF in Base64 um und sendet sie an den Server zur Fragen-Generierung.
 */
window.previewPDF = async function (input) {
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
};

/** --- DATEN IMPORT / EXPORT --- **/
window.importCSV = function (source) {
	window.quizApp.resetStats();
	const file = source.files ? source.files[0] : source[0];
	if (!file) return;
	window.toggleCard("status");
	const r = new FileReader();
	r.onload = (e) => {
		const parsedData = parseCSVData(e.target.result);
		window.quizApp.loadQuizData(parsedData);
	};
	r.readAsText(file, "UTF-8");
};

window.exportCSV = function () {
	let csv = "\uFEFFFrage;Option A;Option B;Option C;Option D;Antwort\n";
	window.quizApp.quizData.forEach((q) => {
		csv += `"${q.question}";${q.options.map((o) => `"${o}"`).join(";")};"${q.answer.join(",")}"\n`;
	});
	const b = new Blob([csv], { type: "text/csv;charset=utf-8;" });
	const a = document.createElement("a");
	a.href = URL.createObjectURL(b);
	a.download = "Quiz_Export.csv";
	a.click();
};

window.loadTemplate = async function (url) {
	window.quizApp.resetStats();
	window.toggleCard("status");
	try {
		const response = await fetch(url);
		if (!response.ok) throw new Error(`Vorlage konnte nicht geladen werden (Status: ${response.status})`);
		const text = await response.text();
		const parsedData = parseCSVData(text);
		window.quizApp.loadQuizData(parsedData);
	} catch (err) {
		alert("Fehler beim Laden der Vorlage: " + err.message);
		window.goToHome();
	}
};

/** --- INITIALISIERUNG --- **/
//Datei laden
window.loadDownloadFiles = async function () {
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
};

// Initialisierung beim Laden
window.onload = () => {
	const modusSelect = document.getElementById("Modus");

	if (modusSelect) {
		// Event-Listener für das Umschalten registrieren
		modusSelect.onchange = function () {
			//aktuelle Wahl
			const val = this.value;

			// Hier wird geprüft, was ausgewählt wurde (val) und NUR das wird angezeigt!
			document.getElementById("section-pdf").classList.toggle("hidden", val !== "PDF");
			document.getElementById("section-csv").classList.toggle("hidden", val !== "CSV");
			document.getElementById("section-template").classList.toggle("hidden", val !== "TEMPLATE");
			document.getElementById("section-training").classList.toggle("hidden", val !== "TRAINING");
			document.getElementById("section-downloads").classList.toggle("hidden", val !== "DOWNLOADS");

			// Liste laden, wenn Downloads ODER Vorlagen gewählt werden
			if (val === "DOWNLOADS" || val === "TEMPLATE") {
				window.loadDownloadFiles();
			}

			// Falls ein Spiel auf dem Home-Canvas läuft, stoppen wenn man den Modus wechselt
			if (val !== "TRAINING") {
				window.gameActive = false;
				if (typeof window.gameInterval !== "undefined") clearInterval(window.gameInterval);
			}
		};
	}

	// Downloadbereich beim Start initialisieren
	window.loadDownloadFiles();

	// Start-Zustand: Zeige PDF an, blende den Rest aus (genau wie in deinem Original-Code)
	document.getElementById("section-pdf").classList.remove("hidden");
	document.getElementById("section-csv").classList.add("hidden");
	document.getElementById("section-template").classList.add("hidden");
	document.getElementById("section-training").classList.add("hidden");
	document.getElementById("section-downloads").classList.add("hidden");

	// Verlauf rendern
	window.renderHistory();
};

document.addEventListener("DOMContentLoaded", () => {
	const modusSelect = document.getElementById("Modus");
	if (modusSelect) {
		modusSelect.onchange = function () {
			//aktuelle Wahl
			const val = this.value;

			document.getElementById("section-pdf").classList.toggle("hidden", val !== "PDF");
			document.getElementById("section-csv").classList.toggle("hidden", val !== "CSV");
			document.getElementById("section-template").classList.toggle("hidden", val !== "TEMPLATE");
			document.getElementById("section-training").classList.toggle("hidden", val !== "TRAINING"); // NEU
			document.getElementById("section-downloads").classList.toggle("hidden", val !== "DOWNLOADS");

			// Liste laden, wenn Downloads ODER Vorlagen gewählt werden
			if (val === "DOWNLOADS" || val === "TEMPLATE") {
				window.loadDownloadFiles();
			}

			// Falls ein Spiel auf dem Home-Canvas läuft, stoppen wenn man den Modus wechselt
			if (this.value !== "TRAINING") {
				window.gameActive = false;
				if (typeof window.gameInterval !== "undefined") clearInterval(window.gameInterval);
			}
		};
	}
});

//Drag & Drop Bindings
window.handleDragOver = handleDragOver;
window.handleDragLeave = handleDragLeave;
window.handleDrop = (e) =>
	handleDrop(e, (files) => {
		document.getElementById("pdf-file").files = files;
		window.previewPDF(document.getElementById("pdf-file"));
	});
window.handleDragOverCSV = handleDragOver;
window.handleDragLeaveCSV = handleDragLeaveCSV;
window.handleDropCSV = (e) => handleDrop(e, (files) => window.importCSV(files));

/** --- DARKMODE --- **/
window.updateThemeButton = function (isDark) {
	const themeBtn = document.getElementById("theme-btn");
	if (themeBtn) {
		// Ändert nur das Icon-Emoji im Button, ohne das HTML zu zerstören
		themeBtn.innerText = isDark ? "☀️" : "🌙";
		themeBtn.title = isDark ? "Zu hellem Design wechseln" : "Zu dunklem Design wechseln";
	}
};

window.toggleDarkMode = function () {
	const isDark = document.documentElement.classList.toggle("dark");
	localStorage.setItem("darkMode", isDark);
	window.updateThemeButton(isDark);
};

// Beim Laden der Seite den gespeicherten Modus anwenden und Button-Icon setzen
const savedDarkMode =
	localStorage.getItem("darkMode") === "true" ||
	(!("darkMode" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches);

if (savedDarkMode) {
	document.documentElement.classList.add("dark");
} else {
	document.documentElement.classList.remove("dark");
}

// Nach dem Laden das korrekte Icon anzeigen
document.addEventListener("DOMContentLoaded", () => {
	const isCurrentlyDark = document.documentElement.classList.contains("dark");
	window.updateThemeButton(isCurrentlyDark);
});

window.toggleContrast = function () {
	const isContrast = document.documentElement.classList.toggle("contrast");
	localStorage.setItem("contrastMode", isContrast);

	// Ändert das Auge-Icon, um den Zustand anzuzeigen
	const contrastBtn = document.getElementById("contrast-btn");
	if (contrastBtn) {
		contrastBtn.innerText = isContrast ? "🕶️" : "👁️";
		contrastBtn.title = isContrast ? "Zu normalem Modus wechseln" : "Zu Kontrastmodus wechseln";
	}
};

// Beim Laden der Seite prüfen, ob Kontrastmodus aktiv ist
if (localStorage.getItem("contrastMode") === "true") {
	document.documentElement.classList.add("contrast");
	document.addEventListener("DOMContentLoaded", () => {
		const contrastBtn = document.getElementById("contrast-btn");
		if (contrastBtn) contrastBtn.innerText = "🕶️";
	});
}
