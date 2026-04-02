/**
 * Sound Engine — all sounds are synthesized via Web Audio API.
 * No file loading. Single shared AudioContext. Rate-limited per sound type.
 */

type SoundName =
  | "dragTick"      // resize-bar knob click (repeated during drag)
  | "dragStop"      // resize-bar release
  | "aiOpen"        // AI panel opens — celestial ascending arpeggio
  | "calendarLift"  // calendar event drag starts
  | "calendarDrop"  // calendar event dropped
  | "moduleAdd"     // module added to sidebar
  | "uiClick"       // generic micro-click
  | "mallyWhoosh"   // Mally text box focus — short air whoosh
  | "mallyChoir"    // Mally pill click — angelic choir reveal
  | "viewSwipe"     // calendar prev/next navigation — directional swoosh
  | "drawerOpen"    // calendar dropdown open — cupboard/drawer creak
  | "gearClick"     // settings — soft metallic gear tick
  | "themeDay"      // switch to light theme — rising bright tone
  | "themeNight"    // switch to dark theme — descending mellow tone
  | "themeSystem"   // switch to system theme — soft neutral ping
  | "eventOpen"     // event dialog opens — soft chime
  | "pageSwitch"    // sidebar page navigation — paper-turn swoosh
  | "lightClick"    // very subtle click for minor UI buttons
  | "typingKey"     // mechanical key press during typing
  | "micOn"         // Mally mic activated — ready ping
  | "feedbackOpen"  // feedback tab click — papery flick
  | "todayClick";   // today button / shortcut — soft anchor chime

