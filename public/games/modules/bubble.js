// BubbleBurst
// -----------------------------

import { MiniGame } from "./mini-game.js";
import { createExplosion, drawCharCentered, drawPlayer } from "../game-utils.js";
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

export class BubbleGame extends MiniGame {
	constructor(engine) {
		super(engine);
		this.title = "BubbleBurst";
		this.useDefaultKeyboard = true;
		this.syncPointerOnDown = true;
		this.instructions = INSTRUCTIONS.bubble;
	}

	init() {
		if (this.engine.audio) this.engine.audio.playMusic(musicData.bubble, true, false, "BubbleBurst");
		this.particles = [];
		this.bubbles = [];
		this.fog = [];

		// Initialisierung einer Hilfsleinwand für Wackeleffekt
		this.offscreenCanvas = document.createElement("canvas");
		this.offscreenCanvas.width = W;
		this.offscreenCanvas.height = H;
		this.octx = this.offscreenCanvas.getContext("2d");

		// Generierung der Nebelwolken
		for (let i = 0; i < 4; i++) {
			this.fog.push({
				x: Math.random() * W,
				y: Math.random() * H,
				r: (70 + Math.random() * 50) * S,
				speed: (Math.random() - 0.5) * 0.3 * S,
			});
		}

		// Generierung der Hintergrundblasen
		for (let i = 0; i < 15; i++) {
			this.bubbles.push({
				x: Math.random() * W,
				y: Math.random() * H,
				r: (Math.random() * 3 + 1) * S,
				speed: (Math.random() * 0.5 + 0.2) * S,
				wobble: Math.random() * Math.PI,
			});
		}

		// Generierung der Zielblase
		this.target = { x: 0, y: 0, r: 0, speedX: 0, speedY: 0 };
		this.createBubble = () => {
			const progress = this.engine.score / this.engine.maxScore;
			const difficulty = this.engine.difficulty;
			const speedConfig = PHYSICS.bubble.targetSpeed;

			this.target.x = 30 * S + Math.random() * (W - 60 * S);
			this.target.y = 30 * S + Math.random() * (H - 60 * S);
			this.target.r = PHYSICS.bubble.spawnSize * (1 + Math.random());

			const speedX =
				speedConfig.base *
				(speedConfig.r * Math.random() + speedConfig.p * progress + speedConfig.d * difficulty);
			const speedY =
				speedConfig.base *
				(speedConfig.r * Math.random() + speedConfig.p * progress + speedConfig.d * difficulty);
			const signX = Math.random() < 0.5 ? -1 : 1;
			const signY = Math.random() < 0.5 ? -1 : 1;

			this.target.speedX = signX * speedX;
			this.target.speedY = signY * speedY;
		};
	}

	// Pustelogik
	blow() {
		const wobbleOffset = Math.sin(this.frames * 0.02 + (this.target.y / S) * 0.03) * 6 * S;
		const visualX = this.target.x + wobbleOffset;
		const distance = Math.sqrt((this.input.mouse.x - visualX) ** 2 + (this.input.mouse.y - this.target.y) ** 2);

		if (distance < this.target.r + 10 * S) {
			this.target.r += PHYSICS.bubble.growStrength;
			if (this.engine.audio && this.engine.gameState === "playing")
				this.engine.audio.playSoundEffect(SOUNDS.bubble.blow);
			if (this.target.r > PHYSICS.bubble.burstSize) {
				createExplosion(this, this.target.x, this.target.y, COLORS.bubble.popParticles);
				if (this.engine.audio && this.engine.gameState === "playing")
					this.engine.audio.playSoundEffect(SOUNDS.bubble.bubbleBurst);
				this.engine.addScore(POINTS.bubble.bubbleBurst); // Blase ist geplatzt
				this.createBubble();
			}
		}
	}

	// Event Handler
	onPointerDown(e) {
		this.blow();
	}

	onKeyDown(key) {
		if (key === " " || key === "enter") {
			this.blow();
		}
	}

