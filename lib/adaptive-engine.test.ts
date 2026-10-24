import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialAdaptiveState,
  recordTrialAndAdapt,
  getRecentWindowStats,
  calculateBdnfMultiplier,
  generateHawkEyeTrial,
  generateDualNBackSequence,
  evaluateDualNBackTurn,
  generateLaserDriveTarget,
  calculateInterferenceCost,
} from './adaptive-engine';

test('AdaptiveEngine: 3 consecutive fast correct answers immediately increase difficulty and shorten exposure', () => {
  let state = createInitialAdaptiveState({
    initialLevel: 1,
    initialExposureMs: 250,
  });

  state = recordTrialAndAdapt(state, true, 600);
  assert.equal(state.level, 1);
  assert.equal(state.consecutiveCorrect, 1);

  state = recordTrialAndAdapt(state, true, 580);
  assert.equal(state.level, 1);
  assert.equal(state.consecutiveCorrect, 2);

  state = recordTrialAndAdapt(state, true, 550);
  assert.equal(state.level, 2);
  assert.equal(state.exposureMs, 230); // shortened by 20ms
  assert.equal(state.consecutiveCorrect, 0);
  assert.equal(state.lastAdjustment, 'UP');
  assert.ok(state.distractorCount >= 1);
});

test('AdaptiveEngine: 2 consecutive wrong answers decrease difficulty and lengthen exposure', () => {
  let state = createInitialAdaptiveState({
    initialLevel: 3,
    initialExposureMs: 180,
  });

  state = recordTrialAndAdapt(state, false, 1100);
  assert.equal(state.level, 3);
  assert.equal(state.consecutiveWrong, 1);

  state = recordTrialAndAdapt(state, false, 1200);
  assert.equal(state.level, 2);
  assert.equal(state.exposureMs, 200); // extended by 20ms
  assert.equal(state.consecutiveWrong, 0);
  assert.equal(state.lastAdjustment, 'DOWN');
});

test('AdaptiveEngine: exposureMs clamps to minExposureMs (30ms)', () => {
  let state = createInitialAdaptiveState({
    initialLevel: 9,
    initialExposureMs: 40,
  });

  state = recordTrialAndAdapt(state, true, 500);
  state = recordTrialAndAdapt(state, true, 500);
  state = recordTrialAndAdapt(state, true, 500);

  assert.equal(state.exposureMs, 30);
  assert.equal(state.level, 10);
});

test('Recent window stats calculate 5-trial rolling accuracy and reaction speed', () => {
  let state = createInitialAdaptiveState();
  state = recordTrialAndAdapt(state, true, 500);
  state = recordTrialAndAdapt(state, true, 600);
  state = recordTrialAndAdapt(state, false, 900);
  state = recordTrialAndAdapt(state, true, 500);
  state = recordTrialAndAdapt(state, true, 500);

  const stats = getRecentWindowStats(state, 5);
  assert.equal(stats.accuracyPct, 80);
  assert.equal(stats.avgReactionMs, 600);
  assert.equal(stats.inSweetSpot, true);
});

test('BDNF multiplier returns 1.0x, 1.5x, and 2.0x accurately', () => {
  assert.equal(calculateBdnfMultiplier(false, false), 1.0);
  assert.equal(calculateBdnfMultiplier(true, false), 1.5);
  assert.equal(calculateBdnfMultiplier(false, true), 1.5);
  assert.equal(calculateBdnfMultiplier(true, true), 2.0);
});

test('Hawk Eye trial generator assigns distinct target and distractor sectors', () => {
  const trial = generateHawkEyeTrial(4, 190);
  assert.ok(trial.pair.includes(trial.centerTarget));
  assert.ok(trial.peripheralSector >= 0 && trial.peripheralSector <= 7);
  assert.equal(trial.distractorSectors.length, 3);
  assert.ok(!trial.distractorSectors.includes(trial.peripheralSector));
});

test('Dual N-Back sequence generator and evaluator score hits and false alarms accurately', () => {
  const seq = generateDualNBackSequence(2, 20);
  assert.equal(seq.length, 22);
  assert.equal(seq[0].isPositionMatch, false);
  assert.equal(seq[1].isPositionMatch, false);

  for (let i = 2; i < seq.length; i++) {
    assert.equal(
      seq[i].isPositionMatch,
      seq[i].position === seq[i - 2].position
    );
    assert.equal(seq[i].isAudioMatch, seq[i].letter === seq[i - 2].letter);
  }

  const evalHit = evaluateDualNBackTurn(
    {
      turnIndex: 3,
      position: 4,
      letter: 'K',
      isPositionMatch: true,
      isAudioMatch: false,
    },
    true,
    false
  );
  assert.equal(evalHit.positionOutcome, 'HIT');
  assert.equal(evalHit.audioOutcome, 'CORRECT_REJECTION');
  assert.equal(evalHit.perfectTurn, true);
});

test('Laser Drive target discrimination and interference cost calculation', () => {
  const goTarget = generateLaserDriveTarget(() => 0.1);
  assert.equal(goTarget.isGoTarget, true);
  assert.equal(goTarget.color, 'GREEN');
  assert.equal(goTarget.shape, 'TRIANGLE');

  const noGoTarget = generateLaserDriveTarget(() => 0.8);
  assert.equal(noGoTarget.isGoTarget, false);

  const metrics = calculateInterferenceCost(94, 88, 90);
  assert.ok(metrics.interferenceCostPct < 12);
  assert.equal(metrics.grade, 'A');
});
