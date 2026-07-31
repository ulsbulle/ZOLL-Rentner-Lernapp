// BubbleBurst
// -----------------------------
// - Tipp-basiertes Geschicklichkeitsspiel: Der Spieler muss Blasen durch Pusten zum Platzen bringen, bevor sie implodieren.
// - Implementierung von Wachstums- / Schrumpf- und Bewegungslogik der Zielblase
// - Rendering von Wasserfarbverlauf, Hintergrundblasen, Explosionen und Algenanimationen
// - Leinwand-Wackeleffekt durch streifenförmiges Zerschneiden einer Hilfsleinwand und sinusförmig modulierte Projektion auf die sichtbare Leinwand

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
		this.useDefaultKeyboard = true; // Cursorsteuerung über Pfeiltasten und WASD
		this.syncPointerOnDown = true; // Cursorsprung zur Pointer-Down-Koordinate
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

		// Generierung der Nebelwolken im Hintergrund
		for (let i = 0; i < 4; i++) {
			this.fog.push({
				x: Math.random() * W,
				y: Math.random() * H,
				r: (70 + Math.random() * 50) * S,
				speed: (Math.random() - 0.5) * 0.3 * S,
			});
		}

		// Generierung der aufsteigenden Blasen im Hintergrund
		for (let i = 0; i < 15; i++) {
			this.bubbles.push({
				x: Math.random() * W,
				y: Math.random() * H,
				r: (Math.random() * 3 + 1) * S,
				speed: (Math.random() * 0.5 + 0.2) * S,
				wobble: Math.random() * Math.PI,
			});
		}

		// Methode zur Generierung der Zielblase
		// Erzeugen einer neuen Zielblase mit zufälliger Position und auf Spielfortschritt, Schwierigkeit und Zufall basierender Geschwindigkeit
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
			const signX = Math.random() < 0.5 ? -1 : 1; // Bewegungsrichtung
			const signY = Math.random() < 0.5 ? -1 : 1;

			this.target.speedX = signX * speedX;
			this.target.speedY = signY * speedY;
		};
	}

	// Pustelogik
	// Berechnung des Abstands zwischen Cursor und Blase; Wachsen bzw. Platzen der Blase bei Pusten
	blow() {
		// Berücksichtigung des Wackeleffekts der Leinwand
		const wobbleOffset = Math.sin(this.frames * 0.02 + (this.target.y / S) * 0.03) * 6 * S; // Berechnung analog zu lineX bei Wackeleffekt
		const visualX = this.target.x + wobbleOffset; // für den Nutzer nach Leinwandwackeln sichtbare X-Koordinate (physikalische Koordinate ist unverändert)
		const distance = Math.hypot(this.input.mouse.x - visualX, this.input.mouse.y - this.target.y); // euklidischer Abstand Nutzerklick zu sichtbarem Mittelpunkt Zielblase

		// Trefferlogik
		if (distance < this.target.r + 10 * S) {
			this.target.r += PHYSICS.bubble.growStrength; // Blase wächst
			if (this.engine.audio && this.engine.gameState === "playing")
				this.engine.audio.playSoundEffect(SOUNDS.bubble.blow);
			// Platzlogik
			if (this.target.r > PHYSICS.bubble.burstSize) {
				// Blase ist geplatzt
				createExplosion(this, this.target.x, this.target.y, COLORS.bubble.popParticles);
				if (this.engine.audio && this.engine.gameState === "playing")
					this.engine.audio.playSoundEffect(SOUNDS.bubble.bubbleBurst);
				this.engine.addScore(POINTS.bubble.bubbleBurst);
				this.createBubble(); // neue Blase generieren
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
	// Aktualisierung der Spielwelt durch Berechnung von Bewegungen und Kollisionen
	update(deltaTime) {
		this.frames += 1 * deltaTime; // deltaTime = Verhältnis von vergangener Zeit zu Soll-Zeit eines Frames

		const progress = this.engine.score / this.engine.maxScore;
		const difficulty = this.engine.difficulty;

		// Nebelwolken
		this.fog.forEach((cloud) => {
			cloud.x += cloud.speed * deltaTime;
			if (cloud.x < -150 * S) cloud.x = W + 150 * S; // Randüberlauf zu gegenüberliegendem Rand nach Verschwinden
			if (cloud.x > W + 150 * S) cloud.x = -150 * S;
		});

		// Hintergrundblasen
		this.bubbles.forEach((bubble) => {
			bubble.y -= bubble.speed * deltaTime;
			bubble.x += Math.sin(bubble.wobble) * 0.3 * S * deltaTime;
			bubble.wobble += 0.05 * deltaTime;

			if (bubble.y < -10 * S) {
				// Randüberlauf zu unterem Rand nach Verschwinden
				bubble.y = H + 10 * S;
				bubble.x = Math.random() * W;
			}
		});

		// Explosionspartikel
		for (let particleIndex = this.particles.length - 1; particleIndex >= 0; particleIndex--) {
			const particle = this.particles[particleIndex];
			particle.x += particle.speedX * deltaTime;
			particle.y += particle.speedY * deltaTime;
			particle.alpha -= 0.02 * deltaTime; // Partikel verblasst mit der Zeit
			if (particle.alpha <= 0) this.particles.splice(particleIndex, 1); // Verblasste Partikel aus dem Array entfernen
		}

		// Zielblase
		// Schrumpfrate
		const shrinkConfig = PHYSICS.bubble.shrinkRate;
		const shrinkRate =
			shrinkConfig.base *
			(shrinkConfig.r * Math.random() + shrinkConfig.p * progress + shrinkConfig.d * difficulty) *
			deltaTime;
		this.target.r -= shrinkRate;

		// Horizontale Bewegung & Bewegungsumkehr am Rand
		this.target.x += this.target.speedX * deltaTime;
		if (this.target.x < this.target.r) {
			this.target.x = this.target.r;
			this.target.speedX = Math.abs(this.target.speedX);
		} else if (this.target.x > W - this.target.r) {
			this.target.x = W - this.target.r;
			this.target.speedX = -Math.abs(this.target.speedX);
		}

		// Vertikale Bewegung & Bewegungsumkehr am Rand
		this.target.y += this.target.speedY * deltaTime;
		if (this.target.y < this.target.r) {
			this.target.y = this.target.r;
			this.target.speedY = Math.abs(this.target.speedY);
		} else if (this.target.y > H - this.target.r) {
			this.target.y = H - this.target.r;
			this.target.speedY = -Math.abs(this.target.speedY);
		}

		// Implodieren der Blase
		if (this.target.r < 5 * S) {
			createExplosion(this, this.target.x, this.target.y, COLORS.bubble.popParticles);
			this.engine.applyDamage(POINTS.bubble.bubbleImplosion);
			if (this.engine.audio && this.engine.gameState === "playing")
				this.engine.audio.playSoundEffect(SOUNDS.bubble.bubbleImplosion);
			this.createBubble(); // neue Blase generieren
		}
	}

	// Zeichnen
	// Rendern zunächst auf eine unsichtbare Leinwand und dann verzerrte Ausgabe auf sichtbare Leinwand
	draw(ctx) {
		// Wasserfarbverlauf (linear mit drei Farben)
		const waterGradient = this.octx.createLinearGradient(0, 0, 0, H);
		this.octx.save();
		waterGradient.addColorStop(0, COLORS.bubble.water[0]);
		waterGradient.addColorStop(0.5, COLORS.bubble.water[1]);
		waterGradient.addColorStop(1, COLORS.bubble.water[2]);
		this.octx.fillStyle = waterGradient;
		this.octx.fillRect(0, 0, W, H);
		this.octx.restore();

		// Nebel (verzerrter radialer Verlauf)
		// Zeichnung als Kreis + elliptische Verzerrung statt Zeichnung als Ellipse für bessere Farbverlaufsdarstellung
		this.fog.forEach((cloud) => {
			this.octx.save();
			this.octx.translate(cloud.x, cloud.y); // Koordinatenursprung in den Mittelpunkt der Nebelwolke verschieben
			this.octx.scale(1, 0.3); // Verzerrung der Matrix durch Stauchung der y-Achse
			const radialGradient = this.octx.createRadialGradient(0, 0, 0, 0, 0, cloud.r);
			radialGradient.addColorStop(0, COLORS.bubble.fog[0]);
			radialGradient.addColorStop(1, COLORS.bubble.fog[1]);
			this.octx.fillStyle = radialGradient;
			this.octx.beginPath();
			this.octx.arc(0, 0, cloud.r, 0, Math.PI * 2); // Kreis aufgrund Matrixverzerrung Ellipse
			this.octx.fill();
			this.octx.restore();
		});

		// Lichtkegel
		const rayShift = Math.sin(this.frames / 100) * 15 * S; // sinusförmige Veränderung der Verschiebung [-15; 15] * S
		this.octx.save();
		this.octx.fillStyle = COLORS.bubble.ray[0];
		this.octx.beginPath();
		// Eckpunkte des Kegels (Breite oben: 15 * S, Breite unten: 100 * S)
		this.octx.moveTo(230 * S - rayShift, 0);
		this.octx.lineTo(245 * S - rayShift, 0);
		this.octx.lineTo(140 * S - rayShift, H);
		this.octx.lineTo(40 * S - rayShift, H);
		this.octx.closePath();
		this.octx.fill();

		this.octx.fillStyle = COLORS.bubble.ray[1];
		this.octx.beginPath();
		// Eckpunkte des Kegels (Breite oben: 15 * S, Breite unten: 100 * S)
		this.octx.moveTo(240 * S - rayShift, 0);
		this.octx.lineTo(255 * S - rayShift, 0);
		this.octx.lineTo(230 * S + rayShift, H); // Gegenläufige Bewegung des unteren Endes
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
		this.octx.ellipse(W / 2, H + 10 * S, 200 * S, 40 * S, 0, 0, Math.PI * 2); // Ellipse nur ausschnittsweise sichtbar
		this.octx.fill();
		this.octx.restore();

		// Algen zeichnen
		const positions = [50 * S, 90 * S, 160 * S, 210 * S, 260 * S]; // horizontale Positionen der einzelnen Halme
		positions.forEach((startX, algaeIndex) => {
			const algaeColor = COLORS.bubble.algae[algaeIndex % 3]; // alternierende Farbwahl via Modulo
			const segments = 8; // Anzahl der beweglichen Segmente pro Halm
			const segmentHeight = (12 + algaeIndex) * S; // Segmenthöhe, Größenanstieg von links nach rechts
			const nodes = []; // Blattansatzknoten

			// Halme
			this.octx.save();
			this.octx.beginPath();
			this.octx.strokeStyle = algaeColor;
			this.octx.lineWidth = 3 * S;
			this.octx.lineCap = "round";
			this.octx.moveTo(startX, H - 5 * S);
			// Halm vom Startpunkt segmentweise nach oben zeichnen
			for (let segmentIndex = 1; segmentIndex <= segments; segmentIndex++) {
				// Schwingen der Halme durch sinusförmige Veränderung des horizontalen Versatzes der Segmentendpunkte
				// this.frames * 0.04 sorgt für die Zeitabhängigkeit und damit Bewegung
				// + algaeIndex sorgt für verschiedene (versetzte) Bewegungen der Halme
				// + segmentIndex * 0.2 sorgt für unterschiedliche Bewegung der Segmente, der obere Teil folgt dem unteren verzögert
				// * segmentIndex * 1.5 sorgt für segmentabhängige Amplitude, höhere Segmente schlagen stärker aus
				const swayOffset =
					Math.sin(this.frames * 0.04 + algaeIndex + segmentIndex * 0.2) * (segmentIndex * 1.5 * S);
				const nextX = startX + swayOffset;
				const nextY = H - 5 * S - segmentIndex * segmentHeight;
				this.octx.lineTo(nextX, nextY);
				nodes.push({ x: nextX, y: nextY, s: swayOffset }); // aktuellen Blattansatzknoten speichern
			}
			this.octx.stroke();

			// Blätter
			this.octx.fillStyle = algaeColor;
			nodes.forEach((leaf, segmentIndex) => {
				// nur an jedem zweiten Blattansatzknoten ein Blatt zeichnen
				if ((segmentIndex + 1) % 2 === 0) {
					this.octx.save();
					this.octx.translate(leaf.x, leaf.y); // Koordinatenursprung in Blattansatzknoten verschieben
					this.octx.rotate((leaf.s / S) * 0.05); // Matrix leicht drehen, abhängig vom Schwingen des Segments
					this.octx.beginPath();
					this.octx.ellipse(
						(segmentIndex + 1) % 4 === 0 ? 5 * S : -5 * S, // Mittelpunkt eines Blattes alternierend links oder rechts verschoben
						2 * S, // leichter vertikaler Versatz für bessere Optik am Halmende
						6 * S,
						3 * S,
						Math.PI / 6, // Grundrotation der Blätter (30°)
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
		this.octx.setLineDash([5 * S, 5 * S]); // Strichelung mit 5px Strich und 5px Lücke
		this.octx.stroke();
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
		const fontSize = (this.target.r / S) * 1.8; // Annäherung der Emoji-Größe an physikalischen Radius der Zielblase
		this.octx.save();
		this.octx.shadowColor = COLORS.bubble.bubbleShadow;
		this.octx.shadowBlur = 15;
		drawCharCentered(this.octx, this.target.x, this.target.y, CHARS.bubble.target.char, font(fontSize, true));
		this.octx.restore();

		// Wackeleffekt durch Zerschneiden der Hilfsleinwand in horizontale Streifen und versetzte Projektion auf die echte Leinwand
		const step = Math.max(1, S / 2); // Höhe eines Streifens (halber Skalierungsfaktor, mindestens 1 Pixel)
		// streifenweise vertikale Iteration über die Leinwand
		for (let lineY = 0; lineY < H; lineY += step) {
			// Wackeleffekt durch sinusförmige Veränderung des horizontalen Versatzes der Streifen
			// this.frames * 0.02 sorgt für die Zeitabhängigkeit und damit Bewegung
			// (lineY / S) * 0.03 sorgt für den Bewegungsversatz zwischen den einzelnen Streifen
			const lineX = Math.sin(this.frames * 0.02 + (lineY / S) * 0.03) * 6 * S;
			ctx.drawImage(
				this.offscreenCanvas,
				0, // x
				lineY, // y
				W, // Breite
				step, // Höhe
				lineX - 6 * S, // Ziel-x, -6px Versatz aufgrund Skalierung
				lineY, // Ziel-y
				W + 12 * S, // Ziel-Breite, horizontal gestreckt, damit keine Leerstellen am Leinwandrand
				step * 2, // Ziel-Höhe, vergrößert, um durch Überlappung weiße Streifen zu vermeiden
			);
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
