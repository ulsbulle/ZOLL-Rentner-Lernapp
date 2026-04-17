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

// Speichert den gewählten Schwierigkeitsgrad aus dem Dropdown-Menü
function updateDifficulty() {
	const select = document.getElementById("difficulty-select");
	difficulty = select.value;
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
