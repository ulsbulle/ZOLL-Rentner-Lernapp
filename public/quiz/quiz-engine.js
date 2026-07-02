/**
 * QUIZ ENGINE
 * Steuert den Zustand des Quizzes, validiert Antworten (Multiple-Choice, 
 * Lückentext, Freitext) und verwaltet die Minispiel-Pausen sowie Resets.
 */
export class QuizEngine {
    constructor() {
        // Kern-Datenstrukturen
        this.quizData = [];        // Enthält alle geladenen Fragen aus der CSV
        this.currentIndex = 0;     // Aktueller Frage-Index
        this.score = 0;            // Punktzahl des Spielers
        this.gameDone = false;     // Marker, ob das Minispiel bereits absolviert wurde

        // --- DIE RETTUNG FÜR DEN ABSTURZ ---
        // game-ui.js sucht beim Beenden des Minispiels stur nach "window.quizApp".
        // Indem wir uns hier selbst zuweisen, weiß das Spiel, wen es aufrufen muss!
        window.quizApp = this;
        window.quizEngine = this;
    }

    /**
     * Setzt die Statistiken der Engine zurück.
     * Wird vom CSV-Loader/UI aufgerufen, um vor dem Laden neuer Fragen alles zu nullen.
     */
    resetStats() {
        this.currentIndex = 0;
        this.score = 0;
        this.gameDone = false;
        
        // UI-Komponenten bei einem Reset leeren/vorsorglich verstecken
        const answerContainer = document.getElementById("answer-container");
        if (answerContainer) answerContainer.innerHTML = "";
        
        const nextBtn = document.getElementById("next-question-btn");
        if (nextBtn) nextBtn.classList.add("hidden");
        
        console.log("Quiz-Statistiken erfolgreich zurückgesetzt.");
    }

    /**
     * Setzt das Quiz mit neuen Daten auf den Anfang zurück
     * @param {Array} data - Array aus Fragen-Objekten
     */
    init(data) {
        this.quizData = data;
        this.resetStats(); // Nutzt die neue resetStats-Logik für einen sauberen Start
        this.showQuestion();
    }

    /**
     * Kern-Methode: Bereitet die UI vor und entscheidet anhand des Typs, 
     * wie die Frage gerendert werden soll.
     */
    showQuestion() {
        // 1. Prüfen, ob das Quiz vorbei ist
        if (this.currentIndex >= this.quizData.length) {
            this.showResults();
            return;
        }

        const currentQuestion = this.quizData[this.currentIndex];

        // 2. UI-Elemente vorbereiten und leeren
        const questionTextEl = document.getElementById("question-text");
        const answerContainer = document.getElementById("answer-container");
        const nextBtn = document.getElementById("next-question-btn");

        if (questionTextEl) questionTextEl.innerText = currentQuestion.question;
        if (answerContainer) answerContainer.innerHTML = "";
        if (nextBtn) nextBtn.classList.add("hidden"); // Wird erst nach Antwort-Abgabe sichtbar

        // 3. Dynamische Weiche je nach Fragetyp aus der CSV
        switch (currentQuestion.type) {
            case "choice":
                this.renderChoiceQuestion(currentQuestion, answerContainer, nextBtn);
                break;
            case "cloze":
                this.renderClozeQuestion(currentQuestion, answerContainer, nextBtn);
                break;
            case "text":
                this.renderTextQuestion(currentQuestion, answerContainer, nextBtn);
                break;
            default:
                console.error("Unbekannter Fragetyp:", currentQuestion.type);
                // Fehlertoleranz: Springe zur nächsten Frage, falls CSV fehlerhaft
                this.currentIndex++;
                this.showQuestion();
        }
    }

