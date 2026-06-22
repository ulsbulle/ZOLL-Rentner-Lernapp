// Globale Funktionen für DOM und BOM
// ------------------------------------------------

import { GameEngine } from "./game-engine.js";
import { AudioManager } from "../audio/audio-manager.js";

// Globale Definitionen
window.audioManager = new AudioManager();
window.currentGameEngine = null;
let maxScore = 200;
let difficulty = 1;

// Spielaufruffunktion
window.setupGame = function (type, canvasId) {
	// Werte aus UI aktualisieren
	const scoreInput = document.getElementById("max-score-input");
	const difficultyInput = document.getElementById("difficulty-select");
	if (scoreInput && scoreInput.value) maxScore = Math.min(1000, parseInt(Math.max(50, scoreInput.value)));
	if (difficultyInput && difficultyInput.value) difficulty = parseFloat(difficultyInput.value) || 1.0;

	try {
		localStorage.setItem("gameDifficulty", difficulty);
		localStorage.setItem("gameMaxScore", maxScore);
	} catch (error) {
		console.warn("Einstellungen konnten nicht lokal gespeichert werden.", error);
	}

	// UI-Wechsel
	document.dispatchEvent(new CustomEvent("gameStarted", { detail: { canvasId } }));

	// Enginestart
	window.currentGameEngine = new GameEngine(canvasId, window.audioManager);

	// Initialisierung der Leinwand
	window.currentGameEngine.setupCanvas();

	// Spielstart
	window.currentGameEngine.loadGame(type, difficulty, maxScore);
};

// Event Listener für den Spielstart
document.addEventListener("gameStarted", (e) => {
	const { canvasId } = e.detail;

	// UI-Wechsel: Spielbereich zeigen
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
	window.toggleTrainingControls(true);
});

// Event Listener für das Spielende
document.addEventListener("exitGameRequested", (e) => {
	const { canvasId } = e.detail;

	// UI-Wechsel: Home- / Quizbereich zeigen
	switch (canvasId) {
		case "home-canvas":
			window.showHomeGameSelection();
			break;
		case "game-canvas":
			showQuestion();
			break;
	}

	// Engine anhalten
	if (window.currentGameEngine) {
		window.currentGameEngine.destroy();
	}
});

// Aufruf der Spielübersicht
window.showHomeGameSelection = function () {
	// Engine anhalten
	if (window.currentGameEngine) {
		window.currentGameEngine.destroy();
	}

	// UI-Elemente ein- / ausblenden
	document.getElementById("home-game-selection").classList.remove("hidden");
	document.getElementById("home-active-game").classList.add("hidden");
	window.toggleTrainingControls(false);

	// Punktzahl zurücksetzen
	const scoreDisplay = document.getElementById("home-game-score");
	scoreDisplay.innerText = `${maxScore} P`;
};

// Ausblenden / Deaktivieren der Steuerungselemente während des Spiels
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

// UI für das Setzen der Zielpunktzahl
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

	// Begrenzen des zulässigen Wertebreichs
	let newScore = parseInt(inputField.value, 10);
	if (isNaN(newScore) || newScore < 50) newScore = 50;
	if (newScore > 1000) newScore = 1000;

	maxScore = newScore;
	try {
		localStorage.setItem("gameMaxScore", maxScore);
	} catch (error) {
		console.warn("Zielpunktzahl konnte nicht lokal gespeichert werden.", error);
	}
	scoreDisplay.innerText = `${maxScore} P`;

	inputContainer.classList.add("hidden");
	scoreDisplay.classList.remove("hidden");
};

// Speicherung des Schwierigkeitsgrads im local Storage
window.updateDifficulty = function () {
	difficulty = document.getElementById("difficulty-select").value;
	try {
		localStorage.setItem("gameDifficulty", difficulty);
	} catch (error) {
		console.warn("Schwierigkeitsgrad konnte nicht lokal gespeichert werden.", error);
	}
};
