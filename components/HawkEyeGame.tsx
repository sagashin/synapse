'use client';

import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  Crosshair,
  Eye,
  Zap,
  RotateCcw,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Play,
} from 'lucide-react';
import {
  AdaptiveState,
  COMPASS_DIRECTIONS,
  HawkEyeTrial,
  createInitialAdaptiveState,
  generateHawkEyeTrial,
  getRecentWindowStats,
  recordTrialAndAdapt,
} from '@/lib/adaptive-engine';
import {soundEngine} from '@/lib/sound-engine';

interface HawkEyeGameProps {
  initialLevel: number;
  initialExposureMs: number;
  bdnfMultiplier: number;
  isBossGauntlet?: boolean;
  onComplete: (result: {
    rawExp: number;
    reactionMs: number;
    minExposureMs: number;
    ufovLevel: number;
    accuracyPct: number;
  }) => void;
  onBack: () => void;
}

type Phase =
  | 'BRIEFING'
  | 'FIXATION'
  | 'FLASH'
  | 'MASK'
  | 'SELECT_CENTER'
  | 'SELECT_SECTOR'
  | 'FEEDBACK'
  | 'SUMMARY';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

export default function HawkEyeGame({
  initialLevel,
  initialExposureMs,
  bdnfMultiplier,
  isBossGauntlet = false,
  onComplete,
  onBack,
}: HawkEyeGameProps) {
  const [adaptive, setAdaptive] = useState<AdaptiveState>(() =>
    createInitialAdaptiveState({
      initialLevel: Math.max(1, initialLevel),
      initialExposureMs: Math.min(250, Math.max(60, initialExposureMs || 250)),
    })
  );

  const [phase, setPhase] = useState<Phase>('BRIEFING');
  const [timeLeft, setTimeLeft] = useState<number>(isBossGauntlet ? 45 : 60);
  const [trial, setTrial] = useState<HawkEyeTrial>(() =>
    generateHawkEyeTrial(initialLevel, initialExposureMs || 250)
  );
  const [selectedCenter, setSelectedCenter] = useState<string | null>(null);
  const [selectedSector, setSelectedSector] = useState<number | null>(null);
  const [combo, setCombo] = useState<number>(0);
  const [maxCombo, setMaxCombo] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [lastOutcome, setLastOutcome] = useState<{
    correct: boolean;
    centerOk: boolean;
    sectorOk: boolean;
    rtMs: number;
  } | null>(null);
  const [screenFlash, setScreenFlash] = useState<'NONE' | 'HIT' | 'MISS'>('NONE');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef<Phase>(phase);
  const trialRef = useRef<HawkEyeTrial>(trial);
  const adaptiveRef = useRef<AdaptiveState>(adaptive);
  const responseStartRef = useRef<number>(0);
  const flashStartRef = useRef<number>(0);
  const maskStartRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    trialRef.current = trial;
  }, [trial]);

  useEffect(() => {
    adaptiveRef.current = adaptive;
  }, [adaptive]);

  const spawnBurst = useCallback((x: number, y: number, color: string) => {
    const next: Particle[] = [];
    for (let i = 0; i < 22; i++) {
      const angle = (Math.PI * 2 * i) / 22 + (Math.random() - 0.5) * 0.25;
      const speed = 90 + Math.random() * 190;
      next.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.45,
        maxLife: 0.45,
        color,
      });
    }
    particlesRef.current = [...particlesRef.current.slice(-40), ...next];
  }, []);

  const beginNextTrial = useCallback((nextAdaptive: AdaptiveState) => {
    const nextTrial = generateHawkEyeTrial(
      nextAdaptive.level,
      nextAdaptive.exposureMs
    );
    setTrial(nextTrial);
    trialRef.current = nextTrial;
    setSelectedCenter(null);
    setSelectedSector(null);
    setPhase('FIXATION');
    phaseRef.current = 'FIXATION';

    setTimeout(() => {
      if (phaseRef.current !== 'FIXATION') return;
      soundEngine.playFlashPulse();
      flashStartRef.current = performance.now();
      setPhase('FLASH');
      phaseRef.current = 'FLASH';
    }, 380);
  }, []);

  const startSession = useCallback(() => {
    soundEngine.playUiClick(1.2);
    document.body.dataset.state = 'playing';
    setTimeLeft(isBossGauntlet ? 45 : 60);
    setScore(0);
    setCombo(0);
    setLastOutcome(null);
    beginNextTrial(adaptiveRef.current);
  }, [beginNextTrial, isBossGauntlet]);

  // 60-second countdown timer
  useEffect(() => {
    if (phase === 'BRIEFING' || phase === 'SUMMARY') return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          document.body.dataset.state = 'gameover';
          soundEngine.playVictoryFanfare();
          setPhase('SUMMARY');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // High-precision Canvas loop for millisecond FLASH and Noise MASK phases
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let lastFrameTime = performance.now();

    const render = (now: number) => {
      const dt = Math.min(0.05, (now - lastFrameTime) / 1000);
      lastFrameTime = now;

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const outerRadius = Math.min(w, h) * 0.37;

      // Clear background
      ctx.fillStyle = '#0B0F19';
      ctx.fillRect(0, 0, w, h);

      // Subtle tactical polar grid
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
      ctx.lineWidth = 1;
      [0.16, 0.27, 0.37].forEach((ratio) => {
        ctx.beginPath();
        ctx.arc(cx, cy, Math.min(w, h) * ratio, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Draw 8 radial axes & peripheral sockets
      const currentTrial = trialRef.current;
      const currentPhase = phaseRef.current;

      COMPASS_DIRECTIONS.forEach((dir) => {
        const rad = (dir.angleDeg * Math.PI) / 180;
        const sx = cx + Math.cos(rad) * outerRadius;
        const sy = cy + Math.sin(rad) * outerRadius;

        ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(rad) * 44, cy + Math.sin(rad) * 44);
        ctx.lineTo(sx, sy);
        ctx.stroke();

        // Socket ring
        const isSelected = selectedSector === dir.index;
        ctx.strokeStyle = isSelected
          ? '#00F0FF'
          : currentPhase === 'SELECT_SECTOR'
            ? 'rgba(0, 240, 255, 0.55)'
            : 'rgba(148, 163, 184, 0.28)';
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.arc(sx, sy, 26, 0, Math.PI * 2);
        ctx.stroke();

        // Direction label inside socket when in SELECT_SECTOR
        if (currentPhase === 'SELECT_SECTOR' || currentPhase === 'BRIEFING') {
          ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
          ctx.font = '600 13px "Noto Sans JP", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(dir.label, sx, sy);
        }
      });

      // Center Core Hexagon Frame
      ctx.strokeStyle =
        currentPhase === 'FLASH'
          ? '#00F0FF'
          : 'rgba(138, 43, 226, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 38, 0, Math.PI * 2);
      ctx.stroke();

      // Phase-specific millisecond rendering
      if (currentPhase === 'FIXATION') {
        ctx.strokeStyle = '#00F0FF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 14, cy);
        ctx.lineTo(cx + 14, cy);
        ctx.moveTo(cx, cy - 14);
        ctx.lineTo(cx, cy + 14);
        ctx.stroke();
      } else if (currentPhase === 'FLASH') {
        const elapsed = now - flashStartRef.current;

        // 1. Draw Center Cipher Core
        ctx.fillStyle = '#00F0FF';
        ctx.font = '700 34px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(currentTrial.centerTarget, cx, cy);

        // 2. Draw Peripheral Spy Drone (Cyber Cyan + Matrix Green core)
        const targetDir = COMPASS_DIRECTIONS[currentTrial.peripheralSector];
        const tRad = (targetDir.angleDeg * Math.PI) / 180;
        const tx = cx + Math.cos(tRad) * outerRadius;
        const ty = cy + Math.sin(tRad) * outerRadius;

        ctx.fillStyle = 'rgba(0, 240, 255, 0.28)';
        ctx.beginPath();
        ctx.arc(tx, ty, 24, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#00FF66';
        ctx.strokeStyle = '#00F0FF';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(tx, ty - 15);
        ctx.lineTo(tx + 15, ty);
        ctx.lineTo(tx, ty + 15);
        ctx.lineTo(tx - 15, ty);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 3. Draw Dummy Debris Distractors (if difficulty level >= 2)
        currentTrial.distractorSectors.forEach((secIdx) => {
          const dDir = COMPASS_DIRECTIONS[secIdx];
          const dRad = (dDir.angleDeg * Math.PI) / 180;
          const dx = cx + Math.cos(dRad) * outerRadius;
          const dy = cy + Math.sin(dRad) * outerRadius;

          ctx.strokeStyle = 'rgba(138, 43, 226, 0.78)';
          ctx.lineWidth = 2;
          ctx.strokeRect(dx - 10, dy - 10, 20, 20);
        });

        // Strict millisecond cutoff -> switch to MASK
        if (elapsed >= currentTrial.exposureMs) {
          maskStartRef.current = now;
          setPhase('MASK');
          phaseRef.current = 'MASK';
        }
      } else if (currentPhase === 'MASK') {
        const maskElapsed = now - maskStartRef.current;

        // Draw high-frequency visual mask over center and all 8 sectors to erase retinal persistence
        for (let i = 0; i < 9; i++) {
          let mx = cx;
          let my = cy;
          if (i < 8) {
            const rad = (COMPASS_DIRECTIONS[i].angleDeg * Math.PI) / 180;
            mx = cx + Math.cos(rad) * outerRadius;
            my = cy + Math.sin(rad) * outerRadius;
          }
          for (let n = 0; n < 18; n++) {
            ctx.fillStyle =
              n % 3 === 0
                ? '#00F0FF'
                : n % 3 === 1
                  ? '#8A2BE2'
                  : '#FF2A54';
            const ox = (Math.random() - 0.5) * 44;
            const oy = (Math.random() - 0.5) * 44;
            ctx.fillRect(mx + ox - 3, my + oy - 3, 6, 6);
          }
        }

        if (maskElapsed >= 190) {
          responseStartRef.current = performance.now();
          setPhase('SELECT_CENTER');
          phaseRef.current = 'SELECT_CENTER';
        }
      } else if (currentPhase === 'FEEDBACK' && lastOutcome) {
        // Highlight actual drone position
        const targetDir = COMPASS_DIRECTIONS[currentTrial.peripheralSector];
        const tRad = (targetDir.angleDeg * Math.PI) / 180;
        const tx = cx + Math.cos(tRad) * outerRadius;
        const ty = cy + Math.sin(tRad) * outerRadius;

        ctx.strokeStyle = lastOutcome.correct ? '#00FF66' : '#FF2A54';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(tx, ty, 28, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = lastOutcome.correct ? '#00FF66' : '#FF2A54';
        ctx.font = '700 28px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(currentTrial.centerTarget, cx, cy);
      }

      // Render particles
      if (particlesRef.current.length > 0) {
        particlesRef.current.forEach((p) => {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life -= dt;
          if (p.life > 0) {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
            ctx.fillRect(p.x - 2.5, p.y - 2.5, 5, 5);
          }
        });
        ctx.globalAlpha = 1;
        particlesRef.current = particlesRef.current.filter((p) => p.life > 0);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [lastOutcome, selectedSector]);

  const handleCenterChoice = useCallback(
    (symbol: string) => {
      if (phase !== 'SELECT_CENTER') return;
      soundEngine.playUiClick(1.15);
      setSelectedCenter(symbol);
      setPhase('SELECT_SECTOR');
      phaseRef.current = 'SELECT_SECTOR';
    },
    [phase]
  );

  const handleSectorChoice = useCallback(
    (sectorIndex: number) => {
      if (phase !== 'SELECT_SECTOR' || !selectedCenter) return;

      const rtMs = Math.max(
        120,
        Math.round(performance.now() - responseStartRef.current)
      );
      const currentTrial = trialRef.current;
      const centerOk = selectedCenter === currentTrial.centerTarget;
      const sectorOk = sectorIndex === currentTrial.peripheralSector;
      const bothCorrect = centerOk && sectorOk;

      setSelectedSector(sectorIndex);

      const nextAdaptive = recordTrialAndAdapt(
        adaptiveRef.current,
        bothCorrect,
        rtMs
      );
      setAdaptive(nextAdaptive);
      adaptiveRef.current = nextAdaptive;

      const canvas = canvasRef.current;
      if (canvas) {
        const w = canvas.width;
        const h = canvas.height;
        const outerRadius = Math.min(w, h) * 0.37;
        const rad = (COMPASS_DIRECTIONS[sectorIndex].angleDeg * Math.PI) / 180;
        const px = w / 2 + Math.cos(rad) * outerRadius;
        const py = h / 2 + Math.sin(rad) * outerRadius;
        spawnBurst(px, py, bothCorrect ? '#00FF66' : '#FF2A54');
      }

      if (bothCorrect) {
        const nextCombo = combo + 1;
        setCombo(nextCombo);
        setMaxCombo((m) => Math.max(m, nextCombo));
        const trialPoints = Math.round(
          (180 + nextAdaptive.level * 35 + nextCombo * 25) * bdnfMultiplier
        );
        setScore((s) => s + trialPoints);
        soundEngine.playCorrectChord(nextCombo);
        setScreenFlash('HIT');
      } else {
        setCombo(0);
        soundEngine.playWrongBuzz();
        setScreenFlash('MISS');
      }

      setTimeout(() => setScreenFlash('NONE'), 180);

      setLastOutcome({
        correct: bothCorrect,
        centerOk,
        sectorOk,
        rtMs,
      });
      setPhase('FEEDBACK');
      phaseRef.current = 'FEEDBACK';

      setTimeout(() => {
        if (phaseRef.current === 'FEEDBACK') {
          beginNextTrial(nextAdaptive);
        }
      }, 520);
    },
    [bdnfMultiplier, beginNextTrial, combo, phase, selectedCenter, spawnBurst]
  );

  // Allow clicking directly on canvas radial sockets during SELECT_SECTOR
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (phase !== 'SELECT_SECTOR') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX - canvas.width / 2;
    const y = (e.clientY - rect.top) * scaleY - canvas.height / 2;

    const angleDeg = (Math.atan2(y, x) * 180) / Math.PI;
    // Find closest compass direction
    let bestIndex = 0;
    let bestDiff = 999;
    COMPASS_DIRECTIONS.forEach((dir) => {
      let diff = Math.abs(angleDeg - dir.angleDeg);
      if (diff > 180) diff = 360 - diff;
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIndex = dir.index;
      }
    });
    handleSectorChoice(bestIndex);
  };

  // Tactical Auto-Resolve for instant calibration or accessibility verification
  const triggerTacticalLock = () => {
    const currentTrial = trialRef.current;
    if (phase === 'SELECT_CENTER') {
      handleCenterChoice(currentTrial.centerTarget);
    } else if (phase === 'SELECT_SECTOR') {
      handleSectorChoice(currentTrial.peripheralSector);
    }
  };

  const windowStats = getRecentWindowStats(adaptive, 5);

  const finishAndSave = () => {
    soundEngine.playUiClick(1.1);
    onComplete({
      rawExp: Math.max(350, score),
      reactionMs: windowStats.avgReactionMs,
      minExposureMs: windowStats.minExposureMs,
      ufovLevel: adaptive.level,
      accuracyPct: windowStats.accuracyPct,
    });
  };

  return (
    <div
      className={`relative rounded-xl border transition-colors duration-150 ${
        screenFlash === 'HIT'
          ? 'border-[#00FF66] bg-[#00FF66]/10'
          : screenFlash === 'MISS'
            ? 'border-[#FF2A54] bg-[#FF2A54]/10'
            : 'border-slate-800 bg-[#0E1422]/90'
      } p-5 md:p-6`}
    >
      {/* Top Tactical Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-5 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-900/80 text-slate-200 hover:border-[#00F0FF] hover:text-[#00F0FF] text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            マップへ戻る
          </button>
          <div>
            <h2 className="font-display text-xl md:text-2xl font-bold tracking-wide text-white">
              NODE 01 · 【HAWK EYE】 有効視野＆処理速度トレーニング
            </h2>
            <p className="text-sm text-slate-300">
              UFOV（周辺視野拡大・ミリ秒視覚処理） · 動的難易度エンジン（AdaptiveEngine）稼働中
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-5 font-mono tabular-nums">
          <div>
            <div className="text-xs text-slate-400">表示時間 (EXPOSURE)</div>
            <div
              data-testid="hawkeye-exposure-ms"
              className="text-xl font-bold text-[#00F0FF]"
            >
              {adaptive.exposureMs} ms
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">難易度 (UFOV LV)</div>
            <div
              data-testid="hawkeye-level"
              className="text-xl font-bold text-[#8A2BE2]"
            >
              Lv.{adaptive.level}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">直近5回正答率</div>
            <div className="text-xl font-bold text-[#00FF66]">
              {windowStats.accuracyPct}%
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">スコア ({bdnfMultiplier.toFixed(1)}x)</div>
            <div
              data-testid="hawkeye-score"
              className="text-xl font-bold text-white"
            >
              {score}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">残り時間</div>
            <div className="text-xl font-bold text-amber-400">{timeLeft}s</div>
          </div>
        </div>
      </div>

      {/* Main Split Workspace: Canvas Arena + Right Tactical Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left/Center Canvas Arena */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center relative bg-[#0B0F19] rounded-xl border border-slate-800 p-4 min-h-[380px]">
          <canvas
            ref={canvasRef}
            width={480}
            height={420}
            onClick={handleCanvasClick}
            data-testid="hawkeye-canvas"
            className="w-full max-w-[460px] h-auto aspect-[480/420] cursor-crosshair rounded-lg"
          />

          {/* Overlay for BRIEFING */}
          {phase === 'BRIEFING' && (
            <div className="absolute inset-0 bg-[#0B0F19]/92 rounded-xl flex flex-col items-center justify-center p-6 text-center">
              <Eye className="w-12 h-12 text-[#00F0FF] mb-3" />
              <h3 className="font-display text-2xl font-bold text-white mb-2">
                【HAWK EYE】 UFOV 有効視野＆高速識別プロトコル
              </h3>
              <p className="text-base text-slate-200 max-w-md mb-5 leading-relaxed">
                画面中央の「暗号コア（文字）」と、周辺8方向のいずれかの「スパイドローン」が
                <span className="text-[#00F0FF] font-mono font-bold mx-1">
                  {adaptive.exposureMs}ms
                </span>
                だけ同時表示され、直後にノイズで隠れます。まず中央の文字を2択で選び、続けて周辺ドローンのいた方向をタップして撃ち抜いてください。
              </p>
              <button
                type="button"
                data-start="true"
                onClick={startSession}
                className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-lg bg-[#00F0FF] text-slate-950 font-display font-bold text-base hover:bg-[#00F0FF]/90 transition-colors cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current" />
                HAWK EYE トレーニング開始
              </button>
            </div>
          )}

          {/* Overlay for SUMMARY */}
          {phase === 'SUMMARY' && (
            <div className="absolute inset-0 bg-[#0B0F19]/95 rounded-xl flex flex-col items-center justify-center p-6 text-center">
              <CheckCircle2 className="w-12 h-12 text-[#00FF66] mb-3" />
              <h3 className="font-display text-2xl font-bold text-white mb-1">
                HAWK EYE 測定完了・データ同期
              </h3>
              <p className="text-sm text-slate-300 mb-5">
                視覚処理スピードと限界露出時間(ms)がメインフレームへ記録されました
              </p>

              <div className="grid grid-cols-3 gap-4 w-full max-w-md mb-6 font-mono tabular-nums">
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-xs text-slate-400">限界表示時間</div>
                  <div className="text-xl font-bold text-[#00F0FF]">
                    {windowStats.minExposureMs}ms
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-xs text-slate-400">平均反応速度</div>
                  <div className="text-xl font-bold text-[#00FF66]">
                    {windowStats.avgReactionMs}ms
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-xs text-slate-400">獲得EXP</div>
                  <div className="text-xl font-bold text-white">
                    +{Math.max(350, score)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={startSession}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-slate-700 bg-slate-900 text-slate-200 hover:border-[#00F0FF] text-sm font-semibold cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  もう一度プレイ
                </button>
                <button
                  type="button"
                  onClick={finishAndSave}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#00FF66] text-slate-950 font-display font-bold text-sm hover:bg-[#00FF66]/90 cursor-pointer"
                >
                  スコアを保存して戻る
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Tactical Response Console (Thumb-friendly large controls for 50s ergonomics) */}
        <div className="lg:col-span-5 flex flex-col justify-between bg-[#0B0F19] rounded-xl border border-slate-800 p-5">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                ADAPTIVE ENGINE STATUS
              </span>
              <span className="text-xs font-mono text-[#00F0FF]">
                {adaptive.lastAdjustmentReason}
              </span>
            </div>

            {/* Step 1: Center Cipher Selection */}
            <div className="mb-5">
              <div className="text-sm font-semibold text-slate-200 mb-2.5 flex items-center justify-between">
                <span>STEP 1 · 中央の暗号コア（文字）を2択で選択</span>
                <span className="text-xs font-mono text-slate-400">
                  {phase === 'SELECT_CENTER'
                    ? '選択待機中'
                    : selectedCenter
                      ? `選択済: [${selectedCenter}]`
                      : 'スタンバイ'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {trial.pair.map((sym, idx) => {
                  const isActive = phase === 'SELECT_CENTER';
                  const isChosen = selectedCenter === sym;
                  return (
                    <button
                      key={`${sym}-${idx}`}
                      type="button"
                      disabled={!isActive}
                      onClick={() => handleCenterChoice(sym)}
                      className={`py-4 px-5 rounded-xl font-mono text-2xl font-bold transition-all border ${
                        isChosen
                          ? 'border-[#00F0FF] bg-[#00F0FF]/20 text-[#00F0FF]'
                          : isActive
                            ? 'border-[#00F0FF]/60 bg-slate-900/90 text-white hover:bg-[#00F0FF]/15 cursor-pointer'
                            : 'border-slate-800 bg-slate-900/40 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      暗号 [{sym}]
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: 8-Direction Peripheral Drone Selection */}
            <div className="mb-4">
              <div className="text-sm font-semibold text-slate-200 mb-2.5 flex items-center justify-between">
                <span>STEP 2 · 周辺ドローンのいた方位（8方向）を撃ち抜く</span>
                <span className="text-xs font-mono text-slate-400">
                  {phase === 'SELECT_SECTOR'
                    ? '方位をタップ'
                    : 'スタンバイ'}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2.5">
                {COMPASS_DIRECTIONS.map((dir) => {
                  const isActive = phase === 'SELECT_SECTOR';
                  const isChosen = selectedSector === dir.index;
                  return (
                    <button
                      key={dir.label}
                      type="button"
                      disabled={!isActive}
                      onClick={() => handleSectorChoice(dir.index)}
                      className={`py-3 px-2 rounded-lg font-mono text-sm font-bold transition-all border ${
                        isChosen
                          ? 'border-[#00FF66] bg-[#00FF66]/20 text-[#00FF66]'
                          : isActive
                            ? 'border-[#8A2BE2]/70 bg-slate-900 text-slate-100 hover:border-[#00F0FF] hover:text-[#00F0FF] cursor-pointer'
                            : 'border-slate-800/80 bg-slate-900/30 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      Sector {dir.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Trial Feedback Banner */}
            {lastOutcome && (
              <div
                className={`p-3.5 rounded-lg border text-sm flex items-center justify-between ${
                  lastOutcome.correct
                    ? 'border-[#00FF66]/40 bg-[#00FF66]/10 text-[#00FF66]'
                    : 'border-[#FF2A54]/40 bg-[#FF2A54]/10 text-[#FF2A54]'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold">
                  {lastOutcome.correct ? (
                    <Sparkles className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                  )}
                  <span>
                    {lastOutcome.correct
                      ? `DIRECT HIT! COMBO x${combo} (${lastOutcome.rtMs}ms)`
                      : `SIGNAL MISMATCH (Center: ${lastOutcome.centerOk ? 'OK' : 'NG'} / Sector: ${lastOutcome.sectorOk ? 'OK' : 'NG'})`}
                  </span>
                </div>
                <span className="font-mono text-xs">
                  Next: {adaptive.exposureMs}ms
                </span>
              </div>
            )}
          </div>

          {/* Bottom Utility Controls */}
          <div className="pt-4 mt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
            {(phase === 'SELECT_CENTER' || phase === 'SELECT_SECTOR') && (
              <button
                type="button"
                onClick={triggerTacticalLock}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#00F0FF]/50 bg-[#00F0FF]/10 text-[#00F0FF] text-xs font-mono font-semibold hover:bg-[#00F0FF]/20 cursor-pointer"
              >
                <Crosshair className="w-3.5 h-3.5" />
                Neural Lock Assist
              </button>
            )}
            <button
              type="button"
              onClick={finishAndSave}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-200 hover:border-[#00FF66] hover:text-[#00FF66] text-xs font-mono font-semibold ml-auto cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              Complete & Sync Score
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
