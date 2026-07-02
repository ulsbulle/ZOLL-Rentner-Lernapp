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
    // 1. DROPDOWN-MENÜ STEUERUNG
    const dropdownBtn = document.querySelector(".dropdown-trigger") || document.getElementById("dropdown-btn");
    const dropdownMenu = document.querySelector(".dropdown-menu") || document.getElementById("dropdown-menu");

    if (dropdownBtn && dropdownMenu) {
        // Alten Listener entfernen, falls vorhanden, um Doppel-Triggerung zu vermeiden
        dropdownBtn.replaceWith(dropdownBtn.cloneNode(true));
        const cleanDropdownBtn = document.querySelector(".dropdown-trigger") || document.getElementById("dropdown-btn");

        cleanDropdownBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation(); // Verhindert, dass das Dokument-Klick-Event sofort wieder schließt
            dropdownMenu.classList.toggle("hidden");
        });
        
        // Schließen, wenn man irgendwo anders hinklickt
        document.addEventListener("click", (e) => {
            if (!dropdownMenu.contains(e.target) && !cleanDropdownBtn.contains(e.target)) {
                dropdownMenu.classList.add("hidden");
            }
        });
    }

    // 2. ZONEN / TAB-UMSCHALTUNG (Trainingszone, Hauptmenü etc.)
    const navLinks = document.querySelectorAll("[data-target]");
    navLinks.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const targetId = link.getAttribute("data-target");
            const targetZone = document.getElementById(targetId);
            
            if (!targetZone) {
                console.error(`Navigationsziel mit ID '${targetId}' wurde im HTML nicht gefunden!`);
                return;
            }

            // REPARATUR-WEICHE: Wenn wir in den Admin- oder Haupt-Spielermodus wechseln
            if (targetId === "bereich-spieler" || targetId === "bereich-admin") {
                const bereichSpieler = document.getElementById("bereich-spieler");
                const bereichAdmin = document.getElementById("bereich-admin");
                if (bereichSpieler) bereichSpieler.classList.add("hidden");
                if (bereichAdmin) bereichAdmin.classList.add("hidden");
                targetZone.classList.remove("hidden");
            } else {
                // Wenn wir Unterzonen umschalten (z.B. Trainingszone, Quiz-Inhalt, Hauptmenü)
                // Verstecke NUR die echten Inhalts-Zonen, um nicht das Haupt-Layout zu sprengen!
                document.querySelectorAll(".quiz-zone, .bereich-unterseite").forEach(zone => {
                    zone.classList.add("hidden");
                });
                
                // Stelle sicher, dass der übergeordnete Spielerbereich sichtbar ist, falls die Zone darin liegt
                const parentSpieler = targetZone.closest("#bereich-spieler");
                if (parentSpieler) {
                    parentSpieler.classList.remove("hidden");
                    const adminBereich = document.getElementById("bereich-admin");
                    if (adminBereich) adminBereich.classList.add("hidden");
                }

                targetZone.classList.remove("hidden");
            }

            // Dropdown nach Klick auf einen Navigationspunkt automatisch schließen
            if (dropdownMenu) dropdownMenu.classList.add("hidden");
        });
    });
}

/**
 * Steuert den Wechsel zwischen dem "Spieler-Modus" und dem "Admin-Modus" via Buttons.
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
        
        // Zurück zum Hauptmenü/Quiz-Start wechseln im Spielerbereich
        const mainQuizContent = document.getElementById("quiz-content");
        if (mainQuizContent) mainQuizContent.classList.remove("hidden");
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

    dropZone.addEventListener("click", () => fileInput.click());

    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("border-blue-500", "bg-blue-50");
    });

    ["dragleave", "drop"].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove("border-blue-500", "bg-blue-50");
        });
    });

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
