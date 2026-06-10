// Hilfs- und Zeichenfunktionen
// -----------------------------

// Anzeige der Herzen entsprechend der Leben
function drawHearts(ctx, state) {
	ctx.font = "20px serif";
	ctx.textAlign = "left";
	for (let i = 0; i < state.maxLives; i++) {
		let xPos = 260 - i * 25;
		let yPos = 20;
		if (i < state.lives - (state.recoveringHeart ? 1 : 0)) {
			// Volle Herzen
			ctx.globalAlpha = 1.0;
			ctx.fillStyle = "#ffffff";
			ctx.fillText("❤️", xPos, yPos);
		} else if (state.recoveringHeart && i === state.lives - 1) {
			// Blinkendes Herz
			let blink = Math.floor(Date.now() / 250) % 2;
			ctx.globalAlpha = blink ? 1.0 : 0.2;
			ctx.fillStyle = "#ffffff";
			ctx.fillText("❤️", xPos, yPos);
		} else {
			// Erloschene Herzen
			ctx.globalAlpha = 0.2;
			ctx.fillStyle = "#ffffff";
			ctx.fillText("🖤", xPos, yPos);
		}
	}
	ctx.globalAlpha = 1.0;
}

// Schatten zeichnen (Pferdeparcours und Früchtefänger)
function drawShadow(ctx, x, groundY, currentY, startFadeY) {
	if (currentY > startFadeY) {
		let range = groundY - startFadeY;
		let proximity = Math.min(1, (currentY - startFadeY) / range);
		let shadowAlpha = proximity * 0.25;
		let shadowWidth = 10 + proximity * 15;
		ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
		ctx.beginPath();
		// Zeichnet ellipsenförmigen Schatten auf die Bodenhöhe (groundY)
		ctx.ellipse(x, groundY, shadowWidth, shadowWidth / 3, 0, 0, Math.PI * 2);
		ctx.fill();
	}
}

// Explosionen zeichnen (Sternenslalom und BubbleBlow)
function createExplosion(state, x, y, color) {
	state.particles = state.particles || [];
	for (let i = 0; i < 12; i++) {
		state.particles.push({
			x: x,
			y: y,
			vX: (Math.random() - 0.5) * 6,
			vY: (Math.random() - 0.5) * 6,
			size: Math.random() * 3 + 1,
			alpha: 1,
			color: color,
		});
	}
}

// Startbildschirm zeichnen
function drawStartScreen(ctx, type, btnRect) {
	const config = gamesConfig[type];
	if (!config) return;
	// Dunkles Overlay über dem Spielhintergrund
	ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
	ctx.fillRect(0, 0, 300, 300);
	// Blauer Rahmen
	ctx.strokeStyle = "rgba(59, 130, 246, 0.4)";
	ctx.lineWidth = 3;
	ctx.strokeRect(10, 10, 280, 280);
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	// Titel
	const titles = { horse: "Pferdeparcours", catcher: "Früchtefänger", dodger: "Sternenslalom", grower: "BubbleBlow" };
	ctx.fillStyle = "#3b82f6";
	ctx.font = "bold 24px sans-serif";
	ctx.fillText(titles[type] || "Mini-Spiel", 150, 45);
	// Trennlinie
	ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(30, 70);
	ctx.lineTo(270, 70);
	ctx.stroke();
	// Kurzanleitung Zeile für Zeile ausgeben
	ctx.fillStyle = "#e2e8f0";
	ctx.font = "13px sans-serif";
	if (config.instructions) {
		config.instructions.forEach((line, index) => {
			// Erste Zeile hervorheben
			if (index === 0) {
				ctx.fillStyle = "#fbbf24";
				ctx.font = "bold 14px sans-serif";
			} else {
				ctx.fillStyle = "#e2e8f0";
				ctx.font = "13px sans-serif";
			}
			ctx.fillText(line, 150, 105 + index * 24);
		});
	}
	// Start-Button zeichnen
	ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
	ctx.shadowBlur = 6;
	ctx.shadowOffsetY = 2;
	ctx.fillStyle = "#22c55e"; // Grüner Start-Button
	ctx.beginPath();
	ctx.roundRect(btnRect.x, btnRect.y, btnRect.w, btnRect.h, 12);
	ctx.fill();
	// Schatten zurücksetzen
	ctx.shadowBlur = 0;
	ctx.shadowOffsetY = 0;
	ctx.fillStyle = "white";
	ctx.font = "bold 16px sans-serif";
	ctx.fillText("START", btnRect.x + btnRect.w / 2, btnRect.y + btnRect.h / 2);
}

