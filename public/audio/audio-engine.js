// Audioengine (Schnittstelle mit Hauptprozess)
// ------------------------------

import { compileMusicData, SOUND_MAP } from "./audio-utils.js";

export class AudioEngine {
	#ctx = null;
	#worklet = null;
	#isPlaying = false;
	#volume = 1.0;
	currentSongName = null;

	// AudioContext initialisieren
	async init() {
		if (!this.#ctx) {
			this.#ctx = new (window.AudioContext || window.webkitAudioContext)();

			// Reaktivierung des Audio-Kontexts
			if (this.#ctx.state === "suspended") {
				try {
					this.#ctx.resume();
				} catch (error) {
					console.warn("Reaktivierung des Audio-Kontexts fehlgeshlagen:", error);
				}
			}

			// Laden des Audioprozessorcodes
			const processorUrl = new URL("./audio-processor.js", import.meta.url);
			await this.#ctx.audioWorklet.addModule(processorUrl, { type: "module" });
			this.#worklet = new AudioWorkletNode(this.#ctx, "audio-processor", {
				outputChannelCount: [2],
			});

			// Event-Listener für das Beenden einer Aufnahme
			this.#worklet.port.onmessage = (event) => {
				if (event.data.type === "RECORDING_FINISHED") {
					this.#saveWave(
						event.data.left,
						event.data.right,
						this.#ctx.sampleRate,
						`${this.currentSongName || "recording"}.wav`,
					);
				}
			};

			this.#worklet.connect(this.#ctx.destination);
		}
		if (this.#ctx.state === "suspended") {
			await this.#ctx.resume();
		}
		return this.#ctx.sampleRate;
	}

	// Startet die Audiowiedergabe
	async playMusic(songData, loop = true, record = false, songName = "") {
		if (!songData) return console.warn("Audiodaten fehlen!");
		try {
			const sampleRate = await this.init();
			const audioData = compileMusicData(songData, sampleRate);

			this.currentSongName = songName;
			this.#isPlaying = true;

			// Daten-Übergabe an das AudioWorklet
			this.#worklet.port.postMessage({
				type: "PLAY_MUSIC",
				audioData: audioData,
				sampleRate: sampleRate,
				loop: loop,
				record: record,
			});

			document.dispatchEvent(new CustomEvent("audioStarted", { detail: { songName } }));
		} catch (error) {
			console.error("Fehler beim Starten der AudioWorklet Engine: ", error);
		}
	}

	// Startet die Wiedergabe eines Soundeffekts
	playSoundEffect(soundName) {
		if (!this.#worklet || !SOUND_MAP[soundName]) return;
		this.#worklet.port.postMessage({
			type: "PLAY_SOUND_EFFECT",
			soundId: SOUND_MAP[soundName],
		});
	}

	// Stoppt die Audiowiedergabe
	stopMusic() {
		if (this.#worklet) {
			this.#worklet.port.postMessage({ type: "STOP" });
		}
		this.#isPlaying = false;
		document.dispatchEvent(new CustomEvent("audioStopped"));
	}

	// Verändert die Lautstärke
	setVolume(volume) {
		this.#volume = volume;
		if (this.#worklet) {
			this.#worklet.port.postMessage({ type: "VOLUME", volume: this.#volume });
		}
	}

	// Export der Audiodaten als 32-Bit Float Stereo-WAV
	#saveWave(chunksL, chunksR, sampleRate, filename) {
		// Ermitteln der Samplezahl und Gesamtgröße
		let samplesPerChannel = 0;
		for (let i = 0; i < chunksL.length; i++) {
			samplesPerChannel += chunksL[i].length;
		}
		const frameSize = 8; // 2 Kanäle * 4 Byte (= 32 Bit) pro Sample
		const dataSize = samplesPerChannel * frameSize; // Samplezahl pro Kanal * Framegröße

		// Initialisieren des Puffers und Viewobjekts
		const buffer = new ArrayBuffer(44 + dataSize); // 12B Riff-Header + 24B Format-Header + 8B Daten-Header + Daten
		const wave = new DataView(buffer);

		// Methode zum zeichenbasierten Schreiben eines Strings in den Puffer
		wave.writeString = function (offset, string) {
			for (let i = 0; i < string.length; i++) {
				this.setUint8(offset + i, string.charCodeAt(i));
			}
		};

		// Riff-Header (12 Byte)
		wave.writeString(0, "RIFF");
		wave.setUint32(4, 36 + dataSize, true); // Größe der restlichen Datei (nach dieser Angabe)
		wave.writeString(8, "WAVE");

		// Format-Header (24 Byte)
		wave.writeString(12, "fmt ");
		wave.setUint32(16, 16, true); // Länge des restlichen Format-Headers (nach dieser Angabe)
		wave.setUint16(20, 3, true); // Datenformat (IEEE Float = 3)
		wave.setUint16(22, 2, true); // Anzahl der Kanäle (2 = Stereo)
		wave.setUint32(24, sampleRate, true); // Abtastrate
		wave.setUint32(28, sampleRate * frameSize, true); // Datenrate (Abtastrate * Framegröße)
		wave.setUint16(32, frameSize, true); // Framegröße (Kanalzahl * Bytes pro Sample)
		wave.setUint16(34, 32, true); // Bits per Sample (32-Bit)

		// Daten-Header (8 Byte)
		wave.writeString(36, "data");
		wave.setUint32(40, dataSize, true); // Datengröße

		// Daten ('dataSize' Byte)
		let offset = 44;
		// Iteration über alle Chunkpaare
		for (let i = 0; i < chunksL.length; i++) {
			const leftChunk = chunksL[i];
			const rightChunk = chunksR[i];
			// Iteration über alle Samples eines Chunkpaares
			for (let j = 0; j < leftChunk.length; j++) {
				// Kanäle sampleweise abwechselnd schreiben
				wave.setFloat32(offset, leftChunk[j], true);
				offset += 4;
				wave.setFloat32(offset, rightChunk[j], true);
				offset += 4;
			}
		}

		// Download starten
		const blob = new Blob([buffer], { type: "audio/wav" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}
}
export const audioEngine = new AudioEngine();
