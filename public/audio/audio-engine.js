// Audioengine (Schnittstelle zwischen Haupt-Thread und AudioWorklet)
// -------------------------------------------------------------------
// - Initialisierung des AudioContexts und Laden des AudioWorklets
// - Kompilierung der Musikdaten in eine DSP-optimierte SoA-Struktur
// - Kommunikation zwischen Haupt-Thread und AudioWorklet
// - Steuerung der Audiowiedergabe
// - Export aufgezeichneter Audiodaten als WAV-Datei

import { compileMusicData, SOUND_MAP } from "./audio-utils.js";

export class AudioEngine {
	#ctx = null;
	#worklet = null;
	#isPlaying = false;
	#volume = 1.0;
	currentSongName = null;

	// Initialisierung des AudioContexts
	async init() {
		if (!this.#ctx) {
			// Vermeidung der mehrfachen Initialisierung

			// Unterstützung von WebKit-Präfixen für ältere Apple-Browser
			this.#ctx = new (window.AudioContext || window.webkitAudioContext)();

			// Aktivierung des AudioContexts aus Pausierung aufgrund von Sicherheitsrichtlinien
			if (this.#ctx.state === "suspended") {
				try {
					await this.#ctx.resume();
				} catch (error) {
					console.warn("Aktivierung des AudioContexts fehlgeschlagen:", error);
				}
			}

			// Laden des Audioprozessorcodes in den isolierten AudioWorklet-Kontext
			const processorUrl = new URL("./audio-processor.js", import.meta.url);
			await this.#ctx.audioWorklet.addModule(processorUrl, { type: "module" });

			// Erstellen des zugehörigen Nodes im Haupt-Thread
			this.#worklet = new AudioWorkletNode(this.#ctx, "audio-processor", {
				outputChannelCount: [2],
			});

			// Event-Listener für Benachrichtigungen aus dem AudioWorklet
			this.#worklet.port.onmessage = (event) => {
				// Abschluss einer Aufnahme
				if (event.data.type === "RECORDING_FINISHED") {
					this.#saveWave(
						event.data.left,
						event.data.right,
						this.#ctx.sampleRate,
						`${this.currentSongName || "recording"}.wav`,
					);
				}
			};

			// Verbindung des AudioWorklets mit dem physischen Audioausgang
			this.#worklet.connect(this.#ctx.destination);
		}
		// Reaktivierung des AudioContexts nach Unterbrechung
		if (this.#ctx.state === "suspended") {
			await this.#ctx.resume();
		}
		// Rückgabe der Abtastrate als Bestätigung der erfolgreichen Initialisierung
		return this.#ctx.sampleRate;
	}

	// Start der Audiowiedergabe und Übergabe der Track-Daten
	// (record und songName nur für SoundLab-Funktionalität)
	async playMusic(songData, loop = true, record = false, songName = "") {
		if (!songData) return console.warn("Audiodaten fehlen!");
		try {
			// Initialisierung bzw. Reaktivieren des AudioContexts mit Abtastrate als Rückgabewert
			const sampleRate = await this.init();

			// Umwandlung des notationsnahen Musikdaten-JSON in eine maschinennahe Audiodaten-SoA
			const audioData = compileMusicData(songData, sampleRate);

			this.currentSongName = songName;
			this.#isPlaying = true;

			// Datenübergabe an das AudioWorklet
			this.#worklet.port.postMessage({
				type: "PLAY_MUSIC",
				audioData: audioData,
				sampleRate: sampleRate,
				loop: loop,
				record: record,
			});

			// Auslösen eines Wiedergabe-Ereignisses für das SoundLab
			document.dispatchEvent(new CustomEvent("audioStarted", { detail: { songName } }));
		} catch (error) {
			console.error("Fehler beim Starten des AudioWorklets: ", error);
		}
	}

	// Auslösen eines Soundeffekts
	playSoundEffect(soundName) {
		if (!this.#worklet || !SOUND_MAP[soundName]) return;

		// Datenübergabe an das AudioWorklet
		this.#worklet.port.postMessage({
			type: "PLAY_SOUND_EFFECT",
			soundId: SOUND_MAP[soundName],
		});
	}

	// Stopp der Audiowiedergabe
	stopMusic() {
		if (this.#worklet) {
			this.#worklet.port.postMessage({ type: "STOP" });
		}
		this.#isPlaying = false;

		// Auslösen eines Stopp-Ereignisses für das SoundLab
		document.dispatchEvent(new CustomEvent("audioStopped"));
	}

	// Steuerung der Lautstärke
	setVolume(volume) {
		// Setzen der privaten Property
		this.#volume = volume;

		// Übermittlung an das AudioWorklet zur tatsächlichen Lautstärkeänderung
		if (this.#worklet) {
			this.#worklet.port.postMessage({ type: "VOLUME", volume: this.#volume });
		}
	}

	// Export der Audiodaten als 32-Bit Float Stereo-WAV
	// (nur für SoundLab-Funktionalität)
	#saveWave(chunksL, chunksR, sampleRate, filename) {
		// Ermitteln der Samplezahl und kumulierten Gesamtgröße
		let samplesPerChannel = 0;
		for (let i = 0; i < chunksL.length; i++) {
			samplesPerChannel += chunksL[i].length;
		}
		const frameSize = 8; // 2 Kanäle * 4 Byte (= 32 Bit) pro Sample
		const dataSize = samplesPerChannel * frameSize; // Samplezahl pro Kanal * Framegröße

		// Speicherallokation des Puffers und Initialisierung des Viewobjekts
		const buffer = new ArrayBuffer(44 + dataSize); // 12B Riff-Header + 24B Format-Header + 8B Daten-Header + Daten
		const wave = new DataView(buffer);

		// Methode zum zeichenbasierten ASCII-Codieren und byteweisen Schreiben eines Strings
		wave.writeString = function (offset, string) {
			for (let i = 0; i < string.length; i++) {
				this.setUint8(offset + i, string.charCodeAt(i));
			}
		};

		// Riff-Header (12 Byte)
		// Schreiben via setUint-Methoden des Viewobjekts (true = Little-Endian)
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
				offset += 4; // Vorschub um 4 Bytes (32 Bit)
				wave.setFloat32(offset, rightChunk[j], true);
				offset += 4;
			}
		}

		// Starten des Downloads
		// Erzeugen einer temporären URL auf den Binärdaten-Blob
		const blob = new Blob([buffer], { type: "audio/wav" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;

		// Virtueller Klick zur Downloadauslösung
		a.click();

		// Speicherfreigabe
		URL.revokeObjectURL(url);
	}
}

// Instanziierung und Export der AudioEngine
export const audioEngine = new AudioEngine();
