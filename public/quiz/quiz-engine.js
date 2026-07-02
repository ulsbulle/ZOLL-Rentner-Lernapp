// Quizengine und Logik
// ------------------------------

import { shuffleArray, toBase64 } from "./quiz-utils.js";[cite: 1]

export class QuizEngine {
	constructor() {
		this.quizData = [];[cite: 1]
		this.currentIndex = 0;[cite: 1]
		this.score = 0;[cite: 1]
		this.userMistakes = [];[cite: 1]
		this.gameDone = false;[cite: 1]
	}

	resetStats() {
		this.currentIndex = 0;[cite: 1]
		this.score = 0;[cite: 1]
		this.userMistakes = [];[cite: 1]
		this.gameDone = false;[cite: 1]
	}

	// ==========================================
	// // NEU: RECHTSCHREIBPRÜFUNG & KULANZ-LOGIK
	// ==========================================
	
	// Berechnet die minimale Anzahl von Editieroperationen (Einfügen, Löschen, Ersetzen)
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

	// Gleicht die Usereingabe mit der korrekten Antwort ab
	checkTextAnswer(userInput, correctInput) {
		const user = userInput.trim().toLowerCase();
		const correct = correctInput.trim().toLowerCase();

		// Exakt richtig
		if (user === correct) {
			return { status: "correct" };
		}

		const distance = this.getLevenshteinDistance(user, correct);
		// Toleranzgrenze: Erlaube 1 Tippfehler bei kurzen Wörtern (<6 Zeichen), sonst max. 2
		const allowedTypos = correct.length < 6 ? 1 : 2;

		if (distance <= allowedTypos) {
			return { status: "almost", correctOriginal: correctInput };
		}

		return { status: "wrong" };
	}
	// ==========================================

	// --- Core Quiz Flow ---
	async startQuizGeneration(file, customPrompt) {[cite: 1]
		this.resetStats();[cite: 1]
		if (!file) return alert("PDF fehlt!");[cite: 1]

		window.toggleCard("status");[cite: 1]
		const statusText = document.getElementById("status-text");[cite: 1]
		statusText.innerText = "PDF wird analysiert...";[cite: 1]

		try {
			const base64 = (await toBase64(file)).split(",")[1];[cite: 1]

			const controller = new AbortController();[cite: 1]
			const timeoutId = setTimeout(() => controller.abort(), 30000);[cite: 1]

			const res = await fetch("/api/quiz", {[cite: 1]
				method: "POST",[cite: 1]
				headers: { "Content-Type": "application/json" },[cite: 1]
				body: JSON.stringify({[cite: 1]
					pdfBase64: base64,[cite: 1]
					questionCount: document.getElementById("question-count").value,[cite: 1]
					customPrompt: customPrompt,[cite: 1]
				}),[cite: 1]
			});[cite: 1]

			clearTimeout(timeoutId);[cite: 1]

			if (!res.ok) {[cite: 1]
				let errorMsg = "Server-Fehler";[cite: 1]
				if (res.status === 413) errorMsg = "Die PDF-Datei ist zu groß für die KI-Analyse.";[cite: 1]
				if (res.status === 504 || res.status === 500) errorMsg = "Der Server antwortet nicht (Timeout).";[cite: 1]
				throw new Error(errorMsg);[cite: 1]
			}

			let data = await res.json();[cite: 1]

			shuffleArray(data);[cite: 1]
			data.forEach((q) => {[cite: 1]
				// NEU: Nur mischen, falls es sich um eine Choice-Frage mit Optionen handelt
				if (q.options && Array.isArray(q.options)) {
					if (!Array.isArray(q.answer)) {[cite: 1]
						q.answer = [q.answer];[cite: 1]
					}[cite: 1]

					const correctTexts = q.answer.map((index) => q.options[index]);[cite: 1]
					shuffleArray(q.options);[cite: 1]
					q.answer = correctTexts.map((text) => q.options.indexOf(text));[cite: 1]
				}
			});[cite: 1]

			this.quizData = data;[cite: 1]
			window.toggleCard("quiz-container");[cite: 1]
			this.showQuestion();[cite: 1]
		} catch (err) {[cite: 1]
			let userMessage = "Fehler: ";[cite: 1]
			if (err.name === "AbortError") {[cite: 1]
				userMessage += "Die Analyse dauert zu lange. Versuche es mit einer kleineren PDF.";[cite: 1]
			} else {[cite: 1]
				userMessage += err.message;[cite: 1]
			}[cite: 1]

			console.error("Quiz-Error:", err);[cite: 1]
			alert(userMessage);[cite: 1]
			window.goToHome();[cite: 1]
		}[cite: 1]
	}[cite: 1]

