// Konfigurationsdatei für die Minispiele
// -----------------------------

const W = 300;
const H = 300;
const S = W / 300; // Skalierungsfaktor zu 300px

export const GameConfig = {
	CANVAS_WIDTH: W,
	CANVAS_HEIGHT: H,
	SCALE: S,
	FPS: 60,

	// Positionen
	CENTER_X: W / 2,
	CENTER_Y: H / 2,
	GROUND_Y: H - 20 * S,
	MARGIN: 15 * S,
	START_BUTTON: { x: W / 2 - 60 * S, y: H - 70 * S, w: 120 * S, h: 40 * S },
	CONTINUE_BUTTON: { x: W / 2 - 50 * S, y: H - 110 * S, w: 100 * S, h: 40 * S },
	HIGHLIGHT_RADIUS: { bubble: 27 * S, fruit: 25 * S, horse: 20 * S, ufo: 25 * S },

	// Schrift
	FONT_UI: "sans-serif",
	font: (size, bold = false, family = "sans-serif") => {
		return `${bold ? "bold " : ""}${size * S}px ${family}`;
	},

	// Emojis
	CHARS: {
		UI: {
			live: { char: ["❤️", "🖤"], size: 20 },
		},
		bubble: {
			player: { char: "🌬️", size: 35 },
			target: { char: "🫧" },
		},
		fruit: {
			player: { char: "🧺", size: 40 },
			target: {
				char: [
					["🍎", "🍐", "🍑", "🍊", "🍒", "🍇", "🍓", "🫐", "🍌", "🥝"], // 0: Obst
					["🥔", "🥕", "🥦", "🧅", "🫑", "🥒", "🫛", "🍆", "🌽", "🥬"], // 1: Gemüse
					["🍔", "🍟", "🍕", "🌭", "🍿", "🍦", "🍰", "🍩", "🍫", "🍭"], // 2: Junkfood
				],
				size: 30,
			},
		},
		horse: {
			player: { char: "🐎", size: 40, flipped: true },
			target: { char: "🚧", size: 40 },
			object: { char: "🕶️", size: 40 },
		},
		ufo: {
			player: { char: "🛸", size: 40 },
			target: { char: "☄️", size: 30 },
		},
	},

	// Farben
	COLORS: {
		UI: {
			overlayStart: "rgba(15, 23, 42, 0.85)",
			overlayWin: ["rgba(20, 50, 20, 0.95)", "rgba(40, 100, 60, 0.9)"],
			overlayLose: ["rgba(30, 20, 50, 0.95)", "rgba(60, 40, 90, 0.9)"],
			border: ["rgba(59, 130, 246, 0.4)", "rgba(255, 255, 255, 0.1)"],
			text: ["rgb(226, 232, 240)", "rgb(251, 191, 36)", "rgb(255, 255, 255)"],
			textKey: ["rgb(20, 20, 20)", "rgb(40, 40, 40)", "rgb(180, 180, 180)", "rgb(255, 255, 255)"],
			textStart: "rgb(59, 130, 246)",
			textWin: "rgb(74, 222, 128)",
			textLose: "rgb(248, 113, 113)",
			buttonStart: ["rgb(34, 197, 94)", "rgba(0, 0, 0, 0.4)"],
			buttonContinue: ["rgb(59, 130, 246)", "rgba(0, 0, 0, 0.3)"],
			cursor: ["rgba(59, 130, 246, 0.2)", "rgba(255, 0, 0, 0.3)"],
		},
		bubble: {
			water: ["rgb(107, 93, 128)", "rgb(2, 106, 82)", "rgb(41, 37, 68)"],
			fog: ["rgba(160, 160, 160, 0.4)", "rgba(160, 160, 160, 0)"],
			ray: ["rgba(195, 181, 253, 0.1)", "rgba(45, 212, 190, 0.1)"],
			bgBubbles: ["rgba(255, 255, 255, 0.4)", "rgb(153, 246, 228)"],
			sand: "rgb(222, 188, 103)",
			algae: ["rgb(24, 149, 70)", "rgb(27, 121, 63)", "rgb(78, 121, 22)"],
			popParticles: "rgb(147, 197, 253)",
			bubbleShadow: "rgba(255, 255, 255, 0.8)",
			bubbleFrame: "rgba(37, 235, 229, 0.4)",
			cross: "rgba(0, 124, 213, 0.48)",
		},
		fruit: {
			table: ["rgb(146, 64, 14)", "rgb(180, 83, 9)"],
			wallpaper: ["rgb(254, 243, 199)", "rgb(250, 232, 176)"],
			squashParticles: [
				[
					"rgb(180, 55, 55)", // 🍎
					"rgb(175, 155, 85)", // 🍐
					"rgb(220, 140, 105)", // 🍑
					"rgb(235, 140, 60)", // 🍊
					"rgb(165, 45, 60)", // 🍒
					"rgb(120, 75, 155)", // 🍇
					"rgb(200, 75, 90)", // 🍓
					"rgb(85, 95, 155)", // 🫐
					"rgb(220, 205, 95)", // 🍌
					"rgb(115, 165, 85)", // 🥝
				],

				[
					"rgb(155, 125, 85)", // 🥔
					"rgb(220, 125, 55)", // 🥕
					"rgb(85, 135, 80)", // 🥦
					"rgb(215, 205, 170)", // 🧅
					"rgb(95, 155, 75)", // 🫑
					"rgb(120, 175, 95)", // 🥒
					"rgb(105, 165, 90)", // 🫛
					"rgb(120, 85, 145)", // 🍆
					"rgb(235, 205, 90)", // 🌽
					"rgb(105, 160, 95)", // 🥬
				],
			],
		},
		horse: {
			sky: "rgb(135, 206, 235)",
			sun: ["rgb(255, 245, 187)", "rgb(255, 238, 136)", "rgb(255, 230, 85)"],
			cloud: "rgb(255, 255, 255)",
			grass: ["rgb(34, 197, 94)", "rgb(22, 101, 52)"],
		},
		ufo: {
			space: "rgb(0, 0, 0)",
			star: [
				"rgb(255, 255, 255)",
				"rgb(255, 255, 255)",
				"rgb(235, 240, 255)",
				"rgb(210, 225, 245)",
				"rgb(190, 210, 235)",
				"rgb(170, 195, 225)",
				"rgb(150, 180, 215)",
				"rgb(235, 225, 170)",
				"rgb(220, 205, 140)",
				"rgb(225, 170, 170)",
			],
			laser: ["rgb(0, 255, 0)", "rgba(255, 255, 255, 0.2)"],
			explosionParticles: "rgb(255, 204, 0)",
		},
	},

	// Physik (base = Basiswert * Anteile r = Zufall, p = Spielfortschritt, d = Schwierigkeitsgrad)
	PHYSICS: {
		bubble: {
			spawnSize: 15 * S,
			burstSize: 65 * S,
			growStrength: 15 * S,
			shrinkRate: { base: 0.2, r: 0.1, p: 0.4, d: 0.5 },
			targetSpeed: { base: 1.4 * S, r: 0.3, p: 0.3, d: 0.4 },
		},
		fruit: {
			spawnRate: { base: 23, r: 0.1, p: 0.4, d: 0.5 },
			targetSpeed: { base: 4.5 * S, r: 0.25, p: 0.35, d: 0.4 },
		},
		horse: {
			groundY: H - 40 * S,
			gravity: 0.4 * S,
			jumpPower: 6.5 * S,
			maxHoldFrames: 15,
			grassSpeed: 5 * S,
			spawnRate: { base: 40, r: 0.2, p: 0.4, d: 0.4 },
			targetSpeed: { base: 10 * S, r: 0.1, p: 0.3, d: 0.6 },
		},
		ufo: {
			maxAmmo: 3,
			laserSpeed: 10 * S,
			reloadTime: 3000,
			starSpeed: 1.5 * S,
			spawnRate: { base: 15, r: 0.2, p: 0.3, d: 0.5 },
			targetSpeed: { base: 8 * S, r: 0.3, p: 0.3, d: 0.4 },
		},
	},

	// Dauer der Schadensphase
	DAMAGE_COOLDOWN: 3000,

	// Punktsystem
	POINTS: {
		bubble: { bubbleBurst: 15, bubbleImplosion: -10 },
		fruit: { vegetableCaught: 10, fruitCaught: 5, junkfoodMissed: 5, freshMissed: -5, junkfoodCaught: -10 },
		horse: { obstacleCleared: 10, obstacleHit: -5 },
		ufo: { asteroidDestroyed: 5, asteroidHit: -10 },
	},

	// Sounds
	SOUNDS: {
		bubble: { blow: "blow", bubbleBurst: "bubble-burst", bubbleImplosion: "bubble-implosion" },
		fruit: {
			vegetableCaught: "vegetable-caught",
			fruitCaught: "fruit-caught",
			junkfoodMissed: "point2",
			freshMissed: "fresh-missed",
			junkfoodCaught: "junkfood-caught",
		},
		horse: {
			obstacleCleared: "point",
			obstacleHit: "obstacle-hit",
			jump: "jump",
			landed: "landed",
		},
		ufo: {
			asteroidDestroyed: "asteroid-destroyed",
			asteroidHit: "asteroid-hit",
			laser: "laser",
			noAmmo: "no-ammo",
		},
	},

	// Anleitungen
	INSTRUCTIONS: {
		bubble: [
			"Puste die Seifenblase auf!",
			"Klicke auf die Blase, um sie zu vergrößern.",
			"Bringe sie zum Platzen, bevor sie schrumpft!",
			"Steuerung: Zielen und Pusten mit ...",
			"🖱️ 👆 [↵] [ ] 📲.",
		],
		fruit: [
			"Fange gesundes Essen!",
			"Sammle Obst (+5P) & Gemüse (+10P).",
			"Weiche Junkfood aus (-10P)!",
			"Steuerung:[W] [A] [S] [D] [▲] [◀] [▼] [▶]",
			" 🖱️ [↵] [ ] 📲.",
		],
		horse: [
			"Reite durch den Parcours!",
			"Weiche den Straßensperren aus.",
			"Steuerung: [ ] [↵] [W] [▲] 🖱️",
			"oder wische auf dem Display nach oben 📲.",
		],
		ufo: [
			"Fliege durch den Weltraum!",
			"Weiche Asteroiden aus oder schieße sie ab.",
			"Steuerung:[W] [A] [S] [D] [▲] [◀] [▼] [▶]",
			" 📲 [↵] 🖱️ ",
			"Schießen: [ ] 🖱️ Touch-Klick.",
		],
	},

	// Motivationstexte
	MOTIVATIONS: {
		win: ["🎉 GEWONNEN! 🎉", "👏 Super gemacht! Gib weiterhin so viel", "Gas wie beim Lernen! 🥳"],
		lose: ["😔 GAME OVER 😔", "Bleib am Ball,", "genau wie beim Lernen! 😉"],
	},
};
