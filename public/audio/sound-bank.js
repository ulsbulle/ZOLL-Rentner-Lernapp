// Soundbank mit Oszillatorfunktionen
// ------------------------------

// Globale Hilfsfunktionen und Konstanten
const musicVolume = 0.8;
const soundVolume = 1.0;
const bubbleBurstAdjustement = 2.5;
export const PI = Math.PI;
export const PI2 = Math.PI * 2;
const normalizePhase = (p) => {
	const phase = p % PI2;
	return phase < 0.0 ? phase + PI2 : phase;
};

// Grundwellen
const sawWave = (p) => normalizePhase(p) / PI - 1.0;
const squareWave = (p) => (normalizePhase(p) < PI ? 1.0 : -1.0);
const triangleWave = (p) => 1.0 - 2.0 * Math.abs(normalizePhase(p) / PI - 1.0);

// Zusammengesetzte Wellen
const polyWave = (p) => 0.6 * triangleWave(p) + 0.2 * Math.sin(p) + 0.2 * sawWave(p);
const stringsWave = (p) => 0.5 * sawWave(p) + 0.3 * triangleWave(p) + 0.2 * Math.sin(p);
const voiceWave = (p) => 0.7 * (Math.sin(p) + 0.3 * Math.sin(p * 2.0)) + 0.2 * triangleWave(p);
const rideWave = (p) => Math.sin(p + Math.sin(p * 1.5) * 1.5);
const crashWave = (p) => Math.sin(p + Math.sin(p * 1.6) * 2.0);
const agogoWave = (p, time) => Math.sin(p + Math.sin(p * 1.8) * 0.4 * Math.exp(-time * 6.5));

// Soundbank
export const soundBank = new Array(46);

// ============================================================================
// Melodieinstrumente
// ============================================================================

soundBank[0] = function sine(phase, time) {
	const mix = Math.sin(phase);

	// Lautstärkenormalisierung
	const level = 1.0;
	const output = mix * level * musicVolume;

	return output;
};

soundBank[1] = function square(phase, time) {
	const mix = squareWave(phase);

	// Lautstärkenormalisierung
	const level = 0.4;
	const output = mix * level * musicVolume;

	return output;
};

soundBank[2] = function saw(phase, time) {
	const mix = sawWave(phase);

	// Sättigung und Lautstärkenormalisierung
	const saturation = 1.5;
	const level = 0.5;
	const output = Math.tanh(mix * saturation) * level * musicVolume;

	return output;
};

soundBank[3] = function chiffer(phase, time) {
	// Rauschen
	const noiseEnvelope = Math.exp(-time * 40.0) * 0.1 + 0.03;
	const noise = (Math.random() * 2.0 - 1.0) * noiseEnvelope;

	// Attack-Tonhöhensenkung
	const dropEnvelope = Math.exp(-time * 40.0);
	const drop = (Math.sin(phase * 6.8) * 1.1 + Math.sin(phase * 8.0) * 1.1) * dropEnvelope;

	// Phase
	const phaseA = phase + drop;

	// Oszillator
	const oscillator =
		Math.sin(phaseA * 0.5) * 0.5 + Math.sin(phaseA) + Math.sin(phaseA * 2.0) * 0.4 + Math.sin(phaseA * 3.0) * 0.2;

	// Mix
	const mix = oscillator + noise;

	// Sättigung und Lautstärkenormalisierung
	const saturation = 1.0;
	const level = 0.8;
	const output = Math.tanh(mix * saturation) * level * musicVolume;

	// Hüllkurve
	const attackTime = 0.02;
	const sustainTime = 0.2;
	const sustainLevel = 0.6;
	let envelope;

	if (time < attackTime) {
		// Attack: Linearer Anstieg auf 100%
		envelope = time / attackTime;
	} else if (time < attackTime + sustainTime) {
		// Sustain: Steiler Abfall vom Attack auf 60%
		const fastDecayTime = time - attackTime;
		envelope = sustainLevel + (1.0 - sustainLevel) * Math.exp(-fastDecayTime * 40.0);
	} else {
		// Decay: Langsamer Abfall vom Sustain auf 0%
		const slowDecayTime = time - (attackTime + sustainTime);
		envelope = sustainLevel * Math.exp(-slowDecayTime * 2.0);
	}

	return output * envelope;
};

soundBank[4] = function poly(phase, time) {
	// Attack-Tonhöhensenkung
	const dropEnvelope = Math.exp(-time * 4.0);
	const drop = dropEnvelope * 0.4;

	// Zeitabhängige Verstimmung
	const detuneIncrease = 1.0 - Math.exp(-time * 0.5);
	const detune = 0.01 + detuneIncrease * 0.015;

	// Phasen und Modulation
	const modulationB = Math.sin(time * 2.2) * 0.004;
	const modulationC = Math.cos(time * 1.6) * 0.005;
	const modulationD = Math.sin(time * 2.8) * 0.003;
	const modulationE = Math.cos(time * 1.1) * 0.006;
	const phaseA = phase * (1.0 + drop);
	const phaseB = phase * (1.0 + detune + modulationB) * (1.0 + drop * 0.8);
	const phaseC = phase * (1.0 - detune + modulationC) * (1.0 + drop * 1.2);
	const phaseD = phase * (1.0 + detune * 2.0 - modulationD) * (1.0 + drop * 0.6);
	const phaseE = phase * (1.0 - detune * 2.0 + modulationE) * (1.0 + drop * 1.5);

	// Oszillator und Mix
	const mix =
		polyWave(phaseA) * 0.4 +
		polyWave(phaseB) * 0.3 +
		polyWave(phaseC) * 0.3 +
		polyWave(phaseD) * 0.15 +
		polyWave(phaseE) * 0.15;

	// Sättigung und Lautstärkenormalisierung
	const saturation = 1.2;
	const level = 0.8;
	const output = Math.tanh(mix * saturation) * level * musicVolume;

	// Hüllkurve
	const attackTime = 0.2;
	const sustainLevel = 0.85;
	let envelope;

	if (time < attackTime) {
		// Attack: Anstieg als S-Kurve auf 100%
		envelope = Math.pow(time / attackTime, 2) * (3.0 - 2.0 * (time / attackTime));
	} else {
		// Sustain: Leichter Abfall auf 85%
		const decayTime = time - attackTime;
		envelope = sustainLevel + (1.0 - sustainLevel) * Math.exp(-decayTime * 0.2);
	}

	return output * envelope;
};

