import { AudioEngine, type AudioSnapshot } from "./audio-engine";
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Elemento principal não encontrado.");

app.innerHTML = `
  <div class="studio-shell">
    <header class="topbar">
      <a class="brand" href="#" aria-label="SILVA XVI Audio Comparer">
        <span class="brand-mark">S</span>
        <span>SILVA XVI <b>AC</b><small>AUDIO COMPARER · DARK STUDIO</small></span>
      </a>
      <nav class="menu"><span>Projeto</span><span>Editar</span><button id="open-separator">Separador</button><button id="open-tuner">Afinador</button><span>Análise</span></nav>
      <div class="project-name"><span class="live-dot"></span> SESSÃO DE TREINO <i>•</i> SEM TÍTULO</div>
      <button class="icon-button settings" title="Configurações" aria-label="Configurações">⚙</button>
    </header>

    <section class="toolbar" aria-label="Transporte">
      <div class="transport">
        <button class="tool-button" id="to-start" title="Ir para o início">|◀</button>
        <button class="tool-button play-button" id="play" title="Reproduzir">▶</button>
        <button class="tool-button" id="stop" title="Parar">■</button>
        <span class="toolbar-divider"></span>
        <button class="tool-button record-button" id="record" title="Testar microfone">●</button>
      </div>
      <div class="time-readout"><span>POSIÇÃO</span><strong id="position">00:00.000</strong></div>
      <div class="toolbar-spacer"></div>
      <label class="speed-control">VELOCIDADE
        <select id="speed">
          <option value="0.5">50%</option><option value="0.75">75%</option><option value="0.9">90%</option>
          <option value="1" selected>100%</option><option value="1.1">110%</option><option value="1.25">125%</option>
        </select>
      </label>
      <button class="primary-button import-button" id="import-button"><span>＋</span> Importar áudio</button>
      <button class="text-button install-pwa" id="install-pwa" hidden>Instalar app</button>
      <input id="audio-file" type="file" accept="audio/*,.wav,.mp3,.flac,.m4a,.ogg" hidden />
    </section>

    <main class="workspace">
      <aside class="sidebar">
        <div class="section-heading"><span>DISPOSITIVOS DE ÁUDIO</span><label class="default-devices"><input id="use-default-devices" type="checkbox" checked /> PADRÃO DO WINDOWS</label><span class="tiny-status" id="device-indicator">●</span></div>
        <section class="device-card">
          <div class="card-title"><span class="icon-tile mic-tile">◖</span><div><b>ENTRADA</b><small>Microfone e instrumentos</small></div><button class="text-button device-discovery" id="refresh-devices" title="Solicitar acesso para listar os dispositivos">Detectar</button></div>
          <label class="field-label" for="input-device">DISPOSITIVO DE ENTRADA</label>
          <select class="device-select" id="input-device" disabled><option value="">Padrão do Windows</option></select>
          <div class="meter-label"><span>NÍVEL DE ENTRADA</span><span id="input-db">— dB</span></div>
          <div class="level-meter"><div class="meter-fill" id="input-meter"></div><div class="meter-peak"></div></div>
          <div class="pitch-reading"><span>NOTA DETECTADA</span><strong id="pitch">—</strong><small id="frequency">Aguardando sinal</small></div>
          <button class="outline-button" id="test-input">Testar microfone</button>
        </section>

        <section class="device-card output-card">
          <div class="card-title"><span class="icon-tile output-tile">◖</span><div><b>SAÍDA</b><small>Monitor e referência</small></div></div>
          <label class="field-label" for="output-device">DISPOSITIVO DE SAÍDA</label>
          <select class="device-select" id="output-device" disabled><option value="">Padrão do Windows</option></select>
          <div class="output-test-row"><span>Tom de teste · 440 Hz</span><button id="test-output" class="text-button">▶ Testar</button></div>
          <label class="monitor-toggle"><input id="monitor" type="checkbox" /><span class="toggle"></span><span><b>Monitorar minha voz</b><small>Use fones para evitar microfonia</small></span></label>
          <div class="warning" id="feedback-warning" hidden>⚠ Monitoramento ativo — confira o volume e use fones.</div>
        </section>

        <section class="device-card config-card">
          <div class="card-title compact-title"><span class="icon-tile config-tile">⌁</span><div><b>CONFIGURAÇÃO</b><small>Engine de áudio</small></div></div>
          <label class="field-label" for="sample-rate">TAXA DE AMOSTRAGEM</label>
          <select class="device-select" id="sample-rate">
            <option value="44100">44.1 kHz</option><option value="48000" selected>48 kHz</option>
            <option value="88200">88.2 kHz</option><option value="96000">96 kHz</option>
          </select>
          <label class="field-label buffer-label" for="buffer-size">BUFFER · ESTIMATIVA</label>
          <select class="device-select" id="buffer-size">
            <option value="64">64 samples · baixa latência</option><option value="128" selected>128 samples · equilibrado</option>
            <option value="256">256 samples</option><option value="512">512 samples · estável</option><option value="1024">1024 samples</option>
          </select>
          <div class="latency-line"><span>LATÊNCIA ESTIMADA</span><b id="latency">2.7 ms</b></div>
          <p class="config-note">O Windows controla o buffer físico; latência real depende do driver e dispositivo.</p>
        </section>
      </aside>

      <section class="arrangement">
        <div class="arrangement-head">
          <div><span class="section-kicker">ARRANJO</span><h1>Seu espaço de treino</h1></div>
          <div class="zoom-tools"><button id="zoom-out" title="Diminuir zoom">−</button><span id="zoom-label">100%</span><button id="zoom-in" title="Aumentar zoom">＋</button></div>
        </div>
        <div class="timeline-ruler"><span>00:00</span><span>00:15</span><span>00:30</span><span>00:45</span><span>01:00</span><span>01:15</span><span>01:30</span></div>
        <div class="tracks">
          <div class="track-labels">
            <div class="track-label reference-label"><span class="track-icon">♫</span><div><b>REFERÊNCIA</b><small id="reference-name">Importe uma música para começar</small></div><span class="track-menu">···</span></div>
            <div class="track-label voice-label"><span class="track-icon">⌁</span><div><b>SUA VOZ</b><small id="voice-track-status">Pronta para testar</small></div><span class="track-menu">···</span></div>
            <div class="track-label pitch-label"><span class="track-icon">♬</span><div><b>ANÁLISE DE PITCH</b><small>Entrada em tempo real</small></div><span class="track-menu">···</span></div>
          </div>
          <div class="track-canvas-wrap" id="track-area">
            <div class="grid-lines"><i></i><i></i><i></i><i></i><i></i><i></i></div>
            <div class="track-lane reference-lane"><canvas id="waveform" aria-label="Forma de onda da referência"></canvas><div class="empty-track" id="empty-track"><span>♫</span><b>Nenhuma referência carregada</b><small>Importe um arquivo de áudio para visualizar a forma de onda</small><button class="text-button" id="empty-import">Escolher arquivo</button></div></div>
            <div class="track-lane voice-lane"><div class="voice-lane-content" id="voice-lane-content">Aguardando captura de voz</div></div>
            <div class="track-lane pitch-lane"><canvas id="pitch-trail" aria-label="Histórico das notas detectadas na voz e na referência"></canvas><div class="reference-pitch" id="reference-pitch" hidden><span>REF</span><strong id="reference-pitch-note">—</strong><small id="reference-pitch-frequency"></small></div><div class="pitch-placeholder" id="pitch-placeholder"><span>♪</span> Cante para visualizar sua nota em tempo real</div><div class="playhead" id="playhead"></div></div>
          </div>
        </div>
        <div class="timeline-footer"><span><i class="legend-dot reference-dot"></i> Faixa de referência</span><span><i class="legend-dot voice-dot"></i> Entrada de voz</span><span class="timeline-hint">Rastro de notas durante a reprodução · Clique na faixa para posicionar</span></div>

        <section class="mixer">
          <div class="mixer-header"><div><span class="section-kicker">CONTROLE DE NÍVEIS</span><h2>Mixer</h2></div><span class="mixer-tag">SAÍDA ESTÉREO</span></div>
          <div class="mixer-channels">
            <div class="channel" data-channel="voice">
              <div class="channel-top"><span class="channel-icon voice-icon">⌁</span><div><b>VOZ</b><small>Entrada selecionada</small></div><div class="channel-actions"><button class="channel-toggle" data-action="mute" data-target="voice" aria-label="Silenciar voz">M</button><button class="channel-toggle solo-toggle" data-action="solo" data-target="voice" aria-label="Solo voz">S</button></div></div>
              <div class="channel-meter"><span>MIC</span><div class="small-meter"><i id="mixer-voice-meter"></i></div><span id="mixer-voice-db">—</span></div>
              <label class="slider-label">VOLUME <span id="voice-volume-value">80%</span><input type="range" min="0" max="100" value="80" data-volume="voice" /></label>
              <label class="slider-label pan-label">PAN <span>C</span><input type="range" min="-100" max="100" value="0" data-pan="voice" /></label>
            </div>
            <div class="channel" data-channel="reference">
              <div class="channel-top"><span class="channel-icon reference-icon">♫</span><div><b>REFERÊNCIA</b><small>Música importada</small></div><div class="channel-actions"><button class="channel-toggle" data-action="mute" data-target="reference" aria-label="Silenciar referência">M</button><button class="channel-toggle solo-toggle" data-action="solo" data-target="reference" aria-label="Solo referência">S</button></div></div>
              <div class="channel-meter"><span>REF</span><div class="small-meter"><i class="reference-meter"></i></div><span>—</span></div>
              <label class="slider-label">VOLUME <span id="reference-volume-value">70%</span><input type="range" min="0" max="100" value="70" data-volume="reference" /></label>
              <label class="slider-label pan-label">PAN <span>C</span><input type="range" min="-100" max="100" value="0" data-pan="reference" /></label>
            </div>
            <div class="channel monitor-channel">
              <div class="channel-top"><span class="channel-icon monitor-icon">◖</span><div><b>MONITOR</b><small>Retorno da voz</small></div></div>
              <div class="channel-meter"><span>OUT</span><div class="small-meter"><i class="monitor-meter"></i></div><span>—</span></div>
              <label class="slider-label">VOLUME <span id="monitor-volume-value">35%</span><input type="range" min="0" max="100" value="35" data-volume="monitor" /></label>
              <div class="channel-footnote">Ative o monitoramento no painel de entrada</div>
            </div>
            <div class="channel master-channel">
              <div class="channel-top"><span class="channel-icon master-icon">▥</span><div><b>MASTER</b><small>Saída principal</small></div></div>
              <div class="master-meter-row"><div class="master-meter"><i id="master-meter"></i></div><div class="master-meter"><i id="master-meter-right"></i></div></div>
              <label class="slider-label">VOLUME <span id="master-volume-value">85%</span><input type="range" min="0" max="100" value="85" data-volume="master" /></label>
              <div class="channel-footnote" id="master-peak">PICO  — dBFS</div>
            </div>
          </div>
        </section>
      </section>
    </main>

    <dialog class="tool-dialog" id="separator-dialog" aria-labelledby="separator-title">
      <form method="dialog" class="dialog-close-row"><button class="dialog-close" aria-label="Fechar">×</button></form>
      <span class="section-kicker">PROCESSAMENTO DE REFERÊNCIA</span>
      <h2 id="separator-title">Separador de voz e instrumentos</h2>
      <p class="tool-description">Na faixa estéreo, escolha a voz central ou remova o centro para destacar os instrumentos laterais. Este método por fase não é separação por IA e não isola fontes panoramizadas.</p>
      <label class="field-label" for="reference-separation">MODO DA FAIXA</label>
      <select class="device-select" id="reference-separation">
        <option value="original">Original (sem separação)</option>
        <option value="center" disabled>Destacar voz central</option>
        <option value="center-removed" disabled>Reduzir voz central · destacar instrumentos</option>
      </select>
      <small class="separator-status" id="separator-status">Importe uma faixa estéreo para ativar a separação.</small>
      <button class="outline-button" id="close-separator" type="button">Concluído</button>
    </dialog>

    <dialog class="tool-dialog tuner-dialog" id="tuner-dialog" aria-labelledby="tuner-title">
      <form method="dialog" class="dialog-close-row"><button class="dialog-close" aria-label="Fechar">×</button></form>
      <span class="section-kicker">AFINADOR CROMÁTICO</span>
      <h2 id="tuner-title">Afinador de instrumentos</h2>
      <p class="tool-description">Toque uma corda ou nota isolada perto do microfone. O afinador compara a frequência captada com o temperamento igual.</p>
      <label class="field-label" for="tuner-reference">REFERÊNCIA DE AFINAÇÃO</label>
      <select class="device-select" id="tuner-reference">
        <option value="440">Lá4 · 440 Hz</option><option value="442">Lá4 · 442 Hz</option><option value="432">Lá4 · 432 Hz</option>
      </select>
      <div class="tuner-readout"><strong id="tuner-note">—</strong><span id="tuner-frequency">Aguardando microfone</span></div>
      <div class="tuner-gauge" aria-label="Indicador de afinação"><div class="tuner-center"></div><i id="tuner-needle"></i></div>
      <div class="tuner-scale"><span>♭ grave</span><b id="tuner-cents">0 cent</b><span>agudo ♯</span></div>
      <p class="tuner-status" id="tuner-status">Abra o afinador e permita o acesso ao microfone.</p>
      <button class="outline-button" id="close-tuner" type="button">Concluído</button>
    </dialog>

    <footer class="statusbar">
      <span class="status-device"><i class="status-icon">◖</i> MIC <b id="status-input">Padrão</b></span>
      <span class="status-device"><i class="status-icon output-status-icon">◖</i> OUT <b id="status-output">Padrão</b></span>
      <span class="status-setting">RATE <b id="status-rate">48 kHz</b></span>
      <span class="status-setting">BUFFER <b id="status-buffer">128</b></span>
      <span class="latency-status">LATÊNCIA <b id="status-latency">2.7 ms*</b></span>
      <span class="status-setting app-version">VERSÃO <b id="app-version"></b></span>
      <span class="status-good" id="audio-status"><i></i><b>ÁUDIO PRONTO</b></span>
    </footer>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>
  </div>
`;

