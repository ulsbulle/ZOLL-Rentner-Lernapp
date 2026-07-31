// Sternenslalom
// -----------------------------
// - Space-Shooter und Ausweichspiel: Der Spieler muss anfliegenden Asteroiden ausweichen oder sie abschießen.
// - Implementierung eines Objektpools, einer Nachladelogik und eines dualen Kollisionsmanagements (Laser-Asteroid, Asteroid-Raumschiff)
// - Rendering von Hintergrundsternen und Explosionen
// - Realisierung einer Steuerung über Maus, Tastatur und Single- oder Multitouch

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
		this.useDefaultKeyboard = true; // Cursorsteuerung über Pfeiltasten und WASD
		this.syncPointerOnDown = false; // kein Cursorsprung zur Pointer-Down-Koordinate
		this.instructions = INSTRUCTIONS.ufo;
	}

	init() {
		if (this.engine.audio) this.engine.audio.playMusic(musicData.ufo, true, false, "Sternenslalom");
		this.asteroids = [];
		this.laserBeams = [];
		this.particles = [];
		this.stars = [];
		this.ammo = PHYSICS.ufo.maxAmmo;
		this.lastReload = Date.now();
		this.touchStart = null;
		this.nextAsteroidFrame = 20;

		// Generierung der Sterne im Hintergrund
		for (let starIndex = 0; starIndex < 100; starIndex++) {
			this.stars.push({
				x: Math.random() * W,
				y: Math.random() * H,
				size: Math.random() * 1.5 * S,
				color: COLORS.ufo.star[Math.floor(Math.random() * 10)] // wählt zufällig eine von zehn Sternfarben aus
					.replace(/rgb/, "rgba") // ersetzt "rgb" durch "rgba" um einen zufälligen Alphawert zu ergänzen
					.replace(/\)$/, `, ${Math.random()})`), // sucht eine schließende Klammer \) am Stringende $ und ersetzt sie durch: , ${Math.random()})
			});
		}

		// Methode zur Generierung der Asteroiden
		// Erzeugen von Asteroiden mit zufälliger Position und auf Spielfortschritt, Schwierigkeit und Zufall basierender Geschwindigkeit
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
	// Auslösen eines Laserschusses und Reduktion der verfügbaren Munition
	fire() {
		if (this.ammo > 0) {
			this.laserBeams.push({
				x: this.input.lerp.x,
				y: this.input.lerp.y - 20 * S,
				speed: PHYSICS.ufo.laserSpeed,
			});
			this.ammo--; // Munition verringern
			if (this.engine.audio && this.engine.gameState === "playing")
				this.engine.audio.playSoundEffect(SOUNDS.ufo.laser);
			// Zeit seit letztem Nachladen läuft beständig weiter und muss nach erstem Schuss aus voller Munition zurückgesetzt werden
			if (this.ammo === PHYSICS.ufo.maxAmmo - 1) this.lastReload = Date.now();
		} else {
			if (this.engine.audio && this.engine.gameState === "playing")
				this.engine.audio.playSoundEffect(SOUNDS.ufo.noAmmo);
		}
	}

	// Event Handler
	onPointerDown(e) {
		// Feuern bei Multitouch oder Mausklick
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
	// Aktualisierung der Spielwelt durch Berechnung von Bewegungen und Kollisionen
	update(deltaTime) {
		this.frames += 1 * deltaTime; // deltaTime = Verhältnis von vergangener Zeit zu Soll-Zeit eines Frames

		const progress = this.engine.score / this.engine.maxScore;
		const difficulty = this.engine.difficulty;

		// Sternbewegung
		this.stars.forEach((star) => {
			star.y += deltaTime * PHYSICS.ufo.starSpeed * this.engine.difficulty;
			if (star.y > H + 1.5 * S) star.y = -1.5 * S; // Randüberlauf zu oberem Rand nach Verschwinden
		});

		// Laserstrahlen
		for (let beamIndex = this.laserBeams.length - 1; beamIndex >= 0; beamIndex--) {
			const laserBeam = this.laserBeams[beamIndex];
			laserBeam.y -= laserBeam.speed * deltaTime;
			if (laserBeam.y < -20 * S) this.laserBeams.splice(beamIndex, 1); // Verschwundenen Laser aus dem Array entfernen
		}

		// Explosionspartikel
		for (let particleIndex = this.particles.length - 1; particleIndex >= 0; particleIndex--) {
			const particle = this.particles[particleIndex];
			particle.x += particle.speedX * deltaTime;
			particle.y += particle.speedY * deltaTime;
			particle.alpha -= 0.02 * deltaTime; // Partikel verblasst mit der Zeit
			if (particle.alpha <= 0) this.particles.splice(particleIndex, 1); // Verblasste Partikel aus dem Array entfernen
		}

		// Asteroiden
		// Erzeugen neuer Asteroiden basierend auf Schwierigkeitsgrad, Spielfortschritt und Zufall
		const spawnConfig = PHYSICS.ufo.spawnRate;
		const spawnRate =
			spawnConfig.base / (spawnConfig.r * Math.random() + spawnConfig.p * progress + spawnConfig.d * difficulty);
		if (this.frames >= this.nextAsteroidFrame) {
			this.createAsteroid(); // neuen Asteroiden generieren
			this.nextAsteroidFrame = this.frames + spawnRate; // nächsten Spawnframe definieren
		}

		// Kollisionsmanagement Laserstrahl-Asteroid
		// Positionsberechnung und Kollisionsprüfung zwischen jedem Laser und jedem Asteroiden
		for (let beamIndex = this.laserBeams.length - 1; beamIndex >= 0; beamIndex--) {
			const laserBeam = this.laserBeams[beamIndex];

			for (let asteroidIndex = this.asteroids.length - 1; asteroidIndex >= 0; asteroidIndex--) {
				const asteroid = this.asteroids[asteroidIndex];
				const distance = Math.hypot(laserBeam.x - asteroid.x, laserBeam.y - asteroid.y); // euklidischer Abstand

				if (distance < 25 * S) {
					createExplosion(this, asteroid.x, asteroid.y, COLORS.ufo.explosionParticles);
					this.asteroids.splice(asteroidIndex, 1); // Zerstörten Asteroiden aus dem Array entfernen
					this.laserBeams.splice(beamIndex, 1); // Zerstörten Laser aus dem Array entfernen
					this.engine.addScore(POINTS.ufo.asteroidDestroyed); // Bonuspunkte für Abschuss
					if (this.engine.audio && this.engine.gameState === "playing")
						this.engine.audio.playSoundEffect(SOUNDS.ufo.asteroidDestroyed);
					break; // aus Asteroidenschleife aussteigen, da Laser verschwunden
				}
			}
		}

		// Kollisionsmanagement Asteroid-Raumschiff
		// Positionsberechnung und Kollisionsprüfung zwischen Spieler und jedem Asteroiden
		for (let asteroidIndex = this.asteroids.length - 1; asteroidIndex >= 0; asteroidIndex--) {
			const asteroid = this.asteroids[asteroidIndex];
			asteroid.y += asteroid.speed * deltaTime;
			const distance = Math.hypot(asteroid.x - this.input.lerp.x, asteroid.y - this.input.lerp.y); // euklidischer Abstand

			if (!asteroid.hit && distance < 25 * S) {
				asteroid.hit = true; // Vermeidung von Mehrfachschaden
				this.engine.applyDamage(POINTS.ufo.asteroidHit); // Malus für Kollision
				if (this.engine.audio && this.engine.gameState === "playing")
					this.engine.audio.playSoundEffect(SOUNDS.ufo.asteroidHit);
			}
			if (asteroid.y > H + 20 * S) this.asteroids.splice(asteroidIndex, 1); // Verschwundenen Asteroiden aus dem Array entfernen
		}

		// Nachladelogik
		// Automatisches Nachladen nach definierter Zeit seit dem letzten Nachladen (oder dem ersten Schuss)
		if (
			this.ammo < PHYSICS.ufo.maxAmmo &&
			Date.now() - this.lastReload > PHYSICS.ufo.reloadTime * this.engine.difficulty
		) {
			this.ammo++; // Munition erhöhen
			this.lastReload = Date.now(); // Zeit seit letztem Nachladen zurücksetzen
		}

		// Punktzahl steigt mit Zeit
		this.engine.addScore(0.12 * deltaTime);
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
