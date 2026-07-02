// =========================================================================
// quiz-utils.js - Hilfsfunktionen für die Quiz-App
// =========================================================================

/**
 * Mischt ein Array zufällig (Fisher-Yates Shuffle)
 * @param {Array} array 
 */
export function shuffleArray(array) {
    if (!Array.isArray(array)) return;
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

/**
 * Konvertiert eine Datei (z.B. PDF) in einen Base64-String
 * @param {File} file 
 * @returns {Promise<string>}
 */
export function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });
}

/**
 * Parst einen CSV-String sicher in ein Quiz-Daten-Array.
 * Unterstützt klassische MC-Fragen sowie die neuen Freitext- und Lückentexte.
 * 
 * @param {string} csvText 
 * @returns {Array} Array von Fragen-Objekten
 */
export function parseCSVData(csvText) {
    try {
        if (!csvText || !csvText.trim()) return [];
        
        const lines = csvText.split("\n");
        if (lines.length <= 1) return [];

        // Header auswerten, um Spalten flexibel und reihenfolgeunabhängig zu finden
        const header = lines[0].split(";").map(h => h.trim().toLowerCase());
        const typeIdx = header.indexOf("type");
        const qIdx = header.indexOf("question");
        const optIdx = header.indexOf("options");
        const ansIdx = header.indexOf("answer");

        const questions = [];

        for (let i = 1; i < lines.length; i++) {
            const currentLine = lines[i].trim();
            if (!currentLine) continue; // Leere Zeilen überspringen

            const columns = currentLine.split(";");
            
            // Schutz vor unvollständigen Zeilen und Zuweisung von Standardwerten
            const type = typeIdx !== -1 && columns[typeIdx] ? columns[typeIdx].trim().toLowerCase() : "choice";
            const question = qIdx !== -1 && columns[qIdx] ? columns[qIdx].trim() : "";
            const rawOptions = optIdx !== -1 && columns[optIdx] ? columns[optIdx].trim() : "";
            const rawAnswer = ansIdx !== -1 && columns[ansIdx] ? columns[ansIdx].trim() : "";

            let options = [];
            let answer = [];

            if (type === "text" || type === "cloze") {
                // Bei Freitext/Lücke bleibt options leer, answer ist der pure Text für die Levenshtein-Prüfung
                options = [];
                answer = rawAnswer; 
            } else {
                // Klassisches Multiple-Choice ("choice")
                options = rawOptions ? rawOptions.split(",").map(o => o.trim()) : [];
                
                // FEHLERSCHUTZ: Sicherstellen, dass rawAnswer existiert und ein String ist, bevor .includes() läuft
                if (rawAnswer) {
                    if (typeof rawAnswer === "string" && rawAnswer.includes(",")) {
                        answer = rawAnswer.split(",").map(a => parseInt(a.trim())).filter(num => !isNaN(num));
                    } else {
                        const parsedNum = parseInt(rawAnswer);
                        answer = !isNaN(parsedNum) ? [parsedNum] : [];
                    }
                } else {
                    answer = [];
                }
            }

            // Nur hinzufügen, wenn zumindest ein Fragetext existiert
            if (question) {
                questions.push({ type, question, options, answer });
            }
        }

        return questions;
    } catch (error) {
        console.error("quiz-utils.js: CSV-Parsing Fehler:", error);
        throw error;
    }
}

/**
 * Generiert aus einem Quiz-Daten-Array einen gültigen CSV-String.
 * Maskiert Semikolons in Texten, um Strukturfehler zu vermeiden.
 * 
 * @param {Array} quizData 
 * @returns {string} CSV-formatiert mit Semikolon-Trennung
 */
export function generateCSVString(quizData) {
    if (!Array.isArray(quizData) || quizData.length === 0) return "type;question;options;answer\n";

    // Header-Zeile mit dem 'type' Feld für volle Kompatibilität
    let csvContent = "type;question;options;answer\n";

    quizData.forEach(q => {
        const type = q.type || "choice";
        // Semikolons in Texten durch Kommas ersetzen, um das CSV-Format nicht zu zerbrechen
        const question = (q.question || "").replace(/;/g, ",");
        
        let optionsStr = "";
        let answerStr = "";

        if (type === "choice") {
            optionsStr = (q.options || []).map(o => o.replace(/;/g, ",")).join(",");
            answerStr = Array.isArray(q.answer) ? q.answer.join(",") : q.answer;
        } else {
            // Für "text" und "cloze" Fragetypen
            optionsStr = "";
            answerStr = typeof q.answer === "string" ? q.answer.replace(/;/g, ",") : (q.answer || "");
        }

        csvContent += `${type};${question};${optionsStr};${answerStr}\n`;
    });

    return csvContent;
}