	loadQuizData(data) {[cite: 1]
		if (!data) {[cite: 1]
			window.goToHome();[cite: 1]
			return;[cite: 1]
		}[cite: 1]
		this.quizData = data;[cite: 1]
		window.toggleCard("quiz-container");[cite: 1]
		this.showQuestion();[cite: 1]
	}[cite: 1]

	// Anzeige der aktuellen Frage
	showQuestion() {
		if (this.currentIndex >= this.quizData.length) {[cite: 1]
			this.showRes();[cite: 1]
			return;[cite: 1]
		}[cite: 1]

		document.getElementById("quiz-content").classList.remove("hidden");[cite: 1]
		document.getElementById("game-screen").classList.add("hidden");[cite: 1]
		document.getElementById("feedback-area").classList.add("hidden");[cite: 1]
		document.getElementById("result-screen").classList.add("hidden");[cite: 1]

		const q = this.quizData[this.currentIndex];[cite: 1]
		
		// // NEU: Fragentyp auslesen (Fallback auf 'choice')
		const qType = q.type || "choice"; 

		document.getElementById("progress-bar").style.width = `${(this.currentIndex / this.quizData.length) * 100}%`;[cite: 1]
		document.getElementById("q-count").innerText = `Frage ${this.currentIndex + 1} von ${this.quizData.length}`;[cite: 1]
		
		// // NEU: Text-Anpassung bei Lückentexten
		if (qType === "cloze") {
			document.getElementById("question-text").innerText = q.question.replace("[Lücke]", "______");
		} else {
			document.getElementById("question-text").innerText = q.question;[cite: 1]
		}

		const optDiv = document.getElementById("options");[cite: 1]
		optDiv.innerHTML = "";[cite: 1]

		let selectedAnswers = [];[cite: 1]
		let alreadyChecked = false;[cite: 1]

		// // NEU: Bedingte UI-Generierung nach Typ
		if (qType === "choice") {
			if (!Array.isArray(q.answer)) {[cite: 1]
				q.answer = [q.answer];[cite: 1]
			}[cite: 1]

			q.options.slice(0, 4).forEach((opt, i) => {[cite: 1]
				const b = document.createElement("button");[cite: 1]
				b.className = "option-btn w-full text-left p-4 rounded-xl border-2 border-slate-100 transition-all font-medium bg-white hover:border-blue-200 shadow-sm";[cite: 1]
				b.innerHTML = `
					<span class="text-xs bg-slate-100 text-slate-400 px-2 py-1 rounded border border-slate-200 font-mono mr-2">Taste ${i + 1}</span>
					<span>${opt}</span>
				`;[cite: 1]

				b.onclick = () => {[cite: 1]
					if (alreadyChecked) return;[cite: 1]
					if (selectedAnswers.includes(i)) {[cite: 1]
						selectedAnswers = selectedAnswers.filter((x) => x !== i);[cite: 1]
						b.classList.remove("border-blue-500", "bg-blue-50");[cite: 1]
					} else {[cite: 1]
						if (selectedAnswers.length < q.answer.length) {[cite: 1]
							selectedAnswers.push(i);[cite: 1]
							b.classList.add("border-blue-500", "bg-blue-50");[cite: 1]
						}[cite: 1]
					}[cite: 1]
				};[cite: 1]
				optDiv.appendChild(b);[cite: 1]
			});
		} else if (qType === "text" || qType === "cloze") {
			// // NEU: Input-Feld für Freitext und Lückentexte generieren
			const inputField = document.createElement("input");
			inputField.type = "text";
			inputField.id = "text-answer-input";
			inputField.placeholder = qType === "cloze" ? "Lücke ausfüllen..." : "Deine Antwort hier eintippen...";
			inputField.className = "w-full p-4 rounded-xl border-2 border-slate-200 focus:border-blue-500 bg-white shadow-sm font-medium mb-2 outline-none transition-all dark:bg-slate-800 dark:border-slate-700";
			optDiv.appendChild(inputField);
			inputField.focus();
		}

		const checkBtn = document.createElement("button");[cite: 1]
		checkBtn.innerText = "Antwort prüfen";[cite: 1]
		checkBtn.className = "w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl";[cite: 1]

		const checkAnswer = () => {
			// // NEU: Schutz gegen Mehrfachausführung bei Textfragen
			if (alreadyChecked) return; 
			alreadyChecked = true;[cite: 1]

			checkBtn.disabled = true;[cite: 1]

			const feedbackArea = document.getElementById("feedback-area");[cite: 1]
			const feedbackText = document.getElementById("feedback-text");[cite: 1]
			const nextBtn = document.getElementById("next-q-btn");[cite: 1]

			let isCorrect = false;
			let isAlmostCorrect = false; // // NEU
			let rightTexts = "";
			let userGivenText = "";

			// // NEU: Fallunterscheidung bei der Auswertung
			if (qType === "choice") {
				document.querySelectorAll(".option-btn").forEach((btn) => (btn.disabled = true));[cite: 1]
				const correctAnswers = [...q.answer].sort((a, b) => a - b);[cite: 1]
				const userAnswers = [...selectedAnswers].sort((a, b) => a - b);[cite: 1]

				isCorrect = JSON.stringify(correctAnswers) === JSON.stringify(userAnswers);[cite: 1]

				const buttons = document.querySelectorAll(".option-btn");[cite: 1]
				buttons.forEach((btn, index) => {[cite: 1]
					if (q.answer.includes(index)) {[cite: 1]
						btn.classList.add("border-green-500", "bg-green-50");[cite: 1]
					}[cite: 1]
					if (selectedAnswers.includes(index) && !q.answer.includes(index)) {[cite: 1]
						btn.classList.add("border-red-500", "bg-red-50");[cite: 1]
					}[cite: 1]
				});

				rightTexts = q.answer.map((index) => q.options[index]).join(", ");[cite: 1]
				userGivenText = selectedAnswers.map((index) => q.options[index]).join(", ");[cite: 1]
			} else {
				// // NEU: Textbasierte Auswertung mit Rechtschreib-Toleranz
				const inputField = document.getElementById("text-answer-input");
				inputField.disabled = true;
				userGivenText = inputField.value;

				// Falls die Lösung als Index im Array steht, Text holen, ansonsten direkt String nehmen
				const solutionString = Array.isArray(q.answer) ? q.options[q.answer[0]] : q.answer;
				rightTexts = solutionString;

				const evaluation = this.checkTextAnswer(userGivenText, solutionString);

				if (evaluation.status === "correct") {
					isCorrect = true;
					inputField.classList.add("border-green-500", "bg-green-50");
				} else if (evaluation.status === "almost") {
					isAlmostCorrect = true;
					inputField.classList.add("border-yellow-500", "bg-yellow-50");
				} else {
					inputField.classList.add("border-red-500", "bg-red-50");
				}
			}

			// // NEU: Erweitertes Feedback für "fast richtig"
			if (isCorrect) {
				this.score++;[cite: 1]
				feedbackText.innerHTML = "✅ Richtig!";[cite: 1]
				feedbackText.className = "text-green-600 font-bold text-center";[cite: 1]
				if (window.audioEngine) window.audioEngine.playSoundEffect("correct");[cite: 1]
			} else if (isAlmostCorrect) {
				// Teilpunkte (z.B. 0.5) oder voller Punkt je nach Wunsch, hier 1 Punkt aber mit Hinweis:
				this.score++; 
				feedbackText.innerHTML = `⚠️ Fast richtig! Achtung auf die Rechtschreibung: <strong>${rightTexts}</strong>`;
				feedbackText.className = "text-yellow-600 font-bold text-center";
				if (window.audioEngine) window.audioEngine.playSoundEffect("correct"); 
			} else {
				this.userMistakes.push({[cite: 1]
					q: q.question,[cite: 1]
					g: userGivenText || "(Keine Eingabe)", // // MODIFIZIERT
					c: rightTexts,[cite: 1]
				});[cite: 1]

				feedbackText.innerHTML = `❌ Falsch. Richtig ist: ${rightTexts}`;[cite: 1]
				feedbackText.className = "text-red-600 font-bold text-center";[cite: 1]
				if (window.audioEngine) window.audioEngine.playSoundEffect("wrong");[cite: 1]
			}

			feedbackArea.classList.remove("hidden");[cite: 1]

			const halfQuiz = Math.floor(this.quizData.length / 2);[cite: 1]
			if (this.currentIndex === halfQuiz - 1 && halfQuiz > 0 && !this.gameDone) {[cite: 1]
				nextBtn.innerText = "Spielen & Weiter ⚡";[cite: 1]
				nextBtn.onclick = () => {[cite: 1]
					document.onkeydown = null;[cite: 1]
					document.getElementById("quiz-content").classList.add("hidden");[cite: 1]
					document.getElementById("game-screen").classList.remove("hidden");[cite: 1]
					this.gameDone = true;[cite: 1]
					this.currentIndex++;[cite: 1]
				};[cite: 1]
			} else {[cite: 1]
				nextBtn.innerText = "Nächste Frage →";[cite: 1]
				nextBtn.onclick = () => {[cite: 1]
					this.currentIndex++;[cite: 1]
					this.showQuestion();[cite: 1]
				};[cite: 1]
			}[cite: 1]
		};

		checkBtn.onclick = checkAnswer;[cite: 1]
		optDiv.appendChild(checkBtn);[cite: 1]

		document.onkeydown = (e) => {
			// // NEU: Nummerntasten-Trigger nur bei Choice-Fragen erlauben
			if (qType === "choice" && ["1", "2", "3", "4"].includes(e.key)) {[cite: 1]
				const index = parseInt(e.key) - 1;[cite: 1]
				const buttons = document.querySelectorAll(".option-btn");[cite: 1]

				if (buttons[index] && !buttons[index].disabled) {[cite: 1]
					buttons[index].click();[cite: 1]
				}[cite: 1]
			}[cite: 1]

			if (e.key === "Enter") {[cite: 1]
				if (document.getElementById("feedback-area").classList.contains("hidden")) {[cite: 1]
					checkAnswer();[cite: 1]
				} else {[cite: 1]
					document.getElementById("next-q-btn").click();[cite: 1]
				}[cite: 1]
			}[cite: 1]
		};[cite: 1]
	}

