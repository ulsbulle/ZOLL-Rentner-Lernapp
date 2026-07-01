// Hilfs- und Zeichenfunktionen
// -----------------------------

import { GameConfig } from "./game-config.js";

const { CANVAS_WIDTH: W, CANVAS_HEIGHT: H, SCALE: S, font, CHARS, COLORS, MOTIVATIONS } = GameConfig;

// Anzeige eines Emojis zentriert an einer gegebenen Position
// (notwendig aufgrund erratischen Verhaltens von iOS bzgl. textAlign = "centered")
export function drawCharCentered(ctx, x, y, char, font, flipped = false) {
	ctx.save();

	ctx.fillStyle = "#ffffff";
	ctx.textAlign = "left";
	ctx.textBaseline = "middle";
	ctx.font = font;
	const width = ctx.measureText(char).width;

	if (flipped) {
		const xPos = x + width / 2;
		ctx.translate(xPos, y);
		ctx.scale(-1, 1);
		ctx.fillText(char, 0, 0);
	} else {
		const xPos = x - width / 2;
		ctx.fillText(char, xPos, y);
	}

	ctx.restore();
}

// Anzeige der Tastatursymbole
function drawKey(ctx, char, x, y, keyWidth) {
	ctx.save();

	const keyText = char === " " ? "⎵" : char;
	const keyHeight = 15 * S;
	const depth = 2 * S;

	const rectangleX = x;
	const rectangleY = y - keyHeight / 2;
	const textY = char === " " ? y - 1 * S : y;

	// Schatten
	ctx.fillStyle = COLORS.UI.textKey[0];
	ctx.beginPath();
	ctx.roundRect(rectangleX, rectangleY, keyWidth + depth, keyHeight + depth, 1 * S);
	ctx.fill();

	// Hintergrund
	ctx.fillStyle = COLORS.UI.textKey[2];
	ctx.beginPath();
	ctx.roundRect(rectangleX, rectangleY, keyWidth, keyHeight, 1 * S);
	ctx.fill();

	// Rahmen
	ctx.strokeStyle = COLORS.UI.textKey[1];
	ctx.lineWidth = 1 * S;
	ctx.stroke();

	// Text
	ctx.fillStyle = COLORS.UI.textKey[3];
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.font = font(12, true, GameConfig.FONT_UI);
	ctx.fillText(keyText, rectangleX + keyWidth / 2, textY);

	ctx.restore();
}

// Anzeige der Herzen / Leben
export function drawHearts(ctx, engine) {
	ctx.save();

	for (let i = 0; i < engine.maxLives; i++) {
		const x = W - 20 * S - i * 25 * S;
		const y = 20 * S;

		if (i < engine.lives - (engine.recoveringHeart ? 1 : 0)) {
			// Volle Herzen
			ctx.globalAlpha = 1.0;
			drawCharCentered(ctx, x, y, CHARS.UI.live.char[0], font(CHARS.UI.live.size, true));
		} else if (engine.recoveringHeart && i === engine.lives - 1) {
			// Blinkendes Herz
			const blink = Math.floor(Date.now() / 250) % 2;
			ctx.globalAlpha = blink ? 1.0 : 0.2;
			drawCharCentered(ctx, x, y, CHARS.UI.live.char[0], font(CHARS.UI.live.size, true));
		} else {
			// Erloschene Herzen
			ctx.globalAlpha = 0.2;
			drawCharCentered(ctx, x, y, CHARS.UI.live.char[1], font(CHARS.UI.live.size, true));
		}
	}

	ctx.restore();
}

// Anzeige des Spielers / Cursors
export function drawPlayer(ctx, x, y, radius, cursor, char) {
	// Prüfung, ob einzelner Wert oder Positionen differenzierendes Array
	const xHighlight = x[0] ?? x;
	const xPlayer = x[1] ?? x;
	const yHighlight = y[0] ?? y;
	const yPlayer = y[1] ?? y;
	const flipped = char.flipped ?? false;

	ctx.save();

	// Cursor (Highlight)
	ctx.beginPath();
	ctx.arc(xHighlight, yHighlight, radius, 0, Math.PI * 2);
	ctx.fillStyle = cursor;
	ctx.fill();

	// Spieler
	drawCharCentered(ctx, xPlayer, yPlayer, char.char, font(char.size, true), flipped);

	ctx.restore();
}

