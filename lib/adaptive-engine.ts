export interface TrialRecord {
  correct: boolean;
  reactionTimeMs: number;
  exposureMs: number;
  levelAtTrial: number;
}

export interface AdaptiveState {
  level: number;
  exposureMs: number;
  distractorCount: number;
  nBackLevel: number;
  courseSpeed: number;
  targetWindowMs: number;
  consecutiveCorrect: number;
  consecutiveWrong: number;
  history: TrialRecord[];
  lastAdjustment: 'UP' | 'DOWN' | 'STABLE';
  lastAdjustmentReason: string;
}

export interface AdaptiveConfig {
  initialLevel?: number;
  minLevel?: number;
  maxLevel?: number;
  initialExposureMs?: number;
  minExposureMs?: number;
  maxExposureMs?: number;
  fastReactionThresholdMs?: number;
  initialNBack?: number;
}

export const DEFAULT_ADAPTIVE_CONFIG: Required<AdaptiveConfig> = {
  initialLevel: 1,
  minLevel: 1,
  maxLevel: 10,
  initialExposureMs: 250,
  minExposureMs: 30,
  maxExposureMs: 280,
  fastReactionThresholdMs: 1350,
  initialNBack: 2,
};

export function createInitialAdaptiveState(
  config: AdaptiveConfig = {}
): AdaptiveState {
  const cfg = {...DEFAULT_ADAPTIVE_CONFIG, ...config};
  return {
    level: cfg.initialLevel,
    exposureMs: cfg.initialExposureMs,
    distractorCount: Math.max(0, (cfg.initialLevel - 1) * 2),
    nBackLevel: cfg.initialNBack,
    courseSpeed: 1.0 + (cfg.initialLevel - 1) * 0.15,
    targetWindowMs: Math.max(360, 620 - (cfg.initialLevel - 1) * 30),
    consecutiveCorrect: 0,
    consecutiveWrong: 0,
    history: [],
    lastAdjustment: 'STABLE',
    lastAdjustmentReason: 'INITIAL_CALIBRATION',
  };
}

/**
 * Dynamic Adaptive Difficulty Engine (UFOV / Dual N-Back / NeuroRacer)
 * Keeps player accuracy around the 75%–80% neuroplasticity zone.
 * - Monitors last 5 trials' accuracy and reaction time (ms).
 * - 3 consecutive correct + fast reaction -> Level UP, shorten exposure by 15-20ms, add noise.
 * - 2 consecutive wrong -> Level DOWN, lengthen exposure by 20ms, reduce noise.
 */
export function recordTrialAndAdapt(
  state: AdaptiveState,
  correct: boolean,
  reactionTimeMs: number,
  config: AdaptiveConfig = {}
): AdaptiveState {
  const cfg = {...DEFAULT_ADAPTIVE_CONFIG, ...config};
  const newHistory: TrialRecord[] = [
    ...state.history,
    {
      correct,
      reactionTimeMs: Math.max(10, Math.round(reactionTimeMs)),
      exposureMs: state.exposureMs,
      levelAtTrial: state.level,
    },
  ];

  const recent5 = newHistory.slice(-5);
  const recentAvgRt =
    recent5.reduce((acc, t) => acc + t.reactionTimeMs, 0) / recent5.length;

  let consecutiveCorrect = correct ? state.consecutiveCorrect + 1 : 0;
  let consecutiveWrong = !correct ? state.consecutiveWrong + 1 : 0;

  let level = state.level;
  let exposureMs = state.exposureMs;
  let nBackLevel = state.nBackLevel;
  let lastAdjustment: 'UP' | 'DOWN' | 'STABLE' = 'STABLE';
  let lastAdjustmentReason = 'MAINTAINING 75-80% PLASTICITY ZONE';

  const isFastReaction =
    reactionTimeMs <= cfg.fastReactionThresholdMs ||
    recentAvgRt <= cfg.fastReactionThresholdMs;

  if (consecutiveCorrect >= 3 && isFastReaction) {
    level = Math.min(cfg.maxLevel, level + 1);
    const stepMs = reactionTimeMs < 850 ? 20 : 15;
    exposureMs = Math.max(cfg.minExposureMs, exposureMs - stepMs);
    if (consecutiveCorrect >= 3 && level >= 4 && nBackLevel < 4) {
      nBackLevel = Math.min(4, Math.floor(1 + level / 2.5));
    }
    consecutiveCorrect = 0;
    lastAdjustment = 'UP';
    lastAdjustmentReason = `3x STREAK (${Math.round(reactionTimeMs)}ms) -> EXPOSURE -${stepMs}ms / NOISE UP`;
  } else if (consecutiveWrong >= 2) {
    level = Math.max(cfg.minLevel, level - 1);
    exposureMs = Math.min(cfg.maxExposureMs, exposureMs + 20);
    if (nBackLevel > 1) {
      nBackLevel = Math.max(1, nBackLevel - 1);
    }
    consecutiveWrong = 0;
    lastAdjustment = 'DOWN';
    lastAdjustmentReason = `2x MISS DETECTED -> EXPOSURE +20ms / STABILIZING`;
  }

  const distractorCount = Math.min(7, Math.max(0, level - 1));
  const courseSpeed = Number((1.0 + (level - 1) * 0.16).toFixed(2));
  const targetWindowMs = Math.max(350, 620 - (level - 1) * 28);

  return {
    level,
    exposureMs,
    distractorCount,
    nBackLevel,
    courseSpeed,
    targetWindowMs,
    consecutiveCorrect,
    consecutiveWrong,
    history: newHistory,
    lastAdjustment,
    lastAdjustmentReason,
  };
}

