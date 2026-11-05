export type AudioDevice = {
  id: string;
  label: string;
};

export type AudioSnapshot = {
  inputs: AudioDevice[];
  outputs: AudioDevice[];
  inputLevel: number;
  inputClip: boolean;
  outputLevel: number;
  outputClip: boolean;
  referenceLevel: number;
  pitchHz: number | null;
  referencePitchHz: number | null;
  sampleRate: number | null;
  inputState: "idle" | "active" | "disconnected" | "error";
  outputState: "ready" | "disconnected" | "error";
  notice: string;
};

export type ReferenceSeparation = "original" | "center" | "center-removed";

type SinkSelectableContext = AudioContext & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

const EMPTY_SNAPSHOT: AudioSnapshot = {
  inputs: [],
  outputs: [],
  inputLevel: 0,
  inputClip: false,
  outputLevel: 0,
  outputClip: false,
  referenceLevel: 0,
  pitchHz: null,
  referencePitchHz: null,
  sampleRate: null,
  inputState: "idle",
  outputState: "ready",
  notice: ""
};

export class AudioEngine {
  private snapshot: AudioSnapshot = { ...EMPTY_SNAPSHOT };
  private listeners = new Set<(snapshot: AudioSnapshot) => void>();
  private context: SinkSelectableContext | null = null;
  private inputStream: MediaStream | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private voiceGain: GainNode | null = null;
  private voicePan: StereoPannerNode | null = null;
  private monitorGain: GainNode | null = null;
  private referenceGain: GainNode | null = null;
  private referencePan: StereoPannerNode | null = null;
  private masterGain: GainNode | null = null;
  private referenceElement: HTMLAudioElement | null = null;
  private referenceSource: MediaElementAudioSourceNode | null = null;
  private referenceDirectGain: GainNode | null = null;
  private referenceSeparationGain: GainNode | null = null;
  private referenceSplitter: ChannelSplitterNode | null = null;
  private referenceMerger: ChannelMergerNode | null = null;
  private referenceMatrixGains: GainNode[] = [];
  private referenceChannels = 0;
  private referenceSeparation: ReferenceSeparation = "original";
  private referenceAnalyser: AnalyserNode | null = null;
  private preferredInput = "";
  private preferredOutput = "";
  private requestedRate = 48000;
  private monitoring = false;
  private inputMuted = false;
  private referenceMuted = false;
  private inputSolo = false;
  private referenceSolo = false;
  private inputVolume = 0.8;
  private referenceVolume = 0.7;
  private monitorVolume = 0.35;
  private masterVolume = 0.85;
  private voicePanValue = 0;
  private referencePanValue = 0;
  private meterFrame = 0;
  private pitchFrame = 0;
  private lastPitchHz: number | null = null;
  private lastReferencePitchHz: number | null = null;
  private lastInputs = new Set<string>();
  private lastOutputs = new Set<string>();
  private referencePitchFrame = 0;

  constructor() {
    navigator.mediaDevices.addEventListener("devicechange", this.handleDeviceChange);
  }

