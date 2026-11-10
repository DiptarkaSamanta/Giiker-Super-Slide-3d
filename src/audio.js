// Procedural Audio Engine for GiiKER Super Slide
// Built using Web Audio API - Zero external asset dependencies

class GiikerAudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('giiker_sound_muted') === 'true';
    this.initOnFirstGesture = this.initOnFirstGesture.bind(this);
    window.addEventListener('pointerdown', this.initOnFirstGesture, { once: true });
    window.addEventListener('keydown', this.initOnFirstGesture, { once: true });
  }

  initOnFirstGesture() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('giiker_sound_muted', this.muted);
    return this.muted;
  }

  isMuted() {
    return this.muted;
  }

  // Tactile plastic snap / click when piece locks into grid
  playSnap(pitch = 1.0) {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    
    // Crisp click impulse
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(640 * pitch, t);
    osc.frequency.exponentialRampToValueAtTime(160 * pitch, t + 0.045);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.05);

    // Subtle magnetic tactile thump
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(180 * pitch, t);
    osc2.frequency.exponentialRampToValueAtTime(60 * pitch, t + 0.06);

    gain2.gain.setValueAtTime(0.25, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.065);

    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start(t);
    osc2.stop(t + 0.065);
  }

  // Smooth sliding friction sound
  playSlide(speed = 1.0) {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    // Soft low-frequency whoosh
    osc.type = 'sine';
    osc.frequency.setValueAtTime(260 * speed, t);
    osc.frequency.exponentialRampToValueAtTime(380 * speed, t + 0.04);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  // Handheld console electronic button click
  playBtnClick() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(440, t + 0.025);

    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.03);
  }

  // Authentic GiiKER 8-bit Level Beep
  playLevelBeep(levelNum = 1) {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const num = typeof levelNum === 'number' ? levelNum : (parseInt(String(levelNum).replace(/\D/g, '')) || 1);
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const freq = 520 + (num % 10) * 40;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.setValueAtTime(freq * 1.5, t + 0.04);

    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  // Sweet hint arpeggio
  playHint() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const notes = [587.33, 739.99, 880.00, 1174.66]; // D5, F#5, A5, D6
    notes.forEach((freq, idx) => {
      const t = this.ctx.currentTime + idx * 0.05;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.16);
    });
  }

  // Restart / Reset chime
  playReset() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const notes = [659.25, 523.25, 392.00]; // E5, C5, G4
    notes.forEach((freq, idx) => {
      const t = this.ctx.currentTime + idx * 0.06;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.12);
    });
  }

  // Wall bump / Illegal slide thud
  playBump() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.08);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  // Celebratory victory fanfare
  playVictory() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const arpeggio = [
      { f: 523.25, d: 0.10 }, // C5
      { f: 659.25, d: 0.10 }, // E5
      { f: 783.99, d: 0.10 }, // G5
      { f: 1046.50, d: 0.22 }, // C6
      { f: 880.00, d: 0.10 }, // A5
      { f: 1046.50, d: 0.12 }, // C6
      { f: 1318.51, d: 0.45 }  // E6
    ];

    let start = this.ctx.currentTime;
    arpeggio.forEach((note) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.f, start);

      gain.gain.setValueAtTime(0.24, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + note.d);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(start);
      osc.stop(start + note.d);
      start += note.d * 0.85;
    });
  }
}

window.giikerAudio = new GiikerAudioEngine();