	// Physik
	update(deltaTime) {
		this.frames += 1 * deltaTime;

		const progress = this.engine.score / this.engine.maxScore;
		const difficulty = this.engine.difficulty;

		// Nebelwolken
		this.fog.forEach((cloud) => {
			cloud.x += cloud.speed * deltaTime;
			if (cloud.x < -150 * S) cloud.x = W + 150 * S;
			if (cloud.x > W + 150 * S) cloud.x = -150 * S;
		});

		// Hintergrundblasen
		this.bubbles.forEach((bubble) => {
			bubble.y -= bubble.speed * deltaTime;
			bubble.x += Math.sin(bubble.wobble) * 0.3 * S * deltaTime;
			bubble.wobble += 0.05 * deltaTime;

			if (bubble.y < -10 * S) {
				// Reset am oberen Rand
				bubble.y = H + 10 * S;
				bubble.x = Math.random() * W;
			}
		});

		// Explosionspartikel
		for (let particleIndex = this.particles.length - 1; particleIndex >= 0; particleIndex--) {
			const particle = this.particles[particleIndex];
			particle.x += particle.speedX * deltaTime;
			particle.y += particle.speedY * deltaTime;
			particle.alpha -= 0.02 * deltaTime; // Partikel verblasst
			if (particle.alpha <= 0) this.particles.splice(particleIndex, 1);
		}

		// Zielblase
		// Schrumpfrate
		const shrinkConfig = PHYSICS.bubble.shrinkRate;
		const shrinkRate =
			shrinkConfig.base *
			(shrinkConfig.r * Math.random() + shrinkConfig.p * progress + shrinkConfig.d * difficulty) *
			deltaTime;
		this.target.r -= shrinkRate;

		// Horizontale Bewegung & Bewegungsumkehr
		this.target.x += this.target.speedX * deltaTime;
		if (this.target.x < this.target.r) {
			this.target.x = this.target.r;
			this.target.speedX = Math.abs(this.target.speedX);
		} else if (this.target.x > W - this.target.r) {
			this.target.x = W - this.target.r;
			this.target.speedX = -Math.abs(this.target.speedX);
		}

		// Vertikale Bewegung & Bewegungsumkehr
		this.target.y += this.target.speedY * deltaTime;
		if (this.target.y < this.target.r) {
			this.target.y = this.target.r;
			this.target.speedY = Math.abs(this.target.speedY);
		} else if (this.target.y > H - this.target.r) {
			this.target.y = H - this.target.r;
			this.target.speedY = -Math.abs(this.target.speedY);
		}

		// Platzen
		if (this.target.r < 5 * S) {
			this.engine.applyDamage(POINTS.bubble.bubbleImplosion);
			if (this.engine.audio && this.engine.gameState === "playing")
				this.engine.audio.playSoundEffect(SOUNDS.bubble.bubbleImplosion);
			this.createBubble();
		}
	}

