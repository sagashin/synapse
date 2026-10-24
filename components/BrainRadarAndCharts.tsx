'use client';

import React, {useState} from 'react';
import type {DailyScorePoint, SynapseSaveState} from '@/lib/storage';

interface BrainRadarAndChartsProps {
  state: SynapseSaveState;
  bdnfMultiplier: number;
}

export default function BrainRadarAndCharts({
  state,
  bdnfMultiplier,
}: BrainRadarAndChartsProps) {
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(
    state.dailyHistory.length - 1
  );

  // Normalize 4 core brain specs into 0..100 radar scores
  const speedNorm = Math.min(
    100,
    Math.max(25, Math.round(100 - (state.minExposureMs - 30) * 0.34))
  );
  const ufovNorm = Math.min(100, Math.max(25, state.ufovLevel * 12 + 28));
  const memoryNorm = Math.min(100, Math.max(25, state.nBackLevel * 24 + 18));
  const controlNorm = Math.min(
    100,
    Math.max(25, Math.round(100 - state.interferenceCostPct * 2.2))
  );

  const axes = [
    {label: '処理速度 (ms)', value: speedNorm, raw: `${state.minExposureMs}ms`, angle: -90},
    {label: '有効視野 (UFOV)', value: ufovNorm, raw: `Lv.${state.ufovLevel}`, angle: 0},
    {label: '作業記憶 (N-Back)', value: memoryNorm, raw: `${state.nBackLevel}-Back`, angle: 90},
    {
      label: '干渉制御 (Laser)',
      value: controlNorm,
      raw: `干渉 ${state.interferenceCostPct.toFixed(1)}%`,
      angle: 180,
    },
  ];

  const cx = 135;
  const cy = 125;
  const maxR = 78;

  const getPoint = (angleDeg: number, pct: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    const r = (pct / 100) * maxR;
    return {
      x: cx + Math.cos(rad) * r,
      y: cy + Math.sin(rad) * r,
    };
  };

  const polygonPoints = axes
    .map((a) => {
      const p = getPoint(a.angle, a.value);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(' ');

  // 7-day trend chart geometry
  const chartW = 460;
  const chartH = 195;
  const padL = 38;
  const padR = 20;
  const padT = 22;
  const padB = 34;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const history: DailyScorePoint[] = state.dailyHistory;
  const scorePoints = history.map((d, idx) => {
    const x = padL + (idx / Math.max(1, history.length - 1)) * plotW;
    const y = padT + (1 - (d.synapseScore - 40) / 60) * plotH;
    return {x, y, day: d, idx};
  });

  const polylineStr = scorePoints
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
  const areaStr = `${padL},${padT + plotH} ${polylineStr} ${padL + plotW},${padT + plotH}`;

  const activeDay = history[selectedDayIdx] || history[history.length - 1];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      {/* Left: Brain Spec Radar Calibration (5 cols) */}
      <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-[#0E1422]/90 p-5 flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-display text-lg font-bold text-white">
              脳スペック4軸レーダー (BRAIN SPEC RADAR)
            </h3>
            <p className="text-xs text-slate-300">
              4指標の神経可塑性プロファイル · BDNF倍率 {bdnfMultiplier.toFixed(1)}x
            </p>
          </div>
          <span className="font-mono text-xs text-[#00F0FF] tabular-nums">
            総合指数: {Math.round((speedNorm + ufovNorm + memoryNorm + controlNorm) / 4)}
          </span>
        </div>

        <div className="flex items-center justify-center my-1">
          <svg
            viewBox="0 0 270 250"
            className="w-full max-w-[270px] h-auto overflow-visible"
            role="img"
            aria-label="Brain Spec 4-Axis Radar Chart"
          >
            {/* Concentric calibration polygons */}
            {[25, 50, 75, 100].map((ring) => {
              const pts = axes
                .map((a) => {
                  const p = getPoint(a.angle, ring);
                  return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
                })
                .join(' ');
              return (
                <polygon
                  key={ring}
                  points={pts}
                  fill="none"
                  stroke="rgba(148, 163, 184, 0.2)"
                  strokeWidth="1"
                />
              );
            })}

            {/* Axes */}
            {axes.map((a) => {
              const end = getPoint(a.angle, 100);
              const labelPos = getPoint(a.angle, 126);
              return (
                <g key={a.label}>
                  <line
                    x1={cx}
                    y1={cy}
                    x2={end.x}
                    y2={end.y}
                    stroke="rgba(148, 163, 184, 0.28)"
                    strokeWidth="1"
                  />
                  <text
                    x={labelPos.x}
                    y={labelPos.y - 4}
                    textAnchor="middle"
                    fill="#CBD5E1"
                    className="text-[10px] font-mono font-semibold"
                  >
                    {a.label}
                  </text>
                  <text
                    x={labelPos.x}
                    y={labelPos.y + 9}
                    textAnchor="middle"
                    fill="#00F0FF"
                    className="text-[10px] font-mono font-bold"
                  >
                    {a.raw}
                  </text>
                </g>
              );
            })}

            {/* Active Spec Polygon */}
            <polygon
              points={polygonPoints}
              fill="rgba(0, 240, 255, 0.22)"
              stroke="#00F0FF"
              strokeWidth="2.2"
            />

            {/* Vertices */}
            {axes.map((a) => {
              const p = getPoint(a.angle, a.value);
              return (
                <circle
                  key={a.label}
                  cx={p.x}
                  cy={p.y}
                  r="4"
                  fill="#00FF66"
                  stroke="#0B0F19"
                  strokeWidth="1.5"
                />
              );
            })}
          </svg>
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-800/80 font-mono text-xs tabular-nums">
          <div className="flex items-center justify-between text-slate-300">
            <span>平均反応速度:</span>
            <span className="text-[#00F0FF] font-bold">
              {state.processingSpeedMs} ms
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span>限界露出時間:</span>
            <span className="text-[#00FF66] font-bold">
              {state.minExposureMs} ms
            </span>
          </div>
        </div>
      </div>

      {/* Right: 7-Day Neuroplasticity Trajectory Chart (7 cols) */}
      <div className="lg:col-span-7 rounded-xl border border-slate-800 bg-[#0E1422]/90 p-5 flex flex-col justify-between">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="font-display text-lg font-bold text-white">
              過去7日間のスコア推移グラフ (7-DAY SCORE TREND)
            </h3>
            <p className="text-xs text-slate-300">
              日々のシナプス総合指数（0〜100）および限界露出時間(ms)の推移
            </p>
          </div>

          <div className="font-mono text-xs text-slate-300 tabular-nums">
            選択日: <span className="text-[#00F0FF] font-bold">{activeDay.dateLabel}</span> · スコア{' '}
            <span className="text-[#00FF66] font-bold">{activeDay.synapseScore}</span> · 露出{' '}
            <span className="text-white font-bold">{activeDay.minExposureMs}ms</span>
          </div>
        </div>

        <div className="w-full">
          <svg
            viewBox={`0 0 ${chartW} ${chartH}`}
            className="w-full h-auto"
            role="img"
            aria-label="7-Day Score Trend Line Chart"
          >
            <defs>
              <linearGradient id="synapseAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#00F0FF" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal grid lines */}
            {[50, 70, 90].map((val) => {
              const y = padT + (1 - (val - 40) / 60) * plotH;
              return (
                <g key={val}>
                  <line
                    x1={padL}
                    y1={y}
                    x2={padL + plotW}
                    y2={y}
                    stroke="rgba(148, 163, 184, 0.16)"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={padL - 8}
                    y={y + 3}
                    textAnchor="end"
                    fill="#94A3B8"
                    className="text-[10px] font-mono"
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            {/* Area fill & Line */}
            <polygon points={areaStr} fill="url(#synapseAreaGrad)" />
            <polyline
              fill="none"
              stroke="#00F0FF"
              strokeWidth="2.5"
              points={polylineStr}
            />

            {/* Data nodes */}
            {scorePoints.map((pt) => {
              const isSelected = pt.idx === selectedDayIdx;
              return (
                <g
                  key={pt.day.dateLabel}
                  onClick={() => setSelectedDayIdx(pt.idx)}
                  className="cursor-pointer"
                >
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isSelected ? 6 : 4.5}
                    fill={isSelected ? '#00FF66' : '#0B0F19'}
                    stroke={isSelected ? '#FFFFFF' : '#00F0FF'}
                    strokeWidth="2"
                  />
                  <text
                    x={pt.x}
                    y={pt.y - 10}
                    textAnchor="middle"
                    fill={isSelected ? '#00FF66' : '#CBD5E1'}
                    className="text-[10px] font-mono font-bold"
                  >
                    {pt.day.synapseScore}
                  </text>
                  <text
                    x={pt.x}
                    y={chartH - 10}
                    textAnchor="middle"
                    fill={isSelected ? '#00F0FF' : '#94A3B8'}
                    className="text-[10px] font-mono"
                  >
                    {pt.day.dateLabel}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Bottom 3-pill free unboxed telemetry strip */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-300 tabular-nums">
          <span>
            UFOV限界表示: <strong className="text-[#00F0FF]">{activeDay.minExposureMs} ms</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            作業記憶負荷: <strong className="text-[#8A2BE2]">{activeDay.nBackLevel}-Back</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            マルチタスク干渉コスト: <strong className="text-[#00FF66]">{activeDay.interferenceCostPct}%</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