soundBank[5] = function strings(phase, time) {
	// Zeitabhängige Verstimmung
	const detuneIncrease = 1.0 - Math.exp(-time * 0.5);
	const detune = 0.008 + detuneIncrease * 0.015;

	// Phasen und Modulation
	const modulationB = Math.sin(time * 1.2) * 0.003;
	const modulationC = Math.cos(time * 0.8) * 0.004;
	const modulationD = Math.sin(time * 1.5) * 0.002;
	const modulationE = Math.cos(time * 0.6) * 0.006;
	const phaseA = phase;
	const phaseB = phase * (1.0 + detune + modulationB);
	const phaseC = phase * (1.0 - detune + modulationC);
	const phaseD = phase * (1.0 + detune * 2.0 - modulationD);
	const phaseE = phase * (1.0 - detune * 2.0 + modulationE);

	// Oszillator und Mix
	const mix =
		stringsWave(phaseA) * 0.4 +
		stringsWave(phaseB) * 0.3 +
		stringsWave(phaseC) * 0.3 +
		stringsWave(phaseD) * 0.15 +
		stringsWave(phaseE) * 0.15;

	// Sättigung und Lautstärkenormalisierung
	const saturation = 1.2;
	const level = 0.5;
	const output = Math.tanh(mix * saturation) * level * musicVolume;

	// Hüllkurve
	const attackTime = 0.05;
	const sustainLevel = 0.8;
	let envelope;

	if (time < attackTime) {
		// Attack: Quadratischer Anstieg auf 100%
		envelope = Math.pow(time / attackTime, 2);
	} else {
		// Sustain: Leichter Abfall auf 80%
		const decayTime = time - attackTime;
		envelope = sustainLevel + (1.0 - sustainLevel) * Math.exp(-decayTime * 0.2);
	}

	return output * envelope;
};

soundBank[6] = function brass(phase, time) {
	// Attack-Tonhöhensenkung
	const dropEnvelope = Math.exp(-time * 20.0);
	const drop = dropEnvelope * 0.15;

	// Phasen und Modulation
	const modulationA = Math.sin(time * 5.0) * 0.002;
	const modulationFmEnvelope = Math.exp(-time * 8.0);
	const modulationFm = 1.5 + 2.5 * modulationFmEnvelope;
	const phaseA = phase * (1.0 + drop + modulationA);
	const phaseFm = phaseA + Math.sin(phaseA) * modulationFm;

	// Oszillator und Mix
	const mix = Math.sin(phaseFm) + Math.sin(phaseA * 0.5) * 0.5;

	// Sättigung und Lautstärkenormalisierung
	const saturation = 0.8;
	const level = 0.8;
	const output = Math.tanh(mix * saturation) * level * musicVolume;

	// Hüllkurve
	const attackTime = 0.05;
	const sustainLevel = 0.85;
	let envelope;

	if (time < attackTime) {
		// Attack: Linearer Anstieg auf 100%
		envelope = time / attackTime;
	} else {
		// Sustain: Leichter Abfall auf 85%
		const decayTime = time - attackTime;
		envelope = sustainLevel + (1.0 - sustainLevel) * Math.exp(-decayTime * 4.0);
	}

	return output * envelope;
};

soundBank[7] = function harp(phase, time) {
	// Attack-Inharmonizität
	const attackEnvelope = Math.exp(-time * 25.0);
	const attack = (Math.sin(phase * 5.6) * 0.4 + Math.sin(phase * 8.2) * 0.2) * attackEnvelope;

	// Oszillator
	const oscillator = Math.sin(phase) * 0.8 + triangleWave(phase) * 0.2;

	// Mix
	const mix = oscillator + attack;

	// Sättigung und Lautstärkenormalisierung
	const saturation = 1.2;
	const level = 1.0;
	const output = Math.tanh(mix * saturation) * level * musicVolume;

	// Hüllkurve
	const attackTime = 0.02;
	let envelope;
	if (time < attackTime) {
		// Attack: Sinusförmiger Anstieg auf 100%
		envelope = Math.sin((time / attackTime) * (PI / 2.0));
	} else {
		// Decay: Schneller Abfall auf 0%
		const decayTime = time - attackTime;
		envelope = Math.exp(-decayTime * 2.0);
	}

	return output * envelope;
};

