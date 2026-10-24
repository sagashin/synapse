'use client';

import React, {useState, useEffect} from 'react';
import {
  Eye,
  Cpu,
  Gauge,
  Flame,
  HeartPulse,
  Moon,
  Play,
  Volume2,
  VolumeX,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import {calculateBdnfMultiplier} from '@/lib/adaptive-engine';
import {
  DEFAULT_SAVE_STATE,
  SynapseSaveState,
  loadSynapseState,
  recordModuleCompletion,
  saveSynapseState,
} from '@/lib/storage';
import {soundEngine} from '@/lib/sound-engine';
import HawkEyeGame from '@/components/HawkEyeGame';
import PhantomCodeGame from '@/components/PhantomCodeGame';
import LaserDriveGame from '@/components/LaserDriveGame';
import BrainRadarAndCharts from '@/components/BrainRadarAndCharts';

type ActiveModule =
  | 'DASHBOARD'
  | 'HAWK_EYE'
  | 'PHANTOM_CODE'
  | 'LASER_DRIVE'
  | 'BOSS_NODE';

export default function SynapseRoguePage() {
  const [saveState, setSaveState] =
    useState<SynapseSaveState>(DEFAULT_SAVE_STATE);
  const [activeModule, setActiveModule] = useState<ActiveModule>('DASHBOARD');
  const [bossStage, setBossStage] = useState<1 | 2 | 3>(1);
  const [muted, setMuted] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    const loaded = loadSynapseState();
    setSaveState(loaded);
    setHydrated(true);

    // Support ?autostart=1 or ?module= query parameters for rapid verification
    const params = new URLSearchParams(window.location.search);
    const mod = params.get('module');
    if (mod === 'hawkeye') setActiveModule('HAWK_EYE');
    else if (mod === 'phantom') setActiveModule('PHANTOM_CODE');
    else if (mod === 'laser') setActiveModule('LASER_DRIVE');
    else if (mod === 'boss') setActiveModule('BOSS_NODE');
  }, []);

  const bdnfMultiplier = calculateBdnfMultiplier(
    saveState.bdnfAerobic,
    saveState.bdnfSleep
  );

  const toggleBdnfAerobic = () => {
    const nextAerobic = !saveState.bdnfAerobic;
    const nextMult = calculateBdnfMultiplier(nextAerobic, saveState.bdnfSleep);
    soundEngine.playBdnfBoost(nextMult);
    const nextState: SynapseSaveState = {
      ...saveState,
      bdnfAerobic: nextAerobic,
    };
    setSaveState(nextState);
    saveSynapseState(nextState);
  };

  const toggleBdnfSleep = () => {
    const nextSleep = !saveState.bdnfSleep;
    const nextMult = calculateBdnfMultiplier(saveState.bdnfAerobic, nextSleep);
    soundEngine.playBdnfBoost(nextMult);
    const nextState: SynapseSaveState = {
      ...saveState,
      bdnfSleep: nextSleep,
    };
    setSaveState(nextState);
    saveSynapseState(nextState);
  };

  const handleToggleMute = () => {
    const next = !muted;
    soundEngine.muted = next;
    setMuted(next);
    if (!next) soundEngine.playUiClick(1.0);
  };

  const handleLaunchNextRogueNode = () => {
    soundEngine.playUiClick(1.2);
    if (!saveState.sectorProgress.hawkEyeCleared) {
      setActiveModule('HAWK_EYE');
    } else if (!saveState.sectorProgress.phantomCodeCleared) {
      setActiveModule('PHANTOM_CODE');
    } else if (!saveState.sectorProgress.laserDriveCleared) {
      setActiveModule('LASER_DRIVE');
    } else {
      setBossStage(1);
      setActiveModule('BOSS_NODE');
    }
  };

  const handleResetProgress = () => {
    soundEngine.playUiClick(0.8);
    setSaveState(DEFAULT_SAVE_STATE);
    saveSynapseState(DEFAULT_SAVE_STATE);
  };

  const clearedCount = [
    saveState.sectorProgress.hawkEyeCleared,
    saveState.sectorProgress.phantomCodeCleared,
    saveState.sectorProgress.laserDriveCleared,
    saveState.sectorProgress.bossCleared,
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen flex flex-col bg-[#0B0F19] text-slate-100">
      {/* Top Bar Contract: 3 Zones separated by gap-8 */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-slate-800/90 bg-[#0B0F19]/95 sticky top-0 z-30">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => {
            soundEngine.playUiClick();
            setActiveModule('DASHBOARD');
          }}
          className="font-display text-lg md:text-xl font-bold tracking-wider text-[#00F0FF] whitespace-nowrap shrink-0 cursor-pointer"
        >
          SYNAPSE ROGUE
        </button>

        {/* Zone 2: 4–5 concise single-line text navigation links */}
        <nav
          aria-label="Primary Module Navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300"
        >
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              setActiveModule('DASHBOARD');
            }}
            className={`hover:text-[#00F0FF] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeModule === 'DASHBOARD'
                ? 'text-[#00F0FF] underline underline-offset-8'
                : ''
            }`}
          >
            ダッシュボード
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              setActiveModule('HAWK_EYE');
            }}
            className={`hover:text-[#00F0FF] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeModule === 'HAWK_EYE'
                ? 'text-[#00F0FF] underline underline-offset-8'
                : ''
            }`}
          >
            1. HAWK EYE (視野)
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              setActiveModule('PHANTOM_CODE');
            }}
            className={`hover:text-[#00F0FF] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeModule === 'PHANTOM_CODE'
                ? 'text-[#00F0FF] underline underline-offset-8'
                : ''
            }`}
          >
            2. PHANTOM CODE (記憶)
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              setActiveModule('LASER_DRIVE');
            }}
            className={`hover:text-[#00F0FF] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeModule === 'LASER_DRIVE'
                ? 'text-[#00F0FF] underline underline-offset-8'
                : ''
            }`}
          >
            3. LASER DRIVE (Step2・マルチタスク)
          </button>
          <button
            type="button"
            onClick={handleToggleMute}
            aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
            className="hover:text-[#00F0FF] transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer"
          >
            {muted ? (
              <VolumeX className="w-4 h-4 text-[#FF2A54]" />
            ) : (
              <Volume2 className="w-4 h-4 text-[#00FF66]" />
            )}
            <span>{muted ? '消音中' : 'シンセ効果音'}</span>
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleLaunchNextRogueNode}
            className="px-4 py-2 text-xs md:text-sm font-display font-bold text-slate-950 bg-[#00F0FF] rounded-lg hover:bg-[#00F0FF]/90 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            デイリー訓練開始
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-6 py-5 space-y-5">
        {activeModule === 'DASHBOARD' && (
          <>
            {/* Top Mainframe Hero & Real-Life BDNF Physical Link */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              {/* Left 7 Cols: Starship Mainframe Status & CTA */}
              <div className="lg:col-span-7 rounded-xl border border-slate-800 bg-[#0E1422]/90 p-5 flex flex-col justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-400 mb-2">
                    <span>STARSHIP NEURAL MAINFRAME</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#00F0FF] font-semibold">
                      称号: {saveState.rankTitle}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#00FF66]">
                      累計EXP: {hydrated ? saveState.totalExp.toLocaleString() : '2,450'}
                    </span>
                  </div>

                  <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight text-balance mb-2.5">
                    恒星間宇宙船メインフレーム・シナプス再起動プロトコル
                  </h1>

                  <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-2xl mb-4">
                    UFOV（有効視野＆ミリ秒視覚処理）、進化型Dual N-Back（ワーキングメモリ）、さらにStep 2のUCSF『NeuroRacer』研究ベース【LASER DRIVE】（マルチタスク＆干渉制御）まで全3コアモジュール＋ボスステージを完全実装。正答率75%〜80%の神経可塑性ゾーンへ動的調整します。
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-3.5 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={handleLaunchNextRogueNode}
                    className="inline-flex items-center gap-2.5 px-5 py-3 rounded-lg bg-[#00F0FF] text-slate-950 font-display font-bold text-sm sm:text-base hover:bg-[#00F0FF]/90 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    本日のローグ・セクターを開始
                  </button>

                  <div className="text-xs font-mono text-slate-300 ml-auto tabular-nums">
                    メインフレーム復旧率: <strong className="text-white">{68 + clearedCount * 8}%</strong> ({clearedCount}/4 ノード完了)
                  </div>
                </div>
              </div>

              {/* Right 5 Cols: Real-Life BDNF Booster (Physical Link Gimmick) */}
              <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-[#0E1422]/90 p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <h2 className="font-display text-lg font-bold text-white">
                      REAL-LIFE BDNF BOOSTER（フィジカル連動）
                    </h2>
                    <span
                      data-testid="bdnf-multiplier-value"
                      className={`font-mono text-base font-bold tabular-nums ${
                        bdnfMultiplier >= 2.0
                          ? 'text-[#00FF66]'
                          : bdnfMultiplier > 1.0
                            ? 'text-[#00F0FF]'
                            : 'text-slate-400'
                      }`}
                    >
                      BOOST {bdnfMultiplier.toFixed(1)}x EXP
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-200 mb-3">
                    運動と睡眠で脳内物質BDNF（脳由来神経栄養因子）を活性化。両方ONで獲得EXPが
                    <strong className="text-[#00FF66] mx-1">2.0倍</strong>
                    になります。
                  </p>

                  <div className="space-y-2.5">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={saveState.bdnfAerobic}
                      data-testid="bdnf-aerobic-toggle"
                      onClick={toggleBdnfAerobic}
                      className={`w-full p-3 rounded-xl border flex items-center justify-between text-left transition-all cursor-pointer ${
                        saveState.bdnfAerobic
                          ? 'border-[#00FF66] bg-[#00FF66]/15 text-white'
                          : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <HeartPulse
                          className={`w-5 h-5 shrink-0 ${
                            saveState.bdnfAerobic
                              ? 'text-[#00FF66]'
                              : 'text-slate-400'
                          }`}
                        />
                        <div>
                          <div className="text-sm font-bold">
                            今日の有酸素運動（20分以上）
                          </div>
                          <div className="text-xs text-slate-400">
                            海馬・前頭葉のBDNF分泌を促進（EXP +0.5倍）
                          </div>
                        </div>
                      </div>
                      <span className="font-mono text-xs font-bold shrink-0 ml-2">
                        {saveState.bdnfAerobic ? 'ON (+0.5x)' : 'OFF'}
                      </span>
                    </button>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={saveState.bdnfSleep}
                      data-testid="bdnf-sleep-toggle"
                      onClick={toggleBdnfSleep}
                      className={`w-full p-3 rounded-xl border flex items-center justify-between text-left transition-all cursor-pointer ${
                        saveState.bdnfSleep
                          ? 'border-[#00F0FF] bg-[#00F0FF]/15 text-white'
                          : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Moon
                          className={`w-5 h-5 shrink-0 ${
                            saveState.bdnfSleep
                              ? 'text-[#00F0FF]'
                              : 'text-slate-400'
                          }`}
                        />
                        <div>
                          <div className="text-sm font-bold">
                            7時間以上の睡眠
                          </div>
                          <div className="text-xs text-slate-400">
                            睡眠中のシナプス定着＆老廃物除去（EXP +0.5倍）
                          </div>
                        </div>
                      </div>
                      <span className="font-mono text-xs font-bold shrink-0 ml-2">
                        {saveState.bdnfSleep ? 'ON (+0.5x)' : 'OFF'}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">BDNFブースト状態:</span>
                  <span
                    className={
                      bdnfMultiplier >= 2.0
                        ? 'text-[#00FF66] font-bold'
                        : bdnfMultiplier > 1.0
                          ? 'text-[#00F0FF] font-bold'
                          : 'text-slate-400'
                    }
                  >
                    {bdnfMultiplier >= 2.0
                      ? 'MAX OVERCLOCK 発動中 (2.0倍 EXP)'
                      : bdnfMultiplier > 1.0
                        ? 'BDNFブースト稼働中 (1.5倍 EXP)'
                        : '通常モード (1.0倍 EXP)'}
                  </span>
                </div>
              </div>
            </section>

            {/* 4 Core Scientific Metrics Strip */}
            <section
              aria-label="Core Brain Telemetry"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
            >
              <div className="rounded-xl border border-slate-800 bg-[#0E1422]/90 p-4">
                <div className="text-xs font-mono uppercase tracking-wider text-slate-300 mb-1">
                  01. 処理速度 (Processing Speed)
                </div>
                <div className="flex items-baseline gap-1.5 font-mono tabular-nums">
                  <span
                    data-testid="metric-processing-speed"
                    className="text-3xl font-bold text-[#00F0FF]"
                  >
                    {saveState.processingSpeedMs}
                  </span>
                  <span className="text-xs uppercase text-slate-400">ms</span>
                </div>
                <div className="text-xs font-mono text-slate-300 mt-1.5">
                  限界表示時間: <strong className="text-white">{saveState.minExposureMs} ms</strong>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#0E1422]/90 p-4">
                <div className="text-xs font-mono uppercase tracking-wider text-slate-300 mb-1">
                  02. 有効視野 (UFOV Level)
                </div>
                <div className="flex items-baseline gap-1.5 font-mono tabular-nums">
                  <span
                    data-testid="metric-ufov-level"
                    className="text-3xl font-bold text-[#8A2BE2]"
                  >
                    Lv.{saveState.ufovLevel}
                  </span>
                  <span className="text-xs uppercase text-slate-400">
                    / 10 MAX
                  </span>
                </div>
                <div className="text-xs font-mono text-slate-300 mt-1.5">
                  周辺8方向ドローン同時捕捉ランク
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#0E1422]/90 p-4">
                <div className="text-xs font-mono uppercase tracking-wider text-slate-300 mb-1">
                  03. 作業記憶 (Working Memory)
                </div>
                <div className="flex items-baseline gap-1.5 font-mono tabular-nums">
                  <span
                    data-testid="metric-nback-level"
                    className="text-3xl font-bold text-[#00FF66]"
                  >
                    {saveState.nBackLevel}-Back
                  </span>
                  <span className="text-xs uppercase text-slate-400">
                    DUAL N-BACK
                  </span>
                </div>
                <div className="text-xs font-mono text-slate-300 mt-1.5">
                  3×3発光位置 × 音声レター同時保持
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#0E1422]/90 p-4">
                <div className="text-xs font-mono uppercase tracking-wider text-slate-300 mb-1">
                  04. BDNF倍率 & マルチタスク干渉コスト
                </div>
                <div className="flex items-baseline gap-2 font-mono tabular-nums">
                  <span
                    data-testid="metric-interference-cost"
                    className="text-3xl font-bold text-white"
                  >
                    {saveState.interferenceCostPct.toFixed(1)}%
                  </span>
                  <span className="text-xs text-[#00FF66] font-bold">
                    BDNF {bdnfMultiplier.toFixed(1)}x
                  </span>
                </div>
                <div className="text-xs font-mono text-slate-300 mt-1.5">
                  LASER DRIVE 干渉コスト（低いほど優秀）
                </div>
              </div>
            </section>

            {/* Daily Rogue Sector Map (Node 1 -> Node 2 -> Node 3 -> Boss Node) */}
            <section className="rounded-xl border border-slate-800 bg-[#0E1422]/90 p-5">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="font-display text-xl font-bold text-white">
                    DAILY ROGUE SECTOR（1日5〜7分のマップ進行 · Step 2【LASER DRIVE】統合済）
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300">
                    Node 1 (Hawk Eye) → Node 2 (Phantom Code) → Node 3 (Laser Drive: Step 2) → Boss Node (高負荷連続モード)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetProgress}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-xs font-mono text-slate-300 hover:text-white hover:border-slate-700 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  進行リセット
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Node 1: HAWK EYE */}
                <div className="rounded-xl border border-slate-800 bg-[#0B0F19] p-4 flex flex-col justify-between hover:border-[#00F0FF] transition-colors">
                  <div>
                    <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
                      <span>NODE 01 · 視覚処理</span>
                      <span
                        className={
                          saveState.sectorProgress.hawkEyeCleared
                            ? 'text-[#00FF66] font-bold'
                            : 'text-[#00F0FF]'
                        }
                      >
                        {saveState.sectorProgress.hawkEyeCleared
                          ? 'CLEARED'
                          : 'READY'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <Eye className="w-5 h-5 text-[#00F0FF] shrink-0" />
                      <h3 className="font-display text-lg font-bold text-white">
                        【HAWK EYE】
                      </h3>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-3">
                      UFOV（有効視野＆処理速度）。中央の暗号文字と周辺8方向のスパイドローンを{saveState.minExposureMs}msで同時捕捉。
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-400 tabular-nums">
                      最高: {saveState.sectorProgress.hawkEyeBestScore} EXP
                    </span>
                    <button
                      type="button"
                      data-testid="launch-hawkeye-btn"
                      onClick={() => {
                        soundEngine.playUiClick(1.1);
                        setActiveModule('HAWK_EYE');
                      }}
                      className="px-3.5 py-2 rounded-lg bg-[#00F0FF]/15 border border-[#00F0FF]/60 text-[#00F0FF] font-display font-bold text-xs hover:bg-[#00F0FF] hover:text-slate-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      HAWK EYE 起動
                    </button>
                  </div>
                </div>

                {/* Node 2: PHANTOM CODE */}
                <div className="rounded-xl border border-slate-800 bg-[#0B0F19] p-4 flex flex-col justify-between hover:border-[#8A2BE2] transition-colors">
                  <div>
                    <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
                      <span>NODE 02 · 作業記憶</span>
                      <span
                        className={
                          saveState.sectorProgress.phantomCodeCleared
                            ? 'text-[#00FF66] font-bold'
                            : 'text-[#8A2BE2]'
                        }
                      >
                        {saveState.sectorProgress.phantomCodeCleared
                          ? 'CLEARED'
                          : 'READY'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <Cpu className="w-5 h-5 text-[#8A2BE2] shrink-0" />
                      <h3 className="font-display text-lg font-bold text-white">
                        【PHANTOM CODE】
                      </h3>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-3">
                      進化型 Dual N-Back。3×3発光パネル位置とアルファベット音声を{saveState.nBackLevel}個前と同時照合。
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-400 tabular-nums">
                      最高: {saveState.sectorProgress.phantomCodeBestScore} EXP
                    </span>
                    <button
                      type="button"
                      data-testid="launch-phantom-btn"
                      onClick={() => {
                        soundEngine.playUiClick(1.1);
                        setActiveModule('PHANTOM_CODE');
                      }}
                      className="px-3.5 py-2 rounded-lg bg-[#8A2BE2]/20 border border-[#8A2BE2]/70 text-white font-display font-bold text-xs hover:bg-[#8A2BE2] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      PHANTOM CODE 起動
                    </button>
                  </div>
                </div>

                {/* Node 3: LASER DRIVE (Step 2) */}
                <div className="rounded-xl border border-[#00FF66]/50 bg-[#0B0F19] p-4 flex flex-col justify-between hover:border-[#00FF66] transition-colors">
                  <div>
                    <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
                      <span>NODE 03 · STEP 2 実装済</span>
                      <span className="text-[#00FF66] font-bold">
                        {saveState.sectorProgress.laserDriveCleared
                          ? 'CLEARED'
                          : 'NEURORACER'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <Gauge className="w-5 h-5 text-[#00FF66] shrink-0" />
                      <h3 className="font-display text-lg font-bold text-white">
                        【LASER DRIVE】
                      </h3>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-3">
                      UCSF NeuroRacer準拠マルチタスク＆干渉制御。うねるコース維持と「緑の三角形」撃墜を同時遂行。
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-400 tabular-nums">
                      最高: {saveState.sectorProgress.laserDriveBestScore} EXP
                    </span>
                    <button
                      type="button"
                      data-testid="launch-laser-btn"
                      onClick={() => {
                        soundEngine.playUiClick(1.1);
                        setActiveModule('LASER_DRIVE');
                      }}
                      className="px-3.5 py-2 rounded-lg bg-[#00FF66] text-slate-950 font-display font-bold text-xs hover:bg-[#00FF66]/90 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      LASER DRIVE 起動
                    </button>
                  </div>
                </div>

                {/* Node 4: BOSS NODE (High-Load Continuous Gauntlet) */}
                <div className="rounded-xl border border-[#FF2A54]/50 bg-[#0B0F19] p-4 flex flex-col justify-between hover:border-[#FF2A54] transition-colors">
                  <div>
                    <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
                      <span>BOSS NODE · 高負荷連続</span>
                      <span className="text-[#FF2A54] font-bold">
                        {saveState.sectorProgress.bossCleared
                          ? 'CONQUERED'
                          : 'OVERDRIVE'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <Flame className="w-5 h-5 text-[#FF2A54] shrink-0" />
                      <h3 className="font-display text-lg font-bold text-white">
                        【OVERDRIVE CORE】
                      </h3>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-3">
                      高負荷連続ボスモード。Hawk Eye → Phantom Code → Laser Driveを3連戦突破しEXP 2.0倍獲得。
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-400 tabular-nums">
                      報酬: 2.0倍 EXP
                    </span>
                    <button
                      type="button"
                      data-testid="launch-boss-btn"
                      onClick={() => {
                        soundEngine.playUiClick(1.3);
                        setBossStage(1);
                        setActiveModule('BOSS_NODE');
                      }}
                      className="px-3.5 py-2 rounded-lg bg-[#FF2A54] text-white font-display font-bold text-xs hover:bg-[#FF2A54]/90 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      ボスモード起動
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Brain Spec Radar & 7-Day Score Trend SVG Charts */}
            <BrainRadarAndCharts
              state={saveState}
              bdnfMultiplier={bdnfMultiplier}
            />
          </>
        )}

        {/* Active Training Module 1: HAWK EYE */}
        {activeModule === 'HAWK_EYE' && (
          <HawkEyeGame
            initialLevel={saveState.ufovLevel}
            initialExposureMs={saveState.minExposureMs}
            bdnfMultiplier={bdnfMultiplier}
            onBack={() => setActiveModule('DASHBOARD')}
            onComplete={(res) => {
              const updated = recordModuleCompletion(saveState, {
                module: 'HAWK_EYE',
                rawExp: res.rawExp,
                reactionMs: res.reactionMs,
                minExposureMs: res.minExposureMs,
                ufovLevel: res.ufovLevel,
              });
              setSaveState(updated);
              setActiveModule('DASHBOARD');
            }}
          />
        )}

        {/* Active Training Module 2: PHANTOM CODE */}
        {activeModule === 'PHANTOM_CODE' && (
          <PhantomCodeGame
            initialNBack={saveState.nBackLevel}
            bdnfMultiplier={bdnfMultiplier}
            onBack={() => setActiveModule('DASHBOARD')}
            onComplete={(res) => {
              const updated = recordModuleCompletion(saveState, {
                module: 'PHANTOM_CODE',
                rawExp: res.rawExp,
                nBackLevel: res.nBackLevel,
              });
              setSaveState(updated);
              setActiveModule('DASHBOARD');
            }}
          />
        )}

        {/* Active Training Module 3: LASER DRIVE */}
        {activeModule === 'LASER_DRIVE' && (
          <LaserDriveGame
            bdnfMultiplier={bdnfMultiplier}
            onBack={() => setActiveModule('DASHBOARD')}
            onComplete={(res) => {
              const updated = recordModuleCompletion(saveState, {
                module: 'LASER_DRIVE',
                rawExp: res.rawExp,
                interferenceCostPct: res.interferenceCostPct,
              });
              setSaveState(updated);
              setActiveModule('DASHBOARD');
            }}
          />
        )}

        {/* Active BOSS NODE: High-Load Continuous Sequence */}
        {activeModule === 'BOSS_NODE' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#FF2A54]/60 bg-[#FF2A54]/10 px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-5 h-5 text-[#FF2A54]" />
                <span className="font-display font-bold text-white">
                  BOSS GAUNTLET · STAGE {bossStage} OF 3
                </span>
              </div>
              <div className="font-mono text-xs text-slate-200">
                {bossStage === 1
                  ? 'PHASE 1: HAWK EYE UFOV'
                  : bossStage === 2
                    ? 'PHASE 2: PHANTOM CODE N-BACK'
                    : 'FINAL PHASE: LASER DRIVE MULTITASK'}
              </div>
            </div>

            {bossStage === 1 && (
              <HawkEyeGame
                initialLevel={Math.max(3, saveState.ufovLevel)}
                initialExposureMs={Math.min(160, saveState.minExposureMs)}
                bdnfMultiplier={bdnfMultiplier * 1.5}
                isBossGauntlet
                onBack={() => setActiveModule('DASHBOARD')}
                onComplete={(res) => {
                  const updated = recordModuleCompletion(saveState, {
                    module: 'HAWK_EYE',
                    rawExp: res.rawExp,
                    reactionMs: res.reactionMs,
                    minExposureMs: res.minExposureMs,
                    ufovLevel: res.ufovLevel,
                  });
                  setSaveState(updated);
                  setBossStage(2);
                }}
              />
            )}

            {bossStage === 2 && (
              <PhantomCodeGame
                initialNBack={Math.max(2, saveState.nBackLevel)}
                bdnfMultiplier={bdnfMultiplier * 1.5}
                isBossGauntlet
                onBack={() => setActiveModule('DASHBOARD')}
                onComplete={(res) => {
                  const updated = recordModuleCompletion(saveState, {
                    module: 'PHANTOM_CODE',
                    rawExp: res.rawExp,
                    nBackLevel: res.nBackLevel,
                  });
                  setSaveState(updated);
                  setBossStage(3);
                }}
              />
            )}

            {bossStage === 3 && (
              <LaserDriveGame
                bdnfMultiplier={bdnfMultiplier * 2.0}
                isBossGauntlet
                onBack={() => setActiveModule('DASHBOARD')}
                onComplete={(res) => {
                  const updated = recordModuleCompletion(saveState, {
                    module: 'BOSS_NODE',
                    rawExp: res.rawExp * 2,
                    interferenceCostPct: res.interferenceCostPct,
                  });
                  setSaveState(updated);
                  setActiveModule('DASHBOARD');
                }}
              />
            )}
          </div>
        )}
      </main>

      {/* Clean Quiet Footer */}
      <footer className="border-t border-slate-800/80 px-6 py-4 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-4 max-w-[1360px] w-full mx-auto">
        <span>SYNAPSE ROGUE — Neuroplasticity Tactical Mainframe</span>
        <span>
          Evidence-Based Cognitive Protocols: UFOV · Dual N-Back · UCSF NeuroRacer Interference Control
        </span>
      </footer>
    </div>
  );
}
