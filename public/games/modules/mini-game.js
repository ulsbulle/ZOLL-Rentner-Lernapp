// Minispielklasse
// -----------------------------

export class MiniGame {
	constructor(engine) {
		this.engine = engine;
		this.input = engine.input;
		this.title = "";
		this.instructions = [];
		this.useDefaultKeyboard = false;
		this.syncPointerOnDown = false;
		this.frames = 0;
	}

	init() {}
	onPointerDown(e) {}
	onPointerUp(e) {}
	onKeyDown(key) {}
	onKeyUp(key) {}
	update(deltaTime) {}
	draw(ctx) {}
}
