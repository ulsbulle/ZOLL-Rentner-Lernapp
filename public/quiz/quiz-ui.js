// Funktionen für DOM und BOM
// ------------------------------
//Verwaltet die gesamte Benutzeroberfläche, Event-Listener, Themes, PDF-Rendering auf dem Canvas sowie Datei-Ex- und Importe.
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
// Quiz starten
// Globale Verbindungs-Funktionen, um Events an die QuizEngine weiterzuleiten.
window.startQuizGeneration = () => {
	const file = document.getElementById("pdf-file").files[0];
	const customPrompt = document.getElementById("custom-prompt").value;
	window.quizApp.startQuizGeneration(file, customPrompt);
};
window.restartCurrentQuiz = () => window.quizApp.restartCurrentQuiz();

// zurück zu Hauptmenü
// Navigation zurück zum Hauptmenü. Setzt alle Eingabefelder, Datei-Auswahlen und UI-Zustände zurück.
window.goToHome = function () {
	window.quizApp.resetStats();
	window.quizApp.quizData = [];
	window.toggleCard("setup-card");
	const modus = document.getElementById("Modus");
	modus.value = "PDF";
	document.getElementById("section-pdf").classList.remove("hidden");
	document.getElementById("section-csv").classList.add("hidden");
	document.getElementById("section-template").classList.add("hidden");
	document.getElementById("section-devtools").classList.add("hidden");
	document.getElementById("pdf-preview-box").classList.add("hidden");
	document.getElementById("file-name").innerText = "PDF WÄHLEN / DROP";
	document.getElementById("pdf-file").value = "";
	document.getElementById("csv-import").value = "";
	document.getElementById("section-downloads").classList.add("hidden");
};

// Quiz ausblenden-
window.toggleCard = function (id) {
	["setup-card", "status", "quiz-container"].forEach((c) => document.getElementById(c)?.classList.add("hidden"));
	document.getElementById(id)?.classList.remove("hidden");
};

// Download ausblenden
// Blendet die Download-Sektion basierend auf einem Boolean-Wert ein oder aus.
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

