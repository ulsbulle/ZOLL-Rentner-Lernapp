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

// Macht die Funktion global für das onchange="importCSV(this)" im HTML verfügbar
window.importCSV = function(input) {
    if (input.files && input.files.length > 0) {
        verarbeiteCSVDatei(input.files[0]);
    }
};

// Globale Funktionen für Drag & Drop Events aus dem HTML
window.handleDragOverCSV = function(e) {
    e.preventDefault();
    const dropZone = document.getElementById("drop-zone-csv");
    if (dropZone) dropZone.classList.add("border-emerald-500", "bg-emerald-100");
};

window.handleDragLeaveCSV = function(e) {
    const dropZone = document.getElementById("drop-zone-csv");
    if (dropZone) dropZone.classList.remove("border-emerald-500", "bg-emerald-100");
};

window.handleDropCSV = function(e) {
    e.preventDefault();
    const dropZone = document.getElementById("drop-zone-csv");
    if (dropZone) dropZone.classList.remove("border-emerald-500", "bg-emerald-100");
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        verarbeiteCSVDatei(files[0]);
    }
};

// DOMContentLoaded: Startet die UI-Event-Listener nach dem Laden der Seite
document.addEventListener("DOMContentLoaded", () => {
    try { initModusAuswahl(); } catch(e) { console.log("Modus-Auswahl nicht aktiv.", e); }
    try { initDragAndDropVerhalten(); } catch(e) { console.log("D&D Listener-Fehler.", e); }
    
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

        Object.values(sektionenMap).forEach(id => {
            const sektion = document.getElementById(id);
            if (sektion) sektion.classList.add("hidden");
        });

        if (zielSektionId) {
            const zielSektion = document.getElementById(zielSektionId);
            if (zielSektion) zielSektion.classList.remove("hidden");
        }
    });
}

/**
 * Event-Listener für das Drag-and-Drop Feld als Backup zu den Inline-Events
 */
function initDragAndDropVerhalten() {
    const dropZone = document.getElementById("drop-zone-csv");
    if (!dropZone) return;

    dropZone.addEventListener("dragover", window.handleDragOverCSV);
    dropZone.addEventListener("dragleave", window.handleDragLeaveCSV);
    dropZone.addEventListener("drop", window.handleDropCSV);
}

/**
 * Liest die übergebene Datei ein, parst sie über quiz-utils und 
 * initialisiert die QuizEngine fehlerfrei.
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
            const parsedData = parseCSVData(text);

            if (!parsedData || parsedData.length === 0) {
                throw new Error("Die CSV-Datei enthält keine lesbaren Fragen.");
            }

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
