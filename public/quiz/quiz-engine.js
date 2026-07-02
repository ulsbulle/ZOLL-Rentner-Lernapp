// Quizengine und Logik
// ------------------------------

import { shuffleArray, toBase64 } from "./quiz-utils.js";

export class QuizEngine {
	constructor() {
		this.quizData = [];
		this.currentIndex = 0;
		this.score = 0;
		this.userMistakes = [];
		this.gameDone = false;
	}

	resetStats() {
		this.currentIndex = 0;
		this.score = 0;
		this.userMistakes = [];
		this.gameDone = false;
	}

	// =========================================================================
	// NEU: HILFSFUNKTIONEN FÜR TEXTPRÜFUNG & FEHLERTOLERANZ (Levenshtein-Distanz)
	// =========================================================================
	getLevenshteinDistance(a, b) {
		const an = a ? a.length : 0;
		const bn = b ? b.length : 0;
		if (an === 0) return bn;
		if (bn === 0) return an;
		const matrix = Array.from({ length: an + 1 }, (_, i) => Array(bn + 1).fill(i));
		for (let j = 0; j <= bn; j++) matrix[0][j] = j;

		for (let i = 1; i <= an; i++) {
			for (let j = 1; j <= bn; j++) {
				const cost = a[i - 1] === b[j - 1] ? 0 : 1;
				matrix[i][j] = Math.min(
					matrix[i - 1][j] + 1,      // Deletion
					matrix[i][j - 1] + 1,      // Insertion
					matrix[i - 1][j - 1] + cost // Substitution
				);
			}
		}
		return matrix[an][bn];
	}

	checkTextAnswer(userInput, correctInput) {
		const user = userInput.trim().toLowerCase();
		const correct = correctInput.trim().toLowerCase();

		if (user === correct) {
			return { status: "correct" };
		}

		const distance = this.getLevenshteinDistance(user, correct);
		// Toleranzgrenze: Erlaube 1 Fehler bei kurzen Wörtern (<6 Zeichen), sonst max. 2 Fehler
		const allowedTypos = correct.length < 6 ? 1 : 2;

		if (distance <= allowedTypos) {
			return { status: "almost" };
		}

		return { status: "wrong" };
	}

