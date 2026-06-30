// Pferdeparcours
// -----------------------------

import { MiniGame } from "./mini-game.js";
import { drawShadow, drawCharCentered, drawPlayer } from "../game-utils.js";
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

export class HorseGame extends MiniGame {
	constructor(engine) {
		super(engine);
		this.title = "Pferdeparcours";
		this.useDefaultKeyboard = false;
		this.syncPointerOnDown = true;
		this.instructions = INSTRUCTIONS.horse;
	}

	init() {
		if (this.engine.audio) this.engine.audio.playMusic(musicData.horse, true, false, "Pferdeparcours");
		this.player = {
			x: W / 2,
			y: PHYSICS.horse.groundY,
			speedY: 0,
			isJumping: false,
			jumpHoldFrames: 0,
			onGround: true,
		};
		this.clouds = [];
		this.obstacles = [];
		this.nextObstacleFrame = 60;
		this.touchStart = null;
		this.touchStartY = null;
		this.pendingPoints = 0;

		// Wolkengenerierung
		for (let cloudIndex = 0; cloudIndex < 5; cloudIndex++) {
			this.clouds.push({
				x: Math.random() * W,
				y: (Math.random() * 80 + 20) * S,
				size: (Math.random() * 20 + 20) * S,
				speed: (Math.random() * 0.2 + 0.1) * S,
			});
		}

		// Generierung der Hindernisse
		this.createObstacle = () => {
			this.obstacles.push({ x: W + 20 * S, y: PHYSICS.horse.groundY, passed: false, hit: false });
		};
	}

	// Sprunglogik
	jump(jumpPower = undefined) {
		if (this.player.y >= PHYSICS.horse.groundY) {
			this.player.speedY = jumpPower ?? -PHYSICS.horse.jumpPower;
			this.player.isJumping = true;
			this.player.jumpHoldFrames = 0;
			if (this.engine.audio && this.engine.gameState === "playing")
				this.engine.audio.playSoundEffect(SOUNDS.horse.jump);
		}
	}

	// Event Handler
	onPointerDown(e) {
		this.touchStart = Date.now();
		this.touchStartY = this.input.mouse.y;
	}

	onPointerUp(e) {
		// Berechnung der Sprungstärke bei Swipe
		if (!this.touchStart || this.player.y < PHYSICS.horse.groundY) return;

		const touchDuration = Math.max(30, Date.now() - this.touchStart);
		const touchDistance = this.touchStartY - this.input.mouse.y;
		if (touchDistance < 25 * S) {
			this.jump();
		} else {
			const swipePower = (touchDistance / S / touchDuration) * 2 * PHYSICS.horse.jumpPower;
			this.jump(-Math.max(PHYSICS.horse.jumpPower, Math.min(2 * PHYSICS.horse.jumpPower, swipePower)));
		}

		this.player.isJumping = false;
	}

	onKeyDown(key) {
		this.jump();
	}

	onKeyUp(key) {
		this.player.isJumping = false;
	}

	// Physik
	update(deltaTime) {
		this.frames += 1 * deltaTime;

		const progress = this.engine.score / this.engine.maxScore;
		const difficulty = this.engine.difficulty;

		// Auftrieb: Längerer Tastendruck --> höherer Sprung
		if (this.player.isJumping) {
			this.player.jumpHoldFrames += deltaTime;
			if (this.player.jumpHoldFrames < PHYSICS.horse.maxHoldFrames) {
				this.player.speedY = -Math.max(PHYSICS.horse.jumpPower, this.player.jumpHoldFrames * 0.8 * S);
			} else {
				// Beenden nach einer bestimmten Zahl Frames (Standard: 15)
				this.player.isJumping = false;
			}
		}
		this.player.onGround = this.player.y >= PHYSICS.horse.groundY;

		// Gravitation
		this.player.speedY += PHYSICS.horse.gravity * Math.sqrt(difficulty) * deltaTime;
		this.player.y += this.player.speedY * deltaTime;
		if (this.player.y < 20 * S) {
			this.player.y = 20 * S;
			this.player.speedY = 0;
		}
		if (this.player.y > PHYSICS.horse.groundY) {
			this.player.y = PHYSICS.horse.groundY;
			this.player.speedY = 0;
			if (this.engine.audio && this.engine.gameState === "playing" && !this.player.onGround)
				this.engine.audio.playSoundEffect(SOUNDS.horse.landed);
			this.player.isJumping = false;

			if (this.pendingPoints > 0) {
				this.engine.addScore(this.pendingPoints);
				if (this.engine.audio && this.engine.gameState === "playing")
					this.engine.audio.playSoundEffect(SOUNDS.horse.obstacleCleared);
				this.pendingPoints = 0;
			}
		}

		// Bewegung der Wolken
		this.clouds.forEach((cloud) => {
			cloud.x -= cloud.speed * deltaTime;
			if (cloud.x < -100 * S) cloud.x = W + 50 * S; // Reset am rechten Rand
		});

		// Hindernisse
		const spawnConfig = PHYSICS.horse.spawnRate;
		const spawnGap =
			spawnConfig.base / (spawnConfig.r * Math.random() + spawnConfig.p * progress + spawnConfig.d * difficulty);
		if (this.frames >= this.nextObstacleFrame) {
			this.createObstacle();
			this.nextObstacleFrame = this.frames + spawnGap;
		}

		// Kollisionsmanagement
		for (let obstacleIndex = this.obstacles.length - 1; obstacleIndex >= 0; obstacleIndex--) {
			const obstacle = this.obstacles[obstacleIndex];
			const speedConfig = PHYSICS.horse.targetSpeed;
			const speed =
				speedConfig.base *
				(speedConfig.r * Math.random() + speedConfig.p * progress + speedConfig.d * difficulty);

			obstacle.x -= speed * deltaTime;

			// Hinderniskollision
			if (
				!obstacle.hit &&
				obstacle.x > 30 * S &&
				obstacle.x < 70 * S &&
				this.player.y > PHYSICS.horse.groundY - 40 * S
			) {
				obstacle.hit = true;
				obstacle.passed = true;
				this.engine.applyDamage(POINTS.horse.obstacleHit);
				if (this.engine.audio && this.engine.gameState === "playing")
					this.engine.audio.playSoundEffect(SOUNDS.horse.obstacleHit);
			}

			// Hindernis übersprungen
			if (obstacle.x < 30 * S && !obstacle.passed && !obstacle.hit) {
				obstacle.passed = true;
				this.pendingPoints += POINTS.horse.obstacleCleared;
			}

			// Entfernen von Hindernissen außerhalb des Bildschirms
			if (obstacle.x < -50 * S) this.obstacles.splice(obstacleIndex, 1);
		}
	}

