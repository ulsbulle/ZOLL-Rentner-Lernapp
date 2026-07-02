// Quiz UI-Steuerung und Event-Handling
// ------------------------------------

import { QuizEngine } from "./quiz-engine.js";
import { parseCSVData, generateCSVString } from "./quiz-utils.js";

// Globale Instanz der QuizEngine erstellen
const quizEngine = new QuizEngine();

// Für globalen Zugriff aus der index.html registrieren
window.quizEngine = quizEngine;

document.addEventListener("DOMContentLoaded", () => {
    initModusUmschaltung();
    initDragAndDrop();
    window.renderHistory();
});

// =========================================================================
// 1. MODUS-UMSCHALTUNG (PDF, CSV, Vorlagen, Training, Downloads)
// =========================================================================
function initModusUmschaltung() {
    const modusSelect = document.getElementById("Modus");
    if (!modusSelect) return;

    modusSelect.addEventListener("change", (e) => {
        const modus = e.target.value;
        
        // Alle Sektionen standardmäßig verstecken
        document.getElementById("section-pdf").classList.add("hidden");
        document.getElementById("section-csv").classList.add("hidden");
        document.getElementById("section-template").classList.add("hidden");
        document.getElementById("section-training").classList.add("hidden");
        document.getElementById("section-downloads").classList.add("hidden");

        // Nur die gewählte Sektion anzeigen
        if (modus === "PDF") document.getElementById("section-pdf").classList.remove("hidden");
        if (modus === "CSV") document.getElementById("section-csv").classList.remove("hidden");
        if (modus === "TEMPLATE") document.getElementById("section-template").classList.remove("hidden");
        if (modus === "TRAINING") document.getElementById("section-training").classList.remove("hidden");
        if (modus === "DOWNLOADS") document.getElementById("section-downloads").classList.remove("hidden");
    });
}

// =========================================================================
// 2. CSV EXPORT & IMPORT (NEU: Unterstützt Choice, Text und Cloze fehlerfrei)
// =========================================================================