  subscribe(listener: (snapshot: AudioSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  async initialize(): Promise<void> {
    if (!navigator.mediaDevices?.enumerateDevices) {
      this.update({ notice: "Este ambiente não disponibiliza dispositivos de áudio." });
      return;
    }
    await this.refreshDevices(false);
  }

  async discoverDevices(): Promise<void> {
    let temporaryStream: MediaStream | null = null;
    try {
      if (!this.inputStream) {
        temporaryStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      if (!(await this.refreshDevices(false))) {
        throw new Error(this.snapshot.notice || "Não foi possível atualizar a lista de dispositivos.");
      }
      this.update({ notice: "Lista de dispositivos de áudio atualizada." });
    } finally {
      temporaryStream?.getTracks().forEach((track) => track.stop());
    }
  }

  getSnapshot(): AudioSnapshot {
    return this.snapshot;
  }

  async setInputDevice(id: string): Promise<void> {
    this.preferredInput = id;
    if (this.inputStream) await this.openInput();
    else this.update({ inputState: "idle", notice: "" });
  }

  async setOutputDevice(id: string): Promise<void> {
    this.preferredOutput = id;
    try {
      if (this.context) await this.applySink(this.context, id);
      this.update({ outputState: "ready", notice: "" });
    } catch (error) {
      this.update({
        outputState: "error",
        notice: `Não foi possível abrir a saída selecionada: ${this.errorMessage(error)}`
      });
      throw error;
    }
  }

  async setSampleRate(rate: number): Promise<number> {
    if (this.context) {
      if (rate !== this.context.sampleRate) {
        throw new Error("Feche e reabra o aplicativo para aplicar outra taxa de amostragem.");
      }
      return this.context.sampleRate;
    }
    this.requestedRate = rate;
    return rate;
  }

  async startInput(): Promise<void> {
    await this.openInput();
  }

  stopInput(): void {
    this.inputSource?.disconnect();
    this.inputSource = null;
    this.analyser?.disconnect();
    this.analyser = null;
    this.voiceGain?.disconnect();
    this.voicePan?.disconnect();
    if (this.inputStream) {
      for (const track of this.inputStream.getTracks()) track.stop();
    }
    this.inputStream = null;
    this.lastPitchHz = null;
    this.update({ inputState: "idle", inputLevel: 0, pitchHz: null });
  }

  async setMonitoring(enabled: boolean): Promise<void> {
    try {
      if (enabled && !this.inputStream) await this.openInput();
      this.monitoring = enabled;
      const context = await this.ensureContext();
      this.ensureVoiceNodes(context);
      this.connectInputPath();
      this.applyMix();
    } catch (error) {
      this.monitoring = false;
      throw error;
    }
  }

  setChannelVolume(channel: "voice" | "reference" | "monitor" | "master", value: number): void {
    const volume = Math.max(0, Math.min(1, value));
    if (channel === "voice") this.inputVolume = volume;
    if (channel === "reference") this.referenceVolume = volume;
    if (channel === "monitor") this.monitorVolume = volume;
    if (channel === "master") this.masterVolume = volume;
    this.applyMix();
  }

  setPan(channel: "voice" | "reference", value: number): void {
    const pan = Math.max(-1, Math.min(1, value));
    if (channel === "voice") {
      this.voicePanValue = pan;
      if (this.voicePan) this.voicePan.pan.value = pan;
    } else {
      this.referencePanValue = pan;
      if (this.referencePan) this.referencePan.pan.value = pan;
    }
  }

  setMute(channel: "voice" | "reference", muted: boolean): void {
    if (channel === "voice") this.inputMuted = muted;
    else this.referenceMuted = muted;
    this.applyMix();
  }

  setSolo(channel: "voice" | "reference", solo: boolean): void {
    if (channel === "voice") this.inputSolo = solo;
    else this.referenceSolo = solo;
    this.applyMix();
  }

  setReferenceSeparation(mode: ReferenceSeparation): void {
    if (mode !== "original" && this.referenceChannels < 2) {
      throw new Error("A separação por centro exige uma música estéreo.");
    }
    this.referenceSeparation = mode;
    this.applyReferenceSeparation();
  }

  async playTestTone(): Promise<void> {
    const context = await this.ensureContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 440;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.04);
    gain.gain.setValueAtTime(0.08, context.currentTime + 0.35);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.5);
    oscillator.connect(gain).connect(this.ensureMaster(context));
    oscillator.start();
    oscillator.stop(context.currentTime + 0.52);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }

  async loadReference(file: File): Promise<{ element: HTMLAudioElement; peaks: number[]; channels: number }> {
    const context = await this.ensureContext();
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    const url = URL.createObjectURL(file);
    const element = new Audio(url);
    element.preload = "auto";
    element.preservesPitch = true;
    const source = context.createMediaElementSource(element);
    const directGain = context.createGain();
    const gain = context.createGain();
    const analyser = context.createAnalyser();
    analyser.fftSize = 4096;
    const pan = context.createStereoPanner();
    pan.pan.value = this.referencePanValue;
    let splitter: ChannelSplitterNode | null = null;
    let merger: ChannelMergerNode | null = null;
    let separationGain: GainNode | null = null;
    let matrixGains: GainNode[] = [];
    if (buffer.numberOfChannels >= 2) {
      splitter = context.createChannelSplitter(2);
      merger = context.createChannelMerger(2);
      separationGain = context.createGain();
      matrixGains = Array.from({ length: 4 }, () => context.createGain());
      source.connect(splitter);
      splitter.connect(matrixGains[0]!, 0);
      matrixGains[0]!.connect(merger, 0);
      splitter.connect(matrixGains[1]!, 0);
      matrixGains[1]!.connect(merger, 1);
      splitter.connect(matrixGains[2]!, 1);
      matrixGains[2]!.connect(merger, 0);
      splitter.connect(matrixGains[3]!, 1);
      matrixGains[3]!.connect(merger, 1);
      merger.connect(separationGain).connect(gain);
    }
    source.connect(directGain).connect(gain);
    this.referenceSource?.disconnect();
    this.referenceDirectGain?.disconnect();
    this.referenceSeparationGain?.disconnect();
    this.referenceSplitter?.disconnect();
    this.referenceMerger?.disconnect();
    for (const matrixGain of this.referenceMatrixGains) matrixGain.disconnect();
    this.referenceGain?.disconnect();
    this.referenceAnalyser?.disconnect();
    this.referencePan?.disconnect();
    gain.connect(analyser).connect(pan).connect(this.ensureMaster(context));
    this.referenceElement?.pause();
    if (this.referenceElement?.src.startsWith("blob:")) URL.revokeObjectURL(this.referenceElement.src);
    this.referenceElement = element;
    this.referenceSource = source;
    this.referenceDirectGain = directGain;
    this.referenceSplitter = splitter;
    this.referenceMerger = merger;
    this.referenceSeparationGain = separationGain;
    this.referenceMatrixGains = matrixGains;
    this.referenceChannels = buffer.numberOfChannels;
    this.referenceSeparation = "original";
    this.referenceGain = gain;
    this.referenceAnalyser = analyser;
    this.lastReferencePitchHz = null;
    this.update({ referencePitchHz: null });
    this.referencePan = pan;
    this.applyMix();
    this.applyReferenceSeparation();
    const samples = buffer.getChannelData(0);
    const buckets = 180;
    const peaks = Array.from({ length: buckets }, (_, index) => {
      const start = Math.floor((index / buckets) * samples.length);
      const end = Math.max(start + 1, Math.floor(((index + 1) / buckets) * samples.length));
      let peak = 0;
      for (let cursor = start; cursor < end; cursor += 1) {
        peak = Math.max(peak, Math.abs(samples[cursor] ?? 0));
      }
      return peak;
    });
    return { element, peaks, channels: buffer.numberOfChannels };
  }

  async dispose(): Promise<void> {
    navigator.mediaDevices.removeEventListener("devicechange", this.handleDeviceChange);
    this.stopMeter();
    this.stopInput();
    this.referenceElement?.pause();
    this.referenceSource?.disconnect();
    this.referenceDirectGain?.disconnect();
    this.referenceSeparationGain?.disconnect();
    this.referenceSplitter?.disconnect();
    this.referenceMerger?.disconnect();
    for (const matrixGain of this.referenceMatrixGains) matrixGain.disconnect();
    if (this.referenceElement?.src.startsWith("blob:")) URL.revokeObjectURL(this.referenceElement.src);
    if (this.context && this.context.state !== "closed") await this.context.close();
  }

  private handleDeviceChange = (): void => {
    void this.refreshDevices(true);
  };

  private async refreshDevices(notify: boolean): Promise<boolean> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices
        .filter((device) => device.kind === "audioinput")
        .map((device) => ({ id: device.deviceId, label: device.label || "Dispositivo de entrada" }));
      const outputs = devices
        .filter((device) => device.kind === "audiooutput")
        .map((device) => ({ id: device.deviceId, label: device.label || "Dispositivo de saída" }));
      const inputIds = new Set(inputs.map((device) => device.id));
      const outputIds = new Set(outputs.map((device) => device.id));
      const lostInput = Boolean(this.preferredInput && !inputIds.has(this.preferredInput));
      const restoredInput = Boolean(
        this.preferredInput && inputIds.has(this.preferredInput) && this.snapshot.inputState === "disconnected"
      );
      if (lostInput) {
        this.stopInput();
        this.update({ inputState: "disconnected", notice: "Dispositivo de entrada desconectado. Sua seleção foi preservada." });
      }
      const lostOutput = Boolean(this.preferredOutput && !outputIds.has(this.preferredOutput));
      if (lostOutput) {
        this.update({ outputState: "disconnected", notice: "Dispositivo de saída desconectado. Sua seleção foi preservada." });
      }
      if (restoredInput && !lostInput) {
        this.update({ inputState: "idle", notice: "Dispositivo de entrada reconectado. A seleção foi preservada." });
      }
      const restoredOutput = Boolean(
        this.preferredOutput && outputIds.has(this.preferredOutput) && this.snapshot.outputState === "disconnected"
      );
      if (restoredOutput && !lostOutput) {
        try {
          if (this.context) await this.applySink(this.context, this.preferredOutput);
          this.update({ outputState: "ready", notice: "Dispositivo de saída reconectado. A seleção foi restaurada." });
        } catch (error) {
          this.update({
            outputState: "error",
            notice: `Dispositivo reconectado, mas não foi possível abrir a saída: ${this.errorMessage(error)}`
          });
        }
      }
      const added = notify
        ? [...inputs, ...outputs].filter((device) => !this.lastInputs.has(device.id) && !this.lastOutputs.has(device.id))
        : [];
      this.lastInputs = new Set(inputs.map((device) => device.id));
      this.lastOutputs = new Set(outputs.map((device) => device.id));
      this.update({ inputs, outputs });
      if (notify && !this.preferredInput && this.inputStream) {
        void this.openInput().catch(() => undefined);
      }
      if (added.length && !lostOutput) {
        this.update({ notice: `Novo dispositivo de áudio detectado: ${added.map((device) => device.label).join(", ")}.` });
      }
      if (!lostOutput && !restoredOutput && this.snapshot.outputState !== "error") {
        this.update({ outputState: "ready" });
      }
      return true;
    } catch (error) {
      this.update({ notice: `Falha ao atualizar dispositivos: ${this.errorMessage(error)}` });
      return false;
    }
  }

  private async openInput(): Promise<void> {
    const previousStream = this.inputStream;
    const previousSource = this.inputSource;
    const previousAnalyser = this.analyser;
    let nextStream: MediaStream | null = null;
    try {
      const constraints: MediaStreamConstraints = {
        audio: this.preferredInput
          ? { deviceId: { exact: this.preferredInput }, channelCount: 1 }
          : { channelCount: 1 }
      };
      nextStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.stopMeter();
      await this.attachInput(nextStream);
      this.inputStream = nextStream;
      const track = nextStream.getAudioTracks()[0];
      if (track) {
        track.onended = () => {
          if (this.inputStream === nextStream) {
            this.stopInput();
            this.update({ inputState: "disconnected", notice: "Dispositivo de entrada desconectado." });
          }
        };
      }
      await this.refreshDevices(false);
      if (this.inputStream !== nextStream) throw new Error("O dispositivo foi desconectado durante a abertura.");
      previousSource?.disconnect();
      previousAnalyser?.disconnect();
      previousStream?.getTracks().forEach((previousTrack) => previousTrack.stop());
      this.update({ inputState: "active", notice: "" });
      this.startMeter();
    } catch (error) {
      this.stopMeter();
      if (this.inputSource !== previousSource) this.inputSource?.disconnect();
      if (this.analyser !== previousAnalyser) this.analyser?.disconnect();
      this.inputSource = previousSource;
      this.analyser = previousAnalyser;
      this.inputStream = previousStream;
      if (nextStream && nextStream !== previousStream) {
        nextStream.getTracks().forEach((track) => track.stop());
      }
      if (previousStream) {
        this.connectInputPath();
        this.startMeter();
      }
      this.update({
        inputState: previousStream ? "active" : "error",
        notice: `Não foi possível abrir o microfone: ${this.errorMessage(error)}`
      });
      throw error;
    }
  }

  private async attachInput(stream: MediaStream): Promise<void> {
    const context = await this.ensureContext();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0.18;
    source.connect(analyser);
    this.inputSource = source;
    this.analyser = analyser;
    this.ensureVoiceNodes(context);
    this.connectInputPath();
    this.update({ sampleRate: context.sampleRate });
  }

  private async ensureContext(): Promise<SinkSelectableContext> {
    if (this.context && this.context.state !== "closed") {
      if (this.context.state === "suspended") await this.context.resume();
      return this.context;
    }
    const context = new AudioContext({ sampleRate: this.requestedRate }) as SinkSelectableContext;
    this.context = context;
    try {
      await this.applySink(context, this.preferredOutput);
      this.ensureMaster(context);
      this.ensureVoiceNodes(context);
      this.applyMix();
      this.update({ sampleRate: context.sampleRate });
      this.startMeter();
      return context;
    } catch (error) {
      await context.close();
      this.context = null;
      throw error;
    }
  }

  private async applySink(context: SinkSelectableContext, deviceId: string): Promise<void> {
    if (!context.setSinkId) {
      if (deviceId) throw new Error("seleção de saída não suportada por este runtime");
      return;
    }
    await context.setSinkId(deviceId);
  }

  private ensureMaster(context: AudioContext): GainNode {
    if (!this.masterGain) {
      this.masterGain = context.createGain();
      this.outputAnalyser = context.createAnalyser();
      this.outputAnalyser.fftSize = 1024;
      this.masterGain.connect(this.outputAnalyser).connect(context.destination);
    }
    return this.masterGain;
  }

  private ensureVoiceNodes(context: AudioContext): void {
    if (!this.voiceGain) this.voiceGain = context.createGain();
    if (!this.voicePan) {
      this.voicePan = context.createStereoPanner();
      this.voicePan.pan.value = this.voicePanValue;
    }
    if (!this.monitorGain) {
      this.monitorGain = context.createGain();
      this.monitorGain.connect(this.ensureMaster(context));
    }
  }

  private connectInputPath(): void {
    if (!this.inputSource || !this.analyser) return;
    this.inputSource.disconnect();
    this.inputSource.connect(this.analyser);
    if (this.monitoring && this.voiceGain && this.voicePan && this.monitorGain) {
      this.inputSource.connect(this.voiceGain);
      this.voiceGain.connect(this.voicePan);
      this.voicePan.connect(this.monitorGain);
    } else {
      this.voiceGain?.disconnect();
      this.voicePan?.disconnect();
    }
  }

  private applyMix(): void {
    const context = this.context;
    if (!context) return;
    const soloActive = this.inputSolo || this.referenceSolo;
    const voiceAudible = this.monitoring && !this.inputMuted && (!soloActive || this.inputSolo);
    const referenceAudible = !this.referenceMuted && (!soloActive || this.referenceSolo);
    if (this.voiceGain) this.voiceGain.gain.setTargetAtTime(this.inputVolume, context.currentTime, 0.015);
    if (this.monitorGain) {
      this.monitorGain.gain.setTargetAtTime(
        voiceAudible ? this.monitorVolume : 0,
        context.currentTime,
        0.015
      );
    }
    if (this.referenceGain) {
      this.referenceGain.gain.setTargetAtTime(
        referenceAudible ? this.referenceVolume : 0,
        context.currentTime,
        0.015
      );
    }
    if (this.masterGain) this.masterGain.gain.setTargetAtTime(this.masterVolume, context.currentTime, 0.015);
  }

  private applyReferenceSeparation(): void {
    const context = this.context;
    if (!context || !this.referenceDirectGain) return;
    const original = this.referenceSeparation === "original";
    this.referenceDirectGain.gain.setTargetAtTime(original ? 1 : 0, context.currentTime, 0.015);
    this.referenceSeparationGain?.gain.setTargetAtTime(original ? 0 : 1, context.currentTime, 0.015);
    const coefficients = this.referenceSeparation === "center-removed"
      ? [0.5, 0.5, -0.5, -0.5]
      : [0.5, 0.5, 0.5, 0.5];
    this.referenceMatrixGains.forEach((gain, index) => {
      gain.gain.setTargetAtTime(coefficients[index] ?? 0, context.currentTime, 0.015);
    });
  }

  private startMeter(): void {
    const analyse = (): void => {
      let inputLevel = 0;
      let inputClip = false;
      let pitchHz: number | null = null;
      if (this.analyser && this.inputStream) {
        const samples = new Float32Array(this.analyser.fftSize);
        this.analyser.getFloatTimeDomainData(samples);
        let energy = 0;
        for (const sample of samples) {
          energy += sample * sample;
          if (Math.abs(sample) >= 0.999) inputClip = true;
        }
        const rms = Math.sqrt(energy / samples.length);
        inputLevel = Math.min(1, rms * 3.2);
        this.pitchFrame += 1;
        if (this.pitchFrame % 5 === 0) {
          this.lastPitchHz = this.detectPitch(samples, this.context?.sampleRate ?? 48000);
        }
        pitchHz = this.lastPitchHz;
      }
      let outputLevel = 0;
      let outputClip = false;
      if (this.outputAnalyser) {
        const outputSamples = new Float32Array(this.outputAnalyser.fftSize);
        this.outputAnalyser.getFloatTimeDomainData(outputSamples);
        for (const sample of outputSamples) {
          outputLevel = Math.max(outputLevel, Math.abs(sample));
          if (outputLevel >= 0.999) outputClip = true;
        }
      }
      let referenceLevel = 0;
      let referencePitchHz: number | null = null;
      if (this.referenceAnalyser) {
        if (this.referenceElement && !this.referenceElement.paused && !this.referenceElement.ended) {
          const referenceSamples = new Float32Array(this.referenceAnalyser.fftSize);
          this.referenceAnalyser.getFloatTimeDomainData(referenceSamples);
          for (const sample of referenceSamples) referenceLevel = Math.max(referenceLevel, Math.abs(sample));
          this.referencePitchFrame += 1;
          if (this.referencePitchFrame % 5 === 0) {
            this.lastReferencePitchHz = this.detectPitch(referenceSamples, this.context?.sampleRate ?? 48000);
          }
          referencePitchHz = this.lastReferencePitchHz;
        } else {
          this.lastReferencePitchHz = null;
        }
      }
      this.update({ inputLevel, inputClip, pitchHz, referencePitchHz, outputLevel, outputClip, referenceLevel });
      if (this.context && this.context.state !== "closed") {
        this.meterFrame = requestAnimationFrame(analyse);
      } else {
        this.meterFrame = 0;
      }
    };
    this.meterFrame = requestAnimationFrame(analyse);
  }

  private stopMeter(): void {
    if (this.meterFrame) cancelAnimationFrame(this.meterFrame);
    this.meterFrame = 0;
  }

  private detectPitch(samples: Float32Array, sampleRate: number): number | null {
    let rms = 0;
    for (const sample of samples) rms += sample * sample;
    if (Math.sqrt(rms / samples.length) < 0.01) return null;
    let bestOffset = -1;
    let bestCorrelation = 0;
    const minOffset = Math.floor(sampleRate / 1000);
    const maxOffset = Math.min(Math.floor(sampleRate / 65), samples.length - 1);
    for (let offset = minOffset; offset <= maxOffset; offset += 1) {
      let correlation = 0;
      for (let index = 0; index < samples.length - offset; index += 2) {
        correlation += samples[index]! * samples[index + offset]!;
      }
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = offset;
      }
    }
    return bestOffset > 0 && bestCorrelation > 1 ? sampleRate / bestOffset : null;
  }

  private update(patch: Partial<AudioSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener(this.snapshot);
  }

  private errorMessage(error: unknown): string {
    if (error instanceof DOMException) {
      if (error.name === "NotFoundError" || error.name === "OverconstrainedError") return "dispositivo indisponível";
      if (error.name === "NotAllowedError") return "permissão de microfone não concedida";
    }
    return error instanceof Error ? error.message : "erro desconhecido";
  }
}
