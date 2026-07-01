// DSP-Playback via AudioWorklet
// ------------------------------

import { soundBank, PI2 } from "./sound-bank.js";

// Konfigurationskonstanten
const AUDIO_CONFIG = {
	MAX_VOICES: 32,
	ATTACK_TIME: 0.005,
	RELEASE_TIME: 0.1,
	PRE_GAIN: 0.5,
};

// Zustände der Hüllkurve
const STAGE = {
	INACTIVE: 0,
	ATTACK: 1,
	SUSTAIN: 2,
	RELEASE: 3,
};

// Audioprozessor
class AudioProcessor extends AudioWorkletProcessor {
	constructor() {
		super();
		// Zustand & Aufnahme
		this.isPlaying = false;
		this.isRecording = false;
		this.loop = true;
		this.currentNote = 0;
		this.globalSampleCounter = 0;
		this.sampleRate = 48000;
		this.attackIncrement = 1 / (this.sampleRate * AUDIO_CONFIG.ATTACK_TIME);
		this.releaseDecrement = 1 / (this.sampleRate * AUDIO_CONFIG.RELEASE_TIME);
		this.masterVolume = 1;
		this.audioData = null;
		this.recordedL = [];
		this.recordedR = [];

		// Reverb
		this.hasReverb = false;
		this.reverbLevel = 0;
		this.reverbDelay = 0;
		this.reverbBufferLength = 0;
		this.reverbBufferIndex = 0;
		this.reverbBufferL = null;
		this.reverbBufferR = null;

		// Tremolo-Pan-Effekt
		this.hasTremolo = false;
		this.tremoloIncrement = 0;
		this.tremoloDepth = 0;
		this.tremoloPhase = 0;

		// Low-Pass-Filter
		this.hasLowPass = false;
		this.lowPassAlpha = 1.0;
		this.lowPassRuns = 0;
		this.lowPassStateL = new Float32Array(4);
		this.lowPassStateR = new Float32Array(4);

		// Initialisiert den Stimmenpool als Structure of Arrays
		this.voices = {
			active: new Uint8Array(AUDIO_CONFIG.MAX_VOICES),
			phase: new Float32Array(AUDIO_CONFIG.MAX_VOICES),
			envelope: new Float32Array(AUDIO_CONFIG.MAX_VOICES),
			stage: new Uint8Array(AUDIO_CONFIG.MAX_VOICES),
			phaseIncrement: new Float32Array(AUDIO_CONFIG.MAX_VOICES),
			targetVolume: new Float32Array(AUDIO_CONFIG.MAX_VOICES),
			panL: new Float32Array(AUDIO_CONFIG.MAX_VOICES),
			panR: new Float32Array(AUDIO_CONFIG.MAX_VOICES),
			startSample: new Int32Array(AUDIO_CONFIG.MAX_VOICES),
			endSample: new Int32Array(AUDIO_CONFIG.MAX_VOICES),
			soundId: new Uint8Array(AUDIO_CONFIG.MAX_VOICES),
			oscillator: new Array(AUDIO_CONFIG.MAX_VOICES),
		};

		// Event-Handling (Kommunikation mit Main-Thread)
		this.port.onmessage = (event) => {
			if (event.data.type === "PLAY_MUSIC") {
				this.audioData = event.data.audioData;
				this.sampleRate = event.data.sampleRate;
				this.loop = Boolean(event.data.loop);
				this.isRecording = Boolean(event.data.record);
				this.recordedL = [];
				this.recordedR = [];

				// Berechnen der Inkremente für Attack und Release
				this.attackIncrement = 1 / (this.sampleRate * AUDIO_CONFIG.ATTACK_TIME);
				this.releaseDecrement = 1 / (this.sampleRate * AUDIO_CONFIG.RELEASE_TIME);

				// Effekte initialisieren
				const effects = this.audioData.effects;

				// Reverb
				this.hasReverb = !!(effects.reverbLevel && effects.reverbDelay);
				if (this.hasReverb) {
					this.reverbLevel = effects.reverbLevel;
					this.reverbDelay = effects.reverbDelay;

					// Puffer allokieren, wenn fehlt oder sich die SampleRate geändert hat, sonst löschen
					const requiredBufferLength = this.sampleRate * 2;
					if (!this.reverbBufferL || this.reverbBufferLength !== requiredBufferLength) {
						this.reverbBufferLength = requiredBufferLength;
						this.reverbBufferL = new Float32Array(this.reverbBufferLength);
						this.reverbBufferR = new Float32Array(this.reverbBufferLength);
					} else {
						this.reverbBufferL.fill(0);
						this.reverbBufferR.fill(0);
					}
					this.reverbBufferIndex = 0;
				}

				// Tremolo-Pan
				this.hasTremolo = !!effects.tremoloDepth;
				if (this.hasTremolo) {
					this.tremoloIncrement = effects.tremoloIncrement;
					this.tremoloDepth = effects.tremoloDepth;
					this.tremoloPhase = 0;
				}

				// Low-Pass
				this.hasLowPass = !!effects.lowPassRuns;
				if (this.hasLowPass) {
					this.lowPassAlpha = effects.lowPassAlpha;
					this.lowPassRuns = effects.lowPassRuns;
					this.lowPassStateL.fill(0);
					this.lowPassStateR.fill(0);
				}

				this.resetPlayback();
				this.isPlaying = true;
			} else if (event.data.type === "PLAY_SOUND_EFFECT") {
				this.triggerSoundEffect(event.data.soundId);
			} else if (event.data.type === "STOP") {
				if (this.isPlaying && this.isRecording) {
					this.port.postMessage({ type: "RECORDING_FINISHED", left: this.recordedL, right: this.recordedR });
				}
				this.isPlaying = false;
				this.resetPlayback();
				this.resetFilter();
			} else if (event.data.type === "VOLUME") {
				this.masterVolume = event.data.volume;
			}
		};
	}