// Globaler CSV Export (Aufgerufen über Buttons im Quiz & Result-Screen)
window.exportCSV = () => {
    if (!quizEngine || !quizEngine.quizData || quizEngine.quizData.length === 0) {
        alert("Keine Quizdaten zum Exportieren vorhanden!");
        return;
    }

    // Nutzen der neuen, robusten Maskierungs-Logik aus quiz-utils.js
    const csvContent = generateCSVString(quizEngine.quizData);
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `quiz_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// Globaler CSV Import (Wird getriggert, wenn eine Datei im Input gewählt wird)
window.importCSV = (inputElement) => {
    const file = inputElement.files[0];
    if (!file) return;

    processCSVFile(file);
};

// Interne Verarbeitungslogik für CSV-Dateien
function processCSVFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const text = e.target.result;
            // NEU: Nutzt das erweiterte, fehlertolerante Spalten-Parsing
            const parsedQuestions = parseCSVData(text);

            if (!parsedQuestions || parsedQuestions.length === 0) {
                throw new Error("Die CSV-Datei enthält keine gültigen Fragen oder ein falsches Trennzeichen (erwartet: Semikolon ';').");
            }

            // Statistiken zurücksetzen und Daten direkt in die Engine laden
            quizEngine.resetStats();
            quizEngine.loadQuizData(parsedQuestions);
            
        } catch (error) {
            // Fängt den im Prompt erwähnten Fehler ("Cannot read properties of undefined...") jetzt sicher ab
            console.error("quiz-ui.js: CSV-Import fehlgeschlagen:", error);
            alert("Fehler beim Laden der CSV: " + error.message);
        }
    };
    reader.readAsText(file, "UTF-8");
}

// =========================================================================
// 3. DRAG & DROP HANDLING (Für PDF und CSV)
// =========================================================================
function initDragAndDrop() {
    // PDF Drop-Zone
    window.handleDragOver = (e) => {
        e.preventDefault();
        document.getElementById("drop-zone").classList.add("border-blue-500", "bg-blue-50");
    };

    window.handleDragLeave = (e) => {
        e.preventDefault();
        document.getElementById("drop-zone").classList.remove("border-blue-500", "bg-blue-50");
    };

    window.handleDrop = (e) => {
        e.preventDefault();
        document.getElementById("drop-zone").classList.remove("border-blue-500", "bg-blue-50");
        
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type === "application/pdf") {
            document.getElementById("pdf-file").files = files;
            window.previewPDF(document.getElementById("pdf-file"));
        } else {
            alert("Bitte lade eine gültige PDF-Datei hoch.");
        }
    };

    // CSV Drop-Zone
    window.handleDragOverCSV = (e) => {
        e.preventDefault();
        document.getElementById("drop-zone-csv").classList.add("border-emerald-500", "bg-emerald-100");
    };

    window.handleDragLeaveCSV = (e) => {
        e.preventDefault();
        document.getElementById("drop-zone-csv").classList.remove("border-emerald-500", "bg-emerald-100");
    };

    window.handleDropCSV = (e) => {
        e.preventDefault();
        document.getElementById("drop-zone-csv").classList.remove("border-emerald-500", "bg-emerald-100");
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            processCSVFile(files[0]);
        }
    };
}

// =========================================================================
// 4. KI-GENERIERUNG ANSTRATEN
// =========================================================================
window.startQuizGeneration = () => {
    const fileInput = document.getElementById("pdf-file");
    const file = fileInput.files[0];
    const customPrompt = document.getElementById("custom-prompt").value;

    if (!file) {
        alert("Bitte wähle zuerst eine PDF-Datei aus oder ziehe sie per Drag & Drop in das Feld.");
        return;
    }

    // Engine startet die Server-Anfrage mit dem optionalen Prompt-Zusatz
    quizEngine.startQuizGeneration(file, customPrompt);
};

// =========================================================================
// 5. ALLGEMEINE UI NAVIGATIONS- & HILFSFUNKTIONEN
// =========================================================================

// Zwischen Ansichten/Karten umschalten
window.toggleCard = (cardId) => {
    document.getElementById("setup-card").classList.add("hidden");
    document.getElementById("status").classList.add("hidden");
    document.getElementById("quiz-container").classList.add("hidden");

    document.getElementById(cardId).classList.remove("hidden");
};

// Zurück zum Hauptmenü
window.goToHome = () => {
    // Falls noch Tastatur-Listener aktiv sind, säubern
    document.onkeydown = null;
    
    // Inputs zurücksetzen
    document.getElementById("pdf-file").value = "";
    document.getElementById("file-name").innerText = "PDF W WÄHLEN / DROP";
    document.getElementById("pdf-preview-box").classList.add("hidden");
    
    window.toggleCard("setup-card");
};

// PDF-Vorschau rendern (Nutzt pdf.js aus der index.html)
window.previewPDF = (input) => {
    const file = input.files[0];
    if (!file) return;

    document.getElementById("file-name").innerText = file.name.toUpperCase();

    const fileReader = new FileReader();
    fileReader.onload = function () {
        const typedarray = new Uint8Array(this.result);
        
        pdfjsLib.getDocument(typedarray).promise.then((pdf) => {
            // Erste Seite für die Mini-Vorschau laden
            pdf.getPage(1).then((page) => {
                const canvas = document.getElementById("pdf-canvas");
                const ctx = canvas.getContext("2d");
                const viewport = page.getViewport({ scale: 0.4 });

                canvas.height = viewport.height;
                canvas.width = viewport.width;

                const renderContext = {
                    canvasContext: ctx,
                    viewport: viewport
                };
                
                document.getElementById("pdf-preview-box").classList.remove("hidden");
                page.render(renderContext);
            });
        });
    };
    fileReader.readAsArrayBuffer(file);
};

// Verlauf im LocalStorage auslesen und im UI anzeigen
window.renderHistory = () => {
    const historyList = document.getElementById("history-list");
    if (!historyList) return;

    const history = JSON.parse(localStorage.getItem("quiz_history") || "[]");

    if (history.length === 0) {
        historyList.innerHTML = '<p class="text-slate-400 text-xs italic text-center py-2">Noch keine Ergebnisse aufgezeichnet.</p>';
        return;
    }

    historyList.innerHTML = history
        .map(
            (item) => `
        <div class="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-xs font-medium dark:bg-slate-800 dark:border-slate-700">
            <span class="text-slate-500 dark:text-slate-400">📅 ${item.d}</span>
            <span class="font-bold ${item.p >= 50 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}">${item.p}% richtig</span>
        </div>`
        )
        .join("");
};

// Verlauf leeren
window.clearHistory = () => {
    localStorage.removeItem("quiz_history");
    window.renderHistory();
};

// App-Themes umschalten (Dark Mode / Kontrast)
window.toggleDarkMode = () => {
    document.documentElement.classList.toggle("dark");
    const btn = document.getElementById("theme-btn");
    if (document.documentElement.classList.contains("dark")) {
        btn.innerText = "☀️";
        btn.title = "Zu hellem Design wechseln";
    } else {
        btn.innerText = "🌙";
        btn.title = "Zu dunklem Design wechseln";
    }
};

window.toggleContrast = () => {
    document.body.classList.toggle("contrast-high");
    // Optionale visuelle Anpassung für Barrierefreiheit
};

window.toggleMute = () => {
    if (window.audioEngine) {
        const isMuted = window.audioEngine.toggleMute();
        document.getElementById("mute-btn").innerText = isMuted ? "🔇" : "🔊";
    }
};

// Placeholder-Funktionen für Vorlagen-Liste (Falls vom Server geladen)
// Kann bei Bedarf erweitert werden
window.loadTemplates = async () => {
    const templateList = document.getElementById("template-list");
    if (templateList) {
        templateList.innerHTML = '<p class="text-slate-400 text-sm italic">Keine statischen Server-Vorlagen konfiguriert.</p>';
    }
};
