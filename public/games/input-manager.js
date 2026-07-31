// Input-Event-Listener und Manager
// ---------------------------------
// - Empfangen gerätespezifischer Eingaben (Maus, Touch, Tastatur)
// - Verwaltung aktiver Pointer-IDs zur Multitouch-Steuerung
// - Management der Spielerposition und Lerp-Interpolation
// - Weiterleitung relevanter Eingaben über Callbacks

import { GameConfig } from "./game-config.js";

export class InputManager {
	constructor(canvas, callbacks) {
		this.canvas = canvas;
		this.callbacks = callbacks ?? {}; // Callbacks: onKeyDown, onKeyUp, onPointerMove, onPointerDown, onPointerUp
		this.keys = {};
		this.mouse = { x: GameConfig.CENTER_X, y: GameConfig.CENTER_Y };
		this.lerp = { x: GameConfig.CENTER_X, y: GameConfig.CENTER_Y };
		this.activePointers = new Set();
		this.steeringPointerId = null;
		this.syncPointerOnDown = false;

		this.initListeners();
	}

	setSyncPointer(value) {
		this.syncPointerOnDown = value; // Verhalten Pointerposition bei Pointer-Down
	}

	// Event Listener entfernen
	// Deregistrierung zur Vermeidung von Komplikationen
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

			// Weiterleitung an Callbacks (nur bei Anschlag, keine Dauerweiterleitung bei Gedrückthalten)
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
			// Fokus von HTML-Elementen entfernen, damit Eingaben an das Spiel gehen
			if (document.activeElement) document.activeElement.blur();

			this.activePointers.add(e.pointerId); // Pointer registrieren
			this.canvas.setPointerCapture(e.pointerId); // Pointerereignisse auch außerhalb der Leinwand empfangen

			// Erster Touch oder Maus --> Steuerungspointer setzen
			// Sicherstellung, dass nachfolgende Multitouch-Events die Steuerung nicht überschreiben
			if (this.steeringPointerId === null || e.pointerType === "mouse") {
				this.steeringPointerId = e.pointerId;
			}

			// Spielerposition setzen (wenn Synchronisation bei Pointer-Down)
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
			// Freigabe des Steuerungspointers bei Beendigung der Geste
			if (this.steeringPointerId === e.pointerId) this.steeringPointerId = null;

			// Freigabe des Pointer Captures
			if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);

			// Weiterleitung an Callbacks
			if (this.callbacks.onPointerUp) this.callbacks.onPointerUp(e);

			// Pointer deregistrieren
			this.activePointers.delete(e.pointerId);
		};

		// Unterdrückung des nativen Kontextmenüs bei Rechtsklick
		this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
	}

	// Pointer-Koordinaten ermitteln
	// Transformation der Browser-Koordinaten skalierte Leinwand-Koordinaten
	getPointerPos(e) {
		const r = this.canvas.getBoundingClientRect();
		return {
			x: (e.clientX - r.left) * (GameConfig.CANVAS_WIDTH / r.width),
			y: (e.clientY - r.top) * (GameConfig.CANVAS_HEIGHT / r.height),
		};
	}

	// Interpolation (lerp) der Pointerbewegung
	// Glättung ruckartiger Bewegungen
	updateLerp(deltaTime) {
		this.lerp.x += (this.mouse.x - this.lerp.x) * 0.2 * deltaTime;
		this.lerp.y += (this.mouse.y - this.lerp.y) * 0.2 * deltaTime;
	}

	// Bewegungsteuerung mittels Tastatur
	// Feste Bewegung pro niedergedrücktem Frame
	updateKeyboardMovement(deltaTime) {
		const speed = GameConfig.KEYBOARD_MOVEMENT * deltaTime;
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

	// Überprüfen, ob Pointer über Buttongrenzen liegt
	isOverButton(pointer, rectangle) {
		return (
			pointer.x >= rectangle.x &&
			pointer.x <= rectangle.x + rectangle.w &&
			pointer.y >= rectangle.y &&
			pointer.y <= rectangle.y + rectangle.h
		);
	}
}