// Anzeige der Schatten (Pferdeparcours und Früchtefänger)
export function drawShadow(ctx, x, groundY, currentY, startFadeY) {
	if (currentY > startFadeY) {
		const fadeRange = groundY - startFadeY;
		const fadeProgress = Math.min(1, (currentY - startFadeY) / fadeRange);
		const shadowAlpha = fadeProgress * 0.25;
		const shadowWidth = (10 + fadeProgress * 15) * S;
		ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;

		// Ellipsenförmiger Schatten auf Bodenhöhe
		ctx.beginPath();
		ctx.ellipse(x, groundY, shadowWidth, shadowWidth / 3, 0, 0, Math.PI * 2);
		ctx.fill();
	}
}

// Berechnung der Explosionspartikel (Sternenslalom und BubbleBurst)
export function createExplosion(game, x, y, color) {
	game.particles = game.particles ?? [];
	for (let i = 0; i < 12; i++) {
		game.particles.push({
			x: x,
			y: y,
			speedX: (Math.random() - 0.5) * 6 * S,
			speedY: (Math.random() - 0.5) * 6 * S,
			size: (Math.random() * 3 + 1) * S,
			alpha: 1,
			color: color,
		});
	}
}

// Anzeige des Startbildschirms
export function drawStartScreen(ctx, gameType, gameInstance, buttonRectangle) {
	ctx.save();

	// Dunkles Overlay über dem Spielhintergrund
	ctx.fillStyle = COLORS.UI.overlayStart;
	ctx.fillRect(0, 0, W, H);

	// Blauer Rahmen
	ctx.strokeStyle = COLORS.UI.border[0];
	ctx.lineWidth = 3 * S;
	ctx.strokeRect(10 * S, 10 * S, W - 20 * S, H - 20 * S);

	// Titel
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillStyle = COLORS.UI.textStart;
	ctx.font = font(24, true, GameConfig.FONT_UI);
	ctx.fillText(gameInstance.title, W / 2, 45 * S);

	// Trennlinie
	ctx.strokeStyle = COLORS.UI.border[1];
	ctx.lineWidth = 1 * S;
	ctx.beginPath();
	ctx.moveTo(30 * S, 70 * S);
	ctx.lineTo(W - 30 * S, 70 * S);
	ctx.stroke();

	// Kurzanleitung
	gameInstance.instructions.forEach((line, index) => {
		// y-Position der Zeile
		const yPos = (105 + index * 24) * S;

		// Hervorhebung der ersten Zeile
		ctx.fillStyle = COLORS.UI.text[index === 0 ? 1 : 0];
		ctx.font = font(index === 0 ? 14 : 13, index === 0, GameConfig.FONT_UI);

		// Besondere Darstellung der Tasten
		if (line.includes("[")) {
			// Aufteilen anhand "[]"
			const parts = line.split(/(\[.*?\])/);

			// Berechnung der Zeilenbreite
			let lineWidth = 0;
			parts.forEach((part) => {
				if (part.startsWith("[") && part.endsWith("]")) {
					const char = part.slice(1, -1);
					const keyWidth = char === " " ? 45 * S : 15 * S;
					lineWidth += keyWidth + 4 * S;
				} else {
					lineWidth += ctx.measureText(part).width;
				}
			});

			// x-Position des Zeichens
			let xPos = W / 2 - lineWidth / 2;
			ctx.textAlign = "left";

			// Zeichnen der Tasten
			parts.forEach((part) => {
				if (part.startsWith("[") && part.endsWith("]")) {
					const char = part.slice(1, -1);
					const keyWidth = char === " " ? 45 * S : 15 * S;
					xPos += 2 * S;
					drawKey(ctx, char, xPos, yPos, keyWidth);
					xPos += keyWidth + 2 * S;
				} else {
					ctx.fillText(part, xPos, yPos);
					xPos += ctx.measureText(part).width;
				}
			});
		} else {
			// Normale Textzeilen
			ctx.textAlign = "center";
			ctx.fillText(line, W / 2, yPos);
		}
	});

	// Start-Button
	ctx.shadowBlur = 6;
	ctx.shadowOffsetY = 2;
	ctx.shadowColor = COLORS.UI.buttonStart[1];
	ctx.fillStyle = COLORS.UI.buttonStart[0];
	ctx.beginPath();
	ctx.roundRect(buttonRectangle.x, buttonRectangle.y, buttonRectangle.w, buttonRectangle.h, 12 * S);
	ctx.fill();
	ctx.fillStyle = COLORS.UI.text[2];
	ctx.textAlign = "center";
	ctx.font = font(16, true, GameConfig.FONT_UI);
	ctx.fillText("START", buttonRectangle.x + buttonRectangle.w / 2, buttonRectangle.y + buttonRectangle.h / 2);

	ctx.restore();
}

