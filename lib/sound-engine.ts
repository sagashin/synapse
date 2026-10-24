'use client';

import type {NBackLetter} from './adaptive-engine';

class SynapseSoundEngine {
  private ctx: AudioContext | null = null;
  public muted = false;

  private getContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as {webkitAudioContext: typeof AudioContext})
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public playUiClick(pitchMultiplier = 1.0) {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880 * pitchMultiplier, now);
    osc.frequency.exponentialRampToValueAtTime(1760 * pitchMultiplier, now + 0.045);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.055);
  }

  /**
   * Rewarding polyphonic major-9th synth chord on correct answer,
   * pitch-shifted subtly upward with combo count for maximum "Juice".
   */
  public playCorrectChord(combo = 1) {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const semitoneShift = Math.min(12, Math.max(0, combo - 1));
    const rootFreq = 440 * Math.pow(2, semitoneShift / 24);
    // Major 9th chord intervals: Root, Major 3rd, Perfect 5th, Major 7th, 9th
    const ratios = [1, 1.25, 1.5, 1.875, 2.25];

    ratios.forEach((ratio, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
      const startTime = now + idx * 0.018;
      osc.frequency.setValueAtTime(rootFreq * ratio, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.065 / Math.sqrt(idx + 1), startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0008, startTime + 0.34);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.36);
    });
  }

  public playWrongBuzz() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const freqs = [155, 146]; // dissonant minor second low buzz
    freqs.forEach((f) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.linearRampToValueAtTime(f * 0.82, now + 0.22);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    });
  }

  public playBdnfBoost(multiplier: number) {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes =
      multiplier >= 2.0
        ? [330, 440, 554.37, 659.25, 880]
        : multiplier > 1.0
          ? [330, 440, 554.37]
          : [440, 330];

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.055;
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.07, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  public playFlashPulse() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1320, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.06);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  public playLaserShot(isHit: boolean) {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = isHit ? 'triangle' : 'sawtooth';
    osc.frequency.setValueAtTime(isHit ? 1480 : 520, now);
    osc.frequency.exponentialRampToValueAtTime(isHit ? 280 : 110, now + 0.14);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);

    if (isHit) {
      this.playCorrectChord(3);
    }
  }

  /**
   * Dual N-Back Audio Stimulus:
   * Uses both Web Audio distinctive synth signature AND Web Speech API
   * so letters are crisp and unmistakable on all devices.
   */
  public playLetterStimulus(letter: NBackLetter) {
    if (this.muted || typeof window === 'undefined') return;

    const letterFreqMap: Record<NBackLetter, [number, number]> = {
      C: [261.63, 523.25],
      H: [293.66, 587.33],
      K: [329.63, 659.25],
      L: [349.23, 698.46],
      Q: [392.0, 783.99],
      R: [440.0, 880.0],
      S: [493.88, 987.77],
      T: [523.25, 1046.5],
    };

    const ctx = this.getContext();
    if (ctx) {
      const now = ctx.currentTime;
      const [f1, f2] = letterFreqMap[letter] || [440, 880];
      [f1, f2].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = idx === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.055, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
      });
    }

    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(letter);
        utter.lang = 'en-US';
        utter.rate = 1.25;
        utter.pitch = 1.05;
        utter.volume = 0.9;
        window.speechSynthesis.speak(utter);
      }
    } catch {
      // Fallback already handled by Web Audio tone above
    }
  }

  public playVictoryFanfare() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880, 1108.73];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.08;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.48);
    });
  }
}

export const soundEngine = new SynapseSoundEngine();