	// Zeichnen
	draw(ctx) {
		// Wasserfarbverlauf
		const waterGradient = this.octx.createLinearGradient(0, 0, 0, H);
		this.octx.save();
		waterGradient.addColorStop(0, COLORS.bubble.water[0]);
		waterGradient.addColorStop(0.5, COLORS.bubble.water[1]);
		waterGradient.addColorStop(1, COLORS.bubble.water[2]);
		this.octx.fillStyle = waterGradient;
		this.octx.fillRect(0, 0, W, H);
		this.octx.restore();

		// Nebel
		this.fog.forEach((cloud) => {
			this.octx.save();
			this.octx.translate(cloud.x, cloud.y);
			this.octx.scale(1, 0.3);
			const radialGradient = this.octx.createRadialGradient(0, 0, 0, 0, 0, cloud.r);
			radialGradient.addColorStop(0, COLORS.bubble.fog[0]);
			radialGradient.addColorStop(1, COLORS.bubble.fog[1]);
			this.octx.fillStyle = radialGradient;
			this.octx.beginPath();
			this.octx.arc(0, 0, cloud.r, 0, Math.PI * 2);
			this.octx.fill();
			this.octx.restore();
		});

		// Lichtkegel
		const rayShift = Math.sin(this.frames / 100) * 15 * S;
		this.octx.save();
		this.octx.fillStyle = COLORS.bubble.ray[0];
		this.octx.beginPath();
		this.octx.moveTo(230 * S - rayShift, 0);
		this.octx.lineTo(245 * S - rayShift, 0);
		this.octx.lineTo(140 * S - rayShift, H);
		this.octx.lineTo(40 * S - rayShift, H);
		this.octx.closePath();
		this.octx.fill();

		this.octx.fillStyle = COLORS.bubble.ray[2];
		this.octx.beginPath();
		this.octx.moveTo(240 * S - rayShift, 0);
		this.octx.lineTo(255 * S - rayShift, 0);
		this.octx.lineTo(230 * S + rayShift, H);
		this.octx.lineTo(130 * S + rayShift, H);
		this.octx.closePath();
		this.octx.fill();
		this.octx.restore();

		// Aufsteigende Hintergrundblasen
		this.octx.save();
		this.octx.fillStyle = COLORS.bubble.bgBubbles[0];
		this.octx.shadowColor = COLORS.bubble.bgBubbles[1];
		this.octx.shadowBlur = 8;
		this.bubbles.forEach((bubble) => {
			this.octx.beginPath();
			this.octx.arc(bubble.x, bubble.y, bubble.r, 0, Math.PI * 2);
			this.octx.fill();
		});
		this.octx.restore();

		// Sandboden
		this.octx.save();
		this.octx.fillStyle = COLORS.bubble.sand;
		this.octx.beginPath();
		this.octx.ellipse(W / 2, H + 10 * S, 200 * S, 40 * S, 0, 0, Math.PI * 2);
		this.octx.fill();
		this.octx.restore();

		// Algen zeichnen
		const positions = [50 * S, 90 * S, 160 * S, 210 * S, 260 * S];
		positions.forEach((startX, algaeIndex) => {
			const algaeColor = COLORS.bubble.algae[algaeIndex % 3];
			const segments = 8;
			const segmentHeight = (12 + algaeIndex) * S;
			const points = [];

			// Halme
			this.octx.save();
			this.octx.beginPath();
			this.octx.strokeStyle = algaeColor;
			this.octx.lineWidth = 3 * S;
			this.octx.lineCap = "round";
			this.octx.moveTo(startX, H - 5 * S);
			for (let segmentIndex = 1; segmentIndex <= segments; segmentIndex++) {
				const swayOffset =
					Math.sin(this.frames * 0.04 + algaeIndex + segmentIndex * 0.2) * (segmentIndex * 1.5 * S); // Schwingen der Halme
				const nextX = startX + swayOffset;
				const nextY = H - 5 * S - segmentIndex * segmentHeight;
				this.octx.lineTo(nextX, nextY);
				points.push({ x: nextX, y: nextY, s: swayOffset });
			}
			this.octx.stroke();

			// Blätter
			this.octx.fillStyle = algaeColor;
			points.forEach((leaf, segmentIndex) => {
				if ((segmentIndex + 1) % 2 === 0) {
					this.octx.save();
					this.octx.translate(leaf.x, leaf.y);
					this.octx.rotate((leaf.s / S) * 0.05);
					this.octx.beginPath();
					this.octx.ellipse(
						(segmentIndex + 1) % 4 === 0 ? 5 * S : -5 * S,
						0,
						6 * S,
						3 * S,
						0.5,
						0,
						Math.PI * 2,
					);
					this.octx.fill();
					this.octx.restore();
				}
			});
			this.octx.restore();
		});

		// Zielrahmen
		this.octx.save();
		this.octx.beginPath();
		this.octx.arc(this.target.x, this.target.y, 70 * S, 0, Math.PI * 2);
		this.octx.strokeStyle = COLORS.bubble.bubbleFrame;
		this.octx.setLineDash([5 * S, 5 * S]);
		this.octx.stroke();
		this.octx.setLineDash([]);
		this.octx.restore();

		// Explosionspartikel
		this.octx.save();
		this.particles.forEach((particle) => {
			this.octx.globalAlpha = particle.alpha;
			this.octx.fillStyle = particle.color;
			this.octx.beginPath();
			this.octx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
			this.octx.fill();
		});
		this.octx.restore();

		// Zielblase
		const fontSize = (this.target.r / S) * 1.8;
		this.octx.save();
		this.octx.shadowColor = COLORS.bubble.bubbleShadow;
		this.octx.shadowBlur = 15;
		drawCharCentered(this.octx, this.target.x, this.target.y, CHARS.bubble.target.char, font(fontSize, true));
		this.octx.restore();

		// Wackeleffekt durch Zerschneiden der Hilfsleinwand in horizontale Streifen und Projektion auf die echte Leinwand
		const step = Math.max(1, Math.floor(S / 2));
		for (let lineY = 0; lineY < H; lineY += step) {
			const wobbleX = Math.sin(this.frames * 0.02 + (lineY / S) * 0.03) * 6 * S;
			ctx.drawImage(this.offscreenCanvas, 0, lineY, W, 1, wobbleX - 6 * S, lineY, W + 12 * S, S / 2 + 1);
		}

		// Spieler
		drawPlayer(
			ctx,
			this.input.lerp.x,
			this.input.lerp.y,
			HIGHLIGHT_RADIUS.bubble,
			this.engine.cursorStyle,
			CHARS.bubble.player,
		);

		// Fadenkreuz
		ctx.save();
		ctx.strokeStyle = COLORS.bubble.cross;
		ctx.lineWidth = 2 * S;
		ctx.beginPath();
		ctx.moveTo(this.input.lerp.x - 12 * S, this.input.lerp.y);
		ctx.lineTo(this.input.lerp.x + 12 * S, this.input.lerp.y);
		ctx.moveTo(this.input.lerp.x, this.input.lerp.y - 12 * S);
		ctx.lineTo(this.input.lerp.x, this.input.lerp.y + 12 * S);
		ctx.stroke();
		ctx.restore();
	}
}