export function getRecentWindowStats(state: AdaptiveState, windowSize = 5) {
  const slice = state.history.slice(-windowSize);
  if (slice.length === 0) {
    return {
      accuracyPct: 78,
      avgReactionMs: 620,
      minExposureMs: state.exposureMs,
      totalTrials: 0,
      inSweetSpot: true,
    };
  }
  const correctCount = slice.filter((t) => t.correct).length;
  const accuracyPct = Math.round((correctCount / slice.length) * 100);
  const avgReactionMs = Math.round(
    slice.reduce((sum, t) => sum + t.reactionTimeMs, 0) / slice.length
  );
  const allCorrectExposures = state.history
    .filter((t) => t.correct)
    .map((t) => t.exposureMs);
  const minExposureMs =
    allCorrectExposures.length > 0
      ? Math.min(...allCorrectExposures)
      : state.exposureMs;

  return {
    accuracyPct,
    avgReactionMs,
    minExposureMs,
    totalTrials: state.history.length,
    inSweetSpot: accuracyPct >= 70 && accuracyPct <= 85,
  };
}

/**
 * Real-Life BDNF Booster Multiplier
 * Aerobic exercise (20+ min) and Quality Sleep (7+ hrs) boost neuroplasticity EXP up to 2.0x.
 */
export function calculateBdnfMultiplier(
  aerobicExercise: boolean,
  qualitySleep: boolean
): number {
  if (aerobicExercise && qualitySleep) return 2.0;
  if (aerobicExercise || qualitySleep) return 1.5;
  return 1.0;
}

/**
 * HAWK EYE (UFOV) Trial Generator
 */
export const UFOV_SYMBOL_PAIRS: [string, string][] = [
  ['A', 'H'],
  ['X', 'K'],
  ['M', 'W'],
  ['Δ', 'Ω'],
  ['7', '4'],
  ['R', 'P'],
  ['Σ', 'Φ'],
  ['N', 'Z'],
];

export const COMPASS_DIRECTIONS = [
  {index: 0, label: 'N', angleDeg: -90, name: '12:00 (N)'},
  {index: 1, label: 'NE', angleDeg: -45, name: '01:30 (NE)'},
  {index: 2, label: 'E', angleDeg: 0, name: '03:00 (E)'},
  {index: 3, label: 'SE', angleDeg: 45, name: '04:30 (SE)'},
  {index: 4, label: 'S', angleDeg: 90, name: '06:00 (S)'},
  {index: 5, label: 'SW', angleDeg: 135, name: '07:30 (SW)'},
  {index: 6, label: 'W', angleDeg: 180, name: '09:00 (W)'},
  {index: 7, label: 'NW', angleDeg: -135, name: '10:30 (NW)'},
] as const;

export interface HawkEyeTrial {
  pair: [string, string];
  centerTarget: string;
  peripheralSector: number; // 0..7
  distractorSectors: number[]; // indices in 0..7 excluding peripheralSector
  exposureMs: number;
}

