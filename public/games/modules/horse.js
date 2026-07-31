// Pferdeparcours
// -----------------------------
// - Side-Scroller Jump-'n'-Run: Der Spieler muss über herannahende Hindernisse springen.
// - Implementierung einer Sprungphysik (Gravitation, Auftrieb abhängig von Tastendruckdauer oder Swipe-Stärke) und Kollisionslogik
// - Rendering von bewegenden Wolken, einer pulsierenden Sonne und endlos scrollendem Rasen

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
		this.useDefaultKeyboard = false; // keine Cursorsteuerung über Pfeiltasten und WASD
		this.syncPointerOnDown = true; // Cursorsprung zur Pointer-Down-Koordinate
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
		this.touchStart = {
			time: null,
			x: null,
			y: null,
		};
		this.pendingPoints = 0;

		// Generierung der Wolken aus drei Segmenten
		for (let cloudIndex = 0; cloudIndex < 5; cloudIndex++) {
			this.clouds.push({
				x: Math.random() * W,
				y: (Math.random() * 100 + 20) * S,
				size: (Math.random() * 20 + 20) * S,
				speed: (Math.random() * 0.2 + 0.1) * S,
				radii: [0.6 + Math.random() * 0.2, 0.8 + Math.random() * 0.2, 0.6 + Math.random() * 0.2],
			});
		}

		// Methode zur Generierung der Hindernisse
		// Erzeugen neuer Hindernisse hinter dem rechten Bildschirmrand
		this.createObstacle = () => {
			this.obstacles.push({ x: W + 20 * S, y: PHYSICS.horse.groundY, cleared: false, hit: false });
		};
	}

	// Sprunglogik
	// Aufruf ohne Übergabe der Sprungstärke für Standardsprung
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
		// Startzeit und Startkoordinaten zur Berechnung der Swipe-Stärke
		this.touchStart.time = Date.now();
		this.touchStart.x = this.input.mouse.x;
		this.touchStart.y = this.input.mouse.y;
	}

	onPointerUp(e) {
		// Start muss definiert und vergangener Sprung beendet sein
		if (!this.touchStart.time || this.player.y < PHYSICS.horse.groundY) return;

		// Berechnung der Sprungstärke bei Swipe
		const touchDuration = Math.max(30, Date.now() - this.touchStart.time);
		const touchDistance = Math.hypot(
			this.touchStart.x - this.input.mouse.x,
			this.touchStart.y - this.input.mouse.y,
		); // euklidischer Abstand
		if (touchDistance < 25 * S) {
			// Wertung kleiner Bewegung als Klick (Sprung in Standardhöhe)
			this.jump();
		} else {
			const swipePower = Math.max(
				1,
				Math.min(2, (PHYSICS.horse.touchSensitivity * touchDistance) / (S * touchDuration)),
			); // Begrenzung auf [1, 2]
			this.jump(-swipePower * PHYSICS.horse.jumpPower);
		}

		this.player.isJumping = false; // Sprung abgeschlossen (kein weiterer Auftrieb durch Tastatur möglich)
	}

	onKeyDown(key) {
		this.jump();
	}

	onKeyUp(key) {
		this.player.isJumping = false; // Sprung abgeschlossen
	}

	// Physik
	// Aktualisierung der Spielwelt durch Berechnung von Bewegungen und Kollisionen
	update(deltaTime) {
		this.frames += 1 * deltaTime; // deltaTime = Verhältnis von vergangener Zeit zu Soll-Zeit eines Frames

		const progress = this.engine.score / this.engine.maxScore;
		const difficulty = this.engine.difficulty;

		// Auftrieb: Längerer Tastendruck --> höherer Sprung
		if (this.player.isJumping) {
			this.player.jumpHoldFrames += deltaTime;
			if (this.player.jumpHoldFrames < PHYSICS.horse.maxHoldFrames) {
				// Auftrieb bei gedrückter Taste
				this.player.speedY = -Math.max(
					PHYSICS.horse.jumpPower,
					this.player.jumpHoldFrames * PHYSICS.horse.keyboardLift,
				);
			} else {
				// Beenden nach einer bestimmten Zahl Frames (maxHoldFrames)
				this.player.isJumping = false;
			}
		}

		// Gravitation
		// Berechnung der momentanen vertikalen Geschwindigkeit und Höhe (Himmel = 0, Boden = 265 * S)
		if (this.player.y < PHYSICS.horse.groundY || this.player.speedY < 0) {
			// Gravitation wirkt nur, wenn in der Luft oder Auftrieb vorhanden
			this.player.speedY += PHYSICS.horse.gravity * Math.sqrt(difficulty) * deltaTime;
			this.player.y += this.player.speedY * deltaTime;
		}

		// Obere Begrenzung (Himmel)
		if (this.player.y < 20 * S) {
			this.player.y = 20 * S;
			this.player.speedY = 0; // Scheitelpunkt hart gesetzt
		}

		// Untere Begrenzung (Boden)
		if (this.player.y > PHYSICS.horse.groundY) {
			// Landung (y >= groundY würde auch Nicht-Sprünge erfassen; bei Sprung wird durch speedY > 0 immer y > groundY)
			this.player.y = PHYSICS.horse.groundY;
			this.player.speedY = 0;
			if (this.engine.audio && this.engine.gameState === "playing")
				this.engine.audio.playSoundEffect(SOUNDS.horse.landed);
			this.player.isJumping = false; // Sprung abgeschlossen

			// Punktvergabe nach Landung: 2 übersprungene Hürden = 2 x Punkte + 1 x Sound
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
			if (cloud.x < -100 * S) cloud.x = W + 50 * S; // Randüberlauf zu gegenüberliegendem Rand nach Verschwinden
		});

		// Hindernisse
		// Erzeugen neuer Objekte basierend auf Schwierigkeitsgrad, Spielfortschritt und Zufall
		const spawnConfig = PHYSICS.horse.spawnRate;
		const spawnGap =
			spawnConfig.base / (spawnConfig.r * Math.random() + spawnConfig.p * progress + spawnConfig.d * difficulty);
		if (this.frames >= this.nextObstacleFrame) {
			this.createObstacle(); // neue Hürde generieren
			this.nextObstacleFrame = this.frames + spawnGap; // nächsten Spawnframe definieren
		}

		// Kollisionsmanagement
		// Positionsberechnung und Kollisionsprüfung zwischen Spieler und jeder Hürde
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
				obstacle.hit = true; // Verhinderung von Mehrfachschaden
				this.engine.applyDamage(POINTS.horse.obstacleHit);
				if (this.engine.audio && this.engine.gameState === "playing")
					this.engine.audio.playSoundEffect(SOUNDS.horse.obstacleHit);
			}

			// Hindernis übersprungen
			if (obstacle.x < 30 * S && !obstacle.cleared && !obstacle.hit) {
				obstacle.cleared = true; // Verhinderung von Mehrfachwertungen
				this.pendingPoints += POINTS.horse.obstacleCleared; // Punkte vormerken, Vergabe bei Landung
			}

			// Hindernisse außerhalb des Bildschirms aus dem Array entfernen
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
		// Polygon aus 36 Segmenten, deren Abstand zum Mittelpunkt sinusförmig moduliert wird
		// je 3 Punkte formen einen Wellenberg --> Korona mit 12 pulsierenden Zacken
		for (let rayIndex = 0; rayIndex <= 36; rayIndex++) {
			// Winkel des aktuellen Segments (36 Segmente = 10° pro Schritt)
			const angle = (rayIndex * Math.PI * 2) / 36;

			// Abstand zum Mittelpunkt [30, 40] * S
			// 35 ist der mittlere Abstand
			// sin(angle * 12) erzeugt 12 Wellen um den virtuellen Kreis
			// - this.frames * 0.1 sorgt für Zeitabhängigkeit und damit Bewegung
			// * 5 verstärkt die Amplitude
			const radius = (35 + Math.sin(angle * 12 - this.frames * 0.1) * 5) * S;

			// Berechnung der Koordinaten jedes Punktes
			// Mittelpunkt der Sonne: (W - 50 * S, 50 * S)
			// Einheitskreis: Math.cos(angle) für x-Abstand, Math.sin(angle) für y-Abstand
			// multipliziert mit variablen Abstand --> Pulsierung
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
			const radiusA = cloud.size * cloud.radii[0];
			const radiusB = cloud.size * cloud.radii[1];
			const radiusC = cloud.size * cloud.radii[2];
			// 3 teilüberlappende Kreise mit versetzten Mittelpunkten
			ctx.beginPath();
			ctx.arc(cloud.x, cloud.y, radiusA, 0, Math.PI * 2);
			ctx.arc(cloud.x + radiusA * 0.8, cloud.y, radiusB, 0, Math.PI * 2);
			ctx.arc(cloud.x + radiusA * 0.8 + radiusB * 0.8, cloud.y, radiusC, 0, Math.PI * 2);
			ctx.fill();
		});
		ctx.restore();

		// Boden
		ctx.save();
		ctx.fillStyle = COLORS.horse.grass[0];
		ctx.fillRect(0, GameConfig.GROUND, W, 20 * S);
		ctx.restore();

		// Grashalme
		ctx.save();
		ctx.strokeStyle = COLORS.horse.grass[1];
		ctx.lineWidth = 1.2 * S;
		// Grashalme im Abstand von 15px zeichnen
		for (let grassX = 0; grassX < W + 15 * S; grassX += 15 * S) {
			// Berechnung des zeitabhängigen Versatzes
			// % (15 * S) begrenzt den Versatz auf einen Grashalm-Abstand
			// Rücksetzen auf die Ausgangsposition bewirkt Eindruck einer Endlosbewegung
			const grassOffset = (PHYSICS.horse.grassSpeed * this.frames * this.engine.difficulty) % (15 * S);
			ctx.beginPath();
			ctx.moveTo(grassX - grassOffset, GameConfig.GROUND);
			ctx.lineTo(grassX - grassOffset - 2 * S, GameConfig.GROUND - 5 * S);
			ctx.stroke();
		}
		ctx.restore();

		// Hindernisse
		this.obstacles.forEach((obstacle) => {
			drawCharCentered(ctx, obstacle.x, obstacle.y, CHARS.horse.target.char, font(CHARS.horse.target.size, true));
		});

		// Spieler
		drawShadow(ctx, 50 * S, GameConfig.GROUND, this.player.y, 180 * S);
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
