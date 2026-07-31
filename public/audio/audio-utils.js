// Hilfsfunktionen zur Kompilation der Musikdaten
// -----------------------------------------------
// - Überführung der Notennamen in MIDI-Werte, Berechnung der Frequenzen und Konvertierung in Phaseninkremente pro Sample
// - Umrechnung der musikalischen Zeitangaben in absolute Start- und Samplepositionen
// - Berechnung der effektiven, normalisierten Lautstärke und Abbildung des Stereo-Panoramas auf zwei Kanäle
// - Umrechnung globaler Effekt-Konfigurationen in DSP-optimierte Werte
// - Chronologische Sortierung aller Ereignisse
// - Überführung in eine maschinennahe Sructure of Arrays

import { PI, PI2 } from "./sound-bank.js";

// Sound-Tabelle (Mapping von Soundnamen auf Indizes)
// 0-8 Melodieinstrumente, 9-26 Perkussionsinstrumente, 27-45 Soundeffekte
export const SOUND_MAP = {
	sine: 0,
	square: 1,
	saw: 2,
	chiffer: 3,
	poly: 4,
	strings: 5,
	brass: 6,
	harp: 7,
	fantasia: 8,
	bass: 9,
	snare: 10,
	"tom-high": 11,
	"tom-low": 12,
	"hihat-closed": 13,
	"hihat-open": 14,
	ride: 15,
	crash: 16,
	"surdo-open": 17,
	"surdo-muted": 18,
	"timbau-bass": 19,
	"timbau-open": 20,
	"timbau-slap": 21,
	caixa: 22,
	"caixa-rim": 23,
	pandeiro: 24,
	"agogo-high": 25,
	"agogo-low": 26,
	correct: 27,
	wrong: 28,
	point: 29,
	point2: 30,
	blow: 31,
	"bubble-burst": 32,
	"bubble-implosion": 33,
	caught: 34,
	"vegetable-caught": 35,
	"fruit-caught": 36,
	"fresh-missed": 37,
	"junkfood-caught": 38,
	jump: 39,
	landed: 40,
	"obstacle-hit": 41,
	laser: 42,
	"no-ammo": 43,
	"asteroid-destroyed": 44,
	"asteroid-hit": 45,
};

