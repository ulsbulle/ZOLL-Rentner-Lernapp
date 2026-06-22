// Sternenslalom
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

export class UfoGame extends MiniGame {
	constructor(engine) {
		super(engine);
		this.title = "Sternenslalom";
		this.useDefaultKeyboard = true;
		this.syncPointerOnDown = false;
		this.instructions = INSTRUCTIONS.ufo;
	}

	init() {
		this.asteroids = [];
		this.laserBeams = [];
		this.particles = [];
		this.stars = [];
		this.ammo = PHYSICS.ufo.maxAmmo;
		this.lastReload = Date.now();
		this.touchStart = null;
		this.nextAsteroidFrame = 20;

		// Sterngenerierung
		for (let starIndex = 0; starIndex < 100; starIndex++) {
			this.stars.push({
				x: Math.random() * W,
				y: Math.random() * H,
				size: Math.random() * 1.5 * S,
				color: COLORS.ufo.star[Math.floor(Math.random() * 10)]
					.replace(/rgb/i, "rgba")
					.replace(/\)$/, `, ${Math.random()})`),
			});
		}

		// Generierung der Asteroiden
		this.createAsteroid = () => {
			const progress = this.engine.score / this.engine.maxScore;
			const difficulty = this.engine.difficulty;
			const speedConfig = PHYSICS.ufo.targetSpeed;

			this.asteroids.push({
				x: 20 * S + Math.random() * (W - 40 * S),
				y: -40 * S,
				speed:
					speedConfig.base *
					(speedConfig.r * Math.random() + speedConfig.p * progress + speedConfig.d * difficulty),
				hit: false,
			});
		};
	}

	// Feuerlogik
	fire() {
		if (this.ammo > 0) {
			this.laserBeams.push({
				x: this.input.lerp.x,
				y: this.input.lerp.y - 20 * S,
				speed: PHYSICS.ufo.laserSpeed,
			});
			this.ammo--;
			this.engine.audio.playSound(SOUNDS.ufo.laser);
			if (this.ammo === PHYSICS.ufo.maxAmmo - 1) this.lastReload = Date.now();
		} else {
			this.engine.audio.playSound(SOUNDS.ufo.noAmmo);
		}
	}

	// Event Handler
	onPointerDown(e) {
		// Feuern bei Multitouch oder Mausclick
		this.touchStart = Date.now();
		if (this.input.activePointers.size > 1 || e.pointerType === "mouse") {
			this.fire();
		}
	}

	onPointerUp(e) {
		// Feuern bei kurzem Singletouch
		if (this.input.activePointers.size === 1 && e.pointerType === "touch") {
			const touchDuration = Date.now() - this.touchStart;
			if (touchDuration < 200) this.fire();
		}
	}

	onKeyDown(key) {
		// Feuern bei Tastendruck
		if (key === " " || key === "enter") {
			this.fire();
		}
	}

	// Physik
	update(deltaTime) {
		this.frames += 1 * deltaTime;

		const progress = this.engine.score / this.engine.maxScore;
		const difficulty = this.engine.difficulty;

		// Sternbewegung
		this.stars.forEach((star) => {
			star.y += deltaTime * PHYSICS.ufo.starSpeed * this.engine.difficulty;
			if (star.y > H) star.y = 0; // Reset am unteren Rand
		});

		// Laserstrahlen
		for (let beamIndex = this.laserBeams.length - 1; beamIndex >= 0; beamIndex--) {
			const laserBeam = this.laserBeams[beamIndex];
			laserBeam.y -= laserBeam.speed * deltaTime;
			if (laserBeam.y < -20 * S) this.laserBeams.splice(beamIndex, 1);
		}

		// Explosionspartikel
		for (let particleIndex = this.particles.length - 1; particleIndex >= 0; particleIndex--) {
			const particle = this.particles[particleIndex];
			particle.x += particle.speedX * deltaTime;
			particle.y += particle.speedY * deltaTime;
			particle.alpha -= 0.02 * deltaTime; // Partikel verblasst
			if (particle.alpha <= 0) this.particles.splice(particleIndex, 1);
		}

		// Asteroiden
		const spawnConfig = PHYSICS.ufo.spawnRate;
		const spawnRate =
			spawnConfig.base / (spawnConfig.r * Math.random() + spawnConfig.p * progress + spawnConfig.d * difficulty);
		if (this.frames >= this.nextAsteroidFrame) {
			this.createAsteroid();
			this.nextAsteroidFrame = this.frames + spawnRate;
		}

		// Kollisionsmanagement Laserstrahl-Asteroid
		for (let beamIndex = this.laserBeams.length - 1; beamIndex >= 0; beamIndex--) {
			const laserBeam = this.laserBeams[beamIndex];

			for (let asteroidIndex = this.asteroids.length - 1; asteroidIndex >= 0; asteroidIndex--) {
				const asteroid = this.asteroids[asteroidIndex];
				const distance = Math.sqrt((laserBeam.x - asteroid.x) ** 2 + (laserBeam.y - asteroid.y) ** 2);

				if (distance < 25 * S) {
					createExplosion(this, asteroid.x, asteroid.y, COLORS.ufo.explosionParticles);
					this.asteroids.splice(asteroidIndex, 1);
					this.laserBeams.splice(beamIndex, 1);
					this.engine.addScore(POINTS.ufo.asteroidDestroyed); // Bonuspunkte Abschuss
					this.engine.audio.playSound(SOUNDS.ufo.asteroidDestroyed);
					break;
				}
			}
		}

		// Kollisionsmanagement Asteroid-Raumschiff
		for (let asteroidIndex = this.asteroids.length - 1; asteroidIndex >= 0; asteroidIndex--) {
			const asteroid = this.asteroids[asteroidIndex];
			asteroid.y += asteroid.speed * deltaTime;

			if (
				!asteroid.hit &&
				Math.sqrt((asteroid.x - this.input.lerp.x) ** 2 + (asteroid.y - this.input.lerp.y) ** 2) < 25 * S
			) {
				asteroid.hit = true;
				this.engine.applyDamage(POINTS.ufo.asteroidHit); // Malus Kollision
				this.engine.audio.playSound(SOUNDS.ufo.asteroidHit);
			}
			if (asteroid.y > H + 20 * S) this.asteroids.splice(asteroidIndex, 1);
		}

		// Nachladelogik
		if (
			this.ammo < PHYSICS.ufo.maxAmmo &&
			Date.now() - this.lastReload > PHYSICS.ufo.reloadTime * this.engine.difficulty
		) {
			this.ammo++;
			this.lastReload = Date.now();
		}
		this.engine.addScore(0.12 * deltaTime); // Punktzahl steigt mit Zeit
	}

	// Zeichnen
	draw(ctx) {
		// Universum
		ctx.save();
		ctx.fillStyle = COLORS.ufo.space;
		ctx.fillRect(0, 0, W, H);
		ctx.restore();

		// Sterne im Hintergrund
		ctx.save();
		this.stars.forEach((star) => {
			ctx.fillStyle = star.color;
			ctx.beginPath();
			ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
			ctx.fill();
		});
		ctx.restore();

		// Laserstrahlen
		ctx.save();
		ctx.fillStyle = COLORS.ufo.laser[0];
		ctx.shadowColor = COLORS.ufo.laser[0];
		ctx.shadowBlur = 10;
		this.laserBeams.forEach((laserBeam) => {
			ctx.fillRect(laserBeam.x - 2 * S, laserBeam.y, 4 * S, 15 * S);
		});
		ctx.restore();

		// Explosionspartikel
		ctx.save();
		this.particles.forEach((particle) => {
			ctx.fillStyle = particle.color;
			ctx.globalAlpha = particle.alpha;
			ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
		});
		ctx.restore();

		// Asteroiden
		this.asteroids.forEach((asteroid) => {
			drawCharCentered(ctx, asteroid.x, asteroid.y, CHARS.ufo.target.char, font(CHARS.ufo.target.size, true));
		});

		// Spieler
		drawPlayer(
			ctx,
			this.input.lerp.x,
			this.input.lerp.y,
			HIGHLIGHT_RADIUS.ufo,
			this.engine.cursorStyle,
			CHARS.ufo.player,
		);

		// Munitionsanzeige
		ctx.save();
		for (let ammoIndex = 0; ammoIndex < PHYSICS.ufo.maxAmmo; ammoIndex++) {
			ctx.fillStyle = COLORS.ufo.laser[ammoIndex < this.ammo ? 0 : 1];
			ctx.fillRect(10 * S + ammoIndex * 15 * S, 15 * S, 10 * S, 4 * S);
		}
		ctx.restore();
	}
}
