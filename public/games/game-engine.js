// Spielengine und Hauptschleife
// ------------------------------

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

		// Übernahme der Eingaben vom InputManager
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
		this.maxScore = 200;

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
		this.canvas.width = rectangle.width * dpr;
		this.canvas.height = rectangle.height * dpr;
		this.ctx.scale(this.canvas.width / GameConfig.CANVAS_WIDTH, this.canvas.height / GameConfig.CANVAS_HEIGHT);
	}

	// Cleanup
	destroy() {
		if (this.animationId) {
			cancelAnimationFrame(this.animationId);
			this.animationId = null;
		}
		if (this.input) this.input.destroy();
		this.activeGame = null;
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
				this.activeGame.onPointerDown(e);
				break;
			case "start":
				if (this.input.isOverButton(pointer, GameConfig.START_BUTTON)) this.startGame();
				break;
			case "win":
			case "lose":
				if (this.input.isOverButton(pointer, GameConfig.CONTINUE_BUTTON)) this.endGame();
				break;
		}
	}

	handlePointerUp(e) {
		if (this.gameState === "playing") this.activeGame.onPointerUp(e);
	}

	handleKeyDown(e) {
		const key = e.key.toLowerCase();
		switch (this.gameState) {
			case "playing":
				if ([" ", "enter", "arrowup", "w"].includes(key)) this.activeGame.onKeyDown(key);
				else if (key === "escape") this.endGame();
				break;
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
		if (this.gameState === "playing" && [" ", "enter", "arrowup", "w"].includes(key)) this.activeGame.onKeyUp(key);
	}

	// Spielzustand initialisieren
	loadGame(type, difficulty, maxScore) {
		// Allgemeine Konfiguration
		this.difficulty = difficulty;
		this.maxScore = maxScore;
		this.maxLives = difficulty == 0.6 ? 3 : difficulty == 1 ? 2 : 1;
		this.#score = 0;
		this.lives = this.maxLives;

		this.canvas.style.cursor = "default";
		this.gameState = "start";

		// Spielsezifische Konfiguration
		const gameMap = { horse: HorseGame, fruit: FruitGame, ufo: UfoGame, bubble: BubbleGame };
		this.activeGameType = type;
		try {
			this.activeGame = new gameMap[type](this);
			this.activeGame.init();
			this.input.setSyncPointer(this.activeGame.syncPointerOnDown);

			// Starten der Schleife
			if (this.animationId) cancelAnimationFrame(this.animationId);
			this.lastTime = Date.now();
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
		document.dispatchEvent(new CustomEvent("exitGameRequested", { detail: { canvasId: this.canvasId } }));
	}

	// Hauptschleife (Start der Spielanimation)
	loop() {
		let now = Date.now();
		let deltaTime = Math.min(3.0, (now - this.lastTime) / (1000 / GameConfig.FPS));
		this.lastTime = now;

		// Fade-In
		if (this.volume < 1.0) {
			this.volume += 0.005;
			if (this.audio) this.audio.setVolume(Math.min(1.0, this.volume));
		}

		this.ctx.clearRect(0, 0, GameConfig.CANVAS_WIDTH, GameConfig.CANVAS_HEIGHT);

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
