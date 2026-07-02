/**
 * QUIZ UI MANAGER
 * Steuert die gesamte Benutzeroberfläche des Quizzes, den CSV-Import/Export,
 * Drag-and-Drop-Dateihandling sowie die Umschaltung zwischen Spieler- und Admin-Modus.
 */

import { QuizEngine } from "./quiz-engine.js";
import { parseCSVData, generateCSVString } from "./quiz-utils.js";

// Globale Instanz der QuizEngine erstellen
const quizEngine = new QuizEngine();

// Globale Brücken für HTML-Inlines und die game-ui.js schlagen
window.quizEngine = quizEngine;
window.quizApp = quizEngine;
window.loadQuizData = (data) => quizEngine.loadQuizData(data);
window.initQuiz = (data) => quizEngine.init(data);

// DOMContentLoaded: Startet die UI-Event-Listener nach dem Laden der Seite
document.addEventListener("DOMContentLoaded", () => {
    // Jede Funktion ist einzeln gekapselt. Existiert ein Element auf einer 
    // Unterseite nicht, bricht nicht mehr das gesamte UI-Skript ab!
    try { initModusUmschaltung(); } catch(e) { console.log("Modus-Umschaltung nicht aktiv."); }
    try { initDragAndDrop(); } catch(e) { console.log("Drag & Drop nicht aktiv."); }
    try { initCsvDateiHandler(); } catch(e) { console.log("CSV-Handler nicht aktiv."); }
    try { initDropdownsUndNavigation(); } catch(e) { console.log("Navigation/Dropdowns nicht aktiv."); }
    
    // Historie beim Start einmalig rendern (falls vorhanden)
    if (typeof window.renderHistory === "function") {
        try { window.renderHistory(); } catch(e) { console.error(e); }
    }
});

/**
 * Universelle Navigations- und Dropdown-Steuerung (Trainingszone, Tabs etc.)
 */
function initDropdownsUndNavigation() {
    // 1. Dropdown-Menü Steuerung
    const dropdownBtn = document.querySelector(".dropdown-trigger") || document.getElementById("dropdown-btn");
    const dropdownMenu = document.querySelector(".dropdown-menu") || document.getElementById("dropdown-menu");

    if (dropdownBtn && dropdownMenu) {
        dropdownBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            dropdownMenu.classList.toggle("hidden");
        });
        
        // Schließen, wenn man irgendwo anders hinklickt
        document.addEventListener("click", () => {
            dropdownMenu.classList.add("hidden");
        });
    }

    // 2. ZONEN / TAB-UMSCHALTUNG (Trainingszone, Hauptmenü etc.)
    // Sucht nach allen Elementen mit dem Attribut data-target="..."
    const navLinks = document.querySelectorAll("[data-target]");
    navLinks.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const targetId = link.getAttribute("data-target");
            
            // Alle Zonen/Bereiche verstecken, die die Klasse 'quiz-zone' oder 'bereich' haben
            document.querySelectorAll(".quiz-zone, .bereich, #bereich-spieler, #bereich-admin").forEach(zone => {
                zone.classList.add("hidden");
            });
            
            // Ziel-Zone (z.B. Trainingszone) anzeigen
            const targetZone = document.getElementById(targetId);
            if (targetZone) {
                targetZone.classList.remove("hidden");
            }
        });
    });
}

/**
 * Steuert den Wechsel zwischen dem "Spieler-Modus" und dem "Admin-Modus".
 */
