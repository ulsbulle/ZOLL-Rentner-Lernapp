/**
 * QUIZ UI MANAGER
 * Steuert die gesamte Benutzeroberfläche des Quizzes, den CSV-Import,
 * Drag-and-Drop-Dateihandling sowie die Umschaltung der Menü-Modi.
 */

import { QuizEngine } from "./quiz-engine.js";
import { parseCSVData, generateCSVString } from "./quiz-utils.js";

// Globale Instanz der QuizEngine erstellen
const quizEngine = new QuizEngine();

// Globale Brücken für HTML-Inlines und andere Skripte schlagen
window.quizEngine = quizEngine;
window.quizApp = quizEngine;
window.loadQuizData = (data) => quizEngine.loadQuizData(data);
window.initQuiz = (data) => quizEngine.init(data);

// DOMContentLoaded: Startet die UI-Event-Listener nach dem Laden der Seite
document.addEventListener("DOMContentLoaded", () => {
    // Jede Funktion ist einzeln gekapselt, um Abstürze bei fehlenden Elementen zu vermeiden
    try { initModusAuswahl(); } catch(e) { console.log("Modus-Auswahl nicht aktiv.", e); }
    try { initDragAndDrop(); } catch(e) { console.log("Drag & Drop nicht aktiv.", e); }
    try { initCsvDateiHandler(); } catch(e) { console.log("CSV-Handler nicht aktiv.", e); }
    
    // Historie beim Start einmalig rendern (falls vorhanden)
    if (typeof window.renderHistory === "function") {
        try { window.renderHistory(); } catch(e) { console.error(e); }
    }
});

/**
 * Steuert die Umschaltung der Sektionen basierend auf dem <select id="Modus">-Feld.
 */
function initModusAuswahl() {
    const modusSelect = document.getElementById("Modus");
    if (!modusSelect) return;

    // Map, die den Value des Selects mit den IDs der HTML-Sektionen verknüpft
    const sektionenMap = {
        "PDF": "section-pdf",
        "CSV": "section-csv",
        "TEMPLATE": "section-template",
        "TRAINING": "section-training",
        "DOWNLOADS": "section-downloads"
    };

    modusSelect.addEventListener("change", (e) => {
        const ausgewaehlterModus = e.target.value;
        const zielSektionId = sektionenMap[ausgewaehlterModus];

        // 1. Alle Sektionen verstecken
        Object.values(sektionenMap).forEach(id => {
            const sektion = document.getElementById(id);
            if (sektion) {
                sektion.classList.add("hidden");
            }
        });

        // 2. Die ausgewählte Sektion anzeigen
        if (zielSektionId) {
            const zielSektion = document.getElementById(zielSektionId);
            if (zielSektion) {
                zielSektion.classList.remove("hidden");
            }
        }
    });
}

/**
 * Richtet das Drag-and-Drop-Feld für den CSV-Import ein.
 */
function initDragAndDrop() {
    const dropZone = document.getElementById("drop-zone-csv");
    const fileInput = document.getElementById("csv-import");

    if (!dropZone || !fileInput) return;

    // Drag-Over-Effekte
    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("border-emerald-500", "bg-emerald-100");
    });

    ["dragleave", "drop"].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove("border-emerald-500", "bg-emerald-100");
        });
    });

    // Drop-Event abfangen
    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            verarbeiteCSVDatei(files[0]);
        }
    });
}

/**
 * Reagiert auf die klassische Dateiauswahl über das CSV-Input-Feld.
 */
function initCsvDateiHandler() {
    const fileInput = document.getElementById("csv-import");
    if (!fileInput) return;

    fileInput.addEventListener("change", (e) => {
        const files = e.target.files;
        if (files.length > 0) {
            verarbeiteCSVDatei(files[0]);
        }
    });
}

/**
 * Liest die übergebene Datei ein, parst sie über quiz-utils und 
 * initialisiert die QuizEngine fehlerfrei.
 * @param {File} file 
 */
function verarbeiteCSVDatei(file) {
    if (!file.name.endsWith(".csv")) {
        alert("Bitte lade eine gültige .csv-Datei hoch!");
        return;
    }

    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const text = e.target.result;
            
            // CSV-Text in JSON-Struktur umwandeln
            const parsedData = parseCSVData(text);

            if (!parsedData || parsedData.length === 0) {
                throw new Error("Die CSV-Datei enthält keine lesbaren Fragen.");
            }

            // Sicherer Instanz-Zugriff über window
            if (window.quizEngine && typeof window.quizEngine.resetStats === "function") {
                window.quizEngine.resetStats();
                window.quizEngine.init(parsedData);
                
                // Hauptsetup ausblenden und Quiz-Container einblenden
                const setupCard = document.getElementById("setup-card");
                const quizContainer = document.getElementById("quiz-container");
                
                if (setupCard) setupCard.classList.add("hidden");
                if (quizContainer) quizContainer.classList.remove("hidden");
                
                console.log(`${parsedData.length} Fragen erfolgreich aus CSV geladen.`);
            } else {
                console.error("QuizEngine ist im globalen Fenster-Scope nicht definiert.");
                alert("Fehler: Die Quiz-Engine konnte nicht erreicht werden.");
            }

        } catch (error) {
            console.error("quiz-ui.js: CSV-Import fehlgeschlagen:", error);
            alert(`Fehler beim Laden der CSV: ${error.message}`);
        }
    };

    reader.readAsText(file);
}

/**
 * Rendert die bisherigen Spielergebnisse aus dem LocalStorage in die Inhalts-Übersicht.
 */
window.renderHistory = function() {
    const historyContainer = document.getElementById("history-list");
    if (!historyContainer) return;

    try {
        const history = JSON.parse(localStorage.getItem("quiz_history") || "[]");
        
        if (history.length === 0) {
            historyContainer.innerHTML = `<p class="text-slate-400 text-sm italic text-center">Noch keine Spiele absolviert.</p>`;
            return;
        }

        // Die neuesten Ergebnisse zuerst anzeigen
        historyContainer.innerHTML = history.slice().reverse().map(entry => `
            <div class="flex justify-between items-center p-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 transition-colors">
                <span class="text-slate-500 text-xs font-medium">${entry.date}</span>
                <span class="font-extrabold text-blue-600">${entry.score} / ${entry.total} Richtige</span>
            </div>
        `).join('');

    } catch (e) {
        console.error("Fehler beim Rendern der Historie:", e);
        historyContainer.innerHTML = `<p class="text-red-500 italic text-sm text-center">Historie konnte nicht geladen werden.</p>`;
    }
};
