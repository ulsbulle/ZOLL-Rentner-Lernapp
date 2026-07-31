// Globale Funktionen für DOM und BOM
// -----------------------------------
// - Handling von UI-Übergängen und -Events
// - Verwaltung des local storage

import { GameEngine } from "./game-engine.js";

// Globale Definitionen
window.currentGameEngine = null;
let maxScore = localStorage.getItem("gameMaxScore") ?? 250;
let difficulty = localStorage.getItem("gameDifficulty") ?? 1;

// Werte in UI aktualisieren
document.getElementById("home-game-score").innerText = `${maxScore} P`;
document.getElementById("difficulty-select").value = difficulty;

// Spielaufruffunktion
window.setupGame = function (type, canvasId) {
	// Engine anhalten zur Vermeidung von Konflikten mit alten Instanzen
	if (window.currentGameEngine) {
		window.currentGameEngine.destroy();
	}

	// Werte aus UI aktualisieren
	const scoreInput = document.getElementById("max-score-input");
	const difficultyInput = document.getElementById("difficulty-select");
	if (scoreInput && scoreInput.value) maxScore = Math.min(1000, parseInt(Math.max(50, scoreInput.value))); // Begrenzung der Punktzahl [50, 1000]
	if (difficultyInput && difficultyInput.value) difficulty = parseFloat(difficultyInput.value) || 1.0;

	// Speicherung der Parameter im local storage
	try {
		localStorage.setItem("gameDifficulty", difficulty);
		localStorage.setItem("gameMaxScore", maxScore);
	} catch (error) {
		console.warn("Einstellungen konnten nicht lokal gespeichert werden.", error);
	}

	// Auslösen eines Spielstart-Events für den UI-Wechsel
	document.dispatchEvent(new CustomEvent("gameStarted", { detail: { canvasId } }));

	// Enginestart
	window.currentGameEngine = new GameEngine(canvasId, window.audioEngine);

	// Initialisierung der Leinwand
	window.currentGameEngine.setupCanvas();

	// Spielstart
	window.currentGameEngine.loadGame(type, difficulty, maxScore);
};

// Event Listener für den Spielstart
document.addEventListener("gameStarted", (e) => {
	const { canvasId } = e.detail;

	// UI-Wechsel: Spielbereich zeigen (Umschaltung mittels hidden-Attribut)
	let activeArea;
	switch (canvasId) {
		case "home-canvas":
			document.getElementById("home-game-selection").classList.add("hidden");
			activeArea = document.getElementById("home-active-game");
			activeArea.classList.remove("hidden");
			break;
		case "game-canvas":
			document.getElementById("quiz-game-selection").classList.add("hidden");
			activeArea = document.getElementById("active-game-area");
			activeArea.classList.remove("hidden");
			break;
	}

	// Zum Spielfeld scrollen
	if (activeArea) {
		setTimeout(() => activeArea.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
	}

	// Schwierigkeitsgrad und maximale Punktzahl ausblenden
	window.toggleTrainingControls(true);
});

// Event Listener für das Spielende
document.addEventListener("exitGameRequested", (e) => {
	const { canvasId } = e.detail;
	// UI-Wechsel: Home- / Quizbereich zeigen
	switch (canvasId) {
		case "home-canvas":
			window.showHomeGameSelection(); // Aufruf der Spielübersicht
			break;
		case "game-canvas":
			window.returnToQuiz(); // Rückkehr zur Quizansicht
			break;
	}
});

// Aufruf der Spielübersicht
window.showHomeGameSelection = function () {
	// Musik anhalten
	if (window.currentGameEngine.audio) window.currentGameEngine.audio.stopMusic();

	// Engine anhalten
	if (window.currentGameEngine) window.currentGameEngine.destroy();

	// UI-Elemente ein- / ausblenden
	document.getElementById("home-game-selection").classList.remove("hidden");
	document.getElementById("home-active-game").classList.add("hidden");
	window.toggleTrainingControls(false); // Schwierigkeitsgrad und maximale Punktzahl einblenden

	// Punktzahl zurücksetzen
	const scoreDisplay = document.getElementById("home-game-score");
	scoreDisplay.innerText = `${maxScore} P`;
};

// Rückkehr zur Quizansicht
window.returnToQuiz = function () {
	// Musik anhalten
	if (window.currentGameEngine.audio) window.currentGameEngine.audio.stopMusic();

	// Engine anhalten
	if (window.currentGameEngine) window.currentGameEngine.destroy();

	// UI-Elemente ein- / ausblenden
	document.getElementById("quiz-game-selection").classList.remove("hidden");
	document.getElementById("active-game-area").classList.add("hidden");
	window.toggleTrainingControls(false); // Schwierigkeitsgrad und maximale Punktzahl einblenden

	// Fortsetzung des Quiz
	window.quizApp.showQuestion();
};

// Aktivieren / Deaktivieren der Steuerungselemente während des Spiels
window.toggleTrainingControls = function (lockStatus) {
	const difficultySelect = document.getElementById("difficulty-select");
	const scoreButton = document.getElementById("home-game-score");

	difficultySelect.disabled = lockStatus;
	scoreButton.disabled = lockStatus;

	if (lockStatus) {
		difficultySelect.classList.add("hidden");
		scoreButton.classList.add("cursor-not-allowed");
		window.setMaxScore();
	} else {
		difficultySelect.classList.remove("hidden");
		scoreButton.classList.remove("cursor-not-allowed");
	}
};

// UI-Einblendung für das Setzen der Zielpunktzahl
window.editMaxScore = function () {
	const inputContainer = document.getElementById("score-input-container");
	const scoreDisplay = document.getElementById("home-game-score");
	const inputField = document.getElementById("max-score-input");

	scoreDisplay.classList.add("hidden");
	inputContainer.classList.remove("hidden");

	inputField.value = maxScore;
	inputField.focus();

	// Event Listener für Abschluss der Eingabe
	inputField.addEventListener("blur", window.setMaxScore, { once: true });
	inputField.onkeydown = (e) => {
		if (e.key === "Enter") window.setMaxScore();
	};
};

// Speicherung der Zielpunktzahl im local Storage
window.setMaxScore = function () {
	const inputContainer = document.getElementById("score-input-container");
	const scoreDisplay = document.getElementById("home-game-score");
	const inputField = document.getElementById("max-score-input");

	if (inputContainer.classList.contains("hidden")) return;

	// Begrenzen des zulässigen Wertebreichs [50, 1000]
	let newScore = parseInt(inputField.value, 10);
	if (isNaN(newScore) || newScore < 50) newScore = 50;
	if (newScore > 1000) newScore = 1000;
	maxScore = newScore;

	// Speicherung der Punktzahl im local storage
	try {
		localStorage.setItem("gameMaxScore", maxScore);
	} catch (error) {
		console.warn("Zielpunktzahl konnte nicht lokal gespeichert werden.", error);
	}

	// Punktzahl in der Anzeige setzen
	scoreDisplay.innerText = `${maxScore} P`;

	// UI für die Bearbeitung der Punktzahl verstecken
	inputContainer.classList.add("hidden");
	scoreDisplay.classList.remove("hidden");
};

// Speicherung des Schwierigkeitsgrads im local storage
window.updateDifficulty = function () {
	difficulty = document.getElementById("difficulty-select").value;
	try {
		localStorage.setItem("gameDifficulty", difficulty);
	} catch (error) {
		console.warn("Schwierigkeitsgrad konnte nicht lokal gespeichert werden.", error);
	}
};
