'use client';

import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  Cpu,
  Volume2,
  Grid,
  ArrowLeft,
  Play,
  RotateCcw,
  CheckCircle2,
  FastForward,
  Zap,
} from 'lucide-react';
import {
  AdaptiveState,
  DualNBackStimulus,
  NBackTurnResult,
  createInitialAdaptiveState,
  evaluateDualNBackTurn,
  generateDualNBackSequence,
  getRecentWindowStats,
  recordTrialAndAdapt,
} from '@/lib/adaptive-engine';
import {soundEngine} from '@/lib/sound-engine';

interface PhantomCodeGameProps {
  initialNBack: number;
  bdnfMultiplier: number;
  isBossGauntlet?: boolean;
  onComplete: (result: {
    rawExp: number;
    nBackLevel: number;
    accuracyPct: number;
  }) => void;
  onBack: () => void;
}

export default function PhantomCodeGame({
  initialNBack,
  bdnfMultiplier,
  isBossGauntlet = false,
  onComplete,
  onBack,
}: PhantomCodeGameProps) {
  const [nLevel, setNLevel] = useState<number>(
    Math.min(4, Math.max(1, initialNBack || 2))
  );
  const [adaptive, setAdaptive] = useState<AdaptiveState>(() =>
    createInitialAdaptiveState({
      initialLevel: Math.max(1, (initialNBack || 2) * 2),
      initialNBack: Math.min(4, Math.max(1, initialNBack || 2)),
    })
  );

  const baseTurns = isBossGauntlet ? 10 : 20;
  const [sequence, setSequence] = useState<DualNBackStimulus[]>(() =>
    generateDualNBackSequence(initialNBack || 2, baseTurns)
  );
  const [status, setStatus] = useState<'BRIEFING' | 'PLAYING' | 'SUMMARY'>(
    'BRIEFING'
  );
  const [turnIndex, setTurnIndex] = useState<number>(0);
  const [activeCell, setActiveCell] = useState<number | null>(null);
  const [pressedPosition, setPressedPosition] = useState<boolean>(false);
  const [pressedAudio, setPressedAudio] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [combo, setCombo] = useState<number>(0);
  const [lastTurnResult, setLastTurnResult] = useState<NBackTurnResult | null>(
    null
  );
  const [turnFeedbackBanner, setTurnFeedbackBanner] = useState<string>(
    'INITIALIZING MEMORY BUFFER...'
  );

  const pressedPosRef = useRef(false);
  const pressedAudRef = useRef(false);
  const turnStartRef = useRef<number>(0);
  const adaptiveRef = useRef<AdaptiveState>(adaptive);
  const nLevelRef = useRef<number>(nLevel);

  useEffect(() => {
    adaptiveRef.current = adaptive;
  }, [adaptive]);

  useEffect(() => {
    nLevelRef.current = nLevel;
  }, [nLevel]);

  const triggerTurnStimulus = useCallback(
    (idx: number, seq: DualNBackStimulus[]) => {
      const stim = seq[idx];
      if (!stim) return;
      setActiveCell(stim.position);
      setPressedPosition(false);
      setPressedAudio(false);
      pressedPosRef.current = false;
      pressedAudRef.current = false;
      turnStartRef.current = performance.now();
      soundEngine.playLetterStimulus(stim.letter);

      // Keep panel illuminated for 1.75s out of the 2.5s cycle
      const hideTimer = setTimeout(() => {
        setActiveCell((current) => (current === stim.position ? null : current));
      }, 1750);

      return () => clearTimeout(hideTimer);
    },
    []
  );

  const evaluateAndAdvanceTurn = useCallback(() => {
    const currentStim = sequence[turnIndex];
    if (!currentStim) return;

    const currentN = nLevelRef.current;
    if (turnIndex >= currentN) {
      const evalRes = evaluateDualNBackTurn(
        currentStim,
        pressedPosRef.current,
        pressedAudRef.current
      );
      setLastTurnResult(evalRes);

      const rtMs = Math.max(
        300,
        Math.round(performance.now() - turnStartRef.current)
      );
      const nextAdaptive = recordTrialAndAdapt(
        adaptiveRef.current,
        evalRes.perfectTurn,
        rtMs
      );
      setAdaptive(nextAdaptive);
      adaptiveRef.current = nextAdaptive;

      // Dynamic N-Back Adjustment (N=1..4) based on streaks
      if (nextAdaptive.lastAdjustment === 'UP' && currentN < 4) {
        const upgradedN = Math.min(4, currentN + 1);
        setNLevel(upgradedN);
        nLevelRef.current = upgradedN;
        setTurnFeedbackBanner(
          `OVERCLOCK! N-BACK LEVEL UPGRADED TO ${upgradedN}-BACK`
        );
        soundEngine.playCorrectChord(combo + 2);
      } else if (nextAdaptive.lastAdjustment === 'DOWN' && currentN > 1) {
        const downgradedN = Math.max(1, currentN - 1);
        setNLevel(downgradedN);
        nLevelRef.current = downgradedN;
        setTurnFeedbackBanner(
          `BUFFER STABILIZED: ADJUSTED TO ${downgradedN}-BACK`
        );
        soundEngine.playWrongBuzz();
      } else if (evalRes.perfectTurn) {
        const nextCombo = combo + 1;
        setCombo(nextCombo);
        const pts = Math.round(
          (evalRes.scoreDelta + currentN * 45 + nextCombo * 20) * bdnfMultiplier
        );
        setScore((s) => s + pts);
        if (
          evalRes.positionOutcome === 'HIT' ||
          evalRes.audioOutcome === 'HIT'
        ) {
          soundEngine.playCorrectChord(nextCombo);
          setTurnFeedbackBanner(
            `SYNAPSE MATCH LOCKED! (+${pts} EXP · COMBO x${nextCombo})`
          );
        } else {
          setTurnFeedbackBanner(
            `CLEAN INTERFERENCE FILTER (+${pts} EXP · POS:${evalRes.positionOutcome} / AUD:${evalRes.audioOutcome})`
          );
        }
      } else {
        setCombo(0);
        soundEngine.playWrongBuzz();
        setTurnFeedbackBanner(
          `SIGNAL DRIFT (POS: ${evalRes.positionOutcome} · AUD: ${evalRes.audioOutcome})`
        );
      }
    } else {
      setTurnFeedbackBanner(
        `ENCODING BUFFER TURN ${turnIndex + 1}/${currentN} — MEMORIZE POSITION & VOICE [${currentStim.letter}]`
      );
    }

    const nextIdx = turnIndex + 1;
    if (nextIdx >= sequence.length) {
      document.body.dataset.state = 'gameover';
      soundEngine.playVictoryFanfare();
      setStatus('SUMMARY');
    } else {
      setTurnIndex(nextIdx);
      triggerTurnStimulus(nextIdx, sequence);
    }
  }, [bdnfMultiplier, combo, sequence, triggerTurnStimulus, turnIndex]);

  // Automatic 2.5s cadence during PLAYING
  useEffect(() => {
    if (status !== 'PLAYING') return;
    const interval = setInterval(() => {
      evaluateAndAdvanceTurn();
    }, 2500);
    return () => clearInterval(interval);
  }, [evaluateAndAdvanceTurn, status]);

  const startSession = useCallback(() => {
    soundEngine.playUiClick(1.2);
    document.body.dataset.state = 'playing';
    const freshSeq = generateDualNBackSequence(nLevel, baseTurns);
    setSequence(freshSeq);
    setTurnIndex(0);
    setScore(0);
    setCombo(0);
    setLastTurnResult(null);
    setTurnFeedbackBanner(
      `ENCODING INITIAL ${nLevel} TURNS INTO PREFRONTAL WORKING MEMORY...`
    );
    setStatus('PLAYING');
    triggerTurnStimulus(0, freshSeq);
  }, [baseTurns, nLevel, triggerTurnStimulus]);

  const handleTogglePositionMatch = useCallback(() => {
    if (status !== 'PLAYING') return;
    soundEngine.playUiClick(1.1);
    setPressedPosition((prev) => {
      const next = !prev;
      pressedPosRef.current = next;
      return next;
    });
  }, [status]);

  const handleToggleAudioMatch = useCallback(() => {
    if (status !== 'PLAYING') return;
    soundEngine.playUiClick(1.3);
    setPressedAudio((prev) => {
      const next = !prev;
      pressedAudRef.current = next;
      return next;
    });
  }, [status]);

  // Keyboard shortcuts: A (Position Match), L (Audio Match)
  useEffect(() => {
    if (status !== 'PLAYING') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'a' || e.key === 'ArrowLeft') {
        e.preventDefault();
        handleTogglePositionMatch();
      } else if (key === 'l' || e.key === 'ArrowRight') {
        e.preventDefault();
        handleToggleAudioMatch();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleToggleAudioMatch, handleTogglePositionMatch, status]);

  const currentStimulus = sequence[turnIndex] || sequence[0];
  const windowStats = getRecentWindowStats(adaptive, 5);

  const finishAndSave = () => {
    soundEngine.playUiClick(1.1);
    onComplete({
      rawExp: Math.max(400, score),
      nBackLevel: nLevel,
      accuracyPct: windowStats.accuracyPct,
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
              NODE 02 · 【PHANTOM CODE】 進化型 Dual {nLevel}-Back
            </h2>
            <p className="text-sm text-slate-300">
              前頭前野ワーキングメモリ拡張 · 3×3発光グリッド＆音声レター二重照合
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-5 font-mono tabular-nums">
          <div>
            <div className="text-xs text-slate-400">現在の負荷 (N-BACK)</div>
            <div
              data-testid="phantom-nlevel"
              className="text-xl font-bold text-[#8A2BE2]"
            >
              N = {nLevel}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">ターン進行</div>
            <div
              data-testid="phantom-turn"
              className="text-xl font-bold text-[#00F0FF]"
            >
              {Math.min(sequence.length, turnIndex + 1)} / {sequence.length}
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
              data-testid="phantom-score"
              className="text-xl font-bold text-white"
            >
              {score}
            </div>
          </div>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: 3x3 Cyber Grid Arena */}
        <div className="lg:col-span-7 relative flex flex-col items-center justify-center bg-[#0B0F19] rounded-xl border border-slate-800 p-6 min-h-[390px]">
          {/* Active Voice Telemetry Readout */}
          <div className="w-full max-w-[360px] flex items-center justify-between mb-4 px-3.5 py-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Volume2 className="w-4 h-4 text-[#00F0FF]" />
              <span>AUDIO SIGNAL:</span>
            </div>
            <div className="font-mono text-xl font-bold text-[#00F0FF]">
              {status === 'PLAYING' ? `[ ${currentStimulus.letter} ]` : '[ STANDBY ]'}
            </div>
          </div>

          {/* 3x3 Cyber Grid */}
          <div
            data-testid="phantom-grid"
            className="grid grid-cols-3 gap-3.5 w-full max-w-[360px] aspect-square"
          >
            {Array.from({length: 9}).map((_, idx) => {
              const isLit = status === 'PLAYING' && activeCell === idx;
              return (
                <div
                  key={idx}
                  data-active={isLit ? 'true' : 'false'}
                  className={`rounded-xl border-2 flex items-center justify-center transition-all duration-150 font-mono text-lg font-bold ${
                    isLit
                      ? 'border-[#00F0FF] bg-[#00F0FF]/30 text-white shadow-[0_0_28px_rgba(0,240,255,0.45)] scale-[1.03]'
                      : 'border-slate-800 bg-slate-900/60 text-slate-600'
                  }`}
                >
                  {isLit ? currentStimulus.letter : `0${idx + 1}`}
                </div>
              );
            })}
          </div>

          {/* Briefing Overlay */}
          {status === 'BRIEFING' && (
            <div className="absolute inset-0 bg-[#0B0F19]/92 rounded-xl flex flex-col items-center justify-center p-6 text-center">
              <Cpu className="w-12 h-12 text-[#8A2BE2] mb-3" />
              <h3 className="font-display text-2xl font-bold text-white mb-2">
                【PHANTOM CODE】 進化型 Dual {nLevel}-Back プロトコル
              </h3>
              <p className="text-base text-slate-200 max-w-md mb-5 leading-relaxed">
                2.5秒ごとに3×3グリッドの1箇所が発光し、アルファベット音声（C, H, K, L, Q, R, S, T）が再生されます。
                <span className="text-[#00F0FF] font-bold mx-1">
                  {nLevel}個前
                </span>
                と「位置が同じ」なら左ボタン（Aキー）、「音が同じ」なら右ボタン（Lキー）を押してください（両方同じなら両方押す）。
              </p>
              <button
                type="button"
                data-start="true"
                onClick={startSession}
                className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-lg bg-[#8A2BE2] text-white font-display font-bold text-base hover:bg-[#8A2BE2]/90 transition-colors cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current" />
                PHANTOM CODE トレーニング開始
              </button>
            </div>
          )}

          {/* Summary Overlay */}
          {status === 'SUMMARY' && (
            <div className="absolute inset-0 bg-[#0B0F19]/95 rounded-xl flex flex-col items-center justify-center p-6 text-center">
              <CheckCircle2 className="w-12 h-12 text-[#00FF66] mb-3" />
              <h3 className="font-display text-2xl font-bold text-white mb-1">
                PHANTOM CODE シーケンス完了
              </h3>
              <p className="text-sm text-slate-300 mb-5">
                前頭前野ワーキングメモリ容量データがメインフレームへ同期されました
              </p>

              <div className="grid grid-cols-3 gap-4 w-full max-w-md mb-6 font-mono tabular-nums">
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-xs text-slate-400">到達Nレベル</div>
                  <div className="text-xl font-bold text-[#8A2BE2]">
                    {nLevel}-Back
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-xs text-slate-400">正答率</div>
                  <div className="text-xl font-bold text-[#00FF66]">
                    {windowStats.accuracyPct}%
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-xs text-slate-400">獲得EXP</div>
                  <div className="text-xl font-bold text-white">
                    +{Math.max(400, score)}
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

        {/* Right: Dual Match Controller & Telemetry */}
        <div className="lg:col-span-5 flex flex-col justify-between bg-[#0B0F19] rounded-xl border border-slate-800 p-5">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
              REAL-TIME INTERFERENCE MONITOR
            </div>
            <div className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 text-sm font-mono text-[#00F0FF] mb-5">
              {turnFeedbackBanner}
            </div>

            {/* Dual Match Trigger Buttons (Large 50s-ergonomic thumb controls) */}
            <div className="space-y-3.5 mb-5">
              <button
                type="button"
                disabled={status !== 'PLAYING'}
                onClick={handleTogglePositionMatch}
                className={`w-full py-4 px-5 rounded-xl border-2 flex items-center justify-between font-display font-bold text-lg transition-all ${
                  pressedPosition
                    ? 'border-[#00F0FF] bg-[#00F0FF]/25 text-[#00F0FF]'
                    : status === 'PLAYING'
                      ? 'border-slate-700 bg-slate-900 text-white hover:border-[#00F0FF]/80 cursor-pointer'
                      : 'border-slate-800 bg-slate-900/40 text-slate-500 cursor-not-allowed'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Grid className="w-5 h-5 text-[#00F0FF]" />
                  POSITION MATCH · 位置が同じ
                </span>
                <span className="font-mono text-xs px-2.5 py-1 rounded bg-slate-950 text-slate-300">
                  [Aキー / 左ボタン]
                </span>
              </button>

              <button
                type="button"
                disabled={status !== 'PLAYING'}
                onClick={handleToggleAudioMatch}
                className={`w-full py-4 px-5 rounded-xl border-2 flex items-center justify-between font-display font-bold text-lg transition-all ${
                  pressedAudio
                    ? 'border-[#8A2BE2] bg-[#8A2BE2]/25 text-white'
                    : status === 'PLAYING'
                      ? 'border-slate-700 bg-slate-900 text-white hover:border-[#8A2BE2]/80 cursor-pointer'
                      : 'border-slate-800 bg-slate-900/40 text-slate-500 cursor-not-allowed'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Volume2 className="w-5 h-5 text-[#8A2BE2]" />
                  AUDIO MATCH · 音が同じ
                </span>
                <span className="font-mono text-xs px-2.5 py-1 rounded bg-slate-950 text-slate-300">
                  [Lキー / 右ボタン]
                </span>
              </button>
            </div>

            {lastTurnResult && (
              <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-slate-400 mb-1">LAST POSITION JUDGE</div>
                  <div
                    className={`font-bold ${
                      lastTurnResult.positionOutcome === 'HIT' ||
                      lastTurnResult.positionOutcome === 'CORRECT_REJECTION'
                        ? 'text-[#00FF66]'
                        : 'text-[#FF2A54]'
                    }`}
                  >
                    {lastTurnResult.positionOutcome}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-slate-400 mb-1">LAST AUDIO JUDGE</div>
                  <div
                    className={`font-bold ${
                      lastTurnResult.audioOutcome === 'HIT' ||
                      lastTurnResult.audioOutcome === 'CORRECT_REJECTION'
                        ? 'text-[#00FF66]'
                        : 'text-[#FF2A54]'
                    }`}
                  >
                    {lastTurnResult.audioOutcome}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Controls: Step Next Turn & Complete */}
          <div className="pt-4 mt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
            {status === 'PLAYING' && (
              <button
                type="button"
                onClick={evaluateAndAdvanceTurn}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#00F0FF]/50 bg-[#00F0FF]/10 text-[#00F0FF] text-xs font-mono font-semibold hover:bg-[#00F0FF]/20 cursor-pointer"
              >
                <FastForward className="w-3.5 h-3.5" />
                Advance Turn Now
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
