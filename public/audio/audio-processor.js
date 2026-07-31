// DSP-Playback via AudioWorklet
// ------------------------------
// - Initialisierung der Wiedergabe und DSP-Komponenten
// - Loop-Management mit konsistenten Samplepositionen bei Loop-Übergängen
// - Sequenzierung und Aktivierung der Noten anhand ihrer Sampleposition
// - Sampleweise Synthese aktiver Stimmen über Hüllkurven und Oszillatoren
// - Mischung, DSP-Effektverarbeitung und Soft-Clipping
// - Ausgabe des berechneten Stereosignals

import { soundBank, PI2 } from "./sound-bank.js";

// Konfigurationskonstanten
const AUDIO_CONFIG = {
	MAX_VOICES: 32, // Polyphonie-Limit
	REVERB_BUFFER: 2, // Länge des Delay-Ringpuffers
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

// Audioprozessor im isolierten AudioWorklet-Kontext
class AudioProcessor extends AudioWorkletProcessor {
	constructor() {
		super();
		// Zustandsinitialisierung
		this.isPlaying = false;
		this.isRecording = false;
		this.loop = true;
		this.currentNote = 0;
		this.globalSampleCounter = 0;
		this.sampleRate = 48000; // Fallback
		// Standard-Änderungsrate für Hüllkurvenübergänge (falls PLAY_SOUND_EFFECT vor PLAY_MUSIC aufgerufen wird)
		this.attackIncrement = 1 / (this.sampleRate * AUDIO_CONFIG.ATTACK_TIME);
		this.releaseDecrement = 1 / (this.sampleRate * AUDIO_CONFIG.RELEASE_TIME);
		this.masterVolume = 1;
		this.audioData = null;
		this.recordedL = [];
		this.recordedR = [];

		// Hall (Delay mittels Ringpuffer)
		this.hasReverb = false;
		this.reverbLevel = 0;
		this.reverbDelay = 0;
		this.reverbBufferLength = 0;
		this.reverbBufferIndex = 0;
		// Array zur Speicherung vergangener Samples
		this.reverbBufferL = null;
		this.reverbBufferR = null;

		// Tremolo-Pan-Effekt (Amplituden- und Panorama-Manipulation)
		this.hasTremolo = false;
		this.tremoloIncrement = 0;
		this.tremoloDepth = 0;
		this.tremoloPhase = 0;

		// Tiefpassfilter
		this.hasLowPass = false;
		this.lowPassAlpha = 1.0;
		this.lowPassRuns = 0;
		// Array zur Speicherung verzögerter Samples; bis zu 4 Filterkaskaden (24 dB / Oktave)
		this.lowPassStateL = new Float32Array(4);
		this.lowPassStateR = new Float32Array(4);

		// Initialisiert den Stimmenpool als Structure of Arrays (SoA)
		// Einsatz getypter, eindimensionaler Arrays für schnellen Cache-Zugriff und konstanten Speicherverbrauch
		// Vermeidung von Objektinstanziierungen zur Laufzeit reduziert Garbage-Collection-Aufwand
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

		// Event-Handling (Nachrichtenverarbeitung vom Haupt-Thread)
		this.port.onmessage = (event) => {
			// Wiedergabe-Ereignis
			if (event.data.type === "PLAY_MUSIC") {
				this.audioData = event.data.audioData;
				this.sampleRate = event.data.sampleRate;
				this.loop = Boolean(event.data.loop);
				this.isRecording = Boolean(event.data.record);
				this.recordedL = [];
				this.recordedR = [];

				// Berechnen der Inkremente für Attack und Release
				// Neuberechnung der Änderungsrate für Hüllkurvenübergänge (falls Abtastratenänderung)
				this.attackIncrement = 1 / (this.sampleRate * AUDIO_CONFIG.ATTACK_TIME);
				this.releaseDecrement = 1 / (this.sampleRate * AUDIO_CONFIG.RELEASE_TIME);

				// Effekte initialisieren und Puffer leeren / allokieren
				const effects = this.audioData.effects;

				// Hall
				this.hasReverb = !!(effects.reverbLevel && effects.reverbDelay);
				if (this.hasReverb) {
					this.reverbLevel = effects.reverbLevel;
					this.reverbDelay = effects.reverbDelay;

					// Dynamische Speicherzuweisung für Ringpuffer bei Bedarf
					const requiredBufferLength = this.sampleRate * AUDIO_CONFIG.REVERB_BUFFER;
					if (!this.reverbBufferL || this.reverbBufferLength !== requiredBufferLength) {
						this.reverbBufferLength = requiredBufferLength;
						this.reverbBufferL = new Float32Array(this.reverbBufferLength);
						this.reverbBufferR = new Float32Array(this.reverbBufferLength);
					} else {
						// Vermeidung von Neuzuweisungen durch Wiederverwendung des Float32Arrays
						this.reverbBufferL.fill(0);
						this.reverbBufferR.fill(0);
					}
					this.reverbBufferIndex = 0;
				}

				// Tremolo-Pan-Effekt
				this.hasTremolo = !!effects.tremoloDepth;
				if (this.hasTremolo) {
					this.tremoloIncrement = effects.tremoloIncrement;
					this.tremoloDepth = effects.tremoloDepth;
					this.tremoloPhase = 0;
				}

				// Tiefpassfilter
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
				// Soundeffekt-Ereignis
				this.triggerSoundEffect(event.data.soundId);
			} else if (event.data.type === "STOP") {
				// Stopp-Ereignis
				if (this.isPlaying && this.isRecording) {
					// Nachricht an den Haupt-Thread senden, um WAVE-Export auszulösen
					this.port.postMessage({ type: "RECORDING_FINISHED", left: this.recordedL, right: this.recordedR });
				}
				this.isPlaying = false;
				this.resetPlayback();
				this.resetFilter();
			} else if (event.data.type === "VOLUME") {
				// Ereignis zur Lautstärkeänderung
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

	// Setzt die globalen Filter- / Effektparameter zurück
	resetFilter() {
		// Hall zurücksetzen
		this.hasReverb = false;
		this.reverbLevel = 0;
		this.reverbDelay = 0;
		if (this.reverbBufferL) {
			this.reverbBufferL.fill(0);
			this.reverbBufferR.fill(0);
		}

		// Tremolo-Pan-Effekt zurücksetzen
		this.hasTremolo = false;
		this.tremoloIncrement = 0;
		this.tremoloDepth = 0;
		this.tremoloPhase = 0;

		// Tiefpassfilter zurücksetzen
		this.hasLowPass = false;
		this.lowPassAlpha = 1.0;
		this.lowPassRuns = 0;
		this.lowPassStateL.fill(0);
		this.lowPassStateR.fill(0);
	}

	// Zuweisungs-Algorithmus für die begrenzte Polyphonie
	findFreeVoice(targetSoundId = null) {
		const voiceState = this.voices;
		const isPercussion = targetSoundId >= 9;

		// Priorität 0: Nutzung aktiver Instanzen mit selber Sound-ID bei Percussion / Soundeffekt (Vermeidung von Überlappungen)
		if (isPercussion) {
			for (let voice = 0; voice < AUDIO_CONFIG.MAX_VOICES; voice++) {
				if (voiceState.active[voice] === 1 && voiceState.soundId[voice] === targetSoundId) return voice;
			}
		}

		// Priorität 1: Inaktive Instanz finden
		for (let voice = 0; voice < AUDIO_CONFIG.MAX_VOICES; voice++) {
			if (voiceState.active[voice] === 0) return voice;
		}

		// Fallback 1: Überschreibung einer Instanz im Release-Zustand
		for (let voice = 0; voice < AUDIO_CONFIG.MAX_VOICES; voice++) {
			if (voiceState.stage[voice] === STAGE.RELEASE) return voice;
		}

		// Fallback 2: Suche der ältesten Instanz durch Start-Sample-Vergleich (Voice-Stealing)
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

	// Initialisierungszustand einer Note in SoA setzen
	activateVoice(currentNote, currentSample) {
		const voice = this.findFreeVoice(this.audioData.soundId[currentNote]);
		const voiceState = this.voices;

		voiceState.active[voice] = 1;
		voiceState.phase[voice] = Math.random() * PI2; // Zufälligen Phasenstarts zur Vermeidung von Interferenzen
		voiceState.envelope[voice] = 0;
		voiceState.stage[voice] = STAGE.ATTACK;
		voiceState.phaseIncrement[voice] = this.audioData.phaseIncrement[currentNote];
		voiceState.targetVolume[voice] = this.audioData.volume[currentNote];
		voiceState.panL[voice] = this.audioData.panL[currentNote];
		voiceState.panR[voice] = this.audioData.panR[currentNote];
		voiceState.startSample[voice] = currentSample;
		voiceState.endSample[voice] = this.audioData.endSample[currentNote];
		voiceState.soundId[voice] = this.audioData.soundId[currentNote];
		voiceState.oscillator[voice] = soundBank[this.audioData.soundId[currentNote]] || soundBank[0]; // Fallback auf Sinus-Oszillator
	}

	// Soundeffekt einspeisen
	triggerSoundEffect(soundId) {
		const voice = this.findFreeVoice(soundId);
		const voiceState = this.voices;

		voiceState.active[voice] = 1;
		voiceState.phase[voice] = Math.random() * PI2; // Zufälligen Phasenstarts zur Vermeidung von Interferenzen
		voiceState.envelope[voice] = 0;
		voiceState.stage[voice] = STAGE.ATTACK;
		voiceState.phaseIncrement[voice] = 0;
		voiceState.targetVolume[voice] = 1.0;
		voiceState.panL[voice] = 1;
		voiceState.panR[voice] = 1;
		voiceState.startSample[voice] = this.globalSampleCounter;
		voiceState.endSample[voice] = this.globalSampleCounter + this.sampleRate * 4; // Feste Dauer von 4s
		voiceState.soundId[voice] = soundId;
		voiceState.oscillator[voice] = soundBank[soundId] || soundBank[0];
	}

	// DSP-Logik
	// Audio-Render-Schleife (pro Aufruf durch WebAudio-API regulär 128 Frames)
	process(inputs, outputs, parameters) {
		if (!this.isPlaying && !this.voices.active.includes(1)) return true; // Leerlauf-Optimierung

		const output = outputs[0]; // Referenz auf das Ausgangssignal-Array der WebAudio-API
		const outputL = output[0];
		const outputR = output[1] || output[0]; // Mono-Fallback
		const bufferLength = outputL.length;

		// Schleife über jeden Audioframe
		for (let i = 0; i < bufferLength; i++) {
			let currentSample = this.globalSampleCounter + i;

			if (this.isPlaying) currentSample = this.updateSequencer(currentSample);

			const mix = this.renderVoices(currentSample);

			outputL[i] = mix.sampleL;
			outputR[i] = mix.sampleR;
		}

		// Kopieren des Puffers bei aktivierter Aufnahme
		if (this.isRecording && this.isPlaying) {
			this.recordedL.push(outputL.slice());
			this.recordedR.push(outputR.slice());
		}

		this.globalSampleCounter += bufferLength;
		return true; // Worklet aktiv halten
	}

	// Sample-Loop-Management
	// Sequenzierung und Loop-Logik basierend auf absoluten Sample-Positionen
	updateSequencer(currentSample) {
		const loopLength = this.audioData.loopLength;
		const voiceState = this.voices;

		// Loop-Handling
		if (currentSample >= loopLength) {
			if (!this.loop) {
				this.isPlaying = false;
				return currentSample;
			}
			// Zurücksetzen des Zählers am Ende des Songs
			this.globalSampleCounter -= loopLength;
			currentSample -= loopLength;
			this.currentNote = 0;

			// Korrektur aktiver Stimmen zur Beibehaltung bei Loop-Übergang
			for (let voice = 0; voice < AUDIO_CONFIG.MAX_VOICES; voice++) {
				if (voiceState.active[voice] === 1) {
					voiceState.startSample[voice] -= loopLength;
					voiceState.endSample[voice] -= loopLength;
					// Release-Zustand für Melodieinstrumente erzwingen
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
	// Signalverarbeitung und Synthese auf Sample-Ebene
	renderVoices(currentSample) {
		const voiceState = this.voices;
		let sampleL = 0;
		let sampleR = 0;

		// Audiosynthese und additives Mischen aller aktiven Stimmen
		for (let voice = 0; voice < AUDIO_CONFIG.MAX_VOICES; voice++) {
			if (voiceState.active[voice] === 0) continue;

			// Hüllkurvenberechnung
			switch (voiceState.stage[voice]) {
				case STAGE.ATTACK:
					// Lineares Erhöhen der Hüllkurve
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
					// Lineares Absenken der Hüllkurve
					voiceState.envelope[voice] -= this.releaseDecrement;
					if (voiceState.envelope[voice] <= 0) {
						voiceState.envelope[voice] = 0;
						voiceState.active[voice] = 0;
					}
					break;
			}

			// Oszillator-Ausführung
			// Wellenform generieren und Lautstärke anwenden
			if (voiceState.active[voice] === 1) {
				const oscillator = voiceState.oscillator[voice];
				if (typeof oscillator === "function") {
					const currentVoiceVolume = voiceState.envelope[voice] * voiceState.targetVolume[voice];
					const timeElapsed = (currentSample - voiceState.startSample[voice]) / this.sampleRate; // Vergangene Zeit seit Aktivierung

					// Übergabe der vergangenen Zeit nur bei Melodieinstrumenten
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

				// Phasenvorschub um Phaseninkrement
				voiceState.phase[voice] += voiceState.phaseIncrement[voice];
				// Wrap-Around (Vermeidung von Präzisionsverlusten bei großen Gleitkommazahlen)
				if (voiceState.phase[voice] >= PI2) voiceState.phase[voice] -= PI2;
			}
		}

		// Hall (basierend auf Verzögerungspuffer)
		if (this.hasReverb) {
			// Offset / Leseposition im Ringpuffer berechnen
			let readIndex = this.reverbBufferIndex - this.reverbDelay;
			// Negativer Ringpuffer-Überlauf
			if (readIndex < 0) readIndex += this.reverbBufferLength;

			// Echo aus dem Puffer auslesen
			const echoL = this.reverbBufferL[readIndex];
			const echoR = this.reverbBufferR[readIndex];

			// Schreiben des Signals in den Puffer (Aktuelles Signal + abklingendes Echo)
			const decay = 0.5; // Abklingverhalten
			this.reverbBufferL[this.reverbBufferIndex] = sampleL + echoL * decay;
			this.reverbBufferR[this.reverbBufferIndex] = sampleR + echoR * decay;

			// Indexvorschub, ggf. Neustart
			this.reverbBufferIndex++;
			if (this.reverbBufferIndex >= this.reverbBufferLength) this.reverbBufferIndex = 0;

			// Mischung in das Mastersignal
			sampleL += echoL * this.reverbLevel;
			sampleR += echoR * this.reverbLevel;
		}

		// Tremolo-Pan-Effekt (basierend auf Niedrigfrequenzoszillator)
		if (this.hasTremolo) {
			// Phasenvorschub um Phaseninkrement
			this.tremoloPhase += this.tremoloIncrement;
			// Wrap-Around (Vermeidung von Präzisionsverlusten bei großen Gleitkommazahlen)
			if (this.tremoloPhase >= PI2) this.tremoloPhase -= PI2;

			// Niedrigfrequenzoszillator [-1, 1]
			const lfo = Math.sin(this.tremoloPhase);

			// Amplitude modulieren (Tremolo) (1 - [0, 1])
			const tremolo = 1.0 - this.tremoloDepth * (lfo * 0.5 + 0.5);

			// Stereoposition modulieren (Auto-Pan), gegensätzliche Phasenanpassung (1 +/- [-0.5, 0.5])
			// Begrenzung auf 50%-150%
			const panModulationL = 1.0 + lfo * this.tremoloDepth * 0.5;
			const panModulationR = 1.0 - lfo * this.tremoloDepth * 0.5;

			// Mischung in das Mastersignal
			sampleL = sampleL * tremolo * panModulationL;
			sampleR = sampleR * tremolo * panModulationR;
		}

		//Tiefpassfilter (basierend auf exponentieller Glättung)
		if (this.hasLowPass) {
			// Kaskadierung zur Erhöhung der Flankensteilheit
			// Jeder Schleifendurchgang entspricht 6dB / Oktave Steilheit
			for (let run = 0; run < this.lowPassRuns; run++) {
				// Zustandsaktualisierung basierend auf Alpha (Anpassungsgeschwindigkeit)
				// niedrige Grenzfrequenz -> kleiner Alpha -> langsame Signaländerung -> Dämpfung hoher Frequenzen
				this.lowPassStateL[run] += this.lowPassAlpha * (sampleL - this.lowPassStateL[run]);
				this.lowPassStateR[run] += this.lowPassAlpha * (sampleR - this.lowPassStateR[run]);

				// Ersetzen des Mastersignals
				sampleL = this.lowPassStateL[run];
				sampleR = this.lowPassStateR[run];
			}
		}

		return {
			// Lautstärke-Begrenzung via Pre-Gain und Tangens hyperbolicus (Soft Clipping); Anwenden der Master-Lautstärke
			sampleL: Math.tanh(sampleL * AUDIO_CONFIG.PRE_GAIN) * this.masterVolume,
			sampleR: Math.tanh(sampleR * AUDIO_CONFIG.PRE_GAIN) * this.masterVolume,
		};
	}
}
// Registriert die Implementierungsklasse für die Erstellung eines AudioWorkletNode unter dem Namen "audio-processor"
registerProcessor("audio-processor", AudioProcessor);