	// Setzt den Stimmenpool zurück
	resetPlayback() {
		this.currentNote = 0;
		this.globalSampleCounter = 0;
		this.voices.active.fill(0);
		this.voices.stage.fill(STAGE.INACTIVE);
		this.voices.oscillator.fill(null);
	}

	// Setzt die globalen Filter-/Effektparameter zurück
	resetFilter() {
		// Reverb zurücksetzen
		this.hasReverb = false;
		this.reverbLevel = 0;
		this.reverbDelay = 0;
		if (this.reverbBufferL) {
			this.reverbBufferL.fill(0);
			this.reverbBufferR.fill(0);
		}

		// Tremolo-Pan zurücksetzen
		this.hasTremolo = false;
		this.tremoloIncrement = 0;
		this.tremoloDepth = 0;
		this.tremoloPhase = 0;

		// Low-Pass zurücksetzen
		this.hasLowPass = false;
		this.lowPassAlpha = 1.0;
		this.lowPassRuns = 0;
		this.lowPassStateL.fill(0);
		this.lowPassStateR.fill(0);
	}

	// Sucht eine freie Stimme im Pool
	findFreeVoice(targetSoundId = null) {
		const voiceState = this.voices;
		const isPercussion = targetSoundId >= 9;

		// Nur für Percussion: Suche eine aktive Stimme mit derselben Sound-ID
		if (isPercussion) {
			for (let voice = 0; voice < AUDIO_CONFIG.MAX_VOICES; voice++) {
				if (voiceState.active[voice] === 1 && voiceState.soundId[voice] === targetSoundId) return voice;
			}
		}

		// Suche inaktive Stimme
		for (let voice = 0; voice < AUDIO_CONFIG.MAX_VOICES; voice++) {
			if (voiceState.active[voice] === 0) return voice;
		}

		// Fallback 1: Suche Stimme im Release-Zustand
		for (let voice = 0; voice < AUDIO_CONFIG.MAX_VOICES; voice++) {
			if (voiceState.stage[voice] === STAGE.RELEASE) return voice;
		}

		// Fallback 2: Suche die älteste Stimme
		let oldestVoice = 0;
		let oldestStartSample = voiceState.startSample[0];
		for (let voice = 1; voice < AUDIO_CONFIG.MAX_VOICES; voice++) {
			if (voiceState.startSample[voice] < oldestStartSample) {
				oldestStartSample = voiceState.startSample[voice];
				oldestVoice = voice;
			}
		}
		return oldestVoice;
	}

