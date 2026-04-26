// Spielengine und Hauptschleife
// ------------------------------

// Zustand des laufenden Spiels
const gameState = {
	scoreDisplayId: "",
	canvasId: "",
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
	gameResult: null,
	continueButtonRect: { x: 100, y: 190, w: 100, h: 40 },

	// Funktion zur Veränderung des Spielstandes
	addScore: function (points) {
		gamePoints = Math.max(0, gamePoints + points);
		const scoreDisplay = document.getElementById(this.scoreDisplayId);
		scoreDisplay.innerText = `${Math.min(maxScore, Math.floor(gamePoints))} / ${maxScore}`;

		if (gamePoints >= maxScore) {
			if (scoreDisplay) scoreDisplay.innerText = `${maxScore} P`;
			// Sieg-Zustand setzen
			this.gameResult = "win";
			gameActive = false;
			document.getElementById(this.canvasId).style.cursor = "default";
			document.dispatchEvent(new CustomEvent("gameOver", { detail: { result: "win" } }));
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
				// Niederlage-Zustand setzen
				this.gameResult = "lose";
				gameActive = false;
				document.getElementById(this.canvasId).style.cursor = "default";
				document.dispatchEvent(new CustomEvent("gameOver", { detail: { result: "lose" } }));
			}
		} else if (!this.recoveringHeart) {
			// Blinkendes Herz bei erstem Schaden
			this.recoveringHeart = true;
			this.damageTime = now;
			playSound("wrong");
		}
		if (scorePenalty) {
			// Punktabzug
			this.addScore(scorePenalty);
		}
	},
};

// Spielstartfunktion (durch HTML aufgerufen)
function setupGame(type, canvasId) {
	// Event zum Spielstart für UI-Vorbereitungen
	document.dispatchEvent(new CustomEvent("gameStarted", { detail: { type, canvasId } }));

	gameActive = true;
	gamePoints = 0;
	gameState.gameResult = null;
	gameState.canvasId = canvasId;

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

		// Aktuelle Pointer-Koordinaten berechnen
		const pointerX = (e.clientX - r.left) * (300 / r.width);
		const pointerY = (e.clientY - r.top) * (300 / r.height);

		// "Weiter"-Button, wenn das Spiel vorbei ist
		if (!gameActive && gameState.gameResult) {
			const btn = gameState.continueButtonRect;
			if (pointerX >= btn.x && pointerX <= btn.x + btn.w && pointerY >= btn.y && pointerY <= btn.y + btn.h) {
				document.dispatchEvent(new CustomEvent("exitGameRequested", { detail: { canvasId } }));
				return;
			}
		}

		if (gameState.activePointers.size === 1) {
			// Nicht bei Multitouch im Sternenslalom auszuführen
			gameState.mouse.x = pointerX;
			gameState.mouse.y = pointerY;
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
		if (!gameActive) {
			// Beendet die Spielanimation
			if (gameState.gameResult) {
				drawEndScreen(ctx, gameState.gameResult, gameState.continueButtonRect);
				const btn = gameState.continueButtonRect;
				if (
					gameState.mouse.x >= btn.x &&
					gameState.mouse.x <= btn.x + btn.w &&
					gameState.mouse.y >= btn.y &&
					gameState.mouse.y <= btn.y + btn.h
				) {
					canvas.style.cursor = "pointer";
				} else {
					canvas.style.cursor = "default";
				}
				gameAnimationId = requestAnimationFrame(loop);
			}
			return;
		}

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