    /**
     * Rendet klassische Multiple-Choice-Fragen (Buttons)
     */
    renderChoiceQuestion(questionData, container, nextBtn) {
        questionData.options.forEach(option => {
            const button = document.createElement("button");
            button.className = "quiz-answer-btn w-full text-left p-3 my-2 border rounded transition-colors bg-white hover:bg-gray-100";
            button.innerText = option;

            button.onclick = () => {
                // Alle Buttons deaktivieren, um Mehrfachklicks zu verhindern
                Array.from(container.children).forEach(btn => btn.disabled = true);

                // Antwort prüfen
                if (option.trim() === questionData.answer.trim()) {
                    button.classList.add("bg-green-200", "border-green-500");
                    this.score++;
                } else {
                    button.classList.add("bg-red-200", "border-red-500");
                    // Richtige Antwort zur Aufklärung grün markieren
                    Array.from(container.children).forEach(btn => {
                        if (btn.innerText.trim() === questionData.answer.trim()) {
                            btn.classList.add("bg-green-200", "border-green-500");
                        }
                    });
                }
                this.prepareNextStep(nextBtn);
            };
            container.appendChild(button);
        });
    }

    /**
     * Rendert Lückentext-Fragen. Ersetzt ein Platzhalter-Wort im Text durch ein Input-Feld.
     */
    renderClozeQuestion(questionData, container, nextBtn) {
        const wrapper = document.createElement("div");
        wrapper.className = "p-4 w-full text-center";

        // Wir nutzen das Feld 'question' für den Text mit der Lücke (z.B. "Die Hauptstadt von Deutschland ist [___].")
        const textParts = questionData.question.split("[___]");
        
        // Wenn kein Platzhalter da ist, setzen wir das Input-Feld einfach ans Ende
        if (textParts.length === 1) {
            const label = document.createElement("p");
            label.className = "mb-3 text-lg";
            label.innerText = questionData.question;
            wrapper.appendChild(label);
        }

        // Input-Feld für die Lücke erstellen
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Antwort hier eintippen...";
        input.className = "border-2 border-gray-300 p-2 rounded focus:outline-none focus:border-blue-500 text-center text-lg w-64";

        // Bestätigungs-Button für das Textfeld
        const submitBtn = document.createElement("button");
        submitBtn.className = "mt-3 block mx-auto bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition";
        submitBtn.innerText = "Antwort prüfen";

        submitBtn.onclick = () => {
            input.disabled = true;
            submitBtn.disabled = true;

            const userAnswer = input.value.trim().toLowerCase();
            const correctAnswer = questionData.answer.trim().toLowerCase();

            if (userAnswer === correctAnswer) {
                input.classList.add("bg-green-100", "border-green-500");
                this.score++;
            } else {
                input.classList.add("bg-red-100", "border-red-500");
                // Feedback über die richtige Antwort einblenden
                const feedback = document.createElement("p");
                feedback.className = "text-green-600 font-bold mt-2";
                feedback.innerText = `Richtige Antwort: ${questionData.answer}`;
                wrapper.appendChild(feedback);
            }
            this.prepareNextStep(nextBtn);
        };

        // Zusammenbauen (Falls Lücke da war, Input dazwischensetzen)
        if (textParts.length > 1) {
            document.getElementById("question-text").innerText = ""; // Alten Text leeren
            const phrase = document.createElement("p");
            phrase.className = "text-xl mb-4";
            phrase.appendChild(document.createTextNode(textParts[0]));
            phrase.appendChild(input);
            phrase.appendChild(document.createTextNode(textParts[1]));
            wrapper.appendChild(phrase);
        } else {
            wrapper.appendChild(input);
        }

        wrapper.appendChild(submitBtn);
        container.appendChild(wrapper);
    }

