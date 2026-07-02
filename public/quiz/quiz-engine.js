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

        // Brücke für externe Scripte schlagen
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
        
        // Anpassung an index.html: "options" statt "answer-container"
        const answerContainer = document.getElementById("options");
        if (answerContainer) answerContainer.innerHTML = "";
        
        // Blendet den Feedback-Bereich inklusive Weiter-Button aus
        const feedbackArea = document.getElementById("feedback-area");
        if (feedbackArea) feedbackArea.classList.add("hidden");
        
        console.log("Quiz-Statistiken erfolgreich zurückgesetzt.");
    }

    /**
     * Setzt das Quiz mit neuen Daten auf den Anfang zurück
     * @param {Array} data - Array aus Fragen-Objekten
     */
    init(data) {
        this.quizData = data;
        this.resetStats(); 
        this.showQuestion();
    }

    // --- ALIAS ---
    loadQuizData(data) {
        this.init(data);
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

        // 2. UI-Elemente vorbereiten und leeren (Kompatibel mit index.html IDs)
        const questionTextEl = document.getElementById("question-text");
        const answerContainer = document.getElementById("options"); 
        const nextBtn = document.getElementById("next-q-btn"); 
        const feedbackArea = document.getElementById("feedback-area");

        if (questionTextEl) questionTextEl.innerText = currentQuestion.question;
        if (answerContainer) answerContainer.innerHTML = "";
        if (feedbackArea) feedbackArea.classList.add("hidden"); // Wird erst nach Antwort sichtbar

        // Fortschrittsbalken & Zähler aktualisieren (falls im HTML vorhanden)
        const progressBar = document.getElementById("progress-bar");
        const qCount = document.getElementById("q-count");
        if (progressBar && this.quizData.length > 0) {
            progressBar.style.width = `${(this.currentIndex / this.quizData.length) * 100}%`;
        }
        if (qCount) {
            qCount.innerText = `Frage ${this.currentIndex + 1} von ${this.quizData.length}`;
        }

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
                this.currentIndex++;
                this.showQuestion();
        }
    }

    /**
     * Rendert klassische Multiple-Choice-Fragen (Buttons)
     */
    renderChoiceQuestion(questionData, container, nextBtn) {
        questionData.options.forEach((option, index) => {
            const button = document.createElement("button");
            button.className = "quiz-answer-btn w-full text-left p-3 my-2 border rounded-xl transition-all bg-white hover:bg-slate-100 font-medium shadow-sm border-slate-200";
            button.innerText = option;

            button.onclick = () => {
                // Alle Buttons deaktivieren
                Array.from(container.children).forEach(btn => btn.disabled = true);

                // Da in quiz-utils.js 'answer' bei Choice-Fragen ein Array von Indices sein kann:
                const isCorrect = Array.isArray(questionData.answer) 
                    ? questionData.answer.includes(index) 
                    : option.trim() === questionData.answer.trim();

                if (isCorrect) {
                    button.classList.add("bg-green-100", "border-green-500", "text-green-800");
                    this.score++;
                    this.showFeedback(true, "Richtig!");
                } else {
                    button.classList.add("bg-red-100", "border-red-500", "text-red-800");
                    
                    // Richtige Antwort(en) zur Aufklärung grün markieren
                    Array.from(container.children).forEach((btn, btnIdx) => {
                        const isBtnCorrect = Array.isArray(questionData.answer)
                            ? questionData.answer.includes(btnIdx)
                            : btn.innerText.trim() === questionData.answer.trim();
                        
                        if (isBtnCorrect) {
                            btn.classList.add("bg-green-100", "border-green-500", "text-green-800");
                        }
                    });
                    this.showFeedback(false, `Falsch! Die richtige Antwort wäre gewesen: ${questionData.answer}`);
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

        const textParts = questionData.question.split("[___]");
        
        if (textParts.length === 1) {
            const label = document.createElement("p");
            label.className = "mb-3 text-lg";
            label.innerText = questionData.question;
            wrapper.appendChild(label);
        }

        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Antwort eintippen...";
        input.className = "border-2 border-slate-200 p-2 rounded-xl focus:outline-none focus:border-blue-500 text-center text-lg w-64 shadow-sm";

        const submitBtn = document.createElement("button");
        submitBtn.className = "mt-3 block mx-auto bg-blue-600 text-white px-6 py-2 rounded-xl hover:bg-blue-700 transition font-bold shadow";
        submitBtn.innerText = "Antwort prüfen";

        submitBtn.onclick = () => {
            input.disabled = true;
            submitBtn.disabled = true;

            const userAnswer = input.value.trim().toLowerCase();
            const correctAnswer = String(questionData.answer).trim().toLowerCase();

            if (userAnswer === correctAnswer) {
                input.classList.add("bg-green-100", "border-green-500", "text-green-800");
                this.score++;
                this.showFeedback(true, "Ausgezeichnet, das stimmt!");
            } else {
                input.classList.add("bg-red-100", "border-red-500", "text-red-800");
                this.showFeedback(false, `Leider nicht ganz. Richtig ist: ${questionData.answer}`);
            }
            this.prepareNextStep(nextBtn);
        };

        if (textParts.length > 1) {
            const questionTextEl = document.getElementById("question-text");
            if (questionTextEl) questionTextEl.innerText = ""; 
            const phrase = document.createElement("p");
            phrase.className = "text-xl mb-4 text-slate-800 font-medium";
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
        input.className = "border-2 border-slate-200 p-2 rounded-xl focus:outline-none focus:border-blue-500 text-lg w-full max-w-md text-center shadow-sm";

        const submitBtn = document.createElement("button");
        submitBtn.className = "mt-3 block mx-auto bg-blue-600 text-white px-6 py-2 rounded-xl hover:bg-blue-700 transition font-bold shadow";
        submitBtn.innerText = "Antwort absenden";

        submitBtn.onclick = () => {
            input.disabled = true;
            submitBtn.disabled = true;

            const userAnswer = input.value.trim().toLowerCase();
            const correctAnswer = String(questionData.answer).trim().toLowerCase();

            if (userAnswer === correctAnswer) {
                input.classList.add("bg-green-100", "border-green-500", "text-green-800");
                this.score++;
                this.showFeedback(true, "Perfekt beantwortet!");
            } else {
                input.classList.add("bg-red-100", "border-red-500", "text-red-800");
                this.showFeedback(false, `Knapp daneben. Die richtige Antwort ist: ${questionData.answer}`);
            }
            this.prepareNextStep(nextBtn);
        };

        wrapper.appendChild(input);
        wrapper.appendChild(submitBtn);
        container.appendChild(wrapper);
    }

    /**
     * Steuert die Einblendung der Feedback-Area unter den Fragen
     */
    showFeedback(isCorrect, text) {
        const feedbackArea = document.getElementById("feedback-area");
        const feedbackText = document.getElementById("feedback-text");
        if (!feedbackArea || !feedbackText) return;

        feedbackText.innerText = text;
        feedbackArea.classList.remove("hidden", "bg-green-50", "border-green-200", "text-green-800", "bg-red-50", "border-red-200", "text-red-800");

        if (isCorrect) {
            feedbackArea.classList.add("bg-green-50", "border-green-200", "text-green-800");
        } else {
            feedbackArea.classList.add("bg-red-50", "border-red-200", "text-red-800");
        }
    }

    /**
     * Bereitet den "Nächste Frage"-Button vor und steuert die Minispiel-Pausen.
     */
    prepareNextStep(nextBtn) {
        const feedbackArea = document.getElementById("feedback-area");
        if (feedbackArea) feedbackArea.classList.remove("hidden");

        const halfIndex = Math.floor(this.quizData.length / 2);

        // Wenn wir an der Hälfte angekommen sind UND das Spiel noch nicht gespielt wurde
        if (this.currentIndex === halfIndex - 1 && !this.gameDone) {
            if (nextBtn) nextBtn.innerText = "Spielen & Weiter ⚡";
            
            if (nextBtn) nextBtn.onclick = () => {
                this.gameDone = true; 
                this.currentIndex++;  

                // Versteckt den Fragen-Inhalt und schaltet auf das Game-Screen deiner index.html um
                const quizContent = document.getElementById("quiz-content");
                const gameScreen = document.getElementById("game-screen");
                
                if (quizContent) quizContent.classList.add("hidden");
                if (gameScreen) gameScreen.classList.remove("hidden");
            };
        } else {
            if (nextBtn) nextBtn.innerText = "Nächste Frage →";
            if (nextBtn) nextBtn.onclick = () => {
                this.currentIndex++;
                this.showQuestion();
            };
        }
    }

    /**
     * Zeigt das Endergebnis des Quizzes passend zur Struktur deiner index.html
     */
    showResults() {
        const quizContent = document.getElementById("quiz-content");
        const resultScreen = document.getElementById("result-screen");
        const scoreDisplay = document.getElementById("score-display");

        if (quizContent) quizContent.classList.add("hidden");
        if (resultScreen) resultScreen.classList.remove("hidden");
        
        if (scoreDisplay) {
            scoreDisplay.innerText = `${this.score} von ${this.quizData.length} Fragen richtig beantwortet!`;
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
