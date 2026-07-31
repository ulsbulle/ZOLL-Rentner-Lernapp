// Spielengine und Hauptschleife
// ------------------------------
// - Verwaltung der zentralen requestAnimationFrame-Schleife
// - Synchronisation von Inputmanager, Physiklogik, Renderer und Audioengine
// - Auswertung und Delegation der Input-Events
// - Kapselung des Spielzustands (Start, Playing, Win, Lose, Score, Damage)

import { InputManager } from "./input-manager.js";
import { drawStartScreen, drawEndScreen, drawHearts } from "./game-utils.js";
import { GameConfig } from "./game-config.js";
import { HorseGame } from "./modules/horse.js";
import { FruitGame } from "./modules/fruit.js";
import { UfoGame } from "./modules/ufo.js";
import { BubbleGame } from "./modules/bubble.js";

const { CANVAS_WIDTH: W, CANVAS_HEIGHT: H, SCALE: S } = GameConfig;

// Engine über den Zustand des laufenden Spiels
export class GameEngine {
	#score = 0;

	constructor(canvasId, audioEngine) {
		// Leinwand- und Audioinitialisierung
		this.canvasId = canvasId;
		this.canvas = document.getElementById(canvasId);
		this.ctx = this.canvas.getContext("2d");
		this.audio = audioEngine;

		// Übernahme der Eingabe-Events vom InputManager
		this.input = new InputManager(this.canvas, {
			onKeyDown: (e) => this.handleKeyDown(e),
			onKeyUp: (e) => this.handleKeyUp(e),
			onPointerMove: (e) => this.handlePointerMove(e),
			onPointerDown: (e) => this.handlePointerDown(e),
			onPointerUp: (e) => this.handlePointerUp(e),
		});

		// Zustandsvariablen
		this.activeGame = null;
		this.animationId = null;
		this.gameState = "start";
		this.volume = 0;

		this.difficulty = 1.0;
		this.lives = 3;
		this.maxScore = 250;

		this.#score = 0;
		this.frames = 0;
		this.lastTime = 0;
		this.lastHit = 0;
		this.damageTime = 0;
		this.recoveringHeart = false;

		this.cursorStyle = GameConfig.COLORS.UI.cursor[0];

		this.setupCanvas();
	}

	// Getter für die aktuelle Punktzahl
	get score() {
		return this.#score;
	}

	// Leinwand vorbereiten und skalieren
	setupCanvas() {
		const dpr = window.devicePixelRatio || 1;
		const rectangle = this.canvas.getBoundingClientRect();
		// Skalierung mit Device-Pixel-Ratio zur Vermeidung von Unschärfen
		this.canvas.width = rectangle.width * dpr;
		this.canvas.height = rectangle.height * dpr;
		this.ctx.scale(this.canvas.width / GameConfig.CANVAS_WIDTH, this.canvas.height / GameConfig.CANVAS_HEIGHT);
	}

	// Cleanup
	destroy() {
		if (this.animationId) {
			// Beendigung der Animationsschleife
			cancelAnimationFrame(this.animationId);
			this.animationId = null;
		}
		// Eingabe-Event-Listener entfernen
		if (this.input) this.input.destroy();
		this.activeGame = null;
		// Leinwand löschen
		this.ctx.clearRect(0, 0, GameConfig.CANVAS_WIDTH, GameConfig.CANVAS_HEIGHT);
	}

	// Event Handler
	handlePointerMove(e) {
		// Pointerwechsel über Start-/Endebutton
		const pointer = this.input.getPointerPos(e);
		switch (this.gameState) {
			case "playing":
				return;
			case "start":
				this.canvas.style.cursor = this.input.isOverButton(pointer, GameConfig.START_BUTTON)
					? "pointer"
					: "default";
				break;
			case "win":
			case "lose":
				this.canvas.style.cursor = this.input.isOverButton(pointer, GameConfig.CONTINUE_BUTTON)
					? "pointer"
					: "default";
				break;
		}
	}