const STORAGE_KEY = "mally-sounds-enabled";
const RATE_LIMITS: Record<SoundName, number> = {
  dragTick:      30,
  dragStop:      200,
  aiOpen:        500,
  calendarLift:  200,
  calendarDrop:  200,
  moduleAdd:     300,
  uiClick:       80,
  mallyWhoosh:   300,
  mallyChoir:    600,
  viewSwipe:     120,
  drawerOpen:    300,
  gearClick:     200,
  themeDay:      400,
  themeNight:    400,
  themeSystem:   400,
  eventOpen:     300,
  pageSwitch:    120,
  lightClick:    60,
  typingKey:     60,
  micOn:         400,
  feedbackOpen:  200,
  todayClick:    300,
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  private lastPlayed: Partial<Record<SoundName, number>> = {};
  private _enabled: boolean;
  private paperRustleNode: { src: AudioBufferSourceNode; gain: GainNode } | null = null;

  constructor() {
    const saved = localStorage.getItem(STORAGE_KEY);
    this._enabled = saved !== null ? saved === "true" : true;
  }

  get enabled() { return this._enabled; }

  setEnabled(val: boolean) {
    this._enabled = val;
    localStorage.setItem(STORAGE_KEY, String(val));
  }

  toggle() {
    const next = !this._enabled;
    this.setEnabled(next);
    return next;
  }

  private getCtx(): AudioContext | null {
    if (!this._enabled) return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return null;
      }
    }
    // Resume if suspended (browsers require user gesture)
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  play(name: SoundName) {
    if (!this._enabled) return;
    const now = performance.now();
    const last = this.lastPlayed[name] ?? 0;
    if (now - last < RATE_LIMITS[name]) return;
    this.lastPlayed[name] = now;

    const ctx = this.getCtx();
    if (!ctx) return;

    const t = ctx.currentTime;
    switch (name) {
      case "dragTick":    this._dragTick(ctx, t); break;
      case "dragStop":    this._dragStop(ctx, t); break;
      case "aiOpen":      this._aiOpen(ctx, t); break;
      case "calendarLift": this._calendarLift(ctx, t); break;
      case "calendarDrop": this._calendarDrop(ctx, t); break;
      case "moduleAdd":   this._moduleAdd(ctx, t); break;
      case "uiClick":     this._uiClick(ctx, t); break;
      case "mallyWhoosh": this._mallyWhoosh(ctx, t); break;
      case "mallyChoir":  this._mallyChoir(ctx, t); break;
      case "viewSwipe":   this._viewSwipe(ctx, t); break;
      case "drawerOpen":  this._drawerOpen(ctx, t); break;
      case "gearClick":   this._gearClick(ctx, t); break;
      case "themeDay":    this._themeDay(ctx, t); break;
      case "themeNight":  this._themeNight(ctx, t); break;
      case "themeSystem": this._themeSystem(ctx, t); break;
      case "eventOpen":   this._eventOpen(ctx, t); break;
      case "pageSwitch":  this._pageSwitch(ctx, t); break;
      case "lightClick":  this._lightClick(ctx, t); break;
      case "typingKey":   this._typingKey(ctx, t); break;
      case "micOn":       this._micOn(ctx, t); break;
      case "feedbackOpen": this._feedbackOpen(ctx, t); break;
      case "todayClick":   this._todayClick(ctx, t); break;
    }
  }

  /** Soft two-note anchor chime for "go to today" — 200ms */
  private _todayClick(ctx: AudioContext, t: number) {
    // E5 quick hit → C5 soft landing — "you are here"
    [[659.25, 0, 0.032, 0.09], [523.25, 0.055, 0.042, 0.16]].forEach(([freq, delay, peak, decay]) => {
      const onset = t + delay;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, onset);
      g.gain.linearRampToValueAtTime(peak, onset + 0.007);
      g.gain.exponentialRampToValueAtTime(0.001, onset + decay);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(onset);
      osc.stop(onset + decay + 0.01);
    });
  }

  /** Papery "shk" flick for feedback tab click — bandpass noise sweep, 80ms */
  private _feedbackOpen(ctx: AudioContext, t: number) {
    const len = Math.floor(ctx.sampleRate * 0.08);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.35));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.setValueAtTime(900, t);
    filt.frequency.exponentialRampToValueAtTime(3000, t + 0.06);
    filt.Q.value = 0.9;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    src.connect(filt);
    filt.connect(gain);
    gain.connect(ctx.destination);
    src.start(t);
  }

  /** Start a continuous looping paper rustle — call stopPaperRustle() to end it */
  startPaperRustle() {
    if (!this._enabled || this.paperRustleNode) return;
    const ctx = this.getCtx();
    if (!ctx) return;

    // 40ms bandpass-filtered noise, looped seamlessly
    const len = Math.floor(ctx.sampleRate * 0.04);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = 2200;
    filt.Q.value = 0.7;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.028, ctx.currentTime + 0.03);

    src.connect(filt);
    filt.connect(gain);
    gain.connect(ctx.destination);
    src.start();

    this.paperRustleNode = { src, gain };
  }

  /** Fade out and stop the looping paper rustle */
  stopPaperRustle() {
    if (!this.paperRustleNode) return;
    const ctx = this.getCtx();
    if (!ctx) return;

    const { src, gain } = this.paperRustleNode;
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    try { src.stop(t + 0.08); } catch { /* already stopped */ }
    this.paperRustleNode = null;
  }

  // ── Individual sounds ────────────────────────────────────────────────────

  /** Mechanical knob tick — band-passed noise burst, 15ms */
  private _dragTick(ctx: AudioContext, t: number) {
    const len = Math.floor(ctx.sampleRate * 0.015);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.25));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = 3500;
    filt.Q.value = 1.2;
    const gain = ctx.createGain();
    gain.gain.value = 0.18;
    src.connect(filt);
    filt.connect(gain);
    gain.connect(ctx.destination);
    src.start(t);
  }

  /** Soft landing when drag stops */
  private _dragStop(ctx: AudioContext, t: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(420, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.09);
    gain.gain.setValueAtTime(0.09, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.13);
  }

  /** Celestial ascending arpeggio: C5 → E5 → G5 → C6 */
  private _aiOpen(ctx: AudioContext, t: number) {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    const masterGain = ctx.createGain();
    masterGain.gain.value = 1;
    masterGain.connect(ctx.destination);

    notes.forEach((freq, i) => {
      const onset = t + i * 0.09;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, onset);
      g.gain.linearRampToValueAtTime(0.08, onset + 0.018);
      g.gain.exponentialRampToValueAtTime(0.001, onset + 0.55);
      osc.connect(g);
      g.connect(masterGain);
      osc.start(onset);
      osc.stop(onset + 0.6);

      const osc2 = ctx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.value = freq * 2.756;
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0, onset);
      g2.gain.linearRampToValueAtTime(0.025, onset + 0.012);
      g2.gain.exponentialRampToValueAtTime(0.001, onset + 0.25);
      osc2.connect(g2);
      g2.connect(masterGain);
      osc2.start(onset);
      osc2.stop(onset + 0.3);
    });
  }

  /** Soft "lift" when dragging a calendar event */
  private _calendarLift(ctx: AudioContext, t: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(280, t);
    osc.frequency.exponentialRampToValueAtTime(480, t + 0.1);
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.linearRampToValueAtTime(0.07, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  /** Satisfying thunk when dropping a calendar event */
  private _calendarDrop(ctx: AudioContext, t: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(340, t);
    osc.frequency.exponentialRampToValueAtTime(75, t + 0.13);
    gain.gain.setValueAtTime(0.16, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.2);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.value = 1200;
    gain2.gain.setValueAtTime(0.06, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(t);
    osc2.stop(t + 0.05);
  }

  /** Bubble pop when adding a module */
  private _moduleAdd(ctx: AudioContext, t: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(720, t + 0.05);
    osc.frequency.exponentialRampToValueAtTime(420, t + 0.13);
    gain.gain.setValueAtTime(0.13, t);
    gain.gain.setValueAtTime(0.13, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.19);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.21);
  }

  /** Generic micro-click — short high-passed noise, 12ms */
  private _uiClick(ctx: AudioContext, t: number) {
    const len = Math.floor(ctx.sampleRate * 0.012);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.2));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = "highpass";
    filt.frequency.value = 2200;
    const gain = ctx.createGain();
    gain.gain.value = 0.12;
    src.connect(filt);
    filt.connect(gain);
    gain.connect(ctx.destination);
    src.start(t);
  }

  /** Short air whoosh for Mally text box focus — filtered noise sweep, 90ms */
  private _mallyWhoosh(ctx: AudioContext, t: number) {
    const len = Math.floor(ctx.sampleRate * 0.09);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.setValueAtTime(600, t);
    filt.frequency.exponentialRampToValueAtTime(3800, t + 0.07);
    filt.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0, t);
    gain.gain.linearRampToValueAtTime(0.22, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.085);
    src.connect(filt);
    filt.connect(gain);
    gain.connect(ctx.destination);
    src.start(t);
  }

  /**
   * Angelic choir reveal for Mally pill click.
   * Four-voice major 7th chord with vibrato and shimmer overtones (~650ms).
   */
  private _mallyChoir(ctx: AudioContext, t: number) {
    const voices = [523.25, 659.25, 783.99, 987.77];
    const master = ctx.createGain();
    master.gain.value = 0.38; // reduced from 0.9 — noticeably quieter
    master.connect(ctx.destination);

    voices.forEach((freq, i) => {
      const onset = t + i * 0.028;

      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;

      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 5.5 + i * 0.4;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = freq * 0.007;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0, onset);
      g.gain.linearRampToValueAtTime(0.055, onset + 0.04);
      g.gain.setValueAtTime(0.055, onset + 0.22);
      g.gain.exponentialRampToValueAtTime(0.001, onset + 0.62);

      osc.connect(g);
      g.connect(master);
      osc.start(onset);
      osc.stop(onset + 0.65);
      lfo.start(onset);
      lfo.stop(onset + 0.65);

      const shimmer = ctx.createOscillator();
      shimmer.type = "sine";
      shimmer.frequency.value = freq * 2.0;
      const sg = ctx.createGain();
      sg.gain.setValueAtTime(0, onset);
      sg.gain.linearRampToValueAtTime(0.018, onset + 0.03);
      sg.gain.exponentialRampToValueAtTime(0.001, onset + 0.35);
      shimmer.connect(sg);
      sg.connect(master);
      shimmer.start(onset);
      shimmer.stop(onset + 0.38);
    });

    // Rising sparkle sweep
    const sweep = ctx.createOscillator();
    sweep.type = "sine";
    sweep.frequency.setValueAtTime(1200, t);
    sweep.frequency.exponentialRampToValueAtTime(2800, t + 0.18);
    const sg2 = ctx.createGain();
    sg2.gain.setValueAtTime(0, t);
    sg2.gain.linearRampToValueAtTime(0.04, t + 0.02);
    sg2.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    sweep.connect(sg2);
    sg2.connect(master);
    sweep.start(t);
    sweep.stop(t + 0.25);
  }

  /**
   * Cinema-quality directional whoosh for calendar nav — 120ms.
   * Two-layer: airy noise sweep + tonal glide gives it body and direction.
   */
  private _viewSwipe(ctx: AudioContext, t: number) {
    const master = ctx.createGain();
    master.gain.value = 1.0;
    master.connect(ctx.destination);

    // Layer 1: noise band — the "air" of the whoosh
    const len = Math.floor(ctx.sampleRate * 0.12);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;

    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.setValueAtTime(300, t);
    filt.frequency.exponentialRampToValueAtTime(3000, t + 0.09);
    filt.Q.value = 0.7;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, t);
    noiseGain.gain.linearRampToValueAtTime(0.14, t + 0.018);
    noiseGain.gain.setValueAtTime(0.14, t + 0.055);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.115);

    src.connect(filt);
    filt.connect(noiseGain);
    noiseGain.connect(master);
    src.start(t);

    // Layer 2: tonal glide — gives the whoosh a musical "shape"
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(780, t + 0.08);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0, t);
    oscGain.gain.linearRampToValueAtTime(0.055, t + 0.015);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    osc.connect(oscGain);
    oscGain.connect(master);
    osc.start(t);
    osc.stop(t + 0.11);
  }

  /** Cupboard/drawer opening — low thunk + friction creak, 180ms */
  private _drawerOpen(ctx: AudioContext, t: number) {
    const thunk = ctx.createOscillator();
    thunk.type = "sine";
    thunk.frequency.setValueAtTime(110, t);
    thunk.frequency.exponentialRampToValueAtTime(55, t + 0.06);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.12, t);
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    thunk.connect(tg);
    tg.connect(ctx.destination);
    thunk.start(t);
    thunk.stop(t + 0.09);

    const len = Math.floor(ctx.sampleRate * 0.14);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.sin(i * 0.18);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.setValueAtTime(320, t + 0.02);
    filt.frequency.linearRampToValueAtTime(480, t + 0.14);
    filt.Q.value = 2.5;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.0, t + 0.02);
    cg.gain.linearRampToValueAtTime(0.08, t + 0.05);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    src.connect(filt);
    filt.connect(cg);
    cg.connect(ctx.destination);
    src.start(t + 0.02);
  }

  /** Soft metallic gear tick for settings — 3 rapid metallic clicks, 120ms */
  private _gearClick(ctx: AudioContext, t: number) {
    const clickTimes = [0, 0.038, 0.072];
    clickTimes.forEach((offset) => {
      const onset = t + offset;
      const len = Math.floor(ctx.sampleRate * 0.018);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.3));
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filt = ctx.createBiquadFilter();
      filt.type = "bandpass";
      filt.frequency.value = 3200 + offset * 800;
      filt.Q.value = 4.0;
      const gain = ctx.createGain();
      gain.gain.value = 0.1 - offset * 0.03;
      src.connect(filt);
      filt.connect(gain);
      gain.connect(ctx.destination);
      src.start(onset);
    });
  }

  /** Rising bright tone for switching to light/day theme — 260ms */
  private _themeDay(ctx: AudioContext, t: number) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(500, t);
    osc.frequency.exponentialRampToValueAtTime(1400, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.045, t + 0.025);
    g.gain.setValueAtTime(0.045, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.26);

    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1000, t);
    osc2.frequency.exponentialRampToValueAtTime(2800, t + 0.14);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0, t);
    g2.gain.linearRampToValueAtTime(0.02, t + 0.02);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc2.connect(g2);
    g2.connect(ctx.destination);
    osc2.start(t);
    osc2.stop(t + 0.2);
  }

  /**
   * Soft muffled exhale for dark theme — 220ms.
   * Filtered noise only (no tones), low-pass sweeps down — like a room going quiet.
   */
  private _themeNight(ctx: AudioContext, t: number) {
    const len = Math.floor(ctx.sampleRate * 0.22);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.55));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;

    // Low-pass descends from 350Hz → 70Hz — muffles to near silence
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.setValueAtTime(350, t);
    filt.frequency.exponentialRampToValueAtTime(70, t + 0.18);
    filt.Q.value = 0.4;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0, t);
    gain.gain.linearRampToValueAtTime(0.07, t + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    src.connect(filt);
    filt.connect(gain);
    gain.connect(ctx.destination);
    src.start(t);
  }

  /** Soft neutral ping for switching to system theme — 150ms */
  private _themeSystem(ctx: AudioContext, t: number) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 880;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.08, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.15);

    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = 880 * 2.756;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0, t);
    g2.gain.linearRampToValueAtTime(0.025, t + 0.006);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc2.connect(g2);
    g2.connect(ctx.destination);
    osc2.start(t);
    osc2.stop(t + 0.09);
  }

  /** Very soft tap when event dialog opens — 80ms */
  private _eventOpen(ctx: AudioContext, t: number) {
    // Single gentle sine tap at C5 — unobtrusive, matches a light touch
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 523.25;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.02, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  /** Sidebar page navigation — light paper-turn swish, 90ms */
  private _pageSwitch(ctx: AudioContext, t: number) {
    const len = Math.floor(ctx.sampleRate * 0.09);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;

    // High-mid bandpass — papery, airy
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.setValueAtTime(1200, t);
    filt.frequency.exponentialRampToValueAtTime(3500, t + 0.06);
    filt.Q.value = 1.4;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.085);

    src.connect(filt);
    filt.connect(gain);
    gain.connect(ctx.destination);
    src.start(t);
  }

  /** Very subtle feather-light click for minor UI buttons — 8ms */
  private _lightClick(ctx: AudioContext, t: number) {
    const len = Math.floor(ctx.sampleRate * 0.008);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.15));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = "highpass";
    filt.frequency.value = 3500;
    const gain = ctx.createGain();
    gain.gain.value = 0.045; // very quiet
    src.connect(filt);
    filt.connect(gain);
    gain.connect(ctx.destination);
    src.start(t);
  }

  /**
   * Mechanical typewriter key — ultra-short bandpass noise, 7ms.
   * Rate-limited to 60ms so rapid typing stays musical not noisy.
   */
  private _typingKey(ctx: AudioContext, t: number) {
    const len = Math.floor(ctx.sampleRate * 0.007);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.2));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;

    // Mechanical "clack" — mid-high bandpass 1.8-3kHz
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = 1800 + Math.random() * 400; // slight pitch variation per key
    filt.Q.value = 2.2;

    const gain = ctx.createGain();
    gain.gain.value = 0.055;

    src.connect(filt);
    filt.connect(gain);
    gain.connect(ctx.destination);
    src.start(t);
  }

  /** Mic activated — confident upward ping + short whoosh, 100ms */
  private _micOn(ctx: AudioContext, t: number) {
    // Rising ping
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(480, t);
    osc.frequency.exponentialRampToValueAtTime(960, t + 0.07);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.1);

    // Breathy onset noise
    const len = Math.floor(ctx.sampleRate * 0.045);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const nd = buf.getChannelData(0);
    for (let i = 0; i < len; i++) nd[i] = Math.random() * 2 - 1;
    const nsrc = ctx.createBufferSource();
    nsrc.buffer = buf;
    const nf = ctx.createBiquadFilter();
    nf.type = "highpass";
    nf.frequency.value = 3000;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.07, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    nsrc.connect(nf);
    nf.connect(ng);
    ng.connect(ctx.destination);
    nsrc.start(t);
  }

}

export const sounds = new SoundEngine();

/** Convenience hook — returns enabled state. Toggle via sounds.toggle() */
export function useSoundEnabled() {
  return sounds.enabled;
}
