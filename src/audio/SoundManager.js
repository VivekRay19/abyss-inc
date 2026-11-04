// Procedural Web Audio API Sound Engine for ABYSS INC.
// Provides underwater hydrophone ambiance, mechanical crawler rumble, cutter grind,
// nodule collection pops, sonar pings, riser transfer chimes, and restoration harmonics.

export class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.initialized = false;
    this.ambientGain = null;
    this.machineryGain = null;
    this.crawlerOsc = null;
    this.cutterOsc = null;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.initialized = true;
      this.setupContinuousLoops();
    } catch (e) {
      // Ignore audio initialization failures if blocked by browser policy
    }
  }

  resume() {
    if (!this.initialized) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setTargetAtTime(this.muted ? 0 : 0.08, this.ctx.currentTime, 0.1);
    }
    if (this.machineryGain && this.ctx && this.muted) {
      this.machineryGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
    }
    return this.muted;
  }

  setupContinuousLoops() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // 1. Deep-ocean low-pass noise & hydrophone hum
    const bufferSize = this.ctx.sampleRate * 3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 175;

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.setValueAtTime(this.muted ? 0 : 0.07, now);

    noise.connect(filter);
    filter.connect(this.ambientGain);
    this.ambientGain.connect(this.ctx.destination);
    noise.start(now);

    // 2. Continuous Machinery / Crawler Engine Hum (modulated by activity)
    this.machineryGain = this.ctx.createGain();
    this.machineryGain.gain.setValueAtTime(0.0, now);

    this.crawlerOsc = this.ctx.createOscillator();
    this.crawlerOsc.type = 'sawtooth';
    this.crawlerOsc.frequency.setValueAtTime(46, now);

    this.cutterOsc = this.ctx.createOscillator();
    this.cutterOsc.type = 'triangle';
    this.cutterOsc.frequency.setValueAtTime(92, now);

    const machFilter = this.ctx.createBiquadFilter();
    machFilter.type = 'lowpass';
    machFilter.frequency.setValueAtTime(220, now);

    this.crawlerOsc.connect(machFilter);
    this.cutterOsc.connect(machFilter);
    machFilter.connect(this.machineryGain);
    this.machineryGain.connect(this.ctx.destination);

    this.crawlerOsc.start(now);
    this.cutterOsc.start(now);
  }

  updateMachinerySound(isMoving, isMining, isRestoring) {
    if (!this.initialized || !this.ctx || this.muted) return;
    const now = this.ctx.currentTime;

    let targetGain = 0.008;
    let baseFreq = 44;
    let secondFreq = 88;

    if (isMining) {
      targetGain = 0.055;
      baseFreq = 58 + Math.sin(now * 18) * 6;
      secondFreq = 135 + Math.cos(now * 28) * 14;
    } else if (isRestoring) {
      targetGain = 0.04;
      baseFreq = 110;
      secondFreq = 220 + Math.sin(now * 8) * 18;
    } else if (isMoving) {
      targetGain = 0.032;
      baseFreq = 52;
      secondFreq = 104;
    }

    this.machineryGain.gain.setTargetAtTime(targetGain, now, 0.12);
    this.crawlerOsc.frequency.setTargetAtTime(baseFreq, now, 0.1);
    this.cutterOsc.frequency.setTargetAtTime(secondFreq, now, 0.1);
  }

  playSonarPing(freq = 880) {
    if (this.muted) return;
    this.resume();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.96, now + 0.65);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.68);
  }

  playNoduleCollect() {
    if (this.muted) return;
    this.resume();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const base = 310 + Math.random() * 140;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.65, now + 0.14);

    gain.gain.setValueAtTime(0.075, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.16);
  }

  playCashDeposit() {
    if (this.muted) return;
    this.resume();
    if (!this.ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const now = this.ctx.currentTime + idx * 0.065;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.36);
    });
  }

  playRestorationChime() {
    if (this.muted) return;
    this.resume();
    if (!this.ctx) return;

    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      const now = this.ctx.currentTime + idx * 0.08;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.55);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.58);
    });
  }

  playRuleChangeAlert() {
    if (this.muted) return;
    this.resume();
    if (!this.ctx) return;

    const freqs = [220, 277.18, 329.63];
    freqs.forEach((f, idx) => {
      const now = this.ctx.currentTime + idx * 0.09;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 600;

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.46);
    });
  }
}