// Endbildschirm zeichnen
function drawEndScreen(ctx, result, btnRect) {
	// Hintergrund-Overlay mit Farbverlauf
	const gradient = ctx.createLinearGradient(0, 0, 0, 300);
	if (result === "win") {
		gradient.addColorStop(0, "rgba(20, 50, 20, 0.95)");
		gradient.addColorStop(1, "rgba(40, 100, 60, 0.9)");
	} else {
		gradient.addColorStop(0, "rgba(30, 20, 50, 0.95)");
		gradient.addColorStop(1, "rgba(60, 40, 90, 0.9)");
	}
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, 300, 300);
	// Weißer Rahmen
	ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
	ctx.lineWidth = 4;
	ctx.strokeRect(10, 10, 280, 280);
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	// Sieg oder Niederlage
	ctx.shadowBlur = 10;
	if (result === "win") {
		ctx.fillStyle = "#4ade80";
		ctx.font = "bold 28px sans-serif";
		ctx.fillText("🎉 GEWONNEN! 🎉", 150, 70);
	} else {
		ctx.fillStyle = "#f87171";
		ctx.font = "bold 28px sans-serif";
		ctx.fillText("😔 GAME OVER 😔", 150, 70);
	}
	// Punktzahl anzeigen
	ctx.fillStyle = "#fbbf24";
	ctx.font = "bold 22px sans-serif";
	ctx.fillText(`${Math.max(0, Math.min(Math.floor(gamePoints), maxScore))} / ${maxScore} Punkte`, 150, 110);
	// Motivationstext
	ctx.font = "14px sans-serif";
	ctx.fillStyle = "white";
	if (result === "win") {
		ctx.fillText("👏 Super gemacht! Gib weiterhin so viel", 150, 145);
		ctx.fillText("Gas wie beim Lernen! 🥳", 150, 165);
	} else {
		ctx.fillText("Bleib am Ball,", 150, 145);
		ctx.fillText("genau wie beim Lernen! 😉", 150, 165);
	}
	// Button
	ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
	ctx.shadowBlur = 5;
	ctx.shadowOffsetY = 3;
	ctx.fillStyle = "#3b82f6";
	ctx.beginPath();
	ctx.roundRect(btnRect.x, btnRect.y, btnRect.w, btnRect.h, 12);
	ctx.fill();
	ctx.shadowBlur = 0;
	ctx.shadowOffsetY = 0;
	ctx.fillStyle = "white";
	ctx.font = "bold 16px sans-serif";
	ctx.fillText("Weiter", btnRect.x + btnRect.w / 2, btnRect.y + btnRect.h / 2);
}

// Pointer-Koordinaten ermitteln
function getCanvasPointer(e, canvas) {
	const r = canvas.getBoundingClientRect();
	return {
		x: (e.clientX - r.left) * (300 / r.width),
		y: (e.clientY - r.top) * (300 / r.height),
	};
}

