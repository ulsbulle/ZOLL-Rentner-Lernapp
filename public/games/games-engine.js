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
		if (!gameActive) return;
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
		if (!gameActive) return;
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
	const key = e.key.toLowerCase();
	// Steuerung während des Spielstarts und Spielendes
	if (!gameActive && [" ", "enter"].includes(key)) {
		if (gameState.gameResult === "start") {
			e.preventDefault();
			gameState.gameResult = null;
			gameActive = true;
			document.getElementById(gameState.canvasId).style.cursor = "none";
		} else if (gameState.gameResult) {
			e.preventDefault();
			document.dispatchEvent(new CustomEvent("exitGameRequested", { detail: { canvasId: gameState.canvasId } }));
		}
		return;
	}
	// Steuerung während des Spiels
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

gameState.startButtonRect = { x: 90, y: 215, w: 120, h: 40 };

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
	gameActive = false;
	gamePoints = 0;
	gameState.gameResult = "start";
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
	gameState.touchStart = null;
	gameState.touchStartY = null;
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
		const pointer = getCanvasPointer(e, canvas);

		// Steuerung während des Spielstarts
		if (!gameActive) {
			let overButton = false;
			if (gameState.gameResult === "start") {
				const startButton = gameState.startButtonRect;
				overButton =
					pointer.x >= startButton.x &&
					pointer.x <= startButton.x + startButton.w &&
					pointer.y >= startButton.y &&
					pointer.y <= startButton.y + startButton.h;
			} else if (gameState.gameResult) {
				const continueButton = gameState.continueButtonRect;
				overButton =
					pointer.x >= continueButton.x &&
					pointer.x <= continueButton.x + continueButton.w &&
					pointer.y >= continueButton.y &&
					pointer.y <= continueButton.y + continueButton.h;
			}
			canvas.style.cursor = overButton ? "pointer" : "default";
			gameState.mouse.x = pointer.x;
			gameState.mouse.y = pointer.y;
			return;
		}

		// = Bewegen nur bei Steuerungspointer
		if (e.pointerId === gameState.steeringPointerId || e.pointerType === "mouse") {
			// Canvasgrenzen einhalten
			gameState.mouse.x = Math.max(15, Math.min(285, pointer.x));
			gameState.mouse.y = Math.max(15, Math.min(285, pointer.y));
		}
	};

	canvas.onpointerdown = (e) => {
		e.preventDefault();
		gameState.activePointers.add(e.pointerId);
		canvas.setPointerCapture(e.pointerId);
		const pointer = getCanvasPointer(e, canvas);

		// Steuerung während des Spielstarts
		if (!gameActive && gameState.gameResult === "start") {
			const startButton = gameState.startButtonRect;
			if (
				pointer.x >= startButton.x &&
				pointer.x <= startButton.x + startButton.w &&
				pointer.y >= startButton.y &&
				pointer.y <= startButton.y + startButton.h
			) {
				gameState.gameResult = null;
				gameActive = true;
				canvas.style.cursor = "none";
				return;
			}
		}

		// Steuerung während des Spielendes
		if (!gameActive && gameState.gameResult) {
			const continueButton = gameState.continueButtonRect;
			if (
				pointer.x >= continueButton.x &&
				pointer.x <= continueButton.x + continueButton.w &&
				pointer.y >= continueButton.y &&
				pointer.y <= continueButton.y + continueButton.h
			) {
				document.dispatchEvent(new CustomEvent("exitGameRequested", { detail: { canvasId } }));
				return;
			}
		}
		if (!gameActive) return;

		// Steuerung während des Spiels
		// = Erster Touch / Nicht Multitouch --> Steuerungspointer setzen
		if (gameState.steeringPointerId === null || e.pointerType === "mouse") {
			gameState.steeringPointerId = e.pointerId;
			if (gameState.activeGame.syncPointerOnDown) {
				gameState.mouse.x = Math.max(15, Math.min(285, pointer.x));
				gameState.mouse.y = Math.max(15, Math.min(285, pointer.y));
			}
			if (gameState.activeGame.onPointerDown) {
				gameState.activeGame.onPointerDown(e, gameState);
			}
		} else {
			if (e.pointerType !== "mouse" && gameState.activeGame.fire) {
				gameState.activeGame.fire(gameState);
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
		let now = Date.now();
		let deltaTime = Math.min(3.0, (now - lastTime) / 16.66); // Faktor 1.0 bei 60 FPS
		lastTime = now;

		// Start-/Endbildschirm
		if (!gameActive) {
			if (gameState.gameResult === "start") {
				// Verlangsamter Spielhintergrund
				if (gameState.activeGame && gameState.activeGame.draw) {
					if (gameState.activeGame.update) gameState.activeGame.update(gameState, deltaTime * 0.3);
					gameState.activeGame.draw(ctx, gameState);
				}
				// Startbildschirm-Overlay
				drawStartScreen(ctx, gameState.activeGameType, gameState.startButtonRect);
			} else if (gameState.gameResult) {
				// Endbildschirm
				drawEndScreen(ctx, gameState.gameResult, gameState.continueButtonRect);
			}
			gameAnimationId = requestAnimationFrame(loop);
			return;
		}

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