// Verlauf rendern
// Liest die letzten 10 Testergebnisse aus dem lokalen Browserspeicher (localStorage) und generiert eine tabellarische Listenansicht im UI.
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
        <div class="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
            <span class="font-bold text-slate-600 dark:text-slate-300 text-sm">${e.d}</span>
            <span class="font-black text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800 px-3 py-1 rounded-lg shadow-sm border border-blue-50 dark:border-blue-900">${e.p}%</span>
        </div>`,
		)
		.join("");
};

// Verlauf löschen
// Löscht die Historie aus dem Speicher und aktualisiert die Ansicht sofort.
window.clearHistory = () => {
	localStorage.removeItem("quiz_history");
	// Liest die letzten 10 Testergebnisse aus dem lokalen Browserspeicher (localStorage) und generiert eine tabellarische Listenansicht im UI.
	window.renderHistory();
};

/** --- AUDIO UI --- **/
// Verwaltet die Sound-Optionen. Ändert das Lautsprecher-Emoji (🔊/🔇) und setzt das globale Volume der Audio-Engine gegenläufig auf 0 oder 1.
function updateMuteUI() {
	const btn = document.getElementById("mute-btn");
	if (btn) btn.innerText = window.isMuted ? "🔇" : "🔊";
	btn.title = window.isMuted ? "Ton einschalten" : "Ton stummschalten";
}

// Speichern der Einstellungen im localStorage
window.toggleMute = function () {
	window.isMuted = !window.isMuted;
	if (window.audioEngine) window.audioEngine.setVolume(window.isMuted ? 0 : 1);
	localStorage.setItem("quiz_muted", window.isMuted);
	updateMuteUI();
};

/** --- PDF VORSCHAU --- **/
// Erzeugt eine Live-Vorschau der hochgeladenen PDF-Datei (1.Seite).
// Funktionsweise: Lädt die Datei via FileReader, füttert die Bibliothek pdf.js damit,
// greift sich die allererste Seite und zeichnet diese skaliert.
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
// Laden lokaler Quiz-Dateien ohne Serververbindung.
// Funktionsweise: Liest eine vom Nutzer ausgewählte CSV-Datei als Text ein,
// konvertiert sie über die Utility-Funktionen in ein JS-Objekt und übergibt sie an die Quiz-Engine.
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

// Exportiert das aktuelle Quiz-Set als CSV-Datei auf die Festplatte des Nutzers.
// Jetzt auch mit der Spalte Typ um die unterschiedlichen Fragen erkennbar zu machne.
// Fragentypen free und cloze sind werden damit beim Re-Import korrekt verarbeitet.
// Für Lückentexte wird das ermittelte Lösungswort automatisch wieder in eckige Klammern gesetzt.
window.exportCSV = function () {
	// Erweitert um das optionale Feld "Typ" zur Typerhaltung
	let csv = "\uFEFFFrage;Option A;Option B;Option C;Option D;Antwort;Typ\n";
	window.quizApp.quizData.forEach((q) => {
		const type = q.type || "multiple";
		let questionStr = q.question.replace(/"/g, '""');
		let optA = q.options && q.options[0] ? q.options[0].replace(/"/g, '""') : "";
		let optB = q.options && q.options[1] ? q.options[1].replace(/"/g, '""') : "";
		let optC = q.options && q.options[2] ? q.options[2].replace(/"/g, '""') : "";
		let optD = q.options && q.options[3] ? q.options[3].replace(/"/g, '""') : "";

		let ansField = "";
		if (type === "multiple") {
			ansField = q.answer.join(",");
		} else if (type === "free") {
			ansField = (q.correct_text || "").replace(/"/g, '""');
		} else if (type === "cloze") {
			const m = q.question.match(/\[(.*?)\]/);
			ansField = m ? m[1].replace(/"/g, '""') : (q.correct_text || "").replace(/"/g, '""');
		}

		csv += `"${questionStr}";"${optA}";"${optB}";"${optC}";"${optD}";"${ansField}";"${type}"\n`;
	});
	const b = new Blob([csv], { type: "text/csv;charset=utf-8;" });
	const a = document.createElement("a");
	a.href = URL.createObjectURL(b);
	a.download = "Quiz_Export_Pro.csv";
	a.click();
};

// Lädt serverseitig bereitgestellte Lern-Vorlagen direkt via HTTP-Fetch.
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
		// Navigation zurück zum Hauptmenü. Setzt alle Eingabefelder, Datei-Auswahlen und UI-Zustände auf den Werkszustand zurück.
		window.goToHome();
	}
};

/** --- INITIALISIERUNG --- **/
// Ruft parallel (Promise.all) die API-Endpunkte für Vorlagen und Downloads ab und generiert daraus dynamisch
// Listen mit Download-Buttons oder Direkt-Start-Buttons für CSV-Dateien.
window.loadDownloadFiles = async function () {
	const downloadList = document.getElementById("file-list");
	const downloadList2 = document.getElementById("file2-list");
	const templateList = document.getElementById("template-list");

	try {
		const [resT, resD] = await Promise.all([fetch("/api/files/templates"), fetch("/api/files/downloads")]);

		const templates = await resT.json();
		const downloads = await resD.json();

		if (downloadList) {
			downloadList.innerHTML =
				templates.length > 0
					? templates
							.map(
								(file) => `
                <li class="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                    <span class="text-slate-700 dark:text-slate-300 font-medium truncate">📄 ${file}</span>
                    <a href="/templates/${file}" download class="bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300 px-3 py-1 rounded-md text-xs font-bold hover:bg-blue-600 hover:text-white transition-all">Laden ↓</a>
                </li>
            `,
							)
							.join("")
					: '<li class="text-slate-400 text-sm italic">Keine Lernmaterialien gefunden.</li>';
		}

		if (templateList) {
			const csvFiles = templates.filter((f) => f.toLowerCase().endsWith(".csv"));
			templateList.innerHTML =
				csvFiles.length > 0
					? csvFiles
							.map(
								(file) => `
                <button onclick="loadTemplate('/templates/${file}')" class="w-full p-4 border-2 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-left font-bold transition-all flex justify-between items-center group">
                    <span class="text-slate-900 dark:text-white">📊 ${file.replace(".csv", "")}</span>
                    <span class="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">Starten →</span>
                </button>
            `,
							)
							.join("")
					: '<p class="text-slate-400 text-center">Keine CSV-Vorlagen gefunden.</p>';
		}

		if (downloadList2) {
			downloadList2.innerHTML =
				downloads.length > 0
					? downloads
							.map(
								(file) => `
                <li class="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                    <span class="text-slate-700 dark:text-slate-300 font-medium truncate">📦 ${file}</span>
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

// <-- NEU für Michis Tools
// Lädt die verfügbaren Entwickler-Tools vom Server.
// Funktionsweise: Holt die Tool-Liste ab und rendert Schaltflächen, die beim Klick das jeweilige Werkzeug in einem neuen Browsertab (_blank) öffnen.
// Enthält einen integrierten Fallback für den Fall, dass etwas nicht geladen werden kann.
window.loadDevToolsFiles = async function () {
	const devtoolsList = document.getElementById("devtools-list");
	if (!devtoolsList) return;

	try {
		const response = await fetch("/api/files/tools");

		// Prüfen, ob die Antwort vom Server gültiges JSON ist
		if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
			throw new Error("Server antwortete nicht mit JSON.");
		}

		const tools = await response.json();

		devtoolsList.innerHTML =
			tools.length > 0
				? tools
						.map(
							(file) => `
                <button onclick="window.open('/tools/${file}', '_blank')" class="w-full p-4 border-2 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-left font-bold transition-all flex justify-between items-center group">
                    <span class="text-slate-900 dark:text-white">🛠️ ${file.replace(".html", "").replace(".js", "")}</span>
                    <span class="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">Öffnen →</span>
                </button>
            `,
						)
						.join("")
				: '<p class="text-slate-400 text-center">Keine Entwicklertools gefunden.</p>';
	} catch (error) {
		console.error("Fehler beim Laden der Entwicklertools:", error);
		devtoolsList.innerHTML =
			'<p class="text-slate-400 text-sm italic text-center py-4">Entwicklertools konnten nicht geladen werden. Prüfe den Ordnernamen auf dem Server.</p>';
	}
};
// <-- NEU bis hier