    /**
     * Rendert Freitext-Fragen mit einem offenen Textfeld
     */
    renderTextQuestion(questionData, container, nextBtn) {
        const wrapper = document.createElement("div");
        wrapper.className = "p-4 w-full text-center";

        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Deine Antwort...";
        input.className = "border-2 border-gray-300 p-2 rounded focus:outline-none focus:border-blue-500 text-lg w-full max-w-md text-center";

        const submitBtn = document.createElement("button");
        submitBtn.className = "mt-3 block mx-auto bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition";
        submitBtn.innerText = "Antwort absenden";

        submitBtn.onclick = () => {
            input.disabled = true;
            submitBtn.disabled = true;

            const userAnswer = input.value.trim().toLowerCase();
            const correctAnswer = questionData.answer.trim().toLowerCase();

            if (userAnswer === correctAnswer) {
                input.classList.add("bg-green-100", "border-green-500");
                this.score++;
            } else {
                input.classList.add("bg-red-100", "border-red-500");
                const feedback = document.createElement("p");
                feedback.className = "text-green-600 font-bold mt-2";
                feedback.innerText = `Richtige Antwort: ${questionData.answer}`;
                wrapper.appendChild(feedback);
            }
            this.prepareNextStep(nextBtn);
        };

        wrapper.appendChild(input);
        wrapper.appendChild(submitBtn);
        container.appendChild(wrapper);
    }

    /**
     * Bereitet den "Nächste Frage"-Button vor und schaltet bei der Hälfte 
     * der Fragen die Minispiel-Option scharf.
     */
    prepareNextStep(nextBtn) {
        nextBtn.classList.remove("hidden");

        // Berechnung der Quiz-Hälfte für das Minispiel
        const halfIndex = Math.floor(this.quizData.length / 2);

        // Wenn wir an der Hälfte angekommen sind UND das Spiel noch nicht gespielt wurde
        if (this.currentIndex === halfIndex - 1 && !this.gameDone) {
            nextBtn.innerText = "Spielen & Weiter ⚡";
            
            nextBtn.onclick = () => {
                this.gameDone = true; // Markieren, damit es nicht in eine Dauerschleife gerät
                this.currentIndex++;  // JETZT den Index erhöhen, damit nach dem Spiel die nächste Frage lädt!

                // Quiz-Oberfläche ausblenden
                document.getElementById("quiz-content").classList.add("hidden");
                
                // Trigger an das UI-Skript senden, um das Minispiel-Auwahlmenü zu öffnen
                const gameArea = document.getElementById("active-game-area");
                const gameSelection = document.getElementById("quiz-game-selection");
                
                if (gameSelection) gameSelection.classList.remove("hidden");
                if (gameArea) gameArea.classList.remove("hidden");
            };
        } else {
            // Regulärer Ablauf für normale Fragen
            nextBtn.innerText = "Nächste Frage →";
            nextBtn.onclick = () => {
                this.currentIndex++;
                this.showQuestion();
            };
        }
    }

    /**
     * Zeigt das Endergebnis des Quizzes und trägt es in die Historie ein
     */
    showResults() {
        const questionTextEl = document.getElementById("question-text");
        const answerContainer = document.getElementById("answer-container");
        const nextBtn = document.getElementById("next-question-btn");

        if (questionTextEl) questionTextEl.innerText = "Quiz beendet!";
        if (nextBtn) nextBtn.classList.add("hidden");

        if (answerContainer) {
            answerContainer.innerHTML = `
                <div class="text-center p-5">
                    <p class="text-2xl mb-4">Du hast <strong>${this.score}</strong> von <strong>${this.quizData.length}</strong> Fragen richtig beantwortet!</p>
                    <button onclick="window.location.reload()" class="bg-green-500 text-white px-6 py-3 rounded-lg font-bold hover:bg-green-600 transition shadow">
                        Neues Quiz starten 🔄
                    </button>
                </div>
            `;
        }

        // Ergebnis im LocalStorage für die Bestenliste speichern
        try {
            const history = JSON.parse(localStorage.getItem("quiz_history") || "[]");
            history.push({
                date: new Date().toLocaleString(),
                score: this.score,
                total: this.quizData.length
            });
            localStorage.setItem("quiz_history", JSON.stringify(history));
            if (typeof window.renderHistory === "function") window.renderHistory();
        } catch (e) {
            console.error("Fehler beim Speichern der Historie:", e);
        }
    }
}