export function generateHawkEyeTrial(
  level: number,
  exposureMs: number,
  rng: () => number = Math.random
): HawkEyeTrial {
  const pairIdx = Math.floor(rng() * UFOV_SYMBOL_PAIRS.length);
  const pair = UFOV_SYMBOL_PAIRS[pairIdx];
  const centerTarget = rng() < 0.5 ? pair[0] : pair[1];
  const peripheralSector = Math.floor(rng() * 8);

  const distractorCount = Math.min(6, Math.max(0, level - 1));
  const candidateSectors = [0, 1, 2, 3, 4, 5, 6, 7].filter(
    (s) => s !== peripheralSector
  );
  // Shuffle candidateSectors
  for (let i = candidateSectors.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = candidateSectors[i];
    candidateSectors[i] = candidateSectors[j];
    candidateSectors[j] = tmp;
  }
  const distractorSectors = candidateSectors.slice(0, distractorCount);

  return {
    pair,
    centerTarget,
    peripheralSector,
    distractorSectors,
    exposureMs,
  };
}

/**
 * PHANTOM CODE (Dual N-Back) Sequence & Evaluation
 */
export const NBACK_LETTERS = ['C', 'H', 'K', 'L', 'Q', 'R', 'S', 'T'] as const;
export type NBackLetter = (typeof NBACK_LETTERS)[number];

export interface DualNBackStimulus {
  turnIndex: number;
  position: number; // 0..8 (3x3 grid)
  letter: NBackLetter;
  isPositionMatch: boolean;
  isAudioMatch: boolean;
}

export function generateDualNBackSequence(
  nLevel: number,
  baseTurns = 20,
  rng: () => number = Math.random
): DualNBackStimulus[] {
  const totalTurns = baseTurns + nLevel;
  const sequence: DualNBackStimulus[] = [];

  for (let i = 0; i < totalTurns; i++) {
    let position = Math.floor(rng() * 9);
    let letter = NBACK_LETTERS[Math.floor(rng() * NBACK_LETTERS.length)];

    if (i >= nLevel) {
      const nAgo = sequence[i - nLevel];
      // Controlled ~35% match probability for Position and Audio independently
      const forcePosMatch = rng() < 0.35;
      const forceAudioMatch = rng() < 0.35;

      if (forcePosMatch) {
        position = nAgo.position;
      } else if (position === nAgo.position) {
        position = (position + 1 + Math.floor(rng() * 8)) % 9;
      }

      if (forceAudioMatch) {
        letter = nAgo.letter;
      } else if (letter === nAgo.letter) {
        const otherLetters = NBACK_LETTERS.filter((l) => l !== nAgo.letter);
        letter = otherLetters[Math.floor(rng() * otherLetters.length)];
      }
    }

    const isPositionMatch =
      i >= nLevel ? position === sequence[i - nLevel].position : false;
    const isAudioMatch =
      i >= nLevel ? letter === sequence[i - nLevel].letter : false;

    sequence.push({
      turnIndex: i,
      position,
      letter,
      isPositionMatch,
      isAudioMatch,
    });
  }

  return sequence;
}

export interface NBackTurnResult {
  positionOutcome: 'HIT' | 'MISS' | 'FALSE_ALARM' | 'CORRECT_REJECTION';
  audioOutcome: 'HIT' | 'MISS' | 'FALSE_ALARM' | 'CORRECT_REJECTION';
  perfectTurn: boolean;
  scoreDelta: number;
}

