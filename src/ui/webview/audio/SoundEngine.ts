/**
 * SoundEngine — Real audio assets for Digital Life
 *
 * Sound selection by the Dragon Quest Development Team:
 *   堀井雄二 — "音は0.5秒で意味を伝える"
 *
 * Architecture:
 *   1. PanelProvider reads MP3 files → base64 strings
 *   2. Passed via window.__SOUNDS__ (no network requests)
 *   3. Decoded to AudioBuffer on first user interaction
 *   4. Played via AudioBufferSourceNode (zero latency)
 *
 * No CSP changes needed — everything lives in memory.
 *
 * — 山田聡
 */

interface SoundStore {
  [key: string]: string; // base64-encoded MP3 (no data URI prefix)
}

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private buffers: Map<string, AudioBuffer> = new Map();
  private decoding = false;

  constructor() {
    // Defer decoding until first user gesture (AudioContext policy)
  }

  // ── Core ───────────────────────────────────────────────────

  private getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      // Kick off decoding on first context creation
      if (!this.decoding) { this.decodeAll(); }
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private decodeAll(): void {
    this.decoding = true;
    const store = (window as unknown as { __SOUNDS__?: SoundStore }).__SOUNDS__;
    if (!store) return;

    for (const [name, base64] of Object.entries(store)) {
      if (!base64) continue;
      this.decodeOne(name, base64);
    }
  }

  private decodeOne(name: string, base64: string): void {
    try {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      // decodeAudioData copies the buffer, so this is safe
      void this.getContext().decodeAudioData(
        bytes.buffer.slice(0),
        (decoded) => { this.buffers.set(name, decoded); },
      );
    } catch {
      // Silently skip corrupt files
    }
  }

  /** Play a named sound at the given volume (0-1). */
  private play(name: string, volume: number = 0.5): void {
    if (this.muted) return;
    const ctx = this.getContext();
    const buffer = this.buffers.get(name);
    if (!buffer) {
      // Buffer not yet decoded — fall back to tiny synth blip
      this.synthBlip();
      return;
    }

    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  }

  /** Minimal fallback while MP3s are still decoding */
  private synthBlip(): void {
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, now);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.06);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  // ── Public API ─────────────────────────────────────────────
  // Each method maps to a sound selected by the DQ team.
  //
  // Event            → Sound file               → Reason
  // ────────────────────────────────────────────────────────────
  // Feed (ごはん)     → マウスダブルクリック       → 小気味よいパクパク感
  // Pet / Care選択    → マウスクリック             → 軽いタッチ
  // Hatch (孵化)      → 8bitジャンプ3             → 殻から飛び出す
  // Commit            → 正解9                     → やったね！達成感
  // Level Up          → 8bitジャンプ              → ジャンプ = 成長
  // Death (別れ)      → 不正解3                   → 切なく短い
  // Heal (回復)       → 完了6                     → 完了 = 元気に
  // Speech (吹き出し) → 8bitかわす                → 最も軽い
  // Suggestion (提案) → 8bitアラート1             → 注意を引く
  // Approve (承認)    → 決定7                     → 決定音
  // Morning (朝)      → 電源オン                  → セッション開始
  // Error             → エラー1                   → そのまま
  // Friendship        → 出題3                     → 柔らかい呼びかけ
  // First Run         → 扉が開く2                 → 新しい世界への扉
  // Cancel            → 8bitアラート3             → 軽い否定

  setMuted(muted: boolean): void { this.muted = muted; }
  isMuted(): boolean { return this.muted; }

  playFeed(): void         { this.play('feed', 0.4); }
  playPet(): void          { this.play('pet', 0.35); }
  playHatch(): void        { this.play('hatch', 0.5); }
  playCommit(): void       { this.play('commit', 0.45); }
  playLevelUp(): void      { this.play('levelUp', 0.5); }
  playDeath(): void        { this.play('death', 0.4); }
  playHeal(): void         { this.play('heal', 0.45); }
  playSpeech(): void       { this.play('speech', 0.2); }
  playSuggestion(): void   { this.play('suggestion', 0.4); }
  playApprove(): void      { this.play('approve', 0.4); }
  playMorning(): void      { this.play('morning', 0.35); }
  playError(): void        { this.play('error', 0.35); }
  playFriendship(): void   { this.play('friendship', 0.25); }
  playFirstRun(): void     { this.play('firstRun', 0.45); }
  playCancel(): void       { this.play('cancel', 0.35); }
  playAgentSpawn(): void   { this.play('agentSpawn', 0.5); }
}
