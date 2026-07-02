// Quizengine und Logik mit Freitext- und Lückentext-Erweiterung
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
				// Standard-Typ zuweisen, falls nicht vorhanden
				if (!q.type) q.type = "multiple";

				if (q.type === "multiple") {
					if (!Array.isArray(q.answer)) {
						q.answer = [q.answer];
					}
					const correctTexts = q.answer.map((index) => q.options[index]);
					shuffleArray(q.options);
					q.answer = correctTexts.map((text) => q.options.indexOf(text));
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

	// Hilfsfunktion zur Toleranzberechnung (Levenshtein-Distanz)
	getSimilarity(s1, s2) {
		let longer = s1.toLowerCase().trim();
		let shorter = s2.toLowerCase().trim();
		if (longer.length < shorter.length) {
			let tmp = longer; longer = shorter; shorter = tmp;
		}
		let longerLength = longer.length;
		if (longerLength === 0) return 1.0;
		
		let costs = new Array();
		for (let i = 0; i <= longer.length; i++) {
			let lastValue = i;
			for (let j = 0; j <= shorter.length; j++) {
				if (i == 0) costs[j] = j;
				else {
					if (j > 0) {
						let newValue = costs[j - 1];
						if (longer.charAt(i - 1) != shorter.charAt(j - 1))
							newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
						costs[j - 1] = lastValue;
						lastValue = newValue;
					}
				}
			}
			if (i > 0) costs[shorter.length] = lastValue;
		}
		return (longerLength - costs[shorter.length]) / parseFloat(longerLength);
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
		if (!q.type) q.type = "multiple"; // Fallback

		document.getElementById("progress-bar").style.width = `${(this.currentIndex / this.quizData.length) * 100}%`;
		document.getElementById("q-count").innerText = `Frage ${this.currentIndex + 1} von ${this.quizData.length} (${q.type.toUpperCase()})`;
		
		const optDiv = document.getElementById("options");
		optDiv.innerHTML = "";

		let alreadyChecked = false;
		let checkAnswerFunc = () => {};

		// RENDERING BASIEREND AUF FRAGENTYP
		if (q.type === "free") {
			// FREITEXT MODUS
			document.getElementById("question-text").innerText = q.question;
			
			const inputField = document.createElement("input");
			inputField.type = "text";
			inputField.id = "free-text-input";
			inputField.placeholder = "Deine Antwort hier eingeben...";
			inputField.className = "w-full p-4 rounded-xl border-2 border-slate-200 outline-none font-medium text-lg focus:border-blue-500 shadow-sm dark:bg-slate-800 dark:text-white";
			optDiv.appendChild(inputField);
			inputField.focus();

			checkAnswerFunc = () => {
				if (alreadyChecked) return;
				alreadyChecked = true;
				inputField.disabled = true;

				const userAns = inputField.value.trim();
				const correctAns = q.correct_text || "";
				const similarity = this.getSimilarity(userAns, correctAns);

				let isCorrect = similarity >= 0.85; // 85% Übereinstimmung notwendig
				let isAlmostCorrect = !isCorrect && similarity >= 0.65; // Toleranzbereich für "fast richtig"

				if (isCorrect || isAlmostCorrect) {
					this.score += isCorrect ? 1 : 0.5; // Halber Punkt für "fast richtig"
					inputField.classList.add(isCorrect ? "border-green-500" : "border-amber-500", isCorrect ? "bg-green-50" : "bg-amber-50");
					document.getElementById("feedback-text").innerHTML = isCorrect ? "✅ Richtig!" : `⚠️ Fast richtig (Tippfehler)!<br>Lösung: <b>${correctAns}</b>`;
					document.getElementById("feedback-text").className = isCorrect ? "text-green-600 font-bold text-center" : "text-amber-600 font-bold text-center";
					if (window.audioEngine) window.audioEngine.playSoundEffect("correct");
				} else {
					this.userMistakes.push({ q: q.question, g: userAns || "[Keine Eingabe]", c: correctAns });
					inputField.classList.add("border-red-500", "bg-red-50");
					document.getElementById("feedback-text").innerHTML = `❌ Falsch. Richtig ist: <b>${correctAns}</b>`;
					document.getElementById("feedback-text").className = "text-red-600 font-bold text-center";
					if (window.audioEngine) window.audioEngine.playSoundEffect("wrong");
				}
				document.getElementById("feedback-area").classList.remove("hidden");
			};

		} else if (q.type === "cloze") {
			// LÜCKENTEXT MODUS
			// Erwartet Text-Format: "Das ist ein [Lückentext] mit System."
			const regex = /\[(.*?)\]/g;
			let placeholderText = q.question.replace(regex, "________");
			document.getElementById("question-text").innerText = "Fülle die Lücke aus:\n" + placeholderText;

			const inputField = document.createElement("input");
			inputField.type = "text";
			inputField.id = "cloze-input";
			inputField.placeholder = "Gesuchtes Wort eingeben...";
			inputField.className = "w-full p-4 rounded-xl border-2 border-slate-200 outline-none font-medium text-lg focus:border-blue-500 shadow-sm dark:bg-slate-800 dark:text-white";
			optDiv.appendChild(inputField);
			inputField.focus();

			// Antwort extrahieren
			const matches = [...q.question.matchAll(regex)];
			const correctAns = matches[0] ? matches[0][1] : q.correct_text;

			checkAnswerFunc = () => {
				if (alreadyChecked) return;
				alreadyChecked = true;
				inputField.disabled = true;

				const userAns = inputField.value.trim();
				const similarity = this.getSimilarity(userAns, correctAns);

				let isCorrect = similarity >= 0.85;
				let isAlmostCorrect = !isCorrect && similarity >= 0.65;

				if (isCorrect || isAlmostCorrect) {
					this.score += isCorrect ? 1 : 0.5;
					inputField.classList.add(isCorrect ? "border-green-500" : "border-amber-500", isCorrect ? "bg-green-50" : "bg-amber-50");
					document.getElementById("feedback-text").innerHTML = isCorrect ? "✅ Richtig!" : `⚠️ Fast richtig!<br>Lösung: <b>${correctAns}</b>`;
					document.getElementById("feedback-text").className = isCorrect ? "text-green-600 font-bold text-center" : "text-amber-600 font-bold text-center";
					if (window.audioEngine) window.audioEngine.playSoundEffect("correct");
				} else {
					this.userMistakes.push({ q: q.question, g: userAns || "[Keine Eingabe]", c: correctAns });
					inputField.classList.add("border-red-500", "bg-red-50");
					document.getElementById("feedback-text").innerHTML = `❌ Falsch. Richtig ist: <b>${correctAns}</b>`;
					document.getElementById("feedback-text").className = "text-red-600 font-bold text-center";
					if (window.audioEngine) window.audioEngine.playSoundEffect("wrong");
				}
				document.getElementById("feedback-area").classList.remove("hidden");
			};

		} else {
			// MULTIPLE CHOICE (Bisherige Logik)
			document.getElementById("question-text").innerText = q.question;
			if (!Array.isArray(q.answer)) q.answer = [q.answer];

			let selectedAnswers = [];
			q.options.slice(0, 4).forEach((opt, i) => {
				const b = document.createElement("button");
				b.className = "option-btn w-full text-left p-4 rounded-xl border-2 border-slate-100 transition-all font-medium bg-white hover:border-blue-200 shadow-sm dark:bg-slate-800 dark:text-white dark:border-slate-700";
				b.innerHTML = `<span class="text-xs bg-slate-100 text-slate-400 px-2 py-1 rounded border border-slate-200 font-mono mr-2 dark:bg-slate-700">Taste ${i + 1}</span><span>${opt}</span>`;

				b.onclick = () => {
					if (alreadyChecked) return;
					if (selectedAnswers.includes(i)) {
						selectedAnswers = selectedAnswers.filter((x) => x !== i);
						b.classList.remove("border-blue-500", "bg-blue-50", "dark:bg-blue-900");
					} else {
						if (selectedAnswers.length < q.answer.length) {
							selectedAnswers.push(i);
							b.classList.add("border-blue-500", "bg-blue-50", "dark:bg-blue-900");
						}
					}
				};
				optDiv.appendChild(b);
			});

			checkAnswerFunc = () => {
				if (alreadyChecked) return;
				alreadyChecked = true;

				document.querySelectorAll(".option-btn").forEach((btn) => (btn.disabled = true));
				
				const correctAnswers = [...q.answer].sort((a, b) => a - b);
				const userAnswers = [...selectedAnswers].sort((a, b) => a - b);
				const isCorrect = JSON.stringify(correctAnswers) === JSON.stringify(userAnswers);

				document.querySelectorAll(".option-btn").forEach((btn, index) => {
					if (q.answer.includes(index)) btn.classList.add("border-green-500", "bg-green-50", "dark:bg-green-900");
					if (selectedAnswers.includes(index) && !q.answer.includes(index)) btn.classList.add("border-red-500", "bg-red-50", "dark:bg-red-900");
				});

				if (isCorrect) {
					this.score++;
					document.getElementById("feedback-text").innerHTML = "✅ Richtig!";
					document.getElementById("feedback-text").className = "text-green-600 font-bold text-center";
					if (window.audioEngine) window.audioEngine.playSoundEffect("correct");
				} else {
					const rightTexts = q.answer.map((index) => q.options[index]).join(", ");
					this.userMistakes.push({
						q: q.question,
						g: selectedAnswers.map((index) => q.options[index]).join(", ") || "[Keine Wahl]",
						c: rightTexts,
					});
					document.getElementById("feedback-text").innerHTML = `❌ Falsch. Richtig ist: ${rightTexts}`;
					document.getElementById("feedback-text").className = "text-red-600 font-bold text-center";
					if (window.audioEngine) window.audioEngine.playSoundEffect("wrong");
				}
				document.getElementById("feedback-area").classList.remove("hidden");
			};
		}

		// Prüfen-Button anhängen
		const checkBtn = document.createElement("button");
		checkBtn.innerText = "Antwort prüfen";
		checkBtn.className = "w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-md uppercase tracking-wider";
		checkBtn.onclick = () => {
			checkAnswerFunc();
			checkBtn.disabled = true;
			checkBtn.classList.add("opacity-50");
		};
		optDiv.appendChild(checkBtn);

		// Event Handler für Weiter-Button vorbereiten
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

		// Keyboard Support
		document.onkeydown = (e) => {
			if (q.type === "multiple" && ["1", "2", "3", "4"].includes(e.key)) {
				const index = parseInt(e.key) - 1;
				const buttons = document.querySelectorAll(".option-btn");
				if (buttons[index] && !buttons[index].disabled) buttons[index].click();
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
		document.getElementById("score-display").innerText = `${this.score} von ${total} Punkten richtig (${percent}%)`;
		
		const analysis = document.getElementById("mistake-analysis");
		if (this.userMistakes.length > 0) {
			analysis.innerHTML = this.userMistakes
				.map((m) => `
				<div class="mistake-card p-3 bg-white border border-slate-200 rounded-xl text-xs shadow-sm border-l-red-500 dark:bg-slate-800 dark:border-slate-700">
					<p class="font-bold mb-1 text-slate-800 dark:text-slate-200">Aufgabe: ${m.q}</p>
					<p class="text-red-500">❌ Deine Eingabe: ${m.g}</p>
					<p class="text-green-600 font-bold">✅ Richtige Lösung: ${m.c}</p>
				</div>`)
				.join("");
		} else {
			analysis.innerHTML = '<div class="text-center p-6 bg-green-50 rounded-2xl border-2 border-green-100"><p class="text-green-600 font-black text-lg">PERFEKT! 100% 🌟</p></div>';
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
				q.answer = correctTexts.map((text) => q.options.indexOf(text));
			}
		});
		this.resetStats();
		document.getElementById("result-screen").classList.add("hidden");
		document.getElementById("quiz-content").classList.remove("hidden");
		this.showQuestion();
	}
}