	handlePointerDown(e) {
		const pointer = this.input.getPointerPos(e);
		switch (this.gameState) {
			case "playing":
				// Delegation des Pointer-Down-Events an das aktive Spiel
				this.activeGame.onPointerDown(e);
				break;
			case "start":
				// Spielstart-Funktion
				if (this.input.isOverButton(pointer, GameConfig.START_BUTTON)) this.startGame();
				break;
			case "win":
			case "lose":
				// Spielende-Funktion
				if (this.input.isOverButton(pointer, GameConfig.CONTINUE_BUTTON)) this.endGame();
				break;
		}
	}

	handlePointerUp(e) {
		// Delegation des Pointer-Up-Events an das aktive Spiel
		if (this.gameState === "playing") this.activeGame.onPointerUp(e);
	}

	handleKeyDown(e) {
		const key = e.key.toLowerCase();
		switch (this.gameState) {
			case "playing":
				// Delegation bestimmter Key-Down-Events an das aktive Spiel
				if ([" ", "enter", "arrowup", "w"].includes(key)) this.activeGame.onKeyDown(key);
				else if (key === "escape") this.endGame(); // Spielende-Funktion
				break;
			// Buttonbestätigung via Tastatur im Spielstart- und endebildschirm
			case "start":
			case "win":
			case "lose":
				if (key === " " || key === "enter") {
					this.gameState === "start" ? this.startGame() : this.endGame();
				}
				break;
		}
	}

	handleKeyUp(e) {
		const key = e.key.toLowerCase();
		// Delegation bestimmter Key-Up-Events an das aktive Spiel
		if (this.gameState === "playing" && [" ", "enter", "arrowup", "w"].includes(key)) this.activeGame.onKeyUp(key);
	}

	// Spielzustand initialisieren
	loadGame(type, difficulty, maxScore) {
		// Allgemeine Konfiguration
		this.difficulty = difficulty;
		this.maxScore = maxScore;
		this.maxLives = difficulty == 0.6 ? 3 : difficulty == 1 ? 2 : 1; // Mapping Schwierigkeitsgrad auf Anzahl Leben
		this.#score = 0;
		this.lives = this.maxLives;

		this.canvas.style.cursor = "default";
		this.gameState = "start";

		// Spielsezifische Konfiguration
		const gameMap = { horse: HorseGame, fruit: FruitGame, ufo: UfoGame, bubble: BubbleGame };
		this.activeGameType = type;
		try {
			// Mapping Typ-String auf entsprechende Minigame-Klasse
			this.activeGame = new gameMap[type](this);
			this.activeGame.init();
			this.input.setSyncPointer(this.activeGame.syncPointerOnDown); // spielabhängige Pointersynchronisation bei Pointer-Down-Event

			// Starten der Schleife
			if (this.animationId) cancelAnimationFrame(this.animationId); // Vorherige Animation beenden
			this.lastTime = Date.now();
			// Lautstärke auf 0 setzen als Vorbereitung des Fade-Ins
			this.volume = 0;
			if (this.audio) this.audio.setVolume(0);
			this.loop();
		} catch (error) {
			console.warn("Spiel konnte nicht geladen werden:", error.message);
			this.gameState = "error";
			this.endGame();
		}
	}

	// Spielstartfunktion
	startGame() {
		this.gameState = "playing";
		this.canvas.style.cursor = "none";
		this.addScore(0);
	}

	// Spielendefunktion
	endGame() {
		// Auslösen eines Spielende-Events für den UI-Manager (game-ui)
		document.dispatchEvent(new CustomEvent("exitGameRequested", { detail: { canvasId: this.canvasId } }));
	}