soundBank[8] = function fantasia(phase, time) {
	// --- Chorklang ---
	// Rauschen
	const voiceNoise = Math.random() * 2.0 - 1.0;

	// Zeitabhängige Verstimmung
	const voiceDetuneIncrease = 1.0 - Math.exp(-time * 0.5);
	const voiceDetune = 0.006 + voiceDetuneIncrease * 0.012;

	// Phasen und Modulation
	const voiceModulationA = Math.sin(time * 1.5) * 0.005;
	const voiceModulationB = Math.cos(time * 1.1) * 0.005;
	const voicePhaseA = phase * (1.0 + voiceDetune + voiceModulationA);
	const voicePhaseB = phase * (1.0 - voiceDetune + voiceModulationB);

	// Oszillator
	const voiceOscillator = voiceWave(voicePhaseA) * 0.5 + voiceWave(voicePhaseB) * 0.5;

	// Mix
	const voiceMix = voiceOscillator * 0.5 + voiceNoise * 0.05;

	// Sättigung und Lautstärkenormalisierung
	const voiceSaturation = 1.2;
	const voiceLevel = 0.85;
	const voiceOutput = Math.tanh(voiceMix * voiceSaturation) * voiceLevel;

	// Hüllkurve
	const voiceAttackTime = 0.3;
	const voiceSustainLevel = 0.8;
	let voiceEnvelope;

	if (time < voiceAttackTime) {
		// Attack: Anstieg als S-Kurve auf 100%
		voiceEnvelope = Math.pow(time / voiceAttackTime, 2) * (3.0 - 2.0 * (time / voiceAttackTime));
	} else {
		// Sustain: Langsamer Abfall auf 85%
		const voiceDecayTime = time - voiceAttackTime;
		voiceEnvelope = voiceSustainLevel + (1.0 - voiceSustainLevel) * Math.exp(-voiceDecayTime * 0.3);
	}
	const voiceSignal = voiceOutput * voiceEnvelope;

	// --- Glockenklang ---
	// Attack-Inharmonizität
	const bellAttackEnvelope = Math.exp(-time * 30.0);
	const bellAttack = (Math.sin(phase * 7.0) + Math.sin(phase * 12.0) * 0.5) * bellAttackEnvelope;

	// Oszillator
	const bellOscillator =
		0.25 * Math.sin(phase * 0.5) * Math.exp(-time * 0.5) +
		0.6 * Math.sin(phase * 1.0) * Math.exp(-time * 0.8) +
		0.25 * Math.sin(phase * 1.2) * Math.exp(-time * 1.2) +
		0.2 * Math.sin(phase * 1.5) * Math.exp(-time * 1.5) +
		0.25 * Math.sin(phase * 2.0) * Math.exp(-time * 2.5) +
		0.15 * Math.sin(phase * 2.4) * Math.exp(-time * 3.0) +
		0.1 * Math.sin(phase * 3.0) * Math.exp(-time * 4.0) +
		0.08 * Math.sin(phase * 4.5) * Math.exp(-time * 6.0) +
		0.05 * Math.sin(phase * 7.5) * Math.exp(-time * 12.0);

	// Mix
	const bellMix = bellOscillator + bellAttack * 0.15;

	// Sättigung und Lautstärkenormalisierung
	const bellSaturation = 0.9;
	const bellLevel = 1.0;
	const bellOutput = Math.tanh(bellMix * bellSaturation) * bellLevel;

	// Hüllkurve
	const bellAttackTime = 0.005;
	let bellEnvelope;

	if (time < bellAttackTime) {
		// Attack: Linearer Anstieg auf 100%
		bellEnvelope = time / bellAttackTime;
	} else {
		// Decay: Langsamer Abfall vom Sustain auf 0%
		const bellDecayTime = time - bellAttackTime;
		bellEnvelope = Math.exp(-bellDecayTime * 0.5);
	}
	const bellSignal = bellOutput * bellEnvelope;

	// --- Gesamtmix ---
	const mix = voiceSignal * 0.5 + bellSignal * 0.8;

	// Lautstärkenormalisierung
	const level = 0.9;

	return mix * level * musicVolume;
};

// ============================================================================
// Perkussionsinstrumente: Sternenslalom
// ============================================================================

soundBank[9] = function bass(time) {
	const frequency = 24.5; // G0

	// Rauschen
	const noiseEnvelope = Math.exp(-time * 80.0);
	const noise = (Math.random() * 2.0 - 1.0) * noiseEnvelope * 0.25;

	// Attack-Tonhöhensenkung
	const drop = Math.exp(-time * 20.0) * 0.3;

	// Phase und Modulation
	const phase = time * frequency * (1.0 + drop) * PI2;
	const modulationA = Math.sin(phase * 2.0) * 0.8 * Math.exp(-time * 10.0);
	const modulationB = Math.sin(phase * 4.0) * 0.8 * Math.exp(-time * 10.0);

	// Oszillator
	const oscillator = Math.sin(phase + modulationA) * 0.8 + Math.sin(phase * 2.0 + modulationB) * 0.2;

	// Mix
	const mix = oscillator * 0.6 + noise * 0.4;

	// Sättigung und Lautstärkenormalisierung
	const saturation = 2.0;
	const level = 3.0;
	const output = Math.tanh(mix * saturation) * level * musicVolume;

	// Hüllkurve
	const attack = 1.0 - Math.exp(-time * 400.0);
	const decay = Math.exp(-time * 3.0);
	const envelope = attack * decay;

	return output * envelope;
};

soundBank[10] = function snare(time) {
	const frequencyA = 196.0; // G3
	const frequencyB = 293.66; // D4

	// Rauschen
	const rawNoise = Math.random() * 2.0 - 1.0;
	const noiseEnvelope = Math.exp(-time * 15.0);
	const noise = Math.pow(rawNoise, 3) * noiseEnvelope;

	// Attack-Tonhöhensenkung
	const drop = Math.exp(-time * 25.0) * 0.2;

	// Phasen
	const phaseA = time * frequencyA * (1.0 + drop) * PI2;
	const phaseB = time * frequencyB * (1.0 + drop) * PI2;

	// Oszillator
	const oscillator = (Math.sin(phaseA) * 0.7 + Math.sin(phaseB) * 0.3) * Math.exp(-time * 18.0);

	// Mix
	const mix = oscillator * 0.4 + noise * 0.6;

	// Sättigung und Lautstärkenormalisierung
	const saturation = 4.0;
	const level = 0.9;
	const output = Math.tanh(mix * saturation) * level * musicVolume;

	// Hüllkurve
	const envelope = 1.0 - Math.exp(-time * 500.0);

	return output * envelope;
};

soundBank[11] = function tomHigh(time) {
	const frequency = 146.83; // D3

	// Rauschen
	const noiseEnvelope = Math.exp(-time * 90.0);
	const noise = (Math.random() * 2.0 - 1.0) * noiseEnvelope * 0.4;

	// Attack-Tonhöhensenkung
	const drop = Math.exp(-time * 20.0) * 0.1;

	// Phase und Modulation
	const phase = time * frequency * (1.0 + drop) * PI2;
	const modulation = Math.sin(phase * 1.4) * 0.2 * Math.exp(-time * 6.0);

	// Oszillator
	const oscillator = Math.sin(phase + modulation);

	// Mix
	const mix = oscillator * 0.7 + noise * 0.3;

	// Sättigung und Lautstärkenormalisierung
	const saturation = 1.5;
	const level = 0.9;
	const output = Math.tanh(mix * saturation) * level * musicVolume;

	// Hüllkurve
	const attack = 1.0 - Math.exp(-time * 300.0);
	const decay = Math.exp(-time * 3.5);
	const envelope = attack * decay;

	return output * envelope;
};

