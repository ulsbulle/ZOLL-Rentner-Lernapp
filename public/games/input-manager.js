// Input-Event-Listener und Manager
// -----------------------------

import { GameConfig } from "./game-config.js";

export class InputManager {
	constructor(canvas, callbacks) {
		this.canvas = canvas;
		this.callbacks = callbacks ?? {};
		this.keys = {};
		this.mouse = { x: GameConfig.CENTER_X, y: GameConfig.CENTER_Y };
		this.lerp = { x: GameConfig.CENTER_X, y: GameConfig.CENTER_Y };
		this.activePointers = new Set();
		this.steeringPointerId = null;
		this.syncPointerOnDown = false;

		this.initListeners();
	}

	setSyncPointer(value) {
		this.syncPointerOnDown = value;
	}

	// Event Listener entfernen
	destroy() {
		window.removeEventListener("keydown", this.handleKeyDown);
		window.removeEventListener("keyup", this.handleKeyUp);
		this.canvas.onpointermove = null;
		this.canvas.onpointerdown = null;
		this.canvas.onpointerup = null;
		this.canvas.removeEventListener("contextmenu", this.handleContextMenu);
	}

	// Event Listener initialisieren
	initListeners() {
		// Tastatureingaben
		this.handleKeyDown = (e) => {
			const key = e.key.toLowerCase();

			// Kein Blockieren der Eingaben in Textfeldern im Menü
			if (document.activeElement && ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) {
				return;
			}

			// Blockieren des Standardverhaltens im Spiel
			if (
				[
					" ",
					"enter",
					"escape",
					"arrowup",
					"arrowdown",
					"arrowleft",
					"arrowright",
					"w",
					"a",
					"s",
					"d",
				].includes(key)
			) {
				e.preventDefault();
			}

			// Weiterleitung an Callbacks
			if (this.keys[key] !== true && this.callbacks.onKeyDown) {
				this.callbacks.onKeyDown(e);
			}
			this.keys[key] = true;
		};

		this.handleKeyUp = (e) => {
			// Weiterleitung an Callbacks
			this.keys[e.key.toLowerCase()] = false;
			if (this.callbacks.onKeyUp) this.callbacks.onKeyUp(e);
		};

		window.addEventListener("keydown", this.handleKeyDown);
		window.addEventListener("keyup", this.handleKeyUp);

		// Pointereingaben
		this.canvas.onpointermove = (e) => {
			if (this.steeringPointerId === e.pointerId || e.pointerType === "mouse") {
				// Begrenzen der Pointerposition auf die Leinwand
				const pointer = this.getPointerPos(e);
				this.mouse.x = Math.max(
					GameConfig.MARGIN,
					Math.min(GameConfig.CANVAS_WIDTH - GameConfig.MARGIN, pointer.x),
				);
				this.mouse.y = Math.max(
					GameConfig.MARGIN,
					Math.min(GameConfig.CANVAS_HEIGHT - GameConfig.MARGIN, pointer.y),
				);
			}

			// Weiterleitung an Callbacks
			if (this.callbacks.onPointerMove) this.callbacks.onPointerMove(e);
		};

		this.canvas.onpointerdown = (e) => {
			e.preventDefault();
			// Fokus von HTML-Elementen entfernen
			if (document.activeElement) document.activeElement.blur();

			this.activePointers.add(e.pointerId);
			this.canvas.setPointerCapture(e.pointerId);

			// Erster Touch --> Steuerungspointer setzen
			if (this.steeringPointerId === null || e.pointerType === "mouse") {
				this.steeringPointerId = e.pointerId;
			}

			// Spielerposition setzen
			if (this.syncPointerOnDown) {
				// Begrenzen der Pointerposition auf die Leinwand
				const pointer = this.getPointerPos(e);
				this.mouse.x = Math.max(
					GameConfig.MARGIN,
					Math.min(GameConfig.CANVAS_WIDTH - GameConfig.MARGIN, pointer.x),
				);
				this.mouse.y = Math.max(
					GameConfig.MARGIN,
					Math.min(GameConfig.CANVAS_HEIGHT - GameConfig.MARGIN, pointer.y),
				);
			}

			// Weiterleitung an Callbacks
			if (this.callbacks.onPointerDown) this.callbacks.onPointerDown(e);
		};

		this.canvas.onpointerup = (e) => {
			e.preventDefault();
			if (this.steeringPointerId === e.pointerId) this.steeringPointerId = null;
			if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);

			// Weiterleitung an Callbacks
			if (this.callbacks.onPointerUp) this.callbacks.onPointerUp(e);
			this.activePointers.delete(e.pointerId);
		};

		this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
	}

	// Pointer-Koordinaten ermitteln
	getPointerPos(e) {
		const r = this.canvas.getBoundingClientRect();
		return {
			x: (e.clientX - r.left) * (GameConfig.CANVAS_WIDTH / r.width),
			y: (e.clientY - r.top) * (GameConfig.CANVAS_HEIGHT / r.height),
		};
	}

	// Interpolation (lerp) der Pointerbewegung
	updateLerp(deltaTime) {
		this.lerp.x += (this.mouse.x - this.lerp.x) * 0.2 * deltaTime;
		this.lerp.y += (this.mouse.y - this.lerp.y) * 0.2 * deltaTime;
	}

	// Bewegungsteuerung mittels Tastatur
	updateKeyboardMovement(deltaTime) {
		const speed = 7 * GameConfig.SCALE * deltaTime;
		if (this.isKeyDown("w") || this.isKeyDown("arrowup")) this.mouse.y -= speed;
		if (this.isKeyDown("s") || this.isKeyDown("arrowdown")) this.mouse.y += speed;
		if (this.isKeyDown("a") || this.isKeyDown("arrowleft")) this.mouse.x -= speed;
		if (this.isKeyDown("d") || this.isKeyDown("arrowright")) this.mouse.x += speed;

		// Begrenzen der Pointerposition auf die Leinwand
		this.mouse.x = Math.max(GameConfig.MARGIN, Math.min(GameConfig.CANVAS_WIDTH - GameConfig.MARGIN, this.mouse.x));
		this.mouse.y = Math.max(
			GameConfig.MARGIN,
			Math.min(GameConfig.CANVAS_HEIGHT - GameConfig.MARGIN, this.mouse.y),
		);
	}

	// Überprüfen, ob Taste niedergedrückt ist
	isKeyDown(key) {
		return !!this.keys[key.toLowerCase()];
	}

	// Überprüfe, ob Pointer über Buttongrenzen liegt
	isOverButton(pointer, rectangle) {
		return (
			pointer.x >= rectangle.x &&
			pointer.x <= rectangle.x + rectangle.w &&
			pointer.y >= rectangle.y &&
			pointer.y <= rectangle.y + rectangle.h
		);
	}
}