// Halbtonwerte der Stammtöne zur Frequenzberechnung
const NOTE_BASE_VALUES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// Konvertierung von Notennamen in Frequenzen
export function noteToFrequency(note, tuning) {
	if (!note) return 0;

	// Regulärer Ausdruck zur Extrahierung der Notennamenbestandteile
	// (A-G) = Stammton
	// (#+|b+)? = Versetzungszeichen (auch mehrfach möglich)
	// (-?\d+) = Oktave (optionales Minuszeichen für Sub-Subkontraoktaven)
	const match = note.match(/^([A-G])(#+|b+)?(-?\d+)$/);
	if (!match) return 0;

	const letter = match[1];
	const accidentals = match[2] || "";
	const octave = parseInt(match[3], 10);

	// MIDI-Tonhöhe berechnen
	// Ermittlung des Halbtonwertes des Stammtons
	let midiNote = NOTE_BASE_VALUES[letter] + (octave + 1) * 12;
	// Addition / Subtraktion von Halbtönen mittels Stringlänge der Versetzungszeichen (z.B. "b" = -1, "##" = +2)
	if (accidentals.startsWith("#")) midiNote += accidentals.length;
	else if (accidentals.startsWith("b")) midiNote -= accidentals.length;

	// Frequenzberechnung relativ zu Referenzton (A4 = 69)
	return tuning * Math.pow(2, (midiNote - 69) / 12);
}

// Musikdaten in ein DSP-optimiertes Structure of Arrays (SoA) kompilieren
export function compileMusicData(songData, sampleRate = 48000) {
	// Globale Parameter auslesen
	const bpm = songData.bpm ?? 120;
	const timeSig = songData.timeSig ?? "4/4";
	const beatsPerBar = parseInt(timeSig.split("/")[0], 10) ?? 4;
	const secondsPerBeat = 60 / bpm;
	const tuning = songData.tuning ?? 440;
	const level = songData.level ?? 1.0;
	const notes = [];
	let minSample = Infinity; // garantiert spätere min-max-Ersetzung
	let maxSample = -Infinity;

	// Noten sammeln, verarbeiten und sortieren
	for (const key in songData) {
		// Überspringen von globalen Parametern
		if (["timeSig", "bpm", "tuning", "level", "effects"].includes(key)) continue;

		// Überspringen von Tracks ohne Noten
		const track = songData[key];
		if (!track || !Array.isArray(track.notes)) continue;

		// Track-Parameter auslesen
		const trackType = track.type ?? "pitched";
		const trackPan = track.pan ?? 0.0;
		const trackGain = Math.pow(10, (track.gain ?? 0.0) / 20); // Umrechnung von Dezibel in linearen Gain-Faktor (10^(dB / 20))
		const cleanSoundName = key.split("_")[0]; // Spezifikatoren entfernen ("saw_2" --> "saw")
		const trackSoundId = SOUND_MAP[cleanSoundName] ?? 0;

		// Panoramaumrechnung unter Gesamtlautstärkeerhalt
		// Position [-1, +1] wird auf Viertelkreis [0, π/2] abgebildet
		// cos und sin berechnen die Kanalverstärkungen mit konstanter Gesamtleistung (cos^2 + sin^2 = 1)
		const panAngle = (trackPan + 1) * (PI / 4);
		const panL = Math.cos(panAngle);
		const panR = Math.sin(panAngle);

		// Notenereignisse des Tracks verarbeiten
		for (const note of track.notes) {
			// Abbildung der Einteilung nach Takten auf eine globale Zeitachse
			const startBeat = (note.bar - 1) * beatsPerBar + (note.beat - 1);
			const endBeat = startBeat + note.duration;

			// Umrechnung in Sample-Positionen
			const startSample = Math.round(startBeat * secondsPerBeat * sampleRate);
			let endSample = Math.round(endBeat * secondsPerBeat * sampleRate);
			minSample = Math.min(minSample, startSample);
			maxSample = Math.max(maxSample, endSample);
			// Perkussionsinstrumente und Soundeffekte werden durch ihre Hüllkurve terminiert
			if (trackType === "unpitched") {
				endSample = 2147483647; // Quasi Infinity (MaxInt32)
			}

			// Lautstärke berechnen
			// Quadratische Skalierung, um das logarithmische Lautstärkeempfinden des menschlichen Gehörs auszugleichen
			const velocity = Math.pow((note.volume ?? 100) / 127, 2);
			const volume = velocity * trackGain * level;

			// Instrumenten-ID bestimmen
			let currentSoundId = trackSoundId;
			if (trackType === "unpitched" && note.sound) {
				currentSoundId = SOUND_MAP[note.sound] ?? 0;
			}

			// Frequenz und Phaseninkrement (Phasenänderung pro Sample) berechnen
			// eine Periode (2π) * Frequenz = Phasenänderung pro Sekunde
			// Phasenänderung pro Sekunde / Abtastrate = Phaseninkrement pro Sample
			let phaseIncrement = 0;
			if (trackType === "pitched" && note.note) {
				const frequency = noteToFrequency(note.note, tuning);
				phaseIncrement = (PI2 * frequency) / sampleRate;
			}

			notes.push({
				startSample,
				endSample,
				phaseIncrement,
				volume,
				panL,
				panR,
				soundId: currentSoundId,
			});
		}
	}

	// Auftaktkorrektur (Kompensierung negativer Sample-Werte)
	const offset = minSample < 0 ? Math.abs(minSample) : 0;

	// Chronologische Sortierung nach Start-Sample
	notes.sort((a, b) => a.startSample - b.startSample || a.endSample - b.endSample);

	// Structure of Arrays mit exakter Größe allozieren
	const audioData = {
		startSample: new Int32Array(notes.length),
		endSample: new Int32Array(notes.length),
		phaseIncrement: new Float32Array(notes.length),
		volume: new Float32Array(notes.length),
		panL: new Float32Array(notes.length),
		panR: new Float32Array(notes.length),
		soundId: new Uint8Array(notes.length),
		loopLength: maxSample + offset,
		effects: {
			reverbDelay: 0,
			reverbLevel: 0,
			tremoloIncrement: 0,
			tremoloDepth: 0,
			lowPassAlpha: 0,
			lowPassRuns: 0,
		},
	};

	// Daten in typisierte Arrays übertragen
	for (let i = 0; i < notes.length; i++) {
		audioData.startSample[i] = notes[i].startSample + offset;
		audioData.endSample[i] = notes[i].endSample + offset;
		audioData.phaseIncrement[i] = notes[i].phaseIncrement;
		audioData.volume[i] = notes[i].volume;
		audioData.panL[i] = notes[i].panL;
		audioData.panR[i] = notes[i].panR;
		audioData.soundId[i] = notes[i].soundId;
	}

	// Globale Effekte auslesen
	const effects = songData.effects ?? {};
	const reverb = effects.reverb ?? { delay: 0, level: 0 };
	const tremolo = effects.tremoloPan ?? { rate: 0, depth: 0 };
	const lowPass = effects.lowPass ?? { cutoff: 0, rolloff: 0 };

	// Halleffekt (Sampleanzahl für Puffer berechnen)
	if (Object.values(reverb).some(Boolean)) {
		const reverbBufferLength = sampleRate * 2; // 2 Sekunden Puffer
		const reverbLatency = reverb.delay;
		audioData.effects.reverbLevel = reverb.level;
		// Delay von Sekunden in Samples umrechnen, begrenzt auf die Puffergröße
		audioData.effects.reverbDelay = Math.min(reverbBufferLength - 1, Math.floor(reverbLatency * sampleRate));
	}

	// Tremolo-Pan (Phasenvorschub mittels Niedrigfrequenzoszillator berechnen)
	if (Object.values(tremolo).some(Boolean)) {
		const tremoloRate = tremolo.rate;
		// Hz in Winkelgeschwindigkeit umrechnen
		audioData.effects.tremoloIncrement = (PI2 * tremoloRate) / sampleRate;
		audioData.effects.tremoloDepth = tremolo.depth;
	}

	// Tiefpassfilter (Alpha-Wert für Grenzfrequenz berechnen)
	if (Object.values(lowPass).some(Boolean)) {
		const cutoff = lowPass.cutoff;
		const rolloff = lowPass.rolloff;
		// Umrechnung der Grenzfrequenz in einen Alpha-Multiplikator (einpoliger digitaler Tiefpass)
		// Alpha = Geschwindigkeit der Annäherung des Filterzustands an das Eingangssignal
		audioData.effects.lowPassAlpha = (PI2 * cutoff) / (PI2 * cutoff + sampleRate);
		// Anzahl der Filterdurchläufe berechnen (1 Filterdurchlauf entspricht einer Steilheit von 6dB)
		audioData.effects.lowPassRuns = Math.min(4, Math.max(0, Math.round(rolloff / 6)));
	}

	return audioData;
}