const engine = new AudioEngine();
const $ = <T extends HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Elemento ausente: ${selector}`);
  return element;
};
const inputDevice = $("#input-device") as HTMLSelectElement;
const outputDevice = $("#output-device") as HTMLSelectElement;
const inputMeter = $("#input-meter");
const inputDb = $("#input-db");
const pitchDisplay = $("#pitch");
const frequencyDisplay = $("#frequency");
const testInputButton = $("#test-input");
const toast = $("#toast");
$("#app-version").textContent = `${__APP_VERSION__}+${__BUILD_ID__}`;
const audioElement: { current: HTMLAudioElement | null } = { current: null };
type PitchSource = "reference" | "voice";
type PitchSegment = { time: number; end: number; midi: number; source: PitchSource };
const pitchSegments: PitchSegment[] = [];
const activePitch = new Map<PitchSource, number>();
const candidatePitch = new Map<PitchSource, { midi: number; count: number }>();
const separatorDialog = $("#separator-dialog") as HTMLDialogElement;
const tunerDialog = $("#tuner-dialog") as HTMLDialogElement;
const tunerReference = $("#tuner-reference") as HTMLSelectElement;
let tunerStartedInput = false;
let lastTrailTime = 0;
let referenceDuration = 0;
let zoom = 100;
let toastTimer = 0;
let lastDeviceSignature = "";
let lastNotice = "";
let referencePeaks: number[] | null = null;
let previousInput = "";
let previousOutput = "";

function showNotice(message: string): void {
  if (!message) return;
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 5200);
}

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

let pendingInstallPrompt: InstallPromptEvent | null = null;
const installPwaButton = $("#install-pwa") as HTMLButtonElement;

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  pendingInstallPrompt = event as InstallPromptEvent;
  installPwaButton.hidden = false;
});

window.addEventListener("appinstalled", () => {
  pendingInstallPrompt = null;
  installPwaButton.hidden = true;
  showNotice("SILVA XVI Audio Comparer instalado.");
});

installPwaButton.addEventListener("click", async () => {
  const registration = await navigator.serviceWorker?.getRegistration();
  if (registration?.waiting) {
    reloadAfterPwaUpdate = true;
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
    installPwaButton.disabled = true;
    return;
  }
  if (!pendingInstallPrompt) return;
  try {
    await pendingInstallPrompt.prompt();
    const choice = await pendingInstallPrompt.userChoice;
    pendingInstallPrompt = null;
    installPwaButton.hidden = true;
    if (choice.outcome === "accepted") showNotice("Instalação do aplicativo iniciada.");
  } catch (error) {
    showNotice(`Não foi possível iniciar a instalação: ${error instanceof Error ? error.message : "erro desconhecido"}`);
  }
});

let reloadAfterPwaUpdate = false;
async function registerPwa(): Promise<void> {
  if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") return;
  if (!("serviceWorker" in navigator)) {
    showNotice("Este navegador não oferece suporte ao modo PWA offline.");
    return;
  }
  try {
    const registration = await navigator.serviceWorker.register("./sw.js", {
      scope: "./",
      updateViaCache: "none"
    });
    const announceUpdate = (): void => {
      if (registration.waiting) {
        installPwaButton.textContent = "Atualizar app";
        installPwaButton.hidden = false;
        showNotice("Nova versão disponível. Clique em “Atualizar app” quando quiser recarregar.");
      }
    };
    registration.addEventListener("updatefound", () => {
      const installing = registration.installing;
      installing?.addEventListener("statechange", () => {
        if (installing.state === "installed" && navigator.serviceWorker.controller) announceUpdate();
      });
    });
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloadAfterPwaUpdate) window.location.reload();
    });
    if (registration.waiting) announceUpdate();
    await registration.update();
  } catch (error) {
    console.error("Falha ao registrar ou atualizar o PWA:", error);
    showNotice(`Não foi possível ativar ou atualizar o PWA: ${error instanceof Error ? error.message : "erro desconhecido"}`);
  }
}

function setOptions(select: HTMLSelectElement, devices: AudioSnapshot["inputs"], selected: string): void {
  const current = selected || select.value;
  const previousLabel = select.selectedOptions[0]?.textContent ?? "Dispositivo desconectado";
  select.replaceChildren(new Option("Padrão do Windows", ""));
  for (const device of devices) {
    if (device.id === "default") continue;
    select.add(new Option(device.label, device.id));
  }
  if (current && ![...select.options].some((option) => option.value === current)) {
    select.add(new Option(`${previousLabel} (desconectado)`, current));
  }
  select.value = current;
}

function midiName(midi: number): string {
  const notes = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
  return `${notes[(midi % 12 + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

function noteName(hz: number, referenceA = 440): string {
  return midiName(Math.round(69 + 12 * Math.log2(hz / referenceA)));
}

function tunerReading(hz: number): { midi: number; target: number; cents: number } {
  const referenceA = Number(tunerReference.value);
  const midi = Math.round(69 + 12 * Math.log2(hz / referenceA));
  const target = referenceA * 2 ** ((midi - 69) / 12);
  return { midi, target, cents: 1200 * Math.log2(hz / target) };
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = (seconds % 60).toFixed(3).padStart(6, "0");
  return `${minutes}:${secs}`;
}

function drawWaveform(peaks: number[]): void {
  const canvas = $("#waveform") as HTMLCanvasElement;
  const bounds = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(bounds.width * ratio));
  canvas.height = Math.max(1, Math.floor(bounds.height * ratio));
  const context = canvas.getContext("2d");
  if (!context) return;
  context.scale(ratio, ratio);
  const middle = bounds.height / 2;
  const step = bounds.width / peaks.length;
  peaks.forEach((value, index) => {
    const height = Math.max(2, value * bounds.height * 0.88);
    context.fillStyle = index % 8 === 0 ? "#52c9a1" : "#388f77";
    context.fillRect(index * step, middle - height / 2, Math.max(1, step - 1), height);
  });
}

function drawPitchTrail(): void {
  const canvas = $("#pitch-trail") as HTMLCanvasElement;
  const bounds = canvas.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(bounds.width * ratio));
  canvas.height = Math.max(1, Math.floor(bounds.height * ratio));
  const context = canvas.getContext("2d");
  if (!context) return;
  context.scale(ratio, ratio);
  context.clearRect(0, 0, bounds.width, bounds.height);
  if (!referenceDuration) return;
  const duration = referenceDuration;
  for (const segment of pitchSegments) {
    const start = Math.max(0, segment.time / duration) * bounds.width;
    const end = Math.min(duration, Math.max(segment.end, segment.time + 0.08)) / duration * bounds.width;
    if (end < 0 || start > bounds.width) continue;
    const rowTop = segment.source === "reference" ? 6 : bounds.height / 2 + 3;
    const rowHeight = bounds.height / 2 - 12;
    const noteY = rowTop + (84 - Math.max(36, Math.min(84, segment.midi))) / 48 * rowHeight;
    context.fillStyle = segment.source === "reference" ? "#57c394" : "#a28add";
    context.globalAlpha = segment.source === "reference" ? 0.88 : 0.9;
    context.fillRect(start, noteY, Math.max(3, end - start), 5);
    if (end - start > 20) {
      context.globalAlpha = 1;
      context.fillStyle = "#f4f0ff";
      context.font = '8px "DM Mono", monospace';
      context.fillText(midiName(segment.midi), start + 2, noteY - 2);
    }
  }
  context.globalAlpha = 1;
}

function latestPitchSegment(source: PitchSource, midi: number): PitchSegment | undefined {
  for (let index = pitchSegments.length - 1; index >= 0; index -= 1) {
    const segment = pitchSegments[index]!;
    if (segment.source === source && segment.midi === midi) return segment;
  }
  return undefined;
}

function collectPitch(source: PitchSource, hz: number | null, time: number): void {
  if (hz === null || !Number.isFinite(hz)) {
    candidatePitch.delete(source);
    const midi = activePitch.get(source);
    if (midi !== undefined) {
      const current = latestPitchSegment(source, midi);
      if (current) current.end = Math.max(current.time, time);
      activePitch.delete(source);
    }
    return;
  }
  const midi = Math.round(69 + 12 * Math.log2(hz / 440));
  if (activePitch.get(source) === midi) {
    const current = latestPitchSegment(source, midi);
    if (current) current.end = Math.max(current.end, time);
    return;
  }
  const candidate = candidatePitch.get(source);
  if (!candidate || candidate.midi !== midi) {
    candidatePitch.set(source, { midi, count: 1 });
    return;
  }
  candidate.count += 1;
  if (candidate.count < 2) return;
  const previousMidi = activePitch.get(source);
  if (previousMidi !== undefined) {
    const previous = latestPitchSegment(source, previousMidi);
    if (previous) previous.end = Math.max(previous.time, time);
  }
  pitchSegments.push({ time, end: time + 0.08, midi, source });
  if (pitchSegments.length > 1200) pitchSegments.splice(0, pitchSegments.length - 1200);
  activePitch.set(source, midi);
  candidatePitch.delete(source);
  drawPitchTrail();
}

function updateTuner(hz: number | null, state: AudioSnapshot["inputState"]): void {
  const note = $("#tuner-note");
  const frequency = $("#tuner-frequency");
  const centsLabel = $("#tuner-cents");
  const needle = $("#tuner-needle");
  const status = $("#tuner-status");
  if (hz === null || state !== "active") {
    note.textContent = "—";
    frequency.textContent = state === "error" ? "Falha na entrada" : "Aguardando microfone";
    centsLabel.textContent = "0 cent";
    needle.style.left = "50%";
    needle.classList.remove("in-tune");
    status.textContent = state === "error" ? "Não foi possível captar o microfone; confira a permissão e o dispositivo." : "Toque uma corda ou nota isolada perto do microfone.";
    return;
  }
  const reading = tunerReading(hz);
  const cents = Math.max(-50, Math.min(50, reading.cents));
  note.textContent = midiName(reading.midi);
  frequency.textContent = `${hz.toFixed(1)} Hz · alvo ${reading.target.toFixed(1)} Hz`;
  centsLabel.textContent = `${reading.cents > 0 ? "+" : ""}${reading.cents.toFixed(0)} cent`;
  needle.style.left = `${50 + cents}%`;
  needle.classList.toggle("in-tune", Math.abs(reading.cents) <= 5);
  status.textContent = Math.abs(reading.cents) <= 5 ? "Afinado" : reading.cents < 0 ? "Abaixo da nota · aperte a corda" : "Acima da nota · solte um pouco";
}

function updateSnapshot(snapshot: AudioSnapshot): void {
  const signature = JSON.stringify([
    snapshot.inputs.map(({ id, label }) => [id, label]),
    snapshot.outputs.map(({ id, label }) => [id, label])
  ]);
  if (signature !== lastDeviceSignature) {
    setOptions(inputDevice, snapshot.inputs, inputDevice.value);
    setOptions(outputDevice, snapshot.outputs, outputDevice.value);
    lastDeviceSignature = signature;
  }
  const normalized = snapshot.inputLevel;
  if (audioElement.current && !audioElement.current.paused && !audioElement.current.ended) {
    const time = audioElement.current.currentTime;
    if (time < lastTrailTime - 0.5) {
      for (let index = pitchSegments.length - 1; index >= 0; index -= 1) {
        if (pitchSegments[index]!.time > time) pitchSegments.splice(index, 1);
      }
      activePitch.clear();
      candidatePitch.clear();
      drawPitchTrail();
    }
    lastTrailTime = time;
    collectPitch("reference", snapshot.referencePitchHz, time);
    collectPitch("voice", snapshot.inputState === "active" ? snapshot.pitchHz : null, time);
  } else {
    collectPitch("reference", null, lastTrailTime);
    collectPitch("voice", null, lastTrailTime);
  }
  updateTuner(snapshot.pitchHz, snapshot.inputState);
  inputMeter.style.width = `${Math.min(100, normalized * 100)}%`;
  inputMeter.classList.toggle("clipping", snapshot.inputClip);
  const db = normalized > 0 ? Math.max(-60, 20 * Math.log10(normalized)).toFixed(1) : "−∞";
  inputDb.textContent = `${db} dB`;
  $("#mixer-voice-meter").style.width = `${Math.min(100, normalized * 100)}%`;
  $("#mixer-voice-db").textContent = normalized > 0 ? `${db} dB` : "−∞";
  $(".reference-meter").style.width = `${Math.min(100, snapshot.referenceLevel * 100)}%`;
  $(".monitor-meter").style.width = `${Math.min(100, normalized * 100)}%`;
  if (snapshot.pitchHz) {
    pitchDisplay.textContent = noteName(snapshot.pitchHz);
    frequencyDisplay.textContent = `${snapshot.pitchHz.toFixed(1)} Hz`;
    $("#pitch-placeholder").innerHTML = `<span>♪</span> ${noteName(snapshot.pitchHz)} · ${snapshot.pitchHz.toFixed(1)} Hz`;
  } else {
    pitchDisplay.textContent = "—";
    frequencyDisplay.textContent = snapshot.inputState === "active" ? "Cante ou fale" : "Aguardando sinal";
    $("#pitch-placeholder").innerHTML = `<span>♪</span> ${snapshot.inputState === "active" ? "Cante para visualizar sua nota em tempo real" : "Aguardando entrada de áudio"}`;
  }
  const referencePitch = $("#reference-pitch");
  referencePitch.toggleAttribute("hidden", snapshot.referencePitchHz === null);
  if (snapshot.referencePitchHz !== null) {
    $("#reference-pitch-note").textContent = noteName(snapshot.referencePitchHz);
    $("#reference-pitch-frequency").textContent = `${snapshot.referencePitchHz.toFixed(1)} Hz`;
  }
  testInputButton.textContent = snapshot.inputState === "active" ? "Parar teste de microfone" : "Testar microfone";
  $("#voice-track-status").textContent = snapshot.inputState === "active" ? "Capturando entrada ao vivo" : "Pronta para testar";
  $("#voice-lane-content").textContent = snapshot.inputState === "active"
    ? snapshot.inputLevel > 0 ? `Sinal de entrada · ${db} dB` : "Entrada ativa · aguardando sinal"
    : snapshot.inputState === "disconnected" ? "Dispositivo desconectado" : "Aguardando captura de voz";
  $("#device-indicator").classList.toggle("device-error", snapshot.inputState === "error" || snapshot.inputState === "disconnected" || snapshot.outputState !== "ready");
  $("#status-input").textContent = inputDevice.selectedOptions[0]?.textContent ?? "Padrão";
  $("#status-output").textContent = outputDevice.selectedOptions[0]?.textContent ?? "Padrão";
  if (snapshot.sampleRate) $("#status-rate").textContent = `${(snapshot.sampleRate / 1000).toFixed(snapshot.sampleRate % 1000 === 0 ? 0 : 1)} kHz`;
  const status = $("#audio-status");
  const problem = snapshot.inputState === "error" || snapshot.inputState === "disconnected" || snapshot.outputState !== "ready";
  status.classList.toggle("status-error", problem);
  status.innerHTML = `<i></i><b>${problem ? "VERIFICAR ÁUDIO" : snapshot.inputState === "active" ? "ÁUDIO ATIVO" : "ÁUDIO PRONTO"}</b>`;
  if (snapshot.notice && snapshot.notice !== lastNotice) showNotice(snapshot.notice);
  lastNotice = snapshot.notice;
  $("#feedback-warning").toggleAttribute("hidden", !(($("#monitor") as HTMLInputElement).checked));
  const outputDb = snapshot.outputLevel > 0 ? Math.max(-60, 20 * Math.log10(snapshot.outputLevel)).toFixed(1) : "—";
  $("#master-meter").style.height = `${Math.min(100, snapshot.outputLevel * 100)}%`;
  $("#master-meter-right").style.height = `${Math.min(100, snapshot.outputLevel * 92)}%`;
  $("#master-peak").textContent = snapshot.outputClip ? "CLIP · REDUZA O NÍVEL" : `PICO  ${outputDb} dBFS`;
  $("#master-peak").classList.toggle("clip-text", snapshot.outputClip);
  $(".monitor-channel").classList.toggle("monitor-active", snapshot.inputLevel > 0 && ($("#monitor") as HTMLInputElement).checked);
}

async function chooseInput(value: string): Promise<void> {
  try {
    await engine.setInputDevice(value);
  } catch {
    inputDevice.value = value;
  }
}

$("#import-button").addEventListener("click", () => ($("#audio-file") as HTMLInputElement).click());
$("#empty-import").addEventListener("click", () => ($("#audio-file") as HTMLInputElement).click());
$("#audio-file").addEventListener("change", async (event) => {
  const file = (event.currentTarget as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const { element, peaks, channels } = await engine.loadReference(file);
    referencePeaks = peaks;
    audioElement.current = element;
    referenceDuration = element.duration || 0;
    lastTrailTime = 0;
    pitchSegments.length = 0;
    activePitch.clear();
    candidatePitch.clear();
    drawPitchTrail();
    const separationSelect = $("#reference-separation") as HTMLSelectElement;
    const stereoAvailable = channels >= 2;
    separationSelect.options[1]!.disabled = !stereoAvailable;
    separationSelect.options[2]!.disabled = !stereoAvailable;
    separationSelect.value = "original";
    $("#separator-status").textContent = stereoAvailable
      ? "Faixa estéreo: centralize ou reduza o conteúdo do centro. O resultado depende da mixagem."
      : "Faixa mono: separação por centro indisponível. A faixa original continua intacta.";
    element.addEventListener("loadedmetadata", () => {
      referenceDuration = element.duration;
      drawPitchTrail();
    });
    element.addEventListener("timeupdate", () => {
      $("#position").textContent = formatTime(element.currentTime);
      if (referenceDuration > 0) $("#playhead").style.left = `${(element.currentTime / referenceDuration) * 100}%`;
      drawPitchTrail();
    });
    element.addEventListener("ended", () => {
      $("#play").textContent = "▶";
    });
    $("#reference-name").textContent = file.name;
    $("#empty-track").classList.add("hidden");
    $("#play").removeAttribute("disabled");
    drawWaveform(peaks);
    showNotice(`Referência carregada: ${file.name}`);
  } catch (error) {
    showNotice(`Não foi possível carregar o áudio: ${error instanceof Error ? error.message : "arquivo inválido"}`);
  }
});

$("#play").addEventListener("click", async () => {
  if (!audioElement.current) {
    showNotice("Importe uma faixa de áudio para iniciar a reprodução.");
    return;
  }
  if (audioElement.current.paused) {
    try {
      await audioElement.current.play();
      $("#play").textContent = "Ⅱ";
    } catch (error) {
      showNotice(`Falha na reprodução: ${error instanceof Error ? error.message : "erro de áudio"}`);
    }
  } else {
    audioElement.current.pause();
    $("#play").textContent = "▶";
  }
});

$("#stop").addEventListener("click", () => {
  if (audioElement.current) {
    audioElement.current.pause();
    audioElement.current.currentTime = 0;
  }
  $("#position").textContent = "00:00.000";
  $("#playhead").style.left = "0";
  $("#play").textContent = "▶";
});
$("#to-start").addEventListener("click", () => {
  if (audioElement.current) audioElement.current.currentTime = 0;
});
$("#open-separator").addEventListener("click", () => separatorDialog.showModal());
$("#close-separator").addEventListener("click", () => separatorDialog.close());
$("#reference-separation").addEventListener("change", (event) => {
  const select = event.currentTarget as HTMLSelectElement;
  try {
    engine.setReferenceSeparation(select.value as "original" | "center" | "center-removed");
    const status = $("#separator-status");
    if (select.value === "center") {
      status.textContent = "Voz central destacada. Vocais fora do centro podem permanecer na faixa instrumental.";
    } else if (select.value === "center-removed") {
      status.textContent = "Centro reduzido. Vozes e instrumentos centralizados também podem ser atenuados.";
    }
  } catch (error) {
    select.value = "original";
    showNotice(error instanceof Error ? error.message : "Não foi possível aplicar a separação.");
  }
});
$("#open-tuner").addEventListener("click", async () => {
  tunerDialog.showModal();
  if (engine.getSnapshot().inputState === "active") {
    tunerStartedInput = false;
    return;
  }
  tunerStartedInput = true;
  try {
    await engine.startInput();
  } catch (error) {
    tunerStartedInput = false;
    $("#tuner-status").textContent = `Não foi possível iniciar o microfone: ${error instanceof Error ? error.message : "erro de áudio"}`;
  }
});
$("#close-tuner").addEventListener("click", () => tunerDialog.close());
tunerDialog.addEventListener("close", () => {
  if (tunerStartedInput) engine.stopInput();
  tunerStartedInput = false;
});
tunerReference.addEventListener("change", () => updateTuner(engine.getSnapshot().pitchHz, engine.getSnapshot().inputState));
$("#record").addEventListener("click", () => testInputButton.click());
$("#refresh-devices").addEventListener("click", async (event) => {
  const button = event.currentTarget as HTMLButtonElement;
  button.disabled = true;
  try {
    await engine.discoverDevices();
  } catch (error) {
    showNotice(`Não foi possível detectar os dispositivos: ${error instanceof Error ? error.message : "erro de áudio"}`);
  } finally {
    button.disabled = false;
  }
});
testInputButton.addEventListener("click", async () => {
  if (engine.getSnapshot().inputState === "active") {
    engine.stopInput();
    return;
  }
  try {
    await engine.startInput();
  } catch {
    // The device manager publishes the actionable error in the status panel.
  }
});

inputDevice.addEventListener("change", () => void chooseInput(inputDevice.value));
outputDevice.addEventListener("change", async () => {
  try {
    await engine.setOutputDevice(outputDevice.value);
  } catch {
    // The selected device remains visible; the status panel reports the failure.
  }
});
$("#test-output").addEventListener("click", async () => {
  try {
    await engine.playTestTone();
  } catch (error) {
    showNotice(`Não foi possível testar a saída: ${error instanceof Error ? error.message : "erro de áudio"}`);
  }
});
$("#monitor").addEventListener("change", async (event) => {
  try {
    await engine.setMonitoring((event.currentTarget as HTMLInputElement).checked);
  } catch {
    (event.currentTarget as HTMLInputElement).checked = false;
  }
});

document.querySelectorAll<HTMLInputElement>("[data-volume]").forEach((slider) => {
  const channel = slider.dataset.volume as "voice" | "reference" | "monitor" | "master";
  slider.addEventListener("input", () => {
    engine.setChannelVolume(channel, Number(slider.value) / 100);
    $(`#${channel}-volume-value`).textContent = `${slider.value}%`;
  });
});
document.querySelectorAll<HTMLInputElement>("[data-pan]").forEach((slider) => {
  const channel = slider.dataset.pan as "voice" | "reference";
  slider.addEventListener("input", () => engine.setPan(channel, Number(slider.value) / 100));
});
$("#use-default-devices").addEventListener("change", async (event) => {
  const enabled = (event.currentTarget as HTMLInputElement).checked;
  if (enabled) {
    previousInput = inputDevice.value;
    previousOutput = outputDevice.value;
    inputDevice.value = "";
    outputDevice.value = "";
  }
  inputDevice.disabled = enabled;
  outputDevice.disabled = enabled;
  if (!enabled) {
    inputDevice.value = previousInput;
    outputDevice.value = previousOutput;
  }
  try {
    await engine.setInputDevice(inputDevice.value);
    await engine.setOutputDevice(outputDevice.value);
  } catch {
    // Audio state and any device-open failure are reported by the engine.
  }
});
document.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((button) => {
  button.addEventListener("click", () => {
    const channel = button.dataset.target as "voice" | "reference";
    const action = button.dataset.action;
    const active = !button.classList.contains("active");
    button.classList.toggle("active", active);
    if (action === "mute") engine.setMute(channel, active);
    if (action === "solo") engine.setSolo(channel, active);
  });
});
$("#speed").addEventListener("change", (event) => {
  if (audioElement.current) audioElement.current.playbackRate = Number((event.currentTarget as HTMLSelectElement).value);
});
$("#sample-rate").addEventListener("change", async (event) => {
  const select = event.currentTarget as HTMLSelectElement;
  try {
    const actualRate = await engine.setSampleRate(Number(select.value));
    $("#status-rate").textContent = `${(actualRate / 1000).toFixed(actualRate % 1000 === 0 ? 0 : 1)} kHz`;
  } catch (error) {
    select.value = String(engine.getSnapshot().sampleRate ?? 48000);
    showNotice(error instanceof Error ? error.message : "Não foi possível alterar a taxa de amostragem.");
  }
});
$("#buffer-size").addEventListener("change", (event) => {
  const size = Number((event.currentTarget as HTMLSelectElement).value);
  $("#status-buffer").textContent = String(size);
  $("#latency").textContent = `${((size / Number(($("#sample-rate") as HTMLSelectElement).value)) * 1000).toFixed(1)} ms`;
  $("#status-latency").textContent = `${((size / Number(($("#sample-rate") as HTMLSelectElement).value)) * 1000).toFixed(1)} ms*`;
});
$("#sample-rate").addEventListener("change", () => {
  const size = Number(($("#buffer-size") as HTMLSelectElement).value);
  const rate = Number(($("#sample-rate") as HTMLSelectElement).value);
  $("#latency").textContent = `${((size / rate) * 1000).toFixed(1)} ms`;
  $("#status-latency").textContent = `${((size / rate) * 1000).toFixed(1)} ms*`;
});
$("#zoom-in").addEventListener("click", () => {
  zoom = Math.min(300, zoom + 25);
  $("#zoom-label").textContent = `${zoom}%`;
  $("#waveform").style.width = `${zoom}%`;
});
$("#zoom-out").addEventListener("click", () => {
  zoom = Math.max(50, zoom - 25);
  $("#zoom-label").textContent = `${zoom}%`;
  $("#waveform").style.width = `${zoom}%`;
});
$("#track-area").addEventListener("click", (event) => {
  if (!audioElement.current || !referenceDuration || (event.target as HTMLElement).closest("button")) return;
  const bounds = $(".track-canvas-wrap").getBoundingClientRect();
  const offset = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
  audioElement.current.currentTime = offset * referenceDuration;
});
document.addEventListener("keydown", (event) => {
  if (event.code === "Space" && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLSelectElement)) {
    event.preventDefault();
    ($("#play") as HTMLButtonElement).click();
  }
});
window.addEventListener("resize", () => {
  drawPitchTrail();
  if ($("#empty-track").classList.contains("hidden")) {
    if (referencePeaks) drawWaveform(referencePeaks);
  }
});

engine.subscribe(updateSnapshot);
void engine.initialize();
void registerPwa();
window.addEventListener("beforeunload", () => void engine.dispose());