	// Hauptschleife (Start der Spielanimation)
	loop() {
		let now = Date.now();
		// Berechnung deltaTime (Vergangene Zeit / Soll-Dauer eines Frames) für framerate-unabhängige Physik
		// Begrenzung des Physikfortschritts auf maximal 3 Frames
		let deltaTime = Math.min(3.0, (now - this.lastTime) / (1000 / GameConfig.FPS));
		this.lastTime = now;

		// Fade-In
		// Erhöhung der Lautstärke von 0 bis 1 in 200 Frames
		if (!window.isMuted && this.volume < 1.0) {
			this.volume += 0.005;
			if (this.audio) this.audio.setVolume(Math.min(1.0, this.volume));
		}

		// Löschen der Leinwand
		this.ctx.clearRect(0, 0, GameConfig.CANVAS_WIDTH, GameConfig.CANVAS_HEIGHT);

		// Spezifische Update-Funktionen
		switch (this.gameState) {
			case "start":
				this.updateStart(deltaTime);
				break;
			case "playing":
				this.updatePlaying(deltaTime, now);
				break;
			case "win":
			case "lose":
				this.updateEnd();
				break;
		}

		// Anforderung des nächsten Frames vom Browser
		this.animationId = requestAnimationFrame(() => this.loop());
	}

	// Spielmanagement
	updatePlaying(deltaTime, now) {
		// Schadensanzeigemanagement
		if (this.recoveringHeart && now - this.damageTime > GameConfig.DAMAGE_COOLDOWN * this.difficulty) {
			this.recoveringHeart = false;
		}
		this.cursorStyle = GameConfig.COLORS.UI.cursor[now - this.lastHit < 200 ? 1 : 0];

		// Pointermanagement
		if (this.activeGame.useDefaultKeyboard) this.input.updateKeyboardMovement(deltaTime);
		this.input.updateLerp(deltaTime);

		// Spezifische Spiele-Logik ausführen und zeichnen
		this.activeGame.update(deltaTime);
		this.activeGame.draw(this.ctx);

		// Lebensanzeige darüber zeichnen
		drawHearts(this.ctx, this);
	}

	// Startbildschirm mit verlangsamtem Spielhintergrund
	updateStart(deltaTime) {
		this.activeGame.update(deltaTime * 0.3);
		this.activeGame.draw(this.ctx);
		drawStartScreen(this.ctx, this.activeGameType, this.activeGame, GameConfig.START_BUTTON);
	}

	// Endbildschirm
	updateEnd() {
		drawEndScreen(this.ctx, this.gameState, this.score, this.maxScore, GameConfig.CONTINUE_BUTTON);
	}

	// Funktion zur Veränderung des Spielstandes
	addScore(points) {
		if (this.gameState !== "playing") return;
		this.#score = Math.max(0, this.score + points);

		// Punktanzeige aktualisieren
		const scoreDisplay = document.getElementById(
			this.canvasId === "home-canvas" ? "home-game-score" : "game-score",
		);
		if (scoreDisplay)
			scoreDisplay.innerText = `${Math.min(this.maxScore, Math.floor(this.score))} / ${this.maxScore}`;

		// Sieg-Zustand setzen
		if (this.score >= this.maxScore) {
			if (scoreDisplay) scoreDisplay.innerText = `${this.maxScore} P`;
			this.gameState = "win";
			this.canvas.style.cursor = "default";
			// Auslösen eines Spielende-Events (ohne Listener)
			document.dispatchEvent(new CustomEvent("gameOver", { detail: { result: "win" } }));
			if (this.audio) this.audio.playMusic(musicData.win, false, false, "win");
		}
	}

	// Funktion zum Schadensmanagement
	applyDamage(penalty) {
		if (this.gameState !== "playing") return;
		const now = Date.now();
		this.lastHit = now;

		// Lebensmanagement
		if (this.recoveringHeart && now - this.damageTime < GameConfig.DAMAGE_COOLDOWN * this.difficulty) {
			// Verlust eines Lebens bei zweitem Schaden in kurzem Zeitraum
			this.lives--;
			this.recoveringHeart = false;
			// Niederlage-Zustand setzen
			if (this.lives <= 0) {
				this.gameState = "lose";
				this.canvas.style.cursor = "default";
				// Auslösen eines Spielende-Events (ohne Listener)
				document.dispatchEvent(new CustomEvent("gameOver", { detail: { result: "lose" } }));
				if (this.audio) this.audio.playMusic(musicData.lose, false, false, "lose");
			}
		} else if (!this.recoveringHeart) {
			// Blinkendes Herz bei erstem Schaden
			this.recoveringHeart = true;
			this.damageTime = now;
		}

		// Punktabzug
		if (penalty) this.addScore(penalty);
	}
}
