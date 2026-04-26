// Funktionen für DOM und HTML + globale Variablen
// ------------------------------------------------

// Globale Spielparameter initialisieren
let maxScore = 200;
let difficulty = 1;
let gameActive = false;
let gamePoints = 0;
let gameAnimationId = null;
let pointerStart = { x: null, y: null };
window.addEventListener("pointermove", (e) => {
	// Event Listener für die Pointer-Position zu Spielbeginn
	pointerStart.x = e.x;
	pointerStart.y = e.y;
});

// Event-Listener für den Spielstart durch games-engine
document.addEventListener("gameStarted", (e) => {
	const { canvasId } = e.detail;
	// Zielpunktzahl und Schwierigkeitsgrad auslesen
	const scoreInput = document.getElementById("max-score-input");
	const difficultyInput = document.getElementById("difficulty-select");
	if (scoreInput && scoreInput.value) maxScore = Math.min(1000, parseInt(Math.max(50, scoreInput.value)));
	if (difficultyInput && difficultyInput.value) difficulty = parseFloat(difficultyInput.value) || 1.0;
	localStorage.setItem("gameDifficulty", difficulty);
	localStorage.setItem("gameMaxScore", maxScore);
	// UI-Wechsel: Spielbereich zeigen
	let activeArea;
	if (canvasId === "home-canvas") {
		document.getElementById("home-game-selection").classList.add("hidden");
		activeArea = document.getElementById("home-active-game");
		activeArea.classList.remove("hidden");
	} else if (canvasId === "game-canvas") {
		document.getElementById("quiz-game-selection").classList.add("hidden");
		activeArea = document.getElementById("active-game-area");
		activeArea.classList.remove("hidden");
	}
	// Zum Spielfeld scrollen
	if (activeArea) {
		setTimeout(() => {
			activeArea.scrollIntoView({ behavior: "smooth", block: "center" });
		}, 100);
	}
	toggleTrainingControls(true);
});

// Event-Listener für das Beenden des Spiels durch games-engine
document.addEventListener("exitGameRequested", (e) => {
	const { canvasId } = e.detail;
	if (canvasId === "home-canvas") {
		showHomeGameSelection();
	} else if (typeof showQuestion === "function") {
		showQuestion();
	}
});

// Speichert den gewählten Schwierigkeitsgrad aus dem Dropdown-Menü
function updateDifficulty() {
	const select = document.getElementById("difficulty-select");
	difficulty = select.value;
	localStorage.setItem("gameDifficulty", difficulty);
}

// Zielpunktzahl bearbeiten
function scoreEdit() {
	const inputContainer = document.getElementById("score-input-container");
	const scoreDisplay = document.getElementById("home-game-score");
	const inputField = document.getElementById("max-score-input");

	scoreDisplay.classList.add("hidden");
	inputContainer.classList.remove("hidden");

	inputField.value = maxScore;
	inputField.focus();

	// Event Listener für Abschluss der Eingabe
	inputField.addEventListener("blur", newMaxScore, { once: true });
	inputField.onkeydown = (e) => {
		if (e.key === "Enter") {
			newMaxScore();
		}
	};
}

// Neue Zielpunktzahl speichern
function newMaxScore() {
	const inputContainer = document.getElementById("score-input-container");
	const scoreDisplay = document.getElementById("home-game-score");
	const inputField = document.getElementById("max-score-input");

	if (inputContainer.classList.contains("hidden")) return;

	let newScore = parseInt(inputField.value, 10);
	if (isNaN(newScore) || newScore < 50) newScore = 50;
	if (newScore > 1000) newScore = 1000;

	maxScore = newScore;
	localStorage.setItem("gameMaxScore", maxScore);
	scoreDisplay.innerText = `${maxScore} P`;

	inputContainer.classList.add("hidden");
	scoreDisplay.classList.remove("hidden");
}

// Steuerungselemente während des Spiels deaktivieren/ausblenden
function toggleTrainingControls(lockStatus) {
	const difficultySelect = document.getElementById("difficulty-select");
	const scoreButton = document.getElementById("home-game-score");

	difficultySelect.disabled = lockStatus;
	scoreButton.disabled = lockStatus;

	if (lockStatus) {
		difficultySelect.classList.add("hidden");
		scoreButton.classList.add("cursor-not-allowed");
		newMaxScore();
	} else {
		difficultySelect.classList.remove("hidden");
		scoreButton.classList.remove("cursor-not-allowed");
	}
}

// Zurück ins Hauptmenü
function showHomeGameSelection() {
	gameActive = false;
	cancelAnimationFrame(gameAnimationId);
	document.getElementById("home-game-selection").classList.remove("hidden");
	document.getElementById("home-active-game").classList.add("hidden");
	toggleTrainingControls(false);
}
