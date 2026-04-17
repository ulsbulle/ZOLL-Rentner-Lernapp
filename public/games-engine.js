// Spielengine und Hauptschleife
// ------------------------------

// Zustand des laufenden Spiels
const gameState = {
	scoreDisplayId: "",
	frames: 0,
	mouse: { x: 150, y: 150 },
	lerp: { x: 150, y: 150 },
	activePointers: new Set(),
	cursorStyle: "#3b82f633",
	touchStart: 0,
	lastHit: 0,
	damageTime: 0,
	recoveringHeart: false,
	maxLives: 3,
	lives: 3,

	// Funktion zur Veränderung des Spielstandes
	addScore: function (points) {
		gamePoints = Math.max(0, gamePoints + points);
		const scoreDisplay = document.getElementById(this.scoreDisplayId);
		scoreDisplay.innerText = `${Math.min(maxScore, Math.floor(gamePoints))} / ${maxScore}`;
		if (gamePoints >= maxScore) {
			if (scoreDisplay) scoreDisplay.innerText = `${maxScore} P`;
			gameActive = false;
			setTimeout(() => {
				if (this.scoreDisplayId === "home-game-score") {
					showHomeGameSelection();
				} else if (typeof showQuestion === "function") {
					showQuestion();
				}
			}, 800);
		}
	},
	// Funktion zum Schadensmanagement
	applyDamage: function (scorePenalty) {
		const now = Date.now();
		this.lastHit = now;
		if (this.recoveringHeart && now - this.damageTime < 3000 * difficulty) {
			// Verlust eines Lebens bei zweitem Schaden in kurzem Zeitraum
			this.lives--;
			this.recoveringHeart = false;
			playSound("wrong");
			if (this.lives <= 0) {
				// Spiel beenden bei Verlust des letzten Lebens
				gameActive = false;
				showHomeGameSelection();
			}
		} else if (!this.recoveringHeart) {
			// Blinkendes Herz bei erstem Schadem
			this.recoveringHeart = true;
			this.damageTime = now;
			playSound("wrong");
		}
		// Punktabzug
		if (scorePenalty) {
			this.addScore(scorePenalty);
		}
	},
};

// Spielstartfunktion (durch HTML aufgerufen)
function setupGame(type, canvasId) {
	gameActive = true;
	gamePoints = 0;

	// UI-Wechsel: Auswahl verstecken, Spielbereich zeigen
	if (canvasId === "home-canvas") {
		document.getElementById("home-game-selection").classList.add("hidden");
		document.getElementById("home-active-game").classList.remove("hidden");
		toggleTrainingControls(true);
	}
	if (canvasId === "game-canvas") {
		document.getElementById("quiz-game-selection").classList.add("hidden");
		document.getElementById("active-game-area").classList.remove("hidden");
		toggleTrainingControls(true);
	}
	const scoreDisplayId = canvasId === "home-canvas" ? "home-game-score" : "game-score";
	document.getElementById(scoreDisplayId).innerText = `0 / ${maxScore}`;

	// Canvas vorbereiten und skalieren
	const canvas = document.getElementById(canvasId);
	canvas.style.cursor = type === "grower" ? "crosshair" : "none"; // Fadenkreuz im BubbleBlow-Spiel
	const ctx = canvas.getContext("2d");
	const dpr = window.devicePixelRatio || 1;
	const rect = canvas.getBoundingClientRect();
	canvas.width = rect.width * dpr;
	canvas.height = rect.height * dpr;
	ctx.scale(canvas.width / 300, canvas.height / 300);

	// Spielzustand initialisieren
	gameState.scoreDisplayId = scoreDisplayId;
	if (pointerStart.x !== null) {
		// Pointer auf letzte Koordinaten vor Spielaufruf setzen
		gameState.mouse = {
			x: (pointerStart.x - rect.left) * (300 / rect.width),
			y: (pointerStart.y - rect.top) * (300 / rect.height),
		};
	}
	gameState.lerp.x = gameState.mouse.x;
	gameState.lerp.y = gameState.mouse.y;
	gameState.activePointers.clear();
	gameState.touchStart = 0;
	gameState.cursorStyle = "#3b82f633";
	gameState.lastHit = 0;
	gameState.damageTime = 0;
	gameState.recoveringHeart = false;
	gameState.frames = 0;
	gameState.maxLives = difficulty == 0.6 ? 3 : difficulty == 1 ? 2 : 1;
	gameState.lives = gameState.maxLives;

	// Logik und Konfiguration des jeweiligen Spiels initialisieren
	const activeGame = gamesConfig[type];
	activeGame.init(gameState);

	// Event Listener initialisieren
	canvas.oncontextmenu = (e) => e.preventDefault();
	canvas.onpointermove = (e) => {
		if (e.pointerType === "touch") e.preventDefault();
		const r = canvas.getBoundingClientRect();
		gameState.mouse.x = (e.clientX - r.left) * (300 / r.width);
		gameState.mouse.y = (e.clientY - r.top) * (300 / r.height);
	};
	canvas.onpointerdown = (e) => {
		e.preventDefault();
		gameState.activePointers.add(e.pointerId);
		const r = canvas.getBoundingClientRect();
		if (gameState.activePointers.size === 1) {
			// Nicht bei Multitouch im Sternenslalom auszuführen
			gameState.mouse.x = (e.clientX - r.left) * (300 / r.width);
			gameState.mouse.y = (e.clientY - r.top) * (300 / r.height);
			gameState.touchStart = Date.now();
		}
		if (gameActive && activeGame && activeGame.onPointerDown) {
			activeGame.onPointerDown(e, gameState);
		}
	};
	canvas.onpointerup = (e) => {
		e.preventDefault();
		if (gameActive && activeGame && activeGame.onPointerUp) {
			activeGame.onPointerUp(e, gameState);
		}
		gameState.activePointers.delete(e.pointerId);
		if (canvas.hasPointerCapture(e.pointerId)) {
			canvas.releasePointerCapture(e.pointerId);
		}
	};

	// Hauptschleife (Start der Spielanimation)
	let lastTime = Date.now();
	function loop() {
		if (!gameActive) return;
		let now = Date.now();
		let deltaTime = (now - lastTime) / 16.66; // Faktor 1.0 bei 60 FPS
		lastTime = now;

		// Herz ~3s blinkend nach Schaden
		if (gameState.recoveringHeart && Date.now() - gameState.damageTime > 3000 * difficulty) {
			gameState.recoveringHeart = false;
		}

		// Cursor-Highlight 200ms rot nach Schaden
		if (Date.now() - gameState.lastHit < 200) {
			gameState.cursorStyle = "#ff00004d";
		} else {
			gameState.cursorStyle = "#3b82f633";
		}

		// Interpolation (lerp) der Mausbewegung
		gameState.lerp.x += (Math.max(20, Math.min(280, gameState.mouse.x)) - gameState.lerp.x) * 0.2 * deltaTime;
		gameState.lerp.y += (Math.max(20, Math.min(280, gameState.mouse.y)) - gameState.lerp.y) * 0.2 * deltaTime;

		// Spezifische Spiele-Logik ausführen und zeichnen
		if (activeGame) {
			if (activeGame.update) activeGame.update(gameState, deltaTime);
			if (activeGame.draw) activeGame.draw(ctx, gameState);
		}

		// Lebensanzeige darüber zeichnen
		drawHearts(ctx, gameState);

		gameAnimationId = requestAnimationFrame(loop);
	}

	// Alte Schleife anhalten und neue starten
	if (gameAnimationId) cancelAnimationFrame(gameAnimationId);
	gameAnimationId = requestAnimationFrame(loop);
}
