import {calculateBdnfMultiplier} from './adaptive-engine';

export interface DailyScorePoint {
  dateLabel: string;
  processingSpeedMs: number;
  minExposureMs: number;
  ufovLevel: number;
  nBackLevel: number;
  interferenceCostPct: number;
  synapseScore: number;
}

export interface SectorProgress {
  hawkEyeCleared: boolean;
  phantomCodeCleared: boolean;
  laserDriveCleared: boolean;
  bossCleared: boolean;
  hawkEyeBestScore: number;
  phantomCodeBestScore: number;
  laserDriveBestScore: number;
  bossBestScore: number;
}

export interface SynapseSaveState {
  processingSpeedMs: number;
  minExposureMs: number;
  ufovLevel: number;
  nBackLevel: number;
  interferenceCostPct: number;
  totalExp: number;
  rankTitle: string;
  streakDays: number;
  bdnfAerobic: boolean;
  bdnfSleep: boolean;
  sectorProgress: SectorProgress;
  dailyHistory: DailyScorePoint[];
}

const STORAGE_KEY = 'synapse_rogue_mainframe_v1';

export const DEFAULT_SAVE_STATE: SynapseSaveState = {
  processingSpeedMs: 410,
  minExposureMs: 140,
  ufovLevel: 3,
  nBackLevel: 2,
  interferenceCostPct: 12.8,
  totalExp: 2450,
  rankTitle: 'CORTEX NAVIGATOR II',
  streakDays: 7,
  bdnfAerobic: false,
  bdnfSleep: false,
  sectorProgress: {
    hawkEyeCleared: false,
    phantomCodeCleared: false,
    laserDriveCleared: false,
    bossCleared: false,
    hawkEyeBestScore: 1420,
    phantomCodeBestScore: 1680,
    laserDriveBestScore: 1850,
    bossBestScore: 0,
  },
  dailyHistory: [
    {
      dateLabel: 'DAY-6',
      processingSpeedMs: 540,
      minExposureMs: 220,
      ufovLevel: 1,
      nBackLevel: 1,
      interferenceCostPct: 24.5,
      synapseScore: 62,
    },
    {
      dateLabel: 'DAY-5',
      processingSpeedMs: 510,
      minExposureMs: 200,
      ufovLevel: 2,
      nBackLevel: 2,
      interferenceCostPct: 21.0,
      synapseScore: 68,
    },
    {
      dateLabel: 'DAY-4',
      processingSpeedMs: 485,
      minExposureMs: 185,
      ufovLevel: 2,
      nBackLevel: 2,
      interferenceCostPct: 18.4,
      synapseScore: 73,
    },
    {
      dateLabel: 'DAY-3',
      processingSpeedMs: 460,
      minExposureMs: 170,
      ufovLevel: 2,
      nBackLevel: 2,
      interferenceCostPct: 16.2,
      synapseScore: 77,
    },
    {
      dateLabel: 'DAY-2',
      processingSpeedMs: 440,
      minExposureMs: 155,
      ufovLevel: 3,
      nBackLevel: 2,
      interferenceCostPct: 14.5,
      synapseScore: 81,
    },
    {
      dateLabel: 'DAY-1',
      processingSpeedMs: 425,
      minExposureMs: 145,
      ufovLevel: 3,
      nBackLevel: 2,
      interferenceCostPct: 13.6,
      synapseScore: 84,
    },
    {
      dateLabel: 'TODAY',
      processingSpeedMs: 410,
      minExposureMs: 140,
      ufovLevel: 3,
      nBackLevel: 2,
      interferenceCostPct: 12.8,
      synapseScore: 87,
    },
  ],
};

export function loadSynapseState(): SynapseSaveState {
  if (typeof window === 'undefined') return DEFAULT_SAVE_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SAVE_STATE;
    const parsed = JSON.parse(raw) as Partial<SynapseSaveState>;
    return {
      ...DEFAULT_SAVE_STATE,
      ...parsed,
      sectorProgress: {
        ...DEFAULT_SAVE_STATE.sectorProgress,
        ...(parsed.sectorProgress || {}),
      },
      dailyHistory:
        Array.isArray(parsed.dailyHistory) && parsed.dailyHistory.length === 7
          ? parsed.dailyHistory
          : DEFAULT_SAVE_STATE.dailyHistory,
    };
  } catch {
    return DEFAULT_SAVE_STATE;
  }
}

