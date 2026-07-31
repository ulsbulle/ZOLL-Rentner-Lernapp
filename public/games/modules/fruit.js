// Früchtefänger
// -----------------------------
// - Catch-and-Avoid-Spiel: Der Spieler muss herabfallendes Obst und Gemüse auffangen und dem Junkfood ausweichen.
// - Implementierung eines Objektpools mit Kollisions- und Punktemanagement, differenziert nach Objekttyp
// - Rendering von Hintergrund und Explosionen

import { MiniGame } from "./mini-game.js";
import { createExplosion, drawShadow, drawCharCentered, drawPlayer } from "../game-utils.js";
import { GameConfig } from "../game-config.js";

const {
	CANVAS_WIDTH: W,
	CANVAS_HEIGHT: H,
	SCALE: S,
	font,
	HIGHLIGHT_RADIUS,
	CHARS,
	COLORS,
	PHYSICS,
	POINTS,
	SOUNDS,
	INSTRUCTIONS,
} = GameConfig;

export class FruitGame extends MiniGame {
	constructor(engine) {
		super(engine);
		this.title = "Früchtefänger";
		this.useDefaultKeyboard = true; // Cursorsteuerung über Pfeiltasten und WASD
		this.syncPointerOnDown = false; // kein Cursorsprung zur Pointer-Down-Koordinate
		this.instructions = INSTRUCTIONS.fruit;
	}

	init() {
		if (this.engine.audio) this.engine.audio.playMusic(musicData.fruit, true, false, "Früchtefänger");
		this.particles = [];
		this.fallingFood = [];
		this.nextFoodFrame = 20;

		// Methode zur Generierung des herabfallenden Essens
		// Erzeugen neuer Objekte zufälligen Typs mit zufälliger Position und auf Spielfortschritt, Schwierigkeit und Zufall basierender Geschwindigkeit
		this.createFood = () => {
			const progress = this.engine.score / this.engine.maxScore;
			const difficulty = this.engine.difficulty;
			const speedConfig = PHYSICS.fruit.targetSpeed;
			const randomSpread = Math.random();
			// Verteilung 50% Obst + 30% Gemüse + 20% Junkfood
			const foodType = randomSpread < 0.5 ? 0 : randomSpread < 0.8 ? 1 : 2;

			this.fallingFood.push({
				x: 30 * S + Math.random() * (W - 60 * S),
				y: -40 * S,
				type: foodType,
				foodId: Math.floor(Math.random() * 10),
				speed:
					speedConfig.base *
					(speedConfig.r * Math.random() + speedConfig.p * progress + speedConfig.d * difficulty),
			});
		};
	}

