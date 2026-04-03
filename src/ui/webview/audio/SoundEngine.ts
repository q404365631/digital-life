/**
 * SoundEngine — Web Audio API synthesizer for Digital Life
 *
 * Every sound is procedurally generated. No audio files.
 * Each sound tells a micro-story: a rising tone = growth,
 * a gentle chord = friendship, a descending sigh = farewell.
 */
export class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;

  private getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  setMuted(muted: boolean): void { this.muted = muted; }
  isMuted(): boolean { return this.muted; }

  // ── Helper: play a single oscillator note ──────────────────
  private note(
    type: OscillatorType, freq: number, duration: number,
    volume: number = 0.15, delay: number = 0,
    freqEnd?: number,
  ): void {
    const ctx = this.getContext();
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd !== undefined) {
      osc.frequency.linearRampToValueAtTime(freqEnd, t + duration);
    }
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.01);
    gain.gain.linearRampToValueAtTime(0, t + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration);
  }

  /** Short rising tone — feeding */
  playFeed(): void {
    if (this.muted) return;
    this.note('square', 300, 0.1, 0.12, 0, 600);
  }

  /** Soft sine — petting / gentle touch */
  playPet(): void {
    if (this.muted) return;
    this.note('sine', 440, 0.15, 0.12);
  }

  /** Cracking egg → ascending triad */
  playHatch(): void {
    if (this.muted) return;
    this.note('square', 200, 0.1, 0.12);
    this.note('square', 400, 0.1, 0.12, 0.1);
    this.note('square', 800, 0.12, 0.1, 0.2);
  }

  /** C-E-G arpeggio fanfare — commit */
  playCommit(): void {
    if (this.muted) return;
    this.note('square', 523, 0.1, 0.12);
    this.note('square', 659, 0.1, 0.12, 0.1);
    this.note('square', 784, 0.12, 0.12, 0.2);
  }

  /** Descending sigh — farewell */
  playDeath(): void {
    if (this.muted) return;
    this.note('triangle', 400, 0.4, 0.12, 0, 100);
  }

  // ── New sounds ─────────────────────────────────────────────

  /** Rising major third — healing / recovery */
  playHeal(): void {
    if (this.muted) return;
    this.note('sine', 392, 0.2, 0.1);        // G4
    this.note('sine', 494, 0.2, 0.1, 0.15);  // B4
    this.note('sine', 587, 0.3, 0.08, 0.3);  // D5
  }

  /** Tiny blip — speech bubble appears */
  playSpeech(): void {
    if (this.muted) return;
    this.note('sine', 880, 0.05, 0.06);
    this.note('sine', 1100, 0.04, 0.04, 0.04);
  }

  /** Warm dyad — friendship proximity */
  playFriendship(): void {
    if (this.muted) return;
    this.note('sine', 523, 0.3, 0.06);       // C5
    this.note('sine', 659, 0.3, 0.06);       // E5 (simultaneous = chord)
    this.note('triangle', 784, 0.2, 0.04, 0.2); // G5 gentle resolve
  }

  /** Gentle knock — creature has a suggestion */
  playSuggestion(): void {
    if (this.muted) return;
    this.note('triangle', 600, 0.08, 0.1);
    this.note('triangle', 600, 0.08, 0.1, 0.12);
    this.note('triangle', 800, 0.12, 0.08, 0.24);
  }

  /** Triumphant ascending C-E-G-C arpeggio — level up */
  playLevelUp(): void {
    if (this.muted) return;
    this.note('square', 523, 0.1, 0.1);       // C5
    this.note('square', 659, 0.1, 0.1, 0.08); // E5
    this.note('square', 784, 0.1, 0.1, 0.16); // G5
    this.note('square', 1047, 0.25, 0.12, 0.24); // C6 (hold)
  }

  /** Morning chime — session start / diary */
  playMorning(): void {
    if (this.muted) return;
    this.note('sine', 659, 0.2, 0.08);       // E5
    this.note('sine', 784, 0.2, 0.08, 0.15); // G5
    this.note('sine', 988, 0.3, 0.06, 0.3);  // B5
  }

  /** Quick error buzz */
  playError(): void {
    if (this.muted) return;
    this.note('sawtooth', 150, 0.15, 0.08);
    this.note('sawtooth', 120, 0.15, 0.08, 0.1);
  }
}
