// Hilfs- und Zeichenfunktionen
// -----------------------------

// Anzeige der Herzen entsprechend der Leben
function drawHearts(ctx, state) {
	for (let i = 0; i < state.maxLives; i++) {
		ctx.font = "20px serif";
		ctx.textAlign = "right";
		let xPos = 290 - i * 25;
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
		ctx.globalAlpha = 1.0;
	}
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

// Konfiguration und Logik für die einzelnen Spiele
const gamesConfig = {
	// Pferdeparcours
	horse: {
		init: (state) => {
			state.player = { x: 150, y: 265, vY: 0 };
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

		// Event Listener
		onPointerDown: (e, state) => {
			state.touchStartY = state.mouse.y;
		},
		onPointerUp: (e, state) => {
			if (state.player.y < 265) return;
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
			state.player.y += state.player.vY * deltaTime; // Gravitation
			if (state.player.y > 265) {
				state.player.y = 265;
				state.player.vY = 0;
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
			// Wolken aus je drei Kreisen
			ctx.fillStyle = "#ffffffcc";
			state.clouds.forEach((c) => {
				ctx.beginPath();
				ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2);
				ctx.arc(c.x + c.size * 0.6, c.y - c.size * 0.2, c.size * 0.7, 0, Math.PI * 2);
				ctx.arc(c.x + c.size * 1.1, c.y, c.size * 0.8, 0, Math.PI * 2);
				ctx.fill();
			});
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

		// Event Listener
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

		// Event Listener
		onPointerDown: (e, state) => {
			if (state.activePointers.size > 1) {
				// Bei Multitouch schießen
				if (state.ammo > 0) {
					state.beam.push({ x: state.lerp.x, y: state.lerp.y - 20, speed: 10 });
					state.ammo--;
					playSound("point");
					if (state.ammo === 2) state.lastReload = Date.now();
				} else {
					playSound("wrong");
				}
			}
		},
		onPointerUp: (e, state) => {
			const touchDuration = Date.now() - state.touchStart;
			if (touchDuration < 250 && state.activePointers.size <= 1) {
				// Bei Click/Tipp schießen
				if (state.ammo > 0) {
					state.beam.push({ x: state.lerp.x, y: state.lerp.y - 20, speed: 10 });
					state.ammo--;
					playSound("point");
					if (state.ammo === 2) state.lastReload = Date.now();
				} else {
					playSound("wrong");
				}
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
				if (p.alpha <= 0) {
					state.particles.splice(i, 1);
				}
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
		init: (state) => {
			state.particles = [];
			state.bgBubbles = [];
			state.target = {
				r: 20 + Math.random() * 15,
				x: Math.random() * 200 + 50,
				y: Math.random() * 200 + 50,
				vX: (Math.random() - 0.5) * (1.5 * difficulty + gamePoints / maxScore),
				vY: (Math.random() - 0.5) * (1.5 * difficulty + gamePoints / maxScore),
			};
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
			// Funktion zur Generierung der Zielblase
			state.createBubble = () => {
				state.target.r = 20 + Math.random() * 15;
				state.target.x = Math.random() * 200 + 50;
				state.target.y = Math.random() * 200 + 50;
				state.target.vX = (Math.random() - 0.5) * (1.5 * difficulty + gamePoints / maxScore);
				state.target.vY = (Math.random() - 0.5) * (1.5 * difficulty + gamePoints / maxScore);
			};
		},

		// Event Listener
		onPointerDown: (e, state) => {
			const d = Math.sqrt((state.lerp.x - state.target.x) ** 2 + (state.lerp.y - state.target.y) ** 2);
			if (d < state.target.r + 8) {
				state.target.r += 15;
				if (state.target.r > 70) {
					createExplosion(state, state.target.x, state.target.y, "#93c5fd");
					playSound("point");
					state.addScore(15); // Blase ist geplatzt
					state.createBubble();
				}
			}
		},
		onPointerUp: () => {},

		// Logik
		update: (state, deltaTime) => {
			state.frames += 1 * deltaTime;
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
			// Wasserfarbverlauf
			let waterGrad = ctx.createLinearGradient(0, 0, 0, 300);
			waterGrad.addColorStop(0, "#bae6fd"); // Hellblau (Oberfläche)
			waterGrad.addColorStop(1, "#0c4a6e"); // Dunkelblau (Tiefe)
			ctx.fillStyle = waterGrad;
			ctx.fillRect(0, 0, 300, 300);
			// Aufsteigende Hintergrundblasen
			ctx.fillStyle = "#ffffff33";
			state.bgBubbles.forEach((b) => {
				ctx.beginPath();
				ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
				ctx.fill();
			});
			// Sandboden
			ctx.fillStyle = "#fde68a";
			ctx.beginPath();
			ctx.ellipse(150, 310, 200, 40, 0, 0, Math.PI * 2);
			ctx.fill();
			// Algen zeichnen
			const algaeColors = ["#15803d", "#166534", "#3f6212"];
			const positions = [50, 90, 160, 210, 260];
			positions.forEach((startX, i) => {
				const col = algaeColors[i % 3];
				const segments = 8;
				const h = 12 + i;
				const points = [];
				// Halme
				ctx.beginPath();
				ctx.strokeStyle = col;
				ctx.lineWidth = 3;
				ctx.lineCap = "round";
				ctx.moveTo(startX, 295);
				for (let j = 1; j <= segments; j++) {
					let sway = Math.sin(state.frames * 0.04 + i + j * 0.2) * (j * 1.5); // Schwingen der Halme
					let nextX = startX + sway;
					let nextY = 295 - j * h;
					ctx.lineTo(nextX, nextY);
					points.push({ x: nextX, y: nextY, s: sway });
				}
				ctx.stroke();
				// Blätter
				ctx.fillStyle = col;
				points.forEach((p, j) => {
					if ((j + 1) % 2 === 0) {
						ctx.save();
						ctx.translate(p.x, p.y);
						ctx.rotate(p.s * 0.05);
						ctx.beginPath();
						ctx.ellipse((j + 1) % 4 === 0 ? 5 : -5, 0, 6, 3, 0.5, 0, Math.PI * 2);
						ctx.fill();
						ctx.restore();
					}
				});
			});
			// Zielrahmen
			ctx.beginPath();
			ctx.arc(state.target.x, state.target.y, 70, 0, Math.PI * 2);
			ctx.strokeStyle = "#2563eb1a";
			ctx.setLineDash([5, 5]);
			ctx.stroke();
			ctx.setLineDash([]);
			// Explosionspartikel
			state.particles.forEach((p) => {
				ctx.save();
				ctx.globalAlpha = p.alpha;
				ctx.fillStyle = p.color;
				ctx.beginPath();
				ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
				ctx.fill();
				ctx.restore();
			});
			// Zielblase
			let fontSize = state.target.r * 1.8;
			ctx.font = `${fontSize}px serif`;
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.shadowColor = "#ffffffcc"; // Weißes Leuchten
			ctx.shadowBlur = 15;
			ctx.fillStyle = "#ffffff";
			ctx.fillText("🫧", state.target.x, state.target.y);
			ctx.shadowBlur = 0;
			// Cursor (Highlight)
			ctx.beginPath();
			ctx.arc(state.lerp.x, state.lerp.y, 27, 0, Math.PI * 2);
			ctx.fillStyle = state.cursorStyle;
			ctx.fill();
			// Pustender Emoji (Spieler)
			ctx.font = "bold 35px serif";
			ctx.fillStyle = "#ffffff";
			ctx.fillText("🌬️", state.lerp.x, state.lerp.y);
		},
	},
};