	// Zeichnen
	draw(ctx) {
		// Himmel
		ctx.save();
		ctx.fillStyle = COLORS.horse.sky;
		ctx.fillRect(0, 0, W, H);
		ctx.restore();

		// Sonne
		// Leuchten
		ctx.save();
		ctx.shadowColor = COLORS.horse.sun[0];
		ctx.shadowBlur = 15;

		// Corona als kreisförmige Welle
		ctx.globalAlpha = 0.8;
		ctx.fillStyle = COLORS.horse.sun[1];
		ctx.beginPath();
		for (let rayIndex = 0; rayIndex <= 36; rayIndex++) {
			const angle = (rayIndex * Math.PI) / 18;
			const radius = (35 + Math.sin(angle * 12 - this.frames * 0.1) * 5) * S;
			ctx.lineTo(W - 50 * S + Math.cos(angle) * radius, 50 * S + Math.sin(angle) * radius);
		}
		ctx.closePath();
		ctx.fill();

		// Sonnenscheibe
		ctx.fillStyle = COLORS.horse.sun[2];
		ctx.beginPath();
		ctx.arc(W - 50 * S, 50 * S, 30 * S, 0, Math.PI * 2);
		ctx.fill();

		// Sonnenbrillen-Emoji
		drawCharCentered(ctx, W - 50 * S, 45 * S, CHARS.horse.object.char, font(CHARS.horse.object.size, true));
		ctx.restore();

		// Wolken aus je drei Kreisen
		ctx.save();
		ctx.globalAlpha = 0.8;
		ctx.fillStyle = COLORS.horse.cloud;
		this.clouds.forEach((cloud) => {
			ctx.beginPath();
			ctx.arc(cloud.x, cloud.y, cloud.size, 0, Math.PI * 2);
			ctx.arc(cloud.x + cloud.size * 0.6, cloud.y - cloud.size * 0.2, cloud.size * 0.7, 0, Math.PI * 2);
			ctx.arc(cloud.x + cloud.size * 1.1, cloud.y, cloud.size * 0.8, 0, Math.PI * 2);
			ctx.fill();
		});
		ctx.restore();

		// Boden
		ctx.save();
		ctx.fillStyle = COLORS.horse.grass[0];
		ctx.fillRect(0, GameConfig.GROUND_Y, W, 20 * S);
		ctx.restore();

		// Grashalme
		ctx.save();
		ctx.strokeStyle = COLORS.horse.grass[1];
		ctx.lineWidth = 1.2 * S;
		for (let grassX = 0; grassX < W + 20 * S; grassX += 20 * S) {
			ctx.beginPath();
			const grassOffset = (PHYSICS.horse.grassSpeed * this.frames * this.engine.difficulty) % (20 * S);
			ctx.moveTo(grassX - grassOffset, GameConfig.GROUND_Y);
			ctx.lineTo(grassX - grassOffset - 2 * S, GameConfig.GROUND_Y - 5 * S);
			ctx.stroke();
		}
		ctx.restore();

		// Hindernisse
		this.obstacles.forEach((obstacle) => {
			drawCharCentered(ctx, obstacle.x, obstacle.y, CHARS.horse.target.char, font(CHARS.horse.target.size, true));
		});

		// Spieler
		drawShadow(ctx, 50 * S, GameConfig.GROUND_Y, this.player.y, 180 * S);
		drawPlayer(
			ctx,
			[this.input.lerp.x, 50 * S],
			[this.input.lerp.y, this.player.y],
			HIGHLIGHT_RADIUS.horse,
			this.engine.cursorStyle,
			CHARS.horse.player,
		);
	}
}