function initModusUmschaltung() {
    const btnSpieler = document.getElementById("btn-modus-spieler");
    const btnAdmin = document.getElementById("btn-modus-admin");
    const bereichSpieler = document.getElementById("bereich-spieler");
    const bereichAdmin = document.getElementById("bereich-admin");

    if (!btnSpieler || !btnAdmin || !bereichSpieler || !bereichAdmin) return;

    btnSpieler.addEventListener("click", () => {
        btnSpieler.classList.add("bg-blue-600", "text-white");
        btnSpieler.classList.remove("bg-gray-200", "text-gray-700");
        btnAdmin.classList.add("bg-gray-200", "text-gray-700");
        btnAdmin.classList.remove("bg-blue-600", "text-white");

        bereichSpieler.classList.remove("hidden");
        bereichAdmin.classList.add("hidden");
    });

    btnAdmin.addEventListener("click", () => {
        btnAdmin.classList.add("bg-blue-600", "text-white");
        btnAdmin.classList.remove("bg-gray-200", "text-gray-700");
        btnSpieler.classList.add("bg-gray-200", "text-gray-700");
        btnSpieler.classList.remove("bg-blue-600", "text-white");

        bereichAdmin.classList.remove("hidden");
        bereichSpieler.classList.add("hidden");
    });
}

/**
 * Richtet das Drag-and-Drop-Feld für den CSV-Import ein.
 */
function initDragAndDrop() {
    const dropZone = document.getElementById("csv-drop-zone");
    const fileInput = document.getElementById("csv-file-input");

    if (!dropZone || !fileInput) return;

    // Klick auf die Zone öffnet den Standard-Dateidialog
    dropZone.addEventListener("click", () => fileInput.click());

    // Drag-Over-Effekte
    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("border-blue-500", "bg-blue-50");
    });

    ["dragleave", "drop"].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove("border-blue-500", "bg-blue-50");
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
 * Reagiert auf die klassische Dateiauswahl über das <input type="file">-Feld.
 */
function initCsvDateiHandler() {
    const fileInput = document.getElementById("csv-file-input");
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
 * initialisiert die QuizEngine fehlerfrei über den globalen Scope.
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
                
                // Visuelles Feedback für den Admin
                const statusText = document.getElementById("csv-status-text");
                if (statusText) {
                    statusText.innerHTML = `✅ <strong>${parsedData.length} Fragen</strong> erfolgreich geladen! Wechsel zum Spieler-Modus, um zu starten.`;
                    statusText.className = "text-green-600 font-medium mt-2 text-center";
                }
            } else {
                console.error("QuizEngine ist im globalen Fenster-Scope nicht definiert.");
                alert("Fehler: Die Quiz-Engine konnte nicht erreicht werden.");
            }

        } catch (error) {
            console.error("quiz-ui.js: CSV-Import fehlgeschlagen:", error);
            
            const statusText = document.getElementById("csv-status-text");
            if (statusText) {
                statusText.innerText = `❌ Fehler beim Laden der CSV: ${error.message}`;
                statusText.className = "text-red-600 font-medium mt-2 text-center";
            }
        }
    };

    reader.readAsText(file);
}

/**
 * Rendert die bisherigen Spielergebnisse aus dem LocalStorage in die Admin-Übersicht.
 * Wird als globale Funktion registriert, damit auch die quiz-engine.js darauf zugreifen kann.
 */
window.renderHistory = function() {
    const historyContainer = document.getElementById("quiz-history-list");
    if (!historyContainer) return;

    try {
        const history = JSON.parse(localStorage.getItem("quiz_history") || "[]");
        
        if (history.length === 0) {
            historyContainer.innerHTML = `<li class="text-gray-500 italic text-center p-3">Noch keine Spiele absolviert.</li>`;
            return;
        }

        // Die neuesten Ergebnisse zuerst anzeigen
        historyContainer.innerHTML = history.reverse().map(entry => `
            <li class="flex justify-between items-center p-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                <span class="text-gray-600 text-sm">${entry.date}</span>
                <span class="font-bold text-blue-600">${entry.score} / ${entry.total} Richtige</span>
            </li>
        `).join('');

    } catch (e) {
        console.error("Fehler beim Rendern der Historie:", e);
        historyContainer.innerHTML = `<li class="text-red-500 italic text-center p-3">Historie konnte nicht geladen werden.</li>`;
    }
};