window.onload = () => {
	const modusSelect = document.getElementById("Modus");
	updateMuteUI();

	if (modusSelect) {
		modusSelect.onchange = function () {
			const val = this.value;

			document.getElementById("section-pdf").classList.toggle("hidden", val !== "PDF");
			document.getElementById("section-csv").classList.toggle("hidden", val !== "CSV");
			document.getElementById("section-template").classList.toggle("hidden", val !== "TEMPLATE");
			document.getElementById("section-training").classList.toggle("hidden", val !== "TRAINING");
			document.getElementById("section-downloads").classList.toggle("hidden", val !== "DOWNLOADS");
			document.getElementById("section-devtools").classList.toggle("hidden", val !== "DEVTOOLS");

			if (val === "DOWNLOADS" || val === "TEMPLATE") {
				window.loadDownloadFiles();
			}

			if (val === "DEVTOOLS") {
				// <-- NEU
				window.loadDevToolsFiles(); // <-- NEU
			}

			if (val !== "TRAINING") {
				window.gameActive = false;
				if (typeof window.gameInterval !== "undefined") clearInterval(window.gameInterval);
			}
		};
	}

	window.loadDownloadFiles();

	document.getElementById("section-pdf").classList.remove("hidden");
	document.getElementById("section-csv").classList.add("hidden");
	document.getElementById("section-template").classList.add("hidden");
	document.getElementById("section-training").classList.add("hidden");
	document.getElementById("section-downloads").classList.add("hidden");
	document.getElementById("section-devtools").classList.add("hidden");

	window.renderHistory();
};

document.addEventListener("DOMContentLoaded", () => {
	const modusSelect = document.getElementById("Modus");
	if (modusSelect) {
		modusSelect.onchange = function () {
			const val = this.value;

			document.getElementById("section-pdf").classList.toggle("hidden", val !== "PDF");
			document.getElementById("section-csv").classList.toggle("hidden", val !== "CSV");
			document.getElementById("section-template").classList.toggle("hidden", val !== "TEMPLATE");
			document.getElementById("section-training").classList.toggle("hidden", val !== "TRAINING");
			document.getElementById("section-downloads").classList.toggle("hidden", val !== "DOWNLOADS");
			document.getElementById("section-devtools").classList.toggle("hidden", val !== "DEVTOOLS");

			if (val === "DOWNLOADS" || val === "TEMPLATE") {
				window.loadDownloadFiles();
			}

			if (this.value !== "TRAINING") {
				window.gameActive = false;
				if (typeof window.gameInterval !== "undefined") clearInterval(window.gameInterval);
			}

			if (val === "DEVTOOLS") {
				// <-- NEU
				window.loadDevToolsFiles(); // <-- NEU
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
		themeBtn.innerText = isDark ? "☀️" : "🌙";
		themeBtn.title = isDark ? "Zu hellem Design wechseln" : "Zu dunklem Design wechseln";
	}
};

// Barrierefreiheits- und Styling-Optionen. Schalten CSS-Klassen (.dark / .contrast)
// auf dem Root-Dokument um und speichern die Nutzerpräferenz dauerhaft im Browser.
window.toggleDarkMode = function () {
	const isDark = document.documentElement.classList.toggle("dark");
	localStorage.setItem("darkMode", isDark);
	window.updateThemeButton(isDark);
};

const savedDarkMode =
	localStorage.getItem("darkMode") === "true" ||
	(!("darkMode" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches);

if (savedDarkMode) {
	document.documentElement.classList.add("dark");
} else {
	document.documentElement.classList.remove("dark");
}

document.addEventListener("DOMContentLoaded", () => {
	const isCurrentlyDark = document.documentElement.classList.contains("dark");
	window.updateThemeButton(isCurrentlyDark);
});

// Barrierefreiheits- und Styling-Optionen. Schalten CSS-Klassen (.dark / .contrast)
// auf dem Root-Dokument um und speichern die Nutzerpräferenz dauerhaft im Browser.
window.toggleContrast = function () {
	const isContrast = document.documentElement.classList.toggle("contrast");
	localStorage.setItem("contrastMode", isContrast);

	const contrastBtn = document.getElementById("contrast-btn");
	if (contrastBtn) {
		contrastBtn.innerText = isContrast ? "🕶️" : "👁️";
		contrastBtn.title = isContrast ? "Zu normalem Modus wechseln" : "Zu Kontrastmodus wechseln";
	}
};

if (localStorage.getItem("contrastMode") === "true") {
	document.documentElement.classList.add("contrast");
	document.addEventListener("DOMContentLoaded", () => {
		const contrastBtn = document.getElementById("contrast-btn");
		if (contrastBtn) contrastBtn.innerText = "🕶️";
	});
}
