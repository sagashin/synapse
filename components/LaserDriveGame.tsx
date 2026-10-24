'use client';

import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  Crosshair,
  Gauge,
  ArrowLeft,
  Play,
  RotateCcw,
  CheckCircle2,
  Zap,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  LaserDriveTarget,
  calculateInterferenceCost,
  generateLaserDriveTarget,
} from '@/lib/adaptive-engine';
import {soundEngine} from '@/lib/sound-engine';

interface LaserDriveGameProps {
  bdnfMultiplier: number;
  isBossGauntlet?: boolean;
  onComplete: (result: {
    rawExp: number;
    interferenceCostPct: number;
    trackingPct: number;
    goNoGoAccuracyPct: number;
  }) => void;
  onBack: () => void;
}

export default function LaserDriveGame({
  bdnfMultiplier,
  isBossGauntlet = false,
  onComplete,
  onBack,
}: LaserDriveGameProps) {
  const [status, setStatus] = useState<'BRIEFING' | 'PLAYING' | 'SUMMARY'>(
    'BRIEFING'
  );
  const [timeLeft, setTimeLeft] = useState<number>(isBossGauntlet ? 45 : 60);
  const [score, setScore] = useState<number>(0);
  const [courseSpeed, setCourseSpeed] = useState<number>(1.0);
  const [trackingPct, setTrackingPct] = useState<number>(92);
  const [laserAccPct, setLaserAccPct] = useState<number>(100);
  const [activeSign, setActiveSign] = useState<LaserDriveTarget | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string>(
    'STAY ON CENTER WAVE · FIRE ONLY AT GREEN TRIANGLE'
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const statusRef = useRef(status);
  const shipXRef = useRef<number>(0); // -1..1 normalized offset
  const keysHeldRef = useRef<{left: boolean; right: boolean}>({
    left: false,
    right: false,
  });
  const activeSignRef = useRef<{
    target: LaserDriveTarget;
    spawnTime: number;
    windowMs: number;
    responded: boolean;
  } | null>(null);
  const laserBeamTimerRef = useRef<{time: number; hit: boolean} | null>(null);

  // Telemetry accumulators
  const metricsRef = useRef({
    singleTaskFrames: 0,
    singleTaskOnTrack: 0,
    dualTaskFrames: 0,
    dualTaskOnTrack: 0,
    goTargetsTotal: 0,
    goTargetsHit: 0,
    noGoTargetsTotal: 0,
    noGoFalseAlarms: 0,
    speedLevel: 1.0,
    windowMs: 650,
  });

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const computeCurrentLaserAcc = () => {
    const m = metricsRef.current;
    const total = m.goTargetsTotal + m.noGoTargetsTotal;
    if (total === 0) return 100;
    const correct =
      m.goTargetsHit + Math.max(0, m.noGoTargetsTotal - m.noGoFalseAlarms);
    return Math.round((correct / total) * 100);
  };

  const evaluateAdaptiveSpeed = useCallback(() => {
    const m = metricsRef.current;
    const totalFrames = m.singleTaskFrames + m.dualTaskFrames;
    const onTrackFrames = m.singleTaskOnTrack + m.dualTaskOnTrack;
    const trackRate =
      totalFrames > 0 ? Math.round((onTrackFrames / totalFrames) * 100) : 90;
    const laserRate = computeCurrentLaserAcc();

    setTrackingPct(trackRate);
    setLaserAccPct(laserRate);

    if (trackRate >= 80 && laserRate >= 80) {
      m.speedLevel = Math.min(2.4, Number((m.speedLevel + 0.14).toFixed(2)));
      m.windowMs = Math.max(380, m.windowMs - 25);
      setCourseSpeed(m.speedLevel);
    } else if (trackRate < 65 || laserRate < 65) {
      m.speedLevel = Math.max(0.9, Number((m.speedLevel - 0.1).toFixed(2)));
      m.windowMs = Math.min(720, m.windowMs + 25);
      setCourseSpeed(m.speedLevel);
    }
  }, []);

  const fireLaser = useCallback(() => {
    if (statusRef.current !== 'PLAYING') return;
    const currentSign = activeSignRef.current;

    if (!currentSign || currentSign.responded) {
      // Fired with no active target
      soundEngine.playWrongBuzz();
      setFeedbackMsg('EMPTY LASER DISCHARGE — CONSERVE FOCUS');
      return;
    }

    currentSign.responded = true;
    if (currentSign.target.isGoTarget) {
      metricsRef.current.goTargetsHit += 1;
      const pts = Math.round(
        220 * metricsRef.current.speedLevel * bdnfMultiplier
      );
      setScore((s) => s + pts);
      soundEngine.playLaserShot(true);
      laserBeamTimerRef.current = {time: performance.now(), hit: true};
      setFeedbackMsg(`GREEN TRIANGLE VAPORIZED! (+${pts} EXP)`);
    } else {
      metricsRef.current.noGoFalseAlarms += 1;
      soundEngine.playWrongBuzz();
      laserBeamTimerRef.current = {time: performance.now(), hit: false};
      setFeedbackMsg(
        `INHIBITION BREACH! SHOT DISTRACTOR [${currentSign.target.label}]`
      );
    }
    evaluateAdaptiveSpeed();
  }, [bdnfMultiplier, evaluateAdaptiveSpeed]);

  const startSession = useCallback(() => {
    soundEngine.playUiClick(1.2);
    document.body.dataset.state = 'playing';
    metricsRef.current = {
      singleTaskFrames: 0,
      singleTaskOnTrack: 0,
      dualTaskFrames: 0,
      dualTaskOnTrack: 0,
      goTargetsTotal: 0,
      goTargetsHit: 0,
      noGoTargetsTotal: 0,
      noGoFalseAlarms: 0,
      speedLevel: 1.0,
      windowMs: 650,
    };
    shipXRef.current = 0;
    setScore(0);
    setCourseSpeed(1.0);
    setTrackingPct(95);
    setLaserAccPct(100);
    setTimeLeft(isBossGauntlet ? 45 : 60);
    setFeedbackMsg(
      'KEEP INTERCEPTOR ON WAVE CENTER · SHOOT GREEN TRIANGLES ONLY'
    );
    const initialTarget: LaserDriveTarget = {
      shape: 'TRIANGLE',
      color: 'GREEN',
      isGoTarget: true,
      label: 'GREEN TRIANGLE [GO]',
    };
    metricsRef.current.goTargetsTotal += 1;
    activeSignRef.current = {
      target: initialTarget,
      spawnTime: performance.now(),
      windowMs: 750,
      responded: false,
    };
    setActiveSign(initialTarget);
    setStatus('PLAYING');
  }, [isBossGauntlet]);

  // Countdown timer & periodic Go/No-Go Target Spawner
  useEffect(() => {
    if (status !== 'PLAYING') return;

    const secTimer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(secTimer);
          document.body.dataset.state = 'gameover';
          soundEngine.playVictoryFanfare();
          setStatus('SUMMARY');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const signSpawner = setInterval(() => {
      if (statusRef.current !== 'PLAYING') return;
      const target = generateLaserDriveTarget();
      if (target.isGoTarget) {
        metricsRef.current.goTargetsTotal += 1;
      } else {
        metricsRef.current.noGoTargetsTotal += 1;
      }
      soundEngine.playFlashPulse();
      activeSignRef.current = {
        target,
        spawnTime: performance.now(),
        windowMs: metricsRef.current.windowMs,
        responded: false,
      };
      setActiveSign(target);
    }, 2350);

    return () => {
      clearInterval(secTimer);
      clearInterval(signSpawner);
    };
  }, [status]);

  // Keyboard steering (A/D, ArrowLeft/ArrowRight) and Space to Fire
  useEffect(() => {
    if (status !== 'PLAYING') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'a' || e.key === 'ArrowLeft') {
        keysHeldRef.current.left = true;
      } else if (k === 'd' || e.key === 'ArrowRight') {
        keysHeldRef.current.right = true;
      } else if (e.code === 'Space') {
        e.preventDefault();
        fireLaser();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'a' || e.key === 'ArrowLeft') {
        keysHeldRef.current.left = false;
      } else if (k === 'd' || e.key === 'ArrowRight') {
        keysHeldRef.current.right = false;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [fireLaser, status]);

  // 60 FPS Canvas Wave Road & Go/No-Go Target Renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let phaseOffset = 0;
    let lastTime = performance.now();

    const render = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const w = canvas.width;
      const h = canvas.height;
      const horizonY = h * 0.28;
      const shipY = h * 0.84;

      // Clear background
      ctx.fillStyle = '#0B0F19';
      ctx.fillRect(0, 0, w, h);

      // Update steering if PLAYING
      if (statusRef.current === 'PLAYING') {
        const speed = metricsRef.current.speedLevel;
        phaseOffset += dt * 2.2 * speed;
        if (keysHeldRef.current.left) {
          shipXRef.current = Math.max(-0.9, shipXRef.current - dt * 1.45);
        }
        if (keysHeldRef.current.right) {
          shipXRef.current = Math.min(0.9, shipXRef.current + dt * 1.45);
        }
      } else {
        phaseOffset += dt * 0.8;
      }

      // Compute wave center at a given vertical ratio t (0 at horizon, 1 at bottom)
      const getWaveCenterX = (t: number) => {
        const wave =
          Math.sin(phaseOffset - t * 3.2) * 0.34 +
          Math.cos(phaseOffset * 0.65 - t * 2.1) * 0.16;
        const spread = 0.22 + t * 0.78;
        return w / 2 + wave * (w * 0.42) * spread;
      };

      // Draw Cyber Horizon Grid
      ctx.strokeStyle = 'rgba(138, 43, 226, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, horizonY);
      ctx.lineTo(w, horizonY);
      ctx.stroke();

      // Draw Wave Course Rails & Center Optimal Line
      const steps = 28;
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
      ctx.lineWidth = 2;

      // Left & Right road rails
      [-1, 1].forEach((side) => {
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const y = horizonY + t * (h - horizonY);
          const cx = getWaveCenterX(t);
          const halfTrack = 24 + t * 92;
          const rx = cx + side * halfTrack;
          if (i === 0) ctx.moveTo(rx, y);
          else ctx.lineTo(rx, y);
        }
        ctx.stroke();
      });

      // Center optimal tracking laser ribbon
      const idealShipX = getWaveCenterX((shipY - horizonY) / (h - horizonY));
      const playerScreenX = w / 2 + shipXRef.current * (w * 0.38);
      const trackDiff = Math.abs(playerScreenX - idealShipX);
      const isLockedOn = trackDiff <= 44;

      ctx.strokeStyle = isLockedOn ? '#00FF66' : '#00F0FF';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const y = horizonY + t * (h - horizonY);
        const cx = getWaveCenterX(t);
        if (i === 0) ctx.moveTo(cx, y);
        else ctx.lineTo(cx, y);
      }
      ctx.stroke();

      // Record single-task vs dual-task tracking accuracy frames
      const signState = activeSignRef.current;
      if (statusRef.current === 'PLAYING') {
        const isSignVisible =
          signState !== null &&
          now - signState.spawnTime <= signState.windowMs + 150;
        if (isSignVisible) {
          metricsRef.current.dualTaskFrames += 1;
          if (isLockedOn) metricsRef.current.dualTaskOnTrack += 1;
        } else {
          metricsRef.current.singleTaskFrames += 1;
          if (isLockedOn) metricsRef.current.singleTaskOnTrack += 1;
        }
      }

      // Draw Go / No-Go Target Beacon in Upper Zone (visual exposure ~420ms, response window up to windowMs)
      if (signState) {
        const elapsed = now - signState.spawnTime;
        if (elapsed <= signState.windowMs) {
          const bx = w / 2;
          const by = horizonY * 0.52;
          const colorHex =
            signState.target.color === 'GREEN'
              ? '#00FF66'
              : signState.target.color === 'RED'
                ? '#FF2A54'
                : '#8A2BE2';

          // Outer reticle box
          ctx.strokeStyle = 'rgba(226, 232, 240, 0.35)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(bx - 52, by - 36, 104, 72);

          // Draw geometric shape during the flash window (420ms)
          if (elapsed <= 440 && !signState.responded) {
            ctx.fillStyle = colorHex;
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.beginPath();
            if (signState.target.shape === 'TRIANGLE') {
              ctx.moveTo(bx, by - 24);
              ctx.lineTo(bx + 26, by + 20);
              ctx.lineTo(bx - 26, by + 20);
              ctx.closePath();
            } else if (signState.target.shape === 'SQUARE') {
              ctx.rect(bx - 22, by - 22, 44, 44);
            } else {
              // Diamond / Hexagon
              ctx.moveTo(bx, by - 25);
              ctx.lineTo(bx + 25, by);
              ctx.lineTo(bx, by + 25);
              ctx.lineTo(bx - 25, by);
              ctx.closePath();
            }
            ctx.fill();
            ctx.stroke();
          }
        } else {
          // Expired
          if (signState.target.isGoTarget && !signState.responded) {
            setFeedbackMsg('ターゲット見逃し（緑の三角形を撃ち逃しました）');
          }
          activeSignRef.current = null;
          setActiveSign(null);
          evaluateAdaptiveSpeed();
        }
      }

      // Draw Laser Beam if recently fired
      if (
        laserBeamTimerRef.current &&
        now - laserBeamTimerRef.current.time < 160
      ) {
        ctx.strokeStyle = laserBeamTimerRef.current.hit
          ? '#00FF66'
          : '#FF2A54';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(playerScreenX, shipY - 16);
        ctx.lineTo(w / 2, horizonY * 0.52);
        ctx.stroke();
      }

      // Draw Player Interceptor Ship
      ctx.save();
      ctx.translate(playerScreenX, shipY);
      ctx.fillStyle = isLockedOn ? '#00F0FF' : '#FF2A54';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(22, 14);
      ctx.lineTo(0, 7);
      ctx.lineTo(-22, 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [evaluateAdaptiveSpeed]);

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (status !== 'PLAYING') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width; // 0..1
    shipXRef.current = Math.max(-0.9, Math.min(0.9, (relX - 0.5) * 2.1));
  };

  // Calculate final interference cost
  const m = metricsRef.current;
  const singlePct =
    m.singleTaskFrames > 0
      ? Math.round((m.singleTaskOnTrack / m.singleTaskFrames) * 100)
      : 92;
  const dualPct =
    m.dualTaskFrames > 0
      ? Math.round((m.dualTaskOnTrack / m.dualTaskFrames) * 100)
      : 85;
  const interferenceStats = calculateInterferenceCost(
    singlePct,
    dualPct,
    laserAccPct
  );

  const finishAndSave = () => {
    soundEngine.playUiClick(1.1);
    onComplete({
      rawExp: Math.max(450, score + interferenceStats.synergyScore),
      interferenceCostPct: interferenceStats.interferenceCostPct,
      trackingPct,
      goNoGoAccuracyPct: laserAccPct,
    });
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0E1422]/90 p-5 md:p-6">
      {/* Header */}
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
              NODE 03 (Step 2) · 【LASER DRIVE】 マルチタスク＆干渉制御
            </h2>
            <p className="text-sm text-slate-300">
              UCSF『NeuroRacer』研究ベース · 持続的ウェイブコース維持 ＆ Go/No-Goターゲット識別
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-5 font-mono tabular-nums">
          <div>
            <div className="text-xs text-slate-400">蛇行速度 (SPEED)</div>
            <div
              data-testid="laser-speed"
              className="text-xl font-bold text-[#00F0FF]"
            >
              {courseSpeed.toFixed(2)}x
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">コース維持率</div>
            <div className="text-xl font-bold text-[#00FF66]">
              {trackingPct}%
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">レーザー正答率</div>
            <div className="text-xl font-bold text-[#8A2BE2]">
              {laserAccPct}%
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">スコア ({bdnfMultiplier.toFixed(1)}x)</div>
            <div
              data-testid="laser-score"
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

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: 60FPS Wave Course Canvas */}
        <div className="lg:col-span-7 relative flex flex-col items-center justify-center bg-[#0B0F19] rounded-xl border border-slate-800 p-4 min-h-[390px]">
          <canvas
            ref={canvasRef}
            width={520}
            height={380}
            onPointerMove={handlePointerMove}
            onClick={fireLaser}
            data-testid="laser-canvas"
            className="w-full max-w-[520px] h-auto aspect-[520/380] cursor-crosshair rounded-lg touch-none"
          />

          {/* Briefing Overlay */}
          {status === 'BRIEFING' && (
            <div className="absolute inset-0 bg-[#0B0F19]/92 rounded-xl flex flex-col items-center justify-center p-6 text-center">
              <Gauge className="w-12 h-12 text-[#00FF66] mb-3" />
              <h3 className="font-display text-2xl font-bold text-white mb-2">
                【LASER DRIVE】 マルチタスク＆干渉制御（Step 2）
              </h3>
              <p className="text-base text-slate-200 max-w-md mb-5 leading-relaxed">
                マウス移動（またはA/Dキー・画面ボタン）で自機をうねるコースの中央ライン上に維持し続けながら、画面上部に
                <span className="text-[#00FF66] font-bold mx-1">
                  「緑色の三角形 (GREEN TRIANGLE)」
                </span>
                が出現した時だけ即座に［SPACEキー / レーザー発射］で撃ち抜いてください。赤色の三角形や緑色の四角形は撃ってはいけません（抑制制御）。
              </p>
              <button
                type="button"
                data-start="true"
                onClick={startSession}
                className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-lg bg-[#00FF66] text-slate-950 font-display font-bold text-base hover:bg-[#00FF66]/90 transition-colors cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current" />
                LASER DRIVE トレーニング開始
              </button>
            </div>
          )}

          {/* Summary Overlay */}
          {status === 'SUMMARY' && (
            <div className="absolute inset-0 bg-[#0B0F19]/95 rounded-xl flex flex-col items-center justify-center p-6 text-center">
              <CheckCircle2 className="w-12 h-12 text-[#00FF66] mb-3" />
              <h3 className="font-display text-2xl font-bold text-white mb-1">
                マルチタスク干渉コスト算出レポート
              </h3>
              <p className="text-sm text-slate-300 mb-5">
                単一タスク時と同時タスク時のパフォーマンス差（マルチタスク干渉コスト）を記録しました
              </p>

              <div className="grid grid-cols-3 gap-4 w-full max-w-md mb-6 font-mono tabular-nums">
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-xs text-slate-400">マルチタスク干渉コスト</div>
                  <div className="text-xl font-bold text-[#00F0FF]">
                    {interferenceStats.interferenceCostPct}%
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-xs text-slate-400">前頭葉制御ランク</div>
                  <div className="text-xl font-bold text-[#00FF66]">
                    GRADE {interferenceStats.grade}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-xs text-slate-400">獲得EXP</div>
                  <div className="text-xl font-bold text-white">
                    +{Math.max(450, score + interferenceStats.synergyScore)}
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

        {/* Right: Go/No-Go Target Rules & Ergonomic Controls */}
        <div className="lg:col-span-5 flex flex-col justify-between bg-[#0B0F19] rounded-xl border border-slate-800 p-5">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
              Task B · Go / No-Go ターゲット識別モニター
            </div>
            <div className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 text-sm font-mono text-[#00F0FF] mb-4">
              {activeSign
                ? `出現標識: ${activeSign.label}`
                : feedbackMsg}
            </div>

            {/* Target Rule Matrix */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="p-3.5 rounded-xl border border-[#00FF66]/40 bg-[#00FF66]/10">
                <div className="text-xs font-mono text-[#00FF66] font-bold mb-1">
                  GO ターゲット（撃墜対象）
                </div>
                <div className="text-base font-bold text-white">
                  緑色の三角形のみ
                </div>
                <div className="text-xs text-slate-300 mt-1">
                  出現した瞬間（0.4秒間）にレーザー発射
                </div>
              </div>
              <div className="p-3.5 rounded-xl border border-[#FF2A54]/40 bg-[#FF2A54]/10">
                <div className="text-xs font-mono text-[#FF2A54] font-bold mb-1">
                  ディストラクター（撃つな！）
                </div>
                <div className="text-base font-bold text-white">
                  赤三角・緑四角形など
                </div>
                <div className="text-xs text-slate-300 mt-1">
                  絶対に撃たずコース中央維持に集中
                </div>
              </div>
            </div>

            {/* Large Ergonomic Steering & Fire Controls */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={status !== 'PLAYING'}
                  onClick={() => {
                    shipXRef.current = Math.max(-0.9, shipXRef.current - 0.22);
                  }}
                  className="py-3.5 px-4 rounded-xl border border-slate-700 bg-slate-900 text-white font-display font-bold flex items-center justify-center gap-2 hover:border-[#00F0FF] disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5 text-[#00F0FF]" />
                  STEER LEFT · 左操舵 [A]
                </button>
                <button
                  type="button"
                  disabled={status !== 'PLAYING'}
                  onClick={() => {
                    shipXRef.current = Math.min(0.9, shipXRef.current + 0.22);
                  }}
                  className="py-3.5 px-4 rounded-xl border border-slate-700 bg-slate-900 text-white font-display font-bold flex items-center justify-center gap-2 hover:border-[#00F0FF] disabled:opacity-40 cursor-pointer"
                >
                  STEER RIGHT · 右操舵 [D]
                  <ChevronRight className="w-5 h-5 text-[#00F0FF]" />
                </button>
              </div>

              <button
                type="button"
                disabled={status !== 'PLAYING'}
                onClick={fireLaser}
                className="w-full py-4 px-5 rounded-xl bg-[#00FF66] text-slate-950 font-display font-bold text-lg flex items-center justify-center gap-2.5 hover:bg-[#00FF66]/90 disabled:opacity-40 transition-all cursor-pointer"
              >
                <Crosshair className="w-5 h-5" />
                FIRE LASER CANNON · レーザー発射 [SPACE]
              </button>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs font-mono text-slate-300">
              現在のマルチタスク干渉コスト: {interferenceStats.interferenceCostPct}%
            </span>
            <button
              type="button"
              onClick={finishAndSave}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-200 hover:border-[#00FF66] hover:text-[#00FF66] text-xs font-mono font-semibold cursor-pointer"
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