soundBank[12] = function tomLow(time) {
	const frequency = 98.0; // G2

	// Rauschen
	const noiseEnvelope = Math.exp(-time * 70.0);
	const noise = (Math.random() * 2.0 - 1.0) * noiseEnvelope * 0.5;

	// Attack-Tonhöhensenkung
	const drop = Math.exp(-time * 15.0) * 0.05;

	// Phase und Modulation
	const phase = time * frequency * (1.0 + drop) * PI2;
	const modulation = Math.sin(phase * 1.4) * 0.2 * Math.exp(-time * 6.0);

	// Oszillator
	const oscillator = Math.sin(phase + modulation);

	// Mix
	const mix = oscillator * 0.7 + noise * 0.3;

	// Sättigung und Lautstärkenormalisierung
	const saturation = 1.6;
	const level = 0.95;
	const output = Math.tanh(mix * saturation) * level * musicVolume;

	// Hüllkurve
	const attack = 1.0 - Math.exp(-time * 250.0);
	const decay = Math.exp(-time * 2.5);
	const envelope = attack * decay;

	return output * envelope;
};

soundBank[13] = function hihatClosed(time) {
	const frequency = 2349.32; // D7

	// Rauschen
	const rawNoise = Math.random() * 2.0 - 1.0;
	const noise = Math.pow(rawNoise, 3);

	// Phase
	const phase = time * frequency * PI2;

	// Oszillator
	const oscillator = Math.sin(phase + Math.sin(phase * 1.41) * 2.0 + Math.sin(phase * 2.13) * 1.5);

	// Mix
	const mix = oscillator * 0.2 + noise * 0.8;

	// Sättigung und Lautstärkenormalisierung
	const saturation = 1.3;
	const level = 0.6;
	const output = Math.tanh(mix * saturation) * level * musicVolume;

	// Hüllkurve
	const attack = 1.0 - Math.exp(-time * 500.0);
	const decay = Math.exp(-time * 12.0);
	const envelope = attack * decay;

	return output * envelope;
};

soundBank[14] = function hihatOpen(time) {
	const frequency = 2349.32; // D7

	// Rauschen
	const noise = Math.random() * 2.0 - 1.0;

	// Phase
	const phase = time * frequency * PI2;

	// Oszillator
	const oscillator = Math.sin(phase + Math.sin(phase * 1.33) * 2.5 + Math.sin(phase * 2.45) * 1.8);

	// Mix
	const mix = oscillator * 0.3 + noise * 0.7;

	// Sättigung und Lautstärkenormalisierung
	const saturation = 1.5;
	const level = 0.55;
	const output = Math.tanh(mix * saturation) * level * musicVolume;

	// Hüllkurve
	const attack = 1.0 - Math.exp(-time * 500.0);
	const sustain = Math.exp(-time * 6.0);
	const stop = time < 0.2 ? 1.0 : Math.exp(-(time - 0.2) * 35.0);
	const envelope = attack * sustain * stop;

	return output * envelope;
};

soundBank[15] = function ride(time) {
	const frequency = 3135.96; // G7

	// Rauschen
	const rawNoise = Math.random() * 2.0 - 1.0;
	const noise = Math.pow(rawNoise, 3) * 4.0;

	// Phasen
	const phase = time * frequency * PI2;

	// Oszillator
	const oscillator = rideWave(phase) + rideWave(phase * 1.41) + rideWave(phase * 2.05) + rideWave(phase * 2.75);

	// Mix
	const mix = oscillator * 0.6 + noise * 0.4;

	// Sättigung und Lautstärkenormalisierung
	const saturation = 0.4;
	const level = 0.7;
	const output = Math.tanh(mix * saturation) * level * musicVolume;

	// Hüllkurve
	const attack = 1.0 - Math.exp(-time * 200.0);
	const decay = Math.exp(-time * 2.0);
	const envelope = attack * decay;

	return output * envelope;
};

soundBank[16] = function crash(time) {
	const frequency = 1567.98; // G6

	// Rauschen
	const noiseEnvelope = Math.exp(-time * 1.5);
	const noise = (Math.random() * 2.0 - 1.0) * noiseEnvelope * 4.0;

	// Phasen
	const phase = time * frequency * PI2;

	// Oszillator
	const oscillatorEnvelope = Math.exp(-time * 1.2);
	const oscillator =
		(crashWave(phase) +
			crashWave(phase * 1.41) +
			crashWave(phase * 2.05) +
			crashWave(phase * 2.75) +
			crashWave(phase * 3.4) +
			crashWave(phase * 4.2)) *
		oscillatorEnvelope;

	// Mix
	const mix = oscillator * 0.55 + noise * 0.45;

	// Sättigung und Lautstärkenormalisierung
	const saturation = 0.4;
	const level = 0.55;
	const output = Math.tanh(mix * saturation) * level * musicVolume;

	// Hüllkurve
	const envelope = 1.0 - Math.exp(-time * 1000.0);

	return output * envelope;
};

// ============================================================================
// Perkussionsinstrumente: Pferdeparcours
// ============================================================================

soundBank[17] = function surdoOpen(time) {
	const frequency = 65.41; // C2

	// Rauschen
	const noiseEnvelope = Math.exp(-time * 80.0);
	const noise = (Math.random() * 2.0 - 1.0) * noiseEnvelope * 0.05;

	// Phase und Modulation
	const phase = time * frequency * PI2;
	const modulation = Math.sin(phase * 2.0) * 0.6 * Math.exp(-time * 5.0);

	// Oszillator
	const oscillator = Math.sin(phase + modulation);

	// Mix
	const mix = oscillator + noise;

	// Sättigung und Lautstärkenormalisierung
	const saturation = 1.5;
	const level = 1.0;
	const output = Math.tanh(mix * saturation) * level * musicVolume;

	// Hüllkurve
	const attack = 1.0 - Math.exp(-time * 200.0);
	const decay = Math.exp(-time * 1.2);
	const envelope = attack * decay;

	return output * envelope;
};