export function evaluateDualNBackTurn(
  stimulus: DualNBackStimulus,
  pressedPosition: boolean,
  pressedAudio: boolean
): NBackTurnResult {
  const positionOutcome = stimulus.isPositionMatch
    ? pressedPosition
      ? 'HIT'
      : 'MISS'
    : pressedPosition
      ? 'FALSE_ALARM'
      : 'CORRECT_REJECTION';

  const audioOutcome = stimulus.isAudioMatch
    ? pressedAudio
      ? 'HIT'
      : 'MISS'
    : pressedAudio
      ? 'FALSE_ALARM'
      : 'CORRECT_REJECTION';

  const posCorrect =
    positionOutcome === 'HIT' || positionOutcome === 'CORRECT_REJECTION';
  const audCorrect =
    audioOutcome === 'HIT' || audioOutcome === 'CORRECT_REJECTION';
  const perfectTurn = posCorrect && audCorrect;

  let scoreDelta = 0;
  if (positionOutcome === 'HIT') scoreDelta += 150;
  if (audioOutcome === 'HIT') scoreDelta += 150;
  if (positionOutcome === 'CORRECT_REJECTION') scoreDelta += 40;
  if (audioOutcome === 'CORRECT_REJECTION') scoreDelta += 40;
  if (positionOutcome === 'FALSE_ALARM') scoreDelta -= 60;
  if (audioOutcome === 'FALSE_ALARM') scoreDelta -= 60;
  if (positionOutcome === 'MISS') scoreDelta -= 50;
  if (audioOutcome === 'MISS') scoreDelta -= 50;

  return {
    positionOutcome,
    audioOutcome,
    perfectTurn,
    scoreDelta: Math.max(0, scoreDelta),
  };
}

/**
 * LASER DRIVE (UCSF NeuroRacer) Go / No-Go Target & Interference Calculation
 */
export type LaserTargetShape = 'TRIANGLE' | 'SQUARE' | 'DIAMOND' | 'HEXAGON';
export type LaserTargetColor = 'GREEN' | 'RED' | 'CYAN' | 'PURPLE';

export interface LaserDriveTarget {
  shape: LaserTargetShape;
  color: LaserTargetColor;
  isGoTarget: boolean; // ONLY GREEN TRIANGLE is GO!
  label: string;
}

export function generateLaserDriveTarget(
  rng: () => number = Math.random
): LaserDriveTarget {
  // ~45% probability of Go Target (GREEN TRIANGLE), ~55% No-Go Distractor
  const isGo = rng() < 0.45;
  if (isGo) {
    return {
      shape: 'TRIANGLE',
      color: 'GREEN',
      isGoTarget: true,
      label: 'GREEN TRIANGLE [GO]',
    };
  }

  const distractors: Array<{
    shape: LaserTargetShape;
    color: LaserTargetColor;
    label: string;
  }> = [
    {shape: 'TRIANGLE', color: 'RED', label: 'RED TRIANGLE [HOLD]'},
    {shape: 'SQUARE', color: 'GREEN', label: 'GREEN SQUARE [HOLD]'},
    {shape: 'DIAMOND', color: 'GREEN', label: 'GREEN DIAMOND [HOLD]'},
    {shape: 'TRIANGLE', color: 'PURPLE', label: 'PURPLE TRIANGLE [HOLD]'},
    {shape: 'HEXAGON', color: 'RED', label: 'RED HEXAGON [HOLD]'},
  ];
  const pick = distractors[Math.floor(rng() * distractors.length)];
  return {
    ...pick,
    isGoTarget: false,
  };
}

/**
 * Calculates Multitask Interference Cost (%)
 * Lower interference cost (closer to 0%) = stronger prefrontal cognitive control.
 */
export function calculateInterferenceCost(
  singleTaskTrackingPct: number,
  dualTaskTrackingPct: number,
  goNoGoAccuracyPct: number
): {
  interferenceCostPct: number;
  synergyScore: number;
  grade: 'S+' | 'A' | 'B' | 'C';
} {
  const rawDrop = Math.max(0, singleTaskTrackingPct - dualTaskTrackingPct);
  const accuracyPenalty = Math.max(0, (100 - goNoGoAccuracyPct) * 0.35);
  const interferenceCostPct = Number(
    Math.min(65, rawDrop + accuracyPenalty).toFixed(1)
  );
  const synergyScore = Math.round(
    dualTaskTrackingPct * 6 + goNoGoAccuracyPct * 6 - interferenceCostPct * 8
  );

  let grade: 'S+' | 'A' | 'B' | 'C' = 'C';
  if (interferenceCostPct <= 8 && goNoGoAccuracyPct >= 85) grade = 'S+';
  else if (interferenceCostPct <= 15 && goNoGoAccuracyPct >= 75) grade = 'A';
  else if (interferenceCostPct <= 25) grade = 'B';

  return {
    interferenceCostPct,
    synergyScore: Math.max(100, synergyScore),
    grade,
  };
}