// Anzeige des Endbildschirms
export function drawEndScreen(ctx, result, score, maxScore, buttonRectangle) {
	ctx.save();

	// Overlay mit Farbverlauf
	const gradient = ctx.createLinearGradient(0, 0, 0, H);
	switch (result) {
		case "win":
			gradient.addColorStop(0, COLORS.UI.overlayWin[0]);
			gradient.addColorStop(1, COLORS.UI.overlayWin[1]);
			break;
		case "lose":
			gradient.addColorStop(0, COLORS.UI.overlayLose[0]);
			gradient.addColorStop(1, COLORS.UI.overlayLose[1]);
			break;
	}
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, W, H);

	// Weißer Rahmen
	ctx.strokeStyle = COLORS.UI.border[1];
	ctx.lineWidth = 4 * S;
	ctx.strokeRect(10 * S, 10 * S, W - 20 * S, H - 20 * S);

	// Überschrift
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.font = font(28, true, GameConfig.FONT_UI);
	ctx.shadowBlur = 10;
	switch (result) {
		case "win":
			ctx.fillStyle = COLORS.UI.textWin;
			ctx.fillText(MOTIVATIONS.win[0], W / 2, 70 * S);
			break;
		case "lose":
			ctx.fillStyle = COLORS.UI.textLose;
			ctx.fillText(MOTIVATIONS.lose[0], W / 2, 70 * S);
			break;
	}

	// Punktzahl
	ctx.font = font(22, true, GameConfig.FONT_UI);
	ctx.fillStyle = COLORS.UI.text[1];
	ctx.fillText(`${Math.max(0, Math.min(Math.floor(score), maxScore))} / ${maxScore} Punkte`, W / 2, 110 * S);

	// Motivationstext
	ctx.font = font(14, false, GameConfig.FONT_UI);
	ctx.fillStyle = COLORS.UI.text[0];
	switch (result) {
		case "win":
			ctx.fillText(MOTIVATIONS.win[1], W / 2, 145 * S);
			ctx.fillText(MOTIVATIONS.win[2], W / 2, 165 * S);
			break;
		case "lose":
			ctx.fillText(MOTIVATIONS.lose[1], W / 2, 145 * S);
			ctx.fillText(MOTIVATIONS.lose[2], W / 2, 165 * S);
			break;
	}

	// Weiter-Button
	ctx.shadowBlur = 5;
	ctx.shadowOffsetY = 3;
	ctx.shadowColor = COLORS.UI.buttonContinue[1];
	ctx.fillStyle = COLORS.UI.buttonContinue[0];
	ctx.beginPath();
	ctx.roundRect(buttonRectangle.x, buttonRectangle.y, buttonRectangle.w, buttonRectangle.h, 12 * S);
	ctx.fill();
	ctx.font = font(16, true, GameConfig.FONT_UI);
	ctx.fillStyle = COLORS.UI.text[2];
	ctx.fillText("Weiter", buttonRectangle.x + buttonRectangle.w / 2, buttonRectangle.y + buttonRectangle.h / 2);

	ctx.restore();
}