soundBank[18] = function surdoMuted(time) {
	const frequency = 130.81; // C3

	// Rauschen
	const noiseEnvelope = Math.exp(-time * 50.0);
	const noise = (Math.random() * 2.0 - 1.0) * noiseEnvelope;

	// Phase und Modulation
	const phase = time * frequency * PI2;
	const modulation = Math.sin(phase * 2.5) * 1.5 * Math.exp(-time * 15.0);

	// Oszillator
	const oscillatorEnvelope = Math.exp(-time * 15.0);
	const oscillator = Math.sin(phase + modulation) * oscillatorEnvelope;

	// Mix
	const mix = oscillator * 0.55 + noise * 0.45;

	// Sättigung und Lautstärkenormalisierung
	const saturation = 2.0;
	const level = 1.0;
	const output = Math.tanh(mix * saturation) * level * musicVolume;

	// Hüllkurve
	const attack = 1.0 - Math.exp(-time * 300.0);
	const decay = Math.exp(-time * 8.0);
	const envelope = attack * decay;

	return output * envelope;
};

soundBank[19] = function timbauBass(time) {
	const frequency = 98.0; // G2

	// Rauschen
	const noiseEnvelope = Math.exp(-time * 25.0);
	const noise = (Math.random() * 2.0 - 1.0) * noiseEnvelope;

	// Attack-Tonhöhensenkung
	const drop = Math.exp(-time * 25.0) * 0.2;

	// Phase und Modulation
	const phase = time * frequency * (1.0 + drop) * PI2;
	const modulation = Math.sin(phase * 1.5) * 0.5 * Math.exp(-time * 8.0);

	// Oszillator
	const oscillator = Math.sin(phase + modulation);

	// Mix
	const mix = oscillator * 0.75 + noise * 0.25;

	// Sättigung und Lautstärkenormalisierung
	const saturation = 1.6;
	const level = 0.9;
	const output = Math.tanh(mix * saturation) * level * musicVolume;

	// Hüllkurve
	const envelope = Math.exp(-time * 2.0);

	return output * envelope;
};

soundBank[20] = function timbauOpen(time) {
	const frequency = 164.81; // E3

	// Rauschen
	const noiseEnvelope = Math.exp(-time * 30.0);
	const noise = (Math.random() * 2.0 - 1.0) * noiseEnvelope;

	// Phase und Modulation
	const phase = time * frequency * PI2;
	const modulation = Math.sin(phase * 2.0) * 0.8 * Math.exp(-time * 7.0);

	// Oszillator
	const oscillator = Math.sin(phase + modulation);

	// Mix
	const mix = oscillator * 0.8 + noise * 0.2;

	// Sättigung und Lautstärkenormalisierung
	const saturation = 1.2;
	const level = 0.85;
	const output = Math.tanh(mix * saturation) * level * musicVolume;

	// Hüllkurve
	const attack = 1.0 - Math.exp(-time * 300.0);
	const decay = Math.exp(-time * 3.5);
	const envelope = attack * decay;

	return output * envelope;
};

soundBank[21] = function timbauSlap(time) {
	const frequency = 261.63; // C4

	// Rauschen
	const noiseEnvelope = Math.exp(-time * 60.0);
	const noise = (Math.random() * 2.0 - 1.0) * noiseEnvelope;

	// Phase und Modulation
	const phase = time * frequency * PI2;
	const modulation = Math.sin(phase * 1.6) * 1.5 * Math.exp(-time * 10.0);

	// Oszillator
	const oscillatorEnvelope = Math.exp(-time * 6.0);
	const oscillator = Math.sin(phase + modulation) * oscillatorEnvelope;

	// Mix
	const mix = oscillator * 0.6 + noise * 1.3;

	// Sättigung und Lautstärkenormalisierung
	const saturation = 1.8;
	const level = 0.85;
	const output = Math.tanh(mix * saturation) * level * musicVolume;

	return output;
};

soundBank[22] = function caixa(time) {
	const frequency = 196.0; // G3

	// Rauschen
	const noiseEnvelope = time < 0.005 ? time / 0.005 : Math.exp(-(time - 0.005) * 8.0);
	const noise = (Math.random() * 2.0 - 1.0) * noiseEnvelope;

	// Phase
	const phase = time * frequency * PI2;

	// Oszillator
	const oscillatorEnvelope = Math.exp(-time * 18.0);
	const oscillator = Math.sin(phase) * oscillatorEnvelope;

	// Mix
	const mix = oscillator * 0.7 + noise * 0.3;

	// Sättigung und Lautstärkenormalisierung
	const saturation = 1.8;
	const level = 0.85;
	const output = Math.tanh(mix * saturation) * level * musicVolume;

	return output;
};

soundBank[23] = function caixaRim(time) {
	const frequency = 261.63; // C4

	// Rauschen
	const clickEnvelope = Math.exp(-time * 100.0);
	const click = (Math.random() * 2.0 - 1.0) * clickEnvelope;
	const noiseEnvelope = Math.exp(-time * 15.0);
	const noise = (Math.random() * 2.0 - 1.0) * noiseEnvelope;

	// Phase und Modulation
	const phase = time * frequency * PI2;
	const modulation = Math.sin(phase * 2.4) * 2.0 * Math.exp(-time * 20.0);

	// Oszillator
	const oscillatorEnvelope = Math.exp(-time * 12.0);
	const oscillator = Math.sin(phase + modulation) * oscillatorEnvelope;

	// Mix
	const mix = click + oscillator * 0.3 + noise * 0.7;

	// Sättigung und Lautstärkenormalisierung
	const saturation = 2.0;
	const level = 0.9;
	const output = Math.tanh(mix * saturation) * level * musicVolume;

	return output;
};

soundBank[24] = function pandeiro(time) {
	const frequencyDrum = 196.0; // G3
	const frequencyJingle = 3951.07; // B7

	// Rauschen
	const noiseEnvelope = Math.exp(-time * 9.0);
	const noise = (Math.random() * 2.0 - 1.0) * noiseEnvelope;

	// Phasen
	const phaseDrum = time * frequencyDrum * PI2;
	const phaseJingle = time * frequencyJingle * PI2;
	const modulation = Math.sin(phaseDrum * 2.0) * 0.4 * Math.exp(-time * 15.0);

	// Oszillatoren
	const drumEnvelope = Math.exp(-time * 12.0);
	const drum = Math.sin(phaseDrum + modulation) * drumEnvelope;
	const jingleEnvelope = Math.exp(-time * 10.0);
	const jingle = Math.sin(phaseJingle + Math.sin(phaseJingle * 1.41) * 2.0) * jingleEnvelope;

	// Mix
	const mix = drum * 0.6 + jingle * 0.5 + noise * 0.6;

	// Sättigung und Lautstärkenormalisierung
	const saturation = 1.5;
	const level = 0.85;
	const output = Math.tanh(mix * saturation) * level * musicVolume;

	// Hüllkurve
	const envelope = 1.0 - Math.exp(-time * 300.0);

	return output * envelope;
};