	// Aktiviert einen Ton im Stimmenpool
	activateVoice(currentNote, currentSample) {
		const voice = this.findFreeVoice(this.audioData.soundId[currentNote]);
		const voiceState = this.voices;

		voiceState.active[voice] = 1;
		voiceState.phase[voice] = Math.random() * PI2;
		voiceState.envelope[voice] = 0;
		voiceState.stage[voice] = STAGE.ATTACK;
		voiceState.phaseIncrement[voice] = this.audioData.phaseIncrement[currentNote];
		voiceState.targetVolume[voice] = this.audioData.volume[currentNote];
		voiceState.panL[voice] = this.audioData.panL[currentNote];
		voiceState.panR[voice] = this.audioData.panR[currentNote];
		voiceState.startSample[voice] = currentSample;
		voiceState.endSample[voice] = this.audioData.endSample[currentNote];
		voiceState.soundId[voice] = this.audioData.soundId[currentNote];
		voiceState.oscillator[voice] = soundBank[this.audioData.soundId[currentNote]] || soundBank[0];
	}

	// Spielt einen Soundeffekt ab
	triggerSoundEffect(soundId) {
		const voice = this.findFreeVoice(soundId);
		const voiceState = this.voices;

		voiceState.active[voice] = 1;
		voiceState.phase[voice] = Math.random() * PI2;
		voiceState.envelope[voice] = 0;
		voiceState.stage[voice] = STAGE.ATTACK;
		voiceState.phaseIncrement[voice] = 0;
		voiceState.targetVolume[voice] = 1.0;
		voiceState.panL[voice] = 1;
		voiceState.panR[voice] = 1;
		voiceState.startSample[voice] = this.globalSampleCounter;
		voiceState.endSample[voice] = this.globalSampleCounter + this.sampleRate * 4;
		voiceState.soundId[voice] = soundId;
		voiceState.oscillator[voice] = soundBank[soundId] || soundBank[0];
	}

	// DSP-Logik
	process(inputs, outputs, parameters) {
		if (!this.isPlaying && !this.voices.active.includes(1)) return true;

		const output = outputs[0];
		const outputL = output[0];
		const outputR = output[1] || output[0];
		const bufferLength = outputL.length;

		// Schleife über gepufferten Sampleblock
		for (let i = 0; i < bufferLength; i++) {
			let currentSample = this.globalSampleCounter + i;

			if (this.isPlaying) currentSample = this.updateSequencer(currentSample);

			const mix = this.renderVoices(currentSample);

			outputL[i] = mix.sampleL;
			outputR[i] = mix.sampleR;
		}

		// Recording-Post-Processing
		if (this.isRecording && this.isPlaying) {
			this.recordedL.push(outputL.slice());
			this.recordedR.push(outputR.slice());
		}

		this.globalSampleCounter += bufferLength;
		return true;
	}

	// Sample-Loop-Management
	updateSequencer(currentSample) {
		const loopLength = this.audioData.loopLength;
		const voiceState = this.voices;

		// Zurücksetzen am Ende des Songs
		if (currentSample >= loopLength) {
			if (!this.loop) {
				this.isPlaying = false;
				return currentSample;
			}
			this.globalSampleCounter -= loopLength;
			currentSample -= loopLength;
			this.currentNote = 0;
			for (let voice = 0; voice < AUDIO_CONFIG.MAX_VOICES; voice++) {
				if (voiceState.active[voice] === 1) {
					voiceState.startSample[voice] -= loopLength;
					voiceState.endSample[voice] -= loopLength;
					if (voiceState.soundId[voice] <= 8) {
						voiceState.stage[voice] = STAGE.RELEASE;
					}
				}
			}
		}

		// Aktivieren neuer Noten
		while (
			this.currentNote < this.audioData.startSample.length &&
			currentSample >= this.audioData.startSample[this.currentNote]
		) {
			this.activateVoice(this.currentNote, currentSample);
			this.currentNote++;
		}

		return currentSample;
	}