	// --- Core Quiz Flow ---
	// KI-Quiz generieren (Server-Anfrage)
	async startQuizGeneration(file, customPrompt) {
		this.resetStats();
		if (!file) return alert("PDF fehlt!");

		window.toggleCard("status");
		const statusText = document.getElementById("status-text");
		statusText.innerText = "PDF wird analysiert...";

		try {
			const base64 = (await toBase64(file)).split(",")[1];

			//Timeout-Schutz vorbereiten 30 Sektionen
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 30000);

			const res = await fetch("/api/quiz", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					pdfBase64: base64,
					questionCount: document.getElementById("question-count").value,
					customPrompt: customPrompt, // NEU: Wird an das Backend gesendet
				}),
			});

			clearTimeout(timeoutId); // Timeout löschen, da Antwort kam

			// PRÜFUNG: War der Server-Antwort-Status erfolgreich?
			if (!res.ok) {
				let errorMsg = "Server-Fehler";
				if (res.status === 413) errorMsg = "Die PDF-Datei ist zu groß für die KI-Analyse.";
				if (res.status === 504 || res.status === 500) errorMsg = "Der Server antwortet nicht (Timeout).";
				throw new Error(errorMsg);
			}

			// NEU / GEFIXT:
			let data = await res.json();

			// PDF-ERGEBNISSE MISCHEN ---
			shuffleArray(data); // Fragen-Reihenfolge würfeln
			data.forEach((q) => {
				// NEU: Nur mischen, wenn es sich um klassisches Multiple-Choice handelt
				if (!q.type || q.type === "choice") {
					// Sicherheitsprüfung: Falls die KI nur eine Zahl/String statt eines Arrays geliefert hat
					if (!Array.isArray(q.answer)) {
						q.answer = [q.answer];
					}

					const correctTexts = q.answer.map((index) => q.options[index]); // Richtige Antwort sichern
					shuffleArray(q.options); // Antwortmöglichkeiten würfeln
					q.answer = correctTexts.map((text) => q.options.indexOf(text)); // Index neu setzen
				}
			});

			this.quizData = data; // Gemischte Daten speichern
			window.toggleCard("quiz-container");
			this.showQuestion();
		} catch (err) {
			// Differenzierte Fehlermeldung
			let userMessage = "Fehler: ";
			if (err.name === "AbortError") {
				userMessage += "Die Analyse dauert zu lange. Versuche es mit einer kleineren PDF.";
			} else {
				userMessage += err.message;
			}

			console.error("Quiz-Error:", err); // Für Entwickler in der Konsole
			alert(userMessage); // Für den Endnutzer
			window.goToHome();
		}
	}

	loadQuizData(data) {
		if (!data) {
			window.goToHome();
			return;
		}
		this.quizData = data;
		window.toggleCard("quiz-container");
		this.showQuestion();
	}

	// Anzeige der aktuellen Frage
	showQuestion() {
		if (this.currentIndex >= this.quizData.length) {
			this.showRes();
			return;
		}

		document.getElementById("quiz-content").classList.remove("hidden");
		document.getElementById("game-screen").classList.add("hidden");
		document.getElementById("feedback-area").classList.add("hidden");
		document.getElementById("result-screen").classList.add("hidden");

		const q = this.quizData[this.currentIndex];
		
		// NEU: Ermittlung des Fragentyps (Standard: choice)
		const qType = q.type || "choice"; 

		document.getElementById("progress-bar").style.width = `${(this.currentIndex / this.quizData.length) * 100}%`;
		document.getElementById("q-count").innerText = `Frage ${this.currentIndex + 1} von ${this.quizData.length}`;
		
		// NEU: Fragetext anpassen, falls es sich um einen Lückentext handelt
		if (qType === "cloze") {
			document.getElementById("question-text").innerText = q.question.replace("[Lücke]", "______");
		} else {
			document.getElementById("question-text").innerText = q.question;
		}

		const optDiv = document.getElementById("options");
		optDiv.innerHTML = "";

		let selectedAnswers = [];
		let alreadyChecked = false;

		// NEU: Fallunterscheidung beim Rendern nach Fragentyp
		if (qType === "choice") {
			// Falls answer keine Liste ist, wird es zu einer Liste gemacht
			if (!Array.isArray(q.answer)) {
				q.answer = [q.answer];
			}

			q.options.slice(0, 4).forEach((opt, i) => {
				const b = document.createElement("button");

				b.className =
					"option-btn w-full text-left p-4 rounded-xl border-2 border-slate-100 transition-all font-medium bg-white hover:border-blue-200 shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white";

				b.innerHTML = `
					<span class="text-xs bg-slate-100 text-slate-400 px-2 py-1 rounded border border-slate-200 font-mono mr-2 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600">
						Taste ${i + 1}
					</span>
					<span>${opt}</span>
				`;

				b.onclick = () => {
					if (alreadyChecked) return;

					if (selectedAnswers.includes(i)) {
						selectedAnswers = selectedAnswers.filter((x) => x !== i);
						b.classList.remove("border-blue-500", "bg-blue-50", "dark:bg-blue-900/20");
					} else {
						if (selectedAnswers.length < q.answer.length) {
							selectedAnswers.push(i);
							b.classList.add("border-blue-500", "bg-blue-50", "dark:bg-blue-900/20");
						}
					}
				};

				optDiv.appendChild(b);
			});
		} else if (qType === "text" || qType === "cloze") {
			// NEU: Textfeld für Freitext oder Lückentext rendern und fokussieren
			const inputField = document.createElement("input");
			inputField.type = "text";
			inputField.id = "text-answer-input";
			inputField.placeholder = qType === "cloze" ? "Lücke ausfüllen..." : "Deine Antwort eingeben...";
			inputField.className = "w-full p-4 rounded-xl border-2 border-slate-200 focus:border-blue-500 bg-white shadow-sm font-medium mb-4 outline-none text-slate-800 transition-all dark:bg-slate-800 dark:text-white dark:border-slate-700 dark:focus:border-blue-500";
			optDiv.appendChild(inputField);
			inputField.focus();
		}

		const checkBtn = document.createElement("button");
		checkBtn.innerText = "Antwort prüfen";
		checkBtn.className = "w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-md transition-all";

		const checkAnswer = () => {
			if (alreadyChecked) return; // NEU: Doppeltes Absenden verhindern
			alreadyChecked = true;

			checkBtn.disabled = true;

			const feedbackArea = document.getElementById("feedback-area");
			const feedbackText = document.getElementById("feedback-text");
			const nextBtn = document.getElementById("next-q-btn");

			// NEU: Auswertungsvariablen vorbereiten
			let isCorrect = false;
			let isAlmostCorrect = false;
			let rightTexts = "";
			let userGivenText = "";

			if (qType === "choice") {
				document.querySelectorAll(".option-btn").forEach((btn) => (btn.disabled = true));

				const correctAnswers = [...q.answer].sort((a, b) => a - b);
				const userAnswers = [...selectedAnswers].sort((a, b) => a - b);

				isCorrect = JSON.stringify(correctAnswers) === JSON.stringify(userAnswers);

				const buttons = document.querySelectorAll(".option-btn");

				buttons.forEach((btn, index) => {
					if (q.answer.includes(index)) {
						btn.classList.add("border-green-500", "bg-green-50", "dark:bg-green-900/20");
					}

					if (selectedAnswers.includes(index) && !q.answer.includes(index)) {
						btn.classList.add("border-red-500", "bg-red-50", "dark:bg-red-900/20");
					}
				});

				rightTexts = q.answer.map((index) => q.options[index]).join(", ");
				userGivenText = selectedAnswers.map((index) => q.options[index]).join(", ");
			} else {
				// NEU: Auswertung der Text-Eingaben über Levenshtein-Algorithmus
				const inputField = document.getElementById("text-answer-input");
				inputField.disabled = true;
				userGivenText = inputField.value;

				rightTexts = Array.isArray(q.answer) ? q.options[q.answer[0]] : q.answer;

				const result = this.checkTextAnswer(userGivenText, rightTexts);

				if (result.status === "correct") {
					isCorrect = true;
					inputField.classList.add("border-green-500", "bg-green-50", "dark:bg-green-900/20");
				} else if (result.status === "almost") {
					isAlmostCorrect = true;
					inputField.classList.add("border-yellow-500", "bg-yellow-50", "dark:bg-yellow-900/20");
				} else {
					inputField.classList.add("border-red-500", "bg-red-50", "dark:bg-red-900/20");
				}
			}

			// NEU: Feedback-Texte ausgeben (inklusive "fast richtig"-Status)
			if (isCorrect) {
				this.score++;
				feedbackText.innerHTML = "✅ Richtig!";
				feedbackText.className = "text-green-600 font-bold text-center dark:text-green-400";
				if (window.audioEngine) window.audioEngine.playSoundEffect("correct");
			} else if (isAlmostCorrect) {
				this.score += 0.5; // NEU: Halben Punkt für fast richtig geben
				feedbackText.innerHTML = `⚠️ Fast richtig! Hinweis auf Rechtschreibung.<br><span class="text-xs text-slate-500 dark:text-slate-400">Gemeint war: <strong>${rightTexts}</strong></span>`;
				feedbackText.className = "text-yellow-600 font-bold text-center dark:text-yellow-400";
				if (window.audioEngine) window.audioEngine.playSoundEffect("correct");
			} else {
				this.userMistakes.push({
					q: q.question,
					g: userGivenText || "(Keine Eingabe)",
					c: rightTexts,
				});

				feedbackText.innerHTML = `❌ Falsch. Richtig ist: ${rightTexts}`;
				feedbackText.className = "text-red-600 font-bold text-center dark:text-red-400";
				if (window.audioEngine) window.audioEngine.playSoundEffect("wrong");
			}

			feedbackArea.classList.remove("hidden");

			// Berechnen, ob wir genau die Hälfte der Fragen erreicht haben
			const halfQuiz = Math.floor(this.quizData.length / 2);

			// Wenn wir die Hälfte erreicht haben UND das Spiel in dieser Runde noch nicht lief
			if (this.currentIndex === halfQuiz - 1 && halfQuiz > 0 && !this.gameDone) {
				nextBtn.innerText = "Spielen & Weiter ⚡";
				nextBtn.onclick = () => {
					// Keydown-Listener beenden, um Doppel-Enter zu verhindern
					document.onkeydown = null;

					// Wechsel zum Spiel-Bildschirm
					document.getElementById("quiz-content").classList.add("hidden");
					document.getElementById("game-screen").classList.remove("hidden");

					// Flag setzen, damit das Spiel pro Quiz-Durchlauf nur EINMAL triggert
					this.gameDone = true;

					// WICHTIG: currentIndex hier NICHT erhöhen! Das passiert erst, 
			        // wenn der Game-Over-Screen per "Weiter" bestätigt wird.
			        
			        // Falls eine globale Startfunktion für dein Spiel existiert, hier triggern:
			        if (window.startGame) {
			            window.startGame();
			        }
				};
			} else {
				// Normaler Ablauf für alle anderen Fragen
				nextBtn.innerText = "Nächste Frage →";
				nextBtn.onclick = () => {
					this.currentIndex++;
					this.showQuestion();
				};
			}
		};

		checkBtn.onclick = checkAnswer;
		optDiv.appendChild(checkBtn);

		document.onkeydown = (e) => {
			// NEU: Nummerntasten-Steuerung nur für Multiple-Choice aktivieren
			if (qType === "choice" && ["1", "2", "3", "4"].includes(e.key)) {
				const index = parseInt(e.key) - 1;
				const buttons = document.querySelectorAll(".option-btn");

				if (buttons[index] && !buttons[index].disabled) {
					buttons[index].click();
				}
			}

			if (e.key === "Enter") {
				if (document.getElementById("feedback-area").classList.contains("hidden")) {
					checkAnswer();
				} else {
					document.getElementById("next-q-btn").click();
				}
			}
		};
	}

	// Ergebnis-Zusammenfassung anzeigen
	showRes() {
		document.getElementById("quiz-content").classList.add("hidden");
		document.getElementById("result-screen").classList.remove("hidden");
		document.getElementById("progress-bar").style.width = "100%";
		const total = this.quizData.length;
		const percent = Math.round((this.score / total) * 100);
		document.getElementById("score-display").innerText = `${this.score} von ${total} richtig (${percent}%)`;
		const analysis = document.getElementById("mistake-analysis");
		if (this.userMistakes.length > 0) {
			analysis.innerHTML = this.userMistakes
				.map(
					(m) => `
				<div class="mistake-card p-3 bg-white border border-slate-200 rounded-xl text-xs shadow-sm border-l-red-500 dark:bg-slate-800 dark:border-slate-700">
					<p class="font-bold mb-1 text-slate-800 dark:text-slate-200">Frage: ${m.q}</p>
					<p class="text-red-500">❌ Deine Wahl: ${m.g}</p>
					<p class="text-green-600 font-bold dark:text-green-400">✅ Lösung: ${m.c}</p>
				</div>`,
				)
				.join("");
		} else {
			analysis.innerHTML =
				'<div class="text-center p-6 bg-green-50 rounded-2xl border-2 border-green-100 dark:bg-green-950/30 dark:border-green-900"><p class="text-green-600 font-black text-lg dark:text-green-400">PERFEKT! 100% 🌟</p></div>';
		}
		const h = JSON.parse(localStorage.getItem("quiz_history") || "[]");
		h.unshift({ d: new Date().toLocaleDateString(), p: percent });
		localStorage.setItem("quiz_history", JSON.stringify(h.slice(0, 10)));
		window.renderHistory();
	}

	//aktuelles Quiz Neustarten
	restartCurrentQuiz() {
		if (this.quizData.length === 0) return window.goToHome();

		// Alles neu mischen vor dem Neustart
		shuffleArray(this.quizData);
		this.quizData.forEach((q) => {
			// NEU: Nur mischen, falls es sich um eine Choice-Frage handelt
			if (!q.type || q.type === "choice") {
				const correctTexts = q.answer.map((index) => q.options[index]);
				shuffleArray(q.options);
				q.answer = correctTexts.map((text) => q.options.indexOf(text));
			}
		});

		this.resetStats();
		document.getElementById("result-screen").classList.add("hidden");
		document.getElementById("quiz-content").classList.remove("hidden");
		this.showQuestion();
	}
}
