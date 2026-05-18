// Spielengine und Hauptschleife
// ------------------------------

// Zustand des laufenden Spiels
const gameState = {
	activeGame: null,
	activeGameType: null,
	gameResult: null,
	frames: 0,
	lives: 3,
	maxLives: 3,
	recoveringHeart: false,
	lastHit: 0,
	damageTime: 0,
	mouse: { x: 150, y: 150 },
	lerp: { x: 150, y: 150 },
	activePointers: new Set(),
	steeringPointerId: null,
	keys: {},
	canvasId: "",
	scoreDisplayId: "",
	cursorStyle: "#3b82f633",
	continueButtonRect: { x: 100, y: 190, w: 100, h: 40 },

	// Funktion zur Veränderung des Spielstandes
	addScore: function (points) {
		gamePoints = Math.max(0, gamePoints + points);
		const scoreDisplay = document.getElementById(this.scoreDisplayId);
		if (scoreDisplay) scoreDisplay.innerText = `${Math.min(maxScore, Math.floor(gamePoints))} / ${maxScore}`;

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
		// Punktabzug
		if (scorePenalty) this.addScore(scorePenalty);
	},
};

// Event Listener für Tastatur initialisieren
window.addEventListener("keydown", (e) => {
	if (!gameActive) return;
	const key = e.key.toLowerCase();
	gameState.keys[key] = true;
	if ([" ", "enter", "arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(key)) {
		e.preventDefault();
	}

	// Spielabbruch
	if (key === "escape") {
		document.dispatchEvent(new CustomEvent("exitGameRequested", { detail: { canvasId: gameState.canvasId } }));
		return;
	}

	// Weiterleitung an gameState
	if (!e.repeat && gameState.activeGame && gameState.activeGame.onKeyDown) {
		gameState.activeGame.onKeyDown(key, gameState);
	}
});

window.addEventListener("keyup", (e) => {
	if (!gameActive) return;
	const key = e.key.toLowerCase();
	gameState.keys[key] = false;

	// Weiterleitung an gameState
	if (gameState.activeGame && gameState.activeGame.onKeyUp) {
		gameState.activeGame.onKeyUp(key, gameState);
	}
});

// Spielstartfunktion (durch HTML aufgerufen)
function setupGame(type, canvasId) {
	// Event zum Spielstart für UI-Vorbereitungen
	document.dispatchEvent(new CustomEvent("gameStarted", { detail: { type, canvasId } }));
	gameState.scoreDisplayId = canvasId === "home-canvas" ? "home-game-score" : "game-score";
	document.getElementById(gameState.scoreDisplayId).innerText = `0 / ${maxScore}`;

	// Canvas vorbereiten und skalieren
	const canvas = document.getElementById(canvasId);
	canvas.style.cursor = "none";
	const ctx = canvas.getContext("2d");
	const dpr = window.devicePixelRatio || 1;
	const rect = canvas.getBoundingClientRect();
	canvas.width = rect.width * dpr;
	canvas.height = rect.height * dpr;
	ctx.scale(canvas.width / 300, canvas.height / 300);

	// Spielzustand initialisieren
	gameActive = true;
	gamePoints = 0;
	gameState.gameResult = null;
	gameState.canvasId = canvasId;
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
	gameState.steeringPointerId = null;
	gameState.cursorStyle = "#3b82f633";
	gameState.lastHit = 0;
	gameState.damageTime = 0;
	gameState.recoveringHeart = false;
	gameState.frames = 0;
	gameState.maxLives = difficulty == 0.6 ? 3 : difficulty == 1 ? 2 : 1;
	gameState.lives = gameState.maxLives;

	// Logik und Konfiguration des jeweiligen Spiels initialisieren
	gameState.activeGame = gamesConfig[type];
	gameState.activeGameType = type;
	gameState.activeGame.init(gameState);

	// Event Listener für Pointer initialisieren
	canvas.oncontextmenu = (e) => e.preventDefault();
	canvas.onpointermove = (e) => {
		if (!gameActive) return;

		// = Bewegen nur bei Steuerungspointer
		if (e.pointerId === gameState.steeringPointerId || e.pointerType === "mouse") {
			const pointer = getCanvasPointer(e, canvas);

			// Canvasgrenzen einhalten
			gameState.mouse.x = Math.max(15, Math.min(285, pointer.x));
			gameState.mouse.y = Math.max(15, Math.min(285, pointer.y));
		}
	};

	canvas.onpointerdown = (e) => {
		e.preventDefault();
		gameState.activePointers.add(e.pointerId);
		canvas.setPointerCapture(e.pointerId);

		// Aktuelle Pointer-Koordinaten berechnen
		const pointer = getCanvasPointer(e, canvas);

		// = Erster Touch / Nicht Multitouch --> Steuerungspointer setzen
		if (gameState.steeringPointerId === null || e.pointerType === "mouse") {
			gameState.steeringPointerId = e.pointerId;
			if (gameState.activeGame.syncPointerOnDown) {
				gameState.mouse.x = Math.max(15, Math.min(285, pointer.x));
				gameState.mouse.y = Math.max(15, Math.min(285, pointer.y));
			}
			if (gameActive && gameState.activeGame.onPointerDown) {
				gameState.activeGame.onPointerDown(e, gameState);
			}
		} else {
			if (gameActive && e.pointerType !== "mouse" && gameState.activeGame.fire) {
				gameState.activeGame.fire(gameState);
			}
		}

		// "Weiter"-Button, wenn das Spiel vorbei ist
		if (!gameActive && gameState.gameResult) {
			const btn = gameState.continueButtonRect;
			if (pointer.x >= btn.x && pointer.x <= btn.x + btn.w && pointer.y >= btn.y && pointer.y <= btn.y + btn.h) {
				document.dispatchEvent(new CustomEvent("exitGameRequested", { detail: { canvasId } }));
				return;
			}
		}
	};

	canvas.onpointerup = (e) => {
		e.preventDefault();
		if (gameActive && gameState.activeGame && gameState.activeGame.onPointerUp) {
			gameState.activeGame.onPointerUp(e, gameState);
		}
		if (gameState.steeringPointerId === e.pointerId) {
			gameState.steeringPointerId = null;
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
		let deltaTime = Math.min(3.0, (now - lastTime) / 16.66); // Faktor 1.0 bei 60 FPS
		lastTime = now;

		// Herz ~3s blinkend nach Schaden
		if (gameState.recoveringHeart && now - gameState.damageTime > 3000 * difficulty) {
			gameState.recoveringHeart = false;
		}

		// Cursor-Highlight 200ms rot nach Schaden
		if (now - gameState.lastHit < 200) {
			gameState.cursorStyle = "#ff00004d";
		} else {
			gameState.cursorStyle = "#3b82f633";
		}

		// Bewegungsteuerung mittels Tastatur (außer Pferdeparcours)
		if (gameState.activeGame.useDefaultKeyboard === true) {
			if (gameState.keys["w"] || gameState.keys["arrowup"]) gameState.mouse.y -= 7 * deltaTime;
			if (gameState.keys["s"] || gameState.keys["arrowdown"]) gameState.mouse.y += 7 * deltaTime;
			if (gameState.keys["a"] || gameState.keys["arrowleft"]) gameState.mouse.x -= 7 * deltaTime;
			if (gameState.keys["d"] || gameState.keys["arrowright"]) gameState.mouse.x += 7 * deltaTime;
			// Canvas-Begrenzung
			gameState.mouse.x = Math.max(15, Math.min(285, gameState.mouse.x));
			gameState.mouse.y = Math.max(15, Math.min(285, gameState.mouse.y));
		}

		// Interpolation (lerp) der Mausbewegung
		gameState.lerp.x += (gameState.mouse.x - gameState.lerp.x) * 0.2 * deltaTime;
		gameState.lerp.y += (gameState.mouse.y - gameState.lerp.y) * 0.2 * deltaTime;

		// Spezifische Spiele-Logik ausführen und zeichnen
		if (gameState.activeGame) {
			if (gameState.activeGame.update) gameState.activeGame.update(gameState, deltaTime);
			if (gameState.activeGame.draw) gameState.activeGame.draw(ctx, gameState);
		}

		// Lebensanzeige darüber zeichnen
		drawHearts(ctx, gameState);

		gameAnimationId = requestAnimationFrame(loop);
	}

	// Alte Schleife anhalten und neue starten
	if (gameAnimationId) cancelAnimationFrame(gameAnimationId);
	gameAnimationId = requestAnimationFrame(loop);
}