soundBank[25] = function agogoHigh(time) {
	const frequency = 1567.98; // G6

	// Rauschen
	const noiseEnvelope = Math.exp(-time * 60.0);
	const noise = (Math.random() * 2.0 - 1.0) * noiseEnvelope * 0.12;

	// Phase
	const phase = time * frequency * PI2;

	// Oszillator
	const oscillatorEnvelope = Math.exp(-time * 5.5);
	const oscillator =
		(agogoWave(phase, time) * 0.25 +
			agogoWave(phase * 2.13, time) * 0.35 +
			agogoWave(phase * 3.91, time) * 0.3 +
			agogoWave(phase * 5.37, time) * 0.22 +
			agogoWave(phase * 6.89, time) * 0.18) *
		oscillatorEnvelope;

	// Mix
	const mix = oscillator + noise;

	// Sättigung und Lautstärkenormalisierung
	const saturation = 1.6;
	const level = 0.95;
	const output = Math.tanh(mix * saturation) * level * musicVolume;

	// Hüllkurve
	const attack = 1.0 - Math.exp(-time * 500.0);
	const decay = Math.exp(-time * 2.8);
	const envelope = attack * decay;

	return output * envelope;
};

soundBank[26] = function agogoLow(time) {
	const frequency = 1174.66; // D6

	// Rauschen
	const noiseEnvelope = Math.exp(-time * 55.0);
	const noise = (Math.random() * 2.0 - 1.0) * noiseEnvelope * 0.15;

	// Phase
	const phase = time * frequency * PI2;

	// Oszillator
	const oscillatorEnvelope = Math.exp(-time * 4.8);
	const oscillator =
		(agogoWave(phase, time) * 0.28 +
			agogoWave(phase * 2.1, time) * 0.38 +
			agogoWave(phase * 3.62, time) * 0.32 +
			agogoWave(phase * 4.97, time) * 0.26 +
			agogoWave(phase * 6.45, time) * 0.2 +
			agogoWave(phase * 8.2, time) * 0.14) *
		oscillatorEnvelope;

	// Mix
	const mix = oscillator + noise;

	// Sättigung und Lautstärkenormalisierung
	const saturation = 1.55;
	const level = 1.0;
	const output = Math.tanh(mix * saturation) * level * musicVolume;

	// Hüllkurve
	const attack = 1.0 - Math.exp(-time * 450.0);
	const decay = Math.exp(-time * 2.2);
	const envelope = attack * decay;

	return output * envelope;
};

// ============================================================================
// Sounds: Quiz / Punkte
// ============================================================================

soundBank[27] = function correct(time) {
	const frequencyA = 523.25; // C5
	const frequencyB = 783.99; // G5

	// Phasen
	const phaseA = time * frequencyA * PI2;
	const phaseB = time * frequencyB * PI2;

	// Oszillator
	const oscillatorEnvelopeA = time < 0.1 ? 1.0 : Math.exp(-(time - 0.1) * 50.0);
	const oscillatorEnvelopeB = time < 0.1 ? 0.0 : Math.exp(-(time - 0.1) * 10.0);
	const oscillatorA = Math.sin(phaseA) * 0.7 + triangleWave(phaseA) * 0.3;
	const oscillatorB = Math.sin(phaseB) * 0.7 + triangleWave(phaseB) * 0.3;

	// Mix
	const mix = oscillatorA * oscillatorEnvelopeA + oscillatorB * oscillatorEnvelopeB;

	// Sättigung und Lautstärkenormalisierung
	const saturation = 1.2;
	const level = 0.7;
	const output = Math.tanh(mix * saturation) * level * soundVolume;

	return output;
};

soundBank[28] = function wrong(time) {
	const frequency = 98.0; // G2

	// Phase und Modulation
	const phase = time * frequency * PI2;
	const modulation = Math.sin(phase * PI) * 2.5;

	// Oszillator und Mix
	const mix = Math.sin(phase + modulation);

	// Sättigung und Lautstärkenormalisierung
	const saturation = 4.0;
	const level = 0.7;
	const output = Math.tanh(mix * saturation) * level * soundVolume;

	// Hüllkurve
	const envelope = time < 0.2 ? 1.0 : Math.exp(-(time - 0.2) * 30.0);

	return output * envelope;
};

soundBank[29] = function point(time) {
	if (time < 0) return 0;

	const frequencyA = 1174.66; // D6
	const frequencyB = 1568.0; // G6

	// Phasen
	const phaseA = time * frequencyA * PI2;
	const phaseB = time * frequencyB * PI2;

	// Oszillator
	const oscillatorEnvelopeA = time < 0.06 ? 1.0 : Math.exp(-(time - 0.06) * 50.0);
	const oscillatorEnvelopeB = time < 0.06 ? 0.0 : Math.exp(-(time - 0.06) * 4.0);

	// Mix
	const mix = Math.sin(phaseA) * oscillatorEnvelopeA + Math.sin(phaseB) * oscillatorEnvelopeB;

	// Sättigung und Lautstärkenormalisierung
	const saturation = 1.2;
	const level = 0.7;
	const output = Math.tanh(mix * saturation) * level * soundVolume;

	return output;
};

soundBank[30] = function point2(time) {
	if (time < 0) return 0;

	const frequency = 1568.0; // G6

	// Phase
	const phase = time * frequency * PI2;

	// Oszillator und Mix
	const mix = Math.sin(phase);

	// Sättigung und Lautstärkenormalisierung
	const saturation = 1.2;
	const level = 0.7;
	const output = Math.tanh(mix * saturation) * level * soundVolume;

	// Hüllkurve
	const attack = 1.0 - Math.exp(-time * 600.0);
	const decay = Math.exp(-time * 4.0);
	const envelope = attack * decay;

	return output * envelope;
};

