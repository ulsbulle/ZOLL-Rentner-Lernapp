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

	// Berechnet die Levenshtein-Ähnlichkeit zwischen zwei Texten (0.0 bis 1.0)
	getSimilarity(s1, s2) {
		let longer = s1.toLowerCase().trim();
		let shorter = s2.toLowerCase().trim();
		if (longer.length < shorter.length) {
			let tmp = longer;
			longer = shorter;
			shorter = tmp;
		}
		let longerLength = longer.length;
		if (longerLength === 0) return 1.0;

		let costs = [];
		for (let i = 0; i <= longer.length; i++) {
			let lastValue = i;
			for (let j = 0; j <= shorter.length; j++) {
				if (i === 0) {
					costs[j] = j;
				} else {
					if (j > 0) {
						let newValue = costs[j - 1];
						if (longer.charAt(i - 1) !== shorter.charAt(j - 1)) {
							newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
						}
						costs[j - 1] = lastValue;
						lastValue = newValue;
					}
				}
			}
			if (i > 0) costs[shorter.length] = lastValue;
		}
		return (longerLength - costs[shorter.length]) / parseFloat(longerLength);
	}

	// --- Core Quiz Flow ---
	async startQuizGeneration(file, customPrompt) {
		this.resetStats();
		if (!file) return alert("PDF fehlt!");

		window.toggleCard("status");
		const statusText = document.getElementById("status-text");
		statusText.innerText = "PDF wird analysiert...";

		try {
			const base64 = (await toBase64(file)).split(",")[1];
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 30000);

			const res = await fetch("/api/quiz", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					pdfBase64: base64,
					questionCount: document.getElementById("question-count").value,
					customPrompt: customPrompt,
				}),
			});

			clearTimeout(timeoutId);

			if (!res.ok) {
				let errorMsg = "Server-Fehler";
				if (res.status === 413) errorMsg = "Die PDF-Datei ist zu groß für die KI-Analyse.";
				if (res.status === 504 || res.status === 500) errorMsg = "Der Server antwortet nicht (Timeout).";
				throw new Error(errorMsg);
			}

			let data = await res.json();

			shuffleArray(data);
			data.forEach((q) => {
				if (!q.type) q.type = "multiple";

				if (q.type === "multiple") {
					if (!Array.isArray(q.answer)) {
						q.answer = String(q.answer)
							.split(",")
							.map((x) => parseInt(x.trim()))
							.filter((x) => !isNaN(x));
					}
					const correctTexts = q.answer.map((index) => q.options[index]);
					shuffleArray(q.options);
					q.answer = correctTexts.map((text) => q.options.indexOf(text)).filter((idx) => idx !== -1);
				}
			});

			this.quizData = data;
			window.toggleCard("quiz-container");
			this.showQuestion();
		} catch (err) {
			let userMessage = "Fehler: ";
			if (err.name === "AbortError") {
				userMessage += "Die Analyse dauert zu lange. Versuche es mit einer kleineren PDF.";
			} else {
				userMessage += err.message;
			}
			console.error("Quiz-Error:", err);
			alert(userMessage);
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
		if (!q.type) q.type = "multiple";

		document.getElementById("progress-bar").style.width = `${(this.currentIndex / this.quizData.length) * 100}%`;
		document.getElementById("q-count").innerText =
			`Frage ${this.currentIndex + 1} von ${this.quizData.length} [${q.type.toUpperCase()}]`;

		const optDiv = document.getElementById("options");
		optDiv.innerHTML = "";

		let alreadyChecked = false;
		let checkAnswer = () => {};

		if (q.type === "free") {
			document.getElementById("question-text").innerText = q.question;

			const inputField = document.createElement("input");
			inputField.type = "text";
			inputField.id = "free-text-answer";
			inputField.placeholder = "Deine Antwort hier eingeben...";
			inputField.className =
				"w-full p-4 rounded-xl border-2 border-slate-200 dark:border-slate-600 outline-none font-medium text-lg focus:border-blue-500 shadow-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white";
			optDiv.appendChild(inputField);
			inputField.focus();

			checkAnswer = () => {
				if (alreadyChecked) return;
				alreadyChecked = true;
				inputField.disabled = true;

				const userText = inputField.value.trim();
				const correctText = q.correct_text || "";
				const similarity = this.getSimilarity(userText, correctText);

				let isCorrect = similarity >= 0.88;
				let isAlmostCorrect = !isCorrect && similarity >= 0.68;

				const feedbackText = document.getElementById("feedback-text");

				if (isCorrect || isAlmostCorrect) {
					this.score += isCorrect ? 1 : 0.5;
					inputField.classList.add(
						isCorrect ? "border-green-500" : "border-amber-500",
						isCorrect ? "bg-green-50" : "bg-amber-50",
					);

					feedbackText.innerHTML = isCorrect
						? "✅ Richtig!"
						: `⚠️ Fast richtig (Kleine Abweichung)!<br>Erwartet: <b>${correctText}</b>`;
					feedbackText.className = isCorrect
						? "text-green-600 font-bold text-center"
						: "text-amber-600 font-bold text-center";
					if (window.audioEngine) window.audioEngine.playSoundEffect("correct");
				} else {
					this.userMistakes.push({ q: q.question, g: userText || "[Keine Eingabe]", c: correctText });
					inputField.classList.add("border-red-500", "bg-red-50");
					feedbackText.innerHTML = `❌ Falsch. Richtig ist: <b>${correctText}</b>`;
					feedbackText.className = "text-red-600 font-bold text-center";
					if (window.audioEngine) window.audioEngine.playSoundEffect("wrong");
				}
				document.getElementById("feedback-area").classList.remove("hidden");
			};
		} else if (q.type === "cloze") {
			const regex = /\[(.*?)\]/;
			const match = q.question.match(regex);
			const solutionWord = match ? match[1] : q.correct_text || "";

			const displayQuestion = q.question.replace(regex, "________");
			document.getElementById("question-text").innerText = "Ergänze das fehlende Wort:\n\n" + displayQuestion;

			const inputField = document.createElement("input");
			inputField.type = "text";
			inputField.id = "cloze-answer";
			inputField.placeholder = "Gesuchtes Lückenwort...";
			inputField.className =
				"w-full p-4 rounded-xl border-2 border-slate-200 dark:border-slate-600 outline-none font-medium text-lg focus:border-blue-500 shadow-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white";
			optDiv.appendChild(inputField);
			inputField.focus();

			checkAnswer = () => {
				if (alreadyChecked) return;
				alreadyChecked = true;
				inputField.disabled = true;

				const userText = inputField.value.trim();
				const similarity = this.getSimilarity(userText, solutionWord);

				let isCorrect = similarity >= 0.88;
				let isAlmostCorrect = !isCorrect && similarity >= 0.68;

				const feedbackText = document.getElementById("feedback-text");

				if (isCorrect || isAlmostCorrect) {
					this.score += isCorrect ? 1 : 0.5;
					inputField.classList.add(
						isCorrect ? "border-green-500" : "border-amber-500",
						isCorrect ? "bg-green-50" : "bg-amber-50",
					);

					feedbackText.innerHTML = isCorrect
						? "✅ Richtig!"
						: `⚠️ Fast richtig gelöst!<br>Lösung: <b>${solutionWord}</b>`;
					feedbackText.className = isCorrect
						? "text-green-600 font-bold text-center"
						: "text-amber-600 font-bold text-center";
					if (window.audioEngine) window.audioEngine.playSoundEffect("correct");
				} else {
					this.userMistakes.push({ q: q.question, g: userText || "[Keine Eingabe]", c: solutionWord });
					inputField.classList.add("border-red-500", "bg-red-50");
					feedbackText.innerHTML = `❌ Falsch. Richtig ist: <b>${solutionWord}</b>`;
					feedbackText.className = "text-red-600 font-bold text-center";
					if (window.audioEngine) window.audioEngine.playSoundEffect("wrong");
				}
				document.getElementById("feedback-area").classList.remove("hidden");
			};
		} else {
			// --- MULTIPLE CHOICE MODUS ---
			document.getElementById("question-text").innerText = q.question;

			if (!Array.isArray(q.answer)) {
				q.answer = [q.answer];
			}

			let selectedAnswers = [];

			q.options.slice(0, 4).forEach((opt, i) => {
				if (!opt) return; // Leere Buttons gar nicht erst anzeigen

				const b = document.createElement("button");
				b.className =
					"option-btn w-full text-left p-4 rounded-xl border-2 border-slate-100 dark:border-slate-700 transition-all font-medium bg-white dark:bg-slate-800 hover:border-blue-200 dark:hover:border-blue-900 shadow-sm text-slate-900 dark:text-white";

				b.innerHTML = `
					<span class="text-xs bg-slate-100 dark:bg-slate-700 text-slate-400 px-2 py-1 rounded border border-slate-200 dark:border-slate-600 font-mono mr-2">
						Taste ${i + 1}
					</span>
					<span>${opt}</span>
				`;

				b.onclick = () => {
					if (alreadyChecked) return;

					if (selectedAnswers.includes(i)) {
						// Wenn bereits ausgewählt, wieder abwählen
						selectedAnswers = selectedAnswers.filter((x) => x !== i);
						b.classList.remove("border-blue-500", "bg-blue-50", "dark:bg-blue-900/40");
					} else {
						// ANPASSUNG: Keine künstliche Begrenzung mehr auf q.answer.length! Der User darf frei wählen.
						selectedAnswers.push(i);
						b.classList.add("border-blue-500", "bg-blue-50", "dark:bg-blue-900/40");
					}
				};

				optDiv.appendChild(b);
			});

			checkAnswer = () => {
				alreadyChecked = true;
				document.querySelectorAll(".option-btn").forEach((btn) => (btn.disabled = true));

				const correctAnswers = [...q.answer].sort((a, b) => a - b);
				const userAnswers = [...selectedAnswers].sort((a, b) => a - b);

				// Richtig ist es nur, wenn exakt alle richtigen ausgewählt wurden (keine zu viel, keine zu wenig)
				const isCorrect = JSON.stringify(correctAnswers) === JSON.stringify(userAnswers);
				const buttons = document.querySelectorAll(".option-btn");

				buttons.forEach((btn, index) => {
					if (q.answer.includes(index)) {
						// Alle eigentlich richtigen Antworten grün markieren
						btn.classList.add("border-green-500", "bg-green-50", "dark:bg-green-900/40");
					}
					if (selectedAnswers.includes(index) && !q.answer.includes(index)) {
						// Vom User fälschlicherweise ausgewählte Antworten rot markieren
						btn.classList.add("border-red-500", "bg-red-50", "dark:bg-red-900/40");
					}
				});

				const feedbackText = document.getElementById("feedback-text");

				if (isCorrect) {
					this.score++;
					feedbackText.innerHTML = "✅ Richtig!";
					feedbackText.className = "text-green-600 font-bold text-center";
					if (window.audioEngine) window.audioEngine.playSoundEffect("correct");
				} else {
					const rightTexts = q.answer.map((index) => q.options[index]).join(", ");
					this.userMistakes.push({
						q: q.question,
						g: selectedAnswers.map((index) => q.options[index]).join(", ") || "[Keine Wahl]",
						c: rightTexts,
					});

					feedbackText.innerHTML = `❌ Falsch. Richtig ist: ${rightTexts}`;
					feedbackText.className = "text-red-600 font-bold text-center";
					if (window.audioEngine) window.audioEngine.playSoundEffect("wrong");
				}
				document.getElementById("feedback-area").classList.remove("hidden");
			};
		}

		const checkBtn = document.createElement("button");
		checkBtn.innerText = "Antwort prüfen";
		checkBtn.className = "w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-md";
		checkBtn.onclick = () => {
			checkAnswer();
			checkBtn.disabled = true;
			checkBtn.classList.add("opacity-50");
		};
		optDiv.appendChild(checkBtn);

		const nextBtn = document.getElementById("next-q-btn");
		const halfQuiz = Math.floor(this.quizData.length / 2);

		if (this.currentIndex === halfQuiz - 1 && halfQuiz > 0 && !this.gameDone) {
			nextBtn.innerText = "Spielen & Weiter ⚡";
			nextBtn.onclick = () => {
				document.onkeydown = null;
				document.getElementById("quiz-content").classList.add("hidden");
				document.getElementById("game-screen").classList.remove("hidden");
				this.gameDone = true;
				this.currentIndex++;
			};
		} else {
			nextBtn.innerText = "Nächste Frage →";
			nextBtn.onclick = () => {
				this.currentIndex++;
				this.showQuestion();
			};
		}

		document.onkeydown = (e) => {
			if (q.type === "multiple" && ["1", "2", "3", "4"].includes(e.key)) {
				const index = parseInt(e.key) - 1;
				const buttons = document.querySelectorAll(".option-btn");
				if (buttons[index] && !buttons[index].disabled) {
					buttons[index].click();
				}
			}

			if (e.key === "Enter") {
				if (document.getElementById("feedback-area").classList.contains("hidden")) {
					checkBtn.click();
				} else {
					nextBtn.click();
				}
			}
		};
	}

	showRes() {
		document.getElementById("quiz-content").classList.add("hidden");
		document.getElementById("result-screen").classList.remove("hidden");
		document.getElementById("progress-bar").style.width = "100%";

		const total = this.quizData.length;
		const percent = Math.round((this.score / total) * 100);
		document.getElementById("score-display").innerText = `${this.score} von ${total} Punkten (${percent}%)`;
		if (percent >= 75) {
			if (window.audioEngine) window.audioEngine.playMusic(musicData.win, false, false, "win");
		} else {
			if (window.audioEngine) window.audioEngine.playMusic(musicData.lose, false, false, "lose");
		}

		const analysis = document.getElementById("mistake-analysis");
		if (this.userMistakes.length > 0) {
			analysis.innerHTML = this.userMistakes
				.map(
					(m) => `
				<div class="mistake-card p-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-xs shadow-sm border-l-red-500">
					<p class="font-bold mb-1 text-slate-800 dark:text-white">Frage/Text: ${m.q}</p>
					<p class="text-red-500">❌ Deine Eingabe: ${m.g}</p>
					<p class="text-green-600 font-bold">✅ Lösung: ${m.c}</p>
				</div>`,
				)
				.join("");
		} else {
			analysis.innerHTML =
				'<div class="text-center p-6 bg-green-50 dark:bg-green-900/30 rounded-2xl border-2 border-green-100 dark:border-green-900"><p class="text-green-600 dark:text-green-400 font-black text-lg">PERFEKT! 100% 🌟</p></div>';
		}

		const h = JSON.parse(localStorage.getItem("quiz_history") || "[]");
		h.unshift({ d: new Date().toLocaleDateString(), p: percent });
		localStorage.setItem("quiz_history", JSON.stringify(h.slice(0, 10)));
		window.renderHistory();
	}

	restartCurrentQuiz() {
		if (this.quizData.length === 0) return window.goToHome();

		shuffleArray(this.quizData);
		this.quizData.forEach((q) => {
			if (q.type === "multiple") {
				const correctTexts = q.answer.map((index) => q.options[index]);
				shuffleArray(q.options);
				q.answer = correctTexts.map((text) => q.options.indexOf(text)).filter((idx) => idx !== -1);
			}
		});

		this.resetStats();
		document.getElementById("result-screen").classList.add("hidden");
		document.getElementById("quiz-content").classList.remove("hidden");
		this.showQuestion();
	}
}