	// Ergebnis-Zusammenfassung anzeigen
	showRes() {[cite: 1]
		document.getElementById("quiz-content").classList.add("hidden");[cite: 1]
		document.getElementById("result-screen").classList.remove("hidden");[cite: 1]
		document.getElementById("progress-bar").style.width = "100%";[cite: 1]
		const total = this.quizData.length;[cite: 1]
		const percent = Math.round((this.score / total) * 100);[cite: 1]
		document.getElementById("score-display").innerText = `${this.score} von ${total} richtig (${percent}%)`;[cite: 1]
		const analysis = document.getElementById("mistake-analysis");[cite: 1]
		if (this.userMistakes.length > 0) {[cite: 1]
			analysis.innerHTML = this.userMistakes[cite: 1]
				.map([cite: 1]
					(m) => `
				<div class="mistake-card p-3 bg-white border border-slate-200 rounded-xl text-xs shadow-sm border-l-red-500">
					<p class="font-bold mb-1 text-slate-800">Frage: ${m.q}</p>
					<p class="text-red-500">❌ Deine Wahl: ${m.g}</p>
					<p class="text-green-600 font-bold">✅ Lösung: ${m.c}</p>
				</div>`,[cite: 1]
				)[cite: 1]
				.join("");[cite: 1]
		} else {[cite: 1]
			analysis.innerHTML =[cite: 1]
				'<div class="text-center p-6 bg-green-50 rounded-2xl border-2 border-green-100"><p class="text-green-600 font-black text-lg">PERFEKT! 100% 🌟</p></div>';[cite: 1]
		}[cite: 1]
		const h = JSON.parse(localStorage.getItem("quiz_history") || "[]");[cite: 1]
		h.unshift({ d: new Date().toLocaleDateString(), p: percent });[cite: 1]
		localStorage.setItem("quiz_history", JSON.stringify(h.slice(0, 10)));[cite: 1]
		window.renderHistory();[cite: 2]
	}[cite: 1]

	//aktuelles Quiz Neustarten
	restartCurrentQuiz() {[cite: 1]
		if (this.quizData.length === 0) return window.goToHome();[cite: 1]

		shuffleArray(this.quizData);[cite: 1]
		this.quizData.forEach((q) => {[cite: 1]
			// NEU: Nur Choice-Fragen umstrukturieren beim Neustart
			if (q.options && Array.isArray(q.options)) {
				const correctTexts = q.answer.map((index) => q.options[index]);[cite: 1]
				shuffleArray(q.options);[cite: 1]
				q.answer = correctTexts.map((text) => q.options.indexOf(text));[cite: 1]
			}
		});[cite: 1]

		this.resetStats();[cite: 1]
		document.getElementById("result-screen").classList.add("hidden");[cite: 1]
		document.getElementById("quiz-content").classList.remove("hidden");[cite: 1]
		this.showQuestion();[cite: 1]
	}[cite: 1]
}