// ============================================================================
// Sounds: BubbleBurst
// ============================================================================

soundBank[31] = function blow(time) {
	// Rauschen
	const mix = Math.random() * 2.0 - 1.0;

	// Sättigung und Lautstärkenormalisierung
	const saturation = 2.0;
	const level = 0.4;
	const output = Math.tanh(mix * saturation * bubbleBurstAdjustement) * level * soundVolume;

	// Hüllkurve
	const envelope = time < 0.15 ? time / 0.15 : Math.exp(-(time - 0.15) * 3.5);

	return output * envelope * bubbleBurstAdjustement;
};

soundBank[32] = function bubbleBurst(time) {
	const frequency = 698.46; // F5

	// Rauschen
	const noiseEnvelope = Math.exp(-time * 48.0);
	const noise = (Math.random() * 2.0 - 1.0) * noiseEnvelope;

	// Attack-Tonhöhensenkung
	const drop = Math.exp(-time * 50.0) * 2.0;

	// Phase
	const phase = time * frequency * (1.0 + drop) * PI2;

	// Oszillator
	const oscillatorEnvelope = Math.exp(-time * 40.0);
	const oscillator = Math.sin(phase) * oscillatorEnvelope;

	// Mix
	const mix = oscillator * 0.3 + noise * 0.7 * bubbleBurstAdjustement;

	// Sättigung und Lautstärkenormalisierung
	const saturation = 1.5;
	const level = 0.9;
	const output = Math.tanh(mix * saturation * bubbleBurstAdjustement) * level * soundVolume;

	// Hüllkurve
	const envelope = 1.0 - Math.exp(-time * 450.0);

	return (output * envelope + soundBank[29](time - 0.2)) * bubbleBurstAdjustement;
};

soundBank[33] = function bubbleImplosion(time) {
	const frequency = 349.23; // F4

	// Rauschen
	const noiseEnvelope = Math.exp(-time * 130.0);
	const noise = (Math.random() * 2.0 - 1.0) * noiseEnvelope * 0.45;

	// Phase
	const phase = time * frequency * PI2;

	// Oszillator
	const oscillator = Math.sin(phase);

	// Mix
	const mix = oscillator * 0.65 + noise * bubbleBurstAdjustement;

	// Sättigung und Lautstärkenormalisierung
	const saturation = 1.5;
	const level = 0.8;
	const output = Math.tanh(mix * saturation * bubbleBurstAdjustement) * level * soundVolume;

	// Hüllkurve
	const attack = 1.0 - Math.exp(-time * 500.0);
	const decay = Math.exp(-time * 22.0);
	const envelope = attack * decay;

	return output * envelope * bubbleBurstAdjustement;
};

// ============================================================================
// Sounds: Früchtefänger
// ============================================================================

soundBank[34] = function caught(time) {
	const frequency = 293.66; // D4

	// Rauschen
	const noiseEnvelope = Math.exp(-time * 30.0);
	const noise = (Math.random() * 2.0 - 1.0) * noiseEnvelope * 0.4;

	// Attack-Tonhöhensenkung
	const drop = Math.exp(-time * 40.0) * 2.5;

	// Phase
	const phase = time * frequency * (1.0 + drop) * PI2;

	// Oszillator
	const oscillator = Math.sin(phase);

	// Mix
	const mix = oscillator + noise;

	// Sättigung und Lautstärkenormalisierung
	const saturation = 1.4;
	const level = 0.5;
	const output = Math.tanh(mix * saturation) * level * soundVolume;

	// Hüllkurve
	const envelope = Math.exp(-time * 20.0);

	return output * envelope;
};

soundBank[35] = function vegetableCaught(time) {
	return soundBank[34](time) + soundBank[29](time);
};

soundBank[36] = function fruitCaught(time) {
	return soundBank[34](time) + soundBank[30](time);
};

soundBank[37] = function freshMissed(time) {
	const frequency = 784.0; // G5

	// Rauschen
	const noiseEnvelope = Math.exp(-time * 40.0);
	const noise = (Math.random() * 2.0 - 1.0) * noiseEnvelope * 0.7;

	// Phase und Modulation
	const modulation = Math.sin(time * 200.0) * 300.0;
	const phase = time * (frequency + modulation) * PI2;

	// Oszillator
	const oscillatorEnvelope = Math.exp(-time * 20.0);
	const oscillator = Math.sin(phase) * oscillatorEnvelope;

	// Mix
	const mix = oscillator + noise;

	// Sättigung und Lautstärkenormalisierung
	const saturation = 2.5;
	const level = 0.5;
	const output = Math.tanh(mix * saturation) * level * soundVolume;

	// Hüllkurve
	const envelope = Math.exp(-time * 14.0);

	return output * envelope;
};

soundBank[38] = function junkfoodCaught(time) {
	const frequencyA = 73.42; // D2
	const frequencyB = 146.83; // D3

	// Rauschen
	const noiseEnvelope = Math.exp(-time * 15.0);
	const noise = (Math.random() * 2.0 - 1.0) * noiseEnvelope;

	// Phasen
	const phaseA = time * frequencyA * PI2;
	const phaseB = time * frequencyB * PI2;

	// Oszillator
	const oscillator = squareWave(phaseA) * 0.6 + Math.sin(phaseB) * 0.4;

	// Mix
	const mix = oscillator * 0.6 + noise * 0.4;

	// Sättigung und Lautstärkenormalisierung
	const saturation = 3.0;
	const level = 0.85;
	const output = Math.tanh(mix * saturation) * level * soundVolume;

	// Hüllkurve
	const attack = 1.0 - Math.exp(-time * 500.0);
	const decay = Math.exp(-time * 6.0);
	const envelope = attack * decay;

	return output * envelope;
};

// ============================================================================
// Sounds: Pferdeparcours
// ============================================================================