	// DSP-Synthese
	renderVoices(currentSample) {
		const voiceState = this.voices;
		let sampleL = 0;
		let sampleR = 0;

		// Audiosynthese und Mischen aller aktiven Stimmen
		for (let voice = 0; voice < AUDIO_CONFIG.MAX_VOICES; voice++) {
			if (voiceState.active[voice] === 0) continue;

			// Hüllkurve-Logik
			switch (voiceState.stage[voice]) {
				case STAGE.ATTACK:
					voiceState.envelope[voice] += this.attackIncrement;
					if (voiceState.envelope[voice] >= 1) {
						voiceState.envelope[voice] = 1;
						voiceState.stage[voice] = STAGE.SUSTAIN;
					}
					break;
				case STAGE.SUSTAIN:
					if (currentSample >= voiceState.endSample[voice]) {
						voiceState.stage[voice] = STAGE.RELEASE;
					}
					break;
				case STAGE.RELEASE:
					voiceState.envelope[voice] -= this.releaseDecrement;
					if (voiceState.envelope[voice] <= 0) {
						voiceState.envelope[voice] = 0;
						voiceState.active[voice] = 0;
					}
					break;
			}

			// Wellenform generieren und Lautstärke anwenden
			if (voiceState.active[voice] === 1) {
				const oscillator = voiceState.oscillator[voice];
				if (typeof oscillator === "function") {
					const currentVoiceVolume = voiceState.envelope[voice] * voiceState.targetVolume[voice];
					const timeElapsed = (currentSample - voiceState.startSample[voice]) / this.sampleRate;
					const wave =
						voiceState.soundId[voice] <= 8
							? oscillator(voiceState.phase[voice], timeElapsed) * currentVoiceVolume
							: oscillator(timeElapsed) * currentVoiceVolume;

					// Stereo-Mischung
					sampleL += wave * voiceState.panL[voice];
					sampleR += wave * voiceState.panR[voice];
				} else {
					// Fallback: Stimme deaktivieren, um weitere Fehler zu vermeiden
					voiceState.active[voice] = 0;
					console.warn("Audio-Fehler: Ungültiger Oszillator-Index bei Stimme", voice);
				}

				// Phase aktualisieren und begrenzen
				voiceState.phase[voice] += voiceState.phaseIncrement[voice];
				if (voiceState.phase[voice] >= PI2) voiceState.phase[voice] -= PI2;
			}
		}

		// Reverb
		if (this.hasReverb) {
			// Leseposition im Ringpuffer berechnen
			let readIndex = this.reverbBufferIndex - this.reverbDelay;
			if (readIndex < 0) readIndex += this.reverbBufferLength;

			// Echo aus dem Puffer auslesen
			const echoL = this.reverbBufferL[readIndex];
			const echoR = this.reverbBufferR[readIndex];

			// aktuelles Signal und abgeschwächtes Echo in den Puffer schreiben
			const feedback = 0.5; // Abklingverhalten
			this.reverbBufferL[this.reverbBufferIndex] = sampleL + echoL * feedback;
			this.reverbBufferR[this.reverbBufferIndex] = sampleR + echoR * feedback;

			// Index bewegen, ggf. Neustart
			this.reverbBufferIndex++;
			if (this.reverbBufferIndex >= this.reverbBufferLength) this.reverbBufferIndex = 0;

			sampleL += echoL * this.reverbLevel;
			sampleR += echoR * this.reverbLevel;
		}

		// Tremolo-Pan
		if (this.hasTremolo) {
			this.tremoloPhase += this.tremoloIncrement;
			if (this.tremoloPhase >= PI2) this.tremoloPhase -= PI2;
			// Niedrigfrequenzoszillator
			const lfo = Math.sin(this.tremoloPhase);

			// Amplitude modulieren (Tremolo)
			const tremolo = 1.0 - this.tremoloDepth * (lfo * 0.5 + 0.5);

			// Stereoposition modulieren (Auto-Pan)
			const panModulationL = 1.0 + lfo * this.tremoloDepth * 0.5;
			const panModulationR = 1.0 - lfo * this.tremoloDepth * 0.5;

			sampleL = sampleL * tremolo * panModulationL;
			sampleR = sampleR * tremolo * panModulationR;
		}

		// Low-Pass
		if (this.hasLowPass) {
			// Jeder Schleifendurchgang entspricht 6dB Steilheit
			for (let run = 0; run < this.lowPassRuns; run++) {
				this.lowPassStateL[run] += this.lowPassAlpha * (sampleL - this.lowPassStateL[run]);
				this.lowPassStateR[run] += this.lowPassAlpha * (sampleR - this.lowPassStateR[run]);
				sampleL = this.lowPassStateL[run];
				sampleR = this.lowPassStateR[run];
			}
		}

		return {
			// Master-Lautstärke begrenzen und Clipping verhindern
			sampleL: Math.tanh(sampleL * AUDIO_CONFIG.PRE_GAIN) * this.masterVolume,
			sampleR: Math.tanh(sampleR * AUDIO_CONFIG.PRE_GAIN) * this.masterVolume,
		};
	}
}
registerProcessor("audio-processor", AudioProcessor);