// Konfiguration und Logik für die einzelnen Spiele
const gamesConfig = {
	// Pferdeparcours
	horse: {
		syncPointerOnDown: true,
		useDefaultKeyboard: false,
		// Kurzanleitung ANFANG -------->
		instructions: [
			"Reite durch den Parcours!",
			"Weiche den Straßensperren aus.",
			"Steuerung: LEERTASTE / W / ARROW_UP",
			"oder wische auf dem Display nach oben.",
		],
		// Kurzanleitung ENDE <--------
		init: (state) => {
			state.player = { x: 150, y: 265, vY: 0, isJumping: false, jumpHoldFrames: 0 };
			state.clouds = [];
			state.objects = [];
			state.nextObstacleFrame = 60;
			// Wolkengenerierung
			for (let i = 0; i < 5; i++) {
				state.clouds.push({
					x: Math.random() * 300,
					y: Math.random() * 80 + 20,
					size: Math.random() * 20 + 20,
					speed: Math.random() * 0.2 + 0.1,
				});
			}
		},

		// Event Handler
		onKeyDown: (key, state) => {
			if ([" ", "arrowup", "w"].includes(key) && state.player.y >= 265) {
				state.player.isJumping = true;
				state.player.jumpHoldFrames = 0;
			}
		},
		onKeyUp: (key, state) => {
			if ([" ", "arrowup", "w"].includes(key)) {
				state.player.isJumping = false;
			}
		},
		onPointerDown: (e, state) => {
			state.touchStart = Date.now();
			state.touchStartY = state.mouse.y;
		},
		onPointerUp: (e, state) => {
			if (!state.touchStart || state.touchStartY === undefined || state.player.y < 265) return;
			const duration = Math.max(30, Date.now() - state.touchStart);
			const distY = state.touchStartY - state.mouse.y;
			if (distY < 25) {
				state.player.vY = -10;
			} else {
				let swipePower = (distY / Math.max(1, duration)) * 16;
				state.player.vY = -Math.max(8, Math.min(18, swipePower));
			}
		},

		// Logik
		update: (state, deltaTime) => {
			state.frames += 1 * deltaTime;
			// Bewegung der Wolken
			state.clouds.forEach((c) => {
				c.x -= c.speed * deltaTime;
				if (c.x < -100) c.x = 350; // Reset am rechten Rand
			});
			// Sprünge und Gravitation
			state.player.vY += 0.6 * Math.sqrt(difficulty) * deltaTime;
			// Längerer Tastendruck --> höherer Sprung
			if (state.player.isJumping) {
				state.player.jumpHoldFrames += deltaTime;
				if (state.player.jumpHoldFrames < 15) {
					state.player.vY = -Math.max(8, state.player.jumpHoldFrames * 0.8);
				} else {
					state.player.isJumping = false;
				}
			}
			state.player.y += state.player.vY * deltaTime; // Gravitation
			if (state.player.y < 20) {
				state.player.y = 20;
				state.player.vY = 0;
			}
			if (state.player.y > 265) {
				state.player.y = 265;
				state.player.vY = 0;
				state.player.isJumping = false;
			}
			// Hindernissabstand
			if (state.frames >= state.nextObstacleFrame) {
				state.objects.push({ x: 320, y: 265, passed: false, hit: false });
				// Variablen Abstand berechnen
				let randomGap = Math.floor((15 * (2 - Math.random()) + 20 * (2 - gamePoints / maxScore)) / difficulty);
				state.nextObstacleFrame = state.frames + randomGap;
			}
			// Hindernissgenerierung
			for (let i = state.objects.length - 1; i >= 0; i--) {
				let obj = state.objects[i];
				obj.x -= 5 * difficulty * deltaTime;
				// Hinderniskollision
				if (!obj.hit && obj.x > 30 && obj.x < 70 && state.player.y > 225) {
					obj.hit = true;
					obj.passed = true; // damit keine zusätzliche Punktvergabe erfolgt
					state.applyDamage(-5);
				}
				// Hindernis übersprungen
				if (obj.x < 30 && !obj.passed && !obj.hit) {
					obj.passed = true;
					state.addScore(10);
					playSound("point");
				}
				// Entfernen von Hindernissen außerhalb des Bildschirms
				if (obj.x < -50) state.objects.splice(i, 1);
			}
		},

		// Zeichnen
		draw: (ctx, state) => {
			ctx.font = "bold 40px serif";
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			// Himmel
			ctx.fillStyle = "#87ceeb";
			ctx.fillRect(0, 0, 300, 300);
			// Sonne
			ctx.save();
			// Leuchten
			ctx.shadowColor = "#fff5bb";
			ctx.shadowBlur = 15;
			// Corona als kreisförmige Welle
			ctx.globalAlpha = 0.8;
			ctx.fillStyle = "#ffee88";
			ctx.beginPath();
			for (let i = 0; i <= 36; i++) {
				const a = (i * Math.PI) / 18;
				const r = 35 + Math.sin(a * 12 - state.frames * 0.1) * 5;
				ctx.lineTo(250 + Math.cos(a) * r, 50 + Math.sin(a) * r);
			}
			ctx.closePath();
			ctx.fill();
			ctx.shadowBlur = 0;
			ctx.globalAlpha = 1.0;
			// Sonne
			ctx.fillStyle = "#ffe655";
			ctx.beginPath();
			ctx.arc(250, 50, 30, 0, Math.PI * 2);
			ctx.fill();
			// Sonnenbrillen-Emoji
			ctx.fillStyle = "#ffffff";
			ctx.fillText("🕶️", 250, 45);
			ctx.restore();
			// Wolken aus je drei Kreisen
			ctx.globalAlpha = 0.8;
			ctx.fillStyle = "#ffffff";
			state.clouds.forEach((c) => {
				ctx.beginPath();
				ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2);
				ctx.arc(c.x + c.size * 0.6, c.y - c.size * 0.2, c.size * 0.7, 0, Math.PI * 2);
				ctx.arc(c.x + c.size * 1.1, c.y, c.size * 0.8, 0, Math.PI * 2);
				ctx.fill();
			});
			ctx.globalAlpha = 1.0;
			// Boden
			ctx.fillStyle = "#22c55e";
			ctx.fillRect(0, 280, 300, 20);
			// Grashalme
			ctx.strokeStyle = "#166534";
			for (let i = 0; i < 320; i += 20) {
				ctx.beginPath();
				ctx.moveTo(i - ((5 * state.frames * difficulty) % 20), 280);
				ctx.lineTo(i - ((5 * state.frames * difficulty) % 20) - 2, 275);
				ctx.stroke();
			}
			// Hindernisse
			state.objects.forEach((obj) => {
				ctx.fillStyle = "#ffffff";
				ctx.fillText("🚧", obj.x, obj.y);
			});
			// Cursor (Highlight)
			ctx.beginPath();
			ctx.arc(state.lerp.x, state.lerp.y, 20, 0, Math.PI * 2);
			ctx.fillStyle = state.cursorStyle;
			ctx.fill();
			// Pferd (Spieler)
			drawShadow(ctx, 50, 280, state.player.y, 180);
			// (Spiegelung des Emoji)
			ctx.save();
			ctx.translate(50, state.player.y);
			ctx.scale(-1, 1);
			ctx.fillStyle = "#ffffff";
			ctx.fillText("🐎", 0, 0);
			ctx.restore();
		},
	},

	// Früchtefänger
	catcher: {
		syncPointerOnDown: false,
		useDefaultKeyboard: true,
		// Kurzanleitung ANFANG -------->
		instructions: [
			"Fange gesundes Essen!",
			"Sammle Obst (+5P) & Gemüse (+10P).",
			"Weiche Junkfood aus (-10P)!",
			"Steuerung: Maus bewegen oder A / D / Pfeiltasten.",
		],
		// Kurzanleitung ENDE <--------
		init: (state) => {
			state.foodTypes = [
				["🍎", "🍐", "🍑", "🍊", "🍒", "🍇", "🍓", "🫐", "🍌", "🥝"], // 0: Obst
				["🥔", "🥕", "🥦", "🧅", "🫑", "🥒", "🫛", "🍆", "🌽", "🥬"], // 1: Gemüse
				["🍔", "🍟", "🍕", "🌭", "🍿", "🍦", "🍰", "🍩", "🍫", "🍭"], // 2: Junkfood
			];
			state.objects = [];
			state.nextFoodFrame = 20;
			// Funktion zur Generierung der herabfallenden Objekte
			state.createFood = () => {
				let rand = Math.random();
				let typeId = rand < 0.4 ? 0 : rand < 0.8 ? 1 : 2; // Verteilung 40% + 40% + 20%
				state.objects.push({
					x: Math.random() * 260 + 20,
					y: -50,
					type: typeId,
					foodId: Math.floor(Math.random() * 10),
					speed: 1.5 + Math.random() * 1.5,
				});
			};
			state.createFood();
		},

		// Event Handler
		onPointerDown: () => {},
		onPointerUp: () => {},

		// Logik
		update: (state, deltaTime) => {
			state.frames += 1 * deltaTime;
			// Abstand der herabfallenden Objekte
			let spawnRate = (70 / difficulty) * (1 - (gamePoints / maxScore) * 0.6);
			if (state.frames >= state.nextFoodFrame) {
				state.createFood();
				state.nextFoodFrame = state.frames + spawnRate;
			}
			// Generierung der herabfallenden Objekte
			for (let i = state.objects.length - 1; i >= 0; i--) {
				let obj = state.objects[i];
				obj.y += (obj.speed * difficulty + (1.5 * gamePoints) / maxScore) * deltaTime;
				// Herabfallendes Objekt verpasst
				if (obj.y > 280) {
					if (obj.type === 2) {
						state.addScore(5); // Junkfood vermieden
						playSound("point");
					} else {
						state.applyDamage(-5); // Obst/Gemüse verpasst
					}
					state.objects.splice(i, 1);
					continue;
				}
				// Herabfallendes Objekt gefangen
				if (Math.abs(state.lerp.x - obj.x) < 25 && Math.abs(state.lerp.y - obj.y) < 25) {
					if (obj.type === 0) {
						state.addScore(5); // Obst gefangen
						playSound("point");
					} else if (obj.type === 1) {
						state.addScore(10); // Gemüse gefangen
						playSound("point");
					} else if (obj.type === 2) {
						state.applyDamage(-10); // Junkfodd gefangen
					}
					state.objects.splice(i, 1);
				}
			}
		},

		// Zeichnen
		draw: (ctx, state) => {
			ctx.font = "bold 30px serif";
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			// Tapete
			ctx.fillStyle = "#fef3c7";
			ctx.fillRect(0, 0, 300, 300);
			ctx.strokeStyle = "#fae8b0";
			ctx.lineWidth = 1;
			const gridSize = 20;
			ctx.beginPath();
			for (let x = 0; x <= 300; x += gridSize) {
				ctx.moveTo(x, 0);
				ctx.lineTo(x, 300);
			}
			for (let y = 0; y <= 300; y += gridSize) {
				ctx.moveTo(0, y);
				ctx.lineTo(300, y);
			}
			ctx.stroke();
			// Tisch
			ctx.fillStyle = "#92400e";
			ctx.fillRect(0, 280, 300, 20);
			ctx.fillStyle = "#b45309";
			ctx.fillRect(0, 280, 300, 4);
			// Herabfallende Objekte
			state.objects.forEach((obj) => {
				drawShadow(ctx, obj.x, 280, obj.y, 120);
				let currentEmoji = state.foodTypes[obj.type][obj.foodId];
				ctx.fillStyle = "#000000";
				ctx.fillText(currentEmoji, obj.x, obj.y);
			});
			// Cursor (Highlight)
			ctx.beginPath();
			ctx.arc(state.lerp.x, state.lerp.y, 25, 0, Math.PI * 2);
			ctx.fillStyle = state.cursorStyle;
			ctx.fill();
			// Korb (Spieler)
			ctx.font = "bold 40px serif";
			ctx.fillStyle = "#ffffff";
			ctx.fillText("🧺", state.lerp.x, state.lerp.y);
		},
	},

	// Sternenslalom
	dodger: {
		syncPointerOnDown: false,
		useDefaultKeyboard: true,
		// Kurzanleitung ANFANG -------->
		instructions: [
			"Fliege durch den Weltraum!",
			"Weiche Asteroiden aus oder schieße sie ab.",
			"Steuerung: Bewegen mit Maus/Tastatur.",
			"Schießen: LEERTASTE / ENTER / Touch-Klick.",
		],
		// Kurzanleitung ENDE <--------
		init: (state) => {
			state.objects = [];
			state.beam = [];
			state.particles = [];
			state.stars = [];
			state.ammo = 3;
			state.lastReload = Date.now();
			// Sterngenerierung
			for (let i = 0; i < 100; i++) {
				state.stars.push({
					x: Math.random() * 300,
					y: Math.random() * 300,
					size: Math.random() * 1.5,
					opacity: Math.random(),
				});
			}
		},

		// Event Handler & Feuerlogik
		fire: (state) => {
			if (state.ammo > 0) {
				state.beam.push({ x: state.lerp.x, y: state.lerp.y - 20, speed: 10 });
				state.ammo--;
				playSound("point");
				if (state.ammo === 2) state.lastReload = Date.now();
			} else {
				playSound("wrong");
			}
		},

		onKeyDown: (key, state) => {
			if (key === " " || key === "enter") gamesConfig.dodger.fire(state);
		},
		onPointerDown: (e, state) => {
			state.touchStart = Date.now();
			if (state.activePointers.size > 1 || e.pointerType === "mouse") {
				gamesConfig.dodger.fire(state);
			}
		},
		onPointerUp: (e, state) => {
			if (state.activePointers.size === 1 && e.pointerType !== "mouse") {
				const touchDuration = Date.now() - state.touchStart;
				if (touchDuration < 200) gamesConfig.dodger.fire(state);
			}
		},

		// Logik
		update: (state, deltaTime) => {
			// Sternbewegung
			state.stars.forEach((star) => {
				star.y += deltaTime * difficulty;
				if (star.y > 300) star.y = 0; // Reset am unteren Rand
			});
			// Generierung der Laserstrahlen
			for (let i = state.beam.length - 1; i >= 0; i--) {
				let b = state.beam[i];
				b.y -= b.speed * deltaTime;
				if (b.y < -20) state.beam.splice(i, 1);
			}
			// Generierung der Explosionspartikel
			for (let i = state.particles.length - 1; i >= 0; i--) {
				let p = state.particles[i];
				p.x += p.vX * deltaTime;
				p.y += p.vY * deltaTime;
				p.alpha -= 0.02 * deltaTime; // Partikel verblasst
				if (p.alpha <= 0) state.particles.splice(i, 1);
			}
			// Generierung der Asteroiden
			if (Math.random() < 0.04 * difficulty * deltaTime) {
				state.objects.push({
					x: Math.random() * 300,
					y: -20,
					speed: (2 + Math.random() * 3 + (gamePoints / maxScore) * 3) * difficulty,
					hit: false,
				});
			}
			// Kollisionsprüfung Laserstrahl Asteroid
			for (let bId = state.beam.length - 1; bId >= 0; bId--) {
				let b = state.beam[bId];
				for (let oId = state.objects.length - 1; oId >= 0; oId--) {
					let en = state.objects[oId];
					const dist = Math.sqrt((b.x - en.x) ** 2 + (b.y - en.y) ** 2);
					if (dist < 25) {
						createExplosion(state, en.x, en.y, "#ffcc00");
						state.objects.splice(oId, 1);
						state.beam.splice(bId, 1);
						state.addScore(5); // Bonuspunkte Abschuss
						playSound("correct");
						break;
					}
				}
			}
			// Kollisionsprüfung Asteroid Raumschiff
			for (let i = state.objects.length - 1; i >= 0; i--) {
				let obj = state.objects[i];
				obj.y += obj.speed * deltaTime;
				if (!obj.hit && Math.sqrt((obj.x - state.lerp.x) ** 2 + (obj.y - state.lerp.y) ** 2) < 25) {
					obj.hit = true;
					state.applyDamage(-10); // Malus Kollision
				}
				if (obj.y > 320) state.objects.splice(i, 1);
			}
			// Nachladelogik
			if (state.ammo < 3 && Date.now() - state.lastReload > 3000 * difficulty) {
				state.ammo++;
				state.lastReload = Date.now();
			}
			state.addScore(0.12 * deltaTime); // Punktzahl steigt mit Zeit
		},

		// Zeichnen
		draw: (ctx, state) => {
			ctx.font = "bold 30px serif";
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			// Universum
			ctx.fillStyle = "#000000";
			ctx.fillRect(0, 0, 300, 300);
			// Sterne im Hintergrund
			state.stars.forEach((star) => {
				ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
				ctx.beginPath();
				ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
				ctx.fill();
			});
			// Laserstrahlen
			ctx.fillStyle = "#00ff00";
			ctx.shadowColor = "#00ff00";
			ctx.shadowBlur = 10;
			state.beam.forEach((b) => {
				ctx.fillRect(b.x - 2, b.y, 4, 15);
			});
			ctx.shadowBlur = 0;
			// Explosionspartikel
			state.particles.forEach((p) => {
				ctx.fillStyle = p.color;
				ctx.globalAlpha = p.alpha;
				ctx.fillRect(p.x, p.y, p.size, p.size);
			});
			ctx.globalAlpha = 1.0;
			// Asteroiden
			state.objects.forEach((obj) => {
				ctx.fillStyle = "#ffffff";
				ctx.fillText("☄️", obj.x, obj.y);
			});
			// Cursor (Highlight)
			ctx.beginPath();
			ctx.arc(state.lerp.x, state.lerp.y, 25, 0, Math.PI * 2);
			ctx.fillStyle = state.cursorStyle;
			ctx.fill();
			// Raumschiff (Spieler)
			ctx.font = "bold 40px serif";
			ctx.fillStyle = "#ffffff";
			ctx.fillText("🛸", state.lerp.x, state.lerp.y);
			// Munitionsanzeige
			for (let i = 0; i < 3; i++) {
				ctx.fillStyle = i < state.ammo ? "#00ff00" : "#ffffff33";
				ctx.fillRect(10 + i * 15, 15, 10, 4);
			}
		},
	},

	// BubbleBlow
	grower: {
		syncPointerOnDown: true,
		useDefaultKeyboard: true,
		// Kurzanleitung ANFANG -------->
		instructions: [
			"Puste die Seifenblase auf!",
			"Klicke auf die Blase, um sie zu vergrößern.",
			"Bringe sie zum Platzen, bevor sie schrumpft!",
			"Steuerung: Zielen mit Maus, Pusten mit Klick.",
		],
		// Kurzanleitung ENDE <--------
		init: (state) => {
			state.particles = [];
			state.bgBubbles = [];
			state.fogClouds = [];
			state.target = {
				r: 20 + Math.random() * 15,
				x: Math.random() * 200 + 50,
				y: Math.random() * 200 + 50,
				vX: (Math.random() - 0.5) * (1.5 * difficulty + gamePoints / maxScore),
				vY: (Math.random() - 0.5) * (1.5 * difficulty + gamePoints / maxScore),
			};
			// Generierung der Nebelwolken
			for (let i = 0; i < 4; i++) {
				state.fogClouds.push({
					x: Math.random() * 300,
					y: Math.random() * 300,
					r: 70 + Math.random() * 50,
					speed: (Math.random() - 0.5) * 0.3,
				});
			}
			// Generierung der Hintergrundblasen
			for (let i = 0; i < 15; i++) {
				state.bgBubbles.push({
					x: Math.random() * 300,
					y: Math.random() * 300,
					r: Math.random() * 3 + 1,
					speed: Math.random() * 0.5 + 0.2,
					wobble: Math.random() * Math.PI,
				});
			}
			// Generierung der Zielblase
			state.createBubble = () => {
				state.target.r = 20 + Math.random() * 15;
				state.target.x = Math.random() * 200 + 50;
				state.target.y = Math.random() * 200 + 50;
				state.target.vX = (Math.random() - 0.5) * (1.5 * difficulty + gamePoints / maxScore);
				state.target.vY = (Math.random() - 0.5) * (1.5 * difficulty + gamePoints / maxScore);
			};
		},

		// Event Handler & Pustelogik
		fire: (state) => {
			let wobbleX = Math.sin(state.frames * 0.02 + state.target.y * 0.03) * 6;
			let visualTargetX = state.target.x + wobbleX;
			const dist = Math.sqrt((state.mouse.x - visualTargetX) ** 2 + (state.mouse.y - state.target.y) ** 2);
			if (dist < state.target.r + 10) {
				state.target.r += 15;
				if (state.target.r > 70) {
					createExplosion(state, state.target.x, state.target.y, "#93c5fd");
					playSound("point");
					state.addScore(15); // Blase ist geplatzt
					state.createBubble();
				}
			}
		},

		onKeyDown: (key, state) => {
			if (key === " " || key === "enter") gamesConfig.grower.fire(state);
		},
		onPointerDown: (e, state) => {
			gamesConfig.grower.fire(state);
		},
		onPointerUp: () => {},

		// Logik
		update: (state, deltaTime) => {
			state.frames += 1 * deltaTime;
			// Bewegung der Nebelwolken
			state.fogClouds.forEach((f) => {
				f.x += f.speed * deltaTime;
				if (f.x < -150) f.x = 450;
				if (f.x > 450) f.x = -150;
			});
			// Aufsteigen der Hintergrundblasen
			state.bgBubbles.forEach((b) => {
				b.y -= b.speed * deltaTime;
				b.x += Math.sin(b.wobble) * 0.3 * deltaTime;
				b.wobble += 0.05 * deltaTime;
				if (b.y < -10) {
					// Reset am oberen Rand
					b.y = 310;
					b.x = Math.random() * 300;
				}
			});
			// Schrumpfrate der Zielblase
			let shrinkRate = (0.1 * difficulty + (gamePoints / maxScore) * 0.2) * deltaTime;
			state.target.r -= shrinkRate;
			// Bewegung der Zielblase & Bewegungsumkehr am Spielfeldrand
			state.target.x += state.target.vX * deltaTime;
			state.target.y += state.target.vY * deltaTime;
			if (state.target.x < state.target.r || state.target.x > 300 - state.target.r) state.target.vX *= -1;
			if (state.target.y < state.target.r || state.target.y > 300 - state.target.r) state.target.vY *= -1;
			// Platzen der Zielblase
			if (state.target.r < 5) {
				state.applyDamage(-10);
				state.createBubble();
			}
			// Generierung der Explosionspartikel
			for (let i = state.particles.length - 1; i >= 0; i--) {
				let p = state.particles[i];
				p.x += p.vX * deltaTime;
				p.y += p.vY * deltaTime;
				p.alpha -= 0.02 * deltaTime; // Partikel verblasst
				if (p.alpha <= 0) state.particles.splice(i, 1);
			}
		},

		// Zeichnen
		draw: (ctx, state) => {
			// Initialisierung eines Hilfscanvas für Wackeleffekt
			if (!state.offscreenCanvas) {
				state.offscreenCanvas = document.createElement("canvas");
				state.offscreenCanvas.width = 300;
				state.offscreenCanvas.height = 300;
			}
			let octx = state.offscreenCanvas.getContext("2d");
			// Wasserfarbverlauf
			let waterGrad = octx.createLinearGradient(0, 0, 0, 300);
			waterGrad.addColorStop(0, "#6b5d80"); // Perlviolett (Oberfläche)
			waterGrad.addColorStop(0.5, "#026a52"); // Türkisgrün (Mitte)
			waterGrad.addColorStop(1, "#292544"); // Mitternachtblau (Tiefe)
			octx.fillStyle = waterGrad;
			octx.fillStyle = waterGrad;
			octx.fillRect(0, 0, 300, 300);
			// Nebel
			state.fogClouds.forEach((f) => {
				octx.save();
				octx.translate(f.x, f.y);
				octx.scale(1, 0.3);
				let grad = octx.createRadialGradient(0, 0, 0, 0, 0, f.r);
				grad.addColorStop(0, "rgba(160, 160, 160, 0.4)");
				grad.addColorStop(1, "rgba(160, 160, 160, 0)");
				octx.fillStyle = grad;
				octx.beginPath();
				octx.arc(0, 0, f.r, 0, Math.PI * 2);
				octx.fill();
				octx.restore();
			});
			// Lichtkegel
			let rayShift = Math.sin(state.frames / 100) * 15;
			octx.fillStyle = "rgba(195, 181, 253, 0.1)";
			octx.beginPath();
			octx.moveTo(230 - rayShift, 0);
			octx.lineTo(245 - rayShift, 0);
			octx.lineTo(140 - rayShift, 300);
			octx.lineTo(40 - rayShift, 300);
			octx.closePath();
			octx.fill();
			octx.fillStyle = "rgba(45, 212, 190, 0.1)";
			octx.beginPath();
			octx.moveTo(240 - rayShift, 0);
			octx.lineTo(255 - rayShift, 0);
			octx.lineTo(230 + rayShift, 300);
			octx.lineTo(130 + rayShift, 300);
			octx.closePath();
			octx.fill();
			// Aufsteigende Hintergrundblasen
			octx.fillStyle = "rgba(255, 255, 255, 0.4)";
			octx.shadowColor = "#99f6e4";
			octx.shadowBlur = 8;
			state.bgBubbles.forEach((b) => {
				octx.beginPath();
				octx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
				octx.fill();
			});
			octx.shadowBlur = 0;
			// Sandboden
			octx.fillStyle = "#debc67";
			octx.beginPath();
			octx.ellipse(150, 310, 200, 40, 0, 0, Math.PI * 2);
			octx.fill();
			// Algen zeichnen
			const algaeColors = ["#189546", "#1b793f", "#4e7916"];
			const positions = [50, 90, 160, 210, 260];
			positions.forEach((startX, i) => {
				const col = algaeColors[i % 3];
				const segments = 8;
				const h = 12 + i;
				const points = [];
				// Halme
				octx.beginPath();
				octx.strokeStyle = col;
				octx.lineWidth = 3;
				octx.lineCap = "round";
				octx.moveTo(startX, 295);
				for (let j = 1; j <= segments; j++) {
					let sway = Math.sin(state.frames * 0.04 + i + j * 0.2) * (j * 1.5); // Schwingen der Halme
					let nextX = startX + sway;
					let nextY = 295 - j * h;
					octx.lineTo(nextX, nextY);
					points.push({ x: nextX, y: nextY, s: sway });
				}
				octx.stroke();
				// Blätter
				octx.fillStyle = col;
				points.forEach((p, j) => {
					if ((j + 1) % 2 === 0) {
						octx.save();
						octx.translate(p.x, p.y);
						octx.rotate(p.s * 0.05);
						octx.beginPath();
						octx.ellipse((j + 1) % 4 === 0 ? 5 : -5, 0, 6, 3, 0.5, 0, Math.PI * 2);
						octx.fill();
						octx.restore();
					}
				});
			});
			// Zielrahmen
			octx.beginPath();
			octx.arc(state.target.x, state.target.y, 70, 0, Math.PI * 2);
			octx.strokeStyle = "#2563eb1a";
			octx.setLineDash([5, 5]);
			octx.stroke();
			octx.setLineDash([]);
			// Explosionspartikel
			state.particles.forEach((p) => {
				octx.save();
				octx.globalAlpha = p.alpha;
				octx.fillStyle = p.color;
				octx.beginPath();
				octx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
				octx.fill();
				octx.restore();
			});
			// Zielblase
			let fontSize = state.target.r * 1.8;
			octx.font = `${fontSize}px serif`;
			octx.textAlign = "center";
			octx.textBaseline = "middle";
			octx.shadowColor = "#ffffffcc"; // Weißes Leuchten
			octx.shadowBlur = 15;
			octx.fillStyle = "#ffffff";
			octx.fillText("🫧", state.target.x, state.target.y);
			octx.shadowBlur = 0;
			// Wackeleffekt durch Zerschneiden der Hilfscanvas in horizontale Streifen und Projektion auf die echte Canvas
			for (let y = 0; y < 300; y += 1) {
				let wobbleX = Math.sin(state.frames * 0.02 + y * 0.03) * 6;
				ctx.drawImage(state.offscreenCanvas, 0, y, 300, 1, wobbleX - 6, y, 312, 1);
			}
			// Cursor (Highlight)
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.beginPath();
			ctx.arc(state.lerp.x, state.lerp.y, 27, 0, Math.PI * 2);
			ctx.fillStyle = state.cursorStyle;
			ctx.fill();
			// Pustender Emoji (Spieler)
			ctx.font = "bold 35px serif";
			ctx.fillStyle = "#ffffff";
			ctx.fillText("🌬️", state.lerp.x, state.lerp.y);
			// Fadenkreuz
			ctx.strokeStyle = "#007cd57b";
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(state.lerp.x - 12, state.lerp.y);
			ctx.lineTo(state.lerp.x + 12, state.lerp.y);
			ctx.moveTo(state.lerp.x, state.lerp.y - 12);
			ctx.lineTo(state.lerp.x, state.lerp.y + 12);
			ctx.stroke();
		},
	},
};
