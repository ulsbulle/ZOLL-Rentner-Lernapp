// Früchtefänger
// -----------------------------

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
		this.useDefaultKeyboard = true;
		this.syncPointerOnDown = false;
		this.instructions = INSTRUCTIONS.fruit;
	}

	init() {
		if (this.engine.audio) this.engine.audio.playMusic(musicData.fruit, true, false, "Früchtefänger");
		this.particles = [];
		this.fallingFood = [];
		this.nextFoodFrame = 20;

		// Generierung des herabfallenden Essens
		this.createFood = () => {
			const progress = this.engine.score / this.engine.maxScore;
			const difficulty = this.engine.difficulty;
			const speedConfig = PHYSICS.fruit.targetSpeed;
			const randomSpread = Math.random();
			const foodType = randomSpread < 0.4 ? 0 : randomSpread < 0.8 ? 1 : 2; // Verteilung 40% + 40% + 20%

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
	update(deltaTime) {
		this.frames += 1 * deltaTime;

		const progress = this.engine.score / this.engine.maxScore;
		const difficulty = this.engine.difficulty;

		// Herabfallendes Essen
		const spawnConfig = PHYSICS.fruit.spawnRate;
		const spawnRate =
			spawnConfig.base / (spawnConfig.r * Math.random() + spawnConfig.p * progress + spawnConfig.d * difficulty);
		if (this.frames >= this.nextFoodFrame) {
			this.createFood();
			this.nextFoodFrame = this.frames + spawnRate;
		}

		// Explosionspartikel
		for (let particleIndex = this.particles.length - 1; particleIndex >= 0; particleIndex--) {
			const particle = this.particles[particleIndex];
			particle.x += particle.speedX * deltaTime;
			particle.y += particle.speedY * deltaTime;
			particle.alpha -= 0.02 * deltaTime; // Partikel verblasst
			if (particle.alpha <= 0) this.particles.splice(particleIndex, 1);
		}

		// Kollisionsmanagement
		for (let fallingFoodIndex = this.fallingFood.length - 1; fallingFoodIndex >= 0; fallingFoodIndex--) {
			const fallingFood = this.fallingFood[fallingFoodIndex];
			fallingFood.y += fallingFood.speed * deltaTime;

			// Herabfallendes Essen verpasst
			if (fallingFood.y > GameConfig.GROUND_Y) {
				if (fallingFood.type === 2) {
					this.engine.addScore(POINTS.fruit.junkfoodMissed); // Junkfood vermieden
					if (this.engine.audio && this.engine.gameState === "playing")
						this.engine.audio.playSoundEffect(SOUNDS.fruit.junkfoodMissed);
				} else {
					createExplosion(
						this,
						fallingFood.x,
						GameConfig.GROUND_Y,
						COLORS.fruit.squashParticles[fallingFood.type][fallingFood.foodId],
					);
					this.engine.applyDamage(POINTS.fruit.freshMissed); // Obst/Gemüse verpasst
					if (this.engine.audio && this.engine.gameState === "playing")
						this.engine.audio.playSoundEffect(SOUNDS.fruit.freshMissed);
				}
				this.fallingFood.splice(fallingFoodIndex, 1);
				continue;
			}

			// Herabfallendes Essen gefangen
			if (
				Math.abs(this.input.lerp.x - fallingFood.x) < 25 * S &&
				Math.abs(this.input.lerp.y - fallingFood.y) < 25 * S
			) {
				if (fallingFood.type === 0) {
					this.engine.addScore(POINTS.fruit.fruitCaught); // Obst gefangen
					if (this.engine.audio && this.engine.gameState === "playing")
						this.engine.audio.playSoundEffect(SOUNDS.fruit.fruitCaught);
				} else if (fallingFood.type === 1) {
					this.engine.addScore(POINTS.fruit.vegetableCaught); // Gemüse gefangen
					if (this.engine.audio && this.engine.gameState === "playing")
						this.engine.audio.playSoundEffect(SOUNDS.fruit.vegetableCaught);
				} else if (fallingFood.type === 2) {
					this.engine.applyDamage(POINTS.fruit.junkfoodCaught); // Junkfood gefangen
					if (this.engine.audio && this.engine.gameState === "playing")
						this.engine.audio.playSoundEffect(SOUNDS.fruit.junkfoodCaught);
				}
				this.fallingFood.splice(fallingFoodIndex, 1);
			}
		}
	}

	// Zeichnen
	draw(ctx) {
		// Tapete
		ctx.save();
		ctx.fillStyle = COLORS.fruit.wallpaper[0];
		ctx.fillRect(0, 0, W, H);
		ctx.strokeStyle = COLORS.fruit.wallpaper[1];
		ctx.lineWidth = 1 * S;
		const gridSize = 20 * S;
		ctx.beginPath();

		for (let gridX = 0; gridX <= W; gridX += gridSize) {
			ctx.moveTo(gridX, 0);
			ctx.lineTo(gridX, H);
		}
		for (let gridY = 0; gridY <= H; gridY += gridSize) {
			ctx.moveTo(0, gridY);
			ctx.lineTo(W, gridY);
		}
		ctx.stroke();
		ctx.restore();

		// Tisch
		ctx.save();
		ctx.fillStyle = COLORS.fruit.table[0];
		ctx.fillRect(0, GameConfig.GROUND_Y, W, H - GameConfig.GROUND_Y);
		ctx.fillStyle = COLORS.fruit.table[1];
		ctx.fillRect(0, GameConfig.GROUND_Y, W, 4 * S);
		ctx.restore();

		// Herabfallendes Essen
		this.fallingFood.forEach((fallingFood) => {
			drawShadow(ctx, fallingFood.x, GameConfig.GROUND_Y, fallingFood.y, 120 * S);
			const currentEmoji = CHARS.fruit.target.char[fallingFood.type][fallingFood.foodId];
			drawCharCentered(ctx, fallingFood.x, fallingFood.y, currentEmoji, font(CHARS.fruit.target.size, true));
		});

		// Explosionspartikel
		ctx.save();
		this.particles.forEach((particle) => {
			ctx.fillStyle = particle.color;
			ctx.globalAlpha = Math.max(0, particle.alpha);
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