	// Physik
	// Aktualisierung der Spielwelt durch Berechnung von Bewegungen und Kollisionen
	update(deltaTime) {
		this.frames += 1 * deltaTime; // deltaTime = Verhältnis von vergangener Zeit zu Soll-Zeit eines Frames

		const progress = this.engine.score / this.engine.maxScore;
		const difficulty = this.engine.difficulty;

		// Herabfallendes Essen
		// Erzeugen neuer Objekte basierend auf Schwierigkeitsgrad, Spielfortschritt und Zufall
		const spawnConfig = PHYSICS.fruit.spawnRate;
		const spawnRate =
			spawnConfig.base / (spawnConfig.r * Math.random() + spawnConfig.p * progress + spawnConfig.d * difficulty);
		if (this.frames >= this.nextFoodFrame) {
			this.createFood(); // neues Objekt generieren
			this.nextFoodFrame = this.frames + spawnRate; // nächsten Spawnframe definieren
		}

		// Explosionspartikel
		for (let particleIndex = this.particles.length - 1; particleIndex >= 0; particleIndex--) {
			const particle = this.particles[particleIndex];
			particle.x += particle.speedX * deltaTime;
			particle.y += particle.speedY * deltaTime;
			particle.alpha -= 0.02 * deltaTime; // Partikel verblasst mit der Zeit
			if (particle.alpha <= 0) this.particles.splice(particleIndex, 1); // Verblasste Partikel aus dem Array entfernen
		}

		// Kollisionsmanagement
		// Positionsberechnung und Kollisionsprüfung zwischen Spieler und jedem Objekt
		for (let fallingFoodIndex = this.fallingFood.length - 1; fallingFoodIndex >= 0; fallingFoodIndex--) {
			const fallingFood = this.fallingFood[fallingFoodIndex];
			fallingFood.y += fallingFood.speed * deltaTime;

			// Herabfallendes Essen verpasst
			if (fallingFood.y > GameConfig.GROUND) {
				if (fallingFood.type === 2) {
					// Junkfood vermieden
					this.engine.addScore(POINTS.fruit.junkfoodMissed);
					if (this.engine.audio && this.engine.gameState === "playing")
						this.engine.audio.playSoundEffect(SOUNDS.fruit.junkfoodMissed);
				} else {
					// Obst oder Gemüse verpasst
					createExplosion(
						this,
						fallingFood.x,
						GameConfig.GROUND,
						COLORS.fruit.squashParticles[fallingFood.type][fallingFood.foodId],
					);
					this.engine.applyDamage(POINTS.fruit.freshMissed);
					if (this.engine.audio && this.engine.gameState === "playing")
						this.engine.audio.playSoundEffect(SOUNDS.fruit.freshMissed);
				}
				this.fallingFood.splice(fallingFoodIndex, 1); // verpasstes Objekt aus dem Array entfernen
				continue; // zu nächstem Objekt in äußerer for-Schleife springen
			}

			// Herabfallendes Essen gefangen
			if (
				Math.abs(this.input.lerp.x - fallingFood.x) < 25 * S &&
				Math.abs(this.input.lerp.y - fallingFood.y) < 25 * S
			) {
				if (fallingFood.type === 0) {
					// Obst gefangen
					this.engine.addScore(POINTS.fruit.fruitCaught);
					if (this.engine.audio && this.engine.gameState === "playing")
						this.engine.audio.playSoundEffect(SOUNDS.fruit.fruitCaught);
				} else if (fallingFood.type === 1) {
					// Gemüse gefangen
					this.engine.addScore(POINTS.fruit.vegetableCaught);
					if (this.engine.audio && this.engine.gameState === "playing")
						this.engine.audio.playSoundEffect(SOUNDS.fruit.vegetableCaught);
				} else if (fallingFood.type === 2) {
					// Junkfood gefangen
					this.engine.applyDamage(POINTS.fruit.junkfoodCaught);
					if (this.engine.audio && this.engine.gameState === "playing")
						this.engine.audio.playSoundEffect(SOUNDS.fruit.junkfoodCaught);
				}
				this.fallingFood.splice(fallingFoodIndex, 1); // gefangenes Objekt aus dem Array entfernen
			}
		}
	}

	// Zeichnen
	draw(ctx) {
		// Tapete mit kariertem Muster
		ctx.save();
		ctx.fillStyle = COLORS.fruit.wallpaper[0];
		ctx.fillRect(0, 0, W, H); // Hintergrund
		ctx.strokeStyle = COLORS.fruit.wallpaper[1];
		ctx.lineWidth = 1 * S;
		const gridSize = 20 * S; // Abstand zwischen zwei Gitterlinien
		ctx.beginPath();

		// Vertikale Gitterlinien zeichnen
		for (let gridX = 0; gridX <= W; gridX += gridSize) {
			ctx.moveTo(gridX, 0);
			ctx.lineTo(gridX, H);
		}
		// Horizontale Gitterlinien zeichnen
		for (let gridY = 0; gridY <= H; gridY += gridSize) {
			ctx.moveTo(0, gridY);
			ctx.lineTo(W, gridY);
		}
		ctx.stroke();
		ctx.restore();

		// Tisch
		ctx.save();
		ctx.fillStyle = COLORS.fruit.table[0];
		ctx.fillRect(0, GameConfig.GROUND, W, H - GameConfig.GROUND);
		ctx.fillStyle = COLORS.fruit.table[1];
		ctx.fillRect(0, GameConfig.GROUND, W, 4 * S);
		ctx.restore();

		// Herabfallendes Essen
		this.fallingFood.forEach((fallingFood) => {
			drawShadow(ctx, fallingFood.x, GameConfig.GROUND, fallingFood.y, 120 * S); // Schatten zeichnen
			const currentEmoji = CHARS.fruit.target.char[fallingFood.type][fallingFood.foodId];
			drawCharCentered(ctx, fallingFood.x, fallingFood.y, currentEmoji, font(CHARS.fruit.target.size, true));
		});

		// Explosionspartikel
		ctx.save();
		this.particles.forEach((particle) => {
			ctx.globalAlpha = particle.alpha;
			ctx.fillStyle = particle.color;
			ctx.beginPath();
			ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
			ctx.fill();
		});
		ctx.restore();

		// Spieler
		drawPlayer(
			ctx,
			this.input.lerp.x,
			this.input.lerp.y,
			HIGHLIGHT_RADIUS.fruit,
			this.engine.cursorStyle,
			CHARS.fruit.player,
		);
	}
}