soundBank[39] = function jump(time) {
	const frequency = 130.81; // C3

	// Rauschen
	const noiseEnvelope = Math.exp(-time * 18.0);
	const noise = (Math.random() * 2.0 - 1.0) * noiseEnvelope * 0.45;

	// Phase und Modulation
	const modulation = time * 1200.0;
	const phase = time * (frequency + modulation) * PI2;

	// Oszillator
	const oscillator = Math.sin(phase);

	// Mix
	const mix = oscillator * 0.8 + noise;

	// Sättigung und Lautstärkenormalisierung
	const saturation = 1.0;
	const level = 0.9;
	const output = Math.tanh(mix * saturation) * level * soundVolume;

	// Hüllkurve
	const attack = 1.0 - Math.exp(-time * 400.0);
	const decay = Math.exp(-time * 10.0);
	const envelope = attack * decay;

	return output * envelope;
};

soundBank[40] = function landed(time) {
	const localTime = time > 0.1 ? time - 0.1 : time;
	const frequency = 196.0; // G3

	// Rauschen
	const noiseEnvelope = Math.exp(-localTime * 120.0);
	const noise = (Math.random() * 2.0 - 1.0) * noiseEnvelope * 0.5;

	// Attack-Tonhöhensenkung
	const drop = Math.exp(-localTime * 80.0) * 4.0;

	// Phase
	const phase = localTime * frequency * (1.0 + drop) * PI2;

	// Oszillator
	const oscillatorEnvelope = Math.exp(-localTime * 50.0);
	const oscillator = (Math.sin(phase) * 0.7 + squareWave(phase * 1.5) * 0.15) * oscillatorEnvelope;

	// Mix
	const mix = oscillator + noise;

	// Sättigung und Lautstärkenormalisierung
	const saturation = 1.8;
	const level = 0.6;
	const output = Math.tanh(mix * saturation) * level * soundVolume;

	// Hüllkurve
	const attack = 1.0 - Math.exp(-localTime * 600.0);
	const decay = Math.exp(-localTime * 35.0);
	const envelope = attack * decay;

	return output * envelope;
};

soundBank[41] = function obstacleHit(time) {
	const frequencyA = 65.41; // C2
	const frequencyB = 130.81; // C3

	// Rauschen
	const noiseEnvelope = Math.exp(-time * 20.0);
	const noise = (Math.random() * 2.0 - 1.0) * noiseEnvelope;

	// Attack-Tonhöhensenkung
	const drop = Math.exp(-time * 15.0) * 0.5;

	// Phasen
	const phaseA = time * frequencyA * (1.0 + drop) * PI2;
	const phaseB = time * frequencyB * (1.0 + drop) * PI2;

	// Oszillator
	const oscillator = Math.sin(phaseA) * 0.8 + squareWave(phaseB) * 0.2;

	// Mix
	const mix = oscillator * 0.6 + noise * 0.8;

	// Sättigung und Lautstärkenormalisierung
	const saturation = 2.5;
	const level = 0.8;
	const output = Math.tanh(mix * saturation) * level * soundVolume;

	// Hüllkurve
	const envelope = Math.exp(-time * 6.0);

	return output * envelope;
};

// ============================================================================
// Sternenslalom
// ============================================================================

soundBank[42] = function laser(time) {
	const frequency = 784.0; // G5

	// Attack-Tonhöhensenkung
	const drop = Math.exp(-time * 15.0) * 3.5;

	// Phase
	const phase = time * frequency * (1.0 + drop) * PI2;

	// Oszillator und Mix
	const mix = squareWave(phase);

	// Sättigung und Lautstärkenormalisierung
	const saturation = 1.5;
	const level = 0.5;
	const output = Math.tanh(mix * saturation) * level * soundVolume;

	// Hüllkurve
	const envelope = Math.exp(-time * 9.0);

	return output * envelope;
};

soundBank[43] = function noAmmo(time) {
	const frequency = 587.33; // D5

	// Phase
	const phase = time * frequency * PI2;

	// Oszillator und Mix
	const mix = squareWave(phase);

	// Sättigung und Lautstärkenormalisierung
	const saturation = 2.0;
	const level = 0.5;
	const output = Math.tanh(mix * saturation) * level * soundVolume;

	// Hüllkurve
	const envelopeA = Math.exp(-time * 100.0);
	const envelopeB = time > 0.05 ? Math.exp(-(time - 0.05) * 100.0) : 0;
	const envelope = envelopeA + envelopeB;

	return output * envelope;
};

soundBank[44] = function asteroidDestroyed(time) {
	const frequencyA = 49.0; // G1
	const frequencyB = 98.0; // G2

	// Rauschen
	const noiseEnvelope = Math.exp(-time * 3.0);
	const noise = (Math.random() * 2.0 - 1.0) * noiseEnvelope;

	// Phasen
	const phaseA = time * frequencyA * PI2;
	const phaseB = time * frequencyB * PI2;

	// Oszillator
	const oscillatorEnvelopeB = Math.exp(-time * 4.0);
	const oscillator = squareWave(phaseA) * 0.6 + squareWave(phaseB) * 0.4 * oscillatorEnvelopeB;

	// Mix
	const mix = oscillator * 0.5 + noise * 1.5;

	// Sättigung und Lautstärkenormalisierung
	const saturation = 3.5;
	const level = 0.7;
	const output = Math.tanh(mix * saturation) * level * soundVolume;

	// Hüllkurve
	const envelope = Math.exp(-time * 3.5);

	return output * envelope + soundBank[29](time - 0.35);
};

soundBank[45] = function asteroidHit(time) {
	const localTime = time > 0.07 ? time - 0.07 : time;
	const frequency = 73.42; // D2

	// Rauschen
	const noiseEnvelope = Math.exp(-time * 2.0);
	const noise = (Math.random() * 2.0 - 1.0) * noiseEnvelope;

	// Phase
	const phase = localTime * frequency * PI2;

	// Oszillator
	const oscillator = squareWave(phase);

	// Mix
	const mix = oscillator * 0.4 + noise * 0.6;

	// Sättigung und Lautstärkenormalisierung
	const saturation = 2.2;
	const level = 0.8;
	const output = Math.tanh(mix * saturation) * level * soundVolume;

	// Hüllkurve
	const decay = time < 0.07 ? Math.exp(-time * 28.0) : Math.exp(-localTime * 6.0);
	const attack = 1.0 - Math.exp(-localTime * 400.0);
	const envelope = attack * decay;

	return output * envelope;
};