export function saveSynapseState(state: SynapseSaveState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

export function computeRankTitle(totalExp: number): string {
  if (totalExp >= 8000) return 'OMEGA ARCHON V';
  if (totalExp >= 5500) return 'NEURAL COMMANDER IV';
  if (totalExp >= 3800) return 'SYNAPSE VANGUARD III';
  if (totalExp >= 2000) return 'CORTEX NAVIGATOR II';
  return 'CADET INITIATE I';
}

export function recordModuleCompletion(
  current: SynapseSaveState,
  payload: {
    module: 'HAWK_EYE' | 'PHANTOM_CODE' | 'LASER_DRIVE' | 'BOSS_NODE';
    rawExp: number;
    reactionMs?: number;
    minExposureMs?: number;
    ufovLevel?: number;
    nBackLevel?: number;
    interferenceCostPct?: number;
  }
): SynapseSaveState {
  const bdnfMult = calculateBdnfMultiplier(
    current.bdnfAerobic,
    current.bdnfSleep
  );
  const boostedExp = Math.round(payload.rawExp * bdnfMult);
  const nextTotalExp = current.totalExp + boostedExp;

  const nextProcessingSpeedMs = payload.reactionMs
    ? Math.min(current.processingSpeedMs, Math.round(payload.reactionMs))
    : current.processingSpeedMs;

  const nextMinExposureMs = payload.minExposureMs
    ? Math.min(current.minExposureMs, Math.round(payload.minExposureMs))
    : current.minExposureMs;

  const nextUfovLevel = payload.ufovLevel
    ? Math.max(current.ufovLevel, payload.ufovLevel)
    : current.ufovLevel;

  const nextNBackLevel = payload.nBackLevel
    ? Math.max(current.nBackLevel, payload.nBackLevel)
    : current.nBackLevel;

  const nextInterferenceCostPct =
    typeof payload.interferenceCostPct === 'number'
      ? Math.min(current.interferenceCostPct, payload.interferenceCostPct)
      : current.interferenceCostPct;

  const nextSector: SectorProgress = {...current.sectorProgress};
  if (payload.module === 'HAWK_EYE') {
    nextSector.hawkEyeCleared = true;
    nextSector.hawkEyeBestScore = Math.max(
      nextSector.hawkEyeBestScore,
      boostedExp
    );
  } else if (payload.module === 'PHANTOM_CODE') {
    nextSector.phantomCodeCleared = true;
    nextSector.phantomCodeBestScore = Math.max(
      nextSector.phantomCodeBestScore,
      boostedExp
    );
  } else if (payload.module === 'LASER_DRIVE') {
    nextSector.laserDriveCleared = true;
    nextSector.laserDriveBestScore = Math.max(
      nextSector.laserDriveBestScore,
      boostedExp
    );
  } else if (payload.module === 'BOSS_NODE') {
    nextSector.bossCleared = true;
    nextSector.bossBestScore = Math.max(nextSector.bossBestScore, boostedExp);
  }

  // Update TODAY entry in 7-day history
  const nextHistory = current.dailyHistory.map((day, idx) => {
    if (idx !== current.dailyHistory.length - 1) return day;
    const speedScore = Math.max(0, Math.min(100, 100 - (nextMinExposureMs - 30) * 0.35));
    const nBackScore = Math.min(100, nextNBackLevel * 25);
    const controlScore = Math.max(0, Math.min(100, 100 - nextInterferenceCostPct * 2));
    const synapseScore = Math.round(
      speedScore * 0.35 + nBackScore * 0.35 + controlScore * 0.3
    );
    return {
      ...day,
      processingSpeedMs: nextProcessingSpeedMs,
      minExposureMs: nextMinExposureMs,
      ufovLevel: nextUfovLevel,
      nBackLevel: nextNBackLevel,
      interferenceCostPct: nextInterferenceCostPct,
      synapseScore: Math.max(day.synapseScore, synapseScore),
    };
  });

  const nextState: SynapseSaveState = {
    ...current,
    processingSpeedMs: nextProcessingSpeedMs,
    minExposureMs: nextMinExposureMs,
    ufovLevel: nextUfovLevel,
    nBackLevel: nextNBackLevel,
    interferenceCostPct: nextInterferenceCostPct,
    totalExp: nextTotalExp,
    rankTitle: computeRankTitle(nextTotalExp),
    sectorProgress: nextSector,
    dailyHistory: nextHistory,
  };

  saveSynapseState(nextState);
  return nextState;
}
